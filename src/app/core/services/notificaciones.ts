import { Injectable, computed, inject, signal } from '@angular/core';
import { FirebaseService } from './firebase';
import { TenantService } from './tenant';
import { DocumentService } from './document';
import { Documento } from '../models/document.model';

export type TipoNotificacion =
  | 'vencido'
  | 'por_vencer'
  | 'pendiente_aprobacion'
  | 'nuevo_documento';

export type SeveridadNotificacion = 'alta' | 'media' | 'baja';

export interface Notificacion {
  /**
   * Identificador estable: el mismo hecho produce siempre el mismo id.
   *
   * De ahi que incluya la fecha de vencimiento y no la de generacion: si se
   * derivase del instante en que se calcula, cada recarga crearia una
   * notificacion nueva para el mismo documento y el contador no bajaria
   * nunca. Con un id estable, marcar como leida es definitivo.
   */
  id: string;
  tipo: TipoNotificacion;
  severidad: SeveridadNotificacion;
  titulo: string;
  mensaje: string;
  documentoId?: string;
  /** ISO 8601. Ordena la lista y se muestra como fecha y hora. */
  fecha: string;
  leida: boolean;
}

/** Cuantas notificaciones se conservan en el panel. */
const TOPE_LISTA = 50;

/**
 * Cuantos identificadores de "leida" se guardan en el perfil.
 *
 * El registro de lo leido no puede crecer sin limite dentro del documento
 * del usuario: Firestore topa cada documento en 1 MiB. Se conservan los mas
 * recientes, que son los unicos que pueden volver a aparecer en el panel.
 */
const TOPE_LEIDAS = 300;

@Injectable({ providedIn: 'root' })
export class NotificacionesService {
  private firebase = inject(FirebaseService);
  private tenant   = inject(TenantService);
  private documentos = inject(DocumentService);

  private _lista = signal<Notificacion[]>([]);
  private _leidas = signal<Set<string>>(new Set());
  private _cargando = signal(false);
  private _cargado = false;

  readonly lista    = computed(() => this._lista());
  readonly cargando = computed(() => this._cargando());
  readonly noLeidas = computed(() => this._lista().filter(n => !n.leida).length);

  /** Carga una sola vez por sesion salvo que se fuerce. */
  async cargar(forzar = false): Promise<void> {
    if (this._cargando() || (this._cargado && !forzar)) return;
    const empresaId = this.tenant.empresaOpcional();
    const uid = this.tenant.uid();
    if (!empresaId || !uid) return;

    this._cargando.set(true);
    try {
      const [docs, bitacora, perfil] = await Promise.all([
        this.documentos.getAll().catch(() => [] as Documento[]),
        this.firebase.getBitacora(empresaId).catch(() => [] as any[]),
        this.firebase.getPerfilGlobal(uid).catch(() => null)
      ]);

      const leidas = new Set<string>((perfil as any)?.notificacionesLeidas ?? []);
      this._leidas.set(leidas);

      const derivadas = [
        ...this.desdeVencimientos(docs as Documento[]),
        ...this.desdeAprobaciones(docs as Documento[]),
        ...this.desdeBitacora(bitacora)
      ];

      // Un mismo hecho no se anuncia dos veces aunque dos fuentes lo vean.
      const porId = new Map<string, Notificacion>();
      for (const n of derivadas) if (!porId.has(n.id)) porId.set(n.id, n);

      const orden: Record<SeveridadNotificacion, number> = { alta: 0, media: 1, baja: 2 };
      const lista = [...porId.values()]
        .map(n => ({ ...n, leida: leidas.has(n.id) }))
        .sort((a, b) =>
          Number(a.leida) - Number(b.leida) ||
          orden[a.severidad] - orden[b.severidad] ||
          b.fecha.localeCompare(a.fecha))
        .slice(0, TOPE_LISTA);

      this._lista.set(lista);
      this._cargado = true;
    } finally {
      this._cargando.set(false);
    }
  }

  async marcarLeida(id: string): Promise<void> {
    if (this._lista().find(n => n.id === id)?.leida) return;
    this._lista.update(l => l.map(n => n.id === id ? { ...n, leida: true } : n));
    await this.persistir([id]);
  }

  async marcarTodasLeidas(): Promise<void> {
    const pendientes = this._lista().filter(n => !n.leida).map(n => n.id);
    if (!pendientes.length) return;
    this._lista.update(l => l.map(n => ({ ...n, leida: true })));
    await this.persistir(pendientes);
  }

