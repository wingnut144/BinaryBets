// server.js - Binary Bets Backend - COMPLETELY FIXED VERSION
import express from 'express';
import cors from 'cors';
import pkg from 'pg';
const { Pool } = pkg;
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import axios from 'axios';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
const RESOLVER_TOKEN = process.env.RESOLVER_TOKEN || 'resolver-token-change-this';

// Initialize AI clients
const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

// Auth middleware
const authenticate = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    console.log('🔐 Authenticated user:', { id: decoded.id, username: decoded.username });
    next();
  } catch (error) {
    console.error('❌ Auth error:', error);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Admin middleware
const requireAdmin = async (req, res, next) => {
  try {
    const userResult = await pool.query('SELECT is_admin FROM users WHERE id = $1', [req.user.id]);
    if (!userResult.rows[0] || !userResult.rows[0].is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  } catch (error) {
    console.error('❌ Admin check error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

// ============================================================================
// AUTHENTICATION ROUTES
// ============================================================================

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields required' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await pool.query(
      'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email, balance',
      [username, email, hashedPassword]
    );

    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });

    console.log('✅ New user registered:', username);
    res.status(201).json({ user, token });
  } catch (error) {
    console.error('❌ Registration error:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Username or email already exists' });
    }
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const result = await pool.query(
      'SELECT id, username, email, password_hash, balance, is_admin FROM users WHERE username = $1',
      [username]
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
      { id: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    delete user.password_hash;
    console.log('✅ User logged in:', username);
    res.json({ user, token });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ============================================================================
// CATEGORY ROUTES
// ============================================================================

app.get('/api/categories', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*, 
        (SELECT COUNT(*) FROM markets WHERE category_id = c.id AND status = 'active') as market_count
      FROM categories c
      ORDER BY c.name
    `);
    
    console.log('📁 Categories loaded:', result.rows.map(c => c.name));
    res.json({ categories: result.rows });
  } catch (error) {
    console.error('❌ Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

app.get('/api/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const categoryResult = await pool.query('SELECT * FROM categories WHERE id = $1', [id]);
    const subcategoriesResult = await pool.query(
      'SELECT * FROM subcategories WHERE category_id = $1 ORDER BY name',
      [id]
    );
    
    if (categoryResult.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    const category = {
      ...categoryResult.rows[0],
      subcategories: subcategoriesResult.rows
    };
    
    res.json({ category });
  } catch (error) {
    console.error('❌ Error fetching category:', error);
    res.status(500).json({ error: 'Failed to fetch category' });
  }
});

app.post('/api/categories', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, icon, color, description } = req.body;
    
    const result = await pool.query(
      'INSERT INTO categories (name, icon, color, description) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, icon, color, description]
    );
    
    console.log('✅ Category created:', name);
    res.status(201).json({ category: result.rows[0] });
  } catch (error) {
    console.error('❌ Error creating category:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

app.post('/api/categories/:id/subcategories', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    
    const result = await pool.query(
      'INSERT INTO subcategories (category_id, name, description) VALUES ($1, $2, $3) RETURNING *',
      [id, name, description]
    );
    
    console.log('✅ Subcategory created:', name);
    res.status(201).json({ subcategory: result.rows[0] });
  } catch (error) {
    console.error('❌ Error creating subcategory:', error);
    res.status(500).json({ error: 'Failed to create subcategory' });
  }
});

// ============================================================================
// MARKET ROUTES - FIXED VERSION
// ============================================================================

app.get('/api/markets', async (req, res) => {
  try {
    const { status, category } = req.query;
    
    let query = `
      SELECT m.*, 
        u.username as creator_name,
        c.name as category_name, c.icon as category_icon, c.color as category_color,
        sc.name as subcategory_name,
        (SELECT COUNT(*) FROM bets WHERE market_id = m.id) as total_bets,
        (SELECT COALESCE(SUM(amount), 0) FROM bets WHERE market_id = m.id) as total_bet_amount
      FROM markets m
      LEFT JOIN users u ON m.created_by = u.id
      LEFT JOIN categories c ON m.category_id = c.id
      LEFT JOIN subcategories sc ON m.subcategory_id = sc.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (status) {
      params.push(status);
      query += ` AND m.status = $${params.length}`;
    }
    
    if (category) {
      params.push(category);
      query += ` AND m.category_id = $${params.length}`;
    }
    
    query += ' ORDER BY m.created_at DESC';
    
    const result = await pool.query(query, params);
    
    // Get options for each market
    for (let market of result.rows) {
      const optionsResult = await pool.query(
        'SELECT * FROM market_options WHERE market_id = $1 ORDER BY id',
        [market.id]
      );
      market.options = optionsResult.rows;
    }
    
    console.log('📊 Loaded', result.rows.length, 'markets');
    res.json({ markets: result.rows });
  } catch (error) {
    console.error('❌ Error fetching markets:', error);
    res.status(500).json({ error: 'Failed to fetch markets' });
  }
});

