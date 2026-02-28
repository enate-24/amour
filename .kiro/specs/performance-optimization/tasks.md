# Implementation Plan: Performance Optimization

## Overview

This implementation plan breaks down the performance optimization feature into discrete, actionable tasks. The tasks are organized by priority, with database optimization being the most critical (Priority 1). Each task builds on previous tasks and includes specific requirements references for traceability.

The implementation follows a phased approach:
1. **Phase 1**: Database optimization (indexes and query optimization)
2. **Phase 2**: Frontend optimization (pagination and audio batching)
3. **Phase 3**: Caching layer
4. **Phase 4**: WebSocket optimization

## Tasks

### Phase 1: Database Optimization (CRITICAL - Priority 1)

- [ ] 1. Create database migration system
  - [ ] 1.1 Implement migration manager class
    - Create `backend/migrations/MigrationManager.js`
    - Implement `runMigrations()`, `rollback()`, and `getMigrationStatus()` methods
    - Add migration tracking table to database
    - _Requirements: 1.1, 1.2_

  - [ ] 1.2 Create migration runner script
    - Create `backend/run-migrations.js` script
    - Add command-line interface for running migrations
    - Add dry-run mode for testing
    - _Requirements: 1.1_

  - [ ]* 1.3 Write unit tests for migration system
    - Test migration application and rollback
    - Test migration status tracking
    - Test error handling
    - _Requirements: 1.1_

- [ ] 2. Create and apply database index migrations
  - [ ] 2.1 Write index migration for games table
    - Create migration file `backend/migrations/001_add_games_indexes.js`
    - Add indexes: `idx_games_user_id`, `idx_games_status`, `idx_games_created_at`, `idx_games_user_status_date`
    - Use `CREATE INDEX CONCURRENTLY` to avoid table locks
    - _Requirements: 1.1.1_

  - [ ] 2.2 Write index migration for cartelas table
    - Create migration file `backend/migrations/002_add_cartelas_indexes.js`
    - Add indexes: `idx_cartelas_user_id`, `idx_cartelas_game_id`, `idx_cartelas_card_id`, `idx_cartelas_is_winner`
    - Use partial indexes with WHERE clauses
    - _Requirements: 1.1.1_

  - [ ] 2.3 Write index migration for daily_bonuses table
    - Create migration file `backend/migrations/003_add_bonuses_indexes.js`
    - Add indexes: `idx_daily_bonuses_user_date`, `idx_daily_bonuses_date_used`
    - _Requirements: 1.1.1_

  - [ ] 2.4 Write index migration for users table
    - Create migration file `backend/migrations/004_add_users_indexes.js`
    - Add indexes: `idx_users_username`, `idx_users_email`
    - Use partial indexes for active users only
    - _Requirements: 1.1.1_

  - [ ]* 2.5 Write property test for index creation
    - **Property 1: Query Performance Meets Thresholds**
    - **Validates: Requirements 1.1, 1.2**
    - Test that queries execute within specified time thresholds after indexes are added
    - _Requirements: 1.1.1_

- [ ] 3. Checkpoint - Verify index migrations
  - Run migrations on test database
  - Verify all indexes created successfully
  - Check query performance improvements
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Optimize database query operations
  - [ ] 4.1 Create optimized game operations module
    - Create `backend/data/optimizedGameOperations.js`
    - Implement `findByUserAndDateRange()` with WHERE clauses
    - Implement `findByUserAndStatus()` with pagination
    - Implement `getDailyStats()` with aggregate functions
    - _Requirements: 1.2.1, 1.2.2_

  - [ ] 4.2 Create optimized cartela operations module
    - Create `backend/data/optimizedCartelaOperations.js`
    - Implement `findByUserPaginated()` with LIMIT/OFFSET
    - Implement `findByGameId()` with WHERE clause
    - Use Promise.all() for parallel queries
    - _Requirements: 1.2.1, 1.2.2_

  - [ ] 4.3 Create optimized bonus operations module
    - Create `backend/data/optimizedBonusOperations.js`
    - Implement `findByUserAndDateRange()` with WHERE clauses
    - Implement `getUnusedBonuses()` with filtering
    - _Requirements: 1.2.1, 1.2.2_

  - [ ]* 4.4 Write property test for query optimization
    - **Property 6: Optimized Queries Return Correct Results**
    - **Validates: Requirements 1.2.1, 1.2.2**
    - Test that optimized queries return same results as unoptimized queries
    - Test that optimized queries are at least 50% faster
    - _Requirements: 1.2.1, 1.2.2_

