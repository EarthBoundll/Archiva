import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Contraste de la paleta contra WCAG 2.1.
 *
 * La migracion de Tracky cambio el tema de oscuro a claro reescribiendo los
 * tokens, pero varias reglas conservaban colores pensados para fondo oscuro y
 * el tablero quedo ilegible. Estas pruebas miden las ratios reales para que
 * nadie pueda introducir un color sin contraste sin que el CI lo detenga.
 */

const css = readFileSync(
  join(process.cwd(), 'src/styles/_design-system.scss'),
  'utf8'
);

/**
 * Los tokens se extraen por bloque, no de todo el archivo.
 *
 * Un unico barrido mezclaria la paleta clara con la oscura y, al ganar la
 * ultima definicion, las pruebas acabarian midiendo siempre el tema oscuro
 * sin que nadie lo notase.
 */
function extraer(bloque: string): Record<string, string> {
  const t: Record<string, string> = {};
  for (const m of bloque.matchAll(/--([a-z-]+):\s*(#[0-9A-Fa-f]{6})\s*;/g)) {
    t[m[1]] = m[2];
  }
  return t;
}

const corteOscuro = css.indexOf('@mixin tokens-oscuros');

/** Paleta clara: todo lo anterior al mixin del tema oscuro. */
const tokens = extraer(corteOscuro > 0 ? css.slice(0, corteOscuro) : css);

/** Paleta oscura: el interior del mixin. */
const tokensOscuros = corteOscuro > 0
  ? extraer(css.slice(corteOscuro, css.indexOf('}', css.indexOf('--estado-vencido', corteOscuro))))
  : {};

/** Canal sRGB a lineal, segun la formula de WCAG. */
function lineal(canal: number): number {
  const v = canal / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function luminancia(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * lineal(r) + 0.7152 * lineal(g) + 0.0722 * lineal(b);
}

function ratio(a: string, b: string): number {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (oscuro + 0.05);
}

const OBLIGATORIOS = [
  'color-text', 'color-text-secondary', 'color-text-muted',
  'color-surface', 'color-bg', 'color-primary',
  'color-success', 'color-warning', 'color-error', 'color-accent'
];

const ESTADOS = [
  'estado-borrador', 'estado-en-revision', 'estado-pendiente', 'estado-aprobado',
  'estado-observado', 'estado-rechazado', 'estado-archivado', 'estado-vencido'
];

describe('Design system · contraste', () => {

  describe('tema claro', () => {

    it('define todos los tokens que usa la interfaz', () => {
      for (const t of OBLIGATORIOS) {
        expect(tokens[t], 'falta el token --' + t).toBeDefined();
      }
    });

    const pares: [string, string, string, number][] = [
      ['color-text',           'color-surface', 'texto principal sobre tarjeta', 4.5],
      ['color-text-secondary', 'color-surface', 'etiquetas sobre tarjeta',       4.5],
      ['color-text-muted',     'color-surface', 'subtitulos sobre tarjeta',      4.5],
      ['color-text',           'color-bg',      'texto sobre el fondo',          4.5],
      ['color-text-secondary', 'color-bg',      'etiquetas sobre el fondo',      4.5],
      ['color-primary',        'color-surface', 'enlaces y acentos',             4.5],
      ['color-success',        'color-surface', 'estado aprobado',               3.0],
      ['color-warning',        'color-surface', 'estado observado',              3.0],
      ['color-error',          'color-surface', 'estado rechazado',              3.0],
      ['color-accent',         'color-surface', 'acento kraft',                  3.0]
    ];

    for (const [fg, bg, nombre, minimo] of pares) {
      it(nombre, () => {
        const r = ratio(tokens[fg], tokens[bg]);
        expect(r, tokens[fg] + ' sobre ' + tokens[bg] + ' da ' + r.toFixed(2) + ':1')
          .toBeGreaterThanOrEqual(minimo);
      });
    }

    it('los ocho estados documentales se distinguen entre si', () => {
      for (const e of ESTADOS) {
        expect(tokens[e], 'falta el token --' + e).toBeDefined();
        expect(ratio(tokens[e], tokens['color-surface'])).toBeGreaterThanOrEqual(3);
      }
      // El color es la unica pista para leerlos de un vistazo: no pueden repetirse.
      const valores = ESTADOS.map(e => tokens[e]);
      expect(new Set(valores).size).toBe(valores.length);
    });
  });

  describe('tema oscuro', () => {

    it('redefine la paleta completa', () => {
      for (const t of OBLIGATORIOS) {
        expect(tokensOscuros[t], 'el tema oscuro no redefine --' + t).toBeDefined();
      }
    });

    const paresOscuros: [string, string, string, number][] = [
      ['color-text',           'color-surface', 'texto principal',   4.5],
      ['color-text-secondary', 'color-surface', 'etiquetas',         4.5],
      ['color-text-muted',     'color-surface', 'subtitulos',        4.5],
      ['color-text',           'color-bg',      'texto sobre fondo', 4.5],
      ['color-primary',        'color-surface', 'enlaces',           3.0],
      ['color-success',        'color-surface', 'estado aprobado',   3.0],
      ['color-warning',        'color-surface', 'estado observado',  3.0],
      ['color-error',          'color-surface', 'estado rechazado',  3.0],
      ['color-accent',         'color-surface', 'acento',            3.0]
    ];

    for (const [fg, bg, nombre, minimo] of paresOscuros) {
      it(nombre, () => {
        const r = ratio(tokensOscuros[fg], tokensOscuros[bg]);
        expect(r, tokensOscuros[fg] + ' sobre ' + tokensOscuros[bg] + ' da ' + r.toFixed(2) + ':1')
          .toBeGreaterThanOrEqual(minimo);
      });
    }

    it('los ocho estados tambien se distinguen en oscuro', () => {
      for (const e of ESTADOS) {
        expect(tokensOscuros[e], 'el tema oscuro no redefine --' + e).toBeDefined();
        expect(ratio(tokensOscuros[e], tokensOscuros['color-surface'])).toBeGreaterThanOrEqual(3);
      }
      const valores = ESTADOS.map(e => tokensOscuros[e]);
      expect(new Set(valores).size).toBe(valores.length);
    });
  });
});
