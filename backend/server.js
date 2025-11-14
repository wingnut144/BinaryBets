import express from 'express';
import cors from 'cors';
import pkg from 'pg';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;
const app = express();

// Middleware
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'https://binary-bets.com',
    'http://localhost:3000'
  ],
  credentials: true
}));

app.use(express.json());

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

// Test database connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Error connecting to database:', err.stack);
  } else {
    console.log('✅ Database connected successfully');
    release();
  }
});

// Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
}

// Admin middleware
function requireAdmin(req, res, next) {
  if (!req.user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// AI Odds Generation Function
async function generateAIOdds(question, options) {
  console.log('🤖 Generating AI odds for:', question);
  console.log('   Options:', options);
  
  const prompt = `You are an expert prediction market analyst. Given this prediction market question and options, provide realistic probability estimates for each option.

Question: ${question}

Options:
${options.map((opt, i) => `${i + 1}. ${opt}`).join('\n')}

Analyze the question carefully and provide probability estimates that:
1. Add up to 100%
2. Are based on current knowledge and reasonable expectations
3. Reflect real-world likelihood

Respond ONLY with a JSON array of numbers (the probabilities as percentages), like: [45, 35, 20]`;

  // Try OpenAI first
  try {
    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey) {
      console.log('🔍 Trying OpenAI for odds generation...');
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are a prediction market analyst. Respond only with valid JSON arrays of probabilities that sum to 100.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 200
        })
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices[0].message.content.trim();
        console.log('✅ OpenAI response:', content);
        
        const match = content.match(/\[[\d\s,\.]+\]/);
        if (match) {
          const probabilities = JSON.parse(match[0]);
          console.log('📊 Parsed probabilities:', probabilities);
          
          const sum = probabilities.reduce((a, b) => a + b, 0);
          const normalized = probabilities.map(p => (p / sum) * 100);
          const odds = normalized.map(p => parseFloat((100 / p).toFixed(2)));
          
          console.log('🎯 Generated odds from OpenAI:', odds);
          return odds;
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.log('❌ OpenAI API error:', response.status, errorData);
      }
    }
  } catch (error) {
    console.error('❌ OpenAI failed:', error.message);
  }

  // Try Anthropic as fallback
  try {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (anthropicKey) {
      console.log('🔍 Trying Anthropic for odds generation...');
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 200,
          messages: [
            { role: 'user', content: prompt }
          ]
        })
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.content[0].text.trim();
        console.log('✅ Anthropic response:', content);
        
        const match = content.match(/\[[\d\s,\.]+\]/);
        if (match) {
          const probabilities = JSON.parse(match[0]);
          console.log('📊 Parsed probabilities:', probabilities);
          
          const sum = probabilities.reduce((a, b) => a + b, 0);
          const normalized = probabilities.map(p => (p / sum) * 100);
          const odds = normalized.map(p => parseFloat((100 / p).toFixed(2)));
          
          console.log('🎯 Generated odds from Anthropic:', odds);
          return odds;
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.log('❌ Anthropic API error:', response.status, errorData);
      }
    }
  } catch (error) {
    console.error('❌ Anthropic failed:', error.message);
  }

  console.log('⚠️  AI generation failed, using equal odds');
  return options.map(() => parseFloat(options.length.toFixed(2)));
}

