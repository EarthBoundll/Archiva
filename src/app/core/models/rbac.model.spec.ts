/**
 * Control de acceso basado en roles.
 *
 * Hasta la transformación multiempresa se escribía `rol` en el perfil y no
 * se comprobaba en ningún sitio: cada cuenta administraba su propio acervo
 * y no había nada que restringir. Estas pruebas fijan la matriz, que es lo
 * que ahora decide qué ve y qué puede hacer cada persona.
 */

import {
  Rol,
  Permiso,
  ROLES,
  PERMISOS_POR_ROL,
  PERMISO_POR_RUTA,
  tienePermiso,
  tieneAlguno,
  tieneTodos,
  nivelDe,
  puedeAsignarRol,
  rolesAsignablesPor,
  listaRoles
} from './rbac.model';

describe('RBAC · matriz de permisos', () => {

  it('declara los cinco roles', () => {
    expect(Object.keys(Rol).length).toBe(5);
    expect(Object.keys(PERMISOS_POR_ROL).length).toBe(5);
  });

  it('cada rol tiene etiqueta, descripción, nivel e icono', () => {
    for (const r of Object.values(Rol)) {
      expect(ROLES[r].label.length).toBeGreaterThan(3);
      expect(ROLES[r].descripcion.length).toBeGreaterThan(10);
      expect(ROLES[r].nivel).toBeGreaterThan(0);
      expect(ROLES[r].icon.length).toBeGreaterThan(0);
    }
  });

  it('los niveles son únicos: la jerarquía tiene que poder ordenarse', () => {
    const niveles = Object.values(Rol).map(nivelDe);
    expect(new Set(niveles).size).toBe(niveles.length);
  });

  it('un rol nulo no tiene ningún permiso', () => {
    expect(tienePermiso(null, Permiso.DOC_VER)).toBe(false);
    expect(tienePermiso(undefined, Permiso.EMPRESA_VER)).toBe(false);
  });

  it('ningún permiso se concede por herencia tácita', () => {
    // La matriz es explícita a propósito: en control de acceso lo que se
    // hereda sin escribirlo es lo que acaba abriendo puertas no queridas.
    for (const r of Object.values(Rol)) {
      for (const p of PERMISOS_POR_ROL[r]) {
        expect(tienePermiso(r, p)).toBe(true);
      }
    }
  });
});

describe('RBAC · lo que cada rol puede', () => {

  it('solo el administrador gestiona la empresa y los roles', () => {
    for (const r of Object.values(Rol)) {
      const esperado = r === Rol.ADMIN_EMPRESA;
      expect(tienePermiso(r, Permiso.EMPRESA_EDITAR)).toBe(esperado);
      expect(tienePermiso(r, Permiso.USUARIOS_EDITAR_ROL)).toBe(esperado);
      expect(tienePermiso(r, Permiso.USUARIOS_INVITAR)).toBe(esperado);
      expect(tienePermiso(r, Permiso.USUARIOS_DESACTIVAR)).toBe(esperado);
    }
  });

  it('el colaborador ve lo suyo, no el acervo completo', () => {
    expect(tienePermiso(Rol.COLABORADOR, Permiso.DOC_VER)).toBe(true);
    expect(tienePermiso(Rol.COLABORADOR, Permiso.DOC_VER_TODOS)).toBe(false);
    expect(tienePermiso(Rol.COLABORADOR, Permiso.DOC_VER_CONFIDENCIAL)).toBe(false);
  });

  it('el colaborador no aprueba', () => {
    expect(tienePermiso(Rol.COLABORADOR, Permiso.APROBAR)).toBe(false);
    expect(tienePermiso(Rol.SUPERVISOR, Permiso.APROBAR)).toBe(true);
    expect(tienePermiso(Rol.JEFE_AREA, Permiso.APROBAR)).toBe(true);
    expect(tienePermiso(Rol.GERENTE, Permiso.APROBAR)).toBe(true);
  });

  it('reasignar de forma definitiva queda por encima de delegar', () => {
    // Delegar mantiene al titular; reasignar transfiere la
    // responsabilidad, así que exige más jerarquía.
    expect(tienePermiso(Rol.JEFE_AREA, Permiso.DELEGAR)).toBe(true);
    expect(tienePermiso(Rol.JEFE_AREA, Permiso.REASIGNAR)).toBe(false);
    expect(tienePermiso(Rol.GERENTE, Permiso.REASIGNAR)).toBe(true);
  });

  it('el supervisor revisa pero no define flujos', () => {
    expect(tienePermiso(Rol.SUPERVISOR, Permiso.FLUJO_VER)).toBe(true);
    expect(tienePermiso(Rol.SUPERVISOR, Permiso.FLUJO_CREAR)).toBe(false);
    expect(tienePermiso(Rol.JEFE_AREA, Permiso.FLUJO_CREAR)).toBe(true);
  });

  it('solo la jefatura y quien administra gestionan el almacenamiento', () => {
    expect(tienePermiso(Rol.ADMIN_EMPRESA, Permiso.ALMACENAMIENTO_GESTIONAR)).toBe(true);
    expect(tienePermiso(Rol.JEFE_AREA, Permiso.ALMACENAMIENTO_GESTIONAR)).toBe(true);
    expect(tienePermiso(Rol.GERENTE, Permiso.ALMACENAMIENTO_GESTIONAR)).toBe(false);
    expect(tienePermiso(Rol.COLABORADOR, Permiso.ALMACENAMIENTO_GESTIONAR)).toBe(false);
  });

  it('todos los roles ven la empresa: es donde trabajan', () => {
    for (const r of Object.values(Rol)) {
      expect(tienePermiso(r, Permiso.EMPRESA_VER)).toBe(true);
    }
  });
});

