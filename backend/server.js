import express from 'express';
import pkg from 'pg';
const { Pool } = pkg;
import cors from 'cors';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import OpenAI from 'openai';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
const pool = new Pool({
  user: process.env.POSTGRES_USER || 'binaryuser',
  host: process.env.POSTGRES_HOST || 'postgres',
  database: process.env.POSTGRES_DB || 'binarybets',
  password: process.env.POSTGRES_PASSWORD || 'binarypass',
  port: 5432,
});

// Test database connection
pool.connect()
  .then(() => console.log('✅ Database connected successfully'))
  .catch(err => console.error('❌ Database connection error:', err));

// Initialize OpenAI
let openai = null;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (OPENAI_API_KEY && OPENAI_API_KEY !== 'your-openai-api-key-here') {
  try {
    openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    console.log('✅ OpenAI client initialized');
  } catch (error) {
    console.error('❌ Error initializing OpenAI:', error.message);
  }
} else {
  console.warn('⚠️  OPENAI_API_KEY not set - AI resolution will not work');
}

// JWT secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Auth middleware
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

// ============================================================================
// AUTHENTICATION ROUTES
// ============================================================================

// Register
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const existingUser = await pool.query(
      'SELECT * FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      'INSERT INTO users (username, email, password, balance) VALUES ($1, $2, $3, $4) RETURNING id, username, email, balance',
      [username, email, hashedPassword, 1000]
    );

    const user = result.rows[0];

    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        balance: user.balance
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        balance: user.balance
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Get current user
app.get('/api/user', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, email, balance, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================================
// CATEGORY & SUBCATEGORY ROUTES
// ============================================================================

// Get all categories
app.get('/api/categories', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM categories ORDER BY display_order, id'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get subcategories (all or by category)
app.get('/api/subcategories', async (req, res) => {
  try {
    const { category_id } = req.query;
    
    let query, params;
    if (category_id) {
      query = 'SELECT * FROM subcategories WHERE category_id = $1 ORDER BY display_order, id';
      params = [category_id];
    } else {
      query = 'SELECT * FROM subcategories ORDER BY category_id, display_order, id';
      params = [];
    }
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching subcategories:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================================
// MARKET ROUTES
// ============================================================================

// Get all markets or filter by category/status
app.get('/api/markets', async (req, res) => {
  try {
    const { category_id, subcategory_id, status } = req.query;
    
    let query = `
      SELECT 
        m.*,
        m.market_type as type,
        m.deadline as close_date,
        CASE 
          WHEN m.resolved = true THEN 'resolved'
          ELSE 'active'
        END as status,
        m.outcome as winning_outcome,
        COALESCE(m.yes_odds, 0) as yes_shares,
        COALESCE(m.no_odds, 0) as no_shares,
        c.name as category_name,
        c.color as category_color,
        s.name as subcategory_name,
        COALESCE(
          json_agg(
            json_build_object(
              'id', mo.id,
              'text', mo.option_text,
              'yes_shares', COALESCE(mo.yes_shares, 0),
              'no_shares', COALESCE(mo.no_shares, 0)
            ) ORDER BY mo.id
          ) FILTER (WHERE mo.id IS NOT NULL),
          '[]'
        ) as options
      FROM markets m
      LEFT JOIN categories c ON m.category_id = c.id
      LEFT JOIN subcategories s ON m.subcategory_id = s.id
      LEFT JOIN market_options mo ON m.id = mo.market_id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 1;
    
    if (category_id) {
      query += ` AND m.category_id = $${paramCount}`;
      params.push(category_id);
      paramCount++;
    }
    
    if (subcategory_id) {
      query += ` AND m.subcategory_id = $${paramCount}`;
      params.push(subcategory_id);
      paramCount++;
    }
    
    if (status) {
      if (status === 'resolved') {
        query += ` AND m.resolved = true`;
      } else if (status === 'active') {
        query += ` AND m.resolved = false`;
      }
    }
    
    query += ' GROUP BY m.id, c.name, c.color, s.name ORDER BY m.created_at DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching markets:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single market
app.get('/api/markets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `SELECT 
        m.*,
        m.market_type as type,
        m.deadline as close_date,
        CASE 
          WHEN m.resolved = true THEN 'resolved'
          ELSE 'active'
        END as status,
        m.outcome as winning_outcome,
        COALESCE(m.yes_odds, 0) as yes_shares,
        COALESCE(m.no_odds, 0) as no_shares,
        c.name as category_name,
        c.color as category_color,
        s.name as subcategory_name,
        COALESCE(
          json_agg(
            json_build_object(
              'id', mo.id,
              'text', mo.option_text,
              'yes_shares', COALESCE(mo.yes_shares, 0),
              'no_shares', COALESCE(mo.no_shares, 0)
            ) ORDER BY mo.id
          ) FILTER (WHERE mo.id IS NOT NULL),
          '[]'
        ) as options
      FROM markets m
      LEFT JOIN categories c ON m.category_id = c.id
      LEFT JOIN subcategories s ON m.subcategory_id = s.id
      LEFT JOIN market_options mo ON m.id = mo.market_id
      WHERE m.id = $1
      GROUP BY m.id, c.name, c.color, s.name`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Market not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching market:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create market
app.post('/api/markets', authenticateToken, async (req, res) => {
  try {
    const {
      question,
      description,
      category_id,
      subcategory_id,
      close_date,
      type,
      options
    } = req.body;

    if (!question || !category_id || !close_date || !type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Convert type to market_type format
    const market_type = type === 'multiple' ? 'multi-choice' : 'binary';

    // Insert market
    const marketResult = await pool.query(
      `INSERT INTO markets 
       (question, description, category_id, subcategory_id, deadline, market_type, created_by, resolved, yes_odds, no_odds) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8, $9) 
       RETURNING *`,
      [question, description, category_id, subcategory_id, close_date, market_type, req.user.id, 
       market_type === 'binary' ? 50 : null, market_type === 'binary' ? 50 : null]
    );

    const market = marketResult.rows[0];

    // If multiple choice, insert options
    if (type === 'multiple' && options && options.length > 0) {
      for (const option of options) {
        await pool.query(
          'INSERT INTO market_options (market_id, option_text) VALUES ($1, $2)',
          [market.id, option]
        );
      }
    }

    res.status(201).json(market);
  } catch (error) {
    console.error('Error creating market:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================================
// MARKET RESOLUTION
// ============================================================================

// Resolve market
app.post('/api/markets/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;
    const { outcome, resolvedBy } = req.body;

    console.log(`\n🎯 Resolving Market ${id}`);
    console.log(`   Received outcome: "${outcome}"`);
    console.log(`   Resolved by: ${resolvedBy}`);

    // VALIDATION: Check if parameters exist
    if (!outcome) {
      console.error('❌ Missing outcome parameter');
      return res.status(400).json({ error: 'Missing outcome parameter' });
    }

    if (!resolvedBy) {
      console.error('❌ Missing resolvedBy parameter');
      return res.status(400).json({ error: 'Missing resolvedBy parameter' });
    }

    // Get market
    const marketResult = await pool.query(
      'SELECT * FROM markets WHERE id = $1',
      [id]
    );

    if (marketResult.rows.length === 0) {
      return res.status(404).json({ error: 'Market not found' });
    }

    const market = marketResult.rows[0];
    console.log(`   Market type: ${market.market_type}`);

    if (market.resolved === true) {
      return res.status(400).json({ error: 'Market is already resolved' });
    }

    // FIXED: Safely convert to lowercase
    const normalizedOutcome = String(outcome).toLowerCase();
    console.log(`   Normalized outcome: "${normalizedOutcome}"`);

    // Validate outcome based on market type
    if (market.market_type === 'binary') {
      if (!['yes', 'no'].includes(normalizedOutcome)) {
        console.error(`❌ Invalid binary outcome: "${normalizedOutcome}"`);
        return res.status(400).json({ error: 'Invalid outcome for binary market. Must be "yes" or "no"' });
      }
    }

    // Start transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Update market status
      await client.query(
        `UPDATE markets 
         SET resolved = true, 
             outcome = $1, 
             resolved_at = NOW(),
             resolved_by = $2
         WHERE id = $3`,
        [normalizedOutcome, resolvedBy, id]
      );

      // Get all bets for this market
      const betsResult = await client.query(
        'SELECT * FROM bets WHERE market_id = $1 AND status = $2',
        [id, 'active']
      );

      console.log(`   Processing ${betsResult.rows.length} bets`);

      // Process each bet
      for (const bet of betsResult.rows) {
        const won = bet.position === normalizedOutcome;
        const payout = won ? bet.shares * 2 : 0; // Simple 2x payout for winners

        // Update bet
        await client.query(
          'UPDATE bets SET status = $1, payout = $2 WHERE id = $3',
          [won ? 'won' : 'lost', payout, bet.id]
        );

        // Update user balance if won
        if (won && payout > 0) {
          await client.query(
            'UPDATE users SET balance = balance + $1 WHERE id = $2',
            [payout, bet.user_id]
          );
        }
      }

      await client.query('COMMIT');
      console.log(`✅ Market ${id} resolved successfully!`);

      res.json({
        success: true,
        marketId: id,
        outcome: normalizedOutcome,
        betsProcessed: betsResult.rows.length
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error resolving market:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// AI resolution endpoint
app.post('/api/resolve-with-ai', async (req, res) => {
  try {
    const { marketId, question, description, category } = req.body;

    if (!openai) {
      return res.status(503).json({ error: 'OpenAI not configured' });
    }

    console.log(`🤖 AI resolving market: "${question}"`);

    const prompt = `You are a prediction market resolver. Based on current information and news, determine if the following prediction has come true.

Question: ${question}
${description ? `Description: ${description}` : ''}
${category ? `Category: ${category}` : ''}

Respond with ONLY a JSON object in this exact format:
{
  "outcome": "yes" or "no",
  "reasoning": "brief explanation of why"
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 200
    });

    const responseText = completion.choices[0].message.content.trim();
    const result = JSON.parse(responseText);

    console.log(`🤖 AI Result: ${result.outcome}`);
    console.log(`📝 Reasoning: ${result.reasoning}`);

    res.json(result);

  } catch (error) {
    console.error('Error in AI resolution:', error);
    res.status(500).json({ error: 'AI resolution failed' });
  }
});

// ============================================================================
// BETTING ROUTES
// ============================================================================

// Place bet
app.post('/api/bets', authenticateToken, async (req, res) => {
  try {
    const { market_id, position, shares } = req.body;
    const userId = req.user.id;

    if (!market_id || !position || !shares) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (shares <= 0) {
      return res.status(400).json({ error: 'Shares must be positive' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get user balance
      const userResult = await client.query(
        'SELECT balance FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows[0].balance < shares) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Insufficient balance' });
      }

      // Get market
      const marketResult = await client.query(
        'SELECT * FROM markets WHERE id = $1',
        [market_id]
      );

      if (marketResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Market not found' });
      }

      const market = marketResult.rows[0];

      if (market.resolved === true) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Market is already resolved' });
      }

      // Create bet
      const betResult = await client.query(
        `INSERT INTO bets (user_id, market_id, position, shares, status) 
         VALUES ($1, $2, $3, $4, 'active') 
         RETURNING *`,
        [userId, market_id, position, shares]
      );

      // Update user balance
      await client.query(
        'UPDATE users SET balance = balance - $1 WHERE id = $2',
        [shares, userId]
      );

      // Update market odds (simple approach)
      const column = position === 'yes' ? 'yes_odds' : 'no_odds';
      await client.query(
        `UPDATE markets SET ${column} = COALESCE(${column}, 0) + $1 WHERE id = $2`,
        [shares, market_id]
      );

      await client.query('COMMIT');
      res.status(201).json(betResult.rows[0]);

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error placing bet:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user's bets
app.get('/api/bets/user', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        b.*,
        m.question,
        m.resolved as market_resolved,
        m.market_type as type,
        m.outcome as winning_outcome,
        c.name as category_name
      FROM bets b
      JOIN markets m ON b.market_id = m.id
      JOIN categories c ON m.category_id = c.id
      WHERE b.user_id = $1
      ORDER BY b.created_at DESC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching user bets:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get bets for a market
app.get('/api/markets/:id/bets', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `SELECT 
        b.*,
        u.username
      FROM bets b
      JOIN users u ON b.user_id = u.id
      WHERE b.market_id = $1
      ORDER BY b.created_at DESC`,
      [id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching market bets:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================================
// LEADERBOARD
// ============================================================================

app.get('/api/leaderboard', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        u.id,
        u.username,
        u.balance,
        COUNT(b.id) as total_bets,
        COUNT(CASE WHEN b.status = 'won' THEN 1 END) as wins,
        COUNT(CASE WHEN b.status = 'lost' THEN 1 END) as losses,
        COALESCE(SUM(CASE WHEN b.status = 'won' THEN b.payout ELSE 0 END), 0) as total_winnings
      FROM users u
      LEFT JOIN bets b ON u.id = b.user_id
      GROUP BY u.id, u.username, u.balance
      ORDER BY u.balance DESC
      LIMIT 100`
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================================
// HEALTH CHECK
// ============================================================================

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 BinaryBets API server running on port ${PORT}`);
});
