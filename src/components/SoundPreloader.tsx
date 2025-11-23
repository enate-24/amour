import React, { useEffect } from 'react';

interface SoundPreloaderProps {
  onPreloadComplete?: () => void;
}

const SoundPreloader: React.FC<SoundPreloaderProps> = ({ onPreloadComplete }) => {
  useEffect(() => {
    const preloadSounds = async () => {
      console.log('🔄 Skipping sound preloading to reduce system lag...');
      
      // Skip preloading to reduce system load and lag
      // Sounds will load on-demand when needed
      console.log('✅ Sound system ready (on-demand loading)');
      onPreloadComplete?.();
      return;
      
      const soundPromises: Promise<void>[] = [];
      
      // Preload number sounds (1-75) from LOCAL files
      for (let i = 1; i <= 75; i++) {
        const promise = new Promise<void>((resolve) => {
          const audio = new Audio(`/sounds/${i}.wav`);
          audio.preload = 'auto';
          
          const onLoad = () => {
            audio.removeEventListener('canplaythrough', onLoad);
            audio.removeEventListener('error', onError);
            resolve();
          };
          
          const onError = () => {
            audio.removeEventListener('canplaythrough', onLoad);
            audio.removeEventListener('error', onError);
            console.log(`⚠️ Failed to preload sound ${i}`);
            resolve(); // Don't fail the whole process
          };
          
          audio.addEventListener('canplaythrough', onLoad, { once: true });
          audio.addEventListener('error', onError, { once: true });
          
          // Timeout after 5 seconds
          setTimeout(() => {
            audio.removeEventListener('canplaythrough', onLoad);
            audio.removeEventListener('error', onError);
            resolve();
          }, 5000);
          
          audio.load();
        });
        
        soundPromises.push(promise);
      }
      
      // Preload other game sounds from LOCAL files
      const otherSounds = [
        { name: 'start', file: 'start.wav' },
        { name: 'winner', file: 'winner.wav' },
        { name: 'notwinner', file: 'notwinner.wav' }
      ];
      for (const sound of otherSounds) {
        const promise = new Promise<void>((resolve) => {
          const audio = new Audio(`/sounds/${sound.file}`);
          audio.preload = 'auto';
          
          const onLoad = () => {
            audio.removeEventListener('canplaythrough', onLoad);
            audio.removeEventListener('error', onError);
            resolve();
          };
          
          const onError = () => {
            audio.removeEventListener('canplaythrough', onLoad);
            audio.removeEventListener('error', onError);
            console.log(`⚠️ Failed to preload sound ${sound.name}`);
            resolve();
          };
          
          audio.addEventListener('canplaythrough', onLoad, { once: true });
          audio.addEventListener('error', onError, { once: true });
          
          setTimeout(() => {
            audio.removeEventListener('canplaythrough', onLoad);
            audio.removeEventListener('error', onError);
            resolve();
          }, 5000);
          
          audio.load();
        });
        
        soundPromises.push(promise);
      }
      
      // Wait for all sounds to preload (or timeout)
      await Promise.all(soundPromises);
      
      console.log('✅ Sound preloading completed');
      onPreloadComplete?.();
    };
    
    preloadSounds();
  }, [onPreloadComplete]);
  
  return null; // This component doesn't render anything
};

export default SoundPreloader;