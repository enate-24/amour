import React from 'react';
import { X, Home, Plus, Play, BarChart3, Settings, User, Menu } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface SidebarProps {
  currentPage: string;
  onPageChange: (page: 'dashboard' | 'game' | 'select-cartela' | 'card-list' | 'settings' | 'backoffice') => void;
  isOpen: boolean;
  onClose: () => void;
  onToggle: () => void;
}


const Sidebar: React.FC<SidebarProps> = ({ currentPage, onPageChange, isOpen, onClose, onToggle }) => {
  const { user, signOut } = useAuth();

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'game', label: 'Play Bingo', icon: Play },
    { id: 'game-analytics', label: 'Game History', icon: BarChart3 },
    { id: 'card-list', label: 'Card List', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleSignOut = async () => {
    await signOut();
    onClose();
    // Reload the page after sign out
    window.location.reload();
  };

  return (
    <>
      {/* Sidebar Toggle Button - Only show when sidebar is closed */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="fixed left-4 top-4 z-50 p-2 sm:p-3 bg-slate-800 hover:bg-slate-700 rounded-lg shadow-lg transition-colors"
          aria-label="Open menu"
        >
          <Menu size={18} className="text-white sm:w-5 sm:h-5" />
        </button>
      )}

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed left-0 top-0 h-full w-72 sm:w-64 bg-slate-800 border-r border-slate-700 z-50 transition-transform duration-300 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="p-4 sm:p-4">
          <div className="flex items-center justify-between mb-6 sm:mb-8">
            <h1 className="text-xl sm:text-2xl font-bold text-yellow-400">BINGO ONE</h1>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-700 transition-colors"
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
          </div>

          <div className="mb-6">
            <div className="flex items-center gap-3 p-3 bg-slate-700 rounded-lg">
              <User size={18} className="text-slate-400 sm:w-5 sm:h-5" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm sm:text-base truncate">{user?.email?.split('@')[0] || 'User'}</p>
                <p className="text-xs sm:text-sm text-slate-400">House Profit: {user?.balance?.toFixed(2) || '0.00'} Birr</p>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              <button
                onClick={handleSignOut}
                className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-medium transition-colors text-sm sm:text-base"
              >
                Sign Out
              </button>
            </div>
          </div>

          <nav className="space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onPageChange(item.id as any);
                    onClose();
                  }}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                    currentPage === item.id
                      ? 'bg-slate-700 text-yellow-400'
                      : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  <Icon size={18} className="sm:w-5 sm:h-5" />
                  <span className="text-sm sm:text-base">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
