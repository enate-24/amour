// IndexedDB manager for game sessions
class GameSessionDB {
  private dbName = 'BingoGameDB';
  private version = 1;
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ GameSessionDB initialized');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create game sessions store
        if (!db.objectStoreNames.contains('gameSessions')) {
          const store = db.createObjectStore('gameSessions', { keyPath: 'id' });
          store.createIndex('userId', 'userId', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          console.log('✅ Created gameSessions object store');
        }
      };
    });
  }

  async saveGameSession(gameData: any): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['gameSessions'], 'readwrite');
      const store = transaction.objectStore('gameSessions');
      
      const sessionData = {
        id: gameData.gameId,
        ...gameData,
        timestamp: Date.now()
      };

      const request = store.put(sessionData);

      request.onsuccess = () => {
        console.log('✅ Game session saved to IndexedDB:', sessionData.id);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getActiveGameSession(userId: string): Promise<any | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['gameSessions'], 'readonly');
      const store = transaction.objectStore('gameSessions');
      const index = store.index('userId');
      const request = index.openCursor(IDBKeyRange.only(userId), 'prev');

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const session = cursor.value;
          // Check if session is recent (within 10 minutes)
          const age = Date.now() - session.timestamp;
          if (age < 10 * 60 * 1000) {
            console.log('✅ Found active game session:', session.id);
            resolve(session);
          } else {
            console.log('⚠️ Game session too old, ignoring');
            resolve(null);
          }
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async updateGameSession(gameId: string, updates: any): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['gameSessions'], 'readwrite');
      const store = transaction.objectStore('gameSessions');
      const request = store.get(gameId);

      request.onsuccess = () => {
        const session = request.result;
        if (session) {
          const updatedSession = { ...session, ...updates };
          const updateRequest = store.put(updatedSession);
          updateRequest.onsuccess = () => {
            console.log('✅ Game session updated:', gameId);
            resolve();
          };
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          reject(new Error('Game session not found'));
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteGameSession(gameId: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['gameSessions'], 'readwrite');
      const store = transaction.objectStore('gameSessions');
      const request = store.delete(gameId);

      request.onsuccess = () => {
        console.log('✅ Game session deleted:', gameId);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async clearOldSessions(maxAge: number = 24 * 60 * 60 * 1000): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['gameSessions'], 'readwrite');
      const store = transaction.objectStore('gameSessions');
      const index = store.index('timestamp');
      const cutoff = Date.now() - maxAge;
      const request = index.openCursor(IDBKeyRange.upperBound(cutoff));

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          console.log('✅ Old game sessions cleared');
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  }
}

export const gameSessionDB = new GameSessionDB();
