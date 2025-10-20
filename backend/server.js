import express from 'express';
import cors from 'cors';
import pg from 'pg';
import fetch from 'node-fetch';

const { Pool } = pg;
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://binaryuser:binarypass@postgres:5432/binarybets',
  ssl: false
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Database connected successfully!');
  }
});

// AUTHENTICATION
app.post('/api/auth/register', async (req, res) => {
  const { email, password, username, fullName } = req.body;
  try {
    const existingUser = await pool.query(
      'SELECT * FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User or username already exists' });
    }
    const result = await pool.query(
      'INSERT INTO users (email, password, username, full_name, balance, email_verified) VALUES ($1, $2, $3, $4, 10000, true) RETURNING id, email, username, full_name, balance, is_admin',
      [email, password, username, fullName]
    );
    res.json({ user: result.rows[0], message: 'Registration successful!' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query(
      'SELECT id, email, username, full_name, balance, is_admin FROM users WHERE email = $1 AND password = $2',
      [email, password]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// MARKETS
app.get('/api/markets', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        m.*,
        c.name as category_name,
        c.color as category_color,
        COALESCE(json_agg(
          json_build_object(
            'id', mo.id,
            'option_text', mo.option_text,
            'odds', mo.odds,
            'option_order', mo.option_order,
            'bet_count', (SELECT COUNT(*) FROM bets b WHERE b.market_option_id = mo.id)
          ) ORDER BY mo.option_order
        ) FILTER (WHERE mo.id IS NOT NULL), '[]') as options
      FROM markets m
      LEFT JOIN categories c ON m.category_id = c.id
      LEFT JOIN market_options mo ON m.id = mo.market_id
      GROUP BY m.id, c.name, c.color
      ORDER BY m.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching markets:', error);
    res.status(500).json({ error: 'Failed to fetch markets' });
  }
});

app.post('/api/markets', async (req, res) => {
  const { question, description, deadline, category_id, market_type, yes_odds, no_odds, options } = req.body;
  try {
    const marketResult = await pool.query(
      'INSERT INTO markets (question, description, deadline, category_id, market_type) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [question, description, deadline, category_id, market_type]
    );
    const market = marketResult.rows[0];
    if (market_type === 'binary') {
      await pool.query(
        'INSERT INTO market_options (market_id, option_text, odds, option_order) VALUES ($1, $2, $3, 1), ($1, $4, $5, 2)',
        [market.id, 'YES', yes_odds, 'NO', no_odds]
      );
    } else if (market_type === 'multi-choice' && options) {
      for (let i = 0; i < options.length; i++) {
        await pool.query(
          'INSERT INTO market_options (market_id, option_text, odds, option_order) VALUES ($1, $2, $3, $4)',
          [market.id, options[i].text, options[i].odds, i + 1]
        );
      }
    }
    res.json(market);
  } catch (error) {
    console.error('Error creating market:', error);
    res.status(500).json({ error: 'Failed to create market' });
  }
});

// Add this right after the existing /api/calculate-odds endpoint
app.post('/api/markets/calculate-odds', async (req, res) => {
  const { question, options } = req.body;
  try {
    let calculatedOdds;
    if (options.length === 2) {
      calculatedOdds = { yes: 2.0, no: 2.0 };
    } else {
      const baseOdds = options.length;
      calculatedOdds = {
        options: options.map(opt => ({
          text: opt,
          odds: baseOdds + Math.random() * 0.5
        }))
      };
    }
    res.json(calculatedOdds);
  } catch (error) {
    console.error('Error calculating odds:', error);
    res.status(500).json({ error: 'Failed to calculate odds' });
  }
});
app.post('/api/markets/:marketId/resolve', async (req, res) => {
  const { marketId } = req.params;
  const { winning_option_id } = req.body;
  try {
    await pool.query(
      'UPDATE markets SET resolved = true, winning_option_id = $1 WHERE id = $2',
      [winning_option_id, marketId]
    );
    const winningBets = await pool.query(
      'SELECT b.*, u.email, u.username FROM bets b JOIN users u ON b.user_id = u.id WHERE b.market_id = $1 AND b.market_option_id = $2',
      [marketId, winning_option_id]
    );
    for (const bet of winningBets.rows) {
      const winnings = bet.amount * bet.odds;
      await pool.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [winnings, bet.user_id]);
    }
    res.json({ message: 'Market resolved successfully', winners_count: winningBets.rows.length });
  } catch (error) {
    console.error('Error resolving market:', error);
    res.status(500).json({ error: 'Failed to resolve market' });
  }
});

app.get('/api/markets/:marketId/verification-data', async (req, res) => {
  const { marketId } = req.params;
  try {
    const market = await pool.query('SELECT * FROM markets WHERE id = $1', [marketId]);
    if (market.rows.length === 0) {
      return res.status(404).json({ error: 'Market not found' });
    }
    res.json({ news_articles: [], data_sources: [], suggested_outcome: null, confidence: 0 });
  } catch (error) {
    console.error('Error fetching verification data:', error);
    res.status(500).json({ error: 'Failed to fetch verification data' });
  }
});

// BETS
app.post('/api/bets', async (req, res) => {
  const { user_id, market_id, market_option_id, amount, odds } = req.body;
  try {
    const userResult = await pool.query('SELECT balance FROM users WHERE id = $1', [user_id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const balance = parseFloat(userResult.rows[0].balance);
    if (balance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    await pool.query('BEGIN');
    await pool.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [amount, user_id]);
    const betResult = await pool.query(
      'INSERT INTO bets (user_id, market_id, market_option_id, amount, odds) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [user_id, market_id, market_option_id, amount, odds]
    );
    await pool.query('COMMIT');
    res.json(betResult.rows[0]);
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error placing bet:', error);
    res.status(500).json({ error: 'Failed to place bet' });
  }
});

app.post('/api/bets/:betId/cancel', async (req, res) => {
  const { betId } = req.params;
  const { user_id } = req.body;
  try {
    const betResult = await pool.query('SELECT * FROM bets WHERE id = $1 AND user_id = $2', [betId, user_id]);
    if (betResult.rows.length === 0) {
      return res.status(404).json({ error: 'Bet not found' });
    }
    const bet = betResult.rows[0];
    const refundAmount = bet.amount * 0.95;
    await pool.query('BEGIN');
    await pool.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [refundAmount, user_id]);
    await pool.query('DELETE FROM bets WHERE id = $1', [betId]);
    await pool.query('COMMIT');
    res.json({ message: 'Bet cancelled', refund: refundAmount });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error cancelling bet:', error);
    res.status(500).json({ error: 'Failed to cancel bet' });
  }
});

app.get('/api/users/:userId/bets', async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await pool.query(`
      SELECT 
        b.*,
        m.question,
        m.resolved,
        m.winning_option_id,
        mo.option_text,
        c.name as category_name,
        CASE 
          WHEN m.resolved AND m.winning_option_id = b.market_option_id THEN 'won'
          WHEN m.resolved THEN 'lost'
          ELSE 'active'
        END as status
      FROM bets b
      JOIN markets m ON b.market_id = m.id
      JOIN market_options mo ON b.market_option_id = mo.id
      LEFT JOIN categories c ON m.category_id = c.id
      WHERE b.user_id = $1
      ORDER BY b.created_at DESC
    `, [userId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching user bets:', error);
    res.status(500).json({ error: 'Failed to fetch bets' });
  }
});

// USERS
app.get('/api/users/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await pool.query(
      'SELECT id, email, username, full_name, balance, is_admin, created_at FROM users WHERE id = $1',
      [userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

app.get('/api/leaderboard', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id,
        username,
        balance,
        (SELECT COUNT(*) FROM bets WHERE user_id = users.id) as total_bets,
        (SELECT COUNT(*) FROM bets b JOIN markets m ON b.market_id = m.id WHERE b.user_id = users.id AND m.resolved = true AND m.winning_option_id = b.market_option_id) as wins
      FROM users
      ORDER BY balance DESC
      LIMIT 10
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

app.get('/api/categories', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categories ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Backend server running on port ${PORT}`);
  console.log(`🚀 API available at http://localhost:${PORT}/api`);
});
