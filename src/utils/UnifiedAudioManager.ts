import { audioCacheDB, type CacheStatus } from './audioCache';
import { networkStatusManager } from './networkStatus';

/**
 * Voice category type for audio selection
 */
export type VoiceCategory = 'boy' | 'girl';

/**
 * Configuration interface for UnifiedAudioManager
 */
export interface AudioManagerConfig {
  maxConcurrentDownloads: number;
  retryAttempts: number;
  retryDelay: number;
  preloadOnInit?: boolean;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: AudioManagerConfig = {
  maxConcurrentDownloads: 5,
  retryAttempts: 3,
  retryDelay: 1000, // 1 second base delay
  preloadOnInit: false
  // No defaultVoiceCategory - must be set explicitly
};

/**
 * Progress callback type for download operations
 */
export type ProgressCallback = (current: number, total: number) => void;

/**
 * UnifiedAudioManager - Singleton class for managing all audio operations
 * 
 * Features:
 * - Singleton pattern ensures only one instance exists
 * - Smart caching with IndexedDB
 * - Concurrent download limiting
 * - Audio pool for preloaded elements
 * - Download queue management
 * 
 * **Feature: network-optimization, Property 7: Singleton audio manager**
 */
export class UnifiedAudioManager {
  private static instance: UnifiedAudioManager | null = null;
  private audioPool: Map<string, HTMLAudioElement> = new Map(); // Changed to string key for voice categories
  private downloadQueue: Set<string> = new Set();
  private activeDownloads: number = 0;
  private config: AudioManagerConfig;
  private initialized: boolean = false;
  private currentAudio: HTMLAudioElement | null = null;
  private currentVoiceCategory: VoiceCategory;
  private voiceCategoryExplicitlySet: boolean = false;

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor(config?: Partial<AudioManagerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    // No default voice category - must be set explicitly via setVoiceCategory()
    this.currentVoiceCategory = 'girl'; // Temporary until setVoiceCategory is called
    console.log('🔊 UnifiedAudioManager instance created with config:', this.config);
    console.log('⚠️ Voice category not set - must call setVoiceCategory() before playing audio');
  }

  /**
   * Get the singleton instance of UnifiedAudioManager
   * 
   * @param config - Optional configuration (only used on first call)
   * @returns The singleton instance
   */
  public static getInstance(config?: Partial<AudioManagerConfig>): UnifiedAudioManager {
    if (!UnifiedAudioManager.instance) {
      UnifiedAudioManager.instance = new UnifiedAudioManager(config);
    }
    return UnifiedAudioManager.instance;
  }

  /**
   * Initialize the audio manager and check cache status
   * 
   * @returns Promise that resolves when initialization is complete
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('✅ UnifiedAudioManager already initialized');
      return;
    }

    try {
      console.log('🔄 Initializing UnifiedAudioManager...');
      
      // Initialize IndexedDB
      await audioCacheDB.init();
      
      // Get initial cache status
      const status = await this.getCacheStatus();
      console.log(`📊 Cache status: ${status.cachedFiles}/${status.totalFiles} files cached`);
      
      // Auto-preload is now handled by AutoPreloader component to avoid duplicates
      // Just log the status for debugging
      if (!status.isComplete) {
        console.log(`📊 ${status.missingFiles.length} audio files missing - will be handled by AutoPreloader`);
      }
      
      this.initialized = true;
      console.log('✅ UnifiedAudioManager initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize UnifiedAudioManager:', error);
      // Mark as initialized anyway to allow fallback behavior
      this.initialized = true;
      throw error;
    }
  }

  /**
   * Get the current cache status
   * 
   * @returns Promise resolving to cache status information
   */
  public async getCacheStatus(): Promise<CacheStatus> {
    try {
      const status = await audioCacheDB.getCacheStatus();
      return status;
    } catch (error) {
      console.error('❌ Failed to get cache status:', error);
      // Return empty status on error
      return {
        totalFiles: 78,
        cachedFiles: 0,
        missingFiles: [],
        cacheSize: 0,
        isComplete: false,
        lastUpdated: 0
      };
    }
  }

