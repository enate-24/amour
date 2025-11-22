import React, { useState } from 'react';

const DashboardDebug: React.FC = () => {
  const [results, setResults] = useState<any>({});
  const [loading, setLoading] = useState(false);

  const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

  const testEndpoint = async (endpoint: string, requiresAuth: boolean = false) => {
    setLoading(true);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (requiresAuth) {
        const token = localStorage.getItem('auth_token');
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers,
        method: 'GET'
      });

      const data = await response.json();
      
      setResults((prev: Record<string, any>) => ({
        ...prev,
        [endpoint]: {
          status: response.status,
          ok: response.ok,
          data: data
        }
      }));
    } catch (error) {
      setResults((prev: Record<string, any>) => ({
        ...prev,
        [endpoint]: {
          status: 'ERROR',
          ok: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Dashboard Debug Tool</h1>
      
      <div className="space-y-4 mb-6">
        <button
          onClick={() => testEndpoint('/health')}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded mr-2"
        >
          Test Backend Health
        </button>
        
        <button
          onClick={() => testEndpoint('/dashboard/health')}
          disabled={loading}
          className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded mr-2"
        >
          Test Dashboard Health
        </button>
        
        <button
          onClick={() => testEndpoint('/dashboard/test', true)}
          disabled={loading}
          className="bg-yellow-600 hover:bg-yellow-700 px-4 py-2 rounded mr-2"
        >
          Test Dashboard Auth
        </button>
        
        <button
          onClick={() => testEndpoint('/dashboard', true)}
          disabled={loading}
          className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded mr-2"
        >
          Test Full Dashboard
        </button>
      </div>

      {loading && (
        <div className="text-center py-4">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
          <p className="mt-2">Testing...</p>
        </div>
      )}

      <div className="space-y-4">
        {Object.entries(results).map(([endpoint, result]: [string, any]) => (
          <div key={endpoint} className="bg-slate-800 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-2">{endpoint}</h3>
            <div className="space-y-2">
              <p>Status: <span className={result.ok ? 'text-green-400' : 'text-red-400'}>{result.status}</span></p>
              <pre className="bg-slate-900 p-2 rounded text-sm overflow-auto">
                {JSON.stringify(result.data || result.error, null, 2)}
              </pre>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DashboardDebug;