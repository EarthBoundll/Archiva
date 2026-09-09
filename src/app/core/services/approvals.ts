import { Injectable, inject } from '@angular/core';
import { FirebaseService } from './firebase';
import { TenantService } from './tenant';
import { AuditService } from './audit';
import { HistoryService } from './history';
import { DocumentService } from './document';
import {
  TareaAprobacion,
  ResolucionPayload,
  AccionAprobacion,
  Bandeja,
  ResumenBandeja,
  ACCIONES_APROBACION,
  admiteResolucion,
  puedeResolver,
  estaVencida,
  accionesDisponibles,
  validarResolucion,
  resumirBandeja,
  Traspaso
} from '../models/approval.model';
import { FlujoAprobacion, EtapaDefinida } from '../models/workflow.model';
import { Documento, EstadoDocumental } from '../models/document.model';
import { Permiso } from '../models/rbac.model';
import { AccionAuditada } from '../models/audit.model';
import { AccionDocumental } from '../models/history.model';
import { log } from '../utils/logger';

/** Qué asiento de auditoría corresponde a cada acción. */
const AUDITORIA: Record<AccionAprobacion, AccionAuditada> = {
  aprobar: 'aprobo',
  observar: 'observo',
  rechazar: 'rechazo',
  solicitar_correccion: 'solicito_correccion',
  delegar: 'delego',
  reasignar: 'reasigno'
};

/**
 * Tareas de aprobación y bandejas.
 *
 * Cuando un flujo se abre, cada etapa definida genera una tarea con su
 * responsable. La tarea es lo que aparece en la bandeja de esa persona y
 * lo que sostiene la trazabilidad del expediente.
 *
 * Las tareas viven en su propia colección, no dentro del flujo: la bandeja
 * es una consulta por responsable, y leer todos los flujos de la empresa
 * para filtrar sus etapas no escala.
 */
@Injectable({ providedIn: 'root' })
export class ApprovalsService {
  private firebase = inject(FirebaseService);
  private tenant = inject(TenantService);
  private audit = inject(AuditService);
  private history = inject(HistoryService);
  private documentos = inject(DocumentService);

  // ------------------------------------------
  // APERTURA DE EXPEDIENTE
  // ------------------------------------------

  /**
   * Envia un documento a aprobacion.
   *
   * La plantilla describe como se aprueba algo; el expediente es el paso
   * de un documento concreto por esa plantilla. Se copia en vez de
   * reutilizarse porque un flujo compartido por veinte documentos no
   * podria decir en que etapa va cada uno.
   */
  async enviarAAprobacion(documento: Documento, plantilla: FlujoAprobacion): Promise<FlujoAprobacion> {
    // Enviar a revision, no definir flujos: quien redacta un contrato debe
    // poder mandarlo a aprobar sin poder decidir quien lo aprueba.
    this.exigir(Permiso.DOC_ENVIAR_REVISION);
    const empresaId = this.tenant.exigirEmpresa();

    const etapas = plantilla.etapasDefinidas ?? [];
    if (!etapas.length) {
      throw new Error('Esa plantilla no tiene etapas definidas: nadie tendria que aprobarlo.');
    }
    if (plantilla.activo === false) {
      throw new Error('Esa plantilla esta desactivada y no admite expedientes nuevos.');
    }
    if (await this.documentoBloqueado(documento.id)) {
      throw new Error('Este documento ya esta recorriendo un flujo de aprobacion.');
    }

    const ahora = new Date().toISOString();

    const { flujo } = await this.firebase.crearExpediente(
      empresaId,
      {
        documentoId: documento.id,
        codigoDocumento: documento.codigo,

        name: documento.codigo + ' \u00b7 ' + documento.titulo,
        description: 'Expediente abierto sobre la plantilla \u00ab' + plantilla.name + '\u00bb.',
        category: plantilla.category,

        etapasTotales: etapas.length,
        etapasPorPeriodo: plantilla.etapasPorPeriodo ?? 1,
        etapasDefinidas: etapas,
        nombresEtapas: etapas.map(e => e.nombre),

        activo: true,
        duplicadoDe: plantilla.id,
        priority: plantilla.priority ?? 'medium',
        periodosParaCierre: null
      },
      etapas.map(etapa => this.tareaDeEtapa(etapa, plantilla, etapas.length, documento, ahora))
    );

    await this.audit.registrarSobre(
      'creo', 'flujo', flujo.id, flujo.name,
      etapas.length + ' etapas abiertas'
    );

    // El documento pasa a pendiente de aprobacion: es lo que impide que
    // se edite mientras alguien lo revisa.
    try {
      if (documento.estado !== 'pendiente_aprobacion') {
        await this.documentos.cambiarEstado(documento, 'pendiente_aprobacion', {
          motivo: 'Enviado al flujo \u00ab' + plantilla.name + '\u00bb.'
        });
      }
    } catch {
      // Si la transicion no procede desde su estado actual, el expediente
      // sigue siendo valido: el documento se movera al resolverse.
    }

    return flujo as FlujoAprobacion;
  }

