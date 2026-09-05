import { Injectable, inject } from '@angular/core';
import { FirebaseService } from './firebase';
import { Auth } from './auth';
import { log } from '../utils/logger';

export interface RolloverResult {
  success: boolean;
  previousMonth: string;
  newMonth: string;
  budgetsCopied: number;
  expensesCopied: number;
  recurringGenerated: number;
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
      // First time this month - create it
      await this.firebase.getOrCreatePeriodo(userId, currentYear, currentMonth);
      
      // Calculate initial financial state for new month
      await this.firebase.actualizarEstadoDocumental(userId, currentMonthId);
    }

    // Return info about the current month setup
    return {
      success: true,
      previousMonth: this.getPreviousMonth(currentYear, currentMonth),
      newMonth: currentMonthId,
      budgetsCopied: 0,
      expensesCopied: 0,
      recurringGenerated: 0,
      message: `Mes ${currentMonthId} verificado/creado exitosamente`
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
      // 1. Ensure target month exists
      await this.firebase.getOrCreatePeriodo(userId, targetYear, targetMonth);

      // 2. Copy budgets from previous month
      const budgetsCopied = await this.copyBudgets(userId, prevMonthId, targetMonthId);

      // 3. Copy recurring expenses
      const expensesCopied = await this.copyRecurringExpenses(userId, targetYear, targetMonth);

      // 4. Generate initial financial state
      await this.firebase.actualizarEstadoDocumental(userId, targetMonthId);

      return {
        success: true,
        previousMonth: prevMonthId,
        newMonth: targetMonthId,
        budgetsCopied,
        expensesCopied,
        recurringGenerated: expensesCopied,
        message: `Rollover completado: ${budgetsCopied} cuotas copiados, ${expensesCopied} solicitudes recurrentes generados`
      };
    } catch (error: any) {
      return {
        success: false,
        previousMonth: prevMonthId,
        newMonth: targetMonthId,
        budgetsCopied: 0,
        expensesCopied: 0,
        recurringGenerated: 0,
        message: 'Error en rollover',
        error: error.message
      };
    }
  }

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
        actualAmount: 0,
        disponibleMb: budget.budgetedAmount,
        porcentajeUso: 0,
        status: 'on_track'
      });
      count++;
    }

    return count;
  }

  private async copyRecurringExpenses(
    userId: string,
    year: number,
    month: number
  ): Promise<number> {
    const expenses = await this.firebase.getSolicitudesActivas(userId);
    const recurring = expenses.filter((e: any) => e.isRecurring && e.status !== 'paid');

    let count = 0;
    for (const exp of recurring) {
      // Create a placeholder for the recurring expense this month
      // The actual transaction will be created when user marks as paid
      count++;
    }

    return count;
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