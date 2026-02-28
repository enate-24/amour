import React, { useEffect, useState } from 'react';
import { initialDownloadManager, DownloadProgress } from '../utils/initialDownloadManager';

interface InitialDownloadModalProps {
  userId: string;
  token: string;
  onComplete: () => void;
}

const InitialDownloadModal: React.FC<InitialDownloadModalProps> = ({ userId, token, onComplete }) => {
  const [progress, setProgress] = useState<DownloadProgress>({
    cartelas: {
      total: 0,
      downloaded: 0,
      percentage: 0,
      status: 'pending'
    },
    sounds: {
      total: 0,
      downloaded: 0,
      percentage: 0,
      status: 'pending'
    },
    overall: {
      percentage: 0,
      status: 'pending'
    }
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = initialDownloadManager.onProgress(setProgress);

    const startDownload = async () => {
      try {
        await initialDownloadManager.performInitialDownload(userId, token);
        // Wait a moment to show 100% before closing
        setTimeout(() => {
          onComplete();
        }, 1000);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Download failed');
      }
    };

    startDownload();

    return unsubscribe;
  }, [userId, token, onComplete]);

  const handleRetry = () => {
    setError(null);
    initialDownloadManager.resetDownloadStatus(userId);
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border-2 border-blue-500 shadow-2xl w-full max-w-md mx-4 p-6">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">📥</div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {error ? 'Download Failed' : 'Setting Up Your Account'}
          </h2>
          <p className="text-slate-300 text-sm">
            {error 
              ? 'Something went wrong during download' 
              : 'Downloading your cartelas and sounds...'}
          </p>
        </div>

        {error ? (
          /* Error State */
          <div className="space-y-4">
            <div className="bg-red-500/20 border border-red-500 rounded-lg p-4">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
            <button
              onClick={handleRetry}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors"
            >
              Retry Download
            </button>
          </div>
        ) : (
          /* Progress State */
          <div className="space-y-6">
            {/* Overall Progress */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-white font-semibold">Overall Progress</span>
                <span className="text-blue-400 font-bold">{progress.overall.percentage}%</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300 ease-out"
                  style={{ width: `${progress.overall.percentage}%` }}
                />
              </div>
            </div>

            {/* Cartelas Progress */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-slate-300 text-sm">📋 Cartelas</span>
                  {progress.cartelas.status === 'complete' && (
                    <span className="text-green-400 text-xs">✓</span>
                  )}
                </div>
                <span className="text-slate-400 text-sm">{progress.cartelas.percentage}%</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ease-out ${
                    progress.cartelas.status === 'complete'
                      ? 'bg-green-500'
                      : progress.cartelas.status === 'downloading'
                      ? 'bg-blue-500'
                      : 'bg-slate-600'
                  }`}
                  style={{ width: `${progress.cartelas.percentage}%` }}
                />
              </div>
            </div>

            {/* Sounds Progress */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-slate-300 text-sm">🔊 Sounds</span>
                  {progress.sounds.status === 'complete' && (
                    <span className="text-green-400 text-xs">✓</span>
                  )}
                </div>
                <span className="text-slate-400 text-sm">
                  {progress.sounds.total > 0 
                    ? `${progress.sounds.downloaded}/${progress.sounds.total}` 
                    : `${progress.sounds.percentage}%`}
                </span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ease-out ${
                    progress.sounds.status === 'complete'
                      ? 'bg-green-500'
                      : progress.sounds.status === 'downloading'
                      ? 'bg-blue-500'
                      : 'bg-slate-600'
                  }`}
                  style={{ width: `${progress.sounds.percentage}%` }}
                />
              </div>
            </div>

            {/* Status Message */}
            <div className="text-center">
              {progress.overall.status === 'complete' ? (
                <div className="text-green-400 font-semibold animate-pulse">
                  ✓ Download Complete!
                </div>
              ) : (
                <div className="text-slate-400 text-sm">
                  Please wait, this may take a moment...
                </div>
              )}
            </div>
          </div>
        )}

        {/* Info */}
        <div className="mt-6 pt-4 border-t border-slate-700">
          <p className="text-slate-400 text-xs text-center">
            This is a one-time setup. Your data will be cached for offline use.
          </p>
        </div>
      </div>
    </div>
  );
};

export default InitialDownloadModal;