  /**
   * Download missing audio files with progress tracking
   * 
   * @param onProgress - Optional callback for progress updates
   * @returns Promise that resolves when all downloads complete
   */
  public async downloadMissingAudio(onProgress?: ProgressCallback): Promise<void> {
    try {
      // Prevent concurrent downloads
      if (this.activeDownloads > 0) {
        console.log('⚠️ Download already in progress, skipping duplicate request');
        return;
      }
      
      console.log('📥 Starting download of missing audio files...');
      
      // Get cache status to find missing files
      const status = await this.getCacheStatus();
      const missingFiles = status.missingFiles;
      
      if (missingFiles.length === 0) {
        console.log('✅ All audio files already cached');
        onProgress?.(status.totalFiles, status.totalFiles);
        return;
      }

      console.log(`📥 Need to download ${missingFiles.length} missing files`);
      console.log(`📊 Cache status: ${status.cachedFiles} cached, ${status.totalFiles} total expected`);
      console.log(`📋 Missing files sample:`, missingFiles.slice(0, 5));
      console.log(`📋 Expected total files: ${status.totalFiles} (should be 156: 79 boy + 77 girl)`);
      
      if (missingFiles.length > 200) {
        console.error(`🚨 DUPLICATE FILES DETECTED: ${missingFiles.length} missing files is too many!`);
        console.log(`📋 All missing files:`, missingFiles);
        return; // Don't download if there are duplicates
      }
      
      let completed = status.cachedFiles;
      const total = status.totalFiles;
      
      // Process downloads with concurrency limit
      const downloadPromises: Promise<void>[] = [];
      
      for (const cacheKey of missingFiles) {
        // Parse voice category and file ID from cache key (e.g., "boy_1.wav" -> category="boy", fileId="1.wav")
        const [category, ...fileIdParts] = cacheKey.split('_');
        const fileId = fileIdParts.join('_'); // Handle files with underscores in name
        
        if (!category || !fileId || (category !== 'boy' && category !== 'girl')) {
          console.warn(`⚠️ Invalid cache key format: ${cacheKey}`);
          continue;
        }
        
        // Wait if we've reached the concurrent download limit
        while (this.activeDownloads >= this.config.maxConcurrentDownloads) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Add to download queue
        this.downloadQueue.add(cacheKey);
        this.activeDownloads++;
        
        // Start download with proper voice category
        const downloadPromise = this.downloadFile(fileId, category as VoiceCategory)
          .then(() => {
            completed++;
            onProgress?.(completed, total);
          })
          .catch(error => {
            console.error(`❌ Failed to download ${fileId} (${category}):`, error);
          })
          .finally(() => {
            this.downloadQueue.delete(cacheKey);
            this.activeDownloads--;
          });
        
        downloadPromises.push(downloadPromise);
      }
      
      // Wait for all downloads to complete
      await Promise.all(downloadPromises);
      
      console.log('✅ All missing audio files downloaded');
    } catch (error) {
      console.error('❌ Error downloading missing audio:', error);
      throw error;
    }
  }

  /**
   * Set the current voice category for audio playback
   * 
   * @param category - The voice category to use ('boy' or 'girl')
   */
  public setVoiceCategory(category: VoiceCategory): void {
    if (this.currentVoiceCategory !== category) {
      console.log(`🎤 Switching voice category from ${this.currentVoiceCategory} to ${category}`);
      this.currentVoiceCategory = category;
      this.voiceCategoryExplicitlySet = true;
      
      // Clear audio pool when switching categories to force reload with new voice
      this.clearAudioPool();
      console.log('🧹 Audio pool cleared for voice category switch');
    } else {
      console.log(`🎤 Voice category already set to ${category}, no change needed`);
      this.voiceCategoryExplicitlySet = true;
    }
  }

  /**
   * Clear the audio pool (useful when switching voice categories)
   */
  private clearAudioPool(): void {
    // Stop and cleanup existing audio elements
    this.audioPool.forEach((audio) => {
      try {
        audio.pause();
        audio.src = '';
      } catch (error) {
        // Ignore cleanup errors
      }
    });
    this.audioPool.clear();
    console.log('🧹 Audio pool cleared');
  }

  /**
   * Get the current voice category
   * 
   * @returns The current voice category
   */
  public getVoiceCategory(): VoiceCategory {
    return this.currentVoiceCategory;
  }

  /**
   * Check if voice category has been explicitly set
   * 
   * @returns True if voice category has been set by user
   */
  public hasVoiceCategorySet(): boolean {
    return this.voiceCategoryExplicitlySet;
  }

