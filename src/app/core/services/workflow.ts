import { Injectable, inject } from '@angular/core';
import { FirebaseService } from './firebase';
import { Auth } from './auth';
import { HistoryService } from './history';
import {
  FlujoAprobacion,
  FlujoAprobacionPayload,
  EstadoFlujo,
  ResultadoEtapa,
  EtapaAprobacion,
  ResumenFlujos,
  calcularPeriodosParaCierre,
  calcularFechaProyectada,
  calcularAvanceFlujo,
  siguienteOrden,
  nombreDeEtapa,
  admiteResolucion,
  admiteReanudacion,
  validarFlujo,
  ajustarNombresEtapas,
  resumirFlujos,
  TIPOS_FLUJO,
  PRIORIDADES_FLUJO,
  ESTADOS_FLUJO,
  RESULTADOS_ETAPA
} from '../models/workflow.model';
import { TenantService } from './tenant';
import { Permiso } from '../models/rbac.model';

/**
 * Flujos de aprobación por etapas.
 *
 * Un flujo recorre etapas en orden. Solo una etapa aprobada hace avanzar el
 * contador; observarla devuelve el documento sin mover el flujo, y
 * rechazarla lo suspende. Cada resolución deja asiento en la bitácora, que
 * es la evidencia del proceso ante una auditoría.
 */
@Injectable({ providedIn: 'root' })
export class WorkflowService {
  private firebase = inject(FirebaseService);
  private authService = inject(Auth);
  private tenant = inject(TenantService);
  private historyService = inject(HistoryService);

  // ============================================
  // LECTURA
  // ============================================

  /**
   * Todos los flujos, cualquiera que sea su estado.
   *
   * La consulta anterior filtraba por `status == 'active'`, de modo que un
   * flujo completado desaparecía del listado en cuanto se aprobaba su
   * última etapa: justo cuando más interesa verlo.
   */
  /** Corta la operacion si el rol no alcanza. */
  private exigir(permiso: Permiso): void {
    if (!this.tenant.puede(permiso)) {
      throw new Error('Tu rol no permite esta accion.');
    }
  }

  async getAll(): Promise<FlujoAprobacion[]> {
    const userId = this.tenant.empresaOpcional();
    if (!userId) return [];

    const data = await this.firebase.getTodosLosFlujos(userId);
    return (data as any[])
      .map(f => this.normalizar(f))
      .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
  }

  /** Solo los que siguen recorriendo etapas. */
  async getEnCurso(): Promise<FlujoAprobacion[]> {
    return (await this.getAll()).filter(f => f.status === 'active');
  }

  async getById(flujoId: string): Promise<FlujoAprobacion | null> {
    const userId = this.tenant.empresaOpcional();
    if (!userId) return null;

    const data = await this.firebase.getFlujoPorId(userId, flujoId);
    return data ? this.normalizar(data) : null;
  }

  async getResumen(precargados?: FlujoAprobacion[]): Promise<ResumenFlujos> {
    return resumirFlujos(precargados ?? await this.getAll());
  }

  // ============================================
  // ALTA, EDICION Y BAJA
  // ============================================

  async create(payload: FlujoAprobacionPayload): Promise<FlujoAprobacion> {
    const userId = this.tenant.empresaOpcional();
    if (!userId) throw new Error('No autenticado');

    const invalido = validarFlujo(payload);
    if (invalido) throw new Error(invalido);

    const etapasCompletadas = payload.etapasCompletadas || 0;
    const periodosParaCierre = calcularPeriodosParaCierre(
      payload.etapasTotales, etapasCompletadas, payload.etapasPorPeriodo
    );

    const data = {
      ...payload,
      name: payload.name.trim(),
      description: payload.description?.trim(),
      nombresEtapas: ajustarNombresEtapas(payload.nombresEtapas ?? [], payload.etapasTotales),
      etapasCompletadas,
      periodosParaCierre,
      fechaProyectadaCierre: periodosParaCierre
        ? calcularFechaProyectada(periodosParaCierre)
        : undefined,
      priority: payload.priority || 'medium',
      status: 'active' as EstadoFlujo,
      estaCompletado: false,
      etapas: []
    };

    const creado = await this.firebase.crearFlujo(userId, data);
    await this.asentar(creado.name, 'creacion', `Flujo de ${payload.etapasTotales} etapas`);
    return this.normalizar(creado);
  }

