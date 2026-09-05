import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth-guard';
import { guestGuard } from './core/guards/guest-guard';

export const routes: Routes = [
  // Acceso (sin layout)
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./pages/login/login').then(m => m.LoginComponent)
  },

  // Configuracion inicial de la empresa (sin layout, pero solo con sesion)
  {
    path: 'onboarding',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/onboarding/onboarding').then(m => m.OnboardingComponent)
  },

  // Layout principal para paginas autenticadas
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
        // Ruta que en ARCHIVA estaba enlazada pero nunca registrada.
        path: 'flujos/detalle',
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
        path: 'configuracion',
        loadComponent: () =>
          import('./pages/settings/settings').then(m => m.SettingsComponent)
      },
      {
        path: 'migracion',
        loadComponent: () =>
          import('./pages/migration/migration').then(m => m.DataMigrationComponent)
      }
    ]
  },

  // Redireccion raiz al dashboard
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  // Ruta inexistente: pagina propia en vez de redirigir al tablero, que
  // confundia un enlace mal escrito con una sesion expirada.
  {
    path: '**',
    loadComponent: () =>
      import('./pages/not-found/not-found').then(m => m.NotFoundComponent)
  }
];
