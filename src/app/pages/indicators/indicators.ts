import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HistoryService } from '../../core/services/history';
import { DocumentService } from '../../core/services/document';

interface Insight {
  title: string;
  description: string;
  type: 'warning' | 'positive' | 'info';
}

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
  totals = signal({ entradas: 0, salidas: 0, neto: 0, total: 0 });
  topCategories = signal<{ name: string; amount: number; percentage: number }[]>([]);
  monthlyTrend = signal<number[]>([]);

  now = new Date();
  currentMonth = this.now.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });

  months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'];

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
    const total = t.entradas + t.salidas;
    if (total === 0) return '0, 100';
    return `${(t.entradas / total) * 47.5}, 100`;
  }

  get expenseDash(): string {
    const t = this.totals();
    const total = t.entradas + t.salidas;
    if (total === 0) return '0, 100';
    return `${(t.salidas / total) * 47.5}, 100`;
  }

  get tasaVigencia(): number {
    const t = this.totals();
    if (t.entradas === 0) return 0;
    return Math.round(((t.entradas - t.salidas) / t.entradas) * 100);
  }

  insights = computed<Insight[]>(() => {
    const t = this.totals();
    const list: Insight[] = [];

    if (t.salidas > t.entradas) {
      list.push({
        title: 'Solicitudes exceden documentos',
        description: 'Atiende primero las solicitudes prioritarias',
        type: 'warning'
      });
    }

    if (this.tasaVigencia > 20) {
      list.push({
        title: 'Acervo bajo control',
        description: `El ${this.tasaVigencia}% de tus documentos está aprobado y vigente`,
        type: 'positive'
      });
    }

    list.push({
      title: 'Consejo del día',
      description: 'Revisa cada mes los documentos por vencer',
      type: 'info'
    });

    return list;
  });

  async ngOnInit() {
    await this.loadData();
  }

  async loadData() {
    const txs = await this.historyService.getPorPeriodo(this.now.getFullYear(), this.now.getMonth() + 1);
    const totals = this.historyService.calcTotales(txs);
    this.totals.set(totals);

    // calcPorCategoria devuelve un Record<categoria, conteo>
    const porCat = this.historyService.calcPorCategoria(txs);
    const entradas = Object.entries(porCat) as [string, number][];
    const totalMovs = entradas.reduce((sum, [, n]) => sum + n, 0);

    this.topCategories.set(
      entradas
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([nombre, n]) => ({
          name: nombre,
          amount: n,
          percentage: totalMovs > 0 ? (n / totalMovs) * 100 : 0
        }))
    );

    this.monthlyTrend.set([1200, 1400, 1100, 1600, 1300, totals.salidas]);
  }

  formatSol(n: number): string {
    return `${Math.abs(n).toFixed(2)}`;
  }
}