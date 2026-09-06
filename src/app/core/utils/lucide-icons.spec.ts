/**
 * Cobertura del juego de iconos.
 *
 * IconComponent devuelve cadena vacia cuando el nombre no esta en el mapa, y
 * un SVG vacio no se ve: no hay error en consola, ni hueco evidente, ni nada
 * que delate el fallo. Asi es como el producto llego a produccion con los
 * doce iconos de categoria, los ocho de la bitacora y los de flujo dibujados
 * en blanco, mientras el mapa conservaba cerveza, mascotas y vuelos del
 * producto anterior.
 *
 * Estas pruebas recorren los catalogos del dominio y exigen que cada nombre
 * declarado exista. Anadir una categoria sin su icono rompe la suite.
 */

import { LUCIDE_ICONS } from './lucide-icons';
import { CATEGORIAS_DOCUMENTALES, TIPOS_DOCUMENTALES, ESTADOS_DOCUMENTALES } from '../models/document.model';
import { ACCIONES } from '../models/history.model';
import { TIPOS_PRIORITARIOS, TIPOS_ORDINARIOS } from '../models/review-request.model';

/** Nombres declarados en un catalogo cuyo icono no existe. */
function ausentes(nombres: string[]): string[] {
  return [...new Set(nombres)].filter(n => !LUCIDE_ICONS[n]);
}

describe('Juego de iconos', () => {

  it('cubre las doce categorías documentales', () => {
    const nombres = Object.values(CATEGORIAS_DOCUMENTALES).map(c => c.icon);
    expect(nombres.length).toBe(12);
    expect(ausentes(nombres)).toEqual([]);
  });

  it('cubre todos los tipos documentales', () => {
    const nombres = Object.values(TIPOS_DOCUMENTALES).map(t => t.icon);
    expect(ausentes(nombres)).toEqual([]);
  });

  it('cubre los ocho estados documentales', () => {
    const nombres = Object.values(ESTADOS_DOCUMENTALES).map((e: any) => e.icon).filter(Boolean);
    expect(ausentes(nombres)).toEqual([]);
  });

  it('cubre las ocho acciones de la bitácora', () => {
    const nombres = Object.values(ACCIONES).map(a => a.icon);
    expect(nombres.length).toBe(8);
    expect(ausentes(nombres)).toEqual([]);
  });

  it('cubre los tipos de solicitud, prioritarios y ordinarios', () => {
    const nombres = [
      ...Object.values(TIPOS_PRIORITARIOS).map((t: any) => t.icon),
      ...Object.values(TIPOS_ORDINARIOS).map((t: any) => t.icon)
    ].filter(Boolean);
    expect(ausentes(nombres)).toEqual([]);
  });

  it('no conserva la iconografía de gasto doméstico del producto anterior', () => {
    // Cerveza, mascotas, vuelos, ropa y monedas rotulaban categorias de
    // gasto que ARCHIVA no tiene.
    const heredados = [
      'beer', 'beef', 'bone', 'dog', 'shirt', 'plane', 'utensils',
      'clapperboard', 'coins', 'bitcoin', 'banknote', 'wallet',
      'credit-card', 'circle-dollar-sign', 'shopping-cart', 'piggy-bank'
    ];
    const supervivientes = heredados.filter(n => LUCIDE_ICONS[n]);
    expect(supervivientes).toEqual([]);
  });

  it('cada trazado es contenido interno de SVG, no un <svg> completo', () => {
    // IconComponent pone el envoltorio: si un valor trajera su propio <svg>,
    // quedaria anidado y el tamaño dejaria de responder al parametro size.
    for (const [nombre, trazado] of Object.entries(LUCIDE_ICONS)) {
      expect(trazado.includes('<svg'), `${nombre} trae su propio <svg>`).toBe(false);
      expect(trazado.trim().length, `${nombre} está vacío`).toBeGreaterThan(0);
    }
  });
});
