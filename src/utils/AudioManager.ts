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

  // Preload all number sounds (1-75)
  private async preloadSounds(): Promise<void> {
    const preloadPromises: Promise<void>[] = [];
    
    for (let i = 1; i <= 75; i++) {
      const promise = new Promise<void>((resolve) => {
        const audio = new Audio();
        audio.preload = 'auto';
        audio.volume = 0.7;
        audio.src = `/sounds/${i}.wav`;
        
        // Add timeout to prevent hanging on slow loads
        const timeout = setTimeout(() => {
          console.warn(`⏱️ Timeout preloading ${i}.wav`);
          this.failedFiles.add(i);
          resolve();
        }, 3000);
        
        audio.addEventListener('canplaythrough', () => {
          clearTimeout(timeout);
          this.audioPool.set(i, audio);
          resolve();
        }, { once: true });
        
        audio.addEventListener('error', () => {
          clearTimeout(timeout);
          console.warn(`⚠️ Failed to preload ${i}.wav`);
          this.failedFiles.add(i);
          resolve();
        }, { once: true });
        
        // Load the audio
        audio.load();
      });
      
      preloadPromises.push(promise);
    }
    
    await Promise.all(preloadPromises);
    this.preloadComplete = true;
    console.log(`✅ Preloaded ${this.audioPool.size}/75 audio files`);
    if (this.failedFiles.size > 0) {
      console.warn(`⚠️ ${this.failedFiles.size} files failed to preload`);
    }
  }

  async playSound(number: number): Promise<void> {
    // Skip if we know this file failed
    if (this.failedFiles.has(number)) {
      console.warn(`⏭️ Skipping ${number}.wav - known failed file`);
      return;
    }

    // Stop current audio immediately to prevent stacking
    if (this.currentAudio && this.isPlaying) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch (e) {
        // Ignore
      }
    }

    // Get preloaded audio or create new one
    let audio = this.audioPool.get(number);
    
    if (!audio) {
      // Fallback if not preloaded yet
      console.log(`⚠️ ${number}.wav not preloaded, creating on-demand`);
      audio = new Audio(`/sounds/${number}.wav`);
      audio.volume = 0.7;
    } else {
      // Reset preloaded audio to start
      try {
        audio.currentTime = 0;
      } catch (e) {
        // If reset fails, clone the audio
        const newAudio = audio.cloneNode() as HTMLAudioElement;
        newAudio.volume = 0.7;
        audio = newAudio;
      }
    }

    this.currentAudio = audio;
    this.isPlaying = true;

    // Play immediately
    try {
      await audio.play();
      console.log(`▶️ Playing: ${number}.wav`);
    } catch (error) {
      console.warn(`🔊 Play error for ${number}.wav:`, error instanceof Error ? error.message : 'Unknown error');
      this.isPlaying = false;
      this.failedFiles.add(number);
    }

    // Handle end event
    audio.onended = () => {
      console.log(`✅ Finished: ${number}.wav`);
      this.isPlaying = false;
      this.currentAudio = null;
    };
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

  // Stop current audio
  stopCurrent(): void {
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch (e) {
        // Ignore
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

  // Cleanup
  cleanup(): void {
    this.stopCurrent();
    this.audioPool.clear();
    this.failedFiles.clear();
  }
}
