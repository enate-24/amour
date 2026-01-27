// Enhanced Offline Storage Manager
// Provides comprehensive offline data management with sync capabilities

interface StoredData {
  id: string;
  type: 'game' | 'user' | 'cartela' | 'settings' | 'balance';
  data: any;
  timestamp: number;
  synced: boolean;
  version: number;
}

interface SyncQueueItem {
  id: string;
  action: 'create' | 'update' | 'delete';
  type: string;
  data: any;
  timestamp: number;
  retryCount: number;
}

class OfflineStorageManager {
  private dbName = 'AmourOfflineDB';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;
  private syncQueue: SyncQueueItem[] = [];
  private readonly SYNC_QUEUE_KEY = 'sync_queue';

  isInitialized(): boolean {
    return this.db !== null;
  }

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        this.loadSyncQueue();
        console.log('✅ Offline storage initialized');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores
        if (!db.objectStoreNames.contains('data')) {
          const dataStore = db.createObjectStore('data', { keyPath: 'id' });
          dataStore.createIndex('type', 'type', { unique: false });
          dataStore.createIndex('timestamp', 'timestamp', { unique: false });
          dataStore.createIndex('synced', 'synced', { unique: false });
        }

        if (!db.objectStoreNames.contains('games')) {
          const gamesStore = db.createObjectStore('games', { keyPath: 'id' });
          gamesStore.createIndex('gameNumber', 'gameNumber', { unique: false });
          gamesStore.createIndex('status', 'status', { unique: false });
          gamesStore.createIndex('userId', 'userId', { unique: false });
        }

        if (!db.objectStoreNames.contains('cartelas')) {
          const cartelasStore = db.createObjectStore('cartelas', { keyPath: 'card_id' });
          cartelasStore.createIndex('is_active', 'is_active', { unique: false });
        }

        if (!db.objectStoreNames.contains('users')) {
          const usersStore = db.createObjectStore('users', { keyPath: 'id' });
          usersStore.createIndex('email', 'email', { unique: true });
        }

