// ============================================
// APROBACIONES Y BANDEJAS — ARCHIVA
// ============================================
// Un documento entra en un flujo y genera una tarea por etapa. La tarea es
// lo que aparece en la bandeja de quien debe resolverla, y lo que sostiene
// la trazabilidad: quién, cuándo y con qué resultado.

import { Rol } from './rbac.model';
import { AreaEmisora } from './document.model';

/** Lo que un aprobador puede decidir sobre una etapa. */
export type AccionAprobacion =
  | 'aprobar'
  | 'observar'
  | 'rechazar'
  | 'solicitar_correccion'
  | 'delegar'
  | 'reasignar';

export const ACCIONES_APROBACION: Record<AccionAprobacion, {
  label: string;
  icon: string;
  token: string;
  /** Qué le ocurre al expediente. */
  efecto: string;
  /** ¿Exige escribir un motivo? */
  exigeMotivo: boolean;
  /** ¿Exige señalar a otra persona? */
  exigeDestinatario: boolean;
}> = {
  aprobar: {
    label: 'Aprobar', icon: 'file-check', token: 'var(--estado-aprobado)',
    efecto: 'La etapa queda conforme y el expediente pasa a la siguiente',
    exigeMotivo: false, exigeDestinatario: false
  },
  observar: {
    label: 'Observar', icon: 'file-warning', token: 'var(--estado-observado)',
    efecto: 'Vuelve a quien lo presentó; la etapa sigue pendiente',
    exigeMotivo: true, exigeDestinatario: false
  },
  rechazar: {
    label: 'Rechazar', icon: 'file-x', token: 'var(--estado-rechazado)',
    efecto: 'El flujo queda suspendido hasta que alguien lo reanude',
    exigeMotivo: true, exigeDestinatario: false
  },
  solicitar_correccion: {
    label: 'Solicitar corrección', icon: 'file-pen', token: 'var(--estado-borrador)',
    efecto: 'Devuelve el documento a edición sin detener el flujo',
    exigeMotivo: true, exigeDestinatario: false
  },
  delegar: {
    label: 'Delegar', icon: 'send-horizontal', token: 'var(--estado-en-revision)',
    efecto: 'Otra persona resuelve esta etapa en tu nombre; sigues respondiendo de ella',
    exigeMotivo: false, exigeDestinatario: true
  },
  reasignar: {
    label: 'Reasignar', icon: 'user-cog', token: 'var(--estado-pendiente)',
    efecto: 'La etapa cambia de responsable de forma definitiva',
    exigeMotivo: true, exigeDestinatario: true
  }
};

export type EstadoTarea =
  | 'pendiente'    // esperando a su responsable
  | 'en_curso'     // alguien la tomó
  | 'resuelta'     // aprobada, observada o rechazada
  | 'delegada'     // otro la resuelve en nombre del titular
  | 'anulada';     // el flujo se retiró

export const ESTADOS_TAREA: Record<EstadoTarea, { label: string; token: string }> = {
  pendiente: { label: 'Pendiente', token: 'var(--estado-pendiente)' },
  en_curso:  { label: 'En curso',  token: 'var(--estado-en-revision)' },
  resuelta:  { label: 'Resuelta',  token: 'var(--estado-aprobado)' },
  delegada:  { label: 'Delegada',  token: 'var(--estado-borrador)' },
  anulada:   { label: 'Anulada',   token: 'var(--estado-archivado)' }
};

/**
 * Una etapa concreta esperando resolución.
 *
 * Se guarda como documento propio, no dentro del flujo, porque la bandeja
 * de una persona es una consulta por responsable: leer todos los flujos de
 * la empresa para filtrar sus etapas no escala.
 */
export interface TareaAprobacion {
  id: string;
  empresaId: string;

  // De dónde viene
  flujoId: string;
  flujoNombre: string;
  documentoId?: string;
  codigoDocumento?: string;
  tituloDocumento?: string;

  // Qué etapa es
  orden: number;
  etapaNombre: string;
  etapasTotales: number;

  // Quién responde
  /** Titular de la etapa. No cambia al delegar. */
  responsableUid: string;
  responsableNombre: string;
  /** Quién la resuelve ahora: el titular, o alguien por delegación. */
  asignadoUid: string;
  asignadoNombre: string;
  rolRequerido?: Rol;
  area?: AreaEmisora;

  estado: EstadoTarea;
  prioridad: 'high' | 'medium' | 'low';

  fechaCreacion: string;
  fechaLimite?: string;
  fechaResolucion?: string;

  // Resultado
  accion?: AccionAprobacion;
  motivo?: string;
  resueltaPorUid?: string;
  resueltaPorNombre?: string;

  /** Delegaciones y reasignaciones sufridas, en orden. */
  traspasos?: Traspaso[];
}

export interface Traspaso {
  tipo: 'delegar' | 'reasignar';
  deUid: string;
  deNombre: string;
  aUid: string;
  aNombre: string;
  motivo?: string;
  fecha: string;
}

/** Lo que se envía al resolver una etapa. */
export interface ResolucionPayload {
  accion: AccionAprobacion;
  motivo?: string;
  /** Requerido para delegar y reasignar. */
  destinatarioUid?: string;
  destinatarioNombre?: string;
}

