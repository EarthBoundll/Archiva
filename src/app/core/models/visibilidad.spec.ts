/**
 * Quién ve qué documento.
 *
 * La matriz de permisos declaraba desde el principio que un colaborador
 * «ve solo lo suyo, sin DOC_VER_TODOS ni DOC_VER_CONFIDENCIAL», y había
 * pruebas que lo afirmaban y pasaban. Pero `tenant.veTodo()` no lo
 * llamaba nadie y `DOC_VER_CONFIDENCIAL` no se comprobaba en ningún punto
 * del proyecto: `getAll()` devolvía el acervo entero a cualquiera.
 *
 * Es el peor tipo de defecto de control de acceso: el que tiene la regla
 * escrita, documentada y probada en el papel, y sin aplicar en el código.
 * Las pruebas de la matriz pasaban precisamente porque solo miraban la
 * matriz.
 *
 * Estas miran la decisión.
 */

import { readFileSync } from 'node:fs';

import { Rol, Permiso, tienePermiso } from './rbac.model';
import { Confidencialidad } from './document.model';

/**
 * Reproduce `DocumentService.puedeVer`.
 *
 * Se replica la regla en vez de instanciar el servicio porque lo que hay
 * que fijar es la decisión, no el cableado de Angular. Si alguien cambia
 * el servicio y no esto, la prueba deja de proteger — por eso el nombre
 * del método aparece aquí escrito.
 */
function puedeVer(
  rol: Rol,
  doc: { creadoPorUid?: string; confidencialidad: Confidencialidad },
  uid: string
): boolean {
  if (doc.creadoPorUid === uid) return true;
  if (!tienePermiso(rol, Permiso.DOC_VER_TODOS)) return false;

  const reservado = doc.confidencialidad === 'confidencial' ||
                    doc.confidencialidad === 'restringido';

  return !reservado || tienePermiso(rol, Permiso.DOC_VER_CONFIDENCIAL);
}

const MIO   = { creadoPorUid: 'u1' };
const AJENO = { creadoPorUid: 'u9' };

const publico      = (d: object) => ({ ...d, confidencialidad: 'publico' as const });
const interno      = (d: object) => ({ ...d, confidencialidad: 'interno' as const });
const confidencial = (d: object) => ({ ...d, confidencialidad: 'confidencial' as const });
const restringido  = (d: object) => ({ ...d, confidencialidad: 'restringido' as const });

describe('Visibilidad · lo propio siempre se ve', () => {

  it('cada rol ve su propio documento, sea del nivel que sea', () => {
    // Quien redacta algo confidencial tiene que poder abrirlo después. Si
    // no, un colaborador redactaría documentos que dejan de existir para
    // él en cuanto los guarda.
    for (const rol of Object.values(Rol)) {
      expect(puedeVer(rol, confidencial(MIO), 'u1')).toBe(true);
      expect(puedeVer(rol, restringido(MIO), 'u1')).toBe(true);
    }
  });
});

describe('Visibilidad · el colaborador ve solo lo suyo', () => {

  it('no ve el documento público de otra persona', () => {
    // Este es el agujero que existía: devolvía TODO el acervo.
    expect(puedeVer(Rol.COLABORADOR, publico(AJENO), 'u1')).toBe(false);
  });

  it('tampoco el interno ni el confidencial ajenos', () => {
    expect(puedeVer(Rol.COLABORADOR, interno(AJENO), 'u1')).toBe(false);
    expect(puedeVer(Rol.COLABORADOR, confidencial(AJENO), 'u1')).toBe(false);
  });

  it('un documento sin dueño declarado no es suyo', () => {
    // Los anteriores a que existiera creadoPorUid. Se ocultan a quien no
    // ve todo el acervo: enseñárselos sería el agujero otra vez.
    expect(puedeVer(Rol.COLABORADOR, publico({}), 'u1')).toBe(false);
  });
});

