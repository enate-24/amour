import React, { useState, useEffect, useRef } from "react";

// Define Cartela interface locally since we're not using Supabase
interface Cartela {
  id: string;
  card_id: string;
  numbers: number[][];
  is_winner: boolean;
  winning_pattern?: string;
  created_at: string;
}

interface selectcartelaProps {
  onNavigateToGame?: (selectedNumbers: number[]) => void;
}

const Selectcartela: React.FC<selectcartelaProps> = ({ onNavigateToGame }) => {
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [betAmount, setBetAmount] = useState(10);
  const [winAmount, setWinAmount] = useState(22.50);
  const [housePercentage, setHousePercentage] = useState(25);
  const [rememberSelection, setRememberSelection] = useState(true);
  const [gamesPlayed] = useState(14);
  const [bonusPlayed] = useState(0);

  // Database state
  const [cartelas, setCartelas] = useState<Cartela[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCartela, setSelectedCartela] = useState<string | null>(null);

  // Fetch cartelas from database
  useEffect(() => {
    const fetchCartelas = async () => {
      try {
        setLoading(true);
        const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
        const response = await fetch(`${API_BASE_URL}/cartelas`, {
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (data && data.cartelas) {
          // Transform the data to match our expected format
          const transformedCartelas: Cartela[] = data.cartelas.map((item: any) => ({
            id: item.id,
            card_id: item.card_id,
            numbers: item.numbers as number[][],
            is_winner: item.is_winner,
            winning_pattern: item.winning_pattern,
            created_at: item.created_at
          }));
          setCartelas(transformedCartelas);
        }
      } catch (error) {
        console.error('Error fetching cartelas:', error);
        alert('Error connecting to database. Please check your backend configuration.');
      } finally {
        setLoading(false);
      }
    };

    fetchCartelas();
  }, []);

  // Handle cartela selection
  const handleCartelaSelect = (cartela: Cartela) => {
    setSelectedCartela(cartela.id);
    // Flatten the 5x5 grid into a single array of numbers
    const allNumbers = cartela.numbers.flat();
    setSelectedNumbers(allNumbers);
  };

  // Game state
  const [gamePhase, setGamePhase] = useState<'selection' | 'drawing' | 'results'>('selection');
  const [drawnNumbers, setDrawnNumbers] = useState<number[]>([]);
  const [winningNumbers, setWinningNumbers] = useState<number[]>([]);
  const [isDrawing] = useState(false);
  const [showPopup] = useState(false);
  const [popupNumber] = useState<number | null>(null);
  const [gameResult, setGameResult] = useState<'win' | 'lose' | null>(null);
  const [matches, setMatches] = useState(0);
  const [totalWinnings, setTotalWinnings] = useState(0);


  // Generate numbers up to 161+
  const generateNumbers = () => {
    const numbers = [];
    for (let i = 1; i <= 161; i++) {
      numbers.push(i);
    }
    return numbers;
  };

  const numbers = generateNumbers();

  const handleNumberClick = (num: number) => {
    setSelectedNumbers(prev => {
      if (prev.includes(num)) {
        return prev.filter(n => n !== num);
      } else if (prev.length < 20) { // Assuming max 20 selections
        return [...prev, num];
      }
      return prev;
    });
  };

  // Game logic functions
  const handleStartGame = () => {
    if (selectedNumbers.length === 0) {
      alert("Please select at least 1 number to play!");
      return;
    }

    if (betAmount <= 0) {
      alert("Please enter a valid bet amount!");
      return;
    }

    // Navigate to GamePage with selected cartela numbers
    if (onNavigateToGame) {
      onNavigateToGame(selectedNumbers);
    }
  };



  const handleCartelaCheck = () => {
    if (selectedNumbers.length === 0) {
      alert("Please select numbers first!");
      return;
    }
    alert(`Selected ${selectedNumbers.length} numbers: ${selectedNumbers.join(', ')}`);
  };

  const handleEnterID = async () => {
    const id = prompt("Enter Cartela ID:");
    if (id) {
      try {
        const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
        const response = await fetch(`${API_BASE_URL}/cartelas/${id}`, {
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          if (response.status === 404) {
            alert(`No cartela found with ID: ${id}`);
          } else {
            alert(`Error fetching cartela: ${response.statusText}`);
          }
          return;
        }

        const data = await response.json();

        if (data && data.cartela) {
          const cartela: Cartela = {
            id: data.cartela.id,
            card_id: data.cartela.card_id,
            numbers: data.cartela.numbers as number[][],
            is_winner: data.cartela.is_winner,
            winning_pattern: data.cartela.winning_pattern,
            created_at: data.cartela.created_at
          };

          handleCartelaSelect(cartela);
          alert(`Cartela ${id} loaded successfully!`);
        }
      } catch (error) {
        console.error('Error fetching cartela by ID:', error);
        alert('Error loading cartela. Please try again.');
      }
    }
  };

  const handlePlayAgain = () => {
    setGamePhase('selection');
    setDrawnNumbers([]);
    setWinningNumbers([]);
    setGameResult(null);
    setMatches(0);
    setTotalWinnings(0);
    // Keep selected numbers if remember selection is enabled
  };

  const handleNewSelection = () => {
    setGamePhase('selection');
    setSelectedNumbers([]);
    setDrawnNumbers([]);
    setWinningNumbers([]);
    setGameResult(null);
    setMatches(0);
    setTotalWinnings(0);
  };

  // Group numbers into rows of 20
  const rows = [];
  for (let i = 0; i < numbers.length; i += 20) {
    rows.push(numbers.slice(i, i + 20));
  }

  return (
    <div style={{ background: "#f5f5f5", minHeight: "100vh", color: "#333", fontFamily: "Arial, sans-serif" }}>
      {/* Top Number Display */}
      <div style={{ display: "flex", justifyContent: "center", gap: "20px", padding: "30px 0", background: "#fff" }}>
        <div style={{
          width: "80px",
          height: "80px",
          background: "#333",
          color: "#fff",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "24px",
          fontWeight: "bold",
          boxShadow: "0 4px 8px rgba(0,0,0,0.2)"
        }}>
          58
        </div>
        <div style={{
          width: "80px",
          height: "80px",
          background: "#333",
          color: "#fff",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "24px",
          fontWeight: "bold",
          boxShadow: "0 4px 8px rgba(0,0,0,0.2)"
        }}>
          62
        </div>
        <div style={{
          width: "80px",
          height: "80px",
          background: "#333",
          color: "#fff",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "24px",
          fontWeight: "bold",
          boxShadow: "0 4px 8px rgba(0,0,0,0.2)"
        }}>
          12
        </div>
      </div>

      {/* Game Stats */}
      <div style={{ textAlign: "center", padding: "20px 0", background: "#fff", borderBottom: "1px solid #ddd" }}>
        <div style={{ fontSize: "18px", color: "#666" }}>
          Games Played: {gamesPlayed} Bonus Played: {bonusPlayed}
        </div>
      </div>

      {/* Bet Controls */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "20px", padding: "30px 0", background: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "16px", color: "#666" }}>Bet Birr:</span>
          <button
            onClick={() => gamePhase === 'selection' && setBetAmount(prev => Math.max(5, prev - 5))}
            disabled={gamePhase !== 'selection'}
            style={{
              width: "30px",
              height: "30px",
              borderRadius: "50%",
              background: gamePhase === 'selection' ? "#ddd" : "#ccc",
              border: "none",
              fontSize: "18px",
              cursor: gamePhase === 'selection' ? "pointer" : "not-allowed",
              opacity: gamePhase === 'selection' ? 1 : 0.5,
            }}
          >
            −
          </button>
          <input
            type="number"
            value={betAmount}
            onChange={(e) => gamePhase === 'selection' && setBetAmount(Number(e.target.value))}
            disabled={gamePhase !== 'selection'}
            style={{
              width: "60px",
              height: "30px",
              textAlign: "center",
              border: "1px solid #ddd",
              borderRadius: "4px",
              fontSize: "16px",
              opacity: gamePhase === 'selection' ? 1 : 0.5,
              backgroundColor: gamePhase === 'selection' ? "#fff" : "#f5f5f5",
            }}
          />
          <button
            onClick={() => gamePhase === 'selection' && setBetAmount(prev => prev + 1)}
            disabled={gamePhase !== 'selection'}
            style={{
              width: "30px",
              height: "30px",
              borderRadius: "50%",
              background: gamePhase === 'selection' ? "#ddd" : "#ccc",
              border: "none",
              fontSize: "18px",
              cursor: gamePhase === 'selection' ? "pointer" : "not-allowed",
              opacity: gamePhase === 'selection' ? 1 : 0.5,
            }}
          >
            +
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "16px", color: "#666" }}>Win Birr:</span>
          <input
            type="number"
            value={winAmount}
            onChange={(e) => gamePhase === 'selection' && setWinAmount(Number(e.target.value))}
            disabled={gamePhase !== 'selection'}
            style={{
              width: "80px",
              height: "30px",
              textAlign: "center",
              border: "1px solid #ddd",
              borderRadius: "4px",
              fontSize: "16px",
              opacity: gamePhase === 'selection' ? 1 : 0.5,
              backgroundColor: gamePhase === 'selection' ? "#fff" : "#f5f5f5",
            }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "16px", color: "#666" }}>House</span>
          <select
            value={housePercentage}
            onChange={(e) => gamePhase === 'selection' && setHousePercentage(Number(e.target.value))}
            disabled={gamePhase !== 'selection'}
            style={{
              height: "30px",
              border: "1px solid #ddd",
              borderRadius: "4px",
              fontSize: "16px",
              padding: "0 10px",
              opacity: gamePhase === 'selection' ? 1 : 0.5,
              backgroundColor: gamePhase === 'selection' ? "#fff" : "#f5f5f5",
            }}
          >
            <option value={25}>25%</option>
            <option value={20}>20%</option>
            <option value={15}>15%</option>
            <option value={10}>10%</option>
          </select>
          <button
            disabled={gamePhase !== 'selection'}
            style={{
              width: "30px",
              height: "30px",
              borderRadius: "50%",
              background: gamePhase === 'selection' ? "#666" : "#ccc",
              color: "#fff",
              border: "none",
              fontSize: "16px",
              cursor: gamePhase === 'selection' ? "pointer" : "not-allowed",
              opacity: gamePhase === 'selection' ? 1 : 0.5,
            }}
          >
            ⚙️
          </button>
        </div>

        <button
          onClick={handleCartelaCheck}
          disabled={gamePhase !== 'selection'}
          style={{
            background: gamePhase === 'selection' ? "#6b46c1" : "#ccc",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            padding: "10px 20px",
            fontSize: "16px",
            fontWeight: "bold",
            cursor: gamePhase === 'selection' ? "pointer" : "not-allowed",
            opacity: gamePhase === 'selection' ? 1 : 0.5,
          }}
        >
          Cartela Check ⚡
        </button>

        <button
          onClick={handleEnterID}
          disabled={gamePhase !== 'selection'}
          style={{
            background: gamePhase === 'selection' ? "#10b981" : "#ccc",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            padding: "10px 20px",
            fontSize: "16px",
            fontWeight: "bold",
            cursor: gamePhase === 'selection' ? "pointer" : "not-allowed",
            opacity: gamePhase === 'selection' ? 1 : 0.5,
          }}
        >
          Enter ID (Fast)
        </button>

        <button
          onClick={handleStartGame}
          disabled={gamePhase !== 'selection'}
          style={{
            background: gamePhase === 'selection' ? "#10b981" : "#ccc",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            padding: "12px 24px",
            fontSize: "16px",
            fontWeight: "bold",
            cursor: gamePhase === 'selection' ? "pointer" : "not-allowed",
            opacity: gamePhase === 'selection' ? 1 : 0.5,
          }}
        >
          {gamePhase === 'selection' ? 'Start Game' : gamePhase === 'drawing' ? 'Drawing...' : 'Game Finished'}
        </button>
      </div>

      {/* Selected Cards Section */}
      <div style={{ padding: "0 100px", marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "20px", marginBottom: "20px" }}>
          <h3 style={{ fontSize: "18px", color: "#333", margin: 0 }}>Selected Card(s)</h3>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={rememberSelection}
              onChange={(e) => setRememberSelection(e.target.checked)}
              style={{ width: "16px", height: "16px" }}
            />
            <span style={{ fontSize: "14px", color: "#666" }}>Remember Selection</span>
          </label>
        </div>

        {/* Cartela Selection */}
        {loading ? (
          <div style={{ background: "#fff", borderRadius: "8px", padding: "20px", textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
            Loading cartelas...
          </div>
        ) : (
          <div style={{ background: "#fff", borderRadius: "8px", padding: "20px", marginBottom: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
            <h4 style={{ margin: "0 0 15px 0", color: "#333" }}>Available Cartelas</h4>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", maxHeight: "200px", overflowY: "auto" }}>
              {cartelas.slice(0, 20).map((cartela) => (
                <button
                  key={cartela.id}
                  onClick={() => handleCartelaSelect(cartela)}
                  disabled={gamePhase !== 'selection'}
                  style={{
                    padding: "8px 12px",
                    background: selectedCartela === cartela.id ? "#3b82f6" : "#f8f9fa",
                    color: selectedCartela === cartela.id ? "#fff" : "#333",
                    border: `2px solid ${selectedCartela === cartela.id ? "#3b82f6" : "#ddd"}`,
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: "bold",
                    cursor: gamePhase === 'selection' ? "pointer" : "not-allowed",
                    opacity: gamePhase === 'selection' ? 1 : 0.5,
                    minWidth: "60px",
                  }}
                >
                  {cartela.card_id}
                </button>
              ))}
            </div>
            {selectedCartela && (
              <div style={{ marginTop: "15px", padding: "10px", background: "#f0f8ff", borderRadius: "4px", fontSize: "14px" }}>
                Selected Cartela: {cartelas.find(c => c.id === selectedCartela)?.card_id}
              </div>
            )}
          </div>
        )}

        {/* Number Grid */}
        <div style={{ background: "#fff", borderRadius: "8px", padding: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
          {rows.map((row, rowIndex) => (
            <div key={rowIndex} style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
              {row.map((num) => (
                <button
                  key={num}
                  onClick={() => handleNumberClick(num)}
                  disabled={gamePhase !== 'selection'}
                  style={{
                    width: "40px",
                    height: "40px",
                    background: selectedNumbers.includes(num)
                      ? (gamePhase === 'drawing' && drawnNumbers.includes(num) ? "#ff6b6b" : "#3b82f6")
                      : (gamePhase === 'results' && winningNumbers.includes(num) ? "#ffd700" : "#f8f9fa"),
                    color: selectedNumbers.includes(num) || (gamePhase === 'results' && winningNumbers.includes(num)) ? "#fff" : "#333",
                    border: selectedNumbers.includes(num)
                      ? "2px solid #1d4ed8"
                      : (gamePhase === 'results' && winningNumbers.includes(num) ? "2px solid #ffd700" : "1px solid #ddd"),
                    borderRadius: "6px",
                    fontSize: "14px",
                    fontWeight: "bold",
                    cursor: gamePhase === 'selection' ? "pointer" : "default",
                    transition: "all 0.2s",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    animation: gamePhase === 'drawing' && drawnNumbers.includes(num) ? "pulse 0.5s ease-in-out" : "none",
                  }}
                >
                  {num}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Drawing Animation Section */}
      {gamePhase === 'drawing' && (
        <div style={{ padding: "0 100px", marginBottom: "20px" }}>
          <div style={{
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            borderRadius: "12px",
            padding: "30px",
            textAlign: "center",
            color: "#fff",
            boxShadow: "0 4px 15px rgba(0,0,0,0.2)"
          }}>
            <div style={{
              fontSize: "28px",
              fontWeight: "bold",
              marginBottom: "20px",
              animation: isDrawing ? "pulse 1s ease-in-out infinite" : "none"
            }}>
              🎲 DRAWING NUMBERS... {drawnNumbers.length}/20
            </div>

            {/* Drawn Numbers Display */}
            <div style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "12px",
              justifyContent: "center",
              maxWidth: "800px",
              margin: "0 auto"
            }}>
              {drawnNumbers.map((number, index) => (
                <div
                  key={`${number}-${index}`}
                  style={{
                    background: "rgba(255, 255, 255, 0.2)",
                    border: "2px solid #fff",
                    borderRadius: "50%",
                    width: "50px",
                    height: "50px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "18px",
                    fontWeight: "bold",
                    animation: `fadeInUp 0.5s ease-out ${index * 0.1}s both`,
                  }}
                >
                  {number}
                </div>
              ))}
            </div>

            {isDrawing && (
              <div style={{
                marginTop: "20px",
                fontSize: "16px",
                opacity: 0.8
              }}>
                Drawing next number in 2 seconds...
              </div>
            )}
          </div>
        </div>
      )}

      {/* Results Section */}
      {gamePhase === 'results' && (
        <div style={{ padding: "0 100px", marginBottom: "20px" }}>
          <div style={{
            background: gameResult === 'win'
              ? "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)"
              : "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
            borderRadius: "12px",
            padding: "30px",
            textAlign: "center",
            color: "#fff",
            boxShadow: "0 4px 15px rgba(0,0,0,0.2)"
          }}>
            <div style={{
              fontSize: "32px",
              fontWeight: "bold",
              marginBottom: "20px"
            }}>
              {gameResult === 'win' ? '🎉 YOU WIN!' : '😔 BETTER LUCK NEXT TIME!'}
            </div>

            <div style={{
              display: "flex",
              justifyContent: "center",
              gap: "40px",
              marginBottom: "30px"
            }}>
              <div>
                <div style={{ fontSize: "18px", marginBottom: "10px" }}>Your Numbers</div>
                <div style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "8px",
                  justifyContent: "center",
                  maxWidth: "300px"
                }}>
                  {selectedNumbers.map((num) => (
                    <div
                      key={num}
                      style={{
                        background: winningNumbers.includes(num) ? "#ffd700" : "rgba(255, 255, 255, 0.3)",
                        border: winningNumbers.includes(num) ? "2px solid #fff" : "1px solid rgba(255, 255, 255, 0.5)",
                        borderRadius: "50%",
                        width: "35px",
                        height: "35px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "14px",
                        fontWeight: "bold",
                      }}
                    >
                      {num}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontSize: "18px", marginBottom: "10px" }}>Winning Numbers</div>
                <div style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "8px",
                  justifyContent: "center",
                  maxWidth: "300px"
                }}>
                  {winningNumbers.map((num) => (
                    <div
                      key={num}
                      style={{
                        background: selectedNumbers.includes(num) ? "#ffd700" : "rgba(255, 255, 255, 0.3)",
                        border: selectedNumbers.includes(num) ? "2px solid #fff" : "1px solid rgba(255, 255, 255, 0.5)",
                        borderRadius: "50%",
                        width: "35px",
                        height: "35px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "14px",
                        fontWeight: "bold",
                      }}
                    >
                      {num}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{
              fontSize: "24px",
              fontWeight: "bold",
              marginBottom: "10px"
            }}>
              Matches: {matches}/20
            </div>

            <div style={{
              fontSize: "20px",
              marginBottom: "20px"
            }}>
              Winnings: {totalWinnings.toFixed(2)} Birr
            </div>

            <div style={{
              display: "flex",
              justifyContent: "center",
              gap: "20px"
            }}>
              <button
                onClick={handlePlayAgain}
                style={{
                  background: "#10b981",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "12px 24px",
                  fontSize: "16px",
                  fontWeight: "bold",
                  cursor: "pointer"
                }}
              >
                Play Again
              </button>

              <button
                onClick={handleNewSelection}
                style={{
                  background: "#6b46c1",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "12px 24px",
                  fontSize: "16px",
                  fontWeight: "bold",
                  cursor: "pointer"
                }}
              >
                New Selection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Number Popup Animation */}
      {showPopup && popupNumber && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.8)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          animation: "fadeIn 0.3s ease-in-out",
        }}>
          <div style={{
            background: "linear-gradient(135deg, #ff6b6b 0%, #ffa500 50%, #ffd700 100%)",
            borderRadius: "50%",
            width: 150,
            height: 150,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 48,
            fontWeight: "bold",
            color: "#fff",
            border: "6px solid #fff",
            boxShadow: "0 0 40px rgba(255, 215, 0, 0.8)",
            animation: "bounceIn 0.8s ease-in-out",
            textShadow: "2px 2px 4px rgba(0,0,0,0.3)",
          }}>
            {popupNumber}
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
            boxShadow: 0 0 20px rgba(255, 215, 0, 0.8);
          }
          50% {
            transform: scale(1.1);
            boxShadow: 0 0 40px rgba(255, 215, 0, 1);
          }
          100% {
            transform: scale(1);
            boxShadow: 0 0 20px rgba(255, 215, 0, 0.8);
          }
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default Selectcartela;
