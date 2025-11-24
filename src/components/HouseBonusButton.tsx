import React, { useState, useEffect } from 'react';
import { Gift, DollarSign } from 'lucide-react';

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

const HouseBonusButton: React.FC = () => {
  const [bonusData, setBonusData] = useState<HouseBonusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);

  const fetchBonusData = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/bonuses/daily`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        setBonusData(result.dailyBonus);
      } else if (response.status === 404 || response.status === 500) {
        // Bonus system not available - hide component
        console.warn('⚠️ Bonus system not available, hiding bonus button');
        setBonusData(null);
      } else {
        console.error('❌ Bonus API error:', response.status, response.statusText);
      }
    } catch (err) {
      console.error('Error fetching house bonus data:', err);
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
        alert(`🎉 House bonus used! You received ${result.bonusAmount} Birr!`);
        fetchBonusData(); // Refresh data
        
        // Refresh the page to update balance display
        window.location.reload();
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error || 'Failed to use house bonus'}`);
      }
    } catch (err) {
      console.error('Error using house bonus:', err);
      alert('Failed to use house bonus. Please try again.');
    } finally {
      setClaiming(false);
    }
  };

  useEffect(() => {
    fetchBonusData();
    
    // Only set up interval if initial fetch was successful
    let interval: NodeJS.Timeout | null = null;
    
    const setupInterval = () => {
      interval = setInterval(async () => {
        try {
          await fetchBonusData();
        } catch (error) {
          console.warn('⚠️ Bonus data fetch failed, stopping auto-refresh');
          if (interval) {
            clearInterval(interval);
            interval = null;
          }
        }
      }, 30000);
    };
    
    // Set up interval after a short delay to allow initial fetch to complete
    setTimeout(setupInterval, 1000);
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, []);

  // Don't show anything if loading or no data
  if (loading || !bonusData) {
    return null;
  }

  // Don't show if bonus already used
  if (bonusData.bonusUsed) {
    return null;
  }

  // Show button based on requirement status
  if (bonusData.requirementsMet) {
    // Requirements met - show active button
    return (
      <button
        onClick={useHouseBonus}
        disabled={claiming}
        className="bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 text-white px-4 py-2 sm:px-6 sm:py-3 rounded-lg font-bold transition-all shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-sm sm:text-base flex items-center gap-2"
        title={`Use ${bonusData.bonusAvailable} Birr house bonus (Daily profit: ${bonusData.dailyProfit.toFixed(1)} Birr)`}
      >
        <Gift className="h-4 w-4 sm:h-5 sm:w-5" />
        {claiming ? (
          <span>Using...</span>
        ) : (
          <span className="hidden sm:inline">Use {bonusData.bonusAvailable} Birr House Bonus</span>
        )}
        <span className="sm:hidden">{claiming ? 'Using...' : `${bonusData.bonusAvailable} Birr Bonus`}</span>
      </button>
    );
  } else {
    // Requirements not met - show disabled button with progress
    return (
      <button
        disabled
        className="bg-gradient-to-r from-gray-500 to-gray-600 text-white px-4 py-2 sm:px-6 sm:py-3 rounded-lg font-bold opacity-60 cursor-not-allowed text-sm sm:text-base flex items-center gap-2"
        title={`Need ${bonusData.profitNeeded.toFixed(1)} more Birr daily profit to unlock ${bonusData.bonusAvailable} Birr house bonus`}
      >
        <DollarSign className="h-4 w-4 sm:h-5 sm:w-5" />
        <span className="hidden sm:inline">
          House Bonus ({bonusData.dailyProfit.toFixed(0)}/{bonusData.requirements.MIN_DAILY_PROFIT} Birr)
        </span>
        <span className="sm:hidden">
          Bonus ({bonusData.dailyProfit.toFixed(0)}/{bonusData.requirements.MIN_DAILY_PROFIT})
        </span>
      </button>
    );
  }
};

export default HouseBonusButton;