app.post('/api/markets', authenticate, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { question, options, deadline, category_id, subcategory_id, ai_odds } = req.body;
    
    if (!question || !deadline) {
      return res.status(400).json({ error: 'Missing required fields: question and deadline' });
    }
    
    if (!Array.isArray(options) || options.length < 2) {
      return res.status(400).json({ error: 'At least 2 options required' });
    }
    
    // Insert market (without options column - it doesn't exist in schema)
    const marketResult = await client.query(
      `INSERT INTO markets (question, deadline, created_by, category_id, subcategory_id, ai_odds) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        question, 
        deadline, 
        req.user.id, 
        category_id || null, 
        subcategory_id || null, 
        ai_odds ? JSON.stringify(ai_odds) : null
      ]
    );
    
    const market = marketResult.rows[0];
    
    // Insert each option into market_options table
    for (const optionText of options) {
      await client.query(
        `INSERT INTO market_options (market_id, option_text) VALUES ($1, $2)`,
        [market.id, optionText.trim()]
      );
    }
    
    await client.query('COMMIT');
    
    console.log('✅ Market created:', question, 'with', options.length, 'options');
    res.status(201).json({ market });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error creating market:', error);
    res.status(500).json({ error: 'Failed to create market: ' + error.message });
  } finally {
    client.release();
  }
});

app.delete('/api/markets/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    await pool.query('DELETE FROM markets WHERE id = $1', [id]);
    
    console.log('🗑️  Market deleted:', id);
    res.json({ message: 'Market deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting market:', error);
    res.status(500).json({ error: 'Failed to delete market' });
  }
});

// ============================================================================
// BET ROUTES - FIXED VERSION
// ============================================================================

app.get('/api/bets', authenticate, async (req, res) => {
  try {
    console.log('📊 GET /api/bets - User:', req.user.id);
    
    const result = await pool.query(
      `SELECT b.*, m.question, m.status as market_status, mo.option_text
       FROM bets b
       JOIN markets m ON b.market_id = m.id
       LEFT JOIN market_options mo ON b.option_id = mo.id
       WHERE b.user_id = $1
       ORDER BY b.created_at DESC`,
      [req.user.id]
    );
    
    res.json({ bets: result.rows, username: req.user.username });
  } catch (error) {
    console.error('❌ Error fetching bets:', error);
    res.status(500).json({ error: 'Failed to fetch bets' });
  }
});

app.post('/api/bets', authenticate, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { market_id, option_id, amount } = req.body;
    
    if (!market_id || !option_id || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (amount <= 0) {
      return res.status(400).json({ error: 'Amount must be positive' });
    }
    
    // Get user balance
    const userResult = await client.query('SELECT balance FROM users WHERE id = $1', [req.user.id]);
    
    if (userResult.rows[0].balance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    // Check market is active
    const marketResult = await client.query(
      'SELECT status, deadline FROM markets WHERE id = $1',
      [market_id]
    );
    
    if (marketResult.rows.length === 0) {
      return res.status(404).json({ error: 'Market not found' });
    }
    
    if (marketResult.rows[0].status !== 'active') {
      return res.status(400).json({ error: 'Market is not active' });
    }
    
    if (new Date(marketResult.rows[0].deadline) < new Date()) {
      return res.status(400).json({ error: 'Market has closed' });
    }
    
    // Place bet
    await client.query(
      'INSERT INTO bets (user_id, market_id, option_id, amount) VALUES ($1, $2, $3, $4)',
      [req.user.id, market_id, option_id, amount]
    );
    
    // Update user balance
    await client.query(
      'UPDATE users SET balance = balance - $1 WHERE id = $2',
      [amount, req.user.id]
    );
    
    // Update option total
    await client.query(
      'UPDATE market_options SET total_amount = total_amount + $1 WHERE id = $2',
      [amount, option_id]
    );
    
    const newBalanceResult = await client.query('SELECT balance FROM users WHERE id = $1', [req.user.id]);
    
    await client.query('COMMIT');
    
    console.log('✅ Bet placed by user', req.user.username, 'on market', market_id);
    res.status(201).json({ 
      message: 'Bet placed successfully',
      newBalance: newBalanceResult.rows[0].balance
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error placing bet:', error);
    res.status(500).json({ error: 'Failed to place bet' });
  } finally {
    client.release();
  }
});

// ============================================================================
// LEADERBOARD
// ============================================================================

app.get('/api/leaderboard', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, username, balance
      FROM users
      ORDER BY balance DESC
      LIMIT 100
    `);
    
    res.json({ leaderboard: result.rows });
  } catch (error) {
    console.error('❌ Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// ============================================================================
// AI ODDS GENERATION
// ============================================================================

app.post('/api/generate-odds', authenticate, async (req, res) => {
  try {
    const { question, options } = req.body;
    
    if (!question || !options) {
      return res.status(400).json({ error: 'Question and options required' });
    }
    
    console.log('🤖 Generating odds for:', question);
    
    const prompt = `You are a prediction market odds calculator. Given a question and possible outcomes, estimate the probability of each outcome occurring. Return ONLY a JSON object with the format: {"Option 1": 0.45, "Option 2": 0.55}. The probabilities must sum to 1.0.

Question: ${question}
Options: ${options.join(', ')}

Respond with ONLY the JSON object, no other text.`;

    let oddsData = null;
    
    // Try ChatGPT first
    if (openai) {
      try {
        console.log('🎯 Attempting ChatGPT...');
        const completion = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 200
        });
        
        const response = completion.choices[0].message.content.trim();
        oddsData = JSON.parse(response);
        console.log('✅ ChatGPT odds:', oddsData);
      } catch (error) {
        console.log('⚠️  ChatGPT failed:', error.message);
      }
    }
    
    // Try Claude if ChatGPT failed
    if (!oddsData && anthropic) {
      try {
        console.log('🎯 Attempting Claude...');
        const message = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 200,
          messages: [{ role: 'user', content: prompt }]
        });
        
        const response = message.content[0].text.trim();
        oddsData = JSON.parse(response);
        console.log('✅ Claude odds:', oddsData);
      } catch (error) {
        console.log('⚠️  Claude failed:', error.message);
      }
    }
    
    // Fallback to equal odds
    if (!oddsData) {
      console.log('⚠️  Using fallback equal odds');
      oddsData = {};
      const probability = 1.0 / options.length;
      options.forEach(opt => {
        oddsData[opt] = probability;
      });
    }
    
    res.json({ odds: oddsData, method: 'ai-generated' });
  } catch (error) {
    console.error('❌ Error generating odds:', error);
    res.status(500).json({ error: 'Failed to generate odds' });
  }
});

