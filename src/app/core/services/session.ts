import { Injectable, inject, signal, OnDestroy } from '@angular/core';
import { Auth } from './auth';
import { TenantService } from './tenant';
import { AuditService } from './audit';
import { log } from '../utils/logger';

/**
 * Vigilancia de la sesión.
 *
 * Un gestor documental guarda contratos, nóminas y expedientes marcados
 * como confidenciales. Dejar la sesión abierta indefinidamente en un
 * equipo compartido —una recepción, un puesto de archivo— convierte
 * cualquier descuido en un acceso no autorizado que además queda
 * atribuido a quien se dejó la sesión abierta.
 *
 * Por eso la sesión caduca sola. El plazo es deliberadamente generoso:
 * demasiado corto, la gente aprende a odiar el sistema y busca la forma
 * de saltárselo, que es peor que no tenerlo.
 *
 * No sustituye a nada del servidor: Firebase sigue gobernando el testigo
 * de autenticación y las reglas siguen siendo la frontera real. Esto solo
 * cierra la ventana que queda abierta en la pantalla.
 */

/** Minutos de inactividad antes de cerrar. */
export const MINUTOS_INACTIVIDAD = 30;

/** Minutos de aviso previo: da tiempo a guardar lo que se esté haciendo. */
export const MINUTOS_AVISO = 2;

/** Actividad que cuenta como «sigo aquí». */
const SENALES = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const;

@Injectable({ providedIn: 'root' })
export class SessionService implements OnDestroy {
  private auth = inject(Auth);
  private tenant = inject(TenantService);
  private audit = inject(AuditService);

  /** Segundos que faltan para el cierre, o null si aún no hay aviso. */
  readonly avisoRestante = signal<number | null>(null);

  private ultimoMovimiento = Date.now();
  private reloj?: ReturnType<typeof setInterval>;
  private escuchando = false;
  private entradaAnotada = false;

  private readonly alMoverse = () => {
    this.ultimoMovimiento = Date.now();
    if (this.avisoRestante() !== null) this.avisoRestante.set(null);
  };

  // ------------------------------------------
  // CICLO DE VIDA
  // ------------------------------------------

  /**
   * Empieza a vigilar. Se llama desde el layout, que solo existe cuando
   * hay sesión: vigilar desde la raíz haría correr el reloj también en la
   * pantalla de acceso, donde no hay nada que proteger.
   */
  iniciar(): void {
    if (this.escuchando) return;
    this.escuchando = true;

    this.ultimoMovimiento = Date.now();
    for (const s of SENALES) {
      window.addEventListener(s, this.alMoverse, { passive: true });
    }

    // Cada diez segundos basta: comprobar más a menudo no adelanta el
    // cierre y despierta la pestaña sin motivo.
    this.reloj = setInterval(() => this.comprobar(), 10_000);

    this.anotarEntrada();
  }

  detener(): void {
    if (!this.escuchando) return;
    this.escuchando = false;

    for (const s of SENALES) window.removeEventListener(s, this.alMoverse);
    if (this.reloj) clearInterval(this.reloj);
    this.avisoRestante.set(null);
  }

  ngOnDestroy(): void {
    this.detener();
  }

  /** El usuario dice que sigue ahí. */
  continuar(): void {
    this.alMoverse();
  }

  // ------------------------------------------
  // TRAZA DE LA SESION
  // ------------------------------------------

  /**
   * Deja constancia de la entrada, una sola vez por sesión.
   *
   * Sin esto, la auditoría podía decir quién editó un documento pero no
   * quién había entrado, que es la primera pregunta de cualquier revisión
   * de accesos.
   */
  private async anotarEntrada(): Promise<void> {
    if (this.entradaAnotada) return;
    this.entradaAnotada = true;

    const m = this.tenant.miembro();
    if (!m) return;

    await this.audit.registrarSobre(
      'inicio_sesion', 'sesion', m.uid,
      m.nombre || m.email,
      'Acceso a la plataforma'
    );
  }

  /** Deja constancia de la salida y cierra. */
  async cerrar(motivo: 'voluntario' | 'inactividad' = 'voluntario'): Promise<void> {
    const m = this.tenant.miembro();

    if (m) {
      // Se anota antes de cerrar: después ya no hay empresa resuelta con
      // la que escribir, y el asiento se perdería.
      await this.audit.registrarSobre(
        'cerro_sesion', 'sesion', m.uid,
        m.nombre || m.email,
        motivo === 'inactividad' ? 'Cierre automático por inactividad' : 'Cierre de sesión'
      );
    }

    this.detener();
    this.entradaAnotada = false;
    await this.auth.signOut();
  }

  // ------------------------------------------
  // INTERNO
  // ------------------------------------------

  private comprobar(): void {
    const inactivoMs = Date.now() - this.ultimoMovimiento;
    const limiteMs = MINUTOS_INACTIVIDAD * 60_000;
    const avisoMs = (MINUTOS_INACTIVIDAD - MINUTOS_AVISO) * 60_000;

    if (inactivoMs >= limiteMs) {
      log.debug('[Sesión] cierre por inactividad');
      void this.cerrar('inactividad');
      return;
    }

    if (inactivoMs >= avisoMs) {
      this.avisoRestante.set(Math.max(0, Math.ceil((limiteMs - inactivoMs) / 1000)));
    } else if (this.avisoRestante() !== null) {
      this.avisoRestante.set(null);
    }
  }
}
