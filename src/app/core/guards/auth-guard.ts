import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, switchMap, map, take, of } from 'rxjs';
import { Auth } from '../services/auth';
import { TenantService } from '../services/tenant';
import { PERMISO_POR_RUTA, tienePermiso } from '../models/rbac.model';
import { puedeEntrar } from '../models/member.model';

/**
 * Protege las rutas privadas en tres pasos.
 *
 * 1. Espera a que Firebase resuelva la sesión. `onAuthStateChanged` es
 *    asíncrono: en un arranque en frío —F5, enlace directo, pestaña
 *    nueva— el estado tarda un instante, y decidir antes expulsaba al
 *    login a personas con sesión válida.
 * 2. Resuelve a qué empresa pertenece y con qué rol.
 * 3. Comprueba que ese rol pueda ver la ruta pedida.
 */
export const authGuard: CanActivateFn = (ruta: ActivatedRouteSnapshot) => {
  const auth   = inject(Auth);
  const tenant = inject(TenantService);
  const router = inject(Router);

  return toObservable(auth.isLoading).pipe(
    filter(cargando => !cargando),
    take(1),
    switchMap(() => {
      if (!auth.isAuthenticated()) {
        return of(router.createUrlTree(['/login']));
      }
      return tenant.resolver().then(miembro => {
        // Autenticado pero sin pertenencia utilizable: hay una pantalla
        // que lo explica, en vez de un tablero vacío sin motivo.
        if (!puedeEntrar(miembro)) {
          return router.createUrlTree(['/sin-acceso']);
        }

        const permiso = permisoDeRuta(ruta);
        if (permiso && !tienePermiso(miembro!.rol, permiso)) {
          return router.createUrlTree(['/sin-permiso']);
        }

        return true;
      });
    }),
    map(r => r)
  );
};

/** Primer segmento de la ruta, que es el que declara permiso. */
function permisoDeRuta(ruta: ActivatedRouteSnapshot) {
  const segmento = ruta.routeConfig?.path?.split('/')[0] ?? '';
  return PERMISO_POR_RUTA[segmento];
}
