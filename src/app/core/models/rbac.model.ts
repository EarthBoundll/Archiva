// ============================================
// CONTROL DE ACCESO BASADO EN ROLES — ARCHIVA
// ============================================
// Cinco roles con permisos declarados en una matriz, no cadenas sueltas
// repartidas por el codigo.
//
// Hasta ahora se escribia `rol: 'responsable_archivo'` al registrarse y no
// se comprobaba en ningun sitio: cada usuario administraba su propio
// acervo completo y no habia nada que restringir.

/** Los cinco roles de una empresa archivante. */
export enum Rol {
  ADMIN_EMPRESA = 'ADMIN_EMPRESA',
  GERENTE       = 'GERENTE',
  JEFE_AREA     = 'JEFE_AREA',
  SUPERVISOR    = 'SUPERVISOR',
  COLABORADOR   = 'COLABORADOR'
}

/**
 * Permiso concreto sobre el sistema.
 *
 * Se nombran por lo que la persona hace, no por la pantalla donde lo hace:
 * un permiso sobrevive a un rediseño de la interfaz.
 */
export enum Permiso {
  // Empresa
  EMPRESA_VER          = 'EMPRESA_VER',
  EMPRESA_EDITAR       = 'EMPRESA_EDITAR',

  // Personas
  USUARIOS_VER         = 'USUARIOS_VER',
  USUARIOS_INVITAR     = 'USUARIOS_INVITAR',
  USUARIOS_EDITAR_ROL  = 'USUARIOS_EDITAR_ROL',
  USUARIOS_DESACTIVAR  = 'USUARIOS_DESACTIVAR',

  // Documentos
  DOC_VER              = 'DOC_VER',
  DOC_VER_TODOS        = 'DOC_VER_TODOS',
  DOC_CREAR            = 'DOC_CREAR',
  DOC_EDITAR           = 'DOC_EDITAR',
  DOC_ENVIAR_REVISION  = 'DOC_ENVIAR_REVISION',
  DOC_ARCHIVAR         = 'DOC_ARCHIVAR',
  DOC_VER_CONFIDENCIAL = 'DOC_VER_CONFIDENCIAL',

  // Solicitudes
  SOL_VER              = 'SOL_VER',
  SOL_CREAR            = 'SOL_CREAR',
  SOL_ATENDER          = 'SOL_ATENDER',
  SOL_ANULAR           = 'SOL_ANULAR',

  // Flujos
  FLUJO_VER            = 'FLUJO_VER',
  FLUJO_CREAR          = 'FLUJO_CREAR',
  FLUJO_EDITAR         = 'FLUJO_EDITAR',
  FLUJO_ANULAR         = 'FLUJO_ANULAR',

  // Aprobaciones
  APROBAR              = 'APROBAR',
  DELEGAR              = 'DELEGAR',
  REASIGNAR            = 'REASIGNAR',

  // Otros
  ALMACENAMIENTO_GESTIONAR = 'ALMACENAMIENTO_GESTIONAR',
  BITACORA_VER             = 'BITACORA_VER',
  INDICADORES_VER          = 'INDICADORES_VER'
}

export const ROLES: Record<Rol, {
  label: string;
  descripcion: string;
  /** Orden jerarquico: mayor puede reasignar trabajo a menor. */
  nivel: number;
  icon: string;
}> = {
  [Rol.ADMIN_EMPRESA]: {
    label: 'Administrador de empresa',
    descripcion: 'Configura la empresa, invita personas y asigna roles',
    nivel: 5,
    icon: 'user-cog'
  },
  [Rol.GERENTE]: {
    label: 'Gerencia',
    descripcion: 'Aprueba en cualquier etapa y ve todo el acervo',
    nivel: 4,
    icon: 'stamp'
  },
  [Rol.JEFE_AREA]: {
    label: 'Jefatura de área',
    descripcion: 'Aprueba lo de su área, define flujos y gestiona cuotas',
    nivel: 3,
    icon: 'building-2'
  },
  [Rol.SUPERVISOR]: {
    label: 'Supervisión',
    descripcion: 'Revisa, observa y atiende solicitudes',
    nivel: 2,
    icon: 'search-check'
  },
  [Rol.COLABORADOR]: {
    label: 'Colaborador',
    descripcion: 'Registra documentos y los envía a revisión',
    nivel: 1,
    icon: 'user'
  }
};

/**
 * Qué puede hacer cada rol.
 *
 * La matriz es explícita a propósito: un permiso heredado por nivel se
 * concede sin que nadie lo escriba, y en control de acceso lo tácito es
 * exactamente lo que acaba abriendo una puerta que nadie quería abrir.
 */