- [ ] 5. Update API routes to use optimized queries
  - [ ] 5.1 Update games routes
    - Modify `backend/routes/games.js`
    - Replace `findAll()` calls with optimized queries
    - Add pagination support to game list endpoints
    - _Requirements: 1.2.1_

  - [ ] 5.2 Update cartelas routes
    - Modify `backend/routes/cartelas.js`
    - Replace `findAll()` calls with `findByUserPaginated()`
    - Update `/user-cartelas` endpoint to use optimized query
    - _Requirements: 1.2.1_

  - [ ] 5.3 Update dashboard routes
    - Modify dashboard endpoints to use `getDailyStats()`
    - Add date range filtering
    - Use aggregate queries for statistics
    - _Requirements: 1.2.1_

  - [ ]* 5.4 Write integration tests for optimized routes
    - Test that API endpoints return correct data
    - Test pagination parameters
    - Test error handling
    - _Requirements: 1.2.1, 1.2.2_

- [ ] 6. Checkpoint - Verify query optimization
  - Test all API endpoints with optimized queries
  - Measure query performance improvements
  - Verify data correctness
  - Ensure all tests pass, ask the user if questions arise.

### Phase 2: Frontend Optimization (Priority 2)

- [ ] 7. Implement cartela pagination
  - [ ] 7.1 Create pagination component
    - Create `src/components/Pagination.tsx`
    - Implement page navigation controls
    - Add page size selector
    - Show current page and total pages
    - _Requirements: 2.1.1, 2.1.2_

  - [ ] 7.2 Create paginated cartela list component
    - Create `src/components/PaginatedCartelaList.tsx`
    - Fetch cartelas with pagination parameters
    - Handle loading states
    - Integrate pagination component
    - _Requirements: 2.1.1, 2.1.2_

  - [ ] 7.3 Update cartela selection UI
    - Modify cartela selection components to use pagination
    - Set default page size to 50 cartelas
    - Add search/filter functionality
    - _Requirements: 2.1.1, 2.1.2_

  - [ ]* 7.4 Write property test for pagination
    - **Property 2: Pagination Returns Correct Data Subset**
    - **Validates: Requirements 2.2, 2.1.1, 2.1.2**
    - Test that pagination returns correct subset for any page/size
    - Test that total count is accurate
    - _Requirements: 2.1.1, 2.1.2_

- [ ] 8. Implement audio batch downloader
  - [ ] 8.1 Create optimized audio manager
    - Extend `src/utils/UnifiedAudioManager.ts`
    - Implement `downloadInBatches()` method
    - Add batch size configuration (default 10)
    - Implement priority file handling (numbers 1-20)
    - _Requirements: 2.2.1, 2.2.2_

  - [ ] 8.2 Update audio download UI
    - Modify `src/components/InitialDownloadModal.tsx`
    - Show batch download progress
    - Display priority files separately
    - Allow background downloading
    - _Requirements: 2.2.1, 2.2.2_

  - [ ] 8.3 Implement download progress tracking
    - Add progress callback to batch downloader
    - Update UI with download progress
    - Show which batch is currently downloading
    - _Requirements: 2.2.1_

  - [ ]* 8.4 Write property test for audio batch download
    - **Property 8: Audio Batch Download Completeness**
    - **Validates: Requirements 2.2.1, 2.2.2**
    - Test that all files are downloaded successfully
    - Test that priority files are downloaded first
    - _Requirements: 2.2.1, 2.2.2_

