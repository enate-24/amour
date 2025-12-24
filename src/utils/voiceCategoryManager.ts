import { UnifiedAudioManager, type VoiceCategory } from './UnifiedAudioManager';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * Voice Category Manager - Handles admin-assigned voice categories
 */
export class VoiceCategoryManager {
  private static instance: VoiceCategoryManager | null = null;
  private adminAssignedVoice: VoiceCategory | null = null;
  private userPreferredVoice: VoiceCategory | null = null;
  private loaded: boolean = false;

  private constructor() {}

  public static getInstance(): VoiceCategoryManager {
    if (!VoiceCategoryManager.instance) {
      VoiceCategoryManager.instance = new VoiceCategoryManager();
    }
    return VoiceCategoryManager.instance;
  }

  /**
   * Load user's voice category settings (admin-assigned takes priority)
   */
  public async loadUserVoiceCategory(): Promise<VoiceCategory> {
    if (this.loaded && this.adminAssignedVoice) {
      return this.adminAssignedVoice;
    }

    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        console.warn('No auth token found, using default voice category');
        return this.getFallbackVoice();
      }

      // Fetch user settings from backend
      console.log(`🎤 Loading voice category for user from: ${API_BASE_URL}/settings/user-settings`);
      const response = await fetch(`${API_BASE_URL}/settings/user-settings`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const settings = data.settings;
        console.log(`🎤 Received user settings:`, settings);

        // Admin-assigned voice takes priority
        if (settings.voiceCategory) {
          this.adminAssignedVoice = settings.voiceCategory as VoiceCategory;
          console.log(`🎤 Admin-assigned voice category loaded: ${this.adminAssignedVoice}`);
          this.loaded = true;
          return this.adminAssignedVoice;
        } else {
          console.log(`🎤 No admin-assigned voice category found`);
        }

        // Fallback to user preference from localStorage
        const userPreference = localStorage.getItem('voiceCategory') as VoiceCategory;
        if (userPreference && (userPreference === 'boy' || userPreference === 'girl')) {
          this.userPreferredVoice = userPreference;
          console.log(`🎤 Using user preference: ${this.userPreferredVoice}`);
          this.loaded = true;
          return this.userPreferredVoice;
        }
      }
    } catch (error) {
      console.error('Failed to load user voice category:', error);
    }

    // Final fallback
    const fallback = this.getFallbackVoice();
    this.loaded = true;
    return fallback;
  }

  /**
   * Get the effective voice category (admin-assigned or user preference)
   */
  public getEffectiveVoiceCategory(): VoiceCategory {
    if (this.adminAssignedVoice) {
      return this.adminAssignedVoice;
    }
    if (this.userPreferredVoice) {
      return this.userPreferredVoice;
    }
    return this.getFallbackVoice();
  }

  /**
   * Check if voice category is admin-assigned (user cannot change it)
   */
  public isAdminAssigned(): boolean {
    return this.adminAssignedVoice !== null;
  }

  /**
   * Set user preference (only works if not admin-assigned)
   */
  public setUserPreference(voice: VoiceCategory): boolean {
    if (this.adminAssignedVoice) {
      console.warn('Cannot change voice category - it is admin-assigned');
      return false;
    }

    this.userPreferredVoice = voice;
    localStorage.setItem('voiceCategory', voice);
    console.log(`🎤 User voice preference set to: ${voice}`);
    return true;
  }

  /**
   * Initialize voice category for audio manager
   */
  public async initializeAudioManagerVoice(): Promise<void> {
    const voiceCategory = await this.loadUserVoiceCategory();
    const audioManager = UnifiedAudioManager.getInstance();
    audioManager.setVoiceCategory(voiceCategory);
    console.log(`🎤 Audio manager initialized with voice: ${voiceCategory}`);
  }

  /**
   * Refresh voice category from server (call after admin changes)
   */
  public async refreshVoiceCategory(): Promise<VoiceCategory> {
    this.loaded = false;
    this.adminAssignedVoice = null;
    return await this.loadUserVoiceCategory();
  }

  /**
   * Get fallback voice category
   */
  private getFallbackVoice(): VoiceCategory {
    return 'girl'; // Default fallback
  }

  /**
   * Static-like method for backward compatibility
   */
  public static setVoiceCategory(voice: VoiceCategory): void {
    const instance = VoiceCategoryManager.getInstance();
    instance.setUserPreference(voice);
  }

  /**
   * Static-like method for backward compatibility
   */
  public static getVoiceCategoryWithFallback(adminVoice?: VoiceCategory): VoiceCategory {
    const instance = VoiceCategoryManager.getInstance();
    if (adminVoice) {
      instance.adminAssignedVoice = adminVoice;
    }
    return instance.getEffectiveVoiceCategory();
  }

  /**
   * Static-like method for backward compatibility
   */
  public static async initializeVoiceCategory(_apiUrl?: string, _token?: string): Promise<VoiceCategory> {
    const instance = VoiceCategoryManager.getInstance();
    return await instance.loadUserVoiceCategory();
  }

  /**
   * Reset all cached data
   */
  public reset(): void {
    this.adminAssignedVoice = null;
    this.userPreferredVoice = null;
    this.loaded = false;
  }
}

// Export singleton instance
export const voiceCategoryManager = VoiceCategoryManager.getInstance();

// Export class for default import compatibility
export default VoiceCategoryManager;