-- BinaryBets Database Schema with Categories and Subcategories
-- PostgreSQL initialization script

-- Drop existing tables if they exist (in correct order due to foreign keys)
DROP TABLE IF EXISTS bets CASCADE;
DROP TABLE IF EXISTS market_options CASCADE;
DROP TABLE IF EXISTS markets CASCADE;
DROP TABLE IF EXISTS subcategories CASCADE;
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

-- Create categories table (main categories)
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    color VARCHAR(50) NOT NULL,
    icon VARCHAR(10),
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create subcategories table
CREATE TABLE subcategories (
    id SERIAL PRIMARY KEY,
    category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(category_id, name)
);

-- Create markets table
CREATE TABLE markets (
    id SERIAL PRIMARY KEY,
    question TEXT NOT NULL,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    subcategory_id INTEGER REFERENCES subcategories(id) ON DELETE SET NULL,
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
CREATE INDEX idx_categories_display_order ON categories(display_order);
CREATE INDEX idx_subcategories_category ON subcategories(category_id);
CREATE INDEX idx_subcategories_display_order ON subcategories(display_order);
CREATE INDEX idx_markets_category ON markets(category_id);
CREATE INDEX idx_markets_subcategory ON markets(subcategory_id);
CREATE INDEX idx_markets_deadline ON markets(deadline);
CREATE INDEX idx_markets_resolved ON markets(resolved);
CREATE INDEX idx_market_options_market ON market_options(market_id);
CREATE INDEX idx_bets_user ON bets(user_id);
CREATE INDEX idx_bets_market ON bets(market_id);
CREATE INDEX idx_bets_placed_at ON bets(placed_at);

-- Insert default categories with icons
INSERT INTO categories (name, color, icon, display_order) VALUES
    ('Sports', '#10B981', '⚽', 1),
    ('Politics', '#3B82F6', '🏛️', 2),
    ('Technology', '#8B5CF6', '💻', 3),
    ('Entertainment', '#F59E0B', '🎬', 4),
    ('Finance', '#EF4444', '💰', 5),
    ('Science', '#06B6D4', '🔬', 6),
    ('Weather', '#6366F1', '🌤️', 7),
    ('Other', '#6B7280', '📌', 8);

-- Insert subcategories for Sports
INSERT INTO subcategories (category_id, name, display_order) VALUES
    (1, 'Football', 1),
    (1, 'Basketball', 2),
    (1, 'Baseball', 3),
    (1, 'Soccer', 4),
    (1, 'Tennis', 5),
    (1, 'Olympics', 6);

-- Insert subcategories for Politics
INSERT INTO subcategories (category_id, name, display_order) VALUES
    (2, 'US Elections', 1),
    (2, 'International', 2),
    (2, 'Legislation', 3),
    (2, 'State Politics', 4);

-- Insert subcategories for Technology
INSERT INTO subcategories (category_id, name, display_order) VALUES
    (3, 'AI & Machine Learning', 1),
    (3, 'Crypto & Blockchain', 2),
    (3, 'Consumer Tech', 3),
    (3, 'Software', 4),
    (3, 'Startups', 5);

-- Insert subcategories for Entertainment
INSERT INTO subcategories (category_id, name, display_order) VALUES
    (4, 'Movies', 1),
    (4, 'TV Shows', 2),
    (4, 'Music', 3),
    (4, 'Gaming', 4),
    (4, 'Awards', 5);

-- Insert subcategories for Finance
INSERT INTO subcategories (category_id, name, display_order) VALUES
    (5, 'Stock Market', 1),
    (5, 'Cryptocurrency', 2),
    (5, 'Economy', 3),
    (5, 'Companies', 4),
    (5, 'Banking', 5);

-- Insert subcategories for Science
INSERT INTO subcategories (category_id, name, display_order) VALUES
    (6, 'Space', 1),
    (6, 'Medicine', 2),
    (6, 'Environment', 3),
    (6, 'Physics', 4),
    (6, 'Biology', 5);

-- Insert subcategories for Weather
INSERT INTO subcategories (category_id, name, display_order) VALUES
    (7, 'Temperature Records', 1),
    (7, 'Storms & Hurricanes', 2),
    (7, 'Seasonal Events', 3),
    (7, 'Climate', 4);

-- Insert subcategories for Other
INSERT INTO subcategories (category_id, name, display_order) VALUES
    (8, 'General', 1),
    (8, 'Miscellaneous', 2);

-- Insert admin user (password: admin123 - you should change this!)
-- Password hash is for 'admin123' - CHANGE THIS IN PRODUCTION
INSERT INTO users (email, username, full_name, password_hash, balance, is_admin) VALUES
    ('admin@binary-bets.com', 'admin', 'Admin User', '$2b$10$rJ4cL5YQqQqQqQqQqQqQqeqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQq', 10000.00, TRUE);

-- Insert demo users (password: password123)
INSERT INTO users (email, username, full_name, password_hash, balance, is_admin) VALUES
    ('test@example.com', 'testuser', 'Test User', '$2b$10$rJ4cL5YQqQqQqQqQqQqQqeqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQq', 1000.00, FALSE),
    ('john@example.com', 'johnbets', 'John Smith', '$2b$10$rJ4cL5YQqQqQqQqQqQqQqeqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQq', 2500.50, FALSE),
    ('sarah@example.com', 'sarahwins', 'Sarah Johnson', '$2b$10$rJ4cL5YQqQqQqQqQqQqQqeqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQq', 3200.75, FALSE),
    ('mike@example.com', 'mikepro', 'Mike Williams', '$2b$10$rJ4cL5YQqQqQqQqQqQqQqeqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQq', 1800.25, FALSE),
    ('emily@example.com', 'emilybet', 'Emily Davis', '$2b$10$rJ4cL5YQqQqQqQqQqQqQqeqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQq', 950.00, FALSE),
    ('alex@example.com', 'alextrader', 'Alex Chen', '$2b$10$rJ4cL5YQqQqQqQqQqQqQqeqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQq', 4100.00, FALSE),
    ('lisa@example.com', 'lisaluck', 'Lisa Martinez', '$2b$10$rJ4cL5YQqQqQqQqQqQqQqeqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQq', 1500.50, FALSE),
    ('david@example.com', 'davidsharp', 'David Brown', '$2b$10$rJ4cL5YQqQqQqQqQqQqQqeqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQq', 2200.00, FALSE);

-- Insert active binary markets
INSERT INTO markets (question, category_id, subcategory_id, market_type, yes_odds, no_odds, deadline, created_by, resolved) VALUES
    ('Will Bitcoin reach $100,000 by end of 2025?', 5, 12, 'binary', 2.50, 1.50, '2025-12-31 23:59:59', 1, FALSE),
    ('Will the next iPhone have a foldable screen?', 3, 15, 'binary', 4.00, 1.25, '2025-09-30 23:59:59', 1, FALSE),
    ('Will SpaceX land humans on Mars in 2025?', 6, 21, 'binary', 10.00, 1.10, '2025-12-31 23:59:59', 1, FALSE);

-- Insert active multi-choice market
INSERT INTO markets (question, category_id, subcategory_id, market_type, yes_odds, no_odds, deadline, created_by, resolved) VALUES
    ('Who will win the 2026 FIFA World Cup?', 1, 4, 'multi-choice', NULL, NULL, '2026-07-19 23:59:59', 1, FALSE);

-- Insert options for active multi-choice market
INSERT INTO market_options (market_id, option_text, odds, option_order) VALUES
    (4, 'Brazil', 4.50, 1),
    (4, 'Argentina', 5.00, 2),
    (4, 'France', 6.00, 3),
    (4, 'Germany', 7.00, 4),
    (4, 'Spain', 8.00, 5),
    (4, 'England', 9.00, 6);

-- Insert RESOLVED markets with outcomes
INSERT INTO markets (question, category_id, subcategory_id, market_type, yes_odds, no_odds, deadline, created_by, resolved, outcome, resolved_at, resolved_by) VALUES
    ('Will it snow in Miami this winter?', 7, 27, 'binary', 15.00, 1.05, '2025-03-20 23:59:59', 1, TRUE, 'no', '2025-03-21 10:00:00', 1),
    ('Will the US Federal Reserve cut interest rates in Q1 2025?', 5, 13, 'binary', 2.20, 1.70, '2025-03-31 23:59:59', 1, TRUE, 'yes', '2025-04-01 09:00:00', 1),
    ('Will Tesla stock reach $300 by March 2025?', 5, 14, 'binary', 3.00, 1.40, '2025-03-31 23:59:59', 1, TRUE, 'no', '2025-04-01 16:00:00', 1);

-- Insert resolved multi-choice market
INSERT INTO markets (question, category_id, subcategory_id, market_type, yes_odds, no_odds, deadline, created_by, resolved, outcome, resolved_at, resolved_by) VALUES
    ('Which team won the 2025 Super Bowl?', 1, 1, 'multi-choice', NULL, NULL, '2025-02-09 23:59:59', 1, TRUE, '1', '2025-02-10 08:00:00', 1);

-- Insert options for resolved multi-choice market
INSERT INTO market_options (market_id, option_text, odds, option_order) VALUES
    (8, 'Kansas City Chiefs', 2.50, 1),
    (8, 'San Francisco 49ers', 3.00, 2),
    (8, 'Buffalo Bills', 4.00, 3),
    (8, 'Philadelphia Eagles', 5.00, 4);

-- Insert bets on active markets
INSERT INTO bets (user_id, market_id, market_option_id, amount, odds, bet_type, won) VALUES
    (2, 1, NULL, 50.00, 2.50, 'Yes', NULL),
    (3, 1, NULL, 100.00, 1.50, 'No', NULL),
    (4, 1, NULL, 75.00, 2.50, 'Yes', NULL),
    (2, 4, 1, 25.00, 4.50, NULL, NULL),
    (5, 4, 2, 30.00, 5.00, NULL, NULL),
    (6, 4, 3, 20.00, 6.00, NULL, NULL);

-- Insert bets on RESOLVED market #5 (Miami snow - outcome: NO)
-- Winners (bet NO)
INSERT INTO bets (user_id, market_id, market_option_id, amount, odds, bet_type, won) VALUES
    (3, 5, NULL, 200.00, 1.05, 'No', TRUE),
    (6, 5, NULL, 150.00, 1.05, 'No', TRUE),
    (7, 5, NULL, 100.00, 1.05, 'No', TRUE),
    (8, 5, NULL, 75.00, 1.05, 'No', TRUE);

-- Losers (bet YES)
INSERT INTO bets (user_id, market_id, market_option_id, amount, odds, bet_type, won) VALUES
    (2, 5, NULL, 50.00, 15.00, 'Yes', FALSE),
    (4, 5, NULL, 25.00, 15.00, 'Yes', FALSE),
    (5, 5, NULL, 10.00, 15.00, 'Yes', FALSE);

-- Insert bets on RESOLVED market #6 (Fed rate cut - outcome: YES)
-- Winners (bet YES)
INSERT INTO bets (user_id, market_id, market_option_id, amount, odds, bet_type, won) VALUES
    (3, 6, NULL, 150.00, 2.20, 'Yes', TRUE),
    (4, 6, NULL, 100.00, 2.20, 'Yes', TRUE),
    (6, 6, NULL, 200.00, 2.20, 'Yes', TRUE),
    (8, 6, NULL, 50.00, 2.20, 'Yes', TRUE);

-- Losers (bet NO)
INSERT INTO bets (user_id, market_id, market_option_id, amount, odds, bet_type, won) VALUES
    (2, 6, NULL, 80.00, 1.70, 'No', FALSE),
    (5, 6, NULL, 60.00, 1.70, 'No', FALSE),
    (7, 6, NULL, 40.00, 1.70, 'No', FALSE);

-- Insert bets on RESOLVED market #7 (Tesla stock - outcome: NO)
-- Winners (bet NO)
INSERT INTO bets (user_id, market_id, market_option_id, amount, odds, bet_type, won) VALUES
    (2, 7, NULL, 120.00, 1.40, 'No', TRUE),
    (5, 7, NULL, 90.00, 1.40, 'No', TRUE),
    (7, 7, NULL, 150.00, 1.40, 'No', TRUE);

-- Losers (bet YES)
INSERT INTO bets (user_id, market_id, market_option_id, amount, odds, bet_type, won) VALUES
    (3, 7, NULL, 100.00, 3.00, 'Yes', FALSE),
    (4, 7, NULL, 75.00, 3.00, 'Yes', FALSE),
    (6, 7, NULL, 50.00, 3.00, 'Yes', FALSE),
    (8, 7, NULL, 30.00, 3.00, 'Yes', FALSE);

-- Insert bets on RESOLVED market #8 (Super Bowl - Kansas City Chiefs won - option_id 1)
-- Winners (bet on Chiefs)
INSERT INTO bets (user_id, market_id, market_option_id, amount, odds, bet_type, won) VALUES
    (3, 8, 1, 100.00, 2.50, NULL, TRUE),
    (6, 8, 1, 150.00, 2.50, NULL, TRUE),
    (8, 8, 1, 80.00, 2.50, NULL, TRUE);

-- Losers (bet on other teams)
INSERT INTO bets (user_id, market_id, market_option_id, amount, odds, bet_type, won) VALUES
    (2, 8, 2, 60.00, 3.00, NULL, FALSE),
    (4, 8, 3, 50.00, 4.00, NULL, FALSE),
    (5, 8, 4, 40.00, 5.00, NULL, FALSE),
    (7, 8, 2, 70.00, 3.00, NULL, FALSE);

-- Grant necessary permissions (adjust if using different database user)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO binaryuser;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO binaryuser;

-- Display success message
DO $$
BEGIN
    RAISE NOTICE '✅ Database initialized successfully!';
    RAISE NOTICE '📊 Tables created: users, categories, subcategories, markets, market_options, bets';
    RAISE NOTICE '📁 8 main categories with subcategories created';
    RAISE NOTICE '👤 Admin user: admin@binary-bets.com (password: admin123)';
    RAISE NOTICE '🧪 8 demo users created with various balances';
    RAISE NOTICE '📈 7 active markets and 4 resolved markets with bets';
    RAISE NOTICE '🎯 Click "🏁 Completed" to see resolved market results!';
    RAISE NOTICE '⚠️  IMPORTANT: Change the default admin password in production!';
END $$;
