// Offline Demo Mode Component
// Shows what users can do while offline

import React from 'react';
import { Gamepad, Eye, Settings, WifiOff } from 'lucide-react';

export function OfflineDemoMode() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-500/20 rounded-full mb-4">
            <WifiOff className="w-8 h-8 text-yellow-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Offline Mode</h1>
          <p className="text-slate-300">
            You're currently offline, but you can still explore some features
          </p>
        </div>

        <div className="bg-slate-800/80 backdrop-blur-xl p-6 rounded-2xl border border-slate-700/50 shadow-2xl">
          <h2 className="text-xl font-semibold text-white mb-4">Available Offline:</h2>
          
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg">
              <Eye className="w-5 h-5 text-blue-400" />
              <div>
                <div className="text-white font-medium">View Cached Cartelas</div>
                <div className="text-slate-400 text-sm">Browse previously loaded game cards</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg">
              <Gamepad className="w-5 h-5 text-green-400" />
              <div>
                <div className="text-white font-medium">Play Offline Games</div>
                <div className="text-slate-400 text-sm">Games sync when connection returns</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg">
              <Settings className="w-5 h-5 text-purple-400" />
              <div>
                <div className="text-white font-medium">Manage Settings</div>
                <div className="text-slate-400 text-sm">Configure preferences and audio</div>
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 animate-pulse"></div>
              <div>
                <div className="text-blue-300 font-medium text-sm">Auto-Sync Enabled</div>
                <div className="text-blue-200/80 text-xs">
                  Your data will automatically sync when you're back online
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => window.location.reload()}
            className="w-full mt-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-xl font-semibold text-white transition-all"
          >
            Check Connection
          </button>
        </div>

        <div className="text-center mt-6">
          <p className="text-slate-400 text-sm">
            Need to login? Please connect to the internet first.
          </p>
        </div>
      </div>
    </div>
  );
}