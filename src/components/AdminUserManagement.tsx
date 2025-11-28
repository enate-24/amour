 import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Users, Search, Lock, Ban, CheckCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
// Temporarily inline network utilities to fix import issue
const fetchWithRetry = async (url: string, options: RequestInit & { timeout?: number; retries?: number } = {}) => {
  const { timeout = 30000, retries = 2, ...fetchOptions } = options;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return response;
      
    } catch (error) {
      const isLastAttempt = attempt === retries;
      
      if (error instanceof Error) {
        console.warn(`Fetch attempt ${attempt + 1} failed:`, error.message);
        
        if (isLastAttempt) {
          throw error;
        }
        
        // Wait before retrying
        if (!isLastAttempt) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } else {
        throw new Error('Unknown network error');
      }
    }
  }
  
  throw new Error('All retry attempts failed');
};

const getNetworkErrorMessage = (error: any): string => {
  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      return 'Request timeout - the server took too long to respond. Please try again.';
    } else if (error.message.includes('ERR_QUIC_PROTOCOL_ERROR') || error.message.includes('Failed to fetch')) {
      return 'Network connection error. The backend server may be unavailable. Please check your connection and try again.';
    }
    return error.message;
  }
  return 'An unexpected error occurred';
};

const checkServerHealth = async (baseUrl: string): Promise<boolean> => {
  try {
    const response = await fetchWithRetry(`${baseUrl}/health`, {
      method: 'GET',
      timeout: 10000,
      retries: 1
    });
    return response.ok;
  } catch (error) {
    console.warn('Server health check failed:', error);
    return false;
  }
};

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

interface User {
  id: string;
  username: string;
  email: string;
  shopname?: string;
  role: string;
  balance: number;
  totalGamesPlayed: number;
  totalWinnings: number;
  is_active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CreateUserData {
  username: string;
  email: string;
  password: string;
  shopname: string;
  role: string;
  userType: string;
  balanceLimit?: number;
}

const AdminUserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState<CreateUserData>({
    username: '',
    email: '',
    password: '',
    shopname: '',
    role: 'user',
    userType: 'prepaid'
  });
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordUserId, setPasswordUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [showTroubleshootModal, setShowTroubleshootModal] = useState(false);

  const { user: currentUser } = useAuth();

  // Check backend connectivity with retry
  const checkBackendStatus = async () => {
    setBackendStatus('checking');
    const isOnline = await checkServerHealth(API_BASE_URL);
    setBackendStatus(isOnline ? 'online' : 'offline');
  };

  // Fetch users
  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(''); // Clear previous errors
      
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetchWithRetry(`${API_BASE_URL}/admin/users`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000,
        retries: 2
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setUsers(data.users || []);
      setBackendStatus('online'); // Update status on successful fetch
      
    } catch (err) {
      console.error('Fetch users error:', err);
      setError(getNetworkErrorMessage(err));
      
      // Update backend status if it's a network error
      if (err && typeof err === 'object' && 'isNetworkError' in err) {
        setBackendStatus('offline');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkBackendStatus();
    fetchUsers();
  }, []);

  // Filter users based on search term
  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.shopname && user.shopname.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  // Validate form
  const validateForm = (): string[] => {
    const errors: string[] = [];

    if (!formData.username || formData.username.length < 3) {
      errors.push('Username must be at least 3 characters');
    }

    if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.push('Valid email is required');
    }

    if (!formData.password || formData.password.length < 6) {
      errors.push('Password must be at least 6 characters');
    }

    if (formData.shopname && formData.shopname.length < 2) {
      errors.push('Shop name must be at least 2 characters');
    }

