import { TestBed } from '@angular/core/testing';
import { UrlTree, type CanActivateFn, type ActivatedRouteSnapshot } from '@angular/router';
import { signal } from '@angular/core';
import { isObservable, type Observable } from 'rxjs';

import { authGuard } from './auth-guard';
import { guestGuard } from './guest-guard';
import { Auth } from '../services/auth';
import { TenantService } from '../services/tenant';
import { Rol } from '../models/rbac.model';
import { Miembro } from '../models/member.model';

/**
 * Contrato de las guardas, en tres pasos.
 *
 * 1. Esperar a que Firebase resuelva la sesión. El guard original decidía
 *    con isLoading todavía en true y expulsaba al login a quien tenía
 *    sesión válida: bastaba un F5 en cualquier página protegida.
 * 2. Resolver a qué empresa pertenece y con qué rol. Sin este paso, la
 *    plataforma multiempresa dejaría entrar a cuentas sin pertenencia.
 * 3. Comprobar que el rol alcanza la ruta pedida.
 */
describe('Guardas de sesión y tenencia', () => {

  /** Doble de Auth con signals reales, para cambiar el estado en caliente. */
  function authFalso(cargando: boolean, autenticado: boolean) {
    return {
      isLoading: signal(cargando),
      isAuthenticated: () => autenticado
    };
  }

  function miembro(p: Partial<Miembro> = {}): Miembro {
    return {
      uid: 'u1', empresaId: 'e1',
      email: 'maria@empresa.com', nombre: 'María',
      rol: Rol.COLABORADOR, estado: 'activo',
      area: 'administracion', fechaAlta: '2026-01-01',
      ...p
    } as Miembro;
  }

  /** Doble de la tenencia: devuelve la pertenencia que la prueba decida. */
  function tenantFalso(m: Miembro | null) {
    return {
      resolver: () => Promise.resolve(m),
      miembro: () => m,
      rol: () => m?.rol ?? null
    };
  }

  /** Ruta simulada; el guard toma de ella el primer segmento. */
  function rutaDe(path: string): ActivatedRouteSnapshot {
    return { routeConfig: { path } } as ActivatedRouteSnapshot;
  }

  /**
   * toObservable se apoya en effect(): sin forzar la detección de cambios
   * el observable nunca emite dentro de una prueba.
   */
  function propagar(): void {
    const tb = TestBed as unknown as { tick?: () => void; flushEffects?: () => void };
    if (tb.tick) tb.tick();
    else if (tb.flushEffects) tb.flushEffects();
  }

  /** Deja que se resuelvan las promesas encadenadas del guard. */
  async function asentar(): Promise<void> {
    propagar();
    await Promise.resolve();
    await Promise.resolve();
    propagar();
  }

  function ejecutar(
    guard: CanActivateFn,
    auth: unknown,
    tenant: unknown = tenantFalso(miembro()),
    ruta: ActivatedRouteSnapshot = rutaDe('dashboard')
  ) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: Auth, useValue: auth },
        { provide: TenantService, useValue: tenant }
      ]
    });

    const resultado = TestBed.runInInjectionContext(() => guard(ruta, null as never));
    const emitido: (boolean | UrlTree)[] = [];

    if (isObservable(resultado)) {
      (resultado as Observable<boolean | UrlTree>).subscribe(v => emitido.push(v));
    } else {
      emitido.push(resultado as boolean | UrlTree);
    }

    propagar();
    return emitido;
  }

  // ------------------------------------------
  // PASO 1: LA SESION
  // ------------------------------------------

  describe('authGuard · espera de la sesión', () => {

    it('NO decide mientras el estado de sesión sigue cargando', () => {
      // Este es exactamente el fallo original: aquí el guard antiguo ya
      // había devuelto un UrlTree hacia /login.
      const auth = authFalso(true, true);
      expect(ejecutar(authGuard, auth).length).toBe(0);
    });

    it('deja pasar cuando la sesión termina de cargar y es válida', async () => {
      const auth = authFalso(true, true);
      const emitido = ejecutar(authGuard, auth);

      expect(emitido.length).toBe(0);

      auth.isLoading.set(false);   // Firebase resuelve la sesión
      await asentar();

      expect(emitido).toEqual([true]);
    });

    it('redirige al login cuando termina de cargar y no hay sesión', async () => {
      const auth = authFalso(true, false);
      const emitido = ejecutar(authGuard, auth);

      auth.isLoading.set(false);
      await asentar();

      expect(emitido[0]).toBeInstanceOf(UrlTree);
      expect(String(emitido[0])).toBe('/login');
    });

    it('redirige cuando no hay sesión y el estado ya estaba resuelto', async () => {
      const emitido = ejecutar(authGuard, authFalso(false, false));
      await asentar();
      expect(String(emitido[0])).toBe('/login');
    });
  });

  // ------------------------------------------
  // PASO 2: LA PERTENENCIA
  // ------------------------------------------

  describe('authGuard · pertenencia a una empresa', () => {

    it('deja pasar a un miembro activo', async () => {
      const emitido = ejecutar(authGuard, authFalso(false, true), tenantFalso(miembro()));
      await asentar();
      expect(emitido).toEqual([true]);
    });

    it('desvía a quien no pertenece a ninguna empresa', async () => {
      // Autenticado pero sin pertenencia: hay una pantalla que lo explica,
      // en vez de un tablero vacío sin motivo aparente.
      const emitido = ejecutar(authGuard, authFalso(false, true), tenantFalso(null));
      await asentar();
      expect(String(emitido[0])).toBe('/sin-acceso');
    });

    it('desvía a quien está suspendido', async () => {
      const suspendido = tenantFalso(miembro({ estado: 'suspendido' }));
      const emitido = ejecutar(authGuard, authFalso(false, true), suspendido);
      await asentar();
      expect(String(emitido[0])).toBe('/sin-acceso');
    });

    it('desvía a quien no completó su invitación', async () => {
      const invitado = tenantFalso(miembro({ estado: 'invitado' }));
      const emitido = ejecutar(authGuard, authFalso(false, true), invitado);
      await asentar();
      expect(String(emitido[0])).toBe('/sin-acceso');
    });
  });

  // ------------------------------------------
  // PASO 3: EL PERMISO
  // ------------------------------------------

  describe('authGuard · permiso de la ruta', () => {

    it('un colaborador no alcanza la sección de personas', async () => {
      const emitido = ejecutar(
        authGuard, authFalso(false, true),
        tenantFalso(miembro({ rol: Rol.COLABORADOR })),
        rutaDe('usuarios')
      );
      await asentar();
      expect(String(emitido[0])).toBe('/sin-permiso');
    });

    it('un administrador sí la alcanza', async () => {
      const emitido = ejecutar(
        authGuard, authFalso(false, true),
        tenantFalso(miembro({ rol: Rol.ADMIN_EMPRESA })),
        rutaDe('usuarios')
      );
      await asentar();
      expect(emitido).toEqual([true]);
    });

    it('un colaborador no alcanza la bandeja de aprobaciones', async () => {
      const emitido = ejecutar(
        authGuard, authFalso(false, true),
        tenantFalso(miembro({ rol: Rol.COLABORADOR })),
        rutaDe('bandeja')
      );
      await asentar();
      expect(String(emitido[0])).toBe('/sin-permiso');
    });

    it('un supervisor sí llega a la bandeja', async () => {
      const emitido = ejecutar(
        authGuard, authFalso(false, true),
        tenantFalso(miembro({ rol: Rol.SUPERVISOR })),
        rutaDe('bandeja')
      );
      await asentar();
      expect(emitido).toEqual([true]);
    });

    it('una ruta sin permiso declarado no bloquea a nadie', async () => {
      const emitido = ejecutar(
        authGuard, authFalso(false, true),
        tenantFalso(miembro({ rol: Rol.COLABORADOR })),
        rutaDe('ruta-sin-declarar')
      );
      await asentar();
      expect(emitido).toEqual([true]);
    });
  });

  // ------------------------------------------
  // ACCESO PARA VISITANTES
  // ------------------------------------------

  describe('guestGuard', () => {

    it('deja pasar a quien no tiene sesión', () => {
      expect(ejecutar(guestGuard, authFalso(false, false))).toEqual([true]);
    });

    it('devuelve al tablero a quien ya tiene sesión', () => {
      const emitido = ejecutar(guestGuard, authFalso(false, true));
      expect(emitido[0]).toBeInstanceOf(UrlTree);
      expect(String(emitido[0])).toBe('/dashboard');
    });

    it('también espera a que el estado se resuelva', () => {
      const auth = authFalso(true, true);
      const emitido = ejecutar(guestGuard, auth);

      expect(emitido.length).toBe(0);

      auth.isLoading.set(false);
      propagar();

      expect(String(emitido[0])).toBe('/dashboard');
    });
  });
});