  /** Convierte una etapa definida en la tarea que la sostiene. */
  private tareaDeEtapa(
    etapa: EtapaDefinida,
    flujo: { priority?: string },
    total: number,
    documento: Documento | null,
    ahora: string
  ) {
    return {
      flujoNombre: documento ? documento.codigo + ' \u00b7 ' + documento.titulo : '',
      documentoId: documento?.id,
      codigoDocumento: documento?.codigo,
      tituloDocumento: documento?.titulo,

      orden: etapa.orden,
      etapaNombre: etapa.nombre,
      etapasTotales: total,

      responsableUid: etapa.responsableUid,
      responsableNombre: etapa.responsableNombre,
      asignadoUid: etapa.responsableUid,
      asignadoNombre: etapa.responsableNombre,
      rolRequerido: etapa.rolRequerido,
      area: etapa.area,

      // Solo la primera se abre; el resto espera su turno.
      estado: etapa.orden === 1 ? 'pendiente' : 'en_curso',
      prioridad: flujo.priority ?? 'medium',

      fechaCreacion: ahora,
      fechaLimite: etapa.plazoDias
        ? new Date(new Date(ahora).getTime() + etapa.plazoDias * 86400000).toISOString()
        : undefined,
      traspasos: []
    };
  }

  /**
   * Abre las tareas de un flujo.
   *
   * Solo la primera queda pendiente: las demás esperan a que la anterior
   * se apruebe. Sin eso, todas aparecerían a la vez en las bandejas y el
   * orden de las etapas dejaría de significar nada.
   */
  async abrirFlujo(flujo: FlujoAprobacion, etapas: EtapaDefinida[]): Promise<TareaAprobacion[]> {
    const empresaId = this.tenant.exigirEmpresa();
    const ahora = new Date().toISOString();

    // En un solo lote: un corte a mitad dejaba un flujo que declaraba N
    // etapas con menos tareas creadas, y el expediente se quedaba mudo
    // al aprobar la ultima que si existia.
    const creadas = await this.firebase.crearTareas(
      empresaId,
      etapas.map(etapa => ({
        ...this.tareaDeEtapa(etapa, flujo, etapas.length, null, ahora),
        flujoId: flujo.id,
        flujoNombre: flujo.name,
        documentoId: flujo.documentoId,
        codigoDocumento: flujo.codigoDocumento,
        tituloDocumento: flujo.name
      }))
    );

    await this.audit.registrarSobre(
      'creo', 'flujo', flujo.id, flujo.name,
      etapas.length + ' etapas abiertas'
    );

    return creadas as TareaAprobacion[];
  }

  // ------------------------------------------
  // LECTURA
  // ------------------------------------------

  async getTodas(): Promise<TareaAprobacion[]> {
    const empresaId = this.tenant.empresaOpcional();
    if (!empresaId) return [];
    return (await this.firebase.getTareas(empresaId)) as TareaAprobacion[];
  }

  async getDeFlujo(flujoId: string): Promise<TareaAprobacion[]> {
    const empresaId = this.tenant.empresaOpcional();
    if (!empresaId) return [];
    const t = (await this.firebase.getTareasDeFlujo(empresaId, flujoId)) as TareaAprobacion[];
    return t.sort((a, b) => a.orden - b.orden);
  }

