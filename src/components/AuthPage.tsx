import React, { useState } from 'react';
import { LogIn, Gamepad as GamepadIcon } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const AuthPage: React.FC = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const { signIn } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await signIn(formData.username, formData.password);
      if (result.error) throw result.error;

      // Show success message and reload the page
      setSuccessMessage('Login successful! Reloading page...');
      console.log('Login successful, showing message and reloading page', result);

      // Reload the page after showing message
      setTimeout(() => {
        window.location.reload();
      }, 1000);

      // Clear form on success
      setFormData({
        username: '',
        password: ''
      });

    } catch (err) {
      console.error('Authentication error:', err);
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-400 rounded-full mb-4">
            <GamepadIcon size={32} className="text-black" />
          </div>
          <h1 className="text-4xl font-bold text-yellow-400 mb-2">AMOUR BINGO</h1>
          <p className="text-slate-400">Bingo Game Management System</p>
        </div>

        {/* Auth Form */}
        <div className="bg-slate-800 p-8 rounded-lg border border-slate-700 shadow-xl">
          <div className="text-center mb-6">
            <LogIn size={24} className="inline mr-2 text-yellow-400" />
            <h2 className="text-xl font-semibold text-white inline">Login</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              name="username"
              placeholder="Username or Email"
              value={formData.username}
              onChange={handleInputChange}
              required
              className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg focus:border-blue-500 focus:outline-none transition-colors"
            />

            <input
              type="password"
              name="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleInputChange}
              required
              className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg focus:border-blue-500 focus:outline-none transition-colors"
            />

            {error && (
              <div className="p-3 bg-red-600/20 border border-red-600 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            {successMessage && (
              <div className="p-3 bg-green-600/20 border border-green-600 rounded-lg text-green-400 text-sm">
                {successMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 rounded-lg font-medium transition-colors"
            >
              {loading ? 'Processing...' : 'Login'}
            </button>
          </form>

          {/* Login Info */}
          <div className="mt-6 p-4 bg-slate-700/50 rounded-lg border border-slate-600">
            <p className="text-slate-300 text-sm font-medium mb-2">Login Information:</p>
            <div className="space-y-1 text-xs text-slate-400">
              <div><strong>Regular Users:</strong> Login with username</div>
              <div><strong>Admin:</strong> Login with email (amouradmin@gmail.com)</div>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Regular users use their username, admins use their email address.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
