import { TestBed } from '@angular/core/testing';
import { UrlTree, type CanActivateFn } from '@angular/router';
import { signal } from '@angular/core';
import { isObservable, type Observable } from 'rxjs';

import { authGuard } from './auth-guard';
import { guestGuard } from './guest-guard';
import { Auth } from '../services/auth';

/**
 * Estas pruebas fijan el contrato que se rompio en produccion.
 *
 * El guard original resolvia mientras isLoading seguia en true y expulsaba
 * al login a usuarios con sesion valida: bastaba un F5 en cualquier pagina
 * protegida. onAuthStateChanged de Firebase es asincrono, asi que el guard
 * DEBE esperar a que el estado se resuelva antes de decidir.
 */
describe('Guards de sesion', () => {

  /** Doble de Auth con signals reales, para cambiar el estado en caliente. */
  function crearAuthFalso(cargando: boolean, autenticado: boolean) {
    return {
      isLoading: signal(cargando),
      isAuthenticated: () => autenticado
    };
  }

  /**
   * toObservable se apoya en effect(): sin forzar la deteccion de cambios
   * el observable nunca emite dentro de una prueba.
   */
  function propagar(): void {
    const tb = TestBed as unknown as { tick?: () => void; flushEffects?: () => void };
    if (tb.tick) tb.tick();
    else if (tb.flushEffects) tb.flushEffects();
  }

  /** Ejecuta el guard y devuelve un recolector del valor emitido. */
  function ejecutar(guard: CanActivateFn, authFalso: unknown) {
    TestBed.configureTestingModule({
      providers: [{ provide: Auth, useValue: authFalso }]
    });

    const resultado = TestBed.runInInjectionContext(() =>
      guard(null as never, null as never)
    );

    const emitido: (boolean | UrlTree)[] = [];

    if (isObservable(resultado)) {
      (resultado as Observable<boolean | UrlTree>).subscribe(v => emitido.push(v));
    } else {
      emitido.push(resultado as boolean | UrlTree);
    }

    propagar();
    return emitido;
  }

  describe('authGuard', () => {

    it('NO decide mientras el estado de sesion sigue cargando', () => {
      const auth = crearAuthFalso(true, true);
      const emitido = ejecutar(authGuard, auth);

      // Este es exactamente el fallo original: aqui el guard antiguo ya
      // habia devuelto un UrlTree hacia /login.
      expect(emitido.length).toBe(0);
    });

    it('permite el paso cuando la sesion termina de cargar y es valida', () => {
      const auth = crearAuthFalso(true, true);
      const emitido = ejecutar(authGuard, auth);

      expect(emitido.length).toBe(0);

      auth.isLoading.set(false);   // Firebase resuelve la sesion
      propagar();

      expect(emitido).toEqual([true]);
    });

    it('redirige al login cuando termina de cargar y no hay sesion', () => {
      const auth = crearAuthFalso(true, false);
      const emitido = ejecutar(authGuard, auth);

      auth.isLoading.set(false);
      propagar();

      expect(emitido[0]).toBeInstanceOf(UrlTree);
      expect(String(emitido[0])).toBe('/login');
    });

    it('permite el paso cuando la sesion ya estaba resuelta', () => {
      const emitido = ejecutar(authGuard, crearAuthFalso(false, true));
      expect(emitido).toEqual([true]);
    });

    it('redirige cuando no hay sesion y el estado ya estaba resuelto', () => {
      const emitido = ejecutar(authGuard, crearAuthFalso(false, false));
      expect(String(emitido[0])).toBe('/login');
    });
  });

  describe('guestGuard', () => {

    it('deja pasar a quien no tiene sesion', () => {
      const emitido = ejecutar(guestGuard, crearAuthFalso(false, false));
      expect(emitido).toEqual([true]);
    });

    it('devuelve al tablero a quien ya tiene sesion', () => {
      const emitido = ejecutar(guestGuard, crearAuthFalso(false, true));

      expect(emitido[0]).toBeInstanceOf(UrlTree);
      expect(String(emitido[0])).toBe('/dashboard');
    });

    it('tambien espera a que el estado se resuelva', () => {
      const auth = crearAuthFalso(true, true);
      const emitido = ejecutar(guestGuard, auth);

      expect(emitido.length).toBe(0);

      auth.isLoading.set(false);
      propagar();

      expect(String(emitido[0])).toBe('/dashboard');
    });
  });
});
