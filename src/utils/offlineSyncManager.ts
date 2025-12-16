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

  constructor() {
    this.setupNetworkListener();
    this.startPeriodicSync();
  }

  private setupNetworkListener(): void {
    networkStatusManager.subscribe((isOnline) => {
      if (isOnline && !this.syncInProgress) {
        console.log('🌐 Network restored - starting sync...');
        this.performFullSync();
      }
      this.notifyListeners();
    });
  }

  private startPeriodicSync(): void {
    // Sync every 5 minutes when online
    this.syncInterval = setInterval(() => {
      if (networkStatusManager.isOnline && !this.syncInProgress) {
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

      // 1. Sync offline storage queue
      await offlineStorage.syncWithServer();

      // 2. Process offline queue
      await offlineQueue.processQueue();

      // 3. Sync games
      await offlineGameManager.syncAllGames();

      // 4. Update last sync time
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