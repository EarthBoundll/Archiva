import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

/**
 * Pagina para rutas inexistentes.
 *
 * Antes el comodin redirigia todo a /dashboard, de modo que una URL mal
 * escrita se confundia con una sesion expirada: el usuario acababa en el
 * login sin entender por que.
 */
@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterModule],
  template: `
    <div class="nf">
      <svg class="nf__icon" viewBox="0 0 64 64" role="img" aria-label="Documento no encontrado"
           xmlns="http://www.w3.org/2000/svg">
        <g fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round">
          <path d="M16 6h20l12 12v40H16z"/>
          <path d="M36 6v12h12"/>
          <path d="M24 34h16M24 42h10" stroke-linecap="round"/>
        </g>
      </svg>

      <p class="nf__code">Error 404</p>
      <h1>Esta ruta no existe</h1>
      <p class="nf__msg">
        La dirección que escribiste no corresponde a ninguna sección de ARCHIVA.
        Puede que el enlace esté mal copiado o que la página haya cambiado de nombre.
      </p>

      <a routerLink="/dashboard" class="nf__btn">Volver al tablero</a>
    </div>
  `,
  styles: [`
    .nf {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--space-3);
      padding: var(--space-8) var(--space-5);
      text-align: center;
      background: var(--color-bg);
      color: var(--color-text);
    }

    .nf__icon {
      width: 72px;
      height: 72px;
      color: var(--color-text-muted);
      margin-bottom: var(--space-2);
    }

    .nf__code {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--color-text-secondary);
      margin: 0;
    }

    h1 {
      font-family: var(--font-heading);
      font-size: var(--text-2xl);
      font-weight: var(--font-semibold);
      margin: 0;
      text-wrap: balance;
    }

    .nf__msg {
      max-width: 46ch;
      color: var(--color-text-secondary);
      line-height: 1.6;
      margin: 0 0 var(--space-4);
    }

    .nf__btn {
      display: inline-flex;
      align-items: center;
      min-height: 44px;
      padding: 0 var(--space-6);
      border-radius: var(--radius-lg);
      background: var(--color-primary);
      color: #FFFFFF;
      font-family: var(--font-heading);
      font-weight: var(--font-semibold);
      text-decoration: none;
      transition: background var(--duration-normal) var(--ease-out);
    }

    .nf__btn:hover {
      background: var(--color-primary-light);
    }
  `]
})
export class NotFoundComponent {}
