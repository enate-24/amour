import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  FileText,
  LogOut,
  Menu,
  X,
  Shield,
  User
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import AuthPage from './AuthPage';

const BackofficeLayout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Reset sidebar when user changes (login/logout/role change)
  useEffect(() => {
    setIsSidebarOpen(true);
  }, [user?.id]);

  // Auto-close sidebar on route change
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  // Set initial sidebar state based on screen size
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsSidebarOpen(false);
      }
    };

    // Set initial state
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
    return <AuthPage />;
  }

  // Check if user has admin or cashier role
  const userRole = user.role || 'user';
  const hasBackofficeAccess = ['admin', 'cashier'].includes(userRole);

  if (!hasBackofficeAccess) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-slate-400 mb-6">You don't have permission to access the backoffice.</p>
          <button
            onClick={async () => {
              try {
                await signOut();
                window.location.reload();
              } catch (error) {
                console.error('Sign out error:', error);
                window.location.reload();
              }
            }}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, color: 'text-blue-400' },

    ...(userRole === 'admin' ? [
      { id: 'user-management', label: 'User Management', icon: User, color: 'text-purple-400' }
    ] : []),
  ].filter(Boolean);

  const handleSignOut = async () => {
    try {
      await signOut();
      // Reload the page after successful sign out
      window.location.reload();
    } catch (error) {
      console.error('Sign out error:', error);
      // Even if signOut fails, we still want to reload the page to clear the UI state
      window.location.reload();
    }
  };

  const handlePageChange = (pageId: string) => {
    navigate(`/backoffice/${pageId}`);
    // Close sidebar after navigation
    setIsSidebarOpen(false);
  };

  const getCurrentPage = () => {
    const pathSegments = location.pathname.split('/');
    return pathSegments[pathSegments.length - 1] || 'dashboard';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Mobile Header */}
      <div className="lg:hidden bg-slate-800/95 backdrop-blur-sm p-4 flex items-center justify-between border-b border-slate-700/50 sticky top-0 z-30 shadow-lg">
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="p-2.5 rounded-xl bg-gradient-to-br from-slate-700 to-slate-600 hover:from-slate-600 hover:to-slate-500 transition-all duration-200 shadow-md active:scale-95"
        >
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-lg shadow-lg">
            <Shield className="text-slate-900" size={20} />
          </div>
          <h1 className="text-lg font-bold bg-gradient-to-r from-yellow-400 to-yellow-500 bg-clip-text text-transparent">
            BACKOFFICE
          </h1>
        </div>
        <button 
          onClick={handleSignOut}
          className="p-2.5 text-red-400 hover:bg-red-900/20 rounded-xl transition-all duration-200 active:scale-95"
        >
          <LogOut size={20} />
        </button>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <div className={`fixed left-0 top-0 h-full w-80 bg-gradient-to-b from-slate-800 via-slate-800 to-slate-900 border-r border-slate-700/50 z-50 transition-all duration-300 shadow-2xl ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:w-72`}>
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-6 border-b border-slate-700/50">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-xl shadow-lg">
                    <Shield className="text-slate-900" size={24} />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold bg-gradient-to-r from-yellow-400 to-yellow-500 bg-clip-text text-transparent">
                      BINGO BACKOFFICE
                    </h1>
                    <p className="text-xs text-slate-400 font-medium">Management System</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-2 rounded-lg hover:bg-slate-700/50 transition-all duration-200 active:scale-95"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Admin Info */}
              <div className="p-4 bg-gradient-to-br from-slate-700/50 to-slate-700/30 rounded-xl border border-slate-600/30 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 via-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg ring-2 ring-slate-700/50">
                    <User size={22} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white truncate">
                      {user.username || user.email?.split('@')[0] || 'User'}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-300 border border-blue-500/30">
                        {userRole}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const currentPage = getCurrentPage();
                const isActive = currentPage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handlePageChange(item.id)}
                    className={`w-full flex items-center gap-3 p-3.5 rounded-xl transition-all duration-200 group relative overflow-hidden ${
                      isActive
                        ? 'bg-gradient-to-r from-yellow-400/20 to-yellow-500/20 text-yellow-400 shadow-lg border border-yellow-400/30'
                        : 'text-slate-300 hover:bg-slate-700/50 hover:text-white border border-transparent'
                    }`}
                  >
                    {isActive && (
                      <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/10 to-transparent animate-pulse" />
                    )}
                    <div className={`p-2 rounded-lg transition-all duration-200 ${
                      isActive 
                        ? 'bg-yellow-400/20' 
                        : 'bg-slate-700/50 group-hover:bg-slate-600/50'
                    }`}>
                      <Icon size={20} className={isActive ? 'text-yellow-400' : item.color} />
                    </div>
                    <span className="font-medium relative z-10">{item.label}</span>
                    {isActive && (
                      <div className="ml-auto w-2 h-2 rounded-full bg-yellow-400 shadow-lg shadow-yellow-400/50" />
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-slate-700/50 bg-slate-800/50">
              <button 
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 p-3.5 rounded-xl text-red-400 hover:bg-red-900/20 transition-all duration-200 border border-transparent hover:border-red-500/30 group active:scale-95"
              >
                <div className="p-2 rounded-lg bg-red-900/20 group-hover:bg-red-900/30 transition-all duration-200">
                  <LogOut size={20} />
                </div>
                <span className="font-medium">Logout</span>
              </button>
            </div>
          </div>
        </div>

        {/* Overlay - Mobile only */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Toggle Button - Desktop */}
        {!isSidebarOpen && (
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="hidden lg:block fixed left-4 top-4 z-30 p-3 bg-gradient-to-br from-slate-800 to-slate-700 hover:from-slate-700 hover:to-slate-600 rounded-xl shadow-lg transition-all duration-200 active:scale-95 border border-slate-600/50"
          >
            <Menu size={20} className="text-yellow-400" />
          </button>
        )}

        {/* Main Content */}
        <main className={`flex-1 min-h-screen transition-all duration-300 ${
          isSidebarOpen ? 'lg:ml-72' : 'lg:ml-0'
        }`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default BackofficeLayout;
