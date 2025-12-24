// IndexedDB utility for caching audio files

const DB_NAME = 'BingoAudioCache';
const DB_VERSION = 2; // Incremented for schema changes
const STORE_NAME = 'audioFiles';
const CACHE_VERSION = '1.0.0'; // Version for cache invalidation

interface AudioCacheItem {
  id: string;
  blob: Blob;
  timestamp: number;
  version: string;
  size: number;
}

interface CacheStatus {
  totalFiles: number;
  cachedFiles: number;
  missingFiles: string[];
  cacheSize: number;
  isComplete: boolean;
  lastUpdated: number;
}

class AudioCacheDB {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ IndexedDB opened successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          objectStore.createIndex('timestamp', 'timestamp', { unique: false });
          objectStore.createIndex('version', 'version', { unique: false });
          console.log('✅ IndexedDB object store created');
        } else {
          // Handle migration for existing stores
          const transaction = (event.target as IDBOpenDBRequest).transaction!;
          const objectStore = transaction.objectStore(STORE_NAME);
          
          // Add new indexes if they don't exist
          if (!objectStore.indexNames.contains('version')) {
            objectStore.createIndex('version', 'version', { unique: false });
          }
        }
      };
    });
  }

  async saveAudio(id: string, blob: Blob, version: string = CACHE_VERSION): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        const item: AudioCacheItem = {
          id,
          blob,
          timestamp: Date.now(),
          version,
          size: blob.size
        };

        const request = store.put(item);

        request.onsuccess = () => {
          console.log(`✅ Audio cached: ${id} (${blob.size} bytes, v${version})`);
          resolve();
        };

        request.onerror = () => {
          // Check for quota exceeded error
          if (request.error?.name === 'QuotaExceededError') {
            console.error(`❌ Storage quota exceeded while caching: ${id}`);
            reject(new Error('Storage quota exceeded. Please clear some cache to continue.'));
          } else {
            console.error(`❌ Failed to cache audio: ${id}`, request.error);
            reject(request.error);
          }
        };

        transaction.onerror = () => {
          if (transaction.error?.name === 'QuotaExceededError') {
            console.error(`❌ Storage quota exceeded while caching: ${id}`);
            reject(new Error('Storage quota exceeded. Please clear some cache to continue.'));
          } else {
            reject(transaction.error);
          }
        };
      } catch (error) {
        console.error(`❌ Error in saveAudio for ${id}:`, error);
        reject(error);
      }
    });
  }

  async getAudio(id: string): Promise<Blob | null> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        const result = request.result as AudioCacheItem | undefined;
        if (result) {
          console.log(`✅ Audio retrieved from cache: ${id}`);
          resolve(result.blob);
        } else {
          console.log(`⚠️ Audio not in cache: ${id}`);
          resolve(null);
        }
      };

      request.onerror = () => {
        console.error(`❌ Failed to retrieve audio: ${id}`, request.error);
        reject(request.error);
      };
    });
  }

  async hasAudio(id: string): Promise<boolean> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(!!request.result);
      };

      request.onerror = () => {
        console.error(`❌ Failed to check audio: ${id}`, request.error);
        reject(request.error);
      };
    });
  }

  async deleteAudio(id: string): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => {
        console.log(`✅ Audio deleted from cache: ${id}`);
        resolve();
      };

      request.onerror = () => {
        console.error(`❌ Failed to delete audio: ${id}`, request.error);
        reject(request.error);
      };
    });
  }

  async clearAll(): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        console.log('✅ All audio cache cleared');
        resolve();
      };

      request.onerror = () => {
        console.error('❌ Failed to clear audio cache', request.error);
        reject(request.error);
      };
    });
  }

  async getAllAudioIds(): Promise<string[]> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAllKeys();

      request.onsuccess = () => {
        resolve(request.result as string[]);
      };

      request.onerror = () => {
        console.error('❌ Failed to get all audio IDs', request.error);
        reject(request.error);
      };
    });
  }

  async getCacheSize(): Promise<number> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const items = request.result as AudioCacheItem[];
        const totalSize = items.reduce((sum, item) => sum + item.blob.size, 0);
        resolve(totalSize);
      };

      request.onerror = () => {
        console.error('❌ Failed to calculate cache size', request.error);
        reject(request.error);
      };
    });
  }

  async validateAudio(id: string): Promise<boolean> {
    if (!this.db) {
      await this.init();
    }

    try {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          const result = request.result as AudioCacheItem | undefined;
          
          if (!result) {
            resolve(false);
            return;
          }

          // Validate blob integrity
          const isValid = 
            result.blob instanceof Blob &&
            result.blob.size > 0 &&
            result.version !== undefined &&
            result.version.trim().length > 0 &&
            result.timestamp !== undefined;

          if (!isValid) {
            console.warn(`⚠️ Invalid cache entry detected: ${id}`);
          }

          resolve(isValid);
        };

        request.onerror = () => {
          console.error(`❌ Failed to validate audio: ${id}`, request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error(`❌ Error validating audio ${id}:`, error);
      return false;
    }
  }

  async getCacheStatus(): Promise<CacheStatus> {
    if (!this.db) {
      await this.init();
    }

    try {
      const allIds = await this.getAllAudioIds();
      const cacheSize = await this.getCacheSize();
      
      // Expected audio files based on actual file structure
      const expectedFiles = [
        // Boy voice files (75 numbers + 4 special sounds)
        ...Array.from({ length: 75 }, (_, i) => `boy_${i + 1}.wav`),
        'boy_start.wav',
        'boy_winner.wav',
        'boy_notwinner.wav',
        'boy_shuffle-audio-TfqyAnvz.mp3',
        
        // Girl voice files (75 numbers + 2 special sounds)
        ...Array.from({ length: 75 }, (_, i) => `girl_${i + 1}.mp3`),
        'girl_winner.mp3',
        'girl_shuffle-audio-TfqyAnvz.mp3'
        // Note: girl voice doesn't have start.wav or notwinner.wav
      ];

      const missingFiles = expectedFiles.filter(file => !allIds.includes(file));
      
      // Get the most recent timestamp
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          const items = request.result as AudioCacheItem[];
          const lastUpdated = items.length > 0 
            ? Math.max(...items.map(item => item.timestamp))
            : 0;

          resolve({
            totalFiles: expectedFiles.length, // Should be 156 total
            cachedFiles: allIds.length,
            missingFiles,
            cacheSize,
            isComplete: missingFiles.length === 0,
            lastUpdated
          });
        };

        request.onerror = () => {
          console.error('❌ Failed to get cache status', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('❌ Error getting cache status:', error);
      throw error;
    }
  }

  async getInvalidEntries(): Promise<string[]> {
    if (!this.db) {
      await this.init();
    }

    try {
      const allIds = await this.getAllAudioIds();
      const invalidIds: string[] = [];

      for (const id of allIds) {
        const isValid = await this.validateAudio(id);
        if (!isValid) {
          invalidIds.push(id);
        }
      }

      if (invalidIds.length > 0) {
        console.warn(`⚠️ Found ${invalidIds.length} invalid cache entries:`, invalidIds);
      }

      return invalidIds;
    } catch (error) {
      console.error('❌ Error getting invalid entries:', error);
      throw error;
    }
  }
}

// Create singleton instance
const audioCacheDB = new AudioCacheDB();

// Helper function to download and cache audio
export async function downloadAndCacheAudio(url: string, id: string): Promise<Blob> {
  try {
    // Check if already cached and valid
    const cachedBlob = await audioCacheDB.getAudio(id);
    if (cachedBlob) {
      const isValid = await audioCacheDB.validateAudio(id);
      if (isValid) {
        return cachedBlob;
      } else {
        console.warn(`⚠️ Invalid cached audio detected for ${id}, re-downloading...`);
        await audioCacheDB.deleteAudio(id);
      }
    }

    // Download audio
    console.log(`📥 Downloading audio: ${id} from ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download audio: ${response.statusText}`);
    }

    const blob = await response.blob();
    
    // Validate blob before caching
    if (blob.size === 0) {
      throw new Error(`Downloaded audio file is empty: ${id}`);
    }
    
    // Cache it with version
    await audioCacheDB.saveAudio(id, blob, CACHE_VERSION);
    
    return blob;
  } catch (error) {
    console.error(`❌ Error downloading/caching audio ${id}:`, error);
    throw error;
  }
}

// Helper function to get audio URL from cache or download
export async function getAudioUrl(url: string, id: string): Promise<string> {
  try {
    // Try CDN first if available
    const cdnUrl = getCDNAudioUrl(url);
    const blob = await downloadAndCacheAudio(cdnUrl, id);
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error(`❌ Error getting audio URL for ${id}:`, error);
    // Fallback to original URL
    return url;
  }
}

// Get CDN URL for audio file with fallback
function getCDNAudioUrl(localUrl: string): string {
  // Extract filename from local URL
  const filename = localUrl.split('/').pop() || '';
  
  // Check if CDN is enabled via environment variable
  const cdnEnabled = import.meta.env.VITE_CDN_ENABLED === 'true';
  const cdnBaseUrl = import.meta.env.VITE_CDN_BASE_URL || '';
  
  if (cdnEnabled && cdnBaseUrl) {
    return `${cdnBaseUrl}/sounds/${filename}`;
  }
  
  // Fallback to local URL
  return localUrl;
}

// Helper function to preload multiple audio files with concurrent download limiting
export async function preloadAudioFiles(
  files: { url: string; id: string }[], 
  maxConcurrent: number = 6
): Promise<void> {
  console.log(`📥 Preloading ${files.length} audio files (max ${maxConcurrent} concurrent)...`);
  
  let completed = 0;
  let failed = 0;
  const queue = [...files];
  const inProgress = new Set<Promise<void>>();

  while (queue.length > 0 || inProgress.size > 0) {
    // Fill up to maxConcurrent downloads
    while (inProgress.size < maxConcurrent && queue.length > 0) {
      const file = queue.shift()!;
      
      const promise = downloadAndCacheAudio(file.url, file.id)
        .then(() => {
          completed++;
          console.log(`✅ Cached ${file.id} (${completed}/${files.length})`);
        })
        .catch(error => {
          failed++;
          console.error(`❌ Failed to preload ${file.id}:`, error);
        })
        .finally(() => {
          inProgress.delete(promise);
        });
      
      inProgress.add(promise);
    }

    // Wait for at least one download to complete
    if (inProgress.size > 0) {
      await Promise.race(inProgress);
    }
  }

  console.log(`✅ Audio preloading complete: ${completed} cached, ${failed} failed`);
}

export { audioCacheDB, CACHE_VERSION };
export type { CacheStatus, AudioCacheItem };
