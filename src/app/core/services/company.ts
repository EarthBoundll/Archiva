import { Injectable, computed, inject, signal } from '@angular/core';
import { FirebaseService } from './firebase';
import { TenantService } from './tenant';
import { AuditService } from './audit';
import {
  Empresa,
  EMPRESA_POR_DEFECTO,
  SectorEmpresa,
  SECTORES,
  MAX_LOGO_BYTES,
  validarEmpresa,
  estaConfigurada,
  sugerirPrefijo,
  nombreVisible
} from '../models/company.model';
import { AreaEmisora, AREAS_EMISORAS } from '../models/document.model';
import { Permiso } from '../models/rbac.model';

/**
 * Datos de la empresa a la que pertenece la sesión.
 *
 * Es la única fuente de estos datos para toda la aplicación, y se expone
 * como señal porque el prefijo de codificación se consulta en cada alta de
 * documento: releerlo de Firestore cada vez sería un viaje de red por
 * documento registrado.
 */
@Injectable({ providedIn: 'root' })
export class CompanyService {
  private firebase = inject(FirebaseService);
  private tenant = inject(TenantService);
  private audit = inject(AuditService);

  private readonly _empresa = signal<Empresa | null>(null);
  private cargaEnCurso: Promise<Empresa | null> | null = null;

  readonly empresa = this._empresa.asReadonly();

  readonly configurada = computed(() => estaConfigurada(this._empresa()));
  readonly prefijo     = computed(() => this._empresa()?.prefijoCodificacion ?? '');
  readonly razonSocial = computed(() => this._empresa()?.razonSocial ?? '');
  readonly nombre      = computed(() => nombreVisible(this._empresa()));
  readonly logo        = computed(() => this._empresa()?.logo ?? null);

  readonly diasAlertaPorDefecto = computed(() =>
    this._empresa()?.diasAlertaPorDefecto ?? EMPRESA_POR_DEFECTO.diasAlertaPorDefecto
  );

  /** Áreas que la empresa declara activas; acota los desplegables. */
  readonly areasActivas = computed<AreaEmisora[]>(() =>
    this._empresa()?.areasActivas ?? EMPRESA_POR_DEFECTO.areasActivas
  );

  // ------------------------------------------
  // LECTURA
  // ------------------------------------------

  async cargar(forzar = false): Promise<Empresa | null> {
    if (!forzar && this._empresa()) return this._empresa();
    if (!forzar && this.cargaEnCurso) return this.cargaEnCurso;

    await this.tenant.resolver();
    const empresaId = this.tenant.empresaOpcional();
    if (!empresaId) return null;

    this.cargaEnCurso = (async () => {
      const datos = await this.firebase.getEmpresa(empresaId);
      const empresa = this.normalizar(empresaId, datos);
      this._empresa.set(empresa);
      return empresa;
    })();

    try {
      return await this.cargaEnCurso;
    } finally {
      this.cargaEnCurso = null;
    }
  }

  actual(): Empresa {
    return this._empresa() ?? { id: this.tenant.empresaOpcional() ?? '', ...EMPRESA_POR_DEFECTO };
  }

  // ------------------------------------------
  // ESCRITURA
  // ------------------------------------------

  async guardar(datos: Partial<Empresa>): Promise<Empresa> {
    if (!this.tenant.puede(Permiso.EMPRESA_EDITAR)) {
      throw new Error('Tu rol no permite cambiar los datos de la empresa.');
    }

    const empresaId = this.tenant.exigirEmpresa();
    const anterior = this.actual();

    const fusionado: Empresa = {
      ...anterior,
      ...datos,
      id: empresaId,
      prefijoCodificacion: (datos.prefijoCodificacion ?? anterior.prefijoCodificacion)
        .trim().toUpperCase()
    };

    const invalido = validarEmpresa(fusionado);
    if (invalido) throw new Error(invalido);

    if (fusionado.logo && fusionado.logo.length > MAX_LOGO_BYTES * 1.4) {
      throw new Error('El logo supera el tamaño admitido. Usa una imagen más pequeña.');
    }

    const limpio: Empresa = {
      id: empresaId,
      razonSocial: fusionado.razonSocial.trim(),
      nombreComercial: fusionado.nombreComercial?.trim() ?? '',
      ruc: fusionado.ruc.trim(),
      sector: fusionado.sector,
      direccion: fusionado.direccion?.trim() ?? '',
      telefono: fusionado.telefono?.trim() ?? '',
      email: fusionado.email?.trim() ?? '',
      logo: fusionado.logo,
      fechaRegistro: anterior.fechaRegistro || new Date().toISOString(),
      estado: fusionado.estado ?? 'activa',
      areaArchivo: fusionado.areaArchivo,
      areasActivas: fusionado.areasActivas?.length
        ? fusionado.areasActivas
        : EMPRESA_POR_DEFECTO.areasActivas,
      responsableArchivo: fusionado.responsableArchivo.trim(),
      prefijoCodificacion: fusionado.prefijoCodificacion,
      diasAlertaPorDefecto: Math.round(fusionado.diasAlertaPorDefecto),
      creadoPor: anterior.creadoPor,
      actualizadoEl: new Date().toISOString()
    };

    await this.firebase.guardarEmpresa(empresaId, limpio);
    this._empresa.set(limpio);

    await this.audit.registrar({
      accion: 'edito',
      entidad: 'empresa',
      entidadId: empresaId,
      entidadEtiqueta: limpio.razonSocial,
      detalle: this.describirCambios(anterior, limpio)
    });

    return limpio;
  }

