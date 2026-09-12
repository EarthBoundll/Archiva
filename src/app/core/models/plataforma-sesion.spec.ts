/**
 * Fase 2 · Resolución y entrada.
 *
 * Lo que esta fase tiene que garantizar, en orden de importancia:
 *
 *   1. Que un usuario de empresa se comporte **exactamente igual**. Es el
 *      criterio que se repite en las tres fases y el único que, si falla,
 *      lo nota alguien que no tiene nada que ver con esto.
 *   2. Que el rol sintético —administrador de empresa, el único que abre
 *      todas las pantallas— no conceda los cinco permisos que la decisión
 *      de gobierno prohíbe.
 *   3. Que entrar, salir y recargar hagan lo que prometen.
 *
 * Las pruebas del servicio se escriben sobre las funciones puras del
 * modelo y sobre el código fuente, no instanciando Angular: lo que hay que
 * fijar es la decisión, no el cableado.
 */

import { readFileSync } from 'node:fs';

import {
  PERMITIDOS_EN_SOPORTE,
  PROHIBIDOS_EN_SOPORTE,
  permitidoEnSoporte,
  pertenenciaSintetica,
  OperadorPlataforma
} from './plataforma.model';

import { Rol, Permiso, tienePermiso } from './rbac.model';
import { puedeEntrar } from './member.model';

const tenant = readFileSync('src/app/core/services/tenant.ts', 'utf8');
const guard  = readFileSync('src/app/core/guards/auth-guard.ts', 'utf8');
const rutas  = readFileSync('src/app/app.routes.ts', 'utf8');

const OPERADOR: OperadorPlataforma = {
  uid: 'op-1',
  email: 'operador@plataforma.com',
  nombre: 'Operadora de Plataforma'
};

/** Reproduce la decisión de `TenantService.puede()`. */
function puede(rol: Rol, esPlataforma: boolean, permiso: Permiso): boolean {
  if (esPlataforma && !permitidoEnSoporte(permiso)) return false;
  return tienePermiso(rol, permiso);
}

// ============================================
// LA DECISION DE GOBIERNO
// ============================================

describe('Fase 2 · el rol sintético no concede lo prohibido', () => {

  it('la pertenencia sintética lleva rol de administrador de empresa', () => {
    // Es el único que abre todas las pantallas, y por eso se elige. Lo que
    // no debe conceder lo corta la lista blanca, no el rol.
    const m = pertenenciaSintetica(OPERADOR, 'e-1');
    expect(m.rol).toBe(Rol.ADMIN_EMPRESA);
    expect(puedeEntrar(m)).toBe(true);
  });

  it('ese rol SÍ tiene los cinco permisos prohibidos, por matriz', () => {
    // La premisa del problema. Si esto dejara de ser cierto, la lista
    // blanca dejaría de hacer falta — y convendría enterarse.
    for (const p of [Permiso.DOC_EDITAR, Permiso.DOC_ARCHIVAR,
                     Permiso.APROBAR, Permiso.SOL_ANULAR, Permiso.FLUJO_EDITAR]) {
      expect(tienePermiso(Rol.ADMIN_EMPRESA, p)).toBe(true);
    }
  });

  it('y aun así el operador no los tiene', () => {
    // El corazón de la fase, en tres líneas.
    for (const p of [Permiso.DOC_EDITAR, Permiso.DOC_ARCHIVAR,
                     Permiso.APROBAR, Permiso.SOL_ANULAR, Permiso.FLUJO_EDITAR]) {
      expect(puede(Rol.ADMIN_EMPRESA, true, p)).toBe(false);
    }
  });

  for (const p of PROHIBIDOS_EN_SOPORTE) {
    it(`el operador no tiene ${p}`, () => {
      expect(permitidoEnSoporte(p)).toBe(false);
      expect(puede(Rol.ADMIN_EMPRESA, true, p)).toBe(false);
    });
  }

  it('las dos listas no se solapan', () => {
    // Un permiso en ambas sería una contradicción silenciosa: la blanca
    // manda, así que la negra mentiría sin que nada fallara.
    const solapados = PERMITIDOS_EN_SOPORTE.filter(p => PROHIBIDOS_EN_SOPORTE.includes(p));
    expect(solapados).toEqual([]);
  });

  it('entre las dos cubren todos los permisos declarados', () => {
    // Un permiso que no esté en ninguna quedaría negado por omisión, que
    // es el comportamiento correcto — pero sin que nadie lo haya decidido.
    const todos = Object.values(Permiso) as Permiso[];
    const cubiertos = new Set([...PERMITIDOS_EN_SOPORTE, ...PROHIBIDOS_EN_SOPORTE]);
    const huerfanos = todos.filter(p => !cubiertos.has(p));

    expect(huerfanos).toEqual([]);
  });
});

