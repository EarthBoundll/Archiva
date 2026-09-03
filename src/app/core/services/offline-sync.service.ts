import { Injectable, inject } from '@angular/core';
import { FirebaseService } from './firebase';
import { Auth } from './auth';

export interface SyncStatus {
  lastSynced: string | null;
  pendingChanges: number;
  isOnline: boolean;
  isSyncing: boolean;
}

export interface OfflineTransaction {
  id?: string;
  type: 'create' | 'update' | 'delete';
  data: any;
  timestamp: string;
}

const DB_NAME = 'trackpays_offline';
const DB_VERSION = 1;
const STORES = {
  transactions: 'transactions',
  income: 'income',
  expenses: 'expenses',
  budgets: 'budgets',
  goals: 'goals',
  pending: 'pending_sync'
};

@Injectable({ providedIn: 'root' })
export class OfflineSyncService {
  private firebase = inject(FirebaseService);
  private authService = inject(Auth);
  private db: IDBDatabase | null = null;
  private isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  constructor() {
    this.initDatabase();
    this.setupOnlineListener();
  }

  private async initDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        console.warn('IndexedDB not available');
        resolve();
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores
        if (!db.objectStoreNames.contains(STORES.transactions)) {
          db.createObjectStore(STORES.transactions, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.income)) {
          db.createObjectStore(STORES.income, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.expenses)) {
          db.createObjectStore(STORES.expenses, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.budgets)) {
          db.createObjectStore(STORES.budgets, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.goals)) {
          db.createObjectStore(STORES.goals, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.pending)) {
          db.createObjectStore(STORES.pending, { keyPath: 'id', autoIncrement: true });
        }
      };
    });
  }

  private setupOnlineListener(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.syncPendingChanges();
      });
      window.addEventListener('offline', () => {
        this.isOnline = false;
      });
    }
  }

  getStatus(): SyncStatus {
    return {
      lastSynced: localStorage.getItem('trackpays_last_synced'),
      pendingChanges: 0, // Will be calculated
      isOnline: this.isOnline,
      isSyncing: false
    };
  }

  // Store methods for each entity type
  async cacheTransactions(transactions: any[]): Promise<void> {
    await this.bulkPut(STORES.transactions, transactions);
  }

  async cacheIncome(sources: any[]): Promise<void> {
    await this.bulkPut(STORES.income, sources);
  }

  async cacheExpenses(expenses: any[]): Promise<void> {
    await this.bulkPut(STORES.expenses, expenses);
  }

  async cacheBudgets(budgets: any[]): Promise<void> {
    await this.bulkPut(STORES.budgets, budgets);
  }

  async cacheGoals(goals: any[]): Promise<void> {
    await this.bulkPut(STORES.goals, goals);
  }

  // Get cached data
  async getCachedTransactions(): Promise<any[]> {
    return this.getAll(STORES.transactions);
  }

  async getCachedIncome(): Promise<any[]> {
    return this.getAll(STORES.income);
  }

  async getCachedExpenses(): Promise<any[]> {
    return this.getAll(STORES.expenses);
  }

  async getCachedBudgets(): Promise<any[]> {
    return this.getAll(STORES.budgets);
  }

  async getCachedGoals(): Promise<any[]> {
    return this.getAll(STORES.goals);
  }

  // Queue changes for offline sync
  async queueChange(type: 'create' | 'update' | 'delete', store: string, data: any): Promise<void> {
    const change: OfflineTransaction = {
      type,
      data: { store, ...data },
      timestamp: new Date().toISOString()
    };

    await this.put(STORES.pending, change);

    // If online, try to sync immediately
    if (this.isOnline) {
      await this.syncPendingChanges();
    }
  }

  // Sync all pending changes
  async syncPendingChanges(): Promise<{ synced: number; failed: number }> {
    if (!this.isOnline) {
      return { synced: 0, failed: 0 };
    }

    const userId = this.authService.getUserId();
    if (!userId) return { synced: 0, failed: 0 };

    const pending = await this.getAll(STORES.pending);
    let synced = 0;
    let failed = 0;

    for (const change of pending) {
      try {
        await this.applyChange(userId, change);
        await this.delete(STORES.pending, (change as any).id);
        synced++;
      } catch (error) {
        console.error('Failed to sync change:', error);
        failed++;
      }
    }

    if (synced > 0) {
      localStorage.setItem('trackpays_last_synced', new Date().toISOString());
    }

    return { synced, failed };
  }

  private async applyChange(userId: string, change: OfflineTransaction): Promise<void> {
    const { store, ...data } = change.data;

    switch (store) {
      case 'transactions':
        if (change.type === 'create') {
          await this.firebase.crearRegistro(userId, data);
        } else if (change.type === 'update') {
          await this.firebase.actualizarRegistro(userId, data.id, data);
        } else if (change.type === 'delete') {
          await this.firebase.eliminarRegistro(userId, data.id);
        }
        break;
      // Add other stores as needed
    }
  }

  // Sync from Firebase to local cache
  async syncFromFirebase(year: number, month: number): Promise<void> {
    const userId = this.authService.getUserId();
    if (!userId) return;

    const [
      transactions,
      income,
      expenses,
      budgets,
      goals
    ] = await Promise.all([
      this.firebase.getHistorialPorPeriodo(userId, year, month),
      this.firebase.getDocumentos(userId),
      this.firebase.getSolicitudes(userId),
      this.firebase.getCuotasPorPeriodo(userId, year, month),
      this.firebase.getFlujos(userId)
    ]);

    await Promise.all([
      this.cacheTransactions(transactions),
      this.cacheIncome(income),
      this.cacheExpenses(expenses),
      this.cacheBudgets(budgets),
      this.cacheGoals(goals)
    ]);

    localStorage.setItem('trackpays_last_synced', new Date().toISOString());
  }

  // Get data (tries cache first, falls back to Firebase)
  async getDataWithFallback(
    dataType: 'transactions' | 'income' | 'expenses' | 'budgets' | 'goals',
    year?: number,
    month?: number
  ): Promise<any[]> {
    const userId = this.authService.getUserId();
    if (!userId) return [];

    // Try cache first
    let cached: any[];
    switch (dataType) {
      case 'transactions':
        cached = await this.getCachedTransactions();
        break;
      case 'income':
        cached = await this.getCachedIncome();
        break;
      case 'expenses':
        cached = await this.getCachedExpenses();
        break;
      case 'budgets':
        cached = await this.getCachedBudgets();
        break;
      case 'goals':
        cached = await this.getCachedGoals();
        break;
    }

    // If we have cached data, return it
    if (cached && cached.length > 0) {
      // If online, update cache in background
      if (this.isOnline && year && month) {
        this.syncFromFirebase(year, month).catch(console.error);
      }
      return cached;
    }

    // If no cache or offline, fetch from Firebase
    if (this.isOnline) {
      await this.syncFromFirebase(year!, month!);
      switch (dataType) {
        case 'transactions':
          return this.getCachedTransactions();
        case 'income':
          return this.getCachedIncome();
        case 'expenses':
          return this.getCachedExpenses();
        case 'budgets':
          return this.getCachedBudgets();
        case 'goals':
          return this.getCachedGoals();
      }
    }

    return [];
  }

  // Clear all cached data
  async clearCache(): Promise<void> {
    const stores = Object.values(STORES);
    for (const store of stores) {
      await this.clear(store);
    }
  }

  // Get pending changes count
  async getPendingCount(): Promise<number> {
    const pending = await this.getAll(STORES.pending);
    return pending.length;
  }

  // IndexedDB helper methods
  private async getAll(storeName: string): Promise<any[]> {
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  private async put(storeName: string, data: any): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  private async bulkPut(storeName: string, items: any[]): Promise<void> {
    if (!this.db || items.length === 0) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);

      items.forEach(item => store.put(item));

      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve();
    });
  }

  private async delete(storeName: string, key: any): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  private async clear(storeName: string): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
}