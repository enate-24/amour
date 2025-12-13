import React, { useState, useEffect } from 'react';
import { ArrowLeft, Settings as SettingsIcon, DollarSign, Percent, Volume2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AudioCacheManager from './AudioCacheManager';
import { UnifiedAudioManager, type VoiceCategory } from '../utils/UnifiedAudioManager';
import VoiceCategoryManager from '../utils/voiceCategoryManager';

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
  
  const [selectedPattern, setSelectedPattern] = useState<string>("Two Lines");
  const [betAmount, setBetAmount] = useState<number>(5);
  const [houseCutPercentage, setHouseCutPercentage] = useState<number>(10);
  const [voiceCategory, setVoiceCategory] = useState<VoiceCategory | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [saveMessage, setSaveMessage] = useState<string>("");
  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);
  const [isPlayingVoiceSample, setIsPlayingVoiceSample] = useState<boolean>(false);

  const patternOptions = [
    "One Line",
    "Two Lines",
    "Three Lines",
    "Full House"
  ];

  // Load settings from backend on component mount
  useEffect(() => {
    loadSettings();
  }, []);

  // Auto-save when pattern changes
  useEffect(() => {
    if (!isLoading && !isInitialLoad && selectedPattern) {
      console.log('🔄 Pattern changed to:', selectedPattern, '- Auto-saving...');
      saveSettings();
    }
  }, [selectedPattern]);

  // Auto-save when bet amount changes (with debounce)
  useEffect(() => {
    if (!isLoading && !isInitialLoad && betAmount > 0) {
      const timeoutId = setTimeout(() => {
        console.log('🔄 Bet amount changed to:', betAmount, '- Auto-saving...');
        saveSettings();
      }, 1000); // 1 second debounce
      
      return () => clearTimeout(timeoutId);
    }
  }, [betAmount]);

  // Auto-save when house cut changes (with debounce)
  useEffect(() => {
    if (!isLoading && !isInitialLoad && houseCutPercentage >= 0) {
      const timeoutId = setTimeout(() => {
        console.log('🔄 House cut changed to:', houseCutPercentage, '- Auto-saving...');
        saveSettings();
      }, 1000); // 1 second debounce
      
      return () => clearTimeout(timeoutId);
    }
  }, [houseCutPercentage]);

  // Auto-save when voice category changes
  useEffect(() => {
    if (!isLoading && !isInitialLoad && voiceCategory) {
      console.log('🔄 Voice category changed to:', voiceCategory, '- Auto-saving...');
      console.log('🔄 Settings state - isLoading:', isLoading, 'isInitialLoad:', isInitialLoad);
      
      // Save to database
      saveSettings();
      
      // Use voice category manager for persistence
      VoiceCategoryManager.setVoiceCategory(voiceCategory);
      console.log('💾 Voice category persisted as user default:', voiceCategory);
    } else {
      console.log('🔄 Voice category change skipped - isLoading:', isLoading, 'isInitialLoad:', isInitialLoad, 'voiceCategory:', voiceCategory);
    }
  }, [voiceCategory]);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('auth_token');
      
      if (!token) {
        console.warn('No auth token available');
        setIsLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/settings`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedPattern(data.selectedPattern || "Two Lines");
        setBetAmount(data.betAmount || 5);
        setHouseCutPercentage(data.houseCutPercentage || 10);
        
        // Load voice category using the manager
        const voiceCategory = VoiceCategoryManager.getVoiceCategoryWithFallback(data.voiceCategory);
        
        if (voiceCategory) {
          setVoiceCategory(voiceCategory);
          console.log('✅ Settings loaded from backend:', data);
          console.log('🎤 Voice category resolved:', voiceCategory);
          
          // Update audio manager with loaded voice category
          const audioManager = UnifiedAudioManager.getInstance();
          audioManager.setVoiceCategory(voiceCategory);
          console.log('🎤 Audio manager set to voice category:', voiceCategory);
          
          // If voice came from localStorage, save to backend
          if (!data.voiceCategory && voiceCategory) {
            console.log('🔄 Syncing localStorage voice category to backend');
            setTimeout(() => {
              saveSettings();
            }, 1000);
          }
        } else {
          console.warn('⚠️ No voice category available - user must select one');
          console.log('✅ Other settings loaded from backend:', data);
        }
      } else if (response.status === 401) {
        console.warn('⚠️ Authentication error loading settings - using defaults');
        // Don't logout - just use default settings
        // User can manually logout if needed
      } else {
        console.warn('Failed to load settings from backend');
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setIsLoading(false);
      setIsInitialLoad(false);
    }
  };

  // Save settings to backend
  const saveSettings = async () => {
    setIsSaving(true);
    setSaveMessage("");

    const settings: any = {
      selectedPattern,
      betAmount: parseFloat(betAmount.toString()),
      houseCutPercentage: parseFloat(houseCutPercentage.toString())
    };
    
    // Only include voiceCategory if user has selected one
    if (voiceCategory) {
      settings.voiceCategory = voiceCategory;
    }

    try {
      const token = localStorage.getItem('auth_token');
      
      if (!token) {
        setSaveMessage("Error: Not authenticated. Please log in.");
        setIsSaving(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/settings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Settings saved to backend:', data);
        
        // Also update localStorage for backward compatibility
        localStorage.setItem('bingo-settings', JSON.stringify(settings));
        
        // Update active game's pattern if there is one - fetch from database
        try {
          // Fetch active game from database
          const activeGameResponse = await fetch(`${API_BASE_URL}/games/active`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (activeGameResponse.ok) {
            const activeGameResult = await activeGameResponse.json();
            if (activeGameResult.game && activeGameResult.game.id) {
              console.log('🎮 Updating active game pattern to:', selectedPattern);
              const updateResponse = await fetch(`${API_BASE_URL}/games/${activeGameResult.game.id}/pattern`, {
                method: 'PATCH',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ winnerPattern: selectedPattern })
              });
              
              if (updateResponse.ok) {
                console.log('✅ Active game pattern updated successfully');
              } else {
                console.warn('⚠️ Could not update active game pattern');
              }
            }
          }
        } catch (gameUpdateError) {
          console.warn('Could not update active game pattern:', gameUpdateError);
          // Don't fail the settings save if game update fails
        }
        
        setSaveMessage("Settings saved successfully!");

        // Clear success message after 3 seconds
        setTimeout(() => {
          setSaveMessage("");
        }, 3000);
      } else if (response.status === 401) {
        console.warn('⚠️ Authentication error saving settings');
        setSaveMessage("Authentication error. Please try logging in again if this persists.");
        // Don't automatically logout - let user decide
        
        // Clear error message after 5 seconds
        setTimeout(() => {
          setSaveMessage("");
        }, 5000);
      } else {
        const errorData = await response.json();
        setSaveMessage(`Error: ${errorData.error || 'Failed to save settings'}`);
        
        // Clear error message after 5 seconds
        setTimeout(() => {
          setSaveMessage("");
        }, 5000);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveMessage("Error saving settings. Please try again.");

      // Clear error message after 5 seconds
      setTimeout(() => {
        setSaveMessage("");
      }, 5000);
    } finally {
      setIsSaving(false);
    }
  };

  // Play voice sample
  const playVoiceSample = async (category: VoiceCategory) => {
    if (isPlayingVoiceSample) return;
    
    setIsPlayingVoiceSample(true);
    
    try {
      const audioManager = UnifiedAudioManager.getInstance();
      const sampleNumber = Math.floor(Math.random() * 75) + 1;
      await audioManager.playSound(sampleNumber, category);
      console.log(`🎤 Played voice sample (${category}): ${sampleNumber}`);
    } catch (error) {
      console.error('Error playing voice sample:', error);
    } finally {
      setTimeout(() => setIsPlayingVoiceSample(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg">
        {/* Header */}
        <div className="flex items-center gap-4 p-6 border-b">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
          >
            <ArrowLeft size={20} />
            Back
          </button>
          <div className="flex items-center gap-2">
            <SettingsIcon className="text-blue-600" size={24} />
            <h1 className="text-xl font-semibold text-gray-800">Game Settings</h1>
          </div>
        </div>

        {/* Settings Content */}
        <div className="p-6 space-y-8">
          {/* Winner Pattern Section */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-yellow-600">👑</span>
              <h2 className="text-lg font-semibold text-gray-800">Winner Pattern</h2>
            </div>
            <div className="space-y-3 ml-6">
              {patternOptions.map((pattern) => (
                <label key={pattern} className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded">
                  <input
                    type="radio"
                    name="winnerType"
                    value={pattern}
                    checked={selectedPattern === pattern}
                    onChange={(e) => setSelectedPattern(e.target.value)}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-700">{pattern}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Bet Amount Section */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="text-green-600" size={20} />
              <h2 className="text-lg font-semibold text-gray-800">Default Bet Amount</h2>
            </div>
            <div className="ml-6">
              <input
                type="number"
                min="1"
                step="0.01"
                value={betAmount}
                onChange={(e) => setBetAmount(parseFloat(e.target.value) || 0)}
                className="w-full max-w-xs px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter bet amount"
              />
              <p className="text-sm text-gray-500 mt-2">Amount to bet per cartela</p>
            </div>
          </div>

          {/* House Cut Percentage Section */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Percent className="text-purple-600" size={20} />
              <h2 className="text-lg font-semibold text-gray-800">House Cut Percentage</h2>
            </div>
            <div className="ml-6">
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={houseCutPercentage}
                onChange={(e) => setHouseCutPercentage(parseFloat(e.target.value) || 0)}
                className="w-full max-w-xs px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter percentage"
              />
              <p className="text-sm text-gray-500 mt-2">Percentage taken by the house (0-100%)</p>
            </div>
          </div>

          {/* Voice Category Section */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Volume2 className="text-blue-600" size={20} />
              <h2 className="text-lg font-semibold text-gray-800">Voice Category</h2>
            </div>
            <div className="ml-6 space-y-4">
              {voiceCategory === null && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800 font-medium">⚠️ Please select a voice category for number announcements</p>
                </div>
              )}
              
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <input
                    type="radio"
                    name="voiceCategory"
                    value="girl"
                    checked={voiceCategory === "girl"}
                    onChange={(e) => setVoiceCategory(e.target.value as VoiceCategory)}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">👧</span>
                    <span className="text-gray-700 font-medium">Girl Voice</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => playVoiceSample('girl')}
                    disabled={isPlayingVoiceSample}
                    className="ml-auto px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isPlayingVoiceSample ? '🔊 Playing...' : '▶️ Sample'}
                  </button>
                </label>
                
                <label className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <input
                    type="radio"
                    name="voiceCategory"
                    value="boy"
                    checked={voiceCategory === "boy"}
                    onChange={(e) => setVoiceCategory(e.target.value as VoiceCategory)}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">👦</span>
                    <span className="text-gray-700 font-medium">Boy Voice</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => playVoiceSample('boy')}
                    disabled={isPlayingVoiceSample}
                    className="ml-auto px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isPlayingVoiceSample ? '🔊 Playing...' : '▶️ Sample'}
                  </button>
                </label>
              </div>
              <p className="text-sm text-gray-500">Choose the voice for number announcements during gameplay</p>
            </div>
          </div>

          {/* Audio Cache Management Section */}
          <div>
            <AudioCacheManager showProgress={true} />
          </div>
        </div>

        {/* Save Message */}
        {saveMessage && (
          <div className={`p-4 border-t ${saveMessage.includes('Error') ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
            <div className="flex justify-center">
              <span className={`text-sm ${saveMessage.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
                {saveMessage}
              </span>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-6 border-t bg-gray-50">
          <div className="flex justify-center items-center">
            <div className="text-sm text-gray-600 text-center">
              {isSaving ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span>Auto-saving settings...</span>
                </div>
              ) : (
                "Settings are automatically saved and will persist across sessions."
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