// Helper function to recalculate odds based on bets
async function recalculateOdds(client, marketId) {
  const optionsResult = await client.query(
    'SELECT id FROM options WHERE market_id = $1',
    [marketId]
  );

  for (const option of optionsResult.rows) {
    const betsResult = await client.query(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM bets 
       WHERE option_id = $1 AND status = 'pending'`,
      [option.id]
    );

    const totalBet = parseFloat(betsResult.rows[0].total);

    const allBetsResult = await client.query(
      `SELECT COALESCE(SUM(b.amount), 0) as total
       FROM bets b
       JOIN options o ON b.option_id = o.id
       WHERE o.market_id = $1 AND b.status = 'pending'`,
      [marketId]
    );

    const marketTotal = parseFloat(allBetsResult.rows[0].total);

    let newOdds;
    if (marketTotal === 0) {
      const optionCount = optionsResult.rows.length;
      newOdds = optionCount;
    } else {
      const impliedProbability = totalBet / marketTotal;
      newOdds = impliedProbability > 0 ? (1 / impliedProbability) : optionsResult.rows.length;
      newOdds = Math.max(1.01, Math.min(newOdds, 100));
    }

    await client.query(
      'UPDATE options SET odds = $1 WHERE id = $2',
      [newOdds, option.id]
    );
  }
}

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// AUTH ROUTES
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields required' });
    }

    const userCheck = await pool.query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );

    if (userCheck.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash, balance, is_admin)
       VALUES ($1, $2, $3, 1000.00, false)
       RETURNING id, username, email, balance, is_admin, created_at`,
      [username, email, hashedPassword]
    );

    const user = result.rows[0];
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email, is_admin: user.is_admin },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token, user });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

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
      { id: user.id, username: user.username, email: user.email, is_admin: user.is_admin },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ 
      token, 
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        balance: user.balance,
        is_admin: user.is_admin
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, email, balance, is_admin, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// CATEGORIES
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

