/**
 * Reglas de los flujos de aprobación.
 *
 * El módulo existía como modelo y servicio sin ninguna pantalla que lo
 * invocara, de modo que nada de esto estaba ejercitado. Se prueban aquí las
 * reglas que gobiernan el recorrido: la secuencia de etapas, lo que hace
 * avanzar el contador y lo que impide guardar un flujo mal definido.
 */

import {
  siguienteOrden,
  nombreDeEtapa,
  admiteResolucion,
  admiteReanudacion,
  validarFlujo,
  ajustarNombresEtapas,
  resumirFlujos,
  calcularPeriodosParaCierre,
  calcularAvanceFlujo,
  RESULTADOS_ETAPA,
  ESTADOS_FLUJO,
  TIPOS_FLUJO,
  FlujoAprobacion,
  FlujoAprobacionPayload
} from './workflow.model';

/** Flujo mínimo con lo que cada prueba necesita cambiar. */
function flujo(parcial: Partial<FlujoAprobacion> = {}): FlujoAprobacion {
  return {
    id: 'f1',
    userId: 'u1',
    name: 'Aprobación del contrato',
    category: 'aprobacion_contrato',
    etapasTotales: 3,
    etapasCompletadas: 0,
    etapasPorPeriodo: 1,
    nombresEtapas: [],
    status: 'active',
    priority: 'medium',
    estaCompletado: false,
    periodosParaCierre: 3,
    etapas: [],
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...parcial
  } as FlujoAprobacion;
}

/** Payload válido, para alterar solo el campo bajo prueba. */
function payload(parcial: Partial<FlujoAprobacionPayload> = {}): FlujoAprobacionPayload {
  return {
    name: 'Visto bueno de gerencia',
    category: 'visto_bueno_gerencia',
    etapasTotales: 3,
    etapasPorPeriodo: 1,
    ...parcial
  };
}

describe('Flujos · secuencia de etapas', () => {

  it('la etapa que toca es la siguiente a las aprobadas', () => {
    expect(siguienteOrden(flujo({ etapasCompletadas: 0 }))).toBe(1);
    expect(siguienteOrden(flujo({ etapasCompletadas: 2 }))).toBe(3);
  });

  it('un flujo sin etapas pendientes no admite más resoluciones', () => {
    // Sin esta comprobacion se podia firmar la ultima etapa de un flujo ya
    // cerrado y dejar el contador por encima del total.
    expect(admiteResolucion(flujo({ etapasCompletadas: 3, etapasTotales: 3 }))).toBe(false);
    expect(admiteResolucion(flujo({ etapasCompletadas: 2, etapasTotales: 3 }))).toBe(true);
  });

  it('un flujo suspendido no admite resoluciones, pero sí reanudarse', () => {
    const suspendido = flujo({ status: 'paused', etapasCompletadas: 1 });
    expect(admiteResolucion(suspendido)).toBe(false);
    expect(admiteReanudacion(suspendido)).toBe(true);
  });

  it('un flujo en curso no se reanuda: ya lo está', () => {
    expect(admiteReanudacion(flujo({ status: 'active' }))).toBe(false);
    expect(admiteReanudacion(flujo({ status: 'completed' }))).toBe(false);
  });

  it('la etapa toma el nombre declarado, o uno derivado de su posición', () => {
    const conNombres = flujo({ nombresEtapas: ['Revisión legal', '', 'Firma'] });
    expect(nombreDeEtapa(conNombres, 1)).toBe('Revisión legal');
    expect(nombreDeEtapa(conNombres, 3)).toBe('Firma');
    // La segunda quedó en blanco: se numera sola.
    expect(nombreDeEtapa(conNombres, 2)).toBe('Etapa 2 de 3');
  });
});

describe('Flujos · validación del alta', () => {

  it('acepta un flujo bien definido', () => {
    expect(validarFlujo(payload())).toBeNull();
  });

  it('exige nombre de al menos tres caracteres', () => {
    expect(validarFlujo(payload({ name: '' }))).toContain('nombre');
    expect(validarFlujo(payload({ name: 'ab' }))).toContain('tres caracteres');
  });

  it('exige al menos una etapa y no más de veinte', () => {
    expect(validarFlujo(payload({ etapasTotales: 0 }))).toContain('al menos una etapa');
    expect(validarFlujo(payload({ etapasTotales: 21 }))).toContain('máximo');
  });

  it('no admite resolver más etapas por periodo que las que tiene el flujo', () => {
    const r = validarFlujo(payload({ etapasTotales: 2, etapasPorPeriodo: 5 }));
    expect(r).toContain('más etapas por periodo');
  });

  it('rechaza una fecha límite ya pasada', () => {
    expect(validarFlujo(payload({ fechaLimiteCierre: '2020-01-01' }))).toContain('ya pasó');
  });

  it('acepta una fecha límite futura', () => {
    const futuro = new Date();
    futuro.setFullYear(futuro.getFullYear() + 1);
    const iso = futuro.toISOString().slice(0, 10);
    expect(validarFlujo(payload({ fechaLimiteCierre: iso }))).toBeNull();
  });
});

