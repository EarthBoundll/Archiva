import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { onAuthStateChanged, User } from '@angular/fire/auth';
import { FirebaseService } from './firebase';
import { borrarCacheLocal } from '../utils/cache-local';
import { log } from '../utils/logger';

/**
 * Sesión de la persona.
 *
 * ARCHIVA es software empresarial: **no hay alta pública**. Nadie crea su
 * cuenta por su cuenta; un administrador invita y la cuenta nace al
 * aceptar esa invitación, con el rol y la empresa que él fijó. Por eso
 * aquí no existe `signUp` ni acceso con Google: ambos permitían entrar sin
 * que nadie te hubiera dado permiso.
 */
@Injectable({ providedIn: 'root' })
export class Auth {
  private firebase = inject(FirebaseService);
  private router = inject(Router);

  currentUser = signal<User | null>(null);
  isLoading = signal<boolean>(true);

  constructor() {
    this.initAuthState();
  }

  private initAuthState() {
    const auth = this.firebase.getAuth();
    onAuthStateChanged(auth, (user) => {
      this.currentUser.set(user);
      this.isLoading.set(false);
    });
  }

  async signIn(email: string, password: string) {
    const result = await this.firebase.signIn(email, password);
    // La navegación la decide el guard cuando la empresa esté resuelta:
    // ir al tablero antes de saber si la persona pertenece a alguna
    // empresa mostraría una pantalla vacía y confusa.
    return result;
  }

  async signOut() {
    const uid = this.currentUser()?.uid;

    await this.firebase.signOut();

    // La caché local no está segmentada por empresa: si sobrevive al
    // cierre de sesión, en un equipo compartido la siguiente persona
    // recibe datos de la anterior.
    try {
      await borrarCacheLocal();
      localStorage.removeItem('archiva_last_synced');
      localStorage.removeItem('trackpays_last_synced'); // clave heredada
    } catch { /* el cierre de sesión no debe bloquearse por la limpieza */ }

    if (uid) log.debug('[Auth] sesión cerrada');

    // replaceUrl evita dejar la página protegida como entrada de historial.
    await this.router.navigate(['/login'], { replaceUrl: true });
  }

  /** Solicita el correo de restablecimiento. No revela si la cuenta existe. */
  async sendPasswordReset(email: string): Promise<void> {
    await this.firebase.sendPasswordReset(email);
  }

  /**
   * Crea la cuenta de una persona invitada.
   *
   * Es la única vía de alta que queda, y solo se llega a ella con un
   * testigo de invitación válido. El perfil global apunta a la empresa
   * desde el primer instante: sin eso la sesión no tendría ámbito.
   */
  async crearDesdeInvitacion(
    email: string,
    password: string,
    datos: { empresaId: string; nombre: string; rol: string; area: string; cargo?: string }
  ) {
    const result = await this.firebase.signUp(email, password);
    const user = result.user;
    if (!user) throw new Error('No se pudo crear la cuenta.');

    const ahora = new Date().toISOString();

    await this.firebase.guardarPerfilGlobal(user.uid, {
      uid: user.uid,
      email,
      nombre: datos.nombre,
      empresaId: datos.empresaId,
      creadoEl: ahora
    });

    await this.firebase.guardarMiembro(datos.empresaId, user.uid, {
      email,
      nombre: datos.nombre,
      rol: datos.rol,
      area: datos.area,
      cargo: datos.cargo,
      estado: 'activo',
      fechaAlta: ahora
    });

    return result;
  }

  getUserId(): string | null {
    return this.currentUser()?.uid ?? null;
  }

  isAuthenticated(): boolean {
    return this.currentUser() !== null;
  }
}
