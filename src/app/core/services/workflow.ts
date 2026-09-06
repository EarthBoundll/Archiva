import { Injectable, inject } from '@angular/core';
import { FirebaseService } from './firebase';
import { Auth } from './auth';
import { 
  FlujoAprobacion, 
  FlujoAprobacionPayload,
  calcularPeriodosParaCierre,
  calcularFechaProyectada,
  calcularAvanceFlujo,
  TIPOS_FLUJO,
  PRIORIDADES_FLUJO
} from '../models/workflow.model';

@Injectable({ providedIn: 'root' })
export class WorkflowService {
  private firebase = inject(FirebaseService);
  private authService = inject(Auth);

  // ============================================
  // CRUD Múltiples Goals
  // ============================================
  
  async getAll(): Promise<FlujoAprobacion[]> {
    const userId = this.authService.getUserId();
    if (!userId) return [];

    const data = await this.firebase.getFlujos(userId);
    return data as FlujoAprobacion[];
  }

  async getTodosIncluyendoInactivos(): Promise<FlujoAprobacion[]> {
    const userId = this.authService.getUserId();
    if (!userId) return [];

    const data = await this.firebase.getTodosLosFlujos(userId);
    return data as FlujoAprobacion[];
  }

  async getById(flujoId: string): Promise<FlujoAprobacion | null> {
    const userId = this.authService.getUserId();
    if (!userId) return null;

    const data = await this.firebase.getFlujoPorId(userId, flujoId);
    return data as FlujoAprobacion | null;
  }

  async create(payload: FlujoAprobacionPayload): Promise<FlujoAprobacion> {
    const userId = this.authService.getUserId();
    if (!userId) throw new Error('No autenticado');

    // Calculate months to goal
    const periodosParaCierre = calcularPeriodosParaCierre(
      payload.etapasTotales,
      payload.etapasCompletadas || 0,
      payload.etapasPorPeriodo
    );

    const data = {
      ...payload,
      etapasCompletadas: payload.etapasCompletadas || 0,
      etapasPorPeriodo: payload.etapasPorPeriodo,
      periodosParaCierre,
      fechaProyectadaCierre: periodosParaCierre ? calcularFechaProyectada(periodosParaCierre) : undefined,
      priority: payload.priority || 'medium',
      status: 'active',
      estaCompletado: false,
      etapas: []
    };

    const result = await this.firebase.crearFlujo(userId, data);
    return result as FlujoAprobacion;
  }

  async update(flujoId: string, payload: Partial<FlujoAprobacionPayload>): Promise<FlujoAprobacion> {
    const userId = this.authService.getUserId();
    if (!userId) throw new Error('No autenticado');

    // Get existing goal
    const existing = await this.getById(flujoId);
    if (!existing) throw new Error('Meta no encontrada');

    // Calculate new values
    const etapasTotales = payload.etapasTotales ?? existing.etapasTotales;
    const etapasCompletadas = payload.etapasCompletadas ?? existing.etapasCompletadas;
    const etapasPorPeriodo = payload.etapasPorPeriodo ?? existing.etapasPorPeriodo;

    const periodosParaCierre = calcularPeriodosParaCierre(etapasTotales, etapasCompletadas, etapasPorPeriodo);
    const fechaProyectadaCierre = periodosParaCierre ? calcularFechaProyectada(periodosParaCierre) : undefined;

    const updated = {
      ...existing,
      ...payload,
      periodosParaCierre,
      fechaProyectadaCierre,
      updatedAt: new Date().toISOString()
    };

    await this.firebase.actualizarFlujo(userId, flujoId, updated);
    return updated as FlujoAprobacion;
  }

  async delete(flujoId: string): Promise<void> {
    const userId = this.authService.getUserId();
    if (!userId) throw new Error('No autenticado');

    await this.firebase.eliminarFlujo(userId, flujoId);
  }

  // ============================================
  // Contribuciones
  // ============================================
  
  async aprobarEtapa(flujoId: string, etapa: {
    orden: number;
    nombre: string;
    aprobador: string;
    resultado: 'aprobada' | 'observada';
    observacion?: string;
  }): Promise<FlujoAprobacion> {
    const userId = this.authService.getUserId();
    if (!userId) throw new Error('No autenticado');

    if (!etapa.aprobador.trim()) throw new Error('Indica quien firma la etapa.');
    if (etapa.resultado === 'observada' && !etapa.observacion?.trim()) {
      throw new Error('Indica que hay que corregir: sin eso nadie sabe como continuar.');
    }

    await this.firebase.aprobarEtapa(userId, flujoId, etapa);
    return this.getById(flujoId) as Promise<FlujoAprobacion>;
  }

  // ============================================
  // Helpers
  // ============================================
  
  calcAvance(goal: FlujoAprobacion): number {
    return calcularAvanceFlujo(goal.etapasCompletadas, goal.etapasTotales);
  }

  calcFechaEstimada(periodosParaCierre: number | null): string {
    if (!periodosParaCierre) return 'Meta alcanzada';
    const date = new Date();
    date.setMonth(date.getMonth() + periodosParaCierre);
    return date.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });
  }

  getCategories() {
    return TIPOS_FLUJO;
  }

  getPriorities() {
    return PRIORIDADES_FLUJO;
  }

  // Get goals by priority
  async getPorPrioridad(priority: 'high' | 'medium' | 'low'): Promise<FlujoAprobacion[]> {
    const all = await this.getAll();
    return all.filter(g => g.priority === priority);
  }

  // Flujos de un tipo concreto
  async getPorTipo(category: string): Promise<FlujoAprobacion[]> {
    const all = await this.getAll();
    return all.filter(g => g.category === category);
  }

  // Etapas ya aprobadas, sumadas sobre todos los flujos activos
  async getTotalEtapasCompletadas(): Promise<number> {
    const all = await this.getAll();
    return all
      .filter(g => g.status === 'active')
      .reduce((sum, g) => sum + g.etapasCompletadas, 0);
  }

  // Etapas totales previstas, sumadas sobre todos los flujos activos
  async getTotalEtapas(): Promise<number> {
    const all = await this.getAll();
    return all
      .filter(g => g.status === 'active')
      .reduce((sum, g) => sum + g.etapasTotales, 0);
  }
}