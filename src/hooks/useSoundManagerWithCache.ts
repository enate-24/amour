import { useRef, useEffect, useCallback, useState } from 'react';
import { getAudioUrl, preloadAudioFiles, audioCacheDB } from '../utils/audioCache';

interface SoundManagerOptions {
  volume?: number;
  preloadOnMount?: boolean;
}

export const useSoundManagerWithCache = (options: SoundManagerOptions = {}) => {
  const { volume = 0.7, preloadOnMount = true } = options;
  const [isReady, setIsReady] = useState(false);
  const [preloadProgress, setPreloadProgress] = useState(0);
  const audioCache = useRef<Map<string, string>>(new Map()); // Store object URLs
  const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

  // Initialize IndexedDB
  useEffect(() => {
    audioCacheDB.init()
      .then(() => {
        console.log('✅ Audio cache initialized');
        setIsReady(true);
      })
      .catch(error => {
        console.error('❌ Failed to initialize audio cache:', error);
        setIsReady(true); // Continue anyway
      });
  }, []);

  // Preload sounds with IndexedDB caching
  const preloadSounds = useCallback(async () => {
    if (!isReady) {
      console.log('⏳ Waiting for audio cache to be ready...');
      return;
    }

    console.log('🔄 Preloading sounds with IndexedDB cache...');
    
    const soundsToPreload = [
      // Number sounds 1-75
      ...Array.from({ length: 75 }, (_, i) => ({
        url: `${API_BASE_URL}/sound/number/${i + 1}`,
        id: `number-${i + 1}`
      })),
      // Game sounds
      { url: `${API_BASE_URL}/sound/start`, id: 'start' },
      { url: `${API_BASE_URL}/sound/winner`, id: 'winner' },
      { url: `${API_BASE_URL}/sound/notwinner`, id: 'notwinner' }
    ];

    const total = soundsToPreload.length;
    let loaded = 0;

    // Preload in batches to avoid overwhelming the browser
    const batchSize = 10;
    for (let i = 0; i < soundsToPreload.length; i += batchSize) {
      const batch = soundsToPreload.slice(i, i + batchSize);
      
      await preloadAudioFiles(batch);
      
      loaded += batch.length;
      setPreloadProgress(Math.round((loaded / total) * 100));
    }

    console.log('✅ All sounds preloaded to IndexedDB');
    setPreloadProgress(100);
  }, [API_BASE_URL, isReady]);

  // Preload on mount if enabled
  useEffect(() => {
    if (preloadOnMount && isReady) {
      preloadSounds();
    }
  }, [preloadOnMount, preloadSounds, isReady]);

  // Play sound from cache
  const playSound = useCallback(async (soundPath: string): Promise<void> => {
    try {
      // Check if we have the object URL cached
      let objectUrl = audioCache.current.get(soundPath);
      
      if (!objectUrl) {
        // Get from IndexedDB or download
        const url = `${API_BASE_URL}/sound/${soundPath}`;
        const id = soundPath.replace(/\//g, '-');
        objectUrl = await getAudioUrl(url, id);
        audioCache.current.set(soundPath, objectUrl);
      }

      const audio = new Audio(objectUrl);
      audio.volume = volume;
      
      await audio.play();
      
      console.log(`🔊 Playing sound: ${soundPath}`);
    } catch (error) {
      console.error(`❌ Failed to play sound: ${soundPath}`, error);
      throw error;
    }
  }, [API_BASE_URL, volume]);

  // Play number sound
  const playNumber = useCallback(async (number: number): Promise<void> => {
    return playSound(`number/${number}`);
  }, [playSound]);

  // Play game sound
  const playGameSound = useCallback(async (sound: 'start' | 'winner' | 'notwinner'): Promise<void> => {
    return playSound(sound);
  }, [playSound]);

  // Clear cache
  const clearCache = useCallback(async (): Promise<void> => {
    // Clear object URLs
    audioCache.current.forEach(url => URL.revokeObjectURL(url));
    audioCache.current.clear();
    
    // Clear IndexedDB
    await audioCacheDB.clearAll();
    
    console.log('✅ Audio cache cleared');
  }, []);

  // Get cache info
  const getCacheInfo = useCallback(async () => {
    const ids = await audioCacheDB.getAllAudioIds();
    const size = await audioCacheDB.getCacheSize();
    
    return {
      count: ids.length,
      sizeMB: Math.round(size / 1024 / 1024 * 100) / 100
    };
  }, []);

  return {
    isReady,
    preloadProgress,
    playSound,
    playNumber,
    playGameSound,
    preloadSounds,
    clearCache,
    getCacheInfo
  };
};
