// Enhanced Offline Status Bar
// Shows comprehensive offline status and sync information

import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, Clock, Database, AlertTriangle } from 'lucide-react';
import { useNetworkStatus } from '../utils/networkStatus';
import { offlineSyncManager } from '../utils/offlineSyncManager';

interface SyncStatus {
  isOnline: boolean;
  lastSync: number | null;
  pendingItems: number;
  syncInProgress: boolean;
}

export function OfflineStatusBar() {
  const { isOnline, isOffline } = useNetworkStatus();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: false,
    lastSync: null,
    pendingItems: 0,
    syncInProgress: false
  });
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const unsubscribe = offlineSyncManager.subscribe(setSyncStatus);
    return unsubscribe;
  }, []);

  const formatLastSync = (timestamp: number | null): string => {
    if (!timestamp) return 'Never';
    
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  const handleForceSync = async () => {
    if (isOnline && !syncStatus.syncInProgress) {
      try {
        await offlineSyncManager.forcSync();
      } catch (error) {
        console.error('Force sync failed:', error);
      }
    }
  };

  // Don't show if online and no pending items
  if (isOnline && syncStatus.pendingItems === 0 && !syncStatus.syncInProgress) {
    return null;
  }

  const getStatusColor = () => {
    if (isOffline) return 'bg-red-500';
    if (syncStatus.syncInProgress) return 'bg-blue-500';
    if (syncStatus.pendingItems > 0) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStatusText = () => {
    if (isOffline) return 'Offline';
    if (syncStatus.syncInProgress) return 'Syncing...';
    if (syncStatus.pendingItems > 0) return `${syncStatus.pendingItems} pending`;
    return 'Synced';
  };

  return (
    <div className="fixed top-4 right-4 z-50">
      <div
        className={`${getStatusColor()} text-white px-4 py-2 rounded-lg shadow-lg cursor-pointer transition-all duration-300 hover:shadow-xl`}
        onClick={() => setShowDetails(!showDetails)}
      >
        <div className="flex items-center gap-2">
          {/* Status Icon */}
          {isOffline ? (
            <WifiOff size={16} />
          ) : syncStatus.syncInProgress ? (
            <RefreshCw size={16} className="animate-spin" />
          ) : (
            <Wifi size={16} />
          )}

          {/* Status Text */}
          <span className="text-sm font-medium">{getStatusText()}</span>

          {/* Pending Items Badge */}
          {syncStatus.pendingItems > 0 && (
            <span className="bg-white bg-opacity-30 px-2 py-1 rounded-full text-xs font-bold">
              {syncStatus.pendingItems}
            </span>
          )}
        </div>

        {/* Details Dropdown */}
        {showDetails && (
          <div
            className="absolute top-full right-0 mt-2 bg-white text-gray-800 rounded-lg shadow-xl p-4 min-w-64 border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-3">
              {/* Connection Status */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Connection:</span>
                <div className="flex items-center gap-1">
                  {isOnline ? (
                    <>
                      <Wifi size={14} className="text-green-500" />
                      <span className="text-green-600 text-sm">Online</span>
                    </>
                  ) : (
                    <>
                      <WifiOff size={14} className="text-red-500" />
                      <span className="text-red-600 text-sm">Offline</span>
                    </>
                  )}
                </div>
              </div>

              {/* Last Sync */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Last Sync:</span>
                <div className="flex items-center gap-1">
                  <Clock size={14} className="text-gray-500" />
                  <span className="text-sm">{formatLastSync(syncStatus.lastSync)}</span>
                </div>
              </div>

              {/* Pending Items */}
              {syncStatus.pendingItems > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Pending:</span>
                  <div className="flex items-center gap-1">
                    <Database size={14} className="text-yellow-500" />
                    <span className="text-sm">{syncStatus.pendingItems} items</span>
                  </div>
                </div>
              )}

              {/* Sync Status */}
              {syncStatus.syncInProgress && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Status:</span>
                  <div className="flex items-center gap-1">
                    <RefreshCw size={14} className="text-blue-500 animate-spin" />
                    <span className="text-blue-600 text-sm">Syncing...</span>
                  </div>
                </div>
              )}

              {/* Warning for offline mode */}
              {isOffline && (
                <div className="bg-yellow-50 border border-yellow-200 rounded p-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={14} className="text-yellow-600 mt-0.5" />
                    <div>
                      <p className="text-xs text-yellow-800 font-medium">Offline Mode</p>
                      <p className="text-xs text-yellow-700">
                        Data will sync when connection is restored
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Force Sync Button */}
              {isOnline && syncStatus.pendingItems > 0 && !syncStatus.syncInProgress && (
                <button
                  onClick={handleForceSync}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white text-sm py-2 px-3 rounded transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw size={14} />
                  Force Sync Now
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}