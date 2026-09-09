/**
 * Que cada permiso declarado guarde algo de verdad.
 *
 * Este era el hallazgo A-2. Ocho permisos estaban en la matriz,
 * repartidos por rol y cubiertos por pruebas — y no los comprobaba nadie,
 * ni el cliente ni las reglas. Un colaborador podía archivar documentos y
 * anular solicitudes sin tener `DOC_ARCHIVAR` ni `SOL_ANULAR`.
 *
 * La matriz describía un sistema más estricto del que existía. Es el
 * mismo patrón que produjo el fallo de visibilidad: regla escrita,
 * documentada, probada… y sin aplicar. Las pruebas de la matriz pasaban
 * precisamente porque solo miraban la matriz.
 *
 * Estas miran los dos sitios donde la matriz tiene que morder: el
 * servicio, que da el mensaje, y la regla, que es la frontera.
 */

import { readFileSync } from 'node:fs';

import { Rol, Permiso, PERMISO_POR_RUTA, tienePermiso } from './rbac.model';

const reglas = readFileSync('firestore.rules', 'utf8');

const servicios = {
  documento: readFileSync('src/app/core/services/document.ts', 'utf8'),
  solicitud: readFileSync('src/app/core/services/review-request.ts', 'utf8'),
  flujo:     readFileSync('src/app/core/services/workflow.ts', 'utf8')
};

/** El cuerpo de un método, para comprobar qué exige antes de actuar. */
function metodo(fuente: string, firma: string): string {
  const i = fuente.indexOf(firma);
  if (i < 0) throw new Error('no existe el método ' + firma);
  return fuente.slice(i, i + 400);
}

describe('A-2 · el servicio exige el permiso antes de actuar', () => {

  const casos: [string, string, Permiso][] = [
    ['documento', 'async create(payload: DocumentoPayload)',        Permiso.DOC_CREAR],
    ['documento', 'async update(documentoId: string',               Permiso.DOC_EDITAR],
    ['documento', 'async archivar(doc: Documento)',                 Permiso.DOC_ARCHIVAR],
    ['solicitud', 'async create(payload: SolicitudRevisionPayload)', Permiso.SOL_CREAR],
    ['solicitud', 'async tomar(s: SolicitudRevision',               Permiso.SOL_ATENDER],
    ['solicitud', 'async marcarAtendida(s: SolicitudRevision',      Permiso.SOL_ATENDER],
    ['solicitud', 'async anular(s: SolicitudRevision',              Permiso.SOL_ANULAR],
    ['flujo',     'async update(flujoId: string',                   Permiso.FLUJO_EDITAR]
  ];

  for (const [servicio, firma, permiso] of casos) {
    it(`${firma.replace('async ', '').split('(')[0]}() exige ${permiso}`, () => {
      const cuerpo = metodo(servicios[servicio as keyof typeof servicios], firma);
      expect(cuerpo).toContain('this.exigir(Permiso.' + permiso + ')');
    });
  }

  it('archivar también se comprueba en la transición de estado', () => {
    // Archivar se alcanza por dos puertas: el método propio y un cambio
    // de estado a mano. Guardar solo la primera dejaba la segunda abierta.
    const cuerpo = servicios.documento.slice(
      servicios.documento.indexOf('async cambiarEstado('),
      servicios.documento.indexOf('async registrarNuevaVersion')
    );
    expect(cuerpo).toContain("nuevoEstado === 'archivado'");
    expect(cuerpo).toContain('this.exigir(Permiso.DOC_ARCHIVAR)');
  });
});