describe('RBAC · consultas compuestas', () => {

  it('tieneAlguno basta con uno', () => {
    expect(tieneAlguno(Rol.COLABORADOR, [Permiso.APROBAR, Permiso.DOC_CREAR])).toBe(true);
    expect(tieneAlguno(Rol.COLABORADOR, [Permiso.APROBAR, Permiso.EMPRESA_EDITAR])).toBe(false);
  });

  it('tieneTodos los exige todos', () => {
    expect(tieneTodos(Rol.GERENTE, [Permiso.APROBAR, Permiso.DOC_VER_TODOS])).toBe(true);
    expect(tieneTodos(Rol.GERENTE, [Permiso.APROBAR, Permiso.EMPRESA_EDITAR])).toBe(false);
  });
});

describe('RBAC · asignación de roles', () => {

  it('nadie concede un rol por encima del suyo', () => {
    // Sin esta regla, quien administra la jefatura podría nombrarse
    // administrador y quedarse con la empresa.
    expect(puedeAsignarRol(Rol.ADMIN_EMPRESA, Rol.ADMIN_EMPRESA)).toBe(true);
    expect(puedeAsignarRol(Rol.ADMIN_EMPRESA, Rol.COLABORADOR)).toBe(true);
    expect(puedeAsignarRol(Rol.GERENTE, Rol.ADMIN_EMPRESA)).toBe(false);
    expect(puedeAsignarRol(Rol.JEFE_AREA, Rol.GERENTE)).toBe(false);
  });

  it('quien no puede editar roles no asigna ninguno', () => {
    for (const destino of Object.values(Rol)) {
      expect(puedeAsignarRol(Rol.SUPERVISOR, destino)).toBe(false);
      expect(puedeAsignarRol(Rol.COLABORADOR, destino)).toBe(false);
      expect(puedeAsignarRol(null, destino)).toBe(false);
    }
  });

  it('el administrador puede otorgar los cinco roles', () => {
    expect(rolesAsignablesPor(Rol.ADMIN_EMPRESA).length).toBe(5);
    expect(rolesAsignablesPor(Rol.GERENTE).length).toBe(0);
  });

  it('la lista para desplegables va de mayor a menor jerarquía', () => {
    const lista = listaRoles();
    expect(lista[0].value).toBe(Rol.ADMIN_EMPRESA);
    expect(lista[lista.length - 1].value).toBe(Rol.COLABORADOR);

    for (let i = 1; i < lista.length; i++) {
      expect(lista[i - 1].nivel).toBeGreaterThan(lista[i].nivel);
    }
  });
});

describe('RBAC · permisos por ruta', () => {

  it('cada ruta protegida declara el permiso que exige', () => {
    for (const [ruta, permiso] of Object.entries(PERMISO_POR_RUTA)) {
      expect(ruta.length).toBeGreaterThan(0);
      expect(Object.values(Permiso)).toContain(permiso);
    }
  });

  it('las secciones de administración exigen permisos que solo tiene el admin', () => {
    expect(tienePermiso(Rol.COLABORADOR, PERMISO_POR_RUTA['usuarios'])).toBe(false);
    expect(tienePermiso(Rol.ADMIN_EMPRESA, PERMISO_POR_RUTA['usuarios'])).toBe(true);
  });

  it('un colaborador no alcanza la bandeja de aprobaciones', () => {
    expect(tienePermiso(Rol.COLABORADOR, PERMISO_POR_RUTA['bandeja'])).toBe(false);
    expect(tienePermiso(Rol.SUPERVISOR, PERMISO_POR_RUTA['bandeja'])).toBe(true);
  });

  it('todos los roles alcanzan el tablero', () => {
    for (const r of Object.values(Rol)) {
      expect(tienePermiso(r, PERMISO_POR_RUTA['dashboard'])).toBe(true);
    }
  });
});
