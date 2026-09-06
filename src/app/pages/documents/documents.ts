import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DocumentService, type ArchivoAdjunto } from '../../core/services/document';
import { IconComponent } from '../../core/components/icon/icon.component';
import { log } from '../../core/utils/logger';
import {
  Documento,
  DocumentoPayload,
  CategoriaDocumental,
  TipoDocumental,
  AreaEmisora,
  EstadoDocumental,
  Confidencialidad,
  FrecuenciaRenovacion,
  CATEGORIAS_DOCUMENTALES,
  ESTADOS_DOCUMENTALES,
  AREAS_EMISORAS,
  NIVELES_CONFIDENCIALIDAD,
  esCodigoValido
} from '../../core/models/document.model';

type FiltroEstado = EstadoDocumental | 'todos' | 'por_vencer';

@Component({
  selector: 'app-documents',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './documents.html',
  styleUrl: './documents.scss'
})
export class DocumentsComponent implements OnInit {

  private documentService = inject(DocumentService);

  // ── Datos ──
  documentos = signal<Documento[]>([]);
  cargando   = signal(true);
  guardando  = signal(false);
  errorMsg   = signal('');

  // ── Filtros ──
  filtroEstado    = signal<FiltroEstado>('todos');
  filtroCategoria = signal<CategoriaDocumental | 'todas'>('todas');
  busqueda        = signal('');

  // ── Catalogos para la plantilla ──
  categorias      = CATEGORIAS_DOCUMENTALES;
  estados         = ESTADOS_DOCUMENTALES;
  areas           = AREAS_EMISORAS;
  confidencialidades = NIVELES_CONFIDENCIALIDAD;

  listaCategorias = Object.keys(CATEGORIAS_DOCUMENTALES) as CategoriaDocumental[];
  listaEstados    = Object.keys(ESTADOS_DOCUMENTALES) as EstadoDocumental[];
  listaAreas      = Object.keys(AREAS_EMISORAS) as AreaEmisora[];
  listaConfid     = Object.keys(NIVELES_CONFIDENCIALIDAD) as Confidencialidad[];

  frecuencias: { value: FrecuenciaRenovacion; label: string }[] = [
    { value: 'monthly',     label: 'Mensual' },
    { value: 'quarterly',   label: 'Trimestral' },
    { value: 'semi_annual', label: 'Semestral' },
    { value: 'annual',      label: 'Anual' },
    { value: 'variable',    label: 'Sin vencimiento' }
  ];

  // ── Formulario ──
  modalAbierto  = signal(false);
  editando      = signal<Documento | null>(null);
  fCodigo       = signal('');
  fTitulo       = signal('');
  fDescripcion  = signal('');
  fCategoria    = signal<CategoriaDocumental>('contrato');
  fTipo         = signal<TipoDocumental>('contrato_servicios');
  fArea         = signal<AreaEmisora>('administracion');
  fConfid       = signal<Confidencialidad>('interno');
  fResponsable  = signal('');
  fTamanio      = signal<number | null>(null);
  fUbicacion    = signal('');
  fFrecuencia   = signal<FrecuenciaRenovacion>('annual');
  fDiaVence     = signal(31);
  fMesVence     = signal(11);
  fAlerta       = signal(30);

  // ── Modal de cambio de estado ──
  modalEstado   = signal<{ doc: Documento; destino: EstadoDocumental } | null>(null);
  motivoEstado  = signal('');

  // ── Modal de nueva version ──
  modalVersion  = signal<Documento | null>(null);
  resumenCambio = signal('');
  nuevoTamanio  = signal<number | null>(null);

  // ============================================
  // DERIVADOS
  // ============================================

  resumen = computed(() => {
    const docs = this.documentos();
    const cuenta = (e: EstadoDocumental) => docs.filter(d => d.estado === e).length;
    const controlados = docs.filter(d => d.estado !== 'archivado').length;

    return {
      total: docs.length,
      vigentes: cuenta('aprobado'),
      enProceso: cuenta('borrador') + cuenta('en_revision') + cuenta('pendiente_aprobacion'),
      observados: cuenta('observado') + cuenta('rechazado'),
      vencidos: cuenta('vencido'),
      archivados: cuenta('archivado'),
      porVencer: docs.filter(d => this.venceProto(d)).length,
      indiceVigencia: controlados > 0 ? Math.round((cuenta('aprobado') / controlados) * 100) : 0
    };
  });

  filtrados = computed(() => {
    const estado = this.filtroEstado();
    const cat    = this.filtroCategoria();
    const q      = this.busqueda().trim().toLowerCase();

    return this.documentos().filter(d => {
      if (estado === 'por_vencer' && !this.venceProto(d)) return false;
      if (estado !== 'todos' && estado !== 'por_vencer' && d.estado !== estado) return false;
      if (cat !== 'todas' && d.category !== cat) return false;
      if (q && !`${d.codigo} ${d.titulo} ${d.responsable}`.toLowerCase().includes(q)) return false;
      return true;
    });
  });

  tiposDisponibles = computed(() => this.documentService.getTiposDisponibles(this.fCategoria()));

