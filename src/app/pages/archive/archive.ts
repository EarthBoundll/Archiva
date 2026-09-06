import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { WorkflowService } from '../../core/services/workflow';
import { HistoryService } from '../../core/services/history';
import { DocumentService } from '../../core/services/document';
import { FlujoAprobacion } from '../../core/models/workflow.model';

/** Cuantos documentos se enviaron al archivo en un mes. */
interface ArchivadosPorMes {
  month: string;
  cantidad: number;
}

@Component({
  selector: 'app-archivo',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './archive.html',
  styleUrl: './archive.scss'
})
export class ArchiveComponent implements OnInit {
  private workflowService = inject(WorkflowService);
  private historyService  = inject(HistoryService);
  private documentService = inject(DocumentService);

  isLoading = signal(true);
  currentGoal = signal<FlujoAprobacion | null>(null);
  monthlyHistory = signal<ArchivadosPorMes[]>([]);

  now = new Date();
  currentMonth = this.now.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });
  lastMonthName = new Date(this.now.getFullYear(), this.now.getMonth() - 1, 1)
    .toLocaleDateString('es-PE', { month: 'long' });

  archivadosEstePeriodo = 0;
  archivadosMesAnterior = 0;
  archivadosAcumulados  = 0;
  monthChange = 0;
  acervoTotal = 0;
  metaArchivado = 0;

  /** Documentos que ya reposan en el archivo definitivo. */
  acervoArchivado = 0;

  async ngOnInit() {
    await this.loadData();
  }

  async loadData() {
    this.isLoading.set(true);
    try {
      const [flujos, acervo, bitacora] = await Promise.all([
        this.workflowService.getAll(),
        this.documentService.getResumenAcervo(),
        // Una sola lectura para los seis meses: antes eran seis viajes a
        // Firestore, uno por mes, ejecutados en serie.
        this.historyService.getBitacora()
      ]);

      this.currentGoal.set(flujos.find(g => g.status === 'active') || flujos[0] || null);

      this.acervoTotal     = acervo?.total ?? 0;
      this.acervoArchivado = acervo?.archivados ?? 0;

      // Objetivo de depuracion sugerido: un quinto del acervo controlado.
      this.metaArchivado = Math.ceil(this.acervoTotal * 0.2);

      // Archivar es una accion concreta de la bitacora. La version anterior
      // restaba salidas menos entradas, que mezcla observaciones y rechazos
      // con el envio al archivo y no mide lo que dice medir.
      const archivadosDe = (year: number, month: number) => {
        const prefijo = `${year}-${String(month).padStart(2, '0')}`;
        return bitacora.filter(r => r.accion === 'archivado' && r.date.startsWith(prefijo)).length;
      };

      this.archivadosEstePeriodo = archivadosDe(this.now.getFullYear(), this.now.getMonth() + 1);

      const anterior = new Date(this.now.getFullYear(), this.now.getMonth() - 1, 1);
      this.archivadosMesAnterior = archivadosDe(anterior.getFullYear(), anterior.getMonth() + 1);

      this.monthChange = this.archivadosMesAnterior > 0
        ? ((this.archivadosEstePeriodo - this.archivadosMesAnterior) / this.archivadosMesAnterior) * 100
        : 0;

      const historial: ArchivadosPorMes[] = [];
      this.archivadosAcumulados = 0;

      for (let i = 5; i >= 0; i--) {
        const d = new Date(this.now.getFullYear(), this.now.getMonth() - i, 1);
        const cantidad = archivadosDe(d.getFullYear(), d.getMonth() + 1);

        historial.push({
          month: d.toLocaleDateString('es-PE', { month: 'short' }),
          cantidad
        });
        this.archivadosAcumulados += cantidad;
      }

      this.monthlyHistory.set(historial);
    } finally {
      this.isLoading.set(false);
    }
  }

  /** Meses de los seis en que se archivo algo. */
  get mesesConArchivo(): number {
    return this.monthlyHistory().filter(m => m.cantidad > 0).length;
  }

  /** Solo tiene sentido comparar cuando hubo con que comparar. */
  get hayComparacion(): boolean {
    return this.archivadosMesAnterior > 0;
  }

  /** Los documentos se cuentan en enteros, no en decimales. */
  formatoConteo(n: number): string {
    return Math.abs(Math.round(n)).toLocaleString('es-PE');
  }

  getBarHeight(cantidad: number): number {
    const max = Math.max(...this.monthlyHistory().map(m => m.cantidad), 1);
    return max > 0 ? (cantidad / max) * 100 : 0;
  }

  get goalProgress(): number {
    const g = this.currentGoal();
    return g ? this.workflowService.calcAvance(g) : 0;
  }
}
