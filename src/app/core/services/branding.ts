import { Injectable, inject, signal, computed } from '@angular/core';

import { FirebaseService } from './firebase';
import { TenantService } from './tenant';
import { AuditService } from './audit';
import { log } from '../utils/logger';

import {
  MarcaEmpresa, MARCA_VACIA,
  hojaDeMarca, validarMarca, tieneMarca
} from '../models/brand.model';

import { MAX_LOGO_BYTES } from '../models/company.model';

/** Identificador del elemento que lleva la marca. Uno solo, y se reemplaza. */
const ID_HOJA = 'marca-empresa';

/**
 * La identidad visual de la empresa que está usando la plataforma.
 *
 * Aplica la marca inyectando una hoja de estilo, no escribiendo
 * propiedades sobre el elemento raíz. La diferencia no es de gusto: un
 * estilo en línea gana a `:root` **y** a `:root[data-theme="dark"]`, así
 * que fijaría un único color para los dos temas y rompería el interruptor
 * de tema. Con una hoja que replica los tres bloques del sistema, la
 * cascada resuelve el cambio sola y aquí no hay nada que recalcular.
 *
 * Por eso este servicio no conoce a ThemeService ni depende de él: no
 * hace falta, y esa independencia es lo que impide que se desincronicen.
 */
@Injectable({ providedIn: 'root' })
export class BrandingService {
  private firebase = inject(FirebaseService);
  private tenant = inject(TenantService);
  private audit = inject(AuditService);

  private readonly _marca = signal<MarcaEmpresa>(MARCA_VACIA);
  private cargaEnCurso: Promise<MarcaEmpresa> | null = null;

  readonly marca = this._marca.asReadonly();
  readonly logo = computed(() => this._marca().logo ?? null);
  readonly personalizada = computed(() => tieneMarca(this._marca()));

  // ------------------------------------------
  // CARGA
  // ------------------------------------------

  /**
   * Trae la marca y la aplica.
   *
   * No lanza nunca: una marca que no se puede leer deja la plataforma con
   * su propia identidad, que es fea pero funciona. Impedir el arranque
   * por no poder pintar un logo sería una pésima manera de fallar.
   */
  async cargar(forzar = false): Promise<MarcaEmpresa> {
    if (!forzar && this.cargaEnCurso) return this.cargaEnCurso;

    const empresaId = this.tenant.empresaOpcional();
    if (!empresaId) return MARCA_VACIA;

    this.cargaEnCurso = (async () => {
      try {
        const datos = await this.firebase.getMarca(empresaId);
        const marca = (datos ?? MARCA_VACIA) as MarcaEmpresa;

        this._marca.set(marca);
        this.aplicar(marca);
        return marca;
      } catch (e) {
        log.warn('[Marca] no se pudo leer la marca de la empresa:', e);
        return MARCA_VACIA;
      } finally {
        this.cargaEnCurso = null;
      }
    })();

    return this.cargaEnCurso;
  }

  // ------------------------------------------
  // APLICACION
  // ------------------------------------------

  /** Pinta la marca. Con una marca vacía, retira lo que hubiera. */
  aplicar(marca: MarcaEmpresa): void {
    if (typeof document === 'undefined') return;

    const css = hojaDeMarca(marca);
    const previo = document.getElementById(ID_HOJA);

    if (!css) { previo?.remove(); return; }

    const hoja = previo ?? document.createElement('style');
    hoja.id = ID_HOJA;
    hoja.textContent = css;

    // Al final del head: después del sistema de diseño, para ganarle sin
    // necesidad de subir especificidad ni recurrir a !important.
    if (!previo) document.head.appendChild(hoja);
  }

  /**
   * Retira la marca y vuelve a la identidad de la plataforma.
   *
   * Se llama al cerrar sesión: en un equipo compartido, la siguiente
   * persona no debería ver los colores de la empresa anterior mientras
   * teclea su correo.
   */
  limpiar(): void {
    this._marca.set(MARCA_VACIA);
    if (typeof document !== 'undefined') {
      document.getElementById(ID_HOJA)?.remove();
    }
  }

  /**
   * Aplica una marca sin guardarla, para previsualizar.
   *
   * La pantalla de configuración la usa mientras se elige el color: ver el
   * cambio en la aplicación real, y no en un recuadro de muestra, es la
   * única forma de saber si la marca funciona sobre esta interfaz.
   */
  previsualizar(marca: MarcaEmpresa): void {
    this.aplicar(marca);
  }

  /** Deshace una previsualización y devuelve lo que está guardado. */
  cancelarPrevisualizacion(): void {
    this.aplicar(this._marca());
  }

  // ------------------------------------------
  // ESCRITURA
  // ------------------------------------------

  async guardar(cambios: Partial<MarcaEmpresa>): Promise<MarcaEmpresa> {
    const empresaId = this.tenant.exigirEmpresa();
    const propuesta: MarcaEmpresa = { ...this._marca(), ...cambios };

    const invalida = validarMarca(propuesta);
    if (invalida) throw new Error(invalida);

    const actor = this.tenant.miembro();
    const marca: MarcaEmpresa = {
      ...propuesta,
      actualizadaEl: new Date().toISOString(),
      actualizadaPor: actor?.nombre || actor?.email || ''
    };

    await this.firebase.guardarMarca(empresaId, marca);

    this._marca.set(marca);
    this.aplicar(marca);

    await this.audit.registrarSobre(
      'edito', 'empresa', empresaId, 'Identidad visual',
      this.describirCambio(cambios)
    );

    return marca;
  }

  /**
   * Guarda el logo.
   *
   * Se valida el peso antes de leer el archivo: convertir a base64 un
   * archivo de diez megas para descubrir después que no cabe es gastar
   * memoria del navegador para nada.
   */
  async guardarLogo(archivo: File): Promise<void> {
    if (!archivo.type.startsWith('image/')) {
      throw new Error('El logo tiene que ser una imagen.');
    }
    if (archivo.size > MAX_LOGO_BYTES) {
      throw new Error(
        `El logo pesa ${Math.round(archivo.size / 1024)} KB y el máximo son ` +
        `${Math.round(MAX_LOGO_BYTES / 1024)} KB. Prueba con un PNG o un SVG optimizado.`
      );
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
  // INTERNO
  // ------------------------------------------

  /** Qué se tocó, para que la auditoría diga algo más que «editó». */
  private describirCambio(cambios: Partial<MarcaEmpresa>): string {
    const partes: string[] = [];
    if ('logo' in cambios) partes.push(cambios.logo ? 'logo actualizado' : 'logo retirado');
    if (cambios.colorPrimario) partes.push('color principal ' + cambios.colorPrimario);
    if (cambios.colorSecundario) partes.push('color secundario ' + cambios.colorSecundario);
    return partes.length ? partes.join(', ') : 'sin cambios visibles';
  }
}
