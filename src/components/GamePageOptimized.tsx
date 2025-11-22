// @ts-ignore
import { checkWinningPatterns, validateCartela } from "../utils/patternDetection.js";
import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
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
      gap: "clamp(3px, 0.8vw, 10px)",
      maxWidth: "700px",
      width: "100%",
      padding: "0 5px"
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
    maxWidth: "clamp(40px, 7vw, 50px)",
    maxHeight: "clamp(40px, 7vw, 50px)",
    background: isCalled
      ? (isPopupNumber ? "#FF6B6B" : "#FFD700")
      : "#c00",
    color: "#007BFF",
    border: isCalled ? "2px solid #FFD700" : "2px solid #f00",
    borderRadius: 8,
    fontWeight: "bold" as const,
    fontSize: "clamp(16px, 3vw, 22px)",
    cursor: "default" as const,
    transition: "all 0.2s ease", // Reduced from 0.3s for better performance
    transform: isCalled ? "scale(1.05)" : "scale(1)",
    boxShadow: isCalled
      ? "0 0 15px rgba(255, 215, 0, 0.6)"
      : "0 2px 4px rgba(0,0,0,0.2)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  }), [isCalled, isPopupNumber]);

  return (
    <button
      style={buttonStyle}
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
          const firstKey = this.cache.keys().next().value;
          const oldAudio = this.cache.get(firstKey);
          if (oldAudio) {
            oldAudio.pause();
            oldAudio.src = '';
          }
          this.cache.delete(firstKey);
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

const GamePageOptimized = ({ onNavigateToLottery, selectedCartelaNumbers = [] }: GamePageProps): JSX.Element => {
  const navigate = useNavigate();
  const { cartelas } = useCartela();
  const { checkWinner, callNumber, calledNumbers } = useBingo(5);
  const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
  
  // Core game state
  const [called, setCalled] = useState<number[]>([]);
  const [autoCall, setAutoCall] = useState(false);
  const [slider, setSlider] = useState(5);
  const [inputId, setInputId] = useState("");
  const [isGameFinished, setIsGameFinished] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [popupNumber, setPopupNumber] = useState<number | null>(null);
  
  // Check for active game on component mount
  useEffect(() => {
    const checkActiveGame = () => {
      const currentGame = localStorage.getItem('currentGame');
      
      if (!currentGame) {
        // No active game found, redirect to NewGame (play bingo page)
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
        
        // Valid game found, set up the game state
        setSelectedCartelas(gameData.selectedCartelas.length);
        setBetAmount(gameData.betAmount || 10);
        setTotalBet(gameData.totalBet || 0);
        setPlayerWin(gameData.playerWin || 0);
        
        // Load called numbers if they exist
        const savedCalledNumbers = localStorage.getItem('calledNumbers');
        if (savedCalledNumbers) {
          try {
            const parsedCalled = JSON.parse(savedCalledNumbers);
            setCalled(parsedCalled);
          } catch (error) {
            console.error('Error parsing saved called numbers:', error);
          }
        }
        
      } catch (error) {
        console.error('Error parsing current game data:', error);
        navigate('/newgame', { replace: true });
      }
    };
    
    checkActiveGame();
  }, [navigate]);
  
  // Game configuration
  const [selectedCartelas, setSelectedCartelas] = useState(0);
  const [betAmount, setBetAmount] = useState(10);
  const [totalBet, setTotalBet] = useState(0);
  const [playerWin, setPlayerWin] = useState(0);
  const [selectedPattern, setSelectedPattern] = useState<string>("Two Lines");
  
  // UI state
  const [isCallingNumber, setIsCallingNumber] = useState(false);
  const [isShuffling, setIsShuffling] = useState(false);
  const [showWinModal, setShowWinModal] = useState(false);
  const [winningPatterns, setWinningPatterns] = useState<string[]>([]);
  const [currentWinningPattern, setCurrentWinningPattern] = useState<string>("");
  
  // Modal state
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
    
    // Navigate after short delay
    setTimeout(() => {
      navigate('/newgame');
    }, 1000);
  }, [navigate]);

  // Memoized styles
  const btnStyle = useMemo(() => ({
    background: "linear-gradient(180deg, #FFD700 0%, #FFA500 100%)",
    color: "#222",
    fontWeight: "bold" as const,
    fontSize: 18,
    border: "none",
    borderRadius: 8,
    padding: "8px 18px",
    marginRight: 8,
    cursor: "pointer" as const,
    boxShadow: "0 2px 4px rgba(0,0,0,0.4)",
    transition: "all 0.2s ease",
  }), []);

  return (
    <div className="p-2 sm:p-4 lg:p-8 max-w-7xl mx-auto relative">
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)",
        borderRadius: 12,
        padding: "clamp(8px, 2vw, 16px)",
        marginBottom: "clamp(16px, 4vw, 32px)",
        border: "2px solid #FFD700",
        boxShadow: "0 4px 8px rgba(0,0,0,0.3)"
      }}>
        <div style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "clamp(4px, 1vw, 8px)",
          justifyContent: "center"
        }}>
          <button style={{
            ...btnStyle,
            fontSize: "clamp(12px, 2.5vw, 18px)",
            padding: "4px 8px",
            marginRight: "4px",
            whiteSpace: "nowrap" as const
          }}>
            {isGameFinished ? "FINISHED" : "STARTED"}
          </button>
          <button style={{
            ...btnStyle,
            fontSize: "clamp(12px, 2.5vw, 18px)",
            padding: "4px 8px",
            marginRight: "4px",
            whiteSpace: "nowrap" as const
          }}>
            BET {betAmount}
          </button>
          <button style={{
            ...btnStyle,
            fontSize: "clamp(12px, 2.5vw, 18px)",
            padding: "4px 8px",
            marginRight: "4px",
            whiteSpace: "nowrap" as const
          }}>
            WIN {playerWin.toFixed(2)}
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
            whiteSpace: "nowrap" as const
          }}>
            {selectedCartelas} CARTELA{selectedCartelas !== 1 ? 'S' : ''}
          </button>
          <button style={{
            ...btnStyle,
            fontSize: "clamp(12px, 2.5vw, 18px)",
            padding: "4px 8px",
            marginRight: "4px",
            whiteSpace: "nowrap" as const
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
              whiteSpace: "nowrap" as const
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
        {/* BINGO letters */}
        <div style={{
          display: "flex",
          justifyContent: "center",
          gap: "clamp(4px, 1vw, 16px)",
          marginBottom: "clamp(8px, 2vw, 16px)",
          width: "100%",
          maxWidth: "600px"
        }}>
          {BINGO_LETTERS.map((letter) => (
            <div key={letter} style={{
              background: "linear-gradient(180deg, #FFD700 0%, #FFA500 100%)",
              color: "#222",
              fontWeight: "bold",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 4px rgba(0,0,0,0.4)",
              textShadow: "1px 1px 2px rgba(0,0,0,0.3)",
              width: "clamp(32px, 8vw, 48px)",
              height: "clamp(32px, 8vw, 48px)",
              fontSize: "clamp(16px, 4vw, 28px)"
            }}>
              {letter}
            </div>
          ))}
        </div>

        {/* Optimized Numbers grid */}
        <NumberGrid 
          numbers={BINGO_NUMBERS}
          called={called}
          showPopup={showPopup}
          popupNumber={popupNumber}
          isGameFinished={isGameFinished}
          onNumberClick={handleNumberClick}
        />
      </div>

      {/* Controls */}
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "clamp(6px, 1.5vw, 12px)",
        marginTop: "clamp(8px, 2vw, 16px)",
        justifyContent: "center",
        padding: "0 5px"
      }}>
        {!isGameFinished && (
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
                cursor: selectedCartelas >= 3 ? "pointer" : "not-allowed",
                opacity: selectedCartelas >= 3 ? 1 : 0.5,
                whiteSpace: "nowrap" as const
              }}
              onClick={() => selectedCartelas >= 3 && setAutoCall(a => !a)}
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
                fontSize: "clamp(12px, 2.5vw, 18px)",
                padding: "clamp(4px, 1vw, 8px) clamp(8px, 2vw, 18px)",
                margin: 0,
                background: selectedCartelas >= 3
                  ? "linear-gradient(180deg, #FFD700 0%, #FFA500 100%)"
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
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "clamp(4px, 1vw, 8px)",
              opacity: selectedCartelas >= 3 ? 1 : 0.5
            }}>
              <span style={{
                fontSize: "clamp(14px, 3vw, 18px)",
                color: "#FFD700",
                fontWeight: "bold",
                whiteSpace: "nowrap" as const
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
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default GamePageOptimized;