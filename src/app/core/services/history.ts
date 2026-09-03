import { Injectable, inject } from '@angular/core';
import { FirebaseService } from './firebase';
import { Auth } from './auth';
import { RegistroHistorial, RegistroHistorialPayload } from '../models/history.model';

@Injectable({ providedIn: 'root' })
export class HistoryService {
  private firebase = inject(FirebaseService);
  private authService = inject(Auth);

  async getPorPeriodo(year: number, month: number): Promise<RegistroHistorial[]> {
    const userId = this.authService.getUserId();
    if (!userId) return [];

    const data = await this.firebase.getHistorialPorPeriodo(userId, year, month);
    return data as RegistroHistorial[];
  }

  async create(payload: RegistroHistorialPayload): Promise<RegistroHistorial> {
    const userId = this.authService.getUserId();
    if (!userId) throw new Error('No autenticado');

    const now = new Date().toISOString();
    const data = {
      userId,
      categoryId: payload.categoryId,
      amount: payload.amount,
      description: payload.description,
      date: payload.date,
      type: payload.type,
      // Include ruleType for financial calculations
      ruleType: payload.type === 'income' ? 'income' : 'need',
      createdAt: now,
      updatedAt: now
    };

    const result = await this.firebase.crearRegistro(userId, data);
    return result as RegistroHistorial;
  }

  async update(id: string, payload: Partial<RegistroHistorialPayload>): Promise<RegistroHistorial> {
    const userId = this.authService.getUserId();
    if (!userId) throw new Error('No autenticado');

    const data: any = {
      ...payload,
      updatedAt: new Date().toISOString()
    };

    // Include ruleType for financial calculations
    if (payload.type) {
      data.ruleType = payload.type === 'income' ? 'income' : 'need';
    }

    await this.firebase.actualizarRegistro(userId, id, data);
    return (await this.getPorPeriodo(
      new Date().getFullYear(), 
      new Date().getMonth() + 1
    )).find(t => t.id === id) as RegistroHistorial;
  }

  async delete(id: string): Promise<void> {
    const userId = this.authService.getUserId();
    if (!userId) throw new Error('No autenticado');

    await this.firebase.eliminarRegistro(userId, id);
  }

  calcTotales(transactions: RegistroHistorial[]) {
    const income = transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const expenses = transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    const balance = income - expenses;
    return { income, expenses, balance };
  }

  calcPorPrioridad(transactions: RegistroHistorial[]) {
    const result = { need: 0, want: 0, saving: 0 };
    transactions
      .filter(t => t.amount < 0 && t.category)
      .forEach(t => {
        const type = (t.category as any)?.rule_type as keyof typeof result;
        if (type in result) result[type] += Math.abs(t.amount);
      });
    return result;
  }

  calcPorCategoria(transactions: RegistroHistorial[]) {
    const map = new Map<string, { name: string; icon: string; total: number }>();
    transactions
      .filter(t => t.amount < 0 && t.category)
      .forEach(t => {
        const key = t.categoryId ?? 'sin-categoría';
        const prev = map.get(key) ?? { name: (t.category as any)?.name ?? 'Sin categoría', icon: (t.category as any)?.icon ?? 'package', total: 0 };
        map.set(key, { ...prev, total: prev.total + Math.abs(t.amount) });
      });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }
}