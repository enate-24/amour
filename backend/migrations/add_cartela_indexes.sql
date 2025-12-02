-- Add indexes to cartelas table for better query performance
-- These indexes will significantly speed up cartela loading

-- Index on is_active for filtering active cartelas
CREATE INDEX IF NOT EXISTS idx_cartelas_is_active ON cartelas(is_active);

-- Index on card_id for quick lookups
CREATE INDEX IF NOT EXISTS idx_cartelas_card_id ON cartelas(card_id);

-- Index on user_id for user-specific queries
CREATE INDEX IF NOT EXISTS idx_cartelas_user_id ON cartelas(user_id);

-- Index on game_id for game-specific queries
CREATE INDEX IF NOT EXISTS idx_cartelas_game_id ON cartelas(game_id);

-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_cartelas_active_purchased ON cartelas(is_active, purchased_at DESC);

-- Index on games table for status queries
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);

-- Index on games table for user queries
CREATE INDEX IF NOT EXISTS idx_games_user_id ON games(user_id);

-- Composite index for active game queries
CREATE INDEX IF NOT EXISTS idx_games_status_created ON games(status, created_at DESC);