// ============================================
// BANDEJAS
// ============================================

export type Bandeja =
  | 'pendientes'
  | 'aprobaciones'
  | 'observaciones'
  | 'documentos'
  | 'historial';

export const BANDEJAS: Record<Bandeja, {
  label: string;
  icon: string;
  descripcion: string;
}> = {
  pendientes: {
    label: 'Mis pendientes', icon: 'clipboard-list',
    descripcion: 'Etapas que esperan tu resolución'
  },
  aprobaciones: {
    label: 'Mis aprobaciones', icon: 'file-check',
    descripcion: 'Lo que ya diste por conforme'
  },
  observaciones: {
    label: 'Mis observaciones', icon: 'file-warning',
    descripcion: 'Lo que devolviste para corregir'
  },
  documentos: {
    label: 'Mis documentos', icon: 'folder',
    descripcion: 'Los que registraste tú'
  },
  historial: {
    label: 'Historial', icon: 'history',
    descripcion: 'Todo lo que has resuelto'
  }
};

// ============================================
// CONSULTAS
// ============================================

/** Solo una tarea viva admite resolución. */
export function admiteResolucion(t: TareaAprobacion): boolean {
  return t.estado === 'pendiente' || t.estado === 'en_curso' || t.estado === 'delegada';
}

/**
 * ¿Puede esta persona resolver la tarea?
 *
 * El titular siempre puede. Quien recibe una delegación también, mientras
 * dure. Nadie más: una etapa resuelta por quien no la tenía asignada no
 * vale como evidencia.
 */
export function puedeResolver(t: TareaAprobacion, uid: string): boolean {
  if (!admiteResolucion(t)) return false;
  return t.asignadoUid === uid || t.responsableUid === uid;
}

/** Una tarea con fecha límite pasada exige atención inmediata. */
export function estaVencida(t: TareaAprobacion, ahora = new Date()): boolean {
  if (!t.fechaLimite || !admiteResolucion(t)) return false;
  return new Date(t.fechaLimite).getTime() < ahora.getTime();
}

export function diasEnEspera(t: TareaAprobacion, ahora = new Date()): number {
  const desde = new Date(t.fechaCreacion).getTime();
  return Math.max(0, Math.floor((ahora.getTime() - desde) / 86400000));
}

/** Acciones que tienen sentido sobre una tarea, según quién la mira. */
export function accionesDisponibles(
  t: TareaAprobacion,
  uid: string,
  puedeDelegar: boolean,
  puedeReasignar: boolean
): AccionAprobacion[] {
  if (!puedeResolver(t, uid)) return [];

  const base: AccionAprobacion[] = ['aprobar', 'observar', 'rechazar', 'solicitar_correccion'];
  if (puedeDelegar)   base.push('delegar');
  if (puedeReasignar) base.push('reasignar');
  return base;
}

export function validarResolucion(p: ResolucionPayload): string | null {
  const def = ACCIONES_APROBACION[p.accion];
  if (!def) return 'Elige qué hacer con esta etapa.';

  if (def.exigeMotivo && !p.motivo?.trim()) {
    return p.accion === 'rechazar'
      ? 'Indica el motivo del rechazo: sin él la suspensión no se puede justificar.'
      : 'Indica qué hay que corregir: sin eso nadie sabe cómo continuar.';
  }

  if (def.exigeDestinatario && !p.destinatarioUid) {
    return p.accion === 'delegar'
      ? 'Elige a quién delegas la etapa.'
      : 'Elige el nuevo responsable de la etapa.';
  }

  return null;
}

/** Resumen de la carga de trabajo de una persona. */
export interface ResumenBandeja {
  pendientes: number;
  vencidas: number;
  delegadasAMi: number;
  resueltasEstePeriodo: number;
  /** Días medios que tarda en resolver. */
  diasPromedio: number | null;
}

export function resumirBandeja(tareas: TareaAprobacion[], uid: string, ahora = new Date()): ResumenBandeja {
  const mias = tareas.filter(t => t.asignadoUid === uid || t.responsableUid === uid);
  const vivas = mias.filter(admiteResolucion);

  const resueltas = mias.filter(t => t.estado === 'resuelta' && t.resueltaPorUid === uid);
  const periodo = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;

  const demoras = resueltas
    .filter(t => t.fechaResolucion)
    .map(t => (new Date(t.fechaResolucion!).getTime() - new Date(t.fechaCreacion).getTime()) / 86400000)
    .filter(d => d >= 0);

  return {
    pendientes: vivas.length,
    vencidas: vivas.filter(t => estaVencida(t, ahora)).length,
    delegadasAMi: vivas.filter(t => t.estado === 'delegada' && t.asignadoUid === uid).length,
    resueltasEstePeriodo: resueltas.filter(t => (t.fechaResolucion ?? '').startsWith(periodo)).length,
    diasPromedio: demoras.length
      ? Math.round((demoras.reduce((a, b) => a + b, 0) / demoras.length) * 10) / 10
      : null
  };
}
