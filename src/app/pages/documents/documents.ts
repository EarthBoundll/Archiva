import { Component, inject, OnInit, OnDestroy, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { DocumentService } from '../../core/services/document';
import { Auth } from '../../core/services/auth';
import { HistoryService } from '../../core/services/history';
import { FirebaseService } from '../../core/services/firebase';
import { EmailService } from '../../core/services/email';
import { IconComponent } from '../../core/components/icon/icon.component';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { log } from '../../core/utils/logger';
import {
  Documento,
  DocumentoPayload,
  DocumentosPeriodo,
  CategoriaDocumental,
  TipoDocumental,
  FrecuenciaRenovacion,
  ReglaMensual,
  CATEGORIAS_DOCUMENTALES,
  getEtiquetaCategoria,
  getEtiquetaTipo,
  getIconoTipo,
  getInfoTipo,
  esTipoRapido,
  generarOcurrencias,
  calcularEstadoDocumento,
  EntradaBitacora,
  cantidadNeto
} from '../../core/models/document.model';

@Component({
  selector: 'app-income',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, IconComponent],
  templateUrl: './documents.html',
  styleUrl: './documents.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocumentsComponent implements OnInit, OnDestroy {
  private documentService = inject(DocumentService);
  private authService = inject(Auth);
  private historyService = inject(HistoryService);
  private firebaseService = inject(FirebaseService);
  private emailService = inject(EmailService);

  incomeSources = signal<Documento[]>([]);
  incomeHistory = signal<EntradaBitacora[]>([]);
  monthlyIncome = signal<DocumentosPeriodo | null>(null);
  monthlyReceived = signal<number>(0);
  isLoading = signal(true);
  processing = signal(false);
  showModal = signal(false);
  confirmingId = signal<string | null>(null);
  showToast = signal(false);
  toastMessage = signal('');
  toastType = signal<'success' | 'error' | 'info'>('success');
  toastTimer: ReturnType<typeof setTimeout> | null = null;
  notifiedSources = signal<Set<string>>(new Set());

  selectedCategory = signal<CategoriaDocumental | 'all'>('all');
  activeTab = signal<'sources' | 'history'>('sources');
  searchQuery = signal('');
  private descriptionSubject = new Subject<{ entry: EntradaBitacora; description: string }>();

  isOtherCategory = computed(() => this.selectedCategory() === 'otros');
  categories = CATEGORIAS_DOCUMENTALES;
  categoryList: CategoriaDocumental[] = ['contrato', 'factura', 'orden_compra', 'memorando', 'oficio', 'informe', 'resolucion', 'convenio', 'manual', 'politica', 'procedimiento', 'otros'];

  // Form signals
  editingSource = signal<Documento | null>(null);
  editingQuick = signal(false);
  formCategory = signal<CategoriaDocumental>('contrato');
  formType = signal<TipoDocumental>('contrato_servicios');
  formName = signal('');
  formAmount = signal<number | null>(null);
  amountError = signal('');
  formNotes = signal('');

  // Recurrence form
  formFrequency = signal<FrecuenciaRenovacion>('monthly');
  formStartDate = signal<string>(this.localToday());
  formWeeklyDay = signal<number>(1);
  formBiweeklyMode = signal<'two_dates' | 'every_15'>('two_dates');
  formBiweeklyDates = signal<[number, number]>([15, 30]);
  formMonthlyKind = signal<ReglaMensual['kind']>('day');
  formMonthlyDay = signal<number>(15);
  formMonthlyWeekday = signal<number>(1);
  formAnnualMonth = signal<number>(0);
  formAnnualDay = signal<number>(15);

  // Quick mode (other category)
  formQuickDate = signal<string>(this.localToday());

  // Alerts (only for recurrent)
  formAlertDays = signal<number | null>(3);
  formAutoCreate = signal(false);

  now = signal(new Date());
  currentMonth = computed(() => this.now().toLocaleDateString('es-PE', { month: 'long', year: 'numeric' }));

  // ── Confirm Alert ──
  showConfirmAlert = signal(false);
  confirmAlertSource = signal<Documento | null>(null);
  confirmAlertTitle = computed(() => {
    const src = this.confirmAlertSource();
    return src ? `Confirmar recepción` : '';
  });

  // ── Delete Alert ──
  showDeleteAlert = signal(false);
  deleteAlertSource = signal<Documento | null>(null);

  // ── Edit Warning ──
  showEditWarning = signal(false);
  editWarningSource = signal<Documento | null>(null);

  // ── Reopen Warning ──
  showReopenWarning = signal(false);
  reopenWarningEntry = signal<EntradaBitacora | null>(null);

  // ── Catch-up Alert ──
  showCatchUpAlert = signal(false);
  catchUpSource = signal<Documento | null>(null);
  catchUpMonths = signal<string[]>([]);
  skipCatchUpOnLoad = signal(false);
  catchUpQueue = signal<Documento[]>([]);
  catchUpConfirmedCount = signal(0);

  catchUpProgress = computed(() => {
    const queue = this.catchUpQueue();
    const confirmed = this.catchUpConfirmedCount();
    const total = queue.length + confirmed;
    if (total <= 1) return null;
    const current = confirmed + 1;
    return `${current} de ${total}`;
  });

  // ── Computed ──
  esRapido = computed(() => esTipoRapido(this.formType()) || this.editingQuick());

  availableTypes = computed(() => this.documentService.getTiposDisponibles(this.formCategory()));

  // ── Separación Fuentes Activas vs Historial ──

  /** Fuentes activas: recurrentes programados (no variable) que están activos */
  activeSources = computed(() => {
    const cat = this.selectedCategory();
    const sources = this.incomeSources().filter(
      s => s.activo && s.renovacion?.frequency !== 'variable'
    );
    if (cat === 'all') return sources;
    return sources.filter(s => s.category === cat);
  });

  /** Historial: fuentes que tienen fechaUltimaVersion (fueron recibidas) */
  historySources = computed(() => {
    const cat = this.selectedCategory();
    return this.incomeSources().filter(s => {
      if (cat === 'otros') {
        return s.renovacion.frequency === 'variable' && s.category === 'otros';
      }
      if (cat === 'oficio') {
        return s.fechaUltimaVersion != null && s.category === 'oficio';
      }
      if (cat !== 'all') {
        if (s.category !== cat) return false;
        return s.fechaUltimaVersion != null;
      }
      // Todas: recibidas de cualquier categoría EXCEPTO other/puntuales
      return s.fechaUltimaVersion != null && s.category !== 'otros';
    });
  });

  /** Fuentes activas filtradas por búsqueda */
  searchedSources = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const sources = this.activeSources();
    if (!query) return sources;
    return sources.filter(s => s.name.toLowerCase().includes(query));
  });

  /** Historial de fuentes filtrado por búsqueda */
  searchedHistorySources = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const sources = this.historySources();
    if (!query) return sources;
    return sources.filter(s => s.name.toLowerCase().includes(query));
  });

  /** Historial de movimientos filtrado por categoría */
  filteredHistory = computed(() => {
    const cat = this.selectedCategory();
    const history = this.incomeHistory();
    const filtered = cat === 'all' ? history : history.filter(entry => entry.category === cat);
    return filtered.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.time || '').localeCompare(a.time || ''));
  });

  /** Título dinámico para la sección de fuentes activas según categoría */
  activeSourcesTitle = computed(() => {
    const cat = this.selectedCategory();
    if (cat === 'all') return 'Todas las Fuentes de Documento';
    return this.getCategoryInfo(cat).label;
  });

  /** Solo para la barra de "Próximos" */
  upcomingPayments = computed(() =>
    this.activeSources()
      .filter(s => s.vencimiento?.diasParaVencer != null && s.vencimiento!.diasParaVencer! >= 0)
      .sort((a, b) => (a.vencimiento?.diasParaVencer ?? 999) - (b.vencimiento?.diasParaVencer ?? 999))
  );

  totalMonthly = computed(() =>
    this.incomeSources()
      .filter(s => s.activo)
      .reduce((sum, s) => sum + cantidadNeto(s.amount, s.deductions), 0)
  );

  totalByCategory = computed(() => {
    const result: Record<string, number> = {};
    this.incomeSources()
      .filter(s => s.activo && s.renovacion.frequency !== 'variable')
      .forEach(s => {
        result[s.category] = (result[s.category] || 0) + cantidadNeto(s.amount, s.deductions);
      });
    return result;
  });

  getEtiquetaCategoria = getEtiquetaCategoria;
  getEtiquetaTipo = getEtiquetaTipo;
  getIconoTipo = getIconoTipo;

  getCategoryInfo(cat: string) {
    return this.categories[cat as CategoriaDocumental] || { label: cat, icon: 'layout-dashboard', description: '' };
  }

  getCategoryAmount(cat: string): number {
    return this.monthlyIncome()?.byCategory[cat as CategoriaDocumental] || 0;
  }

  async ngOnInit() {
    this.descriptionSubject.pipe(
      debounceTime(500),
      distinctUntilChanged((prev, curr) => prev.description === curr.description)
    ).subscribe(({ entry, description }) => {
      this.saveDescription(entry, description);
    });

    await this.loadData();
  }

  onSelectCategory(cat: CategoriaDocumental | 'all') {
    this.selectedCategory.set(cat);
    if (cat === 'otros') {
      this.activeTab.set('history');
    }
  }

  async loadData() {
    this.isLoading.set(true);
    try {
      const userId = this.authService.getUserId();
      this.now.set(new Date());
      const now = this.now();

      const sources = await this.documentService.getAll();
      const [monthly, txs] = await Promise.all([
        this.documentService.getDocumentosPeriodo(now.getFullYear(), now.getMonth() + 1, sources),
        this.historyService.getPorPeriodo(now.getFullYear(), now.getMonth() + 1)
      ]);

      this.incomeSources.set(sources);
      this.monthlyIncome.set(monthly);
      const received = txs.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
      this.monthlyReceived.set(received);

      // Detectar pagos con check (upcoming, overdue, missed) y enviar catch-up
      if (!this.skipCatchUpOnLoad()) {
        const alertSources = sources.filter(s =>
          s.activo && (
            s.vencimiento?.status === 'upcoming' ||
            s.vencimiento?.status === 'overdue' ||
            (s.vencimiento?.renovacionesOmitidas && s.vencimiento.renovacionesOmitidas > 0)
          )
        );

        // Enviar email de catch-up por cada fuente con check
        for (const source of alertSources) {
          if (!this.notifiedSources().has(source.id)) {
            this.notifiedSources.update(set => new Set(set).add(source.id));
            this.emailService.sendCatchUpReminder({
              sourceName: source.name,
              renovacionesOmitidas: source.vencimiento?.renovacionesOmitidas || 0,
              periodosOmitidos: source.vencimiento?.periodosOmitidos || [],
              amount: source.amount,
              currency: source.currency
            }).catch(e => log.warn('Catch-up email skipped:', e.message || e));
          }
        }

        // Abrir modal solo si hay renovacionesOmitidas > 0
        const missedSources = alertSources.filter(s =>
          s.vencimiento?.renovacionesOmitidas && s.vencimiento.renovacionesOmitidas > 0
        );
        if (missedSources.length > 0) {
          this.catchUpQueue.set(missedSources);
          this.catchUpConfirmedCount.set(0);
          setTimeout(() => this.openCatchUpAlert(missedSources[0]), 600);
        }
      }
      this.skipCatchUpOnLoad.set(false);

      // Cargar historial por separado (no bloquea si falla)
      if (userId) {
        try {
          const history = await this.firebaseService.getBitacora(userId);
          this.incomeHistory.set(history as EntradaBitacora[]);
        } catch (e) {
          log.warn('Error loading income history:', e);
          this.incomeHistory.set([]);
        }
      }
    } catch (e) {
      log.error('Error loading income data:', e);
      this.showErrorToast('Error al cargar datos. Verifica tu conexión.');
    } finally {
      this.isLoading.set(false);
    }
  }

  onCategoryChange() {
    const types = this.availableTypes();
    if (types.length > 0) {
      this.formType.set(types[0].value);
      this.onTypeChange();
    }
  }

  onTypeChange() {
    const info = getInfoTipo(this.formType());
    if (info) {
      this.formFrequency.set(info.typicalFrequency as FrecuenciaRenovacion);
      if (this.formFrequency() === 'monthly') {
        this.formMonthlyDay.set(15);
      } else if (this.formFrequency() === 'biweekly') {
        this.formBiweeklyDates.set([15, 30]);
      }
    }
  }

  onAmountInput(event: any) {
    const val = event;
    this.amountError.set('');
    if (val === '' || val === null || val === undefined) {
      this.formAmount.set(null);
      return;
    }
    const str = String(val);
    if (/[a-zA-ZáéíóúñÁÉÍÓÚÑ]/.test(str)) {
      this.formAmount.set(null);
      this.amountError.set('No es un cantidad válido');
      return;
    }
    const num = parseFloat(str.replace(/[^0-9.]/g, ''));
    if (!isNaN(num) && num >= 0) {
      this.formAmount.set(num);
    } else {
      this.formAmount.set(null);
      this.amountError.set('No es un cantidad válido');
    }
  }

  openAddModal(category?: CategoriaDocumental) {
    this.editingSource.set(null);
    this.editingQuick.set(false);
    this.formCategory.set(category || 'contrato');
    this.onCategoryChange();
    this.formName.set('');
    this.formAmount.set(null);
    this.formNotes.set('');
    this.formStartDate.set(this.localToday());
    this.formQuickDate.set(this.localToday());
    this.formWeeklyDay.set(1);
    this.formBiweeklyMode.set('two_dates');
    this.formBiweeklyDates.set([15, 30]);
    this.formMonthlyKind.set('day');
    this.formMonthlyDay.set(15);
    this.formMonthlyWeekday.set(1);
    this.formAnnualMonth.set(0);
    this.formAnnualDay.set(15);
    this.formAlertDays.set(3);
    this.formAutoCreate.set(false);
    this.showModal.set(true);
  }

  openAddModalForCurrentCategory() {
    const cat = this.selectedCategory();
    this.openAddModal(cat === 'all' ? undefined : cat);
  }

  openEdit(source: Documento) {
    this.editingSource.set(source);
    this.editingQuick.set(source.renovacion.frequency === 'variable' || source.category === 'otros');
    this.formCategory.set(source.category);
    this.formType.set(source.type);
    this.formName.set(source.name);
    this.formAmount.set(source.amount);
    this.formNotes.set(source.notes || '');

    const r = source.renovacion;
    this.formFrequency.set(r.frequency);
    this.formStartDate.set(r.startDate);
    this.formWeeklyDay.set(r.weeklyDays?.[0] || 1);
    this.formBiweeklyMode.set(r.biweeklyMode || 'two_dates');
    this.formBiweeklyDates.set(r.biweeklyDates || [15, 30]);
    if (r.monthlyRule) {
      this.formMonthlyKind.set(r.monthlyRule.kind);
      if (r.monthlyRule.kind === 'day') this.formMonthlyDay.set(r.monthlyRule.day);
      if (r.monthlyRule.kind === 'first_weekday') this.formMonthlyWeekday.set(r.monthlyRule.weekday);
    }
    this.formAnnualMonth.set(r.annualMonth ?? 0);
    this.formAnnualDay.set(r.annualDay ?? 15);

    this.formAlertDays.set(source.alertarDiasAntes ?? null);
    this.formAutoCreate.set(source.generarRegistroAuto ?? false);
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.editingSource.set(null);
    this.editingQuick.set(false);
  }

  private buildRecurrence(): Documento['renovacion'] {
    const freq = this.formFrequency();
    const base: Documento['renovacion'] = {
      frequency: freq,
      startDate: this.formStartDate()
    };

    switch (freq) {
      case 'weekly':
        base.weeklyDays = [this.formWeeklyDay()];
        break;
      case 'biweekly':
        base.biweeklyMode = this.formBiweeklyMode();
        if (base.biweeklyMode === 'two_dates') {
          base.biweeklyDates = this.formBiweeklyDates();
        }
        break;
      case 'monthly':
      case 'bimonthly':
      case 'quarterly':
      case 'semi_annual':
        const kind = this.formMonthlyKind();
        if (kind === 'day') base.monthlyRule = { kind: 'day', day: this.formMonthlyDay() };
        else if (kind === 'last_day') base.monthlyRule = { kind: 'last_day' };
        else if (kind === 'first_weekday') base.monthlyRule = { kind: 'first_weekday', weekday: this.formMonthlyWeekday() };
        break;
      case 'annual':
        base.annualMonth = this.formAnnualMonth();
        base.annualDay = this.formAnnualDay();
        break;
      case 'variable':
        // No extra rules
        break;
    }
    return base;
  }

  async saveSource() {
    if (this.processing()) return;
    const name = this.formName()?.trim();
    const amount = this.formAmount();
    if (!name) {
      this.showErrorToast('El nombre no puede estar vacío');
      return;
    }
    if (!amount || amount <= 0) {
      this.showErrorToast('El cantidad debe ser mayor a 0');
      return;
    }
    this.processing.set(true);

    try {
      const isQ = this.esRapido();
      const renovacion: Documento['renovacion'] = isQ
        ? { frequency: 'variable', startDate: this.formQuickDate() }
        : this.buildRecurrence();

      let alertDays = this.formAlertDays();
      if (!isQ && (alertDays == null || alertDays < 1)) {
        alertDays = 3;
      }

      const payload: DocumentoPayload = {
        category: this.formCategory(),
        type: this.formType(),
        name: this.formName(),
        amount: this.formAmount()!,
        renovacion,
        alertarDiasAntes: isQ ? null : alertDays,
        generarRegistroAuto: isQ ? false : this.formAutoCreate(),
        notes: this.formNotes()
      };

      if (this.editingSource()) {
        const editing = this.editingSource()!;
        if (editing.renovacion.frequency === 'variable' || editing.category === 'otros' || editing.fechaUltimaVersion) {
          await this.documentService.update(editing.id, {
            name,
            notes: this.formNotes()
          } as Partial<DocumentoPayload>);
        } else {
          await this.documentService.update(editing.id, payload);
        }
      } else {
        const newSource = await this.documentService.create(payload);
        if (this.esRapido() && newSource) {
          await this.documentService.registrarNuevaVersion(newSource.id, payload.amount);
        }
      }

      this.closeModal();
      await this.loadData();
    } catch (e: any) {
      log.error('Error saving income source:', e);
      this.showErrorToast('Error al guardar: ' + (e.message || 'Error desconocido'));
    } finally {
      this.processing.set(false);
    }
  }

  async toggleActive(source: Documento) {
    if (this.processing()) return;
    this.processing.set(true);
    try {
      if (source.activo) {
        await this.documentService.deactivate(source.id);
      } else {
        await this.documentService.update(source.id, { activo: true } as Partial<DocumentoPayload>);
      }
      await this.loadData();
    } catch (e: any) {
      log.error('Error toggling income source:', e);
      this.showErrorToast('Error al cambiar estado: ' + (e.message || 'Error desconocido'));
    } finally {
      this.processing.set(false);
    }
  }

  openConfirmAlert(source: Documento) {
    this.confirmAlertSource.set(source);
    this.showConfirmAlert.set(true);
  }

  closeConfirmAlert() {
    this.showConfirmAlert.set(false);
    this.confirmAlertSource.set(null);
  }

  async confirmMarkReceived() {
    if (this.processing()) return;
    const source = this.confirmAlertSource();
    if (!source) return;

    this.processing.set(true);
    this.confirmingId.set(source.id);
    this.closeConfirmAlert();

    try {
      await this.documentService.registrarNuevaVersion(source.id, source.amount);

      this.emailService.sendAprobacionConfirmacion({
        sourceName: source.name,
        amount: source.amount || 0,
        currency: source.currency || 'PEN',
        date: new Date().toLocaleDateString('es-PE'),
        frequency: this.getFrequencyLabel(source),
        fechaVencimiento: this.getNextDateLabel(source),
        anticipationDays: this.getAnticipationDays(source)
      }).catch(e => log.warn('Email skipped:', e.message || e));

      this.skipCatchUpOnLoad.set(true);
      await this.loadData();
      this.showSuccessToast(`✅ ${source.name} confirmado como recibido`);
    } catch (e: any) {
      log.error('Error marking as received:', e);
      this.showErrorToast('Error al confirmar: ' + (e.message || 'Error desconocido'));
    } finally {
      this.processing.set(false);
      this.confirmingId.set(null);
    }
  }

  async markReceived(source: Documento) {
    this.openConfirmAlert(source);
  }

  // ── Catch-up handlers ──
  openCatchUpAlert(source: Documento) {
    this.catchUpSource.set(source);
    this.catchUpMonths.set(source.vencimiento?.periodosOmitidos || []);
    this.showCatchUpAlert.set(true);
  }

  closeCatchUpAlert() {
    this.showCatchUpAlert.set(false);
    this.catchUpSource.set(null);
  }

  async confirmCatchUp() {
    if (this.processing()) return;
    const source = this.catchUpSource();
    if (!source) return;

    this.processing.set(true);
    this.confirmingId.set(source.id);
    this.closeCatchUpAlert();

    try {
      await this.documentService.registrarNuevaVersion(source.id, source.amount);

      this.catchUpConfirmedCount.update(c => c + 1);
      const queue = this.catchUpQueue().filter(s => s.id !== source.id);
      this.catchUpQueue.set(queue);

      if (queue.length > 0) {
        this.openCatchUpAlert(queue[0]);
      } else {
        this.skipCatchUpOnLoad.set(true);
        await this.loadData();
        const total = this.catchUpConfirmedCount();
        this.showSuccessToast(`${total} de ${total} pagos confirmados`);
        this.catchUpConfirmedCount.set(0);
      }
    } catch (e: any) {
      log.error('Error confirming catch-up:', e);
      this.showErrorToast('Error al confirmar: ' + (e.message || 'Error desconocido'));
    } finally {
      this.processing.set(false);
      this.confirmingId.set(null);
    }
  }

  skipCatchUp() {
    const source = this.catchUpSource();
    const queue = this.catchUpQueue().filter(s => s.id !== source?.id);
    this.catchUpQueue.set(queue);

    if (queue.length > 0) {
      this.openCatchUpAlert(queue[0]);
    } else {
      this.closeCatchUpAlert();
      const confirmed = this.catchUpConfirmedCount();
      if (confirmed > 0) {
        this.skipCatchUpOnLoad.set(true);
        this.loadData();
        const total = confirmed;
        this.showSuccessToast(`${total} de ${total} pagos confirmados`);
      }
      this.catchUpConfirmedCount.set(0);
    }
  }

  // ── Delete Alert handlers ──
  openDeleteAlert(source: Documento) {
    this.deleteAlertSource.set(source);
    this.showDeleteAlert.set(true);
  }

  closeDeleteAlert() {
    this.showDeleteAlert.set(false);
    this.deleteAlertSource.set(null);
  }

  async confirmDelete() {
    if (this.processing()) return;
    this.processing.set(true);
    const source = this.deleteAlertSource();
    if (!source) { this.processing.set(false); return; }
    try {
      const userId = this.authService.getUserId();
      await this.documentService.deactivate(source.id);

      if (userId) {
        const now = new Date();
        const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        await this.firebaseService.agregarBitacora(userId, {
          documentoId: source.id,
          sourceName: source.name,
          type: 'deletion',
          amount: source.amount || 0,
          date,
          time,
          category: source.category,
          description: ''
        });
      }

      this.closeDeleteAlert();
      await this.loadData();
    } catch (e: any) {
      log.error('Error deleting income source:', e);
      this.showErrorToast('Error al eliminar: ' + (e.message || 'Error desconocido'));
    } finally {
      this.processing.set(false);
    }
  }

  // ── Edit Warning handlers ──
  openEditWarning(source: Documento) {
    this.editWarningSource.set(source);
    this.showEditWarning.set(true);
  }

  closeEditWarning() {
    this.showEditWarning.set(false);
    this.editWarningSource.set(null);
  }

  proceedEdit() {
    const source = this.editWarningSource();
    this.closeEditWarning();
    if (source) this.openEdit(source);
  }

  // ── Reopen Warning handlers ──
  openReopenWarning(entry: EntradaBitacora) {
    this.reopenWarningEntry.set(entry);
    this.showReopenWarning.set(true);
  }

  closeReopenWarning() {
    this.showReopenWarning.set(false);
    this.reopenWarningEntry.set(null);
  }

  async proceedReopen() {
    if (this.processing()) return;
    this.processing.set(true);
    const entry = this.reopenWarningEntry();
    this.closeReopenWarning();
    if (!entry) { this.processing.set(false); return; }

    try {
      const userId = this.authService.getUserId();
      if (!userId) { this.processing.set(false); return; }

      const sources = await this.documentService.getAll();
      const source = sources.find(s => s.id === entry.documentoId);
      if (!source) { this.processing.set(false); return; }

      const alertDays = source.alertarDiasAntes ?? 1;
      const proximasRenovaciones = generarOcurrencias(source.renovacion, 6);

      await this.firebaseService.actualizarDocumento(userId, source.id, {
        activo: true,
        proximasRenovaciones,
        vencimiento: calcularEstadoDocumento(source.renovacion, proximasRenovaciones, undefined, alertDays),
        fechaUltimaVersion: null,
        actualAmount: null,
        updatedAt: new Date().toISOString()
      });

      const now = new Date();
      const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      await this.firebaseService.agregarBitacora(userId, {
        documentoId: source.id,
        sourceName: source.name,
        type: 'reactivation',
        amount: 0,
        date,
        time,
        category: source.category,
        description: ''
      });

      await this.loadData();
    } catch (e: any) {
      log.error('Error reopening income source:', e);
      this.showErrorToast('Error al reabrir: ' + (e.message || 'Error desconocido'));
    } finally {
      this.processing.set(false);
    }
  }

  updateDescription(entry: EntradaBitacora, description: string) {
    this.descriptionSubject.next({ entry, description });
  }

  private async saveDescription(entry: EntradaBitacora, description: string) {
    const userId = this.authService.getUserId();
    if (!userId) return;
    try {
      await this.firebaseService.actualizarBitacora(userId, entry.id, { description });
    } catch (e: any) {
      log.error('Error updating history description:', e);
    }
  }

  isSourceActive(documentoId: string): boolean {
    return this.incomeSources().some(s => s.id === documentoId && s.activo);
  }

  getHistoryColor(type: string): string {
    switch (type) {
      case 'version': return '#2D7D5A';
      case 'archivado': return '#A3342B';
      case 'reactivacion': return '#B8791F';
      default: return '#8A9295';
    }
  }

  getHistoryIcon(type: string): string {
    switch (type) {
      case 'version': return 'file-check';
      case 'archivado': return 'archive';
      case 'reactivacion': return 'rotate-ccw';
      default: return 'circle';
    }
  }

  getHistoryLabel(type: string): string {
    switch (type) {
      case 'version': return 'Nueva version';
      case 'archivado': return 'Archivado';
      case 'reactivacion': return 'Reactivado';
      default: return type;
    }
  }

  private localToday(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  formatSol(n: number): string {
    return `${(n || 0).toFixed(2)}`;
  }

  formatDays(days: number | null | undefined): string {
    if (days === null || days === undefined) return '';
    if (days === 0) return 'Hoy';
    if (days === 1) return 'Mañana';
    if (days < 0) return `Hace ${Math.abs(days)} días`;
    return `En ${days} días`;
  }

  getPaymentStatusColor(status: string): string {
    switch (status) {
      case 'received': return '#2FA46A';
      case 'upcoming': return '#f59e0b';
      case 'overdue': return '#ef4444';
      case 'scheduled': return '#3b82f6';
      case 'registered': return '#71717a';
      default: return '#8A9295';
    }
  }

  getPaymentStatusLabel(status: string): string {
    switch (status) {
      case 'received': return 'Recibido';
      case 'upcoming': return 'Próximo';
      case 'overdue': return 'Atrasado';
      case 'scheduled': return 'Programado';
      case 'pending': return 'Pendiente';
      default: return status;
    }
  }

  // ── Toast ──
  showSuccessToast(message: string) {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastMessage.set(message);
    this.toastType.set('success');
    this.showToast.set(true);
    this.toastTimer = setTimeout(() => this.showToast.set(false), 3500);
  }

  showErrorToast(message: string) {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastMessage.set(message);
    this.toastType.set('error');
    this.showToast.set(true);
    this.toastTimer = setTimeout(() => this.showToast.set(false), 4500);
  }

  closeToast() {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.showToast.set(false);
  }

  ngOnDestroy() {
    this.descriptionSubject.complete();
    // Limpiar timers de toasts para evitar memory leaks
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  // ── Anticipation days ──
  private getAnticipationDays(source: Documento): number {
    const fechaVencimiento = source.proximasRenovaciones?.[0];
    if (!fechaVencimiento) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const next = new Date(fechaVencimiento + 'T00:00:00');
    const diff = Math.ceil((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  }

  private getNextDateLabel(source: Documento): string {
    const fechaVencimiento = source.proximasRenovaciones?.[1];
    if (!fechaVencimiento) return 'N/A';
    const d = new Date(fechaVencimiento + 'T12:00:00');
    return d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  private getFrequencyLabel(source: Documento): string {
    switch (source.renovacion?.frequency) {
      case 'weekly': return 'Semanal';
      case 'biweekly': return 'Quincenal';
      case 'monthly': return 'Mensual';
      case 'bimonthly': return 'Bimestral';
      case 'quarterly': return 'Trimestral';
      case 'semi_annual': return 'Semestral';
      case 'annual': return 'Anual';
      case 'variable': return 'Variable';
      default: return 'Mensual';
    }
  }
}
