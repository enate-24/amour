import React, { useState, useEffect } from 'react';
import { Minus, Plus, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCartela } from '../hooks/useCartela';
import { useAuth } from '../hooks/useAuth';
import { UnifiedAudioManager } from '../utils/UnifiedAudioManager';
import { voiceCategoryManager } from '../utils/voiceCategoryManager';


const NewGame: React.FC = () => {
  const { cartelas, loading, error } = useCartela();
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [gamesPlayed, setGamesPlayed] = useState(19);
  const [bonusPlayed, setBonusPlayed] = useState(0);
  const [betBirr, setBetBirr] = useState(() => {
    // Load saved bet amount from localStorage, default to 5
    const savedBetAmount = localStorage.getItem('betAmount');
    return savedBetAmount ? parseInt(savedBetAmount, 10) : 5;
  });
  const [winBirr, setWinBirr] = useState(0.00);
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [rememberSelection, setRememberSelection] = useState(() => {
    // Check if there's a saved preference, otherwise default to true
    const savedRememberSelection = localStorage.getItem('rememberSelection');
    return savedRememberSelection !== null ? savedRememberSelection === 'true' : true;
  });
  const [housePercentage, setHousePercentage] = useState(25);
  const [showHouseOptions, setShowHouseOptions] = useState(false);
  const [hideHouseCut, setHideHouseCut] = useState(true);
  const [selectedPattern, setSelectedPattern] = useState<string>("Two Lines");
  const [isLoadingPattern, setIsLoadingPattern] = useState(true);
  const [bonusNotification, setBonusNotification] = useState<string | null>(null);

  const patternOptions = ["One Line", "Two Lines", "Three Lines", "Full House"];

  // Load persisted data on component mount
  React.useEffect(() => {
    const savedRememberSelection = localStorage.getItem('rememberSelection');
    const savedSelectedCards = localStorage.getItem('selectedCards');
    const savedHousePercentage = localStorage.getItem('housePercentage');
    const savedHideHouseCut = localStorage.getItem('hideHouseCut');

    // If remember selection is true (or default), load saved cards
    if (savedRememberSelection !== 'false') {
      if (savedSelectedCards) {
        try {
          setSelectedCards(JSON.parse(savedSelectedCards));
        } catch (error) {
          console.error('Error loading saved cartelas:', error);
        }
      }
    }

    // Load saved house percentage, default to 25 if not found
    if (savedHousePercentage) {
      const parsedPercentage = parseInt(savedHousePercentage, 10);
      if (!isNaN(parsedPercentage) && [10, 15, 20, 25, 30, 35, 40].includes(parsedPercentage)) {
        setHousePercentage(parsedPercentage);
      }
    }

    // Load saved hide house cut preference
    if (savedHideHouseCut !== null) {
      setHideHouseCut(savedHideHouseCut === 'true');
    }
  }, []);

  // Save remember selection state to localStorage
  React.useEffect(() => {
    if (rememberSelection) {
      localStorage.setItem('rememberSelection', 'true');
    } else {
      localStorage.setItem('rememberSelection', 'false');
    }
  }, [rememberSelection]);

  // Save selected cards to localStorage when remember selection is active
  React.useEffect(() => {
    if (rememberSelection) {
      localStorage.setItem('selectedCards', JSON.stringify(selectedCards));
    }
  }, [selectedCards, rememberSelection]);

  // Save house percentage to localStorage whenever it changes
  React.useEffect(() => {
    localStorage.setItem('housePercentage', housePercentage.toString());
  }, [housePercentage]);

  // Save hide house cut preference to localStorage whenever it changes
  React.useEffect(() => {
    localStorage.setItem('hideHouseCut', hideHouseCut.toString());
  }, [hideHouseCut]);

  // Save bet amount to localStorage whenever it changes
  React.useEffect(() => {
    localStorage.setItem('betAmount', betBirr.toString());
  }, [betBirr]);

  // Check for bonus notification on component mount
  React.useEffect(() => {
    const checkBonusStatus = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        if (!token) return;

        const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
        const response = await fetch(`${API_BASE_URL}/bonuses/daily`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          const bonus = data.dailyBonus;
          
          // Show "Today's Bonus Claimed" message if bonus was used today
          if (bonus.bonusUsed) {
           
          }
        }
      } catch (error) {
        console.error('Error checking bonus status:', error);
      }
    };

    checkBonusStatus();
  }, []);

  // Load pattern from settings
  React.useEffect(() => {
    const loadPattern = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        if (!token) {
          setIsLoadingPattern(false);
          return;
        }

        const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
        const response = await fetch(`${API_BASE_URL}/settings`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          const pattern = data.selectedPattern || "Two Lines";
          setSelectedPattern(pattern);
          console.log('✅ Loaded pattern from settings:', pattern);
        }
      } catch (error) {
        console.error('Error loading pattern from settings:', error);
      } finally {
        setIsLoadingPattern(false);
      }
    };

    loadPattern();
  }, []);

  // Save pattern to settings when it changes
  const handlePatternChange = async (newPattern: string) => {
    setSelectedPattern(newPattern);
    
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
      const response = await fetch(`${API_BASE_URL}/settings/pattern`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ selectedPattern: newPattern })
      });

      if (response.ok) {
        console.log('✅ Pattern saved to settings:', newPattern);
      }
    } catch (error) {
      console.error('Error saving pattern:', error);
    }
  };

  const [isIdModalOpen, setIsIdModalOpen] = useState(false);
  const [currentIdInput, setCurrentIdInput] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationStatus, setRegistrationStatus] = useState<{type: 'success' | 'error' | '', message: string}>({type: '', message: ''});
  const [registeredCount, setRegisteredCount] = useState(0);

  const handleCartelaSelect = (cardId: string) => {
    if (selectedCards.includes(cardId)) {
      setSelectedCards(selectedCards.filter(id => id !== cardId));
    } else {
      setSelectedCards([...selectedCards, cardId]);
    }
  };

  // Function to select all 2000 cartelas manually
  const selectAll2000Cartelas = () => {
    if (cartelas.length > 0) {
      // Select all available cartelas (up to 2000)
      const allCartelaIds = cartelas.slice(0, 2000).map(cartela => cartela.card_id);
      setSelectedCards(allCartelaIds);
      console.log(`✅ Selected ${allCartelaIds.length} cartelas automatically`);
    }
  };

  const handleBetChange = (increment: boolean) => {
    setBetBirr(prev => Math.max(5, increment ? prev + 5 : prev - 5));
  };

  // Function to get next game number
  const getNextGameNumber = async (): Promise<number> => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

      const response = await fetch(`${API_BASE_URL}/games/next-number`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        // Try to get error message, but don't fail if parsing fails
        let errorMessage = 'Failed to get next game number';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (parseError) {
          console.warn('Could not parse error response JSON:', parseError);
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      return result.nextGameNumber;
    } catch (error) {
      console.error('❌ Error getting next game number:', error);
      // Fallback to timestamp-based number if API fails
      return Date.now();
    }
  };

  // Function to save game session to database - OPTIMIZED
  const saveGameSession = async (gameData: any) => {
    const startTime = performance.now();
    
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

      // OPTIMIZATION: Get next game number and save session in parallel
      const [gameNumber] = await Promise.all([
        getNextGameNumber().catch(() => Date.now()), // Fallback to timestamp if fails
      ]);

      // Prepare optimized game data
      const gameDataWithNumber = {
        ...gameData,
        gameNumber: gameNumber,
        gameId: `GAME_${gameNumber}_${Date.now()}`,
        selectedCartelas: selectedCards // Ensure only selected cartelas are saved
      };

      console.log('🎮 Saving game session (optimized):', {
        cartelasCount: selectedCards.length,
        betAmount: gameData.betAmount,
        totalBet: gameData.totalBet
      });

      const response = await fetch(`${API_BASE_URL}/games/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(gameDataWithNumber)
      });

      if (!response.ok) {
        // Simplified error handling for better performance
        const errorText = await response.text();
        throw new Error(`Game save failed (${response.status}): ${errorText}`);
      }

      const result = await response.json();
      
      const saveTime = (performance.now() - startTime).toFixed(2);
      console.log(`✅ Game session saved in ${saveTime}ms`);

      // Show warning if present (for postpaid users approaching balance limit)
      if (result.warning) {
        // Use setTimeout to avoid blocking navigation
        setTimeout(() => alert(result.warning), 100);
      }

      return { ...result, gameNumber };
    } catch (error) {
      const saveTime = (performance.now() - startTime).toFixed(2);
      console.error(`❌ Game session save failed after ${saveTime}ms:`, error);
      throw error;
    }
  };

  // Function to play start game sound using UnifiedAudioManager
  const playStartSound = async () => {
    try {
      console.log('🔊 Playing start sound using UnifiedAudioManager');
      const audioManager = UnifiedAudioManager.getInstance();
      
      // Ensure audio manager is initialized
      if (!audioManager.isInitialized()) {
        await audioManager.initialize();
      }
      
      // Get and set voice category if available
      const voiceCategory = voiceCategoryManager.getEffectiveVoiceCategory();
      if (voiceCategory) {
        audioManager.setVoiceCategory(voiceCategory);
        console.log('🎤 Voice category set to:', voiceCategory);
      } else {
        console.warn('⚠️ No voice category set, using default');
      }
      
      // Play start sound
      await audioManager.playSound('start');
      console.log('✅ Start sound playing');
    } catch (error) {
      console.error('❌ Could not play start sound:', error);
    }
  };

  const handleStartGame = async () => {
    // Prevent admin users from starting games
    if (user && user.role === 'admin') {
      alert('Admin accounts cannot start games. Please use a regular user account to play.');
      return;
    }

    if (selectedCards.length < 3) {
      alert('Please select at least 3 cartelas to start the game. You have selected ' + selectedCards.length + ' cartela(s).');
      return;
    }

    // Calculate game results using CORRECT bingo logic
    const totalBet = selectedCards.length * betBirr; // What player pays
    const houseCutAmount = (totalBet * housePercentage) / 100; // House profit
    const playerContributionToPrizePool = totalBet - houseCutAmount; // Goes to prize pool

    // Check if prepaid user has sufficient balance
    if (user && user.userType === 'prepaid') {
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

    // Update game stats immediately
    setGamesPlayed(prev => prev + 1);

    // Prepare game data
    const gameData = {
      userId: user?.id,
      selectedCartelas: selectedCards,
      betAmount: betBirr,
      housePercentage: housePercentage,
      totalBet: totalBet,
      houseCut: houseCutAmount,
      playerWin: playerContributionToPrizePool,
      gameStartTime: new Date().toISOString(),
      gameNumber: Date.now(), // Temporary game number for immediate start
      gameId: `TEMP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    // INSTANT START: Save game data to IndexedDB immediately for instant access
    try {
      const { gameSessionDB } = await import('../utils/gameSessionDB');
      await gameSessionDB.saveGameSession(gameData);
      
      console.log('✅ Game session saved to IndexedDB for instant start:', {
        gameId: gameData.gameId,
        cartelas: selectedCards.length,
        timestamp: Date.now()
      });
      console.log('📦 Full game data:', gameData);
    } catch (e) {
      console.error('❌ Failed to save to IndexedDB:', e);
      // Fallback to localStorage
      try {
        localStorage.setItem('currentGameSession', JSON.stringify(gameData));
        localStorage.setItem('gameSessionTimestamp', Date.now().toString());
        console.log('✅ Fallback: Game session saved to localStorage');
      } catch (localError) {
        console.error('❌ Failed to save to localStorage:', localError);
      }
    }

    // Clear selection if remember is not active
    if (!rememberSelection) {
      setSelectedCards([]);
      localStorage.removeItem('selectedCards');
    }

    // INSTANT NAVIGATION - Don't wait for database operations
    try {
      console.log('⚡ INSTANT START: Game will start in 3 seconds...');
      console.log('📊 Game data saved locally, database sync will happen in background');
      
      // Start sound in background (non-blocking)
      playStartSound().catch(error => {
        console.error('❌ Failed to play start sound:', error);
      });

      // Navigate after a very short delay (under 3 seconds total)
      // This gives time for IndexedDB write and user feedback
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log('🚀 Navigating to game page NOW...');
      
      // Navigate immediately for instant game start
      navigate('/game');

      // Save to database in background (non-blocking) with retry
      // This happens AFTER navigation, so it doesn't block the game
      // Add initial delay to let navigation complete first
      setTimeout(async () => {
        const maxRetries = 3;
        let retryCount = 0;
        
        const attemptSave = async (): Promise<any> => {
          try {
            console.log(`🔄 Background sync attempt ${retryCount + 1}/${maxRetries}...`);
            return await saveGameSession(gameData);
          } catch (error) {
            retryCount++;
            if (retryCount < maxRetries) {
              console.log(`⚠️ Save attempt ${retryCount} failed, retrying in ${retryCount * 2}s...`);
              await new Promise(resolve => setTimeout(resolve, 2000 * retryCount)); // Longer exponential backoff
              return attemptSave();
            }
            throw error;
          }
        };
        
        // Start background sync (non-blocking)
        attemptSave().then(async (gameSessionResult) => {
          // Update IndexedDB with real game ID from database
          if (gameSessionResult && gameSessionResult.gameId) {
            try {
              const { gameSessionDB } = await import('../utils/gameSessionDB');
              await gameSessionDB.updateGameSession(gameData.gameId, {
                gameId: gameSessionResult.gameId,
                gameNumber: gameSessionResult.gameNumber || gameData.gameNumber
              });
              console.log('✅ Background sync complete! Game session updated with database ID:', gameSessionResult.gameId);
            } catch (updateError) {
              console.warn('⚠️ Failed to update IndexedDB, using localStorage fallback');
              const updatedGameData = {
                ...gameData,
                gameId: gameSessionResult.gameId,
                gameNumber: gameSessionResult.gameNumber || gameData.gameNumber
              };
              localStorage.setItem('currentGameSession', JSON.stringify(updatedGameData));
            }
          }
        }).catch(error => {
          console.error('❌ Background database save failed after retries:', error);
          // Game continues with localStorage data - show warning to user
          console.warn('⚠️ Game running in offline mode - will sync when connection is restored');
        });
      }, 500); // Wait 500ms before starting background sync

    } catch (error) {
      console.error('❌ Game start error:', error);
      alert('Failed to start game. Please try again.');
    }
  };

  const handleIdRegistration = async () => {
    if (!currentIdInput.trim()) {
      setRegistrationStatus({
        type: 'error',
        message: 'Please enter a Cartela ID'
      });
      return;
    }

    // Validate ID is a number and within range 1-2000
    const idNumber = parseInt(currentIdInput.trim());
    if (isNaN(idNumber) || idNumber < 1 || idNumber > 2000) {
      setRegistrationStatus({
        type: 'error',
        message: `Invalid ID: Must be between 1 and 2000`
      });
      return;
    }

    setIsRegistering(true);
    setRegistrationStatus({type: '', message: ''});

    try {
      // Simulate registration process
      await new Promise(resolve => setTimeout(resolve, 300));

      // Check if cartela exists
      const cartelaExists = cartelas.some(cartela => cartela.card_id === currentIdInput.trim());

      if (cartelaExists) {
        // Check if already selected
        if (selectedCards.includes(currentIdInput.trim())) {
          setRegistrationStatus({
            type: 'error',
            message: `✗ Cartela ${currentIdInput} already registered`
          });
          return;
        }

        // Add to selected cards
        setSelectedCards(prev => [...prev, currentIdInput.trim()]);

        // Increment registered count
        setRegisteredCount(prev => prev + 1);

        // Show success message
        setRegistrationStatus({
          type: 'success',
          message: `✓ Cartela ${currentIdInput} registered successfully`
        });

        // Clear input for next entry
        setCurrentIdInput('');

        // Clear success message after 2 seconds
        setTimeout(() => {
          setRegistrationStatus({type: '', message: ''});
        }, 2000);

      } else {
        setRegistrationStatus({
          type: 'error',
          message: `✗ Not found: ${currentIdInput}`
        });
      }
    } catch (error) {
      setRegistrationStatus({
        type: 'error',
        message: 'Registration failed. Please try again.'
      });
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#001A23] flex flex-col">
      {/* Bonus Notification Banner */}
      {bonusNotification && (
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-3 shadow-lg animate-slide-down">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <span className="font-semibold text-sm sm:text-base">{bonusNotification}</span>
            <button
              onClick={() => setBonusNotification(null)}
              className="ml-4 text-white hover:text-gray-200 font-bold text-xl"
              aria-label="Close notification"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Sticky Header Section */}
      <div className="sticky top-0 z-20 bg-[#001A23] border-b border-slate-700 shadow-lg">
        <div className="py-2 px-2 sm:py-4 sm:px-4 md:px-8 lg:px-16 xl:px-[87px] relative">
          {/* Clean Button - Top Right Corner */}
          {selectedCards.length > 0 && (
            <div className="absolute top-1 right-1 sm:top-2 sm:right-2 flex gap-1 sm:gap-2 z-10">
              {/* Clear Button */}
              <button
                onClick={() => {
                  setSelectedCards([]);
                  setRegisteredCount(0);
                  // Clear from localStorage but keep remember selection active
                  localStorage.removeItem('selectedCards');
                }}
                className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-2 py-1 sm:px-4 sm:py-2 rounded-lg font-bold transition-all shadow-lg hover:shadow-xl transform hover:scale-105 text-xs sm:text-sm flex items-center gap-1 sm:gap-2"
                title="Clear all selected cartelas"
              >
                <span className="text-sm sm:text-lg">🗑️</span>
                <span className="hidden xs:inline">Clean ({selectedCards.length})</span>
                <span className="xs:hidden">({selectedCards.length})</span>
              </button>
            </div>
          )}

          <div className="mb-4 sm:mb-6">
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm mb-3 sm:mb-4">
              <span>Games Played: <span className="text-blue-400 font-bold">{gamesPlayed}</span></span>
              <span>Bonus Played: <span className="text-green-400 font-bold">{bonusPlayed}</span></span>
              
              {/* Balance Display for Prepaid Users */}
              {user && user.userType === 'prepaid' && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-700/50 border border-slate-600">
                  <span className="text-slate-300">Balance:</span>
                  <span className={`font-bold ${
                    (user.balance || 0) < 100 ? 'text-red-400' : 
                    (user.balance || 0) < 500 ? 'text-yellow-400' : 
                    'text-green-400'
                  }`}>
                    {(user.balance || 0).toFixed(2)} Birr
                  </span>
                  {(user.balance || 0) < 100 && (
                    <span title="Low balance warning">
                      <AlertCircle size={14} className="text-red-400 ml-1" />
                    </span>
                  )}
                </div>
              )}
              
              {/* Credit Display for Postpaid Users */}
              {user && user.userType === 'postpaid' && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-700/50 border border-slate-600">
                  <span className="text-slate-300">Credit:</span>
                  <span className="font-bold text-blue-400">Unlimited</span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-4 mb-4 sm:mb-6">
              <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-base">
                <span className="text-xs sm:text-base">Bet Birr:</span>
                <button
                  onClick={() => handleBetChange(false)}
                  className="p-1 bg-red-500 hover:bg-red-600 rounded transition-colors"
                  aria-label="Decrease Bet"
                >
                  <Minus size={14} className="sm:w-4 sm:h-4" />
                </button>
                <span className="bg-slate-700 px-2 py-1 sm:px-4 sm:py-2 rounded font-bold min-w-[50px] sm:min-w-[60px] text-center text-sm sm:text-base">
                  {betBirr}
                </span>
                <button
                  onClick={() => handleBetChange(true)}
                  className="p-1 bg-green-500 hover:bg-green-600 rounded transition-colors"
                  aria-label="Increase Bet"
                >
                  <Plus size={14} className="sm:w-4 sm:h-4" />
                </button>
              </div>

              <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-base">
                <span>House</span>
                <button
                  onClick={() => setHideHouseCut(!hideHouseCut)}
                  className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
                  title={hideHouseCut ? "Show house cut" : "Hide house cut"}
                >
                  {hideHouseCut ? <EyeOff size={14} className="sm:w-4 sm:h-4" /> : <Eye size={14} className="sm:w-4 sm:h-4" />}
                </button>
                {!hideHouseCut && (
                  <div className="relative">
                    <select
                      value={housePercentage}
                      onChange={(e) => setHousePercentage(Number(e.target.value))}
                      className="appearance-none bg-slate-700 text-white px-2 py-1 pr-5 sm:px-3 sm:pr-6 rounded border border-slate-600 focus:border-blue-400 focus:outline-none cursor-pointer text-xs sm:text-sm"
                    >
                      <option value={10}>10%</option>
                      <option value={15}>15%</option>
                      <option value={20}>20%</option>
                      <option value={25}>25%</option>
                      <option value={30}>30%</option>
                      <option value={35}>35%</option>
                      <option value={40}>40%</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center px-1 pointer-events-none">
                      <svg className="w-2 h-2 sm:w-3 sm:h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                )}
              </div>

              {/* Pattern Selector */}
              <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-base">
                <span className="text-yellow-400">👑</span>
                <span>Pattern:</span>
                {isLoadingPattern ? (
                  <span className="bg-slate-700 px-2 py-1 rounded text-xs sm:text-sm animate-pulse">Loading...</span>
                ) : (
                  <div className="relative">
                    <select
                      value={selectedPattern}
                      onChange={(e) => handlePatternChange(e.target.value)}
                      className="appearance-none bg-[#1D4ED8] text-white px-2 py-1 pr-5 sm:px-3 sm:pr-6 rounded border border-blue-500 focus:border-blue-400 focus:outline-none cursor-pointer text-xs sm:text-sm font-semibold shadow-lg"
                      title="Select winning pattern"
                    >
                      {patternOptions.map((pattern) => (
                        <option key={pattern} value={pattern}>
                          {pattern}
                        </option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center px-1 pointer-events-none">
                      <svg className="w-2 h-2 sm:w-3 sm:h-3 text-yellow-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                )}
              </div>

              {/* Bet and Win Money Display */}
              {selectedCards.length > 0 && (
                <>
                  <div className="flex items-center gap-1 text-xs sm:text-sm">
                    <span className="text-blue-400">💰</span>
                    <span className="text-slate-300">Bet:</span>
                    <span className="bg-blue-600 px-2 py-1 rounded font-bold text-white">
                      {(selectedCards.length * betBirr).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs sm:text-sm">
                    <span className="text-green-400">🏆</span>
                    <span className="text-slate-300">Win:</span>
                    <span className="bg-green-600 px-2 py-1 rounded font-bold text-white">
                      {((selectedCards.length * betBirr) - ((selectedCards.length * betBirr * housePercentage) / 100)).toLocaleString()}
                    </span>
                  </div>
                  
                  {/* Balance Warning for Prepaid Users */}
                  {user && user.userType === 'prepaid' && (() => {
                    const totalBet = selectedCards.length * betBirr;
                    const houseCut = (totalBet * housePercentage) / 100;
                    const currentBalance = user.balance || 0;
                    const insufficient = currentBalance < houseCut;
                    
                    if (insufficient) {
                      return (
                        <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/20 border border-red-500 text-red-400 text-xs sm:text-sm">
                          <AlertCircle size={14} />
                          <span className="font-semibold">
                            Insufficient! Need {houseCut.toFixed(2)} Birr (Have {currentBalance.toFixed(2)})
                          </span>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-6">
              <button
                className="bg-blue-600 hover:bg-blue-700 px-3 py-2 sm:px-4 sm:py-2.5 md:px-6 md:py-3 rounded-lg font-medium transition-colors text-xs sm:text-sm md:text-base"
                onClick={() => alert(`Selected Cards: ${selectedCards.join(', ')}`)}
              >
                <span className="hidden sm:inline">Cartela Check ↗</span>
                <span className="sm:hidden">Check ↗</span>
              </button>
              <button
                className="bg-blue-600 hover:bg-blue-700 px-3 py-2 sm:px-4 sm:py-2.5 md:px-6 md:py-3 rounded-lg font-medium transition-colors text-xs sm:text-sm md:text-base"
                onClick={() => {
                  setIsIdModalOpen(true);
                  setCurrentIdInput('');
                  setRegistrationStatus({type: '', message: ''});
                }}
              >
                <span className="hidden sm:inline">Enter ID (Fast)</span>
                <span className="sm:hidden">Enter ID</span>
              </button>
              
              {/* Bonus Claimed Message - Show only when bonus is used today */}
              {bonusNotification && (
                <div className="px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold bg-green-100 text-green-800 border border-green-300 flex items-center gap-2">
                  <span>🎁</span>
                  <span>Today's Bonus Claimed!</span>
                </div>
              )}
              
              {/* Cartela Selection Status */}
              <div className={`px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold ${
                selectedCards.length >= 3 
                  ? 'bg-green-100 text-green-800 border border-green-300' 
                  : 'bg-yellow-100 text-yellow-800 border border-yellow-300'
              }`}>
                {selectedCards.length >= 3 
                  ? `✅ ${selectedCards.length} cartelas selected` 
                  : `⚠️ ${selectedCards.length}/3 cartelas (need ${3 - selectedCards.length} more)`
                }
              </div>
              
              <button
                className={`px-4 py-2 sm:px-6 sm:py-2.5 md:px-8 md:py-3 rounded-lg font-bold transition-colors text-xs sm:text-sm md:text-base ${
                  selectedCards.length >= 3
                    ? 'bg-green-600 hover:bg-green-700 cursor-pointer'
                    : 'bg-gray-600 cursor-not-allowed opacity-50'
                }`}
                onClick={handleStartGame}
                disabled={selectedCards.length < 3}
                title={selectedCards.length < 3 ? `Select at least 3 cartelas to start (${selectedCards.length}/3 selected)` : 'Start game'}
              >
                {selectedCards.length < 3 
                  ? `Start Game (${selectedCards.length}/3)` 
                  : 'Start Game ⚡'
                }
              </button>
            </div>

            <div className="mb-3 sm:mb-4">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-white font-medium text-xs sm:text-sm md:text-base">
                  Selected Cards ({selectedCards.length})
                  {selectedCards.length >= 2000 && (
                    <span className="ml-2 px-2 py-1 bg-green-600 text-white rounded-full text-xs font-bold">
                      ALL 2000 ACTIVE! 🎯
                    </span>
                  )}
                </span>
                <label className={`flex items-center gap-1 sm:gap-2 px-2 py-1 sm:px-3 rounded-lg transition-colors ${
                  rememberSelection
                    ? 'bg-green-600 text-green-100'
                    : 'bg-slate-700 text-slate-300'
                }`}>
                  <input
                    type="checkbox"
                    checked={rememberSelection}
                    onChange={(e) => setRememberSelection(e.target.checked)}
                    className="rounded w-3 h-3 sm:w-4 sm:h-4"
                  />
                  <span className="text-xs sm:text-sm font-medium">
                    <span className="hidden sm:inline">{rememberSelection ? '✅ Remember Active' : 'Remember Selection'}</span>
                    <span className="sm:hidden">{rememberSelection ? '✅ Remember' : 'Remember'}</span>
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Last 10 Selected Cartelas Display */}
      {selectedCards.length > 0 && (
        <div className="bg-[#002A35] border-b border-slate-700 py-3 px-2 sm:px-4 md:px-8 lg:px-16 xl:px-[87px]">
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="text-white font-semibold text-xs sm:text-sm whitespace-nowrap">
              Last Selected ({Math.min(selectedCards.length, 10)}):
            </span>
            <div className="flex gap-1.5 sm:gap-2 overflow-x-auto scrollbar-hide">
              {selectedCards.slice(-10).map((cardId, index) => (
                <div
                  key={`${cardId}-${index}`}
                  className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-lg border-2 border-blue-300 animate-bounce-in"
                  style={{
                    animationDelay: `${index * 0.1}s`,
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3), 0 0 15px rgba(59, 130, 246, 0.4)'
                  }}
                >
                  <span className="text-white font-bold text-xs sm:text-sm">{cardId}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Scrollable Cartela Grid Section */}
      <div className="flex-1 overflow-y-auto px-2 sm:px-4 md:px-8 lg:px-16 xl:px-[87px] py-4">
        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-slate-400">Loading cartelas...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-12">
            <p className="text-red-400 text-lg mb-4">Error: {error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Cartela Grid with Performance Optimization */}
        {!loading && !error && (
          <div className="space-y-4">
            {/* Performance Info */}
            <div className="flex items-center justify-between text-sm text-slate-400 mb-4">
              <span>Total Cartelas: {cartelas.length}</span>
              {cartelas.length > 500 && (
                <span className="text-yellow-400">⚡ Large dataset - optimized rendering</span>
              )}
            </div>
            

            
            {/* Optimized Cartela Grid - Render in chunks for better performance */}
            <div className="flex flex-wrap gap-2 pb-4">
              {cartelas
                .sort((a, b) => {
                  const aNum = parseInt(a.card_id) || 0;
                  const bNum = parseInt(b.card_id) || 0;
                  return aNum - bNum;
                })
                .slice(0, Math.min(cartelas.length, 1000)) // Limit initial render to 1000 for performance
                .map((cartela, index) => (
                  <button
                    key={`${cartela.card_id}-${index}`}
                    onClick={() => handleCartelaSelect(cartela.card_id)}
                    className={`w-[48px] h-[48px] sm:w-[52px] sm:h-[52px] md:w-[56px] md:h-[56px] p-1 rounded-lg transition-all duration-200 active:scale-95 sm:hover:scale-105 flex-shrink-0 ${
                      selectedCards.includes(cartela.card_id)
                        ? 'bg-blue-600 text-white shadow-lg transform scale-105 border-2 border-blue-400'
                        : 'bg-[#c5c9c8] active:bg-[#b0b5b4] sm:hover:bg-[#b0b5b4] text-black border-2 border-gray-300 hover:border-gray-400'
                    }`}
                    title={`Card ID: ${cartela.card_id}`}
                  >
                    <div className="text-center h-full flex items-center justify-center">
                      <div className="text-[13px] sm:text-[14px] md:text-[15px] font-bold leading-tight">{cartela.card_id}</div>
                    </div>
                  </button>
                ))}
            </div>
            
            {/* Load More Button if there are more cartelas */}
            {cartelas.length > 1000 && (
              <div className="text-center py-4">
                <button
                  onClick={() => {
                    // For now, just show a message. In production, implement proper pagination
                    alert(`You have ${cartelas.length} cartelas total. Use "Select All" button above for bulk selection, or use "Enter ID" for specific cartelas.`);
                  }}
                  className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-medium transition-colors"
                >
                  Show More Cartelas ({cartelas.length - 1000} remaining)
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Centered ID Modal - Fully Responsive */}
      {isIdModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-2 sm:p-4">
          <div className="bg-slate-800 rounded-lg border-2 border-blue-400 shadow-2xl w-full max-w-[95vw] sm:max-w-md mx-auto">
            <div className="p-4 sm:p-5 md:p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-4 sm:mb-5">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-white truncate">
                    Enter Cartela ID
                  </h3>
                  {registeredCount > 0 && (
                    <span className="px-2 py-1 bg-green-600 text-green-100 rounded-full text-xs sm:text-sm font-bold shrink-0">
                      {registeredCount}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setIsIdModalOpen(false)}
                  className="text-slate-400 hover:text-white transition-colors text-xl sm:text-2xl shrink-0 ml-2 p-1"
                  title="Close"
                  aria-label="Close modal"
                >
                  ✕
                </button>
              </div>

              {/* Content */}
              <div className="space-y-3 sm:space-y-4">
                {/* Input Field */}
                <div>
                  <label htmlFor="cartelaIdInput" className="block text-sm sm:text-base text-slate-300 mb-2">
                    Cartela ID (1-2000)
                  </label>
                  <input
                    id="cartelaIdInput"
                    type="number"
                    value={currentIdInput}
                    onChange={(e) => setCurrentIdInput(e.target.value)}
                    placeholder="Enter ID..."
                    min="1"
                    max="2000"
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 text-base sm:text-lg bg-slate-700 text-white rounded-lg border-2 border-slate-600 focus:border-blue-400 focus:outline-none transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleIdRegistration();
                      }
                    }}
                    autoFocus
                  />
                </div>

                {/* Registration Status Message */}
                {registrationStatus.message && (
                  <div className={`p-3 sm:p-4 rounded-lg text-sm sm:text-base font-medium transition-all ${
                    registrationStatus.type === 'success' 
                      ? 'bg-green-600/20 text-green-400 border-2 border-green-600' 
                      : registrationStatus.type === 'error'
                      ? 'bg-red-600/20 text-red-400 border-2 border-red-600'
                      : 'bg-blue-600/20 text-blue-400 border-2 border-blue-600'
                  }`}>
                    {registrationStatus.message}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-2">
                  <button
                    onClick={handleIdRegistration}
                    disabled={isRegistering || !currentIdInput.trim()}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-slate-600 disabled:cursor-not-allowed px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-semibold transition-all text-base sm:text-lg shadow-lg hover:shadow-xl disabled:shadow-none"
                  >
                    {isRegistering ? '⏳ Registering...' : '✓ Register'}
                  </button>
                  <button
                    onClick={() => setIsIdModalOpen(false)}
                    className="sm:flex-none bg-slate-700 hover:bg-slate-600 active:bg-slate-500 px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-semibold transition-all text-base sm:text-lg"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NewGame;