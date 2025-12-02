// Optimized Polling Utility
// Implements smart polling with exponential backoff, visibility detection, and error handling

interface PollingOptions {
  interval: number; // Base interval in milliseconds
  maxInterval?: number; // Maximum interval for backoff (default: 60000ms)
  backoffMultiplier?: number; // Multiplier for exponential backoff (default: 1.5)
  stopOnError?: boolean; // Stop polling on error (default: false)
  pauseWhenHidden?: boolean; // Pause when document is hidden (default: true)
  onError?: (error: Error) => void; // Error callback
  onSuccess?: () => void; // Success callback
  offlineCallback?: () => Promise<void>; // Callback for offline mode
  continueOffline?: boolean; // Continue polling when offline (default: false)
}

class OptimizedPoller {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private currentInterval: number;
  private consecutiveErrors = 0;
  private isRunning = false;
  private isPaused = false;
  private options: Required<PollingOptions>;
  private callback: () => Promise<void>;
  private visibilityHandler: (() => void) | null = null;
  private isExecuting = false;

  constructor(callback: () => Promise<void>, options: PollingOptions) {
    this.callback = callback;
    this.currentInterval = options.interval;
    this.options = {
      interval: options.interval,
      maxInterval: options.maxInterval ?? 60000,
      backoffMultiplier: options.backoffMultiplier ?? 1.5,
      stopOnError: options.stopOnError ?? false,
      pauseWhenHidden: options.pauseWhenHidden ?? true,
      onError: options.onError ?? (() => {}),
      onSuccess: options.onSuccess ?? (() => {}),
      offlineCallback: options.offlineCallback,
      continueOffline: options.continueOffline ?? false
    };
    console.log(`🔧 OptimizedPoller created with interval: ${this.currentInterval}ms, offline mode: ${this.options.continueOffline}`);
  }

