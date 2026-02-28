# Performance Optimization - Requirements

## Feature Name
performance-optimization

## Overview
Comprehensive performance optimization for the Bingo game system based on identified bottlenecks. The system currently loads ALL games and cartelas into memory before filtering, causing significant performance degradation as data grows.

## Problem Statement
Current system performance issues:
1. **Database queries load ALL records** then filter in memory (O(n) complexity)
2. **No database indexes** on frequently queried columns
3. **Cartela loading** renders 2000+ buttons at once without pagination
4. **Audio downloads** happen sequentially (75+ files)
5. **Multiple WebSocket connections** per user
6. **IndexedDB** opened/closed repeatedly

Expected improvements: **80-90% faster** with database optimization alone.

## User Stories

### 1. As a user, I want games to load instantly
**Acceptance Criteria:**
- Dashboard loads in < 1 second
- Game list loads in < 500ms
- No visible lag when switching pages

### 2. As a user, I want smooth cartela selection
**Acceptance Criteria:**
- Cartela list renders without lag
- Pagination works smoothly
- Search/filter is instant

### 3. As a user, I want fast game startup
**Acceptance Criteria:**
- Game starts in < 3 seconds
- Audio preloading doesn't block UI
- Number calling is instant

### 4. As an admin, I want fast analytics
**Acceptance Criteria:**
- Game analytics loads in < 2 seconds
- Dashboard stats update in < 1 second
- Reports generate quickly

## Technical Requirements

### 1. Database Optimization (CRITICAL - Priority 1)

#### 1.1 Add Database Indexes
**Tables to index:**
- `games`: `user_id`, `status`, `created_at`, `game_number`
- `cartelas`: `game_id`, `user_id`, `is_winner`
- `daily_bonuses`: `user_id`, `bonus_date`, `bonus_used`
- `users`: `username`, `email`

**Expected Impact:** 80-90% query speed improvement

#### 1.2 Optimize Queries with WHERE Clauses
**Current Problem:**
```javascript
// BAD: Loads ALL games then filters
const allGames = await games.findAll();
const todayGames = allGames.filter(game => game.date === today);
```

**Solution:**
```javascript
// GOOD: Filters in database
const todayGames = await games.findByDateAndUser(today, userId);
```

**Queries to optimize:**
- Dashboard daily/weekly/monthly stats
- Game list by user
- Bonus calculations
- Analytics queries

#### 1.3 Add Composite Indexes
**For common query patterns:**
- `(user_id, created_at)` on games
- `(user_id, bonus_date)` on daily_bonuses
- `(game_id, is_winner)` on cartelas

### 2. Frontend Optimization (Priority 2)

#### 2.1 Cartela Pagination
**Current:** Renders 2000 cartelas at once
**Solution:** 
- Show 50 cartelas per page
- Virtual scrolling for large lists
- Lazy load images/data

#### 2.2 Audio Optimization
**Current:** Downloads 75+ files sequentially
**Solution:**
- Batch download (10 files at a time)
- Prioritize first 20 numbers
- Background download remaining
- Cache in IndexedDB

#### 2.3 Code Splitting
**Split by route:**
- Dashboard chunk
- Game chunk
- Analytics chunk
- Admin chunk

### 3. Caching Strategy (Priority 3)

#### 3.1 IndexedDB Optimization
**Current:** Opens/closes repeatedly
**Solution:**
- Keep connection open
- Batch operations
- Use transactions properly

#### 3.2 API Response Caching
**Cache:**
- User profile (5 minutes)
- Cartela list (until game starts)
- Dashboard stats (30 seconds)

### 4. WebSocket Optimization (Priority 4)

#### 4.1 Connection Pooling
**Current:** Multiple connections per user
**Solution:**
- Single connection per user
- Multiplexed channels
- Automatic reconnection

## Non-Functional Requirements

### Performance Targets
- Dashboard load: < 1 second
- Game list: < 500ms
- Game start: < 3 seconds
- Number call: < 100ms
- Analytics: < 2 seconds

### Scalability
- Support 100+ concurrent users
- Handle 10,000+ games in database
- Maintain performance with 50,000+ cartelas

### Compatibility
- Works on existing database schema
- Backward compatible with current API
- No breaking changes to frontend

## Out of Scope
- Complete database redesign
- Migration to different database
- Rewrite of entire frontend
- Change of tech stack

## Dependencies
- PostgreSQL database (existing)
- Node.js backend (existing)
- React frontend (existing)
- IndexedDB support in browser

## Success Metrics
- 80% reduction in dashboard load time
- 90% reduction in query execution time
- 50% reduction in audio load time
- 70% reduction in cartela render time
- Zero performance regressions

## Timeline Estimate
- Phase 1 (Database): 2-3 days
- Phase 2 (Frontend): 2-3 days
- Phase 3 (Caching): 1-2 days
- Phase 4 (WebSocket): 1 day
- Testing & Optimization: 2 days

**Total: 8-11 days**
