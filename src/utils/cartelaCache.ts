// IndexedDB utility for caching cartelas - USER-SPECIFIC
// Optimizes cartela loading by storing only user's assigned cartelas locally

const DB_NAME = 'BingoCartelaCache';
const STORE_NAME = 'cartelas';
const DB_VERSION = 2; // Increment version to clear old cache
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

interface CachedCartela {
  id: string;
  card_id: string;
  user_id: string | null;
  game_id: string | null;
  numbers: any;
  is_winner: boolean;
  winning_pattern: string | null;
  created_at: string;
  cached_at: number;
  cached_for_user: string; // NEW: Track which user this cache is for
}

class CartelaCacheDB {
  private db: IDBDatabase | null = null;
  private currentUserId: string | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('❌ Failed to open Cartela IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ Cartela IndexedDB opened successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Clear old object store if it exists (version upgrade)
        if (db.objectStoreNames.contains(STORE_NAME)) {
          db.deleteObjectStore(STORE_NAME);
          console.log('🗑️ Cleared old cartela cache for user-specific caching');
        }
        
        const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'card_id' });
        objectStore.createIndex('cached_at', 'cached_at', { unique: false });
        objectStore.createIndex('user_id', 'user_id', { unique: false });
        objectStore.createIndex('cached_for_user', 'cached_for_user', { unique: false }); // NEW
        console.log('✅ Cartela IndexedDB object store created with user-specific support');
      };
    });
  }

  /**
   * Set the current user ID for user-specific caching
   */
  setCurrentUser(userId: string): void {
    if (this.currentUserId !== userId) {
      console.log(`👤 Setting cartela cache user: ${userId}`);
      this.currentUserId = userId;
    }
  }

  /**
   * Clear cache when user changes
   */
  async clearCacheForUser(userId?: string): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    const targetUserId = userId || this.currentUserId;
    if (!targetUserId) {
      console.warn('No user ID provided for cache clearing');
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(STORE_NAME);
      const index = objectStore.index('cached_for_user');
      const request = index.openCursor(IDBKeyRange.only(targetUserId));

      let deletedCount = 0;

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          console.log(`🗑️ Cleared ${deletedCount} cartelas from cache for user ${targetUserId}`);
          resolve();
        }
      };

      request.onerror = () => {
        console.error('❌ Error clearing user cartela cache:', request.error);
        reject(request.error);
      };
    });
  }

  async saveCartelas(cartelas: any[]): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    if (!this.currentUserId) {
      console.warn('⚠️ No current user set, skipping cartela cache save');
      return;
    }

    // Clear existing cache for this user first
    await this.clearCacheForUser(this.currentUserId);

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(STORE_NAME);
      const cached_at = Date.now();

      let completed = 0;
      const total = cartelas.length;

      if (total === 0) {
        console.log(`✅ No cartelas to cache for user ${this.currentUserId}`);
        resolve();
        return;
      }

      cartelas.forEach((cartela) => {
        const cachedCartela: CachedCartela = {
          ...cartela,
          cached_at,
          cached_for_user: this.currentUserId! // Mark which user this cache belongs to
        };

        const request = objectStore.put(cachedCartela);
        
        request.onsuccess = () => {
          completed++;
          if (completed === total) {
            console.log(`✅ Saved ${total} cartelas to IndexedDB cache for user ${this.currentUserId}`);
            resolve();
          }
        };

        request.onerror = () => {
          console.error('❌ Error saving cartela to cache:', request.error);
        };
      });

      transaction.onerror = () => {
        reject(transaction.error);
      };
    });
  }

  async getAllCartelas(): Promise<any[]> {
    if (!this.db) {
      await this.init();
    }

    if (!this.currentUserId) {
      console.warn('⚠️ No current user set, returning empty cartela cache');
      return [];
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(STORE_NAME);
      const index = objectStore.index('cached_for_user');
      const request = index.getAll(IDBKeyRange.only(this.currentUserId));

      request.onsuccess = () => {
        const cartelas = request.result as CachedCartela[];
        const now = Date.now();
        
        // Filter out expired cartelas
        const validCartelas = cartelas.filter(
          cartela => (now - cartela.cached_at) < CACHE_DURATION
        );

        console.log(`📦 Retrieved ${validCartelas.length} cartelas from IndexedDB cache for user ${this.currentUserId}`);
        resolve(validCartelas);
      };

      request.onerror = () => {
        console.error('❌ Error retrieving cartelas from cache:', request.error);
        reject(request.error);
      };
    });
  }

  async getCartelaById(cardId: string): Promise<any | null> {
    if (!this.db) {
      await this.init();
    }

    if (!this.currentUserId) {
      return null;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.get(cardId);

      request.onsuccess = () => {
        const cartela = request.result as CachedCartela | undefined;
        
        if (cartela && cartela.cached_for_user === this.currentUserId) {
          const now = Date.now();
          // Check if cache is still valid
          if ((now - cartela.cached_at) < CACHE_DURATION) {
            resolve(cartela);
          } else {
            // Cache expired
            resolve(null);
          }
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        console.error('❌ Error retrieving cartela from cache:', request.error);
        reject(request.error);
      };
    });
  }

  async clearCache(): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.clear();

      request.onsuccess = () => {
        console.log('🗑️ All cartela cache cleared');
        resolve();
      };

      request.onerror = () => {
        console.error('❌ Error clearing cartela cache:', request.error);
        reject(request.error);
      };
    });
  }

  async getCacheStats(): Promise<{ count: number; oldestCache: number; newestCache: number }> {
    if (!this.db) {
      await this.init();
    }

    if (!this.currentUserId) {
      return { count: 0, oldestCache: 0, newestCache: 0 };
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(STORE_NAME);
      const index = objectStore.index('cached_for_user');
      const request = index.getAll(IDBKeyRange.only(this.currentUserId));

      request.onsuccess = () => {
        const cartelas = request.result as CachedCartela[];
        
        if (cartelas.length === 0) {
          resolve({ count: 0, oldestCache: 0, newestCache: 0 });
          return;
        }

        const timestamps = cartelas.map(c => c.cached_at);
        resolve({
          count: cartelas.length,
          oldestCache: Math.min(...timestamps),
          newestCache: Math.max(...timestamps)
        });
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }
}

export const cartelaCacheDB = new CartelaCacheDB();
