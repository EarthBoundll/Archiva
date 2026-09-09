import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import { FirebaseService } from '../../core/services/firebase';
import { Auth } from '../../core/services/auth';
import { TenantService } from '../../core/services/tenant';
import { BrandingService } from '../../core/services/branding';
import { IconComponent } from '../../core/components/icon/icon.component';
import { PasswordStrengthComponent } from '../../core/components/password-strength/password-strength';
import {
  Invitacion,
  esTokenValido,
  estadoReal,
  esAceptable,
  diasRestantes,
  validarContrasena
} from '../../core/models/invitation.model';
import { ROLES, Rol } from '../../core/models/rbac.model';
import { AREAS_EMISORAS, AreaEmisora } from '../../core/models/document.model';

type Fase = 'comprobando' | 'lista' | 'invalida' | 'creando' | 'hecha';

@Component({
  selector: 'app-invitacion',
  standalone: true,
  imports: [CommonModule, RouterModule, IconComponent, PasswordStrengthComponent],
  templateUrl: './invitation.html',
  styleUrl: './invitation.scss'
})
export class InvitationComponent implements OnInit {
  private ruta = inject(ActivatedRoute);
  private router = inject(Router);
  private firebase = inject(FirebaseService);
  private auth = inject(Auth);
  private tenant = inject(TenantService);
  private marca = inject(BrandingService);

  fase = signal<Fase>('comprobando');
  invitacion = signal<Invitacion | null>(null);
  logoEmpresa = signal<string | null>(null);
  motivo = signal('');
  error = signal('');

  contrasena = signal('');
  repeticion = signal('');
  verContrasena = signal(false);

  roles = ROLES;
  areas = AREAS_EMISORAS;

  etiquetaRol = computed(() => {
    const r = this.invitacion()?.rol;
    return r ? ROLES[r as Rol]?.label ?? r : '';
  });

  etiquetaArea = computed(() => {
    const a = this.invitacion()?.area;
    return a ? AREAS_EMISORAS[a as AreaEmisora]?.label ?? a : '';
  });

  dias = computed(() => {
    const i = this.invitacion();
    return i ? diasRestantes(i) : 0;
  });

  /** Las dos contraseñas deben coincidir antes de intentar nada. */
  coinciden = computed(() =>
    !this.repeticion() || this.contrasena() === this.repeticion()
  );

  puedeEnviar = computed(() =>
    !!this.contrasena() && this.coinciden() && !validarContrasena(this.contrasena())
  );

  async ngOnInit() {
    const token = this.ruta.snapshot.paramMap.get('token') ?? '';

    if (!esTokenValido(token)) {
      this.motivo.set('El enlace está incompleto o mal copiado.');
      this.fase.set('invalida');
      return;
    }

    try {
      const datos = await this.firebase.getInvitacionPorToken(token);

      if (!datos) {
        this.motivo.set('Este enlace no corresponde a ninguna invitación.');
        this.fase.set('invalida');
        return;
      }

      const inv = { ...datos, estado: estadoReal(datos) } as Invitacion;
      this.invitacion.set(inv);

      // Los colores de la empresa que invita, ya en esta pantalla: es el
      // primer contacto con la plataforma y no deberia verse generico.
      this.marca.previsualizar({
        colorPrimario: datos.colorPrimario,
        logo: datos.logo
      });
      this.logoEmpresa.set(datos.logo ?? null);

      if (!esAceptable(inv)) {
        this.motivo.set(this.explicar(inv));
        this.fase.set('invalida');
        return;
      }

      this.fase.set('lista');
    } catch {
      this.motivo.set('No se pudo comprobar la invitación. Revisa tu conexión.');
      this.fase.set('invalida');
    }
  }

  /** Por qué una invitación ya no sirve, en palabras. */
  private explicar(inv: Invitacion): string {
    switch (inv.estado) {
      case 'aceptada':
        return 'Esta invitación ya se usó. Si la cuenta es tuya, entra con tu correo y contraseña.';
      case 'revocada':
        return inv.motivoRevocacion
          ? `La invitación fue anulada: ${inv.motivoRevocacion}`
          : 'La invitación fue anulada por quien la envió.';
      case 'expirada':
        return 'La invitación caducó. Pide a quien te invitó que te envíe una nueva.';
      default:
        return 'Esta invitación ya no está disponible.';
    }
  }

  async aceptar() {
    const inv = this.invitacion();
    if (!inv || this.fase() === 'creando') return;

    const invalida = validarContrasena(this.contrasena());
    if (invalida) { this.error.set(invalida); return; }

    if (!this.coinciden()) {
      this.error.set('Las dos contraseñas no coinciden.');
      return;
    }

    this.fase.set('creando');
    this.error.set('');

    try {
      await this.auth.crearDesdeInvitacion(inv.email, this.contrasena(), {
        empresaId: inv.empresaId,
        nombre: inv.nombre,
        rol: inv.rol,
        area: inv.area,
        cargo: inv.cargo
      });

      await this.firebase.actualizarInvitacion(inv.empresaId, inv.id, inv.token, {
        estado: 'aceptada',
        fechaAceptada: new Date().toISOString()
      });

      // La sesión ya existe: se resuelve la empresa antes de entrar para
      // que el tablero cargue con ámbito, no vacío.
      await this.tenant.resolver(true);

      this.fase.set('hecha');
      setTimeout(() => this.router.navigate(['/dashboard'], { replaceUrl: true }), 1400);
    } catch (e: any) {
      this.fase.set('lista');
      this.error.set(this.traducir(e));
    }
  }

  private traducir(e: any): string {
    const codigo = String(e?.code ?? e?.message ?? '');
    if (codigo.includes('email-already-in-use')) {
      return 'Ya existe una cuenta con este correo. Entra con tu contraseña o pide que te la restablezcan.';
    }
    if (codigo.includes('weak-password')) {
      return 'La contraseña es demasiado débil.';
    }
    if (codigo.includes('network')) {
      return 'No hay conexión. Inténtalo de nuevo.';
    }
    return 'No se pudo crear la cuenta. Inténtalo de nuevo.';
  }
}
