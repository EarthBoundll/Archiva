/**
 * Aritmética de color para la marca de cada empresa.
 *
 * El problema que resuelve: una empresa elige UN color, y ese color tiene
 * que funcionar sobre los dos fondos del sistema. Un azul marino corporativo
 * se lee perfectamente sobre el fondo claro y desaparece sobre el oscuro;
 * un amarillo de marca hace exactamente lo contrario.
 *
 * Dejar eso al criterio de quien configura no es una opción: la mitad de
 * las marcas del mundo son ilegibles sobre alguno de los dos fondos, y el
 * resultado sería que un cliente puede volver su propia instalación
 * imposible de usar sin darse cuenta —porque él la configuró en el tema
 * que usa, y el problema lo sufre quien usa el otro.
 *
 * Así que se guarda el color tal cual lo eligió, y aquí se deriva por
 * tema: se mide el contraste real contra ese fondo y, si no llega, se
 * desplaza hacia la tinta o hacia el fondo **conservando el tono**, hasta
 * que pase. La marca sigue siendo reconocible; solo cambia su claridad.
 */

/** Color en componentes 0-255. */
export interface Rgb { r: number; g: number; b: number; }

// ============================================
// CONVERSIÓN
// ============================================

/** Acepta `#RGB`, `#RRGGBB` y las mismas sin almohadilla. */
export function aRgb(hex: string): Rgb | null {
  const limpio = hex.trim().replace(/^#/, '');

  const expandido = limpio.length === 3
    ? limpio.split('').map(c => c + c).join('')
    : limpio;

  if (!/^[0-9a-fA-F]{6}$/.test(expandido)) return null;

  return {
    r: parseInt(expandido.slice(0, 2), 16),
    g: parseInt(expandido.slice(2, 4), 16),
    b: parseInt(expandido.slice(4, 6), 16)
  };
}

export function aHex({ r, g, b }: Rgb): string {
  const dos = (n: number) => Math.round(Math.min(255, Math.max(0, n)))
    .toString(16).padStart(2, '0');
  return '#' + dos(r) + dos(g) + dos(b);
}

/** ¿Es una cadena que sirve como color de marca? */
export function esColorValido(hex: string): boolean {
  return aRgb(hex) !== null;
}

// ============================================
// CONTRASTE
// ============================================

/**
 * Luminancia relativa según WCAG 2.1.
 *
 * No es el brillo aparente: es la fórmula que la norma fija para decidir
 * si dos colores se distinguen. Se implementa tal cual porque redondearla
 * cambia el veredicto justo en los casos límite, que son los únicos en
 * los que esto importa.
 */
export function luminancia({ r, g, b }: Rgb): number {
  const canal = (v: number) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

/** Razón de contraste entre dos colores. De 1 (idénticos) a 21. */
export function contraste(a: Rgb, b: Rgb): number {
  const la = luminancia(a);
  const lb = luminancia(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Mezcla lineal: 0 devuelve `a`, 1 devuelve `b`. */
export function mezclar(a: Rgb, b: Rgb, proporcion: number): Rgb {
  const p = Math.min(1, Math.max(0, proporcion));
  return {
    r: a.r + (b.r - a.r) * p,
    g: a.g + (b.g - a.g) * p,
    b: a.b + (b.b - a.b) * p
  };
}

// ============================================
// DERIVACIÓN
// ============================================

/**
 * Acerca un color hasta que contraste lo suficiente con el fondo.
 *
 * Busca la mezcla más pequeña que cumple, no la primera que encuentra a
 * saltos gruesos: se avanza de dos en dos centésimas y se para en cuanto
 * pasa. Así la marca se altera lo mínimo imprescindible — un azul que ya
 * casi llegaba sale casi idéntico, y solo los casos imposibles se
 * desplazan de verdad.
 *
 * Si ni el extremo cumple —un gris medio sobre un fondo gris medio—, se
 * devuelve el extremo: es lo más legible que existe en esa dirección.
 *
 * @param color   el que eligió la empresa
 * @param fondo   sobre el que se va a pintar
 * @param hacia   tinta o fondo del tema; la dirección en la que se corrige
 * @param minimo  razón de contraste exigida
 */
export function asegurarContraste(
  color: Rgb,
  fondo: Rgb,
  hacia: Rgb,
  minimo: number
): Rgb {
  if (contraste(color, fondo) >= minimo) return color;

  for (let p = 0.02; p <= 1; p += 0.02) {
    const intento = mezclar(color, hacia, p);
    if (contraste(intento, fondo) >= minimo) return intento;
  }
  return hacia;
}

/**
 * El color de texto que va encima de un fondo dado.
 *
 * Blanco o tinta, el que más contraste dé. Es lo que el sistema de diseño
 * ya resolvía a mano con `--color-sobre-primario`: en tema claro el
 * primario es oscuro y encima va blanco; en oscuro es claro y encima va
 * tinta. Con un color de marca arbitrario eso hay que decidirlo cada vez.
 */
export function textoSobre(fondo: Rgb): Rgb {
  const blanco: Rgb = { r: 255, g: 255, b: 255 };
  const tinta:  Rgb = { r: 16, g: 23, b: 26 };
  return contraste(blanco, fondo) >= contraste(tinta, fondo) ? blanco : tinta;
}

/** Una versión translúcida, para bordes y fondos sutiles. */
export function conAlfa({ r, g, b }: Rgb, alfa: number): string {
  const e = (n: number) => Math.round(n);
  return `rgba(${e(r)}, ${e(g)}, ${e(b)}, ${alfa})`;
}
