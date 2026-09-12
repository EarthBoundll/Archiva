import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, switchMap, map, take, of } from 'rxjs';
import { Auth } from '../services/auth';
import { TenantService } from '../services/tenant';
import { PERMISO_POR_RUTA } from '../models/rbac.model';
import { puedeEntrar } from '../models/member.model';

/**
 * Protege las rutas privadas en tres pasos.
 *
 * 1. Espera a que Firebase resuelva la sesión. `onAuthStateChanged` es
 *    asíncrono: en un arranque en frío —F5, enlace directo, pestaña
 *    nueva— el estado tarda un instante, y decidir antes expulsaba al
 *    login a personas con sesión válida.
 * 2. Resuelve a qué empresa pertenece y con qué rol.
 * 3. Comprueba que pueda ver la ruta pedida, preguntándoselo al mismo
 *    servicio que usa el resto de la aplicación.
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
        // Autenticado pero sin pertenencia utilizable. Un operador de
        // plataforma que aún no ha entrado en ninguna empresa cae aquí, y
        // no es un caso de acceso denegado: es uno de elegir destino. La
        // pantalla lo distingue por el motivo.
        if (!puedeEntrar(miembro)) {
          return router.createUrlTree(['/sin-acceso']);
        }

        // El permiso se pregunta al servicio, no se calcula aquí.
        //
        // Antes esto comparaba el rol contra la tabla directamente, y con
        // el rol sintético de un operador —administrador de empresa— habría
        // concedido rutas que la lista blanca de soporte niega. Dos
        // comprobaciones que deberían decir lo mismo diciendo cosas
        // distintas es lo que produjo A-2: un solo sitio donde se decide.
        const permiso = permisoDeRuta(ruta);
        if (permiso && !tenant.puede(permiso)) {
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
