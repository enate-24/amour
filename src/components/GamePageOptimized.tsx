import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { useNavigate } from "react-router-dom";
import { logGameState } from "../utils/gameDebug";
import { UnifiedAudioManager } from "../utils/UnifiedAudioManager";
import { voiceCategoryManager } from "../utils/voiceCategoryManager";
import { useWebSocket } from "../hooks/useWebSocket";
import { createPoller, type OptimizedPoller } from "../utils/optimizedPolling";
import { offlineGameState } from "../utils/offlineGameState";
import { useNetworkStatus } from "../utils/networkStatus";
import { useAuth } from "../hooks/useAuth";

// Memoize static data outside component to prevent recreation
const BINGO_NUMBERS = Array.from({ length: 75 }, (_, i) => i + 1);
const BINGO_LETTERS = ["B", "I", "N", "G", "O"] as const;

// Memoized NumberGrid component to prevent unnecessary re-renders
const NumberGrid = memo(({ 
  numbers, 
  called, 
  isGameFinished, 
  onNumberClick,
  isShuffling 
}: {
  numbers: number[];
  called: number[];
  isGameFinished: boolean;
  onNumberClick: (num: number) => void;
  isShuffling: boolean;
}) => {
  // Memoize called numbers set for O(1) lookup
  const calledSet = useMemo(() => new Set(called), [called]);
  
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(15, minmax(0, 1fr))",
      gap: "clamp(2px, 0.8vw, 6px)",
      width: "100%",
      maxWidth: "100%",
      overflow: "hidden"
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
            isShuffling={isShuffling}
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
  onClick,
  isShuffling 
}: {
  number: number;
  isCalled: boolean;
  isGameFinished: boolean;
  onClick: (num: number) => void;
  isShuffling: boolean;
}) => {
  const buttonStyle = useMemo(() => ({
    width: "100%",
    aspectRatio: "1" as const,
    background: isCalled
      ? "linear-gradient(180deg, #FFD700 0%, #FFA500 100%)"
      : "linear-gradient(180deg, #8B0000 0%, #600000 100%)",
    color: isCalled ? "#000" : "#fff",
    border: isCalled ? "2px solid #FFD700" : "1px solid #400000",
    borderRadius: "clamp(2px, 0.5vw, 4px)",
    fontWeight: "bold" as const,
    fontSize: "clamp(8px, 1.8vw, 18px)",
    cursor: "default" as const,
    transition: "all 0.2s ease",
    transform: isCalled ? "scale(1.05)" : "scale(1)",
    boxShadow: isCalled
      ? "0 0 15px rgba(255, 215, 0, 0.8)"
      : "0 2px 4px rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "clamp(20px, 3.5vw, 35px)",
    animation: isShuffling ? "shake 0.5s ease-in-out infinite" : "none",
    padding: "2px"
  }), [isCalled, isShuffling]);

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

const GamePageOptimized = (): JSX.Element => {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
  const { isOnline } = useNetworkStatus();

  
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
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  
  // Check for active game on component mount - INSTANT START with IndexedDB
  useEffect(() => {
    const checkActiveGame = async () => {
      setIsInitialLoading(true);
      
      // INSTANT START: Check IndexedDB first for immediate game data
      try {
        const { gameSessionDB } = await import('../utils/gameSessionDB');
        const token = localStorage.getItem('auth_token');
        
        if (token) {
          // Get user ID from token
          const payload = JSON.parse(atob(token.split('.')[1]));
          const userId = payload.id || payload.userId || payload.sub;
          
          if (userId) {
            const gameData = await gameSessionDB.getActiveGameSession(userId);
            
            console.log('🔍 Checking for game session in IndexedDB:', {
              userId,
              hasSession: !!gameData
            });
            
            // Use IndexedDB data if it's recent (within 10 minutes)
            if (gameData && (Date.now() - gameData.timestamp) < 10 * 60 * 1000) {
              const ageInSeconds = (Date.now() - gameData.timestamp) / 1000;
              console.log('📊 Game session age:', ageInSeconds.toFixed(1), 'seconds');
              console.log('📦 Game data from IndexedDB:', gameData);
              console.log('🚀 INSTANT START: Using IndexedDB game data');
            
            // Set game data immediately for instant start
            const instantGameData = {
              id: gameData.gameId,
              gameNumber: gameData.gameNumber,
              cartelasSelected: gameData.selectedCartelas.length,
              betAmountPerCartela: gameData.betAmount,
              winMoney: gameData.playerWin,
              status: 'started',
              selectedCartelas: gameData.selectedCartelas,
              totalBet: gameData.totalBet,
              houseCut: gameData.houseCut,
              housePercentage: gameData.housePercentage
            };
            
            setCurrentGameData(instantGameData);
            setSelectedCartelas(gameData.selectedCartelas.length);
            setBetAmount(gameData.betAmount);
            setPlayerWin(gameData.playerWin);
            setCalled([]); // Start with no called numbers
            
            console.log('✅ INSTANT START: Game ready immediately', {
              gameId: instantGameData.id,
              cartelas: gameData.selectedCartelas.length,
              betAmount: gameData.betAmount
            });
            
            // Initialize offline game state for instant play
            try {
              await offlineGameState.initializeGameState(
                instantGameData.id,
                instantGameData,
                []
              );
              console.log('✅ INSTANT START: Offline state initialized');
            } catch (offlineError) {
              console.warn('⚠️ Offline state initialization failed:', offlineError);
            }
            
            setIsInitialLoading(false);
            
            // BACKGROUND: Sync with backend database (non-blocking)
            setTimeout(async () => {
              try {
                console.log('🔄 Background sync: Checking backend for game data...');
                await syncWithBackend();
                
                // Pre-warm audio pool with first 10 numbers for instant playback
                if (audioManagerRef.current) {
                  console.log('🎵 Pre-warming audio pool with first 10 numbers...');
                  await audioManagerRef.current.prewarmAudioPool([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
                  console.log('✅ Audio pool pre-warmed');
                }
              } catch (error) {
                console.warn('⚠️ Background sync failed (game continues with localStorage):', error);
              }
            }, 1000); // Increased delay to give backend more time to save
            
            return; // Exit early - game is ready instantly
          } else {
            console.log('⚠️ IndexedDB game data is too old (>10 minutes) or not found, checking backend...');
          }
        }
      }
      } catch (indexedDBError) {
        console.warn('⚠️ IndexedDB check failed, trying localStorage fallback:', indexedDBError);
        
        // FALLBACK: Try localStorage
        try {
          const localGameSession = localStorage.getItem('currentGameSession');
          const sessionTimestamp = localStorage.getItem('gameSessionTimestamp');
          
          if (localGameSession && sessionTimestamp) {
            const gameData = JSON.parse(localGameSession);
            const timestamp = parseInt(sessionTimestamp);
            const now = Date.now();
            
            if (now - timestamp < 10 * 60 * 1000) {
              console.log('🚀 FALLBACK: Using localStorage game data');
              
              const instantGameData = {
                id: gameData.gameId,
                gameNumber: gameData.gameNumber,
                cartelasSelected: gameData.selectedCartelas.length,
                betAmountPerCartela: gameData.betAmount,
                winMoney: gameData.playerWin,
                status: 'started',
                selectedCartelas: gameData.selectedCartelas,
                totalBet: gameData.totalBet,
                houseCut: gameData.houseCut,
                housePercentage: gameData.housePercentage
              };
              
              setCurrentGameData(instantGameData);
              setSelectedCartelas(gameData.selectedCartelas.length);
              setBetAmount(gameData.betAmount);
              setPlayerWin(gameData.playerWin);
              setCalled([]);
              
              try {
                await offlineGameState.initializeGameState(
                  instantGameData.id,
                  instantGameData,
                  []
                );
              } catch (offlineError) {
                console.warn('⚠️ Offline state initialization failed:', offlineError);
              }
              
              setIsInitialLoading(false);
              
              setTimeout(async () => {
                try {
                  console.log('🔄 Background sync: Checking backend for game data...');
                  await syncWithBackend();
                } catch (error) {
                  console.warn('⚠️ Background sync failed (game continues with localStorage):', error);
                }
              }, 1000);
              
              return;
            }
          }
        } catch (localStorageError) {
          console.error('❌ localStorage fallback also failed:', localStorageError);
        }
      }
      
      // FALLBACK: Load from backend if no valid localStorage data
      await syncWithBackend();
    };
    
    const syncWithBackend = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        
        if (!token) {
          console.log('No auth token, redirecting to play bingo page');
          setCalled([]);
          setIsInitialLoading(false);
          navigate('/newgame', { replace: true });
          return;
        }

        // Fetch active game from backend database
        const response = await fetch(`${API_BASE_URL}/games/active`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const result = await response.json();
          
          if (result.game && ['started', 'active'].includes(result.game.status)) {
            // Active game found in backend database
            console.log('Backend game found:', result.game);
            
            setCurrentGameData(result.game);
            setSelectedCartelas(result.game.cartelasSelected || 0);
            setBetAmount(parseFloat(result.game.betAmountPerCartela) || 5);
            setPlayerWin(parseFloat(result.game.winMoney) || 0);
            setCalled([]);
            
            // Initialize offline game state
            try {
              await offlineGameState.initializeGameState(
                result.game.id,
                result.game,
                []
              );
              
              // Fetch number sequence from API
              try {
                const sequenceResponse = await fetch(`${API_BASE_URL}/games/${result.game.id}/number-sequence`, {
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                  }
                });
                
                if (sequenceResponse.ok) {
                  const sequenceData = await sequenceResponse.json();
                  await offlineGameState.updateNumberSequence(result.game.id, sequenceData.numberSequence);
                  console.log(`✅ Cached ${sequenceData.numberSequence.length} numbers in sequence`);
                } else {
                  console.warn('⚠️ Failed to fetch number sequence:', sequenceResponse.status);
                }
              } catch (seqError) {
                console.warn('⚠️ Failed to fetch number sequence:', seqError);
              }
            } catch (error) {
              console.warn('⚠️ Failed to initialize offline game state:', error);
            }
            
            setIsInitialLoading(false);
            return;
          } else {
            // No active game in backend database
            console.log('No active game in backend, checking localStorage...');
            
            // Check if we have recent localStorage game data
            const localGameSession = localStorage.getItem('currentGameSession');
            const sessionTimestamp = localStorage.getItem('gameSessionTimestamp');
            
            if (localGameSession && sessionTimestamp) {
              const gameData = JSON.parse(localGameSession);
              const timestamp = parseInt(sessionTimestamp);
              const now = Date.now();
              
              // If localStorage data is recent (within 2 minutes), use it and wait for backend
              if (now - timestamp < 2 * 60 * 1000) {
                console.log('🚀 Using recent localStorage game data (backend still syncing)');
                
                const instantGameData = {
                  id: gameData.gameId,
                  gameNumber: gameData.gameNumber,
                  cartelasSelected: gameData.selectedCartelas.length,
                  betAmountPerCartela: gameData.betAmount,
                  winMoney: gameData.playerWin,
                  status: 'started',
                  selectedCartelas: gameData.selectedCartelas,
                  totalBet: gameData.totalBet,
                  houseCut: gameData.houseCut,
                  housePercentage: gameData.housePercentage
                };
                
                setCurrentGameData(instantGameData);
                setSelectedCartelas(gameData.selectedCartelas.length);
                setBetAmount(gameData.betAmount);
                setPlayerWin(gameData.playerWin);
                setCalled([]);
                
                // Initialize offline game state
                try {
                  await offlineGameState.initializeGameState(
                    instantGameData.id,
                    instantGameData,
                    []
                  );
                  console.log('✅ Offline state initialized with localStorage data');
                } catch (offlineError) {
                  console.warn('⚠️ Offline state initialization failed:', offlineError);
                }
                
                setIsInitialLoading(false);
                
                // Retry backend sync after a delay
                setTimeout(async () => {
                  console.log('🔄 Retrying backend sync...');
                  try {
                    const retryResponse = await fetch(`${API_BASE_URL}/games/active`, {
                      headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                      }
                    });
                    
                    if (retryResponse.ok) {
                      const retryResult = await retryResponse.json();
                      if (retryResult.game && ['started', 'active'].includes(retryResult.game.status)) {
                        console.log('✅ Backend sync successful on retry');
                        setCurrentGameData(retryResult.game);
                      }
                    }
                  } catch (retryError) {
                    console.warn('⚠️ Backend retry failed (game continues with localStorage):', retryError);
                  }
                }, 2000);
                
                return;
              } else {
                console.log('⚠️ localStorage game data is too old (>2 minutes)');
              }
            }
            
            // No recent localStorage data, redirect to new game
            setCalled([]);
            setIsInitialLoading(false);
            navigate('/newgame', { replace: true });
          }
        } else if (response.status === 401) {
          // Token expired or invalid - try to refresh token first
          console.error('❌ Authentication failed (401) - Token expired or invalid');
          
          try {
            const refreshResponse = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            });
            
            if (refreshResponse.ok) {
              const refreshData = await refreshResponse.json();
              localStorage.setItem('auth_token', refreshData.token);
              setIsInitialLoading(false);
              window.location.reload();
              return;
            } else {
              localStorage.removeItem('auth_token');
              setIsInitialLoading(false);
              navigate('/login', { replace: true });
            }
          } catch (refreshError) {
            localStorage.removeItem('auth_token');
            setIsInitialLoading(false);
            navigate('/login', { replace: true });
          }
        } else {
          // Other API error (including 404)
          // Check if we have recent local data before redirecting
          const localGameSession = localStorage.getItem('currentGameSession');
          const sessionTimestamp = localStorage.getItem('gameSessionTimestamp');
          
          if (localGameSession && sessionTimestamp) {
            const timestamp = parseInt(sessionTimestamp);
            const now = Date.now();
            
            // If localStorage data is recent (within 5 minutes), use it instead of redirecting
            if (now - timestamp < 5 * 60 * 1000) {
              console.log('⚠️ Backend returned error, but using recent localStorage data');
              const gameData = JSON.parse(localGameSession);
              
              const instantGameData = {
                id: gameData.gameId,
                gameNumber: gameData.gameNumber,
                cartelasSelected: gameData.selectedCartelas.length,
                betAmountPerCartela: gameData.betAmount,
                winMoney: gameData.playerWin,
                status: 'started',
                selectedCartelas: gameData.selectedCartelas,
                totalBet: gameData.totalBet,
                houseCut: gameData.houseCut,
                housePercentage: gameData.housePercentage
              };
              
              setCurrentGameData(instantGameData);
              setSelectedCartelas(gameData.selectedCartelas.length);
              setBetAmount(gameData.betAmount);
              setPlayerWin(gameData.playerWin);
              setCalled([]);
              
              try {
                await offlineGameState.initializeGameState(
                  instantGameData.id,
                  instantGameData,
                  []
                );
              } catch (offlineError) {
                console.warn('⚠️ Offline state initialization failed:', offlineError);
              }
              
              setIsInitialLoading(false);
              return;
            }
          }
          
          // No recent local data, redirect to new game
          setCalled([]);
          setIsInitialLoading(false);
          navigate('/newgame', { replace: true });
        }
        
      } catch (error) {
        console.error('❌ Error checking active game:', error);
        setCalled([]);
        setIsInitialLoading(false);
        navigate('/newgame', { replace: true });
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
  const [isShuffling, setIsShuffling] = useState(false);
  
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
  const [notificationMessage, setNotificationMessage] = useState<string>('');
  
  // Game data
  const [currentGameData, setCurrentGameData] = useState<any>(null);
  
  // WebSocket connection for real-time updates
  useWebSocket({
    gameId: currentGameData?.id,
    onNumberCalled: useCallback((data: any) => {
      console.log('🔔 WebSocket: Number called:', data.calledNumber);
      setCalled(prev => {
        if (prev.includes(data.calledNumber)) {
          return prev;
        }
        const newCalled = [...prev, data.calledNumber];
        // Play audio for the called number
        audioManagerRef.current?.playSound(data.calledNumber);
        return newCalled;
      });
    }, []),
    onGameStatusChanged: useCallback((data: any) => {
      console.log('🔔 WebSocket: Game status changed:', data.status);
      if (data.status === 'finished') {
        setIsGameFinished(true);
        setAutoCall(false);
      }
    }, []),
    onPlayerJoined: useCallback((data: any) => {
      console.log('👋 Player joined:', data.username);
    }, []),
    onPlayerLeft: useCallback((data: any) => {
      console.log('👋 Player left:', data.username);
    }, [])
  });
  
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
  const autoCallPollerRef = useRef<OptimizedPoller | null>(null);
  const audioManagerRef = useRef<UnifiedAudioManager | null>(null);
  const calledRef = useRef<number[]>([]);
  const autoCallRef = useRef<boolean>(false);
  
  // Keep refs in sync with state
  useEffect(() => {
    calledRef.current = called;
  }, [called]);
  
  useEffect(() => {
    autoCallRef.current = autoCall;
  }, [autoCall]);
  
  // Initialize audio manager with UnifiedAudioManager
  useEffect(() => {
    const initializeAudioManager = async () => {
      console.log('🎵 Initializing audio manager...');
      
      // Load voice category using the manager
      console.log('🔑 Loading voice settings...');
      const token = localStorage.getItem('auth_token');
      const voiceCategory = await voiceCategoryManager.loadUserVoiceCategory();
      
      // Initialize audio manager
      console.log('🎵 Creating UnifiedAudioManager...');
      audioManagerRef.current = UnifiedAudioManager.getInstance();
      
      // Only set voice category if we have a user selection
      if (voiceCategory) {
        audioManagerRef.current.setVoiceCategory(voiceCategory);
        console.log('✅ Audio manager initialized with user voice category:', voiceCategory);
      } else {
        console.warn('⚠️ No voice category available - user must select one in Settings');
      }
    };
    
    initializeAudioManager();
    
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
      
      (window as any).checkVoiceCategory = () => {
        const debugInfo = audioManagerRef.current?.getDebugInfo();
        console.log('🎤 Audio Manager Debug Info:', debugInfo);
        return debugInfo;
      };
      
      (window as any).setVoiceCategory = (category: 'boy' | 'girl') => {
        console.log(`🎤 Manually setting voice category to: ${category}`);
        audioManagerRef.current?.setVoiceCategory(category);
      };
    }
    
    return () => {
      // UnifiedAudioManager is a singleton, no cleanup needed
      if (process.env.NODE_ENV === 'development') {
        delete (window as any).testAudio;
        delete (window as any).testAudioMultiple;
      }
    };
  }, [API_BASE_URL]);

  // Pre-warm audio pool when called numbers change
  useEffect(() => {
    if (called.length > 0 && audioManagerRef.current) {
      // Pre-warm the last 10 called numbers for instant replay
      const recentNumbers = called.slice(-10);
      audioManagerRef.current.prewarmAudioPool(recentNumbers).catch(error => {
        console.warn('Failed to pre-warm audio pool:', error);
      });
    }
  }, [called]);

  // Remove polling - game data is already loaded on mount and updated via API calls
  // No need for continuous polling which slows down the system

  // Optimized auto-call - always uses IndexedDB sequence (online and offline)
  useEffect(() => {
    // Stop existing poller
    if (autoCallPollerRef.current) {
      autoCallPollerRef.current.stop();
      autoCallPollerRef.current = null;
    }

    if (autoCall && !isGameFinished && selectedCartelas >= 3) {
      // Create optimized poller - always uses IndexedDB sequence
      autoCallPollerRef.current = createPoller(
        async () => {
          // Stop immediately if autocall was turned off
          if (!autoCallRef.current) {
            console.log('🛑 Autocall turned off, stopping...');
            return;
          }
          
          // Skip if already calling a number
          if (isCallingNumber) return;
          
          // Set calling state to prevent concurrent calls
          setIsCallingNumber(true);
          
          try {
            if (!currentGameData?.id) {
              setAutoCall(false);
              throw new Error('Missing game data');
            }
            
            const gameId = currentGameData.id;

            // Always get next number from IndexedDB sequence
            const nextNumber = await offlineGameState.getNextNumber(gameId);
            
            if (!nextNumber) {
              console.warn('⚠️ No more numbers in sequence');
              setAutoCall(false);
              setIsCallingNumber(false);
              return;
            }

            const timestamp = new Date().toLocaleTimeString();
            const mode = isOnline ? 'ONLINE' : 'OFFLINE';
            console.log(`🎲 [${timestamp}] AUTOCALL (${mode}) - Number ${nextNumber} from IndexedDB sequence`);
            
            // Show the number on screen
            setCalled(prev => {
              if (prev.includes(nextNumber)) {
                console.warn(`⚠️ Number ${nextNumber} already called, skipping duplicate`);
                return prev;
              }
              return [...prev, nextNumber];
            });
            
            // Play sound
            setTimeout(() => {
              audioManagerRef.current?.playSound(nextNumber);
            }, 100);

            // If online, sync to backend (fire and forget)
            if (isOnline) {
              const token = localStorage.getItem('auth_token');
              if (token) {
                fetch(`${API_BASE_URL}/games/${gameId}/call-number`, {
                  method: 'PUT',
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ 
                    calledNumbers: [...calledRef.current, nextNumber],
                    fromSequence: true // Flag to indicate this is from pre-fetched sequence
                  })
                }).catch(error => {
                  console.warn('⚠️ Failed to sync number to backend:', error);
                  // Don't stop autocall on sync failure
                });
              }
            }
          } finally {
            // Always reset calling state
            setIsCallingNumber(false);
          }
        },
        {
          interval: slider * 1000,
          maxInterval: 30000,
          backoffMultiplier: 1.5,
          pauseWhenHidden: true,
          stopOnError: false,
          onError: (error) => {
            console.error('Auto-call error:', error.message);
          }
        }
      );

      autoCallPollerRef.current.start();
    }

    return () => {
      if (autoCallPollerRef.current) {
        autoCallPollerRef.current.stop();
        autoCallPollerRef.current = null;
      }
    };
  }, [autoCall, slider, isGameFinished, selectedCartelas, currentGameData?.id, API_BASE_URL, isOnline]);

  // Memoized handlers
  const handleNumberClick = useCallback((_num: number) => {
    // Numbers can only be called via Next button or Auto Call
  }, []);

  const handleNext = useCallback(async () => {
    if (isGameFinished || selectedCartelas < 3 || isCallingNumber) return;

    setIsCallingNumber(true);
    
    try {
      if (!currentGameData?.id) {
        console.error('Missing game data');
        return;
      }
      
      const gameId = currentGameData.id;

      // Always get next number from IndexedDB sequence
      const nextNumber = await offlineGameState.getNextNumber(gameId);
      
      if (!nextNumber) {
        console.warn('⚠️ No more numbers in sequence');
        setIsCallingNumber(false);
        return;
      }

      const timestamp = new Date().toLocaleTimeString();
      const mode = isOnline ? 'ONLINE' : 'OFFLINE';
      console.log(`🎲 [${timestamp}] MANUAL (${mode}) - Number ${nextNumber} from IndexedDB sequence`);
      
      setCalled(prev => {
        if (prev.includes(nextNumber)) {
          console.warn(`⚠️ Number ${nextNumber} already called, skipping duplicate`);
          return prev;
        }
        return [...prev, nextNumber];
      });
      
      setTimeout(() => {
        audioManagerRef.current?.playSound(nextNumber);
      }, 100);

      // If online, sync to backend (fire and forget)
      if (isOnline) {
        const token = localStorage.getItem('auth_token');
        if (token) {
          fetch(`${API_BASE_URL}/games/${gameId}/call-number`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
              calledNumbers: [...called, nextNumber],
              fromSequence: true
            })
          }).catch(error => {
            console.warn('⚠️ Failed to sync number to backend:', error);
          });
        }
      }
    } catch (error) {
      console.error('Manual next error:', error);
    } finally {
      setIsCallingNumber(false);
    }
  }, [isGameFinished, selectedCartelas, isCallingNumber, called, currentGameData, API_BASE_URL, isOnline]);

  const handleShuffle = useCallback(() => {
    console.log('🔀 Shuffle button clicked - playing shuffle sound and animation');
    console.log('📊 Current game state before shuffle:', {
      gameId: currentGameData?.id,
      gameStatus: currentGameData?.status,
      selectedCartelas,
      calledCount: called.length,
      hasAuthToken: !!localStorage.getItem('auth_token')
    });
    
    // Start shaking animation
    setIsShuffling(true);
    
    // Play shuffle sound using UnifiedAudioManager
    const schedulePlay = (window as any).requestIdleCallback || requestAnimationFrame;
    schedulePlay(() => {
      try {
        if (audioManagerRef.current) {
          audioManagerRef.current.playSound('shuffle-audio-TfqyAnvz.mp3').catch((error) => {
            console.warn('Shuffle audio play failed:', error);
          });
        } else {
          console.warn('Audio manager not available for shuffle sound');
        }
      } catch (error) {
        console.warn('Shuffle audio error:', error);
      }
    });
    
    // Reload page after 6 seconds
    console.log('⏱️ Page will reload in 6 seconds...');
    console.log('🔍 Check browser console after reload for authentication errors');
    setTimeout(() => {
      console.log('🔄 Reloading page now...');
      console.log('📊 Game state at reload:', {
        gameId: currentGameData?.id,
        hasAuthToken: !!localStorage.getItem('auth_token')
      });
      window.location.reload();
    }, 6000);
  }, [currentGameData, selectedCartelas, called.length]);

  const handleFinish = useCallback(async () => {
    setIsGameFinished(true);
    setAutoCall(false);
    
    // Navigate immediately to new game page first
    console.log('🏁 Finish button pressed - navigating to new game page immediately');
    navigate('/newgame', { replace: true });
    
    // Then finish the game in the background
    try {
      const token = localStorage.getItem('auth_token');
      
      if (token && currentGameData?.id) {
        const gameId = currentGameData.id;
        
        if (gameId) {
          // No automatic winner checking - users must manually check cartelas
          console.log('🏁 Finishing game without automatic winner checking');

          // Finish the game session in backend without winner cartela IDs
          const finishData = {
            winMoney: playerWin || 0,
            winnerCartelaIds: [], // Empty - no automatic checking
            calledNumbers: called,
            selectedPattern: selectedPattern
          };

          console.log('🏁 Attempting to finish game session:', {
            url: `${API_BASE_URL}/games/${gameId}/finish-session`,
            gameId: gameId,
            finishData: finishData,
            token: token ? 'Present' : 'Missing'
          });

          const response = await fetch(`${API_BASE_URL}/games/${gameId}/finish-session`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(finishData)
          });

          console.log('🏁 Game finish response:', {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
            headers: Object.fromEntries(response.headers.entries())
          });

          if (response.ok) {
            const finishResult = await response.json();
            console.log('✅ Game finished successfully:', finishResult);
            
            // Show bonus message if bonus was auto-applied
            if (finishResult.bonusMessage) {
              alert(finishResult.bonusMessage);
              // Refresh user data to update balance
              if (refreshUser) {
                await refreshUser();
                console.log('✅ User data refreshed after bonus application');
              }
            }
          } else {
            let errorMessage = `Failed to finish game in backend (HTTP ${response.status})`;
            try {
              const errorData = await response.json();
              console.error('🏁 Game finish error data:', errorData);
              errorMessage = errorData.error || errorData.message || errorMessage;
            } catch (parseError) {
              try {
                const errorText = await response.text();
                console.error('🏁 Game finish error text:', errorText);
                if (errorText) {
                  errorMessage = errorText;
                }
              } catch (textError) {
                console.warn('Could not parse finish error response:', parseError);
              }
            }
            console.error('❌ Game finish failed:', errorMessage);
          }
        }
      }
    } catch (error) {
      console.error('Error finishing game:', error);
    }
  }, [navigate, currentGameData, playerWin, selectedCartelas, betAmount, API_BASE_URL, called, selectedPattern]);

  const handleCheckCartela = useCallback(async () => {
    if (!inputId.trim()) {
      return;
    }

    // Prevent checking cartelas when game is finished
    if (currentGameData?.status === 'finished') {
      console.log('⚠️ Cannot check cartela - game has ended');
      return;
    }

    setCheckingCartela(true);
    
    try {
      const token = localStorage.getItem('auth_token');
      
      if (!token || !currentGameData?.id) {
        setCheckingCartela(false);
        return;
      }
      
      const gameId = currentGameData.id;

      // Get selected cartelas from current game data (already loaded)
      let selectedCartelasArray: string[] = [];
      
      if (currentGameData && currentGameData.selectedCartelas) {
        selectedCartelasArray = Array.isArray(currentGameData.selectedCartelas)
          ? currentGameData.selectedCartelas
          : (typeof currentGameData.selectedCartelas === 'string' 
              ? JSON.parse(currentGameData.selectedCartelas)
              : []);
      }
      
      console.log('🎯 Selected cartelas for this game:', selectedCartelasArray);
      console.log('🔍 Checking cartela:', inputId.trim());
      
      // Check if cartela is in selected cartelas
      const isSelected = selectedCartelasArray.includes(inputId.trim());
      
      if (!isSelected) {
        // Show simple notification message for 2 seconds - NO SOUND for unregistered cartelas
        setNotificationMessage(`Cartela ${inputId.trim()} not registered`);
        
        // Clear message after 2 seconds
        setTimeout(() => {
          setNotificationMessage('');
        }, 2000);
        
        setCheckingCartela(false);
        setInputId(''); // Clear input
        return;
      }

      // Use called numbers from state only (database is source of truth)
      let calledNumbersToSend = called;

      console.log(`🎯 Checking cartela ${inputId.trim()} with ${calledNumbersToSend.length} called numbers`);
      console.log(`🎮 Game ID:`, gameId);
      console.log(`📋 Selected pattern:`, selectedPattern);

      // Check if we're online or offline
      if (isOnline) {
        // ONLINE MODE: Use API call
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
          
          // Play sound based on result using UnifiedAudioManager
          const schedulePlay = (window as any).requestIdleCallback || requestAnimationFrame;
          schedulePlay(() => {
            try {
              const soundName = result.win ? 'winner' : 'notwinner';
              console.log(`🔊 Playing ${soundName} sound with voice category`);
              
              if (audioManagerRef.current) {
                audioManagerRef.current.playSound(soundName).catch((error) => {
                  console.warn(`⚠️ Could not play ${soundName} sound:`, error);
                });
              } else {
                console.warn('⚠️ Audio manager not available for winner sound');
              }
            } catch (error) {
              console.warn('⚠️ Error playing winner sound:', error);
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
      } else {
        // OFFLINE MODE: Use local pattern detection
        console.log('🔌 OFFLINE MODE: Checking cartela locally');
        
        try {
          // Import pattern detection utilities
          const { checkWinningPatterns, validateCartela, countCompletedLines, convertCartelaToGrid } = await import('../utils/patternDetection');
          const { offlineStorage } = await import('../utils/offlineStorage');
          
          // Get cartela data from offline storage
          const cartelas = await offlineStorage.getCartelas();
          const cartela = cartelas.find(c => c.card_id === inputId.trim());
          
          if (!cartela) {
            setCartelaCheckResult({
              success: false,
              cartelaId: inputId.trim(),
              gameId: gameId,
              win: false,
              cardType: 'error',
              soundType: 'notwinner',
              winningPatterns: [],
              calledNumbersCount: called.length,
              message: `Cartela ${inputId.trim()} not found in offline storage. Please sync when online.`
            });
            setShowCartelaCheckModal(true);
            return;
          }
          
          console.log('📋 Found cartela in offline storage:', cartela);
          
          // Validate cartela structure
          if (!validateCartela(cartela)) {
            setCartelaCheckResult({
              success: false,
              cartelaId: inputId.trim(),
              gameId: gameId,
              win: false,
              cardType: 'error',
              soundType: 'notwinner',
              winningPatterns: [],
              calledNumbersCount: called.length,
              message: 'Invalid cartela data structure'
            });
            setShowCartelaCheckModal(true);
            return;
          }
          
          // Check winning patterns using offline logic
          const winningPatterns = checkWinningPatterns(calledNumbersToSend, cartela, [selectedPattern]);
          const isWinner = winningPatterns.length > 0;
          
          // Get completed lines for display
          const grid = convertCartelaToGrid(cartela);
          const { lines: completedLines } = countCompletedLines(grid, calledNumbersToSend);
          
          console.log(`🎯 OFFLINE RESULT: ${isWinner ? 'WINNER' : 'NO WIN'}`);
          console.log(`🏆 Winning patterns: ${winningPatterns.join(', ')}`);
          console.log(`📏 Completed lines: ${completedLines.join(', ')}`);
          
          // Create result object similar to API response
          const result = {
            success: true,
            cartelaId: inputId.trim(),
            gameId: gameId,
            win: isWinner,
            cardType: isWinner ? 'win' : 'stillnotwin',
            soundType: isWinner ? 'winner' : 'notwinner',
            winningPatterns: winningPatterns,
            calledNumbersCount: called.length,
            message: isWinner 
              ? `Winner! Pattern: ${winningPatterns.join(', ')}`
              : `Not a winner yet. Completed ${completedLines.length} lines.`,
            cartela: {
              ...cartela,
              completedLines: completedLines
            }
          };
          
          setCartelaCheckResult(result);
          setShowCartelaCheckModal(true);
          
          // Play sound based on result
          const schedulePlay = (window as any).requestIdleCallback || requestAnimationFrame;
          schedulePlay(() => {
            try {
              const soundName = result.win ? 'winner' : 'notwinner';
              console.log(`🔊 Playing ${soundName} sound with voice category (offline)`);
              
              if (audioManagerRef.current) {
                audioManagerRef.current.playSound(soundName).catch((error) => {
                  console.warn(`⚠️ Could not play ${soundName} sound:`, error);
                });
              } else {
                console.warn('⚠️ Audio manager not available for winner sound');
              }
            } catch (error) {
              console.warn('⚠️ Error playing winner sound:', error);
            }
          });
          
        } catch (error) {
          console.error('❌ Offline cartela check error:', error);
          setCartelaCheckResult({
            success: false,
            cartelaId: inputId.trim(),
            gameId: gameId,
            win: false,
            cardType: 'error',
            soundType: 'notwinner',
            winningPatterns: [],
            calledNumbersCount: called.length,
            message: 'Failed to check cartela offline. Please try again.'
          });
          setShowCartelaCheckModal(true);
        }
      }
    } catch (error) {
      console.error('Error checking cartela:', error);
      
      // Check if it's a network error
      const isNetworkError = error instanceof TypeError && 
                            (error.message.includes('fetch') || 
                             error.message.includes('Failed to fetch') ||
                             error.message.includes('NetworkError'));
      
      // Show appropriate error message
      setCartelaCheckResult({
        success: false,
        cartelaId: inputId.trim(),
        gameId: '',
        win: false,
        cardType: isNetworkError ? 'offline' : 'error',
        soundType: 'notwinner',
        winningPatterns: [],
        calledNumbersCount: called.length,
        message: isNetworkError 
          ? 'Network error occurred. Switching to offline mode...'
          : 'Failed to check cartela. Please try again.'
      });
      setShowCartelaCheckModal(true);
    } finally {
      setCheckingCartela(false);
    }
  }, [inputId, selectedPattern, currentGameData, called, API_BASE_URL, isOnline]);

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

  // Show loading screen while checking for active game
  if (isInitialLoading) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "#0F172A",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "20px"
      }}>
        <div style={{
          width: "60px",
          height: "60px",
          border: "4px solid rgba(255, 215, 0, 0.2)",
          borderTop: "4px solid #FFD700",
          borderRadius: "50%",
          animation: "spin 1s linear infinite"
        }} />
        <p style={{ fontSize: "18px", color: "#FFD700" }}>Loading game...</p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0F172A",
      color: "#fff",
      padding: "clamp(10px, 3vw, 50px) clamp(5px, 2vw, 60px)",
      boxSizing: "border-box",
      overflowX: "hidden"
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
          
          @keyframes shake {
            0%, 100% {
              transform: translateX(0) rotate(0deg);
            }
            10% {
              transform: translateX(-2px) rotate(-2deg);
            }
            20% {
              transform: translateX(2px) rotate(2deg);
            }
            30% {
              transform: translateX(-2px) rotate(-1deg);
            }
            40% {
              transform: translateX(2px) rotate(1deg);
            }
            50% {
              transform: translateX(-1px) rotate(-2deg);
            }
            60% {
              transform: translateX(1px) rotate(2deg);
            }
            70% {
              transform: translateX(-2px) rotate(-1deg);
            }
            80% {
              transform: translateX(2px) rotate(1deg);
            }
            90% {
              transform: translateX(-1px) rotate(-2deg);
            }
          }
          
          @keyframes slideDown {
            0% {
              transform: translateX(-50%) translateY(-20px);
              opacity: 0;
            }
            100% {
              transform: translateX(-50%) translateY(0);
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
          GAME <span style={{ color: "#FFD700" }}>{currentGameData?.gameNumber || "..."}</span>
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
          TOTAL BET {Math.round(betAmount * selectedCartelas)} BIRR
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
        maxWidth: "100%",
        overflowX: "auto",
        overflowY: "hidden"
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
          minWidth: 0,
          maxWidth: "100%",
          overflow: "hidden"
        }}>
          <NumberGrid 
            numbers={BINGO_NUMBERS}
            called={called}
            isGameFinished={isGameFinished}
            onNumberClick={handleNumberClick}
            isShuffling={isShuffling}
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
        {/* Offline Mode Indicator */}
        {!isOnline && (
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            background: "linear-gradient(135deg, rgba(255, 165, 0, 0.15), rgba(255, 140, 0, 0.08))",
            padding: "6px 10px",
            borderRadius: "8px",
            border: "1px solid rgba(255, 165, 0, 0.4)",
            boxShadow: "0 2px 6px rgba(0, 0, 0, 0.3)"
          }}>
            <div style={{
              fontSize: "14px",
              filter: "drop-shadow(0 1px 2px rgba(255, 165, 0, 0.3))"
            }}>
              📱
            </div>
            <div style={{
              fontSize: "12px",
              color: "#FFD700",
              fontWeight: "bold",
              textShadow: "0 1px 2px rgba(0, 0, 0, 0.5)"
            }}>
              OFFLINE
            </div>
          </div>
        )}
        {/* Auto Call Timer - Compact */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          background: "linear-gradient(135deg, rgba(255, 165, 0, 0.15), rgba(255, 140, 0, 0.08))",
          padding: "6px 10px",
          borderRadius: "8px",
          border: "1px solid rgba(255, 165, 0, 0.4)",
          boxShadow: "0 2px 6px rgba(0, 0, 0, 0.3)"
        }}>
          <div style={{
            fontSize: "14px",
            filter: "drop-shadow(0 1px 2px rgba(255, 165, 0, 0.3))"
          }}>
            ⏱️
          </div>
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "2px"
          }}>
            <div style={{
              fontSize: "8px",
              color: "#cbd5e1",
              fontWeight: "600",
              textTransform: "uppercase",
              letterSpacing: "0.5px"
            }}>
              Speed
            </div>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}>
              <div style={{
                position: "relative" as const,
                width: "80px",
                paddingTop: "4px",
                paddingBottom: "4px"
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
                        width: "1px",
                        height: slider === tick ? "6px" : "4px",
                        background: slider >= tick 
                          ? "rgba(255, 215, 0, 0.8)" 
                          : "rgba(100, 100, 100, 0.5)",
                        borderRadius: "0.5px",
                        transition: "all 0.2s ease"
                      }}
                    />
                  ))}
                </div>
                
                {/* Track background */}
                <div style={{
                  height: "6px",
                  background: "rgba(30, 30, 30, 0.9)",
                  borderRadius: "3px",
                  position: "relative" as const,
                  boxShadow: "inset 0 1px 2px rgba(0,0,0,0.5)"
                }}>
                  {/* Filled track */}
                  <div style={{
                    width: `${((slider - 3) / (7 - 3)) * 100}%`,
                    height: "100%",
                    background: "linear-gradient(90deg, #FF8C00, #FFA500, #FFD700)",
                    borderRadius: "3px",
                    transition: "width 0.3s ease",
                    boxShadow: "0 0 6px rgba(255, 165, 0, 0.7)"
                  }} />
                  
                  {/* Custom thumb */}
                  <div style={{
                    position: "absolute" as const,
                    top: "50%",
                    left: `${((slider - 3) / (7 - 3)) * 100}%`,
                    transform: "translate(-50%, -50%)",
                    width: "12px",
                    height: "12px",
                    background: "radial-gradient(circle at 30% 30%, #FFD700, #FFA500)",
                    borderRadius: "50%",
                    border: "2px solid #1e293b",
                    boxShadow: "0 0 0 1px #FFA500, 0 2px 4px rgba(0, 0, 0, 0.5)",
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
                fontSize: "12px",
                minWidth: "20px",
                textAlign: "center" as const,
                background: "linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(255, 165, 0, 0.1))",
                padding: "2px 4px",
                borderRadius: "4px",
                border: "1px solid rgba(255, 215, 0, 0.5)",
                boxShadow: "0 1px 4px rgba(255, 215, 0, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.2)",
                textShadow: "0 1px 2px rgba(0, 0, 0, 0.5)"
              }}>
                {slider}s
              </span>
            </div>
          </div>
        </div>
        <input
          type="text"
          placeholder={currentGameData?.status === 'finished' ? "Game Ended" : "Enter ID"}
          value={inputId}
          onChange={(e) => setInputId(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter' && !checkingCartela && currentGameData?.status !== 'finished') {
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
            boxSizing: "border-box",
            opacity: currentGameData?.status === 'finished' ? 0.5 : 1
          }}
          disabled={checkingCartela || currentGameData?.status === 'finished'}
        />
        <button
          style={{
            ...btnStyle,
            fontSize: "clamp(12px, 2.5vw, 16px)",
            padding: "clamp(8px, 2vw, 12px) clamp(12px, 3vw, 24px)",
            margin: 0,
            background: (checkingCartela || currentGameData?.status === 'finished')
              ? "linear-gradient(180deg, #666 0%, #444 100%)"
              : "linear-gradient(180deg, #FFA500 0%, #FF8C00 100%)",
            cursor: (checkingCartela || currentGameData?.status === 'finished') ? "not-allowed" : "pointer",
            opacity: (checkingCartela || currentGameData?.status === 'finished') ? 0.5 : 1,
            whiteSpace: "nowrap" as const
          }}
          onClick={handleCheckCartela}
          disabled={checkingCartela || currentGameData?.status === 'finished'}
        >
          {checkingCartela ? "..." : currentGameData?.status === 'finished' ? "Game Ended" : "Check"}
        </button>
        
        {/* Notification Message */}
        {notificationMessage && (
          <div style={{
            position: "fixed",
            top: "20px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "linear-gradient(135deg, #FF6B6B 0%, #C92A2A 100%)",
            color: "#fff",
            padding: "12px 24px",
            borderRadius: "8px",
            fontSize: "clamp(14px, 2.5vw, 16px)",
            fontWeight: "bold",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.5)",
            zIndex: 2000,
            animation: "slideDown 0.3s ease-out",
            border: "2px solid rgba(255, 255, 255, 0.3)"
          }}>
            {notificationMessage}
          </div>
        )}
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
                          // Define line patterns - MUST match names from patternDetection.ts
                          const linePatterns: Record<string, [number, number][]> = {
                            "Top Row": [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]],
                            "Second Row": [[1, 0], [1, 1], [1, 2], [1, 3], [1, 4]],
                            "Third Row": [[2, 0], [2, 1], [2, 2], [2, 3], [2, 4]],
                            "Fourth Row": [[3, 0], [3, 1], [3, 2], [3, 3], [3, 4]],
                            "Bottom Row": [[4, 0], [4, 1], [4, 2], [4, 3], [4, 4]],
                            "B Column": [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]],
                            "I Column": [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1]],
                            "N Column": [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2]],
                            "G Column": [[0, 3], [1, 3], [2, 3], [3, 3], [4, 3]],
                            "O Column": [[0, 4], [1, 4], [2, 4], [3, 4], [4, 4]],
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
                            // Called but not part of winning line - Gold
                            bgColor = "linear-gradient(180deg, #FFD700 0%, #FFA500 100%)";
                            textColor = "#000000";
                            borderColor = "1px solid #FFD700";
                            boxShadow = "0 2px 4px rgba(255, 215, 0, 0.6)";
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