  /**
   * Get audio URL with voice category and CDN support
   * 
   * @param fileId - The file identifier (e.g., "1.mp3", "start.wav")
   * @param voiceCategory - Optional voice category override
   * @returns URL string (CDN or local)
   */
  private getAudioUrl(fileId: string, voiceCategory?: VoiceCategory): string {
    const category = voiceCategory || this.currentVoiceCategory;
    const cdnEnabled = import.meta.env.VITE_CDN_ENABLED === 'true';
    const cdnBaseUrl = import.meta.env.VITE_CDN_BASE_URL || '';
    
    // Determine file extension based on voice category and file type
    let actualFileId = fileId;
    
    if (fileId.match(/^\d+\.(mp3|wav)$/)) {
      // For numbered files, use appropriate extension
      const number = fileId.split('.')[0];
      actualFileId = category === 'boy' ? `${number}.wav` : `${number}.mp3`;
    } else if (fileId === 'winner') {
      // Winner sound files
      actualFileId = category === 'boy' ? 'winner.wav' : 'winner.mp3';
    } else if (fileId === 'notwinner') {
      // Notwinner sound - only for boy voice
      if (category === 'boy') {
        actualFileId = 'notwinner.wav';
      } else {
        // This shouldn't be called for girl voice due to early return in playSound
        console.warn('⚠️ getAudioUrl called for girl notwinner - this should not happen');
        return ''; // Return empty string as fallback
      }
    } else if (fileId === 'start') {
      // Start sound - only for boy voice
      if (category === 'boy') {
        actualFileId = 'start.wav';
      } else {
        // This shouldn't be called for girl voice due to early return in playSound
        console.warn('⚠️ getAudioUrl called for girl start - this should not happen');
        return ''; // Return empty string as fallback
      }
    } else if (fileId.includes('shuffle-audio')) {
      // Shuffle sound - same file for both
      actualFileId = 'shuffle-audio-TfqyAnvz.mp3';
    }
    
    const voicePath = `${category} sound`;
    
    if (cdnEnabled && cdnBaseUrl) {
      const cdnUrl = `${cdnBaseUrl}/sounds/${voicePath}/${actualFileId}`;
      console.log(`🌐 Using CDN URL (${category}): ${cdnUrl}`);
      return cdnUrl;
    }
    
    // Fallback to local
    const localUrl = `/sounds/${voicePath}/${actualFileId}`;
    console.log(`🔊 Using local URL (${category}): ${localUrl}`);
    return localUrl;
  }

  /**
   * Download a single audio file (with offline detection and voice category support)
   * 
   * @param fileId - The file identifier (e.g., "1.mp3", "start.wav")
   * @param voiceCategory - Optional voice category override
   * @returns Promise that resolves when download completes
   */
  private async downloadFile(fileId: string, voiceCategory?: VoiceCategory): Promise<void> {
    // Check if offline
    if (networkStatusManager.isOffline) {
      console.warn(`📡 Offline: Cannot download ${fileId}`);
      throw new Error('Network offline - cannot download audio');
    }

    const category = voiceCategory || this.currentVoiceCategory;
    const url = this.getAudioUrl(fileId, category);
    const cacheKey = `${category}_${fileId}`;
    
    try {
      console.log(`📥 Downloading (${category}): ${fileId} from ${url}`);
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      
      // Validate blob
      if (blob.size === 0) {
        throw new Error('Downloaded file is empty');
      }
      
      // Save to cache with voice category prefix
      await audioCacheDB.saveAudio(cacheKey, blob);
      
      console.log(`✅ Downloaded and cached (${category}): ${fileId}`);
    } catch (error) {
      console.error(`❌ Failed to download ${fileId} (${category}):`, error);
      throw error;
    }
  }

