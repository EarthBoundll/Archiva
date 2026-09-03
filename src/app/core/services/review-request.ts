import { Injectable, inject } from '@angular/core';
import { FirebaseService } from './firebase';
import { Auth } from './auth';
import { 
  SolicitudRevision, 
  SolicitudRevisionPayload, 
  ResumenSolicitudes,
  calcularEstadoSolicitud,
  TIPOS_PRIORITARIOS,
  TIPOS_ORDINARIOS,
  getAllTiposSolicitud
} from '../models/review-request.model';

@Injectable({ providedIn: 'root' })
export class ReviewRequestService {
  private firebase = inject(FirebaseService);
  private authService = inject(Auth);

  async getAll(): Promise<SolicitudRevision[]> {
    const userId = this.authService.getUserId();
    if (!userId) return [];

    const data = await this.firebase.getSolicitudes(userId);
    return data as SolicitudRevision[];
  }

  async getActive(): Promise<SolicitudRevision[]> {
    const userId = this.authService.getUserId();
    if (!userId) return [];

    const data = await this.firebase.getSolicitudesActivas(userId);
    return data as SolicitudRevision[];
  }

  async create(payload: SolicitudRevisionPayload): Promise<SolicitudRevision> {
    const userId = this.authService.getUserId();
    if (!userId) throw new Error('No autenticado');

    // Calculate status based on due date
    const status = calcularEstadoSolicitud(
      payload.diaLimiteMes,
      0,
      payload.budgetedAmount
    );

    // Use fechaDisponible as startDate, or default to first day of current month
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const startDate = payload.fechaDisponible || `${currentMonth}-01`;

    const data = {
      ...payload,
      status,
      actualAmount: 0,
      startDate
    };

    const result = await this.firebase.crearSolicitud(userId, data);
    return result as SolicitudRevision;
  }

  async update(solicitudId: string, payload: Partial<SolicitudRevisionPayload>): Promise<void> {
    const userId = this.authService.getUserId();
    if (!userId) throw new Error('No autenticado');

    await this.firebase.actualizarSolicitud(userId, solicitudId, payload);
  }

  async marcarAtendida(solicitudId: string, amount: number): Promise<void> {
    const userId = this.authService.getUserId();
    if (!userId) throw new Error('No autenticado');

    // Obtener el solicitud antes de marcarlo para saber si es recurrente
    const allExpenses = await this.firebase.getSolicitudes(userId);
    const expense = allExpenses.find(e => e.id === solicitudId);

    await this.firebase.marcarSolicitudAtendida(userId, solicitudId, amount);
    await this.firebase.actualizarSolicitud(userId, solicitudId, { activo: false } as any);

    // Si es solicitud recurrente mensual, crear la siguiente ocurrencia para el mes próximo
    if (expense && expense.isRecurring && expense.frequency === 'monthly') {
      const now = new Date();
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const nextMonthStr = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`;

      const newStartDate = `${nextMonthStr}-01`;
      const newDueDate = expense.diaLimiteMes
        ? `${nextMonthStr}-${String(expense.diaLimiteMes).padStart(2, '0')}`
        : undefined;

      const newStatus = calcularEstadoSolicitud(
        expense.diaLimiteMes,
        0,
        expense.budgetedAmount
      );

      await this.firebase.crearSolicitud(userId, {
        esPrioritaria: expense.esPrioritaria,
        category: expense.category,
        subcategory: expense.subcategory || '',
        name: expense.name,
        provider: expense.provider || '',
        description: expense.description || '',
        budgetedAmount: expense.budgetedAmount,
        diaLimiteMes: expense.diaLimiteMes,
        fechaDisponible: newStartDate,
        fechaLimite: newDueDate,
        startDate: newStartDate,
        isRecurring: true,
        frequency: 'monthly',
        esReincidente: expense.esReincidente || false,
        isVariable: expense.isVariable || false,
        ...(expense.umbralAlerta != null ? { umbralAlerta: expense.umbralAlerta } : {}),
        ...(expense.metadata ? { metadata: { ...expense.metadata } } : {}),
        notes: expense.notes || '',
        status: newStatus,
        actualAmount: 0,
        activo: true
      });
    }
  }

  async cancel(solicitudId: string): Promise<void> {
    const userId = this.authService.getUserId();
    if (!userId) throw new Error('No autenticado');

    await this.firebase.anularSolicitud(userId, solicitudId);
  }

  async renovarSolicitudesPeriodicas(allExpenses: SolicitudRevision[]): Promise<void> {
    const userId = this.authService.getUserId();
    if (!userId) throw new Error('No autenticado');

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    // También calcular mes siguiente para detectar si ya fue creado por marcarAtendida
    const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextMonth = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`;

    const recurring = allExpenses.filter(e =>
      e.isRecurring && e.frequency === 'monthly' && e.activo
    );

    for (const exp of recurring) {
      const existing = await this.firebase.getSolicitudes(userId);
      const alreadyRenewed = existing.some(e =>
        e.name === exp.name &&
        e.category === exp.category &&
        (e.startDate?.startsWith(currentMonth) || e.startDate?.startsWith(nextMonth)) &&
        e.activo === true
      );
      if (alreadyRenewed) continue;

      if (exp.status === 'pending' && exp.startDate?.startsWith(currentMonth)) {
        continue;
      }

      if (exp.status !== 'paid' && exp.startDate && !exp.startDate.startsWith(currentMonth)) {
        await this.firebase.actualizarSolicitud(userId, exp.id, {
          status: 'overdue'
        } as any);
      }

      const newStartDate = `${currentMonth}-01`;
      const newDueDate = exp.diaLimiteMes
        ? `${currentMonth}-${String(exp.diaLimiteMes).padStart(2, '0')}`
        : undefined;

      const newStatus = calcularEstadoSolicitud(
        exp.diaLimiteMes,
        0,
        exp.budgetedAmount
      );

      await this.firebase.crearSolicitud(userId, {
        esPrioritaria: exp.esPrioritaria,
        category: exp.category,
        subcategory: exp.subcategory || '',
        name: exp.name,
        provider: exp.provider || '',
        description: exp.description || '',
        budgetedAmount: exp.budgetedAmount,
        diaLimiteMes: exp.diaLimiteMes,
        fechaDisponible: newStartDate,
        fechaLimite: newDueDate,
        startDate: newStartDate,
        isRecurring: true,
        frequency: 'monthly',
        esReincidente: exp.esReincidente || false,
        isVariable: exp.isVariable || false,
        ...(exp.umbralAlerta != null ? { umbralAlerta: exp.umbralAlerta } : {}),
        ...(exp.metadata ? { metadata: { ...exp.metadata } } : {}),
        notes: exp.notes || ''
      });
    }
  }

  async getResumenPeriodo(year: number, month: number): Promise<ResumenSolicitudes> {
    const userId = this.authService.getUserId();
    if (!userId) throw new Error('No autenticado');

    const data = await this.firebase.calcularSolicitudesPeriodo(userId, year, month);
    return data as ResumenSolicitudes;
  }

  // Helper methods
  getTiposPrioritarios() {
    return TIPOS_PRIORITARIOS;
  }

  getTiposOrdinarios() {
    return TIPOS_ORDINARIOS;
  }

  getAllCategories() {
    return getAllTiposSolicitud();
  }
  // Solicitudes prioritarias sugeridas al iniciar
  getSolicitudesPrioritariasPorDefecto(): Partial<SolicitudRevisionPayload>[] {
    return [
      { esPrioritaria: true, category: 'aprobacion_gerencial',      subcategory: 'Visto bueno gerencia', budgetedAmount: 3, diaLimiteMes: 5,  isRecurring: false, frequency: 'monthly' },
      { esPrioritaria: true, category: 'revision_legal',            subcategory: 'Clausulas',            budgetedAmount: 5, diaLimiteMes: 10, isRecurring: false, frequency: 'monthly' },
      { esPrioritaria: true, category: 'actualizacion_vencimiento', subcategory: 'Renovacion anual',     budgetedAmount: 7, diaLimiteMes: 15, isRecurring: true,  frequency: 'monthly' },
      { esPrioritaria: true, category: 'validacion_firma',          subcategory: 'Firma responsable',    budgetedAmount: 2, diaLimiteMes: 20, isRecurring: false, frequency: 'monthly' },
      { esPrioritaria: true, category: 'subsanacion_observacion',   subcategory: 'Contenido',            budgetedAmount: 4, diaLimiteMes: 25, isRecurring: false, frequency: 'monthly' }
    ];
  }

  // Solicitudes ordinarias sugeridas al iniciar
  getSolicitudesOrdinariasPorDefecto(): Partial<SolicitudRevisionPayload>[] {
    return [
      { esPrioritaria: false, category: 'revision_formato',     subcategory: 'Plantilla',       budgetedAmount: 2, diaLimiteMes: 10, isRecurring: false, frequency: 'monthly' },
      { esPrioritaria: false, category: 'revision_ortografica', subcategory: 'Redaccion',       budgetedAmount: 1, diaLimiteMes: 12, isRecurring: false, frequency: 'monthly' },
      { esPrioritaria: false, category: 'actualizacion_anexos', subcategory: 'Agregar anexo',   budgetedAmount: 2, diaLimiteMes: 15, isRecurring: false, frequency: 'monthly' },
      { esPrioritaria: false, category: 'digitalizacion',       subcategory: 'Escaneo',         budgetedAmount: 3, diaLimiteMes: 18, isRecurring: true,  frequency: 'monthly' },
      { esPrioritaria: false, category: 'traslado_archivo',     subcategory: 'Archivo pasivo',  budgetedAmount: 5, diaLimiteMes: 28, isRecurring: true,  frequency: 'monthly' }
    ];
  }
}
