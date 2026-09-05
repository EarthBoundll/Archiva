import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, map, take } from 'rxjs';
import { Auth } from '../services/auth';

/**
 * Reserva una ruta para visitantes sin sesion.
 *
 * Evita que un usuario ya autenticado se quede mirando el formulario de
 * acceso: si llega a /login con sesion activa, se le devuelve al tablero.
 */
export const guestGuard: CanActivateFn = () => {
  const auth   = inject(Auth);
  const router = inject(Router);

  return toObservable(auth.isLoading).pipe(
    filter(cargando => !cargando),
    take(1),
    map(() => auth.isAuthenticated() ? router.createUrlTree(['/dashboard']) : true)
  );
};
