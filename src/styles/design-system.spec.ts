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

const tokens: Record<string, string> = {};
for (const m of css.matchAll(/--([a-z-]+):\s*(#[0-9A-Fa-f]{6})\s*;/g)) {
  tokens[m[1]] = m[2];
}

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

describe('Design system · contraste', () => {

  it('define todos los tokens de color que usa la interfaz', () => {
    for (const t of [
      'color-text', 'color-text-secondary', 'color-text-muted',
      'color-surface', 'color-bg', 'color-primary',
      'color-success', 'color-warning', 'color-error', 'color-accent'
    ]) {
      expect(tokens[t], `falta el token --${t}`).toBeDefined();
    }
  });

  describe('texto normal · minimo AA 4.5:1', () => {
    const pares: [string, string, string][] = [
      ['color-text',           'color-surface', 'texto principal sobre tarjeta'],
      ['color-text-secondary', 'color-surface', 'etiquetas sobre tarjeta'],
      ['color-text-muted',     'color-surface', 'subtitulos sobre tarjeta'],
      ['color-text',           'color-bg',      'texto sobre el fondo de pagina'],
      ['color-text-secondary', 'color-bg',      'etiquetas sobre el fondo'],
      ['color-primary',        'color-surface', 'enlaces y acentos']
    ];

    for (const [fg, bg, nombre] of pares) {
      it(nombre, () => {
        const r = ratio(tokens[fg], tokens[bg]);
        expect(r, `${tokens[fg]} sobre ${tokens[bg]} da ${r.toFixed(2)}:1`)
          .toBeGreaterThanOrEqual(4.5);
      });
    }
  });

  describe('color semantico de estado · minimo AA 3:1', () => {
    const pares: [string, string, string][] = [
      ['color-success', 'color-surface', 'estado aprobado'],
      ['color-warning', 'color-surface', 'estado observado'],
      ['color-error',   'color-surface', 'estado rechazado'],
      ['color-accent',  'color-surface', 'acento kraft']
    ];

    for (const [fg, bg, nombre] of pares) {
      it(nombre, () => {
        const r = ratio(tokens[fg], tokens[bg]);
        expect(r, `${tokens[fg]} sobre ${tokens[bg]} da ${r.toFixed(2)}:1`)
          .toBeGreaterThanOrEqual(3);
      });
    }
  });

  it('los ocho estados documentales se distinguen entre si', () => {
    const estados = [
      'estado-borrador', 'estado-en-revision', 'estado-pendiente', 'estado-aprobado',
      'estado-observado', 'estado-rechazado', 'estado-archivado', 'estado-vencido'
    ];

    for (const e of estados) {
      expect(tokens[e], `falta el token --${e}`).toBeDefined();
      // Cada estado debe leerse sobre la superficie de las tarjetas.
      expect(ratio(tokens[e], tokens['color-surface'])).toBeGreaterThanOrEqual(3);
    }

    // Y no deben repetirse: el color es la unica pista para distinguirlos de un vistazo.
    const valores = estados.map(e => tokens[e]);
    expect(new Set(valores).size).toBe(valores.length);
  });
});
