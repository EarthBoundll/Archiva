// ============================================
// EMPRESA ARCHIVANTE — ARCHIVA
// ============================================
// Quién custodia el acervo, a nombre de qué organización y con qué prefijo
// se codifican sus series.
//
// Estos datos los recogía el asistente inicial y no los leía nadie: el
// prefijo que el propio asistente prometía usar en el código —«CON-ADM-0001»—
// no llegaba al generador, y la pantalla de Configuración no mostraba ni
// permitía editar ninguno de ellos.

import { AreaEmisora, AREAS_EMISORAS } from './document.model';

export type SectorEmpresa =
  | 'construccion'
  | 'comercio'
  | 'servicios'
  | 'manufactura'
  | 'salud'
  | 'educacion'
  | 'publico'
  | 'otro';

export const SECTORES: Record<SectorEmpresa, { label: string; descripcion: string }> = {
  construccion: { label: 'Construcción',   descripcion: 'Obras, expedientes técnicos y valorizaciones' },
  comercio:     { label: 'Comercio',       descripcion: 'Compraventa, facturación y contratos con proveedores' },
  servicios:    { label: 'Servicios',      descripcion: 'Consultoría, asesoría y prestación profesional' },
  manufactura:  { label: 'Manufactura',    descripcion: 'Producción, calidad y procedimientos operativos' },
  salud:        { label: 'Salud',          descripcion: 'Historias, protocolos y normativa sanitaria' },
  educacion:    { label: 'Educación',      descripcion: 'Resoluciones académicas, convenios y actas' },
  publico:      { label: 'Sector público', descripcion: 'Oficios, resoluciones y expedientes administrativos' },
  otro:         { label: 'Otro',           descripcion: 'Cualquier otra actividad' }
};

/** Perfil archivístico de la organización. */
export interface Empresa {
  /** Nombre con el que figura en cabeceras y reportes. */
  razonSocial: string;

  /** Registro Único de Contribuyentes: once dígitos. */
  ruc: string;

  sector: SectorEmpresa;

  /** Área que custodia el acervo. */
  areaArchivo: AreaEmisora;

  /** Persona que responde del archivo ante una auditoría. */
  responsableArchivo: string;

  /**
   * Tres a cinco letras que identifican al archivo dentro del código.
   * Un documento queda como CON-ADM-0001: categoría, prefijo y correlativo.
   */
  prefijoCodificacion: string;

  /** Días de aviso previo al vencimiento, cuando el documento no fija otro. */
  diasAlertaPorDefecto: number;

  actualizadoEl?: string;
}

/** Lo que se guarda cuando aún no se ha configurado nada. */
export const EMPRESA_POR_DEFECTO: Empresa = {
  razonSocial: '',
  ruc: '',
  sector: 'otro',
  areaArchivo: 'administracion',
  responsableArchivo: '',
  prefijoCodificacion: '',
  diasAlertaPorDefecto: 30
};

// ============================================
// VALIDACION
// ============================================

/** Un prefijo válido son tres a cinco letras, sin números ni espacios. */
export function esPrefijoValido(prefijo: string): boolean {
  return /^[A-ZÑ]{3,5}$/.test(prefijo.trim().toUpperCase());
}

/**
 * El RUC peruano tiene once dígitos y empieza por 10, 15, 17 o 20.
 * Se admite vacío: no toda organización lo tiene al empezar.
 */
export function esRucValido(ruc: string): boolean {
  const limpio = ruc.trim();
  if (!limpio) return true;
  return /^(10|15|17|20)\d{9}$/.test(limpio);
}

/**
 * Primer motivo por el que la configuración no puede guardarse, o null si
 * está completa. Vive en el modelo para que la pantalla y el servicio
 * apliquen exactamente las mismas reglas.
 */
export function validarEmpresa(e: Partial<Empresa>): string | null {
  if (!e.razonSocial?.trim()) {
    return 'La razón social es el nombre con el que la empresa figura en los reportes.';
  }
  if (e.razonSocial.trim().length < 3) {
    return 'La razón social necesita al menos tres caracteres.';
  }
  if (!esRucValido(e.ruc ?? '')) {
    return 'El RUC tiene once dígitos y empieza por 10, 15, 17 o 20.';
  }
  if (!e.responsableArchivo?.trim()) {
    return 'Indica quién responde del archivo: queda registrado en cada documento.';
  }
  if (!e.prefijoCodificacion || !esPrefijoValido(e.prefijoCodificacion)) {
    return 'El prefijo debe tener entre tres y cinco letras, sin números ni espacios.';
  }
  if (e.diasAlertaPorDefecto == null || e.diasAlertaPorDefecto < 1 || e.diasAlertaPorDefecto > 365) {
    return 'El aviso previo va de 1 a 365 días.';
  }
  return null;
}

/**
 * Deriva un prefijo razonable del área que custodia el archivo.
 * «Administración» da ADM, «Recursos Humanos» da RRH.
 */
export function sugerirPrefijo(area: AreaEmisora | string): string {
  const siglas = AREAS_EMISORAS[area as AreaEmisora]?.siglas;
  if (siglas && esPrefijoValido(siglas)) return siglas.toUpperCase();

  const limpio = String(area)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().trim();

  if (!limpio) return '';

  const palabras = limpio.split(/\s+/).filter(p => p.length > 2);
  if (palabras.length > 1) return palabras.slice(0, 3).map(p => p[0]).join('');
  return (palabras[0] ?? limpio).replace(/[^A-Z]/g, '').slice(0, 3);
}

/** ¿Hay lo mínimo para operar? */
export function estaConfigurada(e: Empresa | null): boolean {
  return !!e && !!e.razonSocial.trim() && esPrefijoValido(e.prefijoCodificacion);
}
