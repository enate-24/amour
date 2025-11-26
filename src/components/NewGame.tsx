import React, { useState, useEffect } from 'react';
import { Minus, Plus, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCartela } from '../hooks/useCartela';
import HouseBonusButton from './HouseBonusButton';

const NewGame: React.FC = () => {
  const { cartelas, loading, error } = useCartela();
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
  const [isSavingGame, setIsSavingGame] = useState(false);

  const handleCartelaSelect = (cardId: string) => {
    if (selectedCards.includes(cardId)) {
      setSelectedCards(selectedCards.filter(id => id !== cardId));
    } else {
      setSelectedCards([...selectedCards, cardId]);
    }
  };

  // Function to select all 1200 cartelas manually
  const selectAll1200Cartelas = () => {
    if (cartelas.length > 0) {
      // Select all available cartelas (up to 1200)
      const allCartelaIds = cartelas.slice(0, 1200).map(cartela => cartela.card_id);
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

  // Function to save game session to database
  const saveGameSession = async (gameData: any) => {
    try {
      setIsSavingGame(true);

      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

      // Get next game number first
      const gameNumber = await getNextGameNumber();

      // Add game number to game data
      const gameDataWithNumber = {
        ...gameData,
        gameNumber: gameNumber,
        gameId: `GAME_${gameNumber}_${Date.now()}`,
        selectedCartelas: selectedCards // Ensure only selected cartelas are saved
      };

      console.log('🎮 Attempting to save game session:', {
        url: `${API_BASE_URL}/games/session`,
        gameData: gameDataWithNumber,
        token: token ? 'Present' : 'Missing'
      });

      const response = await fetch(`${API_BASE_URL}/games/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(gameDataWithNumber)
      });

      console.log('🎮 Game session save response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (!response.ok) {
        // Try to parse error response, but handle cases where response body is not JSON
        let errorMessage = `Failed to save game session (HTTP ${response.status})`;
        try {
          const errorData = await response.json();
          console.error('🎮 Game session save error data:', errorData);
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (parseError) {
          // If response body is not valid JSON, try to get text
          try {
            const errorText = await response.text();
            console.error('🎮 Game session save error text:', errorText);
            if (errorText) {
              errorMessage = errorText;
            }
          } catch (textError) {
            // If we can't get text either, use default message
            console.warn('Could not parse error response:', parseError);
          }
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('✅ Game session saved to database:', result);

      return { ...result, gameNumber };
    } catch (error) {
      console.error('❌ Error saving game session:', error);
      throw error;
    } finally {
      setIsSavingGame(false);
    }
  };

  // Function to play start game sound from LOCAL file
  const playStartSound = () => {
    try {
      const soundUrl = '/sounds/start.wav';
      console.log('🔊 Playing start sound from LOCAL file:', soundUrl);
      
      const audio = new Audio(soundUrl);
      audio.volume = 0.5;
      
      audio.addEventListener('loadeddata', () => {
        console.log('✅ Start sound loaded successfully');
      });
      
      audio.addEventListener('error', (e) => {
        console.error('❌ Error loading start sound:', e);
      });
      
      audio.play()
        .then(() => {
          console.log('✅ Start sound playing');
        })
        .catch(error => {
          console.error('❌ Could not play start sound:', error);
        });
    } catch (error) {
      console.error('❌ Exception in playStartSound:', error);
    }
  };

  const handleStartGame = async () => {
    if (selectedCards.length < 3) {
      alert('Please select at least 3 cartelas to start the game. You have selected ' + selectedCards.length + ' cartela(s).');
      return;
    }

    // Calculate game results using CORRECT bingo logic
    const totalBet = selectedCards.length * betBirr; // What player pays
    const houseCutAmount = (totalBet * housePercentage) / 100; // House profit
    const playerContributionToPrizePool = totalBet - houseCutAmount; // Goes to prize pool

    // Update game stats
    setGamesPlayed(prev => prev + 1);
    // Don't set winBirr here - actual win is calculated when winning occurs

    // Prepare game data for both localStorage and database
    const gameData = {
      selectedCartelas: selectedCards,
      betAmount: betBirr,
      housePercentage: housePercentage,
      totalBet: totalBet,
      houseCut: houseCutAmount,
      playerWin: playerContributionToPrizePool, // Backend expects 'playerWin' not 'playerContributionToPrizePool'
      gameStartTime: new Date().toISOString()
    };

    try {
      // Save to database first
      const gameSessionResult = await saveGameSession(gameData);

      // Update game data with database gameId for consistent API calls
      const gameDataWithId = {
        ...gameData,
        gameId: gameSessionResult.gameId
      };

      // Save game data to localStorage for GamePage (as backup)
      localStorage.setItem('currentGame', JSON.stringify(gameDataWithId));

      // Clear selection if remember is not active
      if (!rememberSelection) {
        setSelectedCards([]);
        localStorage.removeItem('selectedCards');
      }

      // Play start sound on successful game creation
      playStartSound();

      // Navigate to GamePage after successful game creation
      navigate('/game');

    } catch (error) {
      console.error('Failed to save game session:', error);

      // Fallback to localStorage only if database save fails
      localStorage.setItem('currentGame', JSON.stringify(gameData));

      // Play start sound even on fallback
      playStartSound();

      // Navigate to GamePage even if database save fails (fallback to localStorage)
      navigate('/game');
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

        // Clear input for next entry
        setCurrentIdInput('');

        // No success message - just register silently

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
              
              {/* House Bonus Button */}
              <HouseBonusButton />
              
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
                  selectedCards.length >= 3 && !isSavingGame
                    ? 'bg-green-600 hover:bg-green-700 cursor-pointer'
                    : 'bg-gray-600 cursor-not-allowed opacity-50'
                }`}
                onClick={handleStartGame}
                disabled={isSavingGame || selectedCards.length < 3}
                title={selectedCards.length < 3 ? `Select at least 3 cartelas to start (${selectedCards.length}/3 selected)` : ''}
              >
                {isSavingGame 
                  ? 'Saving...' 
                  : selectedCards.length < 3 
                    ? `Start Game (${selectedCards.length}/3)` 
                    : 'Start Game'
                }
              </button>
            </div>

            <div className="mb-3 sm:mb-4">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-white font-medium text-xs sm:text-sm md:text-base">
                  Selected Cards ({selectedCards.length})
                  {selectedCards.length >= 1200 && (
                    <span className="ml-2 px-2 py-1 bg-green-600 text-white rounded-full text-xs font-bold">
                      ALL 1200 ACTIVE! 🎯
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

        {/* Cartela Grid */}
        {!loading && !error && (
          <div className="grid grid-cols-6 xs:grid-cols-8 sm:grid-cols-12 md:grid-cols-16 lg:grid-cols-20 xl:grid-cols-24 2xl:grid-cols-28 gap-0.5 sm:gap-1 pb-4">
            {cartelas.sort((a, b) => {
              const aNum = parseInt(a.card_id) || 0;
              const bNum = parseInt(b.card_id) || 0;
              return aNum - bNum;
            }).map((cartela, index) => (
              <button
                key={`${cartela.card_id}-${index}`}
                onClick={() => handleCartelaSelect(cartela.card_id)}
                className={`aspect-square p-0.5 rounded transition-all duration-200 active:scale-95 sm:hover:scale-105 ${
                  selectedCards.includes(cartela.card_id)
                    ? 'bg-blue-600 text-white shadow-lg transform scale-105'
                    : 'bg-[#c5c9c8] active:bg-[#b0b5b4] sm:hover:bg-[#b0b5b4] text-black border border-gray-300'
                }`}
              >
                <div className="text-center h-full flex items-center justify-center">
                  <div className="text-[8px] xs:text-[9px] sm:text-[10px] md:text-[11px] font-semibold leading-tight">{cartela.card_id}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Sticky ID Modal */}
      {isIdModalOpen && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-[95%] max-w-md sm:w-full sm:mx-4 md:top-8">
          <div className="bg-slate-800 rounded-lg border-2 border-blue-400 shadow-2xl">
            <div className="p-3 sm:p-4">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <h3 className="text-base sm:text-lg font-bold text-white truncate">
                    Enter Cartela ID
                  </h3>
                  {registeredCount > 0 && (
                    <span className="px-2 py-1 bg-green-600 text-green-100 rounded-full text-xs font-bold shrink-0">
                      {registeredCount} registered
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setIsIdModalOpen(false)}
                  className="text-slate-400 hover:text-white transition-colors text-lg sm:text-xl shrink-0 ml-2"
                  title="Close"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <input
                  type="text"
                  value={currentIdInput}
                  onChange={(e) => setCurrentIdInput(e.target.value)}
                  placeholder="Enter Cartela ID..."
                  className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:border-blue-400 focus:outline-none"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleIdRegistration();
                    }
                  }}
                  autoFocus
                />

                {registrationStatus.message && (
                  <div className={`p-3 rounded text-sm ${
                    registrationStatus.type === 'success'
                      ? 'bg-green-600 text-green-100'
                      : 'bg-red-600 text-red-100'
                  }`}>
                    {registrationStatus.message}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={handleIdRegistration}
                    disabled={isRegistering || !currentIdInput.trim()}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed px-4 py-2 rounded font-medium transition-colors text-sm sm:text-base"
                  >
                    {isRegistering ? 'Registering...' : 'Register'}
                  </button>
                  <div className="flex gap-2">
                    {registeredCount > 0 && (
                      <button
                        onClick={() => {
                          setIsIdModalOpen(false);
                          setRegisteredCount(0);
                        }}
                        className="px-3 py-2 bg-green-600 hover:bg-green-700 rounded font-medium transition-colors text-sm sm:text-base flex-1 sm:flex-none"
                      >
                        <span className="hidden sm:inline">Finish </span>({registeredCount})
                      </button>
                    )}
                    <button
                      onClick={() => setIsIdModalOpen(false)}
                      className="px-3 py-2 bg-slate-600 hover:bg-slate-700 rounded font-medium transition-colors text-sm sm:text-base"
                    >
                      Cancel
                    </button>
                  </div>
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