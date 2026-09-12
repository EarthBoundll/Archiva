/**
 * La bitácora tiene un solo camino de escritura y una sola colección.
 *
 * Este era el hallazgo A-3, y su forma era engañosa: no fallaba nada
 * visible. `getBitacora()` disparaba una migración que escribía una marca
 * en la ficha de la empresa, y esa ruta solo la escribe un administrador.
 * Para el resto de roles se denegaba, el `catch` lo registraba como aviso
 * y seguía — así que la marca no se ponía nunca, y en cada sesión se
 * volvía a leer la bitácora entera para decidir si había algo que migrar.
 *
 * Un error de permisos permanente e invisible, más una lectura completa
 * de una colección sin techo en cada arranque. En Firestore eso se paga
 * por documento leído.
 *
 * Se retiró en vez de arreglarse: migraba de una estructura que solo
 * existió en el producto anterior, así que no iba a mover nada nunca.
 */

import { readFileSync } from 'node:fs';

const firebase = readFileSync('src/app/core/services/firebase.ts', 'utf8');
const history  = readFileSync('src/app/core/services/history.ts', 'utf8');

describe('A-3 · la migración no vuelve', () => {

  it('leer la bitácora no dispara ninguna migración', () => {
    expect(history).not.toContain('asegurarUnificada');
    expect(history).not.toContain('migrarHistorialAntiguo');
  });

  it('leer la bitácora no escribe nada', () => {
    // Una lectura que escribe es una lectura que puede denegarse, y este
    // es el sitio donde eso pasaba sin que nadie lo notara.
    const lectura = history.slice(
      history.indexOf('async getBitacora()'),
      history.indexOf('async create(')
    );
    for (const escritura of ['crearRegistro', 'guardarEmpresa', 'setDoc', 'actualizar']) {
      expect(lectura).not.toContain(escritura);
    }
  });

  it('los alias que solo servían a la migración se fueron con ella', () => {
    // `getUserProfileComplete` devolvía la empresa, no un perfil de
    // usuario. Un nombre que miente sobrevive a base de que nadie lo mire.
    expect(firebase).not.toContain('getUserProfileComplete');
    expect(firebase).not.toContain('saveUserProfile');
    expect(firebase).not.toContain('bitacoraUnificada');
  });
});

describe('B-1 · no quedan colecciones que solo se lean', () => {

  /** Últimas rutas de colección que toca cada operación del servicio. */
  function colecciones(filtro: (cuerpo: string) => boolean): Set<string> {
    const marcas = [...firebase.matchAll(/\n  (?:async )?([a-zA-Z][a-zA-Z0-9]*)\s*\([^)]*\)[^{]*\{/g)];
    const out = new Set<string>();

    for (let i = 0; i < marcas.length; i++) {
      const desde = marcas[i].index!;
      const hasta = i + 1 < marcas.length ? marcas[i + 1].index! : firebase.length;
      const cuerpo = firebase.slice(desde, hasta);
      if (!filtro(cuerpo)) continue;

      for (const m of cuerpo.matchAll(/(?:collection|doc)\(this\.firestore,\s*[`']([^`']+)[`']/g)) {
        const partes = m[1].split('/').filter(Boolean);
        out.add(partes.length % 2 === 1 ? partes[partes.length - 1] : partes[partes.length - 2]);
      }
    }
    return out;
  }

  const lee     = colecciones(c => /getDocs?\(|getDoc\(/.test(c));
  const escribe = colecciones(c => /setDoc\(|updateDoc\(|deleteDoc\(|addDoc\(|lote\.set\(/.test(c));

  it('toda colección que se lee, alguien la escribe', () => {
    // `periodos/{id}/historial` se leía y nadie la escribía: existía solo
    // para que la migración tuviera de dónde migrar.
    //
    // `superadmins` es la excepción, y lo es por diseño: el cliente la lee
    // para resolver la sesión y NO la escribe nunca. Las reglas cierran su
    // escritura sin excepción —ni siquiera un operador nombra a otro desde
    // la aplicación— y solo se puebla con credenciales de servidor. Que
    // aquí figure como «solo lectura» no es un olvido: es la prueba de que
    // esa decisión sigue en pie.
    const SOLO_SERVIDOR = ['superadmins'];

    const soloLectura = [...lee]
      .filter(c => !escribe.has(c))
      .filter(c => !SOLO_SERVIDOR.includes(c))
      .sort();

    expect(soloLectura).toEqual([]);
  });

  it('la colección de plataforma se lee y nunca se escribe desde el cliente', () => {
    // El complemento de la excepción anterior: no basta con exceptuarla,
    // hay que comprobar que sigue siendo cierto lo que la justifica.
    expect(lee.has('superadmins')).toBe(true);
    expect(escribe.has('superadmins')).toBe(false);
  });

  it('toda colección que se escribe, alguien la lee', () => {
    // Lo contrario también importa: escribir en una colección que nadie
    // consulta es pagar por guardar algo que no se mira.
    const soloEscritura = [...escribe].filter(c => !lee.has(c)).sort();
    expect(soloEscritura).toEqual([]);
  });

  it('la bitácora sigue estando entre ellas', () => {
    // Comprobación de cordura: si el extractor dejara de encontrar nada,
    // las dos pruebas anteriores pasarían en vacío.
    expect(lee.has('bitacora')).toBe(true);
    expect(escribe.has('bitacora')).toBe(true);
    expect(lee.size).toBeGreaterThan(8);
  });
});
