import { Injectable, inject } from '@angular/core';
import { FirebaseService } from './firebase';
import { Auth } from './auth';
import { log } from '../utils/logger';
import {
  RegistroHistorial,
  RegistroHistorialPayload,
  AccionDocumental,
  TipoMovimiento,
  tipoDeAccion
} from '../models/history.model';

/**
 * Bitacora documental.
 *
 * Es un registro de solo lectura para el usuario: se escribe desde las
 * acciones del ciclo de vida, nunca a mano, y no se edita ni se borra.
 * Esa inmutabilidad es lo que la hace valer como evidencia.
 */
@Injectable({ providedIn: 'root' })
export class HistoryService {
  private firebase = inject(FirebaseService);
  private authService = inject(Auth);

  async getPorPeriodo(year: number, month: number): Promise<RegistroHistorial[]> {
    const userId = this.authService.getUserId();
    if (!userId) return [];

    await this.asegurarUnificada(userId);
    const data = await this.firebase.getHistorialPorPeriodo(userId, year, month);
    return (data as any[]).filter(r => !r.anulado).map(r => this.normalizar(r));
  }

  /** Bitacora completa, para la vista de auditoria. */
  async getBitacora(): Promise<RegistroHistorial[]> {
    const userId = this.authService.getUserId();
    if (!userId) return [];

    await this.asegurarUnificada(userId);
    const data = await this.firebase.getBitacora(userId);
    return (data as any[])
      // Un asiento retirado sigue en la coleccion como evidencia, pero no
      // cuenta en la bitacora que se lee.
      .filter(r => !r.anulado)
      .map(r => this.normalizar(r))
      .sort((a, b) => (b.date + (b.time ?? '')).localeCompare(a.date + (a.time ?? '')));
  }

  async create(payload: RegistroHistorialPayload): Promise<RegistroHistorial> {
    const userId = this.authService.getUserId();
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

  /** Promesa compartida: varias pantallas piden la bitacora a la vez. */
  private migracion: Promise<void> | null = null;

  /**
   * Traslada, la primera vez, los asientos que quedaron en la estructura
   * por periodos. Es idempotente y deja marca en el perfil, asi que en los
   * arranques siguientes no cuesta nada.
   */
  private async asegurarUnificada(userId: string): Promise<void> {
    if (this.migracion) return this.migracion;

    this.migracion = (async () => {
      try {
        const movidos = await this.firebase.migrarHistorialAntiguo(userId);
        if (movidos > 0) log.debug('[Bitacora] asientos trasladados: ' + movidos);
      } catch (e) {
        // Si la migracion falla, la bitacora nueva sigue siendo legible.
        log.warn('[Bitacora] no se pudo unificar el historial antiguo:', e);
      }
    })();

    return this.migracion;
  }

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
