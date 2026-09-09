import {
  Rgb, aRgb, aHex, esColorValido, contraste,
  asegurarContraste, mezclar, textoSobre, conAlfa
} from '../utils/color';

// Se reexporta para que las pantallas tengan una sola puerta de entrada a
// todo lo de marca, en vez de importar la mitad de un sitio y la mitad de otro.
export { esColorValido } from '../utils/color';

/**
 * La identidad visual de una empresa.
 *
 * Vive en `empresas/{eid}/marca/actual` y no dentro de la ficha de la
 * empresa, por una razón de coste concreta: la ficha se lee entera al
 * arrancar cada sesión de cada persona, y un logo en base64 la convierte
 * en un documento de trescientos kilobytes en el camino crítico. Separada,
 * la ficha vuelve a pesar dos kilobytes y la marca se carga en paralelo.
 */
export interface MarcaEmpresa {
  /** Color principal. Se guarda tal cual lo eligieron; se deriva por tema. */
  colorPrimario?: string;
  /** Color secundario, para acentos y realces. */
  colorSecundario?: string;
  /** Logo como data URL. Tope en MAX_LOGO_BYTES. */
  logo?: string;

  actualizadaEl?: string;
  actualizadaPor?: string;
}

/** Nada configurado: la plataforma se ve con su propia identidad. */
export const MARCA_VACIA: MarcaEmpresa = {};

/** ¿Hay algo que aplicar? */
export function tieneMarca(m: MarcaEmpresa | null | undefined): boolean {
  return !!(m && (m.colorPrimario || m.colorSecundario || m.logo));
}

// ============================================
// LOS DOS TEMAS
// ============================================

/**
 * Fondo y tinta de cada tema, copiados del sistema de diseño.
 *
 * Se duplican aquí a propósito, y es una duplicación que hay que vigilar:
 * el cálculo de contraste necesita estos valores en JavaScript, y las
 * variables CSS no se pueden leer con fiabilidad antes de que el documento
 * pinte. Hay una prueba que comprueba que sigan coincidiendo con el SCSS.
 */
export const FONDOS = {
  claro:  { fondo: '#F4F2ED', tinta: '#1A2426' },
  oscuro: { fondo: '#10171A', tinta: '#E8EDEF' }
} as const;

export type NombreTema = keyof typeof FONDOS;

/**
 * Dos mínimos, porque los dos colores se usan de forma distinta.
 *
 * El primario acaba siendo texto: enlaces, botones planos, cifras
 * destacadas. WCAG 2.1 pide 4.5:1 para texto normal, y el primario del
 * propio sistema da 8.71 sobre fondo claro.
 *
 * El secundario es acento: una barra, un icono, un realce. Ahí la norma
 * pide 3:1 (1.4.11, elementos no textuales), y el acento del sistema da
 * 2.94 —justo en esa banda—. Exigirle 4.5 al secundario de una empresa lo
 * oscurecería bastante más de lo que la plataforma se exige a sí misma, y
 * la marca del cliente saldría apagada al lado de la nuestra.
 */
export const CONTRASTE_TEXTO = 4.5;
export const CONTRASTE_GRAFICO = 3;

/** Retrocompatibilidad de nombre: el mínimo del primario. */
export const CONTRASTE_MINIMO = CONTRASTE_TEXTO;

/** Los tokens que la marca reemplaza, ya resueltos para un tema. */
export interface TokensDeMarca {
  primary: string;
  primaryLight: string;
  primaryDark: string;
  sobrePrimario: string;
  accent: string;
  border: string;
  borderHover: string;
}

/**
 * Deriva la paleta de un tema a partir del color que eligió la empresa.
 *
 * Tres cosas pasan aquí, y las tres son necesarias:
 *
 *   1. El primario se corrige hasta que se lea sobre ESE fondo. Un azul
 *      marino sobre fondo oscuro se aclara; un amarillo sobre fondo claro
 *      se oscurece. El tono se conserva: sigue siendo su marca.
 *   2. Las variantes clara y oscura se separan del primario ya corregido,
 *      no del original, o quedarían descolgadas de él.
 *   3. El color que va ENCIMA del primario se decide por contraste, no por
 *      convención. Con una marca clara, el blanco encima es ilegible.
 */