  /** Contenido de una bandeja concreta. */
  async getBandeja(bandeja: Bandeja): Promise<TareaAprobacion[]> {
    const uid = this.tenant.uid();
    if (!uid) return [];

    const todas = await this.getTodas();

    switch (bandeja) {
      case 'pendientes':
        return todas
          .filter(t => t.asignadoUid === uid && t.estado === 'pendiente')
          .sort(this.porUrgencia);

      case 'aprobaciones':
        return todas
          .filter(t => t.resueltaPorUid === uid && t.accion === 'aprobar')
          .sort(this.porResolucion);

      case 'observaciones':
        return todas
          .filter(t => t.resueltaPorUid === uid &&
                      (t.accion === 'observar' || t.accion === 'solicitar_correccion' || t.accion === 'rechazar'))
          .sort(this.porResolucion);

      case 'documentos':
        // Lo que esta persona puso en circulación.
        return todas
          .filter(t => t.responsableUid === uid && t.orden === 1)
          .sort(this.porUrgencia);

      case 'historial':
        return todas
          .filter(t => t.resueltaPorUid === uid)
          .sort(this.porResolucion);
    }
  }

  async getResumen(): Promise<ResumenBandeja> {
    const uid = this.tenant.uid();
    if (!uid) return { pendientes: 0, vencidas: 0, delegadasAMi: 0, resueltasEstePeriodo: 0, diasPromedio: null };
    return resumirBandeja(await this.getTodas(), uid);
  }

  // ------------------------------------------
  // RESOLUCION
  // ------------------------------------------

  async resolver(tarea: TareaAprobacion, p: ResolucionPayload): Promise<TareaAprobacion> {
    this.exigir(Permiso.APROBAR);

    const uid = this.tenant.uid()!;
    const miembro = this.tenant.miembro()!;
    const empresaId = this.tenant.exigirEmpresa();

    if (!puedeResolver(tarea, uid)) {
      throw new Error(
        admiteResolucion(tarea)
          ? 'Esta etapa está asignada a otra persona.'
          : 'Esta etapa ya está resuelta.'
      );
    }

    const invalido = validarResolucion(p);
    if (invalido) throw new Error(invalido);

    if (p.accion === 'delegar')   this.exigir(Permiso.DELEGAR);
    if (p.accion === 'reasignar') this.exigir(Permiso.REASIGNAR);

    const ahora = new Date().toISOString();
    const nombre = miembro.nombre || miembro.email;

    // Delegar y reasignar no cierran la etapa: la mueven.
    if (p.accion === 'delegar' || p.accion === 'reasignar') {
      const traspaso: Traspaso = {
        tipo: p.accion,
        deUid: uid,
        deNombre: nombre,
        aUid: p.destinatarioUid!,
        aNombre: p.destinatarioNombre ?? '',
        motivo: p.motivo?.trim(),
        fecha: ahora
      };

      const cambios: Partial<TareaAprobacion> = {
        asignadoUid: p.destinatarioUid,
        asignadoNombre: p.destinatarioNombre,
        estado: p.accion === 'delegar' ? 'delegada' : 'pendiente',
        traspasos: [...(tarea.traspasos ?? []), traspaso]
      };

      // Reasignar cambia también al titular: la responsabilidad se
      // transfiere. Delegar no: quien delega sigue respondiendo.
      if (p.accion === 'reasignar') {
        cambios.responsableUid = p.destinatarioUid;
        cambios.responsableNombre = p.destinatarioNombre;
      }

      await this.firebase.actualizarTarea(empresaId, tarea.id, cambios);
      await this.asentar(tarea, p, nombre);
      return { ...tarea, ...cambios } as TareaAprobacion;
    }

    // Aprobar, observar, rechazar y solicitar corrección cierran la etapa.
    const cambios: Partial<TareaAprobacion> = {
      estado: 'resuelta',
      accion: p.accion,
      motivo: p.motivo?.trim(),
      fechaResolucion: ahora,
      resueltaPorUid: uid,
      resueltaPorNombre: nombre
    };

    await this.firebase.actualizarTarea(empresaId, tarea.id, cambios);

    // Aprobar abre la etapa siguiente. Es lo único que hace avanzar el
    // expediente: observar lo devuelve y rechazar lo detiene.
    if (p.accion === 'aprobar') {
      await this.abrirSiguiente(tarea);
    }

    // El expediente tiene que reflejar lo que acaba de pasar: sin esto la
    // barra de avance del flujo y la bandeja contaban cosas distintas.
    await this.repercutir(tarea, p, nombre);

    await this.asentar(tarea, p, nombre);
    return { ...tarea, ...cambios } as TareaAprobacion;
  }

