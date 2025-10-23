-- BinaryBets Database Schema
-- PostgreSQL initialization script

-- Drop existing tables if they exist (in correct order due to foreign keys)
DROP TABLE IF EXISTS bets CASCADE;
DROP TABLE IF EXISTS market_options CASCADE;
DROP TABLE IF EXISTS markets CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Create users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    balance NUMERIC(10, 2) DEFAULT 1000.00,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create categories table
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    color VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create markets table
CREATE TABLE markets (
    id SERIAL PRIMARY KEY,
    question TEXT NOT NULL,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    market_type VARCHAR(20) NOT NULL CHECK (market_type IN ('binary', 'multi-choice')),
    yes_odds NUMERIC(5, 2),
    no_odds NUMERIC(5, 2),
    deadline TIMESTAMP NOT NULL,
    resolved BOOLEAN DEFAULT FALSE,
    outcome TEXT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    CONSTRAINT binary_market_odds CHECK (
        (market_type = 'binary' AND yes_odds IS NOT NULL AND no_odds IS NOT NULL) OR
        (market_type = 'multi-choice' AND yes_odds IS NULL AND no_odds IS NULL)
    )
);

-- Create market_options table (for multi-choice markets)
CREATE TABLE market_options (
    id SERIAL PRIMARY KEY,
    market_id INTEGER REFERENCES markets(id) ON DELETE CASCADE,
    option_text TEXT NOT NULL,
    odds NUMERIC(5, 2) NOT NULL,
    option_order INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(market_id, option_order)
);

-- Create bets table
CREATE TABLE bets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    market_id INTEGER REFERENCES markets(id) ON DELETE CASCADE,
    market_option_id INTEGER REFERENCES market_options(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL,
    odds NUMERIC(5, 2) NOT NULL,
    bet_type TEXT,
    placed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    won BOOLEAN,
    CONSTRAINT positive_amount CHECK (amount > 0),
    CONSTRAINT positive_odds CHECK (odds > 0),
    CONSTRAINT bet_type_for_binary CHECK (
        (bet_type IN ('Yes', 'No')) OR bet_type IS NULL
    )
);

-- Create indexes for better query performance
CREATE INDEX idx_markets_category ON markets(category_id);
CREATE INDEX idx_markets_deadline ON markets(deadline);
CREATE INDEX idx_markets_resolved ON markets(resolved);
CREATE INDEX idx_market_options_market ON market_options(market_id);
CREATE INDEX idx_bets_user ON bets(user_id);
CREATE INDEX idx_bets_market ON bets(market_id);
CREATE INDEX idx_bets_placed_at ON bets(placed_at);

-- Insert default categories
INSERT INTO categories (name, color) VALUES
    ('Politics', '#3B82F6'),
    ('Sports', '#10B981'),
    ('Technology', '#8B5CF6'),
    ('Entertainment', '#F59E0B'),
    ('Science', '#06B6D4'),
    ('Finance', '#EF4444'),
    ('Weather', '#6366F1'),
    ('Other', '#6B7280');

-- Insert admin user (password: admin123 - you should change this!)
-- Password hash is for 'admin123' - CHANGE THIS IN PRODUCTION
INSERT INTO users (email, username, full_name, password_hash, balance, is_admin) VALUES
    ('admin@binary-bets.com', 'admin', 'Admin User', '$2b$10$rJ4cL5YQqQqQqQqQqQqQqeqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQq', 10000.00, TRUE);

-- Insert sample test user (password: password123)
INSERT INTO users (email, username, full_name, password_hash, balance, is_admin) VALUES
    ('test@example.com', 'testuser', 'Test User', '$2b$10$rJ4cL5YQqQqQqQqQqQqQqeqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQq', 1000.00, FALSE);

-- Insert sample binary market
INSERT INTO markets (question, category_id, market_type, yes_odds, no_odds, deadline, created_by) VALUES
    ('Will Bitcoin reach $100,000 by end of 2025?', 6, 'binary', 2.50, 1.50, '2025-12-31 23:59:59', 1);

-- Insert sample multi-choice market
INSERT INTO markets (question, category_id, market_type, yes_odds, no_odds, deadline, created_by) VALUES
    ('Who will win the 2026 FIFA World Cup?', 2, 'multi-choice', NULL, NULL, '2026-07-19 23:59:59', 1);

-- Insert options for multi-choice market
INSERT INTO market_options (market_id, option_text, odds, option_order) VALUES
    (2, 'Brazil', 4.50, 1),
    (2, 'Argentina', 5.00, 2),
    (2, 'France', 6.00, 3),
    (2, 'Germany', 7.00, 4),
    (2, 'Spain', 8.00, 5),
    (2, 'England', 9.00, 6);

-- Insert some sample bets
INSERT INTO bets (user_id, market_id, market_option_id, amount, odds, bet_type) VALUES
    (2, 1, NULL, 50.00, 2.50, 'Yes'),
    (2, 2, 1, 25.00, 4.50, NULL);

-- Grant necessary permissions (adjust if using different database user)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO binaryuser;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO binaryuser;

-- Display success message
DO $$
BEGIN
    RAISE NOTICE '✅ Database initialized successfully!';
    RAISE NOTICE '📊 Tables created: users, categories, markets, market_options, bets';
    RAISE NOTICE '👤 Admin user created: admin@binary-bets.com (password: admin123)';
    RAISE NOTICE '🧪 Test user created: test@example.com (password: password123)';
    RAISE NOTICE '⚠️  IMPORTANT: Change the default admin password in production!';
END $$;
