import { Injectable, inject } from '@angular/core';
import { FirebaseService } from './firebase';
import { Auth } from './auth';
import { HistoryService } from './history';
import {
  Documento,
  DocumentoPayload,
  DocumentosPeriodo,
  DocumentoPeriodo,
  CategoriaDocumental,
  TipoDocumental,
  generarOcurrencias,
  proximaOcurrencia,
  calcularEstadoDocumento,
  proyectarRenovaciones,
  TIPOS_DOCUMENTALES,
  esTipoRapido,
  calcularDeducciones
} from '../models/document.model';

@Injectable({ providedIn: 'root' })
export class DocumentService {
  private firebase = inject(FirebaseService);
  private authService = inject(Auth);
  private historyService = inject(HistoryService);

  private localToday(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // ── CRUD ──

  async getAll(): Promise<Documento[]> {
    const userId = this.authService.getUserId();
    if (!userId) return [];
    const data = await this.firebase.getDocumentos(userId);
    return data.map((src: any) => this.enrich(src));
  }

  async getActive(): Promise<Documento[]> {
    const sources = await this.getAll();
    return sources.filter(s => s.activo);
  }

  async create(payload: DocumentoPayload): Promise<Documento> {
    const userId = this.authService.getUserId();
    if (!userId) throw new Error('No autenticado');

    // Asegurar alertarDiasAntes mínimo 1 para recurrentes
    const alertarDiasAntes = payload.renovacion.frequency === 'variable'
      ? null
      : (payload.alertarDiasAntes == null || payload.alertarDiasAntes < 1 ? 3 : payload.alertarDiasAntes);

    const proximasRenovaciones = generarOcurrencias(payload.renovacion, 6);
    const vencimiento = calcularEstadoDocumento(
      payload.renovacion, proximasRenovaciones, undefined, alertarDiasAntes ?? 3
    );

    const data = {
      ...payload,
      alertarDiasAntes,
      userId,
      activo: true,
      actualAmount: 0,
      currency: payload.currency || 'PEN',
      proximasRenovaciones,
      vencimiento,
      fechaUltimaVersion: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const result = await this.firebase.crearDocumento(userId, data);
    return this.enrich(result);
  }

  async update(documentoId: string, payload: Partial<DocumentoPayload>): Promise<void> {
    const userId = this.authService.getUserId();
    if (!userId) throw new Error('No autenticado');

    const updates: any = { ...payload, updatedAt: new Date().toISOString() };

    if (payload.renovacion) {
      const alertDays = payload.alertarDiasAntes == null || payload.alertarDiasAntes < 1 ? 3 : payload.alertarDiasAntes;
      updates.alertarDiasAntes = payload.renovacion.frequency === 'variable' ? null : alertDays;
      updates.proximasRenovaciones = generarOcurrencias(payload.renovacion, 6);
      updates.vencimiento = calcularEstadoDocumento(payload.renovacion, updates.proximasRenovaciones, undefined, alertDays);
    }

    await this.firebase.actualizarDocumento(userId, documentoId, updates);
  }

  async deactivate(documentoId: string): Promise<void> {
    const userId = this.authService.getUserId();
    if (!userId) throw new Error('No autenticado');
    await this.firebase.actualizarDocumento(userId, documentoId, { activo: false, updatedAt: new Date().toISOString() });
  }

  // ── CÁLCULOS ──

  async getDocumentosPeriodo(year: number, month: number, preloadedSources?: Documento[]): Promise<DocumentosPeriodo> {
    const userId = this.authService.getUserId();
    if (!userId) throw new Error('No autenticado');

    const periodoId = `${year}-${String(month).padStart(2, '0')}`;
    const sources = (preloadedSources ?? (await this.getActive())).filter(s => s.activo);

    const byCategory: Record<CategoriaDocumental, number> = {
      contrato: 0, factura: 0, orden_compra: 0, memorando: 0,
      oficio: 0, informe: 0, resolucion: 0, convenio: 0,
      manual: 0, politica: 0, procedimiento: 0, otros: 0
    };

    const monthlySources: DocumentoPeriodo[] = [];
    let totalBudgeted = 0;
    let totalReceived = 0;

    for (const source of sources) {
      const budgeted = source.amount || 0;
      const received = source.actualAmount || 0;

      const deductionsTotal = calcularDeducciones(budgeted, source.deductions);
      const netBudgeted = Math.max(0, budgeted - deductionsTotal);
      const netReceived = received > 0 ? Math.max(0, received - deductionsTotal) : 0;

      byCategory[source.category] += netBudgeted;
      totalBudgeted += netBudgeted;
      totalReceived += netReceived;

      monthlySources.push({
        documentoId: source.id,
        name: source.name,
        category: source.category,
        type: source.type,
        budgeted: netBudgeted,
        received: netReceived,
        expectedDate: source.vencimiento?.fechaVencimiento || null,
        receivedDate: source.fechaUltimaVersion || null,
        status: source.vencimiento?.status || 'pending',
        daysUntilPayment: source.vencimiento?.diasParaVencer ?? null
      });
    }

    const predictions = proyectarRenovaciones(
      sources.map(s => ({ amount: s.amount, renovacion: s.renovacion, proximasRenovaciones: s.proximasRenovaciones })),
      3
    );

    return {
      periodoId, year, month,
      byCategory,
      totalBudgeted,
      totalReceived,
      totalPending: totalBudgeted - totalReceived,
      receivedPercentage: totalBudgeted > 0 ? (totalReceived / totalBudgeted) * 100 : 0,
      sources: monthlySources,
      predictions: {
        nextPaymentDate: predictions[0]?.predicted ? `${predictions[0].month} ${predictions[0].year}` : null,
        nextPaymentAmount: predictions[0]?.predicted || 0,
        expectedEndOfMonth: totalBudgeted
      },
      initialBalance: 0,
      availableNow: totalReceived,
      lastUpdated: new Date().toISOString()
    };
  }

  async registrarNuevaVersion(documentoId: string, actualAmount?: number): Promise<void> {
    const userId = this.authService.getUserId();
    if (!userId) throw new Error('No autenticado');

    // Fecha y hora local (no UTC)
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // Obtener fuente actual para recalcular próximas fechas
    const sources = await this.getAll();
    const source = sources.find(s => s.id === documentoId);
    if (!source) throw new Error('Fuente no encontrada');

    // Clonar recurrencia y avanzar startDate a la siguiente ocurrencia real
    const updatedRecurrence = { ...source.renovacion };
    const paidDate = source.proximasRenovaciones?.[0] ?? today;
    const paid = new Date(paidDate + 'T12:00:00');

    if (updatedRecurrence.frequency !== 'variable') {
      const nextAfterPaid = proximaOcurrencia(updatedRecurrence, paid);
      if (nextAfterPaid) {
        const y = nextAfterPaid.getFullYear();
        const m = String(nextAfterPaid.getMonth() + 1).padStart(2, '0');
        const d = String(nextAfterPaid.getDate()).padStart(2, '0');
        updatedRecurrence.startDate = `${y}-${m}-${d}`;
      } else {
        paid.setDate(paid.getDate() + 1);
        const y = paid.getFullYear();
        const m = String(paid.getMonth() + 1).padStart(2, '0');
        const d = String(paid.getDate()).padStart(2, '0');
        updatedRecurrence.startDate = `${y}-${m}-${d}`;
      }
    } else {
      paid.setDate(paid.getDate() + 1);
      const y = paid.getFullYear();
      const m = String(paid.getMonth() + 1).padStart(2, '0');
      const d = String(paid.getDate()).padStart(2, '0');
      updatedRecurrence.startDate = `${y}-${m}-${d}`;
    }

    // Regenerar ocurrencias con el startDate actualizado
    let proximasRenovaciones: string[] = [];
    if (updatedRecurrence.frequency !== 'variable') {
      proximasRenovaciones = generarOcurrencias(updatedRecurrence, 6);
    }

    // Recalcular estado con la nueva primera fecha
    const alertDays = source.alertarDiasAntes == null || source.alertarDiasAntes < 1 ? 3 : source.alertarDiasAntes;
    const vencimiento = calcularEstadoDocumento(
      updatedRecurrence, proximasRenovaciones, today, alertDays
    );

    // Write 1: Update income source (critical — throws on failure)
    await this.firebase.actualizarDocumento(userId, documentoId, {
      actualAmount: actualAmount ?? null,
      fechaUltimaVersion: today,
      renovacion: updatedRecurrence,
      proximasRenovaciones,
      vencimiento,
      updatedAt: new Date().toISOString()
    });

    // Write 2: Create transaction (non-critical — log error but don't block)
    // Always create transaction when user manually confirms receipt (actualAmount provided)
    if (actualAmount && actualAmount > 0) {
      try {
        await this.historyService.create({
          amount: actualAmount,
          description: `Documento: ${source.name}`,
          date: today,
          type: 'income',
          categoryId: null
        });
      } catch (txError) {
        console.error('Error creating transaction after income confirmation:', txError);
      }
    }

    // Write 3: Add history entry (non-critical — log error but don't block)
    try {
      await this.firebase.agregarBitacora(userId, {
        documentoId: source.id,
        sourceName: source.name,
        type: 'version',
        amount: actualAmount ?? 0,
        date: today,
        time,
        category: source.category,
        description: ''
      });
    } catch (histError) {
      console.error('Error adding income history entry:', histError);
    }
  }

  // ── HELPERS ──

  private enrich(data: any): Documento {
    const source = data as Documento;

    // MIGRACIÓN: datos antiguos usaban 'paymentSchedule', ahora usamos 'renovacion'
    const anySource = source as any;
    if (!source.renovacion && anySource.paymentSchedule) {
      const old = anySource.paymentSchedule;
      source.renovacion = {
        frequency: old.frequency || 'monthly',
        startDate: old.firstPaymentDate || this.localToday()
      };
      // Mapear campos antiguos a nuevos
      if (old.paymentDayOfWeek != null) {
        source.renovacion.weeklyDays = [old.paymentDayOfWeek];
      }
      if (old.paymentDayOfMonth != null) {
        source.renovacion.monthlyRule = { kind: 'day', day: old.paymentDayOfMonth };
      }
      if (old.secondPaymentDay != null) {
        source.renovacion.biweeklyMode = 'two_dates';
        source.renovacion.biweeklyDates = [old.paymentDayOfMonth || 15, old.secondPaymentDay];
      }
    }
    // Asegurar que siempre haya renovacion
    if (!source.renovacion) {
      source.renovacion = { frequency: 'variable', startDate: this.localToday() };
    }

    // Siempre regenerar proximasRenovaciones desde la renovacion rule
    if (source.renovacion.frequency !== 'variable') {
      source.proximasRenovaciones = generarOcurrencias(source.renovacion, 6);
    }

    // Siempre recalcular vencimiento con auto-advance
    const alertDays = source.alertarDiasAntes == null || source.alertarDiasAntes < 1 ? 3 : source.alertarDiasAntes;
    source.vencimiento = calcularEstadoDocumento(
      source.renovacion, source.proximasRenovaciones || [], source.fechaUltimaVersion, alertDays
    );

    return source;
  }

  getTiposDisponibles(category: CategoriaDocumental): { value: TipoDocumental; label: string; icon: string; esRapido?: boolean }[] {
    return (Object.keys(TIPOS_DOCUMENTALES) as TipoDocumental[])
      .filter(t => TIPOS_DOCUMENTALES[t].category === category)
      .map(t => ({ value: t, label: TIPOS_DOCUMENTALES[t].label, icon: TIPOS_DOCUMENTALES[t].icon, esRapido: TIPOS_DOCUMENTALES[t].esRapido }));
  }

  esRapido(type: TipoDocumental): boolean {
    return esTipoRapido(type);
  }
}
