import { Injectable, inject } from '@angular/core';
import { FirebaseService } from './firebase';
import { Auth } from './auth';
import {
  ConfiguracionEmpresa,
  PerfilArchivo,
  SectorEmpresa,
  SECTORES,
  sugerirPrefijo,
  esPrefijoValido
} from '../models/onboarding.model';

/**
 * Configuracion inicial del archivo de la empresa.
 *
 * La version anterior guardaba un cuestionario financiero y, al terminar,
 * creaba automaticamente fuentes de ingreso —salario con descuento de AFP,
 * pension, ayuda familiar, saldo de ahorros—. Nada de eso pertenece a un
 * sistema documental, asi que se elimino junto con el catalogo de preguntas.
 */
@Injectable({ providedIn: 'root' })
export class OnboardingService {
  private firebase = inject(FirebaseService);
  private authService = inject(Auth);

  /** La version del asistente; sube cuando cambia lo que se pregunta. */
  private readonly VERSION = 2;

  // ------------------------------------------
  // CATALOGO
  // ------------------------------------------

  getSectores() {
    return (Object.keys(SECTORES) as SectorEmpresa[])
      .map(s => ({ value: s, ...SECTORES[s] }));
  }

  /** Prefijo sugerido a partir del area; el usuario puede corregirlo. */
  sugerirPrefijo(area: string): string {
    return sugerirPrefijo(area);
  }

  // ------------------------------------------
  // ESTADO
  // ------------------------------------------

  async isOnboardingComplete(): Promise<boolean> {
    const userId = this.authService.getUserId();
    if (!userId) return false;

    const profile = await this.firebase.getUserProfileComplete(userId);
    return profile?.['onboardingCompleted'] || false;
  }

  async getOnboardingVersion(): Promise<number> {
    const userId = this.authService.getUserId();
    if (!userId) return 0;

    const profile = await this.firebase.getUserProfileComplete(userId);
    return profile?.['onboardingVersion'] || 0;
  }

  async getUserProfile(): Promise<PerfilArchivo | null> {
    const userId = this.authService.getUserId();
    if (!userId) return null;

    return (await this.firebase.getUserProfileComplete(userId)) as PerfilArchivo | null;
  }

  // ------------------------------------------
  // GUARDADO
  // ------------------------------------------

  /** Guarda el perfil archivistico de la empresa. */
  async guardarConfiguracionEmpresa(datos: ConfiguracionEmpresa): Promise<void> {
    const userId = this.authService.getUserId();
    if (!userId) throw new Error('No autenticado');

    const prefijo = datos.prefijoCodificacion.trim().toUpperCase();

    // El prefijo entra en el codigo de cada documento: si se acepta mal
    // formado, todo el acervo queda mal codificado y no hay vuelta atras
    // sin renumerar.
    if (!esPrefijoValido(prefijo)) {
      throw new Error('El prefijo debe tener entre tres y cinco letras, sin números ni espacios.');
    }

    await this.firebase.saveUserProfile(userId, {
      responsableArchivo: datos.responsable.trim(),
      razonSocial: datos.razonSocial.trim(),
      areaArchivo: datos.areaArchivo.trim(),
      prefijoCodificacion: prefijo,
      sector: datos.sector ?? 'otro',
      onboardingCompleted: true,
      onboardingVersion: this.VERSION,
      onboardingCompletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  /** Marca el perfil para que el asistente vuelva a pedirse. */
  async markForReview(): Promise<void> {
    const userId = this.authService.getUserId();
    if (!userId) return;

    await this.firebase.saveUserProfile(userId, {
      needsReview: true,
      updatedAt: new Date().toISOString()
    });
  }

  async resetOnboarding(): Promise<void> {
    const userId = this.authService.getUserId();
    if (!userId) return;

    await this.firebase.saveUserProfile(userId, {
      onboardingCompleted: false,
      onboardingVersion: 0,
      needsReview: false,
      updatedAt: new Date().toISOString()
    });
  }
}
