// Network Status Detection and Management
// Provides real-time network status monitoring and offline mode support

type NetworkStatusListener = (isOnline: boolean) => void;

class NetworkStatusManager {
  private listeners = new Set<NetworkStatusListener>();
  private _isOnline = navigator.onLine;
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private lastCheckTime = 0;
  private readonly CHECK_INTERVAL = 30000; // Check every 30 seconds

  constructor() {
    // Initialize with navigator.onLine
    this._isOnline = navigator.onLine;
    console.log(`🌐 Network Status Manager initialized: ${this._isOnline ? 'Online' : 'Offline'}`);
    
    this.setupListeners();
    this.startPeriodicCheck();
  }

  private setupListeners(): void {
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
  }

  private handleOnline = (): void => {
    console.log('🌐 Network: Online');
    this._isOnline = true;
    this.notifyListeners(true);
  };

  private handleOffline = (): void => {
    console.log('📡 Network: Offline');
    this._isOnline = false;
    this.notifyListeners(false);
  };

  private startPeriodicCheck(): void {
    // Periodic connectivity check (fallback for unreliable online/offline events)
    this.checkInterval = setInterval(() => {
      this.checkConnectivity();
    }, this.CHECK_INTERVAL);
  }

  private async checkConnectivity(): Promise<void> {
    const now = Date.now();
    if (now - this.lastCheckTime < 5000) {
      // Throttle checks to max once per 5 seconds
      return;
    }
    this.lastCheckTime = now;

    // First check navigator.onLine as a quick check
    if (!navigator.onLine) {
      const wasOnline = this._isOnline;
      this._isOnline = false;
      if (wasOnline) {
        console.log('📡 Navigator reports offline');
        this.notifyListeners(false);
      }
      return;
    }

    try {
      // Try to fetch from the API endpoint (more reliable than favicon)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      // Use a lightweight API endpoint or fallback to a known resource
      const testUrl = window.location.origin + '/index.html';
      
      const response = await fetch(testUrl, {
        method: 'HEAD',
        cache: 'no-cache',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const wasOnline = this._isOnline;
      this._isOnline = response.ok;

      if (wasOnline !== this._isOnline) {
        console.log(`🔄 Network status changed: ${this._isOnline ? 'Online' : 'Offline'}`);
        this.notifyListeners(this._isOnline);
      }
    } catch (error) {
      // Don't immediately mark as offline on fetch error
      // Only mark offline if navigator.onLine also says offline
      if (!navigator.onLine) {
        const wasOnline = this._isOnline;
        this._isOnline = false;

        if (wasOnline) {
          console.log('📡 Network check failed and navigator reports offline');
          this.notifyListeners(false);
        }
      } else {
        // Fetch failed but navigator says online - likely a CORS or server issue
        // Keep current online status
        console.log('⚠️ Network check failed but navigator.onLine is true - keeping current status');
      }
    }
  }

  private notifyListeners(isOnline: boolean): void {
    this.listeners.forEach(listener => {
      try {
        listener(isOnline);
      } catch (error) {
        console.error('Error in network status listener:', error);
      }
    });
  }

  get isOnline(): boolean {
    return this._isOnline;
  }

  get isOffline(): boolean {
    return !this._isOnline;
  }

  subscribe(listener: NetworkStatusListener): () => void {
    this.listeners.add(listener);
    // Immediately notify with current status
    listener(this._isOnline);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  async forceCheck(): Promise<boolean> {
    await this.checkConnectivity();
    return this._isOnline;
  }

  destroy(): void {
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    this.listeners.clear();
  }
}

// Singleton instance
const networkStatusManager = new NetworkStatusManager();

// React hook for network status
import { useState, useEffect } from 'react';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(networkStatusManager.isOnline);

  useEffect(() => {
    const unsubscribe = networkStatusManager.subscribe(setIsOnline);
    return unsubscribe;
  }, []);

  return {
    isOnline,
    isOffline: !isOnline,
    forceCheck: () => networkStatusManager.forceCheck()
  };
}

export { networkStatusManager };