  /**
   * Play a sound by number (optimized with audio pool and offline support)
   * 
   * @param number - The number to play (1-75) or special sound name
   * @param voiceCategory - Optional voice category override
   * @returns Promise that resolves when playback starts
   */
  public async playSound(number: number | string, voiceCategory?: VoiceCategory): Promise<void> {
    try {
      // Stop any currently playing sound
      this.stopCurrentSound();
      
      const category = voiceCategory || this.currentVoiceCategory;
      
      // Check for silent sounds in girl voice category
      if (category === 'girl' && typeof number === 'string') {
        if (number === 'start' || number === 'notwinner') {
          console.log(`🔇 Girl voice: ${number} sound is silent - not playing any sound`);
          return; // Exit early for silent sounds
        }
      }
      
      // Warn if voice category hasn't been explicitly set
      if (!voiceCategory && !this.voiceCategoryExplicitlySet) {
        console.warn('⚠️ Playing audio with default voice category - user should select a voice in Settings');
      }
      
      // Determine file ID based on voice category
      let fileId: string;
      if (typeof number === 'string') {
        fileId = number;
      } else {
        // Use appropriate extension for voice category
        fileId = category === 'boy' ? `${number}.wav` : `${number}.mp3`;
      }
      
      const poolKey = `${category}_${fileId}`;
      const cacheKey = `${category}_${fileId}`;
      
      // Check if we have a pre-loaded audio element in the pool
      if (this.audioPool.has(poolKey)) {
        const audio = this.audioPool.get(poolKey)!;
        this.currentAudio = audio;
        
        // Reset and play
        audio.currentTime = 0;
        await audio.play();
        console.log(`⚡ Playing from pool (${category}): ${fileId}`);
        return;
      }
      
      // Not in pool - check cache and create new audio element
      let audioUrl: string;
      const cachedBlob = await audioCacheDB.getAudio(cacheKey);
      
      if (cachedBlob) {
        // Use cached audio (works offline)
        audioUrl = URL.createObjectURL(cachedBlob);
        console.log(`🔊 Playing cached audio (${category}): ${fileId}${networkStatusManager.isOffline ? ' (offline mode)' : ''}`);
      } else {
        // Check if offline
        if (networkStatusManager.isOffline) {
          console.error(`❌ Cannot play ${fileId} (${category}): offline and not cached`);
          throw new Error(`Audio not available offline: ${fileId} (${category})`);
        }

        // Download on-demand
        console.log(`📥 Audio not cached, downloading on-demand (${category}): ${fileId}`);
        await this.downloadFile(fileId, category);
        
        // Get from cache after download
        const blob = await audioCacheDB.getAudio(cacheKey);
        if (!blob) {
          throw new Error(`Failed to cache ${fileId} (${category})`);
        }
        audioUrl = URL.createObjectURL(blob);
      }
      
      // Create and play audio
      const audio = new Audio(audioUrl);
      audio.volume = 0.7;
      this.currentAudio = audio;
      
      // Add to pool for future use
      this.audioPool.set(poolKey, audio);
      
      // Clean up object URL after playback (but keep audio element in pool)
      audio.addEventListener('ended', () => {
        if (this.currentAudio === audio) {
          this.currentAudio = null;
        }
      });
      
      audio.addEventListener('error', (e) => {
        console.error(`❌ Error playing audio ${fileId} (${category}):`, e);
        URL.revokeObjectURL(audioUrl);
        if (this.currentAudio === audio) {
          this.currentAudio = null;
        }
        // Remove from pool on error
        this.audioPool.delete(poolKey);
      });
      
      await audio.play();
      console.log(`✅ Playing (${category}): ${fileId}`);
    } catch (error) {
      console.error(`❌ Failed to play sound ${number}:`, error);
      throw error;
    }
  }

  /**
   * Preload a sound into the audio pool
   * 
   * @param number - The number to preload (1-75) or special sound name
   * @param voiceCategory - Optional voice category override
   * @returns Promise that resolves when preload completes
   */
  public async preloadSound(number: number | string, voiceCategory?: VoiceCategory): Promise<void> {
    try {
      const category = voiceCategory || this.currentVoiceCategory;
      
      // Skip preloading silent sounds for girl voice
      if (category === 'girl' && typeof number === 'string') {
        if (number === 'start' || number === 'notwinner') {
          console.log(`🔇 Skipping preload for girl voice silent sound: ${number}`);
          return; // Exit early for silent sounds
        }
      }
      
      let fileId: string;
      
      if (typeof number === 'string') {
        fileId = number;
      } else {
        fileId = category === 'boy' ? `${number}.wav` : `${number}.mp3`;
      }
      
      const cacheKey = `${category}_${fileId}`;
      
      // Check if already cached
      const hasAudio = await audioCacheDB.hasAudio(cacheKey);
      if (hasAudio) {
        console.log(`✅ Audio already cached (${category}): ${fileId}`);
        return;
      }
      
      // Download and cache
      console.log(`📥 Preloading (${category}): ${fileId}`);
      await this.downloadFile(fileId, category);
      console.log(`✅ Preloaded (${category}): ${fileId}`);
    } catch (error) {
      console.error(`❌ Failed to preload ${number}:`, error);
      throw error;
    }
  }

