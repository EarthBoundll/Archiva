import { inject } from '@angular/core';
import { Router, type CanActivateFn, type ActivatedRouteSnapshot } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, switchMap, take, map, of } from 'rxjs';

import { Auth } from '../services/auth';
import { TenantService } from '../services/tenant';

/**
 * Entrada de un operador de plataforma en una empresa.
 *
 * Es una ruta que actúa y redirige, no una pantalla. Existe para que la
 * entrada tenga un punto de acceso comprobable antes de que haya una
 * pantalla desde donde elegir —eso es la Fase 4—, y para que esa pantalla,
 * cuando llegue, no tenga que inventar el mecanismo: solo enlazará aquí.
 *
 * Queda FUERA de la guarda de sesión, junto al acceso y la aceptación de
 * invitación. Si estuviera dentro, un operador sin empresa activa sería
 * redirigido a la pantalla de acceso denegado, que a su vez lo mandaría
 * aquí: un bucle.
 */
export const entrarEnEmpresaGuard: CanActivateFn = (ruta: ActivatedRouteSnapshot) => {
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

      return tenant.resolver().then(async () => {
        // Solo un operador entra así. Un usuario de empresa que llegue
        // aquí —por curiosidad o por un enlace copiado— va a su tablero,
        // no a una pantalla de error: no ha hecho nada malo.
        if (!tenant.esPlataforma()) {
          return router.createUrlTree(['/dashboard']);
        }

        const empresaId = ruta.paramMap.get('empresaId')?.trim();
        if (!empresaId) {
          return router.createUrlTree(['/sin-acceso']);
        }

        // El motivo llega en la consulta. Cuando exista la pantalla de
        // plataforma —Fase 4— lo pedirá en un formulario; hasta entonces,
        // sin motivo no se entra.
        const motivo = ruta.queryParamMap.get('motivo')?.trim();

        try {
          await tenant.entrarEn(empresaId, motivo ?? '');
        } catch {
          // Sin constancia no hay entrada. La pantalla de acceso denegado
          // lo explica desde el modo plataforma.
          return router.createUrlTree(['/sin-acceso']);
        }

        return router.createUrlTree(['/dashboard']);
      });
    }),
    map(r => r)
  );
};

/**
 * Salida de la empresa visitada.
 *
 * Salir y entrar, nunca una transición directa: el servicio de empresa
 * cachea su ficha, y sin una salida limpia el operador vería los datos de
 * la empresa anterior sobre los de la nueva.
 */
export const salirDeEmpresaGuard: CanActivateFn = () => {
  const tenant = inject(TenantService);
  const router = inject(Router);

  if (tenant.esPlataforma()) tenant.salirDeEmpresa();
  return router.createUrlTree(['/sin-acceso']);
};
