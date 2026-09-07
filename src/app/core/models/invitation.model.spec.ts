/**
 * Invitaciones y aprobaciones.
 *
 * ARCHIVA dejó de admitir altas públicas: la única vía de entrada es un
 * enlace con testigo emitido por un administrador. Estas pruebas cubren la
 * vigencia de ese enlace, la aleatoriedad del testigo y las reglas que
 * gobiernan una etapa de aprobación.
 */

import {
  generarToken,
  esTokenValido,
  fechaExpiracion,
  haExpirado,
  estadoReal,
  esAceptable,
  diasRestantes,
  validarContrasena,
  DIAS_VIGENCIA_INVITACION,
  MIN_CONTRASENA,
  Invitacion
} from './invitation.model';

import {
  TareaAprobacion,
  admiteResolucion,
  puedeResolver,
  estaVencida,
  accionesDisponibles,
  validarResolucion,
  resumirBandeja,
  ACCIONES_APROBACION,
  diasEnEspera
} from './approval.model';

import { Rol } from './rbac.model';

function invitacion(p: Partial<Invitacion> = {}): Invitacion {
  return {
    id: 'i1', empresaId: 'e1', empresaNombre: 'Constructora Andes',
    email: 'maria@empresa.com', nombre: 'María Quispe',
    rol: Rol.COLABORADOR, area: 'administracion',
    token: generarToken(), estado: 'pendiente',
    invitadaPor: 'u1', invitadaPorNombre: 'Admin',
    fechaEnvio: new Date().toISOString(),
    fechaExpira: fechaExpiracion(),
    ...p
  } as Invitacion;
}

function tarea(p: Partial<TareaAprobacion> = {}): TareaAprobacion {
  return {
    id: 't1', empresaId: 'e1',
    flujoId: 'f1', flujoNombre: 'Aprobación de contrato',
    orden: 1, etapaNombre: 'Revisión legal', etapasTotales: 3,
    responsableUid: 'u1', responsableNombre: 'María',
    asignadoUid: 'u1', asignadoNombre: 'María',
    estado: 'pendiente', prioridad: 'medium',
    fechaCreacion: new Date().toISOString(),
    traspasos: [],
    ...p
  } as TareaAprobacion;
}

describe('Invitaciones · testigo', () => {

  it('genera 32 caracteres hexadecimales', () => {
    for (let i = 0; i < 20; i++) {
      expect(esTokenValido(generarToken())).toBe(true);
    }
  });

  it('no repite: un testigo concede acceso a una empresa', () => {
    const vistos = new Set<string>();
    for (let i = 0; i < 200; i++) vistos.add(generarToken());
    expect(vistos.size).toBe(200);
  });

  it('rechaza lo que no puede ser un testigo', () => {
    expect(esTokenValido('')).toBe(false);
    expect(esTokenValido('abc')).toBe(false);
    expect(esTokenValido('g'.repeat(32))).toBe(false);   // fuera de hexadecimal
    expect(esTokenValido('a'.repeat(31))).toBe(false);
    expect(esTokenValido('A'.repeat(32))).toBe(false);   // mayúsculas
  });
});

describe('Invitaciones · vigencia', () => {

  it('caduca a los siete días', () => {
    const desde = new Date('2026-09-01T10:00:00Z');
    const expira = new Date(fechaExpiracion(desde));
    const dias = (expira.getTime() - desde.getTime()) / 86400000;
    expect(Math.round(dias)).toBe(DIAS_VIGENCIA_INVITACION);
  });

  it('una invitación vencida deja de aceptarse', () => {
    const vieja = invitacion({ fechaExpira: '2020-01-01T00:00:00.000Z' });
    expect(haExpirado(vieja)).toBe(true);
    expect(estadoReal(vieja)).toBe('expirada');
    expect(esAceptable(vieja)).toBe(false);
  });

  it('la expiración se deriva de la fecha, no se guarda', () => {
    // Guardada, una invitación caducada seguiría figurando como pendiente
    // hasta que alguien la abriera.
    const guardadaComoPendiente = invitacion({
      estado: 'pendiente',
      fechaExpira: '2020-01-01T00:00:00.000Z'
    });
    expect(guardadaComoPendiente.estado).toBe('pendiente');
    expect(estadoReal(guardadaComoPendiente)).toBe('expirada');
  });

  it('una invitación revocada o aceptada no revive al mirar la fecha', () => {
    expect(estadoReal(invitacion({ estado: 'revocada' }))).toBe('revocada');
    expect(estadoReal(invitacion({ estado: 'aceptada' }))).toBe('aceptada');
  });

  it('cuenta los días que le quedan, sin bajar de cero', () => {
    expect(diasRestantes(invitacion())).toBeGreaterThan(0);
    expect(diasRestantes(invitacion({ fechaExpira: '2020-01-01T00:00:00.000Z' }))).toBe(0);
  });
});

describe('Invitaciones · contraseña al aceptar', () => {

  it('acepta una contraseña que cumple los tres requisitos', () => {
    expect(validarContrasena('Archiva2026')).toBeNull();
  });

  it('exige longitud, número y mayúscula', () => {
    expect(validarContrasena('')).toContain('Elige');
    expect(validarContrasena('Corta1')).toContain(String(MIN_CONTRASENA));
    expect(validarContrasena('sinnumeros')).toContain('número');
    expect(validarContrasena('sinmayuscula1')).toContain('mayúscula');
  });
});

