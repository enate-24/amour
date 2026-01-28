import { useState, useEffect, useCallback } from 'react';

interface PerformanceMetrics {
  loadTime: number;
  cacheHitRate: number;
  totalRequests: number;
  cacheHits: number;
  averageLoadTime: number;
  lastUpdated: Date;
}

interface PerformanceEntry {
  timestamp: number;
  loadTime: number;
  fromCache: boolean;
  operation: string;
}

export const usePerformanceMonitor = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    loadTime: 0,
    cacheHitRate: 0,
    totalRequests: 0,
    cacheHits: 0,
    averageLoadTime: 0,
    lastUpdated: new Date()
  });

  const [entries, setEntries] = useState<PerformanceEntry[]>([]);

  // Record a performance entry
  const recordEntry = useCallback((operation: string, loadTime: number, fromCache: boolean) => {
    const entry: PerformanceEntry = {
      timestamp: Date.now(),
      loadTime,
      fromCache,
      operation
    };

    setEntries(prev => {
      const newEntries = [...prev, entry];
      // Keep only last 100 entries to prevent memory issues
      return newEntries.slice(-100);
    });

    // Update metrics
    setMetrics(prev => {
      const totalRequests = prev.totalRequests + 1;
      const cacheHits = prev.cacheHits + (fromCache ? 1 : 0);
      const cacheHitRate = (cacheHits / totalRequests) * 100;
      
      // Calculate average load time (only for non-cached requests for more accurate API performance)
      const nonCachedEntries = [...entries, entry].filter(e => !e.fromCache);
      const averageLoadTime = nonCachedEntries.length > 0 
        ? nonCachedEntries.reduce((sum, e) => sum + e.loadTime, 0) / nonCachedEntries.length
        : 0;

      return {
        loadTime,
        cacheHitRate,
        totalRequests,
        cacheHits,
        averageLoadTime,
        lastUpdated: new Date()
      };
    });
  }, [entries]);

  // Get performance summary
  const getPerformanceSummary = useCallback(() => {
    const recentEntries = entries.filter(e => Date.now() - e.timestamp < 5 * 60 * 1000); // Last 5 minutes
    const slowRequests = recentEntries.filter(e => e.loadTime > 1000 && !e.fromCache);
    const fastRequests = recentEntries.filter(e => e.loadTime < 500);

    return {
      recentRequests: recentEntries.length,
      slowRequests: slowRequests.length,
      fastRequests: fastRequests.length,
      averageRecentLoadTime: recentEntries.length > 0 
        ? recentEntries.reduce((sum, e) => sum + e.loadTime, 0) / recentEntries.length 
        : 0,
      performanceGrade: getPerformanceGrade(metrics.averageLoadTime, metrics.cacheHitRate)
    };
  }, [entries, metrics]);

  // Clear metrics
  const clearMetrics = useCallback(() => {
    setMetrics({
      loadTime: 0,
      cacheHitRate: 0,
      totalRequests: 0,
      cacheHits: 0,
      averageLoadTime: 0,
      lastUpdated: new Date()
    });
    setEntries([]);
  }, []);

  // Auto-cleanup old entries
  useEffect(() => {
    const cleanup = setInterval(() => {
      const cutoff = Date.now() - 30 * 60 * 1000; // 30 minutes
      setEntries(prev => prev.filter(entry => entry.timestamp > cutoff));
    }, 5 * 60 * 1000); // Run every 5 minutes

    return () => clearInterval(cleanup);
  }, []);

  return {
    metrics,
    entries,
    recordEntry,
    getPerformanceSummary,
    clearMetrics
  };
};

// Helper function to grade performance
function getPerformanceGrade(averageLoadTime: number, cacheHitRate: number): string {
  let score = 0;

  // Load time scoring (0-50 points)
  if (averageLoadTime < 200) score += 50;
  else if (averageLoadTime < 500) score += 40;
  else if (averageLoadTime < 1000) score += 30;
  else if (averageLoadTime < 2000) score += 20;
  else score += 10;

  // Cache hit rate scoring (0-50 points)
  if (cacheHitRate > 80) score += 50;
  else if (cacheHitRate > 60) score += 40;
  else if (cacheHitRate > 40) score += 30;
  else if (cacheHitRate > 20) score += 20;
  else score += 10;

  // Convert to letter grade
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

export default usePerformanceMonitor;