describe('A-2 · la regla exige lo mismo que el servicio', () => {

  it('archivar un documento se detiene en la jefatura', () => {
    // DOC_ARCHIVAR lo tienen administración, gerencia y jefatura: es
    // exactamente esGestor. Supervisión y colaboración no lo tienen.
    const doc = reglas.slice(reglas.indexOf('match /documentos/{id}'), reglas.indexOf('match /archivos/'));
    expect(doc).toContain("request.resource.data.estado != 'archivado'");
    expect(doc).toContain('esGestor(eid)');
  });

  it('un documento ya archivado no vuelve a exigir el permiso', () => {
    // Sin esta salida, cualquier edición posterior de un documento
    // archivado quedaría reservada a la jefatura sin motivo.
    const doc = reglas.slice(reglas.indexOf('match /documentos/{id}'), reglas.indexOf('match /archivos/'));
    expect(doc).toContain("resource.data.estado == 'archivado'");
  });

  it('anular una solicitud es cosa de dirección', () => {
    // SOL_ANULAR no lo tiene ni la jefatura.
    expect(reglas).toContain('function esDireccion(eid)');
    const sol = reglas.slice(reglas.indexOf('match /solicitudes/{id}'), reglas.indexOf('match /flujos/{id}'));
    expect(sol).toContain("request.resource.data.status == 'anulada'");
    expect(sol).toContain('esDireccion(eid)');
  });

  it('atenderla llega hasta supervisión, y no más abajo', () => {
    const sol = reglas.slice(reglas.indexOf('match /solicitudes/{id}'), reglas.indexOf('match /flujos/{id}'));
    expect(sol).toContain("request.resource.data.status in ['atendida', 'en_proceso']");
    expect(sol).toContain('esAprobador(eid)');
  });

  it('quien la pidió ya no puede anularla por ser suya', () => {
    // Antes bastaba figurar como solicitante para cualquier cambio, así
    // que un colaborador anulaba la suya sin tener SOL_ANULAR.
    const sol = reglas.slice(reglas.indexOf('match /solicitudes/{id}'), reglas.indexOf('match /flujos/{id}'));
    const ramaPropia = sol.slice(sol.indexOf('resource.data.solicitante'));
    expect(ramaPropia).not.toContain('anulada');
  });
});

describe('A-2 · los conjuntos de la regla coinciden con la matriz', () => {

  /** Los roles que, según la matriz, tienen un permiso. */
  const conMatriz = (p: Permiso) =>
    (Object.values(Rol) as Rol[]).filter(r => tienePermiso(r, p)).sort();

  /** Los roles que nombra un predicado de las reglas. */
  function conRegla(nombre: string): Rol[] {
    const i = reglas.indexOf('function ' + nombre + '(eid)');
    const cuerpo = reglas.slice(i, reglas.indexOf('\n    }', i));
    return (Object.values(Rol) as Rol[]).filter(r => cuerpo.includes("'" + r + "'")).sort();
  }

  it('DOC_ARCHIVAR coincide con esGestor', () => {
    expect(conMatriz(Permiso.DOC_ARCHIVAR)).toEqual(conRegla('esGestor'));
  });

  it('SOL_ATENDER coincide con esAprobador', () => {
    expect(conMatriz(Permiso.SOL_ATENDER)).toEqual(conRegla('esAprobador'));
  });

  it('SOL_ANULAR coincide con esDireccion', () => {
    expect(conMatriz(Permiso.SOL_ANULAR)).toEqual(conRegla('esDireccion'));
  });

  it('FLUJO_EDITAR coincide con esGestor', () => {
    expect(conMatriz(Permiso.FLUJO_EDITAR)).toEqual(conRegla('esGestor'));
  });

  it('EMPRESA_EDITAR coincide con esAdmin', () => {
    expect(conMatriz(Permiso.EMPRESA_EDITAR)).toEqual(conRegla('esAdmin'));
  });
});

describe('A-2 · ningún permiso queda sin aplicar', () => {

  it('cada permiso se comprueba en algún sitio', () => {
    // Un permiso que nadie comprueba describe una restricción que no
    // existe, y eso es peor que no declararlo: da confianza infundada.
    const fuentes = [
      ...Object.values(servicios),
      readFileSync('src/app/core/services/members.ts', 'utf8'),
      readFileSync('src/app/core/services/company.ts', 'utf8'),
      readFileSync('src/app/core/services/approvals.ts', 'utf8'),
      readFileSync('src/app/core/layout/layout.component.ts', 'utf8'),
      readFileSync('src/app/pages/documents/documents.ts', 'utf8'),
      readFileSync('src/app/pages/workflows/workflows.ts', 'utf8'),
      readFileSync('src/app/pages/users/users.ts', 'utf8')
    ].join('\n');

    // Las rutas también cuentan: el guard las aplica genéricamente.
    const enRutas = new Set(Object.values(PERMISO_POR_RUTA));

    const huerfanos = (Object.values(Permiso) as Permiso[]).filter(p =>
      !enRutas.has(p) && !new RegExp('Permiso\\.' + p + '\\b').test(fuentes)
    );

    expect(huerfanos).toEqual([]);
  });
});
