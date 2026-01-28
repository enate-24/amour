// Performance cache utility for cartela data
interface CacheItem<T> {
  data: T;
  timestamp: number;
  expiry: number;
}

class PerformanceCache {
  private cache = new Map<string, CacheItem<any>>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes default TTL

  set<T>(key: string, data: T, ttl?: number): void {
    const expiry = Date.now() + (ttl || this.defaultTTL);
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiry
    });

    // Also store in sessionStorage for persistence across page reloads
    try {
      sessionStorage.setItem(`cache_${key}`, JSON.stringify({
        data,
        timestamp: Date.now(),
        expiry
      }));
    } catch (error) {
      console.warn('Failed to store in sessionStorage:', error);
    }
  }

  get<T>(key: string): T | null {
    // Check memory cache first
    const memoryItem = this.cache.get(key);
    if (memoryItem && Date.now() < memoryItem.expiry) {
      return memoryItem.data;
    }

    // Check sessionStorage cache
    try {
      const sessionItem = sessionStorage.getItem(`cache_${key}`);
      if (sessionItem) {
        const parsed: CacheItem<T> = JSON.parse(sessionItem);
        if (Date.now() < parsed.expiry) {
          // Restore to memory cache
          this.cache.set(key, parsed);
          return parsed.data;
        } else {
          // Expired, remove from sessionStorage
          sessionStorage.removeItem(`cache_${key}`);
        }
      }
    } catch (error) {
      console.warn('Failed to read from sessionStorage:', error);
    }

    // Clean up expired memory cache
    if (memoryItem) {
      this.cache.delete(key);
    }

    return null;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): void {
    this.cache.delete(key);
    try {
      sessionStorage.removeItem(`cache_${key}`);
    } catch (error) {
      console.warn('Failed to remove from sessionStorage:', error);
    }
  }

  clear(): void {
    this.cache.clear();
    
    // Clear all cache items from sessionStorage
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith('cache_')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => sessionStorage.removeItem(key));
    } catch (error) {
      console.warn('Failed to clear sessionStorage cache:', error);
    }
  }

  // Get cache statistics
  getStats() {
    const memorySize = this.cache.size;
    let sessionSize = 0;
    
    try {
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith('cache_')) {
          sessionSize++;
        }
      }
    } catch (error) {
      console.warn('Failed to get sessionStorage stats:', error);
    }

    return {
      memoryItems: memorySize,
      sessionItems: sessionSize,
      totalItems: memorySize + sessionSize
    };
  }

  // Clean up expired items
  cleanup(): void {
    const now = Date.now();
    
    // Clean memory cache
    for (const [key, item] of this.cache.entries()) {
      if (now >= item.expiry) {
        this.cache.delete(key);
      }
    }

    // Clean sessionStorage cache
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith('cache_')) {
          const item = sessionStorage.getItem(key);
          if (item) {
            const parsed = JSON.parse(item);
            if (now >= parsed.expiry) {
              keysToRemove.push(key);
            }
          }
        }
      }
      keysToRemove.forEach(key => sessionStorage.removeItem(key));
    } catch (error) {
      console.warn('Failed to cleanup sessionStorage:', error);
    }
  }
}

// Create singleton instance
export const performanceCache = new PerformanceCache();

// Auto cleanup every 5 minutes - only in browser environment
if (typeof window !== 'undefined') {
  setInterval(() => {
    performanceCache.cleanup();
  }, 5 * 60 * 1000);
}

// Cache key generators for common patterns
export const CacheKeys = {
  userCartelas: (userId: string, page: number, limit: number) => 
    `user_cartelas_${userId}_${page}_${limit}`,
  
  allCartelas: (page: number, limit: number, includeNumbers: boolean) => 
    `all_cartelas_${page}_${limit}_${includeNumbers}`,
  
  cartelaDetails: (cartelaId: string) => 
    `cartela_details_${cartelaId}`,
  
  selectedCartelas: () => 
    'selected_cartelas_status',
  
  gameStatus: (gameId: string) => 
    `game_status_${gameId}`
};

export default performanceCache;