import { Component, inject, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Auth } from '../../core/services/auth';
import { HistoryService } from '../../core/services/history';
import { WorkflowService } from '../../core/services/workflow';
import { DocumentService } from '../../core/services/document';
import { FirebaseService } from '../../core/services/firebase';
import { RegistroHistorial } from '../../core/models/history.model';
import { FlujoAprobacion } from '../../core/models/workflow.model';
import { DocumentosPeriodo } from '../../core/models/document.model';
import { IconComponent } from '../../core/components/icon/icon.component';
import { BaseChartDirective } from 'ng2-charts';
import { log } from '../../core/utils/logger';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, IconComponent, BaseChartDirective],
  // Chart.js se registra aqui y no en app.config para que viaje en el
  // chunk diferido del tablero, no en el bundle inicial.
  providers: [provideCharts(withDefaultRegisterables())],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class DashboardComponent implements OnInit, OnDestroy {

  private authService        = inject(Auth);
  private historyService = inject(HistoryService);
  private workflowService        = inject(WorkflowService);
  private documentService      = inject(DocumentService);
  private firebaseService    = inject(FirebaseService);
  
  isLoading      = signal(true);
  transactions   = signal<RegistroHistorial[]>([]);
  goal           = signal<FlujoAprobacion | null>(null);
  monthlyIncome  = signal<DocumentosPeriodo | null>(null);
  actualBalance  = signal<number>(0);
  incomeSources  = signal<any[]>([]);
  incomePopups   = signal<{message: string, type: 'alert' | 'tip' | 'info', icon: string}[]>([]);
  currentPopupIndex = signal(0);
  currentPopup = computed(() => this.incomePopups()[this.currentPopupIndex()] ?? null);
  popupInterval: ReturnType<typeof setInterval> | null = null;

  // Balance Card Carrusel
  currentBalanceView = signal(0);
  totalBalanceViews = 2;
  isBalanceExpanded = signal(false);
  Math = Math;

  // ─── Chart.js Config ───
  // Balance Chart (versión completa)
  balanceChartData: any = {
    labels: [],
    datasets: [{
      data: [],
      borderColor: '#2FA46A',
      backgroundColor: 'rgba(47, 164, 106, 0.15)',
      borderWidth: 3,
      fill: true,
      tension: 0.4,
      pointRadius: 0,
      pointHoverRadius: 6,
      pointHoverBackgroundColor: '#2FA46A',
      pointHoverBorderColor: '#fff',
      pointHoverBorderWidth: 2
    }]
  };

  balanceChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        titleColor: 'rgba(255,255,255,0.7)',
        bodyColor: '#fff',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        cornerRadius: 8,
        padding: 10,
        displayColors: false,
        callbacks: {
          label: (ctx: any) => `${ctx.parsed.y.toLocaleString()}`
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 10 } }
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.06)', drawBorder: false },
        ticks: { 
          color: 'rgba(255,255,255,0.4)', 
          font: { size: 10 },
          callback: (val: any) => `${(Number(val) / 1000).toFixed(0)}k`
        }
      }
    },
    interaction: { intersect: false, mode: 'index' }
  };

  // Balance Mini Chart (versión reducida)
  balanceMiniChartData: any = {
    labels: [],
    datasets: [{
      data: [],
      borderColor: '#2FA46A',
      backgroundColor: 'rgba(47, 164, 106, 0.2)',
      borderWidth: 2,
      fill: true,
      tension: 0.4,
      pointRadius: 0
    }]
  };

  balanceMiniChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: { x: { display: false }, y: { display: false } },
    elements: { line: { borderWidth: 2 } }
  };

  toggleBalanceSize() {
    this.isBalanceExpanded.update(v => !v);
  }

  // Income vs SolicitudRevision Chart
  comparisonChartData: any = {
    labels: ['Documentos', 'Solicitudes'],
    datasets: [{
      data: [0, 0],
      backgroundColor: ['#22c55e', '#ef4444'],
      borderRadius: 6,
      barThickness: 24
    }]
  };

  comparisonChartOptions: any = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        bodyColor: '#fff',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        cornerRadius: 8,
        callbacks: {
          label: (ctx: any) => `${ctx.parsed.x.toLocaleString()}`
        }
      }
    },
    scales: {
      x: { display: false },
      y: {
        grid: { display: false },
        ticks: { color: 'rgba(255,255,255,0.5)', font: { size: 11 } }
      }
    }
  };

  // Mini charts for metric cards
  incomeMiniChartData: any = { labels: [], datasets: [] };
  expenseMiniChartData: any = { labels: [], datasets: [] };
  savingsMiniChartData: any = { labels: [], datasets: [] };

  miniChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: { x: { display: false }, y: { display: false } },
    elements: { line: { borderWidth: 2, tension: 0.4 } }
  };

  now       = new Date();
  monthName = this.now.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });
  currentMonthName = this.now.toLocaleDateString('es-PE', { month: 'long' });
  lastMonthName = new Date(this.now.getFullYear(), this.now.getMonth() - 1, 1).toLocaleDateString('es-PE', { month: 'long' });

  get income(): number {
    return this.monthlyIncome()?.totalBudgeted ?? 0;
  }

  get limits() {
    return { 
      need: this.income * 0.5, 
      want: this.income * 0.3, 
      saving: this.income * 0.2 
    };
  }

  // Calculados
  totals    = { income: 0, expenses: 0, balance: 0 };
  byRule    = { need: 0, want: 0, saving: 0 };
  byCategory: { name: string; icon: string; total: number }[] = [];
  
  // Documento configurado vs real
  configuredIncome = 0;
  actualIncome = 0;

  // Historial para gráficos (últimos 6 meses)
  monthlyHistory = signal<{ month: number; year: number; income: number; expenses: number; savings: number }[]>([]);
  
  // Comparación con mes anterior
  incomeChange = 0;
  expenseChange = 0;
  savingsChange = 0;

  // Sobrante del mes
  monthlySurplus = 0;
  lastMonthSurplus = 0;
  surplusTrend: 'up' | 'down' | 'stable' = 'stable';

  // Quick entry
  showQuickEntry = signal(false);
  
  // Quick entry form
  quickAmount      = '';
  quickDescription = '';
  quickDate        = this.localToday();
  quickError       = '';
  quickLoading     = false;

  get userName(): string {
    const user = this.authService.currentUser();
    return user?.displayName?.split(' ')[0] ?? user?.email?.split('@')[0] ?? 'Usuario';
  }

  get goalProgress(): number {
    const g = this.goal();
    return g ? this.workflowService.calcAvance(g) : 0;
  }

  get estimatedDate(): string {
    const g = this.goal();
    return g ? this.workflowService.calcFechaEstimada(g.periodosParaCierre) : '';
  }

  // Porcentaje gastado de cada bucket 50/30/20
  pct(spent: number, limit: number): number {
    // Sin datos el limite es 0 y la division producia NaN, que se pintaba
    // literalmente como "NaN%" en las barras del acervo.
    if (!limit || limit <= 0) return 0;
    return Math.min(Math.round((spent / limit) * 100), 100);
  }

  // Color de la barra según % gastado
  barColor(spent: number, limit: number): string {
    if (!limit || limit <= 0) return 'var(--color-text-muted)';
    const p = (spent / limit) * 100;
    if (p >= 90) return 'var(--color-error)';
    if (p >= 70) return 'var(--color-warning)';
    return 'var(--color-primary)';
  }

  // Cargar historial de meses para gráficos
  async loadMonthlyHistory() {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return { year: d.getFullYear(), month: d.getMonth() + 1 };
    });

    const results = await Promise.all(
      months.map(async ({ year, month }) => {
        const txs = await this.historyService.getPorPeriodo(year, month);
        const totals = this.historyService.calcTotales(txs);
        return {
          month,
          year,
          income: totals.income,
          expenses: Math.abs(totals.expenses),
          savings: totals.balance
        };
      })
    );

    this.monthlyHistory.set(results);
  }

  // Comparación vs mes anterior
  calculateMonthOverMonth() {
    const history = this.monthlyHistory();
    if (history.length < 2) return;

    const current = history[history.length - 1];
    const previous = history[history.length - 2];

    this.incomeChange = previous.income > 0 ? ((current.income - previous.income) / previous.income) * 100 : 0;
    this.expenseChange = previous.expenses > 0 ? ((current.expenses - previous.expenses) / previous.expenses) * 100 : 0;
    this.savingsChange = previous.savings > 0 ? ((current.savings - previous.savings) / Math.abs(previous.savings)) * 100 : 0;

    // Calcular tendencia del sobrante
    this.lastMonthSurplus = previous.savings;
    if (this.monthlySurplus > this.lastMonthSurplus) {
      this.surplusTrend = 'up';
    } else if (this.monthlySurplus < this.lastMonthSurplus) {
      this.surplusTrend = 'down';
    } else {
      this.surplusTrend = 'stable';
    }
  }

  // Datos del día actual para el chart
  get currentDay(): number {
    return new Date().getDate();
  }

  get daysRemaining(): number {
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return daysInMonth - this.currentDay;
  }

  async ngOnInit() {
    await this.loadData();
  }

  async loadData() {
    this.isLoading.set(true);
    try {
      const userId = this.authService.getUserId();
      if (!userId) return;

      // Cargar fuentes de ingreso activas
      let activeIncomes: any[] = [];
      let totalConfiguredIncome = 0;
      try {
        activeIncomes = await this.documentService.getActive();
        totalConfiguredIncome = activeIncomes.reduce((sum, src) => sum + (src.amount || 0), 0);
      } catch (e) {
        log.error('Error loading income sources:', e);
      }
      this.incomeSources.set(activeIncomes);

      // Cargar ingreso mensual
      try {
        this.monthlyIncome.set(
          await this.documentService.getDocumentosPeriodo(this.now.getFullYear(), this.now.getMonth() + 1)
        );
      } catch (e) {
        log.error('Error loading monthly income:', e);
      }

      // Cargar metas y registros
      const [txs, goals] = await Promise.all([
        this.historyService.getPorPeriodo(this.now.getFullYear(), this.now.getMonth() + 1),
        this.workflowService.getAll()
      ]);

      this.transactions.set(txs);
      const activeGoal = goals.find(g => g.status === 'active') || goals[0] || null;
      this.goal.set(activeGoal);

      // Obtener estado financiero real
      let fs: any = null;
      try {
        fs = await this.firebaseService.getEstadoDocumental(userId, this.now.getFullYear(), this.now.getMonth() + 1);
      } catch (e) { /* ignore */ }

      const txTotals = this.historyService.calcTotales(txs);
      const initialBalance = fs?.initialBalance ?? 0;
      const receivedIncome = txTotals.income;
      const actualBalanceVal = initialBalance + receivedIncome - Math.abs(txTotals.expenses);

      // Calcular distribución 50/30/20 basado en ingreso total
      const totalIncome = txTotals.income || this.configuredIncome || 0;
      this.byRule = {
        need: totalIncome * 0.5,
        want: totalIncome * 0.3,
        saving: totalIncome * 0.2
      };
      this.byCategory = this.historyService.calcPorCategoria(txs);

      this.actualBalance.set(actualBalanceVal);
      this.totals = {
        income: totalConfiguredIncome,
        expenses: txTotals.expenses,
        balance: actualBalanceVal
      };

      this.configuredIncome = totalConfiguredIncome;
      this.actualIncome = txTotals.income;

      this.monthlySurplus = this.totals.income - this.totals.expenses;

      await this.loadMonthlyHistory();
      this.calculateMonthOverMonth();

      // Generar popups del card de documentos
      this.generateIncomePopups();
      
      // Actualizar datos de charts
      this.updateChartData();
    } finally {
      this.isLoading.set(false);
    }
  }

  private generateIncomePopups() {
    const popups: {message: string, type: 'alert' | 'tip' | 'info', icon: string}[] = [];
    const sources = this.incomeSources();

    // 1. Pagos próximos (3 días)
    sources.forEach(s => {
      if (s.vencimiento?.diasParaVencer != null && s.vencimiento.diasParaVencer >= 0 && s.vencimiento.diasParaVencer <= 3 && s.vencimiento.status !== 'received') {
        const days = s.vencimiento.diasParaVencer;
        const label = days === 0 ? 'Hoy' : days === 1 ? 'Mañana' : `en ${days} días`;
        popups.push({ message: `${s.name} vence ${label}`, type: 'alert', icon: 'clock' });
      }
    });

    // 2. Pagos atrasados
    sources.forEach(s => {
      if (s.vencimiento?.status === 'overdue') {
        popups.push({ message: `${s.name} está atrasado`, type: 'alert', icon: 'alert-triangle' });
      }
    });

    // 3. Tips financieros
    if (this.incomeChange > 10) {
      popups.push({ message: 'Tus documentos subieron este mes, sigue así', type: 'tip', icon: 'trending-up' });
    }
    if (this.expenseChange > 15) {
      popups.push({ message: 'Tus solicitudes subieron más del 15%', type: 'tip', icon: 'alert-triangle' });
    }

    // 4. Fallback: si no hay alertas, mostrar info útil
    if (popups.length === 0 && sources.length > 0) {
      const pending = sources.filter(s => s.vencimiento?.status === 'scheduled' || s.vencimiento?.status === 'pending');
      if (pending.length > 0) {
        const next = pending.sort((a, b) => (a.vencimiento?.diasParaVencer ?? 999) - (b.vencimiento?.diasParaVencer ?? 999))[0];
        const days = next.vencimiento?.diasParaVencer;
        if (days != null && days > 3) {
          popups.push({ message: `${next.name} en ${days} días`, type: 'info', icon: 'clock' });
        }
      }
      if (popups.length === 0) {
        popups.push({ message: 'Registra tus documentos para ver alertas', type: 'tip', icon: 'info' });
      }
    }

    this.incomePopups.set(popups.slice(0, 3));
    this.currentPopupIndex.set(0);
    this.startPopupRotation();
  }

  private startPopupRotation() {
    if (this.popupInterval) {
      clearInterval(this.popupInterval);
      this.popupInterval = null;
    }
    const total = this.incomePopups().length;
    if (total <= 1) return;
    this.popupInterval = setInterval(() => {
      this.currentPopupIndex.update(i => (i + 1) % total);
    }, 5000);
  }

  ngOnDestroy() {
    if (this.popupInterval) {
      clearInterval(this.popupInterval);
      this.popupInterval = null;
    }
  }

  // ─── Actualizar datos de charts ───
  private updateChartData() {
    // Balance chart - datos por día
    const txs = this.transactions();
    const now = new Date();
    const currentDay = now.getDate();
    
    let balance = 0;
    const labels: string[] = [];
    const data: number[] = [];
    
    for (let day = 1; day <= currentDay; day++) {
      const dayTxs = txs.filter(t => {
        const txDate = new Date(t.date);
        return txDate.getDate() === day && txDate.getMonth() === now.getMonth();
      });
      dayTxs.forEach(tx => { balance += tx.amount; });
      labels.push(`${day}`);
      data.push(Math.round(balance * 100) / 100);
    }
    
    // Balance chart (full)
    this.balanceChartData = {
      labels,
      datasets: [{
        ...this.balanceChartData.datasets[0],
        data
      }]
    };
    
    // Balance mini chart
    this.balanceMiniChartData = {
      labels,
      datasets: [{
        ...this.balanceMiniChartData.datasets[0],
        data
      }]
    };
    
    // Comparison chart - Entradas vs Salidas
    this.comparisonChartData = {
      labels: ['Documentos', 'Solicitudes'],
      datasets: [{
        data: [this.totals.income, this.totals.expenses],
        backgroundColor: ['#22c55e', '#ef4444'],
        borderRadius: 6,
        barThickness: 24
      }]
    };
    
    // Mini charts
    const hist = this.monthlyHistory();
    const histLabels = hist.map(h => `${h.month}`);
    
    this.incomeMiniChartData = {
      labels: histLabels,
      datasets: [{ data: hist.map(h => h.income), borderColor: 'rgba(255,255,255,0.6)', backgroundColor: 'rgba(255,255,255,0.1)', fill: true, tension: 0.4 }]
    };
    
    this.expenseMiniChartData = {
      labels: histLabels,
      datasets: [{ data: hist.map(h => h.expenses), borderColor: 'rgba(255,255,255,0.6)', backgroundColor: 'rgba(255,255,255,0.1)', fill: true, tension: 0.4 }]
    };
    
    this.savingsMiniChartData = {
      labels: histLabels,
      datasets: [{ data: hist.map(h => h.savings > 0 ? h.savings : 0), borderColor: 'rgba(255,255,255,0.6)', backgroundColor: 'rgba(255,255,255,0.1)', fill: true, tension: 0.4 }]
    };
  }

  // ─── Balance Card Carrusel ────────────────────────────────
  nextBalanceView() {
    this.currentBalanceView.update(v => (v + 1) % this.totalBalanceViews);
  }

  prevBalanceView() {
    this.currentBalanceView.update(v => (v - 1 + this.totalBalanceViews) % this.totalBalanceViews);
  }

  setBalanceView(index: number) {
    this.currentBalanceView.set(index);
  }

  // ─── Quick Entry ─────────────────────────────────────────
  openQuickEntry()  { this.showQuickEntry.set(true); this.resetQuick(); }
  closeQuickEntry() { this.showQuickEntry.set(false); }

  appendDigit(d: string) {
    if (this.quickAmount.includes('.') && this.quickAmount.split('.')[1]?.length >= 2) return;
    if (d === '.' && this.quickAmount.includes('.')) return;
    if (d === '.' && this.quickAmount === '') this.quickAmount = '0';
    this.quickAmount += d;
  }

  deleteDigit() { this.quickAmount = this.quickAmount.slice(0, -1); }

  setSign(sign: 'income' | 'expense') {
    const clean = this.quickAmount.replace('-', '');
    this.quickAmount = sign === 'expense' ? `-${clean}` : clean;
  }

  get isExpense(): boolean { return this.quickAmount.startsWith('-'); }

  async saveQuickEntry() {
    const amount = parseFloat(this.quickAmount);
    if (isNaN(amount) || amount === 0) { this.quickError = 'Ingresa un cantidad válido'; return; }

    this.quickLoading = true;
    this.quickError   = '';
    try {
      await this.historyService.create({
        amount,
        description: this.quickDescription || (amount < 0 ? 'Solicitud' : 'Documento'),
        date: this.quickDate,
        type: amount < 0 ? 'expense' : 'income'
      });
      this.closeQuickEntry();
      await this.loadData();
    } catch (e: any) {
      this.quickError = e.message;
    } finally {
      this.quickLoading = false;
    }
  }

  private resetQuick() {
    this.quickAmount = ''; this.quickDescription = '';
    this.quickError = '';
    this.quickDate = this.localToday();
  }

  private localToday(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  formatSol(n: number): string {
    // Antes devolvia dos decimales porque formateaba soles peruanos. Lo
    // que se cuenta aqui son documentos: entero con separador de millares.
    return Math.abs(Math.round(n)).toLocaleString('es-PE');
  }

  async logout() { await this.authService.signOut(); }
}