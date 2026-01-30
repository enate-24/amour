// Simple API client with basic performance tracking
interface ApiResponse<T> {
  data: T;
  loadTime: number;
  fromCache: boolean;
}

class SimpleApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = import.meta.env.VITE_API_URL || '/api';
  }

  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('auth_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  }

  private trackPerformance(loadTime: number, fromCache: boolean = false) {
    try {
      // Update simple performance counters
      const currentRequests = parseInt(sessionStorage.getItem('perf_requests') || '0');
      const currentTotalTime = parseFloat(sessionStorage.getItem('perf_total_time') || '0');
      
      sessionStorage.setItem('perf_requests', (currentRequests + 1).toString());
      sessionStorage.setItem('perf_total_time', (currentTotalTime + loadTime).toString());
      
      if (fromCache) {
        const currentCacheHits = parseInt(sessionStorage.getItem('perf_cache_hits') || '0');
        sessionStorage.setItem('perf_cache_hits', (currentCacheHits + 1).toString());
      }
    } catch (error) {
      console.warn('Failed to track performance:', error);
    }
  }

  async fetchWithCache<T>(
    url: string, 
    cacheKey: string, 
    options: RequestInit = {},
    cacheTTL: number = 5 * 60 * 1000 // 5 minutes
  ): Promise<ApiResponse<T>> {
    const startTime = Date.now();

    // Check cache first
    try {
      const cachedItem = sessionStorage.getItem(`cache_${cacheKey}`);
      if (cachedItem) {
        const parsed = JSON.parse(cachedItem);
        if (Date.now() < parsed.expiry) {
          const loadTime = Date.now() - startTime;
          this.trackPerformance(loadTime, true);
          return {
            data: parsed.data,
            loadTime,
            fromCache: true
          };
        } else {
          // Expired, remove from cache
          sessionStorage.removeItem(`cache_${cacheKey}`);
        }
      }
    } catch (error) {
      console.warn('Cache read error:', error);
    }

    // Fetch from API
    const response = await fetch(`${this.baseUrl}${url}`, {
      ...options,
      headers: {
        ...this.getAuthHeaders(),
        ...options.headers
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const loadTime = Date.now() - startTime;

    // Cache the response
    try {
      sessionStorage.setItem(`cache_${cacheKey}`, JSON.stringify({
        data,
        expiry: Date.now() + cacheTTL
      }));
    } catch (error) {
      console.warn('Cache write error:', error);
    }

    this.trackPerformance(loadTime, false);

    return {
      data,
      loadTime,
      fromCache: false
    };
  }

  // Simple fetch without caching
  async fetch<T>(url: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const startTime = Date.now();

    const response = await fetch(`${this.baseUrl}${url}`, {
      ...options,
      headers: {
        ...this.getAuthHeaders(),
        ...options.headers
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const loadTime = Date.now() - startTime;

    this.trackPerformance(loadTime, false);

    return {
      data,
      loadTime,
      fromCache: false
    };
  }

  // Get user cartelas with caching
  async getUserCartelas(page?: number, limit?: number, all?: boolean) {
    let url = '/cartelas/user-cartelas';
    let cacheKey = 'user_cartelas';
    
    if (all) {
      url += '?all=true';
      cacheKey = 'user_cartelas_all';
    } else if (page && limit) {
      url += `?page=${page}&limit=${limit}`;
      cacheKey = `user_cartelas_${page}_${limit}`;
    } else if (limit) {
      url += `?limit=${limit}`;
      cacheKey = `user_cartelas_limit_${limit}`;
    }
    
    const cacheTime = all ? 5 * 60 * 1000 : 3 * 60 * 1000; // Cache all cartelas for 5 minutes
    
    return this.fetchWithCache(
      url,
      cacheKey,
      { method: 'GET' },
      cacheTime
    );
  }

  // Get cartela details
  async getCartelaDetails(cartelaId: string) {
    const cacheKey = `cartela_${cartelaId}`;
    return this.fetchWithCache(
      `/cartelas/${cartelaId}`,
      cacheKey,
      { method: 'GET' },
      10 * 60 * 1000 // 10 minutes cache
    );
  }

  // Get selected cartelas status
  async getSelectedCartelasStatus() {
    const cacheKey = 'selected_cartelas_status';
    return this.fetchWithCache(
      '/cartelas/status/active-games',
      cacheKey,
      { method: 'GET' },
      30 * 1000 // 30 seconds cache
    );
  }

  // Clear all cache
  clearCache(): void {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && (key.startsWith('cache_') || key.startsWith('perf_'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => sessionStorage.removeItem(key));
      console.log('Cache cleared');
    } catch (error) {
      console.warn('Failed to clear cache:', error);
    }
  }
}

// Create singleton instance
export const simpleApiClient = new SimpleApiClient();

export default simpleApiClient;