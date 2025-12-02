import { useNetworkStatus } from '../utils/networkStatus';
import { offlineQueue } from '../utils/offlineQueue';
import { useState, useEffect } from 'react';

/**
 * Offline Indicator Component
 * Shows network status and queued requests count
 */
export function OfflineIndicator() {
  const { isOnline, isOffline } = useNetworkStatus();
  const [queueSize, setQueueSize] = useState(0);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Update queue size periodically
    const interval = setInterval(() => {
      setQueueSize(offlineQueue.getQueueSize());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Don't show anything when online and queue is empty
  if (isOnline && queueSize === 0) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: '10px',
        right: '10px',
        zIndex: 9999,
        backgroundColor: isOffline ? '#ef4444' : '#f59e0b',
        color: 'white',
        padding: '8px 16px',
        borderRadius: '8px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '14px',
        fontWeight: '500',
        cursor: queueSize > 0 ? 'pointer' : 'default',
        transition: 'all 0.3s ease'
      }}
      onClick={() => queueSize > 0 && setShowDetails(!showDetails)}
    >
      {/* Status Icon */}
      <span style={{ fontSize: '18px' }}>
        {isOffline ? '📡' : '🔄'}
      </span>

      {/* Status Text */}
      <span>
        {isOffline ? 'Offline Mode' : 'Syncing...'}
      </span>

      {/* Queue Count Badge */}
      {queueSize > 0 && (
        <span
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.3)',
            padding: '2px 8px',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: 'bold'
          }}
        >
          {queueSize}
        </span>
      )}

      {/* Details Dropdown */}
      {showDetails && queueSize > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '8px',
            backgroundColor: 'white',
            color: '#1f2937',
            padding: '12px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            minWidth: '200px',
            fontSize: '13px'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
            Queued Requests
          </div>
          <div style={{ color: '#6b7280' }}>
            {queueSize} request{queueSize !== 1 ? 's' : ''} waiting to sync
          </div>
          <button
            onClick={() => {
              offlineQueue.clear();
              setShowDetails(false);
            }}
            style={{
              marginTop: '8px',
              padding: '4px 12px',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '12px',
              cursor: 'pointer',
              width: '100%'
            }}
          >
            Clear Queue
          </button>
        </div>
      )}
    </div>
  );
}
