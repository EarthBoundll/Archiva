import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { MembersService } from '../../core/services/members';
import { TenantService } from '../../core/services/tenant';
import { CompanyService } from '../../core/services/company';
import { IconComponent } from '../../core/components/icon/icon.component';
import { DialogoDirective } from '../../core/directives/dialogo.directive';
import { Miembro, EstadoMiembro, ESTADOS_MIEMBRO, iniciales } from '../../core/models/member.model';
import { Invitacion, ESTADOS_INVITACION } from '../../core/models/invitation.model';
import { Rol, ROLES, Permiso, listaRoles } from '../../core/models/rbac.model';
import { AreaEmisora, AREAS_EMISORAS } from '../../core/models/document.model';

type Pestana = 'personas' | 'invitaciones';

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, IconComponent, DialogoDirective],
  templateUrl: './users.html',
  styleUrl: './users.scss'
})
export class UsersComponent implements OnInit {
  private members = inject(MembersService);
  private company = inject(CompanyService);
  tenant = inject(TenantService);

  pestana = signal<Pestana>('personas');
  cargando = signal(true);
  error = signal('');

  miembros    = signal<Miembro[]>([]);
  invitaciones = signal<Invitacion[]>([]);

  // Invitar
  modalInvitar = signal(false);
  enviando = signal(false);
  errorForm = signal('');
  invitacionCreada = signal<Invitacion | null>(null);
  copiado = signal(false);

  fNombre = signal('');
  fEmail  = signal('');
  fRol    = signal<Rol>(Rol.COLABORADOR);
  fArea   = signal<AreaEmisora>('administracion');
  fCargo  = signal('');

  // Cambiar rol
  modalRol = signal<Miembro | null>(null);
  rolElegido = signal<Rol>(Rol.COLABORADOR);
  guardandoRol = signal(false);

  // Suspender
  modalSuspender = signal<Miembro | null>(null);
  motivoSuspension = signal('');
  suspendiendo = signal(false);

  // Revocar
  modalRevocar = signal<Invitacion | null>(null);
  motivoRevocar = signal('');
  revocando = signal(false);

  estadosMiembro = ESTADOS_MIEMBRO;
  estadosInvitacion = ESTADOS_INVITACION;
  roles = ROLES;
  areas = AREAS_EMISORAS;

  todosLosRoles = listaRoles();

  puedeInvitar   = computed(() => this.tenant.puede(Permiso.USUARIOS_INVITAR));
  puedeEditarRol = computed(() => this.tenant.puede(Permiso.USUARIOS_EDITAR_ROL));
  puedeSuspender = computed(() => this.tenant.puede(Permiso.USUARIOS_DESACTIVAR));

  rolesAsignables = computed(() =>
    this.members.rolesQuePuedeAsignar().map(r => ({ value: r, ...ROLES[r] }))
  );

  areasActivas = computed(() => this.company.getAreasActivas());

  activos     = computed(() => this.miembros().filter(m => m.estado === 'activo').length);
  suspendidos = computed(() => this.miembros().filter(m => m.estado === 'suspendido').length);
  pendientes  = computed(() => this.invitaciones().filter(i => i.estado === 'pendiente').length);

  async ngOnInit() {
    await this.company.cargar();
    await this.cargar();
  }

  async cargar() {
    this.cargando.set(true);
    this.error.set('');
    try {
      const [m, i] = await Promise.all([
        this.members.getMiembros(true),
        this.members.getInvitaciones()
      ]);
      this.miembros.set(m);
      this.invitaciones.set(i);
    } catch {
      this.error.set('No se pudieron leer las personas de la empresa.');
    } finally {
      this.cargando.set(false);
    }
  }

  // ------------------------------------------
  // PRESENTACION
  // ------------------------------------------

  inicialesDe(nombre: string): string { return iniciales(nombre); }

  etiquetaArea(a: AreaEmisora): string { return AREAS_EMISORAS[a]?.label ?? a; }

  /** Nadie se cambia a sí mismo el rol ni se suspende. */
  esYo(m: Miembro): boolean { return m.uid === this.tenant.uid(); }

