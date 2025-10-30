import express from 'express';
import cors from 'cors';
import pkg from 'pg';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

const { Pool } = pkg;
const app = express();

// CORS configuration
app.use(cors({
  origin: ['https://binary-bets.com', 'http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Database connection
const pool = new Pool({
  user: process.env.DB_USER || 'binaryuser',
  host: process.env.DB_HOST || 'binarybets-postgres',
  database: process.env.DB_NAME || 'binarybets',
  password: process.env.DB_PASSWORD || 'binarypass',
  port: process.env.DB_PORT || 5432,
});

// Test database connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('Error connecting to database:', err.stack);
  } else {
    console.log('✅ Database connected');
    release();
  }
});

// AI clients
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// Check AI availability
const claudeEnabled = !!process.env.ANTHROPIC_API_KEY;
const chatgptEnabled = !!process.env.OPENAI_API_KEY;

if (claudeEnabled) console.log('✅ Claude AI enabled');
if (chatgptEnabled) console.log('✅ ChatGPT enabled');

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

// Middleware to verify resolver token
const authenticateResolver = (req, res, next) => {
  const resolverToken = req.headers['x-resolver-token'];
  
  if (!resolverToken || resolverToken !== process.env.RESOLVER_TOKEN) {
    return res.status(403).json({ error: 'Invalid resolver token' });
  }
  
  next();
};

// Helper function to detect schema
async function detectBetsSchema() {
  try {
    const result = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'bets'
      ORDER BY ordinal_position
    `);
    
    const columns = result.rows.map(row => row.column_name);
    console.log('Bets table columns:', columns);
    
    const hasOption = columns.includes('option');
    const hasOptionId = columns.includes('option_id');
    
    console.log('Has option column:', hasOption);
    console.log('Has option_id column:', hasOptionId);
    
    return { hasOption, hasOptionId, columns };
  } catch (error) {
    console.error('Error detecting schema:', error);
    return { hasOption: false, hasOptionId: true, columns: [] };
  }
}

// AUTH ENDPOINTS

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ error: 'Username must be between 3 and 20 characters' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check for duplicate username
    const usernameCheck = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );

    if (usernameCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    // Check for duplicate email
    const emailCheck = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    const result = await pool.query(
      'INSERT INTO users (username, email, password_hash, balance) VALUES ($1, $2, $3, $4) RETURNING id, username, email, balance, is_admin',
      [username, email, hashedPassword, 1000]
    );

    const user = result.rows[0];
    user.balance = parseFloat(user.balance) || 1000;

    // Generate token
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
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

    const result = await pool.query(
      'SELECT id, username, email, password_hash, balance, is_admin FROM users WHERE email = $1',
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

    user.balance = parseFloat(user.balance) || 0;
    delete user.password_hash;

    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token, user });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, email, balance, is_admin, email_verified FROM users WHERE id = $1',
      [req.user.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = result.rows[0];
    user.balance = parseFloat(user.balance) || 0;
    
    res.json({ user });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

// MARKETS ENDPOINTS

// Get all markets
app.get('/api/markets', async (req, res) => {
  try {
    const schema = await detectBetsSchema();
    
    // Check if options table exists
    const optionsTableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'options'
      );
    `);
    
    const hasOptionsTable = optionsTableCheck.rows[0].exists;
    
    if (!hasOptionsTable) {
      console.error('Options table does not exist');
      return res.json({ markets: [] });
    }

    const result = await pool.query(`
      SELECT 
        m.*,
        u.username as creator_name,
        c.name as category_name,
        c.icon as category_icon,
        c.color as category_color,
        sc.name as subcategory_name,
        COUNT(DISTINCT b.id)::text as bet_count,
        COALESCE(SUM(CASE WHEN o.option_text = 'Yes' THEN b.amount ELSE 0 END), 0)::text as yes_total,
        COALESCE(SUM(CASE WHEN o.option_text = 'No' THEN b.amount ELSE 0 END), 0)::text as no_total
      FROM markets m
      LEFT JOIN users u ON m.created_by = u.id
      LEFT JOIN categories c ON m.category_id = c.id
      LEFT JOIN subcategories sc ON m.subcategory_id = sc.id
      LEFT JOIN bets b ON m.id = b.market_id
      LEFT JOIN options o ON b.option_id = o.id
      GROUP BY m.id, u.username, c.name, c.icon, c.color, sc.name
      ORDER BY m.created_at DESC
    `);

    // Fetch options for each market
    const markets = await Promise.all(result.rows.map(async (market) => {
      const optionsResult = await pool.query(
        'SELECT id, market_id, option_text, total_amount, created_at FROM options WHERE market_id = $1',
        [market.id]
      );
      
      return {
        ...market,
        options: optionsResult.rows
      };
    }));

    console.log(`✅ Successfully fetched ${markets.length} markets`);
    res.json({ markets });
  } catch (error) {
    console.error('Error fetching markets:', error);
    console.error('Full error:', error);
    res.status(500).json({ error: 'Failed to fetch markets' });
  }
});

