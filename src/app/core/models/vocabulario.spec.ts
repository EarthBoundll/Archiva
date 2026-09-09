/**
 * Que las reglas hablen el mismo idioma que el código.
 *
 * Las reglas de Firestore comparan cadenas contra valores que escribe el
 * cliente. Si una parte dice `ADMIN_EMPRESA` y la otra `admin_empresa`, la
 * comparación no falla: es simplemente falsa, siempre. No hay error de
 * compilación, ni aviso en consola, ni prueba que se rompa — solo un
 * permiso que nunca se concede.
 *
 * Pasó dos veces en el mismo día:
 *
 *   · `veTodoElAcervo` y `veLoReservado`, escritos en minúsculas, eran
 *     falsos siempre. La lectura de documentos quedó reducida a «solo lo
 *     que yo creé»: ni un administrador podía abrir un documento ajeno.
 *
 *   · El script de siembra escribía `rol: 'admin_empresa'`, así que
 *     `esAdmin()` era falso para el único administrador del sistema. Habría
 *     quedado encerrado fuera de Personas y de las invitaciones, sin poder
 *     dar de alta a nadie nunca.
 *
 * Y la prueba que escribí para la visibilidad comprobaba la cadena en
 * minúsculas, así que pasaba PORQUE el fallo estaba ahí. Estas cotejan
 * contra el enum, que es la única fuente que no puede desincronizarse
 * consigo misma.
 */

import { readFileSync } from 'node:fs';

import { Rol } from './rbac.model';
import { ESTADOS_MIEMBRO } from './member.model';

const reglas  = readFileSync('firestore.rules', 'utf8');
const siembra = readFileSync('scripts/sembrar-empresa.mjs', 'utf8');

/** Toda cadena entre comillas simples que aparece en las reglas. */
const cadenasEnReglas = [...reglas.matchAll(/'([A-Za-z_][A-Za-z0-9_]*)'/g)].map(m => m[1]);

describe('Vocabulario · los roles', () => {

  const valores = Object.values(Rol) as string[];

  it('el enum guarda los valores en mayúsculas', () => {
    // Si esto cambiara, todo lo demás de este fichero cambia con ello.
    for (const v of valores) expect(v).toBe(v.toUpperCase());
  });

  it('las reglas nombran roles que existen en el enum', () => {
    // Cualquier cadena de las reglas que se parezca a un rol tiene que ser
    // uno de verdad. Una que no lo sea es una comparación imposible.
    const parecenRol = cadenasEnReglas.filter(c => /^[A-Za-z_]*(EMPRESA|GERENTE|AREA|SUPERVISOR|COLABORADOR|empresa|gerente|area|supervisor|colaborador)$/.test(c));
    const desconocidos = [...new Set(parecenRol)].filter(c => !valores.includes(c));
    expect(desconocidos).toEqual([]);
  });

  it('ninguna regla compara roles en minúsculas', () => {
    // El fallo concreto, dicho de la forma más directa posible.
    const minusculas = cadenasEnReglas.filter(c =>
      valores.some(v => v.toLowerCase() === c && v !== c)
    );
    expect([...new Set(minusculas)]).toEqual([]);
  });

  it('los roles que las reglas nombran son los que están por encima del suelo', () => {
    // COLABORADOR no aparece en ningún predicado, y está bien: es el
    // suelo del sistema, y se define por ausencia. Lo que sí tiene que
    // cumplirse es que todos los demás estén nombrados en alguna parte —
    // un rol intermedio que las reglas no mencionan nunca es un rol sin
    // frontera propia, que en la práctica equivale al suelo.
    for (const v of valores) {
      if (v === Rol.COLABORADOR) continue;
      expect(reglas).toContain("'" + v + "'");
    }

    expect(reglas).not.toContain("'" + Rol.COLABORADOR + "'");
  });
});

describe('Vocabulario · los estados de pertenencia', () => {

  const estados = Object.keys(ESTADOS_MIEMBRO);

  it('las reglas comprueban «activo» con la grafía del modelo', () => {
    // esMiembroActivo compara contra este valor. Con otra grafía, nadie
    // sería miembro activo y el sistema entero denegaría.
    expect(estados).toContain('activo');
    expect(reglas).toContain("estado == 'activo'");
  });
});

describe('Vocabulario · el script de siembra', () => {

  it('siembra un rol que el enum reconoce', () => {
    // Es el único administrador que existirá al arrancar. Si su rol no
    // coincide, no administra nada.
    const rol = siembra.match(/^\s*rol: '([A-Z_a-z]+)',/m);
    expect(rol).not.toBeNull();
    expect(Object.values(Rol) as string[]).toContain(rol![1]);
  });

  it('siembra un estado de pertenencia que el modelo reconoce', () => {
    const estado = siembra.match(/rol: '[A-Z_]+',\s*\n\s*estado: '([a-z]+)',/);
    expect(estado).not.toBeNull();
    expect(Object.keys(ESTADOS_MIEMBRO)).toContain(estado![1]);
  });
});

describe('Vocabulario · un solo camino para leer el rol', () => {

  it('no hay dos ayudantes que lean el mismo dato', () => {
    // Había `miRol()` y `rolEn()`, idénticos. Dos formas de leer lo mismo
    // es como se acaba comparando cada una contra un vocabulario distinto:
    // el segundo nació en minúsculas y nadie lo notó.
    expect(reglas).toContain('function miRol(eid)');
    expect(reglas).not.toContain('function rolEn(eid)');
  });
});
