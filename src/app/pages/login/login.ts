import { Component, inject, signal, effect } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Auth } from '../../core/services/auth';
import { PasswordStrengthComponent } from '../../core/components/password-strength/password-strength';
import { IconComponent } from '../../core/components/icon/icon.component';
import { log } from '../../core/utils/logger';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, PasswordStrengthComponent, IconComponent],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class LoginComponent {

  private fb          = inject(FormBuilder);
  private authService = inject(Auth);
  private router      = inject(Router);

  isRegister   = signal(false);
  isLoading    = signal(false);
  errorMsg     = signal('');
  showPassword = signal(false);
  passwordValue = signal('');

  form = this.fb.group({
    fullName: [''],
    email:    ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  constructor() {
    this.form.get('password')?.valueChanges.subscribe(val => {
      this.passwordValue.set(val || '');
    });

    // Precargar imagen 2.png para cambio instantáneo
  }

  toggleMode() {
    this.isRegister.update(v => !v);
    this.errorMsg.set('');
    this.form.reset();
    this.passwordValue.set('');
  }

  togglePassword() {
    this.showPassword.update(v => !v);
  }

  get showStrength(): boolean {
    return this.isRegister() && this.passwordValue().length > 0;
  }

  isPasswordValid(): boolean {
    const pwd = this.passwordValue();
    return pwd.length >= 8 && /\d/.test(pwd) && /[A-Z]/.test(pwd);
  }

  async onSubmit() {
    // En modo login, solo verificar que los campos no estén vacíos
    if (this.form.invalid) {
      return;
    }

    // En modo registro, verificar requisitos de contraseña fuerte
    if (this.isRegister() && !this.isPasswordValid()) {
      this.errorMsg.set('La contraseña debe tener al menos 8 caracteres, un número y una mayúscula.');
      return;
    }

    this.isLoading.set(true);
    this.errorMsg.set('');

    const { email, password, fullName } = this.form.value;

    try {
      if (this.isRegister()) {
        await this.authService.signUp(email!, password!, fullName ?? '');
      } else {
        await this.authService.signIn(email!, password!);
      }
    } catch (error: any) {
      log.error('Login error:', error);
      this.errorMsg.set(this.parseError(error));
    } finally {
      this.isLoading.set(false);
    }
  }

  async loginWithGoogle() {
    this.isLoading.set(true);
    this.errorMsg.set('');
    try {
      await this.authService.signInWithGoogle();
    } catch (error: any) {
      this.errorMsg.set(this.parseError(error));
      this.isLoading.set(false);
    }
  }

  /**
   * Envia el correo de restablecimiento.
   *
   * El mensaje de confirmacion es deliberadamente ambiguo: confirmar que una
   * direccion existe permitiria enumerar cuentas registradas.
   */
  async recuperarPassword() {
    const email = this.form.get('email')?.value?.trim();

    if (!email) {
      this.errorMsg.set('Escribe tu correo electrónico y vuelve a pulsar.');
      return;
    }

    this.isLoading.set(true);
    this.errorMsg.set('');

    try {
      await this.authService.sendPasswordReset(email);
    } catch (e: any) {
      // Un correo no registrado no debe distinguirse de uno que si lo esta.
      if (e?.code !== 'auth/user-not-found' && e?.code !== 'auth/invalid-email') {
        log.error('Password reset error:', e?.code);
      }
    } finally {
      this.isLoading.set(false);
      this.errorMsg.set('Revisa tu correo: si la dirección está registrada, recibirás un enlace para restablecer la contraseña.');
    }
  }

  private parseError(error: any): string {
    // Firebase Auth error codes
    const code = error?.code || error?.message || '';
    const msg = error?.message || '';
    
    // Login errors
    if (code.includes('auth/user-not-found') || code.includes('auth/wrong-password')) 
      return 'Correo o contraseña incorrectos.';
    if (code.includes('auth/invalid-email')) 
      return 'El correo electrónico no es válido.';
    if (code.includes('auth/user-disabled')) 
      return 'Esta cuenta ha sido deshabilitada.';
    if (code.includes('auth/too-many-requests')) 
      return 'Demasiados intentos fallidos. Intenta más tarde.';
    if (code.includes('auth/invalid-credential')) 
      return 'Correo o contraseña incorrectos.';
    
    // Register errors  
    if (code.includes('auth/email-already-in-use')) 
      return 'Este correo ya está registrado.';
    if (code.includes('auth/weak-password')) 
      return 'La contraseña es muy débil. Usa al menos 6 caracteres.';
    
    // Google errors
    if (code.includes('auth/popup-closed-by-user') || msg.includes('POPUP_CLOSED')) 
      return 'Cerraste la ventana de Google.';
    if (code.includes('auth/cancelled-popup-request')) 
      return 'Solo se permite un popup a la vez.';
    
    // Network
    if (code.includes('auth/network-request-failed') || msg.includes('Network error')) 
      return 'Error de conexión. Verifica tu internet.';
    
    // Default - return friendly message
    log.error('Auth error:', error);
    return 'Ocurrió un error. Intenta de nuevo.';
  }
}