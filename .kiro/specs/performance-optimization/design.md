# Performance Optimization - Design Document

## Overview

This design document outlines comprehensive performance optimizations for the Bingo game system. The current system suffers from critical performance bottlenecks that cause significant degradation as data grows. The primary issue is that database queries load ALL records into memory before filtering, resulting in O(n) complexity for operations that should be O(1) or O(log n).

### Current Performance Issues

1. **Database Anti-Pattern**: Queries use `findAll()` then filter in JavaScript
   - Example: Loading 10,000+ games to find today's games
   - Example: Loading all cartelas to find user's cartelas
   - Result: Linear time complexity instead of constant/logarithmic

2. **Missing Database Indexes**: No indexes on frequently queried columns
   - Queries scan entire tables for every operation
   - No composite indexes for common query patterns

3. **Frontend Rendering**: Rendering 2000+ cartelas at once
   - Blocks UI thread
   - Causes browser lag and freezing

4. **Audio Loading**: Sequential download of 75+ audio files
   - Blocks game startup
   - No prioritization of critical files

5. **WebSocket Connections**: Multiple connections per user
   - Wastes server resources
   - Increases latency

### Expected Performance Improvements

- **80-90% faster** database queries with indexes and WHERE clauses
- **70% faster** cartela rendering with pagination
- **50% faster** audio loading with batching
- **30% reduction** in server resource usage

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend Layer                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Pagination  │  │ Audio Batch  │  │ Code Split   │      │
│  │  Component   │  │  Downloader  │  │  Routes      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Layer                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Response    │  │  WebSocket   │  │  Query       │      │
│  │  Cache       │  │  Pool        │  │  Optimizer   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Database Layer                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Indexes     │  │  Optimized   │  │  Connection  │      │
│  │  (B-tree)    │  │  Queries     │  │  Pool        │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### Optimization Layers

1. **Database Layer** (Priority 1 - CRITICAL)
   - Add B-tree indexes on frequently queried columns
   - Rewrite queries to use WHERE clauses
   - Add composite indexes for multi-column queries
   - Optimize connection pool settings

2. **API Layer** (Priority 2)
   - Implement response caching with TTL
   - Consolidate WebSocket connections
   - Add query result pagination

3. **Frontend Layer** (Priority 3)
   - Implement cartela pagination (50 per page)
   - Batch audio downloads (10 concurrent)
   - Code split by route
   - Optimize IndexedDB usage

---

## Components and Interfaces

### 1. Database Migration System

#### Migration Manager

```typescript
interface Migration {
  id: string;
  name: string;
  up: (pool: Pool) => Promise<void>;
  down: (pool: Pool) => Promise<void>;
}

class MigrationManager {
  async runMigrations(): Promise<void>;
  async rollback(migrationId: string): Promise<void>;
  async getMigrationStatus(): Promise<MigrationStatus[]>;
}
```

#### Index Migration

```sql
-- Migration: add_performance_indexes_v1

-- Games table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_games_user_id 
  ON games(user_id) WHERE status != 'finished';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_games_status 
  ON games(status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_games_created_at 
  ON games(created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_games_user_status_date 
  ON games(user_id, status, created_at DESC);

-- Cartelas table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cartelas_user_id 
  ON cartelas(user_id) WHERE is_active = 1;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cartelas_game_id 
  ON cartelas(game_id) WHERE is_active = 1;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cartelas_card_id 
  ON cartelas(card_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cartelas_is_winner 
  ON cartelas(game_id, is_winner) WHERE is_active = 1;

-- Daily bonuses table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_daily_bonuses_user_date 
  ON daily_bonuses(user_id, bonus_date DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_daily_bonuses_date_used 
  ON daily_bonuses(bonus_date, bonus_used);

-- Users table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_username 
  ON users(username) WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email 
  ON users(email) WHERE is_active = true;
```

