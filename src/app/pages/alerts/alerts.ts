import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-alerts',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page">
      <header class="page-header">
        <h1>Alertas Documentales</h1>
        <p class="page-subtitle">Vencimientos próximos, documentos observados y cuotas excedidas</p>
      </header>
      
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
        </svg>
        <p>Configura alertas para recibir notificaciones cuando tus solicitudes se acerquen a los límites.</p>
      </div>
    </div>
  `,
  styles: [`
    .page { animation: fadeIn 200ms ease-out forwards; }
    .page-header { margin-bottom: var(--space-6); }
    .page-header h1 { font-size: var(--text-2xl); font-weight: var(--font-bold); margin-bottom: var(--space-2); }
    .page-subtitle { color: var(--color-text-secondary); font-size: var(--text-sm); }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  `]
})
export class AlertsComponent {}