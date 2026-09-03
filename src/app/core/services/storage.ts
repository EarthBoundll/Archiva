import { Injectable, inject } from '@angular/core';
import { FirebaseService } from './firebase';
import { Auth } from './auth';
import { CuotaAlmacenamiento, CuotaPayload, ResumenAlmacenamiento, calcularEstadoCuota } from '../models/storage.model';

@Injectable({ providedIn: 'root' })
export class StorageService {
  private firebase = inject(FirebaseService);
  private authService = inject(Auth);

  async getPorPeriodo(year: number, month: number): Promise<CuotaAlmacenamiento[]> {
    const userId = this.authService.getUserId();
    if (!userId) return [];

    const data = await this.firebase.getCuotasPorPeriodo(userId, year, month);
    return data as CuotaAlmacenamiento[];
  }

  async asignarCuota(payload: CuotaPayload): Promise<CuotaAlmacenamiento> {
    const userId = this.authService.getUserId();
    if (!userId) throw new Error('No autenticado');

    const result = await this.firebase.definirCuota(userId, payload);
    return result as CuotaAlmacenamiento;
  }

  async getResumenPeriodo(year: number, month: number): Promise<ResumenAlmacenamiento> {
    const userId = this.authService.getUserId();
    if (!userId) throw new Error('No autenticado');

    const data = await this.firebase.calcularResumenAlmacenamiento(userId, year, month);
    return data as ResumenAlmacenamiento;
  }

  // Helper: Set budget for all categories based on income
  async autoDistribuirCuotas(incomeBudgeted: number, year: number, month: number): Promise<void> {
    const userId = this.authService.getUserId();
    if (!userId) return;

    // Default percentages based on 50/30/20 rule
    const primordialRatio = 0.50;
    const nonPrimordialRatio = 0.20;
    const savingsRatio = 0.20;

    // But we need to get actual expenses to map them
    const existingBudgets = await this.getPorPeriodo(year, month);
    
    if (existingBudgets.length > 0) {
      // If budgets exist, just recalculate with actuals
      return;
    }

    // Get expenses to know which categories exist
    const expenses = await this.getExpensesByCategory(year, month);
    
    // Create budgets based on existing expenses
    for (const [category, amount] of Object.entries(expenses)) {
      const esPrioritaria = this.isPrimordialCategory(category);
      const ratio = esPrioritaria ? primordialRatio : nonPrimordialRatio;
      const budgetAmount = Math.round(incomeBudgeted * ratio);
      
      await this.asignarCuota({
        category,
        categoryName: this.getCategoryDisplayName(category),
        esPrioritaria,
        budgetedAmount: budgetAmount,
        periodoId: `${year}-${String(month).padStart(2, '0')}`,
        year,
        month
      });
    }
  }

  private async getExpensesByCategory(year: number, month: number): Promise<Record<string, number>> {
    const userId = this.authService.getUserId();
    if (!userId) return {};

    const transactions = await this.firebase.getHistorialPorPeriodo(userId, year, month);
    const expenses = transactions.filter((t: any) => t.amount < 0);

    const byCategory: Record<string, number> = {};
    expenses.forEach((t: any) => {
      const cat = t.category || 'other';
      byCategory[cat] = (byCategory[cat] || 0) + Math.abs(t.amount);
    });

    return byCategory;
  }

  private isPrimordialCategory(category: string): boolean {
    const primordialCategories = ['housing', 'utilities', 'transport', 'health', 'debt', 'groceries', 'education'];
    return primordialCategories.includes(category);
  }

  private getCategoryDisplayName(category: string): string {
    const names: Record<string, string> = {
      housing: 'Vivienda',
      utilities: 'Servicios',
      transport: 'Transporte',
      health: 'Salud',
      debt: 'Deudas',
      groceries: 'Supermercado',
      education: 'Educación',
      dining_out: 'Comida fuera',
      entertainment: 'Entretenimiento',
      streaming: 'Streaming',
      pets: 'Mascotas',
      clothing: 'Ropa',
      travel: 'Viajes',
      shopping: 'Compras',
      subscriptions: 'Suscripciones'
    };
    return names[category] || category;
  }

  // Calculate how much budget remains
  async getEspacioDisponible(year: number, month: number): Promise<number> {
    const summary = await this.getResumenPeriodo(year, month);
    return summary.totalRemaining;
  }

  // Get categories that are at risk
  async getCategoriasEnAlerta(year: number, month: number): Promise<CuotaAlmacenamiento[]> {
    const budgets = await this.getPorPeriodo(year, month);
    return budgets.filter(b => b.status === 'at_risk' || b.status === 'exceeded');
  }
}