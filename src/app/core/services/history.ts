import { Injectable, inject } from '@angular/core';
import { FirebaseService } from './firebase';
import {
  RegistroHistorial,
  RegistroHistorialPayload,
  AccionDocumental,
  TipoMovimiento,
  tipoDeAccion
} from '../models/history.model';
import { TenantService } from './tenant';
import { AuditService } from './audit';
import { AccionAuditada, EntidadAuditada } from '../models/audit.model';

/**
 * Bitacora documental.
 *
 * Es un registro de solo lectura para el usuario: se escribe desde las
 * acciones del ciclo de vida, nunca a mano, y no se edita ni se borra.
 * Esa inmutabilidad es lo que la hace valer como evidencia.
 */
/**
 * Que asiento de auditoria corresponde a cada movimiento documental.
 *
 * La tabla es explicita porque los dos vocabularios no son el mismo: la
 * bitacora habla de lo que le pasa a un documento, la auditoria de lo
 * que hizo una persona.
 */
const EQUIVALE: Record<AccionDocumental, AccionAuditada> = {
  creacion:       'creo',
  edicion:        'edito',
  nueva_version:  'edito',
  envio_revision: 'envio_revision',
  aprobacion:     'aprobo',
  observacion:    'observo',
  rechazo:        'rechazo',
  archivado:      'archivo'
};

@Injectable({ providedIn: 'root' })
export class HistoryService {
  private firebase = inject(FirebaseService);
  private tenant = inject(TenantService);
  private audit = inject(AuditService);

  async getPorPeriodo(year: number, month: number): Promise<RegistroHistorial[]> {
    const userId = this.tenant.empresaOpcional();
    if (!userId) return [];

    const data = await this.firebase.getHistorialPorPeriodo(userId, year, month);
    return (data as any[]).filter(r => !r.anulado).map(r => this.normalizar(r));
  }

  /** Bitacora completa, para la vista de auditoria. */
  async getBitacora(): Promise<RegistroHistorial[]> {
    const userId = this.tenant.empresaOpcional();
    if (!userId) return [];

    const data = await this.firebase.getBitacora(userId);
    return (data as any[])
      // Un asiento retirado sigue en la coleccion como evidencia, pero no
      // cuenta en la bitacora que se lee.
      .filter(r => !r.anulado)
      .map(r => this.normalizar(r))
      .sort((a, b) => (b.date + (b.time ?? '')).localeCompare(a.date + (a.time ?? '')));
  }

  /**
   * Registra un movimiento.
   *
   * De aqui salen los dos asientos: el de la bitacora, que cuenta lo que
   * le paso al documento, y el de la auditoria, que cuenta quien lo hizo.
   * Escribir los dos desde el mismo sitio es lo que impide que discrepen.
   *
   * @param traza sobre que entidad se anota en auditoria. Por omision, el
   *              documento; las etapas de aprobacion pasan su tarea.
   */
  async create(
    payload: RegistroHistorialPayload,
    traza?: { entidad: EntidadAuditada; entidadId: string; etiqueta?: string }
  ): Promise<RegistroHistorial> {
    const userId = this.tenant.empresaOpcional();
    if (!userId) throw new Error('No autenticado');

    const ahora = new Date().toISOString();
    const registro = {
      userId,
      documentoId: payload.documentoId ?? null,
      codigo: payload.codigo,
      titulo: payload.titulo,
      accion: payload.accion,
      tipo: tipoDeAccion(payload.accion),
      version: payload.version ?? 1,
      responsable: payload.responsable,
      detalle: payload.detalle ?? '',
      category: payload.category ?? '',
      date: payload.date,
      time: new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
      createdAt: ahora,
      updatedAt: ahora
    };

    const creado = await this.firebase.crearRegistro(userId, registro);

    // La auditoria nunca bloquea: el movimiento ya quedo escrito, y
    // perderlo por no poder anotar quien lo hizo seria peor.
    await this.audit.registrarSobre(
      EQUIVALE[payload.accion],
      traza?.entidad ?? 'documento',
      traza?.entidadId ?? payload.documentoId ?? creado.id,
      traza?.etiqueta ?? `${payload.codigo} · ${payload.titulo}`,
      payload.detalle
    );

    return this.normalizar(creado);
  }

  // ============================================
  // AGREGADOS
  // ============================================

  /** Entradas, salidas y acervo neto acumulado del conjunto. */
  calcTotales(registros: RegistroHistorial[]) {
    let entradas = 0;
    let salidas = 0;

    for (const r of registros) {
      if (r.tipo === 'entrada') entradas++;
      else salidas++;
    }

    return { entradas, salidas, neto: entradas - salidas, total: registros.length };
  }

  /** Cuantos movimientos hubo de cada accion. */
  calcPorAccion(registros: RegistroHistorial[]): Record<string, number> {
    return registros.reduce((acc, r) => {
      acc[r.accion] = (acc[r.accion] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  calcPorCategoria(registros: RegistroHistorial[]): Record<string, number> {
    return registros.reduce((acc, r) => {
      const c = r.category || 'otros';
      acc[c] = (acc[c] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  /** Agrupa por dia, que es como se lee una bitacora. */
  agruparPorDia(registros: RegistroHistorial[]): { fecha: string; registros: RegistroHistorial[] }[] {
    const mapa = new Map<string, RegistroHistorial[]>();

    for (const r of registros) {
      if (!mapa.has(r.date)) mapa.set(r.date, []);
      mapa.get(r.date)!.push(r);
    }

    return [...mapa.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([fecha, registros]) => ({ fecha, registros }));
  }

  // ============================================
  // INTERNO
  // ============================================

/** Rellena los registros antiguos que no tienen la forma nueva. */
  private normalizar(r: any): RegistroHistorial {
    const accion: AccionDocumental = r.accion ?? 'creacion';
    const tipo: TipoMovimiento = r.tipo ?? tipoDeAccion(accion);

    return {
      ...r,
      codigo: r.codigo ?? '—',
      titulo: r.titulo ?? r.sourceName ?? r.description ?? 'Sin título',
      accion,
      tipo,
      version: r.version ?? 1,
      responsable: r.responsable ?? '',
      detalle: r.detalle ?? r.description ?? '',
      date: r.date ?? r.createdAt?.slice(0, 10) ?? ''
    } as RegistroHistorial;
  }
}
