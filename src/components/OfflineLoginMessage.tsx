// Offline Login Message Component
// Shows helpful message when user tries to login while offline

import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { useNetworkStatus } from '../utils/networkStatus';

interface OfflineLoginMessageProps {
  onRetry?: () => void;
}

export function OfflineLoginMessage({ onRetry }: OfflineLoginMessageProps) {
  const { isOffline } = useNetworkStatus();

  if (!isOffline) return null;

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
      <div className="flex items-start">
        <WifiOff className="w-5 h-5 text-yellow-600 mt-0.5 mr-3" />
        <div className="flex-1">
          <h3 className="text-sm font-medium text-yellow-800 mb-1">
            You're Currently Offline
          </h3>
          <p className="text-sm text-yellow-700 mb-3">
            Login requires an internet connection for security. If you were previously logged in, 
            your session may be restored when connection is available.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={onRetry}
              className="inline-flex items-center px-3 py-2 border border-yellow-300 shadow-sm text-sm font-medium rounded-md text-yellow-700 bg-yellow-50 hover:bg-yellow-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </button>
            <div className="text-xs text-yellow-600 flex items-center">
              <div className="w-2 h-2 bg-yellow-400 rounded-full mr-2 animate-pulse"></div>
              Waiting for connection...
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}