/**
 * Que las consultas puedan devolver algo.
 *
 * Firestore excluye de los resultados los documentos que no tienen el
 * campo por el que se ordena. No lanza error, no avisa en consola, no
 * falla al compilar: devuelve una lista vacía. Una consulta que ordena
 * por un campo que la entidad no guarda esconde el cien por cien de los
 * registros, y la pantalla dice «no hay documentos» con la base llena.
 *
 * Es lo que pasaba con `getDocumentos`, que ordenaba por `name` cuando la
 * entidad guarda `titulo` — un resto del proyecto base, donde las
 * entidades sí tenían `name`. El acervo entero era invisible.
 *
 * Estas pruebas leen el servicio y comprueban que cada campo de ordenación
 * lo escribe realmente el método que crea en esa colección. Es una prueba
 * sobre el código fuente, no sobre su comportamiento, porque el fallo no
 * tiene comportamiento observable sin una base de datos real.
 */

import { readFileSync } from 'node:fs';

// Ruta desde la raiz del proyecto: import.meta.url no es un file:// en
// este entorno de pruebas, y new URL() sobre el falla.
const fuente = readFileSync('src/app/core/services/firebase.ts', 'utf8');

/** Campos que Firestore rellena o que escribe siempre todo `crear*`. */
const SIEMPRE_PRESENTES = new Set(['createdAt', 'updatedAt', 'id', 'empresaId', 'activo']);

/** Extrae los pares (colección, campo de orden) de cada consulta. */
function ordenaciones(): { coleccion: string; campo: string; metodo: string }[] {
  const salida: { coleccion: string; campo: string; metodo: string }[] = [];

  // Cada método async con su cuerpo hasta el siguiente método.
  const metodos = [...fuente.matchAll(/\n  (?:async )?([a-zA-Z]+)\s*\([^)]*\)[^{]*\{/g)];

  for (let i = 0; i < metodos.length; i++) {
    const nombre = metodos[i][1];
    const desde = metodos[i].index!;
    const hasta = i + 1 < metodos.length ? metodos[i + 1].index! : fuente.length;
    const cuerpo = fuente.slice(desde, hasta);

    if (!cuerpo.includes('orderBy(')) continue;

    // La última parte de la ruta es la colección.
    const ruta = cuerpo.match(/collection\(this\.firestore,\s*`([^`]+)`/);
    if (!ruta) continue;
    const coleccion = ruta[1].split('/').filter(Boolean).pop()!;

    for (const m of cuerpo.matchAll(/orderBy\('([^']+)'/g)) {
      salida.push({ coleccion, campo: m[1], metodo: nombre });
    }
  }
  return salida;
}

/** Campos que el método de creación escribe en esa colección. */
function camposEscritos(coleccion: string): Set<string> | null {
  // crearDocumento → documentos, crearSolicitud → solicitudes, etc.
  const creadores = [...fuente.matchAll(/\n  async (crear[A-Za-z]+|registrar[A-Za-z]+|definir[A-Za-z]+|guardar[A-Za-z]+)\s*\([^)]*\)[^{]*\{([\s\S]*?)\n  \}/g)];

  for (const c of creadores) {
    const cuerpo = c[2];
    const ruta = cuerpo.match(/collection\(this\.firestore,\s*`([^`]+)`/);
    if (!ruta) continue;
    if (ruta[1].split('/').filter(Boolean).pop() !== coleccion) continue;

    const campos = new Set<string>();
    for (const m of cuerpo.matchAll(/^\s{6}([a-zA-Z][a-zA-Z0-9]*):/gm)) campos.add(m[1]);
    // Cualquier propagacion —...data, ...asiento, ...payload— significa
    // que el resto de campos los aporta quien llama, y desde aqui no se
    // puede saber cuales son.
    if (/...[a-zA-Z]/.test(cuerpo)) campos.add('*');
    return campos;
  }
  return null;
}

describe('Consultas · el campo de ordenación tiene que existir', () => {

  it('hay consultas ordenadas que revisar', () => {
    // Si el extractor deja de encontrar nada, esta batería pasaría en
    // vacío y dejaría de proteger sin que nadie se entere.
    expect(ordenaciones().length).toBeGreaterThan(2);
  });

  it('ninguna ordena por «name»: ninguna entidad de ARCHIVA tiene ese campo', () => {
    // `name` es del proyecto base. Documento y SolicitudRevision guardan
    // `titulo`; el flujo sí tiene `name`, pero ya no se ordena por él.
    const porName = ordenaciones().filter(o => o.campo === 'name');
    expect(porName.map(o => o.metodo + ' → ' + o.coleccion)).toEqual([]);
  });

  it('cada campo de orden lo escribe el creador de esa colección', () => {
    const fallos: string[] = [];

    for (const o of ordenaciones()) {
      if (SIEMPRE_PRESENTES.has(o.campo)) continue;

      const escritos = camposEscritos(o.coleccion);
      // Sin creador conocido no se puede afirmar nada: no se inventa.
      if (!escritos) continue;
      // Si el creador propaga ...data, el campo puede venir de fuera.
      if (escritos.has('*')) continue;

      if (!escritos.has(o.campo)) {
        fallos.push(`${o.metodo} ordena ${o.coleccion} por «${o.campo}», que nadie escribe`);
      }
    }

    expect(fallos).toEqual([]);
  });
});

describe('Consultas · aislamiento por empresa', () => {

  it('ninguna consulta lee una colección fuera de empresas/', () => {
    // Tres excepciones, y cada una con su motivo:
    //
    //   usuarios      el perfil global dice a qué empresa perteneces. Hay
    //                 que leerlo antes de conocerla.
    //   invitaciones  el índice tiene que ser legible por quien todavía no
    //                 pertenece a ninguna: ese es el punto de aceptar.
    //   superadmins   quien opera la plataforma no tiene empresa. Su
    //                 condición no puede colgar de una.
    //
    // Una cuarta necesitaría su propia razón, y esta prueba existe para
    // obligar a escribirla.
    const permitidas = ['usuarios', 'invitaciones', 'superadmins'];

    const fuera = [...fuente.matchAll(/(?:collection|doc)\(this\.firestore,\s*[`']([^`']+)[`']/g)]
      .map(m => m[1])
      .filter(r => r !== 'empresas' && !r.startsWith('empresas/'))
      .filter(r => !permitidas.includes(r.split('/')[0]));

    expect(fuera).toEqual([]);
  });
});
