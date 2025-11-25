import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { useNavigate } from "react-router-dom";
import { logGameState } from "../utils/gameDebug";

// Memoize static data outside component to prevent recreation
const BINGO_NUMBERS = Array.from({ length: 75 }, (_, i) => i + 1);
const BINGO_LETTERS = ["B", "I", "N", "G", "O"] as const;

// Memoized NumberGrid component to prevent unnecessary re-renders
const NumberGrid = memo(({ 
  numbers, 
  called, 
  isGameFinished, 
  onNumberClick 
}: {
  numbers: number[];
  called: number[];
  isGameFinished: boolean;
  onNumberClick: (num: number) => void;
}) => {
  // Memoize called numbers set for O(1) lookup
  const calledSet = useMemo(() => new Set(called), [called]);
  
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(15, 1fr)",
      gap: "clamp(3px, 0.8vw, 6px)",
      width: "100%",
      maxWidth: "100%"
    }}>
      {numbers.map((num) => {
        const isCalled = calledSet.has(num);
        
        return (
          <NumberButton
            key={num}
            number={num}
            isCalled={isCalled}
            isGameFinished={isGameFinished}
            onClick={onNumberClick}
          />
        );
      })}
    </div>
  );
});

// Memoized individual number button to prevent unnecessary re-renders
const NumberButton = memo(({ 
  number, 
  isCalled, 
  isGameFinished, 
  onClick 
}: {
  number: number;
  isCalled: boolean;
  isGameFinished: boolean;
  onClick: (num: number) => void;
}) => {
  const buttonStyle = useMemo(() => ({
    width: "100%",
    aspectRatio: "1" as const,
    background: isCalled
      ? "linear-gradient(180deg, #FFD700 0%, #FFA500 100%)"
      : "linear-gradient(180deg, #8B0000 0%, #600000 100%)",
    color: isCalled ? "#000" : "#fff",
    border: isCalled ? "2px solid #FFD700" : "2px solid #400000",
    borderRadius: "clamp(2px, 0.5vw, 4px)",
    fontWeight: "bold" as const,
    fontSize: "clamp(10px, 2vw, 18px)",
    cursor: "default" as const,
    transition: "all 0.2s ease",
    transform: isCalled ? "scale(1.05)" : "scale(1)",
    boxShadow: isCalled
      ? "0 0 15px rgba(255, 215, 0, 0.8)"
      : "0 2px 4px rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "clamp(25px, 4vw, 35px)"
  }), [isCalled]);

  return (
    <button
      style={buttonStyle }
      onClick={() => onClick(number)}
      disabled={isGameFinished}
      title={isCalled ? "Called number!" : ""}
      
    >
      {number}
    </button>
  );
});

// Improved audio manager that prevents sound stacking
class AudioManager {
  private currentAudio: HTMLAudioElement | null = null;
  private failedFiles = new Set<number>();
  private isPlaying = false;

  constructor() {
    console.log('🔊 AudioManager initialized with anti-stacking');
  }

  playSound(number: number): void {
    // Skip if we know this file failed before
    if (this.failedFiles.has(number)) {
      console.warn(`⏭️ Skipping ${number}.wav - known failed file`);
      return;
    }

    // If already playing, stop current sound first
    if (this.isPlaying && this.currentAudio) {
      console.log('🛑 Stopping previous sound to prevent stacking');
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }

    try {
      // Create fresh audio element
      const audio = new Audio();
      audio.volume = 0.7;
      audio.preload = 'auto';
      
      // Use cache busting
      const timestamp = Date.now();
      const audioSrc = `/sounds/${number}.wav?t=${timestamp}`;
      
      // Error handling
      audio.addEventListener('error', () => {
        console.warn(`❌ Audio load failed: ${number}.wav`);
        this.failedFiles.add(number);
        this.isPlaying = false;
        this.currentAudio = null;
      }, { once: true });
      
      // Track when audio starts playing
      audio.addEventListener('play', () => {
        console.log(`▶️ Playing: ${number}.wav`);
        this.isPlaying = true;
      }, { once: true });
      
      // Track when audio ends
      audio.addEventListener('ended', () => {
        console.log(`✅ Finished: ${number}.wav`);
        this.isPlaying = false;
        this.currentAudio = null;
      }, { once: true });
      
      // Set source and play
      audio.src = audioSrc;
      this.currentAudio = audio;
      
      audio.play().catch((error) => {
        console.warn(`🔊 Play error for ${number}.wav:`, error.message);
        this.isPlaying = false;
        this.currentAudio = null;
      });
      
    } catch (error) {
      console.warn(`🔊 Audio error for ${number}.wav:`, error);
      this.failedFiles.add(number);
      this.isPlaying = false;
    }
  }

  // Stop any currently playing sound
  stopCurrent(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
      this.isPlaying = false;
      console.log('🛑 Stopped current audio');
    }
  }

  // Check if audio is currently playing
  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  cleanup(): void {
    this.stopCurrent();
    this.failedFiles.clear();
    console.log('🧹 Audio manager cleaned up');
  }
}