  /** Reemplaza el logo. Se comprueba el tamaño antes de subirlo. */
  async guardarLogo(archivo: File): Promise<void> {
    if (archivo.size > MAX_LOGO_BYTES) {
      throw new Error(
        `El logo pesa ${Math.round(archivo.size / 1024)} KB y el máximo son ` +
        `${Math.round(MAX_LOGO_BYTES / 1024)} KB.`
      );
    }
    if (!archivo.type.startsWith('image/')) {
      throw new Error('El logo tiene que ser una imagen.');
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const lector = new FileReader();
      lector.onload = () => resolve(String(lector.result));
      lector.onerror = () => reject(new Error('No se pudo leer la imagen.'));
      lector.readAsDataURL(archivo);
    });

    await this.guardar({ logo: dataUrl });
  }

  async quitarLogo(): Promise<void> {
    await this.guardar({ logo: '' });
  }

  // ------------------------------------------
  // CATALOGOS
  // ------------------------------------------

  getSectores() {
    return (Object.keys(SECTORES) as SectorEmpresa[]).map(s => ({ value: s, ...SECTORES[s] }));
  }

  /** Todas las áreas del catálogo, para configurar cuáles se activan. */
  getAreas() {
    return (Object.keys(AREAS_EMISORAS) as AreaEmisora[])
      .map(a => ({ value: a, ...AREAS_EMISORAS[a] }));
  }

  /** Solo las que la empresa tiene activas, para los formularios. */
  getAreasActivas() {
    const activas = this.areasActivas();
    return this.getAreas().filter(a => activas.includes(a.value));
  }

  sugerirPrefijo(area: AreaEmisora): string {
    return sugerirPrefijo(area);
  }

  // ------------------------------------------
  // INTERNO
  // ------------------------------------------

  private normalizar(id: string, d: any): Empresa {
    if (!d) return { id, ...EMPRESA_POR_DEFECTO };

    return {
      id,
      razonSocial: d.razonSocial ?? '',
      nombreComercial: d.nombreComercial ?? '',
      ruc: d.ruc ?? '',
      sector: (d.sector ?? 'otro') as SectorEmpresa,
      direccion: d.direccion ?? '',
      telefono: d.telefono ?? '',
      email: d.email ?? '',
      logo: d.logo,
      fechaRegistro: d.fechaRegistro ?? d.createdAt ?? '',
      estado: d.estado ?? 'activa',
      areaArchivo: this.normalizarArea(d.areaArchivo),
      areasActivas: Array.isArray(d.areasActivas) && d.areasActivas.length
        ? d.areasActivas
        : EMPRESA_POR_DEFECTO.areasActivas,
      responsableArchivo: d.responsableArchivo ?? '',
      prefijoCodificacion: (d.prefijoCodificacion ?? '').toUpperCase(),
      diasAlertaPorDefecto: d.diasAlertaPorDefecto ?? EMPRESA_POR_DEFECTO.diasAlertaPorDefecto,
      creadoPor: d.creadoPor,
      actualizadoEl: d.actualizadoEl ?? d.updatedAt
    };
  }

  /** El asistente antiguo guardaba el área como texto libre. */
  private normalizarArea(valor: unknown): AreaEmisora {
    if (typeof valor !== 'string' || !valor) return EMPRESA_POR_DEFECTO.areaArchivo;
    if (valor in AREAS_EMISORAS) return valor as AreaEmisora;

    const buscado = valor.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const encontrada = (Object.keys(AREAS_EMISORAS) as AreaEmisora[]).find(a =>
      AREAS_EMISORAS[a].label.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() === buscado
    );
    return encontrada ?? EMPRESA_POR_DEFECTO.areaArchivo;
  }

  /** Qué cambió, para que el asiento de auditoría diga algo útil. */
  private describirCambios(antes: Empresa, ahora: Empresa): string {
    const campos: Array<[keyof Empresa, string]> = [
      ['razonSocial', 'razón social'], ['nombreComercial', 'nombre comercial'],
      ['ruc', 'RUC'], ['sector', 'sector'], ['direccion', 'dirección'],
      ['telefono', 'teléfono'], ['email', 'correo'],
      ['prefijoCodificacion', 'prefijo'], ['responsableArchivo', 'responsable'],
      ['diasAlertaPorDefecto', 'aviso previo']
    ];

    const cambiados = campos
      .filter(([k]) => String(antes[k] ?? '') !== String(ahora[k] ?? ''))
      .map(([, etiqueta]) => etiqueta);

    if (antes.logo !== ahora.logo) cambiados.push('logo');

    return cambiados.length ? `Cambió ${cambiados.join(', ')}` : 'Sin cambios efectivos';
  }
}