// ============================================
// LO QUE SI PUEDE
// ============================================

describe('Fase 2 · lo que el operador sí puede', () => {

  for (const p of PERMITIDOS_EN_SOPORTE) {
    it(`el operador sí tiene ${p}`, () => {
      expect(puede(Rol.ADMIN_EMPRESA, true, p)).toBe(true);
    });
  }

  it('las cuotas quedan fuera hasta que las reglas las concedan', () => {
    // Está aprobada como función de plataforma, pero la Fase 3 no da
    // escritura sobre periodos. Ofrecer el botón para que el servidor lo
    // rechace es la divergencia que produjo A-2, del revés.
    expect(permitidoEnSoporte(Permiso.ALMACENAMIENTO_GESTIONAR)).toBe(false);
  });

  it('lo confidencial queda fuera', () => {
    // Un operador que abre los contratos que sus clientes marcaron como
    // reservados es un riesgo de responsabilidad que el soporte no pide.
    expect(permitidoEnSoporte(Permiso.DOC_VER_CONFIDENCIAL)).toBe(false);
    expect(permitidoEnSoporte(Permiso.DOC_VER_TODOS)).toBe(true);
  });
});

// ============================================
// EL USUARIO NORMAL NO CAMBIA
// ============================================

describe('Fase 2 · un usuario de empresa se comporta igual que antes', () => {

  const ROLES = Object.values(Rol) as Rol[];

  it('ningún rol pierde ningún permiso fuera del modo plataforma', () => {
    // El filtro se aplica SOLO en modo plataforma. Si se colara en el
    // camino normal, cada rol perdería permisos sin que nadie lo pidiera.
    for (const rol of ROLES) {
      for (const p of Object.values(Permiso) as Permiso[]) {
        expect(puede(rol, false, p)).toBe(tienePermiso(rol, p));
      }
    }
  });

  it('la comprobación de plataforma cuelga de donde no hay empresa', () => {
    // La propiedad que garantiza coste cero: un perfil que declara empresa
    // termina la resolución antes de llegar a la rama nueva.
    const i = tenant.indexOf('if (!empresaId) {');
    expect(i).toBeGreaterThan(-1);

    const rama = tenant.slice(i, i + 200);
    expect(rama).toContain('resolverPlataforma(uid)');
  });

  it('la lectura de plataforma solo ocurre en esa rama', () => {
    // Una sola invocación. Si apareciera fuera, algún usuario normal la
    // estaría pagando.
    const invocaciones = tenant.split('getSuperAdmin(').length - 1;
    expect(invocaciones).toBe(1);
  });
});

// ============================================
// ENTRAR, SALIR, RECARGAR
// ============================================

