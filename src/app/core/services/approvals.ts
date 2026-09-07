import { Injectable, inject } from '@angular/core';
import { FirebaseService } from './firebase';
import { TenantService } from './tenant';
import { AuditService } from './audit';
import { HistoryService } from './history';
import {
  TareaAprobacion,
  ResolucionPayload,
  AccionAprobacion,
  Bandeja,
  ResumenBandeja,
  ACCIONES_APROBACION,
  admiteResolucion,
  puedeResolver,
  estaVencida,
  accionesDisponibles,
  validarResolucion,
  resumirBandeja,
  Traspaso
} from '../models/approval.model';
import { FlujoAprobacion, EtapaDefinida } from '../models/workflow.model';
import { Permiso } from '../models/rbac.model';
import { AccionAuditada } from '../models/audit.model';

/** Qué asiento de auditoría corresponde a cada acción. */
const AUDITORIA: Record<AccionAprobacion, AccionAuditada> = {
  aprobar: 'aprobo',
  observar: 'observo',
  rechazar: 'rechazo',
  solicitar_correccion: 'solicito_correccion',
  delegar: 'delego',
  reasignar: 'reasigno'
};

/**
 * Tareas de aprobación y bandejas.
 *
 * Cuando un flujo se abre, cada etapa definida genera una tarea con su
 * responsable. La tarea es lo que aparece en la bandeja de esa persona y
 * lo que sostiene la trazabilidad del expediente.
 *
 * Las tareas viven en su propia colección, no dentro del flujo: la bandeja
 * es una consulta por responsable, y leer todos los flujos de la empresa
 * para filtrar sus etapas no escala.
 */
@Injectable({ providedIn: 'root' })
export class ApprovalsService {
  private firebase = inject(FirebaseService);
  private tenant = inject(TenantService);
  private audit = inject(AuditService);
  private history = inject(HistoryService);

  // ------------------------------------------
  // APERTURA DE EXPEDIENTE
  // ------------------------------------------

  /**
   * Abre las tareas de un flujo.
   *
   * Solo la primera queda pendiente: las demás esperan a que la anterior
   * se apruebe. Sin eso, todas aparecerían a la vez en las bandejas y el
   * orden de las etapas dejaría de significar nada.
   */
  async abrirFlujo(flujo: FlujoAprobacion, etapas: EtapaDefinida[]): Promise<TareaAprobacion[]> {
    const empresaId = this.tenant.exigirEmpresa();
    const ahora = new Date();
    const creadas: TareaAprobacion[] = [];

    for (const etapa of etapas) {
      const tarea = await this.firebase.crearTarea(empresaId, {
        flujoId: flujo.id,
        flujoNombre: flujo.name,
        documentoId: flujo.documentoId,
        codigoDocumento: flujo.codigoDocumento,
        tituloDocumento: flujo.name,

        orden: etapa.orden,
        etapaNombre: etapa.nombre,
        etapasTotales: etapas.length,

        responsableUid: etapa.responsableUid,
        responsableNombre: etapa.responsableNombre,
        asignadoUid: etapa.responsableUid,
        asignadoNombre: etapa.responsableNombre,
        rolRequerido: etapa.rolRequerido,
        area: etapa.area,

        // Solo la primera se abre; el resto espera su turno.
        estado: etapa.orden === 1 ? 'pendiente' : 'en_curso',
        prioridad: flujo.priority ?? 'medium',

        fechaCreacion: ahora.toISOString(),
        fechaLimite: etapa.plazoDias
          ? new Date(ahora.getTime() + etapa.plazoDias * 86400000).toISOString()
          : undefined,
        traspasos: []
      });
      creadas.push(tarea as TareaAprobacion);
    }

    await this.audit.registrarSobre(
      'creo', 'flujo', flujo.id, flujo.name,
      `${etapas.length} etapas abiertas`
    );

    return creadas;
  }

  // ------------------------------------------
  // LECTURA
  // ------------------------------------------

  async getTodas(): Promise<TareaAprobacion[]> {
    const empresaId = this.tenant.empresaOpcional();
    if (!empresaId) return [];
    return (await this.firebase.getTareas(empresaId)) as TareaAprobacion[];
  }

