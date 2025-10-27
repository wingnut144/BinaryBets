-- Binary Bets Database Initialization Script
-- This script creates all tables with proper structure and sample data
-- Safe to run multiple times (uses IF NOT EXISTS)

-- Drop existing tables if you want a fresh start (uncomment to use)
-- DROP TABLE IF EXISTS market_reports CASCADE;
-- DROP TABLE IF EXISTS bets CASCADE;
-- DROP TABLE IF EXISTS markets CASCADE;
-- DROP TABLE IF EXISTS categories CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;

-- =============================================================================
-- USERS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    balance NUMERIC(10, 2) DEFAULT 1000.00 NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin);

-- =============================================================================
-- CATEGORIES TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    color VARCHAR(7) NOT NULL,
    icon VARCHAR(10),
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default categories
INSERT INTO categories (name, color, icon, display_order) VALUES
    ('Sports', '#10B981', '⚽', 1),
    ('Politics', '#3B82F6', '🏛️', 2),
    ('Technology', '#8B5CF6', '💻', 3),
    ('Entertainment', '#F59E0B', '🎬', 4),
    ('Finance', '#EF4444', '💰', 5),
    ('Science', '#06B6D4', '🔬', 6),
    ('Weather', '#6366F1', '🌤️', 7),
    ('Other', '#6B7280', '📌', 8)
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- MARKETS (BETS) TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS markets (
    id SERIAL PRIMARY KEY,
    question TEXT NOT NULL,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    close_date TIMESTAMP NOT NULL,
    market_type VARCHAR(20) DEFAULT 'binary' NOT NULL,
    status VARCHAR(20) DEFAULT 'active' NOT NULL,
    options TEXT[], -- For multiple choice markets
    total_bet_amount NUMERIC(10, 2) DEFAULT 0.00,
    winning_outcome VARCHAR(50),
    resolved_at TIMESTAMP,
    resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    -- AI odds storage (as JSONB for flexibility)
    ai_odds JSONB,
    
    -- Current odds calculation (updated as bets come in)
    current_odds JSONB,
    
    -- Volume distribution (percentage of bets on each side)
    volume_distribution JSONB,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CHECK (status IN ('active', 'closed', 'resolved', 'cancelled')),
    CHECK (market_type IN ('binary', 'multiple'))
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_markets_status ON markets(status);
CREATE INDEX IF NOT EXISTS idx_markets_category ON markets(category_id);
CREATE INDEX IF NOT EXISTS idx_markets_close_date ON markets(close_date);
CREATE INDEX IF NOT EXISTS idx_markets_created_by ON markets(created_by);

-- =============================================================================
-- BETS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS bets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    market_id INTEGER REFERENCES markets(id) ON DELETE CASCADE NOT NULL,
    position VARCHAR(50) NOT NULL, -- 'yes', 'no', or option name
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    odds NUMERIC(5, 2) DEFAULT 2.00 NOT NULL,
    potential_payout NUMERIC(10, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' NOT NULL,
    payout_amount NUMERIC(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    settled_at TIMESTAMP,
    
    CHECK (status IN ('pending', 'won', 'lost', 'refunded'))
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_bets_user_id ON bets(user_id);
CREATE INDEX IF NOT EXISTS idx_bets_market_id ON bets(market_id);
CREATE INDEX IF NOT EXISTS idx_bets_status ON bets(status);
CREATE INDEX IF NOT EXISTS idx_bets_created_at ON bets(created_at DESC);

-- =============================================================================
-- MARKET REPORTS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS market_reports (
    id SERIAL PRIMARY KEY,
    market_id INTEGER REFERENCES markets(id) ON DELETE CASCADE NOT NULL,
    reported_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reason TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    admin_notes TEXT,
    
    CHECK (status IN ('pending', 'approved', 'dismissed'))
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_reports_market_id ON market_reports(market_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON market_reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON market_reports(created_at DESC);

-- =============================================================================
-- TRIGGERS FOR UPDATED_AT
-- =============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for users table
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for markets table
DROP TRIGGER IF EXISTS update_markets_updated_at ON markets;
CREATE TRIGGER update_markets_updated_at
    BEFORE UPDATE ON markets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- HELPER VIEWS
-- =============================================================================

-- View for active markets with bet statistics
CREATE OR REPLACE VIEW active_markets_summary AS
SELECT 
    m.id,
    m.question,
    m.category_id,
    c.name as category_name,
    c.color as category_color,
    c.icon as category_icon,
    m.close_date,
    m.market_type,
    m.total_bet_amount,
    m.current_odds,
    m.volume_distribution,
    m.created_at,
    COUNT(b.id) as total_bets,
    u.username as creator_username
FROM markets m
LEFT JOIN categories c ON m.category_id = c.id
LEFT JOIN bets b ON m.id = b.market_id
LEFT JOIN users u ON m.created_by = u.id
WHERE m.status = 'active'
GROUP BY m.id, c.name, c.color, c.icon, u.username;

-- View for user bet history with market details
CREATE OR REPLACE VIEW user_bets_detailed AS
SELECT 
    b.id,
    b.user_id,
    u.username,
    b.market_id,
    m.question,
    b.position,
    b.amount,
    b.odds,
    b.potential_payout,
    b.status,
    b.payout_amount,
    b.created_at,
    b.settled_at,
    m.close_date,
    m.status as market_status
FROM bets b
JOIN users u ON b.user_id = u.id
JOIN markets m ON b.market_id = m.id
ORDER BY b.created_at DESC;

-- View for leaderboard
CREATE OR REPLACE VIEW leaderboard AS
SELECT 
    id,
    username,
    balance,
    (balance - 1000.00) as profit,
    created_at,
    ROW_NUMBER() OVER (ORDER BY balance DESC) as rank
FROM users
WHERE is_admin = FALSE
ORDER BY balance DESC;

-- =============================================================================
-- SAMPLE DATA (OPTIONAL - COMMENT OUT IF NOT NEEDED)
-- =============================================================================

-- Sample admin user (password: admin123)
-- Password hash generated with bcrypt
INSERT INTO users (username, email, password_hash, full_name, balance, is_admin) VALUES
    ('admin', 'admin@binarybets.com', '$2b$10$YourHashHere', 'Admin User', 10000.00, TRUE)
ON CONFLICT (username) DO NOTHING;

-- Sample regular users for testing
INSERT INTO users (username, email, password_hash, full_name, balance) VALUES
    ('alice', 'alice@example.com', '$2b$10$YourHashHere', 'Alice Smith', 1500.00),
    ('bob', 'bob@example.com', '$2b$10$YourHashHere', 'Bob Johnson', 800.00),
    ('charlie', 'charlie@example.com', '$2b$10$YourHashHere', 'Charlie Brown', 2000.00)
ON CONFLICT (username) DO NOTHING;

-- Sample markets
INSERT INTO markets (question, category_id, created_by, close_date, market_type, status, total_bet_amount, current_odds, volume_distribution) VALUES
    (
        'Will Bitcoin reach $100,000 by end of 2025?',
        5, -- Finance
        1, -- Admin
        '2025-12-31 23:59:59',
        'binary',
        'active',
        250.00,
        '{"yes": 2.2, "no": 1.8}'::jsonb,
        '{"yes": 45, "no": 55}'::jsonb
    ),
    (
        'Will the Lakers win the NBA Championship in 2026?',
        1, -- Sports
        1,
        '2026-06-30 23:59:59',
        'binary',
        'active',
        150.00,
        '{"yes": 3.0, "no": 1.5}'::jsonb,
        '{"yes": 33, "no": 67}'::jsonb
    ),
    (
        'Will AI generate more than 50% of all online content by 2027?',
        3, -- Technology
        1,
        '2027-12-31 23:59:59',
        'binary',
        'active',
        0.00,
        '{"yes": 2.0, "no": 2.0}'::jsonb,
        '{"yes": 50, "no": 50}'::jsonb
    )
ON CONFLICT DO NOTHING;

-- =============================================================================
-- USEFUL QUERIES (FOR REFERENCE)
-- =============================================================================

-- Get all active markets with bet counts
-- SELECT * FROM active_markets_summary;

-- Get leaderboard
-- SELECT * FROM leaderboard LIMIT 10;

-- Get user's bet history
-- SELECT * FROM user_bets_detailed WHERE user_id = 1;

-- Get reported markets
-- SELECT r.*, m.question, u.username as reporter 
-- FROM market_reports r
-- JOIN markets m ON r.market_id = m.id
-- JOIN users u ON r.reported_by = u.id
-- WHERE r.status = 'pending';

-- Calculate total pool for a market
-- SELECT m.id, m.question, SUM(b.amount) as total_pool, COUNT(b.id) as bet_count
-- FROM markets m
-- LEFT JOIN bets b ON m.id = b.market_id
-- GROUP BY m.id;

-- =============================================================================
-- GRANT PERMISSIONS (IF USING SPECIFIC USER)
-- =============================================================================

-- Grant all privileges on tables
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO binaryuser;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO binaryuser;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO binaryuser;

-- =============================================================================
-- VALIDATION QUERIES
-- =============================================================================

-- Verify all tables exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        RAISE EXCEPTION 'users table not created';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'categories') THEN
        RAISE EXCEPTION 'categories table not created';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'markets') THEN
        RAISE EXCEPTION 'markets table not created';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bets') THEN
        RAISE EXCEPTION 'bets table not created';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'market_reports') THEN
        RAISE EXCEPTION 'market_reports table not created';
    END IF;
    
    RAISE NOTICE '✅ All tables created successfully!';
    RAISE NOTICE '✅ Database initialization complete!';
END $$;

-- Show table counts
SELECT 
    'users' as table_name, COUNT(*) as count FROM users
UNION ALL SELECT 'categories', COUNT(*) FROM categories
UNION ALL SELECT 'markets', COUNT(*) FROM markets
UNION ALL SELECT 'bets', COUNT(*) FROM bets
UNION ALL SELECT 'market_reports', COUNT(*) FROM market_reports;