describe('Flujos · nombres de etapa', () => {

  it('recorta cuando el flujo pierde etapas', () => {
    expect(ajustarNombresEtapas(['a', 'b', 'c', 'd'], 2)).toEqual(['a', 'b']);
  });

  it('rellena cuando el flujo gana etapas, sin perder lo escrito', () => {
    expect(ajustarNombresEtapas(['a'], 3)).toEqual(['a', '', '']);
  });

  it('deja la lista intacta cuando el número coincide', () => {
    expect(ajustarNombresEtapas(['a', 'b'], 2)).toEqual(['a', 'b']);
  });
});

describe('Flujos · proyección y avance', () => {

  it('estima los periodos que faltan según el ritmo', () => {
    expect(calcularPeriodosParaCierre(10, 4, 2)).toBe(3);
  });

  it('un flujo terminado no necesita más periodos', () => {
    expect(calcularPeriodosParaCierre(5, 5, 1)).toBe(0);
  });

  it('sin ritmo declarado no hay proyección posible', () => {
    expect(calcularPeriodosParaCierre(5, 1, 0)).toBeNull();
  });

  it('el avance nunca pasa del cien por cien', () => {
    expect(calcularAvanceFlujo(3, 3)).toBe(100);
    expect(calcularAvanceFlujo(7, 3)).toBe(100);
    expect(calcularAvanceFlujo(1, 3)).toBe(33);
  });
});

describe('Flujos · resumen del conjunto', () => {

  it('cuenta cada estado por separado', () => {
    const r = resumirFlujos([
      flujo({ id: '1', status: 'active' }),
      flujo({ id: '2', status: 'active' }),
      flujo({ id: '3', status: 'completed', etapasCompletadas: 3 }),
      flujo({ id: '4', status: 'paused' }),
      flujo({ id: '5', status: 'cancelled' })
    ]);

    expect(r.total).toBe(5);
    expect(r.enCurso).toBe(2);
    expect(r.completados).toBe(1);
    expect(r.suspendidos).toBe(1);
    expect(r.anulados).toBe(1);
  });

  it('el avance global excluye los flujos anulados', () => {
    // Dos flujos de tres etapas: uno terminado y otro anulado sin avance.
    // Contar el anulado hundiria la cifra por algo que ya no se sigue.
    const r = resumirFlujos([
      flujo({ id: '1', status: 'completed', etapasCompletadas: 3 }),
      flujo({ id: '2', status: 'cancelled', etapasCompletadas: 0 })
    ]);
    expect(r.avanceGlobal).toBe(100);
  });

  it('señala los flujos en curso que pasaron su fecha límite', () => {
    const r = resumirFlujos([
      flujo({ id: '1', status: 'active', fechaLimiteCierre: '2020-01-01' }),
      flujo({ id: '2', status: 'active', fechaLimiteCierre: '2099-01-01' }),
      // Uno completado fuera de plazo ya no exige nada.
      flujo({ id: '3', status: 'completed', fechaLimiteCierre: '2020-01-01' })
    ]);
    expect(r.vencidos).toBe(1);
  });

  it('un conjunto vacío no divide por cero', () => {
    const r = resumirFlujos([]);
    expect(r.total).toBe(0);
    expect(r.avanceGlobal).toBe(0);
  });
});

describe('Flujos · catálogos', () => {

  it('declara los tres resultados posibles de una etapa', () => {
    expect(Object.keys(RESULTADOS_ETAPA).sort())
      .toEqual(['aprobada', 'observada', 'rechazada']);
  });

  it('cada resultado explica qué le pasa al flujo', () => {
    for (const r of Object.values(RESULTADOS_ETAPA)) {
      expect(r.efecto.length).toBeGreaterThan(10);
      expect(r.token).toContain('var(--');
    }
  });

  it('declara los cuatro estados de un flujo', () => {
    expect(Object.keys(ESTADOS_FLUJO).sort())
      .toEqual(['active', 'cancelled', 'completed', 'paused']);
  });

  it('mantiene los doce tipos de flujo que promete el catálogo', () => {
    expect(Object.keys(TIPOS_FLUJO).length).toBe(12);
  });
});