  async getDeFlujo(flujoId: string): Promise<TareaAprobacion[]> {
    const empresaId = this.tenant.empresaOpcional();
    if (!empresaId) return [];
    const t = (await this.firebase.getTareasDeFlujo(empresaId, flujoId)) as TareaAprobacion[];
    return t.sort((a, b) => a.orden - b.orden);
  }

  /** Contenido de una bandeja concreta. */
  async getBandeja(bandeja: Bandeja): Promise<TareaAprobacion[]> {
    const uid = this.tenant.uid();
    if (!uid) return [];

    const todas = await this.getTodas();

    switch (bandeja) {
      case 'pendientes':
        return todas
          .filter(t => t.asignadoUid === uid && t.estado === 'pendiente')
          .sort(this.porUrgencia);

      case 'aprobaciones':
        return todas
          .filter(t => t.resueltaPorUid === uid && t.accion === 'aprobar')
          .sort(this.porResolucion);

      case 'observaciones':
        return todas
          .filter(t => t.resueltaPorUid === uid &&
                      (t.accion === 'observar' || t.accion === 'solicitar_correccion' || t.accion === 'rechazar'))
          .sort(this.porResolucion);

      case 'documentos':
        // Lo que esta persona puso en circulación.
        return todas
          .filter(t => t.responsableUid === uid && t.orden === 1)
          .sort(this.porUrgencia);

      case 'historial':
        return todas
          .filter(t => t.resueltaPorUid === uid)
          .sort(this.porResolucion);
    }
  }

  async getResumen(): Promise<ResumenBandeja> {
    const uid = this.tenant.uid();
    if (!uid) return { pendientes: 0, vencidas: 0, delegadasAMi: 0, resueltasEstePeriodo: 0, diasPromedio: null };
    return resumirBandeja(await this.getTodas(), uid);
  }

  // ------------------------------------------
  // RESOLUCION
  // ------------------------------------------

  async resolver(tarea: TareaAprobacion, p: ResolucionPayload): Promise<TareaAprobacion> {
    this.exigir(Permiso.APROBAR);

    const uid = this.tenant.uid()!;
    const miembro = this.tenant.miembro()!;
    const empresaId = this.tenant.exigirEmpresa();

    if (!puedeResolver(tarea, uid)) {
      throw new Error(
        admiteResolucion(tarea)
          ? 'Esta etapa está asignada a otra persona.'
          : 'Esta etapa ya está resuelta.'
      );
    }

    const invalido = validarResolucion(p);
    if (invalido) throw new Error(invalido);

    if (p.accion === 'delegar')   this.exigir(Permiso.DELEGAR);
    if (p.accion === 'reasignar') this.exigir(Permiso.REASIGNAR);

    const ahora = new Date().toISOString();
    const nombre = miembro.nombre || miembro.email;

    // Delegar y reasignar no cierran la etapa: la mueven.
    if (p.accion === 'delegar' || p.accion === 'reasignar') {
      const traspaso: Traspaso = {
        tipo: p.accion,
        deUid: uid,
        deNombre: nombre,
        aUid: p.destinatarioUid!,
        aNombre: p.destinatarioNombre ?? '',
        motivo: p.motivo?.trim(),
        fecha: ahora
      };

      const cambios: Partial<TareaAprobacion> = {
        asignadoUid: p.destinatarioUid,
        asignadoNombre: p.destinatarioNombre,
        estado: p.accion === 'delegar' ? 'delegada' : 'pendiente',
        traspasos: [...(tarea.traspasos ?? []), traspaso]
      };

      // Reasignar cambia también al titular: la responsabilidad se
      // transfiere. Delegar no: quien delega sigue respondiendo.
      if (p.accion === 'reasignar') {
        cambios.responsableUid = p.destinatarioUid;
        cambios.responsableNombre = p.destinatarioNombre;
      }

      await this.firebase.actualizarTarea(empresaId, tarea.id, cambios);
      await this.asentar(tarea, p, nombre);
      return { ...tarea, ...cambios } as TareaAprobacion;
    }

    // Aprobar, observar, rechazar y solicitar corrección cierran la etapa.
    const cambios: Partial<TareaAprobacion> = {
      estado: 'resuelta',
      accion: p.accion,
      motivo: p.motivo?.trim(),
      fechaResolucion: ahora,
      resueltaPorUid: uid,
      resueltaPorNombre: nombre
    };

    await this.firebase.actualizarTarea(empresaId, tarea.id, cambios);

    // Aprobar abre la etapa siguiente. Es lo único que hace avanzar el
    // expediente: observar lo devuelve y rechazar lo detiene.
    if (p.accion === 'aprobar') {
      await this.abrirSiguiente(tarea);
    }

    await this.asentar(tarea, p, nombre);
    return { ...tarea, ...cambios } as TareaAprobacion;
  }

