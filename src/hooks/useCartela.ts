import { useState, useEffect } from 'react';
import { cartelaAPI, Cartela } from '../lib/api';
import { cartelaCacheDB } from '../utils/cartelaCache';

export interface UseCartelaReturn {
  cartelas: Cartela[];
  loading: boolean;
  error: string | null;
  createCartela: (userId?: string) => Promise<Cartela | null>;
  getCartelaById: (cardId: string) => Cartela | null;
  getUserCartelas: (userId: string) => Promise<Cartela[]>;
  refreshCartelas: () => Promise<void>;
  clearCache: () => Promise<void>;
}

export function useCartela(): UseCartelaReturn {
  const [cartelas, setCartelas] = useState<Cartela[]>([]);
  const [loading, setLoading] = useState(true); // Start with true, will be set to false quickly if cache exists
  const [error, setError] = useState<string | null>(null);

  // Generate a single cartela with unique numbers
  const generateCartela = (): Cartela => {
    const cardId = `CART_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const numbers: Cartela['numbers'] = {
      B: [],
      I: [],
      N: [],
      G: [],
      O: []
    };

    // Generate numbers for each column
    for (let col = 0; col < 5; col++) {
      const column = ['B', 'I', 'N', 'G', 'O'][col];
      const min = col * 15 + 1;
      const max = col * 15 + 15;
      const columnNumbers: number[] = [];

      // Generate 5 unique numbers for this column
      while (columnNumbers.length < 5) {
        const num = Math.floor(Math.random() * (max - min + 1)) + min;
        if (!columnNumbers.includes(num)) {
          columnNumbers.push(num);
        }
      }

      numbers[column as keyof Cartela['numbers']] = columnNumbers.sort((a, b) => a - b);
    }

    return {
      id: '', // Will be set by database
      card_id: cardId,
      user_id: null,
      game_id: null,
      numbers,
      is_winner: false,
      winning_pattern: null,
      created_at: new Date().toISOString()
    };
  };

  // Create a new cartela
  const createCartela = async (userId?: string): Promise<Cartela | null> => {
    try {
      setLoading(true);
      setError(null);

      const newCartela = generateCartela();

      // If user is logged in, save to database
      if (userId) {
        const { data, error: apiError } = await cartelaAPI.createCartela({
          card_id: newCartela.card_id,
          user_id: userId,
          numbers: newCartela.numbers
        });

        if (apiError) {
          console.error('Error saving cartela to database:', apiError);
          setError('Failed to save cartela to database');
          return null;
        }

        if (data) {
          setCartelas(prev => [...prev, data]);
          return data;
        }
      }

      // Update local state
      setCartelas(prev => [...prev, newCartela]);
      return newCartela;

    } catch (err) {
      console.error('Error creating cartela:', err);
      setError(err instanceof Error ? err.message : 'Failed to create cartela');
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Get cartela by ID
  const getCartelaById = (cardId: string): Cartela | null => {
    return cartelas.find(cartela => cartela.card_id === cardId) || null;
  };

  // Get cartelas for a specific user
  const getUserCartelas = async (userId: string): Promise<Cartela[]> => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: apiError } = await cartelaAPI.getUserCartelas(userId);

      if (apiError) {
        console.error('Error fetching user cartelas:', apiError);
        setError('Failed to fetch cartelas');
        return [];
      }

      const formattedCartelas: Cartela[] = (data || []).map((item: any) => ({
        id: item.id,
        card_id: item.card_id,
        user_id: item.user_id,
        game_id: item.game_id,
        numbers: item.numbers,
        is_winner: item.is_winner,
        winning_pattern: item.winning_pattern,
        created_at: item.created_at
      }));

      setCartelas(formattedCartelas);
      return formattedCartelas;

    } catch (err) {
      console.error('Error in getUserCartelas:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch cartelas');
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Refresh cartelas from database with IndexedDB caching
  const refreshCartelas = async (): Promise<void> => {
    // Performance timing
    const startTime = performance.now();

    // Set current user for cache before loading
    try {
      const token = localStorage.getItem('auth_token');
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const userId = payload.id || payload.userId || payload.sub;
        if (userId) {
          cartelaCacheDB.setCurrentUser(userId);
        }
      }
    } catch (error) {
      console.warn('Could not set cache user:', error);
    }

    // Try to load from IndexedDB cache first (synchronously set loading)
    try {
      const cachedCartelas = await cartelaCacheDB.getAllCartelas();
      
      if (cachedCartelas.length > 0) {
        const formattedCached: Cartela[] = cachedCartelas.map((item: any) => ({
          id: item.id,
          card_id: item.card_id,
          user_id: item.user_id,
          game_id: item.game_id,
          numbers: item.numbers,
          is_winner: item.is_winner || false,
          winning_pattern: item.winning_pattern,
          created_at: item.created_at
        }));

        setCartelas(formattedCached);
        setLoading(false);
        
        const cacheTime = (performance.now() - startTime).toFixed(2);
        console.log(`⚡ Loaded ${formattedCached.length} cartelas from IndexedDB cache in ${cacheTime}ms`);
        
        // Also save to localStorage for even faster next load
        try {
          localStorage.setItem('cartelas_quick_cache', JSON.stringify(formattedCached));
          localStorage.setItem('cartelas_cache_timestamp', Date.now().toString());
        } catch (e) {
          console.warn('⚠️ Failed to save to localStorage:', e);
        }
        
        // Load from API in background to update cache
        fetchAndCacheCartelas(false);
        return;
      }
    } catch (cacheError) {
      console.warn('⚠️ IndexedDB cache read failed, loading from API:', cacheError);
    }

    // If no cache, load from API with loading state
    try {
      setLoading(true);
      setError(null);
      await fetchAndCacheCartelas(true);
    } catch (err) {
      console.error('Error refreshing cartelas:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh cartelas');
      setLoading(false);
    }
  };

  // Helper function to fetch from API and update cache
  const fetchAndCacheCartelas = async (updateLoading: boolean): Promise<void> => {
    try {
      const fetchStartTime = performance.now();

      // Use the /user-cartelas endpoint to get only user's assigned cartelas
      const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
      const token = localStorage.getItem('auth_token');
      
      if (!token) {
        throw new Error('No authentication token found');
      }

      // Get user ID from token to set cache user
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const userId = payload.id || payload.userId || payload.sub;
        if (userId) {
          cartelaCacheDB.setCurrentUser(userId);
          console.log(`👤 Set cartela cache user: ${userId}`);
        }
      } catch (tokenError) {
        console.warn('Could not extract user ID from token:', tokenError);
      }

      const response = await fetch(`${API_BASE_URL}/cartelas/user-cartelas?limit=1000`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      const formattedCartelas: Cartela[] = (result.cartelas || []).map((item: any) => ({
        id: item.id,
        card_id: item.card_id,
        user_id: item.user_id,
        game_id: item.game_id,
        numbers: item.numbers,
        is_winner: item.isWinner || false,
        winning_pattern: item.pattern,
        created_at: item.createdAt || item.purchased_at
      }));

      setCartelas(formattedCartelas);

      // Save to localStorage for instant access on next load
      try {
        localStorage.setItem('cartelas_quick_cache', JSON.stringify(formattedCartelas));
        localStorage.setItem('cartelas_cache_timestamp', Date.now().toString());
        console.log(`💾 Saved ${formattedCartelas.length} cartelas to localStorage for instant access`);
      } catch (e) {
        console.warn('⚠️ Failed to save to localStorage (quota exceeded?):', e);
      }

      // Save to IndexedDB cache in background
      cartelaCacheDB.saveCartelas(formattedCartelas).catch(err => {
        console.warn('⚠️ Failed to save cartelas to IndexedDB cache:', err);
      });

      // Log performance
      const fetchTime = (performance.now() - fetchStartTime).toFixed(2);
      console.log(`✅ Loaded ${formattedCartelas.length} cartelas from API in ${fetchTime}ms`);

    } finally {
      if (updateLoading) {
        setLoading(false);
      }
    }
  };

  // Clear cache function
  const clearCache = async (): Promise<void> => {
    try {
      await cartelaCacheDB.clearCache();
      console.log('🗑️ Cartela cache cleared successfully');
    } catch (err) {
      console.error('❌ Error clearing cache:', err);
    }
  };

  // Load cartelas on mount with instant cache check
  useEffect(() => {
    // Try to load from localStorage first for instant display
    const cachedCartelasStr = localStorage.getItem('cartelas_quick_cache');
    const cacheTimestamp = localStorage.getItem('cartelas_cache_timestamp');
    
    if (cachedCartelasStr && cacheTimestamp) {
      const cacheAge = Date.now() - parseInt(cacheTimestamp);
      const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
      
      if (cacheAge < CACHE_DURATION) {
        try {
          const cachedData = JSON.parse(cachedCartelasStr);
          setCartelas(cachedData);
          setLoading(false);
          console.log(`⚡⚡ INSTANT load from localStorage: ${cachedData.length} cartelas`);
          
          // Still refresh from IndexedDB/API in background
          refreshCartelas();
          return;
        } catch (e) {
          console.warn('Failed to parse localStorage cache:', e);
        }
      }
    }
    
    // No localStorage cache, proceed with normal flow
    refreshCartelas();
  }, []);

  return {
    cartelas,
    loading,
    error,
    createCartela,
    getCartelaById,
    getUserCartelas,
    refreshCartelas,
    clearCache
  };
}
