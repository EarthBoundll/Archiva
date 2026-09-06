import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReviewRequestService } from '../../core/services/review-request';
import { DocumentService } from '../../core/services/document';
import { IconComponent } from '../../core/components/icon/icon.component';
import { log } from '../../core/utils/logger';
import {
  SolicitudRevision,
  SolicitudRevisionPayload,
  TipoSolicitud,
  EstadoSolicitud,
  OrigenSolicitud,
  ESTADOS_SOLICITUD,
  ORIGENES,
  etiquetaTipo,
  iconoTipo,
  diasParaAtender,
  calcularFechaLimiteSugerida,
  esTipoPrioritario
} from '../../core/models/review-request.model';
import { Documento } from '../../core/models/document.model';

type Filtro = EstadoSolicitud | 'todas' | 'prioritarias';

@Component({
  selector: 'app-review-requests',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './review-requests.html',
  styleUrl: './review-requests.scss'
})
export class ReviewRequestsComponent implements OnInit {

  private service = inject(ReviewRequestService);
  private documentService = inject(DocumentService);

  solicitudes = signal<SolicitudRevision[]>([]);
  documentos  = signal<Documento[]>([]);
  cargando    = signal(true);
  guardando   = signal(false);
  errorMsg    = signal('');

  filtro   = signal<Filtro>('todas');
  busqueda = signal('');

  estados      = ESTADOS_SOLICITUD;
  origenes     = ORIGENES;
  listaEstados = Object.keys(ESTADOS_SOLICITUD) as EstadoSolicitud[];
  listaOrigenes = Object.keys(ORIGENES) as OrigenSolicitud[];

  tiposPrioritarios = this.service.getTiposPrioritarios();
  tiposOrdinarios   = this.service.getTiposOrdinarios();

  // ── Formulario ──
  modalAbierto = signal(false);
  editando     = signal<SolicitudRevision | null>(null);
  fDocumento   = signal('');
  fTipo        = signal<TipoSolicitud>('subsanacion_observacion');
  fTitulo      = signal('');
  fDetalle     = signal('');
  fSolicitante = signal('');
  fRevisor     = signal('');
  fOrigen      = signal<OrigenSolicitud>('revision_programada');
  fDias        = signal<number | null>(null);
  fLimite      = signal('');

  // ── Modales de accion ──
  modalTomar    = signal<SolicitudRevision | null>(null);
  fTomarRevisor = signal('');

  modalAtender  = signal<SolicitudRevision | null>(null);
  fDiasReales   = signal<number | null>(null);

  modalAnular   = signal<SolicitudRevision | null>(null);
  fMotivoAnular = signal('');

  // ============================================
  // DERIVADOS
  // ============================================

  resumen = computed(() => {
    const s = this.solicitudes();
    const cuenta = (e: EstadoSolicitud) => s.filter(x => x.status === e).length;
    const atendidas = cuenta('atendida');

    const dias = s.filter(x => x.status === 'atendida' && x.diasReales >= 0)
                  .map(x => x.diasReales);

    return {
      total: s.length,
      pendientes: cuenta('pendiente') + cuenta('en_proceso'),
      vencidas: cuenta('vencida'),
      atendidas,
      prioritariasAbiertas: s.filter(
        x => x.esPrioritaria && x.status !== 'atendida' && x.status !== 'anulada'
      ).length,
      reincidentes: s.filter(x => x.esReincidente).length,
      tasaAtencion: s.length > 0 ? Math.round((atendidas / s.length) * 100) : 0,
      diasPromedio: dias.length
        ? Math.round(dias.reduce((a, b) => a + b, 0) / dias.length)
        : null
    };
  });

  filtradas = computed(() => {
    const f = this.filtro();
    const q = this.busqueda().trim().toLowerCase();

    return this.solicitudes()
      .filter(s => {
        if (f === 'prioritarias' && !s.esPrioritaria) return false;
        if (f !== 'todas' && f !== 'prioritarias' && s.status !== f) return false;
        if (q && !`${s.codigoDocumento} ${s.titulo} ${s.solicitante}`.toLowerCase().includes(q)) return false;
        return true;
      })
      // Primero lo urgente: prioritarias abiertas, luego por fecha limite.
      .sort((a, b) => {
        const abierta = (s: SolicitudRevision) => s.status !== 'atendida' && s.status !== 'anulada';
        const peso = (s: SolicitudRevision) => (abierta(s) ? 0 : 2) + (s.esPrioritaria ? 0 : 1);
        const dp = peso(a) - peso(b);
        return dp !== 0 ? dp : a.fechaLimiteAtencion.localeCompare(b.fechaLimiteAtencion);
      });
  });

