import { useState, useEffect } from 'react';
import { UnifiedAudioManager, type VoiceCategory } from '../utils/UnifiedAudioManager';

interface VoiceSelectorProps {
  className?: string;
}

export const VoiceSelector: React.FC<VoiceSelectorProps> = ({ className = '' }) => {
  const [currentVoice, setCurrentVoice] = useState<VoiceCategory>('girl');
  const [isPlaying, setIsPlaying] = useState(false);

  // Get initial voice category from audio manager
  useEffect(() => {
    const audioManager = UnifiedAudioManager.getInstance();
    setCurrentVoice(audioManager.getVoiceCategory());
  }, []);

  // Save voice preference to localStorage
  useEffect(() => {
    localStorage.setItem('voiceCategory', currentVoice);
  }, [currentVoice]);

  // Load voice preference from localStorage on mount
  useEffect(() => {
    const savedVoice = localStorage.getItem('voiceCategory') as VoiceCategory;
    if (savedVoice && (savedVoice === 'boy' || savedVoice === 'girl')) {
      setCurrentVoice(savedVoice);
      const audioManager = UnifiedAudioManager.getInstance();
      audioManager.setVoiceCategory(savedVoice);
    }
  }, []);

  const handleVoiceChange = async (voice: VoiceCategory) => {
    if (voice === currentVoice || isPlaying) return;

    setIsPlaying(true);
    
    try {
      const audioManager = UnifiedAudioManager.getInstance();
      
      // Switch voice category
      audioManager.setVoiceCategory(voice);
      setCurrentVoice(voice);
      
      // Play a sample number to demonstrate the voice
      const sampleNumber = Math.floor(Math.random() * 75) + 1;
      await audioManager.playSound(sampleNumber);
      
      console.log(`🎤 Voice changed to ${voice}, played sample: ${sampleNumber}`);
    } catch (error) {
      console.error('Error changing voice:', error);
    } finally {
      // Reset playing state after a delay
      setTimeout(() => setIsPlaying(false), 2000);
    }
  };

  return (
    <div className={`voice-selector ${className}`}>
      <div className="voice-selector-label">
        <span className="text-sm font-medium text-gray-700">Voice:</span>
      </div>
      
      <div className="voice-buttons">
        <button
          onClick={() => handleVoiceChange('boy')}
          disabled={isPlaying}
          className={`voice-button ${
            currentVoice === 'boy' 
              ? 'voice-button-active' 
              : 'voice-button-inactive'
          } ${isPlaying ? 'voice-button-disabled' : ''}`}
          title="Switch to boy voice"
        >
          👦 Boy
        </button>
        
        <button
          onClick={() => handleVoiceChange('girl')}
          disabled={isPlaying}
          className={`voice-button ${
            currentVoice === 'girl' 
              ? 'voice-button-active' 
              : 'voice-button-inactive'
          } ${isPlaying ? 'voice-button-disabled' : ''}`}
          title="Switch to girl voice"
        >
          👧 Girl
        </button>
      </div>
      
      {isPlaying && (
        <div className="voice-playing-indicator">
          <span className="text-xs text-blue-600">🔊 Playing sample...</span>
        </div>
      )}
      
      <style jsx>{`
        .voice-selector {
          display: flex;
          flex-direction: column;
          gap: 8px;
          align-items: center;
          padding: 12px;
          background: rgba(255, 255, 255, 0.9);
          border-radius: 8px;
          border: 1px solid #e5e7eb;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .voice-selector-label {
          font-size: 14px;
          font-weight: 500;
          color: #374151;
        }
        
        .voice-buttons {
          display: flex;
          gap: 8px;
        }
        
        .voice-button {
          padding: 8px 16px;
          border-radius: 6px;
          border: 2px solid transparent;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          min-width: 80px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
        }
        
        .voice-button-active {
          background: linear-gradient(180deg, #3b82f6 0%, #1d4ed8 100%);
          color: white;
          border-color: #1d4ed8;
          box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
        }
        
        .voice-button-inactive {
          background: linear-gradient(180deg, #f3f4f6 0%, #e5e7eb 100%);
          color: #374151;
          border-color: #d1d5db;
        }
        
        .voice-button-inactive:hover {
          background: linear-gradient(180deg, #e5e7eb 0%, #d1d5db 100%);
          border-color: #9ca3af;
        }
        
        .voice-button-disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        .voice-playing-indicator {
          font-size: 12px;
          color: #3b82f6;
          animation: pulse 1s ease-in-out infinite;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        @media (max-width: 640px) {
          .voice-selector {
            padding: 8px;
            gap: 6px;
          }
          
          .voice-button {
            padding: 6px 12px;
            font-size: 12px;
            min-width: 70px;
          }
        }
      `}</style>
    </div>
  );
};

export default VoiceSelector;