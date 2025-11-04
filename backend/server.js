import express from 'express';
import cors from 'cors';
import pkg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

dotenv.config();

const { Pool } = pkg;
const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Database connection with fallback for different env variable names
const pool = new Pool({
  host: process.env.POSTGRES_HOST || process.env.DB_HOST || 'postgres',
  port: process.env.POSTGRES_PORT || process.env.DB_PORT || 5432,
  database: process.env.POSTGRES_DB || process.env.DB_NAME || 'binarybets',
  user: process.env.POSTGRES_USER || process.env.DB_USER || 'binaryuser',
  password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || 'binarypass',
});

// Test database connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Error connecting to database:', err);
  } else {
    console.log(`✅ Database connected: ${new Date().toISOString()}`);
    release();
  }
});

// Email transporter (optional - for future features)
let emailTransporter = null;
if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
  emailTransporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
}

// Check for AI API keys
const hasClaudeAI = !!process.env.ANTHROPIC_API_KEY;
const hasChatGPT = !!process.env.OPENAI_API_KEY;

if (hasClaudeAI) {
  console.log('✅ Claude AI enabled');
}
if (hasChatGPT) {
  console.log('✅ ChatGPT enabled');
}

// JWT Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// ============================================================================
// AUTHENTICATION ROUTES
// ============================================================================

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validate input
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if user exists
    const existingUser = await pool.query(
      'SELECT * FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash, balance)
       VALUES ($1, $2, $3, 1000.00)
       RETURNING id, username, email, balance, role, created_at`,
      [username, email, hashedPassword]
    );

    const user = result.rows[0];
    user.balance = parseFloat(user.balance);

    // Generate token
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token, user });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Check password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Convert balance to number
    user.balance = parseFloat(user.balance);

    // Generate token
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Return user without password
    const { password_hash, ...userWithoutPassword } = user;

    res.json({ token, user: userWithoutPassword });
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
    user.balance = parseFloat(user.balance);

    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// ============================================================================
// CATEGORIES ROUTES
// ============================================================================

// Get all categories
app.get('/api/categories', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM categories ORDER BY name'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// ============================================================================
// MARKETS ROUTES
// ============================================================================

// Get all markets with enhanced data
app.get('/api/markets', async (req, res) => {
  try {
    const { status = 'active', category } = req.query;

    let query = 'SELECT * FROM markets WHERE status = $1';
    const params = [status];

    if (category) {
      query += ' AND category_id = $2';
      params.push(category);
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    const markets = result.rows;

    // Fetch options and bet counts for each market
    for (const market of markets) {
      try {
        const optionsResult = await pool.query(
          `SELECT 
             o.id,
             o.name,
             o.odds,
             COUNT(b.id) as bet_count,
             COALESCE(SUM(b.amount), 0) as total_amount
           FROM options o
           LEFT JOIN bets b ON o.id = b.option_id AND b.status = 'pending'
           WHERE o.market_id = $1
           GROUP BY o.id, o.name, o.odds
           ORDER BY o.name`,
          [market.id]
        );

        market.options = optionsResult.rows.map(opt => ({
          ...opt,
          odds: parseFloat(opt.odds),
          bet_count: parseInt(opt.bet_count),
          total_amount: parseFloat(opt.total_amount)
        }));

        // Get total bets count
        const totalBetsResult = await pool.query(
          'SELECT COUNT(*) as count FROM bets WHERE market_id = $1',
          [market.id]
        );
        market.total_bets = parseInt(totalBetsResult.rows[0].count);
      } catch (err) {
        // Silently handle errors - market will just have empty options
        market.options = [];
        market.total_bets = 0;
      }
    }

    res.json(markets);
  } catch (error) {
    console.error('Error fetching markets:', error);
    res.status(500).json({ error: 'Failed to fetch markets' });
  }
});

// Get single market
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
      `SELECT 
         o.id,
         o.name,
         o.odds,
         COUNT(b.id) as bet_count,
         COALESCE(SUM(b.amount), 0) as total_amount
       FROM options o
       LEFT JOIN bets b ON o.id = b.option_id AND b.status = 'pending'
       WHERE o.market_id = $1
       GROUP BY o.id, o.name, o.odds
       ORDER BY o.name`,
      [id]
    );

    market.options = optionsResult.rows.map(opt => ({
      ...opt,
      odds: parseFloat(opt.odds),
      bet_count: parseInt(opt.bet_count),
      total_amount: parseFloat(opt.total_amount)
    }));

    res.json(market);
  } catch (error) {
    console.error('Error fetching market:', error);
    res.status(500).json({ error: 'Failed to fetch market' });
  }
});

// Create market
app.post('/api/markets', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { question, category_id, deadline, options, useAiOdds } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!question || !category_id || !deadline) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!options || options.length < 2) {
      return res.status(400).json({ error: 'At least 2 options required' });
    }

    // Validate deadline is in future
    const deadlineDate = new Date(deadline);
    if (deadlineDate <= new Date()) {
      return res.status(400).json({ error: 'Deadline must be in the future' });
    }

    await client.query('BEGIN');

    // Check if category exists
    const categoryCheck = await client.query(
      'SELECT id FROM categories WHERE id = $1',
      [category_id]
    );

    if (categoryCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid category' });
    }

    // Create market
    const marketResult = await client.query(
      `INSERT INTO markets (question, category_id, deadline, status, created_by)
       VALUES ($1, $2, $3, 'active', $4)
       RETURNING *`,
      [question, category_id, deadline, userId]
    );

    const market = marketResult.rows[0];

    // Determine initial odds
    let initialOdds = 1.0;
    if (useAiOdds) {
      // TODO: Implement AI odds generation
      // For now, use equal odds
      initialOdds = options.length > 0 ? (options.length / 1.0) : 1.0;
    }

    // Create options
    for (const optionName of options) {
      if (optionName && optionName.trim()) {
        await client.query(
          `INSERT INTO options (market_id, name, odds)
           VALUES ($1, $2, $3)`,
          [market.id, optionName.trim(), initialOdds]
        );
      }
    }

    await client.query('COMMIT');

    res.json({ success: true, market });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating market:', error);
    res.status(500).json({ error: 'Failed to create market' });
  } finally {
    client.release();
  }
});

// Get current odds for a market
app.get('/api/markets/:id/odds', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `SELECT 
         o.id,
         o.name,
         o.odds,
         COALESCE(SUM(b.amount), 0) as total_bet,
         COUNT(b.id) as bet_count
       FROM options o
       LEFT JOIN bets b ON o.id = b.option_id AND b.status = 'pending'
       WHERE o.market_id = $1
       GROUP BY o.id, o.name, o.odds
       ORDER BY o.name`,
      [id]
    );
    
    res.json(result.rows.map(row => ({
      ...row,
      odds: parseFloat(row.odds),
      total_bet: parseFloat(row.total_bet),
      bet_count: parseInt(row.bet_count)
    })));
  } catch (error) {
    console.error('Error fetching odds:', error);
    res.status(500).json({ error: 'Failed to fetch odds' });
  }
});

// Manually recalculate odds (admin only)
app.post('/api/markets/:id/recalculate-odds', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    await client.query('BEGIN');
    
    await recalculateOdds(client, id);
    
    await client.query('COMMIT');

    res.json({ success: true, message: 'Odds recalculated successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error recalculating odds manually:', error);
    res.status(500).json({ error: 'Failed to recalculate odds' });
  } finally {
    client.release();
  }
});

// Resolve market (admin or resolver)
app.post('/api/markets/:id/resolve', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { outcome } = req.body;

    // Check authentication - accept JWT token OR resolver token
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];
    
    let isAuthorized = false;

    // Check if it's a resolver token
    if (token === process.env.RESOLVER_TOKEN) {
      console.log('✅ Resolver token authenticated');
      isAuthorized = true;
    } 
    // Check if it's a valid JWT admin token
    else {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role === 'admin') {
          console.log('✅ Admin JWT authenticated');
          isAuthorized = true;
        }
      } catch (jwtError) {
        // JWT verification failed - not authorized
      }
    }

    if (!isAuthorized) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    await client.query('BEGIN');

    // Update market status
    await client.query(
      `UPDATE markets 
       SET status = 'resolved', outcome = $1, resolved_at = NOW()
       WHERE id = $2`,
      [outcome, id]
    );

    // Get winning option
    const winningOption = await client.query(
      'SELECT id FROM options WHERE market_id = $1 AND name = $2',
      [id, outcome]
    );

    if (winningOption.rows.length > 0) {
      const winningOptionId = winningOption.rows[0].id;

      // Get all winning bets
      const winningBets = await client.query(
        'SELECT * FROM bets WHERE market_id = $1 AND option_id = $2 AND status = \'pending\'',
        [id, winningOptionId]
      );

      // Pay out winners
      for (const bet of winningBets.rows) {
        await client.query(
          'UPDATE users SET balance = balance + $1 WHERE id = $2',
          [bet.potential_payout, bet.user_id]
        );

        await client.query(
          'UPDATE bets SET status = \'won\' WHERE id = $1',
          [bet.id]
        );
      }

      // Mark losing bets
      await client.query(
        'UPDATE bets SET status = \'lost\' WHERE market_id = $1 AND option_id != $2 AND status = \'pending\'',
        [id, winningOptionId]
      );
    } else {
      // No winning option found - mark all bets as void
      await client.query(
        'UPDATE bets SET status = \'void\' WHERE market_id = $1 AND status = \'pending\'',
        [id]
      );
    }

    await client.query('COMMIT');

    console.log(`✅ Market ${id} resolved with outcome: ${outcome}`);
    res.json({ success: true, message: 'Market resolved successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error resolving market:', error);
    res.status(500).json({ error: 'Failed to resolve market' });
  } finally {
    client.release();
  }
});

// AI Resolution endpoint for resolver service
app.post('/api/resolve-with-ai', async (req, res) => {
  try {
    // Check for resolver token
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];
    
    if (!token || token !== process.env.RESOLVER_TOKEN) {
      return res.status(401).json({ error: 'Invalid or missing resolver token' });
    }

    const { market_id, question, deadline } = req.body;

    // For now, return "Unresolved" - you can add AI logic later
    // This prevents automatic payouts until you implement proper AI resolution
    res.json({
      outcome: 'Unresolved',
      confidence: 0,
      reasoning: 'No automatic resolution available. Manual resolution required.'
    });
  } catch (error) {
    console.error('Error in AI resolution:', error);
    res.status(500).json({ error: 'Failed to get AI outcome' });
  }
});

// ============================================================================
// BETS ROUTES
// ============================================================================

// Place bet
app.post('/api/bets', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { market_id, option_id, amount } = req.body;
    const userId = req.user.id;

    // Validate amount
    if (!amount || amount <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid bet amount' });
    }

    // Check user balance
    const userResult = await client.query(
      'SELECT balance FROM users WHERE id = $1',
      [userId]
    );

    const userBalance = parseFloat(userResult.rows[0].balance);
    if (userBalance < amount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Check market exists and is active
    const marketResult = await client.query(
      'SELECT * FROM markets WHERE id = $1',
      [market_id]
    );

    if (marketResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Market not found' });
    }

    const market = marketResult.rows[0];
    if (market.status !== 'active') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Market is not active' });
    }

    // Check deadline hasn't passed
    if (new Date(market.deadline) < new Date()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Market has expired' });
    }

    // Get current odds for the option
    const optionResult = await client.query(
      'SELECT odds FROM options WHERE id = $1 AND market_id = $2',
      [option_id, market_id]
    );

    if (optionResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Option not found' });
    }

    const odds = parseFloat(optionResult.rows[0].odds);
    const potential_payout = amount * odds;

    // Deduct balance
    const newBalanceResult = await client.query(
      'UPDATE users SET balance = balance - $1 WHERE id = $2 RETURNING balance',
      [amount, userId]
    );

    // Insert the bet
    const betResult = await client.query(
      `INSERT INTO bets (user_id, market_id, option_id, amount, odds, potential_payout, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [userId, market_id, option_id, amount, odds, potential_payout, 'pending']
    );

    // ✅ RECALCULATE ODDS AFTER BET IS PLACED
    await recalculateOdds(client, market_id);

    await client.query('COMMIT');

    res.json({
      success: true,
      bet: betResult.rows[0],
      newBalance: parseFloat(newBalanceResult.rows[0].balance)
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Place bet error:', error);
    res.status(500).json({ error: 'Failed to place bet' });
  } finally {
    client.release();
  }
});

