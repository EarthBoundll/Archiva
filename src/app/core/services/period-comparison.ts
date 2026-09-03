import { Injectable, inject } from '@angular/core';
import { FirebaseService } from './firebase';
import { Auth } from './auth';

export interface ComparativaPeriodo {
  currentMonth: string;
  previousMonth: string;
  
  // Income comparison
  income: {
    current: number;
    previous: number;
    difference: number;
    percentageChange: number;
    trend: 'up' | 'down' | 'stable';
  };
  
  // SolicitudRevision comparison
  expenses: {
    current: number;
    previous: number;
    difference: number;
    percentageChange: number;
    trend: 'up' | 'down' | 'stable';
  };
  
  // Balance comparison
  balance: {
    current: number;
    previous: number;
    difference: number;
    percentageChange: number;
    trend: 'up' | 'down' | 'stable';
  };
  
  // Savings comparison
  savings: {
    current: number;
    previous: number;
    difference: number;
    percentageChange: number;
    trend: 'up' | 'down' | 'stable';
  };
  
  // Category comparison
  byCategory: {
    category: string;
    current: number;
    previous: number;
    difference: number;
    percentageChange: number;
  }[];
  
  // Overall health
  healthComparison: {
    currentScore: number;
    previousScore: number;
    scoreChange: number;
    status: 'improved' | 'declined' | 'stable';
  };
  
  generatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class PeriodComparisonService {
  private firebase = inject(FirebaseService);
  private authService = inject(Auth);

  async getComparativaPeriodo(year: number, month: number): Promise<ComparativaPeriodo> {
    const userId = this.authService.getUserId();
    if (!userId) throw new Error('No autenticado');

    const currentMonthId = `${year}-${String(month).padStart(2, '0')}`;
    
    // Calculate previous month
    let prevYear = year;
    let prevMonth = month - 1;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear = year - 1;
    }
    const previousMonthId = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;

    // Get financial states for both months
    const currentState = await this.getOrCreateFinancialState(userId, year, month);
    const previousState = await this.getOrCreateFinancialState(userId, prevYear, prevMonth);

    // Calculate income comparison
    const incomeComparison = this.compareValues(
      currentState?.income || 0,
      previousState?.income || 0
    );

    // Calculate expense comparison
    const expenseComparison = this.compareValues(
      currentState?.expenses || 0,
      previousState?.expenses || 0
    );

    // Calculate balance comparison
    const balanceComparison = this.compareValues(
      currentState?.balance || 0,
      previousState?.balance || 0
    );

    // Calculate savings comparison
    const savingsComparison = this.compareValues(
      currentState?.savings || 0,
      previousState?.savings || 0
    );

    // Get category breakdown
    const byCategory = await this.compareCategories(userId, currentMonthId, previousMonthId);

    // Health comparison
    let healthStatus: 'improved' | 'declined' | 'stable' = 'stable';
    const scoreChange = (currentState?.financialScore || 0) - (previousState?.financialScore || 0);
    if (scoreChange > 5) healthStatus = 'improved';
    else if (scoreChange < -5) healthStatus = 'declined';

    const healthComparison = {
      currentScore: currentState?.financialScore || 0,
      previousScore: previousState?.financialScore || 0,
      scoreChange,
      status: healthStatus
    };

    return {
      currentMonth: currentMonthId,
      previousMonth: previousMonthId,
      income: incomeComparison,
      expenses: expenseComparison,
      balance: balanceComparison,
      savings: savingsComparison,
      byCategory,
      healthComparison,
      generatedAt: new Date().toISOString()
    };
  }

  private async getOrCreateFinancialState(userId: string, year: number, month: number): Promise<any> {
    const state = await this.firebase.getEstadoDocumental(userId, year, month);
    if (!state) {
      const periodoId = `${year}-${String(month).padStart(2, '0')}`;
      return await this.firebase.actualizarEstadoDocumental(userId, periodoId);
    }
    return state;
  }

