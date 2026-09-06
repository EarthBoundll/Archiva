// ============================================
// SOLICITUDES DE REVISION - ARCHIVA
// ============================================
// Peticiones sobre un documento concreto: corregir, aprobar, digitalizar,
// reclasificar. Sistema dual: las prioritarias bloquean el avance del
// documento, las ordinarias no.

/** Tipos que bloquean el avance del documento. */
export type TipoSolicitudPrioritaria =
  | 'aprobacion_gerencial'
  | 'revision_legal'
  | 'subsanacion_observacion'
  | 'actualizacion_vencimiento'
  | 'validacion_firma'
  | 'correccion_datos'
  | 'reasignacion_responsable';

/** Tipos que no bloquean: mejoras y tramites de archivo. */
export type TipoSolicitudOrdinaria =
  | 'revision_formato'
  | 'revision_ortografica'
  | 'actualizacion_anexos'
  | 'cambio_categoria'
  | 'solicitud_copia'
  | 'digitalizacion'
  | 'reclasificacion'
  | 'traslado_archivo'
  | 'otros';

export type TipoSolicitud = TipoSolicitudPrioritaria | TipoSolicitudOrdinaria;

export type EstadoSolicitud = 'pendiente' | 'en_proceso' | 'atendida' | 'vencida' | 'anulada';

export type OrigenSolicitud =
  | 'auditoria_interna'
  | 'auditoria_externa'
  | 'revision_programada'
  | 'reporte_usuario';

export type FrecuenciaSolicitud = 'unica' | 'mensual' | 'trimestral' | 'semestral' | 'anual';

export const TIPOS_PRIORITARIOS: Record<TipoSolicitudPrioritaria, {
  name: string; icon: string; plazoSugerido: number;
}> = {
  aprobacion_gerencial:      { name: 'Aprobación gerencial',      icon: 'stamp',          plazoSugerido: 5 },
  revision_legal:            { name: 'Revisión legal',            icon: 'scale',          plazoSugerido: 7 },
  subsanacion_observacion:   { name: 'Subsanar observación',      icon: 'file-warning',   plazoSugerido: 3 },
  actualizacion_vencimiento: { name: 'Actualizar por vencimiento',icon: 'calendar-clock', plazoSugerido: 10 },
  validacion_firma:          { name: 'Validar firma',             icon: 'pen-line',       plazoSugerido: 2 },
  correccion_datos:          { name: 'Corregir datos',            icon: 'file-pen',       plazoSugerido: 2 },
  reasignacion_responsable:  { name: 'Reasignar responsable',     icon: 'user-cog',       plazoSugerido: 5 }
};

export const TIPOS_ORDINARIOS: Record<TipoSolicitudOrdinaria, {
  name: string; icon: string; plazoSugerido: number;
}> = {
  revision_formato:     { name: 'Revisión de formato',    icon: 'layout-template', plazoSugerido: 7 },
  revision_ortografica: { name: 'Revisión ortográfica',   icon: 'spell-check',     plazoSugerido: 5 },
  actualizacion_anexos: { name: 'Actualizar anexos',      icon: 'paperclip',       plazoSugerido: 7 },
  cambio_categoria:     { name: 'Cambio de categoría',    icon: 'folder-symlink',  plazoSugerido: 3 },
  solicitud_copia:      { name: 'Solicitud de copia',     icon: 'copy',            plazoSugerido: 2 },
  digitalizacion:       { name: 'Digitalización',         icon: 'scan',            plazoSugerido: 10 },
  reclasificacion:      { name: 'Reclasificación',        icon: 'folder-tree',     plazoSugerido: 7 },
  traslado_archivo:     { name: 'Traslado a archivo',     icon: 'archive',         plazoSugerido: 15 },
  otros:                { name: 'Otros',                  icon: 'file-question',   plazoSugerido: 7 }
};

export const ESTADOS_SOLICITUD: Record<EstadoSolicitud, {
  label: string; icon: string; token: string;
}> = {
  pendiente:  { label: 'Pendiente',  icon: 'clock',        token: 'var(--estado-pendiente)' },
  en_proceso: { label: 'En proceso', icon: 'loader',       token: 'var(--estado-en-revision)' },
  atendida:   { label: 'Atendida',   icon: 'check-circle', token: 'var(--estado-aprobado)' },
  vencida:    { label: 'Vencida',    icon: 'calendar-x',   token: 'var(--estado-vencido)' },
  anulada:    { label: 'Anulada',    icon: 'x-circle',     token: 'var(--estado-archivado)' }
};