  fechaCorta(iso?: string): string {
    if (!iso) return 'Nunca';
    return new Date(iso).toLocaleDateString('es-PE', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  }

  diasQueQuedan(inv: Invitacion): number {
    return this.members.diasQueLeQuedan(inv);
  }

  // ------------------------------------------
  // INVITAR
  // ------------------------------------------

  abrirInvitar() {
    this.fNombre.set('');
    this.fEmail.set('');
    this.fRol.set(Rol.COLABORADOR);
    this.fArea.set(this.areasActivas()[0]?.value ?? 'administracion');
    this.fCargo.set('');
    this.errorForm.set('');
    this.invitacionCreada.set(null);
    this.copiado.set(false);
    this.modalInvitar.set(true);
  }

  cerrarInvitar() {
    if (this.enviando()) return;
    this.modalInvitar.set(false);
  }

  async invitar() {
    if (this.enviando()) return;

    this.enviando.set(true);
    this.errorForm.set('');
    try {
      const inv = await this.members.invitar({
        nombre: this.fNombre(),
        email: this.fEmail(),
        rol: this.fRol(),
        area: this.fArea(),
        cargo: this.fCargo() || undefined
      });
      this.invitacionCreada.set(inv);
      await this.cargar();
    } catch (e: any) {
      this.errorForm.set(e?.message ?? 'No se pudo enviar la invitación.');
    } finally {
      this.enviando.set(false);
    }
  }

  enlaceDe(inv: Invitacion): string {
    return this.members.enlaceDe(inv);
  }

  /**
   * Copia el enlace al portapapeles.
   *
   * No hay envío de correo: haría falta un servicio de servidor. Mientras
   * tanto el administrador copia el enlace y lo hace llegar como prefiera,
   * que es honesto y funciona hoy.
   */
  async copiarEnlace(inv: Invitacion) {
    try {
      await navigator.clipboard.writeText(this.enlaceDe(inv));
      this.copiado.set(true);
      setTimeout(() => this.copiado.set(false), 2500);
    } catch {
      this.errorForm.set('No se pudo copiar. Selecciona el enlace y cópialo a mano.');
    }
  }

  // ------------------------------------------
  // ROL
  // ------------------------------------------

  abrirRol(m: Miembro) {
    this.rolElegido.set(m.rol);
    this.errorForm.set('');
    this.modalRol.set(m);
  }

  async guardarRol() {
    const m = this.modalRol();
    if (!m || this.guardandoRol()) return;

    this.guardandoRol.set(true);
    this.errorForm.set('');
    try {
      await this.members.cambiarRol(m.uid, this.rolElegido());
      this.modalRol.set(null);
      await this.cargar();
    } catch (e: any) {
      this.errorForm.set(e?.message ?? 'No se pudo cambiar el rol.');
    } finally {
      this.guardandoRol.set(false);
    }
  }

  // ------------------------------------------
  // SUSPENDER Y REACTIVAR
  // ------------------------------------------

  abrirSuspender(m: Miembro) {
    this.motivoSuspension.set('');
    this.errorForm.set('');
    this.modalSuspender.set(m);
  }

  async confirmarSuspension() {
    const m = this.modalSuspender();
    if (!m || this.suspendiendo()) return;

    this.suspendiendo.set(true);
    this.errorForm.set('');
    try {
      await this.members.cambiarEstado(m.uid, 'suspendido', this.motivoSuspension());
      this.modalSuspender.set(null);
      await this.cargar();
    } catch (e: any) {
      this.errorForm.set(e?.message ?? 'No se pudo suspender.');
    } finally {
      this.suspendiendo.set(false);
    }
  }

  async reactivar(m: Miembro) {
    try {
      await this.members.cambiarEstado(m.uid, 'activo');
      await this.cargar();
    } catch (e: any) {
      this.error.set(e?.message ?? 'No se pudo reactivar.');
    }
  }

  // ------------------------------------------
  // REVOCAR INVITACION
  // ------------------------------------------

  abrirRevocar(inv: Invitacion) {
    this.motivoRevocar.set('');
    this.errorForm.set('');
    this.modalRevocar.set(inv);
  }

  async confirmarRevocar() {
    const inv = this.modalRevocar();
    if (!inv || this.revocando()) return;

    this.revocando.set(true);
    try {
      await this.members.revocar(inv, this.motivoRevocar());
      this.modalRevocar.set(null);
      await this.cargar();
    } catch (e: any) {
      this.errorForm.set(e?.message ?? 'No se pudo revocar.');
    } finally {
      this.revocando.set(false);
    }
  }

  async reenviar(inv: Invitacion) {
    try {
      const nueva = await this.members.reenviar(inv);
      this.invitacionCreada.set(nueva);
      this.modalInvitar.set(true);
      await this.cargar();
    } catch (e: any) {
      this.error.set(e?.message ?? 'No se pudo reenviar.');
    }
  }
}
