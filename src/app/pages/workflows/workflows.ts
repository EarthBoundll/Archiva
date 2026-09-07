import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

import { WorkflowService } from '../../core/services/workflow';
import { TenantService } from '../../core/services/tenant';
import { IconComponent } from '../../core/components/icon/icon.component';
import { DialogoDirective } from '../../core/directives/dialogo.directive';
import { ApprovalsService } from '../../core/services/approvals';
import { MembersService } from '../../core/services/members';
import { Miembro } from '../../core/models/member.model';
import { Permiso } from '../../core/models/rbac.model';
import {
  FlujoAprobacion,
  FlujoAprobacionPayload,
  TipoFlujo,
  PrioridadFlujo,
  EstadoFlujo,
  ResumenFlujos,
  TIPOS_FLUJO,
  PRIORIDADES_FLUJO,
  ESTADOS_FLUJO,
  validarFlujo,
  ajustarNombresEtapas,
  ajustarEtapas,
  validarEtapas,
  duplicarFlujo,
  EtapaDefinida,
  nombreDeEtapa,
  siguienteOrden,
  admiteResolucion
} from '../../core/models/workflow.model';

@Component({
  selector: 'app-flujos',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, IconComponent, DialogoDirective],
  templateUrl: './workflows.html',
  styleUrl: './workflows.scss'
})
export class WorkflowsComponent implements OnInit {
  private service = inject(WorkflowService);
  private approvals = inject(ApprovalsService);
  private members = inject(MembersService);
  tenant = inject(TenantService);
  private router = inject(Router);

  flujos   = signal<FlujoAprobacion[]>([]);
  resumen  = signal<ResumenFlujos | null>(null);
  cargando = signal(true);
  error    = signal<string | null>(null);

  /** null = todos los estados. */
  filtro = signal<EstadoFlujo | null>(null);
  busqueda = signal('');

  // Alta y edición
  modalAbierto = signal(false);
  editando     = signal<FlujoAprobacion | null>(null);
  guardando    = signal(false);
  errorForm    = signal('');

  // Anulación
  modalAnular  = signal<FlujoAprobacion | null>(null);
  motivoAnular = signal('');
  anulando     = signal(false);

  // Catálogos
  tipos       = TIPOS_FLUJO;
  prioridades = PRIORIDADES_FLUJO;
  estados     = ESTADOS_FLUJO;

  listaTipos = (Object.keys(TIPOS_FLUJO) as TipoFlujo[])
    .map(t => ({ value: t, ...TIPOS_FLUJO[t] }));

  listaPrioridades = (Object.keys(PRIORIDADES_FLUJO) as PrioridadFlujo[])
    .map(p => ({ value: p, ...PRIORIDADES_FLUJO[p] }));

  listaEstados = (Object.keys(ESTADOS_FLUJO) as EstadoFlujo[])
    .map(e => ({ value: e, ...ESTADOS_FLUJO[e] }));

  // Campos del formulario
  fNombre      = signal('');
  fTipo        = signal<TipoFlujo>('aprobacion_contrato');
  fDescripcion = signal('');
  fTotales     = signal(3);
  fPorPeriodo  = signal(1);
  fPrioridad   = signal<PrioridadFlujo>('medium');
  fLimite      = signal('');
  fNotas       = signal('');
  fEtapas      = signal<string[]>(['', '', '']);
  fEtapasDef   = signal<EtapaDefinida[]>(ajustarEtapas([], 3));

  /** Quién puede recibir una etapa: los roles que aprueban. */
  aprobadores = signal<Miembro[]>([]);

  puedeCrear = computed(() => this.tenant.puede(Permiso.FLUJO_CREAR));
  puedeAnular = computed(() => this.tenant.puede(Permiso.FLUJO_ANULAR));

  visibles = computed(() => {
    const f = this.filtro();
    const q = this.busqueda().trim().toLowerCase();

    return this.flujos().filter(x => {
      if (f && x.status !== f) return false;
      if (!q) return true;
      return x.name.toLowerCase().includes(q)
          || (x.description ?? '').toLowerCase().includes(q)
          || TIPOS_FLUJO[x.category]?.name.toLowerCase().includes(q);
    });
  });

