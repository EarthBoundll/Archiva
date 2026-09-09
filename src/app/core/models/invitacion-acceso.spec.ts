/**
 * Quién puede leer y cerrar una invitación.
 *
 * Este era el hallazgo C-1 de la auditoría, y el peor del informe. Las
 * reglas declaraban, con esas palabras, que «conocer el testigo es la
 * credencial» — y a continuación dejaban que cualquier miembro activo
 * leyera la colección donde los testigos se guardan en claro. Un
 * colaborador podía localizar una invitación pendiente de administrador,
 * copiar su testigo y canjearla.
 *
 * Y el mismo bloque tenía el defecto contrario: quien acepta no es
 * miembro todavía —ese es el punto de aceptar—, así que la lectura que
 * necesitaba para abrir el enlace también se le denegaba. Las
 * invitaciones no funcionaban en absoluto.
 *
 * Dos públicos opuestos en una sola regla. Estas pruebas fijan la
 * separación.
 */

import { readFileSync } from 'node:fs';

const reglas = readFileSync('firestore.rules', 'utf8');
const firebase = readFileSync('src/app/core/services/firebase.ts', 'utf8');

/** El bloque de una regla, para no buscar en todo el fichero. */
function bloque(match: string): string {
  const i = reglas.indexOf('match ' + match);
  if (i < 0) throw new Error('no existe la regla ' + match);

  // El cuerpo empieza en la llave de APERTURA del bloque, no en la de
  // {token} o {id} que lleva la propia ruta.
  const abre = reglas.indexOf('{', i + ('match ' + match).length);

  let nivel = 0;
  for (let k = abre; k < reglas.length; k++) {
    if (reglas[k] === '{') nivel++;
    else if (reglas[k] === '}') { nivel--; if (nivel === 0) return reglas.slice(i, k + 1); }
  }
  throw new Error('regla sin cerrar: ' + match);
}

const indice  = bloque('/invitaciones/{token}');
const empresa = bloque('/invitaciones/{id}');

describe('C-1 · el testigo deja de ser legible por cualquier miembro', () => {

  it('la colección de invitaciones de la empresa solo la lee quien administra', () => {
    // Es la línea del informe. Con esMiembroActivo aquí, una invitación de
    // administrador sin canjear era una escalada de privilegios servida.
    expect(empresa).toMatch(/allow read: if esAdmin\(eid\)/);
    expect(empresa).not.toMatch(/allow read: if esMiembroActivo\(eid\)/);
  });

  it('crearla sigue siendo cosa de quien administra', () => {
    expect(empresa).toMatch(/allow create: if esAdmin\(eid\)/);
  });

  it('no se borra: una invitación revocada es historial', () => {
    expect(empresa).toMatch(/allow delete: if false/);
  });
});

describe('A-1 · el índice público deja de admitir escrituras de cualquiera', () => {

  it('crear una entrada exige administrar la empresa que declara', () => {
    // Antes bastaba `autenticado()`, así que una cuenta de la empresa B
    // podía crear o reescribir el índice de la empresa A.
    expect(indice).toMatch(/allow create: if esAdmin\(request\.resource\.data\.empresaId\)/);
    expect(indice).not.toMatch(/allow create, update: if autenticado\(\)/);
  });

  it('actualizarla exige administrar la empresa dueña de la entrada', () => {
    expect(indice).toMatch(/esAdmin\(resource\.data\.empresaId\)/);
  });

  it('sigue sin poder enumerarse', () => {
    // Enumerar daría los correos y los roles de toda la plantilla.
    expect(indice).toMatch(/allow list: if false/);
  });

  it('y sigue siendo legible por testigo, que es lo que permite aceptar', () => {
    expect(indice).toMatch(/allow get: if true/);
  });
});

