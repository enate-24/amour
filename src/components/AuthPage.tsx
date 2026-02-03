import React, { useState, useEffect } from 'react';
import { LogIn, Gamepad as GamepadIcon } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { OfflineLoginMessage } from './OfflineLoginMessage';
import { useNetworkStatus } from '../utils/networkStatus';
import { offlineAuthManager } from '../utils/offlineAuthManager';
import { initializeOfflineLogin } from '../utils/offlineLoginInit';

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

    try {
      const result = await signIn(formData.username, formData.password);
      
      if (result.error) {
        throw new Error(result.error.message);
      }

      const message = result.offline ? 'Offline login successful! Redirecting...' : 'Login successful! Redirecting...';
      setSuccessMessage(message);

      setFormData({ username: '', password: '' });

      setTimeout(() => {
        window.location.href = '/';
      }, 500);

    } catch (err) {
      console.error('Authentication error:', err);
      let errorMessage = err instanceof Error ? err.message : 'Authentication failed';
      
      if (isOffline || errorMessage.includes('Failed to fetch') || errorMessage.includes('ERR_INTERNET_DISCONNECTED')) {
        errorMessage = 'Cannot login while offline. Please check your internet connection and try again.';
      }
      
      setError(errorMessage);
      setLoading(false);
    }
  };

  useEffect(() => {
    const initOfflineSystem = async () => {
      try {
        await initializeOfflineLogin();
        const available = await offlineAuthManager.isOfflineLoginAvailable();
        const username = await offlineAuthManager.getCachedUsername();
        
        setOfflineLoginAvailable(available);
        if (username && available) {
          setCachedUsername(username);
          setFormData(prev => ({ ...prev, username }));
        }
      } catch (error) {
        console.error('Error initializing offline login:', error);
      }
    };

    initOfflineSystem();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-900 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-yellow-400/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-400/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-2xl mb-4 shadow-2xl shadow-yellow-500/50">
            <GamepadIcon size={40} className="text-slate-900" />
          </div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-yellow-400 via-yellow-300 to-yellow-500 bg-clip-text text-transparent mb-2">
            FIDEL BINGO
          </h1>
        </div>

        <div className="bg-slate-800/80 backdrop-blur-xl p-8 rounded-2xl border border-slate-700/50 shadow-2xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl mb-3">
              <LogIn size={24} className="text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white">Sign In</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300 block">Username or Email</label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                required
                className="w-full p-3.5 bg-slate-900/50 border border-slate-600 rounded-xl text-white"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300 block">Password</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                required
                className="w-full p-3.5 bg-slate-900/50 border border-slate-600 rounded-xl text-white"
              />
            </div>

            {isOffline && (
              <div className="mb-4">
                {offlineLoginAvailable ? (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-blue-800 text-sm">
                    <strong>Offline Login Available</strong>
                    <p>Welcome back, {cachedUsername}!</p>
                  </div>
                ) : (
                  <OfflineLoginMessage onRetry={() => window.location.reload()} />
                )}
              </div>
            )}

            {error && <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-xl text-red-400 text-sm">{error}</div>}
            {successMessage && <div className="p-4 bg-green-500/10 border border-green-500/50 rounded-xl text-green-400 text-sm">{successMessage}</div>}

            <button
              type="submit"
              disabled={loading || (isOffline && !offlineLoginAvailable)}
              className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl font-semibold text-white transition-all"
            >
              {loading ? 'Processing...' : (isOffline ? 'Sign In Offline' : 'Sign In')}
            </button>
          </form>

          <div className="text-center mt-6">
            <p className="text-slate-500 text-sm">Bingo Game Management System</p>
          </div>
        </div> {/* Closed Form Container */}
      </div> {/* Closed Content Wrapper */}
    </div> // Closed Main Container
  );
};

export default AuthPage;