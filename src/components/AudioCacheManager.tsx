import React, { useState, useEffect } from 'react';
import { Download, Trash2, CheckCircle, AlertCircle } from 'lucide-react';
import { UnifiedAudioManager } from '../utils/UnifiedAudioManager';
import type { CacheStatus } from '../utils/audioCache';

interface AudioCacheManagerProps {
  onCacheComplete?: () => void;
  showProgress?: boolean;
}

const AudioCacheManager: React.FC<AudioCacheManagerProps> = ({
  onCacheComplete,
  showProgress = true
}) => {
  const [cacheStatus, setCacheStatus] = useState<CacheStatus | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const audioManager = UnifiedAudioManager.getInstance();

  // Load cache status on mount
  useEffect(() => {
    loadCacheStatus();
  }, []);

  const loadCacheStatus = async () => {
    try {
      const status = await audioManager.getCacheStatus();
      setCacheStatus(status);
    } catch (err) {
      console.error('Failed to load cache status:', err);
      setError('Failed to load cache status');
    }
  };

  const handleDownloadAll = async () => {
    setIsDownloading(true);
    setError(null);
    setDownloadProgress(0);

    try {
      await audioManager.downloadMissingAudio((current, total) => {
        const progress = Math.round((current / total) * 100);
        setDownloadProgress(progress);
      });

      // Reload cache status
      await loadCacheStatus();
      onCacheComplete?.();
    } catch (err) {
      console.error('Failed to download audio:', err);
      setError('Failed to download audio files. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleClearCache = async () => {
    if (!confirm('Are you sure you want to clear all cached audio? This will require re-downloading files.')) {
      return;
    }

    try {
      const { audioCacheDB } = await import('../utils/audioCache');
      await audioCacheDB.clearAll();
      await loadCacheStatus();
    } catch (err) {
      console.error('Failed to clear cache:', err);
      setError('Failed to clear cache');
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (!cacheStatus) {
    return (
      <div className="bg-slate-800 rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-slate-700 rounded w-1/2 mb-4"></div>
          <div className="h-4 bg-slate-700 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  const progressPercentage = (cacheStatus.cachedFiles / cacheStatus.totalFiles) * 100;

  return (
    <div className="bg-slate-800 rounded-lg p-6">
      <h3 className="text-xl font-bold text-yellow-400 mb-4">Audio Cache Management</h3>

      {/* Cache Status */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-slate-300">Cache Status</span>
          <span className="text-white font-semibold">
            {cacheStatus.cachedFiles} / {cacheStatus.totalFiles} files
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-700 rounded-full h-3 mb-2">
          <div
            className={`h-3 rounded-full transition-all duration-300 ${
              cacheStatus.isComplete ? 'bg-green-500' : 'bg-yellow-400'
            }`}
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">
            {cacheStatus.isComplete ? (
              <span className="flex items-center gap-1 text-green-400">
                <CheckCircle size={16} />
                Ready for offline use
              </span>
            ) : (
              <span className="flex items-center gap-1 text-yellow-400">
                <AlertCircle size={16} />
                {cacheStatus.missingFiles.length} files missing
              </span>
            )}
          </span>
          <span className="text-slate-400">{formatBytes(cacheStatus.cacheSize)}</span>
        </div>
      </div>

      {/* Download Progress */}
      {isDownloading && showProgress && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-300">Downloading...</span>
            <span className="text-white font-semibold">{downloadProgress}%</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${downloadProgress}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded-lg text-red-200 text-sm">
          {error}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleDownloadAll}
          disabled={isDownloading || cacheStatus.isComplete}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold transition-colors ${
            isDownloading || cacheStatus.isComplete
              ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
              : 'bg-yellow-400 text-slate-900 hover:bg-yellow-500'
          }`}
        >
          <Download size={20} />
          {isDownloading ? 'Downloading...' : cacheStatus.isComplete ? 'All Downloaded' : 'Download All Sounds'}
        </button>

        <button
          onClick={handleClearCache}
          disabled={isDownloading || cacheStatus.cachedFiles === 0}
          className={`px-4 py-3 rounded-lg font-semibold transition-colors ${
            isDownloading || cacheStatus.cachedFiles === 0
              ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
              : 'bg-red-600 text-white hover:bg-red-700'
          }`}
        >
          <Trash2 size={20} />
        </button>
      </div>

      {/* Info Text */}
      <p className="mt-4 text-sm text-slate-400">
        {cacheStatus.isComplete
          ? 'All audio files are cached. You can play offline without using network data.'
          : 'Download all sounds to enable offline play and reduce network usage. Sounds will also download automatically when played.'}
      </p>
    </div>
  );
};

export default AudioCacheManager;
