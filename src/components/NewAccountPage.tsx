import React from 'react';

interface NewAccountPageProps {
  onViewCartela: () => void;
  onCreateNewGame: () => void;
}

const NewAccountPage: React.FC<NewAccountPageProps> = ({
  onViewCartela,
  onCreateNewGame
}) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        {/* Logo */}
        <div className="mb-8">
          <h1 className="text-5xl font-bold text-white mb-4">CLASSIC BINGO</h1>
        </div>

        {/* Buttons */}
        <div className="space-y-4">
          <button
            onClick={onViewCartela}
            className="w-full py-4 px-8 bg-red-600 hover:bg-red-700 rounded-lg font-medium text-white text-lg transition-colors shadow-lg"
          >
            View Cartela
          </button>

          <button
            onClick={onCreateNewGame}
            className="w-full py-4 px-8 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium text-white text-lg transition-colors shadow-lg"
          >
            Create New Game
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewAccountPage;
