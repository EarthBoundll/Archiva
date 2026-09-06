import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-flujos',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="page">
      <header class="page-header">
        <h1>Flujos de Aprobación</h1>
        <p class="page-subtitle">Controla el avance de cada flujo de aprobación por etapas</p>
      </header>
      
      <a routerLink="/flujos/detalle" class="card card--link">
        <div class="card__icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <circle cx="12" cy="12" r="6"/>
            <circle cx="12" cy="12" r="2"/>
          </svg>
        </div>
        <div class="card__content">
          <h3>Flujo en curso</h3>
          <p>Consulta y ajusta el flujo de aprobación activo</p>
        </div>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </a>
    </div>
  `,
  styles: [`
    .page { animation: fadeIn 200ms ease-out forwards; }
    .page-header { margin-bottom: var(--space-6); }
    .page-header h1 { font-size: var(--text-2xl); font-weight: var(--font-bold); margin-bottom: var(--space-2); }
    .page-subtitle { color: var(--color-text-secondary); font-size: var(--text-sm); }
    
    .card {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-xl);
      padding: var(--space-5);
      text-decoration: none;
      transition: 
        border-color var(--duration-fast) var(--ease-out),
        transform var(--duration-normal) var(--ease-out);
      
      &:active { transform: scale(0.98); }
      &:hover { border-color: var(--color-border-hover); }
      
      &__icon {
        width: 48px;
        height: 48px;
        background: color-mix(in srgb, var(--color-primary) 15%, transparent);
        border-radius: var(--radius-lg);
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--color-primary);
        flex-shrink: 0;
      }
      
      &__content {
        flex: 1;
        
        h3 { font-size: var(--text-base); font-weight: var(--font-semibold); color: var(--color-text); margin-bottom: var(--space-1); }
        p { font-size: var(--text-sm); color: var(--color-text-muted); }
      }
      
      &:last-child svg { color: var(--color-text-muted); }
    }
    
    @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  `]
})
export class WorkflowsComponent {}