import { VoiceCategory, UnifiedAudioManager } from './UnifiedAudioManager';

/**
 * Voice Category Manager - Handles persistence and synchronization of voice category selection
 */
export class VoiceCategoryManager {
  private static readonly STORAGE_KEY = 'userVoiceCategory';
  
  /**
   * Save voice category to localStorage
   */
  static saveToLocalStorage(voiceCategory: VoiceCategory): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, voiceCategory);
      console.log('💾 Voice category saved to localStorage:', voiceCategory);
    } catch (error) {
      console.warn('⚠️ Failed to save voice category to localStorage:', error);
    }
  }
  
  /**
   * Load voice category from localStorage
   */
  static loadFromLocalStorage(): VoiceCategory | null {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored && (stored === 'boy' || stored === 'girl')) {
        console.log('📖 Voice category loaded from localStorage:', stored);
        return stored as VoiceCategory;
      }
    } catch (error) {
      console.warn('⚠️ Failed to load voice category from localStorage:', error);
    }
    return null;
  }
  
  /**
   * Clear voice category from localStorage
   */
  static clearFromLocalStorage(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      console.log('🗑️ Voice category cleared from localStorage');
    } catch (error) {
      console.warn('⚠️ Failed to clear voice category from localStorage:', error);
    }
  }
  
  /**
   * Get voice category with fallback priority:
   * 1. Provided value
   * 2. localStorage
   * 3. null (user must choose)
   */
  static getVoiceCategoryWithFallback(apiVoiceCategory?: VoiceCategory | null): VoiceCategory | null {
    // First priority: API/database value
    if (apiVoiceCategory) {
      console.log('🎤 Using voice category from API:', apiVoiceCategory);
      // Sync to localStorage
      this.saveToLocalStorage(apiVoiceCategory);
      return apiVoiceCategory;
    }
    
    // Second priority: localStorage fallback
    const localVoiceCategory = this.loadFromLocalStorage();
    if (localVoiceCategory) {
      console.log('🔄 Using voice category from localStorage fallback:', localVoiceCategory);
      return localVoiceCategory;
    }
    
    // No voice category available
    console.log('⚠️ No voice category available - user must select one');
    return null;
  }
  
  /**
   * Set voice category and persist it
   */
  static setVoiceCategory(voiceCategory: VoiceCategory): void {
    // Save to localStorage immediately
    this.saveToLocalStorage(voiceCategory);
    
    // Update audio manager if available
    try {
      const audioManager = UnifiedAudioManager.getInstance();
      audioManager.setVoiceCategory(voiceCategory);
      console.log('🎤 Audio manager updated with voice category:', voiceCategory);
    } catch (error) {
      console.warn('⚠️ Could not update audio manager:', error);
    }
  }
  
  /**
   * Initialize voice category on app startup
   */
  static async initializeVoiceCategory(apiBaseUrl: string, authToken?: string): Promise<VoiceCategory | null> {
    let voiceCategory: VoiceCategory | null = null;
    
    // Try to load from API first
    if (authToken) {
      try {
        const response = await fetch(`${apiBaseUrl}/settings`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          voiceCategory = data.voiceCategory || null;
        }
      } catch (error) {
        console.warn('⚠️ Failed to load voice category from API:', error);
      }
    }
    
    // Use fallback logic
    const finalVoiceCategory = this.getVoiceCategoryWithFallback(voiceCategory);
    
    // Set in audio manager if available
    if (finalVoiceCategory) {
      this.setVoiceCategory(finalVoiceCategory);
    }
    
    return finalVoiceCategory;
  }
}

export default VoiceCategoryManager;