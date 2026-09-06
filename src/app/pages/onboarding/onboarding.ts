import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { OnboardingService } from '../../core/services/onboarding';
import { sugerirPrefijo as sugerirPrefijoDeArea, esPrefijoValido } from '../../core/models/onboarding.model';

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="onboarding">
      <!-- Progress -->
      <div class="onboarding__progress">
        @for (s of steps; track s.num) {
          <div class="progress-dot" [class.active]="step() >= s.num" [class.complete]="step() > s.num"></div>
        }
      </div>
      
      <!-- Step 1: Welcome -->
      @if (step() === 1) {
        <div class="step step--active">
          <div class="step__icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/>
              <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/>
              <path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>
            </svg>
          </div>
          <h1>Bienvenido a ARCHIVA</h1>
          <p>Vamos a configurar el archivo de tu empresa. Son tres datos.</p>
          <button class="btn btn-primary" (click)="nextStep()">Comenzar</button>
        </div>
      }
      
      <!-- Step 2: Profile -->
      @if (step() === 2) {
        <div class="step step--active">
          <h1>¿Cómo te llamas?</h1>
          <p>Seras el responsable del archivo documental.</p>
          
          <div class="form-field">
            <input 
              type="text" 
              [(ngModel)]="fullName" 
              placeholder="Nombre y apellidos"
              class="input-large"
              (keyup.enter)="nextStep()"
            />
          </div>
          
          <button class="btn btn-primary" (click)="nextStep()" [disabled]="!fullName">Continuar</button>
        </div>
      }
      
      <!-- Paso 3: Empresa -->
      @if (step() === 3) {
        <div class="step step--active">
          <h1>Razon social de la empresa</h1>
          <p>Aparecera en las cabeceras y en los reportes documentales.</p>

          <div class="form-field">
            <input
              type="text"
              [(ngModel)]="razonSocial"
              placeholder="ej. Constructora Andes SAC"
              class="input-large"
              (keyup.enter)="razonSocial && nextStep()"
            />
          </div>

          <button class="btn btn-primary" (click)="nextStep()" [disabled]="!razonSocial">Continuar</button>
        </div>
      }

      <!-- Paso 4: Area de archivo -->
      @if (step() === 4) {
        <div class="step step--active">
          <h1>Area que gestiona el archivo</h1>
          <p>Se usara para codificar los documentos.</p>

          <div class="form-field">
            <label>Area responsable</label>
            <input
              type="text"
              [(ngModel)]="areaArchivo"
              placeholder="ej. Administracion"
              class="input-large"
              (ngModelChange)="sugerirPrefijo()"
            />
          </div>

          <div class="form-field">
            <label>Prefijo de codificacion</label>
            <input
              type="text"
              [(ngModel)]="prefijoCodificacion"
              placeholder="ADM"
              maxlength="5"
              class="input-large"
            />
            <small>Los documentos se codificarán como CON-{{ prefijoCodificacion || 'ADM' }}-0001</small>
            @if (prefijoCodificacion && !prefijoValido) {
              <small class="hint-error">Entre tres y cinco letras, sin números ni espacios.</small>
            }
          </div>

          @if (errorMsg()) {
            <p class="error-msg" role="alert">{{ errorMsg() }}</p>
          }

          <button
            class="btn btn-primary"
            (click)="finishOnboarding()"
            [disabled]="!areaArchivo || !prefijoValido || guardando()">
            {{ guardando() ? 'Guardando...' : 'Finalizar' }}
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .onboarding {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--space-6);
      background: var(--color-bg);
      animation: fadeIn 300ms ease-out forwards;
      
      &__progress {
        display: flex;
        gap: var(--space-2);
        margin-bottom: var(--space-8);
      }
    }
    
    .progress-dot {
      width: 8px;
      height: 8px;
      border-radius: var(--radius-full);
      background: var(--color-border);
      transition: all var(--duration-normal) var(--ease-out);
      
      &.active {
        background: var(--color-primary);
        width: 24px;
      }
      
      &.complete {
        background: var(--color-primary-light);
      }
    }
    
    .step {
      text-align: center;
      max-width: 360px;
      animation: slideUp 300ms var(--ease-out) forwards;
      
      h1 {
        font-size: var(--text-2xl);
        font-weight: var(--font-bold);
        margin-bottom: var(--space-3);
      }
      
      p {
        color: var(--color-text-secondary);
        margin-bottom: var(--space-6);
      }
      
      &__icon {
        width: 80px;
        height: 80px;
        margin: 0 auto var(--space-6);
        background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-light) 100%);
        border-radius: var(--radius-xl);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        box-shadow: 0 8px 32px color-mix(in srgb, var(--color-primary) 40%, transparent);
      }
    }
    
    .form-field {
      margin-bottom: var(--space-4);
      text-align: left;
      
      label {
        display: block;
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
        margin-bottom: var(--space-2);
      }
    }
    
    .input-large {
      width: 100%;
      padding: var(--space-4);
      font-size: var(--text-lg);
      text-align: center;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      color: var(--color-text);
      
      &:focus {
        border-color: var(--color-primary);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 15%, transparent);
      }
      
      &::placeholder {
        color: var(--color-text-muted);
      }
    }
    
    .btn {
      width: 100%;
      padding: var(--space-4);
      font-size: var(--text-base);
      font-weight: var(--font-semibold);
      border-radius: var(--radius-lg);
      background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-light) 100%);
      color: white;
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 16px color-mix(in srgb, var(--color-primary) 40%, transparent);
      transition: all var(--duration-normal) var(--ease-out);
      
      &:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 8px 24px color-mix(in srgb, var(--color-primary) 50%, transparent);
      }
      
      &:active:not(:disabled) {
        transform: scale(0.98);
      }
      
      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }
    
    .chip-options {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--space-3);
      margin-bottom: var(--space-4);
    }
    
    .chip-option {
      padding: var(--space-3);
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      color: var(--color-text);
      font-weight: var(--font-medium);
      cursor: pointer;
      transition: all var(--duration-fast) var(--ease-out);
      
      &:hover {
        border-color: var(--color-border-hover);
      }
      
      &.selected {
        background: var(--color-primary);
        border-color: var(--color-primary);
        color: white;
        box-shadow: 0 4px 12px color-mix(in srgb, var(--color-primary) 40%, transparent);
      }
    }
    
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(16px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .hint-error {
      display: block;
      margin-top: var(--space-1);
      color: var(--color-error);
    }

    .error-msg {
      color: var(--color-error);
      font-size: var(--text-sm);
      margin: var(--space-3) 0 0;
    }
    .form-field small {
      display: block;
      margin-top: var(--space-2);
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
    }
  `]
})
export class OnboardingComponent {
  private router = inject(Router);
  private onboarding = inject(OnboardingService);

  step = signal(1);
  steps = [{ num: 1 }, { num: 2 }, { num: 3 }, { num: 4 }];

  guardando = signal(false);
  errorMsg  = signal('');

  fullName            = '';
  razonSocial         = '';
  areaArchivo         = '';
  prefijoCodificacion = '';

  nextStep() {
    this.step.update(s => Math.min(s + 1, 4));
  }

  /** Propone un prefijo a partir del nombre del area, sin pisar lo escrito. */
  sugerirPrefijo() {
    if (this.prefijoCodificacion) return;
    this.prefijoCodificacion = sugerirPrefijoDeArea(this.areaArchivo);
  }

  /** El boton solo se habilita cuando el prefijo puede codificar de verdad. */
  get prefijoValido(): boolean {
    return esPrefijoValido(this.prefijoCodificacion);
  }

  async finishOnboarding() {
    if (this.guardando()) return;

    this.guardando.set(true);
    this.errorMsg.set('');

    try {
      await this.onboarding.guardarConfiguracionEmpresa({
        responsable:         this.fullName.trim(),
        razonSocial:         this.razonSocial.trim(),
        areaArchivo:         this.areaArchivo.trim(),
        prefijoCodificacion: this.prefijoCodificacion.trim().toUpperCase()
      });
      await this.router.navigate(['/dashboard'], { replaceUrl: true });
    } catch (e: any) {
      // Un fallo de validacion trae su propio mensaje, y decirle al usuario
      // que revise la conexion cuando el problema es el prefijo lo manda a
      // buscar donde no hay nada.
      if (e?.message === 'No autenticado') {
        this.errorMsg.set('Tu sesión expiró. Vuelve a iniciar sesión para guardar la configuración.');
      } else if (typeof e?.message === 'string' && e.message.includes('prefijo')) {
        this.errorMsg.set(e.message);
      } else {
        this.errorMsg.set('No se pudo guardar la configuración. Revisa tu conexión e inténtalo de nuevo.');
      }
    } finally {
      this.guardando.set(false);
    }
  }
}
