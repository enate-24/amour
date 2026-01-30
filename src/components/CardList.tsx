import React, { useState, useEffect, useMemo } from 'react';
import { X, ChevronLeft, ChevronRight, Search, RefreshCw, AlertCircle, Plus, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCartela } from '../hooks/useCartela';
import { Cartela } from '../lib/api';
import { useWebSocket } from '../hooks/useWebSocket';
import { simpleApiClient } from '../utils/simpleApiClient';

const CARDS_PER_PAGE = 100; // Increased from 50 for better UX

const CardList: React.FC = () => {
  const navigate = useNavigate();
  const { cartelas, loading, error, refreshCartelas } = useCartela();
  const [selectedCartela, setSelectedCartela] = useState<Cartela | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedCartelaIds, setSelectedCartelaIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadTime, setLoadTime] = useState<number>(0);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showAllCartelas, setShowAllCartelas] = useState(false);

  // Memoized filtered and paginated cartelas with performance optimization
  const { paginatedCartelas, totalPages, totalCartelas, displayedCartelas } = useMemo(() => {
    let filtered = cartelas;
    
    // Filter by search term if provided
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = cartelas.filter(cartela => 
        cartela.card_id.toLowerCase().includes(search)
      );
    }
    
    // Sort numerically by card_id
    filtered.sort((a, b) => Number(a.card_id) - Number(b.card_id));
    
    // Handle pagination vs show all
    let paginated = filtered;
    let displayed = filtered.length;
    
    if (!showAllCartelas && filtered.length > CARDS_PER_PAGE) {
      // Paginate
      const startIndex = (currentPage - 1) * CARDS_PER_PAGE;
      const endIndex = startIndex + CARDS_PER_PAGE;
      paginated = filtered.slice(startIndex, endIndex);
      displayed = paginated.length;
    }
    
    return {
      paginatedCartelas: paginated,
      totalPages: Math.ceil(filtered.length / CARDS_PER_PAGE),
      totalCartelas: filtered.length,
      displayedCartelas: displayed
    };
  }, [cartelas, currentPage, searchTerm, showAllCartelas]);

  // Reset to page 1 when search changes or show all changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, showAllCartelas]);

  // Fetch selected cartela IDs from active games with caching
  useEffect(() => {
    const fetchSelectedCartelas = async () => {
      try {
        setFetchError(null);
        const response = await simpleApiClient.getSelectedCartelasStatus();
        const data = response.data as { selectedCartelaIds?: string[] };
        setSelectedCartelaIds(new Set(data.selectedCartelaIds || []));
        setLoadTime(response.loadTime);
        console.log(`Fetched selected cartela IDs in ${response.loadTime}ms (cached: ${response.fromCache})`);
      } catch (error) {
        console.error('Error fetching selected cartelas:', error);
        setFetchError(error instanceof Error ? error.message : 'Failed to fetch selected cartelas');
      }
    };

    fetchSelectedCartelas();
  }, []);

  // WebSocket for real-time cartela selection updates
  useWebSocket({
    onCartelaSelected: (data) => {
      console.log('🔔 WebSocket: Cartela selected:', data.cartelaId);
      // Refresh the selected cartelas list
      const fetchSelectedCartelas = async () => {
        try {
          const response = await simpleApiClient.getSelectedCartelasStatus();
          const data = response.data as { selectedCartelaIds?: string[] };
          setSelectedCartelaIds(new Set(data.selectedCartelaIds || []));
        } catch (error) {
          console.error('Error fetching selected cartelas:', error);
        }
      };
      fetchSelectedCartelas();
    }
  });

  const handleCartelaClick = async (cartela: Cartela) => {
    console.log('🎯 Cartela clicked:', cartela.card_id, 'Numbers:', cartela.numbers);
    
    // Check if cartela has valid numbers data
    if (!cartela.numbers || typeof cartela.numbers !== 'object') {
      console.warn('⚠️ Cartela has invalid numbers data:', cartela);
      
      // Try to fetch cartela details as fallback
      try {
        console.log('🔄 Fetching cartela details for:', cartela.card_id);
        const response = await simpleApiClient.getCartelaDetails(cartela.id);
        const data = response.data as { cartela?: Cartela };
        
        if (data.cartela && data.cartela.numbers) {
          console.log('✅ Fetched cartela details successfully');
          setSelectedCartela(data.cartela);
        } else {
          console.warn('⚠️ Fetched cartela has no numbers data, using original');
          setSelectedCartela(cartela);
        }
      } catch (error) {
        console.error('❌ Error fetching cartela details:', error);
        // Use original cartela even if numbers are invalid
        setSelectedCartela(cartela);
      }
    } else {
      // Cartela already has valid numbers data
      console.log('✅ Using cartela with existing numbers data');
      setSelectedCartela(cartela);
    }
    
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedCartela(null);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages && newPage !== currentPage) {
      setCurrentPage(newPage);
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setFetchError(null);
    try {
      await refreshCartelas();
      // Also refresh selected cartelas
      const response = await simpleApiClient.getSelectedCartelasStatus();
      const data = response.data as { selectedCartelaIds?: string[] };
      setSelectedCartelaIds(new Set(data.selectedCartelaIds || []));
    } catch (error) {
      console.error('Error refreshing:', error);
      setFetchError(error instanceof Error ? error.message : 'Failed to refresh data');
    } finally {
      setRefreshing(false);
    }
  };

  const clearCache = () => {
    simpleApiClient.clearCache();
    refreshCartelas();
  };

  const renderBingoCard = (cartela: Cartela) => {
    const columns = ['B', 'I', 'N', 'G', 'O'] as const;

    // Add safety check for cartela numbers
    if (!cartela.numbers || typeof cartela.numbers !== 'object') {
      console.warn('Invalid cartela numbers format:', cartela.numbers);
      return (
        <div className="inline-block bg-white rounded-xl shadow-lg p-3 sm:p-4">
          <div className="text-red-500 text-center p-4">
            Invalid cartela data
          </div>
        </div>
      );
    }

    return (
      <div className="inline-block bg-white rounded-xl shadow-lg p-3 sm:p-4">
        {/* BINGO Header */}
        <div className="grid grid-cols-5 gap-1 sm:gap-1.5 mb-2 sm:mb-3">
          {columns.map((letter) => (
            <div
              key={letter}
              className="h-6 sm:h-8 flex items-center justify-center font-bold text-gray-800 text-xl sm:text-2xl"
            >
              {letter}
            </div>
          ))}
        </div>

        {/* Numbers Grid */}
        <div className="grid grid-cols-5 gap-1 sm:gap-1.5">
          {Array.from({ length: 5 }, (_, rowIndex) =>
            columns.map((column, colIndex) => {
              const isCenter = rowIndex === 2 && colIndex === 2;
              const number = cartela.numbers[column]?.[rowIndex];

              return (
                <div
                  key={`${column}-${rowIndex}`}
                  className={`w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center font-bold text-base sm:text-lg rounded-lg border-2 ${
                    isCenter
                      ? 'bg-gray-200 text-gray-600 border-gray-300 text-xs sm:text-sm'
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

  const renderPagination = () => {
    if (totalPages <= 1 || showAllCartelas) return null;

    const maxVisiblePages = 5;
    const startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    const pages = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);

    return (
      <div className="flex items-center justify-center gap-2 mt-6">
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={20} />
        </button>
        
        {startPage > 1 && (
          <>
            <button
              onClick={() => handlePageChange(1)}
              className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200"
            >
              1
            </button>
            {startPage > 2 && <span className="px-2">...</span>}
          </>
        )}
        
        {pages.map(page => (
          <button
            key={page}
            onClick={() => handlePageChange(page)}
            className={`px-3 py-2 rounded-lg ${
              page === currentPage
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            {page}
          </button>
        ))}
        
        {endPage < totalPages && (
          <>
            {endPage < totalPages - 1 && <span className="px-2">...</span>}
            <button
              onClick={() => handlePageChange(totalPages)}
              className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200"
            >
              {totalPages}
            </button>
          </>
        )}
        
        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 min-h-screen max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
            Cartela List
            {totalCartelas > 0 && (
              <span className="text-lg text-gray-600 ml-2">
                ({totalCartelas} total)
              </span>
            )}
          </h1>
          
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="p-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded-lg transition-colors flex items-center gap-2"
            title="Refresh cartelas"
          >
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {/* Performance Info */}
        {loadTime > 0 && (
          <div className="text-sm text-gray-500 mb-3">
            Last loaded in {loadTime}ms
            <button 
              onClick={clearCache}
              className="ml-2 text-blue-500 hover:text-blue-700 underline"
            >
              Clear Cache
            </button>
          </div>
        )}

        {/* Fetch Error */}
        {fetchError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
            <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
            <p className="text-red-700 text-sm">{fetchError}</p>
            <button 
              onClick={handleRefresh}
              className="ml-auto text-red-600 hover:text-red-800 underline text-sm"
            >
              Retry
            </button>
          </div>
        )}

        {/* Search Bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search cartelas by ID..."
            value={searchTerm}
            onChange={handleSearch}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-4">
          <button 
            onClick={() => navigate('/newgame')}
            className="px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <Play size={18} />
            New Game
          </button>
          <button 
            onClick={() => navigate('/admin/cartela-assignment')}
            className="px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <Plus size={18} />
            Manage Cartelas
          </button>
        </div>

        {/* Performance Controls */}
        {totalCartelas > CARDS_PER_PAGE && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-yellow-800 font-medium">
                  Large Dataset ({totalCartelas} cartelas)
                </p>
                <p className="text-yellow-700 text-sm">
                  {showAllCartelas 
                    ? `Showing all ${displayedCartelas} cartelas` 
                    : `Showing ${displayedCartelas} of ${totalCartelas} cartelas (paginated)`
                  }
                </p>
              </div>
              <button
                onClick={() => setShowAllCartelas(!showAllCartelas)}
                className={`px-3 py-2 rounded-lg font-medium transition-colors ${
                  showAllCartelas
                    ? 'bg-yellow-200 hover:bg-yellow-300 text-yellow-800'
                    : 'bg-yellow-600 hover:bg-yellow-700 text-white'
                }`}
              >
                {showAllCartelas ? 'Use Pagination' : 'Show All'}
              </button>
            </div>
          </div>
        )}
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

      {/* Cartela Cards Display */}
      {!loading && !error && (
        <div>
          {/* Search Results Info */}
          {searchTerm && (
            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-blue-700">
                Found {totalCartelas} cartela(s) matching "{searchTerm}"
                {showAllCartelas && totalCartelas > 0 && (
                  <span className="ml-2 text-blue-600">(showing all)</span>
                )}
                {totalCartelas === 0 && (
                  <button 
                    onClick={() => setSearchTerm('')}
                    className="ml-2 text-blue-500 hover:text-blue-700 underline"
                  >
                    Clear search
                  </button>
                )}
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-2 sm:gap-2.5">
            {paginatedCartelas.map((cartela: Cartela, index: number) => (
              <button
                key={cartela.id || `cartela-${index}`}
                onClick={() => handleCartelaClick(cartela)}
                className={`w-12 h-12 sm:w-14 sm:h-14 text-white text-base sm:text-lg font-semibold rounded-lg transition-colors flex items-center justify-center touch-manipulation ${
                  selectedCartelaIds.has(cartela.card_id)
                    ? 'bg-orange-500 hover:bg-orange-600 active:bg-orange-700'
                    : 'bg-blue-500 hover:bg-blue-600 active:bg-blue-700'
                }`}
                title={`Click to view Cartela ${cartela.card_id}${selectedCartelaIds.has(cartela.card_id) ? ' (Selected in game)' : ''}`}
              >
                {cartela.card_id}
              </button>
            ))}
          </div>

          {paginatedCartelas.length === 0 && !searchTerm && (
            <div className="mt-6 p-4 sm:p-6 bg-blue-50 rounded-lg">
              <p className="text-blue-700 font-medium text-center text-sm sm:text-base">
                No cartelas available. 
                <button 
                  onClick={handleRefresh}
                  className="ml-2 text-blue-600 hover:text-blue-800 underline"
                >
                  Refresh to load cartelas
                </button>
              </p>
            </div>
          )}

          {/* Performance warning for large datasets */}
          {paginatedCartelas.length > 500 && showAllCartelas && (
            <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="text-orange-500 flex-shrink-0" />
                <p className="text-orange-700 text-sm">
                  Displaying {paginatedCartelas.length} cartelas may affect performance. Consider using pagination for better experience.
                </p>
                <button
                  onClick={() => setShowAllCartelas(false)}
                  className="ml-auto text-orange-600 hover:text-orange-800 underline text-sm whitespace-nowrap"
                >
                  Use Pagination
                </button>
              </div>
            </div>
          )}

          {/* Pagination - only show when not searching or when search has results */}
          {(!searchTerm || totalCartelas > 0) && renderPagination()}
          
          {/* Page Info */}
          {totalCartelas > 0 && (
            <div className="text-center mt-4 text-gray-600">
              {showAllCartelas ? (
                `Showing all ${displayedCartelas} cartelas`
              ) : (
                `Showing ${((currentPage - 1) * CARDS_PER_PAGE) + 1} to ${Math.min(currentPage * CARDS_PER_PAGE, totalCartelas)} of ${totalCartelas} cartelas`
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal for displaying cartela numbers */}
      {showModal && selectedCartela && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl my-4">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-4 sm:p-6 border-b">
              <h2 className="text-lg sm:text-2xl font-bold text-gray-800">
                Cartela {selectedCartela.card_id}
                {selectedCartelaIds.has(selectedCartela.card_id) && (
                  <span className="ml-2 text-sm bg-orange-100 text-orange-800 px-2 py-1 rounded">
                    In Game
                  </span>
                )}
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600 transition-colors bg-gray-100 hover:bg-gray-200 rounded-full p-2 flex-shrink-0"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-8">
              <div className="flex justify-center overflow-x-auto">
                {renderBingoCard(selectedCartela)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CardList;