import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Auth } from '../../core/services/auth';
import { TenantService } from '../../core/services/tenant';
import { IconComponent } from '../../core/components/icon/icon.component';

/**
 * Sesión válida, acceso denegado.
 *
 * Cubre dos situaciones distintas que antes acababan en un tablero vacío
 * sin explicación: pertenecer a ninguna empresa —o estar suspendido— y
 * pedir una sección que el rol no alcanza. Decir cuál de las dos es evita
 * que la persona crea que la aplicación está rota.
 */
@Component({
  selector: 'app-sin-acceso',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './no-access.html',
  styleUrl: './no-access.scss'
})
export class NoAccessComponent {
  private auth = inject(Auth);
  private router = inject(Router);
  tenant = inject(TenantService);

  /** La ruta distingue el caso: falta de pertenencia o falta de permiso. */
  esFaltaDePermiso = computed(() =>
    this.router.url.startsWith('/sin-permiso')
  );

  titulo = computed(() => {
    if (this.esFaltaDePermiso()) return 'Tu rol no alcanza esta sección';
    switch (this.tenant.motivoSinAcceso()) {
      case 'suspendido': return 'Tu acceso está suspendido';
      case 'invitado':   return 'Tu invitación sigue pendiente';
      case 'plataforma': return 'Operas la plataforma';
      default:           return 'No perteneces a ninguna empresa';
    }
  });

  explicacion = computed(() => {
    if (this.esFaltaDePermiso()) {
      return 'Esta parte de ARCHIVA está reservada a otros roles. Si necesitas entrar, ' +
             'pídele a un administrador de tu empresa que revise el tuyo.';
    }
    switch (this.tenant.motivoSinAcceso()) {
      case 'suspendido':
        return 'Un administrador retiró tu acceso. Tu historial se conserva intacto: ' +
               'cuando te reactive, volverás a encontrarlo tal como lo dejaste.';
      case 'invitado':
        return 'Tu cuenta existe pero la invitación no se completó. Abre de nuevo el ' +
               'enlace que recibiste, o pide que te envíen uno nuevo.';
      case 'plataforma':
        // La verdad, dicha entera: es operador, y todavía no hay dónde
        // elegir. La pantalla que lista las empresas llega en la Fase 4.
        return 'Tu cuenta opera ARCHIVA y no pertenece a ninguna empresa concreta. ' +
               'Todavía no hay una pantalla donde elegir en cuál entrar: llegará con ' +
               'las siguientes entregas.';
      default:
        return 'Tu cuenta no está vinculada a ninguna empresa. ARCHIVA no admite altas ' +
               'por cuenta propia: alguien de la empresa tiene que invitarte.';
    }
  });

  icono = computed(() => {
    if (this.esFaltaDePermiso()) return 'lock';
    return this.tenant.motivoSinAcceso() === 'plataforma' ? 'shield-check' : 'shield-alert';
  });

  correo = computed(() => this.auth.currentUser()?.email ?? '');

  volver() {
    this.router.navigate(['/dashboard']);
  }

  async salir() {
    await this.auth.signOut();
  }
}
