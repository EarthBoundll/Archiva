import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, map, take } from 'rxjs';
import { Auth } from '../services/auth';

/**
 * Protege las rutas privadas.
 *
 * onAuthStateChanged de Firebase es asincrono: en un arranque en frio
 * (F5, enlace directo, pestaña nueva) el estado tarda un instante en
 * resolverse. Por eso el guard ESPERA a que isLoading pase a false en
 * lugar de decidir con informacion incompleta. Resolver antes de tiempo
 * expulsaba al login a usuarios con sesion valida.
 */
export const authGuard: CanActivateFn = () => {
  const auth   = inject(Auth);
  const router = inject(Router);

  return toObservable(auth.isLoading).pipe(
    filter(cargando => !cargando),
    take(1),
    map(() => auth.isAuthenticated() ? true : router.createUrlTree(['/login']))
  );
};
