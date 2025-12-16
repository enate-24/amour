// Offline Game Manager
// Handles game state and logic in offline mode

import { offlineStorage } from './offlineStorage';
import { networkStatusManager } from './networkStatus';
import { apiClient } from './offlineApiClient';

interface OfflineGameState {
  id: string;
  gameNumber: number;
  selectedCartelas: string[];
  betAmount: number;
  totalBet: number;
  houseCut: number;
  playerWin: number;
  calledNumbers: number[];
  numberSequence: number[];
  status: 'started' | 'playing' | 'finished';
  winnerPattern?: string;
  isWinner?: boolean;
  createdAt: string;
  userId: string;
  offlineCreated: boolean;
}

class OfflineGameManager {
  private currentGame: OfflineGameState | null = null;

  async initialize(): Promise<void> {
    await offlineStorage.initialize();
    console.log('🎮 Offline Game Manager initialized');
  }

  // Create new game (works offline)
  async createGame(gameData: {
    selectedCartelas: string[];
    betAmount: number;
    housePercentage: number;
    totalBet: number;
    houseCut: number;
    playerWin: number;
    userId: string;
  }): Promise<OfflineGameState> {
    
    const gameId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const gameNumber = await this.getNextGameNumber();
    
    // Generate number sequence for offline play
    const numberSequence = this.generateNumberSequence();
    
    const game: OfflineGameState = {
      id: gameId,
      gameNumber,
      selectedCartelas: gameData.selectedCartelas,
      betAmount: gameData.betAmount,
      totalBet: gameData.totalBet,
      houseCut: gameData.houseCut,
      playerWin: gameData.playerWin,
      calledNumbers: [],
      numberSequence,
      status: 'started',
      createdAt: new Date().toISOString(),
      userId: gameData.userId,
      offlineCreated: networkStatusManager.isOffline
    };

    // Store game locally
    await offlineStorage.storeGame(game);
    this.currentGame = game;

    // Try to sync with server if online
    if (networkStatusManager.isOnline) {
      try {
        await this.syncGameWithServer(game);
      } catch (error) {
        console.warn('Failed to sync game with server, will retry later:', error);
      }
    }

    console.log(`🎮 Game created: #${gameNumber} (${networkStatusManager.isOffline ? 'offline' : 'online'})`);
    return game;
  }

  // Get current game state
  getCurrentGame(): OfflineGameState | null {
    return this.currentGame;
  }

  // Load game from storage
  async loadGame(gameId: string): Promise<OfflineGameState | null> {
    const games = await offlineStorage.getGames();
    const game = games.find(g => g.id === gameId);
    
    if (game) {
      this.currentGame = game;
      return game;
    }
    
    return null;
  }

  // Update game state (call number, check winner, etc.)
  async updateGameState(updates: Partial<OfflineGameState>): Promise<void> {
    if (!this.currentGame) {
      throw new Error('No active game');
    }

    // Update local state
    this.currentGame = { ...this.currentGame, ...updates };
    
    // Store updated state
    await offlineStorage.storeGame(this.currentGame);

    // Try to sync if online
    if (networkStatusManager.isOnline) {
      try {
        await this.syncGameWithServer(this.currentGame);
      } catch (error) {
        console.warn('Failed to sync game update:', error);
      }
    }
  }

  // Call next number in sequence
  async callNextNumber(): Promise<number | null> {
    if (!this.currentGame || this.currentGame.status === 'finished') {
      return null;
    }

    const nextIndex = this.currentGame.calledNumbers.length;
    if (nextIndex >= this.currentGame.numberSequence.length) {
      return null; // No more numbers
    }

    const nextNumber = this.currentGame.numberSequence[nextIndex];
    const updatedCalledNumbers = [...this.currentGame.calledNumbers, nextNumber];

    await this.updateGameState({
      calledNumbers: updatedCalledNumbers,
      status: 'playing'
    });

    return nextNumber;
  }

  // Check for winner (offline pattern detection)
  async checkWinner(pattern: string): Promise<boolean> {
    if (!this.currentGame) return false;

    // Simple pattern detection (can be enhanced)
    const isWinner = this.detectWinningPattern(
      this.currentGame.selectedCartelas,
      this.currentGame.calledNumbers,
      pattern
    );

    if (isWinner) {
      await this.updateGameState({
        status: 'finished',
        isWinner: true,
        winnerPattern: pattern
      });
    }

    return isWinner;
  }

  // Get user's games (offline + online)
  async getUserGames(userId: string): Promise<OfflineGameState[]> {
    const offlineGames = await offlineStorage.getGames(userId);
    
    // Try to get online games if connected
    if (networkStatusManager.isOnline) {
      try {
        const response = await apiClient.get(`/games/user/${userId}`);
        const onlineGames = response.data;
        
        // Merge and deduplicate
        const allGames = [...offlineGames];
        for (const onlineGame of onlineGames) {
          if (!allGames.find(g => g.id === onlineGame.id)) {
            allGames.push(onlineGame);
          }
        }
        
        return allGames.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      } catch (error) {
        console.warn('Failed to fetch online games:', error);
      }
    }

    return offlineGames;
  }

  // Sync all offline games with server
  async syncAllGames(): Promise<void> {
    const games = await offlineStorage.getGames();
    const offlineGames = games.filter(g => g.offlineCreated);

    console.log(`🔄 Syncing ${offlineGames.length} offline games...`);

    for (const game of offlineGames) {
      try {
        await this.syncGameWithServer(game);
        
        // Mark as synced
        game.offlineCreated = false;
        await offlineStorage.storeGame(game);
        
        console.log(`✅ Synced game #${game.gameNumber}`);
      } catch (error) {
        console.error(`❌ Failed to sync game #${game.gameNumber}:`, error);
      }
    }
  }

  // Private helper methods
  private async getNextGameNumber(): Promise<number> {
    try {
      if (networkStatusManager.isOnline) {
        const response = await apiClient.get('/games/next-number');
        return response.data.nextGameNumber;
      }
    } catch (error) {
      console.warn('Failed to get next game number from server:', error);
    }

    // Fallback: use timestamp-based number
    return Date.now();
  }

  private generateNumberSequence(): number[] {
    const numbers = Array.from({ length: 75 }, (_, i) => i + 1);
    
    // Fisher-Yates shuffle
    for (let i = numbers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
    }
    
    return numbers;
  }

  private async syncGameWithServer(game: OfflineGameState): Promise<void> {
    const gameData = {
      selectedCartelas: game.selectedCartelas,
      betAmount: game.betAmount,
      housePercentage: (game.houseCut / game.totalBet) * 100,
      totalBet: game.totalBet,
      houseCut: game.houseCut,
      playerWin: game.playerWin,
      gameStartTime: game.createdAt
    };

    await apiClient.post('/games/session', gameData);
  }

  private detectWinningPattern(_cartelas: string[], calledNumbers: number[], pattern: string): boolean {
    // Simplified pattern detection - can be enhanced with actual cartela data
    // This is a placeholder implementation
    
    switch (pattern.toLowerCase()) {
      case 'one line':
        return calledNumbers.length >= 5;
      case 'two lines':
        return calledNumbers.length >= 10;
      case 'three lines':
        return calledNumbers.length >= 15;
      case 'full house':
        return calledNumbers.length >= 24;
      default:
        return false;
    }
  }
}

export const offlineGameManager = new OfflineGameManager();