**Key Design Decisions:**
- Use `CREATE INDEX CONCURRENTLY` to avoid locking tables during migration
- Add partial indexes with WHERE clauses to reduce index size
- Create composite indexes for common multi-column queries
- Index in DESC order for created_at columns (most recent first)

### 2. Query Optimizer

#### Optimized Database Operations

```typescript
interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
  filters?: Record<string, any>;
}

class OptimizedGameOperations {
  // BEFORE: Load all games then filter
  // async findAll() { return all('SELECT * FROM games') }
  
  // AFTER: Filter in database
  async findByUserAndDateRange(
    userId: string, 
    startDate: Date, 
    endDate: Date,
    options?: QueryOptions
  ): Promise<Game[]> {
    const query = `
      SELECT * FROM games 
      WHERE user_id = $1 
        AND created_at >= $2 
        AND created_at <= $3
      ORDER BY created_at DESC
      LIMIT $4 OFFSET $5
    `;
    return all(query, [
      userId, 
      startDate, 
      endDate, 
      options?.limit || 100,
      options?.offset || 0
    ]);
  }

  async findByUserAndStatus(
    userId: string,
    status: string,
    options?: QueryOptions
  ): Promise<Game[]> {
    const query = `
      SELECT * FROM games 
      WHERE user_id = $1 AND status = $2
      ORDER BY created_at DESC
      LIMIT $3 OFFSET $4
    `;
    return all(query, [
      userId,
      status,
      options?.limit || 100,
      options?.offset || 0
    ]);
  }

  async getDailyStats(userId: string, date: Date): Promise<DailyStats> {
    const query = `
      SELECT 
        COUNT(*) as total_games,
        SUM(bet_money * cartelas_selected) as total_bets,
        SUM(CASE WHEN status = 'finished' THEN win_money ELSE 0 END) as total_winnings,
        SUM(CASE WHEN status = 'finished' 
          THEN (bet_money * cartelas_selected * house_cut_percentage / 100) 
          ELSE 0 END) as house_profit
      FROM games
      WHERE user_id = $1
        AND DATE(created_at) = DATE($2)
    `;
    return get(query, [userId, date]);
  }
}

class OptimizedCartelaOperations {
  // BEFORE: Load all cartelas then filter
  // async findAll() { return all('SELECT * FROM cartelas') }
  
  // AFTER: Paginated query with filters
  async findByUserPaginated(
    userId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<PaginatedResult<Cartela>> {
    const offset = (page - 1) * limit;
    
    const [countResult, cartelas] = await Promise.all([
      get('SELECT COUNT(*) as total FROM cartelas WHERE user_id = $1 AND is_active = 1', [userId]),
      all(`
        SELECT id, card_id, user_id, game_id, numbers, is_winner, purchased_at
        FROM cartelas
        WHERE user_id = $1 AND is_active = 1
        ORDER BY CAST(card_id AS INTEGER)
        LIMIT $2 OFFSET $3
      `, [userId, limit, offset])
    ]);

    return {
      data: cartelas,
      total: countResult.total,
      page,
      limit,
      totalPages: Math.ceil(countResult.total / limit)
    };
  }

  async findByGameId(gameId: string): Promise<Cartela[]> {
    return all(`
      SELECT * FROM cartelas
      WHERE game_id = $1 AND is_active = 1
    `, [gameId]);
  }
}

class OptimizedBonusOperations {
  // BEFORE: Load all bonuses then filter
  // AFTER: Query specific date range
  async findByUserAndDateRange(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<DailyBonus[]> {
    return all(`
      SELECT * FROM daily_bonuses
      WHERE user_id = $1
        AND bonus_date >= $2
        AND bonus_date <= $3
      ORDER BY bonus_date DESC
    `, [userId, startDate, endDate]);
  }

  async getUnusedBonuses(userId: string): Promise<DailyBonus[]> {
    return all(`
      SELECT * FROM daily_bonuses
      WHERE user_id = $1
        AND bonus_used = false
        AND requirements_met = true
      ORDER BY bonus_date DESC
    `, [userId]);
  }
}
```

