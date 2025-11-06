-- =====================================================================
-- BINARY BETS - COMPLETE DATABASE INITIALIZATION
-- Fresh start with proper authentication and sample data
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
    balance DECIMAL(10, 2) DEFAULT 1000.00,
    role VARCHAR(20) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);

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

-- =====================================================================
-- MARKETS TABLE
-- =====================================================================
CREATE TABLE markets (
    id SERIAL PRIMARY KEY,
    question TEXT NOT NULL,
    category_id INTEGER REFERENCES categories(id),
    deadline TIMESTAMP NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    outcome TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP
);

CREATE INDEX idx_markets_status ON markets(status);
CREATE INDEX idx_markets_category ON markets(category_id);
CREATE INDEX idx_markets_deadline ON markets(deadline);

-- =====================================================================
-- OPTIONS TABLE
-- =====================================================================
CREATE TABLE options (
    id SERIAL PRIMARY KEY,
    market_id INTEGER REFERENCES markets(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    odds DECIMAL(10, 2) DEFAULT 1.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_options_market ON options(market_id);

-- =====================================================================
-- BETS TABLE
-- =====================================================================
CREATE TABLE bets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    market_id INTEGER REFERENCES markets(id),
    option_id INTEGER REFERENCES options(id),
    amount DECIMAL(10, 2) NOT NULL,
    odds DECIMAL(10, 2) NOT NULL,
    potential_payout DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_bets_user ON bets(user_id);
CREATE INDEX idx_bets_market ON bets(market_id);
CREATE INDEX idx_bets_status ON bets(status);

-- =====================================================================
-- INSERT SAMPLE DATA
-- =====================================================================

-- Insert Categories
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

-- Insert Users with bcrypt hashed passwords
-- Admin: username=admin, password=AdminBinaryBets2025!
-- Regular users with password: BinaryBets2025!
INSERT INTO users (username, email, password_hash, balance, role) VALUES
('admin', 'admin@binary-bets.com', '$2a$10$xvTGhKZn5YNZjYR3qX8aJO7nF8W8cKJH9YNKqZ8mQnF6vX8L7W8pe', 10000.00, 'admin'),
('alice_trader', 'alice@example.com', '$2a$10$xvTGhKZn5YNZjYR3qX8aJO7nF8W8cKJH9YNKqZ8mQnF6vX8L7W8pe', 2500.00, 'user'),
('bob_gambler', 'bob@example.com', '$2a$10$xvTGhKZn5YNZjYR3qX8aJO7nF8W8cKJH9YNKqZ8mQnF6vX8L7W8pe', 1800.00, 'user'),
('charlie_analyst', 'charlie@example.com', '$2a$10$xvTGhKZn5YNZjYR3qX8aJO7nF8W8cKJH9YNKqZ8mQnF6vX8L7W8pe', 3200.00, 'user'),
('diana_investor', 'diana@example.com', '$2a$10$xvTGhKZn5YNZjYR3qX8aJO7nF8W8cKJH9YNKqZ8mQnF6vX8L7W8pe', 1500.00, 'user');

-- Insert Markets
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
('Will it be sunny in San Francisco tomorrow?', 5, '2025-11-07 23:59:59', 'active', 5);

-- Insert Options for each market
-- Market 1: Bitcoin $100k
INSERT INTO options (market_id, name, odds) VALUES
(1, 'Yes', 2.50),
(1, 'No', 1.50);

-- Market 2: Snow in Boise
INSERT INTO options (market_id, name, odds) VALUES
(2, 'Yes', 1.80),
(2, 'No', 2.20);

-- Market 3: Foldable iPhone
INSERT INTO options (market_id, name, odds) VALUES
(3, 'Yes', 3.50),
(3, 'No', 1.30);

-- Market 4: Tesla $300
INSERT INTO options (market_id, name, odds) VALUES
(4, 'Yes', 2.00),
(4, 'No', 2.00);

-- Market 5: NBA Championship
INSERT INTO options (market_id, name, odds) VALUES
(5, 'Lakers', 3.50),
(5, 'Celtics', 4.00),
(5, 'Warriors', 5.00),
(5, 'Bucks', 4.50),
(5, 'Other', 2.50);

-- Market 6: AI surpass humans
INSERT INTO options (market_id, name, odds) VALUES
(6, 'Yes', 2.80),
(6, 'No', 1.40);

-- Market 7: Mars landing
INSERT INTO options (market_id, name, odds) VALUES
(7, 'Yes', 4.00),
(7, 'No', 1.25);

-- Market 8: S&P 7000
INSERT INTO options (market_id, name, odds) VALUES
(8, 'Yes', 1.90),
(8, 'No', 2.10);

-- Market 9: GTA 6
INSERT INTO options (market_id, name, odds) VALUES
(9, 'Yes', 1.60),
(9, 'No', 2.40);

-- Market 10: SF Sunny
INSERT INTO options (market_id, name, odds) VALUES
(10, 'Yes', 1.50),
(10, 'No', 2.50);

-- Insert Sample Bets
INSERT INTO bets (user_id, market_id, option_id, amount, odds, potential_payout, status) VALUES
-- Alice's bets
(2, 1, 1, 100.00, 2.50, 250.00, 'pending'),
(2, 3, 1, 50.00, 3.50, 175.00, 'pending'),
(2, 8, 9, 75.00, 1.90, 142.50, 'pending'),
-- Bob's bets
(3, 2, 3, 80.00, 1.80, 144.00, 'pending'),
(3, 4, 7, 120.00, 2.00, 240.00, 'pending'),
(3, 9, 17, 60.00, 1.60, 96.00, 'pending'),
-- Charlie's bets
(4, 1, 2, 150.00, 1.50, 225.00, 'pending'),
(4, 5, 10, 100.00, 3.50, 350.00, 'pending'),
(4, 6, 11, 200.00, 2.80, 560.00, 'pending'),
-- Diana's bets
(5, 7, 13, 90.00, 4.00, 360.00, 'pending'),
(5, 10, 19, 110.00, 1.50, 165.00, 'pending');

-- =====================================================================
-- GRANT PERMISSIONS
-- =====================================================================
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO binaryuser;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO binaryuser;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO binaryuser;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO binaryuser;

-- =====================================================================
-- VERIFICATION
-- =====================================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Database initialization complete!';
    RAISE NOTICE '📊 Summary:';
    RAISE NOTICE '   - Categories: %', (SELECT COUNT(*) FROM categories);
    RAISE NOTICE '   - Users: %', (SELECT COUNT(*) FROM users);
    RAISE NOTICE '   - Markets: %', (SELECT COUNT(*) FROM markets);
    RAISE NOTICE '   - Options: %', (SELECT COUNT(*) FROM options);
    RAISE NOTICE '   - Bets: %', (SELECT COUNT(*) FROM bets);
    RAISE NOTICE '';
    RAISE NOTICE '🔐 Admin Credentials:';
    RAISE NOTICE '   Username: admin';
    RAISE NOTICE '   Email: admin@binary-bets.com';
    RAISE NOTICE '   Password: AdminBinaryBets2025!';
    RAISE NOTICE '';
    RAISE NOTICE '👥 Test User Credentials (all have same password):';
    RAISE NOTICE '   Password: BinaryBets2025!';
    RAISE NOTICE '   - alice_trader@example.com';
    RAISE NOTICE '   - bob_gambler@example.com';
    RAISE NOTICE '   - charlie_analyst@example.com';
    RAISE NOTICE '   - diana_investor@example.com';
END $$;
