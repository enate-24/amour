import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';

const GameAnalyticsSimple: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    console.log('🔍 Simple GameAnalytics component mounted');
    console.log('👤 Current user:', user);
    
    // Simulate loading
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  }, [user]);

  if (loading) {
    return (
      <div className="p-6 bg-slate-900 min-h-screen text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto mb-4"></div>
          <p>Loading simple game analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-slate-900 min-h-screen text-white">
        <div className="text-center">
          <div className="bg-red-600 text-white p-4 rounded-lg mb-4">
            <p>Error: {error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-slate-900 min-h-screen text-white">
      <h1 className="text-3xl font-bold mb-6">Game Analytics (Simple Test)</h1>
      
      <div className="bg-slate-800 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4 text-green-400">✅ Component Working!</h2>
        <div className="space-y-2 text-slate-300">
          <p><strong>User:</strong> {user?.email || 'Not logged in'}</p>
          <p><strong>Role:</strong> {user?.role || 'Unknown'}</p>
          <p><strong>Component:</strong> Loaded successfully</p>
          <p><strong>Route:</strong> Should be /game-analytics</p>
        </div>
      </div>

      <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
        <h3 className="text-blue-400 font-semibold mb-2">Next Steps:</h3>
        <ul className="text-sm text-slate-300 space-y-1">
          <li>• If you see this, the routing is working</li>
          <li>• The issue might be with the API call in the full component</li>
          <li>• Check browser console for any errors</li>
          <li>• Verify backend server is running</li>
        </ul>
      </div>
    </div>
  );
};

export default GameAnalyticsSimple;