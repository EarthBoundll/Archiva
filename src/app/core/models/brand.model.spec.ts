/**
 * La marca de una empresa tiene que leerse en los dos temas.
 *
 * Es el requisito que gobierna todo lo demás. Una empresa elige un color
 * y la plataforma lo pinta sobre dos fondos opuestos: el azul marino
 * corporativo desaparece sobre el oscuro, el amarillo de marca desaparece
 * sobre el claro.
 *
 * Dejarlo al criterio de quien configura no sirve, porque configura en el
 * tema que él usa y el problema lo sufre quien usa el otro. Así que se
 * corrige automáticamente, y estas pruebas fijan hasta dónde: lo bastante
 * para que se lea, lo mínimo para que siga siendo su marca.
 */

import { readFileSync } from 'node:fs';

import {
  MarcaEmpresa, FONDOS, CONTRASTE_TEXTO, CONTRASTE_GRAFICO,
  derivarTokens, hojaDeMarca, validarMarca,
  tieneMarca, seLeeTalCual, ajusteAplicado
} from './brand.model';

import { aRgb, contraste, luminancia, esColorValido, textoSobre } from '../utils/color';

/** Contraste de un token derivado contra el fondo de su tema. */
function contra(hex: string, tema: 'claro' | 'oscuro'): number {
  return contraste(aRgb(hex)!, aRgb(FONDOS[tema].fondo)!);
}

const AZUL_MARINO = '#0B2340';   // se lee en claro, desaparece en oscuro
const AMARILLO    = '#F2C744';   // al revés
const GRIS_MEDIO  = '#808080';   // flojo en los dos
const BURDEOS     = '#7A1F3D';   // el caso cómodo: se lee en claro sin tocarlo
// El verde de éxito del sistema da 4.48 sobre fondo claro: no llega a 4.5
// por dos centésimas, así que sirve para probar la corrección mínima.

describe('Color · fundamentos', () => {

  it('acepta las tres grafías de hexadecimal', () => {
    expect(aRgb('#1F4959')).toEqual({ r: 31, g: 73, b: 89 });
    expect(aRgb('1F4959')).toEqual({ r: 31, g: 73, b: 89 });
    expect(aRgb('#FFF')).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('rechaza lo que no es un color', () => {
    for (const malo of ['', '#12', 'azul', '#GGGGGG', '#1234567']) {
      expect(esColorValido(malo)).toBe(false);
    }
  });

  it('la luminancia sigue la fórmula de WCAG en los extremos', () => {
    expect(luminancia({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 4);
    expect(luminancia({ r: 0, g: 0, b: 0 })).toBeCloseTo(0, 4);
  });

  it('blanco sobre negro da el contraste máximo', () => {
    expect(contraste({ r: 255, g: 255, b: 255 }, { r: 0, g: 0, b: 0 })).toBeCloseTo(21, 1);
  });
});

describe('Marca · el color se lee en los dos temas', () => {

  for (const color of [AZUL_MARINO, AMARILLO, GRIS_MEDIO, BURDEOS]) {
    it(`${color} alcanza el mínimo en claro y en oscuro`, () => {
      for (const tema of ['claro', 'oscuro'] as const) {
        const t = derivarTokens(color, undefined, tema)!;
        expect(contra(t.primary, tema)).toBeGreaterThanOrEqual(CONTRASTE_TEXTO - 0.01);
      }
    });
  }

  it('el azul marino se corrige en oscuro y casi no en claro', () => {
    // La comprobación de que la corrección es proporcional al problema, no
    // un aplanado que borra todas las marcas por igual.
    expect(seLeeTalCual(AZUL_MARINO, 'claro')).toBe(true);
    expect(seLeeTalCual(AZUL_MARINO, 'oscuro')).toBe(false);

    expect(ajusteAplicado(AZUL_MARINO, 'claro')).toBe(0);
    expect(ajusteAplicado(AZUL_MARINO, 'oscuro')).toBeGreaterThan(0);
  });

  it('el amarillo hace lo contrario', () => {
    expect(seLeeTalCual(AMARILLO, 'oscuro')).toBe(true);
    expect(seLeeTalCual(AMARILLO, 'claro')).toBe(false);
  });

  it('un color que ya cumple no se toca', () => {
    // Si se moviera igualmente, ninguna marca saldría como su dueño la eligió.
    const t = derivarTokens(BURDEOS, undefined, 'claro')!;
    expect(t.primary.toUpperCase()).toBe(BURDEOS.toUpperCase());
  });
});

describe('Marca · lo que va encima del color', () => {

  it('sobre un color oscuro va blanco; sobre uno claro, tinta', () => {
    // El sistema resolvía esto a mano con --color-sobre-primario. Con un
    // color arbitrario hay que decidirlo cada vez, o un botón de marca
    // clara sale con texto blanco ilegible.
    expect(textoSobre(aRgb('#0B2340')!)).toEqual({ r: 255, g: 255, b: 255 });
    expect(textoSobre(aRgb('#F2C744')!)).toEqual({ r: 16, g: 23, b: 26 });
  });

  it('el texto sobre el primario cumple el mínimo en los dos temas', () => {
    for (const color of [AZUL_MARINO, AMARILLO, GRIS_MEDIO, BURDEOS]) {
      for (const tema of ['claro', 'oscuro'] as const) {
        const t = derivarTokens(color, undefined, tema)!;
        expect(contraste(aRgb(t.sobrePrimario)!, aRgb(t.primary)!))
          .toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});

describe('Marca · las variantes acompañan al primario', () => {

  it('clara y oscura se separan del primario, en la dirección del tema', () => {
    for (const tema of ['claro', 'oscuro'] as const) {
      const t = derivarTokens(BURDEOS, undefined, tema)!;
      const l = luminancia(aRgb(t.primaryLight)!);
      const p = luminancia(aRgb(t.primary)!);
      const d = luminancia(aRgb(t.primaryDark)!);

      expect(l).toBeGreaterThan(p);
      expect(d).toBeLessThan(p);
    }
  });

  it('los bordes toman el tono de la marca', () => {
    // Dejarlos en el azul del sistema con una marca verde los haría
    // desentonar de todo lo demás.
    const t = derivarTokens(BURDEOS, undefined, 'claro')!;
    expect(t.border).toMatch(/^rgba\(/);
    expect(t.border).not.toContain('31, 73, 89');
  });

  it('sin color secundario, el acento sigue al primario', () => {
    const t = derivarTokens(BURDEOS, undefined, 'claro')!;
    expect(t.accent).toBe(t.primary);
  });

  it('con secundario, el acento se corrige contra el umbral gráfico', () => {
    // 3:1, no 4.5: el acento es un realce, no texto. Es el mismo criterio
    // con el que el sistema define el suyo, que da 2.94.
    for (const tema of ['claro', 'oscuro'] as const) {
      const t = derivarTokens(BURDEOS, AZUL_MARINO, tema)!;
      expect(contra(t.accent, tema)).toBeGreaterThanOrEqual(CONTRASTE_GRAFICO - 0.01);
    }
  });
});

describe('Marca · la hoja de estilo', () => {

  const hoja = hojaDeMarca({ colorPrimario: BURDEOS, colorSecundario: AMARILLO });

  it('trae los tres bloques del sistema de diseño', () => {
    // Replicar la estructura es lo que deja que la cascada resuelva el
    // cambio de tema sola, sin recalcular nada al alternar.
    expect(hoja).toContain(':root {');
    expect(hoja).toContain('@media (prefers-color-scheme: dark)');
    expect(hoja).toContain(':root:not([data-theme="light"])');
    expect(hoja).toContain(':root[data-theme="dark"]');
  });

  it('el guard de tema claro está, para que el sistema no gane a una elección manual', () => {
    const media = hoja.slice(hoja.indexOf('@media'), hoja.indexOf(':root[data-theme="dark"]'));
    expect(media).toContain(':not([data-theme="light"])');
  });

  it('define los siete tokens en cada bloque', () => {
    for (const token of ['--color-primary:', '--color-primary-light:', '--color-primary-dark:',
                         '--color-sobre-primario:', '--color-accent:',
                         '--color-border:', '--color-border-hover:']) {
      expect(hoja.split(token).length - 1).toBe(3);
    }
  });

  it('sin color no hay hoja: la plataforma se queda con su identidad', () => {
    expect(hojaDeMarca({})).toBe('');
    expect(hojaDeMarca({ logo: 'data:image/png;base64,xx' })).toBe('');
    expect(hojaDeMarca({ colorPrimario: 'no-es-un-color' })).toBe('');
  });
});

describe('Marca · validación', () => {

  it('acepta una marca completa', () => {
    expect(validarMarca({ colorPrimario: BURDEOS, colorSecundario: AMARILLO })).toBeNull();
  });

  it('rechaza colores que no lo son', () => {
    expect(validarMarca({ colorPrimario: 'rojo' })).toContain('principal');
    expect(validarMarca({ colorPrimario: BURDEOS, colorSecundario: '#ZZZ' })).toContain('secundario');
  });

  it('no admite secundario sin principal', () => {
    // El secundario acentúa al principal; solo no significa nada.
    expect(validarMarca({ colorSecundario: AMARILLO })).toContain('primero');
  });

  it('una marca vacía es válida y no aplica nada', () => {
    expect(validarMarca({})).toBeNull();
    expect(tieneMarca({})).toBe(false);
    expect(tieneMarca(null)).toBe(false);
    expect(tieneMarca({ logo: 'x' } as MarcaEmpresa)).toBe(true);
  });
});

describe('Marca · los fondos duplicados siguen coincidiendo con el SCSS', () => {

  const scss = readFileSync('src/styles/_design-system.scss', 'utf8');

  it('el fondo y la tinta del tema claro son los del sistema', () => {
    // FONDOS duplica estos valores porque el cálculo de contraste los
    // necesita en JavaScript. Si el sistema cambia y esto no, la marca se
    // corregiría contra un fondo que ya no existe.
    const claro = scss.slice(scss.indexOf(':root {'), scss.indexOf('@mixin tokens-oscuros'));
    expect(claro).toContain('--color-bg: ' + FONDOS.claro.fondo);
    expect(claro).toContain('--color-text: ' + FONDOS.claro.tinta);
  });

  it('y los del oscuro', () => {
    const oscuro = scss.slice(scss.indexOf('@mixin tokens-oscuros'));
    expect(oscuro).toContain('--color-bg:                ' + FONDOS.oscuro.fondo);
    expect(oscuro).toContain('--color-text:              ' + FONDOS.oscuro.tinta);
  });
});
