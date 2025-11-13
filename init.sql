-- Binary Bets Database Schema
-- Complete schema with all features

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    balance DECIMAL(10, 2) DEFAULT 1000.00,
    is_admin BOOLEAN DEFAULT FALSE,
    email_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(255),
    reset_token VARCHAR(255),
    reset_token_expires TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Markets table
CREATE TABLE IF NOT EXISTS markets (
    id SERIAL PRIMARY KEY,
    question TEXT NOT NULL,
    description TEXT,
    created_by INTEGER REFERENCES users(id),
    deadline TIMESTAMP NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'open', 'closed', 'resolved')),
    outcome VARCHAR(255),
    resolved_at TIMESTAMP,
    category_id INTEGER REFERENCES categories(id),
    image_url TEXT,
    is_multi_choice BOOLEAN DEFAULT FALSE,
    skip_ai_resolution BOOLEAN DEFAULT FALSE,
    closed_early BOOLEAN DEFAULT FALSE,
    closed_early_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Options table (for multi-choice markets)
CREATE TABLE IF NOT EXISTS options (
    id SERIAL PRIMARY KEY,
    market_id INTEGER REFERENCES markets(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bets table
CREATE TABLE IF NOT EXISTS bets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    market_id INTEGER REFERENCES markets(id),
    option_id INTEGER REFERENCES options(id),
    amount DECIMAL(10, 2) NOT NULL,
    odds DECIMAL(10, 2) NOT NULL,
    potential_payout DECIMAL(10, 2) NOT NULL,
    payout DECIMAL(10, 2) DEFAULT 0,
    paid_out BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Announcements table
CREATE TABLE IF NOT EXISTS announcements (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Market reports table
CREATE TABLE IF NOT EXISTS market_reports (
    id SERIAL PRIMARY KEY,
    market_id INTEGER REFERENCES markets(id) ON DELETE CASCADE,
    reported_by INTEGER REFERENCES users(id),
    reason TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
    reviewed_by INTEGER REFERENCES users(id),
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Market restoration requests table
CREATE TABLE IF NOT EXISTS market_restoration_requests (
    id SERIAL PRIMARY KEY,
    original_market_id INTEGER REFERENCES markets(id),
    user_id INTEGER REFERENCES users(id),
    market_data JSONB NOT NULL,
    bets_data JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Resolver logs table
CREATE TABLE IF NOT EXISTS resolver_logs (
    id SERIAL PRIMARY KEY,
    market_id INTEGER REFERENCES markets(id) ON DELETE CASCADE,
    market_question TEXT NOT NULL,
    decision VARCHAR(20) NOT NULL,
    outcome VARCHAR(255),
    confidence INTEGER,
    reasoning TEXT,
    ai_provider VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_markets_status ON markets(status);
CREATE INDEX IF NOT EXISTS idx_markets_deadline ON markets(deadline);
CREATE INDEX IF NOT EXISTS idx_markets_category ON markets(category_id);
CREATE INDEX IF NOT EXISTS idx_bets_user ON bets(user_id);
CREATE INDEX IF NOT EXISTS idx_bets_market ON bets(market_id);
CREATE INDEX IF NOT EXISTS idx_options_market ON options(market_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON market_reports(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_resolver_logs_created_at ON resolver_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_resolver_logs_market_id ON resolver_logs(market_id);

-- Insert default categories
INSERT INTO categories (name, description) VALUES
    ('Politics', 'Political events and elections'),
    ('Sports', 'Sports events and outcomes'),
    ('Technology', 'Technology and innovation'),
    ('Economics', 'Economic indicators and markets'),
    ('Entertainment', 'Movies, TV, and celebrity news'),
    ('Science', 'Scientific discoveries and research'),
    ('Weather', 'Weather and climate events'),
    ('Crypto', 'Cryptocurrency and blockchain'),
    ('Business', 'Business and corporate events'),
    ('Other', 'Miscellaneous predictions')
ON CONFLICT (name) DO NOTHING;

-- Create admin user (password: admin123)
INSERT INTO users (username, email, password_hash, balance, is_admin, email_verified) 
VALUES ('admin', 'admin@binary-bets.com', '$2b$10$rZ5YqH5vZKjX8qVW5xqLj.8KvhG3jFz5qLf4Y7sJK5mHnO8nE9XYS', 10000.00, TRUE, TRUE)
ON CONFLICT (username) DO NOTHING;

-- Success message
SELECT 'Database initialized successfully!' as status;
