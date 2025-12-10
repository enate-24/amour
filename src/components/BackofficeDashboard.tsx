import React, { useState, useEffect } from 'react';
import { Users, Search, UserCheck, UserX, Shield, Crown, TrendingUp, DollarSign, Download } from 'lucide-react';
import DailyStatistics from './DailyStatistics';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  balance: number;
  total_games_played: number;
  total_winnings: number;
  is_active: boolean;
  created_at: string;
  cartelaCount?: number;
  activeCartelaCount?: number;
}

interface UserStats {
  userId: string;
  username: string;
  userType: string;
  balance: number;
  balanceLimit: number | null;
  dailyGames: number;
  dailyHouseProfit: number;
  weeklyProfit: number;
  houseBonus: number;
  isActive: boolean;
  date: string;
}

interface ProfitSummary {
  dailyProfit: number;
  weeklyProfit: number;
  fifteenDayProfit: number;
}

const BackofficeDashboard: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [userStats, setUserStats] = useState<UserStats[]>([]);
  const [profitSummary, setProfitSummary] = useState<ProfitSummary>({
    dailyProfit: 0,
    weeklyProfit: 0,
    fifteenDayProfit: 0
  });
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [statsSearchTerm, setStatsSearchTerm] = useState('');
  const [showDailyStats, setShowDailyStats] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUsername, setSelectedUsername] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
    fetchUserStats();
    fetchProfitSummary();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/admin/users`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      } else {
        console.error('Error fetching users:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserStats = async () => {
    try {
      setStatsLoading(true);
      
      // Try the new user-stats endpoint first
      let response = await fetch(`${API_BASE_URL}/admin/user-stats`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUserStats(data.stats || []);
        return;
      }

      console.error('Error fetching user stats:', response.status);
    } catch (error) {
      console.error('Error fetching user stats:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchProfitSummary = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/dashboard`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setProfitSummary({
          dailyProfit: data.dailyProfit || 0,
          weeklyProfit: data.weeklyProfit || 0,
          fifteenDayProfit: data.fifteenDayProfit || 0
        });
      }
    } catch (error) {
      console.error('Error fetching profit summary:', error);
    }
  };

  const handleToggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ is_active: !currentStatus })
      });

      if (response.ok) {
        setUsers(prev => prev.map(user =>
          user.id === userId ? { ...user, is_active: !currentStatus } : user
        ));
      } else {
        console.error('Error updating user status:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error updating user status:', error);
    }
  };

  const showUserDailyStats = (userId: string, username: string) => {
    setSelectedUserId(userId);
    setSelectedUsername(username);
    setShowDailyStats(true);
  };

  const backToDashboard = () => {
    setShowDailyStats(false);
    setSelectedUserId(null);
    setSelectedUsername(null);
  };

  const exportToCSV = () => {
    // Create CSV content
    const headers = ['#', 'User', 'Status', 'Balance', 'Date', 'Total Games (Week)', 'Daily Profit', 'Weekly Profit', 'House Bonus'];
    const csvRows = [headers.join(',')];

    filteredStats.forEach((stat, index) => {
      const row = [
        index + 1,
        stat.username,
        stat.isActive ? 'Active' : 'Inactive',
        stat.userType === 'prepaid' ? stat.balance : 'Unlimited',
        new Date(stat.date).toLocaleDateString(),
        stat.dailyGames || 0,
        stat.dailyHouseProfit || 0,
        stat.weeklyProfit || 0,
        stat.houseBonus
      ];
      csvRows.push(row.join(','));
    });

    // Create blob and download
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `user-statistics-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Crown size={16} className="text-yellow-400" />;
      case 'cashier': return <Shield size={16} className="text-blue-400" />;
      default: return <Users size={16} className="text-gray-400" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-yellow-100 text-yellow-700';
      case 'cashier': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' ||
                         (statusFilter === 'active' && user.is_active) ||
                         (statusFilter === 'inactive' && !user.is_active);

    return matchesSearch && matchesRole && matchesStatus;
  });

  const filteredStats = userStats.filter(stat => 
    stat.username.toLowerCase().includes(statsSearchTerm.toLowerCase())
  );

  // Show Daily Statistics page if selected
  if (showDailyStats && selectedUserId && selectedUsername) {
    return (
      <DailyStatistics
        userId={selectedUserId}
        username={selectedUsername}
        onBack={backToDashboard}
      />
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-slate-900 min-h-screen text-white">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Backoffice Dashboard</h1>
          <p className="text-sm sm:text-base text-slate-400">Today's Overview - {new Date().toLocaleDateString()}</p>
        </div>
        <div className="flex items-center gap-2 text-green-400">
          <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
          <span className="text-sm sm:text-base font-medium">System Online</span>
        </div>
      </div>

      {/* Profit Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Daily Profit */}
        <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-lg p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-white text-sm font-medium opacity-90">Daily Profit</h3>
            <DollarSign className="w-8 h-8 text-white opacity-80" />
          </div>
          <p className="text-3xl font-bold text-white mb-1">
            {profitSummary.dailyProfit.toLocaleString()} Birr
          </p>
          <p className="text-green-100 text-xs">Today's earnings</p>
        </div>

        {/* Weekly Profit */}
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-white text-sm font-medium opacity-90">Weekly Profit</h3>
            <TrendingUp className="w-8 h-8 text-white opacity-80" />
          </div>
          <p className="text-3xl font-bold text-white mb-1">
            {profitSummary.weeklyProfit.toLocaleString()} Birr
          </p>
          <p className="text-blue-100 text-xs">Last 7 days</p>
        </div>

        {/* 15-Day Profit */}
        <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-lg p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-white text-sm font-medium opacity-90">15-Day Profit</h3>
            <TrendingUp className="w-8 h-8 text-white opacity-80" />
          </div>
          <p className="text-3xl font-bold text-white mb-1">
            {profitSummary.fifteenDayProfit.toLocaleString()} Birr
          </p>
          <p className="text-purple-100 text-xs">Last 15 days</p>
        </div>
      </div>

      {/* User Statistics Table */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 sm:p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-green-400 flex-shrink-0" />
            <h2 className="text-xl sm:text-2xl font-bold">User Statistics</h2>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <button
              onClick={exportToCSV}
              className="px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm sm:text-base rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Download size={16} />
              <span className="hidden sm:inline">Export CSV</span>
              <span className="sm:hidden">Export</span>
            </button>
            <button
              onClick={() => {
                fetchUserStats();
                fetchProfitSummary();
              }}
              className="px-3 sm:px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm sm:text-base rounded-lg transition-colors"
            >
              Refresh Stats
            </button>
          </div>
        </div>

        {/* Stats Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by username..."
              value={statsSearchTerm}
              onChange={(e) => setStatsSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 sm:py-3 bg-slate-700 border border-slate-600 rounded-lg focus:border-green-500 focus:outline-none text-white text-sm sm:text-base"
            />
          </div>
        </div>

        {/* Loading State */}
        {statsLoading ? (
          <div className="bg-slate-700 rounded-lg p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
            <p className="text-slate-400">Loading statistics...</p>
          </div>
        ) : filteredStats.length === 0 ? (
          <div className="bg-slate-700 rounded-lg p-8 text-center">
            <p className="text-slate-400">No statistics found</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View - Hidden on Mobile */}
            <div className="hidden md:block bg-slate-700 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-600">
                    <tr>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">#</th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">User</th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Status</th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Balance</th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Games (Week)</th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Daily Profit</th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Weekly Profit</th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">House Bonus</th>
                    </tr>
                  </thead>
                  <tbody className="bg-slate-700 divide-y divide-slate-600">
                    {filteredStats.map((stat, index) => (
                      <tr key={stat.userId} className="hover:bg-slate-600 transition-colors">
                        <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-slate-300 font-medium">
                          {index + 1}
                        </td>
                        <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => showUserDailyStats(stat.userId, stat.username)}
                            className="text-sm font-medium text-blue-400 hover:text-blue-300 hover:underline cursor-pointer transition-colors"
                          >
                            {stat.username}
                          </button>
                        </td>
                        <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs rounded ${
                            stat.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {stat.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm">
                          {stat.userType === 'prepaid' ? (
                            <div className="flex items-center gap-1 text-orange-400 font-semibold">
                              <DollarSign size={14} />
                              {stat.balance.toLocaleString()}
                            </div>
                          ) : (
                            <span className="text-slate-500 text-xs">Unlimited</span>
                          )}
                        </td>
                        <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-blue-400 font-semibold">
                          {stat.dailyGames || 0}
                        </td>
                        <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-green-400 font-semibold">
                          <div className="flex items-center gap-1">
                            <DollarSign size={14} />
                            {(stat.dailyHouseProfit || 0).toLocaleString()}
                          </div>
                        </td>
                        <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-blue-400 font-semibold">
                          <div className="flex items-center gap-1">
                            <DollarSign size={14} />
                            {(stat.weeklyProfit || 0).toLocaleString()}
                          </div>
                        </td>
                        <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-yellow-400 font-semibold">
                          <div className="flex items-center gap-1">
                            <DollarSign size={14} />
                            {stat.houseBonus.toLocaleString()}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card View - Visible only on Mobile */}
            <div className="md:hidden space-y-4">
              {filteredStats.map((stat, index) => (
                <div key={stat.userId} className="bg-slate-700 rounded-lg p-4 border border-slate-600">
                  {/* Header Row */}
                  <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-600">
                    <div className="flex items-center gap-3">
                      <span className="text-slate-400 font-medium text-sm">#{index + 1}</span>
                      <button
                        onClick={() => showUserDailyStats(stat.userId, stat.username)}
                        className="text-base font-semibold text-blue-400 hover:text-blue-300 hover:underline"
                      >
                        {stat.username}
                      </button>
                    </div>
                    <span className={`px-2 py-1 text-xs rounded ${
                      stat.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {stat.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Balance */}
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Balance</p>
                      {stat.userType === 'prepaid' ? (
                        <div className="flex items-center gap-1 text-orange-400 font-semibold">
                          <DollarSign size={14} />
                          <span className="text-sm">{stat.balance.toLocaleString()}</span>
                        </div>
                      ) : (
                        <span className="text-slate-500 text-xs">Unlimited</span>
                      )}
                    </div>

                    {/* Games */}
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Games (Week)</p>
                      <p className="text-sm text-blue-400 font-semibold">{stat.dailyGames || 0}</p>
                    </div>

                    {/* Daily Profit */}
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Daily Profit</p>
                      <div className="flex items-center gap-1 text-green-400 font-semibold">
                        <DollarSign size={14} />
                        <span className="text-sm">{(stat.dailyHouseProfit || 0).toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Weekly Profit */}
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Weekly Profit</p>
                      <div className="flex items-center gap-1 text-blue-400 font-semibold">
                        <DollarSign size={14} />
                        <span className="text-sm">{(stat.weeklyProfit || 0).toLocaleString()}</span>
                      </div>
                    </div>

                    {/* House Bonus */}
                    <div className="col-span-2">
                      <p className="text-xs text-slate-400 mb-1">House Bonus</p>
                      <div className="flex items-center gap-1 text-yellow-400 font-semibold">
                        <DollarSign size={14} />
                        <span className="text-sm">{stat.houseBonus.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>


    </div>
  );
};

export default BackofficeDashboard;
