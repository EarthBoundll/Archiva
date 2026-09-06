import { Injectable, inject } from '@angular/core';
import { FirebaseService } from './firebase';
import { Auth } from './auth';
import { HistoryService } from './history';
import { log } from '../utils/logger';
import {
  Documento,
  DocumentoPayload,
  CategoriaDocumental,
  TipoDocumental,
  AreaEmisora,
  EstadoDocumental,
  generarOcurrencias,
  calcularVigencia,
  generarCodigo,
  puedeTransicionar,
  ESTADOS_DOCUMENTALES,
  AREAS_EMISORAS,
  TIPOS_DOCUMENTALES
} from '../models/document.model';

/** Resumen del acervo para el tablero y los indicadores. */
export interface ResumenAcervo {
  total: number;
  porEstado: Record<EstadoDocumental, number>;
  porCategoria: Record<string, number>;
  vigentes: number;
  porVencer: number;      // aprobados que vencen en 30 dias o menos
  vencidos: number;
  archivados: number;
  observados: number;
  indiceVigencia: number; // % del acervo controlado que esta aprobado
  tamanioTotalMb: number;
  diasPromedioAprobacion: number | null;
}

@Injectable({ providedIn: 'root' })
export class DocumentService {
  private firebase = inject(FirebaseService);
  private authService = inject(Auth);
  private historyService = inject(HistoryService);

