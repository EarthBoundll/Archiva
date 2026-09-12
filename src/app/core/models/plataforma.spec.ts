/**
 * Fase 1 · Cimientos invisibles.
 *
 * La colección de operadores de plataforma existe, su escritura está
 * cerrada, y —esto es lo que da nombre a la fase— **ninguna ruta de acceso
 * existente ha cambiado**.
 *
 * Esa última propiedad es la que suele darse por supuesta y luego resulta
 * falsa. Aquí se comprueba: se cuenta lo que había, se enumera lo que hay,
 * y se exige que coincidan salvo en lo declarado. Una fase que promete ser
 * invisible tiene que poder demostrarlo, no afirmarlo.
 *
 * El predicado de plataforma queda definido y probado, pero todavía no lo
 * invoca ninguna regla de acceso: concede desde la Fase 3.
 */

import { readFileSync } from 'node:fs';

const reglas  = readFileSync('firestore.rules', 'utf8');
const siembra = readFileSync('scripts/sembrar-empresa.mjs', 'utf8');

/** El cuerpo de un bloque `match`, contando llaves desde su apertura. */
function bloque(ruta: string): string {
  const i = reglas.indexOf('match ' + ruta);
  if (i < 0) throw new Error('no existe la regla ' + ruta);

  // La apertura del bloque, no la llave de {uid} que lleva la propia ruta.
  const abre = reglas.indexOf('{', i + ('match ' + ruta).length);

  let nivel = 0;
  for (let k = abre; k < reglas.length; k++) {
    if (reglas[k] === '{') nivel++;
    else if (reglas[k] === '}') { nivel--; if (nivel === 0) return reglas.slice(i, k + 1); }
  }
  throw new Error('regla sin cerrar: ' + ruta);
}

// ============================================
// LA COLECCION
// ============================================

describe('Fase 1 · la colección de operadores de plataforma', () => {

  const plataforma = bloque('/superadmins/{uid}');

  it('cada cual puede saber si lo es', () => {
    // La resolución de sesión lo consultará desde la Fase 2. Sin esta
    // lectura, un operador no podría averiguar su propia condición.
    expect(plataforma).toMatch(/allow get: if autenticado\(\) && request\.auth\.uid == uid/);
  });

  it('nadie puede enumerarla', () => {
    // La lista de quienes pueden entrar en todas las empresas es
    // reconocimiento puro para un atacante, y no le sirve a nadie más.
    expect(plataforma).toMatch(/allow list: if false/);
  });

  it('la escritura está cerrada para los tres verbos', () => {
    // Sin excepción y sin condición. Un `if false` no se puede satisfacer;
    // cualquier otra cosa —por estricta que parezca— sí.
    expect(plataforma).toMatch(/allow create, update, delete: if false/);
  });

  it('la escritura no tiene ninguna excepción, ni siquiera para el propio operador', () => {
    // Es la diferencia entre «cerrada» y «casi cerrada». Si algún día
    // alguien añade una vía para que un operador nombre a otro, esta
    // prueba lo delata: no debería poder hacerse desde la aplicación.
    const escrituras = plataforma
      .split('\n')
      .filter(l => /allow\s+[a-z, ]*(create|update|delete)/.test(l));

    expect(escrituras.length).toBe(1);
    expect(escrituras[0]).toContain('if false');
    expect(escrituras[0]).not.toContain('||');
  });
});

// ============================================
// EL PREDICADO
// ============================================

describe('Fase 1 · el predicado de plataforma', () => {

  const fn = reglas.slice(
    reglas.indexOf('function esSuperAdmin()'),
    reglas.indexOf('function esMiembroActivo')
  );

  it('existe', () => {
    expect(reglas).toContain('function esSuperAdmin()');
  });

  it('exige sesión antes de comprobar existencia', () => {
    // Sin esa precedencia, una petición anónima evaluaría la ruta con un
    // identificador vacío. El orden dentro de la conjunción importa.
    const posAutenticado = fn.indexOf('autenticado()');
    const posExists = fn.indexOf('exists(');

    expect(posAutenticado).toBeGreaterThan(-1);
    expect(posExists).toBeGreaterThan(posAutenticado);
  });

  it('resuelve por identificador de documento, sin consulta', () => {
    // Es lo que permite que no haga falta ningún índice: el uid es el
    // identificador. Cualquier otra forma obligaría a buscar, y dentro de
    // una regla no se puede buscar.
    expect(fn).toContain('superadmins/$(request.auth.uid)');
  });

  it('todavía no lo invoca ninguna regla de acceso', () => {
    // La propiedad central de la Fase 1: el predicado está definido y
    // probado, pero no concede nada. Concede desde la Fase 3.
    //
    // Cuando esta prueba empiece a fallar, será porque la Fase 3 ha
    // llegado — y entonces hay que retirarla, no relajarla.
    const invocaciones = reglas.split('esSuperAdmin()').length - 1;
    expect(invocaciones).toBe(1);   // solo la definición
  });
});

