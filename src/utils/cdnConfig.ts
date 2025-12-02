/**
 * CDN Configuration for Static Assets
 * 
 * This module provides configuration for loading static assets from CDN
 * to improve performance and reduce server load.
 */

export interface CDNConfig {
  enabled: boolean;
  baseUrl: string;
  audioPath: string;
  fallbackToLocal: boolean;
}

// CDN configuration - can be overridden via environment variables
export const cdnConfig: CDNConfig = {
  enabled: import.meta.env.VITE_CDN_ENABLED === 'true',
  baseUrl: import.meta.env.VITE_CDN_BASE_URL || '',
  audioPath: import.meta.env.VITE_CDN_AUDIO_PATH || '/sounds',
  fallbackToLocal: true
};

/**
 * Get the URL for an audio file, using CDN if enabled
 */
export function getAudioCDNUrl(filename: string): string {
  if (cdnConfig.enabled && cdnConfig.baseUrl) {
    return `${cdnConfig.baseUrl}${cdnConfig.audioPath}/${filename}`;
  }
  // Fallback to local
  return `/sounds/${filename}`;
}

/**
 * Get the URL for any static asset, using CDN if enabled
 */
export function getStaticAssetUrl(path: string): string {
  if (cdnConfig.enabled && cdnConfig.baseUrl) {
    return `${cdnConfig.baseUrl}${path}`;
  }
  return path;
}

/**
 * Preload critical assets from CDN
 */
export function preloadCriticalAssets(assets: string[]): void {
  assets.forEach(asset => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = determineAssetType(asset);
    link.href = getStaticAssetUrl(asset);
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  });
}

function determineAssetType(path: string): string {
  if (path.endsWith('.mp3') || path.endsWith('.wav')) return 'audio';
  if (path.endsWith('.jpg') || path.endsWith('.png') || path.endsWith('.webp')) return 'image';
  if (path.endsWith('.js')) return 'script';
  if (path.endsWith('.css')) return 'style';
  return 'fetch';
}

/**
 * Test CDN availability
 */
export async function testCDNAvailability(): Promise<boolean> {
  if (!cdnConfig.enabled || !cdnConfig.baseUrl) {
    return false;
  }

  try {
    const response = await fetch(`${cdnConfig.baseUrl}/health`, {
      method: 'HEAD',
      mode: 'no-cors'
    });
    return true;
  } catch (error) {
    console.warn('CDN not available, falling back to local assets');
    return false;
  }
}

// Log CDN configuration in development
if (import.meta.env.DEV) {
  console.log('📦 CDN Configuration:', {
    enabled: cdnConfig.enabled,
    baseUrl: cdnConfig.baseUrl || 'Not configured',
    audioPath: cdnConfig.audioPath,
    fallbackToLocal: cdnConfig.fallbackToLocal
  });
}