export const PERMISOS_POR_ROL: Record<Rol, readonly Permiso[]> = {

  [Rol.ADMIN_EMPRESA]: [
    Permiso.EMPRESA_VER, Permiso.EMPRESA_EDITAR,
    Permiso.USUARIOS_VER, Permiso.USUARIOS_INVITAR,
    Permiso.USUARIOS_EDITAR_ROL, Permiso.USUARIOS_DESACTIVAR,
    Permiso.DOC_VER, Permiso.DOC_VER_TODOS, Permiso.DOC_CREAR, Permiso.DOC_EDITAR,
    Permiso.DOC_ENVIAR_REVISION, Permiso.DOC_ARCHIVAR, Permiso.DOC_VER_CONFIDENCIAL,
    Permiso.SOL_VER, Permiso.SOL_CREAR, Permiso.SOL_ATENDER, Permiso.SOL_ANULAR,
    Permiso.FLUJO_VER, Permiso.FLUJO_CREAR, Permiso.FLUJO_EDITAR, Permiso.FLUJO_ANULAR,
    Permiso.APROBAR, Permiso.DELEGAR, Permiso.REASIGNAR,
    Permiso.ALMACENAMIENTO_GESTIONAR, Permiso.BITACORA_VER, Permiso.INDICADORES_VER
  ],

  [Rol.GERENTE]: [
    Permiso.EMPRESA_VER,
    Permiso.USUARIOS_VER,
    Permiso.DOC_VER, Permiso.DOC_VER_TODOS, Permiso.DOC_CREAR, Permiso.DOC_EDITAR,
    Permiso.DOC_ENVIAR_REVISION, Permiso.DOC_ARCHIVAR, Permiso.DOC_VER_CONFIDENCIAL,
    Permiso.SOL_VER, Permiso.SOL_CREAR, Permiso.SOL_ATENDER, Permiso.SOL_ANULAR,
    Permiso.FLUJO_VER, Permiso.FLUJO_CREAR, Permiso.FLUJO_EDITAR,
    Permiso.APROBAR, Permiso.DELEGAR, Permiso.REASIGNAR,
    Permiso.BITACORA_VER, Permiso.INDICADORES_VER
  ],

  [Rol.JEFE_AREA]: [
    Permiso.EMPRESA_VER,
    Permiso.USUARIOS_VER,
    Permiso.DOC_VER, Permiso.DOC_VER_TODOS, Permiso.DOC_CREAR, Permiso.DOC_EDITAR,
    Permiso.DOC_ENVIAR_REVISION, Permiso.DOC_ARCHIVAR, Permiso.DOC_VER_CONFIDENCIAL,
    Permiso.SOL_VER, Permiso.SOL_CREAR, Permiso.SOL_ATENDER,
    Permiso.FLUJO_VER, Permiso.FLUJO_CREAR, Permiso.FLUJO_EDITAR,
    Permiso.APROBAR, Permiso.DELEGAR,
    Permiso.ALMACENAMIENTO_GESTIONAR, Permiso.BITACORA_VER, Permiso.INDICADORES_VER
  ],

  [Rol.SUPERVISOR]: [
    Permiso.EMPRESA_VER,
    Permiso.USUARIOS_VER,
    Permiso.DOC_VER, Permiso.DOC_VER_TODOS, Permiso.DOC_CREAR, Permiso.DOC_EDITAR,
    Permiso.DOC_ENVIAR_REVISION,
    Permiso.SOL_VER, Permiso.SOL_CREAR, Permiso.SOL_ATENDER,
    Permiso.FLUJO_VER,
    Permiso.APROBAR,
    Permiso.BITACORA_VER, Permiso.INDICADORES_VER
  ],

  [Rol.COLABORADOR]: [
    Permiso.EMPRESA_VER,
    // Ve solo lo suyo: sin DOC_VER_TODOS ni DOC_VER_CONFIDENCIAL.
    Permiso.DOC_VER, Permiso.DOC_CREAR, Permiso.DOC_EDITAR, Permiso.DOC_ENVIAR_REVISION,
    Permiso.SOL_VER, Permiso.SOL_CREAR,
    Permiso.FLUJO_VER,
    Permiso.BITACORA_VER
  ]
};

// ============================================
// CONSULTAS
// ============================================

export function tienePermiso(rol: Rol | null | undefined, permiso: Permiso): boolean {
  if (!rol) return false;
  return PERMISOS_POR_ROL[rol]?.includes(permiso) ?? false;
}

export function tieneAlguno(rol: Rol | null | undefined, permisos: Permiso[]): boolean {
  return permisos.some(p => tienePermiso(rol, p));
}

export function tieneTodos(rol: Rol | null | undefined, permisos: Permiso[]): boolean {
  return permisos.every(p => tienePermiso(rol, p));
}

export function nivelDe(rol: Rol | null | undefined): number {
  return rol ? ROLES[rol]?.nivel ?? 0 : 0;
}

/**
 * Quién puede asignar qué rol.
 *
 * Nadie concede un rol por encima del suyo: sin esta regla un jefe de área
 * podría nombrarse administrador y quedarse con la empresa.
 */
export function puedeAsignarRol(quienAsigna: Rol | null, rolDestino: Rol): boolean {
  if (!tienePermiso(quienAsigna, Permiso.USUARIOS_EDITAR_ROL)) return false;
  return nivelDe(quienAsigna) >= nivelDe(rolDestino);
}

/** Roles que este rol puede otorgar. */
export function rolesAsignablesPor(rol: Rol | null): Rol[] {
  return Object.values(Rol).filter(r => puedeAsignarRol(rol, r));
}

/** Lista para desplegables, de mayor a menor jerarquía. */
export function listaRoles(): Array<{ value: Rol } & typeof ROLES[Rol]> {
  return Object.values(Rol)
    .map(r => ({ value: r, ...ROLES[r] }))
    .sort((a, b) => b.nivel - a.nivel);
}

/** Rutas y el permiso que exige cada una. */
export const PERMISO_POR_RUTA: Record<string, Permiso> = {
  'dashboard':      Permiso.DOC_VER,
  'documentos':     Permiso.DOC_VER,
  'solicitudes':    Permiso.SOL_VER,
  'historial':      Permiso.BITACORA_VER,
  'flujos':         Permiso.FLUJO_VER,
  'bandeja':        Permiso.APROBAR,
  'almacenamiento': Permiso.ALMACENAMIENTO_GESTIONAR,
  'archivo':        Permiso.DOC_VER,
  'alertas':        Permiso.DOC_VER,
  'indicadores':    Permiso.INDICADORES_VER,
  'usuarios':       Permiso.USUARIOS_VER,
  'configuracion':  Permiso.EMPRESA_VER
};