  /** Aprobado y a 30 dias o menos de vencer. */
  venceProto(d: Documento): boolean {
    return d.estado === 'aprobado'
      && d.vencimiento.diasParaVencer !== null
      && d.vencimiento.diasParaVencer >= 0
      && d.vencimiento.diasParaVencer <= 30;
  }

  // ============================================
  // CICLO
  // ============================================

  async ngOnInit() {
    await this.cargar();
  }

  async cargar() {
    this.cargando.set(true);
    try {
      this.documentos.set(await this.documentService.getAll());
    } catch (e) {
      log.error('Error cargando documentos:', e);
      this.errorMsg.set('No se pudieron cargar los documentos. Revisa tu conexión.');
    } finally {
      this.cargando.set(false);
    }
  }

  // ============================================
  // FORMULARIO
  // ============================================

  abrirNuevo() {
    this.editando.set(null);
    this.errorMsg.set('');
    this.fCodigo.set('');
    this.fTitulo.set('');
    this.fDescripcion.set('');
    this.fCategoria.set('contrato');
    this.onCategoriaChange();
    this.fArea.set('administracion');
    this.fConfid.set('interno');
    this.fResponsable.set('');
    this.fTamanio.set(null);
    this.fUbicacion.set('');
    this.fFrecuencia.set('annual');
    this.fAlerta.set(30);
    this.modalAbierto.set(true);
  }

  abrirEdicion(d: Documento) {
    this.editando.set(d);
    this.errorMsg.set('');
    this.fCodigo.set(d.codigo);
    this.fTitulo.set(d.titulo);
    this.fDescripcion.set(d.descripcion ?? '');
    this.fCategoria.set(d.category);
    this.fTipo.set(d.type);
    this.fArea.set(d.area);
    this.fConfid.set(d.confidencialidad);
    this.fResponsable.set(d.responsable);
    this.fTamanio.set(d.tamanioMb || null);
    this.fUbicacion.set(d.ubicacionReferencia ?? '');
    this.fFrecuencia.set(d.renovacion.frequency);
    this.fAlerta.set(d.alertarDiasAntes ?? 30);
    this.modalAbierto.set(true);
  }

  cerrarModal() {
    this.modalAbierto.set(false);
    this.editando.set(null);
    this.errorMsg.set('');
  }

  onCategoriaChange() {
    const tipos = this.tiposDisponibles();
    if (tipos.length) this.fTipo.set(tipos[0].value);
  }

  async guardar() {
    if (this.guardando()) return;

    if (!this.fTitulo().trim())      { this.errorMsg.set('Escribe el título del documento.'); return; }
    if (!this.fResponsable().trim()) { this.errorMsg.set('Indica quién es el responsable.');  return; }

    const codigo = this.fCodigo().trim().toUpperCase();
    if (codigo && !esCodigoValido(codigo)) {
      this.errorMsg.set('El código debe seguir el formato CAT-ÁREA-0001, por ejemplo CON-LEG-0001.');
      return;
    }

    const duplicado = this.documentos().some(
      d => d.codigo === codigo && d.id !== this.editando()?.id
    );
    if (codigo && duplicado) {
      this.errorMsg.set(`El código ${codigo} ya está en uso por otro documento.`);
      return;
    }

    this.guardando.set(true);
    this.errorMsg.set('');

    const payload: DocumentoPayload = {
      codigo: codigo || undefined,
      titulo: this.fTitulo(),
      descripcion: this.fDescripcion() || undefined,
      category: this.fCategoria(),
      type: this.fTipo(),
      area: this.fArea(),
      confidencialidad: this.fConfid(),
      responsable: this.fResponsable(),
      tamanioMb: this.fTamanio() ?? 0,
      ubicacionReferencia: this.fUbicacion() || undefined,
      alertarDiasAntes: this.fAlerta(),
      renovacion: {
        frequency: this.fFrecuencia(),
        startDate: new Date().toISOString().split('T')[0],
        monthlyRule: this.fFrecuencia() === 'variable' ? undefined : { kind: 'day', day: this.fDiaVence() },
        annualMonth: this.fMesVence(),
        annualDay: this.fDiaVence()
      }
    };

    try {
      const edit = this.editando();
      if (edit) await this.documentService.update(edit.id, payload);
      else      await this.documentService.create(payload);

      await this.cargar();
      this.cerrarModal();
    } catch (e: any) {
      log.error('Error guardando documento:', e);
      this.errorMsg.set(e?.message ?? 'No se pudo guardar el documento.');
    } finally {
      this.guardando.set(false);
    }
  }

  // ============================================
  // CICLO DE VIDA
  // ============================================

  accionesDe(d: Documento) {
    return this.documentService.getTransicionesPosibles(d);
  }

  pedirCambioEstado(doc: Documento, destino: EstadoDocumental) {
    this.motivoEstado.set('');
    this.errorMsg.set('');
    this.modalEstado.set({ doc, destino });
  }

  necesitaMotivo(destino: EstadoDocumental): boolean {
    return destino === 'observado' || destino === 'rechazado';
  }

