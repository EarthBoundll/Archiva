import { Injectable, inject } from '@angular/core';
import { FirebaseService } from './firebase';
import { Auth } from './auth';
import { 
  SectorEmpresa, 
  PreguntaOnboarding, 
  RespuestaOnboarding,
  PREGUNTAS_ONBOARDING,
  PREGUNTAS_COMUNES
} from '../models/onboarding.model';

@Injectable({ providedIn: 'root' })
export class OnboardingService {
  private firebase = inject(FirebaseService);
  private authService = inject(Auth);

  // Obtener preguntas según tipo de empleo
  getPreguntasPorSector(type: SectorEmpresa): PreguntaOnboarding[] {
    const specificQuestions = PREGUNTAS_ONBOARDING[type] || [];
    return [...PREGUNTAS_COMUNES, ...specificQuestions];
  }

  // Obtener todas las preguntas para un tipo específico
  getTodasLasPreguntas(type: SectorEmpresa): PreguntaOnboarding[] {
    return this.getPreguntasPorSector(type);
  }

  // Obtener opciones de tipo de empleo para la primera pregunta
  getSectores() {
    return [
      { value: 'employee', label: 'Empleado / Trabajador dependiente' },
      { value: 'freelancer', label: 'Freelancer / Independiente' },
      { value: 'business_owner', label: 'Dueño de negocio / Emprendedor' },
      { value: 'retired', label: 'Jubilado / Pensionado' },
      { value: 'student', label: 'Estudiante' },
      { value: 'unemployed', label: 'Sin trabajo actualmente' },
      { value: 'other', label: 'Otra situación' }
    ];
  }

  // Verificar si el usuario ya completó el onboarding
  async isOnboardingComplete(): Promise<boolean> {
    const userId = this.authService.getUserId();
    if (!userId) return false;

    const profile = await this.firebase.getUserProfileComplete(userId);
    return profile?.['onboardingCompleted'] || false;
  }

  // Obtener la versión del onboarding
  async getOnboardingVersion(): Promise<number> {
    const userId = this.authService.getUserId();
    if (!userId) return 0;

    const profile = await this.firebase.getUserProfileComplete(userId);
    return profile?.['onboardingVersion'] || 0;
  }

  // Guardar respuestas del onboarding
  async saveOnboardingResponse(response: RespuestaOnboarding): Promise<void> {
    const userId = this.authService.getUserId();
    if (!userId) throw new Error('No autenticado');

    const profileData = {
      // Basic info
      age: response.age,
      employmentType: response.employmentType,
      
      // Answers based on employment type
      ...response.answers,
      
      // Common answers
      hasGoals: response.hasGoals,
      hasInvestments: response.hasInvestments,
      financialPriority: response.financialPriority,
      
      // Meta
      onboardingCompleted: true,
      onboardingVersion: response.onboardingVersion || 1,
      onboardingCompletedAt: new Date().toISOString(),
      needsReview: false,
      
      // Updated
      updatedAt: new Date().toISOString()
    };

    await this.firebase.saveUserProfile(userId, profileData);

    // Create income sources based on employment type
    await this.createIncomeSourcesFromOnboarding(response);
  }

