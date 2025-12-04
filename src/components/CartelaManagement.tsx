import React, { useState, useEffect } from 'react';
import { Search, Eye, X, Grid3x3, List, RefreshCw, Trash2, Edit, Save } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

interface Cartela {
  id: string;
  card_id: string;
  user_id: string | null;
  game_id: string | null;
  numbers: {
    B: number[];
    I: number[];
    N: number[];
    G: number[];
    O: number[];
  };
  is_winner: boolean;
  is_active: boolean;
  pattern?: string | null;
  purchased_at: string;
}

const CartelaManagement: React.FC = () => {
  const [cartelas, setCartelas] = useState<Cartela[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedCartela, setSelectedCartela] = useState<Cartela | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [isEditing, setIsEditing] = useState(false);
  const [editedStatus, setEditedStatus] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editedNumbers, setEditedNumbers] = useState<{
    B: number[];
    I: number[];
    N: number[];
    G: number[];
    O: number[];
  }>({ B: [], I: [], N: [], G: [], O: [] });

  useEffect(() => {
    fetchCartelas();
  }, []);

  const fetchCartelas = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/cartelas/all-cartelas`);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Cartelas fetched successfully');
        console.log('📊 Sample cartela data:', data.cartelas?.[0]);
        setCartelas(data.cartelas || []);
      } else {
        console.error('❌ Error fetching cartelas:', response.status);
      }
    } catch (error) {
      console.error('❌ Error fetching cartelas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCartelaClick = (cartela: Cartela) => {
    setSelectedCartela(cartela);
    setEditedStatus(cartela.is_active);
    setEditedNumbers(JSON.parse(JSON.stringify(cartela.numbers))); // Deep copy
    setIsEditing(false);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedCartela(null);
    setIsEditing(false);
    setShowDeleteConfirm(false);
  };

  const handleUpdateCartela = async () => {
    if (!selectedCartela) return;

    console.log('🔧 Updating cartela:', {
      id: selectedCartela.id,
      card_id: selectedCartela.card_id
    });

    // Validate numbers
    const columns = ['B', 'I', 'N', 'G', 'O'] as const;
    for (const col of columns) {
      if (editedNumbers[col].length !== 5) {
        alert(`Column ${col} must have exactly 5 numbers`);
        return;
      }
      for (let i = 0; i < 5; i++) {
        const num = editedNumbers[col][i];
        if (i === 2 && col === 'N') continue; // Skip center (FREE space)
        if (isNaN(num) || num < 1 || num > 75) {
          alert(`Invalid number in column ${col}: ${num}. Must be between 1-75`);
          return;
        }
      }
    }

    try {
      const response = await fetch(`${API_BASE_URL}/cartelas/${selectedCartela.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          is_active: editedStatus,
          numbers: editedNumbers
        })
      });

      if (response.ok) {
        await fetchCartelas();
        setIsEditing(false);
        // Update the selected cartela in the modal
        setSelectedCartela({ ...selectedCartela, is_active: editedStatus, numbers: editedNumbers });
        alert('Cartela updated successfully!');
      } else {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        alert(`Error updating cartela: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error updating cartela:', error);
      alert('Failed to update cartela');
    }
  };

  const handleNumberChange = (column: 'B' | 'I' | 'N' | 'G' | 'O', index: number, value: string) => {
    const numValue = parseInt(value) || 0;
    setEditedNumbers(prev => ({
      ...prev,
      [column]: prev[column].map((n, i) => i === index ? numValue : n)
    }));
  };

  const handleDeleteCartela = async () => {
    if (!selectedCartela) return;

    try {
      const response = await fetch(`${API_BASE_URL}/cartelas/${selectedCartela.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        await fetchCartelas();
        handleCloseModal();
        alert('Cartela deleted successfully!');
      } else {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        alert(`Error deleting cartela: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting cartela:', error);
      alert('Failed to delete cartela');
    }
  };

  const renderBingoCard = (cartela: Cartela, editable = false) => {
    const columns = ['B', 'I', 'N', 'G', 'O'] as const;
    const numbers = editable ? editedNumbers : cartela.numbers;

    return (
      <div className="inline-block bg-white rounded-xl shadow-lg p-4">
        {/* BINGO Header */}
        <div className="grid grid-cols-5 gap-1.5 mb-3">
          {columns.map((letter) => (
            <div
              key={letter}
              className="h-8 flex items-center justify-center font-bold text-gray-800 text-2xl"
            >
              {letter}
            </div>
          ))}
        </div>

        {/* Numbers Grid */}
        <div className="grid grid-cols-5 gap-1.5">
          {Array.from({ length: 5 }, (_, rowIndex) =>
            columns.map((column, colIndex) => {
              const isCenter = rowIndex === 2 && colIndex === 2;
              const number = numbers[column]?.[rowIndex];

              if (editable && !isCenter) {
                return (
                  <input
                    key={`${column}-${rowIndex}`}
                    type="number"
                    min="1"
                    max="75"
                    value={number || ''}
                    onChange={(e) => handleNumberChange(column, rowIndex, e.target.value)}
                    className="w-12 h-12 flex items-center justify-center font-bold text-lg rounded-lg border-2 border-blue-400 text-gray-800 text-center focus:outline-none focus:border-blue-600"
                  />
                );
              }

              return (
                <div
                  key={`${column}-${rowIndex}`}
                  className={`w-12 h-12 flex items-center justify-center font-bold text-lg rounded-lg border-2 ${
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

  const filteredCartelas = cartelas
    .filter(cartela => {
      const matchesSearch = cartela.card_id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === 'all' ||
                           (filterStatus === 'active' && cartela.is_active) ||
                           (filterStatus === 'inactive' && !cartela.is_active);
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => Number(a.card_id) - Number(b.card_id));

  const stats = {
    total: cartelas.length,
    active: cartelas.filter(c => c.is_active).length,
    inactive: cartelas.filter(c => !c.is_active).length,
    inGame: cartelas.filter(c => c.game_id).length
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-slate-900 min-h-screen text-white">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Cartela Management</h1>
          <p className="text-sm sm:text-base text-slate-400">View and manage all bingo cards</p>
        </div>
        <button
          onClick={fetchCartelas}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          <RefreshCw size={18} />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <p className="text-slate-400 text-sm mb-1">Total Cartelas</p>
          <p className="text-2xl font-bold text-white">{stats.total}</p>
        </div>
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <p className="text-slate-400 text-sm mb-1">Active</p>
          <p className="text-2xl font-bold text-green-400">{stats.active}</p>
        </div>
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <p className="text-slate-400 text-sm mb-1">Inactive</p>
          <p className="text-2xl font-bold text-red-400">{stats.inactive}</p>
        </div>
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <p className="text-slate-400 text-sm mb-1">In Game</p>
          <p className="text-2xl font-bold text-yellow-400">{stats.inGame}</p>
        </div>
      </div>

      {/* Filters and View Controls */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by card ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg focus:border-blue-500 focus:outline-none text-white"
            />
          </div>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'inactive')}
            className="px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg focus:border-blue-500 focus:outline-none text-white"
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>

          {/* View Mode Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2.5 rounded-lg transition-colors ${
                viewMode === 'grid'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
              }`}
            >
              <Grid3x3 size={20} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2.5 rounded-lg transition-colors ${
                viewMode === 'list'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
              }`}
            >
              <List size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading cartelas...</p>
        </div>
      )}

      {/* Cartelas Display */}
      {!loading && (
        <>
          {viewMode === 'grid' ? (
            <div className="flex flex-wrap gap-2">
              {filteredCartelas.map((cartela) => (
                <button
                  key={cartela.id}
                  onClick={() => handleCartelaClick(cartela)}
                  className={`w-14 h-14 text-lg font-semibold rounded transition-colors flex items-center justify-center relative ${
                    cartela.is_active
                      ? 'bg-blue-500 hover:bg-blue-600 text-white'
                      : 'bg-slate-600 hover:bg-slate-500 text-slate-300'
                  }`}
                  title={`Cartela ${cartela.card_id} - ${cartela.is_active ? 'Active' : 'Inactive'}`}
                >
                  {cartela.card_id}
                  {cartela.game_id && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full"></div>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">Card ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">In Game</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">Created</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {filteredCartelas.map((cartela) => (
                      <tr key={cartela.id} className="hover:bg-slate-700/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {cartela.card_id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs rounded ${
                            cartela.is_active
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {cartela.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {cartela.game_id ? (
                            <span className="text-yellow-400">Yes</span>
                          ) : (
                            <span className="text-slate-500">No</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                          {new Date(cartela.purchased_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleCartelaClick(cartela)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm transition-colors"
                              title="View details"
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedCartela(cartela);
                                setEditedStatus(cartela.is_active);
                                setEditedNumbers(JSON.parse(JSON.stringify(cartela.numbers)));
                                setIsEditing(true);
                                setShowModal(true);
                              }}
                              className="flex items-center gap-1 px-3 py-1.5 bg-slate-600 hover:bg-slate-500 rounded text-sm transition-colors"
                              title="Edit cartela"
                            >
                              <Edit size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {filteredCartelas.length === 0 && (
            <div className="text-center py-12 bg-slate-800 rounded-lg border border-slate-700">
              <p className="text-slate-400">No cartelas found matching your filters</p>
            </div>
          )}
        </>
      )}

      {/* Modal for displaying cartela details */}
      {showModal && selectedCartela && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl shadow-2xl w-auto max-w-2xl border border-slate-700">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-6 border-b border-slate-700">
              <div>
                <h2 className="text-2xl font-bold text-white">
                  Cartela {selectedCartela.card_id}
                </h2>
                <div className="flex gap-2 mt-2">
                  <span className={`px-2 py-1 text-xs rounded ${
                    selectedCartela.is_active
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {selectedCartela.is_active ? 'Active' : 'Inactive'}
                  </span>
                  {selectedCartela.game_id && (
                    <span className="px-2 py-1 text-xs rounded bg-yellow-100 text-yellow-700">
                      In Game
                    </span>
                  )}
                  {selectedCartela.is_winner && (
                    <span className="px-2 py-1 text-xs rounded bg-purple-100 text-purple-700">
                      Winner
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-white transition-colors bg-slate-700 hover:bg-slate-600 rounded-full p-2"
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-8">
              <div className="flex justify-center mb-6">
                {renderBingoCard(selectedCartela, isEditing)}
              </div>
              {isEditing && (
                <div className="text-center text-sm text-slate-400 mb-4">
                  Click on numbers to edit them. Valid range: 1-75
                </div>
              )}

              {/* Cartela Info */}
              <div className="bg-slate-700 rounded-lg p-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Card ID:</span>
                  <span className="text-white font-medium">{selectedCartela.card_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Created:</span>
                  <span className="text-white">{new Date(selectedCartela.purchased_at).toLocaleString()}</span>
                </div>
                {selectedCartela.pattern && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Pattern:</span>
                    <span className="text-white">{selectedCartela.pattern}</span>
                  </div>
                )}
                
                {/* Edit Status */}
                {isEditing && (
                  <div className="pt-3 border-t border-slate-600 space-y-2">
                    <label className="flex items-center gap-2 text-white">
                      <input
                        type="checkbox"
                        checked={editedStatus}
                        onChange={(e) => setEditedStatus(e.target.checked)}
                        className="w-4 h-4 rounded"
                      />
                      <span>Active Status</span>
                    </label>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-6 flex gap-3">
                {!isEditing ? (
                  <>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors text-white font-medium"
                    >
                      <Edit size={18} />
                      Edit Cartela
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 rounded-lg transition-colors text-white font-medium"
                    >
                      <Trash2 size={18} />
                      Delete
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleUpdateCartela}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 rounded-lg transition-colors text-white font-medium"
                    >
                      <Save size={18} />
                      Save Changes
                    </button>
                    <button
                      onClick={() => {
                        setIsEditing(false);
                        setEditedStatus(selectedCartela.is_active);
                        setEditedNumbers(JSON.parse(JSON.stringify(selectedCartela.numbers)));
                      }}
                      className="flex-1 px-4 py-2.5 bg-slate-600 hover:bg-slate-500 rounded-lg transition-colors text-white font-medium"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedCartela && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md border border-slate-700 p-6">
            <h3 className="text-xl font-bold text-white mb-4">Confirm Delete</h3>
            <p className="text-slate-300 mb-6">
              Are you sure you want to delete Cartela <span className="font-bold text-white">{selectedCartela.card_id}</span>? 
              This will set it as inactive and cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDeleteCartela}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 rounded-lg transition-colors text-white font-medium"
              >
                Yes, Delete
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2.5 bg-slate-600 hover:bg-slate-500 rounded-lg transition-colors text-white font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CartelaManagement;
