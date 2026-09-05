import {
  proximaOcurrencia,
  generarOcurrencias,
  CATEGORIAS_DOCUMENTALES,
  TIPOS_DOCUMENTALES,
  getTiposPorCategoria,
  getEtiquetaCategoria,
  esTipoRapido,
  type ReglaRenovacion,
  type CategoriaDocumental,
  type TipoDocumental
} from './document.model';

/**
 * El motor de renovacion decide cuando vence cada documento. Es el codigo
 * mas delicado del sistema —dias que no existen en el mes, años bisiestos,
 * ultimo dia, primer dia habil— y hasta ahora no tenia ninguna prueba.
 */
describe('Motor de renovacion documental', () => {

  const desde = (iso: string) => new Date(iso + 'T12:00:00');

  describe('proximaOcurrencia · mensual por dia fijo', () => {
    const regla = (day: number): ReglaRenovacion => ({
      frequency: 'monthly',
      startDate: '2026-01-01',
      monthlyRule: { kind: 'day', day }
    });

    it('devuelve el mismo mes cuando el dia aun no ha pasado', () => {
      const r = proximaOcurrencia(regla(15), desde('2026-03-10'));
      expect(r?.getMonth()).toBe(2);
      expect(r?.getDate()).toBe(15);
    });

    it('salta al mes siguiente cuando el dia ya paso', () => {
      const r = proximaOcurrencia(regla(5), desde('2026-03-10'));
      expect(r?.getMonth()).toBe(3);
      expect(r?.getDate()).toBe(5);
    });

    it('ajusta el dia 31 a un mes de 30 dias', () => {
      const r = proximaOcurrencia(regla(31), desde('2026-04-05'));
      expect(r?.getMonth()).toBe(3);
      expect(r?.getDate()).toBe(30);
    });

    it('ajusta el dia 30 a febrero en un año comun', () => {
      // 2026 no es bisiesto: febrero tiene 28 dias
      const r = proximaOcurrencia(regla(30), desde('2026-02-01'));
      expect(r?.getMonth()).toBe(1);
      expect(r?.getDate()).toBe(28);
    });

    it('ajusta el dia 30 a febrero en un año bisiesto', () => {
      // 2028 es bisiesto: febrero tiene 29 dias
      const r = proximaOcurrencia(regla(30), desde('2028-02-01'));
      expect(r?.getMonth()).toBe(1);
      expect(r?.getDate()).toBe(29);
    });
  });

  describe('proximaOcurrencia · ultimo dia del mes', () => {
    const regla: ReglaRenovacion = {
      frequency: 'monthly',
      startDate: '2026-01-01',
      monthlyRule: { kind: 'last_day' }
    };

    it('resuelve el 28 en febrero comun', () => {
      const r = proximaOcurrencia(regla, desde('2026-02-10'));
      expect(r?.getDate()).toBe(28);
    });

    it('resuelve el 29 en febrero bisiesto', () => {
      const r = proximaOcurrencia(regla, desde('2028-02-10'));
      expect(r?.getDate()).toBe(29);
    });

    it('resuelve el 31 en un mes de 31 dias', () => {
      const r = proximaOcurrencia(regla, desde('2026-07-10'));
      expect(r?.getDate()).toBe(31);
    });
  });

  describe('generarOcurrencias', () => {
    it('genera seis fechas por defecto', () => {
      const fechas = generarOcurrencias({
        frequency: 'monthly',
        startDate: '2026-01-01',
        monthlyRule: { kind: 'day', day: 10 }
      });
      expect(fechas.length).toBe(6);
    });

    it('devuelve las fechas en orden ascendente y sin repetir', () => {
      const fechas = generarOcurrencias({
        frequency: 'monthly',
        startDate: '2026-01-01',
        monthlyRule: { kind: 'day', day: 10 }
      });
      const ordenadas = [...fechas].sort();
      expect(fechas).toEqual(ordenadas);
      expect(new Set(fechas).size).toBe(fechas.length);
    });

    it('respeta el numero solicitado', () => {
      const fechas = generarOcurrencias({
        frequency: 'annual',
        startDate: '2026-01-01',
        annualMonth: 5,
        annualDay: 15
      }, 3);
      expect(fechas.length).toBe(3);
    });

    it('devuelve formato YYYY-MM-DD', () => {
      const fechas = generarOcurrencias({
        frequency: 'monthly',
        startDate: '2026-01-01',
        monthlyRule: { kind: 'day', day: 10 }
      }, 1);
      expect(fechas[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('no revienta con una regla ausente', () => {
      expect(generarOcurrencias(null)).toEqual([]);
      expect(generarOcurrencias(undefined)).toEqual([]);
    });
  });

  describe('Catalogo documental', () => {
    it('define las doce categorias del dominio', () => {
      expect(Object.keys(CATEGORIAS_DOCUMENTALES).length).toBe(12);
    });

    it('define veintiocho tipos documentales', () => {
      expect(Object.keys(TIPOS_DOCUMENTALES).length).toBe(28);
    });

    it('asigna cada tipo a una categoria existente', () => {
      const categorias = Object.keys(CATEGORIAS_DOCUMENTALES);
      for (const [clave, tipo] of Object.entries(TIPOS_DOCUMENTALES)) {
        expect(categorias).toContain(tipo.category);
        expect(tipo.label.length).toBeGreaterThan(0);
        expect(tipo.icon.length).toBeGreaterThan(0);
      }
    });

    it('cubre todas las categorias con al menos un tipo', () => {
      for (const categoria of Object.keys(CATEGORIAS_DOCUMENTALES) as CategoriaDocumental[]) {
        expect(getTiposPorCategoria(categoria).length).toBeGreaterThan(0);
      }
    });

    it('devuelve la clave cuando la categoria no existe', () => {
      expect(getEtiquetaCategoria('inventada' as CategoriaDocumental)).toBe('inventada');
    });

    it('marca como rapidos los documentos puntuales', () => {
      expect(esTipoRapido('factura_compra')).toBe(true);
      expect(esTipoRapido('contrato_servicios')).toBe(false);
    });

    it('no falla con un tipo desconocido', () => {
      expect(esTipoRapido('inexistente' as TipoDocumental)).toBe(false);
    });
  });
});