  documentosDisponibles = computed(() =>
    this.documentos()
      .filter(d => d.estado !== 'archivado')
      .sort((a, b) => a.codigo.localeCompare(b.codigo))
  );

  // ============================================
  // CICLO
  // ============================================

  async ngOnInit() {
    await this.cargar();
  }

  async cargar() {
    this.cargando.set(true);
    try {
      const [solicitudes, documentos] = await Promise.all([
        this.service.getAll(),
        this.documentService.getAll()
      ]);
      this.solicitudes.set(solicitudes);
      this.documentos.set(documentos);
    } catch (e) {
      log.error('Error cargando solicitudes:', e);
      this.errorMsg.set('No se pudieron cargar las solicitudes. Revisa tu conexión.');
    } finally {
      this.cargando.set(false);
    }
  }

  // ============================================
  // FORMULARIO
  // ============================================

  abrirNueva() {
    this.editando.set(null);
    this.errorMsg.set('');
    this.fDocumento.set(this.documentosDisponibles()[0]?.id ?? '');
    this.fTipo.set('subsanacion_observacion');
    this.onTipoChange();
    this.fTitulo.set('');
    this.fDetalle.set('');
    this.fSolicitante.set('');
    this.fRevisor.set('');
    this.fOrigen.set('revision_programada');
    this.modalAbierto.set(true);
  }

  abrirEdicion(s: SolicitudRevision) {
    this.editando.set(s);
    this.errorMsg.set('');
    this.fDocumento.set(s.documentoId);
    this.fTipo.set(s.category);
    this.fTitulo.set(s.titulo);
    this.fDetalle.set(s.detalle ?? '');
    this.fSolicitante.set(s.solicitante);
    this.fRevisor.set(s.revisor ?? '');
    this.fOrigen.set(s.origen);
    this.fDias.set(s.diasEstimados);
    this.fLimite.set(s.fechaLimiteAtencion);
    this.modalAbierto.set(true);
  }

  cerrarModal() {
    this.modalAbierto.set(false);
    this.editando.set(null);
    this.errorMsg.set('');
  }

  /** Al cambiar el tipo se proponen plazo y fecha límite coherentes. */
  onTipoChange() {
    const t = this.fTipo();
    this.fDias.set(this.service.getTodosLosTipos().find(x => x.value === t)?.plazoSugerido ?? 7);
    this.fLimite.set(calcularFechaLimiteSugerida(t));
  }

  esPrioritario(t: TipoSolicitud): boolean {
    return esTipoPrioritario(t);
  }

  async guardar() {
    if (this.guardando()) return;

    if (!this.fDocumento())          { this.errorMsg.set('Elige el documento sobre el que recae la solicitud.'); return; }
    if (!this.fTitulo().trim())      { this.errorMsg.set('Escribe qué se solicita.'); return; }
    if (!this.fSolicitante().trim()) { this.errorMsg.set('Indica quién realiza la solicitud.'); return; }
    if (!this.fLimite())             { this.errorMsg.set('Indica la fecha límite de atención.'); return; }

    const dias = this.fDias();
    if (dias === null || dias < 1) { this.errorMsg.set('Los días estimados deben ser al menos uno.'); return; }

    const doc = this.documentos().find(d => d.id === this.fDocumento());
    if (!doc) { this.errorMsg.set('El documento elegido ya no existe.'); return; }

    this.guardando.set(true);
    this.errorMsg.set('');

    const payload: SolicitudRevisionPayload = {
      documentoId: doc.id,
      codigoDocumento: doc.codigo,
      tituloDocumento: doc.titulo,
      esPrioritaria: esTipoPrioritario(this.fTipo()),
      category: this.fTipo(),
      titulo: this.fTitulo(),
      detalle: this.fDetalle().trim() || undefined,
      solicitante: this.fSolicitante(),
      revisor: this.fRevisor().trim() || undefined,
      origen: this.fOrigen(),
      diasEstimados: dias,
      fechaLimiteAtencion: this.fLimite()
    };

    try {
      const edit = this.editando();
      if (edit) await this.service.update(edit.id, payload);
      else      await this.service.create(payload);

      await this.cargar();
      this.cerrarModal();
    } catch (e: any) {
      log.error('Error guardando solicitud:', e);
      this.errorMsg.set(e?.message ?? 'No se pudo guardar la solicitud.');
    } finally {
      this.guardando.set(false);
    }
  }