  async update(flujoId: string, payload: Partial<FlujoAprobacionPayload>): Promise<FlujoAprobacion> {
    this.exigir(Permiso.FLUJO_EDITAR);
    const userId = this.tenant.empresaOpcional();
    if (!userId) throw new Error('No autenticado');

    const existente = await this.getById(flujoId);
    if (!existente) throw new Error('Ese flujo ya no existe.');

    const fusionado = { ...existente, ...payload } as FlujoAprobacionPayload;
    const invalido = validarFlujo(fusionado);
    if (invalido) throw new Error(invalido);

    // Reducir el total por debajo de lo ya aprobado dejaría el flujo con un
    // avance superior al cien por cien.
    if (fusionado.etapasTotales < existente.etapasCompletadas) {
      throw new Error(
        `Ya hay ${existente.etapasCompletadas} etapas aprobadas: el total no puede bajar de ahí.`
      );
    }

    const etapasTotales     = fusionado.etapasTotales;
    const etapasPorPeriodo  = fusionado.etapasPorPeriodo;
    const etapasCompletadas = existente.etapasCompletadas;

    const periodosParaCierre = calcularPeriodosParaCierre(
      etapasTotales, etapasCompletadas, etapasPorPeriodo
    );

    const cambios: Record<string, unknown> = {
      ...payload,
      name: payload.name?.trim() ?? existente.name,
      description: payload.description?.trim(),
      nombresEtapas: ajustarNombresEtapas(
        payload.nombresEtapas ?? existente.nombresEtapas ?? [], etapasTotales
      ),
      periodosParaCierre,
      fechaProyectadaCierre: periodosParaCierre
        ? calcularFechaProyectada(periodosParaCierre)
        : undefined,
      // Ampliar el total reabre un flujo que se daba por cerrado.
      estaCompletado: etapasCompletadas >= etapasTotales,
      status: etapasCompletadas >= etapasTotales
        ? 'completed'
        : (existente.status === 'completed' ? 'active' : existente.status),
      updatedAt: new Date().toISOString()
    };

    await this.firebase.actualizarFlujo(userId, flujoId, cambios);
    await this.asentar(cambios['name'] as string, 'edicion', 'Se ajustó la definición del flujo');

    return (await this.getById(flujoId))!;
  }

  /**
   * Retira el flujo del seguimiento sin borrarlo.
   *
   * En un sistema documental nada se elimina físicamente: el flujo queda
   * anulado y sigue consultable, porque forma parte del expediente.
   */
  async delete(flujoId: string, motivo?: string): Promise<void> {
    const userId = this.tenant.empresaOpcional();
    if (!userId) throw new Error('No autenticado');

    const flujo = await this.getById(flujoId);
    if (!flujo) throw new Error('Ese flujo ya no existe.');

    await this.firebase.anularFlujo(userId, flujoId, motivo?.trim());
    await this.asentar(flujo.name, 'archivado', motivo?.trim() || 'Flujo anulado');
  }

  /** Devuelve al curso un flujo suspendido por rechazo. */
  async reanudar(flujoId: string): Promise<FlujoAprobacion> {
    const userId = this.tenant.empresaOpcional();
    if (!userId) throw new Error('No autenticado');

    const flujo = await this.getById(flujoId);
    if (!flujo) throw new Error('Ese flujo ya no existe.');
    if (!admiteReanudacion(flujo)) {
      throw new Error('Solo se reanuda un flujo suspendido.');
    }

    await this.firebase.actualizarFlujo(userId, flujoId, {
      status: 'active',
      updatedAt: new Date().toISOString()
    });
    await this.asentar(flujo.name, 'envio_revision', 'Flujo reanudado tras el rechazo');

    return (await this.getById(flujoId))!;
  }

  // ============================================
  // RESOLUCION DE ETAPAS
  // ============================================

  /**
   * Registra el resultado de la etapa que toca.
   *
   * El orden no se elige: siempre se resuelve la siguiente pendiente. Sin
   * esa comprobación cualquiera podía firmar la última etapa de un flujo
   * recién creado y darlo por cerrado.
   */
  /**
   * Recalcula el avance del flujo desde sus tareas.
   *
   * Antes habia aqui un resolverEtapa que escribia las resoluciones
   * dentro del flujo pidiendo el aprobador como texto libre. Eso era
   * un segundo motor de aprobacion que ignoraba roles, asignaciones y
   * delegaciones, y que discrepaba de la bandeja. Las etapas se
   * resuelven ahora en ApprovalsService, que es el unico sitio donde
   * se comprueba quien puede hacerlo.
   */
  async sincronizarAvance(flujoId: string, aprobadas: number, total: number): Promise<void> {
    const empresaId = this.tenant.empresaOpcional();
    if (!empresaId) return;

    await this.firebase.actualizarFlujo(empresaId, flujoId, {
      etapasCompletadas: aprobadas,
      estaCompletado: aprobadas >= total,
      updatedAt: new Date().toISOString()
    });
  }

