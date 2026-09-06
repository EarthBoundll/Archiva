import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Auth } from '../services/auth';
import { LayoutService } from '../services/layout.service';
import { ThemeService } from '../services/theme.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <a href="#main-content" class="skip-nav">Saltar al contenido principal</a>
    <div class="layout" [class.sidebar-open]="layoutService.sidebarOpen()" [class.sidebar-collapsed]="layoutService.sidebarCollapsed()">
      
      <!-- Sidebar -->
      <aside class="sidebar" [attr.aria-label]="'Navegación principal'">
        <div class="sidebar__header">
          <svg class="logo-mark sidebar__logo" viewBox="0 0 260 48" role="img" aria-label="ARCHIVA" xmlns="http://www.w3.org/2000/svg">
          <rect x="2" y="10" width="40" height="30" rx="3" fill="none" stroke="currentColor" stroke-width="2.5"/>
          <path d="M2 18 h40" stroke="currentColor" stroke-width="2.5"/>
          <path d="M14 8 h18 l3 4 H11 z" fill="currentColor"/>
          <path d="M14 27 h16 M14 33 h10" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
          <text x="56" y="35" font-family="Archivo, sans-serif" font-size="27" font-weight="700" letter-spacing="3" fill="currentColor">ARCHIVA</text>
        </svg>
          <svg class="sidebar__logo-icon" viewBox="0 0 44 48" role="img" aria-label="ARCHIVA" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="10" width="40" height="30" rx="3" fill="none" stroke="currentColor" stroke-width="3"/><path d="M2 18 h40" stroke="currentColor" stroke-width="3"/><path d="M14 8 h18 l3 4 H11 z" fill="currentColor"/><path d="M14 27 h16 M14 33 h10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>
        </div>
        
        <!-- Toggle button flotante en el borde -->
        <button class="sidebar-toggle-float" (click)="toggleSidebar()" [attr.aria-label]="layoutService.sidebarCollapsed() ? 'Expandir sidebar' : 'Colapsar sidebar'" [attr.aria-expanded]="!layoutService.sidebarCollapsed()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" [style.transform]="layoutService.sidebarCollapsed() ? 'rotate(180deg)' : ''">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        
        <nav class="sidebar__nav" aria-label="Navegación principal">
          <a routerLink="/dashboard" routerLinkActive="active" class="nav-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
            </svg>
            <span [class.hidden]="layoutService.sidebarCollapsed()">Tablero</span>
          </a>
          <a routerLink="/documentos" routerLinkActive="active" class="nav-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M8 13h8M8 17h5"/>
            </svg>
            <span [class.hidden]="layoutService.sidebarCollapsed()">Documentos</span>
          </a>
          <a routerLink="/solicitudes" routerLinkActive="active" class="nav-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M12 11v4M12 18h.01"/>
            </svg>
            <span [class.hidden]="layoutService.sidebarCollapsed()">Solicitudes</span>
          </a>
          <a routerLink="/historial" routerLinkActive="active" class="nav-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l4 2"/>
            </svg>
            <span [class.hidden]="layoutService.sidebarCollapsed()">Historial</span>
          </a>
          <a routerLink="/flujos" routerLinkActive="active" class="nav-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>
            </svg>
            <span [class.hidden]="layoutService.sidebarCollapsed()">Flujos</span>
          </a>
          <a routerLink="/almacenamiento" routerLinkActive="active" class="nav-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="4" width="20" height="6" rx="2"/><rect x="2" y="14" width="20" height="6" rx="2"/><path d="M6 7h.01M6 17h.01"/>
            </svg>
            <span [class.hidden]="layoutService.sidebarCollapsed()">Almacenamiento</span>
          </a>
          <a routerLink="/archivo" routerLinkActive="active" class="nav-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>
            </svg>
            <span [class.hidden]="layoutService.sidebarCollapsed()">Archivo</span>
          </a>
          <a routerLink="/alertas" routerLinkActive="active" class="nav-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
            </svg>
            <span [class.hidden]="layoutService.sidebarCollapsed()">Alertas</span>
          </a>
          <a routerLink="/indicadores" routerLinkActive="active" class="nav-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>
            </svg>
            <span [class.hidden]="layoutService.sidebarCollapsed()">Indicadores</span>
          </a>
        </nav>
        
        <div class="sidebar__footer">
          <a routerLink="/configuracion" routerLinkActive="active" class="nav-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            <span>Configuración</span>
          </a>
          
          <button class="nav-item nav-item--logout" (click)="pedirCierreSesion()">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>
      
      <!-- Mobile Overlay -->
      @if (layoutService.sidebarOpen()) {
        <div class="sidebar-overlay" (click)="closeSidebar()"></div>
      }
      
      <!-- Main Content -->
      <main class="main" id="main-content">
        <!-- Topbar -->
        <header class="topbar">
          <button class="topbar__menu-btn" (click)="toggleMobileMenu()" aria-label="Abrir menú de navegación">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          
          <button
            class="interruptor-tema"
            [class.interruptor-tema--oscuro]="theme.temaAplicado() === 'oscuro'"
            role="switch"
            [attr.aria-checked]="theme.temaAplicado() === 'oscuro'"
            (click)="theme.alternar()"
            [attr.aria-label]="theme.temaAplicado() === 'oscuro' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'">

            <span class="interruptor-tema__pista" aria-hidden="true">
              <svg class="interruptor-tema__sol" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <circle cx="12" cy="12" r="4.5"/>
                <path d="M12 1.5v2M12 20.5v2M3.9 3.9l1.5 1.5M18.6 18.6l1.5 1.5M1.5 12h2M20.5 12h2M3.9 20.1l1.5-1.5M18.6 5.4l1.5-1.5"/>
              </svg>
              <svg class="interruptor-tema__luna" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
              </svg>
            </span>

            <span class="interruptor-tema__bola" aria-hidden="true"></span>
          </button>

          <div class="topbar__user">
            <span class="topbar__greeting">{{ greeting }}, {{ userName }}</span>
            <div class="topbar__avatar">
              @if (userPhoto) {
                <img [src]="userPhoto" [alt]="userName" class="topbar__avatar-img">
              } @else {
                {{ userInitials }}
              }
            </div>
          </div>
        </header>
        
        <!-- Page Content -->
        <div class="content">
          <router-outlet />
        </div>
      </main>
      
      <!-- Mobile Bottom Nav -->
      <nav class="bottom-nav" aria-label="Navegación móvil">
        <a routerLink="/dashboard" routerLinkActive="active" class="bottom-nav__item">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="7" height="7"/>
            <rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/>
          </svg>
          <span>Tablero</span>
        </a>
        
        <a routerLink="/almacenamiento" routerLinkActive="active" class="bottom-nav__item">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
          </svg>
          <span>Almac.</span>
        </a>
        
        <a routerLink="/historial" routerLinkActive="active" class="bottom-nav__item">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1 2 1-2-1 2 1-2-1 2 1-2-1 2 1-2-1Z"/>
          </svg>
          <span>Historial</span>
        </a>
        
        <a routerLink="/alertas" routerLinkActive="active" class="bottom-nav__item">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
          </svg>
          <span>Alertas</span>
        </a>
        
        <a routerLink="/flujos" routerLinkActive="active" class="bottom-nav__item">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <circle cx="12" cy="12" r="6"/>
            <circle cx="12" cy="12" r="2"/>
          </svg>
          <span>Flujos</span>
        </a>
        
        <a routerLink="/configuracion" routerLinkActive="active" class="bottom-nav__item">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44"/>
          </svg>
          <span>Ajustes</span>
        </a>
      </nav>
      
    </div>

      <!-- Confirmacion de cierre de sesion -->
      @if (confirmandoSalida()) {
        <div class="salida-overlay" (click)="confirmandoSalida.set(false)">
          <div class="salida" (click)="$event.stopPropagation()" role="alertdialog" aria-modal="true" aria-labelledby="salida-titulo">
            <div class="salida__icono" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </div>
            <h2 id="salida-titulo">¿Cerrar sesión?</h2>
            <p>Volverás a la pantalla de acceso. Los datos guardados no se pierden.</p>
            <div class="salida__acciones">
              <button class="salida__btn" (click)="confirmandoSalida.set(false)">Seguir aquí</button>
              <button class="salida__btn salida__btn--confirmar" (click)="confirmarSalida()" [disabled]="saliendo()">
                {{ saliendo() ? 'Cerrando…' : 'Cerrar sesión' }}
              </button>
            </div>
          </div>
        </div>
      }
  `,
  styleUrl: './layout.component.scss'
})
export class LayoutComponent {
  private auth = inject(Auth);
  layoutService = inject(LayoutService);
  theme = inject(ThemeService);
  
  toggleSidebar() {
    this.layoutService.toggleSidebar();
  }

  toggleMobileMenu() {
    this.layoutService.toggleSidebar();
  }

  closeSidebar() {
    this.layoutService.setSidebarCollapsed(true);
  }
  
  get greeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 19) return 'Buenas tardes';
    return 'Buenas noches';
  }
  
  get userName(): string {
    const user = this.auth.currentUser();
    return user?.displayName?.split(' ')[0] ?? user?.email?.split('@')[0] ?? 'Usuario';
  }
  
  get userInitials(): string {
    const user = this.auth.currentUser();
    const name = user?.displayName ?? user?.email ?? 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  }

  get userPhoto(): string | null {
    return this.auth.currentUser()?.photoURL ?? null;
  }
  
  confirmandoSalida = signal(false);
  saliendo = signal(false);

  /** Cerrar sesion es destructivo de facto: se pregunta antes. */
  pedirCierreSesion() {
    this.confirmandoSalida.set(true);
  }

  async confirmarSalida() {
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