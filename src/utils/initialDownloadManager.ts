// Initial download manager for cartelas and sounds
import { cartelaCacheDB } from './cartelaCache';
import { UnifiedAudioManager } from './UnifiedAudioManager';
import { voiceCategoryManager } from './voiceCategoryManager';

export interface DownloadProgress {
  cartelas: {
    total: number;
    downloaded: number;
    percentage: number;
    status: 'pending' | 'downloading' | 'complete' | 'error';
  };
  sounds: {
    total: number;
    downloaded: number;
    percentage: number;
    status: 'pending' | 'downloading' | 'complete' | 'error';
  };
  overall: {
    percentage: number;
    status: 'pending' | 'downloading' | 'complete' | 'error';
  };
}

class InitialDownloadManager {
  private progressCallbacks: ((progress: DownloadProgress) => void)[] = [];

  // Check if initial download is needed
  async needsInitialDownload(userId: string): Promise<boolean> {
    try {
      // Check localStorage flag
      const downloadComplete = localStorage.getItem(`initial_download_complete_${userId}`);
      if (downloadComplete === 'true') {
        console.log('✅ Initial download already complete for user:', userId);
        return false;
      }

      // Double-check by verifying actual data
      const cartelasExist = await this.checkCartelasExist();
      const soundsExist = await this.checkSoundsExist();

      if (cartelasExist && soundsExist) {
        // Mark as complete if data exists
        localStorage.setItem(`initial_download_complete_${userId}`, 'true');
        console.log('✅ Data exists, marking download as complete');
        return false;
      }

      console.log('⚠️ Initial download needed:', { cartelasExist, soundsExist });
      return true;
    } catch (error) {
      console.error('Error checking download status:', error);
      return true; // Download to be safe
    }
  }

  // Check if cartelas exist in IndexedDB
  private async checkCartelasExist(): Promise<boolean> {
    try {
      await cartelaCacheDB.init();
      const stats = await cartelaCacheDB.getCacheStats();
      return stats.count > 0;
    } catch (error) {
      console.error('Error checking cartelas:', error);
      return false;
    }
  }

  // Check if sounds exist in cache
  private async checkSoundsExist(): Promise<boolean> {
    try {
      const audioManager = UnifiedAudioManager.getInstance();
      if (!audioManager.isInitialized()) {
        await audioManager.initialize();
      }
      const status = await audioManager.getCacheStatus();
      return status.isComplete;
    } catch (error) {
      console.error('Error checking sounds:', error);
      return false;
    }
  }

  // Subscribe to progress updates
  onProgress(callback: (progress: DownloadProgress) => void): () => void {
    this.progressCallbacks.push(callback);
    return () => {
      this.progressCallbacks = this.progressCallbacks.filter(cb => cb !== callback);
    };
  }

  // Notify all subscribers
  private notifyProgress(progress: DownloadProgress): void {
    this.progressCallbacks.forEach(callback => callback(progress));
  }

  // Download cartelas
  private async downloadCartelas(userId: string, token: string): Promise<void> {
    const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
    
    console.log('📥 Starting cartela download...');
    
    const response = await fetch(`${API_BASE_URL}/cartelas/user-cartelas?all=true`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch cartelas: ${response.status}`);
    }

    const data = await response.json();
    
    if (data && data.cartelas && Array.isArray(data.cartelas)) {
      await cartelaCacheDB.init();
      cartelaCacheDB.setCurrentUser(userId);
      
      // Clear old cache
      await cartelaCacheDB.clearCacheForUser(userId);
      
      // Store cartelas
      await cartelaCacheDB.saveCartelas(data.cartelas);
      
      console.log(`✅ Downloaded ${data.cartelas.length} cartelas`);
      
      // Store metadata
      localStorage.setItem('cartelas_count', data.cartelas.length.toString());
      localStorage.setItem('cartelas_last_sync', Date.now().toString());
    }
  }

  // Download sounds
  private async downloadSounds(): Promise<void> {
    console.log('🔊 Starting sound download...');
    
    const audioManager = UnifiedAudioManager.getInstance();
    
    if (!audioManager.isInitialized()) {
      await audioManager.initialize();
    }

    // Get voice category
    const voiceCategory = voiceCategoryManager.getEffectiveVoiceCategory();
    if (voiceCategory) {
      audioManager.setVoiceCategory(voiceCategory);
    }

    // Preload all sounds
    await audioManager.preloadAllVoiceCategories((downloaded: number, total: number) => {
      const progress: DownloadProgress = {
        cartelas: {
          total: 0,
          downloaded: 0,
          percentage: 100,
          status: 'complete'
        },
        sounds: {
          total,
          downloaded,
          percentage: Math.round((downloaded / total) * 100),
          status: downloaded === total ? 'complete' : 'downloading'
        },
        overall: {
          percentage: Math.round((downloaded / total) * 100),
          status: downloaded === total ? 'complete' : 'downloading'
        }
      };
      this.notifyProgress(progress);
    });

    console.log('✅ All sounds downloaded');
  }

  // Perform initial download
  async performInitialDownload(userId: string, token: string): Promise<void> {
    try {
      // Initial progress
      const initialProgress: DownloadProgress = {
        cartelas: {
          total: 0,
          downloaded: 0,
          percentage: 0,
          status: 'downloading'
        },
        sounds: {
          total: 0,
          downloaded: 0,
          percentage: 0,
          status: 'pending'
        },
        overall: {
          percentage: 0,
          status: 'downloading'
        }
      };
      this.notifyProgress(initialProgress);

      // Step 1: Download cartelas
      await this.downloadCartelas(userId, token);
      
      const cartelasCompleteProgress: DownloadProgress = {
        cartelas: {
          total: 1,
          downloaded: 1,
          percentage: 100,
          status: 'complete'
        },
        sounds: {
          total: 0,
          downloaded: 0,
          percentage: 0,
          status: 'downloading'
        },
        overall: {
          percentage: 50,
          status: 'downloading'
        }
      };
      this.notifyProgress(cartelasCompleteProgress);

      // Step 2: Download sounds
      await this.downloadSounds();

      // Mark as complete
      localStorage.setItem(`initial_download_complete_${userId}`, 'true');
      localStorage.setItem(`initial_download_timestamp_${userId}`, Date.now().toString());

      const completeProgress: DownloadProgress = {
        cartelas: {
          total: 1,
          downloaded: 1,
          percentage: 100,
          status: 'complete'
        },
        sounds: {
          total: 1,
          downloaded: 1,
          percentage: 100,
          status: 'complete'
        },
        overall: {
          percentage: 100,
          status: 'complete'
        }
      };
      this.notifyProgress(completeProgress);

      console.log('🎉 Initial download complete!');
    } catch (error) {
      console.error('❌ Initial download failed:', error);
      
      const errorProgress: DownloadProgress = {
        cartelas: {
          total: 0,
          downloaded: 0,
          percentage: 0,
          status: 'error'
        },
        sounds: {
          total: 0,
          downloaded: 0,
          percentage: 0,
          status: 'error'
        },
        overall: {
          percentage: 0,
          status: 'error'
        }
      };
      this.notifyProgress(errorProgress);
      
      throw error;
    }
  }

  // Reset download status (for testing or re-download)
  resetDownloadStatus(userId: string): void {
    localStorage.removeItem(`initial_download_complete_${userId}`);
    localStorage.removeItem(`initial_download_timestamp_${userId}`);
    console.log('🔄 Download status reset for user:', userId);
  }
}

export const initialDownloadManager = new InitialDownloadManager();
