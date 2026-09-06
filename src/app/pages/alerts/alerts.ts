import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AlertsService, Alerta, Urgencia } from '../../core/services/alerts';
import { IconComponent } from '../../core/components/icon/icon.component';

const ROTULOS: Record<Urgencia, string> = {
  critica: 'Crítica',
  alta:    'Alta',
  media:   'Media',
  baja:    'Baja'
};

@Component({
  selector: 'app-alertas',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './alerts.html',
  styleUrl: './alerts.scss'
})
export class AlertsComponent implements OnInit {
  private alertsService = inject(AlertsService);
  private router = inject(Router);

  alertas  = signal<Alerta[]>([]);
  cargando = signal(true);
  error    = signal<string | null>(null);

  /** null = sin filtro. */
  filtro = signal<Urgencia | null>(null);

  private now = new Date();
  currentMonth = this.now.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });

  urgencias: Urgencia[] = ['critica', 'alta', 'media', 'baja'];

  conteos = computed(() => {
    const c: Record<Urgencia, number> = { critica: 0, alta: 0, media: 0, baja: 0 };
    for (const a of this.alertas()) c[a.urgencia]++;
    return c;
  });

  visibles = computed(() => {
    const f = this.filtro();
    return f ? this.alertas().filter(a => a.urgencia === f) : this.alertas();
  });

  /** La cifra que resume el estado: lo que no puede esperar. */
  urgentes = computed(() => this.conteos().critica + this.conteos().alta);

  async ngOnInit() {
    await this.cargar();
  }

  async cargar() {
    this.cargando.set(true);
    this.error.set(null);
    try {
      this.alertas.set(
        await this.alertsService.getAlertasDocumentales(
          this.now.getFullYear(), this.now.getMonth() + 1
        )
      );
    } catch {
      this.error.set('No se pudieron leer las alertas. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      this.cargando.set(false);
    }
  }

  alternarFiltro(u: Urgencia) {
    this.filtro.set(this.filtro() === u ? null : u);
  }

  abrir(a: Alerta) {
    this.router.navigate([a.ruta]);
  }

  rotulo(u: Urgencia): string {
    return ROTULOS[u];
  }
}
