import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StorageService } from '../../core/services/storage';
import { CATEGORIAS_DOCUMENTALES, type CategoriaDocumental } from '../../core/models/document.model';
import { IconComponent } from '../../core/components/icon/icon.component';

interface BudgetCategory {
  id: string;
  category: string;
  categoryName: string;
  icon: string;
  budgeted: number;
  spent: number;
  remaining: number;
  percentage: number;
  status: 'ok' | 'at_risk' | 'exceeded';
}

@Component({
  selector: 'app-almacenamiento',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './storage.html',
  styleUrl: './storage.scss'
})
export class StorageComponent implements OnInit {
  private storageService = inject(StorageService);

  categories = signal<BudgetCategory[]>([]);
  showModal = signal(false);
  editingCategory = signal<string | null>(null);

  formCategory = '';
  formAmount: number | null = null;

  repartiendo = signal(false);
  avisoReparto = signal<string | null>(null);

  now = new Date();
  currentMonth = this.now.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });

  get totalBudgeted() {
    return this.categories().reduce((sum, c) => sum + c.budgeted, 0);
  }

  get totalSpent() {
    return this.categories().reduce((sum, c) => sum + c.spent, 0);
  }

  get remaining() {
    return this.totalBudgeted - this.totalSpent;
  }

  get budgetProgress() {
    return this.totalBudgeted > 0 ? Math.round((this.totalSpent / this.totalBudgeted) * 100) : 0;
  }

  /** Las cuotas se asignan por categoria documental, no por tipo de gasto. */
  availableCategories = (Object.keys(CATEGORIAS_DOCUMENTALES) as CategoriaDocumental[])
    .map(c => ({ value: c as string, label: CATEGORIAS_DOCUMENTALES[c].label }));

  async ngOnInit() {
    await this.loadBudgets();
  }

  async loadBudgets() {
    const budgets = await this.storageService.getPorPeriodo(this.now.getFullYear(), this.now.getMonth() + 1);
    const cats = budgets.map(b => this.mapBudgetToCategory(b));
    this.categories.set(cats);
  }

  private mapBudgetToCategory(b: any): BudgetCategory {
    const spent = b.spent || 0;
    const budgeted = b.budgetedAmount || 0;
    const remaining = budgeted - spent;
    const percentage = budgeted > 0 ? Math.round((spent / budgeted) * 100) : 0;

    let status: 'ok' | 'at_risk' | 'exceeded' = 'ok';
    if (percentage >= 100) status = 'exceeded';
    else if (percentage >= 70) status = 'at_risk';

    return {
      id: b.id || b.category,
      category: b.category,
      categoryName: CATEGORIAS_DOCUMENTALES[b.category as CategoriaDocumental]?.label
                     ?? b.categoryName ?? b.category,
      // El icono sale del catalogo documental: antes la plantilla escogia
      // entre vivienda, transporte, salud y supermercado.
      icon: CATEGORIAS_DOCUMENTALES[b.category as CategoriaDocumental]?.icon ?? 'folder',
      budgeted,
      spent,
      remaining,
      percentage,
      status
    };
  }

  /** Capacidad en la unidad que corresponda: MB o GB. */
  formatoMb(n: number): string {
    const v = Math.abs(n);
    if (v >= 1024) return `${(v / 1024).toLocaleString('es-PE', { maximumFractionDigits: 1 })} GB`;
    if (v < 1)     return `${Math.round(v * 1024)} KB`;
    return `${v.toLocaleString('es-PE', { maximumFractionDigits: 1 })} MB`;
  }

  /**
   * Reparte una capacidad total entre las categorias que ya tienen
   * documentos, en proporcion a lo que ocupan. Ahorra doce altas manuales
   * en un acervo recien creado.
   */
  async repartirAutomaticamente() {
    if (this.repartiendo()) return;

    const entrada = window.prompt(
      'Capacidad total a repartir, en MB:',
      '500'
    );
    if (entrada === null) return;

    const capacidad = Number(entrada.replace(',', '.'));
    if (!Number.isFinite(capacidad) || capacidad <= 0) {
      this.avisoReparto.set('Indica una capacidad mayor que cero.');
      return;
    }

    this.repartiendo.set(true);
    this.avisoReparto.set(null);
    try {
      const creadas = await this.storageService.autoDistribuirCuotas(
        capacidad, this.now.getFullYear(), this.now.getMonth() + 1
      );

      if (creadas === 0) {
        this.avisoReparto.set(
          'No hay documentos todavía: registra alguno y el reparto sabrá qué peso dar a cada serie.'
        );
      } else {
        await this.loadBudgets();
      }
    } catch {
      this.avisoReparto.set('No se pudo repartir la capacidad. Inténtalo de nuevo.');
    } finally {
      this.repartiendo.set(false);
    }
  }

  createBudget() {
    this.editingCategory.set(null);
    this.formCategory = '';
    this.formAmount = null;
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
  }

  async saveBudget() {
    if (!this.formCategory || !this.formAmount) return;

    await this.storageService.asignarCuota({
      category: this.formCategory,
      categoryName: this.availableCategories.find(c => c.value === this.formCategory)?.label || this.formCategory,
      budgetedAmount: this.formAmount,
      // Series exigidas por norma: son las que no pueden quedarse sin
      // espacio sin consecuencias.
      esPrioritaria: ['contrato', 'factura', 'resolucion', 'convenio', 'politica'].includes(this.formCategory),
      periodoId: `${this.now.getFullYear()}-${String(this.now.getMonth() + 1).padStart(2, '0')}`,
      year: this.now.getFullYear(),
      month: this.now.getMonth() + 1
    });

    this.closeModal();
    await this.loadBudgets();
  }
}