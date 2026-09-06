import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import { WorkflowService } from '../../core/services/workflow';
import { IconComponent } from '../../core/components/icon/icon.component';
import { DialogoDirective } from '../../core/directives/dialogo.directive';
import {
  FlujoAprobacion,
  EtapaAprobacion,
  ResultadoEtapa,
  TIPOS_FLUJO,
  PRIORIDADES_FLUJO,
  ESTADOS_FLUJO,
  RESULTADOS_ETAPA,
  nombreDeEtapa,
  admiteResolucion,
  admiteReanudacion
} from '../../core/models/workflow.model';

/** Una etapa del recorrido, con lo que le ha pasado hasta ahora. */
interface EtapaVista {
  orden: number;
  nombre: string;
  estado: 'aprobada' | 'pendiente' | 'actual' | 'suspendida';
  /** Resoluciones registradas sobre esta etapa, la más reciente primero. */
  resoluciones: EtapaAprobacion[];
}

@Component({
  selector: 'app-flujo',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, IconComponent, DialogoDirective],
  templateUrl: './workflow.html',
  styleUrl: './workflow.scss'
})
export class WorkflowComponent implements OnInit {
  private service = inject(WorkflowService);
  private ruta = inject(ActivatedRoute);
  private router = inject(Router);

  flujo    = signal<FlujoAprobacion | null>(null);
  cargando = signal(true);
  error    = signal<string | null>(null);

  // Resolución de la etapa en curso
  modalResolver = signal(false);
  fAprobador    = signal('');
  fResultado    = signal<ResultadoEtapa>('aprobada');
  fObservacion  = signal('');
  resolviendo   = signal(false);
  errorForm     = signal('');

  tipos       = TIPOS_FLUJO;
  prioridades = PRIORIDADES_FLUJO;
  estados     = ESTADOS_FLUJO;
  resultados  = RESULTADOS_ETAPA;

  listaResultados = (Object.keys(RESULTADOS_ETAPA) as ResultadoEtapa[])
    .map(r => ({ value: r, ...RESULTADOS_ETAPA[r] }));

  avance = computed(() => {
    const f = this.flujo();
    return f ? this.service.calcAvance(f) : 0;
  });

  puedeResolver = computed(() => {
    const f = this.flujo();
    return !!f && admiteResolucion(f);
  });

  puedeReanudar = computed(() => {
    const f = this.flujo();
    return !!f && admiteReanudacion(f);
  });

  siguiente = computed(() => {
    const f = this.flujo();
    return f ? this.service.siguienteEtapa(f) : null;
  });

  /**
   * El recorrido completo: una fila por etapa prevista, con las
   * resoluciones que haya recibido. Una etapa observada aparece con su
   * historial y sigue pendiente, que es justo lo que hay que ver.
   */
  recorrido = computed<EtapaVista[]>(() => {
    const f = this.flujo();
    if (!f) return [];

    const porOrden = new Map<number, EtapaAprobacion[]>();
    for (const e of f.etapas ?? []) {
      if (!porOrden.has(e.orden)) porOrden.set(e.orden, []);
      porOrden.get(e.orden)!.push(e);
    }

    const filas: EtapaVista[] = [];
    for (let orden = 1; orden <= f.etapasTotales; orden++) {
      const resoluciones = (porOrden.get(orden) ?? [])
        .sort((a, b) => b.date.localeCompare(a.date));

      let estado: EtapaVista['estado'] = 'pendiente';
      if (orden <= f.etapasCompletadas)                   estado = 'aprobada';
      else if (f.status === 'paused' && orden === f.etapasCompletadas + 1) estado = 'suspendida';
      else if (orden === f.etapasCompletadas + 1)         estado = 'actual';

      filas.push({ orden, nombre: nombreDeEtapa(f, orden), estado, resoluciones });
    }
    return filas;
  });

  /** Todas las resoluciones registradas, de la más reciente a la más antigua. */
  historial = computed<EtapaAprobacion[]>(() =>
    [...(this.flujo()?.etapas ?? [])].sort((a, b) => b.date.localeCompare(a.date))
  );

  async ngOnInit() {
    const id = this.ruta.snapshot.paramMap.get('id');
    if (!id) { this.router.navigate(['/flujos']); return; }
    await this.cargar(id);
  }

  async cargar(id: string) {
    this.cargando.set(true);
    this.error.set(null);
    try {
      const f = await this.service.getById(id);
      if (!f) { this.error.set('Ese flujo no existe o fue retirado.'); return; }
      this.flujo.set(f);
    } catch {
      this.error.set('No se pudo leer el flujo. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      this.cargando.set(false);
    }
  }

  // ------------------------------------------
  // RESOLUCION
  // ------------------------------------------

  abrirResolver() {
    this.fAprobador.set('');
    this.fResultado.set('aprobada');
    this.fObservacion.set('');
    this.errorForm.set('');
    this.modalResolver.set(true);
  }

  cerrarResolver() {
    if (this.resolviendo()) return;
    this.modalResolver.set(false);
  }

  /** Observar y rechazar exigen motivo; aprobar no. */
  get exigeMotivo(): boolean {
    return this.fResultado() !== 'aprobada';
  }

  async resolver() {
    const f = this.flujo();
    if (!f || this.resolviendo()) return;

    this.resolviendo.set(true);
    this.errorForm.set('');
    try {
      const actualizado = await this.service.resolverEtapa(f.id, {
        aprobador: this.fAprobador(),
        resultado: this.fResultado(),
        observacion: this.fObservacion() || undefined
      });
      this.flujo.set(actualizado);
      this.modalResolver.set(false);
    } catch (e: any) {
      this.errorForm.set(e?.message ?? 'No se pudo registrar la resolución.');
    } finally {
      this.resolviendo.set(false);
    }
  }

  async reanudar() {
    const f = this.flujo();
    if (!f) return;
    try {
      this.flujo.set(await this.service.reanudar(f.id));
    } catch (e: any) {
      this.error.set(e?.message ?? 'No se pudo reanudar el flujo.');
    }
  }

  // ------------------------------------------
  // PRESENTACION
  // ------------------------------------------

  cierreEstimado(): string {
    const f = this.flujo();
    return f ? this.service.calcFechaEstimada(f.periodosParaCierre) : '';
  }

  vencido(): boolean {
    const f = this.flujo();
    if (!f || f.status !== 'active' || !f.fechaLimiteCierre) return false;
    const d = new Date();
    const hoy = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return f.fechaLimiteCierre < hoy;
  }

  fechaLarga(iso?: string): string {
    if (!iso) return '';
    const d = new Date(iso.length > 10 ? iso : iso + 'T00:00:00');
    return d.toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  fechaHora(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' }) +
           ' · ' + d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  }

  /** Perímetro del anillo de avance, para el trazo. */
  get arco(): string {
    return `${this.avance()}, 100`;
  }
}
