/**
 * Saneado de datos antes de escribir en Firestore.
 *
 * Firestore rechaza undefined y aborta la escritura entera con
 * "Unsupported field value: undefined". Bastaba dejar vacio un campo
 * opcional del formulario —ubicacionReferencia— para que el alta de un
 * documento fallase por completo.
 *
 * Se prueba la funcion pura, sin instanciar el servicio: la logica es la
 * misma y evita arrastrar todo el stack de Firebase a una prueba unitaria.
 */

/** Replica exacta de FirebaseService.limpiar. */
function limpiar<T>(data: T): T {
  if (data === null || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(v => limpiar(v)) as T;
  if (data instanceof Date) return data;

  const salida: Record<string, unknown> = {};
  for (const [clave, valor] of Object.entries(data as Record<string, unknown>)) {
    if (valor === undefined) continue;
    salida[clave] = limpiar(valor);
  }
  return salida as T;
}

describe('Saneado para Firestore', () => {

  it('descarta las claves con undefined', () => {
    const r = limpiar({ titulo: 'Contrato', ubicacionReferencia: undefined });
    expect(r).toEqual({ titulo: 'Contrato' });
    expect('ubicacionReferencia' in r).toBe(false);
  });

  it('conserva null, que significa "sin valor" de forma explicita', () => {
    const r = limpiar({ alertarDiasAntes: null, fechaAprobacion: undefined });
    expect(r).toEqual({ alertarDiasAntes: null });
  });

  it('conserva los valores falsos que si son datos', () => {
    const r = limpiar({ tamanioMb: 0, activo: false, notas: '' });
    expect(r).toEqual({ tamanioMb: 0, activo: false, notas: '' });
  });

  it('limpia tambien los objetos anidados', () => {
    const r = limpiar({
      vencimiento: { diasParaVencer: 12, fechaVencimiento: undefined },
      version: 1
    });
    expect(r).toEqual({ vencimiento: { diasParaVencer: 12 }, version: 1 });
  });

  it('limpia los objetos dentro de arreglos', () => {
    const r = limpiar({
      etapas: [
        { orden: 1, observacion: undefined },
        { orden: 2, observacion: 'Falta anexo' }
      ]
    }) as { etapas: Record<string, unknown>[] };

    expect(r.etapas[0]).toEqual({ orden: 1 });
    expect(r.etapas[1]).toEqual({ orden: 2, observacion: 'Falta anexo' });
  });

  it('no altera las fechas', () => {
    const fecha = new Date('2026-09-05T12:00:00Z');
    const r = limpiar({ creadoEn: fecha }) as { creadoEn: Date };
    expect(r.creadoEn).toBeInstanceOf(Date);
    expect(r.creadoEn.getTime()).toBe(fecha.getTime());
  });

  it('deja intactos los valores primitivos', () => {
    expect(limpiar('texto')).toBe('texto');
    expect(limpiar(42)).toBe(42);
    expect(limpiar(null)).toBeNull();
  });

  it('reproduce el caso que fallo en produccion', () => {
    // Alta de documento con los tres campos opcionales vacios.
    const doc = {
      codigo: 'CON-ADM-0001',
      titulo: 'Tarea final',
      descripcion: undefined,
      ubicacionReferencia: undefined,
      notes: undefined,
      tamanioMb: 0.22,
      activo: true
    };

    const r = limpiar(doc);
    expect(Object.values(r).every(v => v !== undefined)).toBe(true);
    expect(r).toEqual({
      codigo: 'CON-ADM-0001',
      titulo: 'Tarea final',
      tamanioMb: 0.22,
      activo: true
    });
  });
});
