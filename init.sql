-- =====================================================================
-- BINARY BETS - COMPLETE DATABASE INITIALIZATION
-- Optimized for Docker deployment with proper authentication
-- =====================================================================

-- Drop everything and start fresh
DROP TABLE IF EXISTS bets CASCADE;
DROP TABLE IF EXISTS options CASCADE;
DROP TABLE IF EXISTS markets CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- =====================================================================
-- USERS TABLE
-- =====================================================================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    balance DECIMAL(10, 2) DEFAULT 1000.00 CHECK (balance >= 0),
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);

-- =====================================================================
-- CATEGORIES TABLE
-- =====================================================================
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    icon VARCHAR(10),
    color VARCHAR(20) DEFAULT '#667eea',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_categories_name ON categories(name);

-- =====================================================================
-- MARKETS TABLE
-- =====================================================================
CREATE TABLE markets (
    id SERIAL PRIMARY KEY,
    question TEXT NOT NULL,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    deadline TIMESTAMP NOT NULL CHECK (deadline > CURRENT_TIMESTAMP OR status != 'active'),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'cancelled')),
    outcome TEXT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP
);

CREATE INDEX idx_markets_status ON markets(status);
CREATE INDEX idx_markets_category ON markets(category_id);
CREATE INDEX idx_markets_deadline ON markets(deadline);
CREATE INDEX idx_markets_created_by ON markets(created_by);

-- =====================================================================
-- OPTIONS TABLE  
-- =====================================================================
CREATE TABLE options (
    id SERIAL PRIMARY KEY,
    market_id INTEGER REFERENCES markets(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(100) NOT NULL,
    odds DECIMAL(10, 2) DEFAULT 1.00 CHECK (odds >= 1.00),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(market_id, name)
);

CREATE INDEX idx_options_market ON options(market_id);

-- =====================================================================
-- BETS TABLE
-- =====================================================================
CREATE TABLE bets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    market_id INTEGER REFERENCES markets(id) ON DELETE CASCADE NOT NULL,
    option_id INTEGER REFERENCES options(id) ON DELETE CASCADE NOT NULL,
    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    odds DECIMAL(10, 2) NOT NULL CHECK (odds >= 1.00),
    potential_payout DECIMAL(10, 2) NOT NULL CHECK (potential_payout > 0),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'won', 'lost', 'void')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_bets_user ON bets(user_id);
CREATE INDEX idx_bets_market ON bets(market_id);
CREATE INDEX idx_bets_option ON bets(option_id);
CREATE INDEX idx_bets_status ON bets(status);
CREATE INDEX idx_bets_created_at ON bets(created_at DESC);

-- =====================================================================
-- INSERT CATEGORIES
-- =====================================================================
INSERT INTO categories (name, description, icon, color) VALUES
('Politics', 'Political events, elections, and government decisions', '🏛️', '#667eea'),
('Sports', 'Sports games, championships, and athlete performances', '⚽', '#10B981'),
('Technology', 'Tech industry, innovation, and product launches', '💻', '#8B5CF6'),
('Finance', 'Markets, stocks, crypto, and economic indicators', '💰', '#EF4444'),
('Weather', 'Weather predictions and climate events', '🌤️', '#F59E0B'),
('Entertainment', 'Movies, TV shows, music, and celebrity events', '🎬', '#EC4899'),
('Science', 'Scientific discoveries and research outcomes', '🔬', '#06B6D4'),
('Gaming', 'Video game releases, esports, and gaming industry', '🎮', '#8B5CF6'),
('Business', 'Company performance, mergers, and business news', '📊', '#3B82F6'),
('Social', 'Social trends, viral content, and cultural events', '📱', '#6366F1');

-- =====================================================================
-- INSERT USERS
-- Password for all users: BinaryBets2025!
-- Hashed with bcrypt rounds=10
-- =====================================================================
INSERT INTO users (username, email, password_hash, balance, role) VALUES
('admin', 'admin@binary-bets.com', '$2a$10$YQ7z8QH6vK3gX9mJ5N8zXuHqKqF8L9wN2vC1xB4yA5zR6tE7sD8fO', 10000.00, 'admin'),
('alice_trader', 'alice@example.com', '$2a$10$YQ7z8QH6vK3gX9mJ5N8zXuHqKqF8L9wN2vC1xB4yA5zR6tE7sD8fO', 2500.00, 'user'),
('bob_gambler', 'bob@example.com', '$2a$10$YQ7z8QH6vK3gX9mJ5N8zXuHqKqF8L9wN2vC1xB4yA5zR6tE7sD8fO', 1800.00, 'user'),
('charlie_analyst', 'charlie@example.com', '$2a$10$YQ7z8QH6vK3gX9mJ5N8zXuHqKqF8L9wN2vC1xB4yA5zR6tE7sD8fO', 3200.00, 'user'),
('diana_investor', 'diana@example.com', '$2a$10$YQ7z8QH6vK3gX9mJ5N8zXuHqKqF8L9wN2vC1xB4yA5zR6tE7sD8fO', 1500.00, 'user'),
('test_user', 'test@example.com', '$2a$10$YQ7z8QH6vK3gX9mJ5N8zXuHqKqF8L9wN2vC1xB4yA5zR6tE7sD8fO', 1000.00, 'user');

