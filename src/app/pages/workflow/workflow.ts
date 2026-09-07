import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import { WorkflowService } from '../../core/services/workflow';
import { ApprovalsService } from '../../core/services/approvals';
import { MembersService } from '../../core/services/members';
import { TenantService } from '../../core/services/tenant';
import { IconComponent } from '../../core/components/icon/icon.component';
import { DialogoDirective } from '../../core/directives/dialogo.directive';
import {
  FlujoAprobacion,
  EtapaAprobacion,
  TIPOS_FLUJO,
  PRIORIDADES_FLUJO,
  ESTADOS_FLUJO,
  RESULTADOS_ETAPA,
  nombreDeEtapa,
  admiteReanudacion
} from '../../core/models/workflow.model';
import {
  TareaAprobacion,
  AccionAprobacion,
  ACCIONES_APROBACION,
  estaVencida
} from '../../core/models/approval.model';
import { Miembro } from '../../core/models/member.model';

/**
 * Una etapa del recorrido.
 *
 * Se construye desde la tarea, que es donde vive quien responde de ella.
 * Antes se construia desde flujo.etapas[], que solo guardaba un nombre
 * tecleado a mano y no permitia saber si a esa persona le correspondia.
 */
interface EtapaVista {
  orden: number;
  nombre: string;
  estado: 'aprobada' | 'pendiente' | 'actual' | 'suspendida' | 'devuelta' | 'anulada';
  tarea?: TareaAprobacion;
  /** Resoluciones antiguas, de los flujos anteriores al motor de tareas. */
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
  private approvals = inject(ApprovalsService);
  private members = inject(MembersService);
  private tenant = inject(TenantService);
  private ruta = inject(ActivatedRoute);
  private router = inject(Router);

  flujo    = signal<FlujoAprobacion | null>(null);
  cargando = signal(true);
  error    = signal<string | null>(null);

  tareas   = signal<TareaAprobacion[]>([]);
  personas = signal<Miembro[]>([]);

  // Resolución de la etapa en curso
  modalResolver = signal(false);
  tareaActiva   = signal<TareaAprobacion | null>(null);
  fAccion       = signal<AccionAprobacion>('aprobar');
  fMotivo       = signal('');
  fDestinatario = signal('');
  resolviendo   = signal(false);
  errorForm     = signal('');

  tipos       = TIPOS_FLUJO;
  prioridades = PRIORIDADES_FLUJO;
  estados     = ESTADOS_FLUJO;
  /** Solo para leer el historial de los flujos anteriores al motor de tareas. */
  resultados  = RESULTADOS_ETAPA;


  avance = computed(() => {
    const f = this.flujo();
    if (!f) return 0;

    const tareas = this.tareas();
    if (!tareas.length) return this.service.calcAvance(f);

    const aprobadas = tareas.filter(t => t.accion === 'aprobar').length;
    return Math.round((aprobadas / tareas.length) * 100);
  });

  /**
   * Ahora depende de si hay una etapa que ME toque a mi, no solo de que
   * el flujo tenga etapas sueltas. Antes cualquiera podia resolver
   * cualquier etapa tecleando un nombre.
   */
  puedeResolver = computed(() => this.mias().length > 0);

  puedeReanudar = computed(() => {
    const f = this.flujo();
    return !!f && admiteReanudacion(f);
  });

  siguiente = computed(() => {
    const viva = this.tareas().find(t => t.estado === 'pendiente' || t.estado === 'delegada');
    if (viva) return { orden: viva.orden, nombre: viva.etapaNombre };

    const f = this.flujo();
    return f ? this.service.siguienteEtapa(f) : null;
  });

  /**
   * El recorrido completo: una fila por etapa, con la tarea que la
   * sostiene. Una etapa devuelta se ve con su motivo y el expediente
   * parado ahi, que es justo lo que hay que ver.
   */
  recorrido = computed<EtapaVista[]>(() => {
    const f = this.flujo();
    if (!f) return [];

    const tareas = this.tareas();

    // Los flujos anteriores al motor de tareas no tienen ninguna: se
    // siguen leyendo de flujo.etapas[] para no perder su historial.
    const antiguas = new Map<number, EtapaAprobacion[]>();
    for (const e of f.etapas ?? []) {
      if (!antiguas.has(e.orden)) antiguas.set(e.orden, []);
      antiguas.get(e.orden)!.push(e);
    }

    const total = Math.max(f.etapasTotales, tareas.length);
    const filas: EtapaVista[] = [];

    for (let orden = 1; orden <= total; orden++) {
      const tarea = tareas.find(t => t.orden === orden);
      const resoluciones = (antiguas.get(orden) ?? [])
        .sort((a, b) => b.date.localeCompare(a.date));

      let estado: EtapaVista['estado'] = 'pendiente';
      if (tarea) {
        estado =
          tarea.estado === 'anulada' ? 'anulada' :
          tarea.accion === 'aprobar' ? 'aprobada' :
          tarea.accion === 'rechazar' ? 'suspendida' :
          tarea.estado === 'resuelta' ? 'devuelta' :
          tarea.estado === 'pendiente' || tarea.estado === 'delegada' ? 'actual' :
          'pendiente';
      } else {
        if (orden <= f.etapasCompletadas) estado = 'aprobada';
        else if (f.status === 'paused' && orden === f.etapasCompletadas + 1) estado = 'suspendida';
        else if (orden === f.etapasCompletadas + 1) estado = 'actual';
      }

      filas.push({ orden, nombre: tarea?.etapaNombre ?? nombreDeEtapa(f, orden), estado, tarea, resoluciones });
    }
    return filas;
  });

