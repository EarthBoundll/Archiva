import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { TenantService } from '../services/tenant';
import { Permiso, tienePermiso } from '../models/rbac.model';

/**
 * Exige un permiso concreto para entrar en una ruta.
 *
 * Se usa cuando el permiso no se deduce del nombre de la ruta, o cuando
 * hace falta más de uno. La comprobación del cliente es de experiencia:
 * la frontera real son las reglas de Firestore, que aplican lo mismo del
 * lado del servidor.
 *
 *   { path: 'usuarios', canActivate: [authGuard, exigePermiso(Permiso.USUARIOS_VER)] }
 */
export function exigePermiso(...permisos: Permiso[]): CanActivateFn {
  return () => {
    const tenant = inject(TenantService);
    const router = inject(Router);

    // authGuard ya resolvió la empresa antes de llegar aquí.
    const rol = tenant.rol();
    const autorizado = permisos.every(p => tienePermiso(rol, p));

    return autorizado ? true : router.createUrlTree(['/sin-permiso']);
  };
}

/** Variante permisiva: basta con uno de los permisos. */
export function exigeAlguno(...permisos: Permiso[]): CanActivateFn {
  return () => {
    const tenant = inject(TenantService);
    const router = inject(Router);

    const rol = tenant.rol();
    const autorizado = permisos.some(p => tienePermiso(rol, p));

    return autorizado ? true : router.createUrlTree(['/sin-permiso']);
  };
}
