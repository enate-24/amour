import { useState, useEffect } from 'react';
import { Menu, User } from 'lucide-react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { UnifiedAudioManager } from './utils/UnifiedAudioManager';
import { OfflineIndicator } from './components/OfflineIndicator';
import AuthPage from './components/AuthPage';
import Dashboard from './components/Dashboard';
import GamePage from './components/GamePageOptimized';
import Selectcartela from './components/select-cartela.tsx';
import CardList from './components/CardList';
import Settings from './components/Settings';
import Sidebar from './components/Sidebar';
import BackofficeLayout from './components/BackofficeLayout';
import BackofficeDashboard from './components/BackofficeDashboard';

import AdminUserManagement from './components/AdminUserManagement';

import NewAccountPage from './components/NewAccountPage';
import NewGame from './components/NewGame';
import GameAnalytics from './components/GameAnalytics';

// Initialize audio manager with cache-first strategy
const initializeAudioManager = async () => {
  console.log('🔊 Initializing UnifiedAudioManager...');
  try {
    const audioManager = UnifiedAudioManager.getInstance({
      maxConcurrentDownloads: 5,
      retryAttempts: 3,
      retryDelay: 1000,
      preloadOnInit: false // Don't auto-download, only download on-demand
    });
    
    await audioManager.initialize();
    
    // Check cache status
    const status = await audioManager.getCacheStatus();
    console.log(`📊 Audio cache: ${status.cachedFiles}/${status.totalFiles} files (${(status.cachedFiles/status.totalFiles*100).toFixed(1)}%)`);
    
    if (status.isComplete) {
      console.log('✅ All audio files cached - ready for offline use');
    } else {
      console.log(`⚠️ ${status.missingFiles.length} audio files not cached - will download on-demand`);
    }
  } catch (error) {
    console.error('❌ Failed to initialize audio manager:', error);
  }
};

function AppContent() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Initialize audio manager (cache-first, no auto-download)
  useEffect(() => {
    initializeAudioManager();
  }, []); // Run once on app mount

  // Reset sidebar when user changes (login/logout/role change)
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [user?.id, user?.role]);

  // Navigate to login page when user logs out
  useEffect(() => {
    if (!user && !loading) {
      // Use setTimeout to ensure navigation happens after state updates
      const timer = setTimeout(() => {
        // Only navigate if we're not already on the root/login page
        if (location.pathname !== '/' && location.pathname !== '/login') {
          console.log('Navigating to login page after logout');
          navigate('/', { replace: true });
        }
      }, 0);

      return () => clearTimeout(timer);
    }
  }, [user, loading, location.pathname, navigate]);

  // Redirect based on user status - runs whenever user or path changes
  useEffect(() => {
    if (!user || loading) {
      console.log('Skipping redirect - user:', !!user, 'loading:', loading);
      return;
    }

    const currentPath = location.pathname;
    const userRole = user.role || 'user';

    console.log('🔄 Redirect check - User:', user.username, 'Role:', userRole, 'Path:', currentPath);

    if (userRole === 'admin') {
      // Admin should only access backoffice routes
      if (!currentPath.startsWith('/backoffice')) {
        console.log('➡️ Redirecting admin to backoffice dashboard');
        navigate('/backoffice/dashboard', { replace: true });
      }
    } else {
      // Regular user - redirect from root or any non-user path to game
      const validUserPaths = ['/dashboard', '/game', '/game-analytics', '/select-cartela', '/newgame', '/card-list', '/settings', '/new-account'];
      const isValidUserPath = validUserPaths.some(path => currentPath === path);
      
      if (currentPath === '/' || !isValidUserPath) {
        console.log('➡️ Redirecting regular user to /game from:', currentPath);
        navigate('/game', { replace: true });
      } else {
        console.log('✅ User on valid path:', currentPath);
      }
    }
  }, [user, loading, location.pathname, navigate]);

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Show login page if not authenticated
  if (!user) {
    console.log('No user, showing AuthPage');
    return (
      <Routes>
        <Route path="*" element={<AuthPage />} />
      </Routes>
    );
  }

  console.log('User authenticated:', user.username, 'role:', user.role, 'on path:', location.pathname);

  // Get user role
  const userRole = user?.role || 'user';

  // Role-based access control - check admin role first
  if (userRole === 'admin') {
    // Admin can only access backoffice
    return (
      <Routes>
        <Route path="/backoffice/*" element={<BackofficeLayout />}>
          <Route path="dashboard" element={<BackofficeDashboard />} />

          <Route path="user-management" element={<AdminUserManagement />} />
          <Route path="" element={<BackofficeDashboard />} />
        </Route>
        <Route path="*" element={<BackofficeLayout />} />
      </Routes>
    );
  }



  // Check if user is new (hasn't played any games yet) - only for non-admin users
  const isNewUser = user?.totalGamesPlayed === 0;

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Offline Indicator */}
      <OfflineIndicator />
      
      {/* Mobile Header */}
      <div className="lg:hidden bg-slate-800 p-4 flex items-center justify-between">
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors"
        >
          <Menu size={20} />
        </button>
        <h1 className="text-xl font-bold text-yellow-400"> {user?.username || user?.email?.split('@')[0] || 'User'}</h1>
        <div className="flex items-center gap-4">
          <User size={20} />
          <span className="text-sm">
            {user?.username || user?.email?.split('@')[0] || 'User'}
          </span>
        </div>
      </div>

      <div className="flex">
        <Sidebar
          currentPage={location.pathname.substring(1) || 'dashboard'}
          onPageChange={(page) => navigate(`/${page}`)}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        />

        {/* Main Content */}
        <main className="flex-1 min-w-0 overflow-x-hidden">{/* Ensure content doesn't overflow on mobile */}
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/game-analytics" element={<GameAnalytics />} />
            <Route path="/game" element={<GamePage onNavigateToLottery={() => navigate('/newgame')} />} />
            <Route path="/select-cartela" element={<Selectcartela />} />
            <Route path="/newgame" element={<NewGame />} />
            <Route path="/card-list" element={<CardList />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/new-account" element={
              <NewAccountPage
                onViewCartela={() => navigate('/card-list')}
                onCreateNewGame={() => navigate('/game')}
              />
            } />
            <Route path="/" element={
              isNewUser ? (
                <NewAccountPage
                  onViewCartela={() => navigate('/card-list')}
                  onCreateNewGame={() => navigate('/game')}
                />
              ) : (
                <Dashboard />
              )
            } />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <AppContent />
    </Router>
  );
}

export default App;