const GamePageOptimized = (): JSX.Element => {
  const navigate = useNavigate();
  const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';


  
  // Core game state
  const [called, setCalled] = useState<number[]>([]);
  const [autoCall, setAutoCall] = useState(false);
  const [slider, setSlider] = useState(() => {
    // Load saved timer value from localStorage, default to 5
    const savedTimer = localStorage.getItem('autoCallTimer');
    return savedTimer ? Number(savedTimer) : 5;
  });
  const [inputId, setInputId] = useState("");
  const [isGameFinished, setIsGameFinished] = useState(false);
  
  // Check for active game on component mount
  useEffect(() => {
    const checkActiveGame = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        
        if (!token) {
          console.log('No auth token, redirecting to play bingo page');
          // Clear called numbers when no auth
          localStorage.removeItem('calledNumbers');
          setCalled([]);
          navigate('/newgame', { replace: true });
          return;
        }

        // Clean up any duplicate numbers in localStorage
        const storedCalled = localStorage.getItem('calledNumbers');
        if (storedCalled) {
          try {
            const parsed = JSON.parse(storedCalled);
            if (Array.isArray(parsed)) {
              const uniqueCalled = [...new Set(parsed)];
              if (uniqueCalled.length !== parsed.length) {
                console.warn(`⚠️ Found ${parsed.length - uniqueCalled.length} duplicate numbers in localStorage, cleaning up`);
                localStorage.setItem('calledNumbers', JSON.stringify(uniqueCalled));
                setCalled(uniqueCalled);
              }
            }
          } catch (e) {
            console.error('Error parsing stored called numbers:', e);
          }
        }

        // First, try to fetch active game from backend
        const response = await fetch(`${API_BASE_URL}/games/active`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const result = await response.json();
          
          if (result.game && ['started', 'active'].includes(result.game.status)) {
            // Active game found in backend
            console.log('Active game found in backend:', result.game);
            
            setCurrentGameData(result.game);
            setSelectedCartelas(result.game.cartelas_selected || 0);
            setBetAmount(parseFloat(result.game.bet_money) || 5);
            setPlayerWin(parseFloat(result.game.win_money) || 0);
            
            // Always clear called numbers on page refresh
            console.log('🔄 Clearing called numbers on page refresh');
            localStorage.removeItem('calledNumbers');
            setCalled([]);
            
            // Update localStorage with backend data
            const gameData = {
              gameId: result.game.id,
              selectedCartelas: result.game.selected_cartelas || [],
              betAmount: parseFloat(result.game.bet_money) || 5,
              playerWin: parseFloat(result.game.win_money) || 0,
              housePercentage: result.game.house_cut_percentage || 25
            };
            localStorage.setItem('currentGame', JSON.stringify(gameData));
            
            return;
          } else {
            // No active game in backend, clear called numbers
            console.log('No active game in backend, clearing called numbers');
            localStorage.removeItem('calledNumbers');
            setCalled([]);
          }
        }
        
        // If no active game in backend, check localStorage as fallback
        const currentGame = localStorage.getItem('currentGame');
        
        if (!currentGame) {
          // No active game found anywhere, clear called numbers and redirect to NewGame
          console.log('No active game found, clearing called numbers and redirecting to play bingo page');
          localStorage.removeItem('calledNumbers');
          setCalled([]);
          navigate('/newgame', { replace: true });
          return;
        }
        
        try {
          const gameData = JSON.parse(currentGame);
          if (!gameData.selectedCartelas || gameData.selectedCartelas.length < 3) {
            // Invalid game data or insufficient cartelas, redirect to NewGame
            console.log('Insufficient cartelas selected (need 3 minimum), redirecting to play bingo page');
            localStorage.removeItem('calledNumbers');
            localStorage.removeItem('currentGame'); // Clear invalid game data
            setCalled([]);
            navigate('/newgame', { replace: true });
            return;
          }
          
          // Valid game found in localStorage, set up the game state
          // But clear called numbers since we're starting fresh
          console.log('Starting fresh game, clearing called numbers');
          localStorage.removeItem('calledNumbers');
          setCalled([]);
          setSelectedCartelas(gameData.selectedCartelas.length);
          setBetAmount(gameData.betAmount || 5);
          setPlayerWin(gameData.playerWin || 0);
          
        } catch (error) {
          console.error('Error parsing current game data:', error);
          localStorage.removeItem('calledNumbers');
          setCalled([]);
          navigate('/newgame', { replace: true });
        }
        
      } catch (error) {
        console.error('Error checking active game:', error);
        // On error, fall back to localStorage check
        const currentGame = localStorage.getItem('currentGame');
        if (!currentGame) {
          localStorage.removeItem('calledNumbers');
          setCalled([]);
          navigate('/newgame', { replace: true });
        }
      }
    };
    
    checkActiveGame();
  }, [navigate, API_BASE_URL]);
  
  // Load selected pattern from settings
  useEffect(() => {
    const loadPattern = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        if (!token) return;

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
          
          // Pattern is sent with each winner check request, no need to update game database
          console.log('🎮 Pattern loaded and will be used for winner checks:', pattern);
        }
      } catch (error) {
        console.error('Error loading pattern from settings:', error);
      }
    };

    loadPattern();

    // Also reload pattern when window gains focus or becomes visible (user returns from settings)
    const handleFocus = () => {
      console.log('🔄 Window focused - reloading pattern from settings...');
      loadPattern();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('🔄 Page became visible - reloading pattern from settings...');
        loadPattern();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [API_BASE_URL]);
  
  // Game configuration
  const [selectedCartelas, setSelectedCartelas] = useState(0);
  const [betAmount, setBetAmount] = useState(5);
  const [playerWin, setPlayerWin] = useState(0);
  const [selectedPattern, setSelectedPattern] = useState<string>("Two Lines");
  
  // UI state
  const [isCallingNumber, setIsCallingNumber] = useState(false);
  
  // Modal state
  const [cartelaCheckResult, setCartelaCheckResult] = useState<{
    success: boolean;
    cartelaId: string;
    gameId: string;
    win: boolean;
    cardType: string;
    soundType: string;
    winningPatterns: string[];
    calledNumbersCount: number;
    message: string;
    cartela?: any;
  } | null>(null);
  const [showCartelaCheckModal, setShowCartelaCheckModal] = useState<boolean>(false);
  const [checkingCartela, setCheckingCartela] = useState<boolean>(false);
  
  // Game data
  const [currentGameData, setCurrentGameData] = useState<any>(null);
  
  // Safety mechanism to reset isCallingNumber if it gets stuck
  useEffect(() => {
    if (isCallingNumber) {
      const resetTimer = setTimeout(() => {
        console.warn('⚠️ Resetting stuck isCallingNumber state');
        logGameState({
          autoCall,
          isCallingNumber,
          isGameFinished,
          selectedCartelas,
          calledCount: called.length,
          gameId: currentGameData?.id
        });
        setIsCallingNumber(false);
        setAutoCall(false); // Also stop auto-call to prevent further issues
      }, 15000); // Reset after 15 seconds if stuck
      
      return () => clearTimeout(resetTimer);
    }
  }, [isCallingNumber, autoCall, isGameFinished, selectedCartelas, called.length, currentGameData?.id]);

  // Debug logging for state changes
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      logGameState({
        autoCall,
        isCallingNumber,
        isGameFinished,
        selectedCartelas,
        calledCount: called.length,
        gameId: currentGameData?.id
      });
    }
  }, [autoCall, isCallingNumber, isGameFinished]);
  
  // Refs
  const autoCallIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioManagerRef = useRef<AudioManager | null>(null);
  const gameFetchIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Initialize audio manager with LOCAL sounds
  useEffect(() => {
    audioManagerRef.current = new AudioManager();
    
    // Expose debug methods to window for debugging
    if (process.env.NODE_ENV === 'development') {
      (window as any).testAudio = (num: number) => {
        console.log(`🧪 Testing audio ${num}...`);
        audioManagerRef.current?.playSound(num);
      };
      
      (window as any).testAudioMultiple = (nums: number[]) => {
        console.log(`🧪 Testing multiple audio files...`);
        nums.forEach((num, index) => {
          setTimeout(() => {
            console.log(`🔊 Playing ${num}...`);
            audioManagerRef.current?.playSound(num);
          }, index * 1000);
        });
      };
    }
    
    return () => {
      audioManagerRef.current?.cleanup();
      if (process.env.NODE_ENV === 'development') {
        delete (window as any).testAudio;
        delete (window as any).testAudioMultiple;
      }
    };
  }, []);

  // Minimal polling to reduce system load
  useEffect(() => {
    if (!selectedCartelas || selectedCartelas < 3 || isGameFinished) {
      return;
    }

    // Poll every 5 minutes to minimize system load
    const intervalId = setInterval(async () => {
      // Only poll if document is visible and game is active
      if (document.hidden || isGameFinished) return;
      
      try {
        const token = localStorage.getItem('auth_token');
        if (!token) return;

        const response = await fetch(`${API_BASE_URL}/games/active`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const result = await response.json();
          setCurrentGameData(result.game);
        }
      } catch (error) {
        // Silent fail
      }
    }, 300000); // 5 minutes to reduce system load

    gameFetchIntervalRef.current = intervalId;

    return () => {
      if (gameFetchIntervalRef.current) {
        clearInterval(gameFetchIntervalRef.current);
      }
    };
  }, [selectedCartelas, isGameFinished, API_BASE_URL]);

  // Optimized auto-call with better error handling
  useEffect(() => {
    // Always clear existing interval first
    if (autoCallIntervalRef.current) {
      clearInterval(autoCallIntervalRef.current);
      autoCallIntervalRef.current = null;
    }

    if (autoCall && !isGameFinished && selectedCartelas >= 3 && !isCallingNumber) {
      autoCallIntervalRef.current = setInterval(async () => {
        // Skip if document is hidden or already calling a number
        if (document.hidden || isCallingNumber) return;
        
        // Set calling state to prevent concurrent calls
        setIsCallingNumber(true);
        
        try {
          const token = localStorage.getItem('auth_token');
          const gameData = localStorage.getItem('currentGame');
          
          if (!token || !gameData) {
            setAutoCall(false);
            return;
          }
          
          const parsed = JSON.parse(gameData);
          const gameId = currentGameData?.id || parsed.gameId;
          
          if (!gameId) {
            setAutoCall(false);
            return;
          }

          // Add timeout to prevent hanging requests
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

          const response = await fetch(`${API_BASE_URL}/games/${gameId}/call-number`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ calledNumbers: called }),
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            const result = await response.json();
            
            if (result.gameCompleted) {
              setAutoCall(false);
              return;
            }

            const calledNumber = result.calledNumber;
            if (calledNumber) {
              // Play sound first
              audioManagerRef.current?.playSound(calledNumber);
              
              // Show popup after 1 second delay
              setTimeout(() => {
                setCalled(prev => {
                  // Prevent duplicates by checking if number already exists
                  if (prev.includes(calledNumber)) {
                    console.warn(`⚠️ Number ${calledNumber} already called, skipping duplicate`);
                    return prev;
                  }
                  const newCalled = [...prev, calledNumber];
                  localStorage.setItem('calledNumbers', JSON.stringify(newCalled));
                  return newCalled;
                });
              }, 1000);
            }
          } else if (response.status === 400 || response.status === 429) {
            console.log('Auto-call stopped due to API response:', response.status);
            setAutoCall(false);
          } else {
            console.warn('Auto-call API error:', response.status);
            // Don't stop auto-call for temporary server errors
          }
        } catch (error) {
          console.error('Auto-call error:', error);
          if (error instanceof Error && error.name === 'AbortError') {
            console.log('Auto-call request timed out');
          }
          // Don't stop auto-call for network errors, just log them
        } finally {
          // Always reset calling state
          setIsCallingNumber(false);
        }
      }, slider * 1000);
    }

    return () => {
      if (autoCallIntervalRef.current) {
        clearInterval(autoCallIntervalRef.current);
        autoCallIntervalRef.current = null;
      }
    };
  }, [autoCall, slider, isGameFinished, selectedCartelas, called, currentGameData, API_BASE_URL, isCallingNumber]);

  // Memoized handlers
  const handleNumberClick = useCallback((_num: number) => {
    // Numbers can only be called via Next button or Auto Call
  }, []);

  const handleNext = useCallback(async () => {
    if (isGameFinished || selectedCartelas < 3 || isCallingNumber) return;

    setIsCallingNumber(true);
    
    try {
      const token = localStorage.getItem('auth_token');
      const gameData = localStorage.getItem('currentGame');
      
      if (!gameData || !token) {
        console.error('Missing token or game data');
        return;
      }
      
      const parsed = JSON.parse(gameData);
      const gameId = currentGameData?.id || parsed.gameId;
      
      if (!gameId) {
        console.error('Missing game ID');
        return;
      }

      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(`${API_BASE_URL}/games/${gameId}/call-number`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ calledNumbers: called }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const result = await response.json();
        
        if (result.gameCompleted) {
          setAutoCall(false);
          // Remove duplicates from game calledNumbers before setting
          const gameCalledNumbers = (result.game.calledNumbers || called) as number[];
          const uniqueCalledNumbers = [...new Set(gameCalledNumbers)];
          if (uniqueCalledNumbers.length !== gameCalledNumbers.length) {
            console.warn(`⚠️ Removed ${gameCalledNumbers.length - uniqueCalledNumbers.length} duplicates from completed game`);
          }
          setCalled(uniqueCalledNumbers);
          return;
        }

        const calledNumber = result.calledNumber;
        if (calledNumber) {
          // Play sound first
          audioManagerRef.current?.playSound(calledNumber);
          
          // Show popup after 1 second delay
          setTimeout(() => {
            setCalled(prev => {
              // Prevent duplicates by checking if number already exists
              if (prev.includes(calledNumber)) {
                console.warn(`⚠️ Number ${calledNumber} already called, skipping duplicate`);
                return prev;
              }
              const newCalled = [...prev, calledNumber];
              localStorage.setItem('calledNumbers', JSON.stringify(newCalled));
              return newCalled;
            });
          }, 1000);
        }
      } else {
        console.error('API error:', response.status);
        if (response.status === 400) {
          const errorData = await response.json();
          console.error('Error details:', errorData);
        }
      }
    } catch (error) {
      console.error('Manual next error:', error);
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Manual next request timed out');
      }
    } finally {
      setIsCallingNumber(false);
    }
  }, [isGameFinished, selectedCartelas, isCallingNumber, called, currentGameData, API_BASE_URL]);

  const handleShuffle = useCallback(() => {
    // Play shuffle sound from LOCAL file without blocking
    const schedulePlay = (window as any).requestIdleCallback || requestAnimationFrame;
    schedulePlay(() => {
      try {
        const shuffleAudio = new Audio('/sounds/shuffle-audio-TfqyAnvz.mp3');
        shuffleAudio.volume = 0.7;
        shuffleAudio.play().catch(() => {});
      } catch (error) {
        // Silent fail
      }
    });
    
    // Reload page after 6 seconds
    setTimeout(() => {
      window.location.reload();
    }, 6000);
  }, []);

  const handleFinish = useCallback(async () => {
    setIsGameFinished(true);
    setAutoCall(false);
    
    try {
      const token = localStorage.getItem('auth_token');
      const gameData = localStorage.getItem('currentGame');
      
      if (token && gameData) {
        const parsed = JSON.parse(gameData);
        const gameId = currentGameData?.id || parsed.gameId;
        
        if (gameId) {
          // Finish the game session in backend
          const response = await fetch(`${API_BASE_URL}/games/${gameId}/finish-session`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              winMoney: playerWin || 0
            })
          });

          if (response.ok) {
            console.log('✅ Game finished successfully');
            
            // Refresh daily profit calculation for house bonus (optional)
            try {
              const bonusResponse = await fetch(`${API_BASE_URL}/bonuses/refresh-profit`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                }
              });
              
              if (bonusResponse.ok) {
                console.log('✅ Daily profit refreshed for house bonus');
              } else {
                console.warn('⚠️ Bonus system not available (status:', bonusResponse.status, ')');
              }
            } catch (bonusError) {
              console.warn('⚠️ Bonus system not available:', bonusError instanceof Error ? bonusError.message : 'Unknown error');
              // Don't block game completion if bonus system is unavailable
            }
          } else {
            console.error('Failed to finish game in backend');
          }
        }
      }
    } catch (error) {
      console.error('Error finishing game:', error);
    }
    
    // Clean up localStorage
    localStorage.removeItem('currentGame');
    localStorage.removeItem('calledNumbers');
    
    // Navigate immediately to new game page
    navigate('/newgame', { replace: true });
  }, [navigate, currentGameData, playerWin, selectedCartelas, betAmount, API_BASE_URL]);

  const handleCheckCartela = useCallback(async () => {
    if (!inputId.trim()) {
      return;
    }

    setCheckingCartela(true);
    
    try {
      const token = localStorage.getItem('auth_token');
      const gameData = localStorage.getItem('currentGame');
      
      if (!gameData || !token) {
        setCheckingCartela(false);
        return;
      }
      
      const parsed = JSON.parse(gameData);
      const gameId = currentGameData?.id || parsed.gameId;
      
      if (!gameId) {
        setCheckingCartela(false);
        return;
      }

      // Get selected cartelas from current game data or fetch from backend
      let selectedCartelas: string[] = [];
      
      // First try from currentGameData
      if (currentGameData && currentGameData.selected_cartelas) {
        selectedCartelas = typeof currentGameData.selected_cartelas === 'string' 
          ? JSON.parse(currentGameData.selected_cartelas)
          : currentGameData.selected_cartelas;
      } else {
        // Fallback: fetch from backend
        try {
          const gameResponse = await fetch(`${API_BASE_URL}/games/${gameId}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (gameResponse.ok) {
            const gameInfo = await gameResponse.json();
            // Parse selected_cartelas from database
            if (gameInfo.game && gameInfo.game.selected_cartelas) {
              selectedCartelas = typeof gameInfo.game.selected_cartelas === 'string' 
                ? JSON.parse(gameInfo.game.selected_cartelas)
                : gameInfo.game.selected_cartelas;
            }
          }
        } catch (error) {
          console.error('Error fetching game data:', error);
        }
      }
      
      console.log('🎯 Selected cartelas for this game:', selectedCartelas);
      console.log('🔍 Checking cartela:', inputId.trim());
      
      // Check if cartela is in selected cartelas
      const isSelected = selectedCartelas.includes(inputId.trim());
      
      if (!isSelected) {
        // Show not registered message
        setCartelaCheckResult({
          success: false,
          cartelaId: inputId.trim(),
          gameId: gameId,
          win: false,
          cardType: 'notregistered',
          soundType: 'notwinner',
          winningPatterns: [],
          calledNumbersCount: called.length,
          message: `Cartela ${inputId.trim()} is not registered for this game. Please select it in the New Game page first.`
        });
        setShowCartelaCheckModal(true);
        
        // Play notwinner sound from LOCAL file without blocking
        const schedulePlay = (window as any).requestIdleCallback || requestAnimationFrame;
        schedulePlay(() => {
          try {
            const audio = new Audio('/sounds/notwinner.wav');
            audio.volume = 0.7;
            audio.play().catch(() => {});
          } catch (error) {
            // Silent fail
          }
        });
        
        setCheckingCartela(false);
        return;
      }

      // Get called numbers from localStorage or state
      let calledNumbersToSend = called;
      if (calledNumbersToSend.length === 0) {
        const storedCalled = localStorage.getItem('calledNumbers');
        if (storedCalled) {
          try {
            calledNumbersToSend = JSON.parse(storedCalled);
            console.log(`📥 Loaded ${calledNumbersToSend.length} called numbers from localStorage`);
          } catch (e) {
            console.error('Error parsing stored called numbers:', e);
          }
        }
      }

      console.log(`🎯 Checking cartela ${inputId.trim()} with ${calledNumbersToSend.length} called numbers`);
      console.log(`🎮 Game ID:`, gameId);
      console.log(`📋 Selected pattern:`, selectedPattern);

      const requestBody = {
        cartelaId: inputId.trim(),
        gameId: gameId,
        patterns: [selectedPattern],
        calledNumbers: calledNumbersToSend
      };
      
      console.log('📤 Sending request:', requestBody);

      const response = await fetch(`${API_BASE_URL}/winner-check`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      console.log('📥 Response status:', response.status);

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Winner check result:', result);
        console.log('📦 Cartela in result:', result.cartela);
        console.log('🔢 Numbers in cartela:', result.cartela?.numbers);
        console.log('🔢 Numbers type:', typeof result.cartela?.numbers);
        console.log('🔢 Is array?:', Array.isArray(result.cartela?.numbers));
        
        // The backend should already include cartela data
        // If it's missing or malformed, show the result anyway
        if (!result.cartela || !result.cartela.numbers) {
          console.warn('⚠️ Cartela data missing or incomplete in response');
        } else if (result.cartela.numbers) {
          // Check if numbers is a 2D array, if not, try to parse/convert it
          if (typeof result.cartela.numbers === 'string') {
            try {
              result.cartela.numbers = JSON.parse(result.cartela.numbers);
              console.log('✅ Parsed numbers from string:', result.cartela.numbers);
            } catch (e) {
              console.error('❌ Failed to parse numbers string:', e);
            }
          }
          
          // If numbers is an object (like {B: [...], I: [...], N: [...], G: [...], O: [...]}), convert to 2D array
          if (result.cartela.numbers && typeof result.cartela.numbers === 'object' && !Array.isArray(result.cartela.numbers)) {
            console.log('🔄 Converting numbers object to 2D array');
            const numbersObj = result.cartela.numbers as any;
            
            // Check if it has BINGO keys
            if (numbersObj.B && numbersObj.I && numbersObj.N && numbersObj.G && numbersObj.O) {
              result.cartela.numbers = [
                numbersObj.B,
                numbersObj.I,
                numbersObj.N,
                numbersObj.G,
                numbersObj.O
              ];
              console.log('✅ Converted to 2D array:', result.cartela.numbers);
            } else {
              console.error('❌ Numbers object does not have BINGO keys:', numbersObj);
            }
          }
          
          // Verify it's a 2D array
          if (Array.isArray(result.cartela.numbers)) {
            if (result.cartela.numbers.length > 0 && !Array.isArray(result.cartela.numbers[0])) {
              console.warn('⚠️ Numbers is not a 2D array, it might be flat');
            } else {
              console.log('✅ Numbers is a valid 2D array with', result.cartela.numbers.length, 'columns');
            }
          }
        }
        
        setCartelaCheckResult(result);
        setShowCartelaCheckModal(true);
        
        // Play sound based on result from LOCAL files without blocking
        const schedulePlay = (window as any).requestIdleCallback || requestAnimationFrame;
        schedulePlay(() => {
          try {
            const soundUrl = result.win 
              ? '/sounds/winner.wav'
              : '/sounds/notwinner.wav';
            const audio = new Audio(soundUrl);
            audio.volume = 0.7;
            audio.play().catch(() => {});
          } catch (error) {
            // Silent fail
          }
        });
      } else {
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          errorData = { message: await response.text() };
        }
        console.error('❌ Winner check error response:', errorData);
        console.error('❌ Status:', response.status);
        
        // Show error in modal instead of alert
        setCartelaCheckResult({
          success: false,
          cartelaId: inputId.trim(),
          gameId: gameId,
          win: false,
          cardType: 'error',
          soundType: 'notwinner',
          winningPatterns: [],
          calledNumbersCount: called.length,
          message: errorData.message || errorData.errors?.[0]?.msg || `Error checking cartela (Status: ${response.status})`
        });
        setShowCartelaCheckModal(true);
      }
    } catch (error) {
      console.error('Error checking cartela:', error);
      // Show error in modal instead of alert
      setCartelaCheckResult({
        success: false,
        cartelaId: inputId.trim(),
        gameId: '',
        win: false,
        cardType: 'error',
        soundType: 'notwinner',
        winningPatterns: [],
        calledNumbersCount: called.length,
        message: 'Failed to check cartela. Please try again.'
      });
      setShowCartelaCheckModal(true);
    } finally {
      setCheckingCartela(false);
    }
  }, [inputId, selectedPattern, currentGameData, called, API_BASE_URL]);

  // Memoized styles
  const btnStyle = useMemo(() => ({
    background: "linear-gradient(180deg, #FFA500 0%, #FF8C00 100%)",
    color: "#000",
    fontWeight: "bold" as const,
    fontSize: 18,
    border: "none",
    borderRadius: 8,
    padding: "8px 18px",
    marginRight: 8,
    cursor: "pointer" as const,
    boxShadow: "0 2px 4px rgba(0,0,0,0.5)",
    transition: "all 0.2s ease",
  }), []);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0F172A",
      color: "#fff",
      padding: "clamp(10px, 3vw, 50px) clamp(10px, 4vw, 60px)",
      paddingRight: "clamp(10px, 6vw, 100px)",
      boxSizing: "border-box"
    }}>
      {/* Last 5 Called Numbers - Golden Balls */}
      {called.length > 0 && (
        <div style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "clamp(8px, 2vw, 25px)",
          marginBottom: "clamp(15px, 3vw, 25px)",
          padding: "clamp(10px, 2vw, 15px)",
          flexWrap: "wrap"
        }}>
          {called.slice(-5).reverse().map((num, index) => (
            <div
              key={`${num}-${index}`}
              style={{
                width: "clamp(50px, 12vw, 90px)",
                height: "clamp(50px, 12vw, 90px)",
                borderRadius: "50%",
                background: index === 0 
                  ? "radial-gradient(circle at 30% 30%, #FFD700, #FFA500, #FF8C00)"
                  : "radial-gradient(circle at 30% 30%, #FFA500, #FF8C00, #CC6600)",
                color: "#000",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "bold",
                fontSize: "clamp(20px, 5vw, 36px)",
                boxShadow: index === 0 
                  ? "0 8px 20px rgba(255, 215, 0, 0.6), inset 0 -3px 8px rgba(0,0,0,0.3), inset 0 3px 8px rgba(255,255,255,0.4)"
                  : "0 6px 15px rgba(255, 140, 0, 0.4), inset 0 -3px 8px rgba(0,0,0,0.3), inset 0 3px 8px rgba(255,255,255,0.3)",
                border: index === 0 ? "3px solid #FFD700" : "2px solid #FFA500",
                animation: index === 0 ? "bounce 1.5s ease-in-out infinite" : "none",
                position: "relative" as const,
                transform: index === 0 ? "scale(1.1)" : "scale(1)",
                flexShrink: 0
              }}
            >
              <div style={{
                textShadow: "1px 1px 2px rgba(0,0,0,0.3)"
              }}>
                {num}
              </div>
            </div>
          ))}
        </div>
      )}

      <style>
        {`
          @keyframes bounce {
            0%, 100% {
              transform: scale(1.1) translateY(0);
            }
            50% {
              transform: scale(1.1) translateY(-8px);
            }
          }
          
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          
          @keyframes bounceIn {
            0% {
              transform: scale(0.3);
              opacity: 0;
            }
            50% {
              transform: scale(1.05);
            }
            70% {
              transform: scale(0.9);
            }
            100% {
              transform: scale(1);
              opacity: 1;
            }
          }
        `}
      </style>

      {/* Header */}
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "clamp(6px, 1.5vw, 10px)",
        marginBottom: "clamp(15px, 3vw, 20px)"
      }}>
        <div style={{
          fontSize: "clamp(24px, 6vw, 48px)",
          fontWeight: "bold",
          color: "#FFA500",
          marginRight: "clamp(5px, 1.5vw, 10px)",
          width: "100%"
        }}>
          GAME <span style={{ color: "#FFD700" }}>{currentGameData?.game_number || "169"}</span>
        </div>
        <div style={{
          background: "#FFD700",
          color: "#000",
          padding: "clamp(6px, 1.5vw, 8px) clamp(10px, 2.5vw, 16px)",
          borderRadius: 8,
          fontWeight: "bold",
          fontSize: "clamp(11px, 2.5vw, 14px)",
          whiteSpace: "nowrap"
        }}>
          GAME STARTED
        </div>
        <div style={{
          background: "#FFA500",
          color: "#000",
          padding: "clamp(6px, 1.5vw, 8px) clamp(10px, 2.5vw, 16px)",
          borderRadius: 8,
          fontWeight: "bold",
          fontSize: "clamp(11px, 2.5vw, 14px)",
          whiteSpace: "nowrap"
        }}>
          BET {betAmount} BIRR
        </div>
        <div style={{
          background: "#90EE90",
          color: "#000",
          padding: "clamp(6px, 1.5vw, 8px) clamp(10px, 2.5vw, 16px)",
          borderRadius: 8,
          fontWeight: "bold",
          fontSize: "clamp(11px, 2.5vw, 14px)",
          whiteSpace: "nowrap"
        }}>
          WIN {playerWin.toFixed(1)} BIRR
        </div>
        <div style={{
          background: "#FFD700",
          color: "#000",
          padding: "clamp(6px, 1.5vw, 8px) clamp(10px, 2.5vw, 16px)",
          borderRadius: 8,
          fontWeight: "bold",
          fontSize: "clamp(11px, 2.5vw, 14px)",
          whiteSpace: "nowrap"
        }}>
          {selectedCartelas} CARTELA
        </div>
        <div style={{
          background: "#333",
          color: "#FFD700",
          padding: "clamp(6px, 1.5vw, 8px) clamp(10px, 2.5vw, 16px)",
          borderRadius: 8,
          fontWeight: "bold",
          fontSize: "clamp(11px, 2.5vw, 14px)",
          whiteSpace: "nowrap"
        }}>
          {called.length}/75
        </div>
      </div>



      <div style={{
        display: "flex",
        gap: "clamp(8px, 2vw, 20px)",
        flexWrap: "nowrap",
        width: "100%",
        maxWidth: "100%"
      }}>
        {/* Left side - BINGO letters */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "clamp(4px, 1vw, 8px)",
          flexShrink: 0
        }}>
          {BINGO_LETTERS.map((letter) => (
            <div key={letter} style={{
              background: "linear-gradient(180deg, #FFA500 0%, #FF8C00 100%)",
              color: "#000",
              fontWeight: "bold",
              borderRadius: "clamp(4px, 1vw, 8px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "clamp(30px, 6vw, 50px)",
              height: "clamp(30px, 6vw, 50px)",
              fontSize: "clamp(14px, 3vw, 24px)",
              boxShadow: "0 2px 4px rgba(0,0,0,0.5)"
            }}>
              {letter}
            </div>
          ))}
        </div>

        {/* Center - Numbers grid */}
        <div style={{
          flex: 1,
          width: "100%",
          minWidth: 0
        }}>
          <NumberGrid 
            numbers={BINGO_NUMBERS}
            called={called}
            isGameFinished={isGameFinished}
            onNumberClick={handleNumberClick}
          />
        </div>
      </div>

      {/* Controls */}
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "clamp(6px, 1.5vw, 10px)",
        marginTop: "clamp(15px, 3vw, 20px)",
        marginLeft: "clamp(0px, 8vw, 70px)"
      }}>
        {!isGameFinished && (
          <>
            <button
              style={{
                ...btnStyle,
                fontSize: "clamp(12px, 2.5vw, 16px)",
                padding: "clamp(8px, 2vw, 12px) clamp(12px, 3vw, 24px)",
                margin: 0,
                background: selectedCartelas >= 3
                  ? (autoCall
                    ? "linear-gradient(180deg, #FF6B6B 0%, #FF5252 100%)"
                    : "linear-gradient(180deg, #FFA500 0%, #FF8C00 100%)")
                  : "linear-gradient(180deg, #666 0%, #444 100%)",
                cursor: selectedCartelas >= 3 ? "pointer" : "not-allowed",
                opacity: selectedCartelas >= 3 ? 1 : 0.5,
                whiteSpace: "nowrap" as const
              }}
              onClick={() => selectedCartelas >= 3 && setAutoCall(a => !a)}
              disabled={selectedCartelas < 3}
            >
              {autoCall ? "Auto On" : "Auto Off"}
            </button>
            <button
              style={{
                ...btnStyle,
                fontSize: "clamp(12px, 2.5vw, 16px)",
                padding: "clamp(8px, 2vw, 12px) clamp(12px, 3vw, 24px)",
                margin: 0,
                background: selectedCartelas >= 3 && !isCallingNumber
                  ? "linear-gradient(180deg, #FFA500 0%, #FF8C00 100%)"
                  : "linear-gradient(180deg, #666 0%, #444 100%)",
                cursor: (selectedCartelas >= 3 && !isCallingNumber) ? "pointer" : "not-allowed",
                opacity: selectedCartelas >= 3 && !isCallingNumber ? 1 : 0.5,
                whiteSpace: "nowrap" as const
              }}
              onClick={handleNext}
              disabled={selectedCartelas < 3 || isCallingNumber}
            >
              {isCallingNumber ? "⏳" : "Next"}
            </button>
            <button
              style={{
                ...btnStyle,
                fontSize: "clamp(12px, 2.5vw, 16px)",
                padding: "clamp(8px, 2vw, 12px) clamp(12px, 3vw, 24px)",
                margin: 0,
                background: selectedCartelas >= 3
                  ? "linear-gradient(180deg, #FFA500 0%, #FF8C00 100%)"
                  : "linear-gradient(180deg, #666 0%, #444 100%)",
                cursor: selectedCartelas >= 3 ? "pointer" : "not-allowed",
                opacity: selectedCartelas >= 3 ? 1 : 0.5,
                whiteSpace: "nowrap" as const
              }}
              onClick={handleFinish}
              disabled={selectedCartelas < 3}
            >
              Finish
            </button>
            <button
              style={{
                ...btnStyle,
                fontSize: "clamp(12px, 2.5vw, 16px)",
                padding: "clamp(8px, 2vw, 12px) clamp(12px, 3vw, 24px)",
                margin: 0,
                background: "linear-gradient(180deg, #9333EA 0%, #7C3AED 100%)",
                cursor: "pointer",
                whiteSpace: "nowrap" as const
              }}
              onClick={handleShuffle}
              disabled={selectedCartelas < 3}
              title="Play shuffle sound"
            >
              🔀 Shuffle
            </button>
            {isCallingNumber && (
              <button
                style={{
                  ...btnStyle,
                  fontSize: "clamp(12px, 2.5vw, 16px)",
                  padding: "clamp(8px, 2vw, 12px) clamp(12px, 3vw, 24px)",
                  margin: 0,
                  background: "linear-gradient(180deg, #DC2626 0%, #B91C1C 100%)",
                  cursor: "pointer",
                  whiteSpace: "nowrap" as const
                }}
                onClick={() => {
                  console.log('🔄 Manual reset of calling state');
                  setIsCallingNumber(false);
                  setAutoCall(false);
                }}
                title="Reset if stuck calling numbers"
              >
                🔄 Reset
              </button>
            )}
          </>
        )}
      </div>

      {/* Cartela Check Section */}
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "clamp(10px, 2vw, 15px)",
        marginTop: "clamp(15px, 3vw, 20px)",
        marginLeft: "clamp(0px, 8vw, 70px)"
      }}>
        {/* Auto Call Timer */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "clamp(10px, 2vw, 14px)",
          background: "linear-gradient(135deg, rgba(255, 165, 0, 0.15), rgba(255, 140, 0, 0.08))",
          padding: "clamp(10px, 2vw, 14px) clamp(14px, 2.5vw, 18px)",
          borderRadius: "16px",
          border: "2px solid rgba(255, 165, 0, 0.4)",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)"
        }}>
          <div style={{
            fontSize: "clamp(22px, 3.5vw, 28px)",
            filter: "drop-shadow(0 2px 4px rgba(255, 165, 0, 0.3))"
          }}>
            ⏱️
          </div>
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "6px"
          }}>
            <div style={{
              fontSize: "clamp(10px, 1.8vw, 12px)",
              color: "#cbd5e1",
              fontWeight: "600",
              textTransform: "uppercase",
              letterSpacing: "0.8px"
            }}>
              Auto Call Speed
            </div>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "clamp(10px, 2vw, 14px)"
            }}>
              <div style={{
                position: "relative" as const,
                width: "clamp(100px, 20vw, 140px)",
                paddingTop: "8px",
                paddingBottom: "8px"
              }}>
                {/* Tick marks */}
                <div style={{
                  position: "absolute" as const,
                  top: "50%",
                  left: 0,
                  right: 0,
                  display: "flex",
                  justifyContent: "space-between",
                  transform: "translateY(-50%)",
                  pointerEvents: "none" as const
                }}>
                  {[3, 4, 5, 6, 7].map((tick) => (
                    <div
                      key={tick}
                      style={{
                        width: "2px",
                        height: slider === tick ? "12px" : "8px",
                        background: slider >= tick 
                          ? "rgba(255, 215, 0, 0.8)" 
                          : "rgba(100, 100, 100, 0.5)",
                        borderRadius: "1px",
                        transition: "all 0.2s ease"
                      }}
                    />
                  ))}
                </div>
                
                {/* Track background */}
                <div style={{
                  height: "10px",
                  background: "rgba(30, 30, 30, 0.9)",
                  borderRadius: "5px",
                  position: "relative" as const,
                  boxShadow: "inset 0 2px 4px rgba(0,0,0,0.5)"
                }}>
                  {/* Filled track */}
                  <div style={{
                    width: `${((slider - 3) / (7 - 3)) * 100}%`,
                    height: "100%",
                    background: "linear-gradient(90deg, #FF8C00, #FFA500, #FFD700)",
                    borderRadius: "5px",
                    transition: "width 0.3s ease",
                    boxShadow: "0 0 10px rgba(255, 165, 0, 0.7)"
                  }} />
                  
                  {/* Custom thumb */}
                  <div style={{
                    position: "absolute" as const,
                    top: "50%",
                    left: `${((slider - 3) / (7 - 3)) * 100}%`,
                    transform: "translate(-50%, -50%)",
                    width: "20px",
                    height: "20px",
                    background: "radial-gradient(circle at 30% 30%, #FFD700, #FFA500)",
                    borderRadius: "50%",
                    border: "3px solid #1e293b",
                    boxShadow: "0 0 0 2px #FFA500, 0 4px 8px rgba(0, 0, 0, 0.5)",
                    transition: "left 0.3s ease",
                    pointerEvents: "none" as const,
                    zIndex: 2
                  }} />
                </div>
                
                {/* Invisible input overlay */}
                <input
                  type="range"
                  min={3}
                  max={7}
                  step={1}
                  value={slider}
                  onChange={(e) => {
                    const newValue = Number(e.target.value);
                    setSlider(newValue);
                    localStorage.setItem('autoCallTimer', newValue.toString());
                  }}
                  style={{
                    position: "absolute" as const,
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    opacity: 0,
                    cursor: selectedCartelas < 3 ? "not-allowed" : "pointer",
                    zIndex: 3
                  }}
                  disabled={selectedCartelas < 3}
                />
              </div>
              
              {/* Time display */}
              <span style={{
                color: "#FFD700",
                fontWeight: "bold",
                fontSize: "clamp(18px, 3.5vw, 24px)",
                minWidth: "clamp(35px, 7vw, 45px)",
                textAlign: "center" as const,
                background: "linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(255, 165, 0, 0.1))",
                padding: "clamp(4px, 1vw, 6px) clamp(8px, 1.5vw, 10px)",
                borderRadius: "8px",
                border: "2px solid rgba(255, 215, 0, 0.5)",
                boxShadow: "0 2px 8px rgba(255, 215, 0, 0.3), inset 0 1px 2px rgba(255, 255, 255, 0.2)",
                textShadow: "0 2px 4px rgba(0, 0, 0, 0.5)"
              }}>
                {slider}s
              </span>
            </div>
          </div>
        </div>
        <input
          type="text"
          placeholder="Enter ID"
          value={inputId}
          onChange={(e) => setInputId(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter' && !checkingCartela) {
              handleCheckCartela();
            }
          }}
          style={{
            padding: "clamp(8px, 2vw, 12px) clamp(10px, 2.5vw, 16px)",
            fontSize: "clamp(12px, 2.5vw, 16px)",
            borderRadius: 8,
            border: "2px solid #FFA500",
            background: "#222",
            color: "#FFA500",
            outline: "none",
            width: "clamp(120px, 30vw, 200px)",
            fontWeight: "bold",
            boxSizing: "border-box"
          }}
          disabled={checkingCartela}
        />
        <button
          style={{
            ...btnStyle,
            fontSize: "clamp(12px, 2.5vw, 16px)",
            padding: "clamp(8px, 2vw, 12px) clamp(12px, 3vw, 24px)",
            margin: 0,
            background: checkingCartela
              ? "linear-gradient(180deg, #666 0%, #444 100%)"
              : "linear-gradient(180deg, #FFA500 0%, #FF8C00 100%)",
            cursor: checkingCartela ? "not-allowed" : "pointer",
            opacity: checkingCartela ? 0.5 : 1,
            whiteSpace: "nowrap" as const
          }}
          onClick={handleCheckCartela}
          disabled={checkingCartela}
        >
          {checkingCartela ? "..." : "Check"}
        </button>
      </div>



      {/* Cartela Check Result Modal */}
      {showCartelaCheckModal && cartelaCheckResult && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.9)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: "20px"
        }}>
          <div style={{
            background: cartelaCheckResult.win 
              ? "linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #000000 100%)"
              : "linear-gradient(135deg, #3a3a3a 0%, #2d2d2d 100%)",
            borderRadius: 16,
            padding: "20px",
            maxWidth: "350px",
            width: "95%",
            maxHeight: "90vh",
            boxShadow: cartelaCheckResult.win
              ? "0 0 40px rgba(30, 58, 138, 0.9), 0 8px 30px rgba(0,0,0,0.6)"
              : "0 0 25px rgba(255, 215, 0, 0.6), 0 8px 30px rgba(0,0,0,0.8)",
            textAlign: "center" as const,
            position: "relative" as const,
            border: cartelaCheckResult.win ? "3px solid #1e40af" : "2px solid #FFD700"
          }}>
            {/* Close Button */}
            <button
              onClick={() => {
                setShowCartelaCheckModal(false);
                setInputId("");
              }}
              style={{
                position: "absolute" as const,
                top: "8px",
                right: "8px",
                width: "30px",
                height: "30px",
                borderRadius: "50%",
                background: "rgba(100, 100, 100, 0.8)",
                border: "1px solid #888",
                color: "#fff",
                fontSize: "20px",
                fontWeight: "bold",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 2px 6px rgba(0, 0, 0, 0.5)"
              }}
            >
              ×
            </button>
            
            {/* Winner Title or Cartela ID */}
            {cartelaCheckResult.win ? (
              <h2 style={{
                color: "#FFFFFF",
                fontSize: "clamp(20px, 4vw, 28px)",
                fontWeight: "bold",
                marginBottom: "10px",
                letterSpacing: "1px",
                textShadow: "2px 2px 4px rgba(0,0,0,0.3)"
              }}>
                አሸናፊ!
              </h2>
            ) : (
              <h2 style={{
                color: "#FFFFFF",
                fontSize: "clamp(14px, 3vw, 18px)",
                fontWeight: "bold",
                marginBottom: "6px",
                letterSpacing: "0.5px"
              }}>
                {cartelaCheckResult.cartelaId}
              </h2>
            )}
            
            {/* Status Message with Icon */}
            {cartelaCheckResult.cardType === 'notregistered' ? (
              <div style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "15px",
                marginBottom: "20px",
                padding: "20px",
                background: "rgba(255, 107, 107, 0.15)",
                borderRadius: "10px",
                border: "2px solid #FF6B6B"
              }}>
                <span style={{ fontSize: "48px" }}>⚠️</span>
                <div style={{
                  color: "#FF6B6B",
                  fontSize: "clamp(18px, 3.5vw, 24px)",
                  fontWeight: "bold",
                  textAlign: "center" as const
                }}>
                  Cartela Not Registered
                </div>
                <div style={{
                  color: "#FFF",
                  fontSize: "clamp(14px, 2.5vw, 16px)",
                  textAlign: "center" as const,
                  lineHeight: 1.5
                }}>
                  {cartelaCheckResult.message}
                </div>
              </div>
            ) : cartelaCheckResult.win ? (
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                marginBottom: "10px",
                padding: "8px",
                background: "rgba(255, 255, 255, 0.3)",
                borderRadius: "8px",
                border: "2px solid rgba(255, 255, 255, 0.5)"
              }}>
                <span style={{ fontSize: "18px" }}>🎯</span>
                <span style={{
                  color: "#FFFFFF",
                  fontSize: "clamp(11px, 2.2vw, 14px)",
                  fontWeight: "bold",
                  textShadow: "1px 1px 2px rgba(0,0,0,0.3)"
                }}>
                  ካርታ {cartelaCheckResult.cartelaId} - የእርስዎ ቁጥሮች
                </span>
              </div>
            ) : (
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                marginBottom: "12px",
                padding: "8px",
                background: "rgba(255, 107, 107, 0.2)",
                borderRadius: "8px",
                border: "2px solid #FF6B6B"
              }}>
                <span style={{ fontSize: "20px" }}>❌</span>
                <span style={{
                  color: "#FF6B6B",
                  fontSize: "clamp(12px, 2.5vw, 16px)",
                  fontWeight: "bold"
                }}>
                  እስካሁን አላሸነፈም
                </span>
              </div>
            )}

            {/* Display Cartela - Only show if registered and available */}
            {cartelaCheckResult.cardType !== 'notregistered' && cartelaCheckResult.cartela && cartelaCheckResult.cartela.numbers && Array.isArray(cartelaCheckResult.cartela.numbers) ? (
              <div style={{
                marginBottom: "15px",
                padding: cartelaCheckResult.win ? "12px" : "0",
                background: cartelaCheckResult.win ? "rgba(255, 255, 255, 0.25)" : "transparent",
                borderRadius: cartelaCheckResult.win ? "10px" : "0",
                border: cartelaCheckResult.win ? "2px solid rgba(255, 255, 255, 0.4)" : "none"
              }}>
                {/* BINGO Letters */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(5, 1fr)",
                  gap: "6px",
                  maxWidth: "300px",
                  margin: "0 auto 10px auto"
                }}>
                  {["B", "I", "N", "G", "O"].map((letter) => (
                    <div
                      key={letter}
                      style={{
                        background: cartelaCheckResult.win
                          ? "linear-gradient(180deg, #3b82f6 0%, #1e40af 100%)"
                          : "linear-gradient(180deg, #FFD700 0%, #FFA500 100%)",
                        color: "#000",
                        fontWeight: "bold",
                        fontSize: "clamp(14px, 3vw, 18px)",
                        padding: "8px",
                        borderRadius: "8px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: cartelaCheckResult.win
                          ? "0 3px 8px rgba(0,0,0,0.5)"
                          : "0 2px 6px rgba(0,0,0,0.4)"
                      }}
                    >
                      {letter}
                    </div>
                  ))}
                </div>
                
                {/* Numbers Grid */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(5, 1fr)",
                  gap: "6px",
                  maxWidth: "300px",
                  margin: "0 auto"
                }}>
                  {(() => {
                    // Convert cartela numbers to proper format
                    const numbers = cartelaCheckResult.cartela.numbers;
                    let columns: number[][] = [];
                    
                    // Check if numbers is already a 2D array
                    if (Array.isArray(numbers) && numbers.length === 5 && Array.isArray(numbers[0])) {
                      columns = numbers;
                    } 
                    // Check if numbers is an object with B, I, N, G, O keys
                    else if (numbers && typeof numbers === 'object' && 'B' in numbers) {
                      columns = [
                        numbers.B || [],
                        numbers.I || [],
                        numbers.N || [],
                        numbers.G || [],
                        numbers.O || []
                      ];
                    }
                    
                    return columns.map((column: any[], colIndex: number) => (
                      <div key={colIndex} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {column.map((num: number | null, rowIndex: number) => {
                        const isFreeSpace = colIndex === 2 && rowIndex === 2;
                        const isCalled = num !== null && called.includes(num);
                        
                        // Check if this cell is part of a winning line
                        const completedLines = cartelaCheckResult.cartela?.completedLines || [];
                        const isWinningCell = (() => {
                          // Define line patterns
                          const linePatterns: Record<string, [number, number][]> = {
                            "Top Row": [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]],
                            "Second Row": [[1, 0], [1, 1], [1, 2], [1, 3], [1, 4]],
                            "Third Row": [[2, 0], [2, 1], [2, 2], [2, 3], [2, 4]],
                            "Fourth Row": [[3, 0], [3, 1], [3, 2], [3, 3], [3, 4]],
                            "Bottom Row": [[4, 0], [4, 1], [4, 2], [4, 3], [4, 4]],
                            "Left Column": [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]],
                            "Second Column": [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1]],
                            "Middle Column": [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2]],
                            "Fourth Column": [[0, 3], [1, 3], [2, 3], [3, 3], [4, 3]],
                            "Right Column": [[0, 4], [1, 4], [2, 4], [3, 4], [4, 4]],
                            "Main Diagonal": [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4]],
                            "Anti Diagonal": [[0, 4], [1, 3], [2, 2], [3, 1], [4, 0]],
                            "Four Corners": [[0, 0], [0, 4], [4, 0], [4, 4]]
                          };
                          
                          // Check if current cell is in any completed line
                          for (const lineName of completedLines) {
                            const positions = linePatterns[lineName];
                            if (positions && positions.some(([r, c]) => r === rowIndex && c === colIndex)) {
                              return true;
                            }
                          }
                          return false;
                        })();
                        
                        // Determine background color based on state
                        let bgColor = "#4a4a4a"; // Dark gray for uncalled
                        let textColor = "#FFFFFF"; // White text
                        let borderColor = "none";
                        let boxShadow = "0 1px 3px rgba(0,0,0,0.4)";
                        
                        if (cartelaCheckResult.win) {
                          // Winner cartela
                          if (isFreeSpace) {
                            bgColor = "linear-gradient(180deg, #3b82f6 0%, #1e40af 100%)"; // Blue for FREE space
                            textColor = "#FFFFFF";
                            borderColor = "2px solid #1e40af";
                            boxShadow = "0 2px 6px rgba(30, 64, 175, 0.8)";
                          } else if (isWinningCell) {
                            // Part of winning line - Blue
                            bgColor = "linear-gradient(180deg, #3b82f6 0%, #1e40af 100%)";
                            textColor = "#FFFFFF";
                            borderColor = "2px solid #1e40af";
                            boxShadow = "0 3px 8px rgba(30, 64, 175, 0.9)";
                          } else if (isCalled) {
                            // Called but not part of winning line - Chocolate
                            bgColor = "linear-gradient(180deg, #8B4513 0%, #654321 100%)";
                            textColor = "#FFFFFF";
                            borderColor = "1px solid #654321";
                            boxShadow = "0 2px 4px rgba(139, 69, 19, 0.6)";
                          } else {
                            // Not called - Dark gray
                            bgColor = "#4a4a4a";
                            textColor = "#FFFFFF";
                          }
                        } else {
                          // Non-winner cartela
                          if (isFreeSpace) {
                            bgColor = "linear-gradient(180deg, #FFD700 0%, #FFA500 100%)";
                            textColor = "#000000";
                            borderColor = "1px solid #FFD700";
                            boxShadow = "0 2px 6px rgba(255, 215, 0, 0.6)";
                          } else if (isCalled) {
                            // Called numbers - Chocolate
                            bgColor = "linear-gradient(180deg, #8B4513 0%, #654321 100%)";
                            textColor = "#FFFFFF";
                            borderColor = "1px solid #654321";
                            boxShadow = "0 2px 4px rgba(139, 69, 19, 0.6)";
                          } else {
                            // Not called - Dark gray
                            bgColor = "#4a4a4a";
                            textColor = "#FFFFFF";
                          }
                        }
                        
                        return (
                          <div
                            key={`${colIndex}-${rowIndex}`}
                            style={{
                              background: bgColor,
                              color: textColor,
                              fontWeight: "bold",
                              fontSize: isFreeSpace ? "clamp(8px, 1.5vw, 10px)" : "clamp(12px, 2.5vw, 16px)",
                              padding: "clamp(6px, 1.5vw, 10px)",
                              borderRadius: "6px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              minHeight: "clamp(35px, 6vw, 45px)",
                              aspectRatio: "1",
                              boxShadow: boxShadow,
                              transition: "all 0.3s ease",
                              border: borderColor
                            }}
                          >
                            {isFreeSpace ? "FREE" : num || ""}
                          </div>
                        );
                      })}
                    </div>
                    ));
                  })()}
                </div>
                
                {/* Legend */}
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "8px",
                  marginTop: "15px",
                  padding: "10px",
                  background: "rgba(0, 0, 0, 0.3)",
                  borderRadius: "8px",
                  fontSize: "clamp(9px, 2vw, 11px)",
                  fontWeight: "bold"
                }}>
                  {cartelaCheckResult.win && (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <div style={{
                        width: "14px",
                        height: "14px",
                        background: "linear-gradient(180deg, #3b82f6 0%, #1e40af 100%)",
                        borderRadius: "3px",
                        border: "1px solid #1e40af"
                      }}></div>
                      <span style={{ color: "#3b82f6" }}>የአሸናፊ መስመር</span>
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <div style={{
                      width: "14px",
                      height: "14px",
                      background: "linear-gradient(180deg, #8B4513 0%, #654321 100%)",
                      borderRadius: "3px",
                      border: "1px solid #654321"
                    }}></div>
                    <span style={{ color: "#D2691E" }}>የተጠራ ቁጥሮች</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <div style={{
                      width: "14px",
                      height: "14px",
                      background: "#4a4a4a",
                      borderRadius: "3px",
                      border: "1px solid #666"
                    }}></div>
                    <span style={{ color: "#AAA" }}>ያልተጠራ ቁጥሮች</span>
                  </div>
                </div>
              </div>
            ) : cartelaCheckResult.cardType !== 'notregistered' ? (
              <div style={{
                padding: "30px",
                marginBottom: "20px",
                background: "rgba(30, 64, 175, 0.1)",
                border: "2px solid #1e40af",
                borderRadius: "12px",
                color: "#3b82f6",
                fontSize: "16px",
                textAlign: "center" as const
              }}>
                <div style={{ fontSize: "32px", marginBottom: "10px" }}>⏳</div>
                <div>Loading cartela details...</div>
                <div style={{ fontSize: "12px", marginTop: "10px", color: "#AAA" }}>
                  Cartela ID: {cartelaCheckResult.cartelaId}
                </div>
              </div>
            ) : null}


          </div>
        </div>
      )}




    </div>
  );
};

export default GamePageOptimized;