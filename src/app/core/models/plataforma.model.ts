import { Permiso, Rol } from './rbac.model';
import { Miembro } from './member.model';
import { AreaEmisora } from './document.model';

/**
 * El operador de plataforma.
 *
 * No es un rol empresarial y no está en `PERMISOS_POR_ROL`: quien opera la
 * plataforma no pertenece a ninguna empresa, y meterlo en esa matriz
 * obligaría a definir sus permisos dentro de la ficha de cada cliente.
 *
 * Su condición vive en `superadmins/{uid}`. El documento vale por existir;
 * estos campos son informativos y ninguna regla los lee.
 */
export interface OperadorPlataforma {
  uid: string;
  email: string;
  nombre: string;
  fechaAlta?: string;
  altaPor?: string;
}

/**
 * Lo que un operador puede hacer dentro de una empresa que visita.
 *
 * Esta lista existe por un motivo concreto y desagradable: la pertenencia
 * sintética con la que entra lleva rol de administrador de empresa, porque
 * es el único que abre todas las pantallas y hace que la navegación
 * funcione sin excepciones. Pero ese rol tiene, en la matriz, permiso para
 * editar y archivar documentos, aprobar etapas, anular solicitudes y
 * editar flujos — las cinco cosas que la decisión de gobierno prohíbe.
 *
 * Así que el rol no decide solo. Esta lista se consulta ANTES, y lo que no
 * está escrito aquí no se concede, aunque el rol lo tenga. Nada de
 * herencia tácita: en control de acceso, lo que se hereda sin escribirlo
 * es lo que acaba abriendo una puerta que nadie quería abrir.
 *
 * Lo que falta es tan deliberado como lo que está:
 *
 *   · Nada de escritura sobre contenido del cliente.
 *   · Nada de aprobar: las decisiones son suyas, siempre.
 *   · Nada de tocar su plantilla ni los roles de su gente.
 *   · Nada de ver lo que marcaron como confidencial.
 *   · Nada de gestionar cuotas todavía: está aprobado como función, pero
 *     las reglas no conceden esa escritura hasta que llegue su pantalla.
 *     Un permiso que no se puede ejercer no debe ofrecerse.
 */
export const PERMITIDOS_EN_SOPORTE: readonly Permiso[] = [
  // La empresa y su identidad visual: es la función administrativa.
  Permiso.EMPRESA_VER,
  Permiso.EMPRESA_EDITAR,

  // Ver quién hay. Sin esto, el soporte es a ciegas.
  Permiso.USUARIOS_VER,

  // Diagnosticar sin tocar.
  Permiso.DOC_VER,
  Permiso.DOC_VER_TODOS,
  Permiso.SOL_VER,
  Permiso.FLUJO_VER,

  // Consultar el rastro.
  Permiso.BITACORA_VER,
  Permiso.INDICADORES_VER
] as const;

/** ¿Cabe este permiso dentro del soporte de plataforma? */
export function permitidoEnSoporte(permiso: Permiso): boolean {
  return PERMITIDOS_EN_SOPORTE.includes(permiso);
}

/**
 * Los que el operador nunca tiene, escritos uno a uno.
 *
 * Es redundante con la lista blanca —lo que no está permitido, está
 * negado— y esa redundancia es el punto: convierte la decisión de gobierno
 * en algo que se puede leer y comprobar, en vez de deducir por ausencia.
 * Hay una prueba que recorre esta lista.
 */
export const PROHIBIDOS_EN_SOPORTE: readonly Permiso[] = [
  Permiso.DOC_CREAR,
  Permiso.DOC_EDITAR,
  Permiso.DOC_ARCHIVAR,
  Permiso.DOC_ENVIAR_REVISION,
  Permiso.DOC_VER_CONFIDENCIAL,

  Permiso.SOL_CREAR,
  Permiso.SOL_ATENDER,
  Permiso.SOL_ANULAR,

  Permiso.FLUJO_CREAR,
  Permiso.FLUJO_EDITAR,
  Permiso.FLUJO_ANULAR,

  Permiso.APROBAR,
  Permiso.DELEGAR,
  Permiso.REASIGNAR,

  Permiso.USUARIOS_INVITAR,
  Permiso.USUARIOS_EDITAR_ROL,
  Permiso.USUARIOS_DESACTIVAR,

  Permiso.ALMACENAMIENTO_GESTIONAR
] as const;

/**
 * La pertenencia que se construye al entrar en una empresa.
 *
 * Nunca se escribe. Su única función es poblar la señal de la que derivan
 * el identificador de empresa, el rol, el uid y el nombre — y con ellos,
 * los veintiocho puntos de servicio y las veintisiete comprobaciones de
 * permiso, que así funcionan sin enterarse de que quien mira es de
 * plataforma.
 *
 * Es indistinguible en forma de una pertenencia real, a propósito: si
 * llevara una marca propia, los cinco servicios que usan este tipo
 * tendrían que conocer dos formas. La distinción vive en el modo
 * plataforma, que es donde corresponde.
 */
export function pertenenciaSintetica(
  operador: OperadorPlataforma,
  empresaId: string
): Miembro {
  return {
    uid: operador.uid,
    empresaId,
    email: operador.email,
    nombre: operador.nombre || operador.email,

    // El único rol que abre todas las pantallas. Lo que no debe conceder
    // lo corta PERMITIDOS_EN_SOPORTE, no el rol.
    rol: Rol.ADMIN_EMPRESA,
    estado: 'activo',

    area: 'administracion' as AreaEmisora,
    cargo: 'Soporte de plataforma',

    // Deja claro que es de la sesión y no un alta real.
    fechaAlta: new Date().toISOString()
  };
}

// ============================================
// RETENCION DE LA EMPRESA VISITADA
// ============================================

/**
 * Dónde se recuerda la empresa que se está visitando.
 *
 * En el almacenamiento de sesión porque el requisito tiene dos mitades que
 * se contradicen: una recarga no debe sacar al operador de la empresa que
 * revisaba, y a la vez no debe quedarse dentro indefinidamente. Esa es
 * exactamente la semántica de este almacén — sobrevive a la recarga, muere
 * al cerrar la pestaña.
 *
 * Y no se comparte entre pestañas, que es una ventaja menos obvia: permite
 * tener dos clientes abiertos en paralelo sin que uno arrastre al otro.
 *
 * Es manipulable, y no importa: retener un identificador no concede nada.
 * Lo que concede acceso son las reglas del servidor, que comprueban la
 * condición de operador contra la base de datos y no contra esta clave.
 */
const CLAVE_EMPRESA = 'archiva_plataforma_empresa';

export function recordarEmpresa(empresaId: string): void {
  try {
    sessionStorage.setItem(CLAVE_EMPRESA, empresaId);
  } catch {
    // Navegación privada o almacenamiento bloqueado. La degradación
    // correcta es perder la retención, no romper la sesión.
  }
}

export function empresaRecordada(): string | null {
  try {
    return sessionStorage.getItem(CLAVE_EMPRESA);
  } catch {
    return null;
  }
}

export function olvidarEmpresa(): void {
  try {
    sessionStorage.removeItem(CLAVE_EMPRESA);
  } catch { /* ídem */ }
}
