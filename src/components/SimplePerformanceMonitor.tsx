import React, { useState, useEffect } from 'react';
import { Activity, Clock, Database } from 'lucide-react';

interface PerformanceStats {
  loadTime: number;
  requestCount: number;
  cacheHits: number;
  lastUpdated: Date;
}

const SimplePerformanceMonitor: React.FC = () => {
  const [showDetails, setShowDetails] = useState(false);
  const [stats, setStats] = useState<PerformanceStats>({
    loadTime: 0,
    requestCount: 0,
    cacheHits: 0,
    lastUpdated: new Date()
  });

  // Simple performance tracking
  useEffect(() => {
    const updateStats = () => {
      // Get basic performance info from sessionStorage
      const cacheKeys = Object.keys(sessionStorage).filter(key => key.startsWith('cache_'));
      const requestCount = parseInt(sessionStorage.getItem('perf_requests') || '0');
      const totalLoadTime = parseFloat(sessionStorage.getItem('perf_total_time') || '0');
      
      setStats({
        loadTime: requestCount > 0 ? totalLoadTime / requestCount : 0,
        requestCount: requestCount,
        cacheHits: cacheKeys.length,
        lastUpdated: new Date()
      });
    };

    updateStats();
    const interval = setInterval(updateStats, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const clearCache = () => {
    // Clear performance cache
    const keysToRemove = Object.keys(sessionStorage).filter(key => 
      key.startsWith('cache_') || key.startsWith('perf_')
    );
    keysToRemove.forEach(key => sessionStorage.removeItem(key));
    
    setStats({
      loadTime: 0,
      requestCount: 0,
      cacheHits: 0,
      lastUpdated: new Date()
    });
    
    alert('Cache cleared!');
  };

  if (!showDetails) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setShowDetails(true)}
          className="bg-blue-500 hover:bg-blue-600 text-white p-3 rounded-full shadow-lg transition-colors"
          title="Show Performance Monitor"
        >
          <Activity size={20} />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-4 w-72">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <Activity size={20} />
          Performance
        </h3>
        <button
          onClick={() => setShowDetails(false)}
          className="text-gray-400 hover:text-gray-600"
        >
          ×
        </button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 gap-3 mb-4">
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
            <Clock size={14} />
            Avg Load Time
          </div>
          <div className="text-lg font-semibold text-gray-800">
            {formatTime(stats.loadTime)}
          </div>
        </div>

        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
            <Database size={14} />
            Requests / Cache Items
          </div>
          <div className="text-lg font-semibold text-gray-800">
            {stats.requestCount} / {stats.cacheHits}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={clearCache}
          className="flex-1 px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-sm rounded-lg transition-colors"
        >
          Clear Cache
        </button>
      </div>

      <div className="text-xs text-gray-500 text-center">
        Last updated: {stats.lastUpdated.toLocaleTimeString()}
      </div>
    </div>
  );
};

export default SimplePerformanceMonitor;