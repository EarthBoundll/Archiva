import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StorageService } from '../../core/services/storage';

interface BudgetCategory {
  id: string;
  category: string;
  categoryName: string;
  budgeted: number;
  spent: number;
  remaining: number;
  percentage: number;
  status: 'ok' | 'at_risk' | 'exceeded';
}

@Component({
  selector: 'app-budgets',
  standalone: true,
  imports: [CommonModule, FormsModule],
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

  availableCategories = [
    { value: 'housing', label: 'Vivienda' },
    { value: 'utilities', label: 'Servicios' },
    { value: 'transport', label: 'Transporte' },
    { value: 'health', label: 'Salud' },
    { value: 'groceries', label: 'Supermercado' },
    { value: 'dining_out', label: 'Restaurantes' },
    { value: 'entertainment', label: 'Entretenimiento' },
    { value: 'shopping', label: 'Compras' },
    { value: 'subscriptions', label: 'Suscripciones' },
    { value: 'clothing', label: 'Ropa' },
    { value: 'pets', label: 'Mascotas' },
    { value: 'education', label: 'Educación' },
  ];

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
      categoryName: b.categoryName || b.category,
      budgeted,
      spent,
      remaining,
      percentage,
      status
    };
  }

  formatSol(n: number): string {
    return `${Math.abs(n).toFixed(2)}`;
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
      esPrioritaria: ['housing', 'utilities', 'transport', 'health', 'groceries'].includes(this.formCategory),
      periodoId: `${this.now.getFullYear()}-${String(this.now.getMonth() + 1).padStart(2, '0')}`,
      year: this.now.getFullYear(),
      month: this.now.getMonth() + 1
    });

    this.closeModal();
    await this.loadBudgets();
  }
}