describe('Visibilidad · el supervisor ve el acervo, no lo reservado', () => {

  it('ve los documentos abiertos de cualquiera', () => {
    expect(puedeVer(Rol.SUPERVISOR, publico(AJENO), 'u1')).toBe(true);
    expect(puedeVer(Rol.SUPERVISOR, interno(AJENO), 'u1')).toBe(true);
  });

  it('no ve lo confidencial ni lo restringido ajeno', () => {
    // Es la diferencia entre revisar el flujo de trabajo y acceder al
    // contenido reservado. El supervisor hace lo primero.
    expect(puedeVer(Rol.SUPERVISOR, confidencial(AJENO), 'u1')).toBe(false);
    expect(puedeVer(Rol.SUPERVISOR, restringido(AJENO), 'u1')).toBe(false);
  });

  it('sí lo suyo, aunque sea confidencial', () => {
    expect(puedeVer(Rol.SUPERVISOR, confidencial(MIO), 'u1')).toBe(true);
  });
});

describe('Visibilidad · jefatura, gerencia y administración lo ven todo', () => {

  for (const rol of [Rol.JEFE_AREA, Rol.GERENTE, Rol.ADMIN_EMPRESA]) {
    it(rol + ' ve cualquier documento de la empresa', () => {
      expect(puedeVer(rol, publico(AJENO), 'u1')).toBe(true);
      expect(puedeVer(rol, interno(AJENO), 'u1')).toBe(true);
      expect(puedeVer(rol, confidencial(AJENO), 'u1')).toBe(true);
      expect(puedeVer(rol, restringido(AJENO), 'u1')).toBe(true);
    });
  }
});

describe('Visibilidad · coherencia entre la matriz y la decisión', () => {

  it('ningún rol sin DOC_VER_TODOS ve un documento ajeno', () => {
    // Si alguien añade DOC_VER_TODOS a un rol y no repasa esto, la prueba
    // sigue siendo cierta: es la matriz la que manda.
    for (const rol of Object.values(Rol)) {
      if (tienePermiso(rol, Permiso.DOC_VER_TODOS)) continue;
      expect(puedeVer(rol, publico(AJENO), 'u1')).toBe(false);
    }
  });

  it('ningún rol sin DOC_VER_CONFIDENCIAL ve lo reservado ajeno', () => {
    for (const rol of Object.values(Rol)) {
      if (tienePermiso(rol, Permiso.DOC_VER_CONFIDENCIAL)) continue;
      expect(puedeVer(rol, confidencial(AJENO), 'u1')).toBe(false);
      expect(puedeVer(rol, restringido(AJENO), 'u1')).toBe(false);
    }
  });
});

describe('Visibilidad · las reglas de Firestore dicen lo mismo', () => {

  const reglas = readFileSync('firestore.rules', 'utf8');

  it('la regla de lectura comprueba el dueño', () => {
    // El filtro del cliente evita pedir lo que van a denegar. El que
    // protege es este: cualquiera puede llamar al SDK sin el filtro.
    expect(reglas).toContain('resource.data.creadoPorUid == request.auth.uid');
  });

  it('la regla distingue ver el acervo de ver lo reservado', () => {
    expect(reglas).toContain('function veTodoElAcervo(eid)');
    expect(reglas).toContain('function veLoReservado(eid)');
  });

  it('el supervisor está en el acervo pero no en lo reservado', () => {
    // Es exactamente la línea que hay que mirar si alguien discute por
    // qué un supervisor no abre un contrato marcado como confidencial.
    const acervo = reglas.match(/function veTodoElAcervo[\s\S]*?\n {4}\}/)![0];
    const reservado = reglas.match(/function veLoReservado[\s\S]*?\n {4}\}/)![0];

    expect(acervo).toContain('supervisor');
    expect(reservado).not.toContain('supervisor');
  });

  it('crear exige declararse dueño, y editar no permite cambiar de dueño', () => {
    // Sin lo primero, bastaba omitir el campo para quedar fuera de toda
    // comprobación. Sin lo segundo, se podría uno apropiar de un
    // documento ajeno o repudiar el propio.
    expect(reglas).toContain('request.resource.data.creadoPorUid == request.auth.uid');
    expect(reglas).toContain('resource.data.creadoPorUid == request.resource.data.creadoPorUid');
  });
});
