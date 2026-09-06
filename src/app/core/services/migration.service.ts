import { Injectable, inject } from '@angular/core';
import { FirebaseService } from './firebase';
import { Auth } from './auth';

@Injectable({ providedIn: 'root' })
export class MigrationService {
  private firebase = inject(FirebaseService);
  private authService = inject(Auth);

  // ============================================
  // DETECTAR DATOS ANTIGUOS
  // ============================================

  async checkLegacyData(): Promise<{
    hasLegacyTransactions: boolean;
    hasLegacyGoals: boolean;
    hasLegacyCategories: boolean;
    legacyTransactionCount: number;
    legacyGoalCount: number;
  }> {
    const userId = this.authService.getUserId();
    if (!userId) {
      return {
        hasLegacyTransactions: false,
        hasLegacyGoals: false,
        hasLegacyCategories: false,
        legacyTransactionCount: 0,
        legacyGoalCount: 0
      };
    }

    // Check legacy transactions (flat collection)
    const legacyTx = await this.firebase.checkLegacyTransactions(userId);
    
    // Check legacy goals (goals/data document)
    const legacyGoal = await this.firebase.checkLegacyGoal(userId);

    // Check legacy categories
    const legacyCategories = await this.firebase.checkLegacyCategories(userId);

    return {
      hasLegacyTransactions: legacyTx.count > 0,
      hasLegacyGoals: legacyGoal.exists,
      hasLegacyCategories: legacyCategories.count > 0,
      legacyTransactionCount: legacyTx.count,
      legacyGoalCount: legacyGoal.exists ? 1 : 0
    };
  }

  // ============================================
  // MIGRAR TRANSACCIONES
  // ============================================

  async migrateTransactions(): Promise<{
    migrated: number;
    errors: string[];
  }> {
    const userId = this.authService.getUserId();
    if (!userId) throw new Error('No autenticado');

    const result = { migrated: 0, errors: [] as string[] };

    try {
      // Get all legacy transactions
      const legacyTxs = await this.firebase.getLegacyTransactions(userId);
      
      if (legacyTxs.length === 0) {
        return result;
      }

      // Migrate each transaction to month structure
      for (const tx of legacyTxs) {
        try {
          // Extract year/month from date
          const date = new Date(tx.date || tx.createdAt);
          const year = date.getFullYear();
          const month = date.getMonth() + 1;
          const periodoId = `${year}-${String(month).padStart(2, '0')}`;

          // Create in new structure
          const migratedData = {
            amount: tx.amount,
            description: tx.description || 'Sin descripción',
            date: tx.date || date.toISOString().split('T')[0],
            type: tx.type || (tx.amount > 0 ? 'income' : 'expense'),
            ruleType: tx.tipo === 'entrada' ? 'income' : 'need',
            createdAt: tx.createdAt || new Date().toISOString(),
            updatedAt: tx.updatedAt || new Date().toISOString()
          };

          await this.firebase.crearRegistro(userId, migratedData);
          result.migrated++;

        } catch (e: any) {
          result.errors.push(`Registro ${tx.id}: ${e.message}`);
        }
      }

      // After migration, mark as migrated
      await this.firebase.markAsMigrated(userId, 'transactions');

    } catch (e: any) {
      result.errors.push(`Error general: ${e.message}`);
    }

    return result;
  }

  // ============================================
  // MIGRAR GOALS
  // ============================================

  async migrateGoals(): Promise<{
    migrated: number;
    errors: string[];
  }> {
    const userId = this.authService.getUserId();
    if (!userId) throw new Error('No autenticado');

    const result = { migrated: 0, errors: [] as string[] };

    try {
      // Get legacy goal
      const legacyGoal = await this.firebase.getLegacyGoal(userId);
      
      if (!legacyGoal) {
        return result;
      }

      // Create in new goals collection
      const newGoal = {
        name: legacyGoal.name || 'Meta Principal',
        category: 'other',
        etapasTotales: legacyGoal.etapasTotales || 0,
        etapasCompletadas: legacyGoal.etapasCompletadas || 0,
        etapasPorPeriodo: legacyGoal.etapasPorPeriodo || 0,
        priority: 'high' as const,
        status: 'active' as const,
        periodosParaCierre: legacyGoal.periodosParaCierre || null,
        fechaProyectadaCierre: null,
        etapas: [],
        notes: 'Migrado desde sistema antiguo',
        createdAt: legacyGoal.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await this.firebase.crearFlujo(userId, newGoal);
      result.migrated = 1;

      // Mark as migrated
      await this.firebase.markAsMigrated(userId, 'goals');

    } catch (e: any) {
      result.errors.push(`Goal: ${e.message}`);
    }

    return result;
  }

  // ============================================
  // MIGRAR TODO
  // ============================================

  async migrateAll(): Promise<{
    transactions: { migrated: number; errors: string[] };
    goals: { migrated: number; errors: string[] };
    completed: boolean;
  }> {
    const txResult = await this.migrateTransactions();
    const goalResult = await this.migrateGoals();

    return {
      transactions: txResult,
      goals: goalResult,
      completed: true
    };
  }

  // ============================================
  // VERIFICAR SI YA SE MIGRÓ
  // ============================================

  async isAlreadyMigrated(): Promise<boolean> {
    const userId = this.authService.getUserId();
    if (!userId) return true; // Assume migrated if not logged in

    return this.firebase.checkMigrationStatus(userId);
  }
}
