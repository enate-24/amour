// IndexedDB utility for caching cartelas
// Optimizes cartela loading by storing them locally

const DB_NAME = 'BingoCartelaCache';
const STORE_NAME = 'cartelas';
const DB_VERSION = 1;
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
}

class CartelaCacheDB {
  private db: IDBDatabase | null = null;

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
        
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'card_id' });
          objectStore.createIndex('cached_at', 'cached_at', { unique: false });
          objectStore.createIndex('user_id', 'user_id', { unique: false });
          console.log('✅ Cartela IndexedDB object store created');
        }
      };
    });
  }

  async saveCartelas(cartelas: any[]): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(STORE_NAME);
      const cached_at = Date.now();

      let completed = 0;
      const total = cartelas.length;

      cartelas.forEach((cartela) => {
        const cachedCartela: CachedCartela = {
          ...cartela,
          cached_at
        };

        const request = objectStore.put(cachedCartela);
        
        request.onsuccess = () => {
          completed++;
          if (completed === total) {
            console.log(`✅ Saved ${total} cartelas to IndexedDB cache`);
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

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.getAll();

      request.onsuccess = () => {
        const cartelas = request.result as CachedCartela[];
        const now = Date.now();
        
        // Filter out expired cartelas
        const validCartelas = cartelas.filter(
          cartela => (now - cartela.cached_at) < CACHE_DURATION
        );

        console.log(`📦 Retrieved ${validCartelas.length} cartelas from IndexedDB cache`);
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

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.get(cardId);

      request.onsuccess = () => {
        const cartela = request.result as CachedCartela | undefined;
        
        if (cartela) {
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
        console.log('🗑️ Cartela cache cleared');
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

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.getAll();

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
