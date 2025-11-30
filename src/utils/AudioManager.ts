import { audioCacheDB } from './audioCache';

// Optimized audio manager with IndexedDB caching for instant playback
export class AudioManager {
  private audioPool: Map<number, HTMLAudioElement> = new Map();
  private currentAudio: HTMLAudioElement | null = null;
  private failedFiles = new Set<number>();
  private isPlaying = false;
  private preloadComplete = false;

  constructor() {
    console.log('🔊 AudioManager initialized with IndexedDB cache - preloading sounds...');
    this.preloadSounds();
  }

  // Preload all number sounds (1-75) using IndexedDB cache OR direct URLs as fallback
  private async preloadSounds(): Promise<void> {
    // Check if cache has any files first
    const cachedIds = await audioCacheDB.getAllAudioIds();
    const useCacheOnly = cachedIds.length >= 10; // Only use cache if we have at least 10 files
    
    if (!useCacheOnly) {
      console.log('⚠️ IndexedDB cache is empty or incomplete, using direct file loading');
      // Don't try to preload from cache, just mark as complete
      // Audio will be loaded on-demand from direct URLs
      this.preloadComplete = true;
      return;
    }
    
    const batchSize = 10;
    
    for (let start = 1; start <= 75; start += batchSize) {
      const end = Math.min(start + batchSize - 1, 75);
      const batchPromises: Promise<void>[] = [];
      
      for (let i = start; i <= end; i++) {
        const promise = (async () => {
          try {
            // Get audio blob from IndexedDB cache
            const cachedBlob = await audioCacheDB.getAudio(`${i}.mp3`);
            
            if (cachedBlob) {
              // Create object URL from cached blob
              const cachedUrl = URL.createObjectURL(cachedBlob);
              
              const audio = new Audio();
              audio.preload = 'metadata';
              audio.volume = 0.7;
              audio.src = cachedUrl;
              
              await new Promise<void>((resolve) => {
                const timeoutId = setTimeout(() => {
                  URL.revokeObjectURL(cachedUrl);
                  this.failedFiles.add(i);
                  resolve();
                }, 3000);
                
                audio.addEventListener('loadedmetadata', () => {
                  clearTimeout(timeoutId);
                  this.audioPool.set(i, audio);
                  resolve();
                }, { once: true });
                
                audio.addEventListener('error', () => {
                  clearTimeout(timeoutId);
                  URL.revokeObjectURL(cachedUrl);
                  this.failedFiles.add(i);
                  resolve();
                }, { once: true });
                
                audio.load();
              });
            } else {
              this.failedFiles.add(i);
            }
          } catch (error) {
            this.failedFiles.add(i);
          }
        })();
        
        batchPromises.push(promise);
      }
      
      await Promise.all(batchPromises);
      
      if (end < 75) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    this.preloadComplete = true;
    console.log(`✅ Preloading complete from IndexedDB: ${this.audioPool.size}/75 audio files ready`);
  }

  async playSound(number: number): Promise<void> {
    // Stop current audio cleanly to prevent noise
    if (this.currentAudio && this.isPlaying) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
        // Clean up event listeners to prevent memory leaks
        this.currentAudio.onended = null;
        this.currentAudio.onerror = null;
      } catch (e) {
        // Ignore cleanup errors
      }
    }

    // Get preloaded audio or create new one
    let audio = this.audioPool.get(number);
    
    if (!audio) {
      // Try to load from IndexedDB cache first
      try {
        const cachedBlob = await audioCacheDB.getAudio(`${number}.mp3`);
        if (cachedBlob) {
          const cachedUrl = URL.createObjectURL(cachedBlob);
          audio = new Audio();
          audio.volume = 0.6;
          audio.preload = 'auto';
          audio.src = cachedUrl;
        }
      } catch (error) {
        // Ignore cache errors, will fall back to direct URL
      }
      
      // If cache failed, fall back to direct URL
      if (!audio) {
        console.log(`📥 Loading ${number}.mp3 directly from server`);
        audio = new Audio();
        audio.volume = 0.6;
        audio.preload = 'auto';
        audio.src = `/sounds/${number}.mp3`;
      }
    } else {
      // Clone preloaded audio to avoid conflicts
      const originalSrc = audio.src;
      audio = new Audio();
      audio.volume = 0.6;
      audio.preload = 'auto';
      audio.src = originalSrc;
    }

    this.currentAudio = audio;
    this.isPlaying = true;

    // Set up event handlers before attempting to play
    const cleanup = () => {
      this.isPlaying = false;
      this.currentAudio = null;
      audio.onended = null;
      audio.onerror = null;
      audio.onloadeddata = null;
    };

    audio.onended = () => {
      console.log(`✅ Finished playing: ${number}.mp3 (from IndexedDB cache)`);
      cleanup();
    };

    audio.onerror = (e) => {
      console.warn(`🔊 Play error for ${number}.mp3:`, e);
      this.failedFiles.add(number);
      cleanup();
    };

    // Try to play with timeout protection
    try {
      const playPromise = audio.play();
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Play timeout')), 3000);
      });
      
      await Promise.race([playPromise, timeoutPromise]);
      console.log(`▶️ Playing: ${number}.mp3 (from IndexedDB cache)`);
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.warn(`🔊 Play error for ${number}.mp3:`, errorMsg);
      
      // Only mark as failed if it's a real error, not user interaction
      if (!errorMsg.includes('user interaction') && !errorMsg.includes('gesture')) {
        this.failedFiles.add(number);
      }
      
      cleanup();
    }
  }

  // Wait for preloading to complete
  async waitForPreload(): Promise<void> {
    if (this.preloadComplete) return;
    
    // Poll until preload is complete (max 10 seconds)
    const startTime = Date.now();
    while (!this.preloadComplete && Date.now() - startTime < 10000) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (!this.preloadComplete) {
      console.warn('⚠️ Preload timeout - continuing anyway');
    }
  }

  // Stop current audio cleanly
  stopCurrent(): void {
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
        // Clean up event listeners
        this.currentAudio.onended = null;
        this.currentAudio.onerror = null;
      } catch (e) {
        // Ignore cleanup errors
      }
      this.currentAudio = null;
      this.isPlaying = false;
      console.log('🛑 Stopped current audio');
    }
  }

  // Check if preloading is complete
  isReady(): boolean {
    return this.preloadComplete;
  }

  // Check if audio is currently playing
  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  // Cleanup with proper audio disposal
  cleanup(): void {
    this.stopCurrent();
    
    // Clean up all preloaded audio elements
    this.audioPool.forEach((audio) => {
      try {
        audio.pause();
        audio.currentTime = 0;
        audio.onended = null;
        audio.onerror = null;
        audio.src = '';
      } catch (e) {
        // Ignore cleanup errors
      }
    });
    
    this.audioPool.clear();
    this.failedFiles.clear();
  }
}
