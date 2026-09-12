/**
 * Fase 3 · Trazabilidad y acceso auditado.
 *
 * La fase en la que el operador ve algo por primera vez. Lo que hay que
 * garantizar, en orden:
 *
 *   1. Que las once excepciones estén donde deben — y, sobre todo, que NO
 *      estén donde no deben. La segunda mitad importa más: es la que
 *      detecta una línea copiada a una regla de escritura.
 *   2. Que la reserva del cliente siga en pie. Opción B: el operador ve
 *      el acervo, no lo confidencial.
 *   3. Que ninguna entrada ocurra sin dejar constancia.
 */

import { readFileSync } from 'node:fs';

import { AsientoAuditoria, ACCIONES_AUDITADAS, esIntervencionDePlataforma,
         autorConProcedencia } from './audit.model';

const reglas = readFileSync('firestore.rules', 'utf8');
const tenant = readFileSync('src/app/core/services/tenant.ts', 'utf8');
const audit  = readFileSync('src/app/core/services/audit.ts', 'utf8');

/** El cuerpo de un bloque `match`, contando llaves desde su apertura. */
function bloque(ruta: string): string {
  const i = reglas.indexOf('match ' + ruta);
  if (i < 0) throw new Error('no existe la regla ' + ruta);

  const abre = reglas.indexOf('{', i + ('match ' + ruta).length);
  let nivel = 0;
  for (let k = abre; k < reglas.length; k++) {
    if (reglas[k] === '{') nivel++;
    else if (reglas[k] === '}') { nivel--; if (nivel === 0) return reglas.slice(i, k + 1); }
  }
  throw new Error('regla sin cerrar: ' + ruta);
}

/**
 * Las sentencias `allow` de un bloque, cada una entera.
 *
 * Una sentencia puede ocupar varias líneas —la de miembros ocupa dos, la
 * de documentos nueve— así que se acumula desde `allow` hasta el punto y
 * coma. Quedarse con la primera línea haría que la prueba no viera la
 * condición y fallara por un motivo que no es el suyo.
 */
function allows(ruta: string): string[] {
  const out: string[] = [];
  let actual: string | null = null;

  for (const bruta of bloque(ruta).split('\n')) {
    const linea = bruta.split('//')[0];

    if (actual === null && /^\s*allow /.test(linea)) actual = linea.trim();
    else if (actual !== null) actual += ' ' + linea.trim();

    if (actual !== null && actual.includes(';')) {
      out.push(actual.replace(/\s+/g, ' '));
      actual = null;
    }
  }
  return out;
}

// ============================================
// DONDE SI
// ============================================

describe('Fase 3 · las excepciones están donde deben', () => {

  const CONCEDIDAS: [string, string][] = [
    ['/empresas/{eid}',       'read'],
    ['/empresas/{eid}',       'update'],
    ['/marca/{id}',           'read'],
    ['/marca/{id}',           'write'],
    ['/miembros/{uid}',       'get'],
    ['/miembros/{uid}',       'list'],
    ['/documentos/{id}',      'read'],
    ['/solicitudes/{id}',     'read'],
    ['/flujos/{id}',          'read'],
    ['/tareas/{id}',          'read'],
    ['/bitacora/{id}',        'read'],
    ['/auditoria/{id}',       'read'],
    ['/auditoria/{id}',       'create']
  ];

  for (const [ruta, verbo] of CONCEDIDAS) {
    it(`${ruta} · ${verbo}`, () => {
      const linea = allows(ruta).find(l => new RegExp(`allow [a-z, ]*\\b${verbo}\\b`).test(l));
      expect(linea).toBeDefined();
      expect(linea).toContain('esSuperAdmin()');
    });
  }

  it('la creación del asiento la lleva: sin ella la trazabilidad falla en silencio', () => {
    // El servicio de auditoría captura sus errores. Sin esta excepción, la
    // entrada de un operador no dejaría constancia y nadie se enteraría.
    // Es el mismo modo de fallo que produjo A-3.
    const crear = allows('/auditoria/{id}').find(l => l.includes('create'));
    expect(crear).toContain('esSuperAdmin()');
  });
});

// ============================================
// DONDE NO
// ============================================