-- =====================================================================
-- INSERT MARKETS
-- =====================================================================
INSERT INTO markets (question, category_id, deadline, status, created_by) VALUES
('Will Bitcoin reach $100,000 by end of 2025?', 4, '2025-12-31 23:59:59', 'active', 1),
('Will it snow in Boise, Idaho on Christmas 2025?', 5, '2025-12-25 23:59:59', 'active', 1),
('Will the next iPhone have a foldable screen?', 3, '2025-09-30 23:59:59', 'active', 2),
('Will Tesla stock reach $300 by March 2025?', 9, '2025-03-31 23:59:59', 'active', 3),
('Who will win the 2025 NBA Championship?', 2, '2025-06-30 23:59:59', 'active', 4),
('Will AI surpass human intelligence by 2030?', 7, '2030-12-31 23:59:59', 'active', 1),
('Will SpaceX land humans on Mars by 2028?', 7, '2028-12-31 23:59:59', 'active', 1),
('Will the S&P 500 hit 7000 by end of 2025?', 4, '2025-12-31 23:59:59', 'active', 3),
('Will GTA 6 be released in 2025?', 8, '2025-12-31 23:59:59', 'active', 2),
('Will it rain in Seattle this weekend?', 5, '2025-11-10 23:59:59', 'active', 5),
('Will Apple announce a new MacBook in 2025?', 3, '2025-12-31 23:59:59', 'active', 2),
('Will the Fed cut interest rates in Q1 2025?', 4, '2025-03-31 23:59:59', 'active', 3);

-- =====================================================================
-- INSERT OPTIONS
-- =====================================================================

-- Binary markets (Yes/No)
INSERT INTO options (market_id, name, odds) VALUES
-- Market 1: Bitcoin
(1, 'Yes', 2.50), (1, 'No', 1.50),
-- Market 2: Snow
(2, 'Yes', 1.80), (2, 'No', 2.20),
-- Market 3: iPhone
(3, 'Yes', 3.50), (3, 'No', 1.30),
-- Market 4: Tesla
(4, 'Yes', 2.00), (4, 'No', 2.00),
-- Market 6: AI
(6, 'Yes', 2.80), (6, 'No', 1.40),
-- Market 7: Mars
(7, 'Yes', 4.00), (7, 'No', 1.25),
-- Market 8: S&P
(8, 'Yes', 1.90), (8, 'No', 2.10),
-- Market 9: GTA 6
(9, 'Yes', 1.60), (9, 'No', 2.40),
-- Market 10: Seattle Rain
(10, 'Yes', 1.70), (10, 'No', 2.30),
-- Market 11: MacBook
(11, 'Yes', 1.80), (11, 'No', 2.20),
-- Market 12: Fed Rates
(12, 'Yes', 2.50), (12, 'No', 1.50);

-- Multi-choice market: NBA Championship
INSERT INTO options (market_id, name, odds) VALUES
(5, 'Lakers', 3.50),
(5, 'Celtics', 4.00),
(5, 'Warriors', 5.00),
(5, 'Bucks', 4.50),
(5, 'Nuggets', 5.50),
(5, 'Other', 2.50);

-- =====================================================================
-- INSERT SAMPLE BETS
-- =====================================================================
INSERT INTO bets (user_id, market_id, option_id, amount, odds, potential_payout, status) VALUES
-- Alice's bets (user_id=2)
(2, 1, 1, 100.00, 2.50, 250.00, 'pending'),
(2, 3, 5, 50.00, 3.50, 175.00, 'pending'),
(2, 8, 15, 75.00, 1.90, 142.50, 'pending'),
(2, 11, 21, 80.00, 1.80, 144.00, 'pending'),
-- Bob's bets (user_id=3)
(3, 2, 3, 80.00, 1.80, 144.00, 'pending'),
(3, 4, 7, 120.00, 2.00, 240.00, 'pending'),
(3, 9, 17, 60.00, 1.60, 96.00, 'pending'),
(3, 10, 19, 70.00, 1.70, 119.00, 'pending'),
-- Charlie's bets (user_id=4)
(4, 1, 2, 150.00, 1.50, 225.00, 'pending'),
(4, 5, 25, 100.00, 3.50, 350.00, 'pending'),
(4, 6, 11, 200.00, 2.80, 560.00, 'pending'),
(4, 12, 23, 90.00, 2.50, 225.00, 'pending'),
-- Diana's bets (user_id=5)
(5, 7, 13, 90.00, 4.00, 360.00, 'pending'),
(5, 8, 16, 110.00, 2.10, 231.00, 'pending'),
(5, 11, 22, 85.00, 2.20, 187.00, 'pending'),
-- Test user bets (user_id=6)
(6, 1, 1, 50.00, 2.50, 125.00, 'pending'),
(6, 2, 4, 75.00, 2.20, 165.00, 'pending');