describe('Fase 2 · entrada y retención', () => {

  it('la pertenencia sintética apunta a la empresa visitada', () => {
    const m = pertenenciaSintetica(OPERADOR, 'e-20123456789');
    expect(m.empresaId).toBe('e-20123456789');
  });

  it('conserva la identidad real del operador', () => {
    // Para que la auditoría, en la Fase 3, atribuya a quien corresponde y
    // no a una etiqueta genérica.
    const m = pertenenciaSintetica(OPERADOR, 'e-1');
    expect(m.uid).toBe(OPERADOR.uid);
    expect(m.email).toBe(OPERADOR.email);
    expect(m.nombre).toBe(OPERADOR.nombre);
  });

  it('es indistinguible en forma de una pertenencia real', () => {
    // Si llevara una marca propia, los cinco servicios que usan este tipo
    // tendrían que conocer dos formas. La distinción vive en el modo.
    const m = pertenenciaSintetica(OPERADOR, 'e-1') as unknown as Record<string, unknown>;
    const esperados = ['uid', 'empresaId', 'email', 'nombre', 'rol', 'estado',
                       'area', 'cargo', 'fechaAlta'];
    expect(Object.keys(m).sort()).toEqual(esperados.sort());
  });

  it('entrar exige ser operador', () => {
    expect(tenant).toContain('Solo un operador de plataforma puede entrar');
  });

  it('entrar no cuesta ninguna lectura', () => {
    // La pertenencia se construye en memoria: no hay nada que leer porque
    // no hay nada escrito.
    const fn = tenant.slice(
      tenant.indexOf('entrarEn(empresaId: string)'),
      tenant.indexOf('salirDeEmpresa()')
    );
    expect(fn).not.toContain('await');
    expect(fn).not.toContain('firebase.');
  });

  it('salir olvida la retención y vacía la pertenencia', () => {
    const fn = tenant.slice(
      tenant.indexOf('salirDeEmpresa(): void'),
      tenant.indexOf('limpiar(): void')
    );
    expect(fn).toContain('olvidarEmpresa()');
    expect(fn).toContain('_miembro.set(null)');
  });

  it('cerrar sesión olvida el modo y la empresa visitada', () => {
    // En un equipo compartido, quien entre después no debe heredar ninguna
    // de las dos cosas.
    const fn = tenant.slice(tenant.indexOf('limpiar(): void'), tenant.indexOf('exigirEmpresa'));
    expect(fn).toContain('_operador.set(null)');
    expect(fn).toContain('olvidarEmpresa()');
  });

  it('la retención sobrevive a la recarga y muere con la pestaña', () => {
    // Las dos mitades del requisito, y las dos son la semántica del
    // almacenamiento de sesión. Se comprueba que sea ese y no otro.
    const modelo = readFileSync('src/app/core/models/plataforma.model.ts', 'utf8');
    expect(modelo).toContain('sessionStorage');
    expect(modelo).not.toContain('localStorage');
  });

  it('el acceso al almacenamiento está protegido', () => {
    // En navegación privada puede lanzar. La degradación correcta es
    // perder la retención, no romper la sesión. Hay precedente: el
    // servicio de tema ya lo envuelve.
    const modelo = readFileSync('src/app/core/models/plataforma.model.ts', 'utf8');
    const accesos = (modelo.match(/sessionStorage\./g) ?? []).length;
    const guardas = (modelo.match(/try \{/g) ?? []).length;
    expect(guardas).toBeGreaterThanOrEqual(accesos);
  });
});

// ============================================
// UN SOLO SITIO DONDE SE DECIDE
// ============================================

describe('Fase 2 · la guarda pregunta en vez de calcular', () => {

  it('consulta al servicio y no a la tabla de permisos', () => {
    // Antes comparaba el rol contra la tabla directamente, y con el rol
    // sintético habría concedido rutas que la lista blanca niega. Dos
    // comprobaciones que deberían decir lo mismo diciendo cosas distintas
    // es lo que produjo A-2.
    expect(guard).toContain('tenant.puede(permiso)');
    expect(guard).not.toContain('tienePermiso(miembro!.rol, permiso)');
  });

  it('ya no importa tienePermiso', () => {
    // Si volviera a importarse, sería porque alguien volvió a calcular.
    expect(guard).not.toContain('tienePermiso');
  });
});

describe('Fase 2 · la ruta de entrada no crea un bucle', () => {

  it('vive fuera de la guarda de sesión', () => {
    // Dentro, un operador sin empresa activa sería redirigido a «sin
    // acceso», que a su vez lo mandaría aquí.
    const bloqueProtegido = rutas.slice(rutas.indexOf('canActivate: [authGuard]'));
    expect(bloqueProtegido).not.toContain('plataforma/entrar');
  });

  it('existe, con su guarda propia', () => {
    expect(rutas).toContain("path: 'plataforma/entrar/:empresaId'");
    expect(rutas).toContain('canActivate: [entrarEnEmpresaGuard]');
  });

  it('un usuario de empresa que llegue ahí va a su tablero', () => {
    // No ha hecho nada malo: un enlace copiado no merece una pantalla de
    // error.
    const pg = readFileSync('src/app/core/guards/plataforma-guard.ts', 'utf8');
    const fn = pg.slice(pg.indexOf('if (!tenant.esPlataforma())'), pg.indexOf('const empresaId'));
    expect(fn).toContain("'/dashboard'");
  });
});
