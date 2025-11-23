import React, { useState, useEffect } from 'react';
import { ArrowLeft, Settings as SettingsIcon, DollarSign, Percent } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
  
  const [selectedPattern, setSelectedPattern] = useState<string>("Two Lines");
  const [betAmount, setBetAmount] = useState<number>(5);
  const [houseCutPercentage, setHouseCutPercentage] = useState<number>(10);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [saveMessage, setSaveMessage] = useState<string>("");

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
        console.log('✅ Settings loaded from backend:', data);
      } else {
        console.warn('Failed to load settings from backend');
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Save settings to backend
  const saveSettings = async () => {
    setIsSaving(true);
    setSaveMessage("");

    const settings = {
      selectedPattern,
      betAmount: parseFloat(betAmount.toString()),
      houseCutPercentage: parseFloat(houseCutPercentage.toString())
    };

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
        
        setSaveMessage("Settings saved successfully!");

        // Clear success message after 3 seconds
        setTimeout(() => {
          setSaveMessage("");
        }, 3000);
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
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              Settings are saved to the database and will persist across sessions.
            </div>
            <button
              onClick={saveSettings}
              disabled={isSaving}
              className={`px-6 py-2 rounded-lg transition-colors ${
                isSaving
                  ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isSaving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
