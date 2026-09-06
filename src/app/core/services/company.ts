import { Injectable, inject, signal, computed } from '@angular/core';
import { FirebaseService } from './firebase';
import { Auth } from './auth';
import {
  Empresa,
  EMPRESA_POR_DEFECTO,
  SectorEmpresa,
  SECTORES,
  validarEmpresa,
  estaConfigurada,
  sugerirPrefijo
} from '../models/company.model';
import { AreaEmisora, AREAS_EMISORAS } from '../models/document.model';

/**
 * Configuración de la empresa archivante.
 *
 * Es la única fuente de estos datos para toda la aplicación. Se expone
 * como señal porque el prefijo de codificación se consulta en cada alta de
 * documento: releerlo de Firestore cada vez sería un viaje de red por
 * documento registrado.
 *
 * La versión anterior escribía estos campos al terminar el asistente y no
 * los leía en ninguna parte.
 */
@Injectable({ providedIn: 'root' })
export class CompanyService {
  private firebase = inject(FirebaseService);
  private authService = inject(Auth);

  /** null mientras no se ha leído el perfil. */
  private readonly _empresa = signal<Empresa | null>(null);
  private cargaEnCurso: Promise<Empresa | null> | null = null;

  readonly empresa = this._empresa.asReadonly();

  readonly configurada = computed(() => estaConfigurada(this._empresa()));

  /** Prefijo vigente, o cadena vacía si aún no se configuró. */
  readonly prefijo = computed(() => this._empresa()?.prefijoCodificacion ?? '');

  readonly razonSocial = computed(() => this._empresa()?.razonSocial ?? '');

  readonly diasAlertaPorDefecto = computed(() =>
    this._empresa()?.diasAlertaPorDefecto ?? EMPRESA_POR_DEFECTO.diasAlertaPorDefecto
  );

  // ------------------------------------------
  // LECTURA
  // ------------------------------------------

  /**
   * Carga el perfil una sola vez y lo deja en la señal.
   * Las llamadas simultáneas comparten la misma promesa: al arrancar, varias
   * pantallas lo piden a la vez.
   */
  async cargar(forzar = false): Promise<Empresa | null> {
    if (!forzar && this._empresa()) return this._empresa();
    if (!forzar && this.cargaEnCurso) return this.cargaEnCurso;

    const userId = this.authService.getUserId();
    if (!userId) return null;

    this.cargaEnCurso = (async () => {
      const perfil = await this.firebase.getUserProfileComplete(userId);
      const empresa = this.desdePerfil(perfil);
      this._empresa.set(empresa);
      return empresa;
    })();

    try {
      return await this.cargaEnCurso;
    } finally {
      this.cargaEnCurso = null;
    }
  }

  /** El valor ya cargado, sin ir a la red. */
  actual(): Empresa {
    return this._empresa() ?? { ...EMPRESA_POR_DEFECTO };
  }

  // ------------------------------------------
  // ESCRITURA
  // ------------------------------------------

  async guardar(datos: Partial<Empresa>): Promise<Empresa> {
    const userId = this.authService.getUserId();
    if (!userId) throw new Error('No autenticado');

    const fusionado: Empresa = {
      ...this.actual(),
      ...datos,
      prefijoCodificacion: (datos.prefijoCodificacion ?? this.actual().prefijoCodificacion)
        .trim().toUpperCase()
    };

    const invalido = validarEmpresa(fusionado);
    if (invalido) throw new Error(invalido);

    const limpio: Empresa = {
      razonSocial: fusionado.razonSocial.trim(),
      ruc: fusionado.ruc.trim(),
      sector: fusionado.sector,
      areaArchivo: fusionado.areaArchivo,
      responsableArchivo: fusionado.responsableArchivo.trim(),
      prefijoCodificacion: fusionado.prefijoCodificacion,
      diasAlertaPorDefecto: Math.round(fusionado.diasAlertaPorDefecto),
      actualizadoEl: new Date().toISOString()
    };

    await this.firebase.saveUserProfile(userId, {
      ...limpio,
      // Se conserva el nombre antiguo del campo para no romper los perfiles
      // que ya lo tenían escrito.
      areaArchivo: limpio.areaArchivo,
      onboardingCompleted: true,
      onboardingVersion: 3,
      updatedAt: limpio.actualizadoEl
    });

    this._empresa.set(limpio);
    return limpio;
  }

  // ------------------------------------------
  // CATALOGOS
  // ------------------------------------------

  getSectores() {
    return (Object.keys(SECTORES) as SectorEmpresa[]).map(s => ({ value: s, ...SECTORES[s] }));
  }

  getAreas() {
    return (Object.keys(AREAS_EMISORAS) as AreaEmisora[])
      .map(a => ({ value: a, ...AREAS_EMISORAS[a] }));
  }

  sugerirPrefijo(area: AreaEmisora): string {
    return sugerirPrefijo(area);
  }

  // ------------------------------------------
  // INTERNO
  // ------------------------------------------

  /** Traduce el documento de perfil, que mezcla campos de varias versiones. */
  private desdePerfil(p: any): Empresa {
    if (!p) return { ...EMPRESA_POR_DEFECTO };

    const area = this.normalizarArea(p.areaArchivo);

    return {
      razonSocial: p.razonSocial ?? '',
      ruc: p.ruc ?? '',
      sector: (p.sector ?? 'otro') as SectorEmpresa,
      areaArchivo: area,
      responsableArchivo: p.responsableArchivo ?? p.fullName ?? '',
      prefijoCodificacion: (p.prefijoCodificacion ?? '').toUpperCase(),
      diasAlertaPorDefecto: p.diasAlertaPorDefecto ?? EMPRESA_POR_DEFECTO.diasAlertaPorDefecto,
      actualizadoEl: p.updatedAt
    };
  }

  /**
   * El asistente antiguo guardaba el área como texto libre —«Administracion»—
   * en vez de como clave del catálogo.
   */
  private normalizarArea(valor: unknown): AreaEmisora {
    if (typeof valor !== 'string' || !valor) return EMPRESA_POR_DEFECTO.areaArchivo;
    if (valor in AREAS_EMISORAS) return valor as AreaEmisora;

    const buscado = valor.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const encontrada = (Object.keys(AREAS_EMISORAS) as AreaEmisora[]).find(a => {
      const label = AREAS_EMISORAS[a].label
        .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      return label === buscado || a === buscado;
    });

    return encontrada ?? EMPRESA_POR_DEFECTO.areaArchivo;
  }
}