  async confirmarCambioEstado() {
    const m = this.modalEstado();
    if (!m || this.guardando()) return;

    this.guardando.set(true);
    this.errorMsg.set('');

    try {
      await this.documentService.cambiarEstado(m.doc, m.destino, { motivo: this.motivoEstado() });
      await this.cargar();
      this.modalEstado.set(null);
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'No se pudo cambiar el estado.');
    } finally {
      this.guardando.set(false);
    }
  }

  // ============================================
  // VERSIONES
  // ============================================

  abrirNuevaVersion(d: Documento) {
    this.resumenCambio.set('');
    this.nuevoTamanio.set(d.tamanioMb || null);
    this.errorMsg.set('');
    this.modalVersion.set(d);
  }

  async confirmarNuevaVersion() {
    const doc = this.modalVersion();
    if (!doc || this.guardando()) return;

    if (!this.resumenCambio().trim()) {
      this.errorMsg.set('Describe qué cambió en esta versión.');
      return;
    }

    this.guardando.set(true);
    try {
      await this.documentService.registrarNuevaVersion(doc, {
        tamanioMb: this.nuevoTamanio() ?? doc.tamanioMb,
        resumenCambio: this.resumenCambio()
      });
      await this.cargar();
      this.modalVersion.set(null);
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'No se pudo registrar la versión.');
    } finally {
      this.guardando.set(false);
    }
  }

  // ============================================
  // ARCHIVOS ADJUNTOS
  // ============================================

  modalArchivos = signal<Documento | null>(null);
  archivos      = signal<ArchivoAdjunto[]>([]);
  subiendo      = signal(false);
  arrastrando   = signal(false);

  maxKb = Math.round(DocumentService.MAX_ARCHIVO_BYTES / 1024);

  async abrirArchivos(d: Documento) {
    this.modalArchivos.set(d);
    this.errorMsg.set('');
    this.archivos.set([]);
    try {
      this.archivos.set(await this.documentService.getArchivos(d.id));
    } catch (e) {
      log.error('Error cargando adjuntos:', e);
    }
  }

  onArrastrar(e: DragEvent, activo: boolean) {
    e.preventDefault();
    e.stopPropagation();
    this.arrastrando.set(activo);
  }

  async onSoltar(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    this.arrastrando.set(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) await this.subirArchivo(file);
  }

  async onSeleccionArchivo(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) await this.subirArchivo(file);
    input.value = '';   // permite volver a elegir el mismo archivo
  }

  private async subirArchivo(file: File) {
    const doc = this.modalArchivos();
    if (!doc || this.subiendo()) return;

    this.subiendo.set(true);
    this.errorMsg.set('');

    try {
      await this.documentService.adjuntarArchivo(doc.id, file);
      this.archivos.set(await this.documentService.getArchivos(doc.id));
      await this.cargar();
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'No se pudo subir el archivo.');
    } finally {
      this.subiendo.set(false);
    }
  }

  async descargar(a: ArchivoAdjunto) {
    const doc = this.modalArchivos();
    if (!doc) return;

    try {
      const contenido = await this.documentService.getContenidoArchivo(doc.id, a.id);
      if (!contenido) { this.errorMsg.set('El archivo ya no está disponible.'); return; }

      const enlace = document.createElement('a');
      enlace.href = contenido;
      enlace.download = a.nombre;
      enlace.click();
    } catch (e: any) {
      this.errorMsg.set('No se pudo descargar el archivo.');
    }
  }

  async borrarArchivo(a: ArchivoAdjunto) {
    const doc = this.modalArchivos();
    if (!doc) return;

    try {
      await this.documentService.eliminarArchivo(doc.id, a.id);
      this.archivos.set(await this.documentService.getArchivos(doc.id));
    } catch (e: any) {
      this.errorMsg.set('No se pudo eliminar el archivo.');
    }
  }

  iconoArchivo(tipo: string): string {
    if (tipo.startsWith('image/'))     return 'image';
    if (tipo.includes('pdf'))          return 'file-text';
    if (tipo.includes('sheet') || tipo.includes('excel') || tipo.includes('csv')) return 'table';
    if (tipo.includes('word'))         return 'file-text';
    return 'file';
  }

  formatoBytes(b: number): string {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
    return `${(b / 1024 / 1024).toFixed(1)} MB`;
  }

  // ============================================
  // PRESENTACION
  // ============================================

  textoVigencia(d: Documento): string {
    const dias = d.vencimiento.diasParaVencer;
    if (dias === null) return 'Sin vencimiento';
    if (dias < 0)  return `Venció hace ${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'día' : 'días'}`;
    if (dias === 0) return 'Vence hoy';
    if (dias === 1) return 'Vence mañana';
    return `Vence en ${dias} días`;
  }

  formatoMb(mb: number): string {
    if (!mb) return '—';
    if (mb < 1) return `${Math.round(mb * 1024)} KB`;
    return `${mb.toLocaleString('es-PE', { maximumFractionDigits: 1 })} MB`;
  }

  trackId(_: number, d: Documento) { return d.id; }
}
