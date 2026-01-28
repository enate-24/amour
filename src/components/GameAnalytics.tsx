import React, { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface GameData {
  date: string;
  gameNumber: number;
  players: number;
  bet: number;
  totalBet: number;
  cutPercentage: number;
  win: number;
  profit: number;
  houseBonus: number;
  playersBonus: number;
  winner: string;
  winnerCartelaIds?: string[];
  finished: boolean;
  gameId: string;
  playersDetails?: Array<{
    username: string;
    betAmount: number;
    isWinner: number;
    cartelaId: string;
    userId: string;
  }>;
}

const GameAnalytics: React.FC = () => {
  const [gamesData, setGamesData] = useState<GameData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [usernameSearch, setUsernameSearch] = useState('');
  const [filteredGames, setFilteredGames] = useState<GameData[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();

  // Debug logging
  useEffect(() => {
    try {
      console.log('🔍 GameAnalytics component mounted');
      console.log('👤 Current user:', user);
      console.log('🌐 API Base URL:', API_BASE_URL);
      console.log('🌐 Environment VITE_API_URL:', import.meta.env.VITE_API_URL);
      console.log('🌐 Current origin:', window.location.origin);
    } catch (err) {
      console.error('❌ Error in debug logging:', err);
    }
  }, [user]);

  // For regular users, automatically filter by their username
  const isRegularUser = user && user.role !== 'admin';

  const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        hour12: true
      });
    } catch {
      return dateString;
    }
  };

  const fetchGamesData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('auth_token');
      if (!token) {
        setError('Authentication token not found. Please log in again.');
        return;
      }

      // Build URL properly - handle both absolute and relative URLs
      let fetchUrl = `${API_BASE_URL}/games/analysis`;
      const params = new URLSearchParams();
      if (usernameSearch) {
        params.append('username', usernameSearch);
      }
      if (params.toString()) {
        fetchUrl += `?${params.toString()}`;
      }

      console.log('🔍 Fetching games data from:', fetchUrl);

      const response = await fetch(fetchUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('📥 Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Games data received:', data);

        // Transform the API data to match our interface
        // Note: PostgreSQL returns lowercase field names
        const transformedGames: GameData[] = (data.games || []).map((game: any) => ({
          date: formatDate(game.date),
          gameNumber: game.gamenumber || game.gameNumber || 1,
          players: game.players || 0,
          bet: parseFloat(game.bet) || 0,
          totalBet: parseFloat(game.totalbet || game.totalBet) || 0,
          cutPercentage: parseFloat(game.cutpercentage || game.cutPercentage) || 0,
          win: parseFloat(game.win) || 0,
          profit: parseFloat(game.profit) || 0,
          houseBonus: parseFloat(game.housebonus || game.houseBonus) || 0,
          playersBonus: parseFloat(game.playersbonus || game.playersBonus) || 0,
          winner: game.winnerinfo || game.winnerInfo || 'No Winner',
          winnerCartelaIds: game.winnercartelaids || game.winnerCartelaIds || [],
          finished: game.status === 'finished' || game.finished || false,
          gameId: game.gameid || game.gameId || '',
          playersDetails: game.playersDetails || []
      }));

        console.log('🎯 Transformed games:', transformedGames);
        setGamesData(transformedGames);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('❌ API Error:', response.status, errorData);
        setError(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('❌ Network error fetching games data:', error);
      
      // More specific error handling
      if (error instanceof TypeError) {
        if (error.message.includes('Failed to construct')) {
          setError('Configuration error: Invalid API URL. Please check your environment settings.');
        } else if (error.message.includes('fetch')) {
          setError('Network error: Unable to connect to the server. Please check if the backend is running.');
        } else {
          setError(`Network error: ${error.message}`);
        }
      } else {
        setError(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [API_BASE_URL, usernameSearch]); // Add dependencies for useCallback

  // Initialize component and set username for regular users
  useEffect(() => {
    if (isRegularUser && user?.username && usernameSearch !== user.username) {
      setUsernameSearch(user.username);
    }
  }, [isRegularUser, user?.username]); // Only depend on user changes

  // Fetch games data when username search changes
  useEffect(() => {
    fetchGamesData();
  }, [fetchGamesData]); // Depend on the memoized function

  // Filter games based on search term
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredGames(gamesData);
    } else {
      const filtered = gamesData.filter(game =>
        game.gameNumber.toString().includes(searchTerm.trim()) ||
        game.gameId.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredGames(filtered);
    }
  }, [searchTerm, gamesData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchGamesData();
  };

  const formatCurrency = (amount: number | string) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return `$${numAmount.toFixed(2)}`;
  };



  if (loading) {
    return (
      <div className="p-4 sm:p-6 bg-slate-900 min-h-screen text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto mb-4"></div>
          <p>Loading game analytics...</p>
          <p className="text-sm text-slate-400 mt-2">
            If this takes too long, check the browser console for errors
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6 bg-slate-900 min-h-screen text-white">
        <div className="text-center">
          <div className="bg-red-600 text-white p-4 rounded-lg mb-4">
            <p className="text-sm sm:text-base font-semibold mb-2">Game Analytics Error</p>
            <p className="text-sm sm:text-base">{error}</p>
          </div>
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-4">
            <h3 className="text-blue-400 font-semibold mb-2">Troubleshooting Steps:</h3>
            <ul className="text-left text-sm text-slate-300 space-y-1">
              <li>1. Check if the backend server is running</li>
              <li>2. Verify your authentication token is valid</li>
              <li>3. Check browser console for detailed errors</li>
              <li>4. Try refreshing the page</li>
            </ul>
          </div>
          <button
            onClick={handleRefresh}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm sm:text-base"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 bg-slate-900 min-h-screen text-white">
      {/* Header with Search and Refresh */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-3xl font-bold">
          {isRegularUser ? 'My Game History' : 'Game Analytics'}
        </h1>
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh data"
          >
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Search Bars - Only show for admins */}
      {!isRegularUser && (
        <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="relative w-full sm:max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search by Game ID"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-9 sm:pl-10 pr-3 py-2 text-sm sm:text-base border border-gray-600 rounded-md leading-5 bg-slate-800 text-white placeholder-gray-400 focus:outline-none focus:bg-slate-700 focus:border-blue-500"
            />
          </div>
          <div className="relative w-full sm:max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search by Username"
              value={usernameSearch}
              onChange={(e) => setUsernameSearch(e.target.value)}
              className="block w-full pl-9 sm:pl-10 pr-3 py-2 text-sm sm:text-base border border-gray-600 rounded-md leading-5 bg-slate-800 text-white placeholder-gray-400 focus:outline-none focus:bg-slate-700 focus:border-blue-500"
            />
          </div>
        </div>
      )}

      {/* Search Bar for regular users - only Game ID */}
      {isRegularUser && (
        <div className="mb-4 sm:mb-6 flex gap-4">
          <div className="relative w-full sm:max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search by Game Number"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-9 sm:pl-10 pr-3 py-2 text-sm sm:text-base border border-gray-600 rounded-md leading-5 bg-slate-800 text-white placeholder-gray-400 focus:outline-none focus:bg-slate-700 focus:border-blue-500"
            />
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead className="bg-slate-700">
              <tr>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  DATE
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  Game
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  Players
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  Bet
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  Tot Bet
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  Cut %
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  Win
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  Profit
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  H.Bonus
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  P.Bonus
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  Winner
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  Cartelas
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-slate-800 divide-y divide-slate-700">
              {filteredGames.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-4 py-8 text-center text-slate-400 text-sm">
                    No games found
                  </td>
                </tr>
              ) : (
                filteredGames.map((game, index) => (
                  <tr key={game.gameId || index} className={`${index % 2 === 0 ? 'bg-slate-800' : 'bg-slate-750'} hover:bg-slate-700 transition-colors`}>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-[10px] sm:text-sm text-gray-300">
                      {game.date}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-[11px] sm:text-sm font-medium text-yellow-400">
                      #{game.gameNumber}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-[10px] sm:text-sm text-gray-300">
                      {game.players}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-[10px] sm:text-sm text-gray-300">
                      {formatCurrency(game.bet)}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-[10px] sm:text-sm text-gray-300">
                      {formatCurrency(game.totalBet)}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-[10px] sm:text-sm text-gray-300">
                      {game.cutPercentage}%
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-[10px] sm:text-sm text-green-400 font-medium">
                      {formatCurrency(game.win)}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-[10px] sm:text-sm text-blue-400 font-medium">
                      {formatCurrency(game.profit)}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-[10px] sm:text-sm text-gray-300">
                      {formatCurrency(game.houseBonus)}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-[10px] sm:text-sm text-gray-300">
                      {formatCurrency(game.playersBonus)}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-[10px] sm:text-sm text-gray-300 max-w-[100px] truncate">
                      {game.winner}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3">
                      {game.winnerCartelaIds && game.winnerCartelaIds.length > 0 ? (
                        <div className="flex gap-1 flex-wrap max-w-[100px]">
                          {game.winnerCartelaIds.slice(0, 2).map((cartelaId, idx) => (
                            <span key={idx} className="px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold bg-green-600 text-white rounded">
                              {cartelaId}
                            </span>
                          ))}
                          {game.winnerCartelaIds.length > 2 && (
                            <span className="px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold bg-gray-600 text-white rounded">
                              +{game.winnerCartelaIds.length - 2}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-500 text-[10px]">—</span>
                      )}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap">
                      <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 text-[9px] sm:text-xs font-semibold rounded-full ${game.finished
                          ? 'bg-green-600 text-white'
                          : 'bg-red-600 text-white'
                        }`}>
                        {game.finished ? '✓' : '✗'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default GameAnalytics;
