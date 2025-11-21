import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { cartelaAPI } from '../lib/api';

const AddCartela: React.FC = () => {
  const { user } = useAuth();
  const [cardId, setCardId] = useState('');
  const [cartelaNumber, setCartelaNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isGenerated, setIsGenerated] = useState(false);
  
  // Initialize the bingo card with empty values
  const [bingoCard, setBingoCard] = useState({
    B: ['', '', '', '', ''],
    I: ['', '', '', '', ''],
    N: ['', '', 'FREE', '', ''],
    G: ['', '', '', '', ''],
    O: ['', '', '', '', '']
  });

  const columns = ['B', 'I', 'N', 'G', 'O'] as const;

  // Generate random bingo numbers
  const generateRandomCard = () => {
    // Generate a random cartela number (1-9999)
    const randomCartelaNumber = Math.floor(Math.random() * 9999) + 1;
    setCartelaNumber(randomCartelaNumber.toString());
    
    // Generate card ID based on cartela number
    const generatedCardId = `CARTELA-${randomCartelaNumber}`;
    setCardId(generatedCardId);
    
    // Generate the bingo card numbers
    const newCard = {
      B: generateColumnNumbers(1, 15),
      I: generateColumnNumbers(16, 30),
      N: generateColumnNumbers(31, 45, true),
      G: generateColumnNumbers(46, 60),
      O: generateColumnNumbers(61, 75)
    };
    setBingoCard(newCard);
    setIsGenerated(true);
    setMessage({ type: 'success', text: `Cartela #${randomCartelaNumber} generated successfully!` });
  };

  const generateColumnNumbers = (min: number, max: number, hasFree: boolean = false): string[] => {
    const numbers: number[] = [];
    while (numbers.length < 5) {
      const num = Math.floor(Math.random() * (max - min + 1)) + min;
      if (!numbers.includes(num)) {
        numbers.push(num);
      }
    }
    // Don't sort - keep random order
    
    if (hasFree) {
      return [
        numbers[0].toString(),
        numbers[1].toString(),
        'FREE',
        numbers[2].toString(),
        numbers[3].toString()
      ];
    }
    
    return numbers.map(n => n.toString());
  };

  const handleCellChange = (column: typeof columns[number], index: number, value: string) => {
    // Don't allow changing the FREE space
    if (column === 'N' && index === 2) return;
    
    // Only allow numbers
    if (value && !/^\d+$/.test(value)) return;
    
    setBingoCard(prev => ({
      ...prev,
      [column]: prev[column].map((cell, i) => i === index ? value : cell)
    }));
  };

  const validateCard = (): boolean => {
    // Check if cartela has been generated
    if (!isGenerated) {
      setMessage({ type: 'error', text: 'Please generate a cartela first' });
      return false;
    }

    // Check if card ID is provided
    if (!cardId.trim()) {
      setMessage({ type: 'error', text: 'Card ID is missing' });
      return false;
    }

    // Check if all cells are filled (except FREE)
    for (const column of columns) {
      for (let i = 0; i < 5; i++) {
        if (column === 'N' && i === 2) continue; // Skip FREE space
        if (!bingoCard[column][i] || bingoCard[column][i].trim() === '') {
          setMessage({ type: 'error', text: 'Please fill all cells in the bingo card' });
          return false;
        }
      }
    }

    // Validate number ranges
    const ranges = {
      B: [1, 15],
      I: [16, 30],
      N: [31, 45],
      G: [46, 60],
      O: [61, 75]
    };

    for (const column of columns) {
      const [min, max] = ranges[column];
      for (let i = 0; i < 5; i++) {
        if (column === 'N' && i === 2) continue; // Skip FREE space
        const num = parseInt(bingoCard[column][i]);
        if (isNaN(num) || num < min || num > max) {
          setMessage({ 
            type: 'error', 
            text: `Column ${column} must contain numbers between ${min} and ${max}` 
          });
          return false;
        }
      }
    }

    return true;
  };

  const handleAddCartela = async () => {
    if (!user) {
      setMessage({ type: 'error', text: 'You must be logged in to add a cartela' });
      return;
    }

    if (!validateCard()) return;

    setLoading(true);
    setMessage(null);

    try {
      // Convert the card to the format expected by the database (JSON string for PostgreSQL)
      const numbers = {
        B: bingoCard.B.map(n => n === 'FREE' ? 0 : parseInt(n)), // 0 represents FREE in PostgreSQL
        I: bingoCard.I.map(n => n === 'FREE' ? 0 : parseInt(n)),
        N: bingoCard.N.map(n => n === 'FREE' ? 0 : parseInt(n)),
        G: bingoCard.G.map(n => n === 'FREE' ? 0 : parseInt(n)),
        O: bingoCard.O.map(n => n === 'FREE' ? 0 : parseInt(n))
      };

      // Use the cartelaAPI to create the cartela
      const { data, error } = await cartelaAPI.createCartela({
        card_id: cardId,
        user_id: user.id,
        numbers: numbers
      });

      if (error) {
        throw error;
      }

      setMessage({
        type: 'success',
        text: `Cartela #${cartelaNumber} added to database successfully!`
      });

      // Reset form
      setCardId('');
      setCartelaNumber('');
      setIsGenerated(false);
      setBingoCard({
        B: ['', '', '', '', ''],
        I: ['', '', '', '', ''],
        N: ['', '', 'FREE', '', ''],
        G: ['', '', '', '', ''],
        O: ['', '', '', '', '']
      });
    } catch (error: any) {
      console.error('Error adding cartela:', error);
      setMessage({
        type: 'error',
        text: error.message || 'Failed to add cartela. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-3xl font-bold text-black">Add Cartela</h1>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          {/* Card ID Input - Read Only */}
          <div className="mb-4">
            <input
              type="text"
              value={cardId}
              readOnly
              placeholder="Card ID (Generated automatically)"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50 text-gray-700 cursor-not-allowed"
            />
          </div>

          {/* BINGO Grid */}
          <div className="mb-4">
            {/* Column Headers */}
            <div className="grid grid-cols-5 gap-1.5 mb-1.5">
              {columns.map((letter) => (
                <div
                  key={letter}
                  className="text-center font-bold text-xl text-gray-800"
                >
                  {letter}
                </div>
              ))}
            </div>

            {/* Grid Cells */}
            <div className="grid grid-cols-5 gap-1.5">
              {Array.from({ length: 5 }, (_, rowIndex) =>
                columns.map((column) => {
                  const isFree = column === 'N' && rowIndex === 2;
                  const cellValue = bingoCard[column][rowIndex];
                  
                  return (
                    <input
                      key={`${column}-${rowIndex}`}
                      type="text"
                      value={cellValue}
                      onChange={(e) => handleCellChange(column, rowIndex, e.target.value)}
                      disabled={isFree}
                      placeholder={isFree ? '' : `${column.toLowerCase()}${rowIndex + 1}`}
                      className={`
                        aspect-square flex items-center justify-center text-center text-base font-semibold
                        border-2 rounded transition-all
                        ${isFree 
                          ? 'bg-red-500 text-white border-red-600 cursor-not-allowed' 
                          : 'border-gray-300 text-black hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                        }
                      `}
                    />
                  );
                })
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={generateRandomCard}
              disabled={loading}
              className="flex-1 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors text-sm"
            >
              Generate
            </button>
            <button
              onClick={handleAddCartela}
              disabled={loading || !isGenerated}
              className="flex-1 px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors text-sm"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Adding...
                </div>
              ) : (
                'Add Cartela'
              )}
            </button>
          </div>

          {/* Status Messages */}
          {message && (
            <div
              className={`mt-4 p-3 rounded-lg text-sm ${
                message.type === 'success'
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              {message.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddCartela;
