import express from 'express';
import cors from 'cors';
import pool from './db.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ============ AUTH ROUTES ============

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND password = $2',
      [email, password]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      isAdmin: user.is_admin,
      balance: parseFloat(user.balance),
      totalWinnings: parseFloat(user.total_winnings),
      betsWon: user.bets_won
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Sign up
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    const existing = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    
    const result = await pool.query(
      'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING *',
      [name, email, password]
    );
    
    const user = result.rows[0];
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      isAdmin: user.is_admin,
      balance: parseFloat(user.balance),
      totalWinnings: parseFloat(user.total_winnings),
      betsWon: user.bets_won
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ USER ROUTES ============

// Get user balance
app.get('/api/users/:userId/balance', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query('SELECT balance FROM users WHERE id = $1', [userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ balance: parseFloat(result.rows[0].balance) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ MARKET ROUTES ============

// Get all markets
app.get('/api/markets', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM markets WHERE status = $1 ORDER BY id', ['active']);
    res.json(result.rows.map(m => ({
      id: m.id,
      question: m.question,
      category: m.category,
      yesOdds: parseFloat(m.yes_odds),
      noOdds: parseFloat(m.no_odds),
      deadline: m.deadline,
      status: m.status
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create market (admin only)
app.post('/api/markets', async (req, res) => {
  try {
    const { question, category, yesOdds, noOdds, deadline } = req.body;
    
    const result = await pool.query(
      'INSERT INTO markets (question, category, yes_odds, no_odds, deadline) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [question, category, yesOdds, noOdds, deadline]
    );
    
    const market = result.rows[0];
    res.json({
      id: market.id,
      question: market.question,
      category: market.category,
      yesOdds: parseFloat(market.yes_odds),
      noOdds: parseFloat(market.no_odds),
      deadline: market.deadline,
      status: market.status
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ BET ROUTES ============

// Get user's bets
app.get('/api/users/:userId/bets', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query(
      `SELECT b.*, m.question as market_question 
       FROM bets b 
       JOIN markets m ON b.market_id = m.id 
       WHERE b.user_id = $1 
       ORDER BY b.created_at DESC`,
      [userId]
    );
    
    res.json(result.rows.map(b => ({
      id: b.id,
      market: b.market_question,
      choice: b.choice,
      amount: parseFloat(b.amount),
      odds: parseFloat(b.odds),
      potentialWin: parseFloat(b.potential_win),
      status: b.status,
      createdAt: b.created_at
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Place a bet
app.post('/api/bets', async (req, res) => {
  try {
    const { userId, marketId, choice, amount, odds, potentialWin } = req.body;
    
    // Check user balance
    const userResult = await pool.query('SELECT balance FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const balance = parseFloat(userResult.rows[0].balance);
    if (balance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    // Start transaction
    await pool.query('BEGIN');
    
    // Deduct balance
    await pool.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [amount, userId]);
    
    // Create bet
    const betResult = await pool.query(
      'INSERT INTO bets (user_id, market_id, choice, amount, odds, potential_win) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [userId, marketId, choice, amount, odds, potentialWin]
    );
    
    await pool.query('COMMIT');
    
    const bet = betResult.rows[0];
    res.json({
      id: bet.id,
      userId: bet.user_id,
      marketId: bet.market_id,
      choice: bet.choice,
      amount: parseFloat(bet.amount),
      odds: parseFloat(bet.odds),
      potentialWin: parseFloat(bet.potential_win),
      status: bet.status
    });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ LEADERBOARD ROUTES ============

// Get leaderboard
app.get('/api/leaderboard', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, total_winnings, bets_won FROM users WHERE total_winnings > 0 ORDER BY total_winnings DESC LIMIT 20'
    );
    
    res.json(result.rows.map(u => ({
      id: u.id,
      name: u.name,
      winnings: parseFloat(u.total_winnings),
      betsWon: u.bets_won
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
