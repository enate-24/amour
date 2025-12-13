import React, { useState, useEffect } from 'react';
import { Download, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { UnifiedAudioManager } from '../utils/UnifiedAudioManager';
import { cartelaCacheDB } from '../utils/cartelaCache';
import { cartelaAPI } from '../lib/api';

interface PreloadStatus {
  audio: {
    total: number;
    cached: number;
    downloading: boolean;
    complete: boolean;
  };
  cartelas: {
    total: number;
    cached: number;
    downloading: boolean;
    complete: boolean;
  };
  overall: {
    complete: boolean;
    downloading: boolean;
  };
}

interface AutoPreloaderProps {
  onComplete?: () => void;
  showProgress?: boolean;
  autoStart?: boolean;
}

const AutoPreloader: React.FC<AutoPreloaderProps> = ({
  onComplete,
  showProgress = true,
  autoStart = true
}) => {
  const [status, setStatus] = useState<PreloadStatus>({
    audio: { total: 0, cached: 0, downloading: false, complete: false },
    cartelas: { total: 0, cached: 0, downloading: false, complete: false },
    overall: { complete: false, downloading: false }
  });
  const [error, setError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (autoStart) {
      checkStatusAndPreload();
    }
  }, [autoStart]);

  const checkStatusAndPreload = async () => {
    try {
      // Check if we've already completed preload recently (within last hour)
      const lastPreloadTime = localStorage.getItem('lastPreloadTime');
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      
      if (lastPreloadTime && parseInt(lastPreloadTime) > oneHourAgo) {
        console.log('✅ Preload completed recently - skipping check');
        onComplete?.();
        return;
      }

      // Check audio status
      const audioManager = UnifiedAudioManager.getInstance();
      const audioStatus = await audioManager.getCacheStatus();
      
      // Check cartela status
      const cartelaStats = await cartelaCacheDB.getCacheStats();
      
      // Check if cartela cache is recent (less than 24 hours old)
      const cartelaCacheAge = cartelaStats.count > 0 ? Date.now() - cartelaStats.newestCache : Infinity;
      const cartelaCacheValid = cartelaCacheAge < 24 * 60 * 60 * 1000; // 24 hours
      
      const newStatus: PreloadStatus = {
        audio: {
          total: audioStatus.totalFiles,
          cached: audioStatus.cachedFiles,
          downloading: false,
          complete: audioStatus.isComplete
        },
        cartelas: {
          total: cartelaStats.count > 0 ? cartelaStats.count : 0,
          cached: cartelaStats.count,
          downloading: false,
          complete: cartelaCacheValid && cartelaStats.count > 0
        },
        overall: {
          complete: audioStatus.isComplete && cartelaCacheValid && cartelaStats.count > 0,
          downloading: false
        }
      };

      setStatus(newStatus);

      // Only download if content is missing or outdated
      if (!newStatus.overall.complete) {
        console.log('🔄 Starting silent background preload...');
        if (showProgress) {
          setIsVisible(true);
        }
        await startPreloading(newStatus);
      } else {
        console.log('✅ All content already cached and up-to-date - skipping download');
        // Mark as completed to prevent repeated checks
        localStorage.setItem('lastPreloadTime', Date.now().toString());
        onComplete?.();
      }
    } catch (error) {
      console.error('❌ Error checking preload status:', error);
      setError('Failed to check cache status');
      // Still call onComplete to not block the app
      onComplete?.();
    }
  };

  const startPreloading = async (currentStatus: PreloadStatus) => {
    setStatus(prev => ({
      ...prev,
      overall: { ...prev.overall, downloading: true }
    }));

    try {
      // Start audio preloading if needed
      if (!currentStatus.audio.complete) {
        await preloadAudio();
      }

      // Start cartela preloading if needed
      if (!currentStatus.cartelas.complete) {
        await preloadCartelas();
      }

      // Mark as complete
      setStatus(prev => ({
        ...prev,
        overall: { complete: true, downloading: false }
      }));

      console.log('✅ Auto-preload completed successfully');
      
      // Mark completion time to prevent repeated downloads
      localStorage.setItem('lastPreloadTime', Date.now().toString());
      
      // Hide immediately if not showing progress, otherwise after short delay
      if (!showProgress) {
        setIsVisible(false);
        onComplete?.();
      } else {
        setTimeout(() => {
          setIsVisible(false);
          onComplete?.();
        }, 2000);
      }

    } catch (error) {
      console.error('❌ Preload failed:', error);
      setError('Preload failed. Content will load on-demand.');
      
      // Hide after error
      setTimeout(() => {
        setIsVisible(false);
      }, 5000);
    }
  };

  const preloadAudio = async () => {
    setStatus(prev => ({
      ...prev,
      audio: { ...prev.audio, downloading: true }
    }));

    try {
      const audioManager = UnifiedAudioManager.getInstance();
      
      await audioManager.downloadMissingAudio((current, total) => {
        setStatus(prev => ({
          ...prev,
          audio: {
            ...prev.audio,
            total,
            cached: current
          }
        }));
      });

      setStatus(prev => ({
        ...prev,
        audio: {
          ...prev.audio,
          downloading: false,
          complete: true
        }
      }));

      console.log('✅ Audio preload completed');
    } catch (error) {
      console.error('❌ Audio preload failed:', error);
      setStatus(prev => ({
        ...prev,
        audio: { ...prev.audio, downloading: false }
      }));
      throw error;
    }
  };

  const preloadCartelas = async () => {
    setStatus(prev => ({
      ...prev,
      cartelas: { ...prev.cartelas, downloading: true }
    }));

    try {
      // Check if we already have recent cartelas
      const currentStats = await cartelaCacheDB.getCacheStats();
      const cacheAge = currentStats.count > 0 ? Date.now() - currentStats.newestCache : Infinity;
      
      if (currentStats.count > 0 && cacheAge < 24 * 60 * 60 * 1000) {
        console.log('✅ Cartelas already cached and recent - skipping download');
        setStatus(prev => ({
          ...prev,
          cartelas: {
            total: currentStats.count,
            cached: currentStats.count,
            downloading: false,
            complete: true
          }
        }));
        return;
      }
      
      console.log('📥 Preloading cartelas silently...');
      
      const { data: cartelas, error: apiError } = await cartelaAPI.getAllCartelasPublic();
      
      if (apiError) {
        throw apiError;
      }

      if (cartelas && cartelas.length > 0) {
        await cartelaCacheDB.saveCartelas(cartelas);
        
        setStatus(prev => ({
          ...prev,
          cartelas: {
            total: cartelas.length,
            cached: cartelas.length,
            downloading: false,
            complete: true
          }
        }));

        console.log(`✅ Cartela preload completed silently: ${cartelas.length} cartelas cached`);
      } else {
        console.log('⚠️ No cartelas received from server - using existing cache');
        setStatus(prev => ({
          ...prev,
          cartelas: { ...prev.cartelas, downloading: false, complete: true }
        }));
      }
    } catch (error) {
      console.error('❌ Cartela preload failed (will use existing cache):', error);
      setStatus(prev => ({
        ...prev,
        cartelas: { ...prev.cartelas, downloading: false, complete: true }
      }));
      // Don't throw error - just continue with existing cache
    }
  };

  const getOverallProgress = () => {
    const audioProgress = status.audio.total > 0 ? (status.audio.cached / status.audio.total) : 1;
    const cartelaProgress = status.cartelas.total > 0 ? (status.cartelas.cached / status.cartelas.total) : 1;
    return Math.round(((audioProgress + cartelaProgress) / 2) * 100);
  };

  // Always return null if showProgress is false (silent mode)
  if (!showProgress) {
    return null;
  }

  if (!isVisible) {
    return null;
  }

  const overallProgress = getOverallProgress();

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-slate-800 rounded-lg p-8 max-w-md w-full mx-4 border border-slate-700">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center mb-4">
            {status.overall.complete ? (
              <CheckCircle className="text-green-400" size={48} />
            ) : error ? (
              <AlertCircle className="text-red-400" size={48} />
            ) : (
              <Loader2 className="text-yellow-400 animate-spin" size={48} />
            )}
          </div>
          
          <h2 className="text-2xl font-bold text-white mb-2">
            {status.overall.complete ? 'Ready to Play!' : 'Preparing Game...'}
          </h2>
          
          <p className="text-slate-300">
            {status.overall.complete 
              ? 'All content cached for offline play'
              : 'Downloading sounds and game data'
            }
          </p>
        </div>

        {/* Overall Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-300">Overall Progress</span>
            <span className="text-white font-semibold">{overallProgress}%</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all duration-300 ${
                status.overall.complete ? 'bg-green-500' : 'bg-yellow-400'
              }`}
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </div>

        {/* Audio Progress */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-slate-400">Audio Files</span>
            <span className="text-sm text-slate-300">
              {status.audio.cached}/{status.audio.total}
            </span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                status.audio.complete ? 'bg-green-500' : 'bg-blue-500'
              }`}
              style={{ 
                width: `${status.audio.total > 0 ? (status.audio.cached / status.audio.total) * 100 : 0}%` 
              }}
            />
          </div>
        </div>

        {/* Cartela Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-slate-400">Game Data</span>
            <span className="text-sm text-slate-300">
              {status.cartelas.complete ? 'Cached' : 'Loading...'}
            </span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                status.cartelas.complete ? 'bg-green-500' : 'bg-purple-500'
              }`}
              style={{ 
                width: `${status.cartelas.complete ? 100 : (status.cartelas.downloading ? 50 : 0)}%` 
              }}
            />
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-900/50 border border-red-500 rounded-lg text-red-200 text-sm text-center">
            {error}
          </div>
        )}

        {/* Status Text */}
        {!error && (
          <div className="text-center text-sm text-slate-400">
            {status.overall.complete 
              ? 'You can now play offline without using network data'
              : status.overall.downloading 
                ? 'This will only happen once...'
                : 'Checking cache status...'
            }
          </div>
        )}
      </div>
    </div>
  );
};

export default AutoPreloader;