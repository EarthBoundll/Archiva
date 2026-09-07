import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { ApprovalsService } from '../../core/services/approvals';
import { MembersService } from '../../core/services/members';
import { TenantService } from '../../core/services/tenant';
import { IconComponent } from '../../core/components/icon/icon.component';
import { DialogoDirective } from '../../core/directives/dialogo.directive';
import {
  TareaAprobacion,
  Bandeja,
  BANDEJAS,
  AccionAprobacion,
  ACCIONES_APROBACION,
  ESTADOS_TAREA,
  ResumenBandeja,
  validarResolucion,
  diasEnEspera
} from '../../core/models/approval.model';
import { Miembro } from '../../core/models/member.model';

@Component({
  selector: 'app-bandeja',
  standalone: true,
  imports: [CommonModule, RouterModule, IconComponent, DialogoDirective],
  templateUrl: './inbox.html',
  styleUrl: './inbox.scss'
})
export class InboxComponent implements OnInit {
  private approvals = inject(ApprovalsService);
  private members = inject(MembersService);
  tenant = inject(TenantService);

  bandeja = signal<Bandeja>('pendientes');
  tareas = signal<TareaAprobacion[]>([]);
  resumen = signal<ResumenBandeja | null>(null);
  cargando = signal(true);
  error = signal('');

  // Resolución
  modalResolver = signal<TareaAprobacion | null>(null);
  accion = signal<AccionAprobacion>('aprobar');
  motivo = signal('');
  destinatario = signal('');
  resolviendo = signal(false);
  errorForm = signal('');

  aprobadores = signal<Miembro[]>([]);

  bandejas = BANDEJAS;
  acciones = ACCIONES_APROBACION;
  estados  = ESTADOS_TAREA;

  listaBandejas = (Object.keys(BANDEJAS) as Bandeja[])
    .map(b => ({ value: b, ...BANDEJAS[b] }));

  /** Acciones que tienen sentido sobre la tarea abierta. */
  accionesPosibles = computed(() => {
    const t = this.modalResolver();
    if (!t) return [];
    return this.approvals.accionesPara(t).map(a => ({ value: a, ...ACCIONES_APROBACION[a] }));
  });

  definicionAccion = computed(() => ACCIONES_APROBACION[this.accion()]);

  /** Candidatos a recibir una delegación: cualquiera menos uno mismo. */
  candidatos = computed(() =>
    this.aprobadores().filter(m => m.uid !== this.tenant.uid())
  );

  async ngOnInit() {
    await this.cargar();
    this.aprobadores.set(await this.members.getAprobadores());
  }

  async cargar() {
    this.cargando.set(true);
    this.error.set('');
    try {
      const [lista, r] = await Promise.all([
        this.approvals.getBandeja(this.bandeja()),
        this.approvals.getResumen()
      ]);
      this.tareas.set(lista);
      this.resumen.set(r);
    } catch {
      this.error.set('No se pudo leer la bandeja. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      this.cargando.set(false);
    }
  }

  async cambiarBandeja(b: Bandeja) {
    this.bandeja.set(b);
    await this.cargar();
  }

  // ------------------------------------------
  // PRESENTACION
  // ------------------------------------------

  vencida(t: TareaAprobacion): boolean {
    return this.approvals.vencida(t);
  }

  espera(t: TareaAprobacion): number {
    return diasEnEspera(t);
  }

  puedeActuar(t: TareaAprobacion): boolean {
    return this.approvals.accionesPara(t).length > 0;
  }

  fechaCorta(iso?: string): string {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('es-PE', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  }

  // ------------------------------------------
  // RESOLUCION
  // ------------------------------------------

  abrirResolver(t: TareaAprobacion) {
    const posibles = this.approvals.accionesPara(t);
    if (posibles.length === 0) return;

    this.accion.set(posibles[0]);
    this.motivo.set('');
    this.destinatario.set('');
    this.errorForm.set('');
    this.modalResolver.set(t);
  }

  cerrarResolver() {
    if (this.resolviendo()) return;
    this.modalResolver.set(null);
  }

  async resolver() {
    const t = this.modalResolver();
    if (!t || this.resolviendo()) return;

    const destino = this.candidatos().find(m => m.uid === this.destinatario());

    const payload = {
      accion: this.accion(),
      motivo: this.motivo() || undefined,
      destinatarioUid: destino?.uid,
      destinatarioNombre: destino?.nombre
    };

    const invalido = validarResolucion(payload);
    if (invalido) { this.errorForm.set(invalido); return; }

    this.resolviendo.set(true);
    this.errorForm.set('');
    try {
      await this.approvals.resolver(t, payload);
      this.modalResolver.set(null);
      await this.cargar();
    } catch (e: any) {
      this.errorForm.set(e?.message ?? 'No se pudo registrar la resolución.');
    } finally {
      this.resolviendo.set(false);
    }
  }
}
