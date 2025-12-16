// Offline-Aware Cartela Hook
// Provides cartela data with offline support

import { useState, useEffect } from 'react';
import { networkStatusManager } from '../utils/networkStatus';
import { offlineStorage } from '../utils/offlineStorage';
import { apiClient } from '../utils/offlineApiClient';

interface Cartela {
  card_id: string;
  numbers: number[][];
  is_active: boolean;
}

export function useOfflineCartela() {
  const [cartelas, setCartelas] = useState<Cartela[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);

  useEffect(() => {
    loadCartelas();
  }, []);

  const loadCartelas = async () => {
    try {
      setLoading(true);
      setError(null);

      let cartelaData: Cartela[] = [];
      let isFromCache = false;

      // Try online first
      if (networkStatusManager.isOnline) {
        try {
          const response = await apiClient.get<Cartela[]>('/cartelas');
          cartelaData = response.data;
          isFromCache = response.fromCache;

          // Cache the data if it's fresh from server
          if (!response.fromCache) {
            await offlineStorage.storeCartelas(cartelaData);
          }
        } catch (error) {
          console.warn('Failed to fetch cartelas from server, trying cache:', error);
        }
      }

      // Fallback to offline storage
      if (cartelaData.length === 0) {
        cartelaData = await offlineStorage.getCartelas();
        isFromCache = true;
      }

      setCartelas(cartelaData);
      setFromCache(isFromCache);
      setLoading(false);

      console.log(`📋 Loaded ${cartelaData.length} cartelas (${isFromCache ? 'cached' : 'fresh'})`);
    } catch (error) {
      console.error('Failed to load cartelas:', error);
      setError(error instanceof Error ? error.message : 'Failed to load cartelas');
      setLoading(false);
    }
  };

  const refreshCartelas = async () => {
    if (networkStatusManager.isOnline) {
      await loadCartelas();
    }
  };

  return {
    cartelas,
    loading,
    error,
    fromCache,
    refreshCartelas
  };
}