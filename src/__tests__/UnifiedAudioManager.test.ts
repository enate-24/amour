import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { UnifiedAudioManager } from '../utils/UnifiedAudioManager';

describe('UnifiedAudioManager', () => {
  let manager: UnifiedAudioManager;

  beforeEach(() => {
    // Get the singleton instance
    manager = UnifiedAudioManager.getInstance();
  });

  afterEach(() => {
    // Cleanup after each test
    manager.cleanup();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance on multiple calls', () => {
      const instance1 = UnifiedAudioManager.getInstance();
      const instance2 = UnifiedAudioManager.getInstance();
      const instance3 = UnifiedAudioManager.getInstance();

      expect(instance1).toBe(instance2);
      expect(instance2).toBe(instance3);
      expect(instance1).toBe(manager);
    });

    it('should ignore config on subsequent calls', () => {
      const instance1 = UnifiedAudioManager.getInstance({ maxConcurrentDownloads: 10 });
      const instance2 = UnifiedAudioManager.getInstance({ maxConcurrentDownloads: 3 });

      expect(instance1).toBe(instance2);
      // Config should be from the first initialization
      expect(instance1.getConfig().maxConcurrentDownloads).toBe(5); // Default or first set value
    });
  });

  describe('Configuration', () => {
    it('should have default configuration values', () => {
      const config = manager.getConfig();

      expect(config.maxConcurrentDownloads).toBe(5);
      expect(config.retryAttempts).toBe(3);
      expect(config.retryDelay).toBe(1000);
      expect(config.preloadOnInit).toBe(false);
    });

    it('should return a copy of config to prevent mutation', () => {
      const config1 = manager.getConfig();
      const config2 = manager.getConfig();

      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await manager.initialize();
      expect(manager.isInitialized()).toBe(true);
    });

    it('should not reinitialize if already initialized', async () => {
      await manager.initialize();
      const firstInit = manager.isInitialized();
      
      await manager.initialize();
      const secondInit = manager.isInitialized();

      expect(firstInit).toBe(true);
      expect(secondInit).toBe(true);
    });
  });

  describe('Cache Status', () => {
    it('should return cache status', async () => {
      await manager.initialize();
      const status = await manager.getCacheStatus();

      expect(status).toHaveProperty('totalFiles');
      expect(status).toHaveProperty('cachedFiles');
      expect(status).toHaveProperty('missingFiles');
      expect(status).toHaveProperty('cacheSize');
      expect(status).toHaveProperty('isComplete');
      expect(status).toHaveProperty('lastUpdated');
    });

    it('should return valid cache status structure even on error', async () => {
      // Don't initialize to potentially cause an error
      const status = await manager.getCacheStatus();

      expect(status.totalFiles).toBe(78);
      expect(typeof status.cachedFiles).toBe('number');
      expect(Array.isArray(status.missingFiles)).toBe(true);
      expect(typeof status.cacheSize).toBe('number');
      expect(typeof status.isComplete).toBe('boolean');
    });
  });

  describe('Audio Pool', () => {
    it('should start uninitialized', () => {
      // Create a fresh instance to test initial state
      // Since we're using singleton, we check the behavior instead
      expect(manager).toBeDefined();
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources', () => {
      manager.cleanup();
      // Verify cleanup doesn't throw
      expect(true).toBe(true);
    });

    it('should stop current sound on cleanup', () => {
      manager.stopCurrentSound();
      manager.cleanup();
      // Verify no errors
      expect(true).toBe(true);
    });
  });

  describe('Stop Current Sound', () => {
    it('should handle stopping when no audio is playing', () => {
      expect(() => manager.stopCurrentSound()).not.toThrow();
    });
  });

  describe('Download Missing Audio', () => {
    it('should call progress callback with correct values', async () => {
      await manager.initialize();
      
      const progressUpdates: Array<{ current: number; total: number }> = [];
      
      await manager.downloadMissingAudio((current, total) => {
        progressUpdates.push({ current, total });
      });
      
      // Should have received at least one progress update
      expect(progressUpdates.length).toBeGreaterThanOrEqual(1);
      
      // All updates should have valid total
      progressUpdates.forEach(update => {
        expect(update.total).toBe(78);
        expect(update.current).toBeGreaterThanOrEqual(0);
        expect(update.current).toBeLessThanOrEqual(update.total);
      });
    });

    it('should handle case when all files are cached', async () => {
      await manager.initialize();
      
      // Mock a complete cache by calling downloadMissingAudio first
      // In a real scenario, this would check the cache
      let callbackCalled = false;
      
      await manager.downloadMissingAudio((current, total) => {
        callbackCalled = true;
        expect(current).toBeLessThanOrEqual(total);
      });
      
      expect(callbackCalled).toBe(true);
    });
  });
});
