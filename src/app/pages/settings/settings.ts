const SELLO_COMPILACION = '2026-09-06 01:25';

import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Auth } from '../../core/services/auth';
import { DevSettingsService } from '../../core/services/dev-settings';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page">
      <header class="page-header">
        <h1>Configuración Empresarial</h1>
        <p class="page-subtitle">Datos de la empresa, cuenta y preferencias</p>
      </header>

      <section class="settings-section">
        <h2>Perfil del Responsable</h2>
        <div class="setting-item">
          <div class="setting-item__info">
            <span class="setting-item__label">Email</span>
            <span class="setting-item__value">{{ userEmail }}</span>
          </div>
        </div>
        <div class="setting-item">
          <div class="setting-item__info">
            <span class="setting-item__label">Nombre</span>
            <span class="setting-item__value">{{ userName }}</span>
          </div>
        </div>
      </section>

      <section class="settings-section">
        <h2>Empresa</h2>
        <div class="setting-item">
          <div class="setting-item__info">
            <span class="setting-item__label">Unidad de tamaño</span>
            <span class="setting-item__value">Megabytes (MB)</span>
          </div>
        </div>
        <div class="setting-item">
          <div class="setting-item__info">
            <span class="setting-item__label">Idioma</span>
            <span class="setting-item__value">Español</span>
          </div>
        </div>
      </section>

      <!-- ── Desarrollador ── -->
      <section class="settings-section dev-section">
        <div class="dev-header">
          <h2>Desarrollador</h2>
        <p class="sello-version">Compilación {{ sello }}</p>
          <span class="dev-badge">DEV</span>
        </div>

        <!-- Debug Mode -->
        <div class="setting-item">
          <div class="setting-item__info">
            <div>
              <span class="setting-item__label">Modo debug</span>
              <span class="setting-item__desc">Muestra logs detallados en consola</span>
            </div>
          </div>
          <button class="toggle" [class.active]="dev.debugMode()" (click)="dev.toggleDebugMode()">
            <span class="toggle-knob"></span>
          </button>
        </div>

        <!-- Placeholder para más opciones futuras -->
        <div class="setting-item setting-item--disabled">
          <div class="setting-item__info">
            <div>
              <span class="setting-item__label">Cargar acervo de ejemplo</span>
              <span class="setting-item__desc">Genera documentos de prueba para explorar el sistema (próximamente)</span>
            </div>
          </div>
          <span class="coming-soon">Próximamente</span>
        </div>

        <div class="setting-item setting-item--disabled">
          <div class="setting-item__info">
            <div>
              <span class="setting-item__label">Resetear datos</span>
              <span class="setting-item__desc">Vacía la caché local del navegador (próximamente)</span>
            </div>
          </div>
          <span class="coming-soon">Próximamente</span>
        </div>
      </section>

      <button class="btn btn-logout" (click)="pedirCierre()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <polyline points="16 17 21 12 16 7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
        Cerrar sesión
      </button>

      @if (confirmandoSalida()) {
        <div class="salida-overlay" (click)="confirmandoSalida.set(false)">
          <div class="salida" role="dialog" aria-modal="true" aria-labelledby="salida-conf"
               (click)="$event.stopPropagation()">
            <h2 id="salida-conf">¿Cerrar sesión?</h2>
            <p>Volverás a la pantalla de acceso. Tus documentos quedan guardados.</p>
            <div class="salida__acciones">
              <button class="salida__btn" (click)="confirmandoSalida.set(false)">Seguir aquí</button>
              <button class="salida__btn salida__btn--confirmar" (click)="confirmarCierre()" [disabled]="saliendo()">
                {{ saliendo() ? 'Cerrando…' : 'Cerrar sesión' }}
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .page { animation: fadeIn 200ms ease-out forwards; }
    .page-header { margin-bottom: var(--space-6); }
    .page-header h1 { font-size: var(--text-2xl); font-weight: var(--font-bold); margin-bottom: var(--space-2); }
    .page-subtitle { color: var(--color-text-secondary); font-size: var(--text-sm); }

    .settings-section {
      margin-bottom: var(--space-6);

      h2 {
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
        color: var(--color-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: var(--space-3);
      }
    }

    .setting-item {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      padding: var(--space-4);
      margin-bottom: var(--space-3);
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--space-3);

      &__info { flex: 1; }

      &__label {
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
        display: block;
      }

      &__desc {
        font-size: 11px;
        color: var(--color-text-muted);
        display: block;
        margin-top: 2px;
      }

      &__value {
        font-size: var(--text-sm);
        color: var(--color-text);
        font-weight: var(--font-medium);
      }

      &--disabled {
        opacity: 0.5;
        pointer-events: none;
      }
    }

    /* ── Toggle Switch ── */
    .toggle {
      width: 44px;
      height: 24px;
      border-radius: 12px;
      border: none;
      background: #475569;
      cursor: pointer;
      position: relative;
      transition: background 0.2s ease;
      flex-shrink: 0;

      &.active {
        background: #10b981;
      }

      .toggle-knob {
        position: absolute;
        top: 2px;
        left: 2px;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: #fff;
        transition: transform 0.2s ease;
        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
      }

      &.active .toggle-knob {
        transform: translateX(20px);
      }
    }

    /* ── Dev Section ── */
    .dev-section {
      border: 1px dashed rgba(168, 85, 247, 0.3);
      border-radius: var(--radius-lg);
      padding: var(--space-4);
      background: rgba(168, 85, 247, 0.03);
    }

    .dev-header {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin-bottom: var(--space-3);
    }

    .dev-badge {
      font-size: 10px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 6px;
      background: rgba(168, 85, 247, 0.15);
      color: #a855f7;
      letter-spacing: 0.5px;
    }

    .coming-soon {
      font-size: 11px;
      color: var(--color-text-muted);
      background: rgba(100, 116, 139, 0.1);
      padding: 4px 10px;
      border-radius: 6px;
      white-space: nowrap;
    }

    /* ── Logout Button ── */
    .btn-logout {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
      padding: var(--space-4);
      background: rgba(239, 68, 68, 0.1);
      color: var(--color-error);
      border: 1px solid rgba(239, 68, 68, 0.2);
      border-radius: var(--radius-lg);
      font-weight: var(--font-semibold);
      cursor: pointer;
      transition: all var(--duration-fast) var(--ease-out);

      &:hover { background: rgba(239, 68, 68, 0.2); }
      &:active { transform: scale(0.98); }
    }

    @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

    .salida-overlay {
      position: fixed;
      inset: 0;
      z-index: 100;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-4);
      background: rgba(0, 0, 0, 0.45);
      backdrop-filter: blur(2px);
    }

    .salida {
      width: 100%;
      max-width: 360px;
      padding: var(--space-5);
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-lg);

      h2 {
        margin: 0 0 var(--space-2);
        font-size: var(--text-lg);
        font-weight: var(--font-semibold);
        color: var(--color-text);
      }

      p {
        margin: 0 0 var(--space-5);
        font-size: var(--text-sm);
        line-height: 1.55;
        color: var(--color-text-secondary);
      }

      &__acciones {
        display: flex;
        gap: var(--space-3);
      }

      &__btn {
        flex: 1;
        min-height: 44px;
        padding: 0 var(--space-4);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: transparent;
        color: var(--color-text);
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
        cursor: pointer;

        &--confirmar {
          background: var(--color-error);
          border-color: var(--color-error);
          color: #FFFFFF;
        }

        &:disabled { opacity: 0.6; cursor: not-allowed; }
      }
    }
  `]
})
export class SettingsComponent {
  /** Marca de la compilacion: sirve para saber si el navegador sirve cache. */
  sello = SELLO_COMPILACION;

  private auth = inject(Auth);
  dev = inject(DevSettingsService);

  get userEmail(): string {
    return this.auth.currentUser()?.email ?? 'Sin email';
  }

  get userName(): string {
    return this.auth.currentUser()?.displayName ?? 'Usuario';
  }

  confirmandoSalida = signal(false);
  saliendo = signal(false);

  /**
   * Cerrar sesion se confirma, igual que en la barra lateral. Antes esta
   * pantalla salia de inmediato: dos caminos al mismo sitio con dos
   * comportamientos distintos.
   */
  pedirCierre() {
    this.confirmandoSalida.set(true);
  }

  async confirmarCierre() {
    if (this.saliendo()) return;
    this.saliendo.set(true);
    try {
      await this.auth.signOut();
    } finally {
      this.saliendo.set(false);
      this.confirmandoSalida.set(false);
    }
  }
}
