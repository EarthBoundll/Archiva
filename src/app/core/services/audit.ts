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

        // La marca sale de la tenencia, no de quien llama. Si dependiera
        // del argumento, cualquier operacion podria omitirla por descuido
        // — y entonces seria un campo, no una garantia.
        //
        // Se omite cuando es falsa en vez de escribirla: limpiar() retira
        // los indefinidos, asi que un asiento de usuario normal no lleva
        // el campo en absoluto. La coleccion no engorda para el 99% de sus
        // documentos.
        plataforma: this.tenant.esPlataforma() ? true : undefined,
        motivoIntervencion: p.motivoIntervencion,

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

  /**
   * Asienta o falla. La unica via que no perdona.
   *
   * `registrar()` captura sus errores y continua, y es lo correcto para
   * una operacion de usuario: si el documento ya se guardo, perderlo
   * porque no se pudo anotar seria peor que perder la anotacion.
   *
   * Para la entrada de un operador de plataforma esa decision se
   * invierte. Un operador dentro de una empresa sin constancia de haber
   * entrado es exactamente lo que la decision de gobierno prohibe, y
   * «lo intentamos» no es trazabilidad. Asi que aqui el error sube, y
   * quien llama decide — en la practica, aborta la entrada.
   *
   * Es ademas el mismo modo de fallo que produjo A-3: un error de
   * permisos silenciado por un capturador. Merece no repetirse.
   */
  async registrarOFallar(p: AsientoPayload): Promise<void> {
    const empresaId = this.tenant.empresaOpcional();
    const miembro = this.tenant.miembro();

    if (!empresaId || !miembro) {
      throw new Error('No hay empresa ni sesion resuelta: no se puede dejar constancia.');
    }

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

      plataforma: this.tenant.esPlataforma() ? true : undefined,
      motivoIntervencion: p.motivoIntervencion,

      fecha: this.fecha(ahora),
      hora: ahora.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
      timestamp: ahora.toISOString(),

      agente: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 180) : undefined
    });
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
