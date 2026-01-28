import { performanceCache, CacheKeys } from './performanceCache';

interface ApiResponse<T> {
  data: T;
  fromCache: boolean;
  loadTime: number;
}

interface CartelasResponse {
  cartelas: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
  userId?: string;
  loadTime?: number;
}

class OptimizedApiClient {
  private baseUrl: string;
  private defaultHeaders: HeadersInit;

  constructor() {
    this.baseUrl = import.meta.env.VITE_API_URL || '/api';
    this.defaultHeaders = {
      'Content-Type': 'application/json'
    };
  }

  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('auth_token');
    return {
      ...this.defaultHeaders,
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  }

  private async fetchWithCache<T>(
    url: string, 
    cacheKey: string, 
    options: RequestInit = {},
    cacheTTL: number = 5 * 60 * 1000 // 5 minutes default
  ): Promise<ApiResponse<T>> {
    const startTime = Date.now();

    // Check cache first
    const cachedData = performanceCache.get<T>(cacheKey);
    if (cachedData) {
      return {
        data: cachedData,
        fromCache: true,
        loadTime: Date.now() - startTime
      };
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
    performanceCache.set(cacheKey, data, cacheTTL);

    return {
      data,
      fromCache: false,
      loadTime
    };
  }

  // Optimized method to fetch user cartelas with caching
  async getUserCartelas(
    page: number = 1, 
    limit: number = 50,
    useCache: boolean = true
  ): Promise<ApiResponse<CartelasResponse>> {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      throw new Error('No authentication token found');
    }

    // Extract user ID from token for cache key (simplified)
    const userId = 'current_user'; // In real app, decode JWT to get user ID
    const cacheKey = CacheKeys.userCartelas(userId, page, limit);

    if (!useCache) {
      performanceCache.delete(cacheKey);
    }

    return this.fetchWithCache<CartelasResponse>(
      `/cartelas/user-cartelas?page=${page}&limit=${limit}`,
      cacheKey,
      { method: 'GET' },
      3 * 60 * 1000 // 3 minutes cache for user cartelas
    );
  }

  // Optimized method to fetch all cartelas with caching
  async getAllCartelas(
    page: number = 1,
    limit: number = 100,
    includeNumbers: boolean = false,
    useCache: boolean = true
  ): Promise<ApiResponse<CartelasResponse>> {
    const cacheKey = CacheKeys.allCartelas(page, limit, includeNumbers);

    if (!useCache) {
      performanceCache.delete(cacheKey);
    }

    return this.fetchWithCache<CartelasResponse>(
      `/cartelas/all-cartelas?page=${page}&limit=${limit}&includeNumbers=${includeNumbers}`,
      cacheKey,
      { method: 'GET' },
      5 * 60 * 1000 // 5 minutes cache for all cartelas
    );
  }

  // Get cartela details with caching
  async getCartelaDetails(cartelaId: string, useCache: boolean = true): Promise<ApiResponse<any>> {
    const cacheKey = CacheKeys.cartelaDetails(cartelaId);

    if (!useCache) {
      performanceCache.delete(cacheKey);
    }

    return this.fetchWithCache(
      `/cartelas/${cartelaId}?includeNumbers=true`,
      cacheKey,
      { method: 'GET' },
      10 * 60 * 1000 // 10 minutes cache for cartela details
    );
  }

  // Get selected cartelas status with short cache
  async getSelectedCartelasStatus(useCache: boolean = true): Promise<ApiResponse<any>> {
    const cacheKey = CacheKeys.selectedCartelas();

    if (!useCache) {
      performanceCache.delete(cacheKey);
    }

    return this.fetchWithCache(
      '/cartelas/status/active-games',
      cacheKey,
      { method: 'GET' },
      30 * 1000 // 30 seconds cache for active game status
    );
  }

  // Clear all cache
  clearCache(): void {
    performanceCache.clear();
  }

  // Get cache statistics
  getCacheStats() {
    return performanceCache.getStats();
  }

  // Preload data for better UX
  async preloadUserCartelas(userId: string, pages: number[] = [1, 2]): Promise<void> {
    const promises = pages.map(page => 
      this.getUserCartelas(page, 50, true).catch(error => {
        console.warn(`Failed to preload page ${page}:`, error);
      })
    );

    await Promise.allSettled(promises);
    console.log(`✅ Preloaded ${pages.length} pages of user cartelas`);
  }

  // Batch invalidate cache for related data
  invalidateCartelaCache(cartelaId?: string): void {
    if (cartelaId) {
      performanceCache.delete(CacheKeys.cartelaDetails(cartelaId));
    }
    
    // Invalidate selected cartelas status
    performanceCache.delete(CacheKeys.selectedCartelas());
    
    // Invalidate user cartelas pages (simplified - in real app, be more specific)
    performanceCache.clear();
  }
}

// Create singleton instance
export const optimizedApiClient = new OptimizedApiClient();

export default optimizedApiClient;