// MARKETS
app.post('/api/markets', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { question, category_id, deadline, options, useAiOdds } = req.body;
    const userId = req.user.id;

    if (!question || !category_id || !deadline) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!options || options.length < 2) {
      return res.status(400).json({ error: 'At least 2 options required' });
    }

    const deadlineDate = new Date(deadline);
    if (deadlineDate <= new Date()) {
      return res.status(400).json({ error: 'Deadline must be in the future' });
    }

    await client.query('BEGIN');

    const categoryCheck = await client.query(
      'SELECT id FROM categories WHERE id = $1',
      [category_id]
    );

    if (categoryCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid category' });
    }

    const marketResult = await client.query(
      `INSERT INTO markets (question, category_id, deadline, status, created_by)
       VALUES ($1, $2, $3, 'active', $4)
       RETURNING *`,
      [question, category_id, deadline, userId]
    );

    const market = marketResult.rows[0];

    let oddsArray;
    if (useAiOdds) {
      console.log('🤖 Using AI to generate odds...');
      oddsArray = await generateAIOdds(question, options);
    } else {
      console.log('⚖️  Using equal odds...');
      oddsArray = options.map(() => parseFloat(options.length.toFixed(2)));
    }

    for (let i = 0; i < options.length; i++) {
      const optionName = options[i];
      const odds = oddsArray[i] || options.length;
      
      if (optionName && optionName.trim()) {
        await client.query(
          `INSERT INTO options (market_id, name, odds)
           VALUES ($1, $2, $3)`,
          [market.id, optionName.trim(), odds]
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

app.get('/api/markets', async (req, res) => {

// Edit market (user can edit their own market, admin can edit any)
app.put('/api/markets/:id', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id: marketId } = req.params;
    const { question, deadline } = req.body;
    const userId = req.user.id;

    await client.query('BEGIN');

    const marketResult = await client.query(
      'SELECT * FROM markets WHERE id = $1',
      [marketId]
    );

    if (marketResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Market not found' });
    }

    const market = marketResult.rows[0];

    // Check if user owns the market or is admin
    if (market.created_by !== userId && !req.user.is_admin) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Not authorized to edit this market' });
    }

    // Don't allow editing if market has bets
    const betsCheck = await client.query(
      'SELECT COUNT(*) as count FROM bets WHERE market_id = $1',
      [marketId]
    );

    if (parseInt(betsCheck.rows[0].count) > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cannot edit market that has bets' });
    }

    // Update market
    await client.query(
      'UPDATE markets SET question = $1, deadline = $2 WHERE id = $3',
      [question, deadline, marketId]
    );

    await client.query('COMMIT');

    res.json({ success: true, message: 'Market updated successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating market:', error);
    res.status(500).json({ error: 'Failed to update market' });
  } finally {
    client.release();
  }
});

// Delete market (admin only)
app.delete('/api/markets/:id', authenticateToken, requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id: marketId } = req.params;

    await client.query('BEGIN');

    const marketResult = await client.query(
      'SELECT * FROM markets WHERE id = $1',
      [marketId]
    );

    if (marketResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Market not found' });
    }

    // Refund all bets on this market
    const bets = await client.query(
      'SELECT user_id, amount FROM bets WHERE market_id = $1',
      [marketId]
    );

    for (const bet of bets.rows) {
      await client.query(
        'UPDATE users SET balance = balance + $1 WHERE id = $2',
        [bet.amount, bet.user_id]
      );
    }

    // Delete bets first (due to foreign key)
    await client.query('DELETE FROM bets WHERE market_id = $1', [marketId]);

    // Delete options
    await client.query('DELETE FROM options WHERE market_id = $1', [marketId]);

    // Delete market
    await client.query('DELETE FROM markets WHERE id = $1', [marketId]);

    await client.query('COMMIT');

    res.json({ success: true, message: 'Market deleted and all bets refunded' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting market:', error);
    res.status(500).json({ error: 'Failed to delete market' });
  } finally {
    client.release();
  }
});

  try {
    const { category, status } = req.query;
    
    let query = `
      SELECT 
        m.*,
        c.name as category_name,
        c.icon as category_icon,
        u.username as creator_username,
        COUNT(DISTINCT b.id) as total_bets,
        COALESCE(SUM(b.amount), 0) as total_volume
      FROM markets m
      LEFT JOIN categories c ON m.category_id = c.id
      LEFT JOIN users u ON m.created_by = u.id
      LEFT JOIN options o ON m.id = o.market_id
      LEFT JOIN bets b ON o.id = b.option_id AND b.status = 'pending'
    `;
    
    const conditions = [];
    const params = [];
    
    if (category) {
      params.push(category);
      conditions.push(`m.category_id = $${params.length}`);
    }
    
    if (status) {
      params.push(status);
      conditions.push(`m.status = $${params.length}`);
    }
    
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    query += ` GROUP BY m.id, c.name, c.icon, u.username ORDER BY m.created_at DESC`;
    
    const marketsResult = await pool.query(query, params);
    
    const markets = await Promise.all(marketsResult.rows.map(async (market) => {
      const optionsResult = await pool.query(
        `SELECT 
           o.*,
           COUNT(b.id) as bet_count,
           COALESCE(SUM(b.amount), 0) as total_bet
         FROM options o
         LEFT JOIN bets b ON o.id = b.option_id AND b.status = 'pending'
         WHERE o.market_id = $1
         GROUP BY o.id
         ORDER BY o.name`,
        [market.id]
      );
      
      return {
        ...market,
        options: optionsResult.rows.map(opt => ({
          ...opt,
          odds: parseFloat(opt.odds),
          bet_count: parseInt(opt.bet_count),
          total_bet: parseFloat(opt.total_bet)
        }))
      };
    }));
    
    res.json(markets);
  } catch (error) {
    console.error('Error fetching markets:', error);
    res.status(500).json({ error: 'Failed to fetch markets' });
  }
});


// Dynamic odds calculation function
async function updateOdds(client, marketId) {
  try {
    const optionsResult = await client.query('SELECT id FROM options WHERE market_id = $1', [marketId]);
    const options = optionsResult.rows;
    if (options.length === 0) return;

    const betsData = await client.query(
      'SELECT option_id, SUM(amount) as total_amount FROM bets WHERE market_id = $1 AND status = $2 GROUP BY option_id',
      [marketId, 'pending']
    );

    const betsByOption = {};
    let totalPoolAmount = 0;
    betsData.rows.forEach(row => {
      const amount = parseFloat(row.total_amount);
      betsByOption[row.option_id] = amount;
      totalPoolAmount += amount;
    });

    for (const option of options) {
      const optionBets = betsByOption[option.id] || 0;
      let newOdds;
      if (totalPoolAmount === 0 || optionBets === 0) {
        newOdds = 2.0;
      } else {
        newOdds = (totalPoolAmount / optionBets) * 0.95;
        newOdds = Math.max(1.1, Math.min(newOdds, 50.0));
      }
      newOdds = Math.round(newOdds * 100) / 100;
      await client.query('UPDATE options SET odds = $1 WHERE id = $2', [newOdds, option.id]);
    }
  } catch (error) {
    console.error('Error updating odds:', error);
    throw error;
  }
}

// BETS
app.post('/api/bets', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { market_id, option_id, amount } = req.body;
    const userId = req.user.id;

    if (!market_id || !option_id || !amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid bet parameters' });
    }

    await client.query('BEGIN');

    const userResult = await client.query(
      'SELECT balance FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }

    const userBalance = parseFloat(userResult.rows[0].balance);

    if (userBalance < amount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient balance' });
    }

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

    if (new Date(market.deadline) < new Date()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Market has expired' });
    }

    const optionResult = await client.query(
      'SELECT * FROM options WHERE id = $1 AND market_id = $2',
      [option_id, market_id]
    );

    if (optionResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Option not found' });
    }

    const option = optionResult.rows[0];
    const potentialPayout = amount * parseFloat(option.odds);

    await client.query(
      `INSERT INTO bets (user_id, market_id, option_id, amount, potential_payout, status, edit_count)
       VALUES ($1, $2, $3, $4, $5, 'pending', 0)`,
      [userId, market_id, option_id, amount, potentialPayout]
    );

    const newBalance = userBalance - amount;
    await client.query(
      'UPDATE users SET balance = $1 WHERE id = $2',
      [newBalance, userId]
    );

    await recalculateOdds(client, market_id);

    await client.query('COMMIT');

    res.json({ 
      success: true, 
      newBalance,
      message: 'Bet placed successfully'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error placing bet:', error);
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
         m.question as market_question,
         m.deadline as market_deadline,
         o.name as option_name,
         o.odds as current_odds,
         m.status as market_status
       FROM bets b
       JOIN markets m ON b.market_id = m.id
       JOIN options o ON b.option_id = o.id
       WHERE b.user_id = $1
       ORDER BY b.created_at DESC`,
      [userId]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching user bets:', error);
    res.status(500).json({ error: 'Failed to fetch bets' });
  }
});

// Edit bet (user can edit up to 2 times)
app.put('/api/bets/:id', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id: betId } = req.params;
    const { option_id, amount } = req.body;
    const userId = req.user.id;

    await client.query('BEGIN');

    // Get the bet
    const betResult = await client.query(
      `SELECT b.*, m.status as market_status, m.deadline, m.id as market_id
       FROM bets b
       JOIN markets m ON b.market_id = m.id
       WHERE b.id = $1`,
      [betId]
    );

    if (betResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Bet not found' });
    }

    const bet = betResult.rows[0];

    // Check if user owns the bet or is admin
    if (bet.user_id !== userId && !req.user.is_admin) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Not authorized to edit this bet' });
    }

    // Check edit limit (only for non-admins)
    if (!req.user.is_admin && bet.edit_count >= 2) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Maximum edit limit (2) reached' });
    }

    // Check if market is still active
    if (bet.market_status !== 'active' || new Date(bet.deadline) < new Date()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cannot edit bet on closed market' });
    }

    // Get old balance
    const userResult = await client.query(
      'SELECT balance FROM users WHERE id = $1',
      [bet.user_id]
    );
    const currentBalance = parseFloat(userResult.rows[0].balance);

    // Refund old bet amount
    const newBalance = currentBalance + parseFloat(bet.amount);

    // Verify new amount is affordable
    if (newBalance < amount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient balance for new bet amount' });
    }

    // Get new option and odds
    const optionResult = await client.query(
      'SELECT * FROM options WHERE id = $1 AND market_id = $2',
      [option_id, bet.market_id]
    );

    if (optionResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Option not found' });
    }

    const option = optionResult.rows[0];
    const potentialPayout = amount * parseFloat(option.odds);

    // Record edit history
    await client.query(
      `INSERT INTO bet_edit_history (bet_id, old_amount, new_amount, old_option_id, new_option_id, edited_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [betId, bet.amount, amount, bet.option_id, option_id, userId]
    );

    // Update bet
    await client.query(
      `UPDATE bets 
       SET option_id = $1, amount = $2, potential_payout = $3, edit_count = edit_count + 1
       WHERE id = $4`,
      [option_id, amount, potentialPayout, betId]
    );

    // Update user balance
    const finalBalance = newBalance - amount;
    await client.query(
      'UPDATE users SET balance = $1 WHERE id = $2',
      [finalBalance, bet.user_id]
    );

    // Recalculate odds
    await recalculateOdds(client, bet.market_id);

    await client.query('COMMIT');

    res.json({ 
      success: true, 
      newBalance: finalBalance,
      message: 'Bet updated successfully'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error editing bet:', error);
    res.status(500).json({ error: 'Failed to edit bet' });
  } finally {
    client.release();
  }
});

// Delete bet (admin only)
app.delete('/api/bets/:id', authenticateToken, requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id: betId } = req.params;

    await client.query('BEGIN');

    const betResult = await client.query(
      `SELECT b.*, m.id as market_id
       FROM bets b
       JOIN markets m ON b.market_id = m.id
       WHERE b.id = $1`,
      [betId]
    );

    if (betResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Bet not found' });
    }

    const bet = betResult.rows[0];

    // Refund the bet amount to user
    await client.query(
      'UPDATE users SET balance = balance + $1 WHERE id = $2',
      [bet.amount, bet.user_id]
    );

    // Delete the bet
    await client.query('DELETE FROM bets WHERE id = $1', [betId]);

    // Recalculate odds
    await recalculateOdds(client, bet.market_id);

    await client.query('COMMIT');

    res.json({ success: true, message: 'Bet deleted and refunded' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting bet:', error);
    res.status(500).json({ error: 'Failed to delete bet' });
  } finally {
    client.release();
  }
});

// LEADERBOARD
app.get('/api/leaderboard', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
         u.id,
         u.username,
         u.balance,
         COUNT(DISTINCT b.id) as total_bets,
         COALESCE(SUM(CASE WHEN b.status = 'won' THEN b.potential_payout - b.amount ELSE 0 END), 0) as total_winnings
       FROM users u
       LEFT JOIN bets b ON u.id = b.user_id
       WHERE u.id != 1
       GROUP BY u.id, u.username, u.balance
       ORDER BY u.balance DESC
       LIMIT 20`
    );

    res.json(result.rows.map(user => ({
      id: user.id,
      username: user.username,
      balance: parseFloat(user.balance),
      total_bets: parseInt(user.total_bets),
      total_winnings: parseFloat(user.total_winnings)
    })));
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// BET REPORTS
app.post('/api/bets/:id/report', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id: betId } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;

    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({ error: 'Please provide a detailed reason (at least 10 characters)' });
    }

    await client.query('BEGIN');

    const betCheck = await client.query(
      'SELECT * FROM bets WHERE id = $1',
      [betId]
    );

    if (betCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Bet not found' });
    }

    const existingReport = await client.query(
      'SELECT id FROM bet_reports WHERE bet_id = $1 AND reported_by = $2',
      [betId, userId]
    );

    if (existingReport.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'You have already reported this bet' });
    }

    const reportResult = await client.query(
      `INSERT INTO bet_reports (bet_id, reported_by, reason, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING *`,
      [betId, userId, reason.trim()]
    );

    await client.query(
      `INSERT INTO messages (from_user_id, to_user_id, subject, message)
       VALUES (1, $1, 'Bet Report Received', $2)`,
      [
        userId,
        `Thank you for reporting bet #${betId}. Our moderation team will review your report shortly. You will be notified once action has been taken.

Report Reason: ${reason}

Reference ID: ${reportResult.rows[0].id}`
      ]
    );

    const admins = await client.query('SELECT id FROM users WHERE is_admin = true');
    for (const admin of admins.rows) {
      await client.query(
        `INSERT INTO messages (from_user_id, to_user_id, subject, message)
         VALUES ($1, $2, 'New Bet Report', $3)`,
        [
          userId,
          admin.id,
          `A bet has been reported and requires review.

Bet ID: #${betId}
Reported by: User #${userId}
Reason: ${reason}

Please review this report in the admin dashboard.`
        ]
      );
    }

    await client.query('COMMIT');

    res.json({ 
      success: true, 
      message: 'Bet reported successfully. You will be notified once reviewed.',
      report: reportResult.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error reporting bet:', error);
    res.status(500).json({ error: 'Failed to report bet' });
  } finally {
    client.release();
  }
});

app.get('/api/admin/reports', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    
    let query = `
      SELECT 
        br.*,
        b.amount,
        b.potential_payout,
        m.question as market_question,
        o.name as option_name,
        u.username as reported_by_username,
        reviewer.username as reviewed_by_username
      FROM bet_reports br
      JOIN bets b ON br.bet_id = b.id
      JOIN users u ON br.reported_by = u.id
      LEFT JOIN users reviewer ON br.reviewed_by = reviewer.id
      JOIN options o ON b.option_id = o.id
      JOIN markets m ON b.market_id = m.id
    `;
    
    const params = [];
    if (status) {
      params.push(status);
      query += ` WHERE br.status = $1`;
    }
    
    query += ` ORDER BY br.created_at DESC`;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

app.post('/api/admin/reports/:id/review', authenticateToken, requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id: reportId } = req.params;
    const { action, admin_notes } = req.body;
    const adminId = req.user.id;

    await client.query('BEGIN');

    const reportResult = await client.query(
      'SELECT * FROM bet_reports WHERE id = $1',
      [reportId]
    );

    if (reportResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Report not found' });
    }

    const report = reportResult.rows[0];

    if (action === 'approve') {
      await client.query('DELETE FROM bets WHERE id = $1', [report.bet_id]);
      
      await client.query(
        `UPDATE bet_reports 
         SET status = 'reviewed', reviewed_by = $1, reviewed_at = NOW(), admin_notes = $2
         WHERE id = $3`,
        [adminId, admin_notes, reportId]
      );

      await client.query(
        `INSERT INTO messages (from_user_id, to_user_id, subject, message)
         VALUES (1, $1, 'Report Resolved - Action Taken', $2)`,
        [
          report.reported_by,
          `Your report (ID: ${reportId}) has been reviewed and the bet has been removed.

Admin notes: ${admin_notes || 'No additional notes'}

Thank you for helping keep Binary Bets fair and safe!`
        ]
      );
    } else {
      await client.query(
        `UPDATE bet_reports 
         SET status = 'dismissed', reviewed_by = $1, reviewed_at = NOW(), admin_notes = $2
         WHERE id = $3`,
        [adminId, admin_notes, reportId]
      );

      await client.query(
        `INSERT INTO messages (from_user_id, to_user_id, subject, message)
         VALUES (1, $1, 'Report Resolved - No Action Taken', $2)`,
        [
          report.reported_by,
          `Your report (ID: ${reportId}) has been reviewed. After investigation, no action was taken.

Admin notes: ${admin_notes || 'The reported content did not violate our policies.'}

If you have additional concerns, please submit a new report with more details.`
        ]
      );
    }

    await client.query('COMMIT');

    res.json({ success: true, message: 'Report reviewed successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error reviewing report:', error);
    res.status(500).json({ error: 'Failed to review report' });
  } finally {
    client.release();
  }
});

// ANNOUNCEMENTS
app.get('/api/announcements', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, u.username as created_by_username
       FROM announcements a
       JOIN users u ON a.created_by = u.id
       WHERE a.is_active = true 
       AND (a.expires_at IS NULL OR a.expires_at > NOW())
       ORDER BY a.created_at DESC
       LIMIT 10`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching announcements:', error);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

app.post('/api/admin/announcements', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { title, message, expires_at } = req.body;
    const adminId = req.user.id;

    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message required' });
    }

    const result = await pool.query(
      `INSERT INTO announcements (title, message, created_by, expires_at)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [title, message, adminId, expires_at || null]
    );

    res.json({ success: true, announcement: result.rows[0] });
  } catch (error) {
    console.error('Error creating announcement:', error);
    res.status(500).json({ error: 'Failed to create announcement' });
  }
});

app.delete('/api/admin/announcements/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    await pool.query(
      'UPDATE announcements SET is_active = false WHERE id = $1',
      [id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting announcement:', error);
    res.status(500).json({ error: 'Failed to delete announcement' });
  }
});

app.get('/api/admin/announcements', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, u.username as created_by_username
       FROM announcements a
       JOIN users u ON a.created_by = u.id
       ORDER BY a.created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching all announcements:', error);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

// MESSAGES
app.get('/api/messages', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { type } = req.query;

    let query;
    if (type === 'sent') {
      query = `
        SELECT m.*, 
               to_user.username as to_username,
               from_user.username as from_username
        FROM messages m
        JOIN users to_user ON m.to_user_id = to_user.id
        JOIN users from_user ON m.from_user_id = from_user.id
        WHERE m.from_user_id = $1
        ORDER BY m.created_at DESC
      `;
    } else {
      query = `
        SELECT m.*, 
               to_user.username as to_username,
               from_user.username as from_username
        FROM messages m
        JOIN users to_user ON m.to_user_id = to_user.id
        JOIN users from_user ON m.from_user_id = from_user.id
        WHERE m.to_user_id = $1
        ORDER BY m.is_read ASC, m.created_at DESC
      `;
    }

    const result = await pool.query(query, [userId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

app.get('/api/messages/unread-count', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      'SELECT COUNT(*) as count FROM messages WHERE to_user_id = $1 AND is_read = false',
      [userId]
    );
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

app.post('/api/messages', authenticateToken, async (req, res) => {
  try {
    const { to_user_id, subject, message, parent_message_id } = req.body;
    const fromUserId = req.user.id;

    if (!to_user_id || !message) {
      return res.status(400).json({ error: 'Recipient and message required' });
    }

    const userCheck = await pool.query(
      'SELECT id FROM users WHERE id = $1',
      [to_user_id]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Recipient not found' });
    }

    const result = await pool.query(
      `INSERT INTO messages (from_user_id, to_user_id, subject, message, parent_message_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [fromUserId, to_user_id, subject, message, parent_message_id || null]
    );

    res.json({ success: true, message: result.rows[0] });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

app.post('/api/messages/:id/read', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    await pool.query(
      'UPDATE messages SET is_read = true WHERE id = $1 AND to_user_id = $2',
      [id, userId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking message as read:', error);
    res.status(500).json({ error: 'Failed to mark message as read' });
  }
});

app.get('/api/admins', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username FROM users WHERE is_admin = true ORDER BY username'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching admins:', error);
    res.status(500).json({ error: 'Failed to fetch admins' });
  }
});

// AI NEWS
app.get('/api/ai-news', async (req, res) => {
  try {
    const news = [
      {
        category: 'Sports',
        icon: '⚽',
        headline: 'Sports: Who will win the 2026 NBA Championship?',
        source_url: null
      },
      {
        category: 'Technology',
        icon: '💻',
        headline: 'Technology: Will the next iPhone have a foldable screen?',
        source_url: null
      },
      {
        category: 'Finance',
        icon: '💰',
        headline: 'Finance: Will Bitcoin reach $100,000 by end of 2026?',
        source_url: null
      }
    ];
    
    res.json({ news });
  } catch (error) {
    console.error('Error fetching AI news:', error);
    res.status(500).json({ error: 'Failed to fetch news' });
  }
});

// SERVER START

// ============= NOTIFICATION ENDPOINTS =============

app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

app.post('/api/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    await pool.query(
      'UPDATE notifications SET read = TRUE WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

app.get('/api/notifications/unread/count', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND read = FALSE',
      [req.user.id]
    );
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

app.post('/api/markets/:id/restore', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const marketResult = await pool.query(
      'SELECT * FROM markets WHERE id = $1 AND created_by = $2',
      [id, req.user.id]
    );
    if (marketResult.rows.length === 0) {
      return res.status(404).json({ error: 'Market not found or unauthorized' });
    }
    const market = marketResult.rows[0];
    if (!market.closed_early) {
      return res.status(400).json({ error: 'Market was not closed early' });
    }
    const betsResult = await pool.query(
      'SELECT b.*, u.username, o.name as option_name FROM bets b JOIN users u ON b.user_id = u.id JOIN options o ON b.option_id = o.id WHERE b.market_id = $1',
      [id]
    );
    const optionsResult = await pool.query('SELECT * FROM options WHERE market_id = $1', [id]);
    const newMarketResult = await pool.query(
      'INSERT INTO markets (question, description, deadline, created_by, category_id, skip_ai_resolution, image_url, status) VALUES ($1, $2, $3, $4, $5, TRUE, $6, $7) RETURNING id',
      [market.question, market.description, market.deadline, req.user.id, market.category_id, market.image_url, 'active']
    );
    const newMarketId = newMarketResult.rows[0].id;
    const optionMapping = {};
    for (const option of optionsResult.rows) {
      const newOptionResult = await pool.query(
        'INSERT INTO options (market_id, name) VALUES ($1, $2) RETURNING id',
        [newMarketId, option.name]
      );
      optionMapping[option.id] = newOptionResult.rows[0].id;
    }
    for (const bet of betsResult.rows) {
      const newOptionId = optionMapping[bet.option_id];
      await pool.query(
        'INSERT INTO bets (user_id, market_id, option_id, amount, odds, potential_payout) VALUES ($1, $2, $3, $4, $5, $6)',
        [bet.user_id, newMarketId, newOptionId, bet.amount, bet.odds, bet.potential_payout]
      );
    }
    const uniqueBettors = [...new Set(betsResult.rows.map(b => b.user_id))];
    for (const bettorId of uniqueBettors) {
      await pool.query(
        'INSERT INTO notifications (user_id, type, title, message, data) VALUES ($1, $2, $3, $4, $5)',
        [bettorId, 'market_restored', 'Market Restored', 'The market "' + market.question + '" has been restored and your bet transferred.', JSON.stringify({ marketId: newMarketId })]
      );
    }
    res.json({ success: true, newMarketId, message: 'Market restored successfully' });
  } catch (error) {
    console.error('Error restoring market:', error);
    res.status(500).json({ error: 'Failed to restore market' });
  }
});

// Admin: Get resolver logs
app.get('/api/admin/resolver-logs', authenticateToken, requireAdmin, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const result = await pool.query(`
      SELECT rl.*, m.question as market_question
      FROM resolver_logs rl
      LEFT JOIN markets m ON rl.market_id = m.id
      ORDER BY rl.created_at DESC
      LIMIT 100
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching resolver logs:', error);
    res.status(500).json({ error: 'Failed to fetch resolver logs' });
  }
});



// Login and Register endpoints (aliases for frontend compatibility)
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
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
      { id: user.id, username: user.username, email: user.email, is_admin: user.is_admin },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ token, user: { id: user.id, username: user.username, email: user.email, balance: user.balance, is_admin: user.is_admin } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/register', async (req, res) => {
  try {
    const { email, username, password } = req.body;
    const existingUser = await pool.query(
      'SELECT * FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email or username already exists' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (email, username, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email, balance, is_admin',
      [email, username, hashedPassword]
    );
    const user = result.rows[0];
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email, is_admin: user.is_admin },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ token, user });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Database: ${process.env.POSTGRES_DB}`);
  console.log(`🤖 OpenAI API: ${process.env.OPENAI_API_KEY ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`🤖 Anthropic API: ${process.env.ANTHROPIC_API_KEY ? '✅ Configured' : '❌ Not configured'}`);
});