describe('F-0 · quien acepta puede abrir el enlace sin ser miembro', () => {

  it('la lectura del testigo ya no salta al documento de la empresa', () => {
    // Esa segunda lectura la deniegan las reglas a quien no pertenece a la
    // empresa, es decir, a todo el que llega a aceptar. Con ella, ninguna
    // invitación se podía abrir.
    const fn = firebase.slice(
      firebase.indexOf('async getInvitacionPorToken'),
      firebase.indexOf('async actualizarInvitacion')
    );
    expect(fn).toContain('invitaciones/${token}');
    expect(fn).not.toContain('/invitaciones/${datos.invitacionId}');
  });

  it('el índice lleva lo que la pantalla necesita mostrar', () => {
    // Si faltara alguno, la pantalla de aceptación quedaría a medio
    // rellenar y no habría forma de saberlo hasta abrirla.
    const fn = firebase.slice(
      firebase.indexOf('async crearInvitacion'),
      firebase.indexOf('async getInvitaciones')
    );
    for (const campo of ['empresaNombre', 'nombre', 'rol', 'area', 'cargo',
                         'invitadaPorNombre', 'fechaExpira', 'estado']) {
      expect(fn).toContain(campo + ':');
    }
  });

  it('la invitación y su índice se escriben en un solo lote', () => {
    // Una invitación sin índice es un enlace que no abre; un índice sin
    // invitación es un enlace que apunta a la nada.
    const fn = firebase.slice(
      firebase.indexOf('async crearInvitacion'),
      firebase.indexOf('async getInvitaciones')
    );
    expect(fn).toContain('writeBatch');
    expect(fn).toContain('lote.commit()');
  });
});

describe('La persona invitada solo puede cerrar SU invitación', () => {

  it('la vía del destinatario se ata al correo del testigo de sesión', () => {
    // Sin este vínculo, cualquier cuenta autenticada podría marcar
    // aceptada la invitación de otra persona.
    for (const regla of [indice, empresa]) {
      expect(regla).toContain('miCorreo() == resource.data.email.lower()');
    }
  });

  it('solo puede tocar el estado y su fecha', () => {
    for (const regla of [indice, empresa]) {
      expect(regla).toContain("soloCambia(['estado', 'fechaAceptada'])");
    }
  });

  it('solo puede llevarla a aceptada, y solo desde pendiente', () => {
    // Sin la segunda condición, una invitación revocada o ya usada podría
    // revivir: el testigo volvería a abrir.
    for (const regla of [indice, empresa]) {
      expect(regla).toContain("request.resource.data.estado == 'aceptada'");
      expect(regla).toContain("resource.data.estado == 'pendiente'");
    }
  });

  it('miCorreo() devuelve vacío sin sesión, para no cuadrar con nadie', () => {
    // Un documento sin `email` compararía contra null y la regla se
    // volvería impredecible. Devolver cadena vacía la deja siempre falsa.
    const fn = reglas.slice(reglas.indexOf('function miCorreo()'), reglas.indexOf('function esMiembroActivo'));
    expect(fn).toContain('autenticado()');
    expect(fn).toContain("''");
  });
});

describe('Los dos registros no pueden discrepar', () => {

  it('el cambio de estado se escribe en los dos sitios a la vez', () => {
    // Si divergieran, el índice diría «pendiente» sobre una invitación
    // revocada y el enlace seguiría abriendo.
    const fn = firebase.slice(
      firebase.indexOf('async actualizarInvitacion'),
      firebase.indexOf('async getTareas')
    );
    expect(fn).toContain('writeBatch');
    expect(fn).toContain('lote.commit()');
    expect(fn).toContain('invitaciones/${token}');
  });

  it('el espejo solo copia los campos que las reglas admiten', () => {
    // Copiar el documento entero haría fallar `soloCambia` en la vía del
    // destinatario, y la aceptación se quedaría a medias.
    const fn = firebase.slice(
      firebase.indexOf('async actualizarInvitacion'),
      firebase.indexOf('async getTareas')
    );
    const copiados = [...fn.matchAll(/espejo\['([a-zA-Z]+)'\]/g)].map(m => m[1]);
    expect(copiados.sort()).toEqual(['fechaAceptada', 'motivoRevocacion']);
  });
});