**Key Design Decisions:**
- Always use WHERE clauses to filter in database
- Use LIMIT and OFFSET for pagination
- Use Promise.all() for parallel queries
- Return only needed columns (avoid SELECT *)
- Use aggregate functions (COUNT, SUM) in database

### 3. Frontend Pagination Component

#### Cartela Pagination

```typescript
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  itemsPerPage: number;
  totalItems: number;
}

interface CartelaListProps {
  userId: string;
  gameId?: string;
  pageSize?: number;
}

const CartelaList: React.FC<CartelaListProps> = ({ 
  userId, 
  gameId, 
  pageSize = 50 
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [cartelas, setCartelas] = useState<Cartela[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchCartelas = async (page: number) => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/cartelas/user-cartelas?page=${page}&limit=${pageSize}`
      );
      const data = await response.json();
      
      setCartelas(data.cartelas);
      setTotalPages(data.totalPages);
    } catch (error) {
      console.error('Failed to fetch cartelas:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCartelas(currentPage);
  }, [currentPage, userId]);

  return (
    <div>
      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          <CartelaGrid cartelas={cartelas} />
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            itemsPerPage={pageSize}
            totalItems={cartelas.length}
          />
        </>
      )}
    </div>
  );
};
```

### 4. Audio Batch Downloader

#### Optimized Audio Manager

```typescript
interface BatchDownloadConfig {
  batchSize: number;
  priorityNumbers: number[];
  onProgress?: (progress: number) => void;
}

class OptimizedAudioManager extends UnifiedAudioManager {
  async downloadInBatches(config: BatchDownloadConfig): Promise<void> {
    const { batchSize, priorityNumbers, onProgress } = config;
    
    // Phase 1: Download priority numbers first (1-20)
    const priorityFiles = priorityNumbers.map(n => this.getFileId(n));
    await this.downloadBatch(priorityFiles, onProgress);
    
    // Phase 2: Download remaining numbers in batches
    const allNumbers = Array.from({ length: 75 }, (_, i) => i + 1);
    const remainingNumbers = allNumbers.filter(n => !priorityNumbers.includes(n));
    
    for (let i = 0; i < remainingNumbers.length; i += batchSize) {
      const batch = remainingNumbers.slice(i, i + batchSize);
      const batchFiles = batch.map(n => this.getFileId(n));
      await this.downloadBatch(batchFiles, onProgress);
    }
  }

  private async downloadBatch(
    fileIds: string[], 
    onProgress?: (progress: number) => void
  ): Promise<void> {
    const promises = fileIds.map(fileId => 
      this.downloadFile(fileId).catch(err => {
        console.warn(`Failed to download ${fileId}:`, err);
        return null; // Continue with other downloads
      })
    );
    
    await Promise.all(promises);
    
    if (onProgress) {
      const progress = (fileIds.length / 75) * 100;
      onProgress(progress);
    }
  }

