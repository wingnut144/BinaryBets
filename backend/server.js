import express from 'express';
import cors from 'cors';
import pkg from 'pg';
import bcrypt from 'bcrypt';
import jsonwebtoken from 'jsonwebtoken';

const { Pool } = pkg;
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
const pool = new Pool({
  host: process.env.POSTGRES_HOST || process.env.DB_HOST || 'postgres',
  port: process.env.POSTGRES_PORT || process.env.DB_PORT || 5432,
  database: process.env.POSTGRES_DB || process.env.DB_NAME || 'binarybets',
  user: process.env.POSTGRES_USER || process.env.DB_USER || 'binaryuser',
  password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || 'binarypass',
});

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jsonwebtoken.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Admin middleware
const requireAdmin = async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT is_admin FROM users WHERE id = $1',
      [req.user.userId]
    );
    
    if (!result.rows[0] || !result.rows[0].is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    next();
  } catch (error) {
    console.error('Admin check error:', error);
    res.status(500).json({ error: 'Failed to verify admin status' });
  }
};

// =============================================================================
// HEALTH CHECK
// =============================================================================

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// =============================================================================
// AUTHENTICATION ENDPOINTS
// =============================================================================

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    console.log('Login attempt for:', username);
    
    const result = await pool.query(
      'SELECT id, username, email, password_hash, balance, is_admin FROM users WHERE username = $1',
      [username]
    );
    
    if (result.rows.length === 0) {
      console.log('User not found:', username);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    console.log('User found:', { id: user.id, username: user.username, is_admin: user.is_admin });
    
    const validPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!validPassword) {
      console.log('Invalid password for:', username);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jsonwebtoken.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    console.log('✅ Login successful:', { username: user.username, is_admin: user.is_admin });
    
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        balance: parseFloat(user.balance),
        is_admin: user.is_admin || false
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Register
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    console.log('Registration attempt:', { username, email });
    
    // Check if user exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );
    
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }
    
    // Hash password
    const password_hash = await bcrypt.hash(password, 10);
    
    // Insert user
    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash, full_name, balance, is_admin, created_at) 
       VALUES ($1, $2, $3, $4, 1000, FALSE, NOW()) 
       RETURNING id, username, email, balance, is_admin`,
      [username, email, password_hash, username]
    );
    
    const newUser = result.rows[0];
    
    const token = jsonwebtoken.sign(
      { userId: newUser.id, username: newUser.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    console.log('✅ Registration successful:', newUser.username);
    
    res.json({
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        balance: parseFloat(newUser.balance),
        is_admin: newUser.is_admin || false
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Get current user info
app.get('/api/user', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, email, balance, is_admin FROM users WHERE id = $1',
      [req.user.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

// =============================================================================
// CATEGORIES
// =============================================================================

app.get('/api/categories', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM categories ORDER BY display_order'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// =============================================================================
// MARKETS (BETS)
// =============================================================================

// Get all markets
app.get('/api/markets', async (req, res) => {
  try {
    const { status } = req.query;
    
    let query = `
      SELECT 
        m.*,
        c.name as category_name,
        c.color as category_color,
        c.icon as category_icon,
        u.username as creator_username,
        COUNT(DISTINCT b.id) as total_bets,
        COALESCE(SUM(b.amount), 0) as total_pool,
        COALESCE(SUM(CASE WHEN b.bet_type = 'Yes' THEN b.amount ELSE 0 END), 0) as yes_volume,
        COALESCE(SUM(CASE WHEN b.bet_type = 'No' THEN b.amount ELSE 0 END), 0) as no_volume
      FROM markets m
      LEFT JOIN categories c ON m.category_id = c.id
      LEFT JOIN users u ON m.created_by = u.id
      LEFT JOIN bets b ON m.id = b.market_id
    `;
    
    if (status) {
      query += ` WHERE m.status = $1`;
    }
    
    query += ` GROUP BY m.id, c.name, c.color, c.icon, u.username ORDER BY m.created_at DESC`;
    
    const result = status 
      ? await pool.query(query, [status])
      : await pool.query(query);
    
    // Add close_date alias and format odds for frontend
    const markets = result.rows.map(market => {
      const totalPool = parseFloat(market.total_pool || 0);
      const yesVolume = parseFloat(market.yes_volume || 0);
      const noVolume = parseFloat(market.no_volume || 0);
      
      // Calculate volume distribution percentages
      let yesPercent = 50;
      let noPercent = 50;
      
      if (totalPool > 0) {
        yesPercent = Math.round((yesVolume / totalPool) * 100);
        noPercent = Math.round((noVolume / totalPool) * 100);
      }
      
      return {
        ...market,
        close_date: market.deadline,
        total_pool: totalPool,
        current_odds: {
          yes: parseFloat(market.yes_odds || 2.0),
          no: parseFloat(market.no_odds || 2.0)
        },
        volume_distribution: {
          yes: yesPercent,
          no: noPercent
        }
      };
    });
    
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
    
    const result = await pool.query(
      `SELECT m.*, c.name as category_name, c.color as category_color
       FROM markets m
       LEFT JOIN categories c ON m.category_id = c.id
       WHERE m.id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Market not found' });
    }
    
    // Add close_date alias for frontend compatibility
    const market = result.rows[0];
    market.close_date = market.deadline;
    
    res.json(market);
  } catch (error) {
    console.error('Error fetching market:', error);
    res.status(500).json({ error: 'Failed to fetch market' });
  }
});

