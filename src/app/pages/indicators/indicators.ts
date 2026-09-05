import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HistoryService } from '../../core/services/history';
import { DocumentService } from '../../core/services/document';

interface Insight {
  title: string;
  description: string;
  type: 'warning' | 'positive' | 'info';
}

const TREND_MONTHS = 6;

@Component({
  selector: 'app-insights',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './indicators.html',
  styleUrl: './indicators.scss'
})
export class IndicatorsComponent implements OnInit {
  private historyService = inject(HistoryService);
  private documentService = inject(DocumentService);

  period = signal<'month' | 'year'>('month');
  totals = signal({ income: 0, expenses: 0, balance: 0 });
  previousTotals = signal({ income: 0, expenses: 0, balance: 0 });
  topCategories = signal<{ name: string; amount: number; percentage: number }[]>([]);
  monthlyTrend = signal<number[]>([]);

  now = new Date();
  currentMonth = this.now.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });

  // Los seis periodos que alimentan la tendencia, terminando en el mes actual.
  private trendPeriods = Array.from({ length: TREND_MONTHS }, (_, i) => {
    const d = new Date(this.now.getFullYear(), this.now.getMonth() - (TREND_MONTHS - 1 - i), 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1, date: d };
  });

  months = this.trendPeriods.map(p => {
    const label = p.date.toLocaleDateString('es-PE', { month: 'short' }).replace('.', '');
    return label.charAt(0).toUpperCase() + label.slice(1);
  });

  // Variación real frente al mes anterior. Se usa el valor absoluto del periodo
  // previo como denominador para que un balance negativo no invierta el signo.
  comparisons = computed(() => {
    const cur = this.totals();
    const prev = this.previousTotals();
    const change = (a: number, b: number) => {
      if (b === 0) return a === 0 ? 0 : 100;
      return Math.round(((a - b) / Math.abs(b)) * 100);
    };
    return [
      { label: 'Documentos', value: change(cur.income, prev.income) },
      { label: 'Solicitudes', value: change(cur.expenses, prev.expenses) },
      { label: 'Archivo', value: change(cur.balance, prev.balance) }
    ];
  });

  get spendingPath(): string {
    const data = this.monthlyTrend();
    if (data.length < 2) return '';
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    const width = 280;
    const height = 100;
    const step = width / (data.length - 1);

    return data.map((v, i) => 
      `${i === 0 ? 'M' : 'L'} ${i * step + 10},${height - ((v - min) / range) * height + 10}`
    ).join(' ');
  }

  get spendingArea(): string {
    const path = this.spendingPath;
    return path ? `${path} L 290,110 L 10,110 Z` : '';
  }

  get incomeDash(): string {
    const t = this.totals();
    const total = t.income + t.expenses;
    if (total === 0) return '0, 100';
    return `${(t.income / total) * 47.5}, 100`;
  }

  get expenseDash(): string {
    const t = this.totals();
    const total = t.income + t.expenses;
    if (total === 0) return '0, 100';
    return `${(t.expenses / total) * 47.5}, 100`;
  }

  get savingsRate(): number {
    const t = this.totals();
    if (t.income === 0) return 0;
    return Math.round(((t.income - t.expenses) / t.income) * 100);
  }

  insights = computed<Insight[]>(() => {
    const t = this.totals();
    const list: Insight[] = [];

    if (t.expenses > t.income) {
      list.push({
        title: 'Solicitudes exceden documentos',
        description: 'Considera reducir solicitudes no esenciales',
        type: 'warning'
      });
    }

    if (this.savingsRate > 20) {
      list.push({
        title: '¡Excelente archivo!',
        description: `Archivas el ${this.savingsRate}% de los documentos que ingresan`,
        type: 'positive'
      });
    }

    list.push({
      title: 'Consejo del día',
      description: 'Revisa los vencimientos de tus documentos cada mes',
      type: 'info'
    });

    return list;
  });

  async ngOnInit() {
    await this.loadData();
  }

  async loadData() {
    // Un periodo por punto de la tendencia; el último es el mes en curso.
    const periods = await Promise.all(
      this.trendPeriods.map(p => this.historyService.getPorPeriodo(p.year, p.month))
    );
    const totalsPorPeriodo = periods.map(txs => this.historyService.calcTotales(txs));

    const txs = periods[periods.length - 1];
    const totals = totalsPorPeriodo[totalsPorPeriodo.length - 1];
    this.totals.set(totals);
    this.previousTotals.set(
      totalsPorPeriodo[totalsPorPeriodo.length - 2] ?? { income: 0, expenses: 0, balance: 0 }
    );
    this.monthlyTrend.set(totalsPorPeriodo.map(t => t.expenses));

    const byCat = this.historyService.calcPorCategoria(txs);
    const totalExpenses = byCat.reduce((sum, c) => sum + c.total, 0);
    this.topCategories.set(
      byCat.slice(0, 5).map(c => ({
        name: c.name,
        amount: c.total,
        percentage: totalExpenses > 0 ? (c.total / totalExpenses) * 100 : 0
      }))
    );
  }

  formatSol(n: number): string {
    return `${Math.abs(n).toFixed(2)}`;
  }
}