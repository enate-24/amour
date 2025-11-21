import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, Users, Gamepad as GamepadIcon, Search, UserCheck, UserX, Shield, Crown } from 'lucide-react';

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

const BackofficeDashboard: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const todayStats = {
    totalRevenue: 15725,
    totalProfit: 3717.5,
    totalGames: 19,
    activeUsers: 42,
    totalBets: 287,
    winRate: 23.8,
    avgBetAmount: 54.8,
    peakHour: '14:00-15:00'
  };

  useEffect(() => {
    fetchUsers();
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

  return (
    <div className="p-6 bg-slate-900 min-h-screen text-white">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Backoffice Dashboard</h1>
          <p className="text-slate-400">Today's Overview - {new Date().toLocaleDateString()}</p>
        </div>
        <div className="flex items-center gap-2 text-green-400">
          <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
          <span className="font-medium">System Online</span>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="w-8 h-8 text-green-400" />
            <h3 className="text-lg font-semibold">Today's Revenue</h3>
          </div>
          <p className="text-3xl font-bold text-green-400">
            {todayStats.totalRevenue.toLocaleString()} BIRR
          </p>
          <p className="text-sm text-slate-400">+15.2% from yesterday</p>
        </div>

        <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-8 h-8 text-blue-400" />
            <h3 className="text-lg font-semibold">Today's Profit</h3>
          </div>
          <p className="text-3xl font-bold text-blue-400">
            {todayStats.totalProfit.toLocaleString()} BIRR
          </p>
          <p className="text-sm text-slate-400">Margin: 23.6%</p>
        </div>

        <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
          <div className="flex items-center gap-3 mb-2">
            <GamepadIcon className="w-8 h-8 text-purple-400" />
            <h3 className="text-lg font-semibold">Games Today</h3>
          </div>
          <p className="text-3xl font-bold text-purple-400">{todayStats.totalGames}</p>
          <p className="text-sm text-slate-400">Avg: 1.6 games/hour</p>
        </div>

        <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-8 h-8 text-yellow-400" />
            <h3 className="text-lg font-semibold">Active Users</h3>
          </div>
          <p className="text-3xl font-bold text-yellow-400">{todayStats.activeUsers}</p>
          <p className="text-sm text-slate-400">Peak: {todayStats.peakHour}</p>
        </div>
      </div>

      {/* User Management Section */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-400" />
            <h2 className="text-2xl font-bold">User Management</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchUsers}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* User Filters */}
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search users by username or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-700 border border-slate-600 rounded-lg focus:border-blue-500 focus:outline-none text-white"
              />
            </div>
          </div>

          <div className="w-full lg:w-48">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg focus:border-blue-500 focus:outline-none text-white"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="cashier">Cashier</option>
              <option value="user">User</option>
            </select>
          </div>

          <div className="w-full lg:w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg focus:border-blue-500 focus:outline-none text-white"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* User Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-700 p-4 rounded-lg">
            <div className="text-2xl font-bold text-blue-400">{users.length}</div>
            <div className="text-sm text-slate-400">Total Users</div>
          </div>
          <div className="bg-slate-700 p-4 rounded-lg">
            <div className="text-2xl font-bold text-green-400">{users.filter(u => u.is_active).length}</div>
            <div className="text-sm text-slate-400">Active Users</div>
          </div>
          <div className="bg-slate-700 p-4 rounded-lg">
            <div className="text-2xl font-bold text-yellow-400">{users.filter(u => u.role === 'admin').length}</div>
            <div className="text-sm text-slate-400">Admins</div>
          </div>
          <div className="bg-slate-700 p-4 rounded-lg">
            <div className="text-2xl font-bold text-purple-400">{users.filter(u => u.role === 'cashier').length}</div>
            <div className="text-sm text-slate-400">Cashiers</div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-slate-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-600">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Balance</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Games Played</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Winnings</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Cartelas</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Joined</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-slate-700 divide-y divide-slate-600">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-4 text-center text-slate-400">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                      Loading users...
                    </td>
                  </tr>
                ) : filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-600">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div>
                            <div className="text-sm font-medium text-white">{user.username}</div>
                            <div className="text-sm text-slate-400">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getRoleIcon(user.role)}
                          <span className={`px-2 py-1 text-xs rounded ${getRoleColor(user.role)}`}>
                            {user.role}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                        {(user.balance || 0).toLocaleString()} BIRR
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                        {user.total_games_played}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-400">
                        {(user.total_winnings || 0).toLocaleString()} BIRR
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                        <div className="flex flex-col">
                          <span>{user.cartelaCount || 0} total</span>
                          <span className="text-xs text-green-400">{user.activeCartelaCount || 0} active</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded ${
                          user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleToggleUserStatus(user.id, user.is_active)}
                          className={`px-3 py-1 rounded text-xs transition-colors ${
                            user.is_active
                              ? 'bg-red-600 hover:bg-red-700 text-white'
                              : 'bg-green-600 hover:bg-green-700 text-white'
                          }`}
                        >
                          {user.is_active ? <UserX size={14} /> : <UserCheck size={14} />}
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="px-6 py-4 text-center text-slate-400">
                      No users found matching the current filters
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
