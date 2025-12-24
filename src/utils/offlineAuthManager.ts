// Offline Authentication Manager
// Handles cached credentials and offline login

import { offlineStorage } from './offlineStorage';
import { networkStatusManager } from './networkStatus';

interface CachedCredentials {
  username: string;
  passwordHash: string;
  user: any;
  timestamp: number;
  expiresAt: number;
}

class OfflineAuthManager {
  private readonly CACHE_KEY = 'cached_credentials';
  private readonly CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

  // Hash password for secure storage (simple hash for demo)
  private hashPassword(password: string): string {
    // Simple hash - in production, use proper crypto
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  // Cache user credentials after successful online login
  async cacheCredentials(username: string, password: string, user: any): Promise<void> {
    try {
      console.log('💾 Caching credentials for user:', username);
      
      const credentials: CachedCredentials = {
        username: username.toLowerCase(),
        passwordHash: this.hashPassword(password),
        user,
        timestamp: Date.now(),
        expiresAt: Date.now() + this.CACHE_DURATION
      };

      console.log('Credentials to cache:', {
        username: credentials.username,
        hasPassword: !!credentials.passwordHash,
        expiresAt: new Date(credentials.expiresAt)
      });

      await offlineStorage.store('auth', this.CACHE_KEY, credentials);
      console.log('✅ Credentials cached for offline login');
    } catch (error) {
      console.error('Failed to cache credentials:', error);
    }
  }

  // Verify credentials against cached data
  async verifyOfflineCredentials(username: string, password: string): Promise<any | null> {
    try {
      const cached = await offlineStorage.retrieve('auth', this.CACHE_KEY);
      if (!cached) {
        console.log('No cached credentials found');
        return null;
      }

      const credentials = cached as CachedCredentials;

      // Check if cache has expired
      if (Date.now() > credentials.expiresAt) {
        console.log('Cached credentials expired');
        await this.clearCachedCredentials();
        return null;
      }

      // Verify username and password
      const inputUsername = username.toLowerCase();
      const inputPasswordHash = this.hashPassword(password);

      if (credentials.username === inputUsername && credentials.passwordHash === inputPasswordHash) {
        console.log('✅ Offline credentials verified');
        return credentials.user;
      } else {
        console.log('❌ Offline credentials do not match');
        return null;
      }
    } catch (error) {
      console.error('Error verifying offline credentials:', error);
      return null;
    }
  }

  // Check if offline login is available
  async isOfflineLoginAvailable(): Promise<boolean> {
    try {
      console.log('🔍 Checking offline storage for cached credentials...');
      const cached = await offlineStorage.retrieve('auth', this.CACHE_KEY);
      console.log('Cached data:', cached);
      
      if (!cached) {
        console.log('❌ No cached credentials found');
        return false;
      }

      const credentials = cached as CachedCredentials;
      const isValid = Date.now() < credentials.expiresAt;
      console.log('Credentials valid:', isValid, 'Expires:', new Date(credentials.expiresAt));
      
      return isValid;
    } catch (error) {
      console.error('Error checking offline login availability:', error);
      return false;
    }
  }

  // Get cached username for convenience
  async getCachedUsername(): Promise<string | null> {
    try {
      const cached = await offlineStorage.retrieve('auth', this.CACHE_KEY);
      if (!cached) return null;

      const credentials = cached as CachedCredentials;
      if (Date.now() > credentials.expiresAt) return null;

      return credentials.username;
    } catch (error) {
      return null;
    }
  }

  // Clear cached credentials
  async clearCachedCredentials(): Promise<void> {
    try {
      await offlineStorage.store('auth', this.CACHE_KEY, null);
      console.log('🗑️ Cached credentials cleared');
    } catch (error) {
      console.error('Failed to clear cached credentials:', error);
    }
  }

  // Attempt offline login
  async attemptOfflineLogin(username: string, password: string): Promise<{
    success: boolean;
    user?: any;
    error?: string;
  }> {
    if (networkStatusManager.isOnline) {
      return {
        success: false,
        error: 'Use online login when connected'
      };
    }

    const user = await this.verifyOfflineCredentials(username, password);
    
    if (user) {
      return {
        success: true,
        user
      };
    } else {
      return {
        success: false,
        error: 'Invalid credentials or no cached login available'
      };
    }
  }
}

export const offlineAuthManager = new OfflineAuthManager();