import express from 'express';
import cors from 'cors';
import pkg from 'pg';
const { Pool } = pkg;
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
const pool = new Pool({
  host: process.env.POSTGRES_HOST || process.env.DB_HOST || 'postgres',
  port: process.env.POSTGRES_PORT || process.env.DB_PORT || 5432,
  database: process.env.POSTGRES_DB || process.env.DB_NAME || 'binarybets',
  user: process.env.POSTGRES_USER || process.env.DB_USER || 'binaryuser',
  password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || 'binarypass'
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection error:', err);
  } else {
    console.log('✅ Database connected:', res.rows[0].now);
  }
});

// Check AI service configuration
if (process.env.CLAUDE_API_KEY) {
  console.log('✅ Claude AI enabled');
}
if (process.env.OPENAI_API_KEY) {
  console.log('✅ ChatGPT enabled');
}

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// ============================================
// AUTH ROUTES
// ============================================

// Register new user
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validate input
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ error: 'Username must be 3-20 characters' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if username already exists
    const usernameCheck = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );

    if (usernameCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    // Check if email already exists
    const emailCheck = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash, balance, role) 
       VALUES ($1, $2, $3, 1000, 'user') 
       RETURNING id, username, email, balance, role, created_at`,
      [username, email, hashedPassword]
    );

    const user = result.rows[0];
    user.balance = parseFloat(user.balance) || 0;

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        balance: user.balance,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login user
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    // Find user
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Convert balance to number
    user.balance = parseFloat(user.balance) || 0;

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        balance: user.balance,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, email, balance, role, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    user.balance = parseFloat(user.balance) || 0;

    res.json({ user });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

// ============================================
// CATEGORY ROUTES
// ============================================

// Get all categories with subcategories
app.get('/api/categories', async (req, res) => {
  try {
    // Get categories
    const categoriesResult = await pool.query(`
      SELECT id, name, description, icon, color, created_at 
      FROM categories 
      ORDER BY name
    `);

    const categories = categoriesResult.rows;

    // Get subcategories for each category
    for (let category of categories) {
      try {
        const subcategoriesResult = await pool.query(
          'SELECT id, name, category_id FROM subcategories WHERE category_id = $1 ORDER BY name',
          [category.id]
        );
        category.subcategories = subcategoriesResult.rows;
      } catch (err) {
        // If subcategories table doesn't exist, just set empty array
        category.subcategories = [];
      }
    }

    res.json({ categories });

  } catch (error) {
    console.error('Categories fetch error:', error);
    // Return empty array if categories table doesn't exist
    res.json({ categories: [] });
  }
});

// ============================================
// MARKET ROUTES
// ============================================

// Get all markets with options
app.get('/api/markets', async (req, res) => {
  try {
    // Simple approach: get markets first, then add options and stats
    const marketsResult = await pool.query(`
      SELECT * FROM markets 
      WHERE status = 'active' OR status = 'resolved'
      ORDER BY created_at DESC
    `);

    const markets = [];

    for (const market of marketsResult.rows) {
      // Get options for this market
      let options = [];
      try {
        const optionsResult = await pool.query(`
          SELECT id, name, odds FROM options WHERE market_id = $1
        `, [market.id]);
        
        // Add bet count to each option
        for (const option of optionsResult.rows) {
          const betCountResult = await pool.query(
            'SELECT COUNT(*) as count FROM bets WHERE option_id = $1',
            [option.id]
          );
          option.bet_count = parseInt(betCountResult.rows[0]?.count || 0);
          option.odds = parseFloat(option.odds) || 1.0;
        }
        
        options = optionsResult.rows;
      } catch (err) {
        console.log('Could not fetch options for market', market.id);
        options = [];
      }

      // Get total pool and bet count
      let totalPool = 0;
      let betCount = 0;
      try {
        const statsResult = await pool.query(
          'SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM bets WHERE market_id = $1',
          [market.id]
        );
        totalPool = parseFloat(statsResult.rows[0]?.total || 0);
        betCount = parseInt(statsResult.rows[0]?.count || 0);
      } catch (err) {
        console.log('Could not fetch stats for market', market.id);
      }

      markets.push({
        ...market,
        options,
        total_pool: totalPool,
        bet_count: betCount
      });
    }

    res.json({ markets });

  } catch (error) {
    console.error('Markets fetch error:', error);
    res.json({ markets: [] });
  }
});

// Get single market with details
app.get('/api/markets/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const marketResult = await pool.query(
      'SELECT * FROM markets WHERE id = $1',
      [id]
    );

    if (marketResult.rows.length === 0) {
      return res.status(404).json({ error: 'Market not found' });
    }

    const market = marketResult.rows[0];

    // Get options
    const optionsResult = await pool.query(
      'SELECT * FROM options WHERE market_id = $1',
      [id]
    );
    market.options = optionsResult.rows;

    res.json({ market });

  } catch (error) {
    console.error('Market fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch market' });
  }
});

// Create new market (admin only)
app.post('/api/markets', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { question, category_id, deadline, options } = req.body;

    // Validate required fields
    if (!question || !category_id || !deadline || !options || options.length < 2) {
      return res.status(400).json({ 
        error: 'Missing required fields. Question, category, deadline, and at least 2 options are required.' 
      });
    }

    // Validate category exists
    const categoryCheck = await pool.query(
      'SELECT id FROM categories WHERE id = $1',
      [category_id]
    );

    if (categoryCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid category selected' });
    }

    // Validate deadline is in the future
    const deadlineDate = new Date(deadline);
    const now = new Date();
    
    if (deadlineDate <= now) {
      return res.status(400).json({ error: 'Deadline must be in the future' });
    }

    // Validate deadline is not today
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const deadlineDay = new Date(deadlineDate.getFullYear(), deadlineDate.getMonth(), deadlineDate.getDate());
    
    if (deadlineDay.getTime() === today.getTime()) {
      return res.status(400).json({ error: 'Market cannot expire on the same day it is created' });
    }

    // Validate options
    const validOptions = options.filter(opt => opt && opt.trim() !== '');
    if (validOptions.length < 2) {
      return res.status(400).json({ error: 'At least 2 valid options are required' });
    }

    // Create market
    const marketResult = await pool.query(
      `INSERT INTO markets (question, category_id, deadline, created_by, status) 
       VALUES ($1, $2, $3, $4, 'active') 
       RETURNING *`,
      [question, category_id, deadline, req.user.id]
    );

    const market = marketResult.rows[0];

    // Create options - try both table names for compatibility
    // Create options
    for (const optionName of validOptions) {
      await pool.query(
        `INSERT INTO options (market_id, name, odds) VALUES ($1, $2, 1.0)`,
        [market.id, optionName.trim()]
      );
    }

    res.json({ 
      message: 'Market created successfully',
      market 
    });

  } catch (error) {
    console.error('Market creation error:', error);
    res.status(500).json({ error: 'Failed to create market' });
  }
});

// Resolve market (admin only)
app.post('/api/markets/:id/resolve', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    const { outcome } = req.body;

    // Update market status
    await pool.query(
      `UPDATE markets 
       SET status = 'resolved', outcome = $1, resolved_at = NOW() 
       WHERE id = $2`,
      [outcome, id]
    );

    // Process payouts if outcome is not 'Unresolved'
    if (outcome && outcome !== 'Unresolved') {
      // Get winning option
      // Get winning option
      const optionResult = await pool.query(
        'SELECT id FROM options WHERE market_id = $1 AND name = $2',
        [id, outcome]
      );
      const winningOption = optionResult.rows[0];

      if (winningOption) {
        // Get winning bets
        const winningBets = await pool.query(
          'SELECT * FROM bets WHERE market_id = $1 AND option_id = $2',
          [id, winningOption.id]
        );

        // Pay out winners
        for (const bet of winningBets.rows) {
          await pool.query(
            'UPDATE users SET balance = balance + $1 WHERE id = $2',
            [parseFloat(bet.potential_payout), bet.user_id]
          );

          await pool.query(
            'UPDATE bets SET status = $1 WHERE id = $2',
            ['won', bet.id]
          );
        }

        // Mark losing bets
        await pool.query(
          'UPDATE bets SET status = $1 WHERE market_id = $2 AND option_id != $3',
          ['lost', id, winningOption.id]
        );
      }
    }

    res.json({ message: 'Market resolved successfully' });

  } catch (error) {
    console.error('Market resolution error:', error);
    res.status(500).json({ error: 'Failed to resolve market' });
  }
});

// ============================================
// BET ROUTES
// ============================================

// Place a bet
app.post('/api/bets', authenticateToken, async (req, res) => {
  try {
    const { market_id, option_id, amount } = req.body;

    // Validate input
    if (!market_id || !option_id || !amount) {
      return res.status(400).json({ error: 'Market, option, and amount are required' });
    }

    if (amount <= 0) {
      return res.status(400).json({ error: 'Amount must be positive' });
    }

    // Get user balance
    const userResult = await pool.query(
      'SELECT balance FROM users WHERE id = $1',
      [req.user.id]
    );

    const userBalance = parseFloat(userResult.rows[0].balance);

    if (userBalance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Get market details
    const marketResult = await pool.query(
      'SELECT * FROM markets WHERE id = $1',
      [market_id]
    );

    if (marketResult.rows.length === 0) {
      return res.status(404).json({ error: 'Market not found' });
    }

    const market = marketResult.rows[0];

    if (market.status !== 'active') {
      return res.status(400).json({ error: 'Market is not active' });
    }

    if (new Date(market.deadline) < new Date()) {
      return res.status(400).json({ error: 'Market has expired' });
    }

    // Get option odds
    const optionResult = await pool.query(
      'SELECT * FROM options WHERE id = $1 AND market_id = $2',
      [option_id, market_id]
    );
    const option = optionResult.rows[0];

    if (!option) {
      return res.status(404).json({ error: 'Option not found' });
    }

    const odds = parseFloat(option.odds) || 1.0;
    const potentialPayout = amount * odds;

    // Deduct amount from user balance
    await pool.query(
      'UPDATE users SET balance = balance - $1 WHERE id = $2',
      [amount, req.user.id]
    );

    // Create bet
    const betResult = await pool.query(
      `INSERT INTO bets (user_id, market_id, option_id, amount, odds, potential_payout, status) 
       VALUES ($1, $2, $3, $4, $5, $6, 'pending') 
       RETURNING *`,
      [req.user.id, market_id, option_id, amount, odds, potentialPayout]
    );

    // Get new balance
    const newBalanceResult = await pool.query(
      'SELECT balance FROM users WHERE id = $1',
      [req.user.id]
    );

    res.json({
      message: 'Bet placed successfully',
      bet: betResult.rows[0],
      newBalance: parseFloat(newBalanceResult.rows[0].balance)
    });

  } catch (error) {
    console.error('Bet placement error:', error);
    res.status(500).json({ error: 'Failed to place bet' });
  }
});

// Get user's bets
app.get('/api/bets/my', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        b.*,
        m.question as market_question,
        m.status as market_status,
        o.name as option_name
      FROM bets b
      JOIN markets m ON b.market_id = m.id
      LEFT JOIN options o ON b.option_id = o.id
      WHERE b.user_id = $1
      ORDER BY b.created_at DESC
    `, [req.user.id]);

    const bets = result.rows.map(bet => ({
      ...bet,
      amount: parseFloat(bet.amount),
      odds: parseFloat(bet.odds),
      potential_payout: parseFloat(bet.potential_payout)
    }));

    res.json({ bets });

  } catch (error) {
    console.error('Bets fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch bets' });
  }
});