  /** Pone en pendiente la etapa que sigue, si la hay. */
  private async abrirSiguiente(tarea: TareaAprobacion): Promise<void> {
    const empresaId = this.tenant.exigirEmpresa();
    const hermanas = await this.getDeFlujo(tarea.flujoId);
    const siguiente = hermanas.find(t => t.orden === tarea.orden + 1);
    if (!siguiente) return;

    await this.firebase.actualizarTarea(empresaId, siguiente.id, {
      estado: 'pendiente',
      fechaCreacion: new Date().toISOString()
    });
  }

  /**
   * Traslada al expediente y al documento lo que decidio la etapa.
   *
   * El avance se recalcula desde las tareas en vez de llevarse en un
   * contador aparte: dos cifras que cuentan lo mismo acaban discrepando,
   * y en un expediente esa discrepancia es la diferencia entre aprobado
   * y sin aprobar.
   */
  private async repercutir(tarea: TareaAprobacion, p: ResolucionPayload, quien: string): Promise<void> {
    const empresaId = this.tenant.exigirEmpresa();
    const hermanas = await this.getDeFlujo(tarea.flujoId);

    const aprobadas = hermanas.filter(t => t.estado === 'resuelta' && t.accion === 'aprobar').length;
    const detenido  = p.accion === 'rechazar';
    const devuelto  = p.accion === 'observar' || p.accion === 'solicitar_correccion';
    const completo  = p.accion === 'aprobar' && aprobadas >= hermanas.length;

    const cambios: Record<string, unknown> = {
      etapasCompletadas: aprobadas,
      estaCompletado: completo,
      status: detenido ? 'paused' : completo ? 'completed' : 'active',
      updatedAt: new Date().toISOString()
    };
    if (detenido && p.motivo?.trim()) cambios['motivoAnulacion'] = p.motivo.trim();

    await this.firebase.actualizarFlujo(empresaId, tarea.flujoId, cambios);

    // Una etapa devuelta o rechazada detiene el expediente: las que venian
    // detras no deben esperar un turno que ya no va a llegar.
    if (detenido || devuelto) {
      for (const t of hermanas) {
        if (t.orden > tarea.orden && admiteResolucion(t)) {
          await this.firebase.actualizarTarea(empresaId, t.id, { estado: 'anulada' });
        }
      }
    }

    if (tarea.documentoId) {
      await this.moverDocumento(tarea.documentoId, p, quien, completo);
    }
  }

  /** Lleva el documento al estado que le corresponde tras la etapa. */
  private async moverDocumento(
    documentoId: string,
    p: ResolucionPayload,
    quien: string,
    completo: boolean
  ): Promise<void> {
    // Delegar y reasignar cambian de manos, no de estado. Se descartan
    // aqui y no solo en quien llama: si manana alguien encamina las
    // delegaciones por este metodo, un documento se daria por aprobado
    // al delegar su ultima etapa.
    if (p.accion === 'delegar' || p.accion === 'reasignar') return;

    const destino =
      p.accion === 'rechazar' ? 'rechazado' :
      (p.accion === 'observar' || p.accion === 'solicitar_correccion') ? 'observado' :
      completo ? 'aprobado' : null;

    // Aprobar una etapa intermedia no mueve el documento: sigue pendiente
    // hasta que se apruebe la ultima.
    if (!destino) return;

    try {
      const doc = (await this.documentos.getAll()).find(d => d.id === documentoId);
      if (!doc || doc.estado === destino) return;

      await this.documentos.cambiarEstado(doc, destino as EstadoDocumental, {
        motivo: p.motivo?.trim() || 'Resultado del flujo de aprobacion.',
        responsable: quien
      });
    } catch (e) {
      // La etapa ya quedo resuelta y auditada. Perder eso por un estado
      // que un gestor puede corregir a mano seria peor.
      log.warn('[Aprobaciones] no se pudo mover el documento:', e);
    }
  }