- [ ] 9. Implement code splitting
  - [ ] 9.1 Configure route-based code splitting
    - Update `vite.config.ts` with manual chunks configuration
    - Split by route: dashboard, game, analytics, admin
    - Configure chunk size limits
    - _Requirements: 2.3.1_

  - [ ] 9.2 Add lazy loading for routes
    - Update `src/App.tsx` to use React.lazy()
    - Add Suspense boundaries for lazy routes
    - Add loading fallbacks
    - _Requirements: 2.3.1_

  - [ ] 9.3 Optimize component imports
    - Use dynamic imports for large components
    - Split vendor bundles
    - Analyze bundle size
    - _Requirements: 2.3.1_

  - [ ]* 9.4 Write unit test for bundle size
    - Test that initial bundle size is reduced by at least 30%
    - Test that route chunks are created correctly
    - _Requirements: 2.3.1_

- [ ] 10. Checkpoint - Verify frontend optimizations
  - Test pagination with various page sizes
  - Test audio batch downloading
  - Verify code splitting reduces bundle size
  - Ensure all tests pass, ask the user if questions arise.

### Phase 3: Caching Strategy (Priority 3)

- [ ] 11. Implement response cache layer
  - [ ] 11.1 Create response cache class
    - Create `backend/utils/ResponseCache.js`
    - Implement cache storage with Map
    - Add TTL expiration logic
    - Implement cache size limits
    - _Requirements: 3.1.1, 3.1.2_

  - [ ] 11.2 Create cache middleware
    - Create `backend/middleware/cache.js`
    - Implement cache key generation
    - Add cache hit/miss logic
    - Implement response caching
    - _Requirements: 3.2.1_

  - [ ] 11.3 Add cache invalidation
    - Implement pattern-based invalidation
    - Add invalidation on data updates
    - Implement cache clear functionality
    - _Requirements: 3.1.2_

  - [ ]* 11.4 Write property test for cache correctness
    - **Property 9: Cache Correctness and Expiration**
    - **Validates: Requirements 3.1.1, 3.1.2, 3.2.1**
    - Test that cache returns correct data within TTL
    - Test that cache expires after TTL
    - _Requirements: 3.1.1, 3.1.2_

- [ ] 12. Apply caching to API routes
  - [ ] 12.1 Add caching to user profile endpoint
    - Apply cache middleware with 5-minute TTL
    - Invalidate on profile updates
    - _Requirements: 3.2.1_

  - [ ] 12.2 Add caching to dashboard stats endpoint
    - Apply cache middleware with 30-second TTL
    - Invalidate on game completion
    - _Requirements: 3.2.1_

  - [ ] 12.3 Add caching to cartela list endpoint
    - Apply cache middleware with cache until game starts
    - Invalidate on cartela assignment
    - _Requirements: 3.2.1_

  - [ ]* 12.4 Write integration tests for cached endpoints
    - Test cache hit rate
    - Test cache invalidation
    - Test that stale data is not served
    - _Requirements: 3.2.1_

- [ ] 13. Optimize IndexedDB usage
  - [ ] 13.1 Implement persistent IndexedDB connection
    - Modify audio manager to keep connection open
    - Add connection pooling
    - Implement proper transaction handling
    - _Requirements: 3.1.1_

  - [ ] 13.2 Add batch operations for IndexedDB
    - Implement batch write operations
    - Use transactions for multiple operations
    - Optimize read operations
    - _Requirements: 3.1.1_

  - [ ]* 13.3 Write unit tests for IndexedDB optimization
    - Test connection persistence
    - Test batch operations
    - Test transaction handling
    - _Requirements: 3.1.1_

- [ ] 14. Checkpoint - Verify caching implementation
  - Test cache hit rates
  - Verify TTL expiration
  - Test cache invalidation
  - Ensure all tests pass, ask the user if questions arise.

### Phase 4: WebSocket Optimization (Priority 4)

- [ ] 15. Implement WebSocket connection pool
  - [ ] 15.1 Create WebSocket pool manager
    - Create `backend/utils/WebSocketPool.js`
    - Implement connection tracking per user
    - Add channel subscription management
    - Implement connection cleanup
    - _Requirements: 4.1.1_

  - [ ] 15.2 Update WebSocket server
    - Modify `backend/websocket.js`
    - Use connection pool for all connections
    - Implement channel multiplexing
    - Add automatic reconnection handling
    - _Requirements: 4.1.1, 4.1.2_

  - [ ] 15.3 Update WebSocket client
    - Modify frontend WebSocket client
    - Use single connection per user
    - Implement channel subscription
    - Add reconnection logic
    - _Requirements: 4.1.1_

  - [ ]* 15.4 Write property test for WebSocket connections
    - **Property 10: Single WebSocket Connection Per User**
    - **Validates: Requirements 4.1.1, 4.1.2**
    - Test that only one connection exists per user
    - Test that channels are multiplexed correctly
    - _Requirements: 4.1.1, 4.1.2_

