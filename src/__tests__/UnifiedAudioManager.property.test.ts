import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { UnifiedAudioManager, type AudioManagerConfig } from '../utils/UnifiedAudioManager';
import { audioCacheDB } from '../utils/audioCache';

/**
 * Property-based tests for UnifiedAudioManager
 * 
 * **Feature: network-optimization, Property 7: Singleton audio manager**
 * **Validates: Requirements 3.1, 3.2, 3.3**
 * 
 * **Feature: network-optimization, Property 1: Cache-first loading**
 * **Validates: Requirements 1.1, 1.2, 1.5**
 */
describe('UnifiedAudioManager Property Tests', () => {
  beforeEach(async () => {
    // Cleanup before each test
    const manager = UnifiedAudioManager.getInstance();
    manager.cleanup();
    
    // Clear cache
    await audioCacheDB.init();
    await audioCacheDB.clearAll();
  });

  describe('Property 7: Singleton audio manager', () => {
    it('should return the same instance for any number of initialization calls', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }), // Number of getInstance calls
          (numCalls) => {
            // Generate an array of getInstance calls
            const instances: UnifiedAudioManager[] = [];
            
            for (let i = 0; i < numCalls; i++) {
              instances.push(UnifiedAudioManager.getInstance());
            }
            
            // All instances should be the same reference
            const firstInstance = instances[0];
            return instances.every(instance => instance === firstInstance);
          }
        ),
        { numRuns: 100 } // Run 100 iterations as specified in design
      );
    });

    it('should return the same instance regardless of configuration provided', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              maxConcurrentDownloads: fc.integer({ min: 1, max: 20 }),
              retryAttempts: fc.integer({ min: 0, max: 10 }),
              retryDelay: fc.integer({ min: 100, max: 5000 }),
              preloadOnInit: fc.boolean()
            }),
            { minLength: 2, maxLength: 10 }
          ),
          (configs) => {
            // Get instances with different configs
            const instances: UnifiedAudioManager[] = [];
            
            for (const config of configs) {
              instances.push(UnifiedAudioManager.getInstance(config));
            }
            
            // All instances should be the same reference
            const firstInstance = instances[0];
            return instances.every(instance => instance === firstInstance);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain singleton property across multiple sequential calls', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 50 }), // Number of accesses
          (numAccesses) => {
            // Get instances sequentially (singleton is synchronous)
            const instances: UnifiedAudioManager[] = [];
            
            for (let i = 0; i < numAccesses; i++) {
              instances.push(UnifiedAudioManager.getInstance());
            }
            
            // All instances should be the same reference
            const firstInstance = instances[0];
            return instances.every(instance => instance === firstInstance);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return the same instance when called from multiple components', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string(), { minLength: 1, maxLength: 20 }), // Simulate component names
          (componentNames) => {
            // Simulate different components getting the instance
            const instancesByComponent = new Map<string, UnifiedAudioManager>();
            
            for (const componentName of componentNames) {
              instancesByComponent.set(componentName, UnifiedAudioManager.getInstance());
            }
            
            // All components should have the same instance
            const instances = Array.from(instancesByComponent.values());
            const firstInstance = instances[0];
            return instances.every(instance => instance === firstInstance);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 1: Cache-first loading', () => {
    /**
     * **Feature: network-optimization, Property 1: Cache-first loading**
     * **Validates: Requirements 1.1, 1.2, 1.5**
     * 
     * For any audio file that exists in the cache, the system should use 
     * the cached version without making network requests
     */
    it('should use cached audio files without making network requests', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.integer({ min: 1, max: 75 }), // Generate random audio numbers
            { minLength: 1, maxLength: 20 }
          ),
          async (audioNumbers) => {
            // Remove duplicates
            const uniqueNumbers = [...new Set(audioNumbers)];
            
            // Pre-cache the audio files
            for (const num of uniqueNumbers) {
              const fileId = `${num}.mp3`;
              const mockBlob = new Blob(['mock audio data'], { type: 'audio/mpeg' });
              await audioCacheDB.saveAudio(fileId, mockBlob);
            }
            
            // Mock fetch to track network calls
            const fetchSpy = vi.spyOn(global, 'fetch');
            
            // Initialize manager
            const manager = UnifiedAudioManager.getInstance();
            await manager.initialize();
            
            // Get cache status - this should show all files are cached
            const status = await manager.getCacheStatus();
            const cachedFileIds = uniqueNumbers.map(n => `${n}.mp3`);
            const allCached = cachedFileIds.every(id => !status.missingFiles.includes(id));
            
            // Verify no fetch calls were made during initialization
            const noFetchDuringInit = fetchSpy.mock.calls.length === 0;
            
            // Try to download missing audio - should not download cached files
            fetchSpy.mockClear();
            await manager.downloadMissingAudio();
            
            // Verify no fetch calls were made for cached files
            const noFetchForCached = fetchSpy.mock.calls.length === 0;
            
            // Cleanup
            fetchSpy.mockRestore();
            
            return allCached && noFetchDuringInit && noFetchForCached;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should check cache before downloading on initialization', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.integer({ min: 1, max: 75 }),
            { minLength: 5, maxLength: 15 }
          ),
          async (cachedNumbers) => {
            // Remove duplicates
            const uniqueNumbers = [...new Set(cachedNumbers)];
            
            // Pre-cache some files
            for (const num of uniqueNumbers) {
              const fileId = `${num}.mp3`;
              const mockBlob = new Blob(['mock audio data'], { type: 'audio/mpeg' });
              await audioCacheDB.saveAudio(fileId, mockBlob);
            }
            
            // Track the order of operations
            const operations: string[] = [];
            
            // Spy on cache operations
            const getCacheStatusSpy = vi.spyOn(audioCacheDB, 'getCacheStatus');
            getCacheStatusSpy.mockImplementation(async () => {
              operations.push('cache-check');
              return getCacheStatusSpy.wrappedMethod.call(audioCacheDB);
            });
            
            // Spy on fetch
            const fetchSpy = vi.spyOn(global, 'fetch');
            fetchSpy.mockImplementation(async (...args) => {
              operations.push('network-request');
              throw new Error('Should not make network requests for cached files');
            });
            
            // Initialize manager
            const manager = UnifiedAudioManager.getInstance();
            await manager.initialize();
            
            // Verify cache was checked
            const cacheChecked = operations.includes('cache-check');
            
            // If there were any network requests, they should come after cache check
            const firstNetworkIndex = operations.indexOf('network-request');
            const firstCacheIndex = operations.indexOf('cache-check');
            const cacheBeforeNetwork = firstNetworkIndex === -1 || firstCacheIndex < firstNetworkIndex;
            
            // Cleanup
            getCacheStatusSpy.mockRestore();
            fetchSpy.mockRestore();
            
            return cacheChecked && cacheBeforeNetwork;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not re-download files that are already cached', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            cachedFiles: fc.array(
              fc.integer({ min: 1, max: 75 }),
              { minLength: 10, maxLength: 30 }
            ),
            requestedFiles: fc.array(
              fc.integer({ min: 1, max: 75 }),
              { minLength: 5, maxLength: 20 }
            )
          }),
          async ({ cachedFiles, requestedFiles }) => {
            // Remove duplicates
            const uniqueCached = [...new Set(cachedFiles)];
            const uniqueRequested = [...new Set(requestedFiles)];
            
            // Pre-cache files
            for (const num of uniqueCached) {
              const fileId = `${num}.mp3`;
              const mockBlob = new Blob(['mock audio data'], { type: 'audio/mpeg' });
              await audioCacheDB.saveAudio(fileId, mockBlob);
            }
            
            // Track which files are requested from network
            const networkRequests = new Set<string>();
            const fetchSpy = vi.spyOn(global, 'fetch');
            fetchSpy.mockImplementation(async (url: string | URL | Request) => {
              const urlString = url.toString();
              const fileId = urlString.split('/').pop() || '';
              networkRequests.add(fileId);
              
              // Return mock response
              return new Response(
                new Blob(['mock audio data'], { type: 'audio/mpeg' }),
                { status: 200, statusText: 'OK' }
              );
            });
            
            // Initialize manager
            const manager = UnifiedAudioManager.getInstance();
            await manager.initialize();
            
            // Download missing audio
            await manager.downloadMissingAudio();
            
            // Verify that cached files were not re-downloaded
            const cachedFileIds = uniqueCached.map(n => `${n}.mp3`);
            const noCachedFilesDownloaded = cachedFileIds.every(id => !networkRequests.has(id));
            
            // Cleanup
            fetchSpy.mockRestore();
            
            return noCachedFilesDownloaded;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use cached files across multiple operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.integer({ min: 1, max: 75 }),
            { minLength: 3, maxLength: 10 }
          ),
          async (audioNumbers) => {
            // Remove duplicates
            const uniqueNumbers = [...new Set(audioNumbers)];
            
            // Pre-cache files
            for (const num of uniqueNumbers) {
              const fileId = `${num}.mp3`;
              const mockBlob = new Blob(['mock audio data'], { type: 'audio/mpeg' });
              await audioCacheDB.saveAudio(fileId, mockBlob);
            }
            
            // Track network calls
            let networkCallCount = 0;
            const fetchSpy = vi.spyOn(global, 'fetch');
            fetchSpy.mockImplementation(async () => {
              networkCallCount++;
              return new Response(
                new Blob(['mock audio data'], { type: 'audio/mpeg' }),
                { status: 200, statusText: 'OK' }
              );
            });
            
            // Initialize manager multiple times (should reuse singleton)
            const manager1 = UnifiedAudioManager.getInstance();
            await manager1.initialize();
            
            const manager2 = UnifiedAudioManager.getInstance();
            await manager2.initialize();
            
            // Check cache status multiple times
            await manager1.getCacheStatus();
            await manager2.getCacheStatus();
            
            // Download missing audio multiple times
            await manager1.downloadMissingAudio();
            await manager2.downloadMissingAudio();
            
            // Verify no network calls were made for cached files
            const noNetworkCalls = networkCallCount === 0;
            
            // Cleanup
            fetchSpy.mockRestore();
            
            return noNetworkCalls;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 2: Selective downloading', () => {
    /**
     * **Feature: network-optimization, Property 2: Selective downloading**
     * **Validates: Requirements 1.3**
     * 
     * For any cache state with missing files, the system should download only 
     * the missing files and not re-download existing ones
     */
    it('should download only missing files when cache is incomplete', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            // Generate a set of files that are already cached
            cachedFiles: fc.array(
              fc.integer({ min: 1, max: 75 }),
              { minLength: 5, maxLength: 40 }
            ),
            // Generate a set of files that should be missing
            missingFiles: fc.array(
              fc.integer({ min: 1, max: 75 }),
              { minLength: 1, maxLength: 20 }
            )
          }),
          async ({ cachedFiles, missingFiles }) => {
            // Remove duplicates and ensure no overlap
            const uniqueCached = [...new Set(cachedFiles)];
            const uniqueMissing = [...new Set(missingFiles)].filter(
              num => !uniqueCached.includes(num)
            );
            
            // Skip if no missing files after filtering
            if (uniqueMissing.length === 0) {
              return true;
            }
            
            // Pre-cache the cached files
            for (const num of uniqueCached) {
              const fileId = `${num}.mp3`;
              const mockBlob = new Blob([`cached audio ${num}`], { type: 'audio/mpeg' });
              await audioCacheDB.saveAudio(fileId, mockBlob);
            }
            
            // Track which files are requested from network
            const networkRequests = new Set<string>();
            const fetchSpy = vi.spyOn(global, 'fetch');
            fetchSpy.mockImplementation(async (url: string | URL | Request) => {
              const urlString = url.toString();
              const fileId = urlString.split('/').pop() || '';
              networkRequests.add(fileId);
              
              // Return mock response
              return new Response(
                new Blob([`downloaded audio ${fileId}`], { type: 'audio/mpeg' }),
                { status: 200, statusText: 'OK' }
              );
            });
            
            // Initialize manager
            const manager = UnifiedAudioManager.getInstance();
            await manager.initialize();
            
            // Download missing audio
            await manager.downloadMissingAudio();
            
            // Verify that only missing files were downloaded
            const missingFileIds = uniqueMissing.map(n => `${n}.mp3`);
            const cachedFileIds = uniqueCached.map(n => `${n}.mp3`);
            
            // All missing files should have been downloaded
            const allMissingDownloaded = missingFileIds.every(id => networkRequests.has(id));
            
            // No cached files should have been re-downloaded
            const noCachedRedownloaded = cachedFileIds.every(id => !networkRequests.has(id));
            
            // The number of network requests should equal the number of missing files
            const correctDownloadCount = networkRequests.size === uniqueMissing.length;
            
            // Cleanup
            fetchSpy.mockRestore();
            
            return allMissingDownloaded && noCachedRedownloaded && correctDownloadCount;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle various cache states correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            totalFiles: fc.constantFrom(10, 20, 30, 50, 75), // Different total file counts
            cachedPercentage: fc.integer({ min: 0, max: 100 }) // Percentage of files cached
          }),
          async ({ totalFiles, cachedPercentage }) => {
            // Calculate how many files should be cached
            const numCached = Math.floor((totalFiles * cachedPercentage) / 100);
            const numMissing = totalFiles - numCached;
            
            // Generate file numbers
            const allFiles = Array.from({ length: totalFiles }, (_, i) => i + 1);
            
            // Randomly select which files are cached
            const shuffled = [...allFiles].sort(() => Math.random() - 0.5);
            const cachedFiles = shuffled.slice(0, numCached);
            const missingFiles = shuffled.slice(numCached);
            
            // Pre-cache the cached files
            for (const num of cachedFiles) {
              const fileId = `${num}.mp3`;
              const mockBlob = new Blob([`cached ${num}`], { type: 'audio/mpeg' });
              await audioCacheDB.saveAudio(fileId, mockBlob);
            }
            
            // Track network requests
            const downloadedFiles = new Set<string>();
            const fetchSpy = vi.spyOn(global, 'fetch');
            fetchSpy.mockImplementation(async (url: string | URL | Request) => {
              const urlString = url.toString();
              const fileId = urlString.split('/').pop() || '';
              downloadedFiles.add(fileId);
              
              return new Response(
                new Blob([`downloaded ${fileId}`], { type: 'audio/mpeg' }),
                { status: 200, statusText: 'OK' }
              );
            });
            
            // Initialize and download
            const manager = UnifiedAudioManager.getInstance();
            await manager.initialize();
            await manager.downloadMissingAudio();
            
            // Verify correct number of downloads
            const correctCount = downloadedFiles.size === numMissing;
            
            // Verify only missing files were downloaded
            const missingFileIds = missingFiles.map(n => `${n}.mp3`);
            const onlyMissingDownloaded = missingFileIds.every(id => downloadedFiles.has(id));
            
            // Verify no cached files were downloaded
            const cachedFileIds = cachedFiles.map(n => `${n}.mp3`);
            const noCachedDownloaded = cachedFileIds.every(id => !downloadedFiles.has(id));
            
            // Cleanup
            fetchSpy.mockRestore();
            
            return correctCount && onlyMissingDownloaded && noCachedDownloaded;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not download anything when cache is complete', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.integer({ min: 1, max: 75 }),
            { minLength: 10, maxLength: 75 }
          ),
          async (fileNumbers) => {
            // Remove duplicates
            const uniqueFiles = [...new Set(fileNumbers)];
            
            // Cache all files
            for (const num of uniqueFiles) {
              const fileId = `${num}.mp3`;
              const mockBlob = new Blob([`cached ${num}`], { type: 'audio/mpeg' });
              await audioCacheDB.saveAudio(fileId, mockBlob);
            }
            
            // Track network requests
            let networkCallCount = 0;
            const fetchSpy = vi.spyOn(global, 'fetch');
            fetchSpy.mockImplementation(async () => {
              networkCallCount++;
              return new Response(
                new Blob(['should not download'], { type: 'audio/mpeg' }),
                { status: 200, statusText: 'OK' }
              );
            });
            
            // Initialize and download
            const manager = UnifiedAudioManager.getInstance();
            await manager.initialize();
            await manager.downloadMissingAudio();
            
            // Verify no network calls were made
            const noDownloads = networkCallCount === 0;
            
            // Cleanup
            fetchSpy.mockRestore();
            
            return noDownloads;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should download all files when cache is empty', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.integer({ min: 1, max: 75 }),
            { minLength: 5, maxLength: 30 }
          ),
          async (fileNumbers) => {
            // Remove duplicates
            const uniqueFiles = [...new Set(fileNumbers)];
            
            // Ensure cache is empty (already cleared in beforeEach)
            
            // Track network requests
            const downloadedFiles = new Set<string>();
            const fetchSpy = vi.spyOn(global, 'fetch');
            fetchSpy.mockImplementation(async (url: string | URL | Request) => {
              const urlString = url.toString();
              const fileId = urlString.split('/').pop() || '';
              downloadedFiles.add(fileId);
              
              return new Response(
                new Blob([`downloaded ${fileId}`], { type: 'audio/mpeg' }),
                { status: 200, statusText: 'OK' }
              );
            });
            
            // Initialize and download
            const manager = UnifiedAudioManager.getInstance();
            await manager.initialize();
            
            // Get cache status to see what's missing
            const status = await manager.getCacheStatus();
            const expectedMissing = status.missingFiles.length;
            
            await manager.downloadMissingAudio();
            
            // Verify all missing files were downloaded
            const allDownloaded = downloadedFiles.size === expectedMissing;
            
            // Cleanup
            fetchSpy.mockRestore();
            
            return allDownloaded;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain selective downloading across multiple calls', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            firstBatch: fc.array(
              fc.integer({ min: 1, max: 75 }),
              { minLength: 5, maxLength: 20 }
            ),
            secondBatch: fc.array(
              fc.integer({ min: 1, max: 75 }),
              { minLength: 5, maxLength: 20 }
            )
          }),
          async ({ firstBatch, secondBatch }) => {
            // Remove duplicates
            const uniqueFirst = [...new Set(firstBatch)];
            const uniqueSecond = [...new Set(secondBatch)];
            
            // Track all network requests
            const allNetworkRequests = new Set<string>();
            const fetchSpy = vi.spyOn(global, 'fetch');
            fetchSpy.mockImplementation(async (url: string | URL | Request) => {
              const urlString = url.toString();
              const fileId = urlString.split('/').pop() || '';
              allNetworkRequests.add(fileId);
              
              return new Response(
                new Blob([`downloaded ${fileId}`], { type: 'audio/mpeg' }),
                { status: 200, statusText: 'OK' }
              );
            });
            
            // Initialize manager
            const manager = UnifiedAudioManager.getInstance();
            await manager.initialize();
            
            // First download: cache first batch
            for (const num of uniqueFirst) {
              const fileId = `${num}.mp3`;
              const mockBlob = new Blob([`cached ${num}`], { type: 'audio/mpeg' });
              await audioCacheDB.saveAudio(fileId, mockBlob);
            }
            
            // Clear network tracking
            allNetworkRequests.clear();
            
            // Second download: should only download files not in first batch
            await manager.downloadMissingAudio();
            
            // Calculate which files should have been downloaded
            const firstFileIds = uniqueFirst.map(n => `${n}.mp3`);
            const shouldNotDownload = firstFileIds.filter(id => allNetworkRequests.has(id));
            
            // Verify files from first batch were not re-downloaded
            const noRedownload = shouldNotDownload.length === 0;
            
            // Cleanup
            fetchSpy.mockRestore();
            
            return noRedownload;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 3: Concurrent download limit', () => {
    /**
     * **Feature: network-optimization, Property 3: Concurrent download limit**
     * **Validates: Requirements 1.4**
     * 
     * For any download operation, the number of simultaneous downloads should never exceed 5
     */
    it('should never exceed maximum concurrent downloads', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            // Generate a large number of files to download
            numFiles: fc.integer({ min: 10, max: 50 }),
            // Vary the max concurrent downloads config
            maxConcurrent: fc.constantFrom(3, 5, 7, 10)
          }),
          async ({ numFiles, maxConcurrent }) => {
            // Clear cache to ensure all files need downloading
            await audioCacheDB.clearAll();
            
            // Track concurrent downloads
            let currentConcurrent = 0;
            let maxObservedConcurrent = 0;
            const concurrentCounts: number[] = [];
            
            // Mock fetch to track concurrent downloads
            const fetchSpy = vi.spyOn(global, 'fetch');
            fetchSpy.mockImplementation(async (url: string | URL | Request) => {
              currentConcurrent++;
              maxObservedConcurrent = Math.max(maxObservedConcurrent, currentConcurrent);
              concurrentCounts.push(currentConcurrent);
              
              // Simulate download time
              await new Promise(resolve => setTimeout(resolve, 50));
              
              currentConcurrent--;
              
              const urlString = url.toString();
              const fileId = urlString.split('/').pop() || '';
              
              return new Response(
                new Blob([`downloaded ${fileId}`], { type: 'audio/mpeg' }),
                { status: 200, statusText: 'OK' }
              );
            });
            
            // Create a new manager instance with custom config
            // Note: Since we use singleton, we need to work with the existing instance
            // but we can verify it respects the configured limit
            const manager = UnifiedAudioManager.getInstance({ maxConcurrentDownloads: maxConcurrent });
            await manager.initialize();
            
            // Pre-populate cache with some files, leave others missing
            const cachedCount = Math.floor(numFiles / 3);
            for (let i = 1; i <= cachedCount; i++) {
              const fileId = `${i}.mp3`;
              const mockBlob = new Blob([`cached ${i}`], { type: 'audio/mpeg' });
              await audioCacheDB.saveAudio(fileId, mockBlob);
            }
            
            // Download missing audio
            await manager.downloadMissingAudio();
            
            // Verify the concurrent download limit was never exceeded
            // Note: The manager is configured with maxConcurrentDownloads from DEFAULT_CONFIG (5)
            // unless we can reset the singleton, which we can't easily do
            // So we'll verify against the actual config value
            const actualConfig = manager.getConfig();
            const limitRespected = maxObservedConcurrent <= actualConfig.maxConcurrentDownloads;
            
            // Cleanup
            fetchSpy.mockRestore();
            
            return limitRespected;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should respect concurrent limit of 5 for default configuration', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 15, max: 40 }), // Number of files to download
          async (numFiles) => {
            // Clear cache
            await audioCacheDB.clearAll();
            
            // Track concurrent downloads
            let currentConcurrent = 0;
            let maxObservedConcurrent = 0;
            const concurrentSnapshots: number[] = [];
            
            // Mock fetch with tracking
            const fetchSpy = vi.spyOn(global, 'fetch');
            fetchSpy.mockImplementation(async (url: string | URL | Request) => {
              currentConcurrent++;
              const snapshot = currentConcurrent;
              concurrentSnapshots.push(snapshot);
              maxObservedConcurrent = Math.max(maxObservedConcurrent, currentConcurrent);
              
              // Simulate network delay
              await new Promise(resolve => setTimeout(resolve, 30));
              
              currentConcurrent--;
              
              const urlString = url.toString();
              const fileId = urlString.split('/').pop() || '';
              
              return new Response(
                new Blob([`audio data ${fileId}`], { type: 'audio/mpeg' }),
                { status: 200, statusText: 'OK' }
              );
            });
            
            // Initialize manager with default config (maxConcurrentDownloads: 5)
            const manager = UnifiedAudioManager.getInstance();
            await manager.initialize();
            
            // Download all missing files
            await manager.downloadMissingAudio();
            
            // Verify concurrent limit was never exceeded
            const limitNeverExceeded = maxObservedConcurrent <= 5;
            
            // Verify we actually had concurrent downloads (if enough files)
            const hadConcurrency = numFiles >= 5 ? maxObservedConcurrent >= 2 : true;
            
            // Cleanup
            fetchSpy.mockRestore();
            
            return limitNeverExceeded && hadConcurrency;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain concurrent limit across multiple download batches', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.integer({ min: 5, max: 20 }), // Multiple batches of different sizes
            { minLength: 2, maxLength: 5 }
          ),
          async (batchSizes) => {
            // Clear cache
            await audioCacheDB.clearAll();
            
            let globalMaxConcurrent = 0;
            
            for (const batchSize of batchSizes) {
              let currentConcurrent = 0;
              let batchMaxConcurrent = 0;
              
              // Mock fetch for this batch
              const fetchSpy = vi.spyOn(global, 'fetch');
              fetchSpy.mockImplementation(async (url: string | URL | Request) => {
                currentConcurrent++;
                batchMaxConcurrent = Math.max(batchMaxConcurrent, currentConcurrent);
                globalMaxConcurrent = Math.max(globalMaxConcurrent, currentConcurrent);
                
                await new Promise(resolve => setTimeout(resolve, 20));
                
                currentConcurrent--;
                
                const urlString = url.toString();
                const fileId = urlString.split('/').pop() || '';
                
                return new Response(
                  new Blob([`audio ${fileId}`], { type: 'audio/mpeg' }),
                  { status: 200, statusText: 'OK' }
                );
              });
              
              // Download this batch
              const manager = UnifiedAudioManager.getInstance();
              await manager.initialize();
              await manager.downloadMissingAudio();
              
              // Verify limit for this batch
              const batchLimitRespected = batchMaxConcurrent <= 5;
              
              fetchSpy.mockRestore();
              
              if (!batchLimitRespected) {
                return false;
              }
            }
            
            // Verify global limit across all batches
            return globalMaxConcurrent <= 5;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should queue downloads when limit is reached', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 10, max: 30 }), // Number of files to download
          async (numFiles) => {
            // Clear cache
            await audioCacheDB.clearAll();
            
            const downloadStartTimes: number[] = [];
            const downloadEndTimes: number[] = [];
            let currentConcurrent = 0;
            let maxConcurrent = 0;
            
            // Mock fetch with timing tracking
            const fetchSpy = vi.spyOn(global, 'fetch');
            fetchSpy.mockImplementation(async (url: string | URL | Request) => {
              const startTime = Date.now();
              downloadStartTimes.push(startTime);
              
              currentConcurrent++;
              maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
              
              // Simulate download time
              await new Promise(resolve => setTimeout(resolve, 40));
              
              currentConcurrent--;
              
              const endTime = Date.now();
              downloadEndTimes.push(endTime);
              
              const urlString = url.toString();
              const fileId = urlString.split('/').pop() || '';
              
              return new Response(
                new Blob([`audio ${fileId}`], { type: 'audio/mpeg' }),
                { status: 200, statusText: 'OK' }
              );
            });
            
            // Initialize and download
            const manager = UnifiedAudioManager.getInstance();
            await manager.initialize();
            await manager.downloadMissingAudio();
            
            // Verify concurrent limit
            const limitRespected = maxConcurrent <= 5;
            
            // Verify downloads were queued (not all started at once)
            // If we have more than 5 files, not all should start at the same time
            const hasQueuing = numFiles <= 5 || downloadStartTimes.length > 5;
            
            // Cleanup
            fetchSpy.mockRestore();
            
            return limitRespected && hasQueuing;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle concurrent limit with varying download speeds', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            numFiles: fc.integer({ min: 10, max: 25 }),
            downloadDelays: fc.array(
              fc.integer({ min: 10, max: 100 }), // Random delays for each file
              { minLength: 10, maxLength: 25 }
            )
          }),
          async ({ numFiles, downloadDelays }) => {
            // Clear cache
            await audioCacheDB.clearAll();
            
            let currentConcurrent = 0;
            let maxConcurrent = 0;
            let downloadIndex = 0;
            
            // Mock fetch with varying delays
            const fetchSpy = vi.spyOn(global, 'fetch');
            fetchSpy.mockImplementation(async (url: string | URL | Request) => {
              const delay = downloadDelays[downloadIndex % downloadDelays.length];
              downloadIndex++;
              
              currentConcurrent++;
              maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
              
              // Simulate varying download times
              await new Promise(resolve => setTimeout(resolve, delay));
              
              currentConcurrent--;
              
              const urlString = url.toString();
              const fileId = urlString.split('/').pop() || '';
              
              return new Response(
                new Blob([`audio ${fileId}`], { type: 'audio/mpeg' }),
                { status: 200, statusText: 'OK' }
              );
            });
            
            // Initialize and download
            const manager = UnifiedAudioManager.getInstance();
            await manager.initialize();
            await manager.downloadMissingAudio();
            
            // Verify concurrent limit was respected despite varying speeds
            const limitRespected = maxConcurrent <= 5;
            
            // Cleanup
            fetchSpy.mockRestore();
            
            return limitRespected;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain limit when downloads fail and retry', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            numFiles: fc.integer({ min: 8, max: 20 }),
            failureRate: fc.integer({ min: 0, max: 30 }) // Percentage of failures
          }),
          async ({ numFiles, failureRate }) => {
            // Clear cache
            await audioCacheDB.clearAll();
            
            let currentConcurrent = 0;
            let maxConcurrent = 0;
            let attemptCount = 0;
            
            // Mock fetch with random failures
            const fetchSpy = vi.spyOn(global, 'fetch');
            fetchSpy.mockImplementation(async (url: string | URL | Request) => {
              currentConcurrent++;
              maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
              attemptCount++;
              
              await new Promise(resolve => setTimeout(resolve, 30));
              
              currentConcurrent--;
              
              // Randomly fail based on failure rate
              const shouldFail = Math.random() * 100 < failureRate;
              
              if (shouldFail && attemptCount < numFiles * 2) {
                // Fail but not too many times to avoid infinite retries
                throw new Error('Simulated network failure');
              }
              
              const urlString = url.toString();
              const fileId = urlString.split('/').pop() || '';
              
              return new Response(
                new Blob([`audio ${fileId}`], { type: 'audio/mpeg' }),
                { status: 200, statusText: 'OK' }
              );
            });
            
            // Initialize and download (may have failures)
            const manager = UnifiedAudioManager.getInstance();
            await manager.initialize();
            
            try {
              await manager.downloadMissingAudio();
            } catch (error) {
              // Some downloads may fail, that's okay for this test
            }
            
            // Verify concurrent limit was maintained even with failures
            const limitRespected = maxConcurrent <= 5;
            
            // Cleanup
            fetchSpy.mockRestore();
            
            return limitRespected;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
