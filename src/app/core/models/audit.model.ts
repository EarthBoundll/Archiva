// ============================================
// TRAZABILIDAD — ARCHIVA
// ============================================
// Quién hizo qué, sobre qué, cuándo y desde dónde. Es la evidencia que se
// presenta ante una auditoría, así que no se edita ni se borra: solo se
// añade.

export type EntidadAuditada =
  | 'empresa' | 'usuario' | 'invitacion' | 'documento'
  | 'solicitud' | 'flujo' | 'tarea' | 'cuota' | 'sesion';

export type AccionAuditada =
  | 'creo' | 'edito' | 'elimino'
  | 'aprobo' | 'observo' | 'rechazo' | 'solicito_correccion'
  | 'delego' | 'reasigno'
  | 'envio_revision' | 'archivo'
  | 'invito' | 'revoco' | 'acepto_invitacion'
  | 'cambio_rol' | 'suspendio' | 'reactivo'
  | 'inicio_sesion' | 'cerro_sesion';

export const ACCIONES_AUDITADAS: Record<AccionAuditada, { frase: string; token: string }> = {
  creo:                { frase: 'creó',                       token: 'var(--estado-borrador)' },
  edito:               { frase: 'editó',                      token: 'var(--estado-borrador)' },
  elimino:             { frase: 'eliminó',                    token: 'var(--estado-archivado)' },
  aprobo:              { frase: 'aprobó',                     token: 'var(--estado-aprobado)' },
  observo:             { frase: 'observó',                    token: 'var(--estado-observado)' },
  rechazo:             { frase: 'rechazó',                    token: 'var(--estado-rechazado)' },
  solicito_correccion: { frase: 'solicitó corrección de',     token: 'var(--estado-borrador)' },
  delego:              { frase: 'delegó',                     token: 'var(--estado-en-revision)' },
  reasigno:            { frase: 'reasignó',                   token: 'var(--estado-pendiente)' },
  envio_revision:      { frase: 'envió a revisión',           token: 'var(--estado-en-revision)' },
  archivo:             { frase: 'archivó',                    token: 'var(--estado-archivado)' },
  invito:              { frase: 'invitó a',                   token: 'var(--estado-en-revision)' },
  revoco:              { frase: 'revocó la invitación de',    token: 'var(--estado-rechazado)' },
  acepto_invitacion:   { frase: 'aceptó la invitación',       token: 'var(--estado-aprobado)' },
  cambio_rol:          { frase: 'cambió el rol de',           token: 'var(--estado-pendiente)' },
  suspendio:           { frase: 'suspendió a',                token: 'var(--estado-rechazado)' },
  reactivo:            { frase: 'reactivó a',                 token: 'var(--estado-aprobado)' },
  inicio_sesion:       { frase: 'inició sesión',              token: 'var(--estado-borrador)' },
  cerro_sesion:        { frase: 'cerró sesión',               token: 'var(--estado-archivado)' }
};

export interface AsientoAuditoria {
  id: string;
  empresaId: string;

  // Quién
  actorUid: string;
  actorNombre: string;
  actorRol: string;

  // Qué
  accion: AccionAuditada;
  entidad: EntidadAuditada;
  entidadId: string;
  /** Cómo se llama lo afectado, para leer el asiento sin ir a buscarlo. */
  entidadEtiqueta: string;

  /** Detalle en palabras: el motivo de un rechazo, el rol anterior… */
  detalle?: string;

  // Cuándo
  fecha: string;   // AAAA-MM-DD
  hora: string;    // HH:MM
  timestamp: string;

  // Desde dónde
  /**
   * Dirección de red del cliente.
   *
   * Un navegador no puede conocerla por sí mismo: haría falta que el
   * servidor la registre. Queda declarada y sin rellenar hasta que exista
   * una función de servidor, en lugar de inventar un valor que en una
   * auditoría sería peor que la ausencia.
   */
  ip?: string;
  agente?: string;
}

export interface AsientoPayload {
  accion: AccionAuditada;
  entidad: EntidadAuditada;
  entidadId: string;
  entidadEtiqueta: string;
  detalle?: string;
}

/** Frase completa del asiento, tal como se lee en pantalla. */
export function narrar(a: AsientoAuditoria): string {
  const verbo = ACCIONES_AUDITADAS[a.accion]?.frase ?? a.accion;
  return `${a.actorNombre} ${verbo} ${a.entidadEtiqueta}`;
}

export function tokenDe(accion: AccionAuditada): string {
  return ACCIONES_AUDITADAS[accion]?.token ?? 'var(--color-text-muted)';
}

/** Agrupa por día, que es como se lee un registro de auditoría. */
export function agruparPorDia(asientos: AsientoAuditoria[]): Array<{
  fecha: string;
  asientos: AsientoAuditoria[];
}> {
  const mapa = new Map<string, AsientoAuditoria[]>();
  for (const a of asientos) {
    if (!mapa.has(a.fecha)) mapa.set(a.fecha, []);
    mapa.get(a.fecha)!.push(a);
  }
  return [...mapa.entries()]
    .sort((x, y) => y[0].localeCompare(x[0]))
    .map(([fecha, lista]) => ({
      fecha,
      asientos: lista.sort((p, q) => q.timestamp.localeCompare(p.timestamp))
    }));
}
