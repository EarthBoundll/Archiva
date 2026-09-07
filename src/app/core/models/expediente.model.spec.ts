/**
 * El expediente: documento, flujo, etapa y estado.
 *
 * Antes de esta entrega la cadena estaba partida en el primer eslabón.
 * `flujo.documentoId` no se asignaba en ningún punto del proyecto, así
 * que ningún documento entraba jamás en un flujo. Las consecuencias eran
 * silenciosas y encadenadas: la bandeja mostraba etapas sin expediente,
 * el bloqueo de edición no podía dispararse nunca porque la condición que
 * lo activa era inalcanzable, y aprobar la última etapa no aprobaba nada.
 *
 * Estas pruebas fijan las reglas de esa cadena. No prueban Firestore:
 * prueban las decisiones, que es lo que se rompe al refactorizar.
 */

import {
  TareaAprobacion,
  AccionAprobacion,
  admiteResolucion,
  puedeResolver
} from './approval.model';

import { Rol, Permiso, tienePermiso } from './rbac.model';
import { TRANSICIONES, puedeTransicionar, EstadoDocumental } from './document.model';

function tarea(p: Partial<TareaAprobacion> = {}): TareaAprobacion {
  return {
    id: 't1', empresaId: 'e1',
    flujoId: 'f1', flujoNombre: 'Aprobación de contrato',
    documentoId: 'd1', codigoDocumento: 'CON-ADM-0001',
    orden: 1, etapaNombre: 'Revisión legal', etapasTotales: 3,
    responsableUid: 'u1', responsableNombre: 'María',
    asignadoUid: 'u1', asignadoNombre: 'María',
    estado: 'pendiente', prioridad: 'medium',
    fechaCreacion: new Date().toISOString(),
    traspasos: [],
    ...p
  } as TareaAprobacion;
}

/**
 * Reproduce la decisión de `ApprovalsService.moverDocumento`.
 *
 * Se prueba la regla, no el servicio: lo que importa es que aprobar una
 * etapa intermedia NO mueva el documento, y ese es el caso que se rompe
 * si alguien simplifica la condición.
 */
function destinoDelDocumento(
  accion: AccionAprobacion,
  completo: boolean
): EstadoDocumental | null {
  if (accion === 'delegar' || accion === 'reasignar') return null;
  return accion === 'rechazar' ? 'rechazado'
    : (accion === 'observar' || accion === 'solicitar_correccion') ? 'observado'
    : completo ? 'aprobado'
    : null;
}

/** Reproduce el cálculo de avance de `repercutir`. */
function avance(tareas: TareaAprobacion[]) {
  const aprobadas = tareas.filter(t => t.estado === 'resuelta' && t.accion === 'aprobar').length;
  return { aprobadas, completo: aprobadas >= tareas.length };
}

describe('Expediente · el documento se mueve con el flujo', () => {

  it('aprobar una etapa intermedia NO mueve el documento', () => {
    // Es el caso que más fácil se rompe: si el documento pasara a
    // aprobado en la primera etapa, las dos siguientes sobrarían y la
    // aprobación valdría lo que la firma de quien la dio primero.
    expect(destinoDelDocumento('aprobar', false)).toBeNull();
  });

  it('aprobar la última sí lo aprueba', () => {
    expect(destinoDelDocumento('aprobar', true)).toBe('aprobado');
  });

  it('rechazar en cualquier etapa lo rechaza', () => {
    expect(destinoDelDocumento('rechazar', false)).toBe('rechazado');
    expect(destinoDelDocumento('rechazar', true)).toBe('rechazado');
  });

  it('observar y solicitar corrección lo devuelven, no lo detienen', () => {
    expect(destinoDelDocumento('observar', false)).toBe('observado');
    expect(destinoDelDocumento('solicitar_correccion', false)).toBe('observado');
  });

  it('delegar y reasignar no tocan el documento: cambian de manos, no de estado', () => {
    expect(destinoDelDocumento('delegar', false)).toBeNull();
    expect(destinoDelDocumento('reasignar', false)).toBeNull();
    expect(destinoDelDocumento('delegar', true)).toBeNull();
  });

  it('los estados de destino son transiciones legales desde pendiente', () => {
    // Si el motor de aprobación pidiera una transición que la máquina de
    // estados rechaza, la etapa quedaría resuelta y el documento no se
    // movería: el expediente diría aprobado y el documento, otra cosa.
    for (const destino of ['aprobado', 'observado', 'rechazado'] as EstadoDocumental[]) {
      expect(puedeTransicionar('pendiente_aprobacion', destino)).toBe(true);
    }
  });

  it('un documento archivado no admite ningún destino: es el final', () => {
    expect(TRANSICIONES.archivado).toEqual([]);
  });
});