// Create market
app.post('/api/markets', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { question, category_id, deadline, market_type, ai_odds } = req.body;
    
    console.log('Creating market:', { question, category_id, deadline, market_type, ai_odds });
    
    // Initialize odds based on AI odds if provided
    let yes_odds = 2.0;
    let no_odds = 2.0;
    
    if (ai_odds && ai_odds.odds) {
      const yesPercent = ai_odds.odds.yes || 50;
      const noPercent = ai_odds.odds.no || 50;
      
      // Convert percentages to odds (odds = 100 / percentage)
      yes_odds = parseFloat((100 / yesPercent).toFixed(2));
      no_odds = parseFloat((100 / noPercent).toFixed(2));
    }
    
    const result = await pool.query(
      `INSERT INTO markets (
        question, category_id, created_by, deadline, 
        market_type, status, yes_odds, no_odds, 
        resolved, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()) 
      RETURNING *`,
      [
        question,
        category_id,
        userId,
        deadline,
        market_type || 'binary',
        'active',
        yes_odds,
        no_odds,
        false
      ]
    );
    
    console.log('✅ Market created:', result.rows[0].id);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating market:', error);
    res.status(500).json({ error: 'Failed to create market', details: error.message });
  }
});

// Delete market (admin only)
app.delete('/api/markets/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('Admin deleting market:', id);
    
    await pool.query('DELETE FROM markets WHERE id = $1', [id]);
    
    console.log('✅ Market deleted:', id);
    
    res.json({ success: true, message: 'Market deleted' });
  } catch (error) {
    console.error('Error deleting market:', error);
    res.status(500).json({ error: 'Failed to delete market' });
  }
});

// =============================================================================
// BETS
// =============================================================================

// Place a bet
app.post('/api/bets', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const { market_id, position, amount, odds } = req.body;
  
  console.log('=== PLACING BET ===');
  console.log('User ID:', userId);
  console.log('Market ID:', market_id);
  console.log('Position:', position);
  console.log('Amount:', amount);
  console.log('Odds:', odds);
  
  try {
    await pool.query('BEGIN');
    
    // Check user balance
    const userResult = await pool.query(
      'SELECT balance FROM users WHERE id = $1',
      [userId]
    );
    
    if (!userResult.rows[0]) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userBalance = parseFloat(userResult.rows[0].balance);
    const betAmount = parseFloat(amount);
    
    console.log('User balance:', userBalance);
    console.log('Bet amount:', betAmount);
    
    if (userBalance < betAmount) {
      await pool.query('ROLLBACK');
      return res.status(400).json({ 
        error: `Insufficient balance. You have $${userBalance.toFixed(2)} but need $${betAmount.toFixed(2)}` 
      });
    }
    
    // Get market
    const marketResult = await pool.query(
      'SELECT id, question FROM markets WHERE id = $1',
      [market_id]
    );
    
    if (marketResult.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ error: 'Market not found' });
    }
    
    // Map position to bet_type ('yes'/'no' -> 'Yes'/'No')
    const bet_type = position.toLowerCase() === 'yes' ? 'Yes' : 'No';
    
    // Insert bet
    const betResult = await pool.query(
      `INSERT INTO bets (
        user_id, market_id, amount, odds, bet_type, placed_at
      ) VALUES ($1, $2, $3, $4, $5, NOW()) 
      RETURNING *`,
      [userId, market_id, betAmount, odds || 2.0, bet_type]
    );
    
    console.log('Bet inserted:', betResult.rows[0]);
    
    // Deduct from user balance
    await pool.query(
      'UPDATE users SET balance = balance - $1 WHERE id = $2',
      [betAmount, userId]
    );
    
    await pool.query('COMMIT');
    
    const potential_payout = betAmount * (odds || 2.0);
    
    console.log('✅ Bet placed successfully');
    
    res.json({ 
      success: true, 
      bet: {
        ...betResult.rows[0],
        potential_payout,
        position: bet_type,
        created_at: betResult.rows[0].placed_at
      },
      new_balance: userBalance - betAmount
    });
    
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('❌ ERROR PLACING BET:', error);
    res.status(500).json({ 
      error: 'Failed to place bet', 
      details: error.message
    });
  }
});

// Get user's bets
app.get('/api/user/bets', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    console.log('Fetching bets for user:', userId);
    
    const result = await pool.query(
      `SELECT 
        b.*,
        b.placed_at as created_at,
        b.bet_type as position,
        (b.amount * b.odds) as potential_payout,
        CASE 
          WHEN b.won = true THEN 'won'
          WHEN b.won = false THEN 'lost'
          ELSE 'pending'
        END as status,
        m.question,
        m.deadline as close_date,
        m.resolved,
        CASE 
          WHEN m.resolved = true THEN 'resolved'
          WHEN m.deadline < NOW() THEN 'closed'
          ELSE 'active'
        END as market_status
      FROM bets b
      JOIN markets m ON b.market_id = m.id
      WHERE b.user_id = $1
      ORDER BY b.placed_at DESC`,
      [userId]
    );
    
    console.log('Found', result.rows.length, 'bets for user:', userId);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching user bets:', error);
    res.status(500).json({ error: 'Failed to fetch user bets' });
  }
});

// =============================================================================
// LEADERBOARD
// =============================================================================

app.get('/api/leaderboard', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, balance 
       FROM users 
       WHERE is_admin = FALSE
       ORDER BY balance DESC 
       LIMIT 50`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// =============================================================================
// AI ODDS GENERATION
// =============================================================================

app.post('/api/generate-odds', authenticateToken, async (req, res) => {
  try {
    const { question, options } = req.body;
    
    console.log('Generating AI odds for:', question);
    
    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      console.log('⚠️ No OpenAI API key, returning default odds');
      return res.json({
        odds: { yes: 50, no: 50 },
        reasoning: 'Default odds (50/50) - AI generation not configured'
      });
    }
    
    // Call OpenAI API
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a prediction market analyst. Given a yes/no question, provide probability estimates and reasoning. Respond in JSON format with "yes" and "no" percentages that sum to 100, and a "reasoning" string.'
          },
          {
            role: 'user',
            content: `Question: ${question}\n\nProvide probability estimates as percentages.`
          }
        ],
        temperature: 0.7,
        max_tokens: 200
      })
    });
    
    if (!openaiResponse.ok) {
      throw new Error('OpenAI API request failed');
    }
    
    const data = await openaiResponse.json();
    const content = data.choices[0].message.content;
    
    // Parse AI response
    const aiOdds = JSON.parse(content);
    
    console.log('✅ AI odds generated:', aiOdds);
    
    res.json({
      odds: aiOdds,
      reasoning: aiOdds.reasoning || 'Based on historical data and current trends'
    });
    
  } catch (error) {
    console.error('Error generating AI odds:', error);
    
    // Return default odds on error
    res.json({
      odds: { yes: 50, no: 50 },
      reasoning: 'Default odds (50/50) - AI generation temporarily unavailable'
    });
  }
});

// =============================================================================
// REPORT SYSTEM
// =============================================================================

// Report a market
app.post('/api/markets/:id/report', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user.userId;
    
    console.log('Reporting market:', id, 'by user:', userId);
    
    const result = await pool.query(
      `INSERT INTO market_reports (market_id, reported_by, reason, status, created_at)
       VALUES ($1, $2, $3, 'pending', NOW())
       RETURNING *`,
      [id, userId, reason]
    );
    
    console.log('✅ Market reported:', result.rows[0].id);
    
    res.json({ success: true, report: result.rows[0] });
  } catch (error) {
    console.error('Error reporting market:', error);
    res.status(500).json({ error: 'Failed to report market' });
  }
});

// Get reported markets (admin only) - THIS WAS MISSING!
app.get('/api/admin/reports', authenticateToken, requireAdmin, async (req, res) => {
  try {
    console.log('Fetching reported markets for admin');
    
    const result = await pool.query(
      `SELECT 
        r.*,
        m.question,
        u.username as reporter_username
      FROM market_reports r
      JOIN markets m ON r.market_id = m.id
      LEFT JOIN users u ON r.reported_by = u.id
      ORDER BY r.created_at DESC`
    );
    
    console.log('Found', result.rows.length, 'reports');
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// Resolve a report (admin only)
app.patch('/api/admin/reports/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // 'approve' or 'dismiss'
    const adminId = req.user.userId;
    
    console.log('Resolving report:', id, 'action:', action);
    
    await pool.query('BEGIN');
    
    // Update report status
    const status = action === 'approve' ? 'approved' : 'dismissed';
    
    await pool.query(
      `UPDATE market_reports 
       SET status = $1, resolved_at = NOW(), resolved_by = $2
       WHERE id = $3`,
      [status, adminId, id]
    );
    
    // If approved, delete the market
    if (action === 'approve') {
      const report = await pool.query(
        'SELECT market_id FROM market_reports WHERE id = $1',
        [id]
      );
      
      if (report.rows[0]) {
        await pool.query('DELETE FROM markets WHERE id = $1', [report.rows[0].market_id]);
        console.log('✅ Market deleted:', report.rows[0].market_id);
      }
    }
    
    await pool.query('COMMIT');
    
    console.log('✅ Report resolved:', id);
    
    res.json({ success: true, message: `Report ${action}d` });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error resolving report:', error);
    res.status(500).json({ error: 'Failed to resolve report' });
  }
});

// =============================================================================
// START SERVER
// =============================================================================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🔗 API available at http://localhost:${PORT}`);
  console.log(`📊 Database: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'binarybets'}`);
});

export default app;
