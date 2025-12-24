// Enhanced NewGame Component with Offline Support
import React, { useState, useEffect } from 'react';
import { Minus, Plus, Eye, EyeOff, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useOfflineCartela } from '../hooks/useOfflineCartela';
import { useOfflineAuth } from '../hooks/useOfflineAuth';
import { offlineGameManager } from '../utils/offlineGameManager';
import { networkStatusManager } from '../utils/networkStatus';
import { UnifiedAudioManager } from '../utils/UnifiedAudioManager';
import { voiceCategoryManager } from '../utils/voiceCategoryManager';

const NewGameOffline: React.FC = () => {
  const { cartelas, loading, error, fromCache } = useOfflineCartela();
  const { user, refreshUser, isOffline } = useOfflineAuth();
  const navigate = useNavigate();
  
  // Game state
  const [betBirr, setBetBirr] = useState(() => {
    const savedBetAmount = localStorage.getItem('betAmount');
    return savedBetAmount ? parseInt(savedBetAmount, 10) : 5;
  });
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [rememberSelection, setRememberSelection] = useState(() => {
    const savedRememberSelection = localStorage.getItem('rememberSelection');
    return savedRememberSelection !== null ? savedRememberSelection === 'true' : true;
  });
  const [housePercentage, setHousePercentage] = useState(25);
  const [hideHouseCut, setHideHouseCut] = useState(true);
  const [selectedPattern, setSelectedPattern] = useState<string>("Two Lines");
  const [isLoadingPattern, setIsLoadingPattern] = useState(true);
  const [isSavingGame, setIsSavingGame] = useState(false);

  const patternOptions = ["One Line", "Two Lines", "Three Lines", "Full House"];

  // Initialize offline game manager
  useEffect(() => {
    offlineGameManager.initialize();
  }, []);

  // Load persisted data
  useEffect(() => {
    const savedRememberSelection = localStorage.getItem('rememberSelection');
    const savedSelectedCards = localStorage.getItem('selectedCards');
    const savedHousePercentage = localStorage.getItem('housePercentage');
    const savedHideHouseCut = localStorage.getItem('hideHouseCut');

    if (savedRememberSelection !== 'false' && savedSelectedCards) {
      try {
        setSelectedCards(JSON.parse(savedSelectedCards));
      } catch (error) {
        console.error('Error loading saved cartelas:', error);
      }
    }

    if (savedHousePercentage) {
      const parsedPercentage = parseInt(savedHousePercentage, 10);
      if (!isNaN(parsedPercentage) && [10, 15, 20, 25, 30, 35, 40].includes(parsedPercentage)) {
        setHousePercentage(parsedPercentage);
      }
    }

    if (savedHideHouseCut !== null) {
      setHideHouseCut(savedHideHouseCut === 'true');
    }

    setIsLoadingPattern(false);
  }, []);

  // Save preferences
  useEffect(() => {
    localStorage.setItem('rememberSelection', rememberSelection.toString());
    if (rememberSelection) {
      localStorage.setItem('selectedCards', JSON.stringify(selectedCards));
    }
  }, [rememberSelection, selectedCards]);

  useEffect(() => {
    localStorage.setItem('housePercentage', housePercentage.toString());
    localStorage.setItem('hideHouseCut', hideHouseCut.toString());
    localStorage.setItem('betAmount', betBirr.toString());
  }, [housePercentage, hideHouseCut, betBirr]);  con
st handleCartelaSelect = (cardId: string) => {
    if (selectedCards.includes(cardId)) {
      setSelectedCards(selectedCards.filter(id => id !== cardId));
    } else {
      setSelectedCards([...selectedCards, cardId]);
    }
  };

  const handleBetChange = (increment: boolean) => {
    setBetBirr(prev => Math.max(5, increment ? prev + 5 : prev - 5));
  };

  const playStartSound = async () => {
    try {
      console.log('🔊 Playing start sound using UnifiedAudioManager');
      const audioManager = UnifiedAudioManager.getInstance();
      
      if (!audioManager.isInitialized()) {
        await audioManager.initialize();
      }
      
      const voiceCategory = voiceCategoryManager.getEffectiveVoiceCategory();
      if (voiceCategory) {
        audioManager.setVoiceCategory(voiceCategory);
      }
      
      await audioManager.playSound('start');
    } catch (error) {
      console.error('❌ Could not play start sound:', error);
    }
  };

  const handleStartGame = async () => {
    if (selectedCards.length < 3) {
      alert('Please select at least 3 cartelas to start the game. You have selected ' + selectedCards.length + ' cartela(s).');
      return;
    }

    if (!user) {
      alert('Please log in to start a game.');
      return;
    }

    const totalBet = selectedCards.length * betBirr;
    const houseCutAmount = (totalBet * housePercentage) / 100;
    const playerContributionToPrizePool = totalBet - houseCutAmount;

    // Check balance for prepaid users (even offline)
    if (user.userType === 'prepaid') {
      const currentBalance = user.balance || 0;
      if (currentBalance < houseCutAmount) {
        alert(
          `Insufficient Balance!\n\n` +
          `Your current balance: ${currentBalance.toFixed(2)} Birr\n` +
          `House cut required: ${houseCutAmount.toFixed(2)} Birr\n` +
          `Shortage: ${(houseCutAmount - currentBalance).toFixed(2)} Birr\n\n` +
          `Please contact admin to add balance to your account.`
        );
        return;
      }
    }

    setIsSavingGame(true);

    try {
      // Play start sound immediately
      playStartSound().catch(error => {
        console.error('❌ Failed to play start sound:', error);
      });

      // Create game using offline manager (works online and offline)
      const gameData = {
        selectedCartelas: selectedCards,
        betAmount: betBirr,
        housePercentage: housePercentage,
        totalBet: totalBet,
        houseCut: houseCutAmount,
        playerWin: playerContributionToPrizePool,
        userId: user.id
      };

      const game = await offlineGameManager.createGame(gameData);

      // Clear selection if remember is not active
      if (!rememberSelection) {
        setSelectedCards([]);
        localStorage.removeItem('selectedCards');
      }

      // Navigate to game
      navigate('/game');

      // Refresh user balance in background
      if (refreshUser) {
        refreshUser().catch(err => console.warn('Background user refresh failed:', err));
      }

    } catch (error) {
      console.error('Failed to create game:', error);
      alert(`Failed to start game: ${error instanceof Error ? error.message : 'Unknown error'}. ${isOffline ? 'Game will be synced when online.' : 'Please try again.'}`);
    } finally {
      setIsSavingGame(false);
    }
  };

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#001A23] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto mb-4"></div>
          <p className="text-white">Loading cartelas...</p>
          {isOffline && (
            <p className="text-yellow-400 text-sm mt-2">
              <WifiOff className="inline w-4 h-4 mr-1" />
              Offline mode - using cached data
            </p>
          )}
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-[#001A23] flex items-center justify-center">
        <div className="text-center text-white">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Error Loading Cartelas</h2>
          <p className="text-gray-300 mb-4">{error}</p>
          {isOffline && (
            <p className="text-yellow-400 text-sm">
              <WifiOff className="inline w-4 h-4 mr-1" />
              You're offline. Please check your connection and try again.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#001A23] flex flex-col">
      {/* Offline Status Banner */}
      {isOffline && (
        <div className="bg-yellow-600 text-white px-4 py-2 text-center">
          <WifiOff className="inline w-4 h-4 mr-2" />
          Offline Mode - Games will sync when connection is restored
          {fromCache && " (Using cached data)"}
        </div>
      )}

      {/* Rest of the component UI would go here */}
      <div className="flex-1 p-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-white mb-6">
            New Game {isOffline && <span className="text-yellow-400">(Offline)</span>}
          </h1>
          
          {/* Game controls and cartela selection would go here */}
          <div className="bg-slate-800 rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-white">Selected Cartelas: {selectedCards.length}</span>
              <span className="text-white">
                Total Bet: {(selectedCards.length * betBirr).toLocaleString()} Birr
              </span>
            </div>
            
            <button
              onClick={handleStartGame}
              disabled={selectedCards.length < 3 || isSavingGame}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white py-3 px-6 rounded-lg font-bold transition-colors"
            >
              {isSavingGame ? 'Creating Game...' : `Start Game (${selectedCards.length} cartelas)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewGameOffline;