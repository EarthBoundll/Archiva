import { Injectable, inject } from '@angular/core';
import { FirebaseService } from './firebase';
import { Auth } from './auth';
import { log } from '../utils/logger';

/** Que se hizo al abrir un periodo nuevo. */
export interface RolloverResult {
  success: boolean;
  previousMonth: string;
  newMonth: string;
  /** Cuotas de almacenamiento trasladadas del periodo anterior. */
  cuotasTrasladadas: number;
  /** Documentos que vencen dentro del periodo y habra que renovar. */
  renovacionesPrevistas: number;
  message: string;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class PeriodRolloverService {
  private firebase = inject(FirebaseService);
  private authService = inject(Auth);

  async checkAndRollover(): Promise<RolloverResult> {
    const userId = this.authService.getUserId();
    if (!userId) throw new Error('No autenticado');

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentMonthId = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

    // Check if current month exists
    const existingMonth = await this.firebase.getEstadoDocumental(userId, currentYear, currentMonth);
    
    if (!existingMonth) {
      // Primera vez en este mes: se crea
      await this.firebase.getOrCreatePeriodo(userId, currentYear, currentMonth);
      
      // Estado documental inicial del mes nuevo
      await this.firebase.actualizarEstadoDocumental(userId, currentMonthId);
    }

    // Return info about the current month setup
    return {
      success: true,
      previousMonth: this.getPreviousMonth(currentYear, currentMonth),
      newMonth: currentMonthId,
      cuotasTrasladadas: 0,
      renovacionesPrevistas: 0,
      message: `Periodo ${currentMonthId} disponible`
    };
  }

  async rolloverToNewMonth(
    targetYear: number, 
    targetMonth: number
  ): Promise<RolloverResult> {
    const userId = this.authService.getUserId();
    if (!userId) throw new Error('No autenticado');

    const targetMonthId = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
    const prevMonthId = this.getPreviousMonth(targetYear, targetMonth);

    try {
      // 1. Asegura que el periodo exista
      await this.firebase.getOrCreatePeriodo(userId, targetYear, targetMonth);

      // 2. Traslada las cuotas del periodo anterior
      const budgetsCopied = await this.copyBudgets(userId, prevMonthId, targetMonthId);

      // 3. Cuenta los documentos que vencen en el periodo
      const renovacionesPrevistas = await this.contarRenovacionesPrevistas(userId, targetYear, targetMonth);

      // 4. Estado documental inicial del periodo
      await this.firebase.actualizarEstadoDocumental(userId, targetMonthId);

      return {
        success: true,
        previousMonth: prevMonthId,
        newMonth: targetMonthId,
        cuotasTrasladadas: budgetsCopied,
        renovacionesPrevistas,
        message: `Periodo abierto: ${budgetsCopied} cuotas trasladadas, ${renovacionesPrevistas} documentos por renovar`
      };
    } catch (error: any) {
      return {
        success: false,
        previousMonth: prevMonthId,
        newMonth: targetMonthId,
        cuotasTrasladadas: 0,
        renovacionesPrevistas: 0,
        message: 'No se pudo abrir el periodo',
        error: error.message
      };
    }
  }

  /** Traslada las cuotas de almacenamiento al periodo siguiente. */
  private async copyBudgets(
    userId: string, 
    fromMonthId: string, 
    toMonthId: string
  ): Promise<number> {
    const budgets = await this.firebase.getCuotasPorPeriodo(userId, 
      parseInt(fromMonthId.split('-')[0]), 
      parseInt(fromMonthId.split('-')[1])
    );

    let count = 0;
    for (const budget of budgets) {
      await this.firebase.definirCuota(userId, {
        ...budget,
        periodoId: toMonthId,
        year: parseInt(toMonthId.split('-')[0]),
        month: parseInt(toMonthId.split('-')[1]),
        // El periodo nuevo hereda la capacidad asignada, no lo ocupado.
        actualAmount: 0,
        disponibleMb: budget.budgetedAmount,
        porcentajeUso: 0,
        status: 'on_track'
      });
      count++;
    }

    return count;
  }

  /**
   * Documentos con ciclo de renovacion que vencen dentro del periodo.
   *
   * La version anterior recorria las solicitudes recurrentes y solo
   * incrementaba un contador: el cuerpo del bucle estaba vacio, asi que
   * informaba de un trabajo que no hacia.
   */
  private async contarRenovacionesPrevistas(
    userId: string,
    year: number,
    month: number
  ): Promise<number> {
    const documentos = await this.firebase.getDocumentosActivos(userId);
    const prefijo = `${year}-${String(month).padStart(2, '0')}`;

    return documentos.filter((d: any) =>
      d.vencimiento?.fechaVencimiento?.startsWith(prefijo)
    ).length;
  }

  private getPreviousMonth(year: number, month: number): string {
    let prevYear = year;
    let prevMonth = month - 1;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear = year - 1;
    }
    return `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
  }

  // Get all months user has data for
  async getPeriodosUsuario(): Promise<{ periodoId: string; hasData: boolean }[]> {
    const userId = this.authService.getUserId();
    if (!userId) return [];

    const months = await this.firebase.getPeriodosUsuario(userId);
    
    return months.map((m: any) => ({
      periodoId: m.id,
      hasData: m.status === 'active'
    }));
  }

  // Delete old month data (cleanup)
  async archiveMonth(year: number, month: number): Promise<void> {
    const userId = this.authService.getUserId();
    if (!userId) throw new Error('No autenticado');

    const periodoId = `${year}-${String(month).padStart(2, '0')}`;
    
    // Just mark as archived instead of deleting
    // In production, you might want to actually delete or move to cold storage
    // For now, we'll just log the archive action
    log.debug(`Month ${periodoId} would be archived - keeping for now`);
  }
}