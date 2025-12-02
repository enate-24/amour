import { useState, useEffect, useCallback } from 'react';
import { UnifiedAudioManager } from '../utils/UnifiedAudioManager';
import type { CacheStatus } from '../utils/audioCache';

interface UseAudioManagerReturn {
  isReady: boolean;
  cacheStatus: CacheStatus | null;
  playSound: (number: number | string) => Promise<void>;
  preloadSound: (number: number | string) => Promise<void>;
  downloadAll: () => Promise<void>;
  clearCache: () => Promise<void>;
  downloadProgress: number;
  isDownloading: boolean;
}

/**
 * React hook for accessing UnifiedAudioManager
 * 
 * Usage:
 * ```tsx
 * const { playSound, cacheStatus, isReady } = useAudioManager();
 * 
 * // Play a sound
 * await playSound(42);
 * 
 * // Check cache status
 * console.log(`${cacheStatus.cachedFiles}/${cacheStatus.totalFiles} cached`);
 * ```
 */
export function useAudioManager(): UseAudioManagerReturn {
  const [isReady, setIsReady] = useState(false);
  const [cacheStatus, setCacheStatus] = useState<CacheStatus | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);

  const audioManager = UnifiedAudioManager.getInstance();

  // Initialize on mount
  useEffect(() => {
    const init = async () => {
      try {
        if (!audioManager.isInitialized()) {
          await audioManager.initialize();
        }
        setIsReady(true);
        
        // Load initial cache status
        const status = await audioManager.getCacheStatus();
        setCacheStatus(status);
      } catch (error) {
        console.error('Failed to initialize audio manager:', error);
        setIsReady(false);
      }
    };

    init();
  }, []);

  // Play sound wrapper
  const playSound = useCallback(async (number: number | string) => {
    try {
      await audioManager.playSound(number);
      
      // Update cache status after playing (in case it was downloaded)
      const status = await audioManager.getCacheStatus();
      setCacheStatus(status);
    } catch (error) {
      console.error(`Failed to play sound ${number}:`, error);
      throw error;
    }
  }, []);

  // Preload sound wrapper
  const preloadSound = useCallback(async (number: number | string) => {
    try {
      await audioManager.preloadSound(number);
      
      // Update cache status after preloading
      const status = await audioManager.getCacheStatus();
      setCacheStatus(status);
    } catch (error) {
      console.error(`Failed to preload sound ${number}:`, error);
      throw error;
    }
  }, []);

  // Download all sounds
  const downloadAll = useCallback(async () => {
    setIsDownloading(true);
    setDownloadProgress(0);

    try {
      await audioManager.downloadMissingAudio((current, total) => {
        const progress = Math.round((current / total) * 100);
        setDownloadProgress(progress);
      });

      // Update cache status
      const status = await audioManager.getCacheStatus();
      setCacheStatus(status);
    } catch (error) {
      console.error('Failed to download all sounds:', error);
      throw error;
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  }, []);

  // Clear cache
  const clearCache = useCallback(async () => {
    try {
      const { audioCacheDB } = await import('../utils/audioCache');
      await audioCacheDB.clearAll();
      
      // Update cache status
      const status = await audioManager.getCacheStatus();
      setCacheStatus(status);
    } catch (error) {
      console.error('Failed to clear cache:', error);
      throw error;
    }
  }, []);

  return {
    isReady,
    cacheStatus,
    playSound,
    preloadSound,
    downloadAll,
    clearCache,
    downloadProgress,
    isDownloading
  };
}
