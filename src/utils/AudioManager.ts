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
    const batchSize = 10; // Load 10 files at a time
    const timeout = 8000; // 8 seconds per file
    
    for (let start = 1; start <= 75; start += batchSize) {
      const end = Math.min(start + batchSize - 1, 75);
      const batchPromises: Promise<void>[] = [];
      
      for (let i = start; i <= end; i++) {
        const promise = new Promise<void>((resolve) => {
          const audio = new Audio();
          audio.preload = 'auto';
          audio.volume = 0.7;
          audio.src = `/sounds/${i}.mp3`;
          
          const timeoutId = setTimeout(() => {
            console.warn(`⏱️ Timeout preloading ${i}.mp3`);
            this.failedFiles.add(i);
            resolve();
          }, timeout);
          
          audio.addEventListener('canplaythrough', () => {
            clearTimeout(timeoutId);
            this.audioPool.set(i, audio);
            resolve();
          }, { once: true });
          
          audio.addEventListener('error', () => {
            clearTimeout(timeoutId);
            console.warn(`⚠️ Failed to preload ${i}.mp3`);
            this.failedFiles.add(i);
            resolve();
          }, { once: true });
          
          audio.load();
        });
        
        batchPromises.push(promise);
      }
      
      await Promise.all(batchPromises);
      console.log(`📦 Loaded batch ${start}-${end}: ${this.audioPool.size} total files loaded`);
    }
    
    this.preloadComplete = true;
    console.log(`✅ Preloading complete: ${this.audioPool.size}/75 audio files ready`);
    if (this.failedFiles.size > 0) {
      console.warn(`⚠️ ${this.failedFiles.size} files failed to preload`);
    }
  }

  async playSound(number: number): Promise<void> {
    // Skip if we know this file failed
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
      // Fallback if not preloaded yet
      console.log(`⚠️ ${number}.mp3 not preloaded, creating on-demand`);
      audio = new Audio(`/sounds/${number}.mp3`);
      audio.volume = 0.6; // Slightly lower volume to prevent distortion
      audio.preload = 'auto';
    } else {
      // Use preloaded audio - create a fresh instance to avoid conflicts
      audio = new Audio(audio.src);
      audio.volume = 0.6; // Clean volume level
      audio.preload = 'auto';
    }

    this.currentAudio = audio;
    this.isPlaying = true;

    // Clean event handling
    audio.onended = () => {
      console.log(`✅ Finished: ${number}.mp3`);
      this.isPlaying = false;
      this.currentAudio = null;
    };

    audio.onerror = () => {
      console.warn(`🔊 Play error for ${number}.mp3`);
      this.isPlaying = false;
      this.failedFiles.add(number);
      this.currentAudio = null;
    };

    // Play with proper error handling
    try {
      await audio.play();
      console.log(`▶️ Playing: ${number}.mp3`);
    } catch (error) {
      console.warn(`🔊 Play error for ${number}.mp3:`, error instanceof Error ? error.message : 'Unknown error');
      this.isPlaying = false;
      this.failedFiles.add(number);
      this.currentAudio = null;
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
