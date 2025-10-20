-- Create users table with email verification
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,     -- ADD THIS LINE
    full_name VARCHAR(255) NOT NULL,          -- ADD THIS LINE
    balance DECIMAL(10,2) DEFAULT 10000,
    is_admin BOOLEAN DEFAULT FALSE,
    email_verified BOOLEAN DEFAULT TRUE,      -- ADD THIS LINE
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create categories table
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    color VARCHAR(20) DEFAULT 'blue',  -- ADD THIS LINE
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create markets table (supports both binary and multi-choice)
CREATE TABLE markets (
  id SERIAL PRIMARY KEY,
  question TEXT NOT NULL,
  market_type VARCHAR(20) DEFAULT 'binary' CHECK (market_type IN ('binary', 'multi-choice')),
  yes_odds DECIMAL(5, 2),
  no_odds DECIMAL(5, 2),
  category_id INTEGER REFERENCES categories(id),
  deadline TIMESTAMP NOT NULL,
  resolved BOOLEAN DEFAULT FALSE,
  winning_option_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for multi-choice market options
CREATE TABLE market_options (
  id SERIAL PRIMARY KEY,
  market_id INTEGER REFERENCES markets(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  odds DECIMAL(5, 2) NOT NULL,
  option_order INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create bets table
CREATE TABLE bets (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  market_id INTEGER REFERENCES markets(id),
  choice VARCHAR(10),
  market_option_id INTEGER REFERENCES market_options(id),
  amount DECIMAL(10, 2) NOT NULL,
  odds DECIMAL(5, 2) NOT NULL,
  potential_win DECIMAL(10, 2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'won', 'lost', 'cancelled')),
  cancelled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert admin user (pre-verified)
INSERT INTO users (username, name, email, password, is_admin, email_verified, balance) VALUES
('admin', 'Administrator', 'admin@binarybets.com', 'admin123', TRUE, TRUE, 50000.00);

-- Insert default categories
INSERT INTO categories (name) VALUES
('Finance'),
('Weather'),
('Technology'),
('Science'),
('Sports'),
('Economics');

-- Insert sample binary markets
INSERT INTO markets (question, market_type, yes_odds, no_odds, category_id, deadline) VALUES
('Will Bitcoin reach $100,000 by end of 2025?', 'binary', 2.5, 1.5, 1, '2025-12-31 23:59:59'),
('Will it snow in Miami this winter?', 'binary', 10.0, 1.1, 2, '2025-03-20 23:59:59'),
('Will the next iPhone have a foldable screen?', 'binary', 3.0, 1.4, 3, '2025-09-30 23:59:59'),
('Will Ethereum surpass $5,000 in 2025?', 'binary', 2.2, 1.6, 1, '2025-12-31 23:59:59'),
('Will NASA announce a manned Mars mission date?', 'binary', 4.0, 1.25, 4, '2025-12-31 23:59:59'),
('Will unemployment rate drop below 3% in US?', 'binary', 3.5, 1.3, 6, '2025-12-31 23:59:59');

-- Insert sample multi-choice markets
INSERT INTO markets (question, market_type, category_id, deadline) VALUES
('Where will the next major US meteor impact be reported?', 'multi-choice', 4, '2026-06-30 23:59:59'),
('Which US state will experience the strongest earthquake in 2025?', 'multi-choice', 4, '2025-12-31 23:59:59'),
('Which company will reach $4 trillion market cap first?', 'multi-choice', 1, '2026-12-31 23:59:59');

-- Insert options for multi-choice markets
INSERT INTO market_options (market_id, option_text, odds, option_order) VALUES
(7, 'California', 2.5, 1),
(7, 'Texas', 3.0, 2),
(7, 'Arizona', 4.0, 3),
(7, 'Nevada', 5.0, 4);

INSERT INTO market_options (market_id, option_text, odds, option_order) VALUES
(8, 'California', 1.8, 1),
(8, 'Alaska', 2.5, 2),
(8, 'Oklahoma', 6.0, 3),
(8, 'Hawaii', 3.5, 4);

INSERT INTO market_options (market_id, option_text, odds, option_order) VALUES
(9, 'Apple', 2.0, 1),
(9, 'Microsoft', 2.2, 2),
(9, 'NVIDIA', 3.5, 3),
(9, 'Amazon', 4.0, 4);

-- Insert demo users for leaderboard (all verified)
INSERT INTO users (username, name, email, password, email_verified, balance, total_winnings, bets_won) VALUES
('cryptoqueen', 'Sarah Chen', 'sarah@example.com', 'password123', TRUE, 57850.00, 47850.00, 32),
('betmaster', 'Marcus Rivera', 'marcus@example.com', 'password123', TRUE, 53200.00, 43200.00, 28),
('alexthegreat', 'Alex Thompson', 'alex@example.com', 'password123', TRUE, 49500.00, 39500.00, 25),
('jamieliu', 'Jamie Liu', 'jamie@example.com', 'password123', TRUE, 45700.00, 35700.00, 22),
('taylorwins', 'Taylor Brooks', 'taylor@example.com', 'password123', TRUE, 41200.00, 31200.00, 19),
('jordanbet', 'Jordan Martinez', 'jordan@example.com', 'password123', TRUE, 38900.00, 28900.00, 17),
('caseyace', 'Casey Anderson', 'casey@example.com', 'password123', TRUE, 35600.00, 25600.00, 15),
('rileypro', 'Riley Johnson', 'riley@example.com', 'password123', TRUE, 32100.00, 22100.00, 13);

-- Create indexes for performance
CREATE INDEX idx_bets_user_id ON bets(user_id);
CREATE INDEX idx_bets_market_id ON bets(market_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_verification_token ON users(verification_token);
CREATE INDEX idx_markets_category_id ON markets(category_id);
CREATE INDEX idx_markets_deadline ON markets(deadline);