  // ============================================
  // CALCULOS Y CATALOGOS
  // ============================================

  calcAvance(flujo: FlujoAprobacion): number {
    return calcularAvanceFlujo(flujo.etapasCompletadas, flujo.etapasTotales);
  }

  calcFechaEstimada(periodosParaCierre: number | null): string {
    if (periodosParaCierre === null) return 'Sin ritmo definido';
    if (periodosParaCierre === 0) return 'Flujo completado';
    const d = new Date();
    d.setMonth(d.getMonth() + periodosParaCierre);
    return d.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });
  }

  siguienteEtapa(flujo: FlujoAprobacion): { orden: number; nombre: string } | null {
    if (!admiteResolucion(flujo)) return null;
    const orden = siguienteOrden(flujo);
    return { orden, nombre: nombreDeEtapa(flujo, orden) };
  }

  getTipos()       { return TIPOS_FLUJO; }
  getPrioridades() { return PRIORIDADES_FLUJO; }
  getEstados()     { return ESTADOS_FLUJO; }

  /** Compatibilidad con el nombre anterior. */
  getCategories()  { return TIPOS_FLUJO; }
  getPriorities()  { return PRIORIDADES_FLUJO; }

  async getPorPrioridad(priority: 'high' | 'medium' | 'low'): Promise<FlujoAprobacion[]> {
    return (await this.getAll()).filter(f => f.priority === priority);
  }

  async getPorTipo(category: string): Promise<FlujoAprobacion[]> {
    return (await this.getAll()).filter(f => f.category === category);
  }

  async getTotalEtapasCompletadas(): Promise<number> {
    return (await this.getEnCurso()).reduce((s, f) => s + f.etapasCompletadas, 0);
  }

  async getTotalEtapas(): Promise<number> {
    return (await this.getEnCurso()).reduce((s, f) => s + f.etapasTotales, 0);
  }

  // ============================================
  // INTERNO
  // ============================================

  /** Deja constancia en la bitácora sin bloquear la operación principal. */
  private async asentar(titulo: string, accion: string, detalle: string): Promise<void> {
    try {
      await this.historyService.create({
        codigo: 'FLU',
        titulo,
        accion: accion as any,
        responsable: this.authService.currentUser()?.displayName || 'Responsable de archivo',
        detalle,
        category: 'flujo',
        date: this.hoy()
      });
    } catch {
      // Un fallo de bitácora no debe impedir que el flujo avance.
    }
  }

  private hoy(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  /** Rellena los flujos antiguos que no tienen la forma actual. */
  private normalizar(f: any): FlujoAprobacion {
    const etapas: EtapaAprobacion[] = (f.etapas ?? []).map((e: any, i: number) => ({
      id: e.id ?? String(i),
      orden: e.orden ?? i + 1,
      nombre: e.nombre ?? `Etapa ${i + 1}`,
      aprobador: e.aprobador ?? '',
      resultado: (e.resultado ?? 'aprobada') as ResultadoEtapa,
      observacion: e.observacion,
      date: e.date ?? f.createdAt ?? ''
    }));

    return {
      ...f,
      name: f.name ?? 'Flujo sin nombre',
      category: f.category ?? 'otro',
      etapasTotales: f.etapasTotales ?? 1,
      etapasCompletadas: f.etapasCompletadas ?? 0,
      etapasPorPeriodo: f.etapasPorPeriodo ?? 1,
      nombresEtapas: f.nombresEtapas ?? [],
      status: (f.status ?? 'active') as EstadoFlujo,
      priority: f.priority ?? 'medium',
      estaCompletado: f.estaCompletado ?? false,
      periodosParaCierre: f.periodosParaCierre ?? null,
      etapas: etapas.sort((a, b) => a.orden - b.orden || a.date.localeCompare(b.date))
    } as FlujoAprobacion;
  }
}