        console.log('📦 Offline storage schema created');
      };
    });
  }

  // Store data with automatic sync queue management
  async store(type: string, id: string, data: any, action: 'create' | 'update' = 'update'): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const storedData: StoredData = {
      id: `${type}_${id}`,
      type: type as any,
      data,
      timestamp: Date.now(),
      synced: false,
      version: 1
    };

    // Store in IndexedDB
    const transaction = this.db.transaction(['data'], 'readwrite');
    const store = transaction.objectStore('data');
    await new Promise<void>((resolve, reject) => {
      const request = store.put(storedData);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    // Add to sync queue
    this.addToSyncQueue(id, action, type, data);

    console.log(`💾 Stored ${type} data offline: ${id}`);
  }

  // Retrieve data from offline storage
  async retrieve(type: string, id?: string): Promise<any> {
    if (!this.db) throw new Error('Database not initialized');

    const transaction = this.db.transaction(['data'], 'readonly');
    const store = transaction.objectStore('data');

    if (id) {
      // Get specific item
      return new Promise((resolve, reject) => {
        const request = store.get(`${type}_${id}`);
        request.onsuccess = () => {
          const result = request.result;
          resolve(result ? result.data : null);
        };
        request.onerror = () => reject(request.error);
      });
    } else {
      // Get all items of type
      return new Promise((resolve, reject) => {
        const index = store.index('type');
        const request = index.getAll(type);
        request.onsuccess = () => {
          const results = request.result.map(item => item.data);
          resolve(results);
        };
        request.onerror = () => reject(request.error);
      });
    }
  }

  // Store game data with full offline support
  async storeGame(gameData: any): Promise<void> {
    if (!this.db) {
      console.log('🔄 Auto-initializing offline storage...');
      await this.initialize();
    }

    const transaction = this.db.transaction(['games'], 'readwrite');
    const store = transaction.objectStore('games');

    const gameRecord = {
      ...gameData,
      timestamp: Date.now(),
      synced: false,
      offlineCreated: true
    };

    await new Promise<void>((resolve, reject) => {
      const request = store.put(gameRecord);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    // Add to sync queue
    this.addToSyncQueue(gameData.id, 'create', 'game', gameData);

    console.log(`🎮 Game stored offline: ${gameData.gameNumber}`);
  }

  // Retrieve games from offline storage
  async getGames(userId?: string): Promise<any[]> {
    if (!this.db) {
      console.log('🔄 Auto-initializing offline storage...');
      await this.initialize();
    }

    const transaction = this.db.transaction(['games'], 'readonly');
    const store = transaction.objectStore('games');

    return new Promise((resolve, reject) => {
      const request = userId 
        ? store.index('userId').getAll(userId)
        : store.getAll();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Store cartelas for offline access
  async storeCartelas(cartelas: any[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const transaction = this.db.transaction(['cartelas'], 'readwrite');
    const store = transaction.objectStore('cartelas');

    for (const cartela of cartelas) {
      await new Promise<void>((resolve, reject) => {
        const request = store.put(cartela);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }

    console.log(`📋 Stored ${cartelas.length} cartelas offline`);
  }

  // Get cartelas from offline storage
  async getCartelas(): Promise<any[]> {
    if (!this.db) {
      console.log('🔄 Auto-initializing offline storage...');
      await this.initialize();
    }

    const transaction = this.db.transaction(['cartelas'], 'readonly');
    const store = transaction.objectStore('cartelas');

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Store user data
  async storeUser(userData: any): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const transaction = this.db.transaction(['users'], 'readwrite');
    const store = transaction.objectStore('users');

    await new Promise<void>((resolve, reject) => {
      const request = store.put(userData);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    console.log(`👤 User data stored offline: ${userData.email}`);
  }

  // Get user data
  async getUser(userId: string): Promise<any> {
    if (!this.db) throw new Error('Database not initialized');

    const transaction = this.db.transaction(['users'], 'readonly');
    const store = transaction.objectStore('users');

    return new Promise((resolve, reject) => {
      const request = store.get(userId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Sync queue management
  private addToSyncQueue(id: string, action: 'create' | 'update' | 'delete', type: string, data: any): void {
    const syncItem: SyncQueueItem = {
      id: `${type}_${id}_${Date.now()}`,
      action,
      type,
      data,
      timestamp: Date.now(),
      retryCount: 0
    };

    this.syncQueue.push(syncItem);
    this.saveSyncQueue();
  }

  private loadSyncQueue(): void {
    try {
      const stored = localStorage.getItem(this.SYNC_QUEUE_KEY);
      if (stored) {
        this.syncQueue = JSON.parse(stored);
        console.log(`📤 Loaded ${this.syncQueue.length} items in sync queue`);
      }
    } catch (error) {
      console.error('Failed to load sync queue:', error);
      this.syncQueue = [];
    }
  }

  private saveSyncQueue(): void {
    try {
      localStorage.setItem(this.SYNC_QUEUE_KEY, JSON.stringify(this.syncQueue));
    } catch (error) {
      console.error('Failed to save sync queue:', error);
    }
  }

  // Sync with server when online
  async syncWithServer(): Promise<void> {
    if (this.syncQueue.length === 0) {
      console.log('📤 Sync queue empty, nothing to sync');
      return;
    }

    console.log(`📤 Syncing ${this.syncQueue.length} items with server...`);

    const results = {
      success: 0,
      failed: 0,
      skipped: 0
    };

    // Process sync queue
    for (let i = this.syncQueue.length - 1; i >= 0; i--) {
      const item = this.syncQueue[i];

      try {
        await this.syncItem(item);
        this.syncQueue.splice(i, 1); // Remove from queue
        results.success++;
      } catch (error) {
        console.error(`Failed to sync item ${item.id}:`, error);
        item.retryCount++;
        
        if (item.retryCount >= 3) {
          console.error(`Max retries reached for ${item.id}, removing from queue`);
          this.syncQueue.splice(i, 1);
          results.failed++;
        } else {
          results.skipped++;
        }
      }
    }

    this.saveSyncQueue();
    console.log(`✅ Sync complete: ${results.success} synced, ${results.failed} failed, ${results.skipped} retrying`);
  }

  private async syncItem(item: SyncQueueItem): Promise<void> {
    const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
    const token = localStorage.getItem('auth_token');

    if (!token) {
      throw new Error('No auth token available');
    }

    let url: string;
    let method: string;
    let body: any;

    switch (item.type) {
      case 'game':
        url = `${API_BASE_URL}/games/session`;
        method = item.action === 'create' ? 'POST' : 'PUT';
        body = item.data;
        break;
      
      case 'user':
        url = `${API_BASE_URL}/users/${item.data.id}`;
        method = 'PUT';
        body = item.data;
        break;
      
      case 'settings':
        url = `${API_BASE_URL}/settings`;
        method = 'POST';
        body = item.data;
        break;
      
      default:
        throw new Error(`Unknown sync type: ${item.type}`);
    }

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    console.log(`✅ Synced ${item.type} ${item.action}: ${item.id}`);
  }

  // Get sync queue status
  getSyncQueueStatus(): { count: number; oldestTimestamp: number | null } {
    return {
      count: this.syncQueue.length,
      oldestTimestamp: this.syncQueue.length > 0 
        ? Math.min(...this.syncQueue.map(item => item.timestamp))
        : null
    };
  }

  // Clear all offline data
  async clearOfflineData(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const transaction = this.db.transaction(['data', 'games', 'cartelas', 'users'], 'readwrite');
    
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        const request = transaction.objectStore('data').clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }),
      new Promise<void>((resolve, reject) => {
        const request = transaction.objectStore('games').clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }),
      new Promise<void>((resolve, reject) => {
        const request = transaction.objectStore('cartelas').clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }),
      new Promise<void>((resolve, reject) => {
        const request = transaction.objectStore('users').clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      })
    ]);

    this.syncQueue = [];
    this.saveSyncQueue();

    console.log('🗑️ All offline data cleared');
  }
}

// Singleton instance
export const offlineStorage = new OfflineStorageManager();