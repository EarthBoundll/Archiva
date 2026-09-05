import { Injectable, inject } from '@angular/core';
import { FirebaseService } from './firebase';
import { Auth } from './auth';

export type ReportFormat = 'csv' | 'json' | 'pdf';
export type ReportType = 'transactions' | 'income' | 'expenses' | 'budgets' | 'goals' | 'full';

export interface ReportOptions {
  type: ReportType;
  format: ReportFormat;
  startDate?: string;
  endDate?: string;
  year?: number;
  month?: number;
  includeCalculations?: boolean;
}

export interface GeneratedReport {
  type: ReportType;
  format: ReportFormat;
  data: any;
  filename: string;
  generatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class DocumentReportService {
  private firebase = inject(FirebaseService);
  private authService = inject(Auth);

  async generateReport(options: ReportOptions): Promise<GeneratedReport> {
    const userId = this.authService.getUserId();
    if (!userId) throw new Error('No autenticado');

    const { type, format, year, month } = options;
    
    let data: any;

    switch (type) {
      case 'transactions':
        data = await this.getTransactionsReport(userId, year!, month!);
        break;
      case 'income':
        data = await this.getIncomeReport(userId, year!, month!);
        break;
      case 'expenses':
        data = await this.getExpensesReport(userId, year!, month!);
        break;
      case 'budgets':
        data = await this.getBudgetsReport(userId, year!, month!);
        break;
      case 'goals':
        data = await this.getGoalsReport(userId);
        break;
      case 'full':
        data = await this.getFullReport(userId, year!, month!);
        break;
      default:
        throw new Error('Tipo de reporte no válido');
    }

    // Format the output
    let formattedData: string | Blob;
    const filename = this.generateFilename(type, format, year, month);

    switch (format) {
      case 'csv':
        formattedData = this.convertToCSV(data);
        break;
      case 'json':
        formattedData = JSON.stringify(data, null, 2);
        break;
      case 'pdf':
        // For PDF, we return JSON data that can be used with a PDF library
        // In a real implementation, you'd use jsPDF or similar
        formattedData = JSON.stringify(data);
        break;
      default:
        formattedData = JSON.stringify(data);
    }

    return {
      type,
      format,
      data: formattedData,
      filename,
      generatedAt: new Date().toISOString()
    };
  }

  private async getTransactionsReport(userId: string, year: number, month: number): Promise<any> {
    const transactions = await this.firebase.getHistorialPorPeriodo(userId, year, month);
    const state = await this.firebase.getEstadoDocumental(userId, year, month);

    return {
      period: { year, month },
      summary: {
        totalIncome: state?.income || 0,
        totalExpenses: state?.expenses || 0,
        balance: state?.balance || 0,
        savingsRate: state?.savingsRate || 0
      },
      transactions: transactions.map((t: any) => ({
        date: t.date,
        description: t.description,
        amount: t.amount,
        category: t.category,
        type: t.type
      }))
    };
  }

  private async getIncomeReport(userId: string, year: number, month: number): Promise<any> {
    const monthlyIncome = await this.firebase.calcularDocumentosPeriodo(userId, year, month);
    const profile = await this.firebase.getUserProfile(userId);

    return {
      period: { year, month },
      profile: {
        monthlyIncomeTarget: profile?.['monthlyIncome'] || 0,
        currency: profile?.['currency'] || 'PEN'
      },
      income: {
        totalBudgeted: monthlyIncome.totalBudgeted,
        totalReceived: monthlyIncome.totalReceived,
        totalPending: monthlyIncome.totalPending,
        availableNow: monthlyIncome.availableNow
      },
      sources: monthlyIncome.sources?.map((s: any) => ({
        name: s.name,
        type: s.type,
        budgeted: s.budgeted,
        received: s.received,
        expectedDate: s.expectedDate,
        status: s.status
      })) || []
    };
  }

  private async getExpensesReport(userId: string, year: number, month: number): Promise<any> {
    const summary = await this.firebase.calcularSolicitudesPeriodo(userId, year, month);

    return {
      period: { year, month },
      summary: {
        totalBudgeted: summary.totalBudgeted,
        totalActual: summary.totalActual,
        primordial: {
          budgeted: summary.primordialBudgeted,
          actual: summary.primordialActual,
          count: summary.primordialCount
        },
        nonPrimordial: {
          budgeted: summary.nonPrimordialBudgeted,
          actual: summary.nonPrimordialActual,
          count: summary.nonPrimordialCount
        }
      },
      byCategory: summary.byCategory,
      upcomingPayments: summary.upcomingPayments,
      alerts: summary.alerts
    };
  }

  private async getBudgetsReport(userId: string, year: number, month: number): Promise<any> {
    const summary = await this.firebase.calcularResumenAlmacenamiento(userId, year, month);

    return {
      period: { year, month },
      summary: {
        totalBudgeted: summary.totalBudgeted,
        totalActual: summary.totalActual,
        totalRemaining: summary.totalRemaining,
        overallPercentage: summary.overallPercentage,
        overallStatus: summary.overallStatus
      },
      primordial: {
        budgeted: summary.primordialBudgeted,
        actual: summary.primordialActual
      },
      nonPrimordial: {
        budgeted: summary.nonPrimordialBudgeted,
        actual: summary.nonPrimordialActual
      },
      budgets: summary.budgets?.map((b: any) => ({
        category: b.category,
        categoryName: b.categoryName,
        budgetedAmount: b.budgetedAmount,
        actualAmount: b.actualAmount,
        disponibleMb: b.disponibleMb,
        porcentajeUso: b.porcentajeUso,
        status: b.status
      })) || [],
      alerts: summary.alerts
    };
  }

  private async getGoalsReport(userId: string): Promise<any> {
    const goals = await this.firebase.getFlujos(userId);
    const monthlyIncome = await this.firebase.calcularDocumentosPeriodo(
      userId, 
      new Date().getFullYear(), 
      new Date().getMonth() + 1
    );

    const totalSaved = goals?.reduce((sum: number, g: any) => sum + (g.etapasCompletadas || 0), 0) || 0;
    const totalTarget = goals?.reduce((sum: number, g: any) => sum + (g.etapasTotales || 0), 0) || 0;

    return {
      generatedAt: new Date().toISOString(),
      summary: {
        totalGoals: goals?.length || 0,
        totalSaved,
        totalTarget,
        overallProgress: totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0,
        monthlyIncome: monthlyIncome?.totalBudgeted || 0,
        savingsRate: monthlyIncome?.totalBudgeted 
          ? Math.round((totalSaved / monthlyIncome.totalBudgeted) * 100) 
          : 0
      },
      goals: goals?.map((g: any) => ({
        name: g.name,
        category: g.category,
        etapasTotales: g.etapasTotales,
        etapasCompletadas: g.etapasCompletadas,
        etapasPorPeriodo: g.etapasPorPeriodo,
        progress: g.etapasTotales > 0 
          ? Math.round((g.etapasCompletadas / g.etapasTotales) * 100) 
          : 0,
        periodosParaCierre: g.periodosParaCierre,
        priority: g.priority,
        status: g.status,
        fechaProyectadaCierre: g.fechaProyectadaCierre
      })) || []
    };
  }

  private async getFullReport(userId: string, year: number, month: number): Promise<any> {
    const [
      transactionsData,
      incomeData,
      expensesData,
      budgetsData,
      goalsData,
      estadoDocumental,
      profile
    ] = await Promise.all([
      this.getTransactionsReport(userId, year, month),
      this.getIncomeReport(userId, year, month),
      this.getExpensesReport(userId, year, month),
      this.getBudgetsReport(userId, year, month),
      this.getGoalsReport(userId),
      this.firebase.getEstadoDocumental(userId, year, month),
      this.firebase.getUserProfile(userId)
    ]);

    return {
      reportGenerated: new Date().toISOString(),
      user: {
        email: profile?.['email'],
        currency: profile?.['currency'] || 'PEN',
        locale: profile?.['locale'] || 'es-PE'
      },
      period: { year, month },
      financialHealth: {
        score: estadoDocumental?.financialScore || 0,
        status: estadoDocumental?.healthStatus || 'unknown',
        savingsRate: estadoDocumental?.savingsRate || 0,
        income: estadoDocumental?.income || 0,
        expenses: estadoDocumental?.expenses || 0,
        balance: estadoDocumental?.balance || 0
      },
      transactions: transactionsData,
      income: incomeData,
      expenses: expensesData,
      budgets: budgetsData,
      goals: goalsData
    };
  }

  private convertToCSV(data: any): string {
    if (Array.isArray(data.transactions)) {
      // Transactions CSV
      const headers = ['Date', 'Description', 'Amount', 'Category', 'Type'];
      const rows = data.transactions.map((t: any) => 
        [t.date, t.description, t.amount, t.category, t.type].join(',')
      );
      return [headers.join(','), ...rows].join('\n');
    }
    
    // Fallback: convert entire object to CSV-like format
    return this.jsonToCSV(data);
  }

  private jsonToCSV(obj: any, prefix = ''): string {
    let csv = '';
    
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        csv += this.jsonToCSV(value, `${prefix}${key}.`);
      } else if (Array.isArray(value)) {
        csv += `${prefix}${key}:\n`;
        value.forEach((item: any, index: number) => {
          if (typeof item === 'object') {
            csv += this.jsonToCSV(item, `${prefix}${key}[${index}].`);
          } else {
            csv += `${prefix}${key}[${index}] = ${item}\n`;
          }
        });
      } else {
        csv += `${prefix}${key} = ${value}\n`;
      }
    }
    
    return csv;
  }

  private generateFilename(type: ReportType, format: ReportFormat, year?: number, month?: number): string {
    const date = new Date().toISOString().split('T')[0];
    const period = year && month ? `${year}_${String(month).padStart(2, '0')}` : 'all';
    return `archiva_${type}_${period}.${format}`;
  }

  // Download helper
  downloadReport(report: GeneratedReport): void {
    const blob = report.data instanceof Blob 
      ? report.data 
      : new Blob([report.data as string], { type: 'text/plain' });
    
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = report.filename;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  // Quick export methods
  async exportTransactionsCSV(year: number, month: number): Promise<void> {
    const report = await this.generateReport({
      type: 'transactions',
      format: 'csv',
      year,
      month
    });
    this.downloadReport(report);
  }

  async exportFullReportJSON(year: number, month: number): Promise<void> {
    const report = await this.generateReport({
      type: 'full',
      format: 'json',
      year,
      month
    });
    this.downloadReport(report);
  }
}