/**
 * Un identificador de empresa no se llama `userId`.
 *
 * Este era el hallazgo M-3. Cinco modelos declaraban `userId: string` y
 * lo que guardaban era el identificador de la EMPRESA — herencia del
 * producto anterior, donde cada usuario era su propio mundo y las dos
 * cosas coincidían.
 *
 * No producía ningún fallo, y por eso llevaba meses ahí: todo el código
 * opera sobre una sola empresa implícita, así que la confusión no tenía
 * dónde manifestarse. Lo tendrá en cuanto exista un Super Administrador,
 * que por definición es código que cruza la frontera entre inquilinos.
 * Un identificador de empresa llamado `userId` en ese contexto es una
 * fuga esperando a que alguien confunda los dos parámetros — y el modo de
 * fallo es enseñarle a un cliente los documentos de otro.
 *
 * Estas pruebas no comprueban comportamiento: comprueban que el
 * vocabulario siga siendo inequívoco. Es lo único que protege de un error
 * que no se manifiesta hasta que ya ocurrió.
 */

import { readFileSync, readdirSync } from 'node:fs';

const RAIZ = 'src/app/core';

function leerTodos(carpeta: string): { nombre: string; texto: string }[] {
  return readdirSync(`${RAIZ}/${carpeta}`)
    .filter(f => f.endsWith('.ts') && !f.endsWith('.spec.ts'))
    .map(f => ({ nombre: f, texto: readFileSync(`${RAIZ}/${carpeta}/${f}`, 'utf8') }));
}

const modelos   = leerTodos('models');
const servicios = leerTodos('services');

describe('M-3 · ningún modelo llama «usuario» a una empresa', () => {

  it('ningún modelo declara userId', () => {
    const culpables = modelos
      .filter(m => /^\s{2}userId\??:/m.test(m.texto))
      .map(m => m.nombre);

    expect(culpables).toEqual([]);
  });

  it('las cinco entidades de empresa declaran empresaId', () => {
    // Son las que cuelgan de empresas/{eid} y llevan el identificador
    // dentro del documento además de en la ruta.
    const esperadas: [string, string][] = [
      ['document.model.ts',       'Documento'],
      ['history.model.ts',        'RegistroHistorial'],
      ['review-request.model.ts', 'SolicitudRevision'],
      ['storage.model.ts',        'CuotaAlmacenamiento'],
      ['workflow.model.ts',       'FlujoAprobacion']
    ];

    for (const [fichero, iface] of esperadas) {
      const m = modelos.find(x => x.nombre === fichero)!;
      const cuerpo = m.texto.slice(
        m.texto.indexOf(`export interface ${iface} {`),
        m.texto.indexOf('\n}', m.texto.indexOf(`export interface ${iface} {`))
      );
      expect(cuerpo).toMatch(/^\s{2}empresaId: string;/m);
    }
  });
});

describe('M-3 · ningún servicio guarda la empresa en una variable llamada userId', () => {

  it('la tenencia nunca se recoge en un userId', () => {
    // `const userId = this.tenant.empresaOpcional()` era la forma exacta
    // en la que la confusión entraba en veintiocho sitios.
    const culpables = servicios
      .filter(s => /const userId\s*=\s*this\.tenant\./.test(s.texto))
      .map(s => s.nombre);

    expect(culpables).toEqual([]);
  });

  it('no queda ningún userId en el núcleo', () => {
    const culpables = [...modelos, ...servicios]
      .filter(x => /\buserId\b/.test(x.texto))
      .map(x => x.nombre);

    expect(culpables).toEqual([]);
  });
});

describe('M-3 · lo que sí identifica a una persona sigue diciéndolo', () => {

  const tenant = servicios.find(s => s.nombre === 'tenant.ts')!.texto;
  const audit  = servicios.find(s => s.nombre === 'audit.ts')!.texto;

  it('la tenencia distingue el uid de la persona del id de la empresa', () => {
    // El refactor no puede haber borrado la distinción en el sitio donde
    // conviven los dos conceptos.
    expect(tenant).toContain('uid');
    expect(tenant).toContain('empresaId');
  });

  it('la auditoría sigue anotando qué persona hizo cada cosa', () => {
    // `actorUid` es una persona de verdad. Si el renombrado lo hubiera
    // tocado, la trazabilidad diría qué empresa actuó, no quién.
    expect(audit).toContain('actorUid');
  });

  it('los documentos siguen sabiendo qué persona los creó', () => {
    // `creadoPorUid` sostiene la regla de visibilidad. Confundirlo con la
    // empresa haría visible el acervo entero a cualquiera.
    const doc = modelos.find(m => m.nombre === 'document.model.ts')!.texto;
    expect(doc).toContain('creadoPorUid');
  });
});

describe('M-3 · compatibilidad con lo ya guardado', () => {

  const firebase = readFileSync(`${RAIZ}/services/firebase.ts`, 'utf8');

  it('las escrituras siguen inyectando empresaId', () => {
    // El renombrado es seguro precisamente porque el campo nuevo ya
    // estaba en los documentos: firebase.ts lo añadía en cada creación.
    // Los documentos antiguos conservan un `userId` vestigial que nadie
    // lee, así que no hay migración que hacer.
    for (const creador of ['crearDocumento', 'crearRegistro', 'crearSolicitud',
                           'crearFlujo', 'crearTareas', 'registrarAuditoria']) {
      const i = firebase.indexOf('async ' + creador);
      expect(i).toBeGreaterThan(-1);
      expect(firebase.slice(i, i + 700)).toContain('empresaId');
    }
  });

  it('ninguna regla ni ningún índice dependían del nombre antiguo', () => {
    // Comprobado antes de renombrar: si alguna regla filtrara por userId,
    // el cambio habría abierto un agujero en vez de cerrar una ambigüedad.
    expect(readFileSync('firestore.rules', 'utf8')).not.toContain('userId');
    expect(readFileSync('firestore.indexes.json', 'utf8')).not.toContain('userId');
  });
});