-- =====================================================================
-- GRANT PERMISSIONS
-- =====================================================================
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO binaryuser;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO binaryuser;
GRANT USAGE ON SCHEMA public TO binaryuser;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO binaryuser;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO binaryuser;

-- =====================================================================
-- CREATE HELPFUL VIEWS
-- =====================================================================

-- View: Active markets with bet counts
CREATE OR REPLACE VIEW active_markets_summary AS
SELECT 
    m.id,
    m.question,
    c.name as category_name,
    c.icon as category_icon,
    m.deadline,
    m.status,
    COUNT(DISTINCT b.id) as total_bets,
    COUNT(DISTINCT o.id) as options_count,
    COALESCE(SUM(b.amount), 0) as total_volume
FROM markets m
LEFT JOIN categories c ON m.category_id = c.id
LEFT JOIN options o ON m.id = o.market_id
LEFT JOIN bets b ON m.id = b.market_id AND b.status = 'pending'
WHERE m.status = 'active'
GROUP BY m.id, m.question, c.name, c.icon, m.deadline, m.status
ORDER BY m.created_at DESC;

-- View: User bet history
CREATE OR REPLACE VIEW user_bet_history AS
SELECT 
    b.id as bet_id,
    u.username,
    m.question,
    o.name as option_name,
    b.amount,
    b.odds,
    b.potential_payout,
    b.status,
    b.created_at
FROM bets b
JOIN users u ON b.user_id = u.id
JOIN markets m ON b.market_id = m.id
JOIN options o ON b.option_id = o.id
ORDER BY b.created_at DESC;

-- =====================================================================
-- VERIFICATION & SUMMARY
-- =====================================================================
DO $$
DECLARE
    cat_count INTEGER;
    user_count INTEGER;
    market_count INTEGER;
    option_count INTEGER;
    bet_count INTEGER;
    total_volume DECIMAL;
BEGIN
    SELECT COUNT(*) INTO cat_count FROM categories;
    SELECT COUNT(*) INTO user_count FROM users;
    SELECT COUNT(*) INTO market_count FROM markets;
    SELECT COUNT(*) INTO option_count FROM options;
    SELECT COUNT(*) INTO bet_count FROM bets;
    SELECT COALESCE(SUM(amount), 0) INTO total_volume FROM bets;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================================';
    RAISE NOTICE '✅ BINARY BETS DATABASE INITIALIZATION COMPLETE!';
    RAISE NOTICE '========================================================';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Database Summary:';
    RAISE NOTICE '   ├─ Categories: % (10 types)', cat_count;
    RAISE NOTICE '   ├─ Users: % (1 admin + % regular)', user_count, user_count - 1;
    RAISE NOTICE '   ├─ Markets: % active markets', market_count;
    RAISE NOTICE '   ├─ Options: % betting options', option_count;
    RAISE NOTICE '   ├─ Bets: % placed bets', bet_count;
    RAISE NOTICE '   └─ Volume: $% total bet volume', total_volume;
    RAISE NOTICE '';
    RAISE NOTICE '🔐 Login Credentials:';
    RAISE NOTICE '   ┌─────────────────────────────────────┐';
    RAISE NOTICE '   │ ADMIN ACCOUNT                       │';
    RAISE NOTICE '   ├─────────────────────────────────────┤';
    RAISE NOTICE '   │ Username: admin                     │';
    RAISE NOTICE '   │ Email: admin@binary-bets.com        │';
    RAISE NOTICE '   │ Password: BinaryBets2025!           │';
    RAISE NOTICE '   │ Balance: $10,000.00                 │';
    RAISE NOTICE '   └─────────────────────────────────────┘';
    RAISE NOTICE '';
    RAISE NOTICE '👥 Test User Accounts (Password: BinaryBets2025!):';
    RAISE NOTICE '   ├─ alice_trader@example.com ($2,500)';
    RAISE NOTICE '   ├─ bob_gambler@example.com ($1,800)';
    RAISE NOTICE '   ├─ charlie_analyst@example.com ($3,200)';
    RAISE NOTICE '   ├─ diana_investor@example.com ($1,500)';
    RAISE NOTICE '   └─ test@example.com ($1,000)';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Quick Start:';
    RAISE NOTICE '   1. Login with admin credentials';
    RAISE NOTICE '   2. Browse 12 active prediction markets';
    RAISE NOTICE '   3. Place bets with your $10,000 balance';
    RAISE NOTICE '   4. Watch odds update dynamically!';
    RAISE NOTICE '';
    RAISE NOTICE '========================================================';
    RAISE NOTICE '';
END $$;
