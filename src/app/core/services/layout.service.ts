import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LayoutService {
  sidebarCollapsed = signal(false);
  // Nace cerrado. En movil el panel se superpone con un velo que cubre la
  // barra superior entera, de modo que arrancar abierto dejaba la campana y
  // el resto de la cabecera fuera de alcance nada mas entrar.
  sidebarOpen = signal(false);

  toggleSidebar() {
    this.sidebarCollapsed.update(v => !v);
    this.sidebarOpen.update(v => !v);
  }

  setSidebarCollapsed(collapsed: boolean) {
    this.sidebarCollapsed.set(collapsed);
    this.sidebarOpen.set(!collapsed);
  }
}