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

  // Preload all number sounds (1-75) using IndexedDB cache
  private async preloadSounds(): Promise<void> {
    const batchSize = 10; // Can use larger batches with IndexedDB
    
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
                  console.warn(`⏱️ Timeout preloading ${i}.mp3 from cache`);
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
                  console.warn(`⚠️ Failed to preload ${i}.mp3 from cache`);
                  URL.revokeObjectURL(cachedUrl);
                  this.failedFiles.add(i);
                  resolve();
                }, { once: true });
                
                audio.load();
              });
            } else {
              console.warn(`⚠️ ${i}.mp3 not found in cache`);
              this.failedFiles.add(i);
            }
          } catch (error) {
            console.warn(`⚠️ Error preloading ${i}.mp3:`, error);
            this.failedFiles.add(i);
          }
        })();
        
        batchPromises.push(promise);
      }
      
      await Promise.all(batchPromises);
      console.log(`📦 Loaded batch ${start}-${end} from IndexedDB: ${this.audioPool.size} total files loaded`);
      
      // Small delay between batches
      if (end < 75) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    this.preloadComplete = true;
    console.log(`✅ Preloading complete from IndexedDB: ${this.audioPool.size}/75 audio files ready`);
    if (this.failedFiles.size > 0) {
      console.warn(`⚠️ ${this.failedFiles.size} files not available in cache`);
    }
  }

  async playSound(number: number): Promise<void> {
    // Skip if we know this file failed multiple times
    if (this.failedFiles.has(number)) {
      console.warn(`⏭️ Skipping ${number}.mp3 - not available in cache`);
      return;
    }

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

    // Get preloaded audio or create new one from cache
    let audio = this.audioPool.get(number);
    
    if (!audio) {
      // Fallback if not preloaded yet - load from IndexedDB cache on-demand
      console.log(`⚠️ ${number}.mp3 not preloaded, loading from cache on-demand`);
      try {
        const cachedBlob = await audioCacheDB.getAudio(`${number}.mp3`);
        if (cachedBlob) {
          const cachedUrl = URL.createObjectURL(cachedBlob);
          audio = new Audio();
          audio.volume = 0.6;
          audio.preload = 'auto';
          audio.src = cachedUrl;
        } else {
          console.warn(`❌ ${number}.mp3 not found in IndexedDB cache`);
          this.failedFiles.add(number);
          return;
        }
      } catch (error) {
        console.warn(`❌ Error loading ${number}.mp3 from cache:`, error);
        this.failedFiles.add(number);
        return;
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
