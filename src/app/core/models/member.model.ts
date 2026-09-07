// ============================================
// MIEMBRO DE UNA EMPRESA — ARCHIVA
// ============================================
// La pertenencia es lo que ata a una persona con una empresa y le da un
// rol dentro de ella. Es el documento que consultan las reglas de
// Firestore para decidir si alguien puede leer o escribir algo.

import { Rol, ROLES } from './rbac.model';
import { AreaEmisora } from './document.model';

export type EstadoMiembro = 'activo' | 'invitado' | 'suspendido';

export const ESTADOS_MIEMBRO: Record<EstadoMiembro, {
  label: string;
  token: string;
  descripcion: string;
}> = {
  activo: {
    label: 'Activo', token: 'var(--estado-aprobado)',
    descripcion: 'Puede entrar y trabajar con normalidad'
  },
  invitado: {
    label: 'Invitado', token: 'var(--estado-en-revision)',
    descripcion: 'Aún no ha aceptado la invitación'
  },
  suspendido: {
    label: 'Suspendido', token: 'var(--estado-rechazado)',
    descripcion: 'Conserva su historial pero no puede entrar'
  }
};

export interface Miembro {
  /** El identificador del documento es el uid de Firebase Auth. */
  uid: string;
  empresaId: string;

  email: string;
  nombre: string;
  rol: Rol;
  estado: EstadoMiembro;

  /** Área a la que pertenece; acota lo que ve un colaborador. */
  area: AreaEmisora;

  /** Cargo tal como lo escribe la empresa, sin efecto sobre permisos. */
  cargo?: string;

  invitadoPor?: string;
  fechaAlta: string;
  ultimoAcceso?: string;
  actualizadoEl?: string;
}

/** Datos que el administrador rellena al invitar. */
export interface MiembroPayload {
  email: string;
  nombre: string;
  rol: Rol;
  area: AreaEmisora;
  cargo?: string;
}

// ============================================
// CONSULTAS
// ============================================

/** Solo un miembro activo entra: invitado y suspendido no. */
export function puedeEntrar(m: Miembro | null | undefined): boolean {
  return m?.estado === 'activo';
}

export function etiquetaRol(rol: Rol): string {
  return ROLES[rol]?.label ?? rol;
}

/** Iniciales para el avatar, a partir del nombre. */
export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

export function validarMiembro(m: Partial<MiembroPayload>): string | null {
  if (!m.nombre?.trim())          return 'Escribe el nombre de la persona.';
  if (m.nombre.trim().length < 3) return 'El nombre necesita al menos tres caracteres.';
  if (!m.email?.trim())           return 'Hace falta un correo para enviarle la invitación.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(m.email.trim()))
    return 'El correo no tiene un formato válido.';
  if (!m.rol)                     return 'Elige el rol con el que entrará.';
  if (!m.area)                    return 'Indica a qué área pertenece.';
  return null;
}

/**
 * Un administrador no puede dejarse fuera a sí mismo.
 *
 * Sin esta regla, el único administrador podía suspenderse o bajarse de
 * rol y dejar la empresa sin nadie capaz de invitar ni configurar.
 */
export function puedeCambiarse(actorUid: string, objetivoUid: string): boolean {
  return actorUid !== objetivoUid;
}

/** ¿Queda algún administrador activo si este miembro deja de serlo? */
export function quedaOtroAdmin(miembros: Miembro[], uidQueCambia: string): boolean {
  return miembros.some(m =>
    m.uid !== uidQueCambia &&
    m.rol === Rol.ADMIN_EMPRESA &&
    m.estado === 'activo'
  );
}