  /** Etapas por las que ha pasado un documento, en orden. */
  async expedienteDe(documentoId: string): Promise<TareaAprobacion[]> {
    if (!documentoId) return [];
    return (await this.getTodas())
      .filter(t => t.documentoId === documentoId)
      .sort((a, b) => a.orden - b.orden);
  }

  // ------------------------------------------
  // CONSULTAS DE APOYO
  // ------------------------------------------

  accionesPara(t: TareaAprobacion): AccionAprobacion[] {
    const uid = this.tenant.uid();
    if (!uid) return [];
    return accionesDisponibles(
      t, uid,
      this.tenant.puede(Permiso.DELEGAR),
      this.tenant.puede(Permiso.REASIGNAR)
    );
  }

  vencida(t: TareaAprobacion): boolean {
    return estaVencida(t);
  }

  definicionDe(a: AccionAprobacion) {
    return ACCIONES_APROBACION[a];
  }

  /**
   * ¿Está el documento bloqueado para edición?
   *
   * Un documento con etapas vivas no se edita: cambiar lo que alguien está
   * aprobando invalida la aprobación.
   */
  async documentoBloqueado(documentoId: string): Promise<boolean> {
    if (!documentoId) return false;
    return (await this.getTodas()).some(t =>
      t.documentoId === documentoId && admiteResolucion(t)
    );
  }

  // ------------------------------------------
  // INTERNO
  // ------------------------------------------

  private exigir(permiso: Permiso): void {
    if (!this.tenant.puede(permiso)) {
      throw new Error('Tu rol no permite esta acción.');
    }
  }

  /**
   * Asiento por cada resolucion.
   *
   * Antes se escribian dos por separado: uno en auditoria y otro en
   * bitacora. Ahora sale uno solo, y la bitacora se encarga de las dos
   * proyecciones para que no puedan discrepar.
   */
  private async asentar(t: TareaAprobacion, p: ResolucionPayload, quien: string): Promise<void> {
    const etiqueta = t.flujoNombre + ' \u00b7 ' + t.etapaNombre;

    const accionBitacora: AccionDocumental =
      p.accion === 'aprobar' ? 'aprobacion' :
      p.accion === 'rechazar' ? 'rechazo' :
      p.accion === 'observar' || p.accion === 'solicitar_correccion' ? 'observacion' :
      'envio_revision';

    try {
      await this.history.create({
        documentoId: t.documentoId ?? null,
        codigo: t.codigoDocumento ?? 'FLU',
        titulo: etiqueta,
        accion: accionBitacora,
        responsable: quien,
        detalle: p.motivo?.trim() || ACCIONES_APROBACION[p.accion].label,
        category: 'flujo',
        date: new Date().toISOString().slice(0, 10)
      }, { entidad: 'tarea', entidadId: t.id, etiqueta });
    } catch (e) {
      // La bitacora no debe impedir que la etapa avance.
      log.warn('[Aprobaciones] no se pudo asentar la resolucion:', e);
    }

    // Delegar y reasignar no son movimientos del documento: no cambian
    // su estado, solo de quien depende. Se anotan solo en auditoria.
    if (p.accion === 'delegar' || p.accion === 'reasignar') {
      await this.audit.registrarSobre(
        AUDITORIA[p.accion], 'tarea', t.id, etiqueta,
        p.motivo?.trim() || ACCIONES_APROBACION[p.accion].efecto
      );
    }
  }
  private porUrgencia = (a: TareaAprobacion, b: TareaAprobacion): number => {
    const va = estaVencida(a) ? 0 : 1;
    const vb = estaVencida(b) ? 0 : 1;
    if (va !== vb) return va - vb;
    return (a.fechaLimite ?? a.fechaCreacion).localeCompare(b.fechaLimite ?? b.fechaCreacion);
  };

  private porResolucion = (a: TareaAprobacion, b: TareaAprobacion): number =>
    (b.fechaResolucion ?? '').localeCompare(a.fechaResolucion ?? '');
}
