// Service Worker Registration and Management
// Handles PWA functionality and offline support

interface ServiceWorkerConfig {
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onOfflineReady?: () => void;
}

class ServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null;
  private config: ServiceWorkerConfig = {};

  async register(config: ServiceWorkerConfig = {}): Promise<void> {
    this.config = config;

    if (!('serviceWorker' in navigator)) {
      console.log('Service Worker not supported');
      return;
    }

    try {
      console.log('🔧 Registering service worker...');
      
      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      console.log('✅ Service Worker registered successfully');

      // Handle updates
      this.registration.addEventListener('updatefound', () => {
        this.handleUpdate();
      });

      // Check for existing service worker
      if (this.registration.active) {
        this.config.onSuccess?.(this.registration);
      }

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        this.handleMessage(event);
      });

      // Check if app is ready for offline use
      this.checkOfflineReady();

    } catch (error) {
      console.error('❌ Service Worker registration failed:', error);
    }
  }

  private handleUpdate(): void {
    if (!this.registration) return;

    const installingWorker = this.registration.installing;
    if (!installingWorker) return;

    installingWorker.addEventListener('statechange', () => {
      if (installingWorker.state === 'installed') {
        if (navigator.serviceWorker.controller) {
          // New update available
          console.log('🔄 New service worker update available');
          this.config.onUpdate?.(this.registration!);
        } else {
          // First time installation
          console.log('✅ Service worker installed for the first time');
          this.config.onSuccess?.(this.registration!);
        }
      }
    });
  }

  private handleMessage(event: MessageEvent): void {
    const { type, data } = event.data;

    switch (type) {
      case 'BACKGROUND_SYNC':
        console.log('📤 Background sync requested by service worker');
        // Trigger sync in main app
        this.triggerBackgroundSync();
        break;
        
      default:
        console.log('SW Message:', type, data);
    }
  }

  private async checkOfflineReady(): Promise<void> {
    try {
      // Check if essential resources are cached
      const cache = await caches.open('amour-static-v1');
      const cachedUrls = await cache.keys();
      
      if (cachedUrls.length > 0) {
        console.log('📱 App ready for offline use');
        this.config.onOfflineReady?.();
      }
    } catch (error) {
      console.warn('Could not check offline readiness:', error);
    }
  }

  private async triggerBackgroundSync(): Promise<void> {
    // Import and trigger sync managers
    try {
      const { offlineSyncManager } = await import('./offlineSyncManager');
      await offlineSyncManager.performFullSync();
    } catch (error) {
      console.error('Background sync failed:', error);
    }
  }

  async skipWaiting(): Promise<void> {
    if (!this.registration?.waiting) return;

    // Tell the waiting service worker to skip waiting
    this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });

    // Reload the page to activate the new service worker
    window.location.reload();
  }

  async cacheUrls(urls: string[]): Promise<void> {
    if (!this.registration?.active) return;

    this.registration.active.postMessage({
      type: 'CACHE_URLS',
      data: { urls }
    });
  }

  async clearCache(cacheName?: string): Promise<void> {
    if (!this.registration?.active) return;

    this.registration.active.postMessage({
      type: 'CLEAR_CACHE',
      data: { cacheName }
    });
  }

  async unregister(): Promise<boolean> {
    if (!this.registration) return false;

    try {
      const result = await this.registration.unregister();
      console.log('🗑️ Service Worker unregistered');
      return result;
    } catch (error) {
      console.error('Failed to unregister service worker:', error);
      return false;
    }
  }

  getRegistration(): ServiceWorkerRegistration | null {
    return this.registration;
  }

  isSupported(): boolean {
    return 'serviceWorker' in navigator;
  }

  isRegistered(): boolean {
    return this.registration !== null;
  }
}

// Singleton instance
export const serviceWorkerManager = new ServiceWorkerManager();

// Convenience function for registration
export async function registerServiceWorker(config?: ServiceWorkerConfig): Promise<void> {
  await serviceWorkerManager.register(config);
}

// Check if app can work offline
export async function checkOfflineCapability(): Promise<boolean> {
  try {
    const cache = await caches.open('amour-static-v1');
    const keys = await cache.keys();
    return keys.length > 0;
  } catch {
    return false;
  }
}