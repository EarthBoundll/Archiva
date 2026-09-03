import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { onAuthStateChanged, User } from '@angular/fire/auth';
import { FirebaseService } from './firebase';

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
    this.router.navigate(['/login']);
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