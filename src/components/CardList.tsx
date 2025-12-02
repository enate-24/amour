import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useCartela } from '../hooks/useCartela';
import { Cartela } from '../lib/api';
import { useWebSocket } from '../hooks/useWebSocket';

const CardList: React.FC = () => {
  const { cartelas, loading, error, refreshCartelas } = useCartela();
  const [selectedCartela, setSelectedCartela] = useState<Cartela | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedCartelaIds, setSelectedCartelaIds] = useState<Set<string>>(new Set());

  // Fetch selected cartela IDs from active games
  useEffect(() => {
    const fetchSelectedCartelas = async () => {
      try {
        const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
        const response = await fetch(`${API_BASE_URL}/cartelas/status/active-games`);

        if (response.ok) {
          const data = await response.json();
          setSelectedCartelaIds(new Set(data.selectedCartelaIds || []));
          console.log('Fetched selected cartela IDs:', data.selectedCartelaIds);
        } else {
          console.warn('Failed to fetch selected cartelas status');
        }
      } catch (error) {
        console.error('Error fetching selected cartelas:', error);
      }
    };

    fetchSelectedCartelas();
    // No polling needed - WebSocket will push updates
  }, []);

  // WebSocket for real-time cartela selection updates
  useWebSocket({
    onCartelaSelected: (data) => {
      console.log('🔔 WebSocket: Cartela selected:', data.cartelaId);
      // Refresh the selected cartelas list
      const fetchSelectedCartelas = async () => {
        try {
          const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
          const response = await fetch(`${API_BASE_URL}/cartelas/status/active-games`);
          if (response.ok) {
            const data = await response.json();
            setSelectedCartelaIds(new Set(data.selectedCartelaIds || []));
          }
        } catch (error) {
          console.error('Error fetching selected cartelas:', error);
        }
      };
      fetchSelectedCartelas();
    }
  });

  const handleCartelaClick = (cartela: Cartela) => {
    // Use the cartela data directly from the database API
    setSelectedCartela(cartela);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedCartela(null);
  };

  const renderBingoCard = (cartela: Cartela) => {
    const columns = ['B', 'I', 'N', 'G', 'O'] as const;

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
              const number = cartela.numbers[column]?.[rowIndex];

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

  return (
    <div className="p-4 lg:p-8 min-h-screen" style={{
      marginRight: '100px',
      marginLeft: '100px',
      marginTop: '50px',
      marginBottom: '30px'
    }}>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Cartela List for one</h1>
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded font-medium transition-colors">
            New Game
          </button>
          <button className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded font-medium transition-colors">
            Add Cartela
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading cartelas...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="text-center py-12">
          <p className="text-red-400 text-lg mb-4">Error: {error}</p>
          <button
            onClick={refreshCartelas}
            className="px-3 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Cartela Cards Display - Simple Grid of Card IDs */}
      {!loading && !error && (
        <div>
          <div className="flex flex-wrap gap-2">
            {cartelas
              .sort((a, b) => {
                // Sort by card_id numerically
                return Number(a.card_id) - Number(b.card_id);
              })
              .map((cartela: Cartela, index: number) => (
                <button
                  key={cartela.id || `cartela-${index}`}
                  onClick={() => handleCartelaClick(cartela)}
                  className="w-14 h-14 bg-blue-500 hover:bg-blue-600 text-white text-lg font-semibold rounded transition-colors flex items-center justify-center"
                  title={`Click to view Cartela ${cartela.card_id}`}
                >
                  {cartela.card_id}
                </button>
              ))}
          </div>

          {cartelas.length === 0 && (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <p className="text-blue-700 font-medium text-center">
                No cartelas available. Please check if the backend server is running.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Modal for displaying cartela numbers */}
      {showModal && selectedCartela && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-auto max-w-xl">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-2xl font-bold text-gray-800">
                Viewing Cartela {selectedCartela.card_id}
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600 transition-colors bg-gray-100 hover:bg-gray-200 rounded-full p-2"
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-8">
              <div className="flex justify-center">
                {renderBingoCard(selectedCartela)}
              </div>
              
              {/* Delete Button */}
              <div className="mt-6 flex justify-center">
                <button className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white text-lg font-semibold rounded-lg transition-colors">
                  Delete Cartela
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CardList;
