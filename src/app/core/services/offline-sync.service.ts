import { Injectable, inject } from '@angular/core';
import { FirebaseService } from './firebase';
import { Auth } from './auth';
import { log } from '../utils/logger';

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

const DB_NAME = 'archiva_offline';

// v2: los almacenes pasan de transactions/income/expenses/budgets/goals a
// los del dominio documental. La cache es desechable, asi que basta con
// crear el esquema nuevo: se rellena en la primera sincronizacion.
const DB_VERSION = 2;

const STORES = {
  bitacora:    'bitacora',
  documentos:  'documentos',
  solicitudes: 'solicitudes',
  cuotas:      'cuotas',
  flujos:      'flujos',
  pending:     'pending_sync'
};

/** Lo que se puede pedir a la cache. */
export type TipoDatoCache = 'bitacora' | 'documentos' | 'solicitudes' | 'cuotas' | 'flujos';

/**
 * Borra la base local. Funcion suelta, sin inyeccion de dependencias:
 * Auth necesita invocarla al cerrar sesion y OfflineSyncService ya depende
 * de Auth, asi que inyectar el servicio crearia una dependencia circular.
 */
export async function borrarCacheLocal(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror   = () => resolve();  // no bloquear el logout por esto
    req.onblocked = () => resolve();
  });
}

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
        log.warn('IndexedDB not available');
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
        if (!db.objectStoreNames.contains(STORES.bitacora)) {
          db.createObjectStore(STORES.bitacora, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.documentos)) {
          db.createObjectStore(STORES.documentos, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.solicitudes)) {
          db.createObjectStore(STORES.solicitudes, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.cuotas)) {
          db.createObjectStore(STORES.cuotas, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.flujos)) {
          db.createObjectStore(STORES.flujos, { keyPath: 'id' });
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
      lastSynced: localStorage.getItem('archiva_last_synced'),
      pendingChanges: 0, // Will be calculated
      isOnline: this.isOnline,
      isSyncing: false
    };
  }

  /**
   * Borra por completo la base local.
   *
   * La cache no esta segmentada por usuario: guarda documentos, solicitudes,
   * historial, flujos y cuotas en almacenes compartidos. Si sobrevive al
   * cierre de sesion, en un equipo compartido el siguiente usuario recibe
   * datos del anterior. Se invoca desde Auth.signOut().
   */
  async clearAll(): Promise<void> {
    this.db?.close();
    this.db = null;
    await borrarCacheLocal();
  }

  // Store methods for each entity type
  async cacheBitacora(registros: any[]): Promise<void> {
    await this.bulkPut(STORES.bitacora, registros);
  }

  async cacheDocumentos(documentos: any[]): Promise<void> {
    await this.bulkPut(STORES.documentos, documentos);
  }

  async cacheSolicitudes(solicitudes: any[]): Promise<void> {
    await this.bulkPut(STORES.solicitudes, solicitudes);
  }

  async cacheCuotas(cuotas: any[]): Promise<void> {
    await this.bulkPut(STORES.cuotas, cuotas);
  }

  async cacheFlujos(flujos: any[]): Promise<void> {
    await this.bulkPut(STORES.flujos, flujos);
  }

  // Get cached data
  async getBitacoraEnCache(): Promise<any[]> {
    return this.getAll(STORES.bitacora);
  }

  async getDocumentosEnCache(): Promise<any[]> {
    return this.getAll(STORES.documentos);
  }

  async getSolicitudesEnCache(): Promise<any[]> {
    return this.getAll(STORES.solicitudes);
  }

  async getCuotasEnCache(): Promise<any[]> {
    return this.getAll(STORES.cuotas);
  }

  async getFlujosEnCache(): Promise<any[]> {
    return this.getAll(STORES.flujos);
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
        log.error('Failed to sync change:', error);
        failed++;
      }
    }

    if (synced > 0) {
      localStorage.setItem('archiva_last_synced', new Date().toISOString());
    }

    return { synced, failed };
  }

  private async applyChange(userId: string, change: OfflineTransaction): Promise<void> {
    const { store, ...data } = change.data;

    switch (store) {
      case 'bitacora':
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
      bitacora,
      documentos,
      solicitudes,
      cuotas,
      flujos
    ] = await Promise.all([
      this.firebase.getHistorialPorPeriodo(userId, year, month),
      this.firebase.getDocumentos(userId),
      this.firebase.getSolicitudes(userId),
      this.firebase.getCuotasPorPeriodo(userId, year, month),
      this.firebase.getFlujos(userId)
    ]);

    await Promise.all([
      this.cacheBitacora(bitacora),
      this.cacheDocumentos(documentos),
      this.cacheSolicitudes(solicitudes),
      this.cacheCuotas(cuotas),
      this.cacheFlujos(flujos)
    ]);

    localStorage.setItem('archiva_last_synced', new Date().toISOString());
  }

  // Get data (tries cache first, falls back to Firebase)
  async getDataWithFallback(
    dataType: TipoDatoCache,
    year?: number,
    month?: number
  ): Promise<any[]> {
    const userId = this.authService.getUserId();
    if (!userId) return [];

    // Try cache first
    let cached: any[];
    switch (dataType) {
      case 'bitacora':
        cached = await this.getBitacoraEnCache();
        break;
      case 'documentos':
        cached = await this.getDocumentosEnCache();
        break;
      case 'solicitudes':
        cached = await this.getSolicitudesEnCache();
        break;
      case 'cuotas':
        cached = await this.getCuotasEnCache();
        break;
      case 'flujos':
        cached = await this.getFlujosEnCache();
        break;
    }

    // If we have cached data, return it
    if (cached && cached.length > 0) {
      // If online, update cache in background
      if (this.isOnline && year && month) {
        this.syncFromFirebase(year, month).catch(e => log.error(e));
      }
      return cached;
    }

    // If no cache or offline, fetch from Firebase
    if (this.isOnline) {
      await this.syncFromFirebase(year!, month!);
      switch (dataType) {
        case 'bitacora':
          return this.getBitacoraEnCache();
        case 'documentos':
          return this.getDocumentosEnCache();
        case 'solicitudes':
          return this.getSolicitudesEnCache();
        case 'cuotas':
          return this.getCuotasEnCache();
        case 'flujos':
          return this.getFlujosEnCache();
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