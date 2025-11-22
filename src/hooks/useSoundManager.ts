import { useRef, useEffect, useCallback } from 'react';

interface SoundManagerOptions {
  volume?: number;
  preloadOnMount?: boolean;
}

export const useSoundManager = (options: SoundManagerOptions = {}) => {
  const { volume = 0.7, preloadOnMount = true } = options;
  const audioCache = useRef<Map<string, HTMLAudioElement>>(new Map());
  const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

  // Preload sounds
  const preloadSounds = useCallback(async () => {
    console.log('🔄 Preloading sounds with SoundManager...');
    
    const soundsToPreload = [
      // Number sounds 1-75
      ...Array.from({ length: 75 }, (_, i) => `number/${i + 1}`),
      // Game sounds
      'start',
      'winner',
      'notwinner'
    ];

    const preloadPromises = soundsToPreload.map(async (soundPath) => {
      try {
        const audio = new Audio(`${API_BASE_URL}/sound/${soundPath}`);
        audio.volume = volume;
        audio.preload = 'auto';
        
        // Store in cache
        audioCache.current.set(soundPath, audio);
        
        // Start loading
        audio.load();
        
        return new Promise<void>((resolve) => {
          const onReady = () => {
            audio.removeEventListener('canplaythrough', onReady);
            audio.removeEventListener('error', onError);
            resolve();
          };
          
          const onError = () => {
            audio.removeEventListener('canplaythrough', onReady);
            audio.removeEventListener('error', onError);
            console.log(`⚠️ Failed to preload: ${soundPath}`);
            resolve(); // Don't fail the whole process
          };
          
          audio.addEventListener('canplaythrough', onReady, { once: true });
          audio.addEventListener('error', onError, { once: true });
          
          // Timeout after 3 seconds
          setTimeout(() => {
            audio.removeEventListener('canplaythrough', onReady);
            audio.removeEventListener('error', onError);
            resolve();
          }, 3000);
        });
      } catch (error) {
        console.log(`❌ Error preloading ${soundPath}:`, error);
      }
    });

    await Promise.all(preloadPromises);
    console.log(`✅ Preloaded ${audioCache.current.size} sounds`);
  }, [API_BASE_URL, volume]);

  // Play sound function
  const playSound = useCallback(async (soundPath: string): Promise<void> => {
    try {
      let audio = audioCache.current.get(soundPath);
      
      if (!audio) {
        // Create new audio if not in cache
        console.log(`⚠️ Sound ${soundPath} not preloaded, creating on-demand`);
        audio = new Audio(`${API_BASE_URL}/sound/${soundPath}`);
        audio.volume = volume;
        audioCache.current.set(soundPath, audio);
      }

      // Reset to beginning
      audio.currentTime = 0;
      
      // Play immediately without waiting
      const playPromise = audio.play();
      
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          console.log(`❌ Failed to play ${soundPath}:`, error);
        });
      }
      
      console.log(`🔊 Playing: ${soundPath}`);
    } catch (error) {
      console.log(`❌ Error playing ${soundPath}:`, error);
    }
  }, [API_BASE_URL, volume]);

  // Convenience functions
  const playNumberSound = useCallback((number: number) => {
    return playSound(`number/${number}`);
  }, [playSound]);

  const playStartSound = useCallback(() => {
    return playSound('start');
  }, [playSound]);

  const playWinnerSound = useCallback(() => {
    return playSound('winner');
  }, [playSound]);

  const playNotWinnerSound = useCallback(() => {
    return playSound('notwinner');
  }, [playSound]);

  // Cleanup function
  const cleanup = useCallback(() => {
    audioCache.current.forEach(audio => {
      audio.pause();
      audio.src = '';
    });
    audioCache.current.clear();
  }, []);

  // Preload on mount if enabled
  useEffect(() => {
    if (preloadOnMount) {
      preloadSounds();
    }

    return cleanup;
  }, [preloadOnMount, preloadSounds, cleanup]);

  return {
    playSound,
    playNumberSound,
    playStartSound,
    playWinnerSound,
    playNotWinnerSound,
    preloadSounds,
    cleanup,
    isPreloaded: (soundPath: string) => audioCache.current.has(soundPath),
    getCacheSize: () => audioCache.current.size
  };
};