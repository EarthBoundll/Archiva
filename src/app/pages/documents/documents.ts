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
  NIVELES_CONFIDENCIALIDAD
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
  fTitulo       = signal('');
  fDescripcion  = signal('');
  fCategoria    = signal<CategoriaDocumental>('contrato');
  fTipo         = signal<TipoDocumental>('contrato_servicios');
  fArea         = signal<AreaEmisora>('administracion');
  fConfid       = signal<Confidencialidad>('interno');
  fResponsable  = signal('');
  fFolios       = signal<number | null>(null);
  fReferencia   = signal('');
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
  nuevosFolios  = signal<number | null>(null);

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
    this.fTitulo.set('');
    this.fDescripcion.set('');
    this.fCategoria.set('contrato');
    this.onCategoriaChange();
    this.fArea.set('administracion');
    this.fConfid.set('interno');
    this.fResponsable.set('');
    this.fFolios.set(null);
    this.fReferencia.set('');
    this.fFrecuencia.set('annual');
    this.fAlerta.set(30);
    this.archivoPendiente.set(null);
    this.modalAbierto.set(true);
  }

  abrirEdicion(d: Documento) {
    this.editando.set(d);
    this.errorMsg.set('');
    this.fTitulo.set(d.titulo);
    this.fDescripcion.set(d.descripcion ?? '');
    this.fCategoria.set(d.category);
    this.fTipo.set(d.type);
    this.fArea.set(d.area);
    this.fConfid.set(d.confidencialidad);
    this.fResponsable.set(d.responsable);
    this.fFolios.set(d.folios || null);
    this.fReferencia.set(d.documentoReferencia ?? '');
    this.fFrecuencia.set(d.renovacion.frequency);
    this.fAlerta.set(d.alertarDiasAntes ?? 30);
    this.archivoPendiente.set(null);
    this.modalAbierto.set(true);
  }

  cerrarModal() {
    this.modalAbierto.set(false);
    this.archivoPendiente.set(null);
    this.editando.set(null);
    this.errorMsg.set('');
  }

  onCategoriaChange() {
    const tipos = this.tiposDisponibles();
    if (tipos.length) this.fTipo.set(tipos[0].value);
  }

  /**
   * Archivo elegido en el alta, antes de que el documento exista.
   *
   * No se puede subir hasta tener el id, asi que se retiene aqui y se
   * adjunta en cuanto create() devuelve el documento creado.
   */
  archivoPendiente = signal<File | null>(null);

  onArchivoEnAlta(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.errorMsg.set('');

    if (file && file.size > DocumentService.MAX_ARCHIVO_BYTES) {
      const mb = (file.size / 1024 / 1024).toFixed(1);
      this.errorMsg.set(`El archivo pesa ${mb} MB y el máximo son ${this.maxKb} KB.`);
      input.value = '';
      return;
    }

    this.archivoPendiente.set(file);
  }

  onSoltarEnAlta(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    this.arrastrando.set(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      const dt = new DataTransfer();
      dt.items.add(file);
      this.onArchivoEnAlta({ target: { files: dt.files, value: '' } } as unknown as Event);
    }
  }

  quitarArchivoPendiente() {
    this.archivoPendiente.set(null);
  }

  /**
   * Devuelve el mensaje del primer campo obligatorio sin rellenar.
   *
   * Se nombra el campo concreto en lugar de un "revisa el formulario":
   * quien lo rellena no tiene por que adivinar cual falta.
   */
  private primerCampoIncompleto(): string | null {
    if (!this.fTitulo().trim())      return 'Escribe el título del documento.';
    if (!this.fResponsable().trim()) return 'Indica quién es el responsable del documento.';
    if (!this.fDescripcion().trim()) return 'Describe qué contiene el documento y para qué sirve.';

    const folios = this.fFolios();
    if (folios === null || folios === undefined) return 'Indica cuántos folios tiene el documento.';
    if (folios < 1)             return 'Un documento tiene al menos un folio.';
    if (!Number.isInteger(folios)) return 'Los folios se cuentan en números enteros.';

    return null;
  }

  /** Documentos que pueden citarse como referencia, ordenados por código. */
  referenciables = computed(() =>
    this.documentos()
      .filter(d => d.id !== this.editando()?.id)
      .sort((a, b) => a.codigo.localeCompare(b.codigo))
  );

  async guardar() {
    if (this.guardando()) return;

    // Todo es obligatorio salvo la referencia y el archivo: un documento
    // sin responsable o sin folios no se puede controlar.
    const falta = this.primerCampoIncompleto();
    if (falta) { this.errorMsg.set(falta); return; }

    // La referencia, si se indica, debe apuntar a un documento que exista.
    const ref = this.fReferencia().trim().toUpperCase();
    if (ref && !this.documentos().some(d => d.codigo === ref)) {
      this.errorMsg.set(`No existe ningún documento con el código ${ref}.`);
      return;
    }

    this.guardando.set(true);
    this.errorMsg.set('');

    const payload: DocumentoPayload = {
      titulo: this.fTitulo().trim(),
      descripcion: this.fDescripcion().trim(),
      category: this.fCategoria(),
      type: this.fTipo(),
      area: this.fArea(),
      confidencialidad: this.fConfid(),
      responsable: this.fResponsable().trim(),
      folios: this.fFolios() ?? 1,
      documentoReferencia: ref || undefined,
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

      if (edit) {
        await this.documentService.update(edit.id, payload);
        if (this.archivoPendiente()) {
          await this.documentService.adjuntarArchivo(edit.id, this.archivoPendiente()!);
        }
      } else {
        // El adjunto necesita el id, asi que se sube en cuanto existe.
        const creado = await this.documentService.create(payload);
        if (this.archivoPendiente()) {
          await this.documentService.adjuntarArchivo(creado.id, this.archivoPendiente()!);
        }
      }

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
    this.nuevosFolios.set(d.folios || null);
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
        folios: this.nuevosFolios() ?? doc.folios,
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
