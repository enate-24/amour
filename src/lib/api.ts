import { cachedFetch, invalidateCache } from '../utils/apiCache';
import { offlineAwareFetch, offlineQueue } from '../utils/offlineQueue';
import { networkStatusManager } from '../utils/networkStatus';

// API configuration - Use Vite proxy for all API calls
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Enhanced fetch wrapper with auth token, caching, and offline support
// NOTE: Does NOT automatically logout on 401 - let components handle auth errors
const fetchWithAuth = async (url: string, options: RequestInit = {}, cacheTTL?: number) => {
  const token = localStorage.getItem('auth_token');
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...options.headers,
  };

  const fetchOptions = {
    ...options,
    headers,
  };

  const method = options.method?.toUpperCase() || 'GET';

  // Use cached fetch for GET requests with TTL
  if (method === 'GET' && cacheTTL !== undefined) {
    try {
      return {
        ok: true,
        status: 200,
        json: async () => await cachedFetch(url, fetchOptions, cacheTTL)
      } as Response;
    } catch (error) {
      // If cached fetch fails and we're offline, throw offline error
      if (networkStatusManager.isOffline) {
        throw new Error('Network offline - no cached data available');
      }
      // Otherwise fall through to regular fetch
      console.warn('Cached fetch failed, falling back to regular fetch:', error);
    }
  }

  // Use offline-aware fetch for mutations
  if (method !== 'GET') {
    try {
      const response = await offlineAwareFetch(url, fetchOptions);
      
      // Log 401 errors but don't automatically logout
      if (response.status === 401) {
        console.warn('⚠️ 401 Unauthorized - Token may be expired. Component should handle this.');
      }

      // Invalidate cache on successful mutations
      if (response.ok) {
        const urlPattern = url.split('?')[0];
        invalidateCache(new RegExp(urlPattern.replace(/\/[^/]+$/, '')));
      }

      return response;
    } catch (error) {
      // Request was queued or failed
      console.warn('Request failed or queued:', error);
      throw error;
    }
  }

  // Regular fetch for GET requests without cache
  const response = await fetch(url, fetchOptions);

  if (response.status === 401) {
    console.warn('⚠️ 401 Unauthorized - Token may be expired. Component should handle this.');
  }

  return response;
};

export interface Cartela {
  id: string;
  card_id: string;
  user_id: string | null;
  game_id?: string | null;
  numbers: {
    B: number[];
    I: number[];
    N: number[];
    G: number[];
    O: number[];
  };
  is_winner: boolean;
  winning_pattern?: string | null;
  created_at: string;
}

export interface ApiResponse<T> {
  data: T | null;
  error: Error | null;
}

// Export the fetch wrapper, cache utilities, and offline support for use in other components
export { fetchWithAuth, API_BASE_URL, invalidateCache, offlineQueue, networkStatusManager };

export const cartelaAPI = {
  // Get cartelas for a specific user (cached for 5 seconds)
  async getUserCartelas(userId: string): Promise<ApiResponse<Cartela[]>> {
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/cartelas/user/${userId}`, {}, 5000);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return { data: result.cartelas || [], error: null };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Unknown error occurred')
      };
    }
  },

  // Get all cartelas (admin function, cached for 5 seconds)
  async getAllCartelas(): Promise<ApiResponse<Cartela[]>> {
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/cartelas/all`, {}, 5000);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return { data: result.cartelas || [], error: null };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Unknown error occurred')
      };
    }
  },

  // Get all cartelas (public endpoint - no authentication required, cached for 5 seconds)
  async getAllCartelasPublic(): Promise<ApiResponse<Cartela[]>> {
    try {
      const response = await cachedFetch(`${API_BASE_URL}/cartelas`, {
        headers: {
          'Content-Type': 'application/json'
        }
      }, 5000);

      return { data: response.cartelas || [], error: null };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Unknown error occurred')
      };
    }
  },

  // Create a new cartela
  async createCartela(cartelaData: {
    card_id: string;
    user_id: string;
    numbers: {
      B: number[];
      I: number[];
      N: number[];
      G: number[];
      O: number[];
    };
  }): Promise<ApiResponse<Cartela>> {
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/cartelas`, {
        method: 'POST',
        body: JSON.stringify(cartelaData)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return { data: result.cartela, error: null };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Unknown error occurred')
      };
    }
  },

  // Update a cartela
  async updateCartela(
    id: string,
    updates: Partial<{
      user_id: string | null;
      game_id: string | null;
      is_winner: boolean;
      pattern: string;
    }>
  ): Promise<ApiResponse<Cartela>> {
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/cartelas/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return { data: result.cartela, error: null };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Unknown error occurred')
      };
    }
  },

  // Delete a cartela
  async deleteCartela(id: string): Promise<ApiResponse<null>> {
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/cartelas/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return { data: null, error: null };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Unknown error occurred')
      };
    }
  }
};