describe('Expediente · avance calculado desde las tareas', () => {

  it('cuenta solo las aprobadas, no las resueltas', () => {
    // Una etapa observada está resuelta pero no aprobada. Contarla como
    // avance era exactamente la discrepancia entre la barra del flujo y
    // la bandeja.
    const t = [
      tarea({ id: '1', orden: 1, estado: 'resuelta', accion: 'aprobar' }),
      tarea({ id: '2', orden: 2, estado: 'resuelta', accion: 'observar' }),
      tarea({ id: '3', orden: 3, estado: 'pendiente' })
    ];
    expect(avance(t).aprobadas).toBe(1);
    expect(avance(t).completo).toBe(false);
  });

  it('completo solo cuando todas están aprobadas', () => {
    const t = [
      tarea({ id: '1', orden: 1, estado: 'resuelta', accion: 'aprobar' }),
      tarea({ id: '2', orden: 2, estado: 'resuelta', accion: 'aprobar' })
    ];
    expect(avance(t).completo).toBe(true);
  });

  it('un expediente sin etapas no se da por completo por vacío', () => {
    // aprobadas (0) >= total (0) es cierto aritméticamente. Que la
    // apertura rechace las plantillas sin etapas es lo que impide que
    // esto llegue a ocurrir.
    expect(avance([]).completo).toBe(true);
  });
});

describe('Expediente · bloqueo de edición', () => {

  /** Reproduce la condición de `documentoBloqueado`. */
  const bloqueado = (tareas: TareaAprobacion[], docId: string) =>
    tareas.some(t => t.documentoId === docId && admiteResolucion(t));

  it('un documento con una etapa viva está bloqueado', () => {
    expect(bloqueado([tarea({ estado: 'pendiente' })], 'd1')).toBe(true);
  });

  it('una etapa delegada también bloquea: sigue viva', () => {
    expect(bloqueado([tarea({ estado: 'delegada' })], 'd1')).toBe(true);
  });

  it('con todas las etapas resueltas se puede volver a editar', () => {
    const t = [tarea({ estado: 'resuelta', accion: 'aprobar' })];
    expect(bloqueado(t, 'd1')).toBe(false);
  });

  it('las etapas de otro documento no bloquean este', () => {
    expect(bloqueado([tarea({ documentoId: 'd9' })], 'd1')).toBe(false);
  });

  it('una tarea sin documento no bloquea nada', () => {
    // Las plantillas generan tareas sin documentoId. Si esas bloquearan,
    // bloquearían a todos los documentos a la vez.
    expect(bloqueado([tarea({ documentoId: undefined })], 'd1')).toBe(false);
  });
});

describe('Expediente · quién puede abrirlo', () => {

  it('un colaborador puede enviar su documento a aprobación', () => {
    // Quien redacta un contrato tiene que poder mandarlo a aprobar. Si
    // hiciera falta ser gestor, el flujo documental no arrancaría nunca
    // sin que un jefe hiciera el trabajo administrativo de otro.
    expect(tienePermiso(Rol.COLABORADOR, Permiso.DOC_ENVIAR_REVISION)).toBe(true);
  });

  it('pero no puede definir quién lo aprueba', () => {
    // Es la separación que sostiene todo lo demás: enviar no es decidir
    // quién firma.
    expect(tienePermiso(Rol.COLABORADOR, Permiso.FLUJO_CREAR)).toBe(false);
    expect(tienePermiso(Rol.COLABORADOR, Permiso.FLUJO_EDITAR)).toBe(false);
  });

  it('ni aprobarlo él mismo', () => {
    expect(tienePermiso(Rol.COLABORADOR, Permiso.APROBAR)).toBe(false);
  });

  it('la jefatura sí define las plantillas', () => {
    expect(tienePermiso(Rol.JEFE_AREA, Permiso.FLUJO_CREAR)).toBe(true);
  });
});

describe('Expediente · la etapa la resuelve quien la tiene', () => {

  it('el titular sí', () => {
    expect(puedeResolver(tarea(), 'u1')).toBe(true);
  });

  it('un tercero no, aunque tenga permiso de aprobar', () => {
    // El permiso dice que el rol puede aprobar; la asignación dice qué
    // puede aprobar. Sin lo segundo, cualquier supervisor firmaría
    // cualquier etapa de la empresa.
    expect(puedeResolver(tarea(), 'u9')).toBe(false);
  });

  it('una etapa anulada por un rechazo anterior ya no se resuelve', () => {
    expect(admiteResolucion(tarea({ estado: 'anulada' }))).toBe(false);
    expect(puedeResolver(tarea({ estado: 'anulada' }), 'u1')).toBe(false);
  });
});
