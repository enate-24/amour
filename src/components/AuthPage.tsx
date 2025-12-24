import React, { useState, useEffect } from 'react';
import { LogIn, Gamepad as GamepadIcon } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { OfflineLoginMessage } from './OfflineLoginMessage';
import { useNetworkStatus } from '../utils/networkStatus';
import { offlineAuthManager } from '../utils/offlineAuthManager';
import { initializeOfflineLogin, testOfflineLogin } from '../utils/offlineLoginInit';

const AuthPage: React.FC = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const { signIn } = useAuth();
  const { isOffline } = useNetworkStatus();
  const [offlineLoginAvailable, setOfflineLoginAvailable] = useState(false);
  const [cachedUsername, setCachedUsername] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    console.log('Login attempt with:', formData.username);

    try {
      const result = await signIn(formData.username, formData.password);
      console.log('Login result:', result);
      
      if (result.error) {
        console.error('Login error from signIn:', result.error);
        throw new Error(result.error.message);
      }

      // Show success message
      const message = result.offline ? 'Offline login successful! Redirecting...' : 'Login successful! Redirecting...';
      setSuccessMessage(message);
      console.log('Login successful, forcing page reload to ensure clean state');

      // Clear form on success
      setFormData({
        username: '',
        password: ''
      });

      // Force a page reload to ensure clean state after login
      // This prevents any stale state issues
      setTimeout(() => {
        window.location.href = '/';
      }, 500);

    } catch (err) {
      console.error('Authentication error:', err);
      
      // Provide better error messages for offline scenarios
      let errorMessage = err instanceof Error ? err.message : 'Authentication failed';
      
      if (isOffline || errorMessage.includes('Failed to fetch') || errorMessage.includes('ERR_INTERNET_DISCONNECTED')) {
        errorMessage = 'Cannot login while offline. Please check your internet connection and try again.';
      }
      
      setError(errorMessage);
      setLoading(false);
    }
  };

  // Initialize offline login system
  useEffect(() => {
    const initOfflineSystem = async () => {
      try {
        console.log('�  Initializing offline login system...');
        
        // Initialize offline login
        await initializeOfflineLogin();
        
        // Check availability
        const available = await offlineAuthManager.isOfflineLoginAvailable();
        const username = await offlineAuthManager.getCachedUsername();
        
        console.log('Offline login available:', available);
        console.log('Cached username:', username);
        
        setOfflineLoginAvailable(available);
        if (username && available) {
          setCachedUsername(username);
          setFormData(prev => ({ ...prev, username }));
          console.log('✅ Pre-filled username for offline login');
        }
      } catch (error) {
        console.error('Error initializing offline login:', error);
      }
    };

    initOfflineSystem();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-900 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-yellow-400/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-400/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-2xl mb-4 shadow-2xl shadow-yellow-500/50 transform hover:scale-105 transition-transform">
            <GamepadIcon size={40} className="text-slate-900" />
          </div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-yellow-400 via-yellow-300 to-yellow-500 bg-clip-text text-transparent mb-2">
            ABISINYA BINGO
          </h1>
          <p className="text-slate-300 text-lg">Welcome back!</p>
        </div>

        {/* Auth Form */}
        <div className="bg-slate-800/80 backdrop-blur-xl p-8 rounded-2xl border border-slate-700/50 shadow-2xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl mb-3">
              <LogIn size={24} className="text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white">Sign In</h2>
            <p className="text-slate-400 text-sm mt-1">Enter your credentials to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300 block">Username or Email</label>
              <input
                type="text"
                name="username"
                placeholder="Enter your username or email"
                value={formData.username}
                onChange={handleInputChange}
                required
                className="w-full p-3.5 bg-slate-900/50 border border-slate-600 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all text-white placeholder-slate-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300 block">Password</label>
              <input
                type="password"
                name="password"
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleInputChange}
                required
                className="w-full p-3.5 bg-slate-900/50 border border-slate-600 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all text-white placeholder-slate-500"
              />
            </div>

            {/* Offline Message */}
            {isOffline && (
              <div className="mb-4">
                {offlineLoginAvailable ? (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start">
                      <div className="w-5 h-5 text-blue-600 mt-0.5 mr-3">🔒</div>
                      <div className="flex-1">
                        <h3 className="text-sm font-medium text-blue-800 mb-1">
                          Offline Login Available
                        </h3>
                        <p className="text-sm text-blue-700 mb-2">
                          You can login offline using your previously saved credentials.
                          {cachedUsername && ` Welcome back, ${cachedUsername}!`}
                        </p>
                        <div className="text-xs text-blue-600">
                          <div className="w-2 h-2 bg-blue-400 rounded-full mr-2 inline-block"></div>
                          Your data will sync when connection returns
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <OfflineLoginMessage onRetry={() => window.location.reload()} />
                )}
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-xl text-red-400 text-sm flex items-start gap-2 animate-shake">
                <span className="text-red-500 font-bold">✕</span>
                <span>{error}</span>
              </div>
            )}

            {successMessage && (
              <div className="p-4 bg-green-500/10 border border-green-500/50 rounded-xl text-green-400 text-sm flex items-start gap-2">
                <span className="text-green-500 font-bold">✓</span>
                <span>{successMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (isOffline && !offlineLoginAvailable)}
              className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-slate-600 disabled:to-slate-600 rounded-xl font-semibold text-white transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-blue-500/25 disabled:shadow-none"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </span>
              ) : isOffline && !offlineLoginAvailable ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                  Offline - Cannot Login
                </span>
              ) : isOffline && offlineLoginAvailable ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                  Sign In Offline
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
          
          {/* Demo Login Button for Testing */}
          <div className="mt-4 pt-4 border-t border-slate-600">
            <button
              onClick={async () => {
                try {
                  console.log('🧪 Testing offline login with demo user...');
                  
                  // First test the offline login directly
                  const testResult = await testOfflineLogin();
                  if (testResult) {
                    console.log('✅ Direct offline login test passed');
                    
                    // Now try through the signIn function
                    setFormData({ username: 'demo', password: 'demo' });
                    const result = await signIn('demo', 'demo');
                    console.log('Demo login result:', result);
                  } else {
                    throw new Error('Direct offline login test failed');
                  }
                } catch (error) {
                  console.error('Demo login failed:', error);
                  alert('Demo login failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
                }
              }}
              className="w-full py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 rounded-xl font-medium text-white transition-all text-sm"
            >
              🧪 Test Demo Login (demo/demo)
            </button>
          </div>
          
          {/* Demo User Creation for Testing */}
          {isOffline && !offlineLoginAvailable && (
            <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <p className="text-yellow-300 text-sm mb-2">
                No offline login available. Create demo user for testing:
              </p>
              <button
                onClick={async () => {
                  try {
                    const { createDemoOfflineUser } = await import('../utils/demoOfflineUser');
                    await createDemoOfflineUser();
                    // Refresh the page to check offline login availability
                    window.location.reload();
                  } catch (error) {
                    console.error('Failed to create demo user:', error);
                  }
                }}
                className="w-full px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Create Demo User (Username: demo, Password: demo)
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-slate-500 text-sm">
            Bingo Game Management System
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