// Get user's bets
app.get('/api/bets/my-bets', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT 
         b.*,
         m.question,
         m.status as market_status,
         m.deadline,
         m.outcome,
         o.name as option_name,
         c.name as category_name,
         c.icon as category_icon
       FROM bets b
       JOIN markets m ON b.market_id = m.id
       JOIN options o ON b.option_id = o.id
       LEFT JOIN categories c ON m.category_id = c.id
       WHERE b.user_id = $1
       ORDER BY b.created_at DESC`,
      [userId]
    );

    const bets = result.rows.map(bet => ({
      ...bet,
      amount: parseFloat(bet.amount),
      odds: parseFloat(bet.odds),
      potential_payout: parseFloat(bet.potential_payout)
    }));

    res.json(bets);
  } catch (error) {
    console.error('Error fetching bets:', error);
    res.status(500).json({ error: 'Failed to fetch bets' });
  }
});

// ============================================================================
// AI NEWS ENDPOINT
// ============================================================================

// Get AI-generated news headlines based on trending bet categories
app.get('/api/ai-news', async (req, res) => {
  try {
    // Get top 3 most popular categories by bet count
    const topCategories = await pool.query(
      `SELECT 
         c.id,
         c.name,
         c.icon,
         COUNT(DISTINCT m.id) as market_count,
         COUNT(b.id) as bet_count
       FROM categories c
       JOIN markets m ON c.id = m.category_id
       LEFT JOIN bets b ON m.id = b.market_id
       WHERE m.status = 'active'
       GROUP BY c.id, c.name, c.icon
       ORDER BY bet_count DESC, market_count DESC
       LIMIT 3`
    );

    const news = [];

    // Generate headlines for each top category
    for (const category of topCategories.rows) {
      // Get a sample market from this category
      const sampleMarket = await pool.query(
        `SELECT question, deadline 
         FROM markets 
         WHERE category_id = $1 AND status = 'active'
         ORDER BY created_at DESC
         LIMIT 1`,
        [category.id]
      );

      if (sampleMarket.rows.length > 0) {
        const market = sampleMarket.rows[0];
        const headline = `${category.name}: ${market.question}`;
        
        news.push({
          category: category.name,
          icon: category.icon,
          headline: headline,
          source_url: `https://binary-bets.com/?category=${category.id}`,
          bet_count: parseInt(category.bet_count)
        });
      }
    }

    // If we don't have 3 headlines, add some generic ones
    if (news.length < 3) {
      const defaultHeadlines = [
        {
          category: 'Trending',
          icon: '🔥',
          headline: 'New prediction markets added daily! Check out the latest.',
          source_url: 'https://binary-bets.com',
          bet_count: 0
        },
        {
          category: 'Popular',
          icon: '⭐',
          headline: 'Join thousands making predictions on Binary Bets.',
          source_url: 'https://binary-bets.com',
          bet_count: 0
        },
        {
          category: 'Featured',
          icon: '🎯',
          headline: 'Create your own prediction market and challenge friends!',
          source_url: 'https://binary-bets.com/create',
          bet_count: 0
        }
      ];

      while (news.length < 3 && defaultHeadlines.length > 0) {
        news.push(defaultHeadlines.shift());
      }
    }

    res.json({ news });
  } catch (error) {
    console.error('Error generating AI news:', error);
    res.json({ news: [] }); // Return empty array instead of error
  }
});