  start(): void {
    if (this.isRunning) {
      console.warn('Poller is already running');
      return;
    }

    this.isRunning = true;
    this.isPaused = false;
    this.consecutiveErrors = 0;
    this.currentInterval = this.options.interval;

    // Set up visibility change handler
    if (this.options.pauseWhenHidden) {
      this.visibilityHandler = () => {
        if (document.hidden) {
          this.pause();
        } else {
          this.resume();
        }
      };
      document.addEventListener('visibilitychange', this.visibilityHandler);
    }

    console.log(`✅ Polling started with ${this.currentInterval}ms interval`);
    
    // Use setInterval for consistent timing
    this.intervalId = setInterval(() => {
      const now = new Date().toLocaleTimeString();
      console.log(`🔔 [${now}] Interval fired (${this.currentInterval}ms)`);
      this.execute();
    }, this.currentInterval);

    // Execute first call immediately
    console.log(`🔔 [${new Date().toLocaleTimeString()}] First call (immediate)`);
    this.execute();
  }

  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    this.isPaused = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }

    console.log('⏹️ Polling stopped');
  }

  pause(): void {
    if (!this.isRunning || this.isPaused) return;

    this.isPaused = true;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    console.log('⏸️ Polling paused');
  }

  resume(): void {
    if (!this.isRunning || !this.isPaused) return;

    this.isPaused = false;
    console.log('▶️ Polling resumed');
    
    // Restart interval
    this.intervalId = setInterval(() => {
      this.execute();
    }, this.currentInterval);
  }

  updateInterval(newInterval: number): void {
    this.options.interval = newInterval;
    this.currentInterval = newInterval;
    this.consecutiveErrors = 0; // Reset backoff

    console.log(`🔄 Polling interval updated to ${newInterval}ms`);

    if (this.isRunning && !this.isPaused) {
      // Restart with new interval
      if (this.intervalId) {
        clearInterval(this.intervalId);
      }
      this.intervalId = setInterval(() => {
        this.execute();
      }, this.currentInterval);
    }
  }

  private async execute(): Promise<void> {
    // Skip if already executing to prevent overlapping calls
    if (this.isExecuting) {
      console.warn('⚠️ Skipping execution - previous call still in progress');
      return;
    }

    // Skip if document is hidden and pause is enabled
    if (this.options.pauseWhenHidden && document.hidden) {
      return;
    }

    this.isExecuting = true;

    try {
      await this.callback();
      
      // Success - reset backoff if needed
      if (this.consecutiveErrors > 0) {
        console.log('✅ Polling recovered, resetting interval');
        this.consecutiveErrors = 0;
        this.currentInterval = this.options.interval;
        
        // Restart interval with normal timing
        if (this.intervalId) {
          clearInterval(this.intervalId);
          this.intervalId = setInterval(() => {
            this.execute();
          }, this.currentInterval);
        }
      }
      
      this.options.onSuccess();
    } catch (error) {
      this.consecutiveErrors++;
      const err = error instanceof Error ? error : new Error(String(error));
      
      // Check if this is a network error and we have offline mode enabled
      const isNetworkError = err.message.includes('Failed to fetch') || 
                            err.message.includes('Network') || 
                            err.message.includes('offline') ||
                            !navigator.onLine;
      
      if (isNetworkError && this.options.continueOffline && this.options.offlineCallback) {
        console.log('📡 Network offline - switching to offline mode');
        try {
          await this.options.offlineCallback();
          // Reset consecutive errors since offline mode succeeded
          this.consecutiveErrors = 0;
          this.options.onSuccess();
        } catch (offlineError) {
          console.error('❌ Offline callback error:', offlineError);
          this.options.onError(offlineError instanceof Error ? offlineError : new Error(String(offlineError)));
        }
      } else {
        console.error(`❌ Polling error (attempt ${this.consecutiveErrors}):`, err.message);
        this.options.onError(err);

        if (this.options.stopOnError) {
          console.log('⏹️ Stopping polling due to error');
          this.stop();
          return;
        }

        // Apply exponential backoff
        const oldInterval = this.currentInterval;
        this.currentInterval = Math.min(
          this.currentInterval * this.options.backoffMultiplier,
          this.options.maxInterval
        );
        
        if (oldInterval !== this.currentInterval) {
          console.log(`⏱️ Backing off to ${this.currentInterval}ms`);
          // Restart interval with backoff timing
          if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = setInterval(() => {
              this.execute();
            }, this.currentInterval);
          }
        }
      }
    } finally {
      this.isExecuting = false;
    }
  }

  isActive(): boolean {
    return this.isRunning && !this.isPaused;
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      currentInterval: this.currentInterval,
      consecutiveErrors: this.consecutiveErrors
    };
  }
}

/**
 * Create an optimized poller
 */
export function createPoller(
  callback: () => Promise<void>,
  options: PollingOptions
): OptimizedPoller {
  return new OptimizedPoller(callback, options);
}

/**
 * React hook for optimized polling
 */
export function useOptimizedPolling(
  callback: () => Promise<void>,
  options: PollingOptions & { enabled?: boolean }
): {
  start: () => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  updateInterval: (interval: number) => void;
  isActive: () => boolean;
  getStatus: () => ReturnType<OptimizedPoller['getStatus']>;
} {
  const pollerRef = React.useRef<OptimizedPoller | null>(null);
  const { enabled = true, ...pollingOptions } = options;

  React.useEffect(() => {
    if (!enabled) return;

    // Create poller
    pollerRef.current = new OptimizedPoller(callback, pollingOptions);
    pollerRef.current.start();

    // Cleanup
    return () => {
      pollerRef.current?.stop();
      pollerRef.current = null;
    };
  }, [enabled, pollingOptions.interval]);

  return {
    start: () => pollerRef.current?.start(),
    stop: () => pollerRef.current?.stop(),
    pause: () => pollerRef.current?.pause(),
    resume: () => pollerRef.current?.resume(),
    updateInterval: (interval: number) => pollerRef.current?.updateInterval(interval),
    isActive: () => pollerRef.current?.isActive() ?? false,
    getStatus: () => pollerRef.current?.getStatus() ?? {
      isRunning: false,
      isPaused: false,
      currentInterval: 0,
      consecutiveErrors: 0
    }
  };
}

// Re-export React for the hook
import * as React from 'react';

export { OptimizedPoller };
