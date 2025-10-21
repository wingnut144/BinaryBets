-- Drop existing tables if they exist
DROP TABLE IF EXISTS bets CASCADE;
DROP TABLE IF EXISTS market_options CASCADE;
DROP TABLE IF EXISTS markets CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Create categories table
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    color VARCHAR(20) DEFAULT 'blue',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    balance DECIMAL(10,2) DEFAULT 10000,
    is_admin BOOLEAN DEFAULT FALSE,
    email_verified BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create markets table
CREATE TABLE markets (
    id SERIAL PRIMARY KEY,
    question TEXT NOT NULL,
    market_type VARCHAR(20) NOT NULL CHECK (market_type IN ('binary', 'multi-choice')),
    yes_odds DECIMAL(10,2),
    no_odds DECIMAL(10,2),
    category_id INTEGER REFERENCES categories(id),
    deadline TIMESTAMP NOT NULL,
    resolved BOOLEAN DEFAULT FALSE,
    winning_option_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create market_options table
CREATE TABLE market_options (
    id SERIAL PRIMARY KEY,
    market_id INTEGER REFERENCES markets(id) ON DELETE CASCADE,
    option_text VARCHAR(255) NOT NULL,
    odds DECIMAL(10,2) NOT NULL,
    option_order INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create bets table
CREATE TABLE bets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    market_id INTEGER REFERENCES markets(id),
    market_option_id INTEGER REFERENCES market_options(id),
    amount DECIMAL(10,2) NOT NULL,
    odds DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default categories
INSERT INTO categories (name, color) VALUES
('Finance', 'green'),
('Weather', 'blue'),
('Technology', 'purple'),
('Science', 'orange'),
('Sports', 'red'),
('Economics', 'yellow');

-- Create admin user
INSERT INTO users (email, password, username, full_name, balance, is_admin, email_verified) VALUES
('admin@binarybets.com', '$2b$10$8wrFBTdi3EeQZqwJf5LjxeXwb9WkAZi7E7tCRjIPUblI9oDfxsqcW', 'admin', 'Admin User', 10000, true, true) ON CONFLICT (email) DO NOTHING;

-- Create sample users
INSERT INTO users (email, password, username, full_name, balance, email_verified) VALUES
('alice@example.com', 'password123', 'cryptoqueen', 'Alice Johnson', 15000, true),
('bob@example.com', 'password123', 'betmaster', 'Bob Smith', 12500, true),
('charlie@example.com', 'password123', 'trader_charlie', 'Charlie Brown', 8000, true);

-- Insert sample binary markets
INSERT INTO markets (question, market_type, yes_odds, no_odds, category_id, deadline) VALUES
('Will Bitcoin reach $100,000 by end of 2025?', 'binary', 2.50, 1.50, 1, '2025-12-31 23:59:59'),
('Will it snow in Miami this winter?', 'binary', 10.00, 1.10, 2, '2025-03-20 23:59:59'),
('Will the next iPhone have a foldable screen?', 'binary', 3.00, 1.40, 3, '2025-09-30 23:59:59'),
('Will Ethereum surpass $5,000 in 2025?', 'binary', 2.20, 1.60, 1, '2025-12-31 23:59:59'),
('Will NASA announce a manned Mars mission date?', 'binary', 4.00, 1.25, 4, '2025-12-31 23:59:59'),
('Will unemployment rate drop below 3% in US?', 'binary', 3.50, 1.30, 6, '2025-12-31 23:59:59');

-- Insert sample multi-choice markets
INSERT INTO markets (question, market_type, category_id, deadline) VALUES
('Where will the next major US meteor impact be reported?', 'multi-choice', 4, '2026-06-30 23:59:59'),
('Which US state will experience the strongest earthquake in 2025?', 'multi-choice', 4, '2025-12-31 23:59:59'),
('Which company will reach $4 trillion market cap first?', 'multi-choice', 1, '2026-12-31 23:59:59');

-- Insert options for multi-choice markets
-- Market 7: Meteor impact locations
INSERT INTO market_options (market_id, option_text, odds, option_order) VALUES
(7, 'California', 2.5, 1),
(7, 'Texas', 3.0, 2),
(7, 'Arizona', 4.0, 3),
(7, 'Nevada', 5.0, 4);

-- Market 8: Earthquake locations
INSERT INTO market_options (market_id, option_text, odds, option_order) VALUES
(8, 'California', 1.8, 1),
(8, 'Alaska', 2.5, 2),
(8, 'Oklahoma', 6.0, 3),
(8, 'Hawaii', 3.5, 4);

-- Market 9: Company market cap
INSERT INTO market_options (market_id, option_text, odds, option_order) VALUES
(9, 'Apple', 2.0, 1),
(9, 'Microsoft', 2.2, 2),
(9, 'NVIDIA', 3.5, 3),
(9, 'Amazon', 4.0, 4);

-- Add some sample bets
INSERT INTO bets (user_id, market_id, market_option_id, amount, odds) VALUES
(2, 1, NULL, 100, 2.50),  -- Alice bets on Bitcoin YES
(3, 1, NULL, 200, 1.50),  -- Bob bets on Bitcoin NO
(4, 2, NULL, 50, 10.00);  -- Charlie bets on Miami snow YES

ANALYZE;