// Create market
app.post('/api/markets', authenticateToken, async (req, res) => {
  try {
    const { question, deadline, categoryId, subcategoryId, options } = req.body;

    // Validate date - cannot expire today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadlineDate = new Date(deadline);
    deadlineDate.setHours(0, 0, 0, 0);

    if (deadlineDate <= today) {
      return res.status(400).json({ 
        error: 'Market deadline must be at least tomorrow or later. Cannot create markets that expire today.' 
      });
    }

    // Generate AI odds if AI is available
    let aiOdds = null;
    
    if (chatgptEnabled) {
      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are a prediction market odds calculator. Return ONLY a JSON object with odds for each option, no other text.'
            },
            {
              role: 'user',
              content: `Calculate fair odds for this prediction market: "${question}". Options: ${options.join(', ')}. Return as JSON: {"odds": {"option1": 0.XX, "option2": 0.XX}}`
            }
          ],
          max_tokens: 150
        });

        const oddsText = completion.choices[0].message.content.trim();
        aiOdds = JSON.parse(oddsText);
        aiOdds.method = 'ai-generated';
      } catch (aiError) {
        console.log('ChatGPT odds generation failed, trying Claude...');
        
        if (claudeEnabled) {
          try {
            const message = await anthropic.messages.create({
              model: 'claude-3-5-sonnet-20241022',
              max_tokens: 150,
              messages: [
                {
                  role: 'user',
                  content: `Calculate fair odds for this prediction market: "${question}". Options: ${options.join(', ')}. Return ONLY a JSON object: {"odds": {"option1": 0.XX, "option2": 0.XX}}`
                }
              ]
            });

            const oddsText = message.content[0].text.trim();
            aiOdds = JSON.parse(oddsText);
            aiOdds.method = 'ai-generated';
          } catch (claudeError) {
            console.log('Claude odds generation failed');
          }
        }
      }
    }

    // Insert market
    const result = await pool.query(
      'INSERT INTO markets (question, deadline, category_id, subcategory_id, created_by, ai_odds) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [question, deadline, categoryId, subcategoryId, req.user.userId, JSON.stringify(aiOdds)]
    );

    const market = result.rows[0];

    // Insert options
    for (const option of options) {
      await pool.query(
        'INSERT INTO options (market_id, option_text) VALUES ($1, $2)',
        [market.id, option]
      );
    }

    res.json({ market });
  } catch (error) {
    console.error('Error creating market:', error);
    res.status(500).json({ error: 'Failed to create market' });
  }
});

// BETTING ENDPOINTS