  private getFileId(number: number): string {
    const voiceCategory = this.getVoiceCategory();
    return `${voiceCategory}/${number}`;
  }
}
```

**Key Design Decisions:**
- Download in batches of 10 concurrent requests
- Prioritize first 20 numbers (most commonly called)
- Continue on individual file failures
- Report progress for UI feedback
- Use existing IndexedDB caching

### 5. Response Cache Layer

#### API Response Cache

```typescript
interface CacheConfig {
  ttl: number; // Time to live in milliseconds
  maxSize: number; // Maximum cache entries
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class ResponseCache {
  private cache: Map<string, CacheEntry<any>>;
  private config: CacheConfig;

  constructor(config: CacheConfig) {
    this.cache = new Map();
    this.config = config;
  }

  set<T>(key: string, data: T, ttl?: number): void {
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.config.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.config.ttl
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    // Check if entry has expired
    const age = Date.now() - entry.timestamp;
    if (age > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }

  invalidate(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

// Cache middleware for Express
const cacheMiddleware = (cache: ResponseCache, ttl?: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${req.method}:${req.originalUrl}`;
    const cached = cache.get(key);
    
    if (cached) {
      return res.json(cached);
    }
    
    // Override res.json to cache response
    const originalJson = res.json.bind(res);
    res.json = (data: any) => {
      cache.set(key, data, ttl);
      return originalJson(data);
    };
    
    next();
  };
};

// Usage in routes
const cache = new ResponseCache({ ttl: 30000, maxSize: 1000 });

// Cache user profile for 5 minutes
router.get('/api/users/profile', 
  cacheMiddleware(cache, 300000), 
  getUserProfile
);

// Cache dashboard stats for 30 seconds
router.get('/api/dashboard/stats', 
  cacheMiddleware(cache, 30000), 
  getDashboardStats
);
```

### 6. WebSocket Connection Pool

#### Optimized WebSocket Manager

```typescript
interface WebSocketPool {
  connections: Map<string, WebSocket>;
  channels: Map<string, Set<string>>; // channelId -> userIds
}

class OptimizedWebSocketManager {
  private pool: WebSocketPool;

  constructor() {
    this.pool = {
      connections: new Map(),
      channels: new Map()
    };
  }

  // Single connection per user
  getOrCreateConnection(userId: string): WebSocket {
    let connection = this.pool.connections.get(userId);
    
    if (!connection || connection.readyState !== WebSocket.OPEN) {
      connection = this.createConnection(userId);
      this.pool.connections.set(userId, connection);
    }
    
    return connection;
  }

  // Subscribe user to channel (game room, notifications, etc.)
  subscribe(userId: string, channelId: string): void {
    const connection = this.getOrCreateConnection(userId);
    
    if (!this.pool.channels.has(channelId)) {
      this.pool.channels.set(channelId, new Set());
    }
    
    this.pool.channels.get(channelId)!.add(userId);
    
    // Send subscription message
    connection.send(JSON.stringify({
      type: 'subscribe',
      channel: channelId
    }));
  }

  // Broadcast to all users in a channel
  broadcast(channelId: string, message: any): void {
    const userIds = this.pool.channels.get(channelId);
    
    if (!userIds) return;
    
    for (const userId of userIds) {
      const connection = this.pool.connections.get(userId);
      if (connection && connection.readyState === WebSocket.OPEN) {
        connection.send(JSON.stringify(message));
      }
    }
  }

  // Clean up closed connections
  cleanup(): void {
    for (const [userId, connection] of this.pool.connections) {
      if (connection.readyState === WebSocket.CLOSED) {
        this.pool.connections.delete(userId);
        
        // Remove from all channels
        for (const userIds of this.pool.channels.values()) {
          userIds.delete(userId);
        }
      }
    }
  }

  private createConnection(userId: string): WebSocket {
    const ws = new WebSocket(`${WS_URL}?userId=${userId}`);
    
    ws.on('close', () => {
      this.pool.connections.delete(userId);
    });
    
    ws.on('error', (error) => {
      console.error(`WebSocket error for user ${userId}:`, error);
      this.pool.connections.delete(userId);
    });
    
    return ws;
  }
}
```

---

## Data Models

### Optimized Query Results

```typescript
interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

interface DailyStats {
  total_games: number;
  total_bets: number;
  total_winnings: number;
  house_profit: number;
  date: Date;
}

interface CacheStatus {
  size: number;
  maxSize: number;
  hitRate: number;
  entries: number;
}

interface MigrationStatus {
  id: string;
  name: string;
  appliedAt: Date | null;
  status: 'pending' | 'applied' | 'failed';
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: Query Performance Meets Thresholds
*For any* database query operation (dashboard load, game list, stats), when executed with optimized indexes and WHERE clauses, the query execution time should be within the specified threshold for that operation type (dashboard < 1s, game list < 500ms, analytics < 2s, stats < 1s).

**Validates: Requirements 1.1, 1.2, 4.1, 4.2**

### Property 2: Pagination Returns Correct Data Subset
*For any* page number and page size, pagination should return exactly the correct subset of data, with accurate total count, and the union of all pages should equal the complete dataset without duplicates or omissions.

**Validates: Requirements 2.2, 2.1.1, 2.1.2**

### Property 3: Search and Filter Performance
*For any* search or filter query, the operation should complete in under 100ms and return results that match the filter criteria exactly.

**Validates: Requirements 2.3**

### Property 4: Game Startup Performance
*For any* game initialization, the startup process (including audio preloading) should complete in under 3 seconds without blocking the UI thread.

**Validates: Requirements 3.1, 3.2**

### Property 5: Number Calling Responsiveness
*For any* number calling operation during an active game, the operation should complete in under 100ms from trigger to audio playback start.

**Validates: Requirements 3.3**

### Property 6: Optimized Queries Return Correct Results
*For any* database query that has been optimized (using WHERE clauses and indexes instead of loading all data), the optimized query should return exactly the same results as the original unoptimized query, but execute significantly faster (at least 50% improvement).

**Validates: Requirements 1.2.1, 1.2.2**

### Property 7: Composite Index Performance Improvement
*For any* multi-column query that uses a composite index, the query execution time should be at least 50% faster than the same query without the composite index.

**Validates: Requirements 1.3.1**

### Property 8: Audio Batch Download Completeness
*For any* set of audio files to be downloaded, the batch download process should successfully download all files (or report specific failures), and priority files (numbers 1-20) should be downloaded before non-priority files.

**Validates: Requirements 2.2.1, 2.2.2**

### Property 9: Cache Correctness and Expiration
*For any* cached query result, the cached data should match the fresh query result exactly when within TTL, and should be invalidated and refetched after TTL expires.

**Validates: Requirements 3.1.1, 3.1.2, 3.2.1**

### Property 10: Single WebSocket Connection Per User
*For any* user, at most one active WebSocket connection should exist at any given time, and all communication channels should be multiplexed over this single connection.

**Validates: Requirements 4.1.1, 4.1.2**

---

## Error Handling

### Database Migration Errors

1. **Migration Failure**
   - Rollback to previous state
   - Log detailed error information
   - Notify administrators
   - Prevent application startup if critical migrations fail

2. **Index Creation Failure**
   - Use `CREATE INDEX CONCURRENTLY` to avoid table locks
   - Retry with exponential backoff
   - Continue with other indexes if one fails
   - Log warnings for failed indexes

3. **Query Timeout**
   - Set reasonable timeout limits (30s for complex queries)
   - Implement retry logic with exponential backoff
   - Fall back to cached data if available
   - Return partial results with warning

### Frontend Errors

1. **Pagination Errors**
   - Handle out-of-range page numbers gracefully
   - Show error message for failed data fetches
   - Retry failed requests automatically
   - Cache last successful page

2. **Audio Download Errors**
   - Continue downloading other files if one fails
   - Retry failed downloads up to 3 times
   - Fall back to silent mode if critical files fail
   - Show user-friendly error messages

3. **Cache Errors**
   - Fall back to fresh queries if cache fails
   - Clear corrupted cache entries
   - Log cache errors for monitoring
   - Don't block user operations

### WebSocket Errors

1. **Connection Failures**
   - Implement automatic reconnection with exponential backoff
   - Queue messages during disconnection
   - Notify user of connection status
   - Fall back to polling if WebSocket unavailable

2. **Message Delivery Failures**
   - Implement message acknowledgment
   - Retry failed messages up to 3 times
   - Log failed messages for debugging
   - Notify user of critical failures

---

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests for comprehensive coverage:

- **Unit tests**: Verify specific examples, edge cases, and error conditions
- **Property tests**: Verify universal properties across all inputs
- Both are complementary and necessary

### Unit Testing

Unit tests should focus on:

1. **Database Migration Tests**
   - Test each migration can be applied successfully
   - Test rollback functionality
   - Test migration status tracking
   - Test concurrent index creation

2. **Query Optimization Tests**
   - Test specific query examples return correct results
   - Test edge cases (empty results, large datasets)
   - Test error handling (timeouts, connection failures)
   - Test pagination boundary conditions

3. **Cache Tests**
   - Test cache hit/miss scenarios
   - Test TTL expiration
   - Test cache invalidation
   - Test cache size limits

4. **WebSocket Tests**
   - Test connection establishment
   - Test message routing
   - Test reconnection logic
   - Test channel subscription/unsubscription

### Property-Based Testing

Property tests should verify universal correctness properties. Each test should run a minimum of 100 iterations.

**Testing Library**: Use `fast-check` for JavaScript/TypeScript property-based testing.

**Property Test Configuration**:
- Minimum 100 iterations per test
- Tag format: `Feature: performance-optimization, Property {number}: {property_text}`

**Example Property Test Structure**:

```typescript
import fc from 'fast-check';

describe('Performance Optimization Properties', () => {
  // Feature: performance-optimization, Property 2: Pagination Returns Correct Data Subset
  it('pagination returns correct data subset for any page and size', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 100 }), // page number
        fc.integer({ min: 10, max: 100 }), // page size
        async (page, pageSize) => {
          // Generate test data
          const totalItems = 500;
          const allData = generateTestCartelas(totalItems);
          
          // Get paginated result
          const result = await getCartelasPaginated(page, pageSize);
          
          // Verify correct subset
          const expectedStart = (page - 1) * pageSize;
          const expectedEnd = Math.min(expectedStart + pageSize, totalItems);
          const expectedData = allData.slice(expectedStart, expectedEnd);
          
          expect(result.data).toEqual(expectedData);
          expect(result.total).toBe(totalItems);
          expect(result.page).toBe(page);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: performance-optimization, Property 6: Optimized Queries Return Correct Results
  it('optimized queries return same results as unoptimized queries', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string(), // userId
        fc.date(), // startDate
        fc.date(), // endDate
        async (userId, startDate, endDate) => {
          // Ensure startDate <= endDate
          const [start, end] = startDate <= endDate 
            ? [startDate, endDate] 
            : [endDate, startDate];
          
          // Get results from both queries
          const optimizedResults = await findGamesByUserAndDateOptimized(
            userId, start, end
          );
          const unoptimizedResults = await findGamesByUserAndDateUnoptimized(
            userId, start, end
          );
          
          // Results should be identical
          expect(optimizedResults).toEqual(unoptimizedResults);
          
          // Optimized should be faster (measure in real implementation)
          // This is verified in performance benchmarks
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: performance-optimization, Property 9: Cache Correctness and Expiration
  it('cache returns correct data within TTL and expires after', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string(), // cache key
        fc.object(), // data to cache
        fc.integer({ min: 100, max: 5000 }), // TTL in ms
        async (key, data, ttl) => {
          const cache = new ResponseCache({ ttl: 10000, maxSize: 100 });
          
          // Set cache entry
          cache.set(key, data, ttl);
          
          // Should return data immediately
          expect(cache.get(key)).toEqual(data);
          
          // Should return data before TTL expires
          await sleep(ttl / 2);
          expect(cache.get(key)).toEqual(data);
          
          // Should return null after TTL expires
          await sleep(ttl / 2 + 100);
          expect(cache.get(key)).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Performance Benchmarking

In addition to correctness testing, performance benchmarks should be run to verify optimization goals:

1. **Database Query Benchmarks**
   - Measure query execution time before and after optimization
   - Test with various dataset sizes (100, 1000, 10000 records)
   - Verify 80-90% improvement target

2. **Frontend Rendering Benchmarks**
   - Measure time to render cartela list
   - Test with various page sizes
   - Verify 70% improvement target

3. **Audio Loading Benchmarks**
   - Measure total download time
   - Compare sequential vs. batch downloading
   - Verify 50% improvement target

4. **WebSocket Resource Benchmarks**
   - Measure server memory and connection usage
   - Compare before and after optimization
   - Verify 30% reduction target

### Integration Testing

Integration tests should verify:

1. **End-to-End Workflows**
   - User logs in → Dashboard loads quickly
   - User selects cartelas → Pagination works correctly
   - User starts game → Audio loads in background
   - Game progresses → Number calling is responsive

2. **Database Migration Integration**
   - Migrations run successfully on fresh database
   - Migrations run successfully on existing database
   - Application works correctly after migrations

3. **Cache Integration**
   - Cache works correctly with real API endpoints
   - Cache invalidation works on data updates
   - Cache doesn't serve stale data

---

## Performance Measurement Strategy

### Metrics to Track

1. **Database Metrics**
   - Query execution time (p50, p95, p99)
   - Number of queries per request
   - Index usage statistics
   - Connection pool utilization

2. **Frontend Metrics**
   - Time to First Contentful Paint (FCP)
   - Time to Interactive (TTI)
   - Page load time
   - Bundle size

3. **API Metrics**
   - Response time (p50, p95, p99)
   - Cache hit rate
   - Error rate
   - Throughput (requests/second)

4. **WebSocket Metrics**
   - Active connections
   - Message latency
   - Reconnection rate
   - Memory usage per connection

### Monitoring and Alerting

1. **Performance Degradation Alerts**
   - Alert if query time exceeds thresholds
   - Alert if cache hit rate drops below 70%
   - Alert if error rate exceeds 1%

2. **Resource Usage Alerts**
   - Alert if database connection pool is exhausted
   - Alert if memory usage exceeds limits
   - Alert if WebSocket connections exceed capacity

3. **Dashboard Metrics**
   - Real-time performance dashboard
   - Historical trend analysis
   - Comparison before/after optimization

---

## Implementation Phases

### Phase 1: Database Optimization (Priority 1 - CRITICAL)

**Duration**: 2-3 days

**Tasks**:
1. Create database migration system
2. Write and test index migrations
3. Rewrite queries to use WHERE clauses
4. Add composite indexes
5. Test query performance improvements
6. Deploy migrations to production

**Success Criteria**:
- All indexes created successfully
- Query execution time reduced by 80-90%
- No data corruption or loss
- Application remains functional

### Phase 2: Frontend Optimization (Priority 2)

**Duration**: 2-3 days

**Tasks**:
1. Implement cartela pagination component
2. Update API endpoints to support pagination
3. Implement audio batch downloader
4. Add code splitting by route
5. Test rendering performance
6. Deploy frontend changes

**Success Criteria**:
- Cartela list renders without lag
- Audio loads in background
- Initial bundle size reduced by 30%
- Page navigation is smooth

### Phase 3: Caching Strategy (Priority 3)

**Duration**: 1-2 days

**Tasks**:
1. Implement response cache layer
2. Add cache middleware to API routes
3. Optimize IndexedDB usage
4. Add cache invalidation logic
5. Test cache correctness
6. Deploy caching layer

**Success Criteria**:
- Cache hit rate > 70%
- Response time reduced by 50% for cached requests
- No stale data served
- Cache memory usage within limits

### Phase 4: WebSocket Optimization (Priority 4)

**Duration**: 1 day

**Tasks**:
1. Implement WebSocket connection pool
2. Add channel multiplexing
3. Update client to use single connection
4. Test connection stability
5. Deploy WebSocket changes

**Success Criteria**:
- One connection per user
- Server resource usage reduced by 30%
- Message delivery remains reliable
- Reconnection works correctly

### Phase 5: Testing and Validation (All Phases)

**Duration**: 2 days

**Tasks**:
1. Run comprehensive test suite
2. Perform load testing
3. Validate performance improvements
4. Fix any issues found
5. Document changes

**Success Criteria**:
- All tests pass
- Performance targets met
- No regressions introduced
- Documentation complete

---

## Rollback Strategy

### Database Migrations

1. **Automatic Rollback**
   - If migration fails, automatically rollback to previous state
   - Use database transactions where possible
   - Keep backup of schema before migration

2. **Manual Rollback**
   - Provide rollback scripts for each migration
   - Test rollback scripts before deployment
   - Document rollback procedure

### Code Deployments

1. **Feature Flags**
   - Use feature flags for major optimizations
   - Allow disabling optimizations without redeployment
   - Gradual rollout to subset of users

2. **Version Rollback**
   - Keep previous version deployed
   - Quick rollback if issues detected
   - Monitor error rates after deployment

---

## Security Considerations

### Database Security

1. **SQL Injection Prevention**
   - Use parameterized queries for all database operations
   - Validate and sanitize all user inputs
   - Use prepared statements

2. **Access Control**
   - Maintain existing authentication and authorization
   - Don't expose sensitive data in cached responses
   - Validate user permissions before returning data

### Cache Security

1. **Cache Poisoning Prevention**
   - Validate data before caching
   - Use secure cache keys
   - Implement cache entry validation

2. **Sensitive Data**
   - Don't cache sensitive user data (passwords, tokens)
   - Implement per-user cache isolation
   - Clear cache on logout

### WebSocket Security

1. **Authentication**
   - Authenticate WebSocket connections
   - Validate user identity on each message
   - Implement rate limiting

2. **Message Validation**
   - Validate all incoming messages
   - Sanitize message content
   - Prevent message injection attacks

---

## Backward Compatibility

### API Compatibility

1. **Existing Endpoints**
   - Maintain existing API endpoints
   - Add new optimized endpoints alongside old ones
   - Deprecate old endpoints gradually

2. **Response Format**
   - Keep response format consistent
   - Add new fields without removing old ones
   - Version API if breaking changes needed

### Database Compatibility

1. **Schema Changes**
   - Add indexes without changing schema
   - Maintain existing columns and tables
   - Use migrations for schema changes

2. **Data Migration**
   - No data migration needed for index additions
   - Test with existing production data
   - Verify data integrity after migrations

### Frontend Compatibility

1. **Progressive Enhancement**
   - Implement optimizations as enhancements
   - Fall back to old behavior if optimization fails
   - Support older browsers where possible

2. **Feature Detection**
   - Detect browser capabilities
   - Use polyfills where needed
   - Graceful degradation for unsupported features

---

## Success Metrics

### Performance Targets

- ✅ Dashboard load time: < 1 second (currently 5-10 seconds)
- ✅ Game list load time: < 500ms (currently 2-3 seconds)
- ✅ Cartela rendering: < 1 second for 50 cartelas (currently 5+ seconds for 2000)
- ✅ Audio loading: < 3 seconds for priority files (currently 30+ seconds for all)
- ✅ Query execution: 80-90% faster with indexes
- ✅ Cache hit rate: > 70%
- ✅ Server resource usage: 30% reduction

### Quality Targets

- ✅ Zero data loss or corruption
- ✅ Zero breaking changes to existing functionality
- ✅ All tests passing
- ✅ No performance regressions
- ✅ Error rate < 0.1%

### User Experience Targets

- ✅ No visible lag in UI
- ✅ Smooth page transitions
- ✅ Responsive interactions
- ✅ Fast game startup
- ✅ Reliable WebSocket connections

---

## Conclusion

This design document outlines a comprehensive performance optimization strategy for the Bingo game system. The optimizations are prioritized by impact, with database optimization being the most critical (80-90% improvement expected). The design maintains backward compatibility, includes robust error handling, and provides a clear testing strategy with both unit tests and property-based tests.

The implementation is divided into four phases, each with clear success criteria and rollback strategies. Performance metrics will be tracked throughout to validate improvements and detect any regressions.
