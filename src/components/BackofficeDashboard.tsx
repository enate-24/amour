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
  dailyGames: number;
  dailyHouseProfit: number;
  weeklyProfit: number;
  houseBonus: number;
  isActive: boolean;
  date: string;
}

const BackofficeDashboard: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [userStats, setUserStats] = useState<UserStats[]>([]);
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
    const headers = ['#', 'User', 'Status', 'Date', 'Total Games (Week)', 'House Bonus'];
    const csvRows = [headers.join(',')];

    filteredStats.forEach((stat, index) => {
      const row = [
        index + 1,
        stat.username,
        stat.isActive ? 'Active' : 'Inactive',
        new Date(stat.date).toLocaleDateString(),
        stat.dailyGames || 0,
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



      {/* User Statistics Table */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 sm:p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-green-400 flex-shrink-0" />
            <h2 className="text-xl sm:text-2xl font-bold">User Statistics</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportToCSV}
              className="px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm sm:text-base rounded-lg transition-colors flex items-center gap-2"
            >
              <Download size={16} />
              Export CSV
            </button>
            <button
              onClick={fetchUserStats}
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

        {/* Statistics Table */}
        <div className="bg-slate-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead className="bg-slate-600">
                <tr>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">#</th>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">User</th>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Status</th>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Date</th>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Total Games (Week)</th>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">House Bonus</th>
                </tr>
              </thead>
              <tbody className="bg-slate-700 divide-y divide-slate-600">
                {statsLoading ? (
                  <tr>
                    <td colSpan={6} className="px-3 sm:px-6 py-4 text-center text-slate-400">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto mb-2"></div>
                      <p className="text-sm">Loading statistics...</p>
                    </td>
                  </tr>
                ) : filteredStats.length > 0 ? (
                  filteredStats.map((stat, index) => (
                    <tr key={stat.userId} className="hover:bg-slate-600 transition-colors">
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-slate-300 font-medium">
                        {index + 1}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                        <button
                          onClick={() => showUserDailyStats(stat.userId, stat.username)}
                          className="text-xs sm:text-sm font-medium text-blue-400 hover:text-blue-300 hover:underline cursor-pointer transition-colors"
                        >
                          {stat.username}
                        </button>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                        <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 text-xs rounded ${
                          stat.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {stat.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-slate-400">
                        {new Date(stat.date).toLocaleDateString()}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-blue-400 font-semibold">
                        {stat.dailyGames || 0}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-yellow-400 font-semibold">
                        <div className="flex items-center gap-1">
                          <DollarSign size={14} />
                          {stat.houseBonus.toLocaleString()}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-3 sm:px-6 py-4 text-center text-slate-400 text-sm">
                      No statistics found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>


    </div>
  );
};

export default BackofficeDashboard;