  /** Cuantos flujos hay en cada estado; los ausentes valen cero. */
  conteoPorEstado = computed(() => {
    const c: Record<string, number> = { active: 0, completed: 0, paused: 0, cancelled: 0 };
    for (const f of this.flujos()) c[f.status] = (c[f.status] ?? 0) + 1;
    return c;
  });

  async ngOnInit() {
    await this.cargar();
    this.aprobadores.set(await this.members.getAprobadores());
  }

  async cargar() {
    this.cargando.set(true);
    this.error.set(null);
    try {
      const lista = await this.service.getAll();
      this.flujos.set(lista);
      this.resumen.set(await this.service.getResumen(lista));
    } catch {
      this.error.set('No se pudieron leer los flujos. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      this.cargando.set(false);
    }
  }

  // ------------------------------------------
  // PRESENTACION
  // ------------------------------------------

  avance(f: FlujoAprobacion): number {
    return this.service.calcAvance(f);
  }

  siguiente(f: FlujoAprobacion): string | null {
    if (!admiteResolucion(f)) return null;
    return nombreDeEtapa(f, siguienteOrden(f));
  }

  cierreEstimado(f: FlujoAprobacion): string {
    return this.service.calcFechaEstimada(f.periodosParaCierre);
  }

  /** Un flujo en curso que pasó su fecha límite pide atención. */
  vencido(f: FlujoAprobacion): boolean {
    if (f.status !== 'active' || !f.fechaLimiteCierre) return false;
    return f.fechaLimiteCierre < this.hoy();
  }

  fechaCorta(iso?: string): string {
    if (!iso) return '';
    return new Date(iso.slice(0, 10) + 'T00:00:00')
      .toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  abrirDetalle(f: FlujoAprobacion) {
    this.router.navigate(['/flujos', f.id]);
  }

  alternarFiltro(e: EstadoFlujo) {
    this.filtro.set(this.filtro() === e ? null : e);
  }

  // ------------------------------------------
  // ALTA Y EDICION
  // ------------------------------------------

  nuevo() {
    this.editando.set(null);
    this.fNombre.set('');
    this.fTipo.set('aprobacion_contrato');
    this.fDescripcion.set('');
    this.fTotales.set(3);
    this.fPorPeriodo.set(1);
    this.fPrioridad.set('medium');
    this.fLimite.set('');
    this.fNotas.set('');
    this.fEtapas.set(['', '', '']);
    this.fEtapasDef.set(ajustarEtapas([], 3));
    this.errorForm.set('');
    this.modalAbierto.set(true);
  }

  editar(f: FlujoAprobacion) {
    this.editando.set(f);
    this.fNombre.set(f.name);
    this.fTipo.set(f.category);
    this.fDescripcion.set(f.description ?? '');
    this.fTotales.set(f.etapasTotales);
    this.fPorPeriodo.set(f.etapasPorPeriodo);
    this.fPrioridad.set(f.priority);
    this.fLimite.set(f.fechaLimiteCierre ?? '');
    this.fNotas.set(f.notes ?? '');
    this.fEtapas.set(ajustarNombresEtapas(f.nombresEtapas ?? [], f.etapasTotales));
    this.fEtapasDef.set(ajustarEtapas(f.etapasDefinidas ?? [], f.etapasTotales));
    this.errorForm.set('');
    this.modalAbierto.set(true);
  }

  /** Al cambiar el total, la lista de nombres se ajusta sin perder lo escrito. */
  cambiarTotales(valor: number) {
    const n = Math.max(1, Math.min(20, Math.round(valor || 1)));
    this.fTotales.set(n);
    this.fEtapas.set(ajustarNombresEtapas(this.fEtapas(), n));
    this.fEtapasDef.set(ajustarEtapas(this.fEtapasDef(), n));
    if (this.fPorPeriodo() > n) this.fPorPeriodo.set(n);
  }

  cambiarNombreEtapa(i: number, valor: string) {
    const copia = [...this.fEtapas()];
    copia[i] = valor;
    this.fEtapas.set(copia);
    this.actualizarEtapa(i, { nombre: valor });
  }

  /** Cambia un campo de la etapa i sin tocar las demás. */
  actualizarEtapa(i: number, cambios: Partial<EtapaDefinida>) {
    const copia = [...this.fEtapasDef()];
    if (!copia[i]) return;
    copia[i] = { ...copia[i], ...cambios };
    this.fEtapasDef.set(copia);
  }

  /** Al elegir responsable hay que guardar también su nombre. */
  asignarResponsable(i: number, uid: string) {
    const persona = this.aprobadores().find(m => m.uid === uid);
    this.actualizarEtapa(i, {
      responsableUid: uid,
      responsableNombre: persona?.nombre ?? '',
      area: persona?.area
    });
  }

  cerrarModal() {
    if (this.guardando()) return;
    this.modalAbierto.set(false);
  }

  async guardar() {
    if (this.guardando()) return;

    const payload: FlujoAprobacionPayload = {
      name: this.fNombre(),
      category: this.fTipo(),
      description: this.fDescripcion() || undefined,
      etapasTotales: this.fTotales(),
      etapasPorPeriodo: this.fPorPeriodo(),
      nombresEtapas: this.fEtapas(),
      etapasDefinidas: this.fEtapasDef(),
      priority: this.fPrioridad(),
      fechaLimiteCierre: this.fLimite() || undefined,
      notes: this.fNotas() || undefined
    };

    const invalido = validarFlujo(payload) ?? validarEtapas(this.fEtapasDef());
    if (invalido) { this.errorForm.set(invalido); return; }

    this.guardando.set(true);
    this.errorForm.set('');
    try {
      const enEdicion = this.editando();
      if (enEdicion) {
        await this.service.update(enEdicion.id, payload);
      } else {
        // Al crear el flujo se abren sus tareas: una por etapa, y solo la
        // primera queda pendiente. Sin esto las etapas no aparecerian en
        // ninguna bandeja y el expediente no llegaria a nadie.
        const creado = await this.service.create(payload);
        await this.approvals.abrirFlujo(creado, this.fEtapasDef());
      }

      this.modalAbierto.set(false);
      await this.cargar();
    } catch (e: any) {
      this.errorForm.set(e?.message ?? 'No se pudo guardar el flujo.');
    } finally {
      this.guardando.set(false);
    }
  }

  /**
   * Copia un flujo como plantilla nueva, sin su historial.
   *
   * Abre el formulario relleno en vez de guardarlo directo: casi siempre
   * hay que cambiar algo, y guardar sin mirar deja duplicados inútiles.
   */
  duplicar(f: FlujoAprobacion) {
    const copia = duplicarFlujo(f);
    this.editando.set(null);
    this.fNombre.set(copia.name);
    this.fTipo.set(copia.category);
    this.fDescripcion.set(copia.description ?? '');
    this.fTotales.set(copia.etapasTotales);
    this.fPorPeriodo.set(copia.etapasPorPeriodo);
    this.fPrioridad.set(copia.priority ?? 'medium');
    this.fLimite.set('');
    this.fNotas.set(copia.notes ?? '');
    this.fEtapas.set(ajustarNombresEtapas(copia.nombresEtapas ?? [], copia.etapasTotales));
    this.fEtapasDef.set(ajustarEtapas(copia.etapasDefinidas ?? [], copia.etapasTotales));
    this.errorForm.set('');
    this.modalAbierto.set(true);
  }

  // ------------------------------------------
  // ANULACION Y REANUDACION
  // ------------------------------------------

  pedirAnular(f: FlujoAprobacion) {
    this.motivoAnular.set('');
    this.modalAnular.set(f);
  }

  async confirmarAnular() {
    const f = this.modalAnular();
    if (!f || this.anulando()) return;

    this.anulando.set(true);
    try {
      await this.service.delete(f.id, this.motivoAnular());
      this.modalAnular.set(null);
      await this.cargar();
    } catch (e: any) {
      this.errorForm.set(e?.message ?? 'No se pudo anular el flujo.');
    } finally {
      this.anulando.set(false);
    }
  }

  async reanudar(f: FlujoAprobacion) {
    try {
      await this.service.reanudar(f.id);
      await this.cargar();
    } catch (e: any) {
      this.error.set(e?.message ?? 'No se pudo reanudar el flujo.');
    }
  }

  private hoy(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
