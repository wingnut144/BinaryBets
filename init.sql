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

-- Categories table
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Betting markets table (FIXED - added missing commas)
CREATE TABLE markets (
    id SERIAL PRIMARY KEY,
    question TEXT NOT NULL,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    market_type VARCHAR(20) DEFAULT 'binary' CHECK (market_type IN ('binary', 'multi-choice')),
    yes_odds DECIMAL(5, 2),
    no_odds DECIMAL(5, 2),
    deadline TIMESTAMP NOT NULL,
    resolved BOOLEAN DEFAULT FALSE,
    winning_option_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Market options table (for multi-choice markets)
CREATE TABLE market_options (
  id SERIAL PRIMARY KEY,
  market_id INTEGER REFERENCES markets(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  odds DECIMAL(5, 2) NOT NULL,
  option_order INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bets table
CREATE TABLE bets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    market_id INTEGER REFERENCES markets(id) ON DELETE CASCADE,
    market_option_id INTEGER REFERENCES market_options(id),  
    choice VARCHAR(10),
    amount DECIMAL(10, 2) NOT NULL,
    odds DECIMAL(5, 2) NOT NULL,
    potential_win DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'won', 'lost', 'cancelled')),
    cancelled_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default categories
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

-- Insert binary betting markets (FIXED - proper TIMESTAMP format)
INSERT INTO markets (question, category_id, market_type, yes_odds, no_odds, deadline) VALUES
('Will the S&P 500 close above 6000 by end of 2025?', 1, 'binary', 1.85, 2.10, '2025-12-31 23:59:59'),
('Will it snow in New York City this December?', 2, 'binary', 1.50, 2.75, '2025-12-31 23:59:59'),
('Will a new Star Wars movie be announced in 2025?', 3, 'binary', 2.20, 1.70, '2025-12-31 23:59:59'),
('Will Bitcoin reach $150,000 by end of Q1 2026?', 4, 'binary', 3.50, 1.35, '2026-03-31 23:59:59'),
('Will the Lakers make the NBA playoffs this season?', 5, 'binary', 1.65, 2.40, '2026-04-15 23:59:59'),
('Will unemployment rate in US be below 4% in December 2025?', 6, 'binary', 1.90, 2.00, '2025-12-31 23:59:59');

-- Insert multi-choice betting markets
INSERT INTO markets (question, category_id, market_type, deadline) VALUES
('Where will the next major US meteor impact be reported?', 9, 'multi-choice', '2026-06-30 23:59:59'),
('Which US state will experience the strongest earthquake in 2025?', 9, 'multi-choice', '2025-12-31 23:59:59'),
('Which company will reach $4 trillion market cap first?', 1, 'multi-choice', '2026-12-31 23:59:59');

-- Insert options for multi-choice market 7 (meteor impact)
INSERT INTO market_options (market_id, option_text, odds, option_order) VALUES
(7, 'California', 2.5, 1),
(7, 'Texas', 3.0, 2),
(7, 'Arizona', 4.0, 3),
(7, 'Nevada', 5.0, 4);

-- Insert options for multi-choice market 8 (earthquake)
INSERT INTO market_options (market_id, option_text, odds, option_order) VALUES
(8, 'California', 1.8, 1),
(8, 'Alaska', 2.5, 2),
(8, 'Oklahoma', 6.0, 3),
(8, 'Hawaii', 3.5, 4);

-- Insert options for multi-choice market 9 (company market cap)
INSERT INTO market_options (market_id, option_text, odds, option_order) VALUES
(9, 'Apple', 2.0, 1),
(9, 'Microsoft', 2.2, 2),
(9, 'NVIDIA', 3.5, 3),
(9, 'Amazon', 4.0, 4);

-- Create indexes for performance
CREATE INDEX idx_bets_user_id ON bets(user_id);
CREATE INDEX idx_bets_market_id ON bets(market_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_markets_category_id ON markets(category_id);
CREATE INDEX idx_markets_deadline ON markets(deadline);