// ============================================
// LEADERBOARD ROUTES
// ============================================

// Get leaderboard
app.get('/api/leaderboard', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.id,
        u.username,
        u.balance,
        COUNT(b.id) as total_bets,
        SUM(CASE WHEN b.status = 'won' THEN 1 ELSE 0 END)::float / 
          NULLIF(COUNT(b.id), 0) as win_rate
      FROM users u
      LEFT JOIN bets b ON u.id = b.user_id
      GROUP BY u.id, u.username, u.balance
      ORDER BY u.balance DESC
      LIMIT 100
    `);

    const leaderboard = result.rows.map(user => ({
      ...user,
      balance: parseFloat(user.balance),
      total_bets: parseInt(user.total_bets) || 0,
      win_rate: user.win_rate ? parseFloat(user.win_rate) : null
    }));

    res.json({ leaderboard });

  } catch (error) {
    console.error('Leaderboard fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// ============================================
// HEALTH CHECK
// ============================================

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    database: 'connected'
  });
});

app.get('/', (req, res) => {
  res.json({ 
    message: 'Binary Bets API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth/*',
      markets: '/api/markets',
      bets: '/api/bets',
      categories: '/api/categories',
      leaderboard: '/api/leaderboard'
    }
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Binary Bets Backend running on port ${PORT}`);
});

export default app;
