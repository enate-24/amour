import { useState, useEffect, useCallback } from 'react';
import { audioCacheDB, downloadAndCacheAudio, getAudioUrl, preloadAudioFiles } from '../utils/audioCache';

interface UseAudioCacheReturn {
  isReady: boolean;
  playAudio: (url: string, id: string) => Promise<void>;
  preloadNumbers: (numbers: number[]) => Promise<void>;
  clearCache: () => Promise<void>;
  getCacheInfo: () => Promise<{ count: number; size: number }>;
}

export function useAudioCache(): UseAudioCacheReturn {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Initialize IndexedDB
    audioCacheDB.init()
      .then(() => {
        setIsReady(true);
        console.log('✅ Audio cache ready');
      })
      .catch(error => {
        console.error('❌ Failed to initialize audio cache:', error);
        setIsReady(true); // Continue anyway, will fallback to direct URLs
      });
  }, []);

  const playAudio = useCallback(async (url: string, id: string): Promise<void> => {
    try {
      const audioUrl = await getAudioUrl(url, id);
      const audio = new Audio(audioUrl);
      audio.volume = 0.7;
      
      await audio.play();
      
      // Clean up object URL after playing
      audio.addEventListener('ended', () => {
        URL.revokeObjectURL(audioUrl);
      });
    } catch (error) {
      console.error(`❌ Failed to play audio ${id}:`, error);
      throw error;
    }
  }, []);

  const preloadNumbers = useCallback(async (numbers: number[]): Promise<void> => {
    const files = numbers.map(num => ({
      url: `/sounds/numbers/${num}.mp3`,
      id: `number-${num}`
    }));

    await preloadAudioFiles(files);
  }, []);

  const clearCache = useCallback(async (): Promise<void> => {
    await audioCacheDB.clearAll();
    console.log('✅ Audio cache cleared');
  }, []);

  const getCacheInfo = useCallback(async (): Promise<{ count: number; size: number }> => {
    const ids = await audioCacheDB.getAllAudioIds();
    const size = await audioCacheDB.getCacheSize();
    
    return {
      count: ids.length,
      size: Math.round(size / 1024 / 1024 * 100) / 100 // Size in MB
    };
  }, []);

  return {
    isReady,
    playAudio,
    preloadNumbers,
    clearCache,
    getCacheInfo
  };
}
