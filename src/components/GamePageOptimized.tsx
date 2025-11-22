import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { useNavigate } from "react-router-dom";

// Memoize static data outside component to prevent recreation
const BINGO_NUMBERS = Array.from({ length: 75 }, (_, i) => i + 1);
const BINGO_LETTERS = ["B", "I", "N", "G", "O"] as const;

// Memoized NumberGrid component to prevent unnecessary re-renders
const NumberGrid = memo(({ 
  numbers, 
  called, 
  showPopup, 
  popupNumber, 
  isGameFinished, 
  onNumberClick 
}: {
  numbers: number[];
  called: number[];
  showPopup: boolean;
  popupNumber: number | null;
  isGameFinished: boolean;
  onNumberClick: (num: number) => void;
}) => {
  // Memoize called numbers set for O(1) lookup
  const calledSet = useMemo(() => new Set(called), [called]);
  
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(15, 1fr)",
      gap: "6px",
      width: "100%",
      maxWidth: "100%"
    }}>
      {numbers.map((num) => {
        const isCalled = calledSet.has(num);
        const isPopupNumber = showPopup && popupNumber === num;
        
        return (
          <NumberButton
            key={num}
            number={num}
            isCalled={isCalled}
            isPopupNumber={isPopupNumber}
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
  isPopupNumber, 
  isGameFinished, 
  onClick 
}: {
  number: number;
  isCalled: boolean;
  isPopupNumber: boolean;
  isGameFinished: boolean;
  onClick: (num: number) => void;
}) => {
  const buttonStyle = useMemo(() => ({
    width: "100%",
    aspectRatio: "1" as const,
    background: isCalled
      ? (isPopupNumber ? "linear-gradient(180deg, #FFD700 0%, #FFA500 100%)" : "linear-gradient(180deg, #FFD700 0%, #FFA500 100%)")
      : "linear-gradient(180deg, #8B0000 0%, #600000 100%)",
    color: isCalled ? "#000" : "#fff",
    border: isCalled ? "2px solid #FFD700" : "2px solid #400000",
    borderRadius: 4,
    fontWeight: "bold" as const,
    fontSize: "clamp(14px, 1.2vw, 18px)",
    cursor: "default" as const,
    transition: "all 0.2s ease",
    transform: isCalled ? "scale(1.05)" : "scale(1)",
    boxShadow: isCalled
      ? "0 0 15px rgba(255, 215, 0, 0.8)"
      : "0 2px 4px rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "35px"
  }), [isCalled, isPopupNumber]);

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

// Optimized audio manager
class AudioManager {
  private cache = new Map<number, HTMLAudioElement>();
  private maxCacheSize = 15; // Reduced cache size
  private apiBaseUrl: string;

  constructor(apiBaseUrl: string) {
    this.apiBaseUrl = apiBaseUrl;
  }

  async playSound(number: number): Promise<void> {
    try {
      let audio = this.cache.get(number);
      
      if (!audio) {
        audio = new Audio(`${this.apiBaseUrl}/sound/number/${number}`);
        audio.volume = 0.7;
        audio.preload = 'none';
        
        // Manage cache size
        if (this.cache.size >= this.maxCacheSize) {
          const firstKey = this.cache.keys().next().value as number | undefined;
          if (firstKey !== undefined) {
            const oldAudio = this.cache.get(firstKey);
            if (oldAudio) {
              oldAudio.pause();
              oldAudio.src = '';
            }
            this.cache.delete(firstKey);
          }
        }
        
        this.cache.set(number, audio);
      }

      audio.currentTime = 0;
      audio.play().catch(() => {}); // Silent fail
    } catch (error) {
      // Silent fail for better performance
    }
  }

  cleanup(): void {
    this.cache.forEach(audio => {
      try {
        audio.pause();
        audio.src = '';
      } catch (error) {
        // Ignore cleanup errors
      }
    });
    this.cache.clear();
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
  const [showPopup, setShowPopup] = useState(false);
  const [popupNumber, setPopupNumber] = useState<number | null>(null);
  
  // Check for active game on component mount
  useEffect(() => {
    const checkActiveGame = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        
        if (!token) {
          console.log('No auth token, redirecting to play bingo page');
          navigate('/newgame', { replace: true });
          return;
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
            setBetAmount(parseFloat(result.game.bet_money) || 10);
            setPlayerWin(parseFloat(result.game.win_money) || 0);
            
            // Load called numbers from backend
            const backendCalledNumbers = result.game.calledNumbers || [];
            setCalled(backendCalledNumbers);
            localStorage.setItem('calledNumbers', JSON.stringify(backendCalledNumbers));
            console.log(`🔄 Loaded ${backendCalledNumbers.length} called numbers from backend`);
            
            // Update localStorage with backend data
            const gameData = {
              gameId: result.game.id,
              selectedCartelas: result.game.selected_cartelas || [],
              betAmount: parseFloat(result.game.bet_money) || 10,
              playerWin: parseFloat(result.game.win_money) || 0,
              housePercentage: result.game.house_cut_percentage || 25
            };
            localStorage.setItem('currentGame', JSON.stringify(gameData));
            
            return;
          }
        }
        
        // If no active game in backend, check localStorage as fallback
        const currentGame = localStorage.getItem('currentGame');
        
        if (!currentGame) {
          // No active game found anywhere, redirect to NewGame
          console.log('No active game found, redirecting to play bingo page');
          navigate('/newgame', { replace: true });
          return;
        }
        
        try {
          const gameData = JSON.parse(currentGame);
          if (!gameData.selectedCartelas || gameData.selectedCartelas.length === 0) {
            // Invalid game data, redirect to NewGame
            console.log('Invalid game data found, redirecting to play bingo page');
            navigate('/newgame', { replace: true });
            return;
          }
          
          // Valid game found in localStorage, set up the game state
          setSelectedCartelas(gameData.selectedCartelas.length);
          setBetAmount(gameData.betAmount || 10);
          setPlayerWin(gameData.playerWin || 0);
          
        } catch (error) {
          console.error('Error parsing current game data:', error);
          navigate('/newgame', { replace: true });
        }
        
      } catch (error) {
        console.error('Error checking active game:', error);
        // On error, fall back to localStorage check
        const currentGame = localStorage.getItem('currentGame');
        if (!currentGame) {
          navigate('/newgame', { replace: true });
        }
      }
    };
    
    checkActiveGame();
  }, [navigate, API_BASE_URL]);
  
  // Game configuration
  const [selectedCartelas, setSelectedCartelas] = useState(0);
  const [betAmount, setBetAmount] = useState(10);
  const [playerWin, setPlayerWin] = useState(0);
  const [selectedPattern] = useState<string>("Two Lines");
  
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
  
  // Refs
  const autoCallIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioManagerRef = useRef<AudioManager | null>(null);
  const gameFetchIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Initialize audio manager
  useEffect(() => {
    audioManagerRef.current = new AudioManager(API_BASE_URL);
    
    return () => {
      audioManagerRef.current?.cleanup();
    };
  }, [API_BASE_URL]);

  // Optimized polling - much less frequent and only when needed
  useEffect(() => {
    if (!selectedCartelas || selectedCartelas < 3 || isGameFinished) {
      return;
    }

    // Poll every 2 minutes instead of 30 seconds
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
    }, 120000); // 2 minutes

    gameFetchIntervalRef.current = intervalId;

    return () => {
      if (gameFetchIntervalRef.current) {
        clearInterval(gameFetchIntervalRef.current);
      }
    };
  }, [selectedCartelas, isGameFinished, API_BASE_URL]);

  // Optimized auto-call
  useEffect(() => {
    if (autoCallIntervalRef.current) {
      clearInterval(autoCallIntervalRef.current);
      autoCallIntervalRef.current = null;
    }

    if (autoCall && !isGameFinished && selectedCartelas >= 3) {
      autoCallIntervalRef.current = setInterval(async () => {
        if (document.hidden) return; // Don't call when tab is hidden
        
        try {
          const token = localStorage.getItem('auth_token');
          const gameData = localStorage.getItem('currentGame');
          
          if (!token || !gameData) return;
          
          const parsed = JSON.parse(gameData);
          const gameId = currentGameData?.id || parsed.gameId;
          
          if (!gameId) return;

          const response = await fetch(`${API_BASE_URL}/games/${gameId}/call-number`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ calledNumbers: called })
          });

          if (response.ok) {
            const result = await response.json();
            
            if (result.gameCompleted) {
              setAutoCall(false);
              return;
            }

            const calledNumber = result.calledNumber;
            if (calledNumber) {
              setCalled(prev => {
                const newCalled = [...prev, calledNumber];
                localStorage.setItem('calledNumbers', JSON.stringify(newCalled));
                return newCalled;
              });

              // Play sound
              audioManagerRef.current?.playSound(calledNumber);

              // Show popup briefly
              setPopupNumber(calledNumber);
              setShowPopup(true);
              setTimeout(() => setShowPopup(false), 1500); // Reduced from 2000ms
            }
          } else if (response.status === 400 || response.status === 429) {
            setAutoCall(false);
          }
        } catch (error) {
          setAutoCall(false);
        }
      }, slider * 1000);
    }

    return () => {
      if (autoCallIntervalRef.current) {
        clearInterval(autoCallIntervalRef.current);
        autoCallIntervalRef.current = null;
      }
    };
  }, [autoCall, slider, isGameFinished, selectedCartelas, called, currentGameData, API_BASE_URL]);

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
      
      if (!gameData || !token) return;
      
      const parsed = JSON.parse(gameData);
      const gameId = currentGameData?.id || parsed.gameId;
      
      if (!gameId) return;

      const response = await fetch(`${API_BASE_URL}/games/${gameId}/call-number`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ calledNumbers: called })
      });

      if (response.ok) {
        const result = await response.json();
        
        if (result.gameCompleted) {
          setAutoCall(false);
          setCalled(result.game.calledNumbers);
          return;
        }

        const calledNumber = result.calledNumber;
        if (calledNumber) {
          setCalled(prev => {
            const newCalled = [...prev, calledNumber];
            localStorage.setItem('calledNumbers', JSON.stringify(newCalled));
            return newCalled;
          });

          audioManagerRef.current?.playSound(calledNumber);
          setPopupNumber(calledNumber);
          setShowPopup(true);
          setTimeout(() => setShowPopup(false), 1500);
        }
      }
    } catch (error) {
      // Handle error
    } finally {
      setIsCallingNumber(false);
    }
  }, [isGameFinished, selectedCartelas, isCallingNumber, called, currentGameData, API_BASE_URL]);

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
    
    // Navigate to new game page
    setTimeout(() => {
      navigate('/newgame', { replace: true });
    }, 500);
  }, [navigate, currentGameData, playerWin, API_BASE_URL]);

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
        
        // Play notwinner sound
        try {
          const audio = new Audio(`${API_BASE_URL}/sound/notwinner`);
          audio.volume = 0.7;
          audio.play().catch(() => {});
        } catch (error) {
          // Silent fail
        }
        
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
        
        // Always fetch cartela data to ensure we have the numbers
        try {
          const cartelaResponse = await fetch(`${API_BASE_URL}/cartelas/${inputId.trim()}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (cartelaResponse.ok) {
            const cartelaData = await cartelaResponse.json();
            console.log('✅ Fetched cartela data:', cartelaData);
            
            // Ensure we have the cartela object with numbers
            result.cartela = {
              id: cartelaData.id,
              card_id: cartelaData.cardId || cartelaData.card_id,
              numbers: cartelaData.numbers,
              pattern: result.winningPatterns?.join(', ') || null,
              purchased_at: cartelaData.purchasedAt || cartelaData.purchased_at
            };
            
            console.log('✅ Final cartela object:', result.cartela);
          } else {
            console.error('❌ Failed to fetch cartela:', await cartelaResponse.text());
          }
        } catch (error) {
          console.error('❌ Error fetching cartela details:', error);
        }
        
        setCartelaCheckResult(result);
        setShowCartelaCheckModal(true);
        
        // Play sound based on result
        try {
          const soundUrl = result.win 
            ? `${API_BASE_URL}/sound/winner`
            : `${API_BASE_URL}/sound/notwinner`;
          const audio = new Audio(soundUrl);
          audio.volume = 0.7;
          audio.play().catch(() => {});
        } catch (error) {
          // Silent fail
        }
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

      marginRight: '100px',
      marginLeft: '60px',
      marginTop: '50px',
      marginBottom: '0px'

    }}>
      {/* Last 5 Called Numbers - Golden Balls */}
      {called.length > 0 && (
        <div style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "clamp(15px, 2.5vw, 25px)",
          marginBottom: "25px",
          padding: "15px"
        }}>
          {called.slice(-5).reverse().map((num, index) => (
            <div
              key={`${num}-${index}`}
              style={{
                width: "clamp(60px, 8vw, 90px)",
                height: "clamp(60px, 8vw, 90px)",
                borderRadius: "50%",
                background: index === 0 
                  ? "radial-gradient(circle at 30% 30%, #FFD700, #FFA500, #FF8C00)"
                  : "radial-gradient(circle at 30% 30%, #FFA500, #FF8C00, #CC6600)",
                color: "#000",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "bold",
                fontSize: "clamp(24px, 3.5vw, 36px)",
                boxShadow: index === 0 
                  ? "0 8px 20px rgba(255, 215, 0, 0.6), inset 0 -3px 8px rgba(0,0,0,0.3), inset 0 3px 8px rgba(255,255,255,0.4)"
                  : "0 6px 15px rgba(255, 140, 0, 0.4), inset 0 -3px 8px rgba(0,0,0,0.3), inset 0 3px 8px rgba(255,255,255,0.3)",
                border: index === 0 ? "3px solid #FFD700" : "2px solid #FFA500",
                animation: index === 0 ? "bounce 1.5s ease-in-out infinite" : "none",
                position: "relative" as const,
                transform: index === 0 ? "scale(1.1)" : "scale(1)"
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
        `}
      </style>

      {/* Header */}
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "10px",
        marginBottom: "20px"
      }}>
        <div style={{
          fontSize: "clamp(32px, 6vw, 48px)",
          fontWeight: "bold",
          color: "#FFA500",
          marginRight: "10px"
        }}>
          GAME <span style={{ color: "#FFD700" }}>{currentGameData?.game_number || "169"}</span>
        </div>
        <div style={{
          background: "#FFD700",
          color: "#000",
          padding: "8px 16px",
          borderRadius: 8,
          fontWeight: "bold",
          fontSize: "14px"
        }}>
          GAME STARTED
        </div>
        <div style={{
          background: "#FFA500",
          color: "#000",
          padding: "8px 16px",
          borderRadius: 8,
          fontWeight: "bold",
          fontSize: "14px"
        }}>
          BET MONEY {betAmount} BIRR
        </div>
        <div style={{
          background: "#90EE90",
          color: "#000",
          padding: "8px 16px",
          borderRadius: 8,
          fontWeight: "bold",
          fontSize: "14px"
        }}>
          WIN MONEY {playerWin.toFixed(1)} BIRR
        </div>
        <div style={{
          background: "#FFD700",
          color: "#000",
          padding: "8px 16px",
          borderRadius: 8,
          fontWeight: "bold",
          fontSize: "14px"
        }}>
          {selectedCartelas} CARTELA SELECTED
        </div>
        <div style={{
          background: "#333",
          color: "#FFD700",
          padding: "8px 16px",
          borderRadius: 8,
          fontWeight: "bold",
          fontSize: "14px"
        }}>
          Called {called.length}/75
        </div>
      </div>

      <div style={{
        display: "flex",
        gap: "20px",
        flexWrap: "nowrap",
        width: "100%"
      }}>
        {/* Left side - BINGO letters */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          flexShrink: 0
        }}>
          {BINGO_LETTERS.map((letter) => (
            <div key={letter} style={{
              background: "linear-gradient(180deg, #FFA500 0%, #FF8C00 100%)",
              color: "#000",
              fontWeight: "bold",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "50px",
              height: "50px",
              fontSize: "24px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.5)"
            }}>
              {letter}
            </div>
          ))}
        </div>

        {/* Center - Numbers grid */}
        <div style={{
          flex: 1,
          width: "100%"
        }}>
          <NumberGrid 
            numbers={BINGO_NUMBERS}
            called={called}
            showPopup={showPopup}
            popupNumber={popupNumber}
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
        gap: "10px",
        marginTop: "20px",
        marginLeft: "70px"
      }}>
        {!isGameFinished && (
          <>
            <button
              style={{
                ...btnStyle,
                fontSize: "16px",
                padding: "12px 24px",
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
              {autoCall ? "Auto Call On" : "Auto Call Off"}
            </button>
            <button
              style={{
                ...btnStyle,
                fontSize: "16px",
                padding: "12px 24px",
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
                fontSize: "16px",
                padding: "12px 24px",
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
                fontSize: "16px",
                padding: "12px 24px",
                margin: 0,
                background: "linear-gradient(180deg, #FFA500 0%, #FF8C00 100%)",
                cursor: "pointer",
                whiteSpace: "nowrap" as const
              }}
            >
              Shuffle
            </button>
          </>
        )}
      </div>

      {/* Cartela Check Section */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        marginTop: "20px",
        marginLeft: "70px"
      }}>
        <div style={{
          fontSize: "24px",
          marginRight: "10px"
        }}>
          ⏱️
        </div>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "10px"
        }}>
          <div style={{
            width: "100px",
            height: "6px",
            background: "#333",
            borderRadius: "3px",
            position: "relative" as const
          }}>
            <div style={{
              width: `${((slider - 3) / (7 - 3)) * 100}%`,
              height: "100%",
              background: "#FFA500",
              borderRadius: "3px"
            }}></div>
            <input
              type="range"
              min={3}
              max={7}
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
                cursor: "pointer"
              }}
              disabled={selectedCartelas < 3}
            />
          </div>
          <span style={{
            color: "#FFA500",
            fontWeight: "bold",
            fontSize: "16px",
            minWidth: "35px"
          }}>
            {slider}s
          </span>
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
            padding: "12px 16px",
            fontSize: "16px",
            borderRadius: 8,
            border: "2px solid #FFA500",
            background: "#222",
            color: "#FFA500",
            outline: "none",
            width: "200px",
            fontWeight: "bold"
          }}
          disabled={checkingCartela}
        />
        <button
          style={{
            ...btnStyle,
            fontSize: "16px",
            padding: "12px 24px",
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
          {checkingCartela ? "Checking..." : "Check"}
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
          padding: "20px",
          overflow: "auto"
        }}>
          <div style={{
            background: "linear-gradient(135deg, #3a3a3a 0%, #2d2d2d 100%)",
            borderRadius: 20,
            padding: "clamp(25px, 4vw, 40px)",
            maxWidth: "550px",
            width: "90%",
            maxHeight: "90vh",
            overflowY: "auto",
            boxShadow: "0 0 40px rgba(255, 215, 0, 0.6), 0 10px 50px rgba(0,0,0,0.8)",
            textAlign: "center" as const,
            position: "relative" as const,
            border: "3px solid #FFD700"
          }}>
            {/* Close Button */}
            <button
              onClick={() => {
                setShowCartelaCheckModal(false);
                setInputId("");
              }}
              style={{
                position: "absolute" as const,
                top: "15px",
                right: "15px",
                width: "45px",
                height: "45px",
                borderRadius: "50%",
                background: "rgba(100, 100, 100, 0.8)",
                border: "2px solid #888",
                color: "#fff",
                fontSize: "28px",
                fontWeight: "bold",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.5)"
              }}
            >
              ×
            </button>
            
            {/* Cartela ID Title */}
            <h2 style={{
              color: "#FFFFFF",
              fontSize: "clamp(24px, 5vw, 32px)",
              fontWeight: "bold",
              marginBottom: "10px",
              letterSpacing: "1px"
            }}>
              {cartelaCheckResult.cartelaId}
            </h2>
            
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
            ) : cartelaCheckResult.win && (
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                marginBottom: "20px",
                padding: "12px",
                background: "rgba(255, 215, 0, 0.15)",
                borderRadius: "10px"
              }}>
                <span style={{ fontSize: "24px" }}>🎯</span>
                <span style={{
                  color: "#FFD700",
                  fontSize: "clamp(16px, 3vw, 20px)",
                  fontWeight: "bold"
                }}>
                  ካርታ 4 - የእርስዎ ቁጥሮች
                </span>
              </div>
            )}

            {/* Display Cartela - Only show if registered and available */}
            {cartelaCheckResult.cardType !== 'notregistered' && cartelaCheckResult.cartela && cartelaCheckResult.cartela.numbers ? (
              <div style={{
                marginBottom: "20px"
              }}>
                {/* BINGO Letters */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(5, 1fr)",
                  gap: "8px",
                  maxWidth: "450px",
                  margin: "0 auto 12px auto"
                }}>
                  {["B", "I", "N", "G", "O"].map((letter) => (
                    <div
                      key={letter}
                      style={{
                        background: "linear-gradient(180deg, #FFD700 0%, #FFA500 100%)",
                        color: "#000",
                        fontWeight: "bold",
                        fontSize: "clamp(20px, 4vw, 28px)",
                        padding: "10px",
                        borderRadius: "10px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 4px 8px rgba(0,0,0,0.3)"
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
                  gap: "8px",
                  maxWidth: "450px",
                  margin: "0 auto"
                }}>
                  {cartelaCheckResult.cartela.numbers.map((column: any[], colIndex: number) => (
                    <div key={colIndex} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {column.map((num: number | null, rowIndex: number) => {
                        const isFreeSpace = colIndex === 2 && rowIndex === 2;
                        const isCalled = num !== null && called.includes(num);
                        
                        // Determine background color based on state
                        let bgColor = "#4a4a4a"; // Dark gray for uncalled
                        let textColor = "#FFFFFF"; // White text
                        
                        if (isFreeSpace) {
                          bgColor = "linear-gradient(180deg, #FFD700 0%, #FFA500 100%)"; // Gold for FREE
                          textColor = "#000000";
                        } else if (isCalled) {
                          bgColor = "linear-gradient(180deg, #FFD700 0%, #FFA500 100%)"; // Gold for called numbers
                          textColor = "#000000";
                        }
                        
                        return (
                          <div
                            key={`${colIndex}-${rowIndex}`}
                            style={{
                              background: bgColor,
                              color: textColor,
                              fontWeight: "bold",
                              fontSize: "clamp(16px, 3.5vw, 22px)",
                              padding: "clamp(10px, 2vw, 14px)",
                              borderRadius: "10px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              minHeight: "clamp(50px, 9vw, 65px)",
                              aspectRatio: "1",
                              boxShadow: isCalled || isFreeSpace ? "0 4px 12px rgba(255, 215, 0, 0.6)" : "0 2px 6px rgba(0,0,0,0.4)",
                              transition: "all 0.3s ease",
                              border: isCalled || isFreeSpace ? "2px solid #FFD700" : "none"
                            }}
                          >
                            {isFreeSpace ? "FREE" : num || ""}
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
                  gap: "20px",
                  marginTop: "15px",
                  fontSize: "clamp(12px, 2.5vw, 14px)",
                  fontWeight: "bold"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <div style={{
                      width: "20px",
                      height: "20px",
                      background: "linear-gradient(180deg, #FFD700 0%, #FFA500 100%)",
                      borderRadius: "4px"
                    }}></div>
                    <span style={{ color: "#FFD700" }}>የተጠራ ቁጥሮች</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <div style={{
                      width: "20px",
                      height: "20px",
                      background: "#4a4a4a",
                      borderRadius: "4px"
                    }}></div>
                    <span style={{ color: "#AAA" }}>ያልተጠራ ቁጥሮች</span>
                  </div>
                </div>
              </div>
            ) : cartelaCheckResult.cardType !== 'notregistered' ? (
              <div style={{
                padding: "30px",
                marginBottom: "20px",
                background: "rgba(255, 215, 0, 0.1)",
                border: "2px solid #FFD700",
                borderRadius: "12px",
                color: "#FFD700",
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