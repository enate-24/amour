// Offline-Aware Authentication Hook
// Provides authentication with offline support

import { useState, useEffect } from 'react';
import { networkStatusManager } from '../utils/networkStatus';
import { offlineStorage } from '../utils/offlineStorage';
import { apiClient } from '../utils/offlineApiClient';

interface User {
  id: string;
  email: string;
  username?: string;
  role: string;
  userType: 'prepaid' | 'postpaid';
  balance?: number;
  totalGamesPlayed?: number;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  isOffline: boolean;
}

export function useOfflineAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    loading: true,
    isOffline: false
  });

  useEffect(() => {
    initializeAuth();
    
    // Listen for network changes
    const unsubscribe = networkStatusManager.subscribe((isOnline) => {
      setAuthState(prev => ({ ...prev, isOffline: !isOnline }));
      
      if (isOnline && authState.user) {
        // Refresh user data when back online
        refreshUser();
      }
    });

    return unsubscribe;
  }, []);

  const initializeAuth = async () => {
    try {
      await offlineStorage.initialize();
      
      const token = localStorage.getItem('auth_token');
      if (!token) {
        setAuthState({ user: null, loading: false, isOffline: !networkStatusManager.isOnline });
        return;
      }

      apiClient.setAuthToken(token);

      // Try to get user from server first, fallback to cache
      let user = null;
      
      if (networkStatusManager.isOnline) {
        try {
          const response = await apiClient.get('/auth/me');
          user = response.data;
          
          // Cache user data
          await offlineStorage.storeUser(user);
        } catch (error) {
          console.warn('Failed to fetch user from server, trying cache:', error);
        }
      }

      // Fallback to cached user
      if (!user) {
        const userId = parseTokenUserId(token);
        if (userId) {
          user = await offlineStorage.getUser(userId);
        }
      }

      setAuthState({
        user,
        loading: false,
        isOffline: !networkStatusManager.isOnline
      });

    } catch (error) {
      console.error('Auth initialization failed:', error);
      setAuthState({ user: null, loading: false, isOffline: !networkStatusManager.isOnline });
    }
  };

  const signIn = async (email: string, password: string): Promise<void> => {
    if (!networkStatusManager.isOnline) {
      throw new Error('Cannot sign in while offline');
    }

    try {
      const response = await apiClient.post('/auth/login', { email, password });
      const { token, user } = response.data;

      localStorage.setItem('auth_token', token);
      apiClient.setAuthToken(token);

      // Cache user data
      await offlineStorage.storeUser(user);

      setAuthState({
        user,
        loading: false,
        isOffline: false
      });
    } catch (error) {
      throw error;
    }
  };

  const signOut = async (): Promise<void> => {
    localStorage.removeItem('auth_token');
    
    // Clear offline data
    await offlineStorage.clearOfflineData();

    setAuthState({
      user: null,
      loading: false,
      isOffline: !networkStatusManager.isOnline
    });
  };

  const refreshUser = async (): Promise<void> => {
    if (!authState.user) return;

    try {
      if (networkStatusManager.isOnline) {
        const response = await apiClient.get('/auth/me');
        const updatedUser = response.data;
        
        // Update cache
        await offlineStorage.storeUser(updatedUser);
        
        setAuthState(prev => ({
          ...prev,
          user: updatedUser
        }));
      }
    } catch (error) {
      console.warn('Failed to refresh user data:', error);
    }
  };

  return {
    user: authState.user,
    loading: authState.loading,
    isOffline: authState.isOffline,
    signIn,
    signOut,
    refreshUser
  };
}

// Helper function to parse user ID from JWT token
function parseTokenUserId(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.userId || payload.id || null;
  } catch (error) {
    console.error('Failed to parse token:', error);
    return null;
  }
}