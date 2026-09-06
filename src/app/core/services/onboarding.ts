import { Injectable, inject } from '@angular/core';
import { FirebaseService } from './firebase';
import { Auth } from './auth';
import { CompanyService } from './company';
import { Empresa } from '../models/company.model';

/**
 * Asistente de configuración inicial.
 *
 * Delega en CompanyService: la empresa tiene una sola representación y un
 * solo sitio donde se guarda. Antes este servicio mantenía su propio modelo
 * y escribía campos que después nadie leía.
 */
@Injectable({ providedIn: 'root' })
export class OnboardingService {
  private firebase = inject(FirebaseService);
  private authService = inject(Auth);
  private company = inject(CompanyService);

  /** Sube cuando cambia lo que el asistente pregunta. */
  private readonly VERSION = 3;

  async isOnboardingComplete(): Promise<boolean> {
    const userId = this.authService.getUserId();
    if (!userId) return false;

    // Se considera completo cuando hay lo mínimo para operar, no cuando
    // alguien pulsó «Finalizar»: un perfil sin prefijo no sirve de nada.
    await this.company.cargar();
    if (this.company.configurada()) return true;

    const perfil = await this.firebase.getUserProfileComplete(userId);
    return perfil?.['onboardingCompleted'] === true;
  }

  async getOnboardingVersion(): Promise<number> {
    const userId = this.authService.getUserId();
    if (!userId) return 0;
    const perfil = await this.firebase.getUserProfileComplete(userId);
    return perfil?.['onboardingVersion'] || 0;
  }

  async getUserProfile(): Promise<Empresa | null> {
    return this.company.cargar();
  }

  /** Guarda lo que recoge el asistente. */
  async guardarConfiguracionEmpresa(datos: Partial<Empresa>): Promise<Empresa> {
    return this.company.guardar(datos);
  }

  sugerirPrefijo(area: string): string {
    return this.company.sugerirPrefijo(area as any);
  }

  getSectores() { return this.company.getSectores(); }
  getAreas()    { return this.company.getAreas(); }

  async resetOnboarding(): Promise<void> {
    const userId = this.authService.getUserId();
    if (!userId) return;

    await this.firebase.saveUserProfile(userId, {
      onboardingCompleted: false,
      onboardingVersion: 0,
      updatedAt: new Date().toISOString()
    });
    await this.company.cargar(true);
  }

  get version(): number { return this.VERSION; }
}
