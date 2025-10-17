-- Users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  avatar VARCHAR(500) DEFAULT 'https://ui-avatars.com/api/?name=User&background=random',
  is_admin BOOLEAN DEFAULT FALSE,
  balance DECIMAL(10, 2) DEFAULT 10000.00,
  total_winnings DECIMAL(10, 2) DEFAULT 0,
  bets_won INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Categories table (NEW)
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Betting markets table (MODIFIED - now uses category_id)
CREATE TABLE markets (
    id SERIAL PRIMARY KEY,
    question TEXT NOT NULL,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    yes_odds DECIMAL(5, 2) NOT NULL,
    no_odds DECIMAL(5, 2) NOT NULL,
    deadline VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bets table (MODIFIED - added cancelled_at)
CREATE TABLE bets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    market_id INTEGER REFERENCES markets(id) ON DELETE CASCADE,
    choice VARCHAR(10) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    odds DECIMAL(5, 2) NOT NULL,
    potential_win DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    penalty_fee DECIMAL(10, 2) DEFAULT 0.00,
    cancelled_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default categories (NEW)
INSERT INTO categories (name) VALUES
('Finance'),
('Weather'),
('Entertainment'),
('Crypto'),
('Sports'),
('Economics'),
('Politics'),
('Technology'),
('Science'),
('Other');

-- Insert default admin user (password: admin123)
INSERT INTO users (name, email, password, is_admin, balance) 
VALUES ('Administrator', 'admin@binarybets.com', 'admin123', TRUE, 50000.00);

-- Insert some demo users for leaderboard
INSERT INTO users (name, email, password, balance, total_winnings, bets_won) VALUES
('Sarah Chen', 'sarah@example.com', 'password123', 57850.00, 47850.00, 32),
('Marcus Rivera', 'marcus@example.com', 'password123', 53200.00, 43200.00, 28),
('Alex Thompson', 'alex@example.com', 'password123', 49500.00, 39500.00, 25),
('Jamie Liu', 'jamie@example.com', 'password123', 45700.00, 35700.00, 22),
('Taylor Brooks', 'taylor@example.com', 'password123', 41200.00, 31200.00, 19),
('Jordan Martinez', 'jordan@example.com', 'password123', 38900.00, 28900.00, 17),
('Casey Anderson', 'casey@example.com', 'password123', 35600.00, 25600.00, 15),
('Riley Johnson', 'riley@example.com', 'password123', 32100.00, 22100.00, 13);

-- Insert default betting markets (MODIFIED - now uses category_id)
INSERT INTO markets (question, category_id, yes_odds, no_odds, deadline) VALUES
('Will the S&P 500 close above 6000 by end of 2025?', 1, 1.85, 2.10, 'Dec 31, 2025'),
('Will it snow in New York City this December?', 2, 1.50, 2.75, 'Dec 31, 2025'),
('Will a new Star Wars movie be announced in 2025?', 3, 2.20, 1.70, 'Dec 31, 2025'),
('Will Bitcoin reach $150,000 by end of Q1 2026?', 4, 3.50, 1.35, 'Mar 31, 2026'),
('Will the Lakers make the NBA playoffs this season?', 5, 1.65, 2.40, 'Apr 15, 2026'),
('Will unemployment rate in US be below 4% in December 2025?', 6, 1.90, 2.00, 'Dec 31, 2025');

-- Create indexes for performance
CREATE INDEX idx_bets_user_id ON bets(user_id);
CREATE INDEX idx_bets_market_id ON bets(market_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_markets_category_id ON markets(category_id);
CREATE INDEX idx_markets_status ON markets(status);
