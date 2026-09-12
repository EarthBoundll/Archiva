import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth-guard';
import { entrarEnEmpresaGuard, salirDeEmpresaGuard } from './core/guards/plataforma-guard';
import { guestGuard } from './core/guards/guest-guard';
import { exigePermiso } from './core/guards/rol-guard';
import { Permiso } from './core/models/rbac.model';

export const routes: Routes = [
  // ============================================
  // ACCESO — sin layout
  // ============================================

  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./pages/login/login').then(m => m.LoginComponent)
  },

  // Aceptar una invitación es la única vía de alta que existe. No lleva
  // guarda de sesión: quien llega aquí todavía no tiene cuenta.
  {
    path: 'invitacion/:token',
    loadComponent: () =>
      import('./pages/invitation/invitation').then(m => m.InvitationComponent)
  },

  // Autenticado pero sin pertenencia utilizable. Una pantalla que lo
  // explica, en lugar de un tablero vacío sin motivo aparente.
  {
    path: 'sin-acceso',
    loadComponent: () =>
      import('./pages/no-access/no-access').then(m => m.NoAccessComponent)
  },
  {
    path: 'sin-permiso',
    loadComponent: () =>
      import('./pages/no-access/no-access').then(m => m.NoAccessComponent)
  },

  // Entrada y salida de un operador de plataforma.
  //
  // Rutas que actuan y redirigen, no pantallas. Van FUERA de authGuard,
  // junto al acceso y la invitacion: dentro, un operador sin empresa
  // activa seria redirigido a «sin acceso», que a su vez lo mandaria
  // aqui. Un bucle.
  //
  // La pantalla desde donde elegir empresa llega en la Fase 4; entonces
  // solo tendra que enlazar aqui.
  {
    path: 'plataforma/entrar/:empresaId',
    canActivate: [entrarEnEmpresaGuard],
    loadComponent: () =>
      import('./pages/no-access/no-access').then(m => m.NoAccessComponent)
  },
  {
    path: 'plataforma/salir',
    canActivate: [salirDeEmpresaGuard],
    loadComponent: () =>
      import('./pages/no-access/no-access').then(m => m.NoAccessComponent)
  },

  // ============================================
  // PLATAFORMA — con layout y sesión
  // ============================================

  {
    path: '',
    loadComponent: () =>
      import('./core/layout/layout.component').then(m => m.LayoutComponent),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/dashboard/dashboard').then(m => m.DashboardComponent)
      },
      {
        path: 'bandeja',
        loadComponent: () =>
          import('./pages/inbox/inbox').then(m => m.InboxComponent)
      },
      {
        path: 'documentos',
        loadComponent: () =>
          import('./pages/documents/documents').then(m => m.DocumentsComponent)
      },
      {
        path: 'solicitudes',
        loadComponent: () =>
          import('./pages/review-requests/review-requests').then(m => m.ReviewRequestsComponent)
      },
      {
        path: 'historial',
        loadComponent: () =>
          import('./pages/history/history').then(m => m.HistoryComponent)
      },
      {
        path: 'flujos',
        loadComponent: () =>
          import('./pages/workflows/workflows').then(m => m.WorkflowsComponent)
      },
      {
        path: 'flujos/:id',
        loadComponent: () =>
          import('./pages/workflow/workflow').then(m => m.WorkflowComponent)
      },
      {
        path: 'almacenamiento',
        loadComponent: () =>
          import('./pages/storage/storage').then(m => m.StorageComponent)
      },
      {
        path: 'archivo',
        loadComponent: () =>
          import('./pages/archive/archive').then(m => m.ArchiveComponent)
      },
      {
        path: 'alertas',
        loadComponent: () =>
          import('./pages/alerts/alerts').then(m => m.AlertsComponent)
      },
      {
        path: 'indicadores',
        loadComponent: () =>
          import('./pages/indicators/indicators').then(m => m.IndicatorsComponent)
      },
      {
        // Personas de la empresa: invitar, cambiar rol, suspender.
        path: 'usuarios',
        canActivate: [exigePermiso(Permiso.USUARIOS_VER)],
        loadComponent: () =>
          import('./pages/users/users').then(m => m.UsersComponent)
      },
      {
        path: 'auditoria',
        canActivate: [exigePermiso(Permiso.BITACORA_VER)],
        loadComponent: () =>
          import('./pages/audit/audit').then(m => m.AuditComponent)
      },
      {
        path: 'configuracion',
        loadComponent: () =>
          import('./pages/settings/settings').then(m => m.SettingsComponent)
      }
    ]
  },

  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },

  // Ruta inexistente: página propia en vez de redirigir al tablero, que
  // confundía un enlace mal escrito con una sesión expirada.
  {
    path: '**',
    loadComponent: () =>
      import('./pages/not-found/not-found').then(m => m.NotFoundComponent)
  }
];
