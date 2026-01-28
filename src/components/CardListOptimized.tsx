import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { X, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { Cartela } from '../lib/api';
import { useWebSocket } from '../hooks/useWebSocket';

interface CartelasResponse {
  cartelas: Cartela[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
  userId: string;
  loadTime?: number;
}

const CardListOptimized: React.FC = () => {
  const [cartelas, setCartelas] = useState<Cartela[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCartela, setSelectedCartela] = useState<Cartela | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedCartelaIds, setSelectedCartelaIds] = useState<Set<string>>(new Set());
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCartelas, setTotalCartelas] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadTime, setLoadTime] = useState<number>(0);
  
  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredCartelas, setFilteredCartelas] = useState<Cartela[]>([]);
  
  const limit = 50; // Cards per page

  // Memoized filtered cartelas for client-side search
  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return cartelas;
    
    const search = searchTerm.toLowerCase();
    return cartelas.filter(cartela => 
      cartela.card_id.toLowerCase().includes(search)
    );
  }, [cartelas, searchTerm]);

  // Fetch cartelas with pagination and caching
  const fetchCartelas = useCallback(async (page: number = 1, useCache: boolean = true) => {
    try {
      setLoading(true);
      setError(null);
      
      const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
      const token = localStorage.getItem('auth_token');
      
      if (!token) {
        throw new Error('No authentication token found');
      }

      // Check cache first for better performance
      const cacheKey = `cartelas_page_${page}_limit_${limit}`;
      const cachedData = useCache ? sessionStorage.getItem(cacheKey) : null;
      
      if (cachedData) {
        const data: CartelasResponse = JSON.parse(cachedData);
        setCartelas(data.cartelas);
        setCurrentPage(data.page);
        setTotalPages(data.totalPages);
        setTotalCartelas(data.total);
        setHasMore(data.hasMore);
        setLoadTime(data.loadTime || 0);
        setLoading(false);
        console.log(`✅ Loaded page ${data.page} from cache (${data.cartelas.length} cartelas)`);
        return;
      }

      const startTime = Date.now();
      const response = await fetch(`${API_BASE_URL}/cartelas/user-cartelas?page=${page}&limit=${limit}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: CartelasResponse = await response.json();
      const clientLoadTime = Date.now() - startTime;
      
      // Cache the response for better performance
      if (useCache) {
        sessionStorage.setItem(cacheKey, JSON.stringify({
          ...data,
          loadTime: data.loadTime || clientLoadTime
        }));
      }
      
      setCartelas(data.cartelas);
      setCurrentPage(data.page);
      setTotalPages(data.totalPages);
      setTotalCartelas(data.total);
      setHasMore(data.hasMore);
      setLoadTime(data.loadTime || clientLoadTime);
      
      console.log(`✅ Loaded page ${data.page}/${data.totalPages} (${data.cartelas.length}/${data.total} cartelas) in ${data.loadTime || clientLoadTime}ms`);
      
    } catch (err) {
      console.error('Error fetching cartelas:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch cartelas');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  // Fetch selected cartela IDs from active games
  const fetchSelectedCartelas = useCallback(async () => {
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
  }, []);

  // Load initial page
  useEffect(() => {
    fetchCartelas(1);
    fetchSelectedCartelas();
  }, [fetchCartelas, fetchSelectedCartelas]);

  // WebSocket for real-time updates
  useWebSocket({
    onCartelaSelected: (data) => {
      console.log('🔔 WebSocket: Cartela selected:', data.cartelaId);
      fetchSelectedCartelas();
    }
  });

  const handleCartelaClick = async (cartela: Cartela) => {
    // If cartela doesn't have numbers, fetch them
    if (!cartela.numbers || Object.keys(cartela.numbers).length === 0) {
      try {
        const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
        const response = await fetch(`${API_BASE_URL}/cartelas/${cartela.id}?includeNumbers=true`);
        if (response.ok) {
          const data = await response.json();
          setSelectedCartela(data.cartela);
        } else {
          setSelectedCartela(cartela);
        }
      } catch (error) {
        console.error('Error fetching cartela details:', error);
        setSelectedCartela(cartela);
      }
    } else {
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
      // Clear search when changing pages
      setSearchTerm('');
      fetchCartelas(newPage);
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const clearCache = () => {
    // Clear session storage cache
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith('cartelas_page_')) {
        sessionStorage.removeItem(key);
      }
    }
    // Refresh current page
    fetchCartelas(currentPage, false);
  };

  const renderBingoCard = (cartela: Cartela) => {
    const columns = ['B', 'I', 'N', 'G', 'O'] as const;

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
              const number = cartela.numbers?.[column]?.[rowIndex];

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

  const displayCartelas = searchTerm ? searchResults : cartelas;

  return (
    <div className="p-4 sm:p-6 lg:p-8 min-h-screen max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-3 sm:mb-4">
          Cartela List
          {totalCartelas > 0 && (
            <span className="text-lg text-gray-600 ml-2">
              ({totalCartelas} total)
            </span>
          )}
        </h1>
        
        {/* Performance Info */}
        {loadTime > 0 && (
          <div className="text-sm text-gray-500 mb-3">
            Loaded in {loadTime}ms
            <button 
              onClick={clearCache}
              className="ml-2 text-blue-500 hover:text-blue-700 underline"
            >
              Clear Cache
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

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <button className="px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors">
            New Game
          </button>
          <button className="px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors">
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
            onClick={() => fetchCartelas(currentPage, false)}
            className="px-3 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Cartela Cards Display - Optimized Grid */}
      {!loading && !error && (
        <div>
          {/* Search Results Info */}
          {searchTerm && (
            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-blue-700">
                Found {searchResults.length} cartela(s) matching "{searchTerm}"
                {searchResults.length === 0 && (
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
            {displayCartelas.map((cartela: Cartela, index: number) => (
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

          {displayCartelas.length === 0 && !searchTerm && (
            <div className="mt-6 p-4 sm:p-6 bg-blue-50 rounded-lg">
              <p className="text-blue-700 font-medium text-center text-sm sm:text-base">
                No cartelas available on this page.
              </p>
            </div>
          )}

          {/* Pagination - only show when not searching */}
          {!searchTerm && totalPages > 1 && renderPagination()}
          
          {/* Page Info */}
          {!searchTerm && totalCartelas > 0 && (
            <div className="text-center mt-4 text-gray-600">
              Showing {((currentPage - 1) * limit) + 1} to {Math.min(currentPage * limit, totalCartelas)} of {totalCartelas} cartelas
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

export default CardListOptimized;