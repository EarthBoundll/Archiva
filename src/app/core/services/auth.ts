import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { onAuthStateChanged, User } from '@angular/fire/auth';
import { FirebaseService } from './firebase';
import { borrarCacheLocal } from './offline-sync.service';

@Injectable({
  providedIn: 'root'
})
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

  async signUp(email: string, password: string, fullName: string) {
    const result = await this.firebase.signUp(email, password);
    
    if (result.user) {
      await this.firebase.createUserProfile(result.user.uid, {
        fullName,
        email,
        monthlyIncome: 1200,
        currency: 'PEN',
        locale: 'es-PE',
        createdAt: new Date().toISOString()
      });
      this.router.navigate(['/dashboard']);
    }
    
    return result;
  }

  async signIn(email: string, password: string) {
    const result = await this.firebase.signIn(email, password);
    // Navegar inmediatamente (Firebase ya autentica)
    this.router.navigate(['/dashboard']);
    return result;
  }

  async signOut() {
    await this.firebase.signOut();

    // La cache local no esta segmentada por usuario: si sobrevive al cierre
    // de sesion, en un equipo compartido el siguiente usuario recibe datos
    // del anterior. Se borra siempre, aunque falle.
    try {
      await borrarCacheLocal();
      localStorage.removeItem('archiva_last_synced');
      localStorage.removeItem('trackpays_last_synced'); // clave heredada
    } catch { /* el logout no debe bloquearse por la limpieza */ }

    // replaceUrl evita dejar la pagina protegida como entrada de historial.
    await this.router.navigate(['/login'], { replaceUrl: true });
  }

  /** Solicita el correo de restablecimiento. No revela si la cuenta existe. */
  async sendPasswordReset(email: string): Promise<void> {
    await this.firebase.sendPasswordReset(email);
  }

  async signInWithGoogle() {
    const result = await this.firebase.signInWithGoogle();
    
    if (result.user) {
      const existingProfile = await this.firebase.getUserProfile(result.user.uid);
      if (!existingProfile) {
        await this.firebase.createUserProfile(result.user.uid, {
          fullName: result.user.displayName || 'Usuario',
          email: result.user.email,
          monthlyIncome: 1200,
          currency: 'PEN',
          locale: 'es-PE',
          createdAt: new Date().toISOString()
        });
      }
    }
    
    this.router.navigate(['/dashboard']);
    return result;
  }

  getUserId(): string | null {
    return this.currentUser()?.uid ?? null;
  }

  isAuthenticated(): boolean {
    return this.currentUser() !== null;
  }

  async getUserProfile() {
    const userId = this.getUserId();
    if (!userId) return null;
    return this.firebase.getUserProfile(userId);
  }
}