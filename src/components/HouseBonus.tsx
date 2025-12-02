import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, Gift } from 'lucide-react';
import { useWebSocket } from '../hooks/useWebSocket';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

interface HouseBonusData {
  dailyProfit: number;
  bonusAvailable: number;
  requirementsMet: boolean;
  profitNeeded: number;
  bonusUsed: boolean;
  requirements: {
    MIN_DAILY_PROFIT: number;
    HOUSE_BONUS_AMOUNT: number;
  };
}

const HouseBonus: React.FC = () => {
  const [bonusData, setBonusData] = useState<HouseBonusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState('');

  const fetchBonusData = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        setError('No authentication token found');
        return;
      }

      // First test if bonus routes are accessible
      try {
        const testResponse = await fetch(`${API_BASE_URL}/bonuses/test`);
        console.log('🧪 Bonus test endpoint status:', testResponse.status);
        if (!testResponse.ok) {
          console.error('❌ Bonus routes not accessible');
        }
      } catch (testError) {
        console.error('❌ Bonus routes test failed:', testError);
      }

      console.log('🎁 Fetching bonus data from:', `${API_BASE_URL}/bonuses/daily`);
      
      const response = await fetch(`${API_BASE_URL}/bonuses/daily`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('📥 Bonus API response status:', response.status);

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Bonus data received:', result);
        setBonusData(result.dailyBonus);
      } else {
        console.error('❌ Bonus API error:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('❌ Error response:', errorText);
        setError(`API Error: ${response.status} - ${response.statusText}`);
      }
    } catch (err) {
      console.error('Error fetching house bonus data:', err);
      setError('Failed to load bonus data');
    } finally {
      setLoading(false);
    }
  };

  const useHouseBonus = async () => {
    if (!bonusData || !bonusData.requirementsMet || bonusData.bonusUsed) return;

    setClaiming(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/bonuses/use`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        alert(`🎉 House bonus used! You received ${result.bonusAmount} Birr!\nNew daily profit: ${result.newDailyProfit} Birr`);
        fetchBonusData(); // Refresh data
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to use house bonus');
      }
    } catch (err) {
      console.error('Error using house bonus:', err);
      setError('Failed to use house bonus');
    } finally {
      setClaiming(false);
    }
  };

  // WebSocket for real-time bonus updates
  useWebSocket({
    onBonusUpdate: (data) => {
      console.log('🔔 WebSocket: Bonus update received:', data);
      fetchBonusData(); // Refresh bonus data when update received
    }
  });

  useEffect(() => {
    fetchBonusData();
    // No polling needed - WebSocket will push updates
  }, []);

  if (loading) {
    return (
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg p-4 text-white">
        <div className="animate-pulse">
          <div className="h-4 bg-white/20 rounded mb-2"></div>
          <div className="h-6 bg-white/20 rounded"></div>
        </div>
      </div>
    );
  }

  if (!bonusData) {
    return null;
  }

  const progressPercentage = Math.min((bonusData.dailyProfit / bonusData.requirements.MIN_DAILY_PROFIT) * 100, 100);

  return (
    <div className={`rounded-lg p-4 text-white transition-all duration-300 ${
      bonusData.bonusUsed 
        ? 'bg-gradient-to-r from-gray-500 to-gray-600'
        : bonusData.requirementsMet
        ? 'bg-gradient-to-r from-green-500 to-emerald-600 shadow-lg shadow-green-500/25'
        : 'bg-gradient-to-r from-purple-600 to-blue-600'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg ${
            bonusData.bonusUsed ? 'bg-gray-600' : 'bg-white/20'
          }`}>
            {bonusData.bonusUsed ? (
              <Gift className="h-5 w-5" />
            ) : (
              <DollarSign className="h-5 w-5" />
            )}
          </div>
          <div>
            <h3 className="font-bold text-sm sm:text-base">House Bonus</h3>
            <p className="text-xs opacity-90">
              {bonusData.bonusUsed 
                ? 'Used Today' 
                : bonusData.requirementsMet 
                ? 'Ready to Use!' 
                : 'Earn More Profit'
              }
            </p>
          </div>
        </div>
        
        {bonusData.bonusAvailable > 0 && !bonusData.bonusUsed && (
          <div className="text-right">
            <div className="text-lg sm:text-xl font-bold">{bonusData.bonusAvailable} Birr</div>
            <div className="text-xs opacity-90">Available</div>
          </div>
        )}
      </div>

      {/* Daily Profit Display */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            <span className="text-xs font-medium">Daily Profit</span>
          </div>
          <span className="text-xs">
            {bonusData.dailyProfit.toFixed(1)}/{bonusData.requirements.MIN_DAILY_PROFIT} Birr
          </span>
        </div>
        <div className="w-full bg-white/20 rounded-full h-2">
          <div 
            className="bg-white rounded-full h-2 transition-all duration-300"
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>
        {bonusData.profitNeeded > 0 && !bonusData.bonusUsed && (
          <p className="text-xs opacity-75 mt-1">
            Earn {bonusData.profitNeeded.toFixed(1)} more Birr profit to unlock bonus
          </p>
        )}
      </div>

      {/* Action Button */}
      {bonusData.requirementsMet && !bonusData.bonusUsed && (
        <button
          onClick={useHouseBonus}
          disabled={claiming}
          className="w-full bg-white text-green-600 font-bold py-2 px-3 rounded-lg hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          {claiming ? 'Using...' : `Use ${bonusData.bonusAvailable} Birr Bonus`}
        </button>
      )}

      {bonusData.bonusUsed && (
        <div className="bg-gray-600 rounded-lg p-2 text-center">
          <p className="text-sm font-medium">✅ House bonus used today!</p>
          <p className="text-xs opacity-90">Come back tomorrow for another bonus</p>
        </div>
      )}

      {/* Requirements Info */}
      {!bonusData.requirementsMet && !bonusData.bonusUsed && (
        <div className="mt-3 p-2 bg-white/10 rounded-lg">
          <p className="text-xs font-medium mb-1">Requirement:</p>
          <p className="text-xs opacity-90">
            • Earn {bonusData.requirements.MIN_DAILY_PROFIT} Birr daily profit to unlock {bonusData.requirements.HOUSE_BONUS_AMOUNT} Birr bonus
          </p>
        </div>
      )}

      {error && (
        <div className="mt-3 p-2 bg-red-500/20 border border-red-500/30 rounded-lg">
          <p className="text-xs text-red-200">{error}</p>
        </div>
      )}
    </div>
  );
};

export default HouseBonus;