- [ ] 16. Implement connection pooling
  - [ ] 16.1 Add connection reuse logic
    - Reuse existing connections when available
    - Close idle connections after timeout
    - Monitor connection health
    - _Requirements: 4.1.2_

  - [ ] 16.2 Add resource monitoring
    - Track active connections
    - Monitor memory usage per connection
    - Log connection statistics
    - _Requirements: 4.1.2_

  - [ ]* 16.3 Write integration tests for connection pooling
    - Test connection reuse
    - Test connection cleanup
    - Test resource usage reduction
    - _Requirements: 4.1.2_

- [ ] 17. Checkpoint - Verify WebSocket optimization
  - Test single connection per user
  - Verify channel multiplexing
  - Measure resource usage reduction
  - Ensure all tests pass, ask the user if questions arise.

### Phase 5: Testing and Validation

- [ ] 18. Run comprehensive test suite
  - [ ] 18.1 Run all unit tests
    - Execute unit test suite
    - Fix any failing tests
    - Verify code coverage
    - _Requirements: All_

  - [ ] 18.2 Run all property tests
    - Execute property test suite with 100+ iterations
    - Verify all properties hold
    - Fix any property violations
    - _Requirements: All_

  - [ ] 18.3 Run integration tests
    - Test end-to-end workflows
    - Test database migrations
    - Test API endpoints
    - _Requirements: All_

- [ ] 19. Perform load testing and benchmarking
  - [ ] 19.1 Run database query benchmarks
    - Measure query execution time before and after
    - Test with various dataset sizes
    - Verify 80-90% improvement target
    - _Requirements: 1.1, 1.2_

  - [ ] 19.2 Run frontend rendering benchmarks
    - Measure cartela list rendering time
    - Test with various page sizes
    - Verify 70% improvement target
    - _Requirements: 2.1, 2.2_

  - [ ] 19.3 Run audio loading benchmarks
    - Measure total download time
    - Compare sequential vs. batch downloading
    - Verify 50% improvement target
    - _Requirements: 2.2_

  - [ ] 19.4 Run WebSocket resource benchmarks
    - Measure server memory and connection usage
    - Compare before and after optimization
    - Verify 30% reduction target
    - _Requirements: 4.1_

- [ ] 20. Validate performance improvements
  - [ ] 20.1 Verify dashboard load time < 1 second
    - Test with production-like data
    - Measure across multiple runs
    - _Requirements: 1.1_

  - [ ] 20.2 Verify game list load time < 500ms
    - Test with various user data sizes
    - Measure across multiple runs
    - _Requirements: 1.2_

  - [ ] 20.3 Verify game startup time < 3 seconds
    - Test with audio preloading
    - Verify UI remains responsive
    - _Requirements: 3.1, 3.2_

  - [ ] 20.4 Verify number calling < 100ms
    - Test during active game
    - Measure from trigger to audio playback
    - _Requirements: 3.3_

- [ ] 21. Final checkpoint - Complete validation
  - All tests passing
  - All performance targets met
  - No regressions introduced
  - Documentation complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional property-based tests and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties with 100+ iterations
- Unit tests validate specific examples and edge cases
- Database migrations use `CREATE INDEX CONCURRENTLY` to avoid table locks
- All optimizations maintain backward compatibility
- Performance benchmarks verify optimization targets are met

## Success Criteria

- ✅ All database indexes created successfully
- ✅ Query execution time reduced by 80-90%
- ✅ Dashboard loads in < 1 second
- ✅ Game list loads in < 500ms
- ✅ Cartela rendering improved by 70%
- ✅ Audio loading improved by 50%
- ✅ Server resource usage reduced by 30%
- ✅ All tests passing
- ✅ No data loss or corruption
- ✅ No breaking changes to existing functionality