export function derivarTokens(
  colorPrimario: string,
  colorSecundario: string | undefined,
  tema: NombreTema
): TokensDeMarca | null {
  const base = aRgb(colorPrimario);
  if (!base) return null;

  const fondo = aRgb(FONDOS[tema].fondo)!;
  const tinta = aRgb(FONDOS[tema].tinta)!;

  const primary = asegurarContraste(base, fondo, tinta, CONTRASTE_TEXTO);

  // «Claro» y «oscuro» son relativos al tema, no absolutos: en tema oscuro
  // la variante clara se acerca a la tinta, que es lo claro allí.
  const haciaClaro = tema === 'claro' ? { r: 255, g: 255, b: 255 } : tinta;
  const haciaOscuro = tema === 'claro' ? { r: 0, g: 0, b: 0 } : fondo;

  const accentBase = colorSecundario ? aRgb(colorSecundario) : null;
  const accent = accentBase
    ? asegurarContraste(accentBase, fondo, tinta, CONTRASTE_GRAFICO)
    : primary;

  return {
    primary:       aHex(primary),
    primaryLight:  aHex(mezclar(primary, haciaClaro, 0.28)),
    primaryDark:   aHex(mezclar(primary, haciaOscuro, 0.34)),
    sobrePrimario: aHex(textoSobre(primary)),
    accent:        aHex(accent),
    // Los bordes del sistema son el primario a baja opacidad. Con otra
    // marca, dejarlos en el azul original los haría desentonar de todo.
    border:        conAlfa(primary, tema === 'claro' ? 0.16 : 0.14),
    borderHover:   conAlfa(primary, tema === 'claro' ? 0.42 : 0.30)
  };
}

// ============================================
// LA HOJA DE ESTILO
// ============================================

/**
 * El CSS que aplica la marca.
 *
 * Se genera una hoja completa en vez de escribir propiedades en línea
 * sobre el elemento raíz, y no es un detalle de estilo: un estilo en línea
 * gana a `:root` **y** a `:root[data-theme="dark"]`, así que fijaría un
 * único color para los dos temas y rompería el interruptor.
 *
 * Replicando la estructura de tres bloques del sistema de diseño, la
 * cascada resuelve el cambio de tema sola y no hay nada que recalcular al
 * alternar.
 */
export function hojaDeMarca(marca: MarcaEmpresa): string {
  if (!marca.colorPrimario || !esColorValido(marca.colorPrimario)) return '';

  const claro  = derivarTokens(marca.colorPrimario, marca.colorSecundario, 'claro');
  const oscuro = derivarTokens(marca.colorPrimario, marca.colorSecundario, 'oscuro');
  if (!claro || !oscuro) return '';

  const decl = (t: TokensDeMarca) => [
    `--color-primary: ${t.primary};`,
    `--color-primary-light: ${t.primaryLight};`,
    `--color-primary-dark: ${t.primaryDark};`,
    `--color-sobre-primario: ${t.sobrePrimario};`,
    `--color-accent: ${t.accent};`,
    `--color-border: ${t.border};`,
    `--color-border-hover: ${t.borderHover};`
  ].join(' ');

  return [
    `:root { ${decl(claro)} }`,
    `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ${decl(oscuro)} } }`,
    `:root[data-theme="dark"] { ${decl(oscuro)} }`
  ].join('\n');
}

// ============================================
// VALIDACION
// ============================================

/** Qué le falta o le sobra a una marca antes de guardarla. */
export function validarMarca(m: MarcaEmpresa): string | null {
  if (m.colorPrimario && !esColorValido(m.colorPrimario)) {
    return 'El color principal no es un color válido. Usa un valor como #1F4959.';
  }
  if (m.colorSecundario && !esColorValido(m.colorSecundario)) {
    return 'El color secundario no es un color válido. Usa un valor como #C97B3C.';
  }
  if (m.colorSecundario && !m.colorPrimario) {
    return 'Elige primero el color principal: el secundario se usa para acentuarlo.';
  }
  return null;
}

/**
 * Cuánto se ha tenido que corregir el color para que se lea.
 *
 * Se enseña en la pantalla de configuración: si la marca de alguien se
 * desplaza mucho, es mejor que lo sepa al elegirla que descubrirlo al
 * verla puesta.
 */
export function ajusteAplicado(colorPrimario: string, tema: NombreTema): number {
  const base = aRgb(colorPrimario);
  if (!base) return 0;

  const fondo = aRgb(FONDOS[tema].fondo)!;
  const tokens = derivarTokens(colorPrimario, undefined, tema);
  if (!tokens) return 0;

  const resultado = aRgb(tokens.primary)!;
  const distancia = Math.abs(base.r - resultado.r)
                  + Math.abs(base.g - resultado.g)
                  + Math.abs(base.b - resultado.b);

  return Math.round((distancia / 765) * 100);
}

/** ¿Se lee el color tal cual, sin corregir, sobre este tema? */
export function seLeeTalCual(colorPrimario: string, tema: NombreTema): boolean {
  const base = aRgb(colorPrimario);
  if (!base) return false;
  return contraste(base, aRgb(FONDOS[tema].fondo)!) >= CONTRASTE_MINIMO;
}