  /** Pone en pendiente la etapa que sigue, si la hay. */
  private async abrirSiguiente(tarea: TareaAprobacion): Promise<void> {
    const empresaId = this.tenant.exigirEmpresa();
    const hermanas = await this.getDeFlujo(tarea.flujoId);
    const siguiente = hermanas.find(t => t.orden === tarea.orden + 1);
    if (!siguiente) return;

    await this.firebase.actualizarTarea(empresaId, siguiente.id, {
      estado: 'pendiente',
      fechaCreacion: new Date().toISOString()
    });
  }

  // ------------------------------------------
  // CONSULTAS DE APOYO
  // ------------------------------------------

  accionesPara(t: TareaAprobacion): AccionAprobacion[] {
    const uid = this.tenant.uid();
    if (!uid) return [];
    return accionesDisponibles(
      t, uid,
      this.tenant.puede(Permiso.DELEGAR),
      this.tenant.puede(Permiso.REASIGNAR)
    );
  }

  vencida(t: TareaAprobacion): boolean {
    return estaVencida(t);
  }

  definicionDe(a: AccionAprobacion) {
    return ACCIONES_APROBACION[a];
  }

  /**
   * ¿Está el documento bloqueado para edición?
   *
   * Un documento con etapas vivas no se edita: cambiar lo que alguien está
   * aprobando invalida la aprobación.
   */
  async documentoBloqueado(documentoId: string): Promise<boolean> {
    if (!documentoId) return false;
    return (await this.getTodas()).some(t =>
      t.documentoId === documentoId && admiteResolucion(t)
    );
  }

  // ------------------------------------------
  // INTERNO
  // ------------------------------------------

  private exigir(permiso: Permiso): void {
    if (!this.tenant.puede(permiso)) {
      throw new Error('Tu rol no permite esta acción.');
    }
  }

  /** Asiento de auditoría y de bitácora por cada resolución. */
  private async asentar(t: TareaAprobacion, p: ResolucionPayload, quien: string): Promise<void> {
    const etiqueta = `${t.flujoNombre} · ${t.etapaNombre}`;

    await this.audit.registrarSobre(
      AUDITORIA[p.accion], 'tarea', t.id, etiqueta,
      p.motivo?.trim() || ACCIONES_APROBACION[p.accion].efecto
    );

    const accionBitacora =
      p.accion === 'aprobar' ? 'aprobacion' :
      p.accion === 'rechazar' ? 'rechazo' :
      p.accion === 'observar' || p.accion === 'solicitar_correccion' ? 'observacion' :
      'envio_revision';

    try {
      await this.history.create({
        documentoId: t.documentoId ?? null,
        codigo: t.codigoDocumento ?? 'FLU',
        titulo: etiqueta,
        accion: accionBitacora as any,
        responsable: quien,
        detalle: p.motivo?.trim() || ACCIONES_APROBACION[p.accion].label,
        category: 'flujo',
        date: new Date().toISOString().slice(0, 10)
      });
    } catch {
      // La bitácora no debe impedir que la etapa avance.
    }
  }

  private porUrgencia = (a: TareaAprobacion, b: TareaAprobacion): number => {
    const va = estaVencida(a) ? 0 : 1;
    const vb = estaVencida(b) ? 0 : 1;
    if (va !== vb) return va - vb;
    return (a.fechaLimite ?? a.fechaCreacion).localeCompare(b.fechaLimite ?? b.fechaCreacion);
  };

  private porResolucion = (a: TareaAprobacion, b: TareaAprobacion): number =>
    (b.fechaResolucion ?? '').localeCompare(a.fechaResolucion ?? '');
}