  // ============================================
  // ACCIONES
  // ============================================

  abrirTomar(s: SolicitudRevision) {
    this.fTomarRevisor.set(s.revisor ?? '');
    this.errorMsg.set('');
    this.modalTomar.set(s);
  }

  async confirmarTomar() {
    const s = this.modalTomar();
    if (!s || this.guardando()) return;

    if (!this.fTomarRevisor().trim()) {
      this.errorMsg.set('Indica quién se hace cargo de la solicitud.');
      return;
    }

    this.guardando.set(true);
    try {
      await this.service.tomar(s, this.fTomarRevisor());
      await this.cargar();
      this.modalTomar.set(null);
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'No se pudo tomar la solicitud.');
    } finally {
      this.guardando.set(false);
    }
  }

  abrirAtender(s: SolicitudRevision) {
    this.fDiasReales.set(s.diasEstimados);
    this.errorMsg.set('');
    this.modalAtender.set(s);
  }

  async confirmarAtender() {
    const s = this.modalAtender();
    if (!s || this.guardando()) return;

    const dias = this.fDiasReales();
    if (dias === null || dias < 0) {
      this.errorMsg.set('Indica cuántos días tomó atenderla.');
      return;
    }

    this.guardando.set(true);
    try {
      await this.service.marcarAtendida(s, dias);
      await this.cargar();
      this.modalAtender.set(null);
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'No se pudo cerrar la solicitud.');
    } finally {
      this.guardando.set(false);
    }
  }

  abrirAnular(s: SolicitudRevision) {
    this.fMotivoAnular.set('');
    this.errorMsg.set('');
    this.modalAnular.set(s);
  }

  async confirmarAnular() {
    const s = this.modalAnular();
    if (!s || this.guardando()) return;

    this.guardando.set(true);
    try {
      await this.service.anular(s, this.fMotivoAnular());
      await this.cargar();
      this.modalAnular.set(null);
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'No se pudo anular la solicitud.');
    } finally {
      this.guardando.set(false);
    }
  }

  // ============================================
  // PRESENTACION
  // ============================================

  etiqueta(t: TipoSolicitud): string { return etiquetaTipo(t); }
  icono(t: TipoSolicitud): string    { return iconoTipo(t); }

  puedeTomar(s: SolicitudRevision): boolean {
    return s.status === 'pendiente' || s.status === 'vencida';
  }

  puedeAtender(s: SolicitudRevision): boolean {
    return s.status !== 'atendida' && s.status !== 'anulada';
  }

  textoPlazo(s: SolicitudRevision): string {
    if (s.status === 'atendida') return `Atendida en ${s.diasReales} ${s.diasReales === 1 ? 'día' : 'días'}`;
    if (s.status === 'anulada')  return 'Anulada';

    const dias = diasParaAtender(s.fechaLimiteAtencion);
    if (dias === null) return 'Sin plazo';
    if (dias < 0)  return `Vencida hace ${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'día' : 'días'}`;
    if (dias === 0) return 'Vence hoy';
    if (dias === 1) return 'Vence mañana';
    return `Quedan ${dias} días`;
  }

  plazoApremia(s: SolicitudRevision): boolean {
    const d = diasParaAtender(s.fechaLimiteAtencion);
    return s.status !== 'atendida' && s.status !== 'anulada' && d !== null && d >= 0 && d <= 2;
  }

  trackId(_: number, s: SolicitudRevision) { return s.id; }
}
