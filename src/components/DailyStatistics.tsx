import React, { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, TrendingUp, DollarSign, Users, Download } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

interface DailyStats {
  date: string;
  games: number;
  totalBet: number;
  totalWin: number;
  houseProfit: number;
}

interface DailyStatisticsProps {
  userId?: string;
  username?: string;
  onBack?: () => void;
}

const DailyStatistics: React.FC<DailyStatisticsProps> = ({ userId, username, onBack }) => {
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('30'); // 7, 15, 30 days

  useEffect(() => {
    if (userId) {
      fetchDailyStats();
    }
  }, [userId, selectedPeriod]);

  const fetchDailyStats = async () => {
    if (!userId) return;
    
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/admin/user-daily-stats/${userId}?days=${selectedPeriod}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setDailyStats(data.dailyStats || []);
      } else {
        console.error('Error fetching daily stats:', response.status);
        setDailyStats([]);
      }
    } catch (error) {
      console.error('Error fetching daily stats:', error);
      setDailyStats([]);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['Date', 'Games', 'Total Bet', 'Total Win', 'House Profit'];
    const csvRows = [headers.join(',')];

    dailyStats.forEach((stat) => {
      const row = [
        stat.date,
        stat.games,
        stat.totalBet,
        stat.totalWin,
        stat.houseProfit
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `${username}-daily-stats-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Calculate totals
  const totals = dailyStats.reduce((acc, stat) => ({
    games: acc.games + stat.games,
    totalBet: acc.totalBet + stat.totalBet,
    totalWin: acc.totalWin + stat.totalWin,
    houseProfit: acc.houseProfit + stat.houseProfit
  }), { games: 0, totalBet: 0, totalWin: 0, houseProfit: 0 });

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-slate-900 min-h-screen text-white">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <ArrowLeft size={24} />
            </button>
          )}
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <Calendar className="w-8 h-8 text-blue-400" />
              Daily Statistics
            </h1>
            <p className="text-sm sm:text-base text-slate-400">
              {username ? `User: ${username}` : 'All Users'} - Last {selectedPeriod} days
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
          >
            <option value="7">Last 7 days</option>
            <option value="15">Last 15 days</option>
            <option value="30">Last 30 days</option>
          </select>
          
          <button
            onClick={exportToCSV}
            disabled={dailyStats.length === 0}
            className="px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white text-sm sm:text-base rounded-lg transition-colors flex items-center gap-2"
          >
            <Download size={16} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-5 h-5 text-blue-400" />
            <span className="text-sm text-slate-400">Total Games</span>
          </div>
          <div className="text-2xl font-bold text-blue-400">{totals.games}</div>
        </div>
        
        <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-yellow-400" />
            <span className="text-sm text-slate-400">Total Bet</span>
          </div>
          <div className="text-2xl font-bold text-yellow-400">{totals.totalBet.toLocaleString()}</div>
        </div>
        
        <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-green-400" />
            <span className="text-sm text-slate-400">Total Win</span>
          </div>
          <div className="text-2xl font-bold text-green-400">{totals.totalWin.toLocaleString()}</div>
        </div>
        
        <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-emerald-400" />
            <span className="text-sm text-slate-400">House Profit</span>
          </div>
          <div className="text-2xl font-bold text-emerald-400">{totals.houseProfit.toLocaleString()}</div>
        </div>
      </div>

      {/* Daily Statistics Table */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 sm:p-6">
        <h2 className="text-xl font-bold mb-4">Daily Breakdown</h2>
        
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : dailyStats.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">Games</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">Total Bet</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">Total Win</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">House Profit</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">Win Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {dailyStats.map((stat, index) => {
                  const winRate = stat.totalBet > 0 ? ((stat.totalWin / stat.totalBet) * 100) : 0;
                  
                  return (
                    <tr key={index} className="hover:bg-slate-700 transition-colors">
                      <td className="px-4 py-3 text-sm text-white font-medium">{stat.date}</td>
                      <td className="px-4 py-3 text-sm text-blue-400 font-semibold">{stat.games}</td>
                      <td className="px-4 py-3 text-sm text-slate-300">{stat.totalBet.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-green-400">{stat.totalWin.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-emerald-400 font-semibold">{stat.houseProfit.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-slate-300">{winRate.toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-slate-400">
            No daily statistics available for the selected period
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyStatistics;