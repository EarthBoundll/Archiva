import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HistoryService } from '../../core/services/history';
import { IconComponent } from '../../core/components/icon/icon.component';
import { log } from '../../core/utils/logger';
import {
  RegistroHistorial,
  AccionDocumental,
  ACCIONES
} from '../../core/models/history.model';
import { CATEGORIAS_DOCUMENTALES, type CategoriaDocumental } from '../../core/models/document.model';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './history.html',
  styleUrl: './history.scss'
})
export class HistoryComponent implements OnInit {

  private historyService = inject(HistoryService);

  registros = signal<RegistroHistorial[]>([]);
  cargando  = signal(true);

  filtroAccion = signal<AccionDocumental | 'todas'>('todas');
  busqueda     = signal('');

  acciones      = ACCIONES;
  listaAcciones = Object.keys(ACCIONES) as AccionDocumental[];
  categorias    = CATEGORIAS_DOCUMENTALES;

  totales = computed(() => this.historyService.calcTotales(this.registros()));

  conteoPorAccion = computed(() => this.historyService.calcPorAccion(this.registros()));

  filtrados = computed(() => {
    const a = this.filtroAccion();
    const q = this.busqueda().trim().toLowerCase();

    return this.registros().filter(r => {
      if (a !== 'todas' && r.accion !== a) return false;
      if (q && !`${r.codigo} ${r.titulo} ${r.responsable}`.toLowerCase().includes(q)) return false;
      return true;
    });
  });

  porDia = computed(() => this.historyService.agruparPorDia(this.filtrados()));

  async ngOnInit() {
    this.cargando.set(true);
    try {
      this.registros.set(await this.historyService.getBitacora());
    } catch (e) {
      log.error('Error cargando la bitácora:', e);
    } finally {
      this.cargando.set(false);
    }
  }

  etiquetaCategoria(c?: string): string {
    if (!c) return '';
    return CATEGORIAS_DOCUMENTALES[c as CategoriaDocumental]?.label ?? c;
  }

  fechaLarga(iso: string): string {
    if (!iso) return '';
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const d = new Date(iso + 'T00:00:00');
    const dias = Math.round((hoy.getTime() - d.getTime()) / 86400000);

    if (dias === 0) return 'Hoy';
    if (dias === 1) return 'Ayer';

    return d.toLocaleDateString('es-PE', {
      weekday: 'long', day: 'numeric', month: 'long'
    });
  }

  trackId(_: number, r: RegistroHistorial) { return r.id; }
}
