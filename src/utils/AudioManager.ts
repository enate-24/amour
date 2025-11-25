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
        
        audio.addEventListener('canplaythrough', () => {
          this.audioPool.set(i, audio);
          resolve();
        }, { once: true });
        
        audio.addEventListener('error', () => {
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
    console.log(`✅ Preloaded ${this.audioPool.size} audio files`);
  }

  playSound(number: number): void {
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
      audio.currentTime = 0;
    }

    this.currentAudio = audio;
    this.isPlaying = true;

    // Play immediately
    audio.play()
      .then(() => {
        console.log(`▶️ Playing: ${number}.wav`);
      })
      .catch((error) => {
        console.warn(`🔊 Play error for ${number}.wav:`, error.message);
        this.isPlaying = false;
        this.failedFiles.add(number);
      });

    // Handle end event
    audio.onended = () => {
      console.log(`✅ Finished: ${number}.wav`);
      this.isPlaying = false;
      this.currentAudio = null;
    };
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
