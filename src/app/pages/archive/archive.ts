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

  archivadosEstePeriodo = 0;
  lastMonthSaved = 0;
  archivadosAcumulados = 0;
  monthChange = 0;
  acervoTotal = 0;
  metaArchivado = 0;

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

      // Acervo total y meta de archivado del periodo: el 20% del acervo
      // controlado es el objetivo de depuracion sugerido por periodo.
      const acervo = await this.documentService.getResumenAcervo();
      this.acervoTotal = acervo?.total ?? 0;
      this.metaArchivado = Math.ceil(this.acervoTotal * 0.2);

      // Calculate this month savings
      const currentMonthTx = await this.historyService.getPorPeriodo(
        this.now.getFullYear(),
        this.now.getMonth() + 1
      );
      const monthlyTxIncome = currentMonthTx.filter(t => t.tipo === 'entrada').length;
      const expenses = Math.abs(currentMonthTx.filter(t => t.tipo === 'salida').length);
      this.archivadosEstePeriodo = monthlyTxIncome - expenses;

      // Last month comparison
      const lastMonthDate = new Date(this.now.getFullYear(), this.now.getMonth() - 1, 1);
      const lastMonthTx = await this.historyService.getPorPeriodo(
        lastMonthDate.getFullYear(),
        lastMonthDate.getMonth() + 1
      );
      const lastMonthIncome = lastMonthTx.filter(t => t.tipo === 'entrada').length;
      const lastMonthExpenses = Math.abs(lastMonthTx.filter(t => t.tipo === 'salida').length);
      this.lastMonthSaved = lastMonthIncome - lastMonthExpenses;

      this.monthChange = this.lastMonthSaved > 0
        ? ((this.archivadosEstePeriodo - this.lastMonthSaved) / Math.abs(this.lastMonthSaved)) * 100
        : 0;

      // Get 6-month history
      const history: MonthlySavings[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(this.now.getFullYear(), this.now.getMonth() - i, 1);
        const tx = await this.historyService.getPorPeriodo(d.getFullYear(), d.getMonth() + 1);
        const inc = tx.filter(t => t.tipo === 'entrada').length;
        const exp = Math.abs(tx.filter(t => t.tipo === 'salida').length);
        const saved = inc - exp;
        
        history.push({
          month: d.toLocaleDateString('es-PE', { month: 'short' }),
          amount: saved > 0 ? saved : 0
        });

        if (saved > 0) this.archivadosAcumulados += saved;
      }
      this.monthlyHistory.set(history);
    } finally {
      this.isLoading.set(false);
    }
  }

 /** Los documentos se cuentan en enteros, no en decimales. */
  formatoConteo(n: number): string {
    return Math.abs(Math.round(n)).toLocaleString('es-PE');
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