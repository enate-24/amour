// Optimized audio manager with preloading for instant playback
export class AudioManager {
  private audioPool: Map<number, HTMLAudioElement> = new Map();
  private currentAudio: HTMLAudioElement | null = null;
  private failedFiles = new Set<number>();
  private isPlaying = false;
  private preloadComplete = false;

  constructor() {
    console.log('🔊 AudioManager initialized - preloading sounds...');
    this.preloadSounds();
  }

  // Preload all number sounds (1-75) in batches to avoid browser limits
  private async preloadSounds(): Promise<void> {
    const batchSize = 5; // Smaller batches to reduce browser load
    const timeout = 5000; // Shorter timeout per file
    
    for (let start = 1; start <= 75; start += batchSize) {
      const end = Math.min(start + batchSize - 1, 75);
      const batchPromises: Promise<void>[] = [];
      
      for (let i = start; i <= end; i++) {
        const promise = new Promise<void>((resolve) => {
          const audio = new Audio();
          audio.preload = 'metadata'; // Load metadata only, not full audio
          audio.volume = 0.7;
          audio.src = `/sounds/${i}.mp3`;
          
          const timeoutId = setTimeout(() => {
            console.warn(`⏱️ Timeout preloading ${i}.mp3 - will load on demand`);
            this.failedFiles.add(i);
            resolve();
          }, timeout);
          
          // Use 'loadedmetadata' instead of 'canplaythrough' for faster loading
          audio.addEventListener('loadedmetadata', () => {
            clearTimeout(timeoutId);
            this.audioPool.set(i, audio);
            resolve();
          }, { once: true });
          
          audio.addEventListener('error', (e) => {
            clearTimeout(timeoutId);
            console.warn(`⚠️ Failed to preload ${i}.mp3:`, e);
            this.failedFiles.add(i);
            resolve();
          }, { once: true });
          
          // Add load event as fallback
          audio.addEventListener('load', () => {
            clearTimeout(timeoutId);
            if (!this.audioPool.has(i)) {
              this.audioPool.set(i, audio);
            }
            resolve();
          }, { once: true });
          
          try {
            audio.load();
          } catch (error) {
            clearTimeout(timeoutId);
            console.warn(`⚠️ Error loading ${i}.mp3:`, error);
            this.failedFiles.add(i);
            resolve();
          }
        });
        
        batchPromises.push(promise);
      }
      
      await Promise.all(batchPromises);
      console.log(`📦 Loaded batch ${start}-${end}: ${this.audioPool.size} total files loaded`);
      
      // Small delay between batches to prevent overwhelming the browser
      if (end < 75) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    this.preloadComplete = true;
    console.log(`✅ Preloading complete: ${this.audioPool.size}/75 audio files ready`);
    if (this.failedFiles.size > 0) {
      console.warn(`⚠️ ${this.failedFiles.size} files failed to preload - will load on demand`);
    }
  }

  async playSound(number: number): Promise<void> {
    // Skip if we know this file failed multiple times
    if (this.failedFiles.has(number)) {
      console.warn(`⏭️ Skipping ${number}.mp3 - known failed file`);
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

    // Get preloaded audio or create new one
    let audio = this.audioPool.get(number);
    
    if (!audio) {
      // Fallback if not preloaded yet - create fresh audio
      console.log(`⚠️ ${number}.mp3 not preloaded, creating on-demand`);
      audio = new Audio();
      audio.volume = 0.6;
      audio.preload = 'auto';
      audio.src = `/sounds/${number}.mp3`;
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
      console.log(`✅ Finished: ${number}.mp3`);
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
      console.log(`▶️ Playing: ${number}.mp3`);
      
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