describe('Aprobaciones · quién puede resolver', () => {

  it('el titular puede', () => {
    expect(puedeResolver(tarea(), 'u1')).toBe(true);
  });

  it('un tercero no: una etapa resuelta por quien no la tenía no vale', () => {
    expect(puedeResolver(tarea(), 'u9')).toBe(false);
  });

  it('quien recibe una delegación también puede', () => {
    const delegada = tarea({ estado: 'delegada', asignadoUid: 'u2', asignadoNombre: 'Luis' });
    expect(puedeResolver(delegada, 'u2')).toBe(true);
    // Y el titular no pierde la capacidad: sigue respondiendo de ella.
    expect(puedeResolver(delegada, 'u1')).toBe(true);
  });

  it('una tarea ya resuelta no admite más resoluciones', () => {
    const cerrada = tarea({ estado: 'resuelta' });
    expect(admiteResolucion(cerrada)).toBe(false);
    expect(puedeResolver(cerrada, 'u1')).toBe(false);
  });

  it('una tarea anulada tampoco', () => {
    expect(admiteResolucion(tarea({ estado: 'anulada' }))).toBe(false);
  });
});

describe('Aprobaciones · acciones disponibles', () => {

  it('quien no puede resolver no ve ninguna acción', () => {
    expect(accionesDisponibles(tarea(), 'u9', true, true)).toEqual([]);
  });

  it('las cuatro básicas están siempre para el titular', () => {
    const a = accionesDisponibles(tarea(), 'u1', false, false);
    expect(a).toEqual(['aprobar', 'observar', 'rechazar', 'solicitar_correccion']);
  });

  it('delegar y reasignar dependen del permiso', () => {
    expect(accionesDisponibles(tarea(), 'u1', true, false)).toContain('delegar');
    expect(accionesDisponibles(tarea(), 'u1', true, false)).not.toContain('reasignar');
    expect(accionesDisponibles(tarea(), 'u1', true, true)).toContain('reasignar');
  });

  it('cada acción declara qué le pasa al expediente', () => {
    for (const def of Object.values(ACCIONES_APROBACION)) {
      expect(def.efecto.length).toBeGreaterThan(15);
      expect(def.token).toContain('var(--');
    }
  });
});

describe('Aprobaciones · validación de la resolución', () => {

  it('aprobar no exige motivo', () => {
    expect(validarResolucion({ accion: 'aprobar' })).toBeNull();
  });

  it('observar y rechazar sí lo exigen', () => {
    expect(validarResolucion({ accion: 'observar' })).toContain('corregir');
    expect(validarResolucion({ accion: 'rechazar' })).toContain('motivo del rechazo');
    expect(validarResolucion({ accion: 'observar', motivo: 'Falta la firma' })).toBeNull();
  });

  it('delegar y reasignar exigen destinatario', () => {
    expect(validarResolucion({ accion: 'delegar' })).toContain('delegas');
    expect(validarResolucion({ accion: 'delegar', destinatarioUid: 'u2' })).toBeNull();
    expect(validarResolucion({ accion: 'reasignar', motivo: 'De baja' })).toContain('responsable');
  });
});

describe('Aprobaciones · plazos y bandeja', () => {

  it('una tarea viva con fecha pasada está vencida', () => {
    expect(estaVencida(tarea({ fechaLimite: '2020-01-01T00:00:00.000Z' }))).toBe(true);
  });

  it('una tarea ya resuelta no se cuenta como vencida', () => {
    // Cerrada fuera de plazo ya no exige nada a nadie.
    const cerrada = tarea({ estado: 'resuelta', fechaLimite: '2020-01-01T00:00:00.000Z' });
    expect(estaVencida(cerrada)).toBe(false);
  });

  it('sin fecha límite no hay vencimiento', () => {
    expect(estaVencida(tarea({ fechaLimite: undefined }))).toBe(false);
  });

  it('cuenta los días en espera desde que se abrió', () => {
    const hace5 = new Date(Date.now() - 5 * 86400000).toISOString();
    expect(diasEnEspera(tarea({ fechaCreacion: hace5 }))).toBe(5);
  });

  it('el resumen separa lo pendiente de lo vencido y lo delegado', () => {
    const r = resumirBandeja([
      tarea({ id: '1', estado: 'pendiente' }),
      tarea({ id: '2', estado: 'pendiente', fechaLimite: '2020-01-01T00:00:00.000Z' }),
      tarea({ id: '3', estado: 'delegada', asignadoUid: 'u1', responsableUid: 'u7' }),
      tarea({ id: '4', estado: 'resuelta', resueltaPorUid: 'u1',
              accion: 'aprobar', fechaResolucion: new Date().toISOString() })
    ], 'u1');

    expect(r.pendientes).toBe(3);
    expect(r.vencidas).toBe(1);
    expect(r.delegadasAMi).toBe(1);
    expect(r.resueltasEstePeriodo).toBe(1);
  });

  it('una bandeja vacía no divide por cero', () => {
    const r = resumirBandeja([], 'u1');
    expect(r.pendientes).toBe(0);
    expect(r.diasPromedio).toBeNull();
  });

  it('las tareas de otras personas no entran en mi resumen', () => {
    const r = resumirBandeja([
      tarea({ id: '1', responsableUid: 'u9', asignadoUid: 'u9' })
    ], 'u1');
    expect(r.pendientes).toBe(0);
  });
});
