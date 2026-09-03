import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { WorkflowService } from '../../core/services/workflow';
import { HistoryService } from '../../core/services/history';
import { DocumentService } from '../../core/services/document';
import { FlujoAprobacion } from '../../core/models/workflow.model';

interface MonthlySavings {
  month: string;
  amount: number;
}

@Component({
  selector: 'app-savings',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './archive.html',
  styleUrl: './archive.scss'
})
export class ArchiveComponent implements OnInit {
  private workflowService = inject(WorkflowService);
  private historyService = inject(HistoryService);
  private documentService = inject(DocumentService);

  isLoading = signal(true);
  currentGoal = signal<FlujoAprobacion | null>(null);
  monthlyHistory = signal<MonthlySavings[]>([]);

  now = new Date();
  currentMonth = this.now.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });
  lastMonthName = new Date(this.now.getFullYear(), this.now.getMonth() - 1, 1)
    .toLocaleDateString('es-PE', { month: 'long' });

  totalSavedThisMonth = 0;
  lastMonthSaved = 0;
  totalSavedAllTime = 0;
  monthChange = 0;
  monthlyIncome = 0;
  target20Percent = 0;

  async ngOnInit() {
    await this.loadData();
  }

  async loadData() {
    this.isLoading.set(true);
    try {
      // Get current goal
      const goals = await this.workflowService.getAll();
      const activeGoal = goals.find(g => g.status === 'active') || goals[0] || null;
      this.currentGoal.set(activeGoal);

      // Get monthly income for 20% target
      const income = await this.documentService.getDocumentosPeriodo(
        this.now.getFullYear(),
        this.now.getMonth() + 1
      );
      this.monthlyIncome = income?.totalBudgeted ?? 0;
      this.target20Percent = this.monthlyIncome * 0.2;

      // Calculate this month savings
      const currentMonthTx = await this.historyService.getPorPeriodo(
        this.now.getFullYear(),
        this.now.getMonth() + 1
      );
      const monthlyTxIncome = currentMonthTx.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
      const expenses = Math.abs(currentMonthTx.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0));
      this.totalSavedThisMonth = monthlyTxIncome - expenses;

      // Last month comparison
      const lastMonthDate = new Date(this.now.getFullYear(), this.now.getMonth() - 1, 1);
      const lastMonthTx = await this.historyService.getPorPeriodo(
        lastMonthDate.getFullYear(),
        lastMonthDate.getMonth() + 1
      );
      const lastMonthIncome = lastMonthTx.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
      const lastMonthExpenses = Math.abs(lastMonthTx.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0));
      this.lastMonthSaved = lastMonthIncome - lastMonthExpenses;

      this.monthChange = this.lastMonthSaved > 0
        ? ((this.totalSavedThisMonth - this.lastMonthSaved) / Math.abs(this.lastMonthSaved)) * 100
        : 0;

      // Get 6-month history
      const history: MonthlySavings[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(this.now.getFullYear(), this.now.getMonth() - i, 1);
        const tx = await this.historyService.getPorPeriodo(d.getFullYear(), d.getMonth() + 1);
        const inc = tx.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
        const exp = Math.abs(tx.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0));
        const saved = inc - exp;
        
        history.push({
          month: d.toLocaleDateString('es-PE', { month: 'short' }),
          amount: saved > 0 ? saved : 0
        });

        if (saved > 0) this.totalSavedAllTime += saved;
      }
      this.monthlyHistory.set(history);
    } finally {
      this.isLoading.set(false);
    }
  }

  formatSol(n: number): string {
    return `${Math.abs(n).toFixed(2)}`;
  }

  getBarHeight(amount: number): number {
    const max = Math.max(...this.monthlyHistory().map(m => m.amount), 1);
    return max > 0 ? (amount / max) * 100 : 0;
  }

  get goalProgress(): number {
    const g = this.currentGoal();
    return g ? this.workflowService.calcAvance(g) : 0;
  }
}