// ============================================
// LA FASE ES INVISIBLE
// ============================================

describe('Fase 1 · ninguna ruta de acceso existente ha cambiado', () => {

  /**
   * Las reglas que existían antes de la Fase 1, con su condición exacta.
   *
   * Se escriben aquí a mano y a propósito. Generarlas desde el propio
   * archivo haría que la prueba se adaptara sola a cualquier cambio, que
   * es justo lo contrario de lo que hace falta: esto es un acta de lo que
   * había, no un resumen de lo que hay.
   */
  const ANTES: [string, string, string][] = [
    ['/usuarios/{uid}',        'read',                  'autenticado() && request.auth.uid == uid'],
    ['/usuarios/{uid}',        'create',                'autenticado() && request.auth.uid == uid'],
    ['/usuarios/{uid}',        'delete',                'false'],
    ['/invitaciones/{token}',  'get',                   'true'],
    ['/invitaciones/{token}',  'list',                  'false'],
    ['/invitaciones/{token}',  'create',                'esAdmin(request.resource.data.empresaId)'],
    ['/invitaciones/{token}',  'delete',                'false'],
    ['/empresas/{eid}',        'read',                  'esMiembroActivo(eid)'],
    ['/empresas/{eid}',        'update',                'esAdmin(eid)'],
    ['/empresas/{eid}',        'create, delete',        'false'],
    ['/marca/{id}',            'read',                  'esMiembroActivo(eid)'],
    ['/marca/{id}',            'write',                 'esAdmin(eid)'],
    ['/invitaciones/{id}',     'read',                  'esAdmin(eid)'],
    ['/invitaciones/{id}',     'create',                'esAdmin(eid)'],
    ['/documentos/{id}',       'delete',                'false'],
    ['/archivos/{archivoId}',  'read, write',           'esMiembroActivo(eid)'],
    ['/solicitudes/{id}',      'read',                  'esMiembroActivo(eid)'],
    ['/solicitudes/{id}',      'create',                'esMiembroActivo(eid)'],
    ['/solicitudes/{id}',      'delete',                'false'],
    ['/flujos/{id}',           'read',                  'esMiembroActivo(eid)'],
    ['/flujos/{id}',           'delete',                'false'],
    ['/tareas/{id}',           'read',                  'esMiembroActivo(eid)'],
    ['/tareas/{id}',           'delete',                'false'],
    ['/bitacora/{id}',         'read',                  'esMiembroActivo(eid)'],
    ['/bitacora/{id}',         'create',                'esMiembroActivo(eid)'],
    ['/bitacora/{id}',         'delete',                'false'],
    ['/auditoria/{id}',        'read',                  'esMiembroActivo(eid)'],
    ['/auditoria/{id}',        'create',                'esMiembroActivo(eid)'],
    ['/auditoria/{id}',        'update, delete',        'false'],
    ['/periodos/{periodoId}',  'read',                  'esMiembroActivo(eid)'],
    ['/periodos/{periodoId}',  'write',                 'esGestor(eid)']
  ];

  for (const [ruta, verbos, condicion] of ANTES) {
    it(`${ruta} · ${verbos} sigue siendo «${condicion}»`, () => {
      const cuerpo = bloque(ruta);
      const buscada = `allow ${verbos}: if ${condicion};`;

      // Se normalizan los espacios: el archivo alinea algunas condiciones.
      const normal = (t: string) => t.replace(/\s+/g, ' ');
      expect(normal(cuerpo)).toContain(normal(buscada));
    });
  }

  it('los predicados existentes conservan su conjunto de roles', () => {
    // Si la Fase 1 hubiera tocado uno de estos, un rol entero cambiaría de
    // alcance sin que ninguna prueba de comportamiento lo notara.
    const esperados: [string, string[]][] = [
      ['esAdmin',         ['ADMIN_EMPRESA']],
      ['esAprobador',     ['ADMIN_EMPRESA', 'GERENTE', 'JEFE_AREA', 'SUPERVISOR']],
      ['esGestor',        ['ADMIN_EMPRESA', 'GERENTE', 'JEFE_AREA']],
      ['esDireccion',     ['ADMIN_EMPRESA', 'GERENTE']],
      ['veTodoElAcervo',  ['ADMIN_EMPRESA', 'GERENTE', 'JEFE_AREA', 'SUPERVISOR']],
      ['veLoReservado',   ['ADMIN_EMPRESA', 'GERENTE', 'JEFE_AREA']]
    ];

    for (const [nombre, roles] of esperados) {
      const i = reglas.indexOf('function ' + nombre + '(eid)');
      expect(i).toBeGreaterThan(-1);

      const cuerpo = reglas.slice(i, reglas.indexOf('\n    }', i));
      for (const rol of roles) expect(cuerpo).toContain("'" + rol + "'");
    }
  });

  it('sigue habiendo exactamente cuatro colecciones raíz', () => {
    // El perfil global y el índice de invitaciones existen porque hay que
    // leerlos antes de conocer la empresa. La de plataforma, porque su
    // titular no tiene ninguna. Una cuarta necesitaría su propia razón.
    const raices = [...reglas.matchAll(/\n {4}match (\/[a-z]+)\/\{/g)].map(m => m[1]);
    const unicas = [...new Set(raices)].sort();

    // Una es la raíz de la tenencia; las otras tres cuelgan fuera de ella.
    expect(unicas).toEqual(['/empresas', '/invitaciones', '/superadmins', '/usuarios']);
    expect(unicas.filter(r => r !== '/empresas')).toHaveLength(3);
  });
});

// ============================================
// LA SIEMBRA
// ============================================

describe('Fase 1 · el modo de siembra de operador', () => {

  it('se detecta recorriendo argv, no por la tabla de pares', () => {
    // El parser toma lo siguiente a cada --clave como su valor, así que
    // una bandera suelta quedaría indefinida o se comería el argumento de
    // al lado. Es el fallo que tuvo la primera versión.
    expect(siembra).toContain("process.argv.includes('--superadmin')");
  });

  it('el modo de plataforma no exige RUC ni razón social', () => {
    // No hay empresa: se siembra a una persona.
    expect(siembra).toContain("MODO_PLATAFORMA\n  ? ['clave', 'email']");
  });

  it('exige que la cuenta ya exista en autenticación', () => {
    // Crearla aquí significaría que un comando puede fabricar un acceso a
    // todos los clientes, con una contraseña que además se inventa él.
    const modo = siembra.slice(
      siembra.indexOf('if (MODO_PLATAFORMA) {'),
      siembra.indexOf('// 1. LA EMPRESA')
    );
    expect(modo).toContain('getUserByEmail');
    expect(modo).toContain('process.exit(1)');
  });

  it('es idempotente', () => {
    const modo = siembra.slice(
      siembra.indexOf('if (MODO_PLATAFORMA) {'),
      siembra.indexOf('// 1. LA EMPRESA')
    );
    expect(modo).toContain('previo.exists');
  });

  it('escribe en la colección correcta, con el uid como identificador', () => {
    const modo = siembra.slice(
      siembra.indexOf('if (MODO_PLATAFORMA) {'),
      siembra.indexOf('// 1. LA EMPRESA')
    );
    expect(modo).toContain("db.doc('superadmins/' + operador.uid)");
  });

  it('avisa de que no hay marcha atrás desde la aplicación', () => {
    // La contrapartida aceptada de cerrar la escritura sin excepciones.
    // Quien siembre a un operador debe enterarse ahí, no al intentarlo.
    expect(siembra).toContain('No se puede desde la aplicacion');
  });

  it('el modo de empresa conserva sus exigencias', () => {
    // La regresión más probable de este cambio: relajar la validación del
    // camino que ya funcionaba al añadirle una bifurcación.
    expect(siembra).toContain("['clave', 'ruc', 'razon', 'email']");
    expect(siembra).toContain('!MODO_PLATAFORMA && !/^(10|20)');
  });
});
