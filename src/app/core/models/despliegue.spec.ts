/**
 * Lo que tiene que ser cierto para poder desplegar.
 *
 * Estas pruebas no miran comportamiento de la aplicación: miran los
 * ficheros que gobiernan la frontera real del sistema. Un error en
 * `firestore.rules` no rompe ninguna pantalla ni falla ninguna
 * compilación — se descubre en producción, cuando alguien lee lo que no
 * debía o cuando una consulta legítima empieza a devolver «permiso
 * denegado». Es el peor sitio posible para descubrirlo.
 */

import { readFileSync } from 'node:fs';

/**
 * Se leen del disco, no se importan: el empaquetador no tiene cargador
 * para .rules ni para .firebaserc, y anadirle uno solo para esto seria
 * cambiar la construccion del proyecto por una prueba.
 */
const leer = (f: string) => readFileSync(f, 'utf8');
const leerJson = (f: string) => JSON.parse(leer(f));

const reglas       = leer('firestore.rules');
const indices      = leerJson('firestore.indexes.json') as { indexes: { collectionGroup: string; fields: { fieldPath: string }[] }[] };
const proyecto     = leerJson('.firebaserc') as { projects: { default: string } };
const firebaseJson = leerJson('firebase.json') as { firestore: { rules: string; indexes: string } };

describe('Despliegue · configuración de Firebase', () => {

  it('el proyecto está declarado: el despliegue no debe preguntar cuál', () => {
    // Sin .firebaserc, `firebase deploy` abre un selector interactivo y
    // el comando de la documentación no se puede copiar y pegar.
    expect(proyecto.projects.default).toBe('archiva-4cf51');
  });

  it('firebase.json despliega reglas e índices, no solo reglas', () => {
    expect(firebaseJson.firestore.rules).toBe('firestore.rules');
    expect(firebaseJson.firestore.indexes).toBe('firestore.indexes.json');
  });

  it('el índice compuesto que exige el reparto de capacidad está declarado', () => {
    // getCuotasPorPeriodo ordena por dos campos a la vez. Firestore no
    // resuelve eso sin índice: falla en ejecución, no al compilar.
    const i = indices.indexes.find((x) => x.collectionGroup === 'almacenamiento');
    expect(i).toBeDefined();
    expect(i!.fields.map(f => f.fieldPath)).toEqual(['esPrioritaria', 'budgetedAmount']);
  });
});

describe('Despliegue · reglas de Firestore', () => {

  it('exige autenticación antes que nada', () => {
    expect(reglas).toContain('function autenticado()');
    expect(reglas).toContain('request.auth != null');
  });

  it('la pertenencia es lo que concede el acceso, no el testigo', () => {
    // La comprobación se hace leyendo empresas/{eid}/miembros/{uid}. Si
    // esta línea desapareciera, bastaría estar autenticado para entrar en
    // cualquier empresa.
    expect(reglas).toContain('function esMiembroActivo(eid)');
    expect(reglas).toMatch(/miembros\/\$\(request\.auth\.uid\)/);
  });

  it('nadie enumera las invitaciones', () => {
    // Se puede canjear un testigo concreto, pero no cosechar la lista:
    // eso daría los correos y los roles de toda la plantilla.
    expect(reglas).toMatch(/match \/invitaciones\/\{token\}[\s\S]*?allow list: if false/);
  });

  it('la auditoría no se edita ni se borra', () => {
    // Un registro que se puede corregir no es un registro.
    expect(reglas).toMatch(/match \/auditoria\/\{id\}[\s\S]*?allow update, delete: if false/);
  });

  it('los documentos se archivan, no se borran', () => {
    expect(reglas).toMatch(/match \/documentos\/\{id\}[\s\S]*?allow delete: if false/);
  });

  it('a los miembros se les suspende, no se les borra', () => {
    expect(reglas).toMatch(/match \/miembros\/\{uid\}[\s\S]*?allow delete: if false/);
  });

  it('nadie se modifica a sí mismo', () => {
    // Sin esto, cualquiera se asciende a administrador editando su propia
    // pertenencia.
    expect(reglas).toContain("request.auth.uid != uid");
  });

  it('el responsable de una etapa tiene que existir en la empresa', () => {
    // Sin esta comprobación, quien abre un expediente podría inventarse un
    // aprobador y firmar su propio documento.
    expect(reglas).toContain('exists(/databases/');
    expect(reglas).toContain('/miembros/$(request.resource.data.responsableUid))');
  });

  it('una plantilla la escribe la jefatura; un expediente, cualquier miembro', () => {
    // Es la separación que permite que un colaborador mande su contrato a
    // aprobar sin poder decidir quién lo firma.
    expect(reglas).toContain('request.resource.data.documentoId is string');
    expect(reglas).toContain('request.resource.data.duplicadoDe is string');
  });

  it('no queda ninguna regla abierta de par en par', () => {
    // `allow read, write: if true` es el error que convierte una base de
    // datos multiempresa en una base de datos pública.
    const abiertas = reglas
      .split('\n')
      .filter((l: string) => /allow\s+[a-z, ]*:\s*if\s+true\s*;/.test(l))
      // El índice de invitaciones es el único `get` público a propósito:
      // quien acepta todavía no pertenece a ninguna empresa.
      .filter((l: string) => !l.includes('allow get: if true'));

    expect(abiertas).toEqual([]);
  });

  it('las llaves están equilibradas: una regla mal cerrada no despliega', () => {
    const abre = (reglas.match(/\{/g) ?? []).length;
    const cierra = (reglas.match(/\}/g) ?? []).length;
    expect(abre).toBe(cierra);
  });
});
