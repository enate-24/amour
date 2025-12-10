import React, { useState, useEffect } from 'react';
import { ArrowLeft, DollarSign, TrendingUp, TrendingDown, RefreshCw, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface GameDetails {
  status: string;
  betMoney: number;
  winMoney: number;
  cartelasSelected: number;
  houseCutPercentage: number;
  houseCut: number;
  profit: number;
  winnerPattern?: string;
  totalNumbers?: number;
  winnerCartelaIds?: string[];
  selectedCartelaIds?: string[];
  hasWinner?: boolean;
}

interface Transaction {
  id: string;
  type: 'debit' | 'credit' | 'bonus';
  amount: number;
  description: string;
  date: string;
  gameId?: string;
  gameNumber?: number;
  gameDetails?: GameDetails;
  balanceAfter: number;
}

const Balance: React.FC = () => {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalGames, setTotalGames] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

  const fetchTransactions = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`${API_BASE_URL}/balance/transactions`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch transactions');
      }

      const data = await response.json();
      setTransactions(data.transactions || []);
      setTotalGames(data.totalGames || 0);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      setError(error instanceof Error ? error.message : 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        fetchTransactions(),
        refreshUser?.()
      ]);
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    // Only fetch transactions for prepaid users
    if (user?.userType === 'prepaid') {
      fetchTransactions();
    } else {
      setLoading(false);
    }
  }, [user]);

  // Redirect postpaid users
  if (user?.userType !== 'prepaid') {
    return (
      <div className="min-h-screen bg-[#001A23] flex items-center justify-center p-4">
        <div className="bg-slate-800 rounded-lg p-8 text-center max-w-md">
          <AlertCircle size={48} className="text-yellow-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Access Restricted</h2>
          <p className="text-slate-300 mb-6">
            Balance page is only available for prepaid users. Postpaid users have unlimited credit.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-medium transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const currentBalance = user?.balance || 0;

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'credit':
      case 'bonus':
        return <TrendingUp size={16} className="text-green-400" />;
      case 'debit':
        return <TrendingDown size={16} className="text-red-400" />;
      default:
        return <DollarSign size={16} className="text-slate-400" />;
    }
  };



  return (
    <div className="min-h-screen bg-[#001A23] text-white">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 p-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
            <span>Back</span>
          </button>
          <h1 className="text-xl font-bold">Balance & Transactions</h1>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="ml-auto p-2 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="p-4 max-w-7xl mx-auto">
        {/* Balance Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {/* Current Balance */}
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <DollarSign size={24} className="text-green-400" />
              <h2 className="text-lg font-semibold">Remaining Balance</h2>
            </div>
            <div className="text-3xl font-bold text-green-400 mb-2">
              {currentBalance.toFixed(2)} Birr
            </div>
            <div className="text-sm text-slate-400">
              Available for games
            </div>
          </div>

          {/* Total Used Balance */}
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <TrendingDown size={24} className="text-red-400" />
              <h2 className="text-lg font-semibold">Total Used</h2>
            </div>
            <div className="text-3xl font-bold text-red-400 mb-2">
              {transactions
                .filter(t => t.type === 'debit' && t.gameDetails)
                .reduce((sum, t) => sum + (t.gameDetails?.houseCut || 0), 0)
                .toFixed(2)} Birr
            </div>
            <div className="text-sm text-slate-400">
              Total house cuts paid
            </div>
          </div>

          {/* Balance Status */}
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp size={24} className="text-blue-400" />
              <h2 className="text-lg font-semibold">Balance Status</h2>
            </div>
            <div className={`text-2xl font-bold mb-2 ${
              currentBalance < 100 ? 'text-red-400' : 
              currentBalance < 500 ? 'text-yellow-400' : 
              'text-green-400'
            }`}>
              {currentBalance < 100 ? 'Low Balance' : 
               currentBalance < 500 ? 'Medium Balance' : 
               'Good Balance'}
            </div>
            <div className="text-sm text-slate-400">
              {currentBalance < 100 && 'Consider adding more balance'}
              {currentBalance >= 100 && currentBalance < 500 && 'Balance is adequate'}
              {currentBalance >= 500 && 'Balance is healthy'}
            </div>
          </div>
        </div>

        {/* Transactions */}
        <div className="bg-slate-800 rounded-lg border border-slate-700">
          <div className="p-4 sm:p-6 border-b border-slate-700">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-lg sm:text-xl font-bold">Transaction History</h2>
                <p className="text-slate-400 text-sm mt-1">
                  Recent balance changes and game expenses
                </p>
              </div>
              <div className="text-left sm:text-right">
                <div className="text-xl sm:text-2xl font-bold text-blue-400">{totalGames}</div>
                <div className="text-sm text-slate-400">Total Games</div>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-6">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-slate-400">Loading transactions...</p>
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <AlertCircle size={48} className="text-red-400 mx-auto mb-4" />
                <p className="text-red-400 mb-4">{error}</p>
                <button
                  onClick={handleRefresh}
                  className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Try Again
                </button>
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-8">
                <DollarSign size={48} className="text-slate-400 mx-auto mb-4" />
                <p className="text-slate-400">No transactions found</p>
                <p className="text-slate-500 text-sm mt-2">
                  Your transaction history will appear here
                </p>
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full text-sm min-w-[1200px]">
                    <thead>
                      <tr className="border-b border-slate-600">
                        <th className="text-left p-4 text-slate-300 font-medium w-48">Date & Game</th>
                        <th className="text-left p-4 text-slate-300 font-medium w-32">Type</th>
                        <th className="text-left p-4 text-slate-300 font-medium w-48">Winner Cartelas</th>
                        <th className="text-right p-4 text-slate-300 font-medium w-40">Used Balance</th>
                        <th className="text-right p-4 text-slate-300 font-medium w-40">Remaining Balance</th>
                        <th className="text-right p-4 text-slate-300 font-medium w-80">Game Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((transaction) => (
                        <tr 
                          key={transaction.id}
                          className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors"
                        >
                          {/* Date & Game Column */}
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              {getTransactionIcon(transaction.type)}
                              <div>
                                <div className="font-medium text-white">
                                  {transaction.gameNumber ? `Game #${transaction.gameNumber}` : 'Balance Add'}
                                </div>
                                <div className="text-xs text-slate-400">
                                  {new Date(transaction.date).toLocaleDateString()} {new Date(transaction.date).toLocaleTimeString()}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Type Column */}
                          <td className="p-4">
                            <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              transaction.type === 'credit' ? 'bg-green-900/30 text-green-400 border border-green-500/30' :
                              transaction.type === 'debit' ? 'bg-red-900/30 text-red-400 border border-red-500/30' :
                              'bg-blue-900/30 text-blue-400 border border-blue-500/30'
                            }`}>
                              {transaction.type === 'credit' ? 'Win' :
                               transaction.type === 'debit' ? 'House Cut' :
                               'Bonus'}
                            </div>
                          </td>

                          {/* Winner Cartelas Column */}
                          <td className="p-4">
                            {transaction.gameDetails?.hasWinner ? (
                              <div className="space-y-1">
                                <div className="flex items-center gap-1">
                                  <span className="text-yellow-400 text-lg">🏆</span>
                                  <span className="text-green-400 font-medium text-sm">
                                    {transaction.gameDetails.winnerCartelaIds?.length || 0} Winner{(transaction.gameDetails.winnerCartelaIds?.length || 0) > 1 ? 's' : ''}
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {transaction.gameDetails.winnerCartelaIds?.slice(0, 3).map((cartelaId, index) => (
                                    <span
                                      key={index}
                                      className="inline-flex items-center px-2 py-1 rounded bg-yellow-900/30 text-yellow-400 border border-yellow-500/30 text-xs font-medium"
                                    >
                                      #{cartelaId}
                                    </span>
                                  ))}
                                  {(transaction.gameDetails.winnerCartelaIds?.length || 0) > 3 && (
                                    <span className="text-xs text-slate-400">
                                      +{(transaction.gameDetails.winnerCartelaIds?.length || 0) - 3} more
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : transaction.gameDetails ? (
                              <div className="flex items-center gap-1">
                                <span className="text-slate-500 text-sm">❌</span>
                                <span className="text-slate-400 text-sm">No Winners</span>
                              </div>
                            ) : (
                              <div className="text-slate-500 text-sm">-</div>
                            )}
                          </td>

                          {/* Used Balance Column */}
                          <td className="p-4 text-right">
                            <div className="font-bold text-red-400">
                              {transaction.gameDetails ? 
                                `${transaction.gameDetails.houseCut.toFixed(2)} Birr` : 
                                '0.00 Birr'
                              }
                            </div>
                            {transaction.gameDetails && (
                              <div className="text-xs text-slate-400">
                                {transaction.gameDetails.houseCutPercentage}% house cut
                              </div>
                            )}
                          </td>

                          {/* Remaining Balance Column */}
                          <td className="p-4 text-right">
                            <div className="font-bold text-green-400">
                              {transaction.balanceAfter.toFixed(2)} Birr
                            </div>
                            <div className={`text-xs ${
                              transaction.balanceAfter < 100 ? 'text-red-400' :
                              transaction.balanceAfter < 500 ? 'text-yellow-400' :
                              'text-green-400'
                            }`}>
                              {transaction.balanceAfter < 100 ? 'Low Balance' :
                               transaction.balanceAfter < 500 ? 'Medium Balance' :
                               'Good Balance'}
                            </div>
                          </td>

                          {/* Game Details Column */}
                          <td className="p-4 text-right">
                            {transaction.gameDetails ? (
                              <div className="text-sm space-y-2">
                                <div className="flex justify-between gap-6">
                                  <span className="text-slate-400 min-w-[80px]">Bet:</span>
                                  <span className="text-blue-400 font-medium">
                                    {transaction.gameDetails.betMoney.toFixed(2)} Birr
                                  </span>
                                </div>
                                <div className="flex justify-between gap-6">
                                  <span className="text-slate-400 min-w-[80px]">Win:</span>
                                  <span className="text-green-400 font-medium">
                                    {transaction.gameDetails.winMoney.toFixed(2)} Birr
                                  </span>
                                </div>
                                <div className="flex justify-between gap-6">
                                  <span className="text-slate-400 min-w-[80px]">Cartelas:</span>
                                  <span className="text-purple-400 font-medium">
                                    {transaction.gameDetails.cartelasSelected}
                                  </span>
                                </div>
                                <div className="flex justify-between gap-6">
                                  <span className="text-slate-400 min-w-[80px]">Profit:</span>
                                  <span className={`font-medium ${
                                    transaction.gameDetails.profit > 0 ? 'text-green-400' :
                                    transaction.gameDetails.profit < 0 ? 'text-red-400' :
                                    'text-slate-300'
                                  }`}>
                                    {transaction.gameDetails.profit > 0 ? '+' : ''}{transaction.gameDetails.profit.toFixed(2)} Birr
                                  </span>
                                </div>
                                {transaction.gameDetails.winnerPattern && (
                                  <div className="flex justify-between gap-6">
                                    <span className="text-slate-400 min-w-[80px]">Pattern:</span>
                                    <span className="text-yellow-400 font-medium">
                                      {transaction.gameDetails.winnerPattern}
                                    </span>
                                  </div>
                                )}
                                <div className="flex justify-between gap-6">
                                  <span className="text-slate-400 min-w-[80px]">Status:</span>
                                  <span className={`font-medium capitalize ${
                                    transaction.gameDetails.status === 'finished' ? 'text-green-400' :
                                    transaction.gameDetails.status === 'active' ? 'text-yellow-400' :
                                    'text-slate-300'
                                  }`}>
                                    {transaction.gameDetails.status}
                                  </span>
                                </div>
                                {transaction.gameDetails.hasWinner && (
                                  <div className="flex justify-between gap-6">
                                    <span className="text-slate-400 min-w-[80px]">Winners:</span>
                                    <span className="text-yellow-400 font-medium">
                                      {transaction.gameDetails.winnerCartelaIds?.join(', ') || 'None'}
                                    </span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-sm text-slate-400">
                                Balance addition
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="lg:hidden space-y-4">
                  {transactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="bg-slate-700/50 rounded-lg border border-slate-600 p-4 space-y-4"
                    >
                      {/* Header Row */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getTransactionIcon(transaction.type)}
                          <div>
                            <div className="font-medium text-white text-sm">
                              {transaction.gameNumber ? `Game #${transaction.gameNumber}` : 'Balance Add'}
                            </div>
                            <div className="text-xs text-slate-400">
                              {new Date(transaction.date).toLocaleDateString()} {new Date(transaction.date).toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                        <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          transaction.type === 'credit' ? 'bg-green-900/30 text-green-400 border border-green-500/30' :
                          transaction.type === 'debit' ? 'bg-red-900/30 text-red-400 border border-red-500/30' :
                          'bg-blue-900/30 text-blue-400 border border-blue-500/30'
                        }`}>
                          {transaction.type === 'credit' ? 'Win' :
                           transaction.type === 'debit' ? 'House Cut' :
                           'Bonus'}
                        </div>
                      </div>

                      {/* Balance Summary */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3">
                          <div className="text-red-400 text-xs font-medium mb-1">USED BALANCE</div>
                          <div className="text-red-300 font-bold text-sm">
                            {transaction.gameDetails ? 
                              `${transaction.gameDetails.houseCut.toFixed(2)} Birr` : 
                              '0.00 Birr'
                            }
                          </div>
                          {transaction.gameDetails && (
                            <div className="text-xs text-red-400 mt-1">
                              {transaction.gameDetails.houseCutPercentage}% house cut
                            </div>
                          )}
                        </div>
                        
                        <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3">
                          <div className="text-green-400 text-xs font-medium mb-1">REMAINING BALANCE</div>
                          <div className="text-green-300 font-bold text-sm">
                            {transaction.balanceAfter.toFixed(2)} Birr
                          </div>
                          <div className={`text-xs mt-1 ${
                            transaction.balanceAfter < 100 ? 'text-red-400' :
                            transaction.balanceAfter < 500 ? 'text-yellow-400' :
                            'text-green-400'
                          }`}>
                            {transaction.balanceAfter < 100 ? 'Low Balance' :
                             transaction.balanceAfter < 500 ? 'Medium Balance' :
                             'Good Balance'}
                          </div>
                        </div>
                      </div>

                      {/* Winner Cartelas */}
                      {transaction.gameDetails && (
                        <div className="border-t border-slate-600 pt-3">
                          <div className="text-xs text-slate-400 mb-2 font-medium">WINNER CARTELAS</div>
                          {transaction.gameDetails.hasWinner ? (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="text-yellow-400">🏆</span>
                                <span className="text-green-400 font-medium text-sm">
                                  {transaction.gameDetails.winnerCartelaIds?.length || 0} Winner{(transaction.gameDetails.winnerCartelaIds?.length || 0) > 1 ? 's' : ''}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {transaction.gameDetails.winnerCartelaIds?.map((cartelaId, index) => (
                                  <span
                                    key={index}
                                    className="inline-flex items-center px-2 py-1 rounded bg-yellow-900/30 text-yellow-400 border border-yellow-500/30 text-xs font-medium"
                                  >
                                    #{cartelaId}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-slate-500">❌</span>
                              <span className="text-slate-400 text-sm">No Winners</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Game Details */}
                      {transaction.gameDetails && (
                        <div className="border-t border-slate-600 pt-3">
                          <div className="text-xs text-slate-400 mb-2 font-medium">GAME DETAILS</div>
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div className="flex justify-between">
                              <span className="text-slate-400">Bet:</span>
                              <span className="text-blue-400 font-medium">
                                {transaction.gameDetails.betMoney.toFixed(2)} Birr
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Win:</span>
                              <span className="text-green-400 font-medium">
                                {transaction.gameDetails.winMoney.toFixed(2)} Birr
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Cartelas:</span>
                              <span className="text-purple-400 font-medium">
                                {transaction.gameDetails.cartelasSelected}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Profit:</span>
                              <span className={`font-medium ${
                                transaction.gameDetails.profit > 0 ? 'text-green-400' :
                                transaction.gameDetails.profit < 0 ? 'text-red-400' :
                                'text-slate-300'
                              }`}>
                                {transaction.gameDetails.profit > 0 ? '+' : ''}{transaction.gameDetails.profit.toFixed(2)} Birr
                              </span>
                            </div>
                            {transaction.gameDetails.winnerPattern && (
                              <div className="flex justify-between col-span-2">
                                <span className="text-slate-400">Pattern:</span>
                                <span className="text-yellow-400 font-medium">
                                  {transaction.gameDetails.winnerPattern}
                                </span>
                              </div>
                            )}
                            <div className="flex justify-between col-span-2">
                              <span className="text-slate-400">Status:</span>
                              <span className={`font-medium capitalize ${
                                transaction.gameDetails.status === 'finished' ? 'text-green-400' :
                                transaction.gameDetails.status === 'active' ? 'text-yellow-400' :
                                'text-slate-300'
                              }`}>
                                {transaction.gameDetails.status}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Balance Warning */}
        {currentBalance < 100 && (
          <div className="mt-6 bg-red-900/20 border border-red-500 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <AlertCircle size={20} className="text-red-400" />
              <div>
                <h3 className="font-semibold text-red-400">Low Balance Warning</h3>
                <p className="text-red-300 text-sm mt-1">
                  Your balance is running low. Contact admin to add more balance to continue playing.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Balance;