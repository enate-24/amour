import React, { useState, useEffect } from 'react';
import { Download, Trash2, Info } from 'lucide-react';
import { useSoundManagerWithCache } from '../hooks/useSoundManagerWithCache';

const AudioCacheManager: React.FC = () => {
  const { isReady, preloadProgress, preloadSounds, clearCache, getCacheInfo } = useSoundManagerWithCache({ preloadOnMount: false });
  const [cacheInfo, setCacheInfo] = useState<{ count: number; sizeMB: number } | null>(null);
  const [isPreloading, setIsPreloading] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const loadCacheInfo = async () => {
    if (isReady) {
      const info = await getCacheInfo();
      setCacheInfo(info);
    }
  };

  useEffect(() => {
    loadCacheInfo();
  }, [isReady]);

  const handlePreload = async () => {
    setIsPreloading(true);
    try {
      await preloadSounds();
      await loadCacheInfo();
    } catch (error) {
      console.error('Failed to preload sounds:', error);
    } finally {
      setIsPreloading(false);
    }
  };

  const handleClearCache = async () => {
    if (!confirm('Are you sure you want to clear the audio cache? This will require re-downloading all sounds.')) {
      return;
    }

    setIsClearing(true);
    try {
      await clearCache();
      await loadCacheInfo();
    } catch (error) {
      console.error('Failed to clear cache:', error);
    } finally {
      setIsClearing(false);
    }
  };

  if (!isReady) {
    return (
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <p className="text-slate-400">Initializing audio cache...</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg p-4 sm:p-6 border border-slate-700">
      <div className="flex items-center gap-2 mb-4">
        <Info className="w-5 h-5 text-blue-400" />
        <h3 className="text-lg font-bold text-white">Audio Cache Manager</h3>
      </div>

      {/* Cache Info */}
      <div className="bg-slate-700 rounded-lg p-4 mb-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-slate-400">Cached Files</p>
            <p className="text-2xl font-bold text-white">{cacheInfo?.count || 0}</p>
          </div>
          <div>
            <p className="text-sm text-slate-400">Cache Size</p>
            <p className="text-2xl font-bold text-white">{cacheInfo?.sizeMB || 0} MB</p>
          </div>
        </div>
      </div>

      {/* Preload Progress */}
      {isPreloading && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-300">Downloading sounds...</span>
            <span className="text-sm font-bold text-blue-400">{preloadProgress}%</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${preloadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-2">
        <button
          onClick={handlePreload}
          disabled={isPreloading || isClearing}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
        >
          <Download size={18} />
          {isPreloading ? 'Downloading...' : 'Download All Sounds'}
        </button>

        <button
          onClick={handleClearCache}
          disabled={isPreloading || isClearing || !cacheInfo?.count}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
        >
          <Trash2 size={18} />
          {isClearing ? 'Clearing...' : 'Clear Cache'}
        </button>
      </div>

      {/* Info Text */}
      <div className="mt-4 p-3 bg-blue-900/20 border border-blue-700/30 rounded-lg">
        <p className="text-xs text-blue-300">
          💡 <strong>Tip:</strong> Download all sounds once for faster gameplay and offline support. 
          Sounds are cached in your browser and will load instantly.
        </p>
      </div>
    </div>
  );
};

export default AudioCacheManager;
