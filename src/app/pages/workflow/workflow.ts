import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { WorkflowService } from '../../core/services/workflow';
import { HistoryService } from '../../core/services/history';
import { FlujoAprobacion } from '../../core/models/workflow.model';

interface Milestone {
  amount: number;
  label:  string;
  reached: boolean;
}

@Component({
  selector: 'app-goal',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './workflow.html',
  styleUrl: './workflow.scss'
})
export class WorkflowComponent implements OnInit {

  private workflowService        = inject(WorkflowService);
  private historyService = inject(HistoryService);

  isLoading   = signal(true);
  isSaving    = signal(false);
  goal        = signal<FlujoAprobacion | null>(null);
  errorMsg    = signal('');
  successMsg  = signal('');

  // Panel de edición
  showEditContribution = signal(false);
  showEditTarget       = signal(false);
  newContribution      = 240;
  newTarget            = 10000;

  // Historial de documentos del mes
  /** Movimientos documentales del periodo, para dar contexto al ritmo. */
  documentosEnFlujo = 0;

  readonly milestones: Milestone[] = [
    // Fracciones del recorrido, no cifras: un flujo de tres etapas y otro
    // de diez deben leerse igual de bien.
    { amount: 0.25, label: '25%',  reached: false },
    { amount: 0.50, label: '50%',  reached: false },
    { amount: 0.75, label: '75%',  reached: false },
    { amount: 1.00, label: '100%', reached: false },
  ];

  get progress(): number {
    return this.goal() ? this.workflowService.calcAvance(this.goal()!) : 0;
  }

  get estimatedDate(): string {
    return this.goal() ? this.workflowService.calcFechaEstimada(this.goal()!.periodosParaCierre) : '';
  }

  get milestonesWithStatus(): Milestone[] {
    const current = this.goal()?.etapasCompletadas ?? 0;
    const total = this.goal()?.etapasTotales || 1;
    return this.milestones.map(m => ({ ...m, reached: current >= m.amount * total }));
  }

  // Proyección: cuántos meses si se aporta X
  projectMonths(contribution: number): number {
    const g = this.goal();
    if (!g || contribution <= 0) return 0;
    const remaining = g.etapasTotales - g.etapasCompletadas;
    if (remaining <= 0) return 0;
    return Math.ceil(remaining / contribution);
  }

  // Escenarios de archivo
  get scenarios() {
    const g = this.goal();
    if (!g) return [];
    return [
      { label: 'Archivo mínimo (10%)',  contribution: 120,  months: this.projectMonths(120)  },
      { label: 'Regla 20%',           contribution: 240,  months: this.projectMonths(240)  },
      { label: 'Archivo agresivo (30%)', contribution: 360, months: this.projectMonths(360)  },
      { label: 'Contribución actual',  contribution: g.etapasPorPeriodo, months: g.periodosParaCierre ?? 0 },
    ];
  }

  async ngOnInit() {
    await this.loadData();
  }

  async loadData() {
    this.isLoading.set(true);
    try {
      const now  = new Date();
      const [goals, txs] = await Promise.all([
        this.workflowService.getAll(),
        this.historyService.getPorPeriodo(now.getFullYear(), now.getMonth() + 1)
      ]);

      const activeGoal = goals.find(g => g.status === 'active') || goals[0] || null;
      this.goal.set(activeGoal);

      const totals      = this.historyService.calcTotales(txs);
      this.documentosEnFlujo = totals.entradas;

      if (activeGoal) {
        this.newContribution = activeGoal.etapasPorPeriodo;
        this.newTarget       = activeGoal.etapasTotales;
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  // ─── Editar contribución ─────────────────────────────────
  async saveContribution() {
    if (this.newContribution <= 0) {
      this.errorMsg.set('La contribución debe ser mayor a 0');
      return;
    }
    const goal = this.goal();
    if (!goal) {
      this.errorMsg.set('No hay meta activa');
      return;
    }
    this.isSaving.set(true);
    this.errorMsg.set('');
    try {
      await this.workflowService.update(goal.id, { etapasPorPeriodo: this.newContribution });
      await this.loadData();
      this.showEditContribution.set(false);
      this.showSuccess('¡Contribución actualizada! Los meses se recalcularon.');
    } catch (e: any) {
      this.errorMsg.set(e.message);
    } finally {
      this.isSaving.set(false);
    }
  }

  // ─── Editar meta ─────────────────────────────────────────
  async saveTarget() {
    if (this.newTarget <= 0) {
      this.errorMsg.set('La meta debe ser mayor a 0');
      return;
    }
    const goal = this.goal();
    if (!goal) {
      this.errorMsg.set('No hay meta activa');
      return;
    }
    this.isSaving.set(true);
    this.errorMsg.set('');
    try {
      await this.workflowService.update(goal.id, { etapasTotales: this.newTarget });
      await this.loadData();
      this.showEditTarget.set(false);
      this.showSuccess('¡Meta actualizada!');
    } catch (e: any) {
      this.errorMsg.set(e.message);
    } finally {
      this.isSaving.set(false);
    }
  }

  private showSuccess(msg: string) {
    this.successMsg.set(msg);
    setTimeout(() => this.successMsg.set(''), 3000);
  }



  formatMonth(months: number): string {
    if (months === 0) return '¡Meta alcanzada!';
    if (months === 1) return '1 mes';
    if (months < 12)  return `${months} meses`;
    const years = Math.floor(months / 12);
    const rem   = months % 12;
    return rem > 0 ? `${years} año${years > 1 ? 's' : ''} y ${rem} mes${rem > 1 ? 'es' : ''}` : `${years} año${years > 1 ? 's' : ''}`;
  }
}