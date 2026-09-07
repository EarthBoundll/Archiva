// ============================================
// EMPRESA ARCHIVANTE — ARCHIVA
// ============================================
// La empresa es ahora la raiz de todo: documentos, flujos, solicitudes,
// bitacora y personas cuelgan de ella. Antes el acervo colgaba del usuario
// y cada cuenta era una isla.

import { AreaEmisora, AREAS_EMISORAS } from './document.model';

export type SectorEmpresa =
  | 'construccion' | 'comercio' | 'servicios' | 'manufactura'
  | 'salud' | 'educacion' | 'publico' | 'otro';

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

export type EstadoEmpresa = 'activa' | 'suspendida' | 'baja';

export const ESTADOS_EMPRESA: Record<EstadoEmpresa, { label: string; token: string }> = {
  activa:     { label: 'Activa',     token: 'var(--estado-aprobado)' },
  suspendida: { label: 'Suspendida', token: 'var(--estado-observado)' },
  baja:       { label: 'De baja',    token: 'var(--estado-archivado)' }
};

export interface Empresa {
  id: string;

  // Identificacion
  razonSocial: string;
  nombreComercial: string;
  ruc: string;
  sector: SectorEmpresa;

  // Contacto
  direccion: string;
  telefono: string;
  email: string;

  /** Data URL del logo. Se limita el tamaño al guardarlo. */
  logo?: string;

  // Ciclo de vida
  fechaRegistro: string;
  estado: EstadoEmpresa;

  // Archivistica
  /** Area que custodia el acervo. */
  areaArchivo: AreaEmisora;
  /** Areas activas de la empresa; restringe lo que se puede elegir. */
  areasActivas: AreaEmisora[];
  /** Persona que responde del archivo ante una auditoria. */
  responsableArchivo: string;
  /** Tres a cinco letras dentro del codigo: CON-ADM-0001. */
  prefijoCodificacion: string;
  /** Aviso previo al vencimiento cuando el documento no fija el suyo. */
  diasAlertaPorDefecto: number;

  creadoPor?: string;
  actualizadoEl?: string;
}

export const EMPRESA_POR_DEFECTO: Omit<Empresa, 'id'> = {
  razonSocial: '',
  nombreComercial: '',
  ruc: '',
  sector: 'otro',
  direccion: '',
  telefono: '',
  email: '',
  fechaRegistro: '',
  estado: 'activa',
  areaArchivo: 'administracion',
  areasActivas: ['gerencia', 'administracion', 'legal', 'finanzas',
                 'recursos_humanos', 'operaciones', 'tecnologia', 'otros'],
  responsableArchivo: '',
  prefijoCodificacion: '',
  diasAlertaPorDefecto: 30
};

/** Tope del logo: viaja como data URL dentro del documento de empresa. */
export const MAX_LOGO_BYTES = 120 * 1024;

// ============================================
// VALIDACION
// ============================================

export function esPrefijoValido(prefijo: string): boolean {
  return /^[A-ZÑ]{3,5}$/.test(prefijo.trim().toUpperCase());
}

/** RUC peruano: once digitos que empiezan por 10, 15, 17 o 20. */
export function esRucValido(ruc: string): boolean {
  const limpio = ruc.trim();
  if (!limpio) return true;
  return /^(10|15|17|20)\d{9}$/.test(limpio);
}

export function esEmailValido(email: string): boolean {
  const limpio = email.trim();
  if (!limpio) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(limpio);
}

export function esTelefonoValido(tel: string): boolean {
  const limpio = tel.trim();
  if (!limpio) return true;
  return /^[\d\s()+-]{6,20}$/.test(limpio);
}

/**
 * Primer motivo por el que la empresa no puede guardarse, o null si esta
 * completa. Vive en el modelo para que pantalla y servicio apliquen
 * exactamente la misma regla.
 */
export function validarEmpresa(e: Partial<Empresa>): string | null {
  if (!e.razonSocial?.trim())            return 'La razón social es el nombre legal de la empresa.';
  if (e.razonSocial.trim().length < 3)   return 'La razón social necesita al menos tres caracteres.';
  if (!esRucValido(e.ruc ?? ''))         return 'El RUC tiene once dígitos y empieza por 10, 15, 17 o 20.';
  if (!esEmailValido(e.email ?? ''))     return 'El correo de contacto no tiene un formato válido.';
  if (!esTelefonoValido(e.telefono ?? ''))return 'El teléfono admite dígitos, espacios, paréntesis, + y guiones.';
  if (!e.responsableArchivo?.trim())     return 'Indica quién responde del archivo.';
  if (!e.prefijoCodificacion || !esPrefijoValido(e.prefijoCodificacion))
    return 'El prefijo debe tener entre tres y cinco letras, sin números ni espacios.';
  if (e.diasAlertaPorDefecto == null || e.diasAlertaPorDefecto < 1 || e.diasAlertaPorDefecto > 365)
    return 'El aviso previo va de 1 a 365 días.';
  if (!e.areasActivas?.length)           return 'La empresa necesita al menos un área activa.';
  return null;
}

/** Deriva un prefijo razonable del área que custodia el archivo. */
export function sugerirPrefijo(area: AreaEmisora | string): string {
  const siglas = AREAS_EMISORAS[area as AreaEmisora]?.siglas;
  if (siglas && esPrefijoValido(siglas)) return siglas.toUpperCase();

  const limpio = String(area).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
  if (!limpio) return '';

  const palabras = limpio.split(/\s+/).filter(p => p.length > 2);
  if (palabras.length > 1) return palabras.slice(0, 3).map(p => p[0]).join('');
  return (palabras[0] ?? limpio).replace(/[^A-ZÑ]/g, '').slice(0, 3);
}

export function estaConfigurada(e: Empresa | null): boolean {
  return !!e && !!e.razonSocial.trim() && esPrefijoValido(e.prefijoCodificacion);
}

/** Nombre para mostrar: el comercial si existe, si no el legal. */
export function nombreVisible(e: Empresa | null): string {
  if (!e) return '';
  return e.nombreComercial?.trim() || e.razonSocial.trim();
}
