import React, { useState, useEffect } from 'react';
import { Gift, Trophy, Target, Coins } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

interface DailyBonusData {
  id: string;
  user_id: string;
  bonus_date: string;
  games_played: number;
  total_bet_amount: number;
  bonus_earned: number;
  requirements_met: boolean;
  bonus_claimed: boolean;
  currentBonus: number;
  requirements: {
    MIN_GAMES: number;
    MIN_BET_AMOUNT: number;
    BONUS_PERCENTAGE: number;
    MAX_BONUS: number;
  };
  progress: {
    gamesProgress: number;
    betProgress: number;
  };
}

const DailyBonus: React.FC = () => {
  const [bonusData, setBonusData] = useState<DailyBonusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState('');

  const fetchBonusData = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch(`${API_BASE_URL}/bonuses/daily`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        setBonusData(result.dailyBonus);
      }
    } catch (err) {
      console.error('Error fetching bonus data:', err);
      setError('Failed to load bonus data');
    } finally {
      setLoading(false);
    }
  };

  const claimBonus = async () => {
    if (!bonusData || !bonusData.requirements_met || bonusData.bonus_claimed) return;

    setClaiming(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/bonuses/claim`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        alert(`🎉 Bonus claimed! You received ${result.bonusAmount} Birr!`);
        fetchBonusData(); // Refresh data
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to claim bonus');
      }
    } catch (err) {
      console.error('Error claiming bonus:', err);
      setError('Failed to claim bonus');
    } finally {
      setClaiming(false);
    }
  };

  useEffect(() => {
    fetchBonusData();
  }, []);

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-yellow-500 to-orange-600 rounded-xl p-6 text-white">
        <div className="animate-pulse">
          <div className="h-6 bg-white/20 rounded mb-4"></div>
          <div className="h-4 bg-white/20 rounded mb-2"></div>
          <div className="h-4 bg-white/20 rounded"></div>
        </div>
      </div>
    );
  }

  if (!bonusData) {
    return (
      <div className="bg-gradient-to-br from-gray-500 to-gray-600 rounded-xl p-6 text-white">
        <div className="flex items-center gap-3">
          <Gift className="h-8 w-8" />
          <div>
            <h3 className="text-lg font-bold">Daily Bonus</h3>
            <p className="text-sm opacity-90">Unable to load bonus data</p>
          </div>
        </div>
      </div>
    );
  }

  const { requirements, progress } = bonusData;
  const gamesNeeded = Math.max(0, requirements.MIN_GAMES - bonusData.games_played);
  const betNeeded = Math.max(0, requirements.MIN_BET_AMOUNT - bonusData.total_bet_amount);

  return (
    <div className={`rounded-xl p-6 text-white transition-all duration-300 ${
      bonusData.bonus_claimed 
        ? 'bg-gradient-to-br from-green-500 to-green-600'
        : bonusData.requirements_met
        ? 'bg-gradient-to-br from-yellow-500 to-orange-600 shadow-lg shadow-yellow-500/25'
        : 'bg-gradient-to-br from-blue-500 to-purple-600'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${
            bonusData.bonus_claimed ? 'bg-green-600' : 'bg-white/20'
          }`}>
            {bonusData.bonus_claimed ? (
              <Trophy className="h-6 w-6" />
            ) : (
              <Gift className="h-6 w-6" />
            )}
          </div>
          <div>
            <h3 className="text-lg font-bold">Daily House Bonus</h3>
            <p className="text-sm opacity-90">
              {bonusData.bonus_claimed 
                ? 'Bonus Claimed!' 
                : bonusData.requirements_met 
                ? 'Ready to Claim!' 
                : 'Complete Daily Tasks'
              }
            </p>
          </div>
        </div>
        
        {bonusData.currentBonus > 0 && (
          <div className="text-right">
            <div className="text-2xl font-bold">{bonusData.currentBonus} Birr</div>
            <div className="text-sm opacity-90">Bonus Amount</div>
          </div>
        )}
      </div>

      {/* Progress Bars */}
      {!bonusData.bonus_claimed && (
        <div className="space-y-4 mb-4">
          {/* Games Progress */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                <span className="text-sm font-medium">Games Played</span>
              </div>
              <span className="text-sm">
                {bonusData.games_played}/{requirements.MIN_GAMES}
              </span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-2">
              <div 
                className="bg-white rounded-full h-2 transition-all duration-300"
                style={{ width: `${Math.min(progress.gamesProgress * 100, 100)}%` }}
              ></div>
            </div>
            {gamesNeeded > 0 && (
              <p className="text-xs opacity-75 mt-1">
                Play {gamesNeeded} more game{gamesNeeded !== 1 ? 's' : ''} to unlock bonus
              </p>
            )}
          </div>

          {/* Bet Amount Progress */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Coins className="h-4 w-4" />
                <span className="text-sm font-medium">Total Bet Amount</span>
              </div>
              <span className="text-sm">
                {bonusData.total_bet_amount.toFixed(1)}/{requirements.MIN_BET_AMOUNT} Birr
              </span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-2">
              <div 
                className="bg-white rounded-full h-2 transition-all duration-300"
                style={{ width: `${Math.min(progress.betProgress * 100, 100)}%` }}
              ></div>
            </div>
            {betNeeded > 0 && (
              <p className="text-xs opacity-75 mt-1">
                Bet {betNeeded.toFixed(1)} more Birr to unlock bonus
              </p>
            )}
          </div>
        </div>
      )}

      {/* Action Button */}
      {bonusData.requirements_met && !bonusData.bonus_claimed && (
        <button
          onClick={claimBonus}
          disabled={claiming}
          className="w-full bg-white text-orange-600 font-bold py-3 px-4 rounded-lg hover:bg-orange-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {claiming ? 'Claiming...' : `Claim ${bonusData.currentBonus} Birr Bonus!`}
        </button>
      )}

      {bonusData.bonus_claimed && (
        <div className="bg-green-600 rounded-lg p-3 text-center">
          <p className="font-medium">✅ Today's bonus claimed!</p>
          <p className="text-sm opacity-90">Come back tomorrow for another bonus</p>
        </div>
      )}

      {/* Requirements Info */}
      {!bonusData.requirements_met && !bonusData.bonus_claimed && (
        <div className="mt-4 p-3 bg-white/10 rounded-lg">
          <p className="text-sm font-medium mb-2">Daily Requirements:</p>
          <ul className="text-xs space-y-1 opacity-90">
            <li>• Play at least {requirements.MIN_GAMES} games</li>
            <li>• Bet at least {requirements.MIN_BET_AMOUNT} Birr total</li>
            <li>• Earn {requirements.BONUS_PERCENTAGE}% of your bets as bonus (max {requirements.MAX_BONUS} Birr)</li>
          </ul>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
          <p className="text-sm text-red-200">{error}</p>
        </div>
      )}
    </div>
  );
};

export default DailyBonus;