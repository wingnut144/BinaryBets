import express from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';
import fetch from 'node-fetch';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Database connection
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://binaryuser:binarypass@postgres:5432/binarybets',
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection error:', err);
  } else {
    console.log('✅ Database connected');
  }
});

// AI Configuration
const anthropic = process.env.ANTHROPIC_API_KEY 
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const RESOLVER_TOKEN = process.env.RESOLVER_TOKEN || 'resolver-secret-token-change-in-production';

if (anthropic) {
  console.log('✅ Claude AI enabled');
}
if (OPENAI_API_KEY) {
  console.log('✅ ChatGPT enabled');
}

// Middleware
app.use(cors({
  origin: ['https://binary-bets.com', 'http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Authentication middleware
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

// Resolver authentication middleware
const authenticateResolver = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  // Check if it's the resolver token
  if (token === RESOLVER_TOKEN) {
    req.user = { id: 'resolver', username: 'system-resolver', is_resolver: true };
    return next();
  }

  // Otherwise, use standard JWT authentication
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

// Admin authentication middleware
const authenticateAdmin = (req, res, next) => {
  if (!req.user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// ==========================================
// AUTH ROUTES
// ==========================================

// Register
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body;

  try {
    // Check for existing email
    const emailCheck = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ error: 'This email is already registered' });
    }

    // Check for existing username
    const usernameCheck = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );

    if (usernameCheck.rows.length > 0) {
      return res.status(400).json({ error: 'This username is already taken' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user with starting balance
    const result = await pool.query(
      'INSERT INTO users (username, email, password_hash, balance) VALUES ($1, $2, $3, $4) RETURNING id, username, email, balance, is_admin',
      [username, email, hashedPassword, 1000]
    );

    const user = result.rows[0];

    // Generate token
    const token = jwt.sign(
      { id: user.id, username: user.username, is_admin: user.is_admin },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        balance: parseFloat(user.balance) || 1000,
        is_admin: user.is_admin
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, is_admin: user.is_admin },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        balance: parseFloat(user.balance) || 0,
        is_admin: user.is_admin
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
      'SELECT id, username, email, balance, is_admin FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

// ==========================================
// CATEGORY ROUTES
// ==========================================

// Get all categories with subcategories
app.get('/api/categories', async (req, res) => {
  try {
    const categoriesResult = await pool.query(
      'SELECT * FROM categories ORDER BY name ASC'
    );

    const subcategoriesResult = await pool.query(
      'SELECT * FROM subcategories ORDER BY name ASC'
    );

    const categories = categoriesResult.rows.map(cat => ({
      ...cat,
      subcategories: subcategoriesResult.rows.filter(sub => sub.category_id === cat.id)
    }));

    res.json({ categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// ==========================================
// MARKET ROUTES
// ==========================================

// Get all markets
app.get('/api/markets', async (req, res) => {
  try {
    // Check if bets table uses 'option' or 'option_id'
    const betsColumnsResult = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'bets'
    `);
    
    const betsColumns = betsColumnsResult.rows.map(r => r.column_name);
    const hasOptionColumn = betsColumns.includes('option');
    const hasOptionIdColumn = betsColumns.includes('option_id');
    
    console.log('Bets table columns:', betsColumns);
    console.log('Has option column:', hasOptionColumn);
    console.log('Has option_id column:', hasOptionIdColumn);
    
    // Build the query based on available schema
    let yesCondition, noCondition;
    
    if (hasOptionColumn) {
      yesCondition = "option = 'yes'";
      noCondition = "option = 'no'";
    } else if (hasOptionIdColumn) {
      // Find the option IDs for Yes and No
      const yesOption = await pool.query("SELECT id FROM options WHERE LOWER(option_text) = 'yes' LIMIT 1");
      const noOption = await pool.query("SELECT id FROM options WHERE LOWER(option_text) = 'no' LIMIT 1");
      
      const yesId = yesOption.rows[0]?.id || 1;
      const noId = noOption.rows[0]?.id || 2;
      
      yesCondition = `option_id = ${yesId}`;
      noCondition = `option_id = ${noId}`;
    } else {
      // Can't calculate yes/no totals without knowing the column
      yesCondition = "1=0";
      noCondition = "1=0";
    }
    
    const result = await pool.query(`
      SELECT m.*, 
             c.name as category_name, 
             c.icon as category_icon,
             c.color as category_color,
             sc.name as subcategory_name,
             (SELECT COUNT(*) FROM bets WHERE market_id = m.id) as bet_count,
             (SELECT COALESCE(SUM(amount), 0) FROM bets WHERE market_id = m.id AND ${yesCondition}) as yes_total,
             (SELECT COALESCE(SUM(amount), 0) FROM bets WHERE market_id = m.id AND ${noCondition}) as no_total
      FROM markets m
      LEFT JOIN categories c ON m.category_id = c.id
      LEFT JOIN subcategories sc ON m.subcategory_id = sc.id
      ORDER BY m.created_at DESC
    `);
    
    // Fetch options for each market
    const marketsWithOptions = await Promise.all(
      result.rows.map(async (market) => {
        try {
          const optionsResult = await pool.query(
            'SELECT * FROM options WHERE market_id = $1 ORDER BY id',
            [market.id]
          );
          return { ...market, options: optionsResult.rows };
        } catch (err) {
          console.error('Error fetching options for market', market.id, err.message);
          return { ...market, options: [] };
        }
      })
    );

    console.log(`✅ Successfully fetched ${marketsWithOptions.length} markets`);
    res.json({ markets: marketsWithOptions });
  } catch (error) {
    console.error('Error fetching markets:', error.message);
    console.error('Full error:', error);
    res.json({ markets: [] });
  }
});

// Get single market
app.get('/api/markets/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT m.*, 
              c.name as category_name, 
              c.icon as category_icon,
              c.color as category_color,
              sc.name as subcategory_name,
              (SELECT COUNT(*) FROM bets WHERE market_id = m.id) as bet_count,
              (SELECT COALESCE(SUM(amount), 0) FROM bets WHERE market_id = m.id AND option = 'yes') as yes_total,
              (SELECT COALESCE(SUM(amount), 0) FROM bets WHERE market_id = m.id AND option = 'no') as no_total
       FROM markets m
       LEFT JOIN categories c ON m.category_id = c.id
       LEFT JOIN subcategories sc ON m.subcategory_id = sc.id
       WHERE m.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Market not found' });
    }

    res.json({ market: result.rows[0] });
  } catch (error) {
    console.error('Error fetching market:', error);
    res.status(500).json({ error: 'Failed to fetch market' });
  }
});

// AI Odds Generation
async function generateAIOdds(question) {
  // Try ChatGPT first
  if (OPENAI_API_KEY) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are an expert at predicting probabilities for binary outcomes. Respond with ONLY a decimal between 0 and 1 representing the probability of YES.'
            },
            {
              role: 'user',
              content: `What is the probability that: ${question}`
            }
          ],
          temperature: 0.7,
          max_tokens: 10
        })
      });

      if (response.ok) {
        const data = await response.json();
        const odds = parseFloat(data.choices[0].message.content.trim());
        if (!isNaN(odds) && odds >= 0 && odds <= 1) {
          return { yes_odds: odds, no_odds: 1 - odds, source: 'ChatGPT' };
        }
      }
    } catch (error) {
      console.error('ChatGPT error:', error);
    }
  }

  // Fallback to Claude
  if (anthropic) {
    try {
      const message = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 10,
        messages: [
          {
            role: 'user',
            content: `What is the probability that: ${question}\n\nRespond with ONLY a decimal between 0 and 1 representing the probability of YES.`
          }
        ]
      });

      const odds = parseFloat(message.content[0].text.trim());
      if (!isNaN(odds) && odds >= 0 && odds <= 1) {
        return { yes_odds: odds, no_odds: 1 - odds, source: 'Claude' };
      }
    } catch (error) {
      console.error('Claude error:', error);
    }
  }

  // Default fallback
  return { yes_odds: 0.5, no_odds: 0.5, source: 'default' };
}

// Create market
app.post('/api/markets', authenticateToken, async (req, res) => {
  const { question, category_id, subcategory_id, closes_at, description } = req.body;

  try {
    // Validate closes_at is not today
    const closesDate = new Date(closes_at);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    closesDate.setHours(0, 0, 0, 0);
    
    if (closesDate <= today) {
      return res.status(400).json({ error: 'Market must close at least tomorrow or later' });
    }

    // Generate AI odds
    const aiOdds = await generateAIOdds(question);

    const result = await pool.query(
      `INSERT INTO markets (question, category_id, subcategory_id, closes_at, description, yes_odds, no_odds, ai_odds, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [question, category_id, subcategory_id || null, closes_at, description || null, 
       aiOdds.yes_odds, aiOdds.no_odds, aiOdds.source, req.user.id]
    );

    res.json({ market: result.rows[0] });
  } catch (error) {
    console.error('Error creating market:', error);
    res.status(500).json({ error: 'Failed to create market' });
  }
});

// Resolve market (AI-powered)
app.post('/api/markets/:id/resolve', authenticateResolver, async (req, res) => {
  const marketId = req.params.id;

  try {
    // Get market details
    const marketResult = await pool.query(
      'SELECT * FROM markets WHERE id = $1',
      [marketId]
    );

    if (marketResult.rows.length === 0) {
      return res.status(404).json({ error: 'Market not found' });
    }

    const market = marketResult.rows[0];

    if (market.resolved) {
      return res.status(400).json({ error: 'Market already resolved' });
    }

    // AI Resolution using ChatGPT first, then Claude
    let outcome = null;
    let confidence = 0;
    let aiSource = 'none';

    // Try ChatGPT first
    if (OPENAI_API_KEY) {
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: 'gpt-4',
            messages: [
              {
                role: 'system',
                content: 'You are resolving prediction markets. Respond with ONLY "YES" or "NO" followed by your confidence (0-1).'
              },
              {
                role: 'user',
                content: `Has this prediction come true: "${market.question}"?\n\nRespond in format: YES 0.95 or NO 0.85`
              }
            ],
            temperature: 0.3,
            max_tokens: 20
          })
        });

        if (response.ok) {
          const data = await response.json();
          const aiResponse = data.choices[0].message.content.trim().toUpperCase();
          const parts = aiResponse.split(' ');
          
          if (parts[0] === 'YES' || parts[0] === 'NO') {
            outcome = parts[0] === 'YES';
            confidence = parseFloat(parts[1]) || 0.9;
            aiSource = 'ChatGPT';
          }
        }
      } catch (error) {
        console.error('ChatGPT resolution error:', error);
      }
    }

    // Fallback to Claude if ChatGPT failed
    if (outcome === null && anthropic) {
      try {
        const message = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 20,
          messages: [
            {
              role: 'user',
              content: `Has this prediction come true: "${market.question}"?\n\nRespond with ONLY "YES" or "NO" followed by your confidence (0-1). Format: YES 0.95 or NO 0.85`
            }
          ]
        });

        const aiResponse = message.content[0].text.trim().toUpperCase();
        const parts = aiResponse.split(' ');
        
        if (parts[0] === 'YES' || parts[0] === 'NO') {
          outcome = parts[0] === 'YES';
          confidence = parseFloat(parts[1]) || 0.9;
          aiSource = 'Claude';
        }
      } catch (error) {
        console.error('Claude resolution error:', error);
      }
    }

    // If AI couldn't resolve, return error
    if (outcome === null) {
      return res.status(500).json({ error: 'AI could not resolve this market' });
    }

    // Resolve the market
    await pool.query(
      'UPDATE markets SET resolved = true, outcome = $1, resolved_at = NOW() WHERE id = $2',
      [outcome, marketId]
    );

    // Pay out winners
    const bets = await pool.query(
      'SELECT * FROM bets WHERE market_id = $1',
      [marketId]
    );

    for (const bet of bets.rows) {
      const won = (outcome && bet.option === 'yes') || (!outcome && bet.option === 'no');
      
      if (won) {
        const payout = bet.amount * 2; // Simple 2x payout for winners
        await pool.query(
          'UPDATE users SET balance = balance + $1 WHERE id = $2',
          [payout, bet.user_id]
        );
      }

      await pool.query(
        'UPDATE bets SET resolved = true, won = $1 WHERE id = $2',
        [won, bet.id]
      );
    }

    res.json({ 
      success: true, 
      outcome,
      confidence,
      aiSource,
      message: `Market resolved: ${outcome ? 'YES' : 'NO'} (${Math.round(confidence * 100)}% confidence via ${aiSource})`
    });
  } catch (error) {
    console.error('Error resolving market:', error);
    res.status(500).json({ error: 'Failed to resolve market' });
  }
});

// ==========================================
// BET ROUTES
// ==========================================

// Get user's bets
app.get('/api/bets', authenticateToken, async (req, res) => {
  try {
    // Check if bets table uses 'option' or 'option_id'
    const betsColumnsResult = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'bets'
    `);
    
    const betsColumns = betsColumnsResult.rows.map(r => r.column_name);
    const hasOptionColumn = betsColumns.includes('option');
    const hasOptionIdColumn = betsColumns.includes('option_id');

    let result;

    if (hasOptionColumn) {
      // Old schema with option text column
      result = await pool.query(
        `SELECT b.*, b.option, m.question, m.resolved, m.outcome, 
                COALESCE(m.closes_at, m.deadline) as closes_at,
                c.name as category_name, c.icon as category_icon
         FROM bets b
         JOIN markets m ON b.market_id = m.id
         LEFT JOIN categories c ON m.category_id = c.id
         WHERE b.user_id = $1
         ORDER BY b.created_at DESC`,
        [req.user.id]
      );
    } else if (hasOptionIdColumn) {
      // New schema with option_id
      result = await pool.query(
        `SELECT b.*, o.option_text as option, m.question, m.resolved, m.outcome,
                COALESCE(m.closes_at, m.deadline) as closes_at,
                c.name as category_name, c.icon as category_icon
         FROM bets b
         JOIN markets m ON b.market_id = m.id
         LEFT JOIN options o ON b.option_id = o.id
         LEFT JOIN categories c ON m.category_id = c.id
         WHERE b.user_id = $1
         ORDER BY b.created_at DESC`,
        [req.user.id]
      );
    } else {
      return res.json({ bets: [] });
    }

    res.json({ bets: result.rows });
  } catch (error) {
    console.error('Error fetching bets:', error);
    res.json({ bets: [] });
  }
});

// Place bet
app.post('/api/bets', authenticateToken, async (req, res) => {
  const { market_id, option, amount } = req.body;

  try {
    // Check user balance
    const userResult = await pool.query(
      'SELECT balance FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userResult.rows[0].balance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Check market is still open
    const marketResult = await pool.query(
      'SELECT * FROM markets WHERE id = $1',
      [market_id]
    );

    if (marketResult.rows.length === 0) {
      return res.status(404).json({ error: 'Market not found' });
    }

    const market = marketResult.rows[0];

    if (market.resolved) {
      return res.status(400).json({ error: 'Market is already resolved' });
    }

    const closesAt = market.closes_at || market.deadline;
    if (closesAt && new Date(closesAt) < new Date()) {
      return res.status(400).json({ error: 'Market is closed' });
    }

    // Check if bets table uses 'option' or 'option_id'
    const betsColumnsResult = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'bets'
    `);
    
    const betsColumns = betsColumnsResult.rows.map(r => r.column_name);
    const hasOptionColumn = betsColumns.includes('option');
    const hasOptionIdColumn = betsColumns.includes('option_id');

    let betResult;

    // Deduct balance
    await pool.query(
      'UPDATE users SET balance = balance - $1 WHERE id = $2',
      [amount, req.user.id]
    );

    if (hasOptionColumn) {
      // Old schema: use option text directly
      betResult = await pool.query(
        'INSERT INTO bets (user_id, market_id, option, amount) VALUES ($1, $2, $3, $4) RETURNING *',
        [req.user.id, market_id, option, amount]
      );
    } else if (hasOptionIdColumn) {
      // New schema: find option_id from options table
      const optionResult = await pool.query(
        'SELECT id FROM options WHERE market_id = $1 AND LOWER(option_text) = LOWER($2)',
        [market_id, option]
      );

      if (optionResult.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid option for this market' });
      }

      const option_id = optionResult.rows[0].id;

      betResult = await pool.query(
        'INSERT INTO bets (user_id, market_id, option_id, amount) VALUES ($1, $2, $3, $4) RETURNING *',
        [req.user.id, market_id, option_id, amount]
      );
    } else {
      return res.status(500).json({ error: 'Bets table schema not recognized' });
    }

    // Update market odds based on new bet
    // (This part depends on your schema, keeping it simple)
    const yesTotal = await pool.query(
      hasOptionColumn
        ? 'SELECT COALESCE(SUM(amount), 0) as total FROM bets WHERE market_id = $1 AND option = $2'
        : 'SELECT COALESCE(SUM(amount), 0) as total FROM bets b JOIN options o ON b.option_id = o.id WHERE b.market_id = $1 AND LOWER(o.option_text) = $2',
      [market_id, hasOptionColumn ? 'yes' : 'yes']
    );
    const noTotal = await pool.query(
      hasOptionColumn
        ? 'SELECT COALESCE(SUM(amount), 0) as total FROM bets WHERE market_id = $1 AND option = $2'
        : 'SELECT COALESCE(SUM(amount), 0) as total FROM bets b JOIN options o ON b.option_id = o.id WHERE b.market_id = $1 AND LOWER(o.option_text) = $2',
      [market_id, hasOptionColumn ? 'no' : 'no']
    );

    const yesAmount = parseFloat(yesTotal.rows[0].total);
    const noAmount = parseFloat(noTotal.rows[0].total);
    const totalAmount = yesAmount + noAmount;

    if (totalAmount > 0) {
      const yes_odds = yesAmount / totalAmount;
      const no_odds = noAmount / totalAmount;

      await pool.query(
        'UPDATE markets SET yes_odds = $1, no_odds = $2 WHERE id = $3',
        [yes_odds, no_odds, market_id]
      );
    }

    res.json({ bet: betResult.rows[0] });
  } catch (error) {
    console.error('Error placing bet:', error);
    res.status(500).json({ error: 'Failed to place bet' });
  }
});

// ==========================================
// LEADERBOARD ROUTES
// ==========================================

app.get('/api/leaderboard', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.id,
        u.username,
        u.balance,
        COUNT(DISTINCT b.id) as total_bets
      FROM users u
      LEFT JOIN bets b ON u.id = b.user_id
      GROUP BY u.id, u.username, u.balance
      ORDER BY u.balance DESC
      LIMIT 100
    `);

    res.json({ leaderboard: result.rows });
  } catch (error) {
    console.error('Error fetching leaderboard:', error.message);
    console.error('Error details:', error);
    // Return empty leaderboard instead of error
    res.json({ leaderboard: [] });
  }
});

// ==========================================
// ADMIN ROUTES
// ==========================================

// Get all categories (admin)
app.get('/api/admin/categories', authenticateToken, authenticateAdmin, async (req, res) => {
  try {
    const categoriesResult = await pool.query(
      'SELECT * FROM categories ORDER BY name ASC'
    );
    
    const subcategoriesResult = await pool.query(
      'SELECT * FROM subcategories ORDER BY category_id, name ASC'
    );

    const categories = categoriesResult.rows.map(cat => ({
      ...cat,
      subcategories: subcategoriesResult.rows.filter(sub => sub.category_id === cat.id)
    }));

    res.json({ categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Create category (admin)
app.post('/api/admin/categories', authenticateToken, authenticateAdmin, async (req, res) => {
  const { name, icon, color } = req.body;

  try {
    const result = await pool.query(
      'INSERT INTO categories (name, icon, color) VALUES ($1, $2, $3) RETURNING *',
      [name, icon, color || '#667eea']
    );

    res.json({ category: result.rows[0] });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// Update category (admin)
app.put('/api/admin/categories/:id', authenticateToken, authenticateAdmin, async (req, res) => {
  const { name, icon, color } = req.body;

  try {
    const result = await pool.query(
      'UPDATE categories SET name = $1, icon = $2, color = $3 WHERE id = $4 RETURNING *',
      [name, icon, color, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json({ category: result.rows[0] });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// Delete category (admin)
app.delete('/api/admin/categories/:id', authenticateToken, authenticateAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM subcategories WHERE category_id = $1', [req.params.id]);
    await pool.query('DELETE FROM categories WHERE id = $1', [req.params.id]);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

// Create subcategory (admin)
app.post('/api/admin/subcategories', authenticateToken, authenticateAdmin, async (req, res) => {
  const { category_id, name } = req.body;

  try {
    const result = await pool.query(
      'INSERT INTO subcategories (category_id, name) VALUES ($1, $2) RETURNING *',
      [category_id, name]
    );

    res.json({ subcategory: result.rows[0] });
  } catch (error) {
    console.error('Error creating subcategory:', error);
    res.status(500).json({ error: 'Failed to create subcategory' });
  }
});

// Delete subcategory (admin)
app.delete('/api/admin/subcategories/:id', authenticateToken, authenticateAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM subcategories WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting subcategory:', error);
    res.status(500).json({ error: 'Failed to delete subcategory' });
  }
});

// Get reported bets (admin)
app.get('/api/admin/reported-bets', authenticateToken, authenticateAdmin, async (req, res) => {
  try {
    // Check if reported_bets table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'reported_bets'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      // Table doesn't exist, return empty array
      return res.json({ reportedBets: [] });
    }

    const result = await pool.query(`
      SELECT rb.*, b.amount, b.option as bet_option, 
             m.question, u.username as reporter_username
      FROM reported_bets rb
      JOIN bets b ON rb.bet_id = b.id
      JOIN markets m ON b.market_id = m.id
      JOIN users u ON rb.reported_by = u.id
      WHERE rb.status = 'pending'
      ORDER BY rb.created_at DESC
    `);

    res.json({ reportedBets: result.rows });
  } catch (error) {
    console.error('Error fetching reported bets:', error);
    // Return empty array instead of error to prevent frontend crashes
    res.json({ reportedBets: [] });
  }
});

// Get all widgets (admin)
app.get('/api/admin/widgets', authenticateToken, authenticateAdmin, async (req, res) => {
  try {
    // Check if widgets table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'widgets'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      // Table doesn't exist, return empty array
      return res.json({ widgets: [] });
    }

    const result = await pool.query(
      'SELECT * FROM widgets ORDER BY position ASC'
    );

    res.json({ widgets: result.rows });
  } catch (error) {
    console.error('Error fetching widgets:', error);
    res.json({ widgets: [] });
  }
});

// Create widget (admin)
app.post('/api/admin/widgets', authenticateToken, authenticateAdmin, async (req, res) => {
  const { title, content, position, widget_type } = req.body;

  try {
    const result = await pool.query(
      'INSERT INTO widgets (title, content, position, widget_type) VALUES ($1, $2, $3, $4) RETURNING *',
      [title, content, position || 999, widget_type || 'custom']
    );

    res.json({ widget: result.rows[0] });
  } catch (error) {
    console.error('Error creating widget:', error);
    res.status(500).json({ error: 'Failed to create widget' });
  }
});

// Update widget (admin)
app.put('/api/admin/widgets/:id', authenticateToken, authenticateAdmin, async (req, res) => {
  const { title, content, position } = req.body;

  try {
    const result = await pool.query(
      'UPDATE widgets SET title = $1, content = $2, position = $3 WHERE id = $4 RETURNING *',
      [title, content, position, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Widget not found' });
    }

    res.json({ widget: result.rows[0] });
  } catch (error) {
    console.error('Error updating widget:', error);
    res.status(500).json({ error: 'Failed to update widget' });
  }
});

// Delete widget (admin)
app.delete('/api/admin/widgets/:id', authenticateToken, authenticateAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM widgets WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting widget:', error);
    res.status(500).json({ error: 'Failed to delete widget' });
  }
});

// Get all widgets (public)
app.get('/api/widgets', async (req, res) => {
  try {
    // Check if widgets table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'widgets'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      return res.json({ widgets: [] });
    }

    const result = await pool.query(
      'SELECT * FROM widgets ORDER BY position ASC'
    );

    res.json({ widgets: result.rows });
  } catch (error) {
    console.error('Error fetching widgets:', error);
    res.json({ widgets: [] });
  }
});

// ==========================================
// EMAIL VERIFICATION ROUTES (Placeholder)
// ==========================================

app.post('/api/auth/send-verification', async (req, res) => {
  // Placeholder for email verification
  res.json({ success: true, message: 'Verification email sent (placeholder)' });
});

app.post('/api/auth/verify-email', async (req, res) => {
  // Placeholder for email verification
  res.json({ success: true, message: 'Email verified (placeholder)' });
});

app.post('/api/auth/forgot-password', async (req, res) => {
  // Placeholder for password reset
  res.json({ success: true, message: 'Password reset email sent (placeholder)' });
});

app.post('/api/auth/reset-password', async (req, res) => {
  // Placeholder for password reset
  res.json({ success: true, message: 'Password reset successful (placeholder)' });
});

// ==========================================
// HEALTH CHECK
// ==========================================

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.json({ message: 'Binary Bets API', version: '1.0.0' });
});

// ==========================================
// START SERVER
// ==========================================

app.listen(PORT, () => {
  console.log(`🚀 Binary Bets Backend running on port ${PORT}`);
});