  /**
   * Guarda lo leido en el perfil del usuario.
   *
   * No se escribe en el documento: dos personas de la misma empresa ven el
   * mismo acervo, y lo que una de ellas haya leido no dice nada de la otra.
   */
  private async persistir(ids: string[]): Promise<void> {
    const uid = this.tenant.uid();
    const empresaId = this.tenant.empresaOpcional();
    if (!uid || !empresaId) return;

    const acumulado = new Set(this._leidas());
    ids.forEach(i => acumulado.add(i));
    const recortado = [...acumulado].slice(-TOPE_LEIDAS);
    this._leidas.set(new Set(recortado));

    try {
      // empresaId viaja en la escritura porque las reglas exigen que no
      // cambie: omitirlo en un merge lo dejaria igual, pero enviarlo hace
      // explicito que este guardado no mueve al usuario de empresa.
      await this.firebase.guardarPerfilGlobal(uid, {
        empresaId,
        notificacionesLeidas: recortado
      });
    } catch {
      // Que no se pueda registrar la lectura no debe romper la vista: la
      // notificacion volvera a aparecer en la siguiente carga.
    }
  }

  // ───────────────── derivacion desde datos reales ─────────────────

  private desdeVencimientos(docs: Documento[]): Notificacion[] {
    const salida: Notificacion[] = [];
    for (const d of docs) {
      if (!d.activo || d.estado === 'archivado') continue;
      const v = d.vencimiento;
      const dias = v?.diasParaVencer;
      const fecha = v?.fechaVencimiento;
      if (dias == null || !fecha) continue;

      const umbral = d.alertarDiasAntes ?? 7;
      if (dias < 0) {
        // El modelo solo da por vencido lo aprobado (calcularVigencia). Un
        // borrador con la fecha pasada no esta vencido: esta sin aprobar, y
        // llamarlo vencido contradiria lo que muestra la ficha.
        const vencido = d.estado === 'aprobado';
        const atraso = `${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'dia' : 'dias'}`;
        salida.push({
          id: `venc:${d.id}:${fecha}`,
          tipo: 'vencido',
          severidad: 'alta',
          titulo: vencido
            ? `Documento vencido: ${d.titulo}`
            : `Plazo superado sin aprobar: ${d.titulo}`,
          mensaje: vencido
            ? `${d.codigo} vencio hace ${atraso} y no registra renovacion.`
            : `${d.codigo} supero su fecha prevista hace ${atraso} y sigue en estado ${d.estado.replace('_', ' ')}.`,
          documentoId: d.id,
          fecha: this.aIso(fecha),
          leida: false
        });
      } else if (dias <= umbral) {
        salida.push({
          id: `prox:${d.id}:${fecha}`,
          tipo: 'por_vencer',
          severidad: dias <= 3 ? 'media' : 'baja',
          titulo: `Proximo a vencer: ${d.titulo}`,
          mensaje: dias === 0
            ? `${d.codigo} vence hoy.`
            : `${d.codigo} vence en ${dias} ${dias === 1 ? 'dia' : 'dias'}.`,
          documentoId: d.id,
          fecha: this.aIso(fecha),
          leida: false
        });
      }
    }
    return salida;
  }

  private desdeAprobaciones(docs: Documento[]): Notificacion[] {
    return docs
      .filter(d => d.activo && d.estado === 'pendiente_aprobacion')
      .map(d => ({
        id: `aprob:${d.id}`,
        tipo: 'pendiente_aprobacion' as const,
        severidad: 'media' as const,
        titulo: `Pendiente de aprobacion: ${d.titulo}`,
        mensaje: `${d.codigo} espera la decision del area responsable.`,
        documentoId: d.id,
        fecha: d.updatedAt || d.createdAt || new Date().toISOString(),
        leida: false
      }));
  }

  private desdeBitacora(entradas: any[]): Notificacion[] {
    return entradas
      .filter(e => e?.type === 'creacion' || e?.tipo === 'creacion')
      .slice(0, 15)
      .map(e => ({
        id: `bit:${e.id}`,
        tipo: 'nuevo_documento' as const,
        severidad: 'baja' as const,
        titulo: `Documento registrado: ${e.sourceName || e.titulo || 'Sin titulo'}`,
        mensaje: `Se incorporo al acervo${e.codigo ? ' con codigo ' + e.codigo : ''}.`,
        documentoId: e.documentoId,
        fecha: this.aIso(e.date || e.fecha, e.time || e.hora),
        leida: false
      }));
  }

  /** 'YYYY-MM-DD' (+ 'HH:MM') -> ISO. Devuelve el momento actual si no hay fecha. */
  private aIso(fecha?: string | null, hora?: string | null): string {
    if (!fecha) return new Date().toISOString();
    const base = fecha.length >= 10 ? fecha.slice(0, 10) : fecha;
    return `${base}T${(hora && hora.length >= 5 ? hora.slice(0, 5) : '09:00')}:00.000Z`;
  }
}
