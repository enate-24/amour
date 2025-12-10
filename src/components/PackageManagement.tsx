import React, { useState, useEffect } from 'react';
import { DollarSign, Plus, Minus, Search, RefreshCw, Package, AlertCircle } from 'lucide-react';

interface User {
  id: string;
  username: string;
  email: string;
  userType: 'prepaid' | 'postpaid';
  balance: number;
  isActive: boolean;
}

const PackageManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [amount, setAmount] = useState<number>(0);
  const [operation, setOperation] = useState<'add' | 'deduct'>('add');
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');
      
      const response = await fetch(`${API_BASE_URL}/admin/users`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        // Filter only prepaid users
        const prepaidUsers = data.users.filter((u: User) => u.userType === 'prepaid');
        setUsers(prepaidUsers);
      } else {
        console.error('Failed to fetch users');
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleUpdateBalance = async () => {
    if (!selectedUser || amount <= 0) {
      setMessage({ type: 'error', text: 'Please select a user and enter a valid amount' });
      return;
    }

    setProcessing(true);
    setMessage(null);

    try {
      const token = localStorage.getItem('auth_token');
      const newBalance = operation === 'add' 
        ? selectedUser.balance + amount 
        : selectedUser.balance - amount;

      if (newBalance < 0) {
        setMessage({ type: 'error', text: 'Balance cannot be negative for prepaid users' });
        setProcessing(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/admin/users/${selectedUser.id}/balance`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ balance: newBalance })
      });

      if (response.ok) {
        setMessage({ 
          type: 'success', 
          text: `Successfully ${operation === 'add' ? 'added' : 'deducted'} ${amount} Birr ${operation === 'add' ? 'to' : 'from'} ${selectedUser.username}'s balance` 
        });
        
        // Refresh users list
        await fetchUsers();
        
        // Reset form
        setSelectedUser(null);
        setAmount(0);
        
        // Clear message after 5 seconds
        setTimeout(() => setMessage(null), 5000);
      } else {
        const errorData = await response.json();
        setMessage({ type: 'error', text: errorData.error || 'Failed to update balance' });
      }
    } catch (error) {
      console.error('Error updating balance:', error);
      setMessage({ type: 'error', text: 'Failed to update balance' });
    } finally {
      setProcessing(false);
    }
  };

  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg">
              <Package className="text-white" size={28} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Package Management</h1>
              <p className="text-slate-400">Manage prepaid user balances</p>
            </div>
          </div>
        </div>

        {/* Message Banner */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
            message.type === 'success' 
              ? 'bg-green-500/20 border border-green-500/30 text-green-400' 
              : 'bg-red-500/20 border border-red-500/30 text-red-400'
          }`}>
            <AlertCircle size={20} />
            <span>{message.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* User Selection Panel */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">Select User</h2>
              <button
                onClick={fetchUsers}
                disabled={loading}
                className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors disabled:opacity-50"
                title="Refresh users"
              >
                <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>

            {/* Search */}
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Search by username or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* User List */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                  <p className="text-slate-400">Loading users...</p>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Package size={48} className="mx-auto mb-2 opacity-50" />
                  <p>No prepaid users found</p>
                </div>
              ) : (
                filteredUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => setSelectedUser(user)}
                    className={`w-full p-4 rounded-lg border transition-all ${
                      selectedUser?.id === user.id
                        ? 'bg-blue-500/20 border-blue-500/50 text-white'
                        : 'bg-slate-700/50 border-slate-600/50 text-slate-300 hover:bg-slate-700 hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-left">
                        <p className="font-semibold">{user.username}</p>
                        <p className="text-sm text-slate-400">{user.email}</p>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-green-400 font-bold">
                          <DollarSign size={16} />
                          <span>{user.balance.toFixed(2)}</span>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          user.isActive 
                            ? 'bg-green-500/20 text-green-400' 
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Balance Update Panel */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Update Balance</h2>

            {selectedUser ? (
              <div className="space-y-6">
                {/* Selected User Info */}
                <div className="p-4 bg-slate-700/50 rounded-lg border border-slate-600/50">
                  <p className="text-sm text-slate-400 mb-1">Selected User</p>
                  <p className="text-lg font-semibold text-white">{selectedUser.username}</p>
                  <p className="text-sm text-slate-400">{selectedUser.email}</p>
                  <div className="mt-3 pt-3 border-t border-slate-600/50">
                    <p className="text-sm text-slate-400 mb-1">Current Balance</p>
                    <div className="flex items-center gap-2 text-2xl font-bold text-green-400">
                      <DollarSign size={24} />
                      <span>{selectedUser.balance.toFixed(2)} Birr</span>
                    </div>
                  </div>
                </div>

                {/* Operation Selection */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Operation</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setOperation('add')}
                      className={`p-3 rounded-lg border transition-all flex items-center justify-center gap-2 ${
                        operation === 'add'
                          ? 'bg-green-500/20 border-green-500/50 text-green-400'
                          : 'bg-slate-700/50 border-slate-600/50 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      <Plus size={20} />
                      <span className="font-semibold">Add Balance</span>
                    </button>
                    <button
                      onClick={() => setOperation('deduct')}
                      className={`p-3 rounded-lg border transition-all flex items-center justify-center gap-2 ${
                        operation === 'deduct'
                          ? 'bg-red-500/20 border-red-500/50 text-red-400'
                          : 'bg-slate-700/50 border-slate-600/50 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      <Minus size={20} />
                      <span className="font-semibold">Deduct Balance</span>
                    </button>
                  </div>
                </div>

                {/* Amount Input */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Amount (Birr)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amount || ''}
                    onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                    placeholder="Enter amount..."
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none text-lg"
                  />
                </div>

                {/* Preview */}
                {amount > 0 && (
                  <div className="p-4 bg-slate-700/50 rounded-lg border border-slate-600/50">
                    <p className="text-sm text-slate-400 mb-2">Preview</p>
                    <div className="flex items-center justify-between text-lg">
                      <span className="text-slate-300">Current Balance:</span>
                      <span className="font-semibold text-white">{selectedUser.balance.toFixed(2)} Birr</span>
                    </div>
                    <div className="flex items-center justify-between text-lg mt-2">
                      <span className="text-slate-300">{operation === 'add' ? 'Add' : 'Deduct'}:</span>
                      <span className={`font-semibold ${operation === 'add' ? 'text-green-400' : 'text-red-400'}`}>
                        {operation === 'add' ? '+' : '-'}{amount.toFixed(2)} Birr
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xl mt-3 pt-3 border-t border-slate-600/50">
                      <span className="text-slate-300">New Balance:</span>
                      <span className="font-bold text-blue-400">
                        {(operation === 'add' ? selectedUser.balance + amount : selectedUser.balance - amount).toFixed(2)} Birr
                      </span>
                    </div>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  onClick={handleUpdateBalance}
                  disabled={processing || amount <= 0}
                  className={`w-full py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                    processing || amount <= 0
                      ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                      : operation === 'add'
                        ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg'
                        : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg'
                  }`}
                >
                  {processing ? (
                    <>
                      <RefreshCw size={20} className="animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      {operation === 'add' ? <Plus size={20} /> : <Minus size={20} />}
                      <span>{operation === 'add' ? 'Add' : 'Deduct'} {amount.toFixed(2)} Birr</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400">
                <Package size={64} className="mx-auto mb-4 opacity-30" />
                <p className="text-lg">Select a user to update their balance</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PackageManagement;
