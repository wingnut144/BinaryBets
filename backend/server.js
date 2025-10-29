import express from 'express';
import cors from 'cors';
import pkg from 'pg';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const { Pool } = pkg;
const app = express();

// Configuration
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
const RESOLVER_TOKEN = process.env.RESOLVER_TOKEN || 'resolver-secure-token-' + Math.random().toString(36).substring(2, 15);

console.log('🔐 Resolver Token:', RESOLVER_TOKEN);

// Database configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

// Middleware
app.use(cors());
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

  if (token === RESOLVER_TOKEN) {
    next();
  } else {
    res.status(403).json({ error: 'Invalid resolver token' });
  }
};

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// ============================================================================
// AUTH ROUTES
// ============================================================================

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // Hash password
    const password_hash = await bcrypt.hash(password, 10);
    
    // Insert user
    const result = await pool.query(
      'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email, balance',
      [username, email, password_hash]
    );
    
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({ user, token });
  } catch (error) {
    console.error('Register error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Get user
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
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
    
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        balance: user.balance
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get current user
app.get('/api/users/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, email, balance, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================================
// CATEGORY ROUTES
// ============================================================================

// Get all categories with market counts
app.get('/api/categories', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        c.id,
        c.name,
        c.description,
        c.icon,
        c.color,
        COUNT(DISTINCT m.id) as market_count
      FROM categories c
      LEFT JOIN markets m ON c.id = m.category_id AND m.status = 'active'
      GROUP BY c.id, c.name, c.description, c.icon, c.color
      ORDER BY c.name
    `);
    res.json({ categories: result.rows });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single category with subcategories
app.get('/api/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get category
    const categoryResult = await pool.query(
      'SELECT * FROM categories WHERE id = $1',
      [id]
    );
    
    if (categoryResult.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    // Get subcategories with market counts
    const subcategoriesResult = await pool.query(`
      SELECT 
        s.id,
        s.name,
        s.description,
        COUNT(DISTINCT m.id) as market_count
      FROM subcategories s
      LEFT JOIN markets m ON s.id = m.subcategory_id AND m.status = 'active'
      WHERE s.category_id = $1
      GROUP BY s.id, s.name, s.description
      ORDER BY s.name
    `, [id]);
    
    const category = categoryResult.rows[0];
    category.subcategories = subcategoriesResult.rows;
    
    res.json({ category });
  } catch (error) {
    console.error('Get category error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get markets by category
app.get('/api/categories/:id/markets', async (req, res) => {
  try {
    const { id } = req.params;
    const { status = 'active' } = req.query;
    
    const result = await pool.query(`
      SELECT 
        m.*,
        u.username as creator_username,
        c.name as category_name,
        c.icon as category_icon,
        c.color as category_color,
        s.name as subcategory_name
      FROM markets m
      JOIN users u ON m.creator_id = u.id
      LEFT JOIN categories c ON m.category_id = c.id
      LEFT JOIN subcategories s ON m.subcategory_id = s.id
      WHERE m.category_id = $1 AND m.status = $2
      ORDER BY m.created_at DESC
    `, [id, status]);
    
    res.json({ markets: result.rows });
  } catch (error) {
    console.error('Get category markets error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get markets by subcategory
app.get('/api/subcategories/:id/markets', async (req, res) => {
  try {
    const { id } = req.params;
    const { status = 'active' } = req.query;
    
    const result = await pool.query(`
      SELECT 
        m.*,
        u.username as creator_username,
        c.name as category_name,
        c.icon as category_icon,
        c.color as category_color,
        s.name as subcategory_name
      FROM markets m
      JOIN users u ON m.creator_id = u.id
      LEFT JOIN categories c ON m.category_id = c.id
      LEFT JOIN subcategories s ON m.subcategory_id = s.id
      WHERE m.subcategory_id = $1 AND m.status = $2
      ORDER BY m.created_at DESC
    `, [id, status]);
    
    res.json({ markets: result.rows });
  } catch (error) {
    console.error('Get subcategory markets error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================================
// LEADERBOARD ROUTES
// ============================================================================

app.get('/api/leaderboard', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.id,
        u.username,
        u.balance,
        COUNT(DISTINCT b.market_id) as total_bets,
        COUNT(DISTINCT CASE WHEN m.outcome = mo.option_text THEN b.id END) as wins
      FROM users u
      LEFT JOIN bets b ON u.id = b.user_id
      LEFT JOIN markets m ON b.market_id = m.id
      LEFT JOIN market_options mo ON b.option_id = mo.id
      GROUP BY u.id, u.username, u.balance
      ORDER BY u.balance DESC
      LIMIT 10
    `);
    res.json({ leaderboard: result.rows });
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================================
// ADMIN ROUTES
// ============================================================================

app.get('/api/admin/reports', async (req, res) => {
  res.json({ reports: [] });
});

// ============================================================================
// MARKET ROUTES
// ============================================================================

// Get all markets with optional filtering
app.get('/api/markets', async (req, res) => {
  try {
    const { status, category_id, subcategory_id } = req.query;
    
    let query = `
      SELECT 
        m.*,
        u.username as creator_username,
        c.name as category_name,
        c.icon as category_icon,
        c.color as category_color,
        s.name as subcategory_name
      FROM markets m
      JOIN users u ON m.creator_id = u.id
      LEFT JOIN categories c ON m.category_id = c.id
      LEFT JOIN subcategories s ON m.subcategory_id = s.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 1;
    
    if (status) {
      query += ` AND m.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }
    
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
    
    query += ' ORDER BY m.created_at DESC';
    
    const marketsResult = await pool.query(query, params);
    
    // Get options for each market
    for (let market of marketsResult.rows) {
      const optionsResult = await pool.query(
        'SELECT id, option_text, total_amount FROM market_options WHERE market_id = $1',
        [market.id]
      );
      market.options = optionsResult.rows;
    }
    
    res.json({ markets: marketsResult.rows });
  } catch (error) {
    console.error('Get markets error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single market
app.get('/api/markets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const marketResult = await pool.query(
      `SELECT 
        m.*,
        u.username as creator_username,
        c.name as category_name,
        c.icon as category_icon,
        c.color as category_color,
        s.name as subcategory_name
      FROM markets m
      JOIN users u ON m.creator_id = u.id
      LEFT JOIN categories c ON m.category_id = c.id
      LEFT JOIN subcategories s ON m.subcategory_id = s.id
      WHERE m.id = $1`,
      [id]
    );
    
    if (marketResult.rows.length === 0) {
      return res.status(404).json({ error: 'Market not found' });
    }
    
    const market = marketResult.rows[0];
    
    // Get options
    const optionsResult = await pool.query(
      'SELECT id, option_text, total_amount FROM market_options WHERE market_id = $1',
      [id]
    );
    market.options = optionsResult.rows;
    
    res.json({ market });
  } catch (error) {
    console.error('Get market error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create market
app.post('/api/markets', authenticateToken, async (req, res) => {
  try {
    const { question, deadline, options, category_id, subcategory_id } = req.body;
    
    // Insert market
    const marketResult = await pool.query(
      'INSERT INTO markets (creator_id, question, deadline, category_id, subcategory_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.user.id, question, deadline, category_id || null, subcategory_id || null]
    );
    
    const market = marketResult.rows[0];
    
    // Insert options
    for (let option of options) {
      await pool.query(
        'INSERT INTO market_options (market_id, option_text) VALUES ($1, $2)',
        [market.id, option]
      );
    }
    
    res.json({ market });
  } catch (error) {
    console.error('Create market error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================================
// BET ROUTES
// ============================================================================

// Place bet
app.post('/api/bets', authenticateToken, async (req, res) => {
  try {
    const { market_id, option_id, amount } = req.body;
    
    // Check user balance
    const userResult = await pool.query(
      'SELECT balance FROM users WHERE id = $1',
      [req.user.id]
    );
    
    if (userResult.rows[0].balance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    // Check market is active
    const marketResult = await pool.query(
      'SELECT status FROM markets WHERE id = $1',
      [market_id]
    );
    
    if (marketResult.rows[0].status !== 'active') {
      return res.status(400).json({ error: 'Market is not active' });
    }
    
    // Place bet
    await pool.query(
      'INSERT INTO bets (user_id, market_id, option_id, amount) VALUES ($1, $2, $3, $4)',
      [req.user.id, market_id, option_id, amount]
    );
    
    // Update user balance
    await pool.query(
      'UPDATE users SET balance = balance - $1 WHERE id = $2',
      [amount, req.user.id]
    );
    
    // Update option total
    await pool.query(
      'UPDATE market_options SET total_amount = total_amount + $1 WHERE id = $2',
      [amount, option_id]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Place bet error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user's bets
app.get('/api/users/me/bets', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        b.*,
        m.question,
        m.status as market_status,
        m.outcome,
        mo.option_text
      FROM bets b
      JOIN markets m ON b.market_id = m.id
      JOIN market_options mo ON b.option_id = mo.id
      WHERE b.user_id = $1
      ORDER BY b.created_at DESC`,
      [req.user.id]
    );
    
    res.json({ bets: result.rows });
  } catch (error) {
    console.error('Get user bets error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all bets (requires authentication)
app.get('/api/bets', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        b.*,
        m.question,
        m.status as market_status,
        m.outcome,
        mo.option_text
      FROM bets b
      JOIN markets m ON b.market_id = m.id
      JOIN market_options mo ON b.option_id = mo.id
      WHERE b.user_id = $1
      ORDER BY b.created_at DESC`,
      [req.user.id]
    );
    res.json({ bets: result.rows });
  } catch (error) {
    console.error('Get bets error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================================
// RESOLVER ROUTES (Protected with resolver token)
// ============================================================================

// AI resolution endpoint
app.post('/api/resolve-with-ai', authenticateResolver, async (req, res) => {
  try {
    const { question, options } = req.body;
    
    // Try Anthropic first
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 1024,
            messages: [{
              role: 'user',
              content: `You are a prediction market resolver. Given this question: "${question}", and these options: ${options.join(', ')}, determine which option is correct based on current facts. Respond with ONLY the exact option text, nothing else. If you cannot determine the outcome with certainty, respond with "Unresolved".`
            }]
          })
        });
        
        if (anthropicResponse.ok) {
          const data = await anthropicResponse.json();
          const outcome = data.content[0].text.trim();
          console.log('✅ Anthropic determined outcome:', outcome);
          return res.json({ outcome, provider: 'anthropic' });
        }
      } catch (err) {
        console.error('Anthropic error:', err.message);
      }
    }
    
    // Try OpenAI as fallback
    if (process.env.OPENAI_API_KEY) {
      try {
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: 'gpt-4',
            messages: [{
              role: 'system',
              content: 'You are a prediction market resolver. Determine the correct outcome based on current facts. Respond with ONLY the exact option text. If uncertain, respond with "Unresolved".'
            }, {
              role: 'user',
              content: `Question: "${question}"\nOptions: ${options.join(', ')}`
            }],
            max_tokens: 50
          })
        });
        
        if (openaiResponse.ok) {
          const data = await openaiResponse.json();
          const outcome = data.choices[0].message.content.trim();
          console.log('✅ OpenAI determined outcome:', outcome);
          return res.json({ outcome, provider: 'openai' });
        }
      } catch (err) {
        console.error('OpenAI error:', err.message);
      }
    }
    
    // No AI available
    res.json({ outcome: 'Unresolved', provider: 'none' });
  } catch (error) {
    console.error('AI resolution error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Resolve market
app.post('/api/markets/:id/resolve', authenticateResolver, async (req, res) => {
  try {
    const { id } = req.params;
    const { outcome, winning_outcome } = req.body;
    
    // Update market
    await pool.query(
      'UPDATE markets SET status = $1, outcome = $2, resolved_at = NOW() WHERE id = $3',
      ['resolved', outcome, id]
    );
    
    // If there's a winning outcome, pay out winners
    if (winning_outcome && winning_outcome !== 'Unresolved') {
      const winningOptionResult = await pool.query(
        'SELECT id, total_amount FROM market_options WHERE market_id = $1 AND option_text = $2',
        [id, winning_outcome]
      );
      
      if (winningOptionResult.rows.length > 0) {
        const winningOption = winningOptionResult.rows[0];
        
        // Get total pool
        const poolResult = await pool.query(
          'SELECT SUM(total_amount) as total_pool FROM market_options WHERE market_id = $1',
          [id]
        );
        const totalPool = parseFloat(poolResult.rows[0].total_pool) || 0;
        
        // Get winning bets
        const betsResult = await pool.query(
          'SELECT user_id, amount FROM bets WHERE market_id = $1 AND option_id = $2',
          [id, winningOption.id]
        );
        
        // Pay out each winner
        for (let bet of betsResult.rows) {
          const winningAmount = parseFloat(winningOption.total_amount);
          const userBetAmount = parseFloat(bet.amount);
          const payout = winningAmount > 0 ? (userBetAmount / winningAmount) * totalPool : 0;
          
          await pool.query(
            'UPDATE users SET balance = balance + $1 WHERE id = $2',
            [payout, bet.user_id]
          );
          
          await pool.query(
            'UPDATE bets SET payout = $1 WHERE market_id = $2 AND user_id = $3',
            [payout, id, bet.user_id]
          );
        }
      }
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Resolve market error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔐 Resolver Token: ${RESOLVER_TOKEN}`);
});
