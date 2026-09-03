import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LayoutService {
  sidebarCollapsed = signal(false);
  sidebarOpen = signal(true);

  toggleSidebar() {
    this.sidebarCollapsed.update(v => !v);
    this.sidebarOpen.update(v => !v);
  }

  setSidebarCollapsed(collapsed: boolean) {
    this.sidebarCollapsed.set(collapsed);
    this.sidebarOpen.set(!collapsed);
  }
}