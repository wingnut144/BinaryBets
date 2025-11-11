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
          
          // Normalize to ensure they sum to 100
          const sum = probabilities.reduce((a, b) => a + b, 0);
          const normalized = probabilities.map(p => (p / sum) * 100);
          
          // Convert to odds (odds = 100 / probability)
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
          
          // Normalize to ensure they sum to 100
          const sum = probabilities.reduce((a, b) => a + b, 0);
          const normalized = probabilities.map(p => (p / sum) * 100);
          
          // Convert to odds
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

  // Fallback to equal odds
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

// Auth routes
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
      `INSERT INTO users (username, email, password_hash, balance)
       VALUES ($1, $2, $3, 1000.00)
       RETURNING id, username, email, balance, created_at`,
      [username, email, hashedPassword]
    );

    const user = result.rows[0];
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email },
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
      { id: user.id, username: user.username, email: user.email },
      process.env.JWT_SECRET,
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
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
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
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Categories
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

// Create market with AI odds
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

    // Generate AI odds or use equal odds
    let oddsArray;
    if (useAiOdds) {
      console.log('🤖 Using AI to generate odds...');
      oddsArray = await generateAIOdds(question, options);
    } else {
      console.log('⚖️  Using equal odds...');
      oddsArray = options.map(() => parseFloat(options.length.toFixed(2)));
    }

    // Create options with their respective odds
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

// Get markets
app.get('/api/markets', async (req, res) => {
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

// Place bet
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
      `INSERT INTO bets (user_id, market_id, option_id, amount, potential_payout, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')`,
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

// AI News endpoint
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

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Database: ${process.env.POSTGRES_DB}`);
  console.log(`🤖 OpenAI API: ${process.env.OPENAI_API_KEY ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`🤖 Anthropic API: ${process.env.ANTHROPIC_API_KEY ? '✅ Configured' : '❌ Not configured'}`);
});
