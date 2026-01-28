import React, { useState } from 'react';
import { Activity, Clock, Database, Zap, TrendingUp, RefreshCw } from 'lucide-react';
import { usePerformanceMonitor } from '../hooks/usePerformanceMonitor';
import { optimizedApiClient } from '../utils/optimizedApiClient';

const PerformanceDashboard: React.FC = () => {
  const { metrics, getPerformanceSummary, clearMetrics } = usePerformanceMonitor();
  const [showDetails, setShowDetails] = useState(false);
  
  const summary = getPerformanceSummary();
  const cacheStats = optimizedApiClient.getCacheStats();

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'text-green-600 bg-green-100';
      case 'B': return 'text-blue-600 bg-blue-100';
      case 'C': return 'text-yellow-600 bg-yellow-100';
      case 'D': return 'text-orange-600 bg-orange-100';
      case 'F': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const clearAllCache = () => {
    optimizedApiClient.clearCache();
    clearMetrics();
    alert('Cache cleared and metrics reset!');
  };

  if (!showDetails) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setShowDetails(true)}
          className="bg-blue-500 hover:bg-blue-600 text-white p-3 rounded-full shadow-lg transition-colors"
          title="Show Performance Dashboard"
        >
          <Activity size={20} />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-4 w-80 max-h-96 overflow-y-auto">
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

      {/* Performance Grade */}
      <div className="mb-4">
        <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getGradeColor(summary.performanceGrade)}`}>
          <TrendingUp size={16} className="mr-1" />
          Grade: {summary.performanceGrade}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
            <Clock size={14} />
            Avg Load Time
          </div>
          <div className="text-lg font-semibold text-gray-800">
            {formatTime(metrics.averageLoadTime)}
          </div>
        </div>

        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
            <Zap size={14} />
            Cache Hit Rate
          </div>
          <div className="text-lg font-semibold text-gray-800">
            {metrics.cacheHitRate.toFixed(1)}%
          </div>
        </div>

        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
            <Database size={14} />
            Total Requests
          </div>
          <div className="text-lg font-semibold text-gray-800">
            {metrics.totalRequests}
          </div>
        </div>

        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
            <RefreshCw size={14} />
            Cache Items
          </div>
          <div className="text-lg font-semibold text-gray-800">
            {cacheStats.totalItems}
          </div>
        </div>
      </div>

      {/* Recent Performance */}
      <div className="mb-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Recent Performance (5min)</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Recent Requests:</span>
            <span className="font-medium">{summary.recentRequests}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Fast Requests (&lt;500ms):</span>
            <span className="font-medium text-green-600">{summary.fastRequests}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Slow Requests (&gt;1s):</span>
            <span className="font-medium text-red-600">{summary.slowRequests}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Avg Recent Load:</span>
            <span className="font-medium">{formatTime(summary.averageRecentLoadTime)}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={clearAllCache}
          className="flex-1 px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-sm rounded-lg transition-colors"
        >
          Clear Cache
        </button>
        <button
          onClick={clearMetrics}
          className="flex-1 px-3 py-2 bg-gray-500 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
        >
          Reset Metrics
        </button>
      </div>

      {/* Performance Tips */}
      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
        <h5 className="text-sm font-medium text-blue-800 mb-1">💡 Tips</h5>
        <ul className="text-xs text-blue-700 space-y-1">
          <li>• Cache hit rate &gt;80% is excellent</li>
          <li>• Load times &lt;500ms provide great UX</li>
          <li>• Clear cache if data seems stale</li>
        </ul>
      </div>

      <div className="mt-2 text-xs text-gray-500 text-center">
        Last updated: {metrics.lastUpdated.toLocaleTimeString()}
      </div>
    </div>
  );
};

export default PerformanceDashboard;