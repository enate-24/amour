import { useState, useEffect } from 'react';
import { User } from '../types/auth';
import { offlineAuthManager } from '../utils/offlineAuthManager';
import { networkStatusManager } from '../utils/networkStatus';

// Use Vite proxy for API calls - always use relative URLs
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Helper function to clear game data from localStorage
const clearGameData = () => {
  const gameKeys = [
    'currentGame',
    'selectedCards',
    'rememberSelection',
    'gameData',
    'cartelaData'
  ];

  gameKeys.forEach(key => {
    localStorage.removeItem(key);
  });

  console.log('Cleared game data from localStorage');
};

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Helper function to validate JWT token format
  const isValidJWT = (token: string | null): boolean => {
    if (!token || typeof token !== 'string') return false;

    // Basic JWT format validation (header.payload.signature)
    const parts = token.split('.');
    return parts.length === 3 && parts.every(part => part.length > 0);
  };

  // Helper function to decode JWT and check expiration
  const getTokenExpiration = (token: string): number | null => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp ? payload.exp * 1000 : null; // Convert to milliseconds
    } catch {
      return null;
    }
  };

  // Function to refresh token
  const refreshToken = async (): Promise<boolean> => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token || !isValidJWT(token)) return false;

      const response = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.token) {
          localStorage.setItem('auth_token', data.token);
          console.log('✅ Token refreshed successfully');
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return false;
    }
  };

  // Set up automatic token refresh - refresh 1 day before expiration
  // TEMPORARILY DISABLED: Backend refresh-token endpoint not deployed yet
  // useEffect(() => {
  //   const setupTokenRefresh = () => {
  //     const token = localStorage.getItem('auth_token');
  //     if (!token || !isValidJWT(token)) return;

  //     const expiration = getTokenExpiration(token);
  //     if (!expiration) return;

  //     const now = Date.now();
  //     const timeUntilExpiration = expiration - now;
  //     const refreshTime = timeUntilExpiration - (24 * 60 * 60 * 1000); // Refresh 1 day before expiration

  //     if (refreshTime > 0) {
  //       console.log(`⏰ Token will be refreshed in ${Math.round(refreshTime / 1000 / 60 / 60)} hours`);
  //       const timeoutId = setTimeout(async () => {
  //         const success = await refreshToken();
  //         if (success) {
  //           setupTokenRefresh(); // Set up next refresh
  //         }
  //       }, refreshTime);

  //       return () => clearTimeout(timeoutId);
  //     } else {
  //       // Token expires soon, refresh immediately
  //       refreshToken().then(success => {
  //         if (success) setupTokenRefresh();
  //       });
  //     }
  //   };

  //   if (user) {
  //     return setupTokenRefresh();
  //   }
  // }, [user]);

  useEffect(() => {
    const initializeAndCheckAuth = async () => {
      try {
        // Initialize offline storage first
        await offlineStorage.initialize();
        console.log('✅ Offline storage initialized in useAuth');
      } catch (error) {
        console.warn('Failed to initialize offline storage:', error);
      }
      
      // Check for stored token and get current user
      const token = localStorage.getItem('auth_token');

      // Validate token format before using it
      if (token && isValidJWT(token)) {
      console.log('Found valid token in localStorage, verifying with server...');

      // Verify token and get user profile
      fetch(`${API_BASE_URL}/auth/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      .then(res => {
        if (!res.ok) {
          // Only clear token on 401 (unauthorized), not on other errors
          if (res.status === 401) {
            console.error('Token is invalid or expired (401)');
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          } else {
            // For other errors (500, 503, etc.), keep the token and retry later
            console.warn(`Server error ${res.status}, will retry later`);
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
        }
        return res.json();
      })
      .then(data => {
        if (data.user) {
          // Map snake_case from backend to camelCase for frontend
          const mappedUser: User = {
            id: data.user.id,
            username: data.user.username,
            email: data.user.email,
            role: data.user.role,
            userType: data.user.userType || data.user.user_type || 'prepaid',
            balance: Number(data.user.balance) || 0,
            balanceLimit: data.user.balanceLimit !== undefined ? Number(data.user.balanceLimit) : (data.user.balance_limit !== undefined ? Number(data.user.balance_limit) : null),
            totalGamesPlayed: Number(data.user.total_games_played) || Number(data.user.totalGamesPlayed) || 0,
            totalWinnings: Number(data.user.total_winnings) || Number(data.user.totalWinnings) || 0,
            isActive: data.user.is_active !== undefined ? Boolean(data.user.is_active) : true,
            createdAt: data.user.created_at || data.user.createdAt || new Date().toISOString(),
            updatedAt: data.user.updated_at || data.user.updatedAt || new Date().toISOString()
          };
          setUser(mappedUser);
          console.log('User authenticated successfully:', mappedUser.username, 'Type:', mappedUser.userType);
        } else {
          throw new Error('No user data received');
        }
      })
      .catch(async (error) => {
        console.error('Auth profile fetch failed:', error);
        
        // Only remove token and logout on 401 errors
        if (error.message.includes('401')) {
          localStorage.removeItem('auth_token');
          setUser(null);
        } else {
          // Server error (500, 503, network error) - try to load cached user data
          console.log('🔒 Server error or unavailable, checking for cached user data...');
          
          try {
            // Try to get cached username and load user data
            const cachedUsername = await offlineAuthManager.getCachedUsername();
            if (cachedUsername) {
              // Get cached user data from offline storage
              const cachedUser = await offlineStorage.retrieve('auth', 'cached_credentials');
              if (cachedUser && cachedUser.user) {
                console.log('✅ Loading cached user data for offline session');
                
                const mappedUser: User = {
                  id: cachedUser.user.id,
                  username: cachedUser.user.username,
                  email: cachedUser.user.email,
                  role: cachedUser.user.role,
                  userType: cachedUser.user.userType || 'prepaid',
                  balance: Number(cachedUser.user.balance) || 0,
                  balanceLimit: cachedUser.user.balanceLimit,
                  totalGamesPlayed: Number(cachedUser.user.totalGamesPlayed) || 0,
                  totalWinnings: Number(cachedUser.user.totalWinnings) || 0,
                  isActive: cachedUser.user.isActive !== undefined ? Boolean(cachedUser.user.isActive) : true,
                  createdAt: cachedUser.user.createdAt || new Date().toISOString(),
                  updatedAt: cachedUser.user.updatedAt || new Date().toISOString()
                };
                
                setUser(mappedUser);
                console.log('User loaded from cache:', mappedUser.username, 'Type:', mappedUser.userType);
              }
            }
          } catch (cacheError) {
            console.warn('Failed to load cached user data:', cacheError);
          }
        }
      })
      .finally(() => {
        setLoading(false);
      });
    } else {
      // Token is missing or malformed
        if (token) {
          console.warn('Found malformed token in localStorage, removing it');
          localStorage.removeItem('auth_token');
        }
        setLoading(false);
      }
    };
    
    initializeAndCheckAuth();
  }, []);

  const signIn = async (usernameOrEmail: string, password: string) => {
    try {
      console.log('Attempting login for:', usernameOrEmail);
      
      // If offline, try offline login first
      if (networkStatusManager.isOffline) {
        console.log('🔒 Attempting offline login...');
        const offlineResult = await offlineAuthManager.attemptOfflineLogin(usernameOrEmail, password);
        
        if (offlineResult.success && offlineResult.user) {
          console.log('✅ Offline login successful');
          
          // Clear any existing game data
          clearGameData();
          
          // Set user state
          const mappedUser: User = {
            id: offlineResult.user.id,
            username: offlineResult.user.username,
            email: offlineResult.user.email,
            role: offlineResult.user.role,
            userType: offlineResult.user.userType || 'prepaid',
            balance: Number(offlineResult.user.balance) || 0,
            balanceLimit: offlineResult.user.balanceLimit,
            totalGamesPlayed: Number(offlineResult.user.totalGamesPlayed) || 0,
            totalWinnings: Number(offlineResult.user.totalWinnings) || 0,
            isActive: offlineResult.user.isActive !== undefined ? Boolean(offlineResult.user.isActive) : true,
            createdAt: offlineResult.user.createdAt || new Date().toISOString(),
            updatedAt: offlineResult.user.updatedAt || new Date().toISOString()
          };

          setUser(mappedUser);
          setLoading(false);

          return { 
            data: { user: mappedUser, token: 'offline_token' }, 
            error: null,
            offline: true
          };
        } else {
          throw new Error(offlineResult.error || 'Offline login failed');
        }
      }
      
      // Online login
      console.log('🌐 Attempting online login...');
      
      // Check if input is an email (contains @)
      const isEmail = usernameOrEmail.includes('@');
      const loginData = isEmail 
        ? { email: usernameOrEmail, password }
        : { username: usernameOrEmail, password };
      
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(loginData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Login failed' }));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Login response received:', data);

      if (data.user && data.token) {
        // Validate token format before storing
        if (!isValidJWT(data.token)) {
          throw new Error('Server returned malformed token');
        }

        // Clear any existing game data from previous user before setting new user data
        clearGameData();

        // Store token
        localStorage.setItem('auth_token', data.token);
        console.log('Token stored successfully');

        // Map snake_case from backend to camelCase for frontend
        const mappedUser: User = {
          id: data.user.id,
          username: data.user.username,
          email: data.user.email,
          role: data.user.role,
          userType: data.user.userType || data.user.user_type || 'prepaid',
          balance: Number(data.user.balance) || 0,
          balanceLimit: data.user.balanceLimit !== undefined ? Number(data.user.balanceLimit) : (data.user.balance_limit !== undefined ? Number(data.user.balance_limit) : null),
          totalGamesPlayed: Number(data.user.total_games_played) || Number(data.user.totalGamesPlayed) || 0,
          totalWinnings: Number(data.user.total_winnings) || Number(data.user.totalWinnings) || 0,
          isActive: data.user.is_active !== undefined ? Boolean(data.user.is_active) : true,
          createdAt: data.user.created_at || data.user.createdAt || new Date().toISOString(),
          updatedAt: data.user.updated_at || data.user.updatedAt || new Date().toISOString()
        };

        console.log('Setting user state:', mappedUser, 'Type:', mappedUser.userType);
        setUser(mappedUser);
        
        // Cache credentials for offline login
        await offlineAuthManager.cacheCredentials(usernameOrEmail, password, mappedUser);
        
        // Ensure loading is false so App.tsx can redirect
        setLoading(false);

        // Return immediately - no need for artificial delay
        return { data, error: null };
      } else {
        throw new Error('Invalid response: missing user data or token');
      }
    } catch (error) {
      console.error('Login error:', error);
      return {
        data: null,
        error: {
          message: error instanceof Error ? error.message : 'Login failed'
        }
      };
    }
  };

  const signUp = async (email: string, password: string, username: string, role: string = 'user') => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, email, password })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Registration failed' }));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.user && data.token) {
        // Validate token format before storing
        if (!isValidJWT(data.token)) {
          throw new Error('Server returned malformed token');
        }

        // Store token
        localStorage.setItem('auth_token', data.token);
        console.log('Registration successful, token stored');

        // Map snake_case from backend to camelCase for frontend
        const mappedUser: User = {
          id: data.user.id,
          username: data.user.username,
          email: data.user.email,
          role: data.user.role,
          userType: data.user.userType || data.user.user_type || 'prepaid',
          balance: Number(data.user.balance) || 0,
          balanceLimit: data.user.balanceLimit !== undefined ? Number(data.user.balanceLimit) : (data.user.balance_limit !== undefined ? Number(data.user.balance_limit) : null),
          totalGamesPlayed: Number(data.user.total_games_played) || Number(data.user.totalGamesPlayed) || 0,
          totalWinnings: Number(data.user.total_winnings) || Number(data.user.totalWinnings) || 0,
          isActive: data.user.is_active !== undefined ? Boolean(data.user.is_active) : true,
          createdAt: data.user.created_at || data.user.createdAt || new Date().toISOString(),
          updatedAt: data.user.updated_at || data.user.updatedAt || new Date().toISOString()
        };

        setUser(mappedUser);
        
        return { data, error: null };
      } else {
        throw new Error('Invalid response: missing user data or token');
      }
    } catch (error) {
      console.error('Registration error:', error);
      return {
        data: null,
        error: {
          message: error instanceof Error ? error.message : 'Registration failed'
        }
      };
    }
  };

  const signOut = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (token) {
        // Try to logout from server, but don't fail if it doesn't work
        try {
          await fetch(`${API_BASE_URL}/auth/logout`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          console.log('Server logout successful');
        } catch (serverError) {
          // Server logout failed, but continue with client cleanup
          console.warn('Server logout failed, continuing with client cleanup');
        }
      }
    } catch (error) {
      // Ignore logout errors - we still want to clear local state
      console.error('Logout error:', error);
    } finally {
      console.log('Starting client cleanup for logout');

      // Comprehensive cleanup for next login
      // Clear all auth-related storage
      localStorage.removeItem('auth_token');

      // Clear game data specifically
      clearGameData();

      // Clear any cached data that might be related to the user session
      const keysToRemove = Object.keys(localStorage).filter(key =>
        key.startsWith('auth_') || key.startsWith('user_') || key.startsWith('game_')
      );
      keysToRemove.forEach(key => localStorage.removeItem(key));

      // Clear session storage as well
      sessionStorage.clear();

      // Clear user state - this will trigger the navigation in App.tsx
      setUser(null);

      console.log('Client cleanup completed');
    }

    return { error: null };
  };

  const refreshUser = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      
      if (!token || !isValidJWT(token)) {
        console.warn('refreshUser: No valid token available');
        return { error: 'No valid token available' };
      }

      const response = await fetch(`${API_BASE_URL}/auth/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        // If 401, token is invalid - but DON'T automatically logout
        // Let the user stay logged in and they can manually refresh or re-login
        if (response.status === 401) {
          console.error('refreshUser: Token may be expired (401), but keeping user logged in');
          // Don't clear token or user state - just return error
          return { error: 'Authentication may be expired', shouldLogout: false };
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.user) {
        // Map snake_case from backend to camelCase for frontend
        const mappedUser: User = {
          id: data.user.id,
          username: data.user.username,
          email: data.user.email,
          role: data.user.role,
          userType: data.user.userType || data.user.user_type || 'prepaid',
          balance: Number(data.user.balance) || 0,
          balanceLimit: data.user.balanceLimit !== undefined ? Number(data.user.balanceLimit) : (data.user.balance_limit !== undefined ? Number(data.user.balance_limit) : null),
          totalGamesPlayed: Number(data.user.total_games_played) || Number(data.user.totalGamesPlayed) || 0,
          totalWinnings: Number(data.user.total_winnings) || Number(data.user.totalWinnings) || 0,
          isActive: data.user.is_active !== undefined ? Boolean(data.user.is_active) : true,
          createdAt: data.user.created_at || data.user.createdAt || new Date().toISOString(),
          updatedAt: data.user.updated_at || data.user.updatedAt || new Date().toISOString()
        };
        setUser(mappedUser);
        console.log('User data refreshed successfully:', mappedUser.username, 'Type:', mappedUser.userType, 'Balance:', mappedUser.balance);
        return { error: null, user: mappedUser };
      } else {
        throw new Error('No user data received');
      }
    } catch (error) {
      console.error('Refresh user error:', error);
      // Don't logout on network errors, only on auth errors
      return {
        error: {
          message: error instanceof Error ? error.message : 'Failed to refresh user data'
        }
      };
    }
  };

  return {
    user,
    loading,
    signIn,
    signUp,
    signOut,
    refreshUser
  };
};
