import { useState, useEffect } from 'react';
import { cartelaAPI, Cartela } from '../lib/api';

export interface UseCartelaReturn {
  cartelas: Cartela[];
  loading: boolean;
  error: string | null;
  createCartela: (userId?: string) => Promise<Cartela | null>;
  getCartelaById: (cardId: string) => Cartela | null;
  getUserCartelas: (userId: string) => Promise<Cartela[]>;
  refreshCartelas: () => Promise<void>;
}

export function useCartela(): UseCartelaReturn {
  const [cartelas, setCartelas] = useState<Cartela[]>([]);
  const [loading, setLoading] = useState(false);
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

  // Refresh cartelas from database
  const refreshCartelas = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      // Performance timing
      const startTime = performance.now();

      // Use the /all-cartelas endpoint to get cartelas with proper bingo card data
      const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
      const response = await fetch(`${API_BASE_URL}/cartelas/all-cartelas`);

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

      // Log performance
      const endTime = performance.now();
      const loadTime = (endTime - startTime).toFixed(2);
      console.log(`✅ Loaded ${formattedCartelas.length} cartelas in ${loadTime}ms`);

    } catch (err) {
      console.error('Error refreshing cartelas:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh cartelas');
    } finally {
      setLoading(false);
    }
  };

  // Load cartelas on mount
  useEffect(() => {
    refreshCartelas();
  }, []);

  return {
    cartelas,
    loading,
    error,
    createCartela,
    getCartelaById,
    getUserCartelas,
    refreshCartelas
  };
}
