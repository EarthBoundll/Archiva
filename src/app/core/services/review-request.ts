import { Injectable, inject } from '@angular/core';
import { FirebaseService } from './firebase';
import { Auth } from './auth';
import { log } from '../utils/logger';
import {
  SolicitudRevision,
  SolicitudRevisionPayload,
  ResumenSolicitudes,
  EstadoSolicitud,
  TipoSolicitud,
  TipoSolicitudPrioritaria,
  TipoSolicitudOrdinaria,
  TIPOS_PRIORITARIOS,
  TIPOS_ORDINARIOS,
  calcularEstadoSolicitud,
  esTipoPrioritario
} from '../models/review-request.model';

@Injectable({ providedIn: 'root' })
export class ReviewRequestService {
  private firebase = inject(FirebaseService);
  private authService = inject(Auth);

  private hoy(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // ============================================
  // LECTURA
  // ============================================

  async getAll(): Promise<SolicitudRevision[]> {
    const userId = this.authService.getUserId();
    if (!userId) return [];
    const data = await this.firebase.getSolicitudes(userId);
    return (data as any[]).map(s => this.normalizar(s));
  }

  async getAbiertas(): Promise<SolicitudRevision[]> {
    return (await this.getAll()).filter(
      s => s.status === 'pendiente' || s.status === 'en_proceso' || s.status === 'vencida'
    );
  }

  /** Solicitudes que recaen sobre un documento concreto. */
  async getPorDocumento(documentoId: string): Promise<SolicitudRevision[]> {
    return (await this.getAll()).filter(s => s.documentoId === documentoId);
  }

  // ============================================
  // ALTA Y CICLO
  // ============================================

  async create(payload: SolicitudRevisionPayload): Promise<SolicitudRevision> {
    const userId = this.authService.getUserId();
    if (!userId) throw new Error('No autenticado');

    // Reincidencia: ya hubo una solicitud igual, y atendida, sobre este mismo
    // documento. Repetir un hallazgo indica que la correccion no fue de fondo.
    const previas = (await this.getPorDocumento(payload.documentoId))
      .filter(s => s.category === payload.category && s.status === 'atendida');

    const ahora = new Date().toISOString();

    const solicitud = {
      userId,
      documentoId: payload.documentoId,
      codigoDocumento: payload.codigoDocumento,
      tituloDocumento: payload.tituloDocumento,
      esPrioritaria: payload.esPrioritaria,
      category: payload.category,
      titulo: payload.titulo.trim(),
      detalle: payload.detalle?.trim(),
      solicitante: payload.solicitante.trim(),
      revisor: payload.revisor?.trim(),
      origen: payload.origen,
      diasEstimados: payload.diasEstimados || 1,
      diasReales: 0,
      fechaSolicitud: this.hoy(),
      fechaLimiteAtencion: payload.fechaLimiteAtencion,
      status: 'pendiente' as EstadoSolicitud,
      esPeriodica: payload.esPeriodica ?? false,
      frequency: payload.frequency ?? 'unica',
      esReincidente: previas.length > 0,
      vecesRepetida: previas.length,
      activo: true,
      notes: payload.notes,
      createdAt: ahora,
      updatedAt: ahora
    };

    const creada = await this.firebase.crearSolicitud(userId, solicitud);
    return this.normalizar(creada);
  }

  async update(solicitudId: string, cambios: Partial<SolicitudRevisionPayload>): Promise<void> {
    const userId = this.authService.getUserId();
    if (!userId) throw new Error('No autenticado');

    await this.firebase.actualizarSolicitud(userId, solicitudId, {
      ...cambios,
      updatedAt: new Date().toISOString()
    });
  }

  /** Pasa a en proceso: alguien la tomó y está trabajando en ella. */
  async tomar(s: SolicitudRevision, revisor: string): Promise<void> {
    const userId = this.authService.getUserId();
    if (!userId) throw new Error('No autenticado');

    if (s.status === 'atendida' || s.status === 'anulada') {
      throw new Error('Una solicitud ya cerrada no puede volver a tomarse.');
    }

    await this.firebase.actualizarSolicitud(userId, s.id, {
      status: 'en_proceso',
      revisor: revisor.trim() || s.revisor || '',
      updatedAt: new Date().toISOString()
    });
  }

  async marcarAtendida(s: SolicitudRevision, diasReales: number): Promise<void> {
    const userId = this.authService.getUserId();
    if (!userId) throw new Error('No autenticado');

    if (s.status === 'anulada') {
      throw new Error('Una solicitud anulada no puede marcarse como atendida.');
    }

    await this.firebase.marcarSolicitudAtendida(
      userId, s.id, diasReales, this.hoy()
    );
  }

  async anular(s: SolicitudRevision, motivo: string): Promise<void> {
    const userId = this.authService.getUserId();
    if (!userId) throw new Error('No autenticado');

    if (!motivo.trim()) {
      throw new Error('Indica por qué se anula: queda registrado en la solicitud.');
    }

    await this.firebase.actualizarSolicitud(userId, s.id, {
      status: 'anulada',
      activo: false,
      notes: motivo.trim(),
      updatedAt: new Date().toISOString()
    });
  }

  // ============================================
  // AGREGADOS
  // ============================================

  async getResumenPeriodo(precargadas?: SolicitudRevision[]): Promise<ResumenSolicitudes> {
    const todas = precargadas ?? await this.getAll();

    const cuenta = (e: EstadoSolicitud) => todas.filter(s => s.status === e).length;

    const atendidas = todas.filter(s => s.status === 'atendida');
    const dias = atendidas
      .map(s => s.diasReales)
      .filter(d => typeof d === 'number' && d >= 0);

    const d = new Date();

    return {
      periodoId: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      total: todas.length,
      pendientes: cuenta('pendiente'),
      enProceso: cuenta('en_proceso'),
      atendidas: atendidas.length,
      vencidas: cuenta('vencida'),
      prioritariasAbiertas: todas.filter(
        s => s.esPrioritaria && s.status !== 'atendida' && s.status !== 'anulada'
      ).length,
      reincidentes: todas.filter(s => s.esReincidente).length,
      tasaAtencion: todas.length > 0
        ? Math.round((atendidas.length / todas.length) * 100)
        : 0,
      diasPromedioAtencion: dias.length
        ? Math.round(dias.reduce((a, b) => a + b, 0) / dias.length)
        : null,
      ultimaActualizacion: new Date().toISOString()
    };
  }

  // ============================================
  // CATALOGOS
  // ============================================

  getTiposPrioritarios() {
    return (Object.keys(TIPOS_PRIORITARIOS) as TipoSolicitudPrioritaria[])
      .map(t => ({ value: t as TipoSolicitud, ...TIPOS_PRIORITARIOS[t] }));
  }

  getTiposOrdinarios() {
    return (Object.keys(TIPOS_ORDINARIOS) as TipoSolicitudOrdinaria[])
      .map(t => ({ value: t as TipoSolicitud, ...TIPOS_ORDINARIOS[t] }));
  }

  getTodosLosTipos() {
    return [...this.getTiposPrioritarios(), ...this.getTiposOrdinarios()];
  }

  // ============================================
  // INTERNO
  // ============================================

  /** Rellena y recalcula lo que pueda faltar en registros antiguos. */
  private normalizar(s: any): SolicitudRevision {
    const base: SolicitudRevision = {
      ...s,
      documentoId: s.documentoId ?? '',
      codigoDocumento: s.codigoDocumento ?? '—',
      tituloDocumento: s.tituloDocumento ?? '',
      esPrioritaria: s.esPrioritaria ?? esTipoPrioritario(s.category),
      titulo: s.titulo ?? s.name ?? 'Sin título',
      solicitante: s.solicitante ?? '',
      origen: s.origen ?? 'reporte_usuario',
      diasEstimados: s.diasEstimados ?? 1,
      diasReales: s.diasReales ?? 0,
      fechaSolicitud: s.fechaSolicitud ?? s.startDate ?? '',
      fechaLimiteAtencion: s.fechaLimiteAtencion ?? s.fechaLimite ?? '',
      status: s.status ?? 'pendiente',
      esPeriodica: s.esPeriodica ?? s.isRecurring ?? false,
      frequency: s.frequency ?? 'unica',
      activo: s.activo ?? true
    };

    // El vencimiento se deriva de la fecha, no se guarda: si se guardara,
    // una solicitud vencida seguiria pareciendo pendiente hasta que alguien
    // la abriera.
    return { ...base, status: calcularEstadoSolicitud(base) };
  }
}