    return errors;
  };

  // Create user
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors = validateForm();
    if (errors.length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      setSubmitting(true);
      setFormErrors([]);

      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`${API_BASE_URL}/admin/users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to create user' }));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      await response.json();

      // Refresh users list
      await fetchUsers();

      // Reset form and close modal
      setFormData({
        username: '',
        email: '',
        password: '',
        shopname: '',
        role: 'user',
        userType: 'prepaid'
      });
      setShowCreateModal(false);

    } catch (err) {
      setFormErrors([err instanceof Error ? err.message : 'Failed to create user']);
    } finally {
      setSubmitting(false);
    }
  };

  // Delete user with all data
  const handleDeleteUser = async (userId: string, username: string) => {
    const confirmMessage = `⚠️ WARNING: This will permanently delete user "${username}" and ALL associated data including:\n\n• All game history\n• All cartelas\n• All transaction records\n• All admin logs\n\nThis action CANNOT be undone!\n\nType "DELETE" to confirm:`;
    
    const confirmation = prompt(confirmMessage);
    
    if (confirmation !== 'DELETE') {
      if (confirmation !== null) {
        alert('Deletion cancelled. You must type "DELETE" exactly to confirm.');
      }
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      console.log('🔄 Attempting to delete user:', { userId, username });
      console.log('🔗 API URL:', `${API_BASE_URL}/admin/users/${userId}?hardDelete=true`);

      const response = await fetch(`${API_BASE_URL}/admin/users/${userId}?hardDelete=true`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('📥 Response status:', response.status);
      console.log('📥 Response ok:', response.ok);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to delete user' }));
        console.error('❌ Delete error:', errorData);
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Delete success:', result);
      alert(`✅ ${result.message}\n\nDeleted:\n• ${result.deletedData?.cartelas || 0} cartelas\n• ${result.deletedData?.affectedGames || 0} affected games`);

      // Refresh users list
      await fetchUsers();

    } catch (err) {
      console.error('❌ Delete exception:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete user');
    }
  };

  // Update user password
  const handleUpdatePassword = async () => {
    if (!passwordUserId || !newPassword) {
      setPasswordError('Password is required');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`${API_BASE_URL}/admin/users/${passwordUserId}/password`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ newPassword })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to update password' }));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      alert('✅ Password updated successfully');
      setShowPasswordModal(false);
      setPasswordUserId(null);
      setNewPassword('');
      setPasswordError('');

    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to update password');
    }
  };

  // Ban/Unban user
  const handleToggleBan = async (userId: string, username: string, currentStatus: boolean) => {
    // currentStatus is user.is_active (true = active, false = banned)
    // We want to toggle this: if active, ban them; if banned, unban them
    const action = currentStatus ? 'ban' : 'unban';
    const shouldBan = currentStatus; // if currently active, we want to ban (true)
    
    if (!confirm(`Are you sure you want to ${action} user "${username}"?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      console.log(`🔄 Attempting to ${action} user:`, { userId, username, currentStatus, shouldBan });
      console.log('🔗 API URL:', `${API_BASE_URL}/admin/users/${userId}/ban`);
      console.log('📦 Request body:', { banned: shouldBan });

      const response = await fetchWithRetry(`${API_BASE_URL}/admin/users/${userId}/ban`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ banned: shouldBan }),
        timeout: 30000,
        retries: 2
      });

      console.log('📥 Response status:', response.status);
      console.log('📥 Response ok:', response.ok);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `Failed to ${action} user` }));
        console.error('❌ Ban/unban error:', errorData);
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Ban/unban success:', result);
      alert(`✅ User ${action}ned successfully`);

      // Refresh users list
      await fetchUsers();

    } catch (err) {
      console.error('❌ Ban/unban exception:', err);
      setError(getNetworkErrorMessage(err));
    }
  };

  // Open password modal
  const openPasswordModal = (userId: string) => {
    setPasswordUserId(userId);
    setNewPassword('');
    setPasswordError('');
    setShowPasswordModal(true);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-slate-400">Loading users...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <Users className="h-6 w-6 sm:h-8 sm:h-8 text-yellow-400 flex-shrink-0" />
            <h1 className="text-2xl sm:text-3xl font-bold text-white">User Management</h1>
            {/* Backend Status Indicator */}
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${
                backendStatus === 'online' ? 'bg-green-400' :
                backendStatus === 'offline' ? 'bg-red-400' : 'bg-yellow-400'
              }`}></div>
              <span className={`text-xs ${
                backendStatus === 'online' ? 'text-green-400' :
                backendStatus === 'offline' ? 'text-red-400' : 'text-yellow-400'
              }`}>
                {backendStatus === 'online' ? 'Backend Online' :
                 backendStatus === 'offline' ? 'Backend Offline' : 'Checking...'}
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => checkBackendStatus()}
              className="bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-2 rounded-lg font-medium flex items-center space-x-2 transition-colors"
              title="Check backend status"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center space-x-2 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Create User</span>
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mb-6 flex space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search users by username, email, or shop name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Backend Status Warning */}
        {backendStatus === 'offline' && (
          <div className="mb-6 p-4 bg-orange-600/20 border border-orange-600 rounded-lg text-orange-400">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
                <span className="font-medium">Backend Server Unavailable</span>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setShowTroubleshootModal(true)}
                  className="bg-slate-600 hover:bg-slate-700 text-white px-3 py-1 rounded text-sm font-medium transition-colors"
                >
                  Troubleshoot
                </button>
                <button
                  onClick={async () => {
                    await checkBackendStatus();
                    await fetchUsers();
                  }}
                  className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded text-sm font-medium transition-colors"
                >
                  Retry Connection
                </button>
              </div>
            </div>
            <p className="mt-1 text-sm">
              The backend server at {API_BASE_URL} is not responding. This may be due to:
            </p>
            <ul className="mt-2 text-sm list-disc list-inside space-y-1">
              <li>Server maintenance or deployment</li>
              <li>Network connectivity issues</li>
              <li>Server overload (Render free tier limitations)</li>
            </ul>
            <p className="mt-2 text-sm">
              Please wait a moment and try the "Retry Connection" button, or contact support if the issue persists.
            </p>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-600/20 border border-red-600 rounded-lg text-red-400">
            {error}
          </div>
        )}

        {/* Users Table */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Shop Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Role
                  </th>

                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-700/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-white">{user.username}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-300">{user.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-300">{user.shopname || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        user.role === 'admin'
                          ? 'bg-purple-600 text-purple-100'
                          : 'bg-green-600 text-green-100'
                      }`}>
                        {user.role}
                      </span>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        user.is_active
                          ? 'bg-green-600 text-green-100'
                          : 'bg-red-600 text-red-100'
                      }`}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => openPasswordModal(user.id)}
                          className="text-purple-400 hover:text-purple-300 transition-colors"
                          title="Update password"
                        >
                          <Lock className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleToggleBan(user.id, user.username, user.is_active)}
                          className={`${
                            user.is_active 
                              ? 'text-orange-400 hover:text-orange-300' 
                              : 'text-green-400 hover:text-green-300'
                          } transition-colors`}
                          title={user.is_active ? 'Ban user' : 'Unban user'}
                          disabled={user.id === currentUser?.id}
                        >
                          {user.is_active ? <Ban className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id, user.username)}
                          className="text-red-400 hover:text-red-300 transition-colors"
                          title="Delete user and all data"
                          disabled={user.id === currentUser?.id}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredUsers.length === 0 && (
            <div className="text-center py-12">
              <Users className="mx-auto h-12 w-12 text-slate-400" />
              <h3 className="mt-2 text-sm font-medium text-slate-400">No users found</h3>
              <p className="mt-1 text-sm text-slate-500">
                {searchTerm ? 'Try adjusting your search criteria.' : 'Get started by creating your first user.'}
              </p>
            </div>
          )}
        </div>

        {/* Update Password Modal */}
        {showPasswordModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 rounded-lg border border-slate-700 w-full max-w-md">
              <div className="p-6">
                <h3 className="text-lg font-medium text-white mb-4">Update User Password</h3>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="newPassword" className="block text-sm font-medium text-slate-300 mb-1">
                      New Password *
                    </label>
                    <input
                      type="password"
                      id="newPassword"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                      placeholder="Enter new password (min 6 characters)"
                    />
                  </div>

                  {passwordError && (
                    <div className="p-3 bg-red-600/20 border border-red-600 rounded-lg">
                      <p className="text-sm text-red-400">{passwordError}</p>
                    </div>
                  )}

                  <div className="flex space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowPasswordModal(false);
                        setPasswordUserId(null);
                        setNewPassword('');
                        setPasswordError('');
                      }}
                      className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg font-medium transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleUpdatePassword}
                      className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
                    >
                      Update Password
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Create User Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 rounded-lg border border-slate-700 w-full max-w-md">
              <div className="p-6">
                <h3 className="text-lg font-medium text-white mb-4">Create New User</h3>

                <form onSubmit={handleCreateUser} className="space-y-4">
                  <div>
                    <label htmlFor="username" className="block text-sm font-medium text-slate-300 mb-1">
                      Username *
                    </label>
                    <input
                      type="text"
                      id="username"
                      name="username"
                      value={formData.username}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                      placeholder="Enter username"
                    />
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1">
                      Email *
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                      placeholder="Enter email"
                    />
                  </div>

                  <div>
                    <label htmlFor="shopname" className="block text-sm font-medium text-slate-300 mb-1">
                      Shop Name
                    </label>
                    <input
                      type="text"
                      id="shopname"
                      name="shopname"
                      value={formData.shopname}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                      placeholder="Enter shop name (optional)"
                    />
                  </div>

                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1">
                      Password *
                    </label>
                    <input
                      type="password"
                      id="password"
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                      placeholder="Enter password"
                    />
                  </div>

                  <div>
                    <label htmlFor="role" className="block text-sm font-medium text-slate-300 mb-1">
                      Role
                    </label>
                    <select
                      id="role"
                      name="role"
                      value={formData.role}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>

                  {formErrors.length > 0 && (
                    <div className="p-3 bg-red-600/20 border border-red-600 rounded-lg">
                      <ul className="text-sm text-red-400 space-y-1">
                        {formErrors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg font-medium transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white rounded-lg font-medium transition-colors"
                    >
                      {submitting ? 'Creating...' : 'Create User'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Troubleshooting Modal */}
        {showTroubleshootModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 rounded-lg border border-slate-700 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
              <div className="p-6">
                <h3 className="text-lg font-medium text-white mb-4">Network Connection Troubleshooting</h3>

                <div className="space-y-4 text-sm text-slate-300">
                  <div>
                    <h4 className="font-medium text-white mb-2">Common Issues & Solutions:</h4>
                    
                    <div className="space-y-3">
                      <div className="p-3 bg-slate-700 rounded-lg">
                        <h5 className="font-medium text-orange-400 mb-1">ERR_QUIC_PROTOCOL_ERROR</h5>
                        <p className="mb-2">This Chrome-specific error occurs with HTTP/3 protocol issues.</p>
                        <p className="font-medium">Solutions:</p>
                        <ul className="list-disc list-inside mt-1 space-y-1">
                          <li>Try refreshing the page (Ctrl+F5 or Cmd+Shift+R)</li>
                          <li>Clear browser cache and cookies</li>
                          <li>Try in an incognito/private window</li>
                          <li>Try a different browser (Firefox, Safari, Edge)</li>
                        </ul>
                      </div>

                      <div className="p-3 bg-slate-700 rounded-lg">
                        <h5 className="font-medium text-blue-400 mb-1">Server Unavailable</h5>
                        <p className="mb-2">The backend server may be temporarily down.</p>
                        <p className="font-medium">Possible causes:</p>
                        <ul className="list-disc list-inside mt-1 space-y-1">
                          <li>Server maintenance or deployment</li>
                          <li>Render free tier sleep mode (takes ~30s to wake up)</li>
                          <li>High server load or resource limits</li>
                          <li>Network connectivity issues</li>
                        </ul>
                      </div>

                      <div className="p-3 bg-slate-700 rounded-lg">
                        <h5 className="font-medium text-green-400 mb-1">Quick Fixes</h5>
                        <ul className="list-disc list-inside space-y-1">
                          <li>Wait 30-60 seconds and try again</li>
                          <li>Check your internet connection</li>
                          <li>Disable VPN if using one</li>
                          <li>Try from a different network (mobile hotspot)</li>
                          <li>Contact support if issue persists</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-600 pt-4">
                    <h4 className="font-medium text-white mb-2">Technical Details:</h4>
                    <div className="bg-slate-900 p-3 rounded font-mono text-xs">
                      <p>Backend URL: {API_BASE_URL}</p>
                      <p>Status: {backendStatus}</p>
                      <p>Browser: {navigator.userAgent.split(' ').slice(-2).join(' ')}</p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    onClick={() => setShowTroubleshootModal(false)}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg font-medium transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminUserManagement;
