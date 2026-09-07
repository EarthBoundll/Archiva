// ============================================
// INVITACIONES — ARCHIVA
// ============================================
// ARCHIVA es software empresarial: nadie crea su cuenta por su cuenta.
// Un administrador invita, la persona recibe un enlace con un testigo de
// un solo uso y ahí elige su contraseña.

import { Rol } from './rbac.model';
import { AreaEmisora } from './document.model';

export type EstadoInvitacion = 'pendiente' | 'aceptada' | 'revocada' | 'expirada';

export const ESTADOS_INVITACION: Record<EstadoInvitacion, {
  label: string;
  token: string;
  descripcion: string;
}> = {
  pendiente: {
    label: 'Pendiente', token: 'var(--estado-en-revision)',
    descripcion: 'Enviada, a la espera de que la acepten'
  },
  aceptada: {
    label: 'Aceptada', token: 'var(--estado-aprobado)',
    descripcion: 'La persona ya tiene cuenta y puede entrar'
  },
  revocada: {
    label: 'Revocada', token: 'var(--estado-rechazado)',
    descripcion: 'Anulada antes de aceptarse'
  },
  expirada: {
    label: 'Expirada', token: 'var(--estado-vencido)',
    descripcion: 'Pasó su plazo sin aceptarse'
  }
};

/** Días de validez del enlace. */
export const DIAS_VIGENCIA_INVITACION = 7;

export interface Invitacion {
  id: string;
  empresaId: string;
  /** Nombre de la empresa, para mostrarlo sin leer otro documento. */
  empresaNombre: string;

  email: string;
  nombre: string;
  rol: Rol;
  area: AreaEmisora;
  cargo?: string;

  /** Testigo de un solo uso que viaja en el enlace. */
  token: string;

  estado: EstadoInvitacion;
  invitadaPor: string;
  invitadaPorNombre: string;

  fechaEnvio: string;
  fechaExpira: string;
  fechaAceptada?: string;
  fechaRevocada?: string;
  motivoRevocacion?: string;
}

export interface InvitacionPayload {
  email: string;
  nombre: string;
  rol: Rol;
  area: AreaEmisora;
  cargo?: string;
}

// ============================================
// TESTIGO
// ============================================

/**
 * Testigo aleatorio de 32 caracteres hexadecimales.
 *
 * Se usa crypto.getRandomValues, no Math.random: un testigo de invitación
 * concede acceso a una empresa, y Math.random es predecible.
 */
export function generarToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export function esTokenValido(token: string): boolean {
  return /^[0-9a-f]{32}$/.test(token.trim());
}

// ============================================
// VIGENCIA
// ============================================

export function fechaExpiracion(desde = new Date()): string {
  const d = new Date(desde);
  d.setDate(d.getDate() + DIAS_VIGENCIA_INVITACION);
  return d.toISOString();
}

export function haExpirado(inv: Pick<Invitacion, 'fechaExpira'>, ahora = new Date()): boolean {
  return new Date(inv.fechaExpira).getTime() < ahora.getTime();
}

/**
 * Estado real de la invitación.
 *
 * La expiración se deriva de la fecha, no se guarda: una invitación
 * caducada seguiría figurando como pendiente hasta que alguien la abriera.
 */
export function estadoReal(inv: Invitacion, ahora = new Date()): EstadoInvitacion {
  if (inv.estado !== 'pendiente') return inv.estado;
  return haExpirado(inv, ahora) ? 'expirada' : 'pendiente';
}

export function esAceptable(inv: Invitacion, ahora = new Date()): boolean {
  return estadoReal(inv, ahora) === 'pendiente';
}

/** Días que le quedan, o cero si ya venció. */
export function diasRestantes(inv: Invitacion, ahora = new Date()): number {
  const ms = new Date(inv.fechaExpira).getTime() - ahora.getTime();
  return Math.max(0, Math.ceil(ms / 86400000));
}

/** Enlace que se copia y se envía a la persona invitada. */
export function enlaceInvitacion(token: string, origen = ''): string {
  const base = origen || (typeof location !== 'undefined'
    ? location.origin + location.pathname.replace(/\/[^/]*$/, '')
    : '');
  return `${base}/invitacion/${token}`;
}

// ============================================
// VALIDACION
// ============================================

/** Longitud mínima de contraseña al aceptar la invitación. */
export const MIN_CONTRASENA = 8;

export function validarContrasena(c: string): string | null {
  if (!c) return 'Elige una contraseña.';
  if (c.length < MIN_CONTRASENA) return `La contraseña necesita al menos ${MIN_CONTRASENA} caracteres.`;
  if (!/[0-9]/.test(c))          return 'La contraseña necesita al menos un número.';
  if (!/[A-ZÑ]/.test(c))         return 'La contraseña necesita al menos una mayúscula.';
  return null;
}