// Place bet
app.post('/api/bets', authenticateToken, async (req, res) => {
  try {
    const { marketId, optionId, amount } = req.body;
    const userId = req.user.userId;

    // Validate amount
    if (amount <= 0) {
      return res.status(400).json({ error: 'Bet amount must be positive' });
    }

    // Check user balance
    const userResult = await pool.query(
      'SELECT balance FROM users WHERE id = $1',
      [userId]
    );

    const userBalance = parseFloat(userResult.rows[0].balance);

    if (userBalance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Check market status
    const marketResult = await pool.query(
      'SELECT status, deadline FROM markets WHERE id = $1',
      [marketId]
    );

    if (marketResult.rows.length === 0) {
      return res.status(404).json({ error: 'Market not found' });
    }

    const market = marketResult.rows[0];

    if (market.status !== 'active') {
      return res.status(400).json({ error: 'Market is not active' });
    }

    if (new Date(market.deadline) < new Date()) {
      return res.status(400).json({ error: 'Market has closed' });
    }

    // Calculate current odds
    const betsResult = await pool.query(
      'SELECT option_id, SUM(amount) as total FROM bets WHERE market_id = $1 GROUP BY option_id',
      [marketId]
    );

    const totalPool = betsResult.rows.reduce((sum, row) => sum + parseFloat(row.total), 0) + amount;
    const optionPool = betsResult.rows.find(row => row.option_id === optionId);
    const currentOptionTotal = optionPool ? parseFloat(optionPool.total) : 0;
    const newOptionTotal = currentOptionTotal + amount;
    const odds = totalPool > 0 ? newOptionTotal / totalPool : 0.5;

    // Insert bet
    await pool.query(
      'INSERT INTO bets (user_id, market_id, option_id, amount, odds) VALUES ($1, $2, $3, $4, $5)',
      [userId, marketId, optionId, amount, odds]
    );

    // Update user balance
    await pool.query(
      'UPDATE users SET balance = balance - $1 WHERE id = $2',
      [amount, userId]
    );

    // Update option total
    await pool.query(
      'UPDATE options SET total_amount = total_amount + $1 WHERE id = $2',
      [amount, optionId]
    );

    res.json({ success: true, message: 'Bet placed successfully' });
  } catch (error) {
    console.error('Error placing bet:', error);
    res.status(500).json({ error: 'Failed to place bet' });
  }
});

// Get user bets
app.get('/api/bets', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        b.*,
        m.question,
        m.status as market_status,
        m.outcome,
        o.option_text
      FROM bets b
      JOIN markets m ON b.market_id = m.id
      JOIN options o ON b.option_id = o.id
      WHERE b.user_id = $1
      ORDER BY b.created_at DESC
    `, [req.user.userId]);

    res.json({ bets: result.rows });
  } catch (error) {
    console.error('Error fetching bets:', error);
    res.status(500).json({ error: 'Failed to fetch bets' });
  }
});

// CATEGORIES ENDPOINTS

// Get all categories
app.get('/api/categories', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        c.*,
        json_agg(
          json_build_object(
            'id', sc.id,
            'name', sc.name,
            'category_id', sc.category_id
          )
        ) FILTER (WHERE sc.id IS NOT NULL) as subcategories
      FROM categories c
      LEFT JOIN subcategories sc ON c.id = sc.category_id
      GROUP BY c.id
      ORDER BY c.name
    `);

    res.json({ categories: result.rows });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.json({ categories: [] });
  }
});

// LEADERBOARD ENDPOINT

// Get leaderboard
app.get('/api/leaderboard', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.id,
        u.username,
        u.balance,
        COUNT(b.id)::integer as bet_count,
        0 as wins,
        0 as winnings
      FROM users u
      LEFT JOIN bets b ON u.id = b.user_id
      GROUP BY u.id, u.username, u.balance
      ORDER BY u.balance DESC
      LIMIT 10
    `);

    const players = result.rows.map(player => ({
      ...player,
      balance: parseFloat(player.balance) || 0,
      winnings: 0
    }));

    res.json({ players });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    console.error('Error details:', error);
    res.json({ players: [] });
  }
});

// WIDGETS ENDPOINTS (Admin)

// Get all widgets
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
      'SELECT * FROM widgets WHERE enabled = true ORDER BY position'
    );

    res.json({ widgets: result.rows });
  } catch (error) {
    console.error('Error fetching widgets:', error);
    res.json({ widgets: [] });
  }
});

// Admin: Get reported bets
app.get('/api/admin/reported-bets', authenticateToken, async (req, res) => {
  if (!req.user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  try {
    // Check if table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'reported_bets'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      return res.json({ reportedBets: [] });
    }

    const result = await pool.query(`
      SELECT rb.*, b.amount, 
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
    res.json({ reportedBets: [] });
  }
});

// RESOLVER ENDPOINTS

// Resolve market (resolver service)
app.post('/api/resolver/resolve', authenticateResolver, async (req, res) => {
  try {
    const { marketId, outcome } = req.body;

    // Update market
    await pool.query(
      'UPDATE markets SET status = $1, outcome = $2, resolved_at = NOW() WHERE id = $3',
      ['resolved', outcome, marketId]
    );

    // Get winning bets
    const winningOption = await pool.query(
      'SELECT id FROM options WHERE market_id = $1 AND option_text = $2',
      [marketId, outcome]
    );

    if (winningOption.rows.length > 0) {
      const optionId = winningOption.rows[0].id;

      // Calculate payouts
      const betsResult = await pool.query(
        'SELECT user_id, amount FROM bets WHERE market_id = $1 AND option_id = $2',
        [marketId, optionId]
      );

      // Update user balances with winnings
      for (const bet of betsResult.rows) {
        const payout = parseFloat(bet.amount) * 2; // Simple 2x payout for winners
        await pool.query(
          'UPDATE users SET balance = balance + $1 WHERE id = $2',
          [payout, bet.user_id]
        );
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error resolving market:', error);
    res.status(500).json({ error: 'Failed to resolve market' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Binary Bets Backend running on port ${PORT}`);
});
