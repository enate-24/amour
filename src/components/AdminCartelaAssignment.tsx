import React, { useState, useEffect } from 'react';
import { Search, Users, Grid3x3, Settings, Volume2, Plus, Minus, Eye, X, Check } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

interface User {
  id: string;
  username: string;
  email: string;
  shopname?: string;
  role: string;
  balance: number;
  is_active: boolean;
}

interface Cartela {
  id: string;
  card_id: string;
  numbers: {
    B: number[];
    I: number[];
    N: number[];
    G: number[];
    O: number[];
  };
  is_active: boolean;
  is_winner: boolean;
  purchased_at: string;
}

interface UserSettings {
  selectedPattern: string;
  betAmount: number;
  houseCutPercentage: number;
  voiceCategory: 'boy' | 'girl' | null;
}

const AdminCartelaAssignment: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [availableCartelas, setAvailableCartelas] = useState<Cartela[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userCartelas, setUserCartelas] = useState<Cartela[]>([]);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCartelas, setSelectedCartelas] = useState<string[]>([]);
  const [showCartelaModal, setShowCartelaModal] = useState(false);
  const [viewingCartela, setViewingCartela] = useState<Cartela | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchAvailableCartelas();
  }, []);

  useEffect(() => {
    if (selectedUser) {
      fetchUserCartelas(selectedUser.id);
      fetchUserSettings(selectedUser.id);
    }
  }, [selectedUser]);

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/admin/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users.filter((u: User) => u.role !== 'admin'));
      }
    } catch (err) {
      setError('Failed to fetch users');
    }
  };

  const fetchAvailableCartelas = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/admin/cartelas/available?limit=200`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setAvailableCartelas(data.cartelas);
      }
    } catch (err) {
      setError('Failed to fetch available cartelas');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserCartelas = async (userId: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/cartelas`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setUserCartelas(data.cartelas);
      }
    } catch (err) {
      console.error('Failed to fetch user cartelas:', err);
    }
  };

  const fetchUserSettings = async (userId: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/settings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setUserSettings(data.settings);
      }
    } catch (err) {
      console.error('Failed to fetch user settings:', err);
    }
  };

  const assignCartelas = async () => {
    if (!selectedUser || selectedCartelas.length === 0) return;

    try {
      setSubmitting(true);
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/admin/users/${selectedUser.id}/assign-cartelas`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ cartelaIds: selectedCartelas })
      });

      if (response.ok) {
        await fetchUserCartelas(selectedUser.id);
        await fetchAvailableCartelas();
        setSelectedCartelas([]);
        alert(`Successfully assigned ${selectedCartelas.length} cartelas to ${selectedUser.username}`);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to assign cartelas');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign cartelas');
    } finally {
      setSubmitting(false);
    }
  };

  const removeCartelas = async (cartelaIds: string[]) => {
    if (!selectedUser || cartelaIds.length === 0) return;

    if (!confirm(`Remove ${cartelaIds.length} cartelas from ${selectedUser.username}?`)) {
      return;
    }

    try {
      setSubmitting(true);
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/admin/users/${selectedUser.id}/remove-cartelas`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ cartelaIds })
      });

      if (response.ok) {
        await fetchUserCartelas(selectedUser.id);
        await fetchAvailableCartelas();
        alert(`Successfully removed ${cartelaIds.length} cartelas from ${selectedUser.username}`);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to remove cartelas');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove cartelas');
    } finally {
      setSubmitting(false);
    }
  };

  const setVoiceCategory = async (voiceCategory: 'boy' | 'girl') => {
    if (!selectedUser) return;

    try {
      setSubmitting(true);
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/admin/users/${selectedUser.id}/voice-category`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ voiceCategory })
      });

      if (response.ok) {
        await fetchUserSettings(selectedUser.id);
        alert(`Voice category set to "${voiceCategory}" for ${selectedUser.username}`);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to set voice category');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set voice category');
    } finally {
      setSubmitting(false);
    }
  };

  const renderBingoCard = (cartela: Cartela) => {
    const columns = ['B', 'I', 'N', 'G', 'O'] as const;

    return (
      <div className="inline-block bg-white rounded-lg shadow-lg p-3 scale-75">
        {/* BINGO Header */}
        <div className="grid grid-cols-5 gap-1 mb-2">
          {columns.map((letter) => (
            <div
              key={letter}
              className="h-6 flex items-center justify-center font-bold text-gray-800 text-lg"
            >
              {letter}
            </div>
          ))}
        </div>

        {/* Numbers Grid */}
        <div className="grid grid-cols-5 gap-1">
          {Array.from({ length: 5 }, (_, rowIndex) =>
            columns.map((column, colIndex) => {
              const isCenter = rowIndex === 2 && colIndex === 2;
              const number = cartela.numbers[column]?.[rowIndex];

              return (
                <div
                  key={`${column}-${rowIndex}`}
                  className={`w-8 h-8 flex items-center justify-center font-bold text-sm rounded border ${
                    isCenter
                      ? 'bg-gray-200 text-gray-600 border-gray-300'
                      : 'bg-white text-gray-800 border-gray-200'
                  }`}
                >
                  {isCenter ? 'FREE' : (number || '')}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.shopname && user.shopname.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-slate-400">Loading...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
              <Grid3x3 className="h-8 w-8 text-yellow-400" />
              Cartela & Voice Management
            </h1>
            <p className="text-slate-400 mt-1">Assign cartelas and set voice categories for users</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-600/20 border border-red-600 rounded-lg text-red-400">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Users List */}
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Users className="h-5 w-5" />
              Users ({filteredUsers.length})
            </h2>

            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* Users List */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredUsers.map((user) => (
                <button
                  key={user.id}
                  onClick={() => setSelectedUser(user)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedUser?.id === user.id
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  <div className="font-medium">{user.username}</div>
                  <div className="text-xs opacity-75">{user.email}</div>
                  {user.shopname && (
                    <div className="text-xs opacity-60">{user.shopname}</div>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      user.is_active ? 'bg-green-600' : 'bg-red-600'
                    }`}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <span className="text-xs">{user.balance.toFixed(2)} Birr</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* User Details & Voice Settings */}
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            {selectedUser ? (
              <>
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  {selectedUser.username}
                </h2>

                {/* Voice Category Settings */}
                <div className="mb-6">
                  <h3 className="text-md font-medium text-white mb-3 flex items-center gap-2">
                    <Volume2 className="h-4 w-4" />
                    Voice Category
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setVoiceCategory('boy')}
                      disabled={submitting}
                      className={`flex-1 px-3 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                        userSettings?.voiceCategory === 'boy'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      👦 Boy
                      {userSettings?.voiceCategory === 'boy' && <Check className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => setVoiceCategory('girl')}
                      disabled={submitting}
                      className={`flex-1 px-3 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                        userSettings?.voiceCategory === 'girl'
                          ? 'bg-pink-600 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      👧 Girl
                      {userSettings?.voiceCategory === 'girl' && <Check className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    Current: {userSettings?.voiceCategory || 'Not set'}
                  </p>
                </div>

                {/* User's Cartelas */}
                <div>
                  <h3 className="text-md font-medium text-white mb-3">
                    Assigned Cartelas ({userCartelas.length})
                  </h3>
                  {userCartelas.length > 0 ? (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {userCartelas.map((cartela) => (
                        <div
                          key={cartela.id}
                          className="flex items-center justify-between p-2 bg-slate-700 rounded border border-slate-600"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white">Card {cartela.card_id}</span>
                            <button
                              onClick={() => {
                                setViewingCartela(cartela);
                                setShowCartelaModal(true);
                              }}
                              className="text-blue-400 hover:text-blue-300"
                              title="View cartela"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          </div>
                          <button
                            onClick={() => removeCartelas([cartela.id])}
                            disabled={submitting}
                            className="text-red-400 hover:text-red-300 disabled:opacity-50"
                            title="Remove cartela"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-400 text-sm">No cartelas assigned</p>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <Users className="mx-auto h-12 w-12 text-slate-400" />
                <h3 className="mt-2 text-sm font-medium text-slate-400">Select a user</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Choose a user from the list to manage their cartelas and voice settings.
                </p>
              </div>
            )}
          </div>

          {/* Available Cartelas */}
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <h2 className="text-lg font-semibold text-white mb-4">
              Available Cartelas ({availableCartelas.length})
            </h2>

            {selectedUser && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-300">
                    Selected: {selectedCartelas.length}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedCartelas([])}
                      className="text-xs px-2 py-1 bg-slate-600 hover:bg-slate-500 text-white rounded"
                    >
                      Clear
                    </button>
                    <button
                      onClick={assignCartelas}
                      disabled={selectedCartelas.length === 0 || submitting}
                      className="text-xs px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white rounded flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" />
                      Assign ({selectedCartelas.length})
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-4 gap-2 max-h-96 overflow-y-auto">
              {availableCartelas.map((cartela) => (
                <button
                  key={cartela.id}
                  onClick={() => {
                    if (selectedUser) {
                      setSelectedCartelas(prev =>
                        prev.includes(cartela.id)
                          ? prev.filter(id => id !== cartela.id)
                          : [...prev, cartela.id]
                      );
                    } else {
                      setViewingCartela(cartela);
                      setShowCartelaModal(true);
                    }
                  }}
                  className={`aspect-square text-sm font-semibold rounded transition-colors flex items-center justify-center relative ${
                    selectedCartelas.includes(cartela.id)
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                  }`}
                  title={`Cartela ${cartela.card_id}`}
                >
                  {cartela.card_id}
                  {selectedCartelas.includes(cartela.id) && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full"></div>
                  )}
                </button>
              ))}
            </div>

            {availableCartelas.length === 0 && (
              <div className="text-center py-8">
                <Grid3x3 className="mx-auto h-8 w-8 text-slate-400" />
                <p className="text-slate-400 text-sm mt-2">No available cartelas</p>
              </div>
            )}
          </div>
        </div>

        {/* Cartela View Modal */}
        {showCartelaModal && viewingCartela && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 p-6 max-w-md">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-white">
                  Cartela {viewingCartela.card_id}
                </h3>
                <button
                  onClick={() => {
                    setShowCartelaModal(false);
                    setViewingCartela(null);
                  }}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex justify-center">
                {renderBingoCard(viewingCartela)}
              </div>

              <div className="mt-4 text-center">
                <p className="text-sm text-slate-400">
                  Created: {new Date(viewingCartela.purchased_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminCartelaAssignment;