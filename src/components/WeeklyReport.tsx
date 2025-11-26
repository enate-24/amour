import React, { useState, useEffect } from 'react';
import { Calendar, Download, TrendingUp, DollarSign, Users, BarChart3, Loader, CalendarDays } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

interface UserStats {
  id: string;
  username: string;
  email: string;
  shopname: string | null;
  periodTotalBet: number;
  periodPlayerWin: number;
  periodHouseProfit: number;
  periodGamesPlayed: number;
  periodCartelasPlayed: number;
}

interface WeeklyReportData {
  users: UserStats[];
  summary: {
    totalUsers: number;
    activeUsersPeriod: number;
    totalBetPeriod: number;
    totalPlayerWinPeriod: number;
    totalHouseProfitPeriod: number;
    totalGamesPeriod: number;
    period: string;
    startDate: string;
    endDate: string;
    reportGeneratedAt: string;
  };
}

const WeeklyReport: React.FC = () => {
  const [period, setPeriod] = useState<'week' | '15days'>('week');
  const [data, setData] = useState<WeeklyReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWeeklyReport = async () => {
      try {
        setLoading(true);
        setError(null);

        const token = localStorage.getItem('auth_token');
        if (!token) {
          throw new Error('No authentication token found');
        }

        const response = await fetch(`${API_BASE_URL}/admin/weekly-report?period=${period}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch weekly report: ${response.statusText}`);
        }

        const reportData: WeeklyReportData = await response.json();
        setData(reportData);
      } catch (err) {
        console.error('Error fetching weekly report:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch weekly report');
      } finally {
        setLoading(false);
      }
    };

    fetchWeeklyReport();
  }, [period]);

  const exportReport = () => {
    if (!data) return;

    // Create CSV content
    const headers = ['Username', 'Email', 'Shop Name', 'Games Played', 'Cartelas Played', 'Total Bet', 'Player Win', 'House Profit'];
    const rows = data.users.map(user => [
      user.username,
      user.email,
      user.shopname || '-',
      user.periodGamesPlayed,
      user.periodCartelasPlayed,
      user.periodTotalBet.toFixed(2),
      user.periodPlayerWin.toFixed(2),
      user.periodHouseProfit.toFixed(2)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${period}-report-${data.summary.startDate}-to-${data.summary.endDate}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="p-6 bg-slate-900 min-h-screen text-white flex items-center justify-center">
        <div className="text-center">
          <Loader className="animate-spin h-12 w-12 text-yellow-400 mx-auto mb-4" />
          <p>Loading weekly report...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-slate-900 min-h-screen text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 mb-4">Error loading weekly report</div>
          <p className="text-slate-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 bg-slate-900 min-h-screen text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400">No data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-slate-900 min-h-screen text-white">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">User Reports</h1>
          <p className="text-sm sm:text-base text-slate-400 mt-1">
            {period === 'week' 
              ? `Weekly Report (${formatDate(data.summary.startDate)} - ${formatDate(data.summary.endDate)})`
              : `15-Day Report (${formatDate(data.summary.startDate)} - ${formatDate(data.summary.endDate)})`
            }
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Period Selector */}
          <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
            <button
              onClick={() => setPeriod('week')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-md transition-colors text-sm ${
                period === 'week'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Calendar size={16} />
              <span>Weekly</span>
            </button>
            <button
              onClick={() => setPeriod('15days')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-md transition-colors text-sm ${
                period === '15days'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <CalendarDays size={16} />
              <span>15 Days</span>
            </button>
          </div>

          <button
            onClick={exportReport}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors text-sm"
          >
            <Download size={16} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <div className="bg-slate-800 p-4 sm:p-6 rounded-lg border border-slate-700">
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <Users className="w-6 h-6 sm:w-8 sm:h-8 text-blue-400 flex-shrink-0" />
            <h3 className="text-xs sm:text-sm font-semibold">Total Users</h3>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-blue-400">{data.summary.totalUsers}</p>
          <div className="flex items-center gap-1 mt-2">
            <span className="text-xs sm:text-sm text-slate-400">{data.summary.activeUsersPeriod} active</span>
          </div>
        </div>

        <div className="bg-slate-800 p-4 sm:p-6 rounded-lg border border-slate-700">
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <BarChart3 className="w-6 h-6 sm:w-8 sm:h-8 text-cyan-400 flex-shrink-0" />
            <h3 className="text-xs sm:text-sm font-semibold">Total Games</h3>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-cyan-400">{data.summary.totalGamesPeriod}</p>
          <div className="flex items-center gap-1 mt-2">
            <span className="text-xs sm:text-sm text-slate-400">Games played</span>
          </div>
        </div>

        <div className="bg-slate-800 p-4 sm:p-6 rounded-lg border border-slate-700">
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <DollarSign className="w-6 h-6 sm:w-8 sm:h-8 text-green-400 flex-shrink-0" />
            <h3 className="text-xs sm:text-sm font-semibold">Total Bet</h3>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-green-400">
            {data.summary.totalBetPeriod.toLocaleString()} BIRR
          </p>
          <div className="flex items-center gap-1 mt-2">
            <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-green-400" />
            <span className="text-xs sm:text-sm text-green-400">Revenue</span>
          </div>
        </div>

        <div className="bg-slate-800 p-4 sm:p-6 rounded-lg border border-slate-700">
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-400 flex-shrink-0" />
            <h3 className="text-xs sm:text-sm font-semibold">Player Wins</h3>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-yellow-400">
            {data.summary.totalPlayerWinPeriod.toLocaleString()} BIRR
          </p>
          <div className="flex items-center gap-1 mt-2">
            <span className="text-xs sm:text-sm text-slate-400">Paid out</span>
          </div>
        </div>

        <div className="bg-slate-800 p-4 sm:p-6 rounded-lg border border-slate-700">
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <BarChart3 className="w-6 h-6 sm:w-8 sm:h-8 text-purple-400 flex-shrink-0" />
            <h3 className="text-xs sm:text-sm font-semibold">House Profit</h3>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-purple-400">
            {data.summary.totalHouseProfitPeriod.toLocaleString()} BIRR
          </p>
          <div className="flex items-center gap-1 mt-2">
            <span className="text-xs sm:text-sm text-slate-400">Net profit</span>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-slate-800 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-slate-700">
          <h2 className="text-lg sm:text-xl font-semibold">
            {period === 'week' ? 'Weekly User Statistics' : '15-Day User Statistics'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            All users with their betting activity from {formatDate(data.summary.startDate)} to {formatDate(data.summary.endDate)}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="bg-slate-700">
              <tr>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm">#</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm">Username</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm">Email</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm">Shop Name</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs sm:text-sm">Games</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs sm:text-sm">Cartelas</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm">Total Bet</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm">Player Win</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm">House Profit</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((user, index) => (
                <tr key={user.id} className={`${index % 2 === 0 ? 'bg-slate-800' : 'bg-slate-750'} hover:bg-slate-700/50 transition-colors`}>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-slate-400 font-medium text-xs sm:text-sm">
                    {index + 1}
                  </td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-bold text-xs sm:text-sm">
                          {user.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="font-medium text-white text-xs sm:text-sm truncate">{user.username}</span>
                    </div>
                  </td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-slate-300 text-xs sm:text-sm truncate">{user.email}</td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-slate-300 text-xs sm:text-sm">{user.shopname || '-'}</td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-center">
                    <span className={`font-bold text-xs sm:text-sm ${user.periodGamesPlayed > 0 ? 'text-blue-400' : 'text-slate-500'}`}>
                      {user.periodGamesPlayed}
                    </span>
                  </td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-center">
                    <span className={`font-bold text-xs sm:text-sm ${user.periodCartelasPlayed > 0 ? 'text-cyan-400' : 'text-slate-500'}`}>
                      {user.periodCartelasPlayed}
                    </span>
                  </td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-right">
                    <span className={`font-bold text-xs sm:text-sm ${user.periodTotalBet > 0 ? 'text-green-400' : 'text-slate-500'}`}>
                      {user.periodTotalBet.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-right">
                    <span className={`font-bold text-xs sm:text-sm ${user.periodPlayerWin > 0 ? 'text-yellow-400' : 'text-slate-500'}`}>
                      {user.periodPlayerWin.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-right">
                    <span className={`font-bold text-xs sm:text-sm ${user.periodHouseProfit > 0 ? 'text-purple-400' : user.periodHouseProfit < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                      {user.periodHouseProfit.toLocaleString()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-700 font-bold">
              <tr>
                <td colSpan={4} className="px-2 sm:px-4 py-2 sm:py-3 text-right text-white text-xs sm:text-sm">TOTALS:</td>
                <td className="px-2 sm:px-4 py-2 sm:py-3 text-center text-cyan-400 text-xs sm:text-sm">{data.summary.totalGamesPeriod}</td>
                <td className="px-2 sm:px-4 py-2 sm:py-3 text-center text-cyan-400 text-xs sm:text-sm">
                  {data.users.reduce((sum, u) => sum + u.periodCartelasPlayed, 0)}
                </td>
                <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-green-400 text-xs sm:text-sm">
                  {data.summary.totalBetPeriod.toLocaleString()}
                </td>
                <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-yellow-400 text-xs sm:text-sm">
                  {data.summary.totalPlayerWinPeriod.toLocaleString()}
                </td>
                <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-purple-400 text-xs sm:text-sm">
                  {data.summary.totalHouseProfitPeriod.toLocaleString()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        {data.users.length === 0 && (
          <div className="p-8 text-center text-slate-400">
            <Users className="mx-auto h-12 w-12 text-slate-600 mb-3" />
            <p className="font-medium">No users found</p>
            <p className="text-sm mt-1">No activity during this period</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default WeeklyReport;