describe('Fase 3 · las excepciones NO están donde no deben', () => {

  /**
   * La escritura sobre contenido operativo del cliente.
   *
   * Es la decisión de gobierno hecha regla. Una línea copiada de más aquí
   * sería el fallo más fácil de cometer y el más difícil de ver.
   */
  const PROHIBIDAS: [string, string[]][] = [
    ['/documentos/{id}',  ['create', 'update', 'delete']],
    ['/solicitudes/{id}', ['create', 'update', 'delete']],
    ['/flujos/{id}',      ['create', 'update', 'delete']],
    ['/tareas/{id}',      ['create', 'update', 'delete']],
    ['/bitacora/{id}',    ['create', 'update', 'delete']],
    ['/miembros/{uid}',   ['create', 'update', 'delete']],
    ['/auditoria/{id}',   ['update', 'delete']],
    ['/usuarios/{uid}',   ['read', 'create', 'update', 'delete']],
    ['/archivos/{archivoId}', ['read', 'write']],
    ['/periodos/{periodoId}', ['read', 'write']],
    ['/empresas/{eid}',   ['create', 'delete']],
    ['/invitaciones/{id}', ['read', 'create', 'update', 'delete']],
    ['/invitaciones/{token}', ['get', 'list', 'create', 'update', 'delete']]
  ];

  for (const [ruta, verbos] of PROHIBIDAS) {
    for (const verbo of verbos) {
      it(`${ruta} · ${verbo} sigue sin excepción`, () => {
        const linea = allows(ruta).find(l => new RegExp(`allow [a-z, ]*\\b${verbo}\\b`).test(l));
        if (!linea) return;   // ese verbo no está declarado en ese bloque
        expect(linea).not.toContain('esSuperAdmin()');
      });
    }
  }

  it('la colección de plataforma sigue con la escritura cerrada', () => {
    // La Fase 3 no la toca. Si alguien le hubiera añadido una excepción
    // «para que el operador pueda nombrar a otro», esto lo delata.
    const p = allows('/superadmins/{uid}');
    const escritura = p.find(l => /create|update|delete/.test(l));
    expect(escritura).toContain('if false');
    expect(escritura).not.toContain('esSuperAdmin()');
  });
});

// ============================================
// EL ORDEN DE LA DISYUNCION
// ============================================

describe('Fase 3 · el predicado va siempre a la derecha', () => {

  it('ninguna invocación precede a un operador lógico', () => {
    // Firestore corta la disyunción en cuanto el primer término es cierto.
    // A la derecha, un miembro legítimo nunca la evalúa ni paga la lectura
    // que implica. Invertido, la pagarían todos, siempre.
    //
    // Es un fallo que no rompe nada funcionalmente: ninguna prueba de
    // comportamiento lo vería. Solo esta.
    const malOrden = reglas
      .split('\n')
      .filter(l => /esSuperAdmin\(\)\s*\|\|/.test(l));

    expect(malOrden).toEqual([]);
  });

  it('y toda invocación viene precedida de una condición propia', () => {
    // Una excepción suelta —`allow read: if esSuperAdmin()`— concedería
    // solo al operador y dejaría fuera al dueño de los datos.
    const sueltas = reglas
      .split('\n')
      .filter(l => /allow [a-z, ]+: if esSuperAdmin\(\)/.test(l));

    expect(sueltas).toEqual([]);
  });
});

// ============================================
// OPCION B: LA RESERVA DEL CLIENTE
// ============================================

describe('Fase 3 · el operador no ve lo confidencial', () => {

  const doc = bloque('/documentos/{id}');
  const lectura = doc.slice(doc.indexOf('allow read:'), doc.indexOf('allow create:'));

  it('la excepción entra por el nivel del acervo, no por el exterior', () => {
    // Toda la decisión de gobierno está en este anidamiento. Fuera, el
    // operador vería todo; aquí, ve lo mismo que un supervisor.
    expect(lectura).toContain('(veTodoElAcervo(eid) || esSuperAdmin())');
  });

  it('el filtro de confidencialidad sigue intacto y por debajo', () => {
    // Si la excepción cayera un nivel más afuera, este filtro dejaría de
    // aplicarse al operador sin que nada fallara: un fallo silencioso.
    expect(lectura).toContain('veLoReservado(eid)');
    expect(lectura).toContain("!(resource.data.confidencialidad in ['confidencial', 'restringido'])");

    const posAcervo = lectura.indexOf('veTodoElAcervo(eid) || esSuperAdmin()');
    const posReserva = lectura.indexOf('veLoReservado(eid)');
    expect(posReserva).toBeGreaterThan(posAcervo);
  });

  it('el operador no aparece en el predicado de lo reservado', () => {
    // No lo tiene, y no hay forma de que lo tenga: no es miembro, así que
    // ese predicado es falso para él siempre. Comprobarlo evita que
    // alguien «lo arregle» añadiéndolo.
    const fn = reglas.slice(
      reglas.indexOf('function veLoReservado(eid)'),
      reglas.indexOf('\n    }', reglas.indexOf('function veLoReservado(eid)'))
    );
    expect(fn).not.toContain('esSuperAdmin');
  });

  it('lo propio sigue por delante de todo', () => {
    // Un documento creado por quien lo pide se ve siempre, sea del nivel
    // que sea. Ese camino no cambia.
    expect(lectura).toContain('resource.data.creadoPorUid == request.auth.uid');
  });
});

// ============================================
// LA MARCA
// ============================================

