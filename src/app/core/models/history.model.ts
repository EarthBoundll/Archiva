// ============================================
// BITACORA DOCUMENTAL - ARCHIVA
// ============================================
// Registro permanente de todo lo que le ocurre a un documento. No se edita
// ni se borra: es la evidencia del proceso ante una auditoria.

/** Las ocho acciones que dejan rastro en la bitacora. */
export type AccionDocumental =
  | 'creacion'
  | 'edicion'
  | 'nueva_version'
  | 'envio_revision'
  | 'aprobacion'
  | 'observacion'
  | 'rechazo'
  | 'archivado';

/**
 * Entrada suma al acervo activo, salida lo retira.
 * Sustituye al par ingreso/gasto y conserva su aritmetica acumulada.
 */
export type TipoMovimiento = 'entrada' | 'salida';

export const ACCIONES: Record<AccionDocumental, {
  label: string;
  icon: string;
  tipo: TipoMovimiento;
  token: string;
  frase: string;
}> = {
  creacion: {
    label: 'Creación', icon: 'file-plus', tipo: 'entrada',
    token: 'var(--estado-borrador)', frase: 'registró el documento'
  },
  edicion: {
    label: 'Edición', icon: 'file-pen', tipo: 'entrada',
    token: 'var(--estado-borrador)', frase: 'editó la ficha'
  },
  nueva_version: {
    label: 'Nueva versión', icon: 'copy-plus', tipo: 'entrada',
    token: 'var(--estado-en-revision)', frase: 'registró una versión nueva'
  },
  envio_revision: {
    label: 'Envío a revisión', icon: 'send', tipo: 'entrada',
    token: 'var(--estado-en-revision)', frase: 'lo envió a revisión'
  },
  aprobacion: {
    label: 'Aprobación', icon: 'file-check', tipo: 'entrada',
    token: 'var(--estado-aprobado)', frase: 'aprobó el documento'
  },
  observacion: {
    label: 'Observación', icon: 'file-warning', tipo: 'salida',
    token: 'var(--estado-observado)', frase: 'lo devolvió con observaciones'
  },
  rechazo: {
    label: 'Rechazo', icon: 'file-x', tipo: 'salida',
    token: 'var(--estado-rechazado)', frase: 'rechazó el documento'
  },
  archivado: {
    label: 'Archivado', icon: 'archive', tipo: 'salida',
    token: 'var(--estado-archivado)', frase: 'lo envió al archivo'
  }
};

export interface RegistroHistorial {
  id: string;
  userId: string;

  documentoId: string | null;
  codigo: string;
  titulo: string;

  accion: AccionDocumental;
  tipo: TipoMovimiento;
  version: number;
  responsable: string;
  detalle?: string;

  category?: string;
  date: string;
  time?: string;

  createdAt: string;
  updatedAt: string;
}

export interface RegistroHistorialPayload {
  documentoId?: string | null;
  codigo: string;
  titulo: string;
  accion: AccionDocumental;
  version?: number;
  responsable: string;
  detalle?: string;
  category?: string;
  date: string;
}

/** Deduce el tipo de movimiento a partir de la accion. */
export function tipoDeAccion(accion: AccionDocumental): TipoMovimiento {
  return ACCIONES[accion]?.tipo ?? 'entrada';
}

export function etiquetaAccion(accion: AccionDocumental): string {
  return ACCIONES[accion]?.label ?? accion;
}
