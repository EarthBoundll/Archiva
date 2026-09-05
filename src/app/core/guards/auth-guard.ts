import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from '../services/auth';

// Tope de espera por si Firebase nunca llega a emitir (red caída, token que no
// se puede refrescar). Pasado el tope se cae al login en vez de dejar la
// pantalla en blanco indefinidamente.
const AUTH_RESOLUTION_TIMEOUT_MS = 5000;

export const authGuard: CanActivateFn = async () => {
  const authService = inject(Auth);
  const router      = inject(Router);

  // Si todavía está cargando, esperar: al recargar una ruta protegida el estado
  // de sesión aún no ha llegado, y redirigir aquí expulsaría al login a un
  // usuario que sí tiene sesión.
  if (authService.isLoading()) {
    await Promise.race([
      authService.ready,
      new Promise<void>(resolve => setTimeout(resolve, AUTH_RESOLUTION_TIMEOUT_MS))
    ]);
  }

  if (authService.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/login']);
};
