import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

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
          <p>Tu asistente financiero personal. Vamos a configurarlo juntos.</p>
          <button class="btn btn-primary" (click)="nextStep()">Comenzar</button>
        </div>
      }
      
      <!-- Step 2: Profile -->
      @if (step() === 2) {
        <div class="step step--active">
          <h1>¿Cómo te llamas?</h1>
          <p>Ingresa tu nombre para personalizar la experiencia.</p>
          
          <div class="form-field">
            <input 
              type="text" 
              [(ngModel)]="fullName" 
              placeholder="Tu nombre"
              class="input-large"
              (keyup.enter)="nextStep()"
            />
          </div>
          
          <button class="btn btn-primary" (click)="nextStep()" [disabled]="!fullName">Continuar</button>
        </div>
      }
      
      <!-- Step 3: Income -->
      @if (step() === 3) {
        <div class="step step--active">
          <h1>¿Cuál es la razón social de tu empresa?</h1>
          <p>Esto nos ayuda a calcular tu cuota 50/30/20.</p>
          
          <div class="income-options">
            @for (opt of incomeOptions; track opt) {
              <button 
                class="income-option" 
                [class.selected]="income === opt"
                (click)="income = opt"
              >
                {{ opt }}
              </button>
            }
          </div>
          
          <div class="form-field">
            <input 
              type="number" 
              [(ngModel)]="customIncome" 
              placeholder="Otro cantidad"
              class="input-large"
            />
          </div>
          
          <button class="btn btn-primary" (click)="nextStep()" [disabled]="!income && !customIncome">Continuar</button>
        </div>
      }
      
      <!-- Step 4: Goal -->
      @if (step() === 4) {
        <div class="step step--active">
          <h1>¿Qué área gestiona el archivo?</h1>
          <p>Establece un objetivo para empezar a ahorrar.</p>
          
          <div class="form-field">
            <label>Nombre de la meta</label>
            <input 
              type="text" 
              [(ngModel)]="goalName" 
              placeholder="ej. Viaje, Auto, Emergencia"
              class="input-large"
            />
          </div>
          
          <div class="form-field">
            <label>Cantidad objetivo</label>
            <input 
              type="number" 
              [(ngModel)]="goalAmount" 
              placeholder="5000"
              class="input-large"
            />
          </div>
          
          <button class="btn btn-primary" (click)="finishOnboarding()" [disabled]="!goalName || !goalAmount">
            ¡Empezar!
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
        box-shadow: 0 8px 32px rgba(22, 107, 70, 0.4);
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
        box-shadow: 0 0 0 3px rgba(22, 107, 70, 0.15);
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
      box-shadow: 0 4px 16px rgba(22, 107, 70, 0.4);
      transition: all var(--duration-normal) var(--ease-out);
      
      &:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(22, 107, 70, 0.5);
      }
      
      &:active:not(:disabled) {
        transform: scale(0.98);
      }
      
      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }
    
    .income-options {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--space-3);
      margin-bottom: var(--space-4);
    }
    
    .income-option {
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
        box-shadow: 0 4px 12px rgba(22, 107, 70, 0.4);
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
  `]
})
export class OnboardingComponent {
  step = signal(1);
  steps = [{num: 1}, {num: 2}, {num: 3}, {num: 4}];
  
  fullName = '';
  income = 0;
  customIncome = 0;
  incomeOptions = [1000, 2000, 3000, 5000, 8000, 10000];
  goalName = '';
  goalAmount = 0;
  
  constructor(private router: Router) {}
  
  nextStep() {
    this.step.update(s => Math.min(s + 1, 4));
  }
  
  finishOnboarding() {
    // Guardar datos del onboarding en Firebase
    this.router.navigate(['/dashboard']);
  }
}