import React, { useState, useEffect } from 'react';
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

  // For regular users, automatically filter by their username
  const isRegularUser = user && user.role !== 'admin';

  const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

  // Fetch games data from database
  useEffect(() => {
    // For regular users, automatically set their username for filtering
    if (isRegularUser && user?.username && usernameSearch !== user.username) {
      setUsernameSearch(user.username);
    } else {
      fetchGamesData();
    }
  }, [usernameSearch, isRegularUser, user?.username]);

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

  const fetchGamesData = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('auth_token');
      if (!token) {
        setError('Authentication token not found');
        return;
      }

      const url = new URL(`${API_BASE_URL}/games/analysis`);
      if (usernameSearch) {
        url.searchParams.append('username', usernameSearch);
      }

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();

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

        setGamesData(transformedGames);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to fetch games data');
      }
    } catch (error) {
      console.error('Error fetching games data:', error);
      setError('Network error: Please check if the API server is running');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

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
      <div className="p-6 bg-slate-900 min-h-screen text-white flex items-center justify-center"
        style={{
          marginRight: '100px',
          marginLeft: '60px',
          marginTop: '50px',
          marginBottom: '0px'
        }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto mb-4"></div>
          <p>Loading game analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-slate-900 min-h-screen text-white">
        <div className="text-center">
          <div className="bg-red-600 text-white p-4 rounded-lg mb-4">
            <p>Error: {error}</p>
          </div>
          <button
            onClick={handleRefresh}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-slate-900 min-h-screen text-white">
      {/* Header with Search and Refresh */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">
          {isRegularUser ? 'My Game History' : 'Game Analytics'}
        </h1>
        <div className="flex items-center gap-4">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh data"
          >
            <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Search Bars - Only show for admins */}
      {!isRegularUser && (
        <div className="mb-6 flex gap-4">
          <div className="relative max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search by Game ID"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-600 rounded-md leading-5 bg-slate-800 text-white placeholder-gray-400 focus:outline-none focus:bg-slate-700 focus:border-blue-500"
            />
          </div>
          <div className="relative max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search by Username"
              value={usernameSearch}
              onChange={(e) => setUsernameSearch(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-600 rounded-md leading-5 bg-slate-800 text-white placeholder-gray-400 focus:outline-none focus:bg-slate-700 focus:border-blue-500"
            />
          </div>
        </div>
      )}

      {/* Search Bar for regular users - only Game ID */}
      {isRegularUser && (
        <div className="mb-6 flex gap-4">
          <div className="relative max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search by Game Number"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-600 rounded-md leading-5 bg-slate-800 text-white placeholder-gray-400 focus:outline-none focus:bg-slate-700 focus:border-blue-500"
            />
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  DATE
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Game
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Players
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Bet
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Tot Bet
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Cut %
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Win
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  ProfitHouse
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  House Bonus
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Players Bonus
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Winner
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Winner Cartelas
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Finished
                </th>
              </tr>
            </thead>
            <tbody className="bg-slate-800 divide-y divide-slate-700">
              {filteredGames.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-6 py-4 text-center text-slate-400">
                    No games found
                  </td>
                </tr>
              ) : (
                filteredGames.map((game, index) => (
                  <tr key={game.gameId || index} className={`${index % 2 === 0 ? 'bg-slate-800' : 'bg-slate-750'}`}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {game.date}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                      {game.gameNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {game.players}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {formatCurrency(game.bet)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {formatCurrency(game.totalBet)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {game.cutPercentage}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {formatCurrency(game.win)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {formatCurrency(game.profit)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {formatCurrency(game.houseBonus)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {formatCurrency(game.playersBonus)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {game.winner}
                    </td>
                    <td className="px-1 py-0.5 text-xs">
                      {game.winnerCartelaIds && game.winnerCartelaIds.length > 0 ? (
                        <div className="flex gap-0.5 max-w-[80px]">
                          {game.winnerCartelaIds.slice(0, 2).map((cartelaId, idx) => (
                            <span key={idx} className="px-1 py-0.5 text-[6px] font-bold bg-green-600 text-white rounded-sm">
                              {cartelaId}
                            </span>
                          ))}
                          {game.winnerCartelaIds.length > 2 && (
                            <span className="px-1 py-0.5 text-[6px] font-bold bg-gray-600 text-white rounded-sm">
                              +{game.winnerCartelaIds.length - 2}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-500 text-[8px]">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${game.finished
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                        }`}>
                        {game.finished ? 'Yes' : 'No'}
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
