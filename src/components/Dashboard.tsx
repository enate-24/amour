import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DollarSign, TrendingUp, PieChart, Banknote, Eye, EyeOff, RefreshCw } from 'lucide-react';
import StatsChart from './StatsChart';
import { useAuth } from '../hooks/useAuth';
import { formatCurrency } from '../utils/formatters';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [showBalance, setShowBalance] = useState(false);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { user, refreshUser } = useAuth();

  const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

  useEffect(() => {
    fetchDashboardData();
    // Refresh user data to get latest balance on mount
    if (refreshUser) {
      refreshUser().catch(err => {
        console.warn('Initial balance refresh failed:', err);
        // Don't throw error - just log it
      });
    }
  }, []);

  const fetchDashboardData = async () => {
    try {
      console.log('Dashboard: Fetching from:', `${API_BASE_URL}/dashboard`);
      const token = localStorage.getItem('auth_token');
      console.log('Dashboard: Using token:', token ? 'Token present' : 'No token');
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE_URL}/dashboard`, {
        headers,
        method: 'GET'
      });

      console.log('Dashboard: Response status:', response.status);
      console.log('Dashboard: Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (response.ok) {
        const data = await response.json();
        console.log('Dashboard: Received data:', data);
        setDashboardData(data);
        setError(null);
      } else {
        let errorText;
        try {
          errorText = await response.text();
        } catch (e) {
          errorText = 'Unable to read error response';
        }
        console.log('Dashboard: Error response:', errorText);
        
        // Handle specific error cases
        if (response.status === 401) {
          setError('Authentication required. Please log in again.');
          // Optionally redirect to login
          // navigate('/login');
        } else if (response.status === 403) {
          setError('Access forbidden. Please check your permissions.');
        } else if (response.status === 500) {
          setError(`Server error (500): ${errorText || 'Internal server error. The backend service may be experiencing issues.'}`);
        } else {
          setError(`Failed to fetch dashboard data: ${response.status} ${response.statusText} - ${errorText}`);
        }
        console.error('Failed to fetch dashboard data:', response.status, response.statusText, errorText);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      let errorMessage = 'An unexpected error occurred.';
      if (error instanceof TypeError && error.message.includes('fetch')) {
        errorMessage = 'Network error: Unable to connect to the backend server. Please check if the server is running.';
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshBalance = async () => {
    if (!refreshUser) return;
    
    setRefreshing(true);
    try {
      await refreshUser();
      console.log('Balance refreshed successfully');
    } catch (error) {
      console.error('Error refreshing balance:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Diagnostic function to check API connection and auth
  const runDiagnostics = async () => {
    console.log('🔍 Running dashboard diagnostics...');
    
    const token = localStorage.getItem('auth_token');
    console.log('🔍 Auth token:', token ? 'Present' : 'Missing');
    console.log('🔍 User data:', user);
    console.log('🔍 API Base URL:', API_BASE_URL);
    
    if (!token) {
      console.error('❌ No authentication token found');
      return;
    }

    try {
      // Test basic API connectivity
      const testResponse = await fetch(`${API_BASE_URL}/dashboard`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('🔍 API Test Response:', {
        status: testResponse.status,
        statusText: testResponse.statusText,
        ok: testResponse.ok,
        url: testResponse.url
      });

      if (testResponse.ok) {
        const testData = await testResponse.json();
        console.log('🔍 API Test Data:', testData);
      } else {
        const errorText = await testResponse.text();
        console.error('🔍 API Test Error:', errorText);
      }
    } catch (error) {
      console.error('🔍 API Test Failed:', error);
    }
  };

  const stats = dashboardData ? [
    { label: 'Daily Profit', value: formatCurrency(dashboardData.dailyProfit || 0), icon: DollarSign, color: 'text-red-400' },
    { label: 'Daily Total', value: formatCurrency(dashboardData.dailyTotal || 0), icon: TrendingUp, color: 'text-red-400' },
    { label: 'Games Today', value: `${dashboardData.dailyGames?.toLocaleString() || '0'}`, icon: PieChart, color: 'text-red-400' },
    { label: 'Weekly Total', value: formatCurrency(dashboardData.weeklyTotal || 0), icon: PieChart, color: 'text-red-400' },
    { label: 'Weekly Profit', value: formatCurrency(dashboardData.weeklyProfit || 0), icon: Banknote, color: 'text-red-400' },
    { label: '15 Day Profit', value: formatCurrency(dashboardData.fifteenDayProfit || 0), icon: Banknote, color: 'text-red-400' },
  ] : [
    { label: 'Daily Profit', value: 'Loading...', icon: DollarSign, color: 'text-red-400' },
    { label: 'Daily Total', value: 'Loading...', icon: TrendingUp, color: 'text-red-400' },
    { label: 'Games Today', value: 'Loading...', icon: PieChart, color: 'text-red-400' },
    { label: 'Weekly Total', value: 'Loading...', icon: PieChart, color: 'text-red-400' },
    { label: 'Weekly Profit', value: 'Loading...', icon: Banknote, color: 'text-red-400' },
    { label: '15 Day Profit', value: 'Loading...', icon: Banknote, color: 'text-red-400' },
  ];

  // Use recent games data from last 10 days
  const tableData = dashboardData?.recentGames?.map((game: any) => ({
    date: new Date(game.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
    games: game.games,
    playersBet: game.playersBet,
    playersWon: game.playersWon,
    houseProfit: game.houseProfit
  })) || [];

  // Type for table row data
  type TableRow = {
    date: string;
    games: number;
    playersBet: string;
    playersWon: string;
    houseProfit: string;
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      {/* Mobile-friendly container with responsive padding and max-width */}
      {/* Error Message */}
      {error && (
        <div className="bg-red-900 border border-red-600 text-white px-4 py-3 rounded-lg relative mb-6" role="alert">
          <strong className="font-bold">Dashboard Error:</strong>
          <span className="block sm:inline ml-2">{error}</span>
          <button
            onClick={() => {
              setError(null);
              setLoading(true);
              fetchDashboardData();
            }}
            className="mt-2 bg-red-700 hover:bg-red-600 px-3 py-1 rounded text-sm"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && !error && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          <p className="mt-2 text-slate-400">Loading dashboard data...</p>
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-6 sm:mb-8">
        <h2 className="text-xl sm:text-2xl font-bold mb-2">{user?.username || 'User'}</h2>
        {/* Only show balance for non-admin users */}
        {(!user?.role || user.role !== 'admin') && (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-2">
            <span className="text-base sm:text-lg">
              Balance {showBalance ? formatCurrency(user?.balance || 0) : '****'}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowBalance(!showBalance)}
                className="p-2 hover:bg-slate-700 rounded transition-colors"
                title={showBalance ? 'Hide balance' : 'Show balance'}
              >
                {showBalance ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              <button
                onClick={handleRefreshBalance}
                disabled={refreshing}
                className={`p-2 hover:bg-slate-700 rounded transition-colors ${refreshing ? 'animate-spin' : ''}`}
                title="Refresh balance"
              >
                <RefreshCw size={16} />
              </button>
              <button
                onClick={runDiagnostics}
                className="p-2 hover:bg-slate-700 rounded text-yellow-400 transition-colors"
                title="Run diagnostics (check console)"
              >
                🔍
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-slate-800 p-3 sm:p-4 rounded-lg shadow-sm">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded ${stat.color} bg-slate-700 flex-shrink-0`}>
                  <Icon size={18} className="sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-slate-400 truncate">{stat.label}</p>
                  <p className="font-bold text-sm sm:text-base truncate">{stat.value}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>



      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6 sm:mb-8">
        <button
          onClick={() => navigate('/game-analytics')}
          className="bg-blue-600 hover:bg-blue-700 px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-medium transition-colors cursor-pointer text-sm sm:text-base"
        >
          Game Analytics
        </button>
        <button className="bg-pink-600 hover:bg-pink-700 px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-medium transition-colors text-sm sm:text-base">
          Go to Jackpot Data
        </button>
        <button className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm transition-colors sm:ml-auto">
          Adjust House Cut
        </button>
      </div>

      {/* Chart */}
      <div className="mb-6 sm:mb-8">
        <div className="bg-slate-800 p-3 sm:p-4 rounded-lg">
          <StatsChart data={dashboardData?.chartData} />
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-slate-800 rounded-lg overflow-hidden shadow-lg">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-700">
          <h3 className="text-base sm:text-lg font-semibold text-white">Games Summary</h3>
          <p className="text-xs sm:text-sm text-slate-400">Last 10 days performance</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="bg-slate-700">
              <tr>
                <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Date</th>
                <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Games</th>
                <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Players Bet</th>
                <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Players Won</th>
                <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">House Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {tableData.map((row: TableRow, index: number) => (
                <tr key={index} className="hover:bg-slate-750 transition-colors duration-150">
                  <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-white">{row.date}</td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-slate-300">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-900 text-blue-200">
                      {row.games}
                    </span>
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-green-400 font-medium">{row.playersBet}</td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-yellow-400 font-medium">{row.playersWon}</td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm">
                    <span className={`font-medium ${parseFloat(row.houseProfit.replace(/[^0-9.-]/g, '')) >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {row.houseProfit}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {tableData.length === 0 || tableData[0].date === 'No data available' ? (
          <div className="px-4 sm:px-6 py-6 sm:py-8 text-center">
            <p className="text-slate-400 text-sm">No recent games data available</p>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default Dashboard;
