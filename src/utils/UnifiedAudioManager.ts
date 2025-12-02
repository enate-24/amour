import { audioCacheDB, type CacheStatus } from './audioCache';
import { networkStatusManager } from './networkStatus';

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
  private audioPool: Map<number, HTMLAudioElement> = new Map();
  private downloadQueue: Set<string> = new Set();
  private activeDownloads: number = 0;
  private config: AudioManagerConfig;
  private initialized: boolean = false;
  private currentAudio: HTMLAudioElement | null = null;

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor(config?: Partial<AudioManagerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    console.log('🔊 UnifiedAudioManager instance created with config:', this.config);
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
      
      let completed = status.cachedFiles;
      const total = status.totalFiles;
      
      // Process downloads with concurrency limit
      const downloadPromises: Promise<void>[] = [];
      
      for (const fileId of missingFiles) {
        // Wait if we've reached the concurrent download limit
        while (this.activeDownloads >= this.config.maxConcurrentDownloads) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Add to download queue
        this.downloadQueue.add(fileId);
        this.activeDownloads++;
        
        // Start download
        const downloadPromise = this.downloadFile(fileId)
          .then(() => {
            completed++;
            onProgress?.(completed, total);
          })
          .catch(error => {
            console.error(`❌ Failed to download ${fileId}:`, error);
          })
          .finally(() => {
            this.downloadQueue.delete(fileId);
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
   * Get audio URL with CDN support
   * 
   * @param fileId - The file identifier (e.g., "1.mp3", "start.wav")
   * @returns URL string (CDN or local)
   */
  private getAudioUrl(fileId: string): string {
    const cdnEnabled = import.meta.env.VITE_CDN_ENABLED === 'true';
    const cdnBaseUrl = import.meta.env.VITE_CDN_BASE_URL || '';
    
    if (cdnEnabled && cdnBaseUrl) {
      const cdnUrl = `${cdnBaseUrl}/sounds/${fileId}`;
      console.log(`🌐 Using CDN URL: ${cdnUrl}`);
      return cdnUrl;
    }
    
    // Fallback to local
    return `/sounds/${fileId}`;
  }

  /**
   * Download a single audio file (with offline detection)
   * 
   * @param fileId - The file identifier (e.g., "1.mp3", "start.wav")
   * @returns Promise that resolves when download completes
   */
  private async downloadFile(fileId: string): Promise<void> {
    // Check if offline
    if (networkStatusManager.isOffline) {
      console.warn(`📡 Offline: Cannot download ${fileId}`);
      throw new Error('Network offline - cannot download audio');
    }

    const url = this.getAudioUrl(fileId);
    
    try {
      console.log(`📥 Downloading: ${fileId} from ${url}`);
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      
      // Validate blob
      if (blob.size === 0) {
        throw new Error('Downloaded file is empty');
      }
      
      // Save to cache
      await audioCacheDB.saveAudio(fileId, blob);
      
      console.log(`✅ Downloaded and cached: ${fileId}`);
    } catch (error) {
      console.error(`❌ Failed to download ${fileId}:`, error);
      throw error;
    }
  }

  /**
   * Play a sound by number (optimized with audio pool and offline support)
   * 
   * @param number - The number to play (1-75) or special sound name
   * @returns Promise that resolves when playback starts
   */
  public async playSound(number: number | string): Promise<void> {
    try {
      // Stop any currently playing sound
      this.stopCurrentSound();
      
      // Determine file ID
      const fileId = typeof number === 'string' ? number : `${number}.mp3`;
      const numericKey = typeof number === 'number' ? number : 0;
      
      // Check if we have a pre-loaded audio element in the pool
      if (numericKey > 0 && this.audioPool.has(numericKey)) {
        const audio = this.audioPool.get(numericKey)!;
        this.currentAudio = audio;
        
        // Reset and play
        audio.currentTime = 0;
        await audio.play();
        console.log(`⚡ Playing from pool: ${fileId}`);
        return;
      }
      
      // Not in pool - check cache and create new audio element
      let audioUrl: string;
      const cachedBlob = await audioCacheDB.getAudio(fileId);
      
      if (cachedBlob) {
        // Use cached audio (works offline)
        audioUrl = URL.createObjectURL(cachedBlob);
        console.log(`🔊 Playing cached audio: ${fileId}${networkStatusManager.isOffline ? ' (offline mode)' : ''}`);
      } else {
        // Check if offline
        if (networkStatusManager.isOffline) {
          console.error(`❌ Cannot play ${fileId}: offline and not cached`);
          throw new Error(`Audio not available offline: ${fileId}`);
        }

        // Download on-demand
        console.log(`📥 Audio not cached, downloading on-demand: ${fileId}`);
        await this.downloadFile(fileId);
        
        // Get from cache after download
        const blob = await audioCacheDB.getAudio(fileId);
        if (!blob) {
          throw new Error(`Failed to cache ${fileId}`);
        }
        audioUrl = URL.createObjectURL(blob);
      }
      
      // Create and play audio
      const audio = new Audio(audioUrl);
      audio.volume = 0.7;
      this.currentAudio = audio;
      
      // Add to pool for future use if it's a number
      if (numericKey > 0) {
        this.audioPool.set(numericKey, audio);
      }
      
      // Clean up object URL after playback (but keep audio element in pool)
      audio.addEventListener('ended', () => {
        if (this.currentAudio === audio) {
          this.currentAudio = null;
        }
      });
      
      audio.addEventListener('error', (e) => {
        console.error(`❌ Error playing audio ${fileId}:`, e);
        URL.revokeObjectURL(audioUrl);
        if (this.currentAudio === audio) {
          this.currentAudio = null;
        }
        // Remove from pool on error
        if (numericKey > 0) {
          this.audioPool.delete(numericKey);
        }
      });
      
      await audio.play();
      console.log(`✅ Playing: ${fileId}`);
    } catch (error) {
      console.error(`❌ Failed to play sound ${number}:`, error);
      throw error;
    }
  }

  /**
   * Preload a sound into the audio pool
   * 
   * @param number - The number to preload (1-75) or special sound name
   * @returns Promise that resolves when preload completes
   */
  public async preloadSound(number: number | string): Promise<void> {
    try {
      const fileId = typeof number === 'string' ? number : `${number}.mp3`;
      
      // Check if already cached
      const hasAudio = await audioCacheDB.hasAudio(fileId);
      if (hasAudio) {
        console.log(`✅ Audio already cached: ${fileId}`);
        return;
      }
      
      // Download and cache
      console.log(`📥 Preloading: ${fileId}`);
      await this.downloadFile(fileId);
      console.log(`✅ Preloaded: ${fileId}`);
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
   * @returns Promise that resolves when pre-warming completes
   */
  public async prewarmAudioPool(numbers: number[]): Promise<void> {
    console.log(`🔥 Pre-warming audio pool with ${numbers.length} numbers...`);
    
    const promises = numbers.map(async (num) => {
      try {
        // Skip if already in pool
        if (this.audioPool.has(num)) {
          return;
        }

        const fileId = `${num}.mp3`;
        const cachedBlob = await audioCacheDB.getAudio(fileId);
        
        if (cachedBlob) {
          const audioUrl = URL.createObjectURL(cachedBlob);
          const audio = new Audio(audioUrl);
          audio.volume = 0.7;
          audio.preload = 'auto';
          
          // Add to pool
          this.audioPool.set(num, audio);
          console.log(`⚡ Pre-warmed: ${fileId}`);
        }
      } catch (error) {
        console.warn(`⚠️ Failed to pre-warm ${num}:`, error);
      }
    });

    await Promise.all(promises);
    console.log(`✅ Audio pool pre-warmed: ${this.audioPool.size} elements ready`);
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
   * Get the current configuration
   */
  public getConfig(): AudioManagerConfig {
    return { ...this.config };
  }
}
