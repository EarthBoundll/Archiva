import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';
import type { ChartConfiguration } from 'chart.js';

import { DocumentService, type ResumenAcervo } from '../../core/services/document';
import { HistoryService } from '../../core/services/history';
import { WorkflowService } from '../../core/services/workflow';
import { IconComponent } from '../../core/components/icon/icon.component';
import { log } from '../../core/utils/logger';
import {
  Documento,
  EstadoDocumental,
  ESTADOS_DOCUMENTALES,
  CATEGORIAS_DOCUMENTALES,
  type CategoriaDocumental
} from '../../core/models/document.model';
import { RegistroHistorial, ACCIONES } from '../../core/models/history.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, BaseChartDirective, IconComponent],
  // Chart.js se registra aqui y no en app.config para que viaje en el
  // chunk diferido del tablero, no en el bundle inicial.
  providers: [provideCharts(withDefaultRegisterables())],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class DashboardComponent implements OnInit {

  private documentService = inject(DocumentService);
  private historyService  = inject(HistoryService);
  private workflowService = inject(WorkflowService);

  cargando   = signal(true);
  documentos = signal<Documento[]>([]);
  acervo     = signal<ResumenAcervo | null>(null);
  bitacora   = signal<RegistroHistorial[]>([]);
  flujos     = signal<any[]>([]);

  estados    = ESTADOS_DOCUMENTALES;
  categorias = CATEGORIAS_DOCUMENTALES;
  acciones   = ACCIONES;

  private ahora = new Date();

  periodoActual = this.ahora.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });

  // ============================================
  // METRICAS
  // ============================================

  /** Documentos que vencen en 30 dias o menos, ordenados por urgencia. */
  proximosVencimientos = computed(() =>
    this.documentos()
      .filter(d =>
        d.estado === 'aprobado' &&
        d.vencimiento.diasParaVencer !== null &&
        d.vencimiento.diasParaVencer <= 30)
      .sort((a, b) => (a.vencimiento.diasParaVencer ?? 0) - (b.vencimiento.diasParaVencer ?? 0))
      .slice(0, 5)
  );

  requierenAccion = computed(() =>
    this.documentos().filter(d =>
      d.estado === 'observado' || d.estado === 'rechazado' || d.estado === 'vencido')
  );

  actividadReciente = computed(() => this.bitacora().slice(0, 6));

  flujosEnCurso = computed(() =>
    this.flujos().filter(f => f.status === 'active' || f.estado === 'en_curso')
  );

  /** Distribucion por estado, solo los estados con documentos. */
  distribucion = computed(() => {
    const a = this.acervo();
    if (!a) return [];
    const total = a.total || 1;

    return (Object.keys(ESTADOS_DOCUMENTALES) as EstadoDocumental[])
      .map(e => ({
        estado: e,
        label: ESTADOS_DOCUMENTALES[e].label,
        token: ESTADOS_DOCUMENTALES[e].token,
        n: a.porEstado[e] ?? 0,
        pct: Math.round(((a.porEstado[e] ?? 0) / total) * 100)
      }))
      .filter(x => x.n > 0);
  });

  porCategoria = computed(() => {
    const a = this.acervo();
    if (!a) return [];
    const total = a.total || 1;

    return Object.entries(a.porCategoria)
      .map(([c, n]) => ({
        label: CATEGORIAS_DOCUMENTALES[c as CategoriaDocumental]?.label ?? c,
        n,
        pct: Math.round((n / total) * 100)
      }))
      .sort((x, y) => y.n - x.n)
      .slice(0, 6);
  });

  // ============================================
  // GRAFICOS
  // ============================================

  /** Movimientos por dia del periodo: entradas frente a salidas. */
  flujoChart: ChartConfiguration<'bar'>['data'] = { labels: [], datasets: [] };

  flujoOpciones: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, usePointStyle: true } } },
    scales: {
      x: { grid: { display: false } },
      y: { beginAtZero: true, ticks: { precision: 0 } }
    }
  };

  cicloChart: ChartConfiguration<'doughnut'>['data'] = { labels: [], datasets: [] };

  cicloOpciones: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',
    plugins: { legend: { position: 'right', labels: { boxWidth: 12, usePointStyle: true } } }
  };

  // ============================================
  // CARGA
  // ============================================

  async ngOnInit() {
    this.cargando.set(true);

    try {
      const [docs, bitacora, flujos] = await Promise.all([
        this.documentService.getAll(),
        this.historyService.getBitacora(),
        this.workflowService.getAll().catch(() => [])
      ]);

      this.documentos.set(docs);
      this.bitacora.set(bitacora);
      this.flujos.set(flujos);
      this.acervo.set(await this.documentService.getResumenAcervo(docs));

      this.construirGraficos(bitacora);
    } catch (e) {
      log.error('Error cargando el tablero:', e);
    } finally {
      this.cargando.set(false);
    }
  }

  private construirGraficos(bitacora: RegistroHistorial[]) {
    // Movimientos de los ultimos seis meses
    const etiquetas: string[] = [];
    const entradas: number[] = [];
    const salidas: number[] = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(this.ahora.getFullYear(), this.ahora.getMonth() - i, 1);
      const prefijo = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

      etiquetas.push(d.toLocaleDateString('es-PE', { month: 'short' }));
      const delMes = bitacora.filter(r => r.date?.startsWith(prefijo));
      entradas.push(delMes.filter(r => r.tipo === 'entrada').length);
      salidas.push(delMes.filter(r => r.tipo === 'salida').length);
    }

    const css = getComputedStyle(document.documentElement);
    const primario = css.getPropertyValue('--color-primary').trim() || '#1F4959';
    const acento   = css.getPropertyValue('--color-accent').trim()  || '#C97B3C';

    this.flujoChart = {
      labels: etiquetas,
      datasets: [
        { label: 'Entradas', data: entradas, backgroundColor: primario, borderRadius: 4 },
        { label: 'Salidas',  data: salidas,  backgroundColor: acento,   borderRadius: 4 }
      ]
    };

    const dist = this.distribucion();
    this.cicloChart = {
      labels: dist.map(d => d.label),
      datasets: [{
        data: dist.map(d => d.n),
        backgroundColor: dist.map(d => css.getPropertyValue(
          d.token.replace('var(', '').replace(')', '')
        ).trim() || primario),
        borderWidth: 0
      }]
    };
  }

  // ============================================
  // PRESENTACION
  // ============================================

  textoVencimiento(d: Documento): string {
    const dias = d.vencimiento.diasParaVencer;
    if (dias === null) return 'Sin vencimiento';
    if (dias < 0)  return `Venció hace ${Math.abs(dias)} d`;
    if (dias === 0) return 'Vence hoy';
    return `Vence en ${dias} d`;
  }

  formatoMb(mb: number): string {
    if (!mb) return '0 MB';
    if (mb < 1) return `${Math.round(mb * 1024)} KB`;
    return `${mb.toLocaleString('es-PE', { maximumFractionDigits: 1 })} MB`;
  }

  fechaCorta(iso: string): string {
    if (!iso) return '';
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const d = new Date(iso + 'T00:00:00');
    const dias = Math.round((hoy.getTime() - d.getTime()) / 86400000);
    if (dias === 0) return 'Hoy';
    if (dias === 1) return 'Ayer';
    return d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' });
  }
}