  // Crear income sources basados en las respuestas
  private async createIncomeSourcesFromOnboarding(response: RespuestaOnboarding): Promise<void> {
    const userId = this.authService.getUserId();
    if (!userId) return;

    const { employmentType, answers, age } = response;
    const now = new Date().toISOString();

    // 根据就业类型创建收入来源
    const ans = answers as any;
    
    switch (employmentType) {
      case 'employee':
        if (ans['salary_amount']) {
          await this.firebase.crearDocumento(userId, {
            type: 'contrato_servicios',
            name: 'Salario',
            amount: ans['salary_amount'],
            frequency: 'monthly',
            paymentDayOfMonth: parseInt(ans['salary_day']) || 15,
            deductions: {
              afpPercent: ans['has_afp'] ? 13 : 0,
              insurancePercent: ans['has_health_insurance'] ? 4 : 0
            },
            isRecurring: true,
            createdAt: now,
            updatedAt: now
          });
        }
        break;

      case 'freelancer':
        if (ans['avg_monthly_income']) {
          await this.firebase.crearDocumento(userId, {
            type: 'freelance',
            name: 'Documento freelance',
            amount: ans['avg_monthly_income'],
            frequency: ans['income_frequency'] === 'irregular' ? 'monthly' : ans['income_frequency'],
            paymentDayOfMonth: null,
            isRecurring: ans['income_frequency'] !== 'irregular',
            notes: ans['income_type'],
            createdAt: now,
            updatedAt: now
          });
        }
        break;

      case 'business_owner':
        if (ans['avg_monthly_profit']) {
          await this.firebase.crearDocumento(userId, {
            type: 'informe_gestion',
            name: ans['business_name'] || 'Negocio',
            amount: ans['avg_monthly_profit'],
            frequency: 'monthly',
            paymentDayOfMonth: null,
            isRecurring: true,
            notes: ans['business_type'],
            createdAt: now,
            updatedAt: now
          });
        }
        break;

      case 'retired':
        if (ans['pension_amount']) {
          await this.firebase.crearDocumento(userId, {
            type: 'afp',
            name: 'Pensión / Jubilación',
            amount: ans['pension_amount'],
            frequency: 'monthly',
            paymentDayOfMonth: parseInt(ans['pension_day']) || 1,
            isRecurring: true,
            notes: ans['pension_source'],
            createdAt: now,
            updatedAt: now
          });
        }
        break;

      case 'student':
        if (ans['monthly_amount']) {
          await this.firebase.crearDocumento(userId, {
            type: 'allowance',
            name: ans['income_source'] === 'parents' ? 'Ayuda familiar' : 'Documento estudiante',
            amount: ans['monthly_amount'],
            frequency: 'monthly',
            paymentDayOfMonth: 1,
            isRecurring: true,
            notes: ans['income_source'],
            createdAt: now,
            updatedAt: now
          });
        }
        break;

      case 'unemployed':
        if (ans['savings_amount']) {
          await this.firebase.setAcervoInicial(userId, ans['savings_amount']);
        }
        break;

      case 'other':
        if (ans['monthly_amount']) {
          await this.firebase.crearDocumento(userId, {
            type: 'other',
            name: 'Otros documentos',
            amount: ans['monthly_amount'],
            frequency: 'monthly',
            paymentDayOfMonth: null,
            isRecurring: true,
            notes: ans['income_source'],
            createdAt: now,
            updatedAt: now
          });
        }
        break;
    }
  }

  /**
   * Guarda la configuracion inicial de la empresa en el perfil del usuario.
   * Sustituye al antiguo saveOnboardingResponse, cuyo modelo era financiero
   * (ingresos, metas de ahorro, prioridad financiera).
   */
  async guardarConfiguracionEmpresa(datos: {
    responsable: string;
    razonSocial: string;
    areaArchivo: string;
    prefijoCodificacion: string;
  }): Promise<void> {
    const userId = this.authService.getUserId();
    if (!userId) throw new Error('No autenticado');

    await this.firebase.saveUserProfile(userId, {
      responsableArchivo: datos.responsable,
      razonSocial: datos.razonSocial,
      areaArchivo: datos.areaArchivo,
      prefijoCodificacion: datos.prefijoCodificacion,
      estadoProyecto: 'en_desarrollo',
      onboardingCompleted: true,
      onboardingVersion: 2,
      onboardingCompletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  // Obtener el perfil del usuario
  async getUserProfile(): Promise<any> {
    const userId = this.authService.getUserId();
    if (!userId) return null;

    return this.firebase.getUserProfileComplete(userId);
  }

  // Marcar que necesita revisión de onboarding
  async markForReview(): Promise<void> {
    const userId = this.authService.getUserId();
    if (!userId) return;

    await this.firebase.saveUserProfile(userId, {
      needsReview: true,
      updatedAt: new Date().toISOString()
    });
  }

  // Reiniciar onboarding (para settings)
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