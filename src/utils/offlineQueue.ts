// Offline Queue for API Requests
// Queues failed requests and retries them when network is restored

import { networkStatusManager } from './networkStatus';

interface QueuedRequest {
  id: string;
  url: string;
  options: RequestInit;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

class OfflineQueue {
  private queue: QueuedRequest[] = [];
  private processing = false;
  private readonly STORAGE_KEY = 'offline_queue';
  private readonly MAX_QUEUE_SIZE = 50;
  private readonly MAX_RETRIES = 3;

  constructor() {
    this.loadQueue();
    this.setupNetworkListener();
  }

  private setupNetworkListener(): void {
    networkStatusManager.subscribe((isOnline) => {
      if (isOnline && this.queue.length > 0) {
        console.log(`📤 Network restored, processing ${this.queue.length} queued requests`);
        this.processQueue();
      }
    });
  }

  private loadQueue(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
        console.log(`📥 Loaded ${this.queue.length} queued requests from storage`);
      }
    } catch (error) {
      console.error('Failed to load offline queue:', error);
      this.queue = [];
    }
  }

  private saveQueue(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      console.error('Failed to save offline queue:', error);
    }
  }

  add(url: string, options: RequestInit = {}): string {
    // Don't queue GET requests (they should use cache)
    const method = options.method?.toUpperCase() || 'GET';
    if (method === 'GET') {
      return '';
    }

    // Check queue size limit
    if (this.queue.length >= this.MAX_QUEUE_SIZE) {
      console.warn('⚠️ Offline queue is full, removing oldest request');
      this.queue.shift();
    }

    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const request: QueuedRequest = {
      id,
      url,
      options,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: this.MAX_RETRIES
    };

    this.queue.push(request);
    this.saveQueue();

    console.log(`📝 Queued request: ${method} ${url} (queue size: ${this.queue.length})`);
    return id;
  }

  remove(id: string): void {
    const index = this.queue.findIndex(req => req.id === id);
    if (index !== -1) {
      this.queue.splice(index, 1);
      this.saveQueue();
    }
  }

  async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    if (!networkStatusManager.isOnline) {
      console.log('📡 Cannot process queue: offline');
      return;
    }

    this.processing = true;
    console.log(`🔄 Processing ${this.queue.length} queued requests...`);

    const results = {
      success: 0,
      failed: 0,
      retrying: 0
    };

    // Process requests sequentially to avoid overwhelming the server
    while (this.queue.length > 0) {
      const request = this.queue[0];

      try {
        const response = await fetch(request.url, request.options);

        if (response.ok) {
          console.log(`✅ Queued request succeeded: ${request.url}`);
          this.queue.shift(); // Remove from queue
          results.success++;
        } else if (response.status >= 400 && response.status < 500) {
          // Client error - don't retry
          console.error(`❌ Queued request failed (client error): ${request.url}`);
          this.queue.shift(); // Remove from queue
          results.failed++;
        } else {
          // Server error - retry
          request.retryCount++;
          if (request.retryCount >= request.maxRetries) {
            console.error(`❌ Queued request failed (max retries): ${request.url}`);
            this.queue.shift(); // Remove from queue
            results.failed++;
          } else {
            console.warn(`⚠️ Queued request failed, will retry: ${request.url}`);
            this.queue.shift(); // Move to end
            this.queue.push(request);
            results.retrying++;
          }
        }
      } catch (error) {
        request.retryCount++;
        if (request.retryCount >= request.maxRetries) {
          console.error(`❌ Queued request error (max retries): ${request.url}`, error);
          this.queue.shift(); // Remove from queue
          results.failed++;
        } else {
          console.warn(`⚠️ Queued request error, will retry: ${request.url}`, error);
          this.queue.shift(); // Move to end
          this.queue.push(request);
          results.retrying++;
          break; // Stop processing if network error
        }
      }

      this.saveQueue();

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.processing = false;
    console.log(`✅ Queue processing complete: ${results.success} succeeded, ${results.failed} failed, ${results.retrying} retrying`);
  }

  getQueueSize(): number {
    return this.queue.length;
  }

  getQueue(): QueuedRequest[] {
    return [...this.queue];
  }

  clear(): void {
    this.queue = [];
    this.saveQueue();
    console.log('🗑️ Offline queue cleared');
  }
}

// Singleton instance
const offlineQueue = new OfflineQueue();

// Enhanced fetch that queues requests when offline
export async function offlineAwareFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  if (networkStatusManager.isOffline) {
    const method = options.method?.toUpperCase() || 'GET';
    
    if (method !== 'GET') {
      // Queue non-GET requests
      offlineQueue.add(url, options);
      throw new Error('Network offline - request queued for later');
    } else {
      // GET requests should fail immediately (use cache)
      throw new Error('Network offline - check cache');
    }
  }

  try {
    const response = await fetch(url, options);
    return response;
  } catch (error) {
    // Network error - queue if not GET
    const method = options.method?.toUpperCase() || 'GET';
    if (method !== 'GET') {
      offlineQueue.add(url, options);
    }
    throw error;
  }
}

export { offlineQueue };
