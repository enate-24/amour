// IndexedDB utility for caching audio files

const DB_NAME = 'BingoAudioCache';
const DB_VERSION = 1;
const STORE_NAME = 'audioFiles';

interface AudioCacheItem {
  id: string;
  blob: Blob;
  timestamp: number;
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
          console.log('✅ IndexedDB object store created');
        }
      };
    });
  }

  async saveAudio(id: string, blob: Blob): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const item: AudioCacheItem = {
        id,
        blob,
        timestamp: Date.now()
      };

      const request = store.put(item);

      request.onsuccess = () => {
        console.log(`✅ Audio cached: ${id}`);
        resolve();
      };

      request.onerror = () => {
        console.error(`❌ Failed to cache audio: ${id}`, request.error);
        reject(request.error);
      };
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
}

// Create singleton instance
const audioCacheDB = new AudioCacheDB();

// Helper function to download and cache audio
export async function downloadAndCacheAudio(url: string, id: string): Promise<Blob> {
  try {
    // Check if already cached
    const cachedBlob = await audioCacheDB.getAudio(id);
    if (cachedBlob) {
      return cachedBlob;
    }

    // Download audio
    console.log(`📥 Downloading audio: ${id} from ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download audio: ${response.statusText}`);
    }

    const blob = await response.blob();
    
    // Cache it
    await audioCacheDB.saveAudio(id, blob);
    
    return blob;
  } catch (error) {
    console.error(`❌ Error downloading/caching audio ${id}:`, error);
    throw error;
  }
}

// Helper function to get audio URL from cache or download
export async function getAudioUrl(url: string, id: string): Promise<string> {
  try {
    const blob = await downloadAndCacheAudio(url, id);
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error(`❌ Error getting audio URL for ${id}:`, error);
    // Fallback to original URL
    return url;
  }
}

// Helper function to preload multiple audio files
export async function preloadAudioFiles(files: { url: string; id: string }[]): Promise<void> {
  console.log(`📥 Preloading ${files.length} audio files...`);
  
  const promises = files.map(file => 
    downloadAndCacheAudio(file.url, file.id).catch(error => {
      console.error(`Failed to preload ${file.id}:`, error);
    })
  );

  await Promise.all(promises);
  console.log('✅ Audio preloading complete');
}

export { audioCacheDB };
