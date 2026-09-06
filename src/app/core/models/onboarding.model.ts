// ============================================
// CONFIGURACION INICIAL DE LA EMPRESA — ARCHIVA
// ============================================
// Lo que ARCHIVA necesita saber antes de dar de alta el primer documento:
// quien responde del archivo, a nombre de que empresa y con que prefijo se
// codifican las series.
//
// Sustituye al cuestionario financiero del producto anterior, que preguntaba
// por salario neto, aportes a AFP, seguro de salud, prestamos, inversiones y
// prioridad financiera. Nada de eso describe un archivo documental, y ademas
// creaba fuentes de ingreso automaticas al terminar el asistente.

/** Sectores en los que puede operar la empresa archivante. */
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
  construccion: { label: 'Construcción',        descripcion: 'Obras, expedientes técnicos y valorizaciones' },
  comercio:     { label: 'Comercio',            descripcion: 'Compraventa, facturación y contratos con proveedores' },
  servicios:    { label: 'Servicios',           descripcion: 'Consultoría, asesoría y prestación profesional' },
  manufactura:  { label: 'Manufactura',         descripcion: 'Producción, calidad y procedimientos operativos' },
  salud:        { label: 'Salud',               descripcion: 'Historias, protocolos y normativa sanitaria' },
  educacion:    { label: 'Educación',           descripcion: 'Resoluciones académicas, convenios y actas' },
  publico:      { label: 'Sector público',      descripcion: 'Oficios, resoluciones y expedientes administrativos' },
  otro:         { label: 'Otro',                descripcion: 'Cualquier otra actividad' }
};

/**
 * Perfil archivistico de la organizacion, tal como queda guardado en el
 * documento de perfil del usuario.
 */
export interface PerfilArchivo {
  /** Persona que responde del archivo ante una auditoria. */
  responsableArchivo: string;

  /** Nombre con el que la empresa figura en cabeceras y reportes. */
  razonSocial: string;

  /** Area que custodia el acervo; da nombre a la codificacion. */
  areaArchivo: string;

  /**
   * Tres a cinco letras que identifican al area dentro del codigo.
   * Un documento queda como CON-ADM-0001: categoria, area y correlativo.
   */
  prefijoCodificacion: string;

  sector?: SectorEmpresa;

  onboardingCompleted: boolean;
  onboardingVersion: number;
  onboardingCompletedAt: string;
  updatedAt: string;
}

/** Lo que el asistente recoge; el resto lo completa el servicio. */
export interface ConfiguracionEmpresa {
  responsable: string;
  razonSocial: string;
  areaArchivo: string;
  prefijoCodificacion: string;
  sector?: SectorEmpresa;
}

/**
 * Deriva un prefijo razonable del nombre del area. "Administracion" da ADM,
 * "Recursos Humanos" da RRH. El usuario siempre puede corregirlo.
 */
export function sugerirPrefijo(area: string): string {
  const limpio = area
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .trim();

  if (!limpio) return '';

  const palabras = limpio.split(/\s+/).filter(p => p.length > 2);

  // Varias palabras: una inicial de cada una, hasta tres.
  if (palabras.length > 1) {
    return palabras.slice(0, 3).map(p => p[0]).join('');
  }

  return (palabras[0] ?? limpio).slice(0, 3);
}

/** Un prefijo valido son tres a cinco letras, sin numeros ni espacios. */
export function esPrefijoValido(prefijo: string): boolean {
  return /^[A-Z]{3,5}$/.test(prefijo.trim().toUpperCase());
}