describe('Fase 3 · la marca de intervención', () => {

  it('el servicio la toma de la tenencia, no del argumento', () => {
    // Si dependiera de quien llama, cualquier operación podría omitirla
    // por descuido — y entonces sería un campo, no una garantía.
    expect(audit).toContain('plataforma: this.tenant.esPlataforma() ? true : undefined');
  });

  it('se omite cuando es falsa, en vez de escribirla', () => {
    // `limpiar()` retira los indefinidos, así que un asiento de usuario
    // normal no lleva el campo en absoluto. La colección no engorda para
    // el 99% de sus documentos.
    //
    // La versión anterior de esta prueba se contradecía: exigía que el
    // fichero contuviera la expresión completa y a la vez que NO
    // contuviera su prefijo, lo cual es imposible.
    const asignaciones = [...audit.matchAll(/plataforma: ([^,\n]+)/g)].map(m => m[1].trim());

    expect(asignaciones.length).toBeGreaterThan(0);
    for (const a of asignaciones) {
      expect(a).toContain('? true : undefined');
      // Nunca un booleano plano: eso escribiría `false` en cada asiento.
      expect(a).not.toBe('this.tenant.esPlataforma()');
    }
  });

  it('la acción de acceso existe y tiene su frase', () => {
    expect(ACCIONES_AUDITADAS['acceso_soporte']).toBeDefined();
    expect(ACCIONES_AUDITADAS['acceso_soporte'].frase.length).toBeGreaterThan(10);
  });

  it('un asiento sin marca se lee como intervención normal', () => {
    // Los anteriores a la Fase 3 no la llevan, y su ausencia significa
    // exactamente lo que ocurrió: no fue plataforma.
    const viejo = { actorNombre: 'María' } as AsientoAuditoria;
    expect(esIntervencionDePlataforma(viejo)).toBe(false);
    expect(autorConProcedencia(viejo)).toBe('María');
  });

  it('uno con marca dice de dónde viene', () => {
    // Un asiento que dice «María editó la ficha» sin decir que María es la
    // plataforma cumple la letra de la decisión y no su intención.
    const nuevo = { actorNombre: 'Operadora', plataforma: true } as AsientoAuditoria;
    expect(esIntervencionDePlataforma(nuevo)).toBe(true);
    expect(autorConProcedencia(nuevo)).toContain('plataforma');
  });
});

// ============================================
// NO SE ENTRA SIN CONSTANCIA
// ============================================

describe('Fase 3 · la entrada deja constancia o no ocurre', () => {

  it('existe una vía que propaga el error en vez de tragárselo', () => {
    // `registrar()` captura y continúa, y es lo correcto para una
    // operación de usuario. Para la entrada de un operador, esa decisión
    // se invierte.
    expect(audit).toContain('async registrarOFallar(');

    const fn = audit.slice(
      audit.indexOf('async registrarOFallar('),
      audit.indexOf('/** Atajo para las acciones')
    );
    expect(fn).not.toContain('catch');
  });

  it('la vía tolerante sigue siendo tolerante', () => {
    // El resto del sistema no cambia: perder un documento porque no se
    // pudo anotar sería peor que perder la anotación.
    const fn = audit.slice(audit.indexOf('async registrar(p: AsientoPayload)'),
                           audit.indexOf('async registrarOFallar('));
    expect(fn).toContain('catch');
  });

  it('entrar exige motivo', () => {
    expect(tenant).toContain('Indica por que entras');
  });

  it('entrar asienta antes de recordar la empresa', () => {
    // Si se recordara antes, una recarga devolvería al operador a una
    // empresa en la que la entrada había fallado.
    const fn = tenant.slice(tenant.indexOf('async entrarEn('), tenant.indexOf('salirDeEmpresa()'));

    const posAsiento = fn.indexOf('registrarOFallar');
    const posRecordar = fn.indexOf('recordarEmpresa(empresaId)');

    expect(posAsiento).toBeGreaterThan(-1);
    expect(posRecordar).toBeGreaterThan(posAsiento);
  });

  it('si el asiento falla, la pertenencia se deshace', () => {
    // Un operador dentro de una empresa sin constancia de haber entrado es
    // lo que la decisión de gobierno prohíbe. «Lo intentamos» no es
    // trazabilidad.
    const fn = tenant.slice(tenant.indexOf('async entrarEn('), tenant.indexOf('salirDeEmpresa()'));
    expect(fn).toContain('this._miembro.set(anterior)');
    expect(fn).toContain('throw new Error');
  });

  it('el ciclo entre tenencia y auditoría se resuelve al usar, no al construir', () => {
    // AuditService ya dependía de TenantService. Inyectarlo al revés
    // produce un ciclo que Angular detecta al construir.
    expect(tenant).not.toContain('inject(AuditService)');
    expect(tenant).toContain('inyector.get(AuditService)');
  });
});