  private compareValues(current: number, previous: number): {
    current: number;
    previous: number;
    difference: number;
    percentageChange: number;
    trend: 'up' | 'down' | 'stable';
  } {
    const difference = current - previous;
    const percentageChange = previous !== 0 
      ? Math.round((difference / Math.abs(previous)) * 100)
      : 0;
    
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (difference > 0) trend = 'up';
    else if (difference < 0) trend = 'down';

    return {
      current: Math.round(current * 100) / 100,
      previous: Math.round(previous * 100) / 100,
      difference: Math.round(difference * 100) / 100,
      percentageChange,
      trend
    };
  }

  private async compareCategories(
    userId: string, 
    currentMonthId: string, 
    previousMonthId: string
  ): Promise<{ category: string; current: number; previous: number; difference: number; percentageChange: number }[]> {
    const currentTxs = await this.firebase.getHistorialPorPeriodo(userId, 
      parseInt(currentMonthId.split('-')[0]), 
      parseInt(currentMonthId.split('-')[1])
    );
    const previousTxs = await this.firebase.getHistorialPorPeriodo(userId, 
      parseInt(previousMonthId.split('-')[0]), 
      parseInt(previousMonthId.split('-')[1])
    );

    // Group by category
    const currentByCat = this.groupByCategory(currentTxs);
    const previousByCat = this.groupByCategory(previousTxs);

    // Get all categories
    const allCategories = new Set([...Object.keys(currentByCat), ...Object.keys(previousByCat)]);

    return Array.from(allCategories).map(cat => {
      const current = currentByCat[cat] || 0;
      const previous = previousByCat[cat] || 0;
      const difference = current - previous;
      const percentageChange = previous !== 0 
        ? Math.round((difference / Math.abs(previous)) * 100)
        : (current > 0 ? 100 : 0);

      return {
        category: cat,
        current: Math.round(current * 100) / 100,
        previous: Math.round(previous * 100) / 100,
        difference: Math.round(difference * 100) / 100,
        percentageChange
      };
    }).filter(c => c.current > 0 || c.previous > 0);
  }

  private groupByCategory(transactions: any[]): Record<string, number> {
    const result: Record<string, number> = {};
    transactions
      .filter((t: any) => t.amount < 0)
      .forEach((t: any) => {
        const cat = t.category || 'other';
        result[cat] = (result[cat] || 0) + Math.abs(t.amount);
      });
    return result;
  }

  // Get trend summary for multiple months
  async getResumenTendencia(year: number, month: number, monthsBack: number = 3): Promise<{
    months: { periodoId: string; income: number; expenses: number; savings: number }[];
    averageIncome: number;
    averageExpenses: number;
    averageSavings: number;
    incomeTrend: 'up' | 'down' | 'stable';
    expenseTrend: 'up' | 'down' | 'stable';
  }> {
    const userId = this.authService.getUserId();
    if (!userId) throw new Error('No autenticado');

    const months: { periodoId: string; income: number; expenses: number; savings: number }[] = [];

    for (let i = 0; i < monthsBack; i++) {
      let y = year;
      let m = month - i;
      if (m <= 0) {
        m = 12 + m;
        y = year - 1;
      }

      const state = await this.getOrCreateFinancialState(userId, y, m);
      const periodoId = `${y}-${String(m).padStart(2, '0')}`;
      
      months.push({
        periodoId,
        income: state?.income || 0,
        expenses: state?.expenses || 0,
        savings: state?.savings || 0
      });
    }

    // Calculate averages
    const avgIncome = months.reduce((s, m) => s + m.income, 0) / months.length;
    const avgExpenses = months.reduce((s, m) => s + m.expenses, 0) / months.length;
    const avgSavings = months.reduce((s, m) => s + m.savings, 0) / months.length;

    // Calculate trends (compare first vs last month)
    const incomeTrend = this.calculateTrend(months[months.length - 1]?.income || 0, months[0]?.income || 0);
    const expenseTrend = this.calculateTrend(months[months.length - 1]?.expenses || 0, months[0]?.expenses || 0);

    return {
      months: months.reverse(),
      averageIncome: Math.round(avgIncome),
      averageExpenses: Math.round(avgExpenses),
      averageSavings: Math.round(avgSavings),
      incomeTrend,
      expenseTrend
    };
  }

  private calculateTrend(current: number, previous: number): 'up' | 'down' | 'stable' {
    const change = ((current - previous) / (previous || 1)) * 100;
    if (change > 5) return 'up';
    if (change < -5) return 'down';
    return 'stable';
  }
}