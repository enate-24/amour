// @ts-ignore
import { checkWinningPatterns, validateCartela } from "../utils/patternDetection.js";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useCartela } from "../hooks/useCartela";
import useBingo, { PatternName } from "../hooks/useBingo";

type BingoNumber = number | 'FREE';
// @ts-ignore - Ignoring type error for JS file import
import { bingoCards } from '../../backend/data/cartela.js';

interface GamePageProps {
  onNavigateToLottery?: () => void;
  initialCartelaCount?: number;
  selectedCartelaNumbers?: number[];
}

export interface GamePageRef {
  updateSelectedCartelas: (count: number) => void;
}

const numbers = Array.from({ length: 75 }, (_, i) => i + 1);

const GamePage = ({ onNavigateToLottery, selectedCartelaNumbers = [] }: GamePageProps): JSX.Element => {
  const navigate = useNavigate();
  const { cartelas } = useCartela(); // Get actual cartela data
  const { checkWinner, callNumber, calledNumbers } = useBingo(5); // Use the new bingo hook
  const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
  const [called, setCalled] = useState<number[]>([]);
  const [autoCall, setAutoCall] = useState(false);
  const [slider, setSlider] = useState(5); // Default to 5 seconds (middle of 3-7 range)
  const [inputId, setInputId] = useState("");
  const [isGameFinished, setIsGameFinished] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [popupNumber, setPopupNumber] = useState<number | null>(null);
  const [defaultBetAmount, setDefaultBetAmount] = useState(10);
  const [defaultHouseCutPercentage, setDefaultHouseCutPercentage] = useState(10);

  // Flag to track if page just refreshed
  const [justRefreshed, setJustRefreshed] = useState(false);

// Pattern selection handler
const handlePatternSelect = (pattern: string) => {
  setSelectedPattern(pattern);
  console.log('🎯 Pattern changed to:', pattern);
  
  // Save to backend immediately
  savePatternSetting(pattern);
};

// Clear called numbers on page refresh
useEffect(() => {
  const handleBeforeUnload = () => {
    // Remove calledNumbers on beforeunload to clear them on page refresh
    localStorage.removeItem('calledNumbers');
  };

  const handleLoad = () => {
    // Clear called numbers on page load
    console.log('🔄 Page loaded - clearing called numbers...');
    localStorage.removeItem('calledNumbers');
    setJustRefreshed(true);
  };

  // Check on page load
  handleLoad();

  // Remove called numbers on beforeunload for clean refresh
  window.addEventListener('beforeunload', handleBeforeUnload);

  return () => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
  };
}, []);

  // Function to close popup manually
  const closePopup = () => {
    setShowPopup(false);
    setPopupNumber(null);
  };

  const [isAutoCalling, setIsAutoCalling] = useState(false);
  const [selectedCartelas, setSelectedCartelas] = useState(0);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [betAmount, setBetAmount] = useState(10);
  const [totalBet, setTotalBet] = useState(0);
  const [playerWin, setPlayerWin] = useState(0);
  const [isShuffling, setIsShuffling] = useState(false);
  const [winningPatterns, setWinningPatterns] = useState<string[]>([]);
  const [showWinModal, setShowWinModal] = useState(false);
  const [currentWinningPattern, setCurrentWinningPattern] = useState<string>("");
  const [cartelaCheckId, setCartelaCheckId] = useState<string>("");
  const [cartelaCheckResult, setCartelaCheckResult] = useState<{
    isRegistered: boolean;
    hasWon: boolean;
    winningPatterns: string[];
    winAmount: number;
    message: string;
    cartelaId?: string;
    cartelaNumbers?: any;
    calledNumbers?: number[];
    selectedPattern?: string;
    winningNumber?: number;
  } | null>(null);
  const [showCartelaCheckModal, setShowCartelaCheckModal] = useState<boolean>(false);
  const autoCallIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [currentGameData, setCurrentGameData] = useState<any>(null);
  const [gameFetchInterval, setGameFetchInterval] = useState<ReturnType<typeof setInterval> | null>(null);
  const [isCallingNumber, setIsCallingNumber] = useState(false);

  // Ref to always get current called numbers (fixes auto-call issue)
  const calledNumbersRef = useRef<number[]>([]);

  // House bonus state
  const [dailyProfit, setDailyProfit] = useState(0);
  const [houseBonusUsed, setHouseBonusUsed] = useState(false);
  const [showHouseBonus, setShowHouseBonus] = useState(false);
  // Player cartela state
  const [playerCartelaNumbers, setPlayerCartelaNumbers] = useState<{B: number[], I: number[], N: number[], G: number[], O: number[]} | null>(null);

  // State to track if auto-call is paused after calling a number
  const [isAutoCallPaused, setIsAutoCallPaused] = useState(false);

  // Sound category state - fixed to boy only
  const [soundCategory, setSoundCategory] = useState<'boy'>('boy');

  // State for selected pattern (moved up to fix temporal dead zone)
  const [selectedPattern, setSelectedPattern] = useState<string>("Two Lines");

  // Load sound category from localStorage on component mount (force to boy)
  useEffect(() => {
    const savedCategory = localStorage.getItem('soundCategory');
    // Always force to 'boy' - clean up any old 'girl' settings
    if (savedCategory !== 'boy') {
      localStorage.setItem('soundCategory', 'boy');
      console.log('🎵 Cleaned up sound category in localStorage - set to boy');
    }
    setSoundCategory('boy');
  }, []);

  // Fetch current sound category from backend and sync
  useEffect(() => {
    const fetchSoundCategory = async () => {
      try {
        const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
        const response = await fetch(`${API_BASE_URL}/sound/category`);

        if (response.ok) {
          const data = await response.json();
          setSoundCategory(data.category);
          localStorage.setItem('soundCategory', data.category); // Sync to localStorage
          console.log('🎵 Current sound category from backend:', data.category);
        }
      } catch (error) {
        console.error('Error fetching sound category:', error);
      }
    };

    fetchSoundCategory();
  }, []);

  // Function to change sound category
  const changeSoundCategory = async (newCategory: 'girl' | 'boy') => {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
      const response = await fetch(`${API_BASE_URL}/sound/category`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ category: newCategory })
      });

      if (response.ok) {
        const data = await response.json();
        setSoundCategory(data.category);
        localStorage.setItem('soundCategory', data.category); // Save to localStorage
        console.log('🎵 Sound category changed to:', data.category);
      } else {
        console.error('Failed to change sound category');
      }
    } catch (error) {
      console.error('Error changing sound category:', error);
    }
  };

  // Function to save pattern setting to backend
  const savePatternSetting = async (pattern: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        console.warn('No auth token available for saving pattern setting');
        return;
      }

      const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
      const response = await fetch(`${API_BASE_URL}/settings/pattern`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ selectedPattern: pattern })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Pattern setting saved to backend:', data);
      } else {
        console.warn('⚠️ Failed to save pattern setting to backend:', response.status);
      }
    } catch (error) {
      console.error('❌ Error saving pattern setting to backend:', error);
    }
  };

  // Function to load pattern setting from backend
  const loadPatternSetting = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        console.warn('No auth token available for loading pattern setting');
        return;
      }

      const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
      const response = await fetch(`${API_BASE_URL}/settings/pattern`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.selectedPattern) {
          setSelectedPattern(data.selectedPattern);
          // Update localStorage to match backend
          const currentSettings = JSON.parse(localStorage.getItem('bingo-settings') || '{}');
          currentSettings.selectedPattern = data.selectedPattern;
          localStorage.setItem('bingo-settings', JSON.stringify(currentSettings));
          console.log('✅ Pattern setting loaded from backend:', data.selectedPattern);
        }
      } else {
        console.warn('⚠️ Failed to load pattern setting from backend:', response.status);
      }
    } catch (error) {
      console.error('❌ Error loading pattern setting from backend:', error);
    }
  };

  // Retry state for rate limiting
  const [fetchRetryCount, setFetchRetryCount] = useState(0);
  const [currentPollInterval, setCurrentPollInterval] = useState(30000); // Increased to 30 seconds
  const maxRetries = 5;
  const basePollInterval = 30000; // 30 seconds - reduced frequency to prevent rate limiting

  // Auto call rate limiting state
  const [autoCallRetryCount, setAutoCallRetryCount] = useState(0);
  const [currentAutoCallInterval, setCurrentAutoCallInterval] = useState(slider * 1000); // Start with slider value in milliseconds
  const maxAutoCallRetries = 5;

  // Sync currentAutoCallInterval with slider changes
  useEffect(() => {
    setCurrentAutoCallInterval(slider * 1000);
  }, [slider]);

  // Calculate win amount based on patterns found
  const calculateWinAmount = (patternCount: number): number => {
    const baseAmount = totalBet || betAmount * selectedCartelas;
    return baseAmount * (1 + (patternCount - 1) * 0.5); // Bonus for multiple patterns
  };

  // Sync called state with ref whenever called changes
  useEffect(() => {
    calledNumbersRef.current = called;
  }, [called]);

  // Play winner sound from API
  const playWinSound = async (patternKey: string) => {
    console.log('🎵 playWinSound called - attempting to play winner sound for:', patternKey);

    // Play winner sound from API
    await playWinnerSoundFile(patternKey);
  };

  // Play winner sound file from API
  const playWinnerSoundFile = async (patternKey: string = '') => {
    try {
      console.log('🎵 Attempting to play winner sound from API for pattern:', patternKey);

      // Fetch winner sound from API
      const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
      const soundUrl = `${API_BASE_URL}/sound/winner${patternKey ? `/${patternKey}` : ''}`;
      const audio = new Audio(soundUrl);
      audio.volume = 0.8;
      audio.preload = 'auto';

      // Wait for the audio to be ready
      await new Promise((resolve) => {
        audio.addEventListener('canplaythrough', resolve, { once: true });
        audio.addEventListener('error', resolve, { once: true });

        // Timeout after 3 seconds
        setTimeout(resolve, 3000);

        // Start loading
        audio.load();
      });

      // Play the sound
      await audio.play();
      console.log('✅ Winner sound played successfully from API');

    } catch (error) {
      console.log('❌ Could not play winner sound from API:', error instanceof Error ? error.message : String(error));
    }
  };

  // Play not winner sound file from API
  const playNotWinnerSoundFile = async (patternKey: string = '') => {
    try {
      console.log('🎵 Attempting to play not winner sound from API for pattern:', patternKey);

      // Fetch not winner sound from API
      const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
      const soundUrl = `${API_BASE_URL}/sound/notwinner${patternKey ? `/${patternKey}` : ''}`;
      const audio = new Audio(soundUrl);
      audio.volume = 0.8;
      audio.preload = 'auto';

      // Wait for the audio to be ready or error
      const loadPromise = new Promise<void>((resolve, reject) => {
        const onCanPlay = () => {
          cleanup();
          resolve();
        };

        const onError = (e: Event) => {
          cleanup();
          console.log('❌ Audio load error:', e);
          reject(new Error('Audio load failed'));
        };

        const onTimeout = () => {
          cleanup();
          console.log('⏰ Audio load timeout');
          reject(new Error('Audio load timeout'));
        };

        const cleanup = () => {
          audio.removeEventListener('canplaythrough', onCanPlay);
          audio.removeEventListener('error', onError);
          clearTimeout(timeoutId);
        };

        audio.addEventListener('canplaythrough', onCanPlay, { once: true });
        audio.addEventListener('error', onError, { once: true });

        // Timeout after 3 seconds
        const timeoutId = setTimeout(onTimeout, 3000);

        // Start loading
        audio.load();
      });

      await loadPromise;

      // Play the sound
      await audio.play();
      console.log('✅ Not winner sound played successfully from API');

    } catch (error) {
      console.log('❌ Could not play not winner sound from API:', error instanceof Error ? error.message : String(error));

      // Fallback: try to play directly without waiting for canplaythrough
      try {
        const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
        const fallbackAudio = new Audio(`${API_BASE_URL}/sound/notwinner`);
        fallbackAudio.volume = 0.8;
        await fallbackAudio.play();
        console.log('✅ Not winner sound played via fallback');
      } catch (fallbackError) {
        console.log('❌ Fallback also failed:', fallbackError instanceof Error ? fallbackError.message : String(fallbackError));
      }
    }
  };

  // Helper function to convert cartela column format to 5x5 grid for the new hook
  const convertCartelaToGrid = (cartelaNumbers: any): BingoNumber[][] => {
    const grid: BingoNumber[][] = Array(5).fill(null).map(() => Array(5).fill('FREE'));

    if (!cartelaNumbers) return grid;

    // Handle column format {B: [], I: [], N: [], G: [], O: []}
    for (let row = 0; row < 5; row++) {
      grid[row][0] = cartelaNumbers.B?.[row] ?? 'FREE';
      grid[row][1] = cartelaNumbers.I?.[row] ?? 'FREE';
      // Center square (N column, middle row) is always FREE
      grid[row][2] = (row === 2) ? 'FREE' : (cartelaNumbers.N?.[row] ?? 'FREE');
      grid[row][3] = cartelaNumbers.G?.[row] ?? 'FREE';
      grid[row][4] = cartelaNumbers.O?.[row] ?? 'FREE';
    }

    return grid;
  };

  // Transform raw bingo card data to column format (moved earlier to avoid scope issues)
  const transformBingoData = (rawCard: any[][]) => {
    const columns: { [key: string]: number[] } = { B: [], I: [], N: [], G: [], O: [] };
    const columnNames = ['B', 'I', 'N', 'G', 'O'];

    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        const value = rawCard[row][col];
        const columnName = columnNames[col];
        if (value === "FREE") {
          columns[columnName][row] = 0; // FREE is 0
        } else {
          columns[columnName][row] = Number(value);
        }
      }
    }

    return columns as { B: number[]; I: number[]; N: number[]; G: number[]; O: number[]; };
  };

  // Update bingo hook when numbers are called - fixed to only call with actual numbers
  useEffect(() => {
    called.forEach(number => {
      if (number && typeof number === 'number' && !calledNumbers?.has(number)) {
        callNumber(number);
      }
    });
  }, [called, calledNumbers, callNumber]);

  // State to toggle between frontend and backend winner checking
  const [useBackendWinnerCheck, setUseBackendWinnerCheck] = useState(true);

  // Check for winning patterns using backend API (new method)
  const checkForWinningPatternsBackend = useCallback(async () => {
    if (called.length < 4) return; // Need at least 4 numbers for basic line patterns
    if (isGameFinished) return;

    try {
      if (!currentGameData || !currentGameData.selectedCartelas || !Array.isArray(currentGameData.selectedCartelas)) {
        console.warn('No current game data or selected cartelas available for backend check');
        return;
      }

      console.log('🔍 CHECKING PATTERNS using backend API...');

      const payload = {
        gameId: currentGameData.id,
        calledNumbers: called,
        selectedCartelas: currentGameData.selectedCartelas,
        selectedPattern: selectedPattern
      };

      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/games/check-winners`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const result = await response.json();
        console.log('📡 Backend winner check result:', result);

        if (result.hasWinner && result.winningCartela && result.winningPatterns && result.winningPatterns.length > 0) {
          const winAmount = calculateWinAmount(result.winningPatterns.length);
          setPlayerWin(winAmount);

          // Set win modal data
          setWinningPatterns(result.winningPatterns);
          setCurrentWinningPattern(result.winningPatterns[0].replace(/\s+/g, '').toLowerCase());
          setShowWinModal(true);

          console.log('🏆 WINNER DETECTED from backend! Cartela:', result.winningCartela, 'Patterns:', result.winningPatterns, 'Win amount:', winAmount);

          // Register the winner in the database
          try {
            fetch(`${API_BASE_URL}/cartelas/${result.winningCartela}/register-winner`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                winningPatterns: result.winningPatterns,
                gameId: currentGameData?.id,
                winAmount: winAmount
              })
            }).then(response => {
              if (response.ok) {
                console.log('✅ Winner registered successfully in database');
              } else {
                console.warn('⚠️ Failed to register winner in database:', response.status);
              }
            }).catch(registerError => {
              console.warn('⚠️ Error registering winner:', registerError);
            });
          } catch (registerError) {
            console.warn('⚠️ Error initiating winner registration:', registerError);
          }
        } else {
          console.log('❌ No winning patterns found from backend');
          setPlayerWin(0);
        }
      } else {
        console.warn('⚠️ Backend winner check failed, status:', response.status);
        // Could fall back to frontend checking here if needed
      }
    } catch (error) {
      console.error('Error checking winning patterns with backend:', error);
      // Could fall back to frontend checking here if needed
    }
  }, [called, isGameFinished, currentGameData, selectedPattern, calculateWinAmount]);

  // Check for winning patterns using frontend logic (fallback/original method)
  const checkForWinningPatternsFrontend = useCallback(() => {
    if (called.length < 4) return; // Need at least 4 numbers for basic line patterns

      // Only check for winners if game is not already finished
      if (isGameFinished) return;

    try {
      console.log('🔍 CHECKING PATTERNS for all cartelas using advanced pattern detection...');

      // Use backend data from currentGameData instead of localStorage
      if (!currentGameData || !currentGameData.selectedCartelas || !Array.isArray(currentGameData.selectedCartelas)) {
        console.warn('No current game data or selected cartelas available');
        return;
      }

      // Check all selected cartelas for winning patterns
      let winningPatternsFound: string[] = [];
      let winningCartelaId: string | null = null;
      let winningCartelaData: any = null;

      for (const cartelaId of currentGameData.selectedCartelas) {
        if (!cartelaId) continue;

        console.log(`🔍 Checking cartela: ${cartelaId}`);

        // Get the actual cartela data from the cartelas array
        const cartelaData = cartelas.find(c => c.card_id === cartelaId);
        if (!cartelaData) {
          console.warn(`Cartela ${cartelaId} not found in available cartelas, skipping winner check`);
          continue;
        }

        // Get cartela numbers in column format (B, I, N, G, O)
        let cartelaNumbers = cartelaData.numbers;

        // Validate cartela structure
        if (!cartelaNumbers.B || !cartelaNumbers.I || !cartelaNumbers.N || !cartelaNumbers.G || !cartelaNumbers.O) {
          // Try to convert from row format if validation fails
          if (Array.isArray(cartelaNumbers) && Array.isArray(cartelaNumbers[0])) {
            cartelaNumbers = transformBingoData(cartelaNumbers);
          } else {
            console.error(`Invalid cartela data for ${cartelaData.card_id}, missing columns`);
            continue;
          }
        }

        console.log('🔍 Called numbers count:', called.length, 'Cartela ID:', cartelaId, 'Selected pattern:', selectedPattern);

        // Use the advanced pattern detection from patternDetection.cjs
        const cartelaForPatternCheck = {
          card_id: cartelaId,
          numbers: cartelaNumbers
        };

        // Get result from comprehensive pattern checking
        const patternResult = checkWinningPatterns(called, cartelaForPatternCheck, [selectedPattern]) as any;

        console.log(`🔍 Pattern check result for ${cartelaId}:`, {
          isWinner: patternResult.isWinner,
          winningPatterns: patternResult.winningPatterns,
          completedLines: patternResult.completedLines
        });

        if (patternResult.isWinner) {
          winningPatternsFound = patternResult.winningPatterns; // Use patterns from advanced detection
          winningCartelaId = cartelaId;
          winningCartelaData = cartelaNumbers;
          console.log(`🎊 WINNER FOUND! Cartela ${cartelaId} has: ${winningPatternsFound.join(', ')}`);
          break; // Stop at the first winning cartela found
        }
      }

      console.log('🎉 Final winning patterns found (frontend):', winningPatternsFound);

      // Notify player when winner is found
      if (winningPatternsFound.length > 0 && winningCartelaId && !isGameFinished) {
        const winAmount = calculateWinAmount(winningPatternsFound.length);
        setPlayerWin(winAmount);

        // Set win modal data
        setWinningPatterns(winningPatternsFound);
        setCurrentWinningPattern(winningPatternsFound[0].replace(/\s+/g, '').toLowerCase()); // Use first pattern for sound, normalize
        setShowWinModal(true);

        console.log('🏆 WINNER DETECTED automatically! Cartela:', winningCartelaId, 'Patterns:', winningPatternsFound, 'Win amount:', winAmount);

        // Register the winner in the database
        try {
          fetch(`${API_BASE_URL}/cartelas/${winningCartelaId}/register-winner`, {
            method: 'POST',
            headers: {
              'Authorization': "Bearer ${localStorage.getItem('auth_token')}",
              'Content-Type': 'application/json',
            },

body: JSON.stringify({
              winningPatterns: winningPatternsFound,
              gameId: currentGameData?.id,
              winAmount: winAmount
            })
          }).then(response => {
            if (response.ok) {
              console.log('✅ Winner registered successfully in database');
            } else {
              console.warn('⚠️ Failed to register winner in database:', response.status);
            }
          }).catch(registerError => {
            console.warn('⚠️ Error registering winner:', registerError);
          });
        } catch (registerError) {
          console.warn('⚠️ Error initiating winner registration:', registerError);
        }
      } else if (winningPatternsFound.length === 0) {
        // No winner found, keep checking
        console.log('❌ No winning patterns found for any cartela');
        setPlayerWin(0);
      }
    } catch (error) {
      console.error('Error checking winning patterns:', error);
    }
  }, [isGameFinished, cartelas, calculateWinAmount, currentGameData, selectedPattern, checkWinner, called]);

  // Check for winning patterns (unified method - uses backend or frontend based on flag)
  const checkForWinningPatterns = useCallback(() => {
    if (useBackendWinnerCheck) {
      checkForWinningPatternsBackend();
    } else {
      checkForWinningPatternsFrontend();
    }
  }, [useBackendWinnerCheck, checkForWinningPatternsBackend, checkForWinningPatternsFrontend]);

  // Fetch active game data including called numbers with rate limiting handling
  const fetchCurrentGame = useCallback(async (retryCount = 0, customInterval?: number) => {
    try {
      const token = localStorage.getItem('auth_token');
      const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

      if (!token) {
        console.log('No auth token available for fetching game data');
        return;
      }

        const response = await fetch(`${API_BASE_URL}/games/active`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

      if (response.ok) {
        const result = await response.json();
        const gameData = result.game;

        // Reset retry count and interval on successful request
        setFetchRetryCount(0);
        if (currentPollInterval !== basePollInterval) {
          setCurrentPollInterval(basePollInterval);
          // Restart polling with normal interval
          startGameDataRefresh();
        }

        // Don't update called numbers from backend - they're stored in localStorage now
        // Just update game data for other purposes
        setCurrentGameData(gameData);

        // Sync database values to local state
        if (gameData.betMoney !== undefined) {
          setBetAmount(parseFloat(gameData.betMoney) || 10);
        }
        if (gameData.winMoney !== undefined) {
          setPlayerWin(parseFloat(gameData.winMoney) || 0);
        }
        if (gameData.cartelasSelected !== undefined) {
          setSelectedCartelas(parseInt(gameData.cartelasSelected) || 0);
        }

        // Use localStorage called numbers for winner checking
        const storedCalledNumbers = localStorage.getItem('calledNumbers');
        if (storedCalledNumbers) {
          try {
            const parsed = JSON.parse(storedCalledNumbers);
            if (Array.isArray(parsed)) {
              console.log('📡 Using called numbers from localStorage for winner check:', parsed.length, 'numbers');
              checkForWinningPatterns();
            }
          } catch (e) {
            console.warn('Error parsing called numbers from localStorage for winner check:', e);
          }
        }

        // If game is finished by backend, stop auto calling (but don't set isGameFinished - let user press Finish button)
        if (gameData && (gameData.status === 'finished' || gameData.status === 'end')) {
          setAutoCall(false);
          if (autoCallIntervalRef.current) {
            clearInterval(autoCallIntervalRef.current);
          }
        }
      } else if (response.status === 429) {
        // Rate limiting detected - implement exponential backoff
        const newRetryCount = retryCount + 1;
        const backoffDelay = Math.min(60000, Math.pow(2, newRetryCount) * 1000); // Exponential backoff up to 60 seconds
        const newInterval = Math.min(basePollInterval * Math.pow(2, newRetryCount), 30000); // Increase poll interval up to 30 seconds

        console.log(`⚠️ Rate limited (429) - Backing off for ${backoffDelay}ms. Retry ${newRetryCount}/${maxRetries}. New poll interval: ${newInterval}ms`);

        if (newRetryCount < maxRetries) {
          // Update retry count and poll interval
          setFetchRetryCount(newRetryCount);
          setCurrentPollInterval(newInterval);

          // Restart polling with new interval
          startGameDataRefresh();

          // Retry the current request after backoff delay
          setTimeout(() => {
            fetchCurrentGame(newRetryCount, newInterval);
          }, backoffDelay);
        } else {
          console.log('🚫 Max retries reached for rate limiting. Stopping automatic polling until next successful request.');
          // Stop polling but don't clear the interval completely - wait for manual trigger or page reload
        }
      } else if (response.status === 401) {
        // Token expired or invalid - redirect to login
        console.log('Authentication failed, redirecting to login');
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        navigate('/login');
        return;
      } else {
        console.log('API call failed for active game, status:', response.status);
        // Reset retry count on other errors (not rate limiting)
        setFetchRetryCount(0);
      }
    } catch (error) {
      console.log('Error fetching active game:', error);
      // Don't throw error, just log it
      // Reset retry count on network errors
      setFetchRetryCount(0);
    }
  }, [currentPollInterval, basePollInterval]);

  // Start/stop periodic game data fetching with dynamic interval
  const startGameDataRefresh = useCallback(() => {
    // Clear any existing interval to prevent overlaps
    if (gameFetchInterval) {
      clearInterval(gameFetchInterval);
      setGameFetchInterval(null);
    }

    // Only set up polling interval - don't fetch immediately to avoid overlapping with manual calls
    const intervalId = setInterval(() => {
      if (!isGameFinished && selectedCartelas >= 3) {
        fetchCurrentGame();
      }
    }, currentPollInterval);

    setGameFetchInterval(intervalId);
  }, [gameFetchInterval, fetchCurrentGame, isGameFinished, selectedCartelas, currentPollInterval]);

  const stopGameDataRefresh = useCallback(() => {
    if (gameFetchInterval) {
      clearInterval(gameFetchInterval);
      setGameFetchInterval(null);
    }
  }, [gameFetchInterval]);

  // On component mount, fetch the active game from the server to initialize the state.
  useEffect(() => {
    let isMounted = true;

    const initializeGame = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

        if (!token) {
          console.log('No auth token, redirecting to login');
          if (isMounted) navigate('/login', { replace: true });
          return;
        }

        const response = await fetch(`${API_BASE_URL}/games/active`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!isMounted) return;

        if (response.ok) {
          const result = await response.json();
          const gameData = result.game;

          console.log('✅ Active game found on server, initializing GamePage.', gameData);

          // Start with empty called numbers array (cleared on refresh)
          setCalled([]);
          console.log('🧹 Page refreshed - starting with cleared called numbers');

          setCurrentGameData(gameData);

          // Store current game data in localStorage for handleNext function
          // For user_session games, selectedCartelas come from localStorage, not backend
          const existingGameData = localStorage.getItem('currentGame');
          const existingSelectedCartelas = existingGameData ?
            JSON.parse(existingGameData).selectedCartelas || [] : [];

          console.log('🔍 GamePage loading - backend gameData.selectedCartelas:', gameData.selectedCartelas);

          // Use selected cartelas only from database (no localStorage saving or fallback)
          let finalSelectedCartelas = Array.isArray(gameData.selectedCartelas) ? gameData.selectedCartelas : [];

          // Store essential data in localStorage, including selectedCartelas now
          const gameDataToStore = {
            gameId: gameData.id,
            gameNumber: gameData.gameNumber,
            betAmount: gameData.betMoney || 10,
            totalBet: (gameData.betMoney || 10) * (gameData.cartelasSelected || 0),
            housePercentage: gameData.houseCutPercentage || 10,
            houseCut: ((gameData.betMoney || 10) * (gameData.cartelasSelected || 0) * (gameData.houseCutPercentage || 10)) / 100,
            selectedCartelas: finalSelectedCartelas, // Store the selected cartelas IDs
            winnerInfo: '',
            status: gameData.status || 'active'
          };
          // Store essential game metadata including cartelas data
          localStorage.setItem('currentGame', JSON.stringify(gameDataToStore));
          console.log('💾 Stored game metadata in localStorage (including cartelas):', gameDataToStore);

          // Sync database values to local state
          if (gameData.betMoney !== undefined) {
            setBetAmount(parseFloat(gameData.betMoney) || 10);
          }
          if (gameData.winMoney !== undefined) {
            setPlayerWin(parseFloat(gameData.winMoney) || 0);
          }
          if (gameData.cartelasSelected !== undefined) {
            setSelectedCartelas(parseInt(gameData.cartelasSelected) || 0);
          }

          // Start polling for updates
          startGameDataRefresh();
        } else if (response.status === 404) {
          console.log('No active game on server, redirecting to /newgame');
          navigate('/newgame', { replace: true });
        } else if (response.status === 401) {
          console.log('Authentication error, clearing token and redirecting to login');
          localStorage.removeItem('auth_token');
          localStorage.removeItem('user');
          navigate('/login', { replace: true });
        } else {
          console.error('Failed to fetch active game, redirecting to new game as fallback');
          navigate('/newgame', { replace: true });
        }
      } catch (error) {
        console.error('Error initializing game:', error);
        if (isMounted) {
          navigate('/newgame', { replace: true });
        }
      }
    };

    initializeGame();

    return () => {
      isMounted = false;
      stopGameDataRefresh();
    };
  }, [navigate]);

  // Token validation cache to prevent excessive API calls
  const tokenValidationCache = useRef<{
    isValid: boolean;
    timestamp: number;
    token: string;
  } | null>(null);

  // Cache token validation for 5 minutes to prevent excessive API calls
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  const validateToken = async (): Promise<boolean> => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return false;

      // Check cache first
      const now = Date.now();
      if (tokenValidationCache.current &&
          tokenValidationCache.current.token === token &&
          (now - tokenValidationCache.current.timestamp) < CACHE_DURATION) {
        return tokenValidationCache.current.isValid;
      }

      const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
      const response = await fetch(`${API_BASE_URL}/auth/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const isValid = response.ok;

      // Cache the result
      tokenValidationCache.current = {
        isValid,
        timestamp: now,
        token
      };

      return isValid;
    } catch (error) {
      console.error('Token validation failed:', error);
      return false;
    }
  };

  // Auto call effect - now calls API instead of generating random numbers
  useEffect(() => {
    // Clear any existing interval first
    if (autoCallIntervalRef.current) {
      clearInterval(autoCallIntervalRef.current);
      autoCallIntervalRef.current = null;
    }

    if (autoCall && !isGameFinished && !isAutoCallPaused) {
      console.log('Starting auto call with interval:', currentAutoCallInterval);
      setIsAutoCalling(true);

      autoCallIntervalRef.current = setInterval(async () => {
        try {
          // Validate token before making API call
          const isTokenValid = await validateToken();
          if (!isTokenValid) {
            console.log('Token invalid, stopping auto call and redirecting to login');
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user');
            navigate('/login');
            setAutoCall(false);
            setIsAutoCalling(false);
            return;
          }

          const token = localStorage.getItem('auth_token');
          const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

          const gameData = localStorage.getItem('currentGame');
          if (!gameData) {
            console.log('No game data for auto call');
            return;
          }

          const parsed = JSON.parse(gameData);
          const gameId = currentGameData?.id || parsed.gameId;

          if (!gameId) {
            console.log('No game ID for auto call');
            return;
          }

          console.log('🤖 Auto-calling next number for game:', gameId);

          const response = await fetch(`${API_BASE_URL}/games/${gameId}/call-number`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              calledNumbers: calledNumbersRef.current // Send current called numbers for user_session games
            })
          });

          if (response.ok) {
            const result = await response.json();

            // Reset auto call retry count on successful request (don't reset interval to avoid re-triggering useEffect)
            setAutoCallRetryCount(0);

            // Check if game is completed
            if (result.gameCompleted) {
              console.log('🎉 Game completed - all numbers have been called - pausing auto-call');
              setAutoCall(false);
              setIsAutoCalling(false);
              // Update called numbers from the response
              if (result.game && result.game.calledNumbers) {
                setCalled(result.game.calledNumbers);
              }
              return;
            }

            const calledNumber = result.calledNumber;

            console.log('✅ Auto-called number from backend:', calledNumber);

        // Update called numbers immediately by adding the new number
        if (calledNumber) {
          setCalled(prev => {
            const newCalled = [...prev, calledNumber];
            // Save to localStorage
            localStorage.setItem('calledNumbers', JSON.stringify(newCalled));
            console.log('📡 Added called number to state and localStorage:', calledNumber);
            return newCalled;
          });
        }

            // Play sound effect
            playNumberSound(calledNumber);

            // Pause auto-call during popup animation
            setIsAutoCallPaused(true);

            // Show number with animation
            setPopupNumber(calledNumber);
            setShowPopup(true);

            // Fetch latest state after animation (as backup) and resume auto-call
            setTimeout(() => {
              setShowPopup(false);
              setIsAutoCallPaused(false); // Resume auto-call
              // Removed redundant fetchCurrentGame call - polling handles updates
            }, 2000);
          } else if (response.status === 400) {
            // Handle 400 errors - check if game is completed
            let errorMessage = 'Auto-call failed with 400 status';
            try {
              const errorData = await response.json();
              if (errorData.error) {
                errorMessage = errorData.error;

                // Check if this means all numbers have been called
                if (errorData.error === 'All numbers have been called.') {
                  console.log('🎉 All numbers have been called - pausing auto-call');
                  setAutoCall(false);
                  setIsAutoCalling(false);
                  return;
                }
              }
            } catch (e) {
              console.log('Could not parse 400 auto-call error response');
            }
            console.log(`⚠️ Auto-call stopped - ${errorMessage}`);
            setAutoCall(false);
            setIsAutoCalling(false);
          } else if (response.status === 429) {
            // Rate limiting detected - stop auto call to prevent repeated calls
            console.log('⚠️ Auto-call rate limited (429) - Stopping auto call');
            setAutoCall(false);
            setIsAutoCalling(false);
            setAutoCallRetryCount(0);
            setCurrentAutoCallInterval(slider * 1000); // Reset to original interval
          } else if (response.status === 401) {
            // Token expired or invalid - clear authentication and redirect to login
            console.log('Authentication failed during auto call - token expired or invalid');
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user');
            navigate('/login');
            setAutoCall(false);
            setIsAutoCalling(false);
            return;
          } else {
            console.log('Auto-call API failed, status:', response.status);
            // Stop auto call on API failure
            setAutoCall(false);
            setIsAutoCalling(false);
          }
        } catch (error) {
          console.log('Error in auto call:', error);
          // Stop auto call on error
          setAutoCall(false);
          setIsAutoCalling(false);
        }
      }, currentAutoCallInterval);
    } else {
      console.log('Stopping auto call');
      setIsAutoCalling(false);
    }

    return () => {
      if (autoCallIntervalRef.current) {
        clearInterval(autoCallIntervalRef.current);
        autoCallIntervalRef.current = null;
      }
    };
  }, [autoCall, slider, isGameFinished, currentGameData, currentAutoCallInterval]);

  const playNumberSound = async (number: number) => {
    try {
      // Fetch sound from API
      const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
      const audio = new Audio(`${API_BASE_URL}/sound/number/${number}`);
      audio.volume = 0.7;
      audio.preload = 'auto';

      console.log(`🔄 Playing REAL MP3 sound for number ${number}`);

      // Wait for the audio to be ready
      await new Promise((resolve) => {
        audio.addEventListener('canplaythrough', resolve, { once: true });
        audio.addEventListener('error', resolve, { once: true });

        // Timeout after 3 seconds
        setTimeout(resolve, 3000);

        // Start loading
        audio.load();
      });

      // Play the sound
      await audio.play();
      console.log(`✅ Playing REAL MP3 sound for number ${number}`);

    } catch (error) {
      console.log('❌ Could not play number sound:', error instanceof Error ? error.message : String(error));
    }
  };

  // Transform raw bingo card data to column format (removed duplicate - now only declared earlier)



  const handleNumberClick = (_num: number) => {
    // Numbers can only be called via Next button or Auto Call
    // Clicking numbers no longer calls them - just for show
  };

  const handleNext = async () => {
    if (isGameFinished || selectedCartelas < 3 || isCallingNumber) return;

    try {
      setIsCallingNumber(true);

      const token = localStorage.getItem('auth_token');
      const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

      // Get current game ID from localStorage or currentGameData
      const gameData = localStorage.getItem('currentGame');
      if (!gameData) {
        console.log('No game data available for calling next number');
        return;
      }

      const parsed = JSON.parse(gameData);
      const gameId = currentGameData?.id || parsed.gameId;

      if (!gameId) {
        console.log('No game ID available for calling next number');
        return;
      }

      console.log('🔔 Calling next single number for game:', gameId);

      // Call only ONE number (not all remaining)
      const response = await fetch(`${API_BASE_URL}/games/${gameId}/call-number`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          calledNumbers: called // Send current called numbers for user_session games
        })
      });

      if (response.ok) {
        const result = await response.json();

        // Check if game is completed
        if (result.gameCompleted) {
          console.log('🎉 Game completed - all numbers have been called - pausing auto-call');
          setAutoCall(false);
          setCalled(result.game.calledNumbers);
          setIsCallingNumber(false);
          return;
        }

        const calledNumber = result.calledNumber;

        console.log(`✅ Called single number from backend:`, calledNumber);

        // Update called numbers immediately by adding the new number
        if (calledNumber) {
          setCalled(prev => {
            const newCalled = [...prev, calledNumber];
            // Save to localStorage
            localStorage.setItem('calledNumbers', JSON.stringify(newCalled));
            console.log('📡 Added called number to state and localStorage:', calledNumber);
            return newCalled;
          });
        }

        // Play sound effect for the number call
        playNumberSound(calledNumber);

        // Show number with animation
        setPopupNumber(calledNumber);
        setShowPopup(true);

        // Hide popup after animation
        setTimeout(() => {
          setShowPopup(false);
          // Removed redundant fetchCurrentGame call - polling handles updates
        }, 2000);

      } else if (response.status === 401) {
        // Token expired or invalid - clear authentication and redirect to login
        console.log('Authentication failed during number call - token expired or invalid');
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        navigate('/login');
        return;
      } else if (response.status === 400) {
        // Handle 400 errors - check if game is completed
        let errorMessage = 'API call failed with 400 status';
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;

            // Check if this means all numbers have been called
            if (errorData.error === 'All numbers have been called.') {
              console.log('🎉 All numbers have been called - pausing auto-call');
              setAutoCall(false);
              setIsCallingNumber(false);
              return;
            }
          }
        } catch (e) {
          console.log('Could not parse 400 error response');
        }
        console.log(`400 Error: ${errorMessage}`);
      } else {
        // Log the actual error message from backend
        let errorMessage = `API call to call next number failed, status: ${response.status}`;
        try {
          // Clone the response to avoid consuming the stream
          const responseClone = response.clone();
          const errorData = await responseClone.json();
          if (errorData.error) {
            errorMessage += ` - ${errorData.error}`;
          }
        } catch (e) {
          // If we can't parse the error as JSON, try to get text
          try {
            const errorText = await response.text();
            if (errorText) {
              errorMessage += ` - ${errorText}`;
            }
          } catch (textError) {
            // If both JSON and text parsing fail, just log the status
            console.log('Could not parse error response body');
          }
        }
        console.log(errorMessage);
      }

    } catch (error) {
      console.log('Error calling next number:', error);
      // Fallback behavior could be added here if needed
    } finally {
      setIsCallingNumber(false);
    }
  };

  const handleFinish = async () => {
    console.log('🎯 handleFinish called - starting game finish process');

    try {
      // Get current game data to find the game ID
      const gameData = localStorage.getItem('currentGame');
      const token = localStorage.getItem('auth_token');
      const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

      console.log('📊 Current game data:', gameData);
      console.log('🔑 Has token:', !!token);

      if (!gameData) {
        console.log('No game data found, allowing finish anyway');
        // Allow finishing even without formal game data
        setCalled(numbers);
        setIsGameFinished(true);
        // Navigate immediately for simple case
        setTimeout(() => {
          navigate('/newgame');
        }, 500);
        return;
      }

      const parsed = JSON.parse(gameData);
      const gameId = parsed.gameId;

      console.log('🎯 Game ID from localStorage:', gameId);
      console.log('🎯 Game data parsed:', parsed);

      if (!gameId) {
        console.log('No game ID found, allowing finish anyway');
        // Allow finishing even without game ID
        setCalled(numbers);
        setIsGameFinished(true);
        // Navigate immediately
        setTimeout(() => {
          navigate('/newgame');
        }, 500);
        return;
      }

      console.log('🎯 Finishing game:', gameId);

      // Check for winners before finishing the game
      let winnerCartelaIds: string[] = [];
      let hasWinner = false;

      try {
        console.log('🔍 Checking for winners before finishing game...');

        // Get current game data and selected cartelas
        if (parsed.selectedCartelas && Array.isArray(parsed.selectedCartelas)) {
          // Check all selected cartelas for winning patterns
          for (const cartelaId of parsed.selectedCartelas) {
            if (!cartelaId) continue;

            // Get the actual cartela data from the cartelas array
            const cartelaData = cartelas.find(c => c.card_id === cartelaId);
            if (!cartelaData) continue;

            // Convert cartela data to the format expected by pattern detection
            const formattedCartela = {
              card_id: cartelaData.card_id,
              numbers: cartelaData.numbers
            };

            // Validate cartela before checking patterns
            if (!validateCartela(formattedCartela)) {
              console.error(`Invalid cartela data for ${cartelaData.card_id}, skipping pattern check in handleFinish`);
              continue;
            }

            // Check for winning patterns using current called numbers
            const patterns = checkWinningPatterns(called, formattedCartela, ["One Line", "Two Lines", "Three Lines", "Full House"]) as any;
            if (patterns.length > 0) {
              console.log(`🏆 Winner found! Cartela ${cartelaId} won with patterns:`, patterns);
              winnerCartelaIds.push(cartelaId);
              hasWinner = true;
            }
          }
        }

        if (hasWinner) {
          console.log(`🎉 Game has ${winnerCartelaIds.length} winner(s):`, winnerCartelaIds);
        } else {
          console.log('😔 No winners found in this game');
        }

      } catch (winnerCheckError) {
        console.error('Error checking for winners:', winnerCheckError);
        // Continue with finishing even if winner check fails
        winnerCartelaIds = [];
        hasWinner = false;
      }

      // Check if this is a user session game (which doesn't need admin API finish)
      const isUserSession = parsed.winnerPattern === 'user_session' || currentGameData?.winnerPattern === 'user_session';
      console.log('🎯 Is user session:', isUserSession, 'winnerPattern:', parsed.winnerPattern, 'currentGameData winnerPattern:', currentGameData?.winnerPattern);

      let apiFinishSuccess = false;

      // Try to finish the game via API (different endpoints for different game types)
      if (token) {
        try {
          const finishEndpoint = isUserSession ? 'finish-session' : 'finish';
          console.log(`📡 Attempting to finish game via API (${finishEndpoint})...`);

          const response = await fetch(`${API_BASE_URL}/games/${gameId}/${finishEndpoint}`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              winMoney: playerWin || 0,
              winnerCartelaIds: winnerCartelaIds // Pass winner cartela IDs or empty array
            })
          });

          if (response.ok) {
            const result = await response.json();
            console.log('✅ Game finished successfully via API:', result);
            apiFinishSuccess = true;
          } else {
            console.log('❌ API finish failed - falling back to local finish');
            // Fall back to local finish if API fails
            apiFinishSuccess = true;
          }
        } catch (apiError) {
          console.log('❌ API call failed - falling back to local finish:', apiError);
          // Fall back to local finish if API fails
          apiFinishSuccess = true;
        }
      } else {
        console.log('⚠️ No auth token - finishing locally as fallback');
        // Fall back to local finish even without token
        apiFinishSuccess = true;
      }

      // Only update local state if API succeeded (or for user sessions)
      if (apiFinishSuccess) {
        // Update local state now that API succeeded
        setIsGameFinished(true);

        // Save finished state to localStorage to persist across refreshes
        try {
          const currentGameData = localStorage.getItem('currentGame');
          if (currentGameData) {
            const parsed = JSON.parse(currentGameData);
            parsed.isFinished = true;
            parsed.finishedAt = new Date().toISOString();
            parsed.finalWinAmount = playerWin || 0;
            parsed.winnerCartelaIds = winnerCartelaIds;
            parsed.hasWinner = hasWinner;
            localStorage.setItem('currentGame', JSON.stringify(parsed));
          }
        } catch (error) {
          console.error('Error saving finished state to localStorage:', error);
        }

        // Update user statistics in localStorage
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        if (currentUser.id) {
          currentUser.totalGamesPlayed = (currentUser.totalGamesPlayed || 0) + 1;
          currentUser.totalWinnings = (currentUser.totalWinnings || 0) + (playerWin || 0);
          localStorage.setItem('user', JSON.stringify(currentUser));
        }

        // Auto-save game data to analysis after finishing (don't block on this)
        try {
          const winnerInfo = hasWinner
            ? `Winner: ${winnerCartelaIds.join(', ')}`
            : 'No Winner';

          // Ensure we have valid user data
          const userData = JSON.parse(localStorage.getItem('user') || '{}');
          const userId = userData.id || 'unknown';
          const username = userData.username || 'unknown';

          // Calculate profit properly
          const totalBetAmount = parsed.totalBet || (parsed.betAmount * (parsed.selectedCartelas?.length || 0)) || 0;
          const houseCutAmount = (totalBetAmount * (parsed.housePercentage || 10)) / 100;
          const profit = houseCutAmount - (playerWin || 0);

          const gameAnalysisData = {
            gameId: String(parsed.gameId || `GAME_${Date.now()}`),
            gameNumber: parseInt(String(parsed.gameNumber || 1), 10),
            players: parseInt(String(parsed.selectedCartelas?.length || 0), 10),
            bet: parseFloat(String(parsed.betAmount || 10)),
            totalBet: parseFloat(String(totalBetAmount)),
            cutPercentage: parseFloat(String(parsed.housePercentage || 10)),
            profit: parseFloat(String(profit)),
            houseBonus: parseFloat(String(houseCutAmount)),
            winnerInfo: String(winnerInfo),
            status: 'finished',
            date: new Date().toISOString(),
            userId: String(userId),
            username: String(username),
            finalWinAmount: parseFloat(String(playerWin || 0)),
            calledNumbers: Array.isArray(called) ? called : [],
            selectedCartelas: Array.isArray(parsed.selectedCartelas) ? parsed.selectedCartelas : [],
            winnerCartelaIds: Array.isArray(winnerCartelaIds) ? winnerCartelaIds : []
          };

          console.log('📊 Sending game analysis data:', gameAnalysisData);

          // Save to analysis in background (fire and forget)
          if (token) {
            fetch(`${API_BASE_URL}/games/analysis/save`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(gameAnalysisData)
            }).then(response => {
              if (response.ok) {
                console.log('✅ Game data saved successfully to analysis');
              } else {
                console.log('⚠️ Failed to save game data to analysis - status:', response.status);
                // Log the response for debugging
                response.text().then(text => console.log('Response:', text)).catch(() => {});
              }
            }).catch(error => {
              console.log('⚠️ Auto-save error:', error);
            });
          }
        } catch (autoSaveError) {
          console.error('Auto-save preparation error:', autoSaveError);
        }

        console.log('✅ Game finished successfully (local state updated)');

        // Navigate to newgame page after a short delay
        setTimeout(() => {
          console.log('🚀 Navigating to /newgame');
          navigate('/newgame');
        }, 1000); // Small delay to allow user to see the finished state
      }

    } catch (error) {
      console.error('❌ Error in handleFinish:', error);
      // Don't update local state on error
    }
  };

  const handleCreateNewGame = async () => {
    try {
      // If there's a finished game, clear it completely
      if (isGameFinished) {
        console.log('Clearing finished game data and starting fresh');

      // Clear all game-related data from localStorage
      const gameKeys = [
        'currentGame',
        'selectedCards',
        'rememberSelection',
        'gameData',
        'cartelaData',
        'calledNumbers'
      ];

      gameKeys.forEach(key => {
        localStorage.removeItem(key);
      });

        // Reset all game state
        setCalled([]);
        setIsGameFinished(false);
        setInputId("");
        setSelectedCartelas(0);
        setBetAmount(10);
        setTotalBet(0);
        setPlayerWin(0);
        setWinningPatterns([]);
        setCurrentWinningPattern("");
        setShowWinModal(false);

        // Navigate to create new game
        if (onNavigateToLottery) {
          onNavigateToLottery();
        }

        return;
      }

      // If there's an unfinished game, try to cancel it first
      const gameData = localStorage.getItem('currentGame');
      if (gameData && !isGameFinished) {
        const parsed = JSON.parse(gameData);
        const gameId = parsed.gameId;

        if (gameId) {
          const token = localStorage.getItem('auth_token');
          if (token) {
            const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

            try {
              // Cancel the current game before creating a new one
              await fetch(`${API_BASE_URL}/games/${gameId}/cancel`, {
                method: 'PUT',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                }
              });
              console.log('Previous game cancelled successfully');
            } catch (error) {
              console.log('Error cancelling previous game:', error);
              // Continue with creating new game even if cancel fails
            }
          }
        }
      }

      // Clear current game data and reset state
      console.log('Starting new game - clearing current game data');

      // Clear all game-related data from localStorage
      const gameKeys = [
        'currentGame',
        'selectedCards',
        'rememberSelection',
        'gameData',
        'cartelaData',
        'calledNumbers'
      ];

      gameKeys.forEach(key => {
        localStorage.removeItem(key);
      });

      // Reset all game state
      setCalled([]);
      setIsGameFinished(false);
      setInputId("");
      setSelectedCartelas(0);
      setBetAmount(10);
      setTotalBet(0);
      setPlayerWin(0);
      setWinningPatterns([]);
      setCurrentWinningPattern("");
      setShowWinModal(false);

      // Stop auto call if active
      if (autoCallIntervalRef.current) {
        clearInterval(autoCallIntervalRef.current);
        autoCallIntervalRef.current = null;
        setIsAutoCalling(false);
      }
      setAutoCall(false);

      // Navigate to create new game
      if (onNavigateToLottery) {
        onNavigateToLottery();
      }

    } catch (error) {
      console.error('Error creating new game:', error);

      // Even if there's an error, try to reset locally and navigate
      try {
        // Clear game data locally
        const gameKeys = [
          'currentGame',
          'selectedCards',
          'rememberSelection',
          'gameData',
          'cartelaData',
          'calledNumbers'
        ];

        gameKeys.forEach(key => {
          localStorage.removeItem(key);
        });

        // Reset state
        setCalled([]);
        setIsGameFinished(false);
        setInputId("");
        setSelectedCartelas(0);

        if (onNavigateToLottery) {
          onNavigateToLottery();
        }
      } catch (resetError) {
        console.error('Error during fallback reset:', resetError);
        // Last resort - reload the page
        window.location.reload();
      }
    }
  };

  const handleShuffle = async () => {
    if (isShuffling) return; // Prevent multiple rapid clicks

    try {
      setIsShuffling(true);

      // Play shuffle sound effect
      playShuffleSound();

      const token = localStorage.getItem('auth_token');
      const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

      if (!token) {
        console.log('No auth token available for shuffling');
        return;
      }

      // Get current game ID from currentGameData
      const gameId = currentGameData?.id;

      if (!gameId) {
        console.log('No game ID available for shuffling');
        return;
      }

      console.log('🔀 Shuffling game:', gameId);

      // Start shuffle animation on all called numbers
      const calledNumbers = [...called];
      let animationStep = 0;
      const totalSteps = 20; // Animation duration

      const shuffleAnimation = setInterval(() => {
        animationStep++;

        // Animate called numbers by rapidly changing their state
        if (animationStep < totalSteps) {
          // Create a flickering effect by rapidly resetting and restoring called numbers
          if (animationStep % 2 === 0) {
            setCalled([]);
          } else {
            setCalled([...calledNumbers]);
          }
        } else {
          // Animation complete - now call the backend shuffle endpoint
          clearInterval(shuffleAnimation);
        }
      }, 100); // 100ms per step for smooth animation

      // Call shuffle endpoint after animation starts
      const response = await fetch(`${API_BASE_URL}/games/${gameId}/shuffle`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Game shuffled successfully:', result);

        // Update local state with shuffled game data
        setCalled([]); // Reset called numbers
        localStorage.removeItem('calledNumbers'); // Clear from localStorage
        setCurrentGameData(result.game);

        // Sync database values to local state after shuffle
        if (result.game.betMoney !== undefined) {
          setBetAmount(parseFloat(result.game.betMoney) || 10);
        }
        if (result.game.winMoney !== undefined) {
          setPlayerWin(parseFloat(result.game.winMoney) || 0);
        }
        if (result.game.cartelasSelected !== undefined) {
          setSelectedCartelas(parseInt(result.game.cartelasSelected) || 0);
        }

        setShowPopup(false);
        setPopupNumber(null);

        // Reset auto call if it's active
        if (autoCall) {
          setAutoCall(false);
          setIsAutoCalling(false);
          if (autoCallIntervalRef.current) {
            clearInterval(autoCallIntervalRef.current);
            autoCallIntervalRef.current = null;
          }
        }

        // Reset win state
        setWinningPatterns([]);
        setCurrentWinningPattern("");
        setShowWinModal(false);
        setPlayerWin(0);

        setIsShuffling(false);
      } else {
        console.log('Shuffle API failed, status:', response.status);
        // Still reset local state even if API fails
        setCalled([]);
        setShowPopup(false);
        setPopupNumber(null);

        if (autoCall) {
          setAutoCall(false);
          setIsAutoCalling(false);
          if (autoCallIntervalRef.current) {
            clearInterval(autoCallIntervalRef.current);
            autoCallIntervalRef.current = null;
          }
        }

        setIsShuffling(false);
      }
    } catch (error) {
      console.log('Error shuffling game:', error);
      // Reset local state on error
      setCalled([]);
      setShowPopup(false);
      setPopupNumber(null);

      if (autoCall) {
        setAutoCall(false);
        setIsAutoCalling(false);
        if (autoCallIntervalRef.current) {
          clearInterval(autoCallIntervalRef.current);
          autoCallIntervalRef.current = null;
        }
      }

      setIsShuffling(false);
    }
  };

  const playShuffleSound = async () => {
    try {
      // Fetch shuffle sound from API
      const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
      const audio = new Audio(`${API_BASE_URL}/sound/shuffle`);
      audio.volume = 0.7;
      audio.preload = 'auto';

      console.log(`🔄 Playing real shuffle sound`);

      // Wait for the audio to be ready
      await new Promise((resolve) => {
        audio.addEventListener('canplaythrough', resolve, { once: true });
        audio.addEventListener('error', resolve, { once: true });

        // Timeout after 3 seconds
        setTimeout(resolve, 3000);

        // Start loading
        audio.load();
      });

      // Play the sound
      await audio.play();
      console.log(`✅ Playing real shuffle sound`);

    } catch (error) {
      console.log('❌ Could not play shuffle sound:', error instanceof Error ? error.message : String(error));
    }
  };








  // Load game settings from backend on component mount
  useEffect(() => {
    const loadGameSettings = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        if (!token) {
          console.warn('No auth token available for loading settings');
          return;
        }

        const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
        const response = await fetch(`${API_BASE_URL}/settings`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          setDefaultBetAmount(data.betAmount || 10);
          setDefaultHouseCutPercentage(data.houseCutPercentage || 10);
          setBetAmount(data.betAmount || 10);
          setSelectedPattern(data.selectedPattern || 'Two Lines');
          console.log('🎮 Loaded game settings from backend:', data);
          console.log('🎯 Pattern loaded from backend:', data.selectedPattern);
          
          // Also update localStorage for backward compatibility
          const savedSettings = localStorage.getItem('bingo-settings') || '{}';
          const settings = JSON.parse(savedSettings);
          settings.betAmount = data.betAmount;
          settings.houseCutPercentage = data.houseCutPercentage;
          settings.selectedPattern = data.selectedPattern;
          localStorage.setItem('bingo-settings', JSON.stringify(settings));
        } else {
          console.warn('Failed to load settings from backend, using localStorage fallback');
          // Fallback to localStorage
          const savedSettings = localStorage.getItem('bingo-settings');
          if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            setDefaultBetAmount(settings.betAmount || 10);
            setDefaultHouseCutPercentage(settings.houseCutPercentage || 10);
            setBetAmount(settings.betAmount || 10);
            setSelectedPattern(settings.selectedPattern || 'Two Lines');
            console.log('🎯 Pattern loaded from localStorage:', settings.selectedPattern);
          }
        }
      } catch (error) {
        console.error('Error loading game settings:', error);
        // Fallback to localStorage
        const savedSettings = localStorage.getItem('bingo-settings');
        if (savedSettings) {
          try {
            const settings = JSON.parse(savedSettings);
            setDefaultBetAmount(settings.betAmount || 10);
            setDefaultHouseCutPercentage(settings.houseCutPercentage || 10);
            setBetAmount(settings.betAmount || 10);
            setSelectedPattern(settings.selectedPattern || 'Two Lines');
            console.log('🎯 Pattern loaded from localStorage (error fallback):', settings.selectedPattern);
          } catch (e) {
            console.error('Error parsing localStorage settings:', e);
          }
        }
      }
    };

    loadGameSettings();
  }, []);

  // Check cartela by ID using new hook
  const checkCartelaById = useCallback(async (cartelaId: string) => {
    const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

    try {
      console.log('🔍 Checking cartela:', cartelaId);

      // Check localStorage for current game data (this is what gets set by our temporary logic)
      const gameData = localStorage.getItem('currentGame');
      console.log('📊 Current game data from localStorage:', gameData);

      if (!gameData) {
        console.log('❌ No game data in localStorage');
        setCartelaCheckResult({
          isRegistered: false,
          hasWon: false,
          winningPatterns: [],
          winAmount: 0,
          message: "የተመዘገበ ጨዋታ የለም ወይም ካርተላዎች አልተመዘገቡም። እባክዎ አዲስ ጨዋታ ይጀምሩ።"
        });
        setShowCartelaCheckModal(true);
        return;
      }

      const parsedGameData = JSON.parse(gameData);
      const selectedCartelas = parsedGameData.selectedCartelas || [];
      console.log('🎯 Selected cartelas from localStorage:', selectedCartelas);

      // Check if cartelaId is registered in the current game
      const isRegistered = selectedCartelas.includes(cartelaId);
      console.log('✅ Is cartela registered?', isRegistered, '- looking for:', cartelaId, 'in:', selectedCartelas);

      // Only proceed if the cartela is registered - don't check unregistered cartelas
      if (!isRegistered) {
        console.log('❌ Cartela not registered in current game - showing not registered message');
        setCartelaCheckResult({
          isRegistered: false,
          hasWon: false,
          winningPatterns: [],
          winAmount: 0,
          message: "የተመዘገበ ጨዋታ የለም ወይም ካርተላዎች አልተመዘገቡም። እባክዎ አዲስ ጨዋታ ይጀምሩ።"
        });
        setShowCartelaCheckModal(true);
        return;
      }

      // Fetch cartela details only for registered cartelas
      // Pass called numbers as query parameter for winner checking
      console.log('🔍 Cartela is registered - fetching details from API...');
      console.log('🔍 Called numbers to send:', called.length, 'numbers:', called);
      const calledNumbersParam = encodeURIComponent(JSON.stringify(called));
      const apiUrl = `${API_BASE_URL}/cartelas/${cartelaId}?calledNumbers=${calledNumbersParam}`;
      console.log('🔍 API URL:', apiUrl.substring(0, 150) + '...');
      const response = await fetch(apiUrl);
      let foundCartela = null;

      if (response.ok) {
        const cartelaResponse = await response.json();
        foundCartela = cartelaResponse.cartela;
        console.log('🔍 DEBUG: Found cartela in database:', foundCartela);
        console.log('🔍 DEBUG: Winner status from API:', {
          dynamicWinnerStatus: foundCartela.dynamicWinnerStatus,
          win: foundCartela.win,
          patterns: foundCartela.potentialWinningPatterns,
          calledNumbersCount: foundCartela.calledNumbersCount
        });
      } else {
        console.log('❌ API error fetching cartela:', response.status);
        setCartelaCheckResult({
          isRegistered: true,
          hasWon: false,
          winningPatterns: [],
          winAmount: 0,
          cartelaId: cartelaId,
          cartelaNumbers: {},
          calledNumbers: called,
          selectedPattern: selectedPattern,
          message: `የካርተላ መረጃ ለማግኘት ስህተት ተከስቷል። እባክዎ እንደገና ይሞክሩ።`
        });
        setShowCartelaCheckModal(true);
        return;
      }

      console.log('🔍 DEBUG: Called numbers available:', called, 'count:', called.length);

      if (!foundCartela) {
        console.log('❌ Cartela exists in game but not found in database');
        setCartelaCheckResult({
          isRegistered: true,
          hasWon: false,
          winningPatterns: [],
          winAmount: 0,
          cartelaId: cartelaId,
          cartelaNumbers: {},
          calledNumbers: called,
          selectedPattern: selectedPattern,
          message: `ካርተላ ID "${cartelaId}" ተመዝግቧል ነገር ግን በውሂብ ጎታ ለማግኘት ስህተት ተከስቷል።`
        });
        setShowCartelaCheckModal(true);
        return;
      }

      // Use the API response for winner detection (already checked on backend)
      const parsedNumbers = foundCartela.numbers;
      const hasWon = foundCartela.dynamicWinnerStatus || false;
      const winningPatternsFound = foundCartela.potentialWinningPatterns || [];

      console.log('🏆 Winner status from API:', {
        hasWon,
        patterns: winningPatternsFound,
        calledNumbersUsed: foundCartela.calledNumbersCount,
        dynamicWinnerStatus: foundCartela.dynamicWinnerStatus,
        win: foundCartela.win,
        soundType: foundCartela.soundType
      });

      console.log('🏆 Checking if winner:', {
        hasWonCheck: hasWon,
        patternsLengthCheck: winningPatternsFound.length,
        willEnterWinnerBlock: hasWon && winningPatternsFound.length > 0
      });

      if (hasWon && winningPatternsFound.length > 0) {
        console.log(`cartela ${cartelaId} winner`);

        const winAmount = calculateWinAmount(winningPatternsFound.length);

        // Register the winner in the database
        try {
          console.log('🏆 Registering winner in database...');
            const registerResponse = await fetch(`${API_BASE_URL}/cartelas/${cartelaId}/register-winner`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                winningPatterns: winningPatternsFound,
                gameId: currentGameData?.id,
                winAmount: winAmount
              })
            });

          if (registerResponse.ok) {
            console.log('✅ Winner registered successfully in database');
          } else {
            console.warn('⚠️ Failed to register winner in database:', registerResponse.status);
          }
        } catch (registerError) {
          console.warn('⚠️ Error registering winner:', registerError);
        }

        // Play winner sound when user checks and wins
        try {
          await playWinSound("");
          console.log('✅ Winner sound played successfully');
        } catch (soundError) {
          console.warn('⚠️ Winner sound failed to play:', soundError);
        }

        // Create enhanced result with card details and pattern visualization
        const lastCalledNumber = called[called.length - 1];
        const enhancedResult = {
          isRegistered: true,
          hasWon: true,
          winningPatterns: winningPatternsFound,
          winAmount: winAmount,
          cartelaId: cartelaId,
          cartelaNumbers: parsedNumbers,
          calledNumbers: called,
          selectedPattern: selectedPattern,
          winningNumber: lastCalledNumber,
          message: `🎉 አመሰግናለሁ! ካርተላ "${cartelaId}" በ "${winningPatternsFound[0]}" ዘዴ አሸንፏል!\n💰 የማግኛ ገንዘብ: ${winAmount.toFixed(2)} ብር\n🎯 የማግኛ ቁጥር: ${lastCalledNumber}\n✅ ካርተላ እንደ አሸናፊ ተመዝግቧል።`
        };

        setCartelaCheckResult(enhancedResult);
      } else {
        console.log(`not win`);
        // Play not winner sound when user checks and doesn't win
        try {
          await playNotWinnerSoundFile();
          console.log('✅ Not winner sound played successfully');
        } catch (soundError) {
          console.warn('⚠️ Not winner sound failed to play:', soundError);
        }

        // Create result showing current state even when not winning
        const enhancedResult = {
          isRegistered: true,
          hasWon: false,
          winningPatterns: [],
          winAmount: 0,
          cartelaId: cartelaId,
          cartelaNumbers: foundCartela.numbers,
          calledNumbers: called,
          selectedPattern: selectedPattern,
          message: `ካርተላ "${cartelaId}" ተመዝግቧል ነገር ግን ገና አላሸነፈም። ተጨዋታው እስኪጠራ ድረስ ይጠብቁ።`
        };

        setCartelaCheckResult(enhancedResult);
      }

      setShowCartelaCheckModal(true);

    } catch (error) {
      console.error('Error checking cartela:', error);
      setCartelaCheckResult({
        isRegistered: false,
        hasWon: false,
        winningPatterns: [],
        winAmount: 0,
        message: "የካርተላ ፍተሻ ሂደት ላይ ስህተት ተከስቷል። እባክዎ ዳግም ይሞክሩ።"
      });
      setShowCartelaCheckModal(true);
    }
  }, [selectedPattern, called, currentGameData, checkWinner, calculateWinAmount, playWinSound, playNotWinnerSoundFile]);

  // Note: Pattern loading is now handled in the main settings loading useEffect above
  // This prevents duplicate loading and ensures pattern is loaded from backend API

  // Fetch daily profit and check house bonus eligibility
  useEffect(() => {
    const fetchDailyProfit = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        if (!token) return;

        const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
        const response = await fetch(`${API_BASE_URL}/dashboard`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          const dailyProfitValue = parseFloat(data.dailyProfit) || 0;
          setDailyProfit(dailyProfitValue);

          // Check if house bonus was already used today
          const today = new Date().toDateString();
          const lastUsedDate = localStorage.getItem('houseBonusLastUsed');
          const alreadyUsedToday = lastUsedDate === today;

          setHouseBonusUsed(alreadyUsedToday);

          // Show house bonus if profit > 1000 and not used today
          setShowHouseBonus(dailyProfitValue > 1000 && !alreadyUsedToday);

          console.log('💰 Daily profit:', dailyProfitValue, 'House bonus available:', dailyProfitValue > 1000 && !alreadyUsedToday);
        }
      } catch (error) {
        console.error('Error fetching daily profit:', error);
      }
    };

    fetchDailyProfit();
  }, []);



  // Handle win modal sound and auto-close
  useEffect(() => {
    if (showWinModal) {
      const playWinSoundAsync = async () => {
        try {
          console.log('🎵 Playing winner sound for winning pattern:', currentWinningPattern);

          // Call the existing playWinSound function with pattern key
          const patternKey = currentWinningPattern.replace(/\s+/g, '').toLowerCase();
          await playWinSound(patternKey);

          // Reset win data immediately
          setWinningPatterns([]);
          setCurrentWinningPattern("");

          // Auto close after 3 seconds
          setTimeout(() => {
            setShowWinModal(false);
          }, 3000);

        } catch (error) {
          console.log('Could not play win sound for modal:', error instanceof Error ? error.message : String(error));
          // Still close the modal even if sound fails
          setTimeout(() => {
            setShowWinModal(false);
          }, 3000);
        }
      };

      // Play sound and start cleanup
      playWinSoundAsync();
    }
  }, [showWinModal, currentWinningPattern, playWinSound]);

  // Handle house bonus usage
  const handleHouseBonus = () => {
    if (!showHouseBonus || houseBonusUsed) return;

    // Decrease 300 birr from daily profit
    const newDailyProfit = Math.max(0, dailyProfit - 300);
    setDailyProfit(newDailyProfit);

    // Mark as used today
    const today = new Date().toDateString();
    localStorage.setItem('houseBonusLastUsed', today);
    setHouseBonusUsed(true);
    setShowHouseBonus(false);

    // Show confirmation
    alert(`🎉 House Bonus Claimed!\n\n💰 300 Birr bonus added to your account!\n📊 Daily profit reduced by 300 Birr\n\nBonus available again tomorrow.`);

    console.log('🎁 House bonus claimed - 300 birr added, daily profit reduced');
  };

  return (
    <div className="p-2 sm:p-4 lg:p-8 max-w-7xl mx-auto relative" style={{
      marginRight: 'auto',
      marginLeft: 'auto',
      marginTop: '20px',
      marginBottom: '20px',
      paddingLeft: '10px',
      paddingRight: '10px',
      position: 'relative'
    }}>
      {/* Top Bar */}
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        padding: "8px 16px",
        gap: "8px",
        justifyContent: "space-between"
      }}>
        {/* Left section */}
        <div style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "8px",
          minWidth: 0,
          flex: "1 1 auto"
        }}>
          <div style={{
            fontWeight: "bold",
            fontSize: "clamp(24px, 5vw, 48px)",
            color: "#FFD700",
            whiteSpace: "nowrap"
          }}>
            GAME
          </div>
          <div style={{
            fontWeight: "bold",
            fontSize: "clamp(20px, 4vw, 48px)",
            color: "#fff",
            whiteSpace: "nowrap"
          }}>
            {currentGameData?.gameNumber || "1"}
          </div>
        </div>

        {/* Center section - Called Numbers and Game title */}
        <div style={{
          flex: "1 1 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "clamp(8px, 1.5vw, 12px)",
          minWidth: 0
        }}>
          {/* Called Numbers Display in Header - Last 7 numbers */}
          {called.length > 0 && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "clamp(4px, 0.8vw, 6px)",
              flexShrink: 0
            }}>
              {called.slice(-7).map((number, index) => (
                <div
                  key={`${number}-${index}`}
                  style={{
                    background: index === called.slice(-7).length - 1 && showPopup
                      ? "linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FF6B6B 100%)"
                      : "linear-gradient(135deg, #FFD700 0%, #FFA500 100%)",
                    borderRadius: "50%",
                    width: "clamp(40px, 6vw, 60px)",
                    height: "clamp(40px, 6vw, 60px)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "clamp(16px, 3vw, 24px)",
                    fontWeight: "bold",
                    color: "#fff",
                    border: "2px solid #fff",
                    boxShadow: index === called.slice(-7).length - 1 && showPopup
                      ? "0 0 20px rgba(255, 215, 0, 0.8)"
                      : "0 0 10px rgba(255, 215, 0, 0.5)",
                    animation: index === called.slice(-7).length - 1 && showPopup
                      ? "headerBounceIn 0.6s ease-in-out"
                      : "none",
                    textShadow: "1px 1px 2px rgba(0,0,0,0.3)",
                    transition: "all 0.3s ease"
                  }}
                >
                  {number}
                </div>
              ))}
            </div>
          )}

          <div style={{
            fontWeight: "bold",
            fontSize: "clamp(32px, 8vw, 64px)",
            color: "#FFD700",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis"
          }}>
            {(() => {
              const gameData = localStorage.getItem('currentGame');
              if (gameData) {
                try {
                  const parsed = JSON.parse(gameData);
                  return parsed.gameName || "BINGO";
                } catch {
                  return "BINGO";
                }
              }
              return "BINGO";
            })()}
          </div>
        </div>

        {/* Right section */}
        <div style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "4px",
          minWidth: 0,
          flex: "1 1 auto",
          justifyContent: "flex-end"
        }}>
          {/* Sound Selection - Boy Only */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            marginRight: "8px",
            padding: "4px 8px",
            background: "rgba(255, 215, 0, 0.1)",
            borderRadius: 8,
            border: "1px solid rgba(255, 215, 0, 0.3)"
          }}>
            <span style={{
              fontSize: "clamp(10px, 2vw, 14px)",
              color: "#FFD700",
              fontWeight: "bold",
              whiteSpace: "nowrap"
            }}>
              🎵 Boy
            </span>
            <button
              style={{
                ...btnStyle,
                fontSize: "clamp(10px, 2vw, 14px)",
                padding: "2px 6px",
                margin: 0,
                background: "linear-gradient(180deg, #FFD700 0%, #FFA500 100%)",
                color: "#222",
                whiteSpace: "nowrap",
                minWidth: "30px",
                cursor: "default"
              }}
              title="Boy Voice (Active)"
              disabled
            >
              👨
            </button>
          </div>
          <button style={{
            ...btnStyle,
            fontSize: "clamp(12px, 2.5vw, 18px)",
            padding: "4px 8px",
            marginRight: "4px",
            whiteSpace: "nowrap"
          }}>
            {isGameFinished ? "FINISHED" : "STARTED"}
          </button>
          <button style={{
            ...btnStyle,
            fontSize: "clamp(12px, 2.5vw, 18px)",
            padding: "4px 8px",
            marginRight: "4px",
            whiteSpace: "nowrap"
          }}>
            BET {isGameFinished ? totalBet.toFixed(2) : betAmount}
          </button>
          <button style={{
            ...btnStyle,
            fontSize: "clamp(12px, 2.5vw, 18px)",
            padding: "4px 8px",
            marginRight: "4px",
            whiteSpace: "nowrap"
          }}>
            WIN {isGameFinished ? playerWin.toFixed(2) : playerWin.toFixed(2)}
          </button>
          <button style={{
            ...btnStyle,
            fontSize: "clamp(12px, 2.5vw, 18px)",
            padding: "4px 8px",
            marginRight: "4px",
            background: selectedCartelas >= 3
              ? "linear-gradient(180deg, #FFD700 0%, #FFA500 100%)"
              : "linear-gradient(180deg, #FF6B6B 0%, #FF5252 100%)",
            color: selectedCartelas >= 3 ? "#222" : "#fff",
            whiteSpace: "nowrap"
          }}>
            {selectedCartelas} CARTELA{selectedCartelas !== 1 ? 'S' : ''}
          </button>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            marginRight: "4px"
          }}>
            <span style={{
              fontSize: "clamp(12px, 2.5vw, 16px)",
              color: "#FFD700",
              fontWeight: "bold"
            }}>
              🎯
            </span>
            <select
              value={selectedPattern}
              onChange={(e) => handlePatternSelect(e.target.value)}
              style={{
                background: "#333333",
                color: "#fff",
                border: "2px solid #555",
                borderRadius: 8,
                padding: "2px 6px",
                fontSize: "clamp(12px, 2.5vw, 16px)",
                fontWeight: "bold",
                cursor: "pointer",
                whiteSpace: "nowrap",
                minWidth: "120px",
                outline: "none"
              }}
            >
              <option value="One Line">One Line</option>
              <option value="Two Lines">Two Lines</option>
              <option value="Three Lines">Three Lines</option>
              <option value="Full House">Full House</option>
            </select>
          </div>
          <button style={{
            ...btnStyle,
            fontSize: "clamp(12px, 2.5vw, 18px)",
            padding: "4px 8px",
            marginRight: "4px",
            whiteSpace: "nowrap"
          }}>
            {called.length}/75
          </button>
          {called.length > 0 && (
            <div style={{
              background: "rgba(255, 215, 0, 0.2)",
              border: "2px solid #FFD700",
              borderRadius: 8,
              padding: "2px 6px",
              display: "flex",
              alignItems: "center",
              gap: 4,
              whiteSpace: "nowrap"
            }}>
              <span style={{
                fontSize: "clamp(12px, 2vw, 16px)",
                color: "#FFD700"
              }}>
                Last:
              </span>
              <span style={{
                fontSize: "clamp(16px, 3vw, 24px)",
                fontWeight: "bold",
                color: "#FFD700"
              }}>
                {called[called.length - 1]}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Bingo Board */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        marginTop: "clamp(16px, 4vw, 32px)",
        padding: "0 10px"
      }}>
        {/* BINGO letters - responsive */}
        <div style={{
          display: "flex",
          justifyContent: "center",
          gap: "clamp(4px, 1vw, 16px)",
          marginBottom: "clamp(8px, 2vw, 16px)",
          width: "100%",
          maxWidth: "600px"
        }}>
          {["B", "I", "N", "G", "O"].map((l) => (
            <div key={l} style={{
              ...bingoLetterStyle,
              width: "clamp(32px, 8vw, 48px)",
              height: "clamp(32px, 8vw, 48px)",
              fontSize: "clamp(16px, 4vw, 28px)"
            }}>
              {l}
            </div>
          ))}
        </div>

        {/* Numbers grid - responsive */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(15, 1fr)",
          gap: "clamp(3px, 0.8vw, 10px)",
          maxWidth: "700px",
          width: "100%",
          padding: "0 5px"
        }}>
          {numbers.map((num) => {
            // Simple check: if number is called (not FREE space), highlight in gold
            const isLineContributor = called.includes(num);

            return (
              <button
                key={num}
                style={{
                  width: "100%",
                  aspectRatio: "1",
                  maxWidth: "clamp(40px, 7vw, 50px)",
                  maxHeight: "clamp(40px, 7vw, 50px)",
                  background: called.includes(num)
                    ? (showPopup && popupNumber === num
                      ? "#FF6B6B"
                      : isLineContributor
                        ? "#8B4513"  // Dark gold color for line contributors
                        : "#FFD700")
                    : "#c00",
                  color: "#007BFF",
                  border: called.includes(num)
                    ? (isLineContributor ? "2px solid #B8860B" : "2px solid #FFD700")
                    : "2px solid #f00",
                  borderRadius: 8,
                  fontWeight: "bold",
                  fontSize: "clamp(16px, 3vw, 22px)",
                  cursor: "default",
                  transition: "all 0.3s ease",
                  transform: called.includes(num)
                    ? (isLineContributor ? "scale(1.1)" : "scale(1.05)")
                    : "scale(1)",
                  boxShadow: called.includes(num)
                    ? (isLineContributor
                      ? "0 0 20px rgba(139, 69, 19, 0.8)"
                      : "0 0 15px rgba(255, 215, 0, 0.6)")
                    : "0 2px 4px rgba(0,0,0,0.2)",
                  animation: showPopup && popupNumber === num ? "pulse 0.5s ease-in-out" : "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
                onClick={() => handleNumberClick(num)}
                disabled={isGameFinished}
                title={isLineContributor ? "Called number!" : ""}
              >
                {num}
              </button>
            );
          })}
        </div>
      </div>



      {/* Controls */}
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "clamp(6px, 1.5vw, 12px)",
        marginTop: "clamp(8px, 2vw, 16px)",
        marginLeft: "clamp(5px, 2vw, 40px)",
        marginRight: "clamp(5px, 2vw, 10px)",
        justifyContent: "center",
        padding: "0 5px"
      }}>
        {isGameFinished ? (
          <button style={{
            ...btnStyle,
            fontSize: "clamp(14px, 3vw, 18px)",
            padding: "clamp(6px, 1.5vw, 12px) clamp(12px, 3vw, 24px)",
            margin: 0,
            whiteSpace: "nowrap"
          }} onClick={handleCreateNewGame}>
            Create New Game
          </button>
        ) : (
          <>
            <button
              style={{
                ...btnStyle,
                fontSize: "clamp(12px, 2.5vw, 18px)",
                padding: "clamp(4px, 1vw, 8px) clamp(8px, 2vw, 18px)",
                margin: 0,
                background: selectedCartelas >= 3
                  ? (autoCall
                    ? "linear-gradient(180deg, #FF6B6B 0%, #FF5252 100%)"
                    : "linear-gradient(180deg, #FFD700 0%, #FFA500 100%)")
                  : "linear-gradient(180deg, #666 0%, #444 100%)",
                animation: autoCall && selectedCartelas >= 3 ? "autoCallPulse 1s ease-in-out infinite" : "none",
                cursor: selectedCartelas >= 3 ? "pointer" : "not-allowed",
                opacity: selectedCartelas >= 3 ? 1 : 0.5,
                transform: autoCall ? "scale(1.05)" : "scale(1)",
                boxShadow: autoCall
                  ? "0 0 20px rgba(255, 107, 107, 0.6)"
                  : "0 2px 4px rgba(0,0,0,0.4)",
                whiteSpace: "nowrap"
              }}
              onClick={() => {
                selectedCartelas >= 3 && setAutoCall((a) => !a);
              }}
              disabled={selectedCartelas < 3}
            >
              {autoCall ? "🔴 AUTO ON" : "Auto Call OFF"}
            </button>
            <button
              style={{
                ...btnStyle,
                fontSize: "clamp(12px, 2.5vw, 18px)",
                padding: "clamp(4px, 1vw, 8px) clamp(8px, 2vw, 18px)",
                margin: 0,
                background: selectedCartelas >= 3 && !isCallingNumber
                  ? "linear-gradient(180deg, #FFD700 0%, #FFA500 100%)"
                  : "linear-gradient(180deg, #666 0%, #444 100%)",
                cursor: (selectedCartelas >= 3 && !isCallingNumber) ? "pointer" : "not-allowed",
                opacity: selectedCartelas >= 3 && !isCallingNumber ? 1 : 0.5,
                whiteSpace: "nowrap"
              }}
              onClick={() => {
                handleNext();
              }}
              disabled={selectedCartelas < 3 || isCallingNumber}
            >
              {isCallingNumber ? "⏳" : "Next"}
            </button>
            <button
              style={{
                ...btnStyle,
                fontSize: "clamp(12px, 2.5vw, 18px)",
                padding: "clamp(4px, 1vw, 8px) clamp(8px, 2vw, 18px)",
                margin: 0,
                background: selectedCartelas >= 3
                  ? "linear-gradient(180deg, #FFD700 0%, #FFA500 100%)"
                  : "linear-gradient(180deg, #666 0%, #444 100%)",
                cursor: selectedCartelas >= 3 ? "pointer" : "not-allowed",
                opacity: selectedCartelas >= 3 ? 1 : 0.5,
                whiteSpace: "nowrap"
              }}
              onClick={handleFinish}
              disabled={selectedCartelas < 3}
            >
              Finish
            </button>
            <button
              style={{
                ...btnStyle,
                fontSize: "clamp(12px, 2.5vw, 18px)",
                padding: "clamp(4px, 1vw, 8px) clamp(8px, 2vw, 18px)",
                margin: 0,
                background: selectedCartelas >= 3
                  ? (isShuffling
                    ? "linear-gradient(180deg, #FF6B6B 0%, #FF5252 100%)"
                    : "linear-gradient(180deg, #FFD700 0%, #FFA500 100%)")
                  : "linear-gradient(180deg, #666 0%, #444 100%)",
                cursor: selectedCartelas >= 3 ? "pointer" : "not-allowed",
                opacity: selectedCartelas >= 3 ? 1 : 0.5,
                animation: isShuffling ? "shufflePulse 0.5s ease-in-out infinite" : "none",
                transform: isShuffling ? "scale(1.05)" : "scale(1)",
                whiteSpace: "nowrap"
              }}
              onClick={() => {
                handleShuffle();
              }}
              disabled={selectedCartelas < 3 || isShuffling}
            >
              {isShuffling ? "🔀" : "Shuffle"}
            </button>
            {/* Timer slider - 3 to 7 seconds range */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "clamp(4px, 1vw, 8px)",
              opacity: selectedCartelas >= 3 ? 1 : 0.5,
              flexWrap: "wrap",
              minWidth: 0
            }}>
              <span style={{
                fontSize: "clamp(14px, 3vw, 18px)",
                color: "#FFD700",
                fontWeight: "bold",
                whiteSpace: "nowrap"
              }}>
                {slider}s
              </span>
              <input
                type="range"
                min={3}
                max={7}
                value={slider}
                onChange={(e) => setSlider(Number(e.target.value))}
                style={{
                  accentColor: "#FFD700",
                  width: "clamp(60px, 15vw, 80px)",
                  height: "6px",
                  borderRadius: "3px",
                  background: "#FFD700",
                  outline: "none",
                  cursor: selectedCartelas >= 3 ? "pointer" : "not-allowed",
                }}
                disabled={selectedCartelas < 3}
              />
              <span style={{
                fontSize: "clamp(12px, 2.5vw, 14px)",
                color: "#FFD700",
                whiteSpace: "nowrap"
              }}>
                ⏱️ {slider}s
              </span>
            </div>
            {/* Enter ID and Check */}
            <input
              style={{
                ...inputStyle,
                fontSize: "clamp(14px, 3vw, 18px)",
                padding: "clamp(6px, 1.5vw, 12px) clamp(8px, 2vw, 16px)",
                margin: 0,
                opacity: selectedCartelas >= 3 ? 1 : 0.5,
                flex: "1 1 120px",
                minWidth: "100px",
                maxWidth: "200px"
              }}
              placeholder="Enter ID"
              value={inputId}
              onChange={(e) => setInputId(e.target.value)}
              disabled={selectedCartelas < 3}
            />
            <button
              style={{
                ...btnStyle,
                fontSize: "clamp(12px, 2.5vw, 18px)",
                padding: "clamp(4px, 1vw, 8px) clamp(8px, 2vw, 18px)",
                margin: 0,
                background: selectedCartelas >= 3
                  ? "linear-gradient(180deg, #FFD700 0%, #FFA500 100%)"
                  : "linear-gradient(180deg, #666 0%, #444 100%)",
                cursor: selectedCartelas >= 3 ? "pointer" : "not-allowed",
                opacity: selectedCartelas >= 3 ? 1 : 0.5,
                whiteSpace: "nowrap"
              }}
              onClick={() => {
                if (selectedCartelas >= 3 && inputId.trim()) {
                  checkCartelaById(inputId.trim());
                }
              }}
              disabled={selectedCartelas < 3 || !inputId.trim()}
            >
              Check
            </button>
            {/* House Bonus Button */}
            {showHouseBonus && (
              <button
                style={{
                  ...btnStyle,
                  fontSize: "clamp(12px, 2.5vw, 18px)",
                  padding: "clamp(4px, 1vw, 8px) clamp(8px, 2vw, 18px)",
                  margin: 0,
                  background: "linear-gradient(180deg, #FF6B6B 0%, #FF5252 100%)",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  animation: "pulse 1s ease-in-out infinite"
                }}
                onClick={handleHouseBonus}
                title={`Daily Profit: ${dailyProfit.toFixed(2)} Birr - Click to claim 300 Birr bonus!`}
              >
                🎁 HOUSE BONUS (300 Birr)
              </button>
            )}
          </>
        )}
      </div>







      {/* Cartela Check Modal */}
      {showCartelaCheckModal && cartelaCheckResult && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.9)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 2000,
          animation: "fadeIn 0.3s ease-in-out",
        }}>
          <div style={{
            background: cartelaCheckResult.hasWon
              ? "linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FF6B6B 100%)"
              : "linear-gradient(135deg, #666 0%, #444 50%, #222 100%)",
            borderRadius: 10,
            padding: 10,
            textAlign: "center",
            border: "2px solid #fff",
            boxShadow: "0 0 25px rgba(255, 215, 0, 0.6)",
            maxWidth: 307,
            maxHeight: 490,
            width: "54%",
            position: "relative",
            overflow: "hidden",
          }}>
            {/* Close Button - Top Right */}
            <button
              onClick={() => {
                setShowCartelaCheckModal(false);
                setCartelaCheckResult(null);
                setInputId("");
              }}
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                background: "rgba(255, 255, 255, 0.2)",
                color: "#fff",
                border: "2px solid rgba(255, 255, 255, 0.3)",
                borderRadius: "50%",
                width: 32,
                height: 32,
                fontSize: 16,
                fontWeight: "bold",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s ease",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.3)";
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.5)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)";
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.3)";
              }}
            >
              ✕
            </button>

            <h2 style={{
              fontSize: 28,
              fontWeight: "bold",
              color: "#fff",
              marginBottom: 20,
              textShadow: "2px 2px 4px rgba(0,0,0,0.3)",
            }}>
              {cartelaCheckResult.isRegistered
                ? (cartelaCheckResult.hasWon ? "አሸናፊ!" : "እስካሁን አላሸነፈም")
                : "ካርተላ አልተመዘገበም"
              }
            </h2>

            {/* Cartela Card Display */}
            {(() => {
              // Debug logging
              console.log('🎯 DEBUG: cartelaCheckResult.cartelaId:', cartelaCheckResult.cartelaId || 'not set');
              console.log('🎯 DEBUG: cartelaCheckResult.cartelaNumbers:', cartelaCheckResult.cartelaNumbers || 'not set');
              console.log('🎯 DEBUG: cartelaCheckResult.calledNumbers:', cartelaCheckResult.calledNumbers || 'not set');
              console.log('🎯 DEBUG: cartelaCheckResult.isRegistered:', cartelaCheckResult.isRegistered);

              // Convert cartela numbers to grid format for display
              let cartelaGrid: (number | string)[][] = [];
              if (cartelaCheckResult.cartelaNumbers) {
                if (Array.isArray(cartelaCheckResult.cartelaNumbers) && Array.isArray(cartelaCheckResult.cartelaNumbers[0])) {
                  // Already in 2D array format (rows)
                  cartelaGrid = cartelaCheckResult.cartelaNumbers;
                } else if (typeof cartelaCheckResult.cartelaNumbers === 'object' && cartelaCheckResult.cartelaNumbers.B) {
                  // In column format, convert to rows
                  const columns = cartelaCheckResult.cartelaNumbers;
                  for (let row = 0; row < 5; row++) {
                    cartelaGrid[row] = [
                      columns.B?.[row] ?? "?",
                      columns.I?.[row] ?? "?",
                      columns.N?.[row] ?? "?",
                      columns.G?.[row] ?? "?",
                      columns.O?.[row] ?? "?"
                    ];
                  }
                } else {
                  // Fallback: create empty grid
                  cartelaGrid = Array(5).fill(null).map(() => Array(5).fill("?"));
                }
              }

              // Always show cartela display for registered cartelas regardless of conditions
              const shouldShowCartela = cartelaCheckResult.isRegistered === true;
              console.log('🎯 DEBUG: shouldShowCartela:', shouldShowCartela);

              return shouldShowCartela ? (
                <div style={{
                  background: "rgba(255, 255, 255, 0.1)",
                  borderRadius: 12,
                  padding: 20,
                  marginBottom: 30,
                  border: "2px solid rgba(255, 255, 255, 0.2)"
                }}>
                  <h3 style={{
                    fontSize: 20,
                    fontWeight: "bold",
                    color: "#FFD700",
                    marginBottom: 16,
                    textAlign: "center",
                    textShadow: "1px 1px 2px rgba(0,0,0,0.5)"
                  }}>
                    🎯 ካርተላ {cartelaCheckResult.cartelaId} - የእርስዎ ቁጥሮች
                  </h3>

                  {/* BINGO Header */}
                  <div style={{
                    display: "flex",
                    gap: 8,
                    marginBottom: 12,
                    justifyContent: "center"
                  }}>
                    {["B", "I", "N", "G", "O"].map((letter) => (
                      <div key={letter} style={{
                        background: "linear-gradient(180deg, #FFD700 0%, #FFA500 100%)",
                        color: "#222",
                        fontWeight: "bold",
                        fontSize: 16,
                        borderRadius: 6,
                        width: 40,
                        height: 40,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        textShadow: "none",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.3)"
                      }}>
                        {letter}
                      </div>
                    ))}
                  </div>

                  {/* Cartela Numbers Grid */}
                  <div style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    maxWidth: 280,
                    margin: "0 auto"
                  }}>
                    {[0, 1, 2, 3, 4].map((row) => (
                      <div key={row} style={{
                        display: "flex",
                        gap: 6,
                        justifyContent: "center"
                      }}>
                        {[0, 1, 2, 3, 4].map((col) => {
                          const number = cartelaGrid[row]?.[col];
                          const isCenter = row === 2 && col === 2;
                          const isFreeSpace = isCenter || number === "Free" || number === "FREE" || number === 0;
                          const isCalled = (number !== null && number !== "?" && called && called.includes(Number(number))) || isFreeSpace;

                          // For winning cartelas, highlight all called numbers in gold since they're part of the win
                          const isHighlighted = cartelaCheckResult.hasWon && isCalled;

                          return (
                            <div
                              key={`${row}-${col}`}
                              style={{
                                width: 40,
                                height: 40,
                                background: isCalled
                                  ? (isHighlighted ? "#FFD700" : "#FFA500")
                                  : "#333",
                                color: isCalled ? "#222" : "#fff",
                                border: isCalled
                                  ? (isHighlighted ? "2px solid #B8860B" : "2px solid #FFD700")
                                  : "2px solid #555",
                                borderRadius: 6,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: "bold",
                                fontSize: 14,
                                boxShadow: isCalled
                                  ? (isHighlighted
                                    ? "0 0 15px rgba(139, 69, 19, 0.8)"
                                    : "0 0 10px rgba(255, 215, 0, 0.6)")
                                  : "0 2px 4px rgba(0,0,0,0.3)",
                                animation: isCalled ? "calledNumber 0.5s ease-in-out" : "none",
                                textShadow: isCalled ? "none" : "1px 1px 2px rgba(0,0,0,0.5)",
                                transform: isHighlighted ? "scale(1.1)" : "scale(1)"
                              }}
                              title={isHighlighted ? "Contributes to winning pattern!" : ""}
                            >
                              {isFreeSpace ? "FREE" : (number !== "?" ? number : "?")}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>

                  {/* Legend */}
                  <div style={{
                    display: "flex",
                    justifyContent: "center",
                    gap: 20,
                    marginTop: 16,
                    fontSize: 12,
                    color: "#ccc"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <div style={{
                        width: 12,
                        height: 12,
                        background: "#FFA500",
                        border: "1px solid #FFD700",
                        borderRadius: 2
                      }}></div>
                      <span>የተጠሩ ቁጥሮች</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <div style={{
                        width: 12,
                        height: 12,
                        background: "#333",
                        border: "1px solid #555",
                        borderRadius: 2
                      }}></div>
                      <span>ያልተጠሩ ቁጥሮች</span>
                    </div>
                  </div>

                  {/* Pattern Info */}
                  <div style={{
                    marginTop: 16,
                    padding: 12,
                    background: "rgba(255, 255, 255, 0.1)",
                    borderRadius: 8,
                    textAlign: "center"
                  }}>
                    <p style={{
                      fontSize: 14,
                      color: "#FFD700",
                      marginBottom: 4,
                      fontWeight: "bold"
                    }}>
                      🎯 የተመረጠ ዘዴ: {cartelaCheckResult.selectedPattern}
                    </p>
                    <p style={{
                      fontSize: 12,
                      color: "#ccc"
                    }}>
                      የተጠሩ ቁጥሮች: {cartelaCheckResult.calledNumbers ? cartelaCheckResult.calledNumbers.length : 0}/75
                    </p>
                  </div>
                </div>
              ) : null;
            })()}
            {cartelaCheckResult.hasWon && (
              <div style={{
                background: "rgba(255, 255, 255, 0.2)",
                borderRadius: 12,
                padding: 20,
                marginBottom: 30,
              }}>
                <p style={{
                  fontSize: 24,
                  color: "#FFD700",
                  fontWeight: "bold",
                  marginBottom: 10,
                }}>
                  የማግኛ ገንዘብ: {cartelaCheckResult.winAmount.toFixed(2)} ብር
                </p>
                <p style={{
                  fontSize: 16,
                  color: "#fff",
                }}>
                  የማግኛ ዘዴ: {cartelaCheckResult.winningPatterns.join(", ")}
                </p>
              </div>
            )}
            <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
              <button
                onClick={() => {
                  setShowCartelaCheckModal(false);
                  setCartelaCheckResult(null);
                  setInputId("");
                }}
                style={{
                  background: "#fff",
                  color: cartelaCheckResult.hasWon ? "#FFD700" : "#666",
                  border: "none",
                  borderRadius: 12,
                  padding: "12px 30px",
                  fontSize: 18,
                  fontWeight: "bold",
                  cursor: "pointer",
                  boxShadow: "0 4px 8px rgba(0,0,0,0.3)",
                }}
              >
                ዝጋ
              </button>
              {cartelaCheckResult.hasWon && (
                <button
                  onClick={() => {
                    // Navigate to claim winnings or show claim modal
                    alert("የማግኛ ገንዘብ ለመቀበል እባክዎ ተቀባይ ተወካይ ያናግጹ!");
                    setShowCartelaCheckModal(false);
                    setCartelaCheckResult(null);
                    setInputId("");
                  }}
                  style={{
                    background: "#FFD700",
                    color: "#222",
                    border: "none",
                    borderRadius: 12,
                    padding: "12px 30px",
                    fontSize: 18,
                    fontWeight: "bold",
                    cursor: "pointer",
                    boxShadow: "0 4px 8px rgba(0,0,0,0.3)",
                  }}
                >
                  ገንዘብ ተቀበል
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes bounceIn {
          0% {
            transform: scale(0.3) translate3d(0, 0, 0);
            opacity: 0;
          }
          50% {
            opacity: 1;
            transform: scale(1.05);
          }
          70% {
            transform: scale(0.9);
          }
          100% {
            opacity: 1;
            transform: scale(1) translate3d(0, 0, 0);
          }
        }

        @keyframes pulse {
          0% {
            transform: scale(1);
            box-shadow: 0 0 50px rgba(255, 215, 0, 0.8);
          }
          50% {
            transform: scale(1.1);
            boxShadow: "0 0 80px rgba(255, 215, 0, 1)";
          }
          100% {
            transform: scale(1);
            boxShadow: "0 0 50px rgba(255, 215, 0, 0.8)";
          }
        }

        @keyframes slideIn {
          from {
            transform: translateY(-100px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        @keyframes shufflePulse {
          0% {
            transform: scale(1);
            boxShadow: "0 2px 4px rgba(0,0,0,0.4)";
          }
          50% {
            transform: scale(1.1);
            boxShadow: "0 0 20px rgba(255, 107, 107, 0.8)";
          }
          100% {
            transform: scale(1);
            boxShadow: "0 2px 4px rgba(0,0,0,0.4)";
          }
        }

        @keyframes autoCallPulse {
          0% {
            transform: scale(1);
            boxShadow: "0 2px 4px rgba(0,0,0,0.4)";
          }
          50% {
            transform: scale(1.1);
            boxShadow: "0 0 25px rgba(255, 107, 107, 0.9)";
          }
          100% {
            transform: scale(1);
            boxShadow: "0 2px 4px rgba(0,0,0,0.4)";
          }
        }

        @keyframes calledNumber {
          0% {
            transform: scale(1);
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          }
          50% {
            transform: scale(1.1);
            box-shadow: 0 0 15px rgba(255, 215, 0, 0.8);
          }
          100% {
            transform: scale(1);
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          }
        }

        @keyframes headerBounceIn {
          0% {
            transform: scale(0.3);
            opacity: 0;
          }
          50% {
            opacity: 1;
            transform: scale(1.1);
          }
          70% {
            transform: scale(0.95);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes winningLine {
          0% {
            transform: scale(1);
            box-shadow: 0 0 15px rgba(255, 107, 107, 0.9);
          }
          50% {
            transform: scale(1.08);
            box-shadow: 0 0 25px rgba(255, 107, 107, 1);
          }
          100% {
            transform: scale(1);
            box-shadow: 0 0 15px rgba(255, 107, 107, 0.9);
          }
        }
      `}</style>
    </div>
  );
};

const btnStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, #FFD700 0%, #FFA500 100%)",
  color: "#222",
  fontWeight: "bold",
  fontSize: 18,
  border: "none",
  borderRadius: 8,
  padding: "8px 18px",
  marginRight: 8,
  cursor: "pointer",
  boxShadow: "0 2px 4px rgba(0,0,0,0.4)",
  transition: "all 0.2s ease",
};

const inputStyle: React.CSSProperties = {
  background: "rgba(255, 255, 255, 0.9)",
  color: "#222",
  border: "2px solid #FFD700",
  borderRadius: 8,
  padding: "8px 16px",
  fontSize: 16,
  fontWeight: "bold",
  outline: "none",
  boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
  transition: "all 0.2s ease",
};

const bingoLetterStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, #FFD700 0%, #FFA500 100%)",
  color: "#222",
  fontWeight: "bold",
  borderRadius: 8,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 2px 4px rgba(0,0,0,0.4)",
  textShadow: "1px 1px 2px rgba(0,0,0,0.3)",
};

export default GamePage;