// ============================================================================
// DYNAMIC ODDS SYSTEM
// ============================================================================

/**
 * Recalculates odds for all options in a market based on bet distribution
 * Formula: Odds = Total Pool ÷ Amount Bet on Option
 * Min: 1.01x, Max: 10.0x
 */
async function recalculateOdds(client, marketId) {
  try {
    // Get total amount bet on each option
    const betTotals = await client.query(
      `SELECT option_id, SUM(amount) as total_amount, COUNT(*) as bet_count
       FROM bets
       WHERE market_id = $1 AND status = 'pending'
       GROUP BY option_id`,
      [marketId]
    );

    if (betTotals.rows.length === 0) return;

    // Calculate total pool
    const totalPool = betTotals.rows.reduce((sum, row) => 
      sum + parseFloat(row.total_amount), 0
    );

    console.log(`📊 Recalculating odds for market ${marketId}. Total pool: $${totalPool}`);

    // Calculate and update odds for each option with bets
    for (const row of betTotals.rows) {
      const optionAmount = parseFloat(row.total_amount);
      const optionId = row.option_id;
      const betCount = parseInt(row.bet_count);

      // Dynamic odds formula: totalPool / optionAmount
      // This means: if more money is on an option, odds decrease (favorite)
      // Minimum odds of 1.01, maximum odds of 10.0
      const calculatedOdds = Math.max(1.01, Math.min(10.0, totalPool / optionAmount));

      await client.query(
        'UPDATE options SET odds = $1 WHERE id = $2',
        [calculatedOdds.toFixed(2), optionId]
      );

      console.log(`   Option ${optionId}: $${optionAmount} (${betCount} bets) → ${calculatedOdds.toFixed(2)}x odds`);
    }

    // For options with no bets, set odds to maximum (10.0x)
    const unbetOptions = await client.query(
      `UPDATE options 
       SET odds = 10.0 
       WHERE market_id = $1 
       AND id NOT IN (
         SELECT DISTINCT option_id FROM bets WHERE market_id = $1 AND status = 'pending'
       )
       RETURNING id, name`,
      [marketId]
    );

    if (unbetOptions.rows.length > 0) {
      console.log(`   ${unbetOptions.rows.length} options with no bets set to 10.0x`);
    }

  } catch (error) {
    console.error('❌ Error recalculating odds:', error);
    throw error; // Re-throw to trigger rollback in transaction
  }
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    features: {
      dynamicOdds: true,
      aiNews: true,
      resolverSupport: true,
      emailNotifications: !!emailTransporter
    }
  });
});

// ============================================================================
// START SERVER
// ============================================================================

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Binary Bets Backend running on port ${PORT}`);
});

export default app;