  private hoy(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // ============================================
  // LECTURA
  // ============================================

  async getAll(): Promise<Documento[]> {
    const userId = this.authService.getUserId();
    if (!userId) return [];
    const data = await this.firebase.getDocumentos(userId);
    return data.map((d: any) => this.normalizar(d));
  }

  /** Acervo activo: todo lo que no esta archivado. */
  async getActivos(): Promise<Documento[]> {
    return (await this.getAll()).filter(d => d.activo && d.estado !== 'archivado');
  }

  async getPorEstado(estado: EstadoDocumental): Promise<Documento[]> {
    return (await this.getAll()).filter(d => d.estado === estado);
  }

  /** Documentos aprobados que vencen dentro del plazo indicado. */
  async getPorVencer(dias = 30): Promise<Documento[]> {
    return (await this.getAll()).filter(d =>
      d.estado === 'aprobado' &&
      d.vencimiento.diasParaVencer !== null &&
      d.vencimiento.diasParaVencer >= 0 &&
      d.vencimiento.diasParaVencer <= dias
    );
  }

  // ============================================
  // ALTA Y EDICION
  // ============================================

  async create(payload: DocumentoPayload): Promise<Documento> {
    const userId = this.authService.getUserId();
    if (!userId) throw new Error('No autenticado');

    const codigo = payload.codigo?.trim().toUpperCase()
      || await this.siguienteCodigo(payload.category, payload.area);

    const alertarDiasAntes = payload.renovacion.frequency === 'variable'
      ? null
      : (payload.alertarDiasAntes == null || payload.alertarDiasAntes < 1 ? 30 : payload.alertarDiasAntes);

    const proximasRenovaciones = generarOcurrencias(payload.renovacion, 6);
    const ahora = new Date().toISOString();

    // Todo documento nace en borrador: el ciclo de vida no se salta.
    const doc: Omit<Documento, 'id'> = {
      userId,
      codigo,
      titulo: payload.titulo.trim(),
      descripcion: payload.descripcion,
      version: 1,
      category: payload.category,
      type: payload.type,
      area: payload.area,
      confidencialidad: payload.confidencialidad,
      estado: 'borrador',
      responsable: payload.responsable.trim(),
      elaboradoPor: payload.responsable.trim(),
      ubicacionReferencia: payload.ubicacionReferencia,
      tamanioMb: payload.tamanioMb || 0,
      renovacion: payload.renovacion,
      proximasRenovaciones,
      vencimiento: {
        ...calcularVigencia({ proximasRenovaciones, estado: 'borrador' }),
        renovacionesOmitidas: 0,
        periodosOmitidos: []
      },
      alertarDiasAntes,
      activo: true,
      notes: payload.notes,
      createdAt: ahora,
      updatedAt: ahora
    };

    const creado = await this.firebase.crearDocumento(userId, doc);
    await this.registrarEnBitacora(userId, { ...doc, id: creado.id } as Documento, 'creacion');
    return this.normalizar(creado);
  }

  async update(documentoId: string, payload: Partial<DocumentoPayload>): Promise<void> {
    const userId = this.authService.getUserId();
    if (!userId) throw new Error('No autenticado');

    const cambios: Record<string, unknown> = { updatedAt: new Date().toISOString() };

    for (const campo of ['titulo', 'descripcion', 'responsable', 'ubicacionReferencia',
                         'confidencialidad', 'tamanioMb', 'notes', 'area', 'category', 'type'] as const) {
      if (payload[campo] !== undefined) cambios[campo] = payload[campo];
    }

    if (payload.renovacion) {
      cambios['renovacion'] = payload.renovacion;
      cambios['proximasRenovaciones'] = generarOcurrencias(payload.renovacion, 6);
    }

    await this.firebase.actualizarDocumento(userId, documentoId, cambios);
  }

  // ============================================
  // CICLO DE VIDA
  // ============================================

  /**
   * Aplica una transicion de estado.
   *
   * Rechaza los saltos no permitidos: sin esta comprobacion un documento
   * podia pasar de borrador a aprobado sin revision de nadie.
   */
  async cambiarEstado(
    doc: Documento,
    nuevoEstado: EstadoDocumental,
    opciones: { motivo?: string; responsable?: string } = {}
  ): Promise<void> {
    const userId = this.authService.getUserId();
    if (!userId) throw new Error('No autenticado');

    if (!puedeTransicionar(doc.estado, nuevoEstado)) {
      throw new Error(
        `Un documento ${ESTADOS_DOCUMENTALES[doc.estado].label.toLowerCase()} ` +
        `no puede pasar a ${ESTADOS_DOCUMENTALES[nuevoEstado].label.toLowerCase()}.`
      );
    }

    // Observar y rechazar exigen justificacion: sin ella nadie sabe que corregir.
    if ((nuevoEstado === 'observado' || nuevoEstado === 'rechazado') && !opciones.motivo?.trim()) {
      throw new Error('Indica el motivo: quien reciba el documento necesita saber que corregir.');
    }

    const cambios: Record<string, unknown> = {
      estado: nuevoEstado,
      motivoEstado: opciones.motivo?.trim() ?? '',
      updatedAt: new Date().toISOString()
    };

    if (nuevoEstado === 'en_revision')  cambios['fechaEnvioRevision'] = this.hoy();
    if (nuevoEstado === 'aprobado') {
      cambios['fechaAprobacion'] = this.hoy();
      cambios['aprobadoPor'] = opciones.responsable ?? doc.responsable;
    }
    if (nuevoEstado === 'archivado') cambios['activo'] = false;

    await this.firebase.actualizarDocumento(userId, doc.id, cambios);

    const accion = {
      en_revision: 'envio_revision',
      pendiente_aprobacion: 'envio_revision',
      aprobado: 'aprobacion',
      observado: 'observacion',
      rechazado: 'rechazo',
      archivado: 'archivado',
      borrador: 'edicion',
      vencido: 'edicion'
    }[nuevoEstado];

    await this.registrarEnBitacora(userId, { ...doc, estado: nuevoEstado }, accion);
  }

  /** Registra una version nueva: incrementa el correlativo y reabre el ciclo. */
  async registrarNuevaVersion(
    doc: Documento,
    datos: { tamanioMb?: number; resumenCambio: string }
  ): Promise<void> {
    const userId = this.authService.getUserId();
    if (!userId) throw new Error('No autenticado');

    const proximasRenovaciones = generarOcurrencias(doc.renovacion, 6);

    await this.firebase.actualizarDocumento(userId, doc.id, {
      version: doc.version + 1,
      tamanioMb: datos.tamanioMb ?? doc.tamanioMb,
      estado: 'en_revision',
      motivoEstado: datos.resumenCambio,
      fechaUltimaVersion: this.hoy(),
      fechaEnvioRevision: this.hoy(),
      proximasRenovaciones,
      vencimiento: {
        ...calcularVigencia({ proximasRenovaciones, estado: 'en_revision' }),
        renovacionesOmitidas: 0,
        periodosOmitidos: []
      },
      updatedAt: new Date().toISOString()
    });

    await this.registrarEnBitacora(
      userId, { ...doc, version: doc.version + 1 }, 'nueva_version'
    );
  }

  async archivar(doc: Documento): Promise<void> {
    return this.cambiarEstado(doc, 'archivado');
  }

  // ============================================
  // INDICADORES
  // ============================================

  async getResumenAcervo(precargados?: Documento[]): Promise<ResumenAcervo> {
    const docs = precargados ?? await this.getAll();

    const porEstado = Object.keys(ESTADOS_DOCUMENTALES).reduce((acc, e) => {
      acc[e as EstadoDocumental] = 0;
      return acc;
    }, {} as Record<EstadoDocumental, number>);

    const porCategoria: Record<string, number> = {};
    let tamanioTotalMb = 0;
    const diasAprobacion: number[] = [];

    for (const d of docs) {
      porEstado[d.estado] = (porEstado[d.estado] ?? 0) + 1;
      porCategoria[d.category] = (porCategoria[d.category] ?? 0) + 1;
      tamanioTotalMb += d.tamanioMb || 0;

      if (d.fechaAprobacion && d.fechaEnvioRevision) {
        const dias = Math.round(
          (new Date(d.fechaAprobacion).getTime() - new Date(d.fechaEnvioRevision).getTime()) / 86400000
        );
        if (dias >= 0) diasAprobacion.push(dias);
      }
    }

    const controlados = docs.length - porEstado.archivado;
    const porVencer = docs.filter(d =>
      d.estado === 'aprobado' &&
      d.vencimiento.diasParaVencer !== null &&
      d.vencimiento.diasParaVencer >= 0 &&
      d.vencimiento.diasParaVencer <= 30
    ).length;

    return {
      total: docs.length,
      porEstado,
      porCategoria,
      vigentes: porEstado.aprobado,
      porVencer,
      vencidos: porEstado.vencido,
      archivados: porEstado.archivado,
      observados: porEstado.observado,
      indiceVigencia: controlados > 0 ? Math.round((porEstado.aprobado / controlados) * 100) : 0,
      tamanioTotalMb: Math.round(tamanioTotalMb * 100) / 100,
      diasPromedioAprobacion: diasAprobacion.length
        ? Math.round(diasAprobacion.reduce((a, b) => a + b, 0) / diasAprobacion.length)
        : null
    };
  }

  // ============================================
  // CATALOGOS
  // ============================================

  getTiposDisponibles(category: CategoriaDocumental) {
    return (Object.keys(TIPOS_DOCUMENTALES) as TipoDocumental[])
      .filter(t => TIPOS_DOCUMENTALES[t].category === category)
      .map(t => ({ value: t, label: TIPOS_DOCUMENTALES[t].label, icon: TIPOS_DOCUMENTALES[t].icon }));
  }

  getAreas() {
    return (Object.keys(AREAS_EMISORAS) as AreaEmisora[])
      .map(a => ({ value: a, ...AREAS_EMISORAS[a] }));
  }

  /** Acciones validas desde el estado actual, para no ofrecer lo imposible. */
  getTransicionesPosibles(doc: Documento) {
    const desde = doc.estado;
    return (Object.keys(ESTADOS_DOCUMENTALES) as EstadoDocumental[])
      .filter(e => puedeTransicionar(desde, e))
      .map(e => ({ value: e, ...ESTADOS_DOCUMENTALES[e] }));
  }

  // ============================================
  // INTERNO
  // ============================================

  /** Correlativo siguiente dentro de la misma categoria y area. */
  private async siguienteCodigo(category: CategoriaDocumental, area: AreaEmisora): Promise<string> {
    const docs = await this.getAll();
    const mismos = docs.filter(d => d.category === category && d.area === area);
    return generarCodigo(category, area, mismos.length + 1);
  }

  private async registrarEnBitacora(userId: string, doc: Documento, accion: string): Promise<void> {
    try {
      await this.firebase.agregarBitacora(userId, {
        documentoId: doc.id,
        codigo: doc.codigo,
        titulo: doc.titulo,
        accion,
        version: doc.version,
        category: doc.category,
        responsable: doc.responsable,
        date: this.hoy(),
        time: new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
      });
    } catch (e) {
      // La bitacora no debe impedir la operacion principal.
      log.warn('No se pudo registrar en la bitacora:', e);
    }
  }

  /** Rellena los campos que puedan faltar en documentos antiguos. */
  private normalizar(data: any): Documento {
    const proximasRenovaciones: string[] = data.proximasRenovaciones ?? [];
    const estado: EstadoDocumental = data.estado ?? 'borrador';

    return {
      ...data,
      codigo: data.codigo ?? '—',
      titulo: data.titulo ?? data.name ?? 'Sin titulo',
      version: data.version ?? 1,
      area: data.area ?? 'otros',
      confidencialidad: data.confidencialidad ?? 'interno',
      responsable: data.responsable ?? '',
      tamanioMb: data.tamanioMb ?? 0,
      estado,
      activo: data.activo ?? true,
      proximasRenovaciones,
      vencimiento: {
        ...calcularVigencia({ proximasRenovaciones, estado }),
        renovacionesOmitidas: data.vencimiento?.renovacionesOmitidas ?? 0,
        periodosOmitidos: data.vencimiento?.periodosOmitidos ?? []
      }
    } as Documento;
  }
}
