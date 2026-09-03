import { Injectable, inject } from '@angular/core';
import { FirebaseService } from './firebase';
import { Auth } from './auth';

export type AlertType = 
  | 'overdue_expense'
  | 'budget_exceeded'
  | 'budget_at_risk'
  | 'income_pending'
  | 'income_overdue'
  | 'goal_behind_schedule'
  | 'high_spending_category'
  | 'low_savings_rate';

export interface Alert {
  id: string;
  type: AlertType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  category?: string;
  amount?: number;
  threshold?: number;
  actionUrl?: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class AlertsService {
  private firebase = inject(FirebaseService);
  private authService = inject(Auth);

  async getAlertasDocumentales(year: number, month: number): Promise<Alert[]> {
    const userId = this.authService.getUserId();
    if (!userId) throw new Error('No autenticado');

    const alerts: Alert[] = [];

    // 1. CuotaAlmacenamiento alerts
    const budgetAlerts = await this.getBudgetAlerts(userId, year, month);
    alerts.push(...budgetAlerts);

    // 2. SolicitudRevision alerts
    const expenseAlerts = await this.getExpenseAlerts(userId, year, month);
    alerts.push(...expenseAlerts);

    // 3. Income alerts
    const incomeAlerts = await this.getIncomeAlerts(userId, year, month);
    alerts.push(...incomeAlerts);

    // 4. Goal alerts
    const goalAlerts = await this.getGoalAlerts(userId);
    alerts.push(...goalAlerts);

    // Sort by severity
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return alerts;
  }

  private async getBudgetAlerts(userId: string, year: number, month: number): Promise<Alert[]> {
    const alerts: Alert[] = [];
    const summary = await this.firebase.calcularResumenAlmacenamiento(userId, year, month);

    if (summary?.alerts) {
      for (const alert of summary.alerts) {
        alerts.push({
          id: `budget-${alert.category}-${month}`,
          type: alert.status === 'exceeded' ? 'budget_exceeded' : 'budget_at_risk',
          severity: alert.status === 'exceeded' ? 'high' : 'medium',
          title: alert.status === 'exceeded' 
            ? `Cuota excedido: ${alert.name}`
            : `Cuota en riesgo: ${alert.name}`,
          message: alert.status === 'exceeded'
            ? `Has gastado ${alert.actual} de ${alert.budgeted} (${alert.percentage}%)`
            : `Has usado el ${alert.percentage}% del cuota de ${alert.name}`,
          category: alert.category,
          amount: alert.actual,
          threshold: alert.budgeted,
          createdAt: new Date().toISOString()
        });
      }
    }

    return alerts;
  }

  private async getExpenseAlerts(userId: string, year: number, month: number): Promise<Alert[]> {
    const alerts: Alert[] = [];
    const summary = await this.firebase.calcularSolicitudesPeriodo(userId, year, month);

    if (summary?.alerts) {
      for (const alert of summary.alerts) {
        let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';
        let type: AlertType = 'overdue_expense';

        switch (alert.type) {
          case 'overdue':
            type = 'overdue_expense';
            severity = 'high';
            break;
          case 'budget_exceeded':
            type = 'budget_exceeded';
            severity = 'critical';
            break;
          case 'price_change':
            type = 'high_spending_category';
            severity = 'low';
            break;
          case 'variable_spike':
            type = 'high_spending_category';
            severity = 'medium';
            break;
        }

        alerts.push({
          id: `expense-${alert.solicitudId}-${month}`,
          type,
          severity,
          title: this.getAlertTitle(alert.type),
          message: alert.message,
          createdAt: new Date().toISOString()
        });
      }
    }

    return alerts;
  }

  private async getIncomeAlerts(userId: string, year: number, month: number): Promise<Alert[]> {
    const alerts: Alert[] = [];
    const monthlyIncome = await this.firebase.calcularDocumentosPeriodo(userId, year, month);

    if (monthlyIncome?.sources) {
      for (const source of monthlyIncome.sources) {
        if (source.status === 'overdue') {
          alerts.push({
            id: `income-overdue-${source.documentoId}`,
            type: 'income_overdue',
            severity: 'high',
            title: `Documento vencido: ${source.name}`,
            message: `Se esperaba recibir ${source.budgeted} el día ${source.expectedDate} pero aún no se ha recibido`,
            category: source.type,
            amount: source.budgeted,
            createdAt: new Date().toISOString()
          });
        } else if (source.status === 'pending' && source.expectedDate) {
          const today = new Date().getDate();
          if (source.expectedDate - today <= 3) {
            alerts.push({
              id: `income-pending-${source.documentoId}`,
              type: 'income_pending',
              severity: 'low',
              title: `Documento próximo: ${source.name}`,
              message: `Se recibirá ${source.budgeted} el día ${source.expectedDate}`,
              category: source.type,
              amount: source.budgeted,
              createdAt: new Date().toISOString()
            });
          }
        }
      }
    }

    return alerts;
  }

  private async getGoalAlerts(userId: string): Promise<Alert[]> {
    const alerts: Alert[] = [];
    const goals = await this.firebase.getFlujos(userId);
    const monthlyIncome = await this.firebase.calcularDocumentosPeriodo(userId, 
      new Date().getFullYear(), 
      new Date().getMonth() + 1
    );

    if (goals && goals.length > 0 && monthlyIncome?.totalBudgeted) {
      const savingsTarget = monthlyIncome.totalBudgeted * 0.20; // 20% savings target

      for (const goal of goals as any[]) {
        if (goal.status !== 'active') continue;

        const etapasPorPeriodo = goal.etapasPorPeriodo || 0;
        
        if (etapasPorPeriodo < savingsTarget) {
          alerts.push({
            id: `goal-behind-${goal.id}`,
            type: 'goal_behind_schedule',
            severity: (goal.priority === 'high') ? 'high' : 'medium',
            title: `Meta fuera de schedule: ${goal.name || 'Meta'}`,
            message: `Contribution mensual de ${etapasPorPeriodo} es menor al objetivo de ${Math.round(savingsTarget)}`,
            category: goal.category,
            amount: etapasPorPeriodo,
            threshold: savingsTarget,
            createdAt: new Date().toISOString()
          });
        }
      }
    }

    // Check for low savings rate
    const estadoDocumental = await this.firebase.getEstadoDocumental(userId, 
      new Date().getFullYear(), 
      new Date().getMonth() + 1
    );

    if (estadoDocumental?.savingsRate !== undefined && estadoDocumental.savingsRate < 10) {
      alerts.push({
        id: 'low-savings-rate',
        type: 'low_savings_rate',
        severity: 'high',
        title: 'Tasa de archivo baja',
        message: `El ${estadoDocumental.savingsRate}% del acervo esta archivado. Revisa los documentos pendientes de archivar.`,
        createdAt: new Date().toISOString()
      });
    }

    return alerts;
  }

  private getAlertTitle(type: string): string {
    const titles: Record<string, string> = {
      'overdue': 'Solicitud vencido',
      'budget_exceeded': 'Cuota excedido',
      'price_change': 'Cambio de precio detectado',
      'variable_spike': 'Solicitud variable elevado'
    };
    return titles[type] || 'Alerta de solicitud';
  }

  // Get alert counts by severity
  async getResumenAlertas(year: number, month: number): Promise<{
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  }> {
    const alerts = await this.getAlertasDocumentales(year, month);

    return {
      total: alerts.length,
      critical: alerts.filter(a => a.severity === 'critical').length,
      high: alerts.filter(a => a.severity === 'high').length,
      medium: alerts.filter(a => a.severity === 'medium').length,
      low: alerts.filter(a => a.severity === 'low').length
    };
  }
}