export const ORIGENES: Record<OrigenSolicitud, { label: string; icon: string }> = {
  auditoria_interna:   { label: 'Auditoría interna',  icon: 'search-check' },
  auditoria_externa:   { label: 'Auditoría externa',  icon: 'shield-check' },
  revision_programada: { label: 'Revisión programada',icon: 'calendar-check' },
  reporte_usuario:     { label: 'Reporte de usuario', icon: 'message-square' }
};

export interface SolicitudRevision {
  id: string;
  userId: string;

  /** Documento sobre el que recae. Sin el, la solicitud no tiene objeto. */
  documentoId: string;
  codigoDocumento: string;
  tituloDocumento: string;

  /** true = bloquea el avance del documento. */
  esPrioritaria: boolean;
  category: TipoSolicitud;

  titulo: string;
  detalle?: string;

  solicitante: string;
  revisor?: string;
  origen: OrigenSolicitud;

  /** Esfuerzo de atencion, en dias. */
  diasEstimados: number;
  diasReales: number;

  fechaSolicitud: string;
  fechaLimiteAtencion: string;
  fechaAtencion?: string;

  status: EstadoSolicitud;
  esPeriodica: boolean;
  frequency: FrecuenciaSolicitud;

  /** Se marca cuando ya hubo una solicitud igual sobre el mismo documento. */
  esReincidente?: boolean;
  vecesRepetida?: number;

  activo: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SolicitudRevisionPayload {
  documentoId: string;
  codigoDocumento: string;
  tituloDocumento: string;
  esPrioritaria: boolean;
  category: TipoSolicitud;
  titulo: string;
  detalle?: string;
  solicitante: string;
  revisor?: string;
  origen: OrigenSolicitud;
  diasEstimados: number;
  fechaLimiteAtencion: string;
  esPeriodica?: boolean;
  frequency?: FrecuenciaSolicitud;
  notes?: string;
}

export interface ResumenSolicitudes {
  periodoId: string;
  total: number;
  pendientes: number;
  enProceso: number;
  atendidas: number;
  vencidas: number;
  prioritariasAbiertas: number;
  reincidentes: number;
  tasaAtencion: number;          // % atendidas sobre el total
  diasPromedioAtencion: number | null;
  ultimaActualizacion: string;
}

// ============================================
// CATALOGOS
// ============================================

export function getAllTiposSolicitud() {
  return { ...TIPOS_PRIORITARIOS, ...TIPOS_ORDINARIOS };
}

export function etiquetaTipo(t: TipoSolicitud): string {
  return getAllTiposSolicitud()[t]?.name ?? t;
}

export function iconoTipo(t: TipoSolicitud): string {
  return getAllTiposSolicitud()[t]?.icon ?? 'file-question';
}

export function plazoSugerido(t: TipoSolicitud): number {
  return getAllTiposSolicitud()[t]?.plazoSugerido ?? 7;
}

export function esTipoPrioritario(t: TipoSolicitud): boolean {
  return t in TIPOS_PRIORITARIOS;
}

// ============================================
// CALCULOS
// ============================================

/**
 * Estado derivado de las fechas.
 *
 * Solo decide el vencimiento: es la unica transicion que ocurre sin que
 * nadie la provoque. Atender o anular son actos deliberados.
 */
export function calcularEstadoSolicitud(
  s: Pick<SolicitudRevision, 'status' | 'fechaLimiteAtencion' | 'fechaAtencion'>
): EstadoSolicitud {
  if (s.status === 'atendida' || s.status === 'anulada') return s.status;
  if (!s.fechaLimiteAtencion) return s.status;

  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const limite = new Date(s.fechaLimiteAtencion + 'T00:00:00');

  return limite < hoy ? 'vencida' : s.status;
}

/** Dias que quedan para el plazo. Negativo si ya vencio. */
export function diasParaAtender(fechaLimite: string): number | null {
  if (!fechaLimite) return null;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const limite = new Date(fechaLimite + 'T00:00:00');
  return Math.round((limite.getTime() - hoy.getTime()) / 86400000);
}

/** Fecha limite sugerida a partir del tipo, contada desde hoy. */
export function calcularFechaLimiteSugerida(tipo: TipoSolicitud): string {
  const d = new Date();
  d.setDate(d.getDate() + plazoSugerido(tipo));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
