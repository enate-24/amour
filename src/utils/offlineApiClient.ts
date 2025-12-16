// Offline-Aware API Client
// Provides seamless online/offline API access with automatic fallback

import { networkStatusManager } from './networkStatus';
import { offlineStorage } from './offlineStorage';
import { offlineQueue } from './offlineQueue';

interface ApiResponse<T = any> {
  data: T;
  fromCache: boolean;
  timestamp: number;
}

class OfflineApiClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string> = {};

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || import.meta.env.VITE_API_URL || '/api';
  }

  setAuthToken(token: string): void {
    this.defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  // Enhanced GET with offline fallback
  async get<T = any>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const cacheKey = this.getCacheKey('GET', endpoint);

    try {
      if (networkStatusManager.isOnline) {
        // Try online first
        const response = await fetch(url, {
          ...options,
          method: 'GET',
          headers: { ...this.defaultHeaders, ...options.headers }
        });

        if (response.ok) {
          const data = await response.json();
          
          // Cache successful response
          await offlineStorage.store('api_cache', cacheKey, {
            data,
            timestamp: Date.now(),
            endpoint
          });

          return { data, fromCache: false, timestamp: Date.now() };
        }
      }
    } catch (error) {
      console.warn(`API request failed, trying cache: ${endpoint}`, error);
    }

    // Fallback to cache
    const cached = await offlineStorage.retrieve('api_cache', cacheKey);
    if (cached) {
      console.log(`📱 Using cached data for: ${endpoint}`);
      return { 
        data: cached.data, 
        fromCache: true, 
        timestamp: cached.timestamp 
      };
    }

    throw new Error(`No data available for ${endpoint} (offline and not cached)`);
  }  // Enha
nced POST with offline queueing
  async post<T = any>(endpoint: string, data: any, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;

    if (networkStatusManager.isOffline) {
      // Queue for later sync
      const queueId = offlineQueue.add(url, {
        ...options,
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...this.defaultHeaders, 
          ...options.headers 
        },
        body: JSON.stringify(data)
      });

      // Store locally for immediate use
      const localId = `offline_${Date.now()}`;
      await offlineStorage.store('pending_posts', localId, {
        endpoint,
        data,
        queueId,
        timestamp: Date.now()
      });

      return { 
        data: { ...data, id: localId, offline: true }, 
        fromCache: false, 
        timestamp: Date.now() 
      };
    }

    try {
      const response = await fetch(url, {
        ...options,
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...this.defaultHeaders, 
          ...options.headers 
        },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        const result = await response.json();
        return { data: result, fromCache: false, timestamp: Date.now() };
      }

      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      // Network error - queue for later
      offlineQueue.add(url, {
        ...options,
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...this.defaultHeaders, 
          ...options.headers 
        },
        body: JSON.stringify(data)
      });

      throw error;
    }
  }

  // Enhanced PUT with offline queueing
  async put<T = any>(endpoint: string, data: any, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;

    if (networkStatusManager.isOffline) {
      offlineQueue.add(url, {
        ...options,
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          ...this.defaultHeaders, 
          ...options.headers 
        },
        body: JSON.stringify(data)
      });

      throw new Error('Offline - request queued for sync');
    }

    const response = await fetch(url, {
      ...options,
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        ...this.defaultHeaders, 
        ...options.headers 
      },
      body: JSON.stringify(data)
    });

    if (response.ok) {
      const result = await response.json();
      return { data: result, fromCache: false, timestamp: Date.now() };
    }

    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  private getCacheKey(method: string, endpoint: string): string {
    return `${method}_${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}`;
  }
}

export const apiClient = new OfflineApiClient();