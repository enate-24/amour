// Offline Game State Manager
// Stores game state in IndexedDB for offline autocall continuation

interface GameState {
  gameId: string;
  calledNumbers: number[];
  numberSequence: number[]; // Pre-fetched sequence from API
  currentIndex: number; // Current position in sequence
  lastUpdated: number;
  gameData: any;
}

class OfflineGameStateManager {
  private dbName = 'BingoOfflineDB';
  private storeName = 'gameState';
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ IndexedDB initialized for offline game state');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'gameId' });
          console.log('✅ Created IndexedDB object store for game state');
        }
      };
    });
  }

  async saveGameState(gameState: GameState): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(gameState);

      request.onsuccess = () => {
        console.log('💾 Game state saved to IndexedDB:', {
          gameId: gameState.gameId,
          calledCount: gameState.calledNumbers.length,
          sequenceLength: gameState.numberSequence.length
        });
        resolve();
      };

      request.onerror = () => {
        console.error('Failed to save game state:', request.error);
        reject(request.error);
      };
    });
  }

  async getGameState(gameId: string): Promise<GameState | null> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(gameId);

      request.onsuccess = () => {
        const result = request.result as GameState | undefined;
        if (result) {
          console.log('📥 Game state loaded from IndexedDB:', {
            gameId: result.gameId,
            calledCount: result.calledNumbers.length,
            sequenceLength: result.numberSequence.length
          });
        }
        resolve(result || null);
      };

      request.onerror = () => {
        console.error('Failed to get game state:', request.error);
        reject(request.error);
      };
    });
  }

  async deleteGameState(gameId: string): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(gameId);

      request.onsuccess = () => {
        console.log('🗑️ Game state deleted from IndexedDB:', gameId);
        resolve();
      };

      request.onerror = () => {
        console.error('Failed to delete game state:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get next number from the pre-fetched sequence
   */
  async getNextNumber(gameId: string): Promise<number | null> {
    const state = await this.getGameState(gameId);
    
    if (!state) {
      console.error('❌ No game state found');
      return null;
    }

    // Check if we have more numbers in the sequence
    if (state.currentIndex >= state.numberSequence.length) {
      console.warn('⚠️ No more numbers in sequence');
      return null;
    }

    // Get next number from sequence
    const nextNumber = state.numberSequence[state.currentIndex];

    // Update state
    state.calledNumbers.push(nextNumber);
    state.currentIndex++;
    state.lastUpdated = Date.now();

    await this.saveGameState(state);

    console.log(`📥 Got number ${nextNumber} from IndexedDB (${state.currentIndex}/${state.numberSequence.length})`);
    return nextNumber;
  }

  /**
   * Initialize game state with empty sequence (will be fetched from API)
   */
  async initializeGameState(gameId: string, gameData: any, alreadyCalled: number[] = []): Promise<void> {
    const gameState: GameState = {
      gameId,
      calledNumbers: [...alreadyCalled],
      numberSequence: [], // Will be populated by API
      currentIndex: 0,
      lastUpdated: Date.now(),
      gameData
    };

    await this.saveGameState(gameState);
    console.log('🎮 Game state initialized in IndexedDB:', {
      gameId,
      calledCount: alreadyCalled.length,
      sequenceLength: 0
    });
  }

  /**
   * Update the number sequence from API
   */
  async updateNumberSequence(gameId: string, sequence: number[]): Promise<void> {
    const state = await this.getGameState(gameId);
    
    if (!state) {
      console.warn('⚠️ Cannot update sequence - game state not found');
      return;
    }

    state.numberSequence = sequence;
    state.lastUpdated = Date.now();
    
    await this.saveGameState(state);
    console.log(`✅ Updated number sequence in IndexedDB: ${sequence.length} numbers`);
  }

  /**
   * Add numbers to the sequence (for incremental updates)
   */
  async appendToSequence(gameId: string, newNumbers: number[]): Promise<void> {
    const state = await this.getGameState(gameId);
    
    if (!state) {
      console.warn('⚠️ Cannot append to sequence - game state not found');
      return;
    }

    // Add only numbers that aren't already in the sequence
    const uniqueNewNumbers = newNumbers.filter(n => !state.numberSequence.includes(n));
    
    if (uniqueNewNumbers.length > 0) {
      state.numberSequence.push(...uniqueNewNumbers);
      state.lastUpdated = Date.now();
      
      await this.saveGameState(state);
      console.log(`✅ Appended ${uniqueNewNumbers.length} numbers to sequence (total: ${state.numberSequence.length})`);
    }
  }

  /**
   * Sync called numbers from server
   */
  async syncCalledNumbers(gameId: string, serverCalledNumbers: number[]): Promise<void> {
    const state = await this.getGameState(gameId);
    
    if (!state) {
      console.warn('⚠️ Cannot sync - game state not found');
      return;
    }

    // Find new numbers called on server
    const newNumbers = serverCalledNumbers.filter(n => !state.calledNumbers.includes(n));
    
    if (newNumbers.length > 0) {
      console.log(`🔄 Syncing ${newNumbers.length} new numbers from server`);
      
      // Add to called numbers
      state.calledNumbers.push(...newNumbers);
      
      // Update current index to match called numbers
      state.currentIndex = state.calledNumbers.length;
      
      state.lastUpdated = Date.now();
      await this.saveGameState(state);
    }
  }

  /**
   * Get current sequence status
   */
  async getSequenceStatus(gameId: string): Promise<{
    hasSequence: boolean;
    sequenceLength: number;
    currentIndex: number;
    remaining: number;
  } | null> {
    const state = await this.getGameState(gameId);
    
    if (!state) {
      return null;
    }

    return {
      hasSequence: state.numberSequence.length > 0,
      sequenceLength: state.numberSequence.length,
      currentIndex: state.currentIndex,
      remaining: state.numberSequence.length - state.currentIndex
    };
  }
}

// Singleton instance
export const offlineGameState = new OfflineGameStateManager();