  /**
   * Pre-warm audio pool with specific numbers for instant playback
   * Loads audio elements into memory for zero-delay playback
   * 
   * @param numbers - Array of numbers to pre-warm (e.g., recently called numbers)
   * @param voiceCategory - Optional voice category override
   * @returns Promise that resolves when pre-warming completes
   */
  public async prewarmAudioPool(numbers: number[], voiceCategory?: VoiceCategory): Promise<void> {
    const category = voiceCategory || this.currentVoiceCategory;
    console.log(`🔥 Pre-warming audio pool with ${numbers.length} numbers (${category})...`);
    
    const promises = numbers.map(async (num) => {
      try {
        const fileId = category === 'boy' ? `${num}.wav` : `${num}.mp3`;
        const poolKey = `${category}_${fileId}`;
        const cacheKey = `${category}_${fileId}`;
        
        // Skip if already in pool
        if (this.audioPool.has(poolKey)) {
          return;
        }

        const cachedBlob = await audioCacheDB.getAudio(cacheKey);
        
        if (cachedBlob) {
          const audioUrl = URL.createObjectURL(cachedBlob);
          const audio = new Audio(audioUrl);
          audio.volume = 0.7;
          audio.preload = 'auto';
          
          // Add to pool
          this.audioPool.set(poolKey, audio);
          console.log(`⚡ Pre-warmed (${category}): ${fileId}`);
        }
      } catch (error) {
        console.warn(`⚠️ Failed to pre-warm ${num} (${category}):`, error);
      }
    });

    await Promise.all(promises);
    console.log(`✅ Audio pool pre-warmed (${category}): ${this.audioPool.size} elements ready`);
  }

  /**
   * Stop the currently playing sound
   */
  public stopCurrentSound(): void {
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
        this.currentAudio = null;
        console.log('🛑 Stopped current audio');
      } catch (error) {
        console.error('❌ Error stopping audio:', error);
      }
    }
  }

  /**
   * Clean up resources
   */
  public cleanup(): void {
    console.log('🧹 Cleaning up UnifiedAudioManager...');
    
    // Stop current audio
    this.stopCurrentSound();
    
    // Clear audio pool
    this.audioPool.forEach((audio) => {
      try {
        audio.pause();
        audio.src = '';
      } catch (error) {
        // Ignore cleanup errors
      }
    });
    this.audioPool.clear();
    
    // Clear download queue
    this.downloadQueue.clear();
    this.activeDownloads = 0;
    
    console.log('✅ UnifiedAudioManager cleaned up');
  }

  /**
   * Check if the manager is initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Preload all audio files for both voice categories
   * 
   * @param onProgress - Optional callback for progress updates
   * @returns Promise that resolves when all downloads complete
   */
  public async preloadAllVoiceCategories(onProgress?: ProgressCallback): Promise<void> {
    console.log('📥 Starting download of all voice categories...');
    
    const numbers = Array.from({ length: 75 }, (_, i) => i + 1);
    // Special sounds - different for each voice category
    const boySpecialSounds = ['start.wav', 'winner.wav', 'notwinner.wav', 'shuffle-audio-TfqyAnvz.mp3'];
    const girlSpecialSounds = ['winner.wav', 'shuffle-audio-TfqyAnvz.mp3']; // No start or notwinner for girl
    
    let completed = 0;
    const totalFiles = numbers.length * 2 + boySpecialSounds.length + girlSpecialSounds.length; // Accurate count
    
    // Download boy sounds
    for (const num of numbers) {
      try {
        await this.preloadSound(num, 'boy');
        completed++;
        onProgress?.(completed, totalFiles);
      } catch (error) {
        console.warn(`⚠️ Failed to preload boy sound ${num}:`, error);
        completed++;
        onProgress?.(completed, totalFiles);
      }
    }
    
    for (const sound of boySpecialSounds) {
      try {
        await this.preloadSound(sound, 'boy');
        completed++;
        onProgress?.(completed, totalFiles);
      } catch (error) {
        console.warn(`⚠️ Failed to preload boy sound ${sound}:`, error);
        completed++;
        onProgress?.(completed, totalFiles);
      }
    }
    
    // Download girl sounds
    for (const num of numbers) {
      try {
        await this.preloadSound(num, 'girl');
        completed++;
        onProgress?.(completed, totalFiles);
      } catch (error) {
        console.warn(`⚠️ Failed to preload girl sound ${num}:`, error);
        completed++;
        onProgress?.(completed, totalFiles);
      }
    }
    
    for (const sound of girlSpecialSounds) {
      try {
        await this.preloadSound(sound, 'girl');
        completed++;
        onProgress?.(completed, totalFiles);
      } catch (error) {
        console.warn(`⚠️ Failed to preload girl sound ${sound}:`, error);
        completed++;
        onProgress?.(completed, totalFiles);
      }
    }
    
    console.log('✅ All voice categories preloaded');
  }

  /**
   * Get debug information about the audio manager
   */
  public getDebugInfo(): any {
    return {
      currentVoiceCategory: this.currentVoiceCategory,
      audioPoolSize: this.audioPool.size,
      isInitialized: this.initialized,
      config: this.config
    };
  }

  /**
   * Get the current configuration
   */
  public getConfig(): AudioManagerConfig {
    return { ...this.config };
  }
}
