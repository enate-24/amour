import React, { useState, useEffect } from 'react';
import { Users, Search, UserCheck, UserX, Shield, Crown, TrendingUp, DollarSign, Download } from 'lucide-react';

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
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [userDailyData, setUserDailyData] = useState<any[]>([]);
  const [dailyDataLoading, setDailyDataLoading] = useState(false);

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

      // Fallback: Use weekly-report endpoint to calculate stats
      console.log('user-stats endpoint not available, using weekly-report fallback');
      response = await fetch(`${API_BASE_URL}/admin/weekly-report?period=week`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const reportUsers = data.users || [];
        
        // Transform weekly report data to user stats format
        const calculatedStats: UserStats[] = reportUsers.map((user: any) => {
          // Estimate daily as 1/7 of weekly (rough approximation)
          const dailyEstimate = Math.round(user.periodHouseProfit / 7);
          
          return {
            userId: user.id,
            username: user.username,
            dailyGames: Math.round(user.periodGamesPlayed / 7),
            dailyHouseProfit: dailyEstimate,
            weeklyProfit: Math.round(user.periodHouseProfit),
            houseBonus: Math.round(user.periodHouseProfit * 0.05),
            isActive: true, // Assume active if in report
            date: new Date().toISOString()
          };
        });
        
        setUserStats(calculatedStats);
      } else {
        console.error('Error fetching stats:', response.status);
        // Last fallback: show users with zero stats
        const allUsers = await fetch(`${API_BASE_URL}/admin/users`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (allUsers.ok) {
          const userData = await allUsers.json();
          const zeroStats: UserStats[] = (userData.users || []).map((user: any) => ({
            userId: user.id,
            username: user.username,
            dailyGames: 0,
            dailyHouseProfit: 0,
            weeklyProfit: 0,
            houseBonus: 0,
            isActive: user.is_active,
            date: new Date().toISOString()
          }));
          setUserStats(zeroStats);
        }
      }
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

  const fetchUserDailyData = async (userId: string, username: string) => {
    try {
      setDailyDataLoading(true);
      setSelectedUser(username);
      
      const response = await fetch(`${API_BASE_URL}/admin/user-daily-stats/${userId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUserDailyData(data.dailyStats || []);
      } else {
        console.error('Error fetching user daily data:', response.status);
        setUserDailyData([]);
      }
    } catch (error) {
      console.error('Error fetching user daily data:', error);
      setUserDailyData([]);
    } finally {
      setDailyDataLoading(false);
    }
  };

  const closeModal = () => {
    setSelectedUser(null);
    setUserDailyData([]);
  };

  const exportToCSV = () => {
    // Create CSV content
    const headers = ['#', 'User', 'Status', 'Date', 'Total Games (Week)', 'House Profit (Today)', 'House Profit (Week)', 'House Bonus'];
    const csvRows = [headers.join(',')];

    filteredStats.forEach((stat, index) => {
      const row = [
        index + 1,
        stat.username,
        stat.isActive ? 'Active' : 'Inactive',
        new Date(stat.date).toLocaleDateString(),
        stat.dailyGames || 0,
        stat.dailyHouseProfit,
        stat.weeklyProfit,
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
            <table className="w-full min-w-[800px]">
              <thead className="bg-slate-600">
                <tr>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">#</th>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">User</th>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Status</th>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Date</th>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Total Games (Week)</th>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">House Profit (Today)</th>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">House Profit (Week)</th>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">House Bonus</th>
                </tr>
              </thead>
              <tbody className="bg-slate-700 divide-y divide-slate-600">
                {statsLoading ? (
                  <tr>
                    <td colSpan={8} className="px-3 sm:px-6 py-4 text-center text-slate-400">
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
                          onClick={() => fetchUserDailyData(stat.userId, stat.username)}
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
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-semibold">
                        <div className="flex items-center gap-1">
                          <DollarSign size={14} className={stat.dailyHouseProfit > 0 ? 'text-green-400' : 'text-slate-500'} />
                          <span className={stat.dailyHouseProfit > 0 ? 'text-green-400' : 'text-slate-500'}>
                            {stat.dailyHouseProfit.toLocaleString()}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-semibold">
                        <div className="flex items-center gap-1">
                          <DollarSign size={14} className={stat.weeklyProfit > 0 ? 'text-emerald-400' : 'text-slate-500'} />
                          <span className={stat.weeklyProfit > 0 ? 'text-emerald-400' : 'text-slate-500'}>
                            {stat.weeklyProfit.toLocaleString()}
                          </span>
                        </div>
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
                    <td colSpan={8} className="px-3 sm:px-6 py-4 text-center text-slate-400 text-sm">
                      No statistics found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* User Management Section */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <Users className="w-6 h-6 sm:w-8 sm:h-8 text-blue-400 flex-shrink-0" />
            <h2 className="text-xl sm:text-2xl font-bold">User Management</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchUsers}
              className="px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm sm:text-base rounded-lg transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* User Filters */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 sm:py-3 bg-slate-700 border border-slate-600 rounded-lg focus:border-blue-500 focus:outline-none text-white text-sm sm:text-base"
              />
            </div>
          </div>

          <div className="w-full sm:w-40 lg:w-48">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full p-2.5 sm:p-3 bg-slate-700 border border-slate-600 rounded-lg focus:border-blue-500 focus:outline-none text-white text-sm sm:text-base"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="cashier">Cashier</option>
              <option value="user">User</option>
            </select>
          </div>

          <div className="w-full sm:w-40 lg:w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full p-2.5 sm:p-3 bg-slate-700 border border-slate-600 rounded-lg focus:border-blue-500 focus:outline-none text-white text-sm sm:text-base"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* User Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <div className="bg-slate-700 p-3 sm:p-4 rounded-lg">
            <div className="text-xl sm:text-2xl font-bold text-blue-400">{users.length}</div>
            <div className="text-xs sm:text-sm text-slate-400">Total Users</div>
          </div>
          <div className="bg-slate-700 p-3 sm:p-4 rounded-lg">
            <div className="text-xl sm:text-2xl font-bold text-green-400">{users.filter(u => u.is_active).length}</div>
            <div className="text-xs sm:text-sm text-slate-400">Active Users</div>
          </div>
          <div className="bg-slate-700 p-3 sm:p-4 rounded-lg">
            <div className="text-xl sm:text-2xl font-bold text-yellow-400">{users.filter(u => u.role === 'admin').length}</div>
            <div className="text-xs sm:text-sm text-slate-400">Admins</div>
          </div>
          <div className="bg-slate-700 p-3 sm:p-4 rounded-lg">
            <div className="text-xl sm:text-2xl font-bold text-purple-400">{users.filter(u => u.role === 'cashier').length}</div>
            <div className="text-xs sm:text-sm text-slate-400">Cashiers</div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-slate-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead className="bg-slate-600">
                <tr>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">User</th>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Role</th>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Balance</th>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Games</th>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Winnings</th>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Cartelas</th>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Status</th>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Joined</th>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-slate-700 divide-y divide-slate-600">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-3 sm:px-6 py-4 text-center text-slate-400">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                      <p className="text-sm">Loading users...</p>
                    </td>
                  </tr>
                ) : filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-600 transition-colors">
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="min-w-0">
                            <div className="text-xs sm:text-sm font-medium text-white truncate">{user.username}</div>
                            <div className="text-xs text-slate-400 truncate">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1 sm:gap-2">
                          {getRoleIcon(user.role)}
                          <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 text-xs rounded ${getRoleColor(user.role)}`}>
                            {user.role}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-white">
                        {(user.balance || 0).toLocaleString()}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-slate-300">
                        {user.total_games_played}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-green-400">
                        {(user.total_winnings || 0).toLocaleString()}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-slate-300">
                        <div className="flex flex-col">
                          <span>{user.cartelaCount || 0} total</span>
                          <span className="text-xs text-green-400">{user.activeCartelaCount || 0} active</span>
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                        <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 text-xs rounded ${
                          user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-slate-400">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleToggleUserStatus(user.id, user.is_active)}
                          className={`p-2 rounded text-xs transition-colors ${
                            user.is_active
                              ? 'bg-red-600 hover:bg-red-700 text-white'
                              : 'bg-green-600 hover:bg-green-700 text-white'
                          }`}
                          title={user.is_active ? 'Deactivate' : 'Activate'}
                        >
                          {user.is_active ? <UserX size={14} /> : <UserCheck size={14} />}
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="px-3 sm:px-6 py-4 text-center text-slate-400 text-sm">
                      No users found matching the current filters
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* User Daily Data Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg border border-slate-700 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-4 sm:p-6 border-b border-slate-700 flex justify-between items-center">
              <h3 className="text-xl sm:text-2xl font-bold text-white">
                Daily Statistics - {selectedUser}
              </h3>
              <button
                onClick={closeModal}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1">
              {dailyDataLoading ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                </div>
              ) : userDailyData.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">Games</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">Total Bet</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">Total Win</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">House Profit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                      {userDailyData.map((day: any, index: number) => (
                        <tr key={index} className="hover:bg-slate-700 transition-colors">
                          <td className="px-4 py-3 text-sm text-white">{day.date}</td>
                          <td className="px-4 py-3 text-sm text-blue-400 font-semibold">{day.games}</td>
                          <td className="px-4 py-3 text-sm text-slate-300">{day.totalBet.toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm text-green-400">{day.totalWin.toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm text-emerald-400 font-semibold">{day.houseProfit.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400">
                  No daily data available for this user
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-6 border-t border-slate-700 flex justify-end">
              <button
                onClick={closeModal}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BackofficeDashboard;
