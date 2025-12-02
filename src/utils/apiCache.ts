// API Response Cache with TTL
// Prevents redundant API calls by caching responses for a short duration

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

class APICache {
  private cache = new Map<string, CacheEntry<any>>();
  private defaultTTL = 5000; // 5 seconds default

  /**
   * Get cached response if available and not expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now > entry.expiresAt) {
      // Expired, remove from cache
      this.cache.delete(key);
      return null;
    }

    console.log(`✅ Cache hit: ${key} (${Math.round((entry.expiresAt - now) / 1000)}s remaining)`);
    return entry.data;
  }

  /**
   * Store response in cache with TTL
   */
  set<T>(key: string, data: T, ttl: number = this.defaultTTL): void {
    const now = Date.now();
    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      expiresAt: now + ttl
    };

    this.cache.set(key, entry);
    console.log(`💾 Cached: ${key} (TTL: ${ttl}ms)`);
  }

  /**
   * Invalidate specific cache entry
   */
  invalidate(key: string): void {
    if (this.cache.delete(key)) {
      console.log(`🗑️ Cache invalidated: ${key}`);
    }
  }

  /**
   * Invalidate all cache entries matching a pattern
   */
  invalidatePattern(pattern: string | RegExp): void {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    let count = 0;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }

    if (count > 0) {
      console.log(`🗑️ Cache invalidated: ${count} entries matching ${pattern}`);
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    console.log(`🗑️ Cache cleared: ${size} entries removed`);
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const now = Date.now();
    let expired = 0;
    let active = 0;

    for (const entry of this.cache.values()) {
      if (now > entry.expiresAt) {
        expired++;
      } else {
        active++;
      }
    }

    return {
      total: this.cache.size,
      active,
      expired
    };
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`🧹 Cache cleanup: ${removed} expired entries removed`);
    }
  }
}

// Singleton instance
const apiCache = new APICache();

// Auto-cleanup every 30 seconds
setInterval(() => apiCache.cleanup(), 30000);

/**
 * Cached fetch wrapper
 * Automatically caches GET requests with configurable TTL
 */
export async function cachedFetch<T = any>(
  url: string,
  options?: RequestInit,
  ttl: number = 5000
): Promise<T> {
  const method = options?.method?.toUpperCase() || 'GET';
  
  // Only cache GET requests
  if (method !== 'GET') {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  }

  // Create cache key from URL and relevant options
  const cacheKey = `${method}:${url}`;

  // Check cache first
  const cached = apiCache.get<T>(cacheKey);
  if (cached !== null) {
    return cached;
  }

  // Fetch from network
  console.log(`📡 Fetching: ${url}`);
  const response = await fetch(url, options);
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  
  // Cache the response
  apiCache.set(cacheKey, data, ttl);
  
  return data;
}

/**
 * Invalidate cache for specific URL or pattern
 */
export function invalidateCache(urlOrPattern: string | RegExp): void {
  if (typeof urlOrPattern === 'string' && !urlOrPattern.includes('*')) {
    apiCache.invalidate(`GET:${urlOrPattern}`);
  } else {
    apiCache.invalidatePattern(urlOrPattern);
  }
}

/**
 * Clear all API cache
 */
export function clearApiCache(): void {
  apiCache.clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return apiCache.getStats();
}

export { apiCache };
