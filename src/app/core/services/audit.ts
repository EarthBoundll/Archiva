import { Injectable, inject } from '@angular/core';
import { FirebaseService } from './firebase';
import { TenantService } from './tenant';
import {
  AsientoAuditoria,
  AsientoPayload,
  AccionAuditada,
  EntidadAuditada,
  agruparPorDia
} from '../models/audit.model';
import { log } from '../utils/logger';

/**
 * Registro de trazabilidad.
 *
 * Cada operación que cambia algo deja un asiento: quién, qué, sobre qué,
 * cuándo y desde qué navegador. Solo se añade —no hay editar ni borrar a
 * propósito—, porque es la evidencia que se presenta ante una auditoría.
 *
 * Registrar nunca bloquea la operación principal: si el asiento falla, el
 * documento ya se guardó y perderlo sería peor que perder la traza.
 */
@Injectable({ providedIn: 'root' })
export class AuditService {
  private firebase = inject(FirebaseService);
  private tenant = inject(TenantService);

  async registrar(p: AsientoPayload): Promise<void> {
    try {
      const empresaId = this.tenant.empresaOpcional();
      const miembro = this.tenant.miembro();
      if (!empresaId || !miembro) return;

      const ahora = new Date();

      await this.firebase.registrarAuditoria(empresaId, {
        actorUid: miembro.uid,
        actorNombre: miembro.nombre || miembro.email,
        actorRol: miembro.rol,

        accion: p.accion,
        entidad: p.entidad,
        entidadId: p.entidadId,
        entidadEtiqueta: p.entidadEtiqueta,
        detalle: p.detalle,

        fecha: this.fecha(ahora),
        hora: ahora.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
        timestamp: ahora.toISOString(),

        // La dirección de red no la conoce el navegador: haría falta que
        // la registrara el servidor. Se guarda el agente, que sí es
        // observable, y la IP queda pendiente de una función de servidor.
        agente: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 180) : undefined
      });
    } catch (e) {
      log.warn('[Auditoría] no se pudo registrar el asiento:', e);
    }
  }

  /** Atajo para las acciones más frecuentes. */
  async registrarSobre(
    accion: AccionAuditada,
    entidad: EntidadAuditada,
    id: string,
    etiqueta: string,
    detalle?: string
  ): Promise<void> {
    return this.registrar({ accion, entidad, entidadId: id, entidadEtiqueta: etiqueta, detalle });
  }

  // ------------------------------------------
  // LECTURA
  // ------------------------------------------

  async getAsientos(limite = 300): Promise<AsientoAuditoria[]> {
    const empresaId = this.tenant.empresaOpcional();
    if (!empresaId) return [];

    const datos = await this.firebase.getAuditoria(empresaId, limite);
    return (datos as any[]).map(a => this.normalizar(a));
  }

  async getPorEntidad(entidad: EntidadAuditada, entidadId: string): Promise<AsientoAuditoria[]> {
    return (await this.getAsientos(500))
      .filter(a => a.entidad === entidad && a.entidadId === entidadId);
  }

  async getPorActor(uid: string): Promise<AsientoAuditoria[]> {
    return (await this.getAsientos(500)).filter(a => a.actorUid === uid);
  }

  async getAgrupados(limite = 300) {
    return agruparPorDia(await this.getAsientos(limite));
  }

  // ------------------------------------------
  // INTERNO
  // ------------------------------------------

  private fecha(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private normalizar(a: any): AsientoAuditoria {
    return {
      ...a,
      actorNombre: a.actorNombre ?? 'Desconocido',
      actorRol: a.actorRol ?? '',
      entidadEtiqueta: a.entidadEtiqueta ?? a.entidadId ?? '',
      fecha: a.fecha ?? (a.timestamp ?? '').slice(0, 10),
      hora: a.hora ?? '',
      timestamp: a.timestamp ?? ''
    } as AsientoAuditoria;
  }
}
