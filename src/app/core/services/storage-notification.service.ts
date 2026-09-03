import { Injectable, inject } from '@angular/core';
import { FirebaseService } from './firebase';
import { Auth } from './auth';
import { HistoryService } from './history';

export interface MonthlySurplus {
  id?: string;
  year: number;
  month: number;
  income: number;
  expenses: number;
  surplus: number;
  previousMonthSurplus: number;
  trend: 'up' | 'down' | 'stable';
  percentageChange: number;
  calculatedAt: string;
}

export interface SurplusNotification {
  id?: string;
  userId: string;
  year: number;
  month: number;
  title: string;
  message: string;
  surplus: number;
  trend: 'up' | 'down' | 'stable';
  previousSurplus: number;
  isRead: boolean;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class StorageNotificationService {
  private firebase = inject(FirebaseService);
  private authService = inject(Auth);
  private historyService = inject(HistoryService);

  async calculateMonthlySurplus(year: number, month: number): Promise<MonthlySurplus> {
    const userId = this.authService.getUserId();
    if (!userId) throw new Error('No autenticado');

    // Get transactions for current month
    const txs = await this.historyService.getPorPeriodo(year, month);
    const totals = this.historyService.calcTotales(txs);

    // Get previous month surplus
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevTxs = await this.historyService.getPorPeriodo(prevYear, prevMonth);
    const prevTotals = this.historyService.calcTotales(prevTxs);
    const previousSurplus = prevTotals.balance;

    // Calculate trend
    const surplus = totals.balance;
    let trend: 'up' | 'down' | 'stable' = 'stable';
    let percentageChange = 0;

    if (previousSurplus !== 0) {
      percentageChange = ((surplus - previousSurplus) / Math.abs(previousSurplus)) * 100;
      
      if (surplus > previousSurplus) {
        trend = 'up';
      } else if (surplus < previousSurplus) {
        trend = 'down';
      }
    } else if (surplus > 0) {
      trend = 'up';
      percentageChange = 100;
    }

    return {
      year,
      month,
      income: totals.income,
      expenses: Math.abs(totals.expenses),
      surplus,
      previousMonthSurplus: previousSurplus,
      trend,
      percentageChange,
      calculatedAt: new Date().toISOString()
    };
  }

  async guardarRegistroCuota(surplus: MonthlySurplus): Promise<void> {
    const userId = this.authService.getUserId();
    if (!userId) return;

    const id = `${surplus.year}-${String(surplus.month).padStart(2, '0')}`;
    await this.firebase.guardarRegistroCuota(userId, id, surplus);
  }

  async generateAndSaveNotification(surplus: MonthlySurplus): Promise<SurplusNotification> {
    const userId = this.authService.getUserId();
    if (!userId) throw new Error('No autenticado');

    let title = '';
    let message = '';

    const monthName = new Date(surplus.year, surplus.month - 1).toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });

    if (surplus.trend === 'up') {
      title = 'Tu archivo aumentó';
      message = `Este ${monthName} terminaste con ${surplus.surplus.toFixed(2)} de sobrante, un ${surplus.percentageChange.toFixed(1)}% más que el mes anterior. ¡Excelente trabajo!`;
    } else if (surplus.trend === 'down') {
      title = 'Tu archivo disminuyó';
      message = `Este ${monthName} terminaste con ${surplus.surplus.toFixed(2)} de sobrante, un ${Math.abs(surplus.percentageChange).toFixed(1)}% menos que el mes anterior. Revisa tus solicitudes para mejorar.`;
    } else {
      title = 'Tu archivo se mantiene';
      message = `Este ${monthName} terminaste con ${surplus.surplus.toFixed(2)} de sobrante, igual que el mes anterior. ¡Sigue así!`;
    }

    const notification: SurplusNotification = {
      userId,
      year: surplus.year,
      month: surplus.month,
      title,
      message,
      surplus: surplus.surplus,
      trend: surplus.trend,
      previousSurplus: surplus.previousMonthSurplus,
      isRead: false,
      createdAt: new Date().toISOString()
    };

    // Save notification
    await this.firebase.saveNotification(userId, notification);
    
    return notification;
  }

  async checkAndProcessMonthEnd(): Promise<SurplusNotification | null> {
    const userId = this.authService.getUserId();
    if (!userId) return null;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();

    // Only run on last day of month or first day of new month
    const lastDayOfMonth = new Date(currentYear, currentMonth, 0).getDate();
    
    if (currentDay !== lastDayOfMonth && currentDay !== 1) {
      return null;
    }

    // Check if we already processed this month
    const monthToCheck = currentDay === 1 ? currentMonth - 1 : currentMonth;
    const yearToCheck = currentDay === 1 && currentMonth === 1 ? currentYear - 1 : currentYear;

    const existingRecord = await this.firebase.getRegistroCuota(userId, `${yearToCheck}-${String(monthToCheck).padStart(2, '0')}`);
    
    if (existingRecord) {
      return null; // Already processed
    }

    // Calculate and save
    const surplus = await this.calculateMonthlySurplus(yearToCheck, monthToCheck);
    await this.guardarRegistroCuota(surplus);
    const notification = await this.generateAndSaveNotification(surplus);

    return notification;
  }

  async getNotifications(unreadOnly: boolean = false): Promise<SurplusNotification[]> {
    const userId = this.authService.getUserId();
    if (!userId) return [];

    return await this.firebase.getNotifications(userId, unreadOnly);
  }

  async markNotificationAsRead(notificationId: string): Promise<void> {
    const userId = this.authService.getUserId();
    if (!userId) return;

    await this.firebase.markNotificationAsRead(userId, notificationId);
  }

  async getSurplusHistory(): Promise<MonthlySurplus[]> {
    const userId = this.authService.getUserId();
    if (!userId) return [];

    return await this.firebase.getSurplusHistory(userId);
  }
}