// ============================================================================
// ADMIN ROUTES
// ============================================================================

app.get('/api/admin/reports', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.*, m.question, u.username as reporter_username
      FROM market_reports r
      JOIN markets m ON r.market_id = m.id
      JOIN users u ON r.reported_by = u.id
      ORDER BY r.created_at DESC
    `);
    
    res.json({ reports: result.rows });
  } catch (error) {
    console.error('❌ Error fetching reports:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

app.post('/api/markets/:id/report', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    await pool.query(
      'INSERT INTO market_reports (market_id, reported_by, reason) VALUES ($1, $2, $3)',
      [id, req.user.id, reason]
    );
    
    console.log('🚩 Market reported:', id);
    res.json({ message: 'Market reported successfully' });
  } catch (error) {
    console.error('❌ Error reporting market:', error);
    res.status(500).json({ error: 'Failed to report market' });
  }
});

app.patch('/api/admin/reports/:id', authenticate, requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { action } = req.body;
    
    const report = await client.query('SELECT market_id FROM market_reports WHERE id = $1', [id]);
    
    if (action === 'approve') {
      await client.query('DELETE FROM markets WHERE id = $1', [report.rows[0].market_id]);
      await client.query('UPDATE market_reports SET status = $1 WHERE id = $2', ['resolved', id]);
    } else if (action === 'dismiss') {
      await client.query('UPDATE market_reports SET status = $1 WHERE id = $2', ['dismissed', id]);
    }
    
    await client.query('COMMIT');
    
    console.log('✅ Report resolved:', id);
    res.json({ message: 'Report resolved' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error resolving report:', error);
    res.status(500).json({ error: 'Failed to resolve report' });
  } finally {
    client.release();
  }
});

// ============================================================================
// MARKET RESOLUTION (for automated resolver)
// ============================================================================

app.post('/api/resolve-market', async (req, res) => {
  const { token, market_id, winning_option_id } = req.body;
  
  if (token !== RESOLVER_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Get winning bets
    const winningBets = await client.query(
      'SELECT * FROM bets WHERE market_id = $1 AND option_id = $2',
      [market_id, winning_option_id]
    );
    
    // Get total pool
    const poolResult = await client.query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM bets WHERE market_id = $1',
      [market_id]
    );
    
    const totalPool = parseFloat(poolResult.rows[0].total);
    
    // Payout winners
    for (const bet of winningBets.rows) {
      const payout = totalPool * (bet.amount / totalPool);
      await client.query(
        'UPDATE users SET balance = balance + $1 WHERE id = $2',
        [payout, bet.user_id]
      );
    }
    
    // Mark market as resolved
    await client.query(
      'UPDATE markets SET status = $1, outcome = $2, resolved_at = NOW() WHERE id = $3',
      ['resolved', winning_option_id, market_id]
    );
    
    await client.query('COMMIT');
    
    console.log('✅ Market resolved:', market_id);
    res.json({ message: 'Market resolved successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error resolving market:', error);
    res.status(500).json({ error: 'Failed to resolve market' });
  } finally {
    client.release();
  }
});

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, () => {
  console.log('🚀 Binary Bets Backend running on port', PORT);
  console.log('✅ Database connected');
  if (anthropic) console.log('✅ Claude AI enabled');
  if (openai) console.log('✅ ChatGPT enabled');
});
