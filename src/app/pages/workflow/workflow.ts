import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { WorkflowService } from '../../core/services/workflow';
import { HistoryService } from '../../core/services/history';
import { FlujoAprobacion } from '../../core/models/workflow.model';

/** Un hito del recorrido, expresado como fraccion del total de etapas. */
interface Hito {
  fraccion: number;
  label: string;
  reached: boolean;
}

@Component({
  selector: 'app-flujo',
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

  // Etapas por periodo y etapas totales. Los valores por defecto eran 240 y
  // 10.000: aportacion mensual y meta de ahorro del producto anterior.
  newContribution = 2;
  newTarget       = 5;

  // Historial de documentos del mes
  /** Movimientos documentales del periodo, para dar contexto al ritmo. */
  documentosEnFlujo = 0;

  readonly milestones: Hito[] = [
    // Fracciones del recorrido, no cifras: un flujo de tres etapas y otro
    // de diez deben leerse igual de bien.
    { fraccion: 0.25, label: '25%',  reached: false },
    { fraccion: 0.50, label: '50%',  reached: false },
    { fraccion: 0.75, label: '75%',  reached: false },
    { fraccion: 1.00, label: '100%', reached: false },
  ];

  get progress(): number {
    return this.goal() ? this.workflowService.calcAvance(this.goal()!) : 0;
  }

  get estimatedDate(): string {
    return this.goal() ? this.workflowService.calcFechaEstimada(this.goal()!.periodosParaCierre) : '';
  }

  get milestonesWithStatus(): Hito[] {
    const current = this.goal()?.etapasCompletadas ?? 0;
    const total = this.goal()?.etapasTotales || 1;
    return this.milestones.map(m => ({ ...m, reached: current >= m.fraccion * total }));
  }

  /** Periodos que faltan si se aprueban N etapas por periodo. */
  projectMonths(contribution: number): number {
    const g = this.goal();
    if (!g || contribution <= 0) return 0;
    const remaining = g.etapasTotales - g.etapasCompletadas;
    if (remaining <= 0) return 0;
    return Math.ceil(remaining / contribution);
  }

  /**
   * A que ritmo se cierra el flujo segun cuantas etapas se aprueben por
   * periodo. Antes eran aportaciones de 120, 240 y 360 soles rotuladas como
   * porcentajes de ahorro; un flujo tiene tres o cuatro etapas, no
   * trescientas.
   */
  get scenarios() {
    const g = this.goal();
    if (!g) return [];
    return [
      { label: 'Una etapa por periodo',    contribution: 1, months: this.projectMonths(1) },
      { label: 'Dos etapas por periodo',   contribution: 2, months: this.projectMonths(2) },
      { label: 'Tres etapas por periodo',  contribution: 3, months: this.projectMonths(3) },
      { label: 'Ritmo actual', contribution: g.etapasPorPeriodo, months: g.periodosParaCierre ?? 0 },
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
      this.errorMsg.set('El ritmo debe ser de al menos una etapa por periodo.');
      return;
    }
    const goal = this.goal();
    if (!goal) {
      this.errorMsg.set('No hay ningún flujo activo.');
      return;
    }
    this.isSaving.set(true);
    this.errorMsg.set('');
    try {
      await this.workflowService.update(goal.id, { etapasPorPeriodo: this.newContribution });
      await this.loadData();
      this.showEditContribution.set(false);
      this.showSuccess('Ritmo actualizado. Los periodos se recalcularon.');
    } catch (e: any) {
      this.errorMsg.set(e.message);
    } finally {
      this.isSaving.set(false);
    }
  }

  // ─── Editar meta ─────────────────────────────────────────
  async saveTarget() {
    if (this.newTarget <= 0) {
      this.errorMsg.set('El flujo necesita al menos una etapa.');
      return;
    }
    const goal = this.goal();
    if (!goal) {
      this.errorMsg.set('No hay ningún flujo activo.');
      return;
    }
    this.isSaving.set(true);
    this.errorMsg.set('');
    try {
      await this.workflowService.update(goal.id, { etapasTotales: this.newTarget });
      await this.loadData();
      this.showEditTarget.set(false);
      this.showSuccess('Etapas del flujo actualizadas.');
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
    if (months === 0) return 'Flujo completado';
    if (months === 1) return '1 periodo';
    if (months < 12)  return `${months} periodos`;
    const years = Math.floor(months / 12);
    const rem   = months % 12;
    return rem > 0 ? `${years} año${years > 1 ? 's' : ''} y ${rem} mes${rem > 1 ? 'es' : ''}` : `${years} año${years > 1 ? 's' : ''}`;
  }
}