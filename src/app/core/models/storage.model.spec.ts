import {
  calcularEstadoCuota,
  calcularDisponible,
  calcularPorcentaje
} from './storage.model';

import {
  calcularAvanceFlujo,
  calcularPeriodosParaCierre,
  calcularEtapasRequeridas
} from './workflow.model';

/**
 * Semaforo de cuotas de almacenamiento.
 *
 * La semantica es la heredada del presupuesto y aqui sigue siendo correcta:
 * excederse es malo, igual que gastar de mas. Estas pruebas fijan ese
 * contrato para que nadie lo invierta por descuido en el futuro.
 */
describe('Cuotas de almacenamiento', () => {

  describe('calcularEstadoCuota', () => {
    it('marca excedido al llegar al 100 %', () => {
      expect(calcularEstadoCuota(100)).toBe('exceeded');
      expect(calcularEstadoCuota(140)).toBe('exceeded');
    });

    it('marca en riesgo al alcanzar el umbral', () => {
      expect(calcularEstadoCuota(80)).toBe('at_risk');
      expect(calcularEstadoCuota(95)).toBe('at_risk');
    });

    it('respeta un umbral personalizado', () => {
      expect(calcularEstadoCuota(65, 60)).toBe('at_risk');
      expect(calcularEstadoCuota(55, 60)).toBe('on_track');
    });

    it('marca sin uso cuando no se ha consumido nada', () => {
      expect(calcularEstadoCuota(0)).toBe('unused');
    });

    it('marca normal en el rango intermedio', () => {
      expect(calcularEstadoCuota(45)).toBe('on_track');
    });
  });

  describe('calcularDisponible', () => {
    it('resta el consumo de la capacidad', () => {
      expect(calcularDisponible(500, 120)).toBe(380);
    });

    it('nunca devuelve un negativo aunque se exceda la cuota', () => {
      expect(calcularDisponible(100, 250)).toBe(0);
    });
  });

  describe('calcularPorcentaje', () => {
    it('calcula el porcentaje de uso', () => {
      expect(calcularPorcentaje(200, 50)).toBe(25);
    });

    it('devuelve cero si la capacidad es cero, sin dividir por cero', () => {
      expect(calcularPorcentaje(0, 50)).toBe(0);
    });
  });
});

/**
 * Avance de los flujos de aprobacion por etapas.
 */
describe('Flujos de aprobacion', () => {

  describe('calcularAvanceFlujo', () => {
    it('calcula el porcentaje de etapas completadas', () => {
      expect(calcularAvanceFlujo(2, 4)).toBe(50);
    });

    it('nunca supera el 100 %', () => {
      expect(calcularAvanceFlujo(9, 4)).toBe(100);
    });

    it('devuelve cero si el flujo no define etapas', () => {
      expect(calcularAvanceFlujo(3, 0)).toBe(0);
    });
  });

  describe('calcularPeriodosParaCierre', () => {
    it('redondea al alza los periodos restantes', () => {
      expect(calcularPeriodosParaCierre(10, 3, 2)).toBe(4);
    });

    it('devuelve cero cuando el flujo ya esta completo', () => {
      expect(calcularPeriodosParaCierre(5, 5, 1)).toBe(0);
      expect(calcularPeriodosParaCierre(5, 8, 1)).toBe(0);
    });

    it('devuelve null si no hay avance previsto por periodo', () => {
      expect(calcularPeriodosParaCierre(10, 2, 0)).toBeNull();
    });
  });

  describe('calcularEtapasRequeridas', () => {
    it('reparte las etapas pendientes entre los periodos disponibles', () => {
      expect(calcularEtapasRequeridas(12, 4, 4)).toBe(2);
    });

    it('devuelve cero si ya no queda nada pendiente', () => {
      expect(calcularEtapasRequeridas(6, 6, 3)).toBe(0);
    });

    it('devuelve cero si no queda tiempo, en vez de dividir por cero', () => {
      expect(calcularEtapasRequeridas(10, 2, 0)).toBe(0);
    });
  });
});
