/**
 * Que el panel de avisos diga la verdad y no se repita.
 *
 * Dos cosas pueden romperlo sin que nada falle al compilar. La primera es
 * llamar vencido a lo que el modelo no da por vencido: `calcularVigencia`
 * solo marca `estaVencido` cuando el documento esta aprobado, de modo que
 * un borrador con la fecha pasada no esta vencido, esta sin aprobar. La
 * segunda es derivar el identificador del instante en que se calcula: cada
 * recarga crearia avisos nuevos para el mismo hecho y el contador no
 * bajaria nunca, por mucho que se marque como leido.
 */
import { TestBed } from '@angular/core/testing';
import { NotificacionesService } from './notificaciones';
import { FirebaseService } from './firebase';
import { TenantService } from './tenant';
import { DocumentService } from './document';

const HOY = new Date();
const enDias = (n: number) => {
  const d = new Date(HOY);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

function doc(over: Record<string, unknown> = {}) {
  const dias = (over['dias'] as number) ?? 5;
  return {
    id: 'd1', codigo: 'CON-ADM-0001', titulo: 'Contrato de prueba',
    estado: 'aprobado', activo: true, alertarDiasAntes: 7,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    vencimiento: {
      fechaVencimiento: enDias(dias), diasParaVencer: dias,
      estaVencido: dias < 0, renovacionesOmitidas: 0, periodosOmitidos: []
    },
    ...over
  };
}

function montar(docs: unknown[], perfil: unknown = null) {
  const guardado: unknown[] = [];
  const firebase = {
    getBitacora: async () => [],
    getPerfilGlobal: async () => perfil,
    guardarPerfilGlobal: async (_uid: string, data: unknown) => { guardado.push(data); }
  };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: FirebaseService, useValue: firebase },
      { provide: TenantService,   useValue: { uid: () => 'u1', empresaOpcional: () => 'e1' } },
      { provide: DocumentService, useValue: { getAll: async () => docs } }
    ]
  });
  return { servicio: TestBed.inject(NotificacionesService), guardado };
}

describe('NotificacionesService', () => {

  it('llama vencido solo a lo que el modelo da por vencido', async () => {
    const { servicio } = montar([doc({ dias: -4, estado: 'aprobado' })]);
    await servicio.cargar();
    expect(servicio.lista()[0].titulo).toContain('Documento vencido');
  });

  it('un documento sin aprobar con la fecha pasada no se anuncia como vencido', async () => {
    const { servicio } = montar([doc({ dias: -4, estado: 'en_revision' })]);
    await servicio.cargar();
    const aviso = servicio.lista()[0];
    expect(aviso.titulo).toContain('Plazo superado');
    expect(aviso.titulo).not.toContain('Documento vencido');
  });

  it('avisa dentro del umbral de antelacion y calla fuera de el', async () => {
    const dentro = montar([doc({ dias: 3, alertarDiasAntes: 7 })]);
    await dentro.servicio.cargar();
    expect(dentro.servicio.lista().length).toBe(1);
    expect(dentro.servicio.lista()[0].tipo).toBe('por_vencer');

    const fuera = montar([doc({ dias: 20, alertarDiasAntes: 7 })]);
    await fuera.servicio.cargar();
    expect(fuera.servicio.lista().length).toBe(0);
  });

  it('no genera avisos de documentos archivados ni inactivos', async () => {
    const archivado = montar([doc({ dias: -9, estado: 'archivado' })]);
    await archivado.servicio.cargar();
    expect(archivado.servicio.lista().length).toBe(0);

    const inactivo = montar([doc({ dias: -9, activo: false })]);
    await inactivo.servicio.cargar();
    expect(inactivo.servicio.lista().length).toBe(0);
  });

  it('anuncia los documentos pendientes de aprobacion', async () => {
    const { servicio } = montar([doc({ dias: 40, estado: 'pendiente_aprobacion' })]);
    await servicio.cargar();
    expect(servicio.lista().some(n => n.tipo === 'pendiente_aprobacion')).toBe(true);
  });

  it('mantiene el mismo identificador entre cargas: el mismo hecho no se duplica', async () => {
    const { servicio } = montar([doc({ dias: -4 })]);
    await servicio.cargar();
    const primero = servicio.lista().map(n => n.id);
    await servicio.cargar(true);
    expect(servicio.lista().map(n => n.id)).toEqual(primero);
    expect(new Set(primero).size).toBe(primero.length);
  });

  it('marcar todas como leidas deja el contador a cero y lo registra en el perfil', async () => {
    const { servicio, guardado } = montar([doc({ dias: -4 }), doc({ id: 'd2', dias: 2 })]);
    await servicio.cargar();
    expect(servicio.noLeidas()).toBe(2);

    await servicio.marcarTodasLeidas();
    expect(servicio.noLeidas()).toBe(0);
    expect(guardado.length).toBe(1);
    expect((guardado[0] as Record<string, unknown>)['notificacionesLeidas']).toBeDefined();
    // El vinculo con la empresa viaja intacto: las reglas lo exigen.
    expect((guardado[0] as Record<string, unknown>)['empresaId']).toBe('e1');
  });

  it('respeta lo que ya estaba leido en el perfil', async () => {
    const id = `venc:d1:${enDias(-4)}`;
    const { servicio } = montar([doc({ dias: -4 })], { notificacionesLeidas: [id] });
    await servicio.cargar();
    expect(servicio.lista()[0].leida).toBe(true);
    expect(servicio.noLeidas()).toBe(0);
  });
});
