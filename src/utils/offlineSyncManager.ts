// Offline Sync Manager
// Coordinates synchronization between offline and online data

import { networkStatusManager } from './networkStatus';
import { offlineStorage } from './offlineStorage';
import { offlineGameManager } from './offlineGameManager';
import { offlineQueue } from './offlineQueue';

interface SyncStatus {
  isOnline: boolean;
  lastSync: number | null;
  pendingItems: number;
  syncInProgress: boolean;
}

class OfflineSyncManager {
  private syncInProgress = false;
  private lastSyncTime: number | null = null;
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<(status: SyncStatus) => void>();
  private initialized = false;

  constructor() {
    this.setupNetworkListener();
    // Don't start periodic sync immediately - wait for initialization
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    console.log('🔄 Initializing sync manager...');
    
    // Ensure dependencies are initialized
    if (!offlineStorage.isInitialized()) {
      await offlineStorage.initialize();
    }
    
    if (!offlineGameManager.isInitialized()) {
      await offlineGameManager.initialize();
    }
    
    this.initialized = true;
    this.startPeriodicSync();
    console.log('✅ Sync manager initialized');
  }

  private setupNetworkListener(): void {
    networkStatusManager.subscribe((isOnline) => {
      if (isOnline && !this.syncInProgress && this.initialized) {
        console.log('🌐 Network restored - starting sync...');
        this.performFullSync();
      }
      this.notifyListeners();
    });
  }

  private startPeriodicSync(): void {
    if (!this.initialized) {
      console.log('⚠️ Sync manager not initialized, skipping periodic sync setup');
      return;
    }
    
    // Sync every 5 minutes when online
    this.syncInterval = setInterval(() => {
      if (networkStatusManager.isOnline && !this.syncInProgress && this.initialized) {
        this.performFullSync();
      }
    }, 5 * 60 * 1000);
  }

  async performFullSync(): Promise<void> {
    if (this.syncInProgress) {
      console.log('🔄 Sync already in progress, skipping...');
      return;
    }

    this.syncInProgress = true;
    this.notifyListeners();

    try {
      console.log('🔄 Starting full sync...');

      // 1. Ensure offline storage is initialized
      if (!offlineStorage.isInitialized()) {
        console.log('🔄 Initializing offline storage for sync...');
        await offlineStorage.initialize();
      }

      // 2. Sync offline storage queue
      await offlineStorage.syncWithServer();

      // 3. Process offline queue
      await offlineQueue.processQueue();

      // 4. Ensure offline game manager is initialized and sync games
      try {
        if (!offlineGameManager.isInitialized()) {
          console.log('🔄 Initializing offline game manager for sync...');
          await offlineGameManager.initialize();
        }
        await offlineGameManager.syncAllGames();
      } catch (error) {
        console.warn('⚠️ Game sync failed, continuing with other sync operations:', error);
      }

      // 5. Update last sync time
      this.lastSyncTime = Date.now();
      localStorage.setItem('lastSyncTime', this.lastSyncTime.toString());

      console.log('✅ Full sync completed successfully');
    } catch (error) {
      console.error('❌ Sync failed:', error);
    } finally {
      this.syncInProgress = false;
      this.notifyListeners();
    }
  }

  getSyncStatus(): SyncStatus {
    const queueStatus = offlineStorage.getSyncQueueStatus();
    
    return {
      isOnline: networkStatusManager.isOnline,
      lastSync: this.lastSyncTime,
      pendingItems: queueStatus.count + offlineQueue.getQueueSize(),
      syncInProgress: this.syncInProgress
    };
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  subscribe(listener: (status: SyncStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.getSyncStatus()); // Immediate notification
    
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const status = this.getSyncStatus();
    this.listeners.forEach(listener => {
      try {
        listener(status);
      } catch (error) {
        console.error('Error in sync status listener:', error);
      }
    });
  }

  async forcSync(): Promise<void> {
    await this.performFullSync();
  }

  destroy(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.listeners.clear();
  }
}

export const offlineSyncManager = new OfflineSyncManager();