  /** Todas las resoluciones registradas, de la mas reciente a la mas antigua. */
  historial = computed<EtapaAprobacion[]>(() =>
    [...(this.flujo()?.etapas ?? [])].sort((a, b) => b.date.localeCompare(a.date))
  );

  /** Etapas que yo puedo resolver ahora mismo. */
  mias = computed<TareaAprobacion[]>(() =>
    this.tareas().filter(t => this.approvals.accionesPara(t).length > 0)
  );

  /** Personas a las que se puede delegar o reasignar. */
  destinatarios = computed(() =>
    this.personas().filter(m => m.uid !== this.tenant.uid() && m.estado === 'activo')
  );

  /** Acciones que caben sobre la etapa que se esta resolviendo. */
  acciones = computed(() => {
    const t = this.tareaActiva();
    return t ? this.approvals.accionesPara(t).map(a => ({ value: a, ...ACCIONES_APROBACION[a] })) : [];
  });

  vencida(t: TareaAprobacion): boolean {
    return estaVencida(t);
  }

  etiquetaAccion(a?: AccionAprobacion): string {
    return a ? ACCIONES_APROBACION[a].label : '';
  }
  async ngOnInit() {
    const id = this.ruta.snapshot.paramMap.get('id');
    if (!id) { this.router.navigate(['/flujos']); return; }
    await this.cargar(id);
  }

  async cargar(id: string) {
    this.cargando.set(true);
    this.error.set(null);
    try {
      const [f, tareas] = await Promise.all([
        this.service.getById(id),
        this.approvals.getDeFlujo(id)
      ]);
      if (!f) { this.error.set('Ese flujo no existe o fue retirado.'); return; }
      this.flujo.set(f);
      this.tareas.set([...tareas].sort((a, b) => a.orden - b.orden));

      // Solo hace falta la lista de personas si hay algo que delegar.
      if (tareas.some(t => this.approvals.accionesPara(t).length > 0)) {
        this.personas.set(await this.members.getMiembros().catch(() => []));
      }
    } catch {
      this.error.set('No se pudo leer el flujo. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      this.cargando.set(false);
    }
  }

  // ------------------------------------------
  // RESOLUCION
  // ------------------------------------------

  abrirResolver(tarea?: TareaAprobacion) {
    const t = tarea ?? this.mias()[0];
    if (!t) return;

    this.tareaActiva.set(t);
    this.fAccion.set(this.approvals.accionesPara(t)[0] ?? 'aprobar');
    this.fMotivo.set('');
    this.fDestinatario.set('');
    this.errorForm.set('');
    this.modalResolver.set(true);
  }

  cerrarResolver() {
    if (this.resolviendo()) return;
    this.modalResolver.set(false);
    this.tareaActiva.set(null);
  }

  /** Aprobar no exige motivo; devolver o rechazar si. */
  get exigeMotivo(): boolean {
    return this.fAccion() !== 'aprobar' && !this.exigeDestinatario;
  }

  /** Delegar y reasignar necesitan a quien. */
  get exigeDestinatario(): boolean {
    return this.fAccion() === 'delegar' || this.fAccion() === 'reasignar';
  }

  async resolver() {
    const t = this.tareaActiva();
    if (!t || this.resolviendo()) return;

    this.resolviendo.set(true);
    this.errorForm.set('');
    try {
      const destino = this.destinatarios().find(m => m.uid === this.fDestinatario());

      await this.approvals.resolver(t, {
        accion: this.fAccion(),
        motivo: this.fMotivo().trim() || undefined,
        destinatarioUid: destino?.uid,
        destinatarioNombre: destino ? (destino.nombre || destino.email) : undefined
      });

      this.modalResolver.set(false);
      this.tareaActiva.set(null);
      await this.cargar(t.flujoId);
    } catch (e: any) {
      this.errorForm.set(e?.message ?? 'No se pudo registrar la resolucion.');
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
