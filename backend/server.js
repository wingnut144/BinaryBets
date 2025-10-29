import express from 'express';
import cors from 'cors';
import pg from 'pg';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import fetch from 'node-fetch';

const { Pool } = pg;
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'postgres',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'binarybets',
  user: process.env.POSTGRES_USER || 'binaryuser',
  password: process.env.POSTGRES_PASSWORD || 'binarypass'
});

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const RESOLVER_TOKEN = process.env.RESOLVER_TOKEN || 'resolver-secure-token-' + Math.random().toString(36).substring(2, 15);

console.log('🔐 Resolver Token:', RESOLVER_TOKEN);

// Authentication middleware for regular users
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Authentication middleware for resolver service
const authenticateResolver = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  // Check if it's the resolver token
  if (token === RESOLVER_TOKEN) {
    req.isResolver = true;
    return next();
  }

  // Otherwise, verify as regular JWT
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// User Registration
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields required' });
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
      'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email, balance, created_at',
      [username, email, hashedPassword]
    );

    const token = jwt.sign(
      { id: result.rows[0].id, username: result.rows[0].username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User created successfully',
      user: result.rows[0],
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// User Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1',
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

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        balance: user.balance,
        created_at: user.created_at
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user profile
app.get('/api/users/me', authenticateToken, async (req, res) => {
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
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all markets
app.get('/api/markets', async (req, res) => {
  try {
    const { status } = req.query;
    
    let query = `
      SELECT 
        m.*,
        u.username as creator_username,
        COALESCE(
          json_agg(
            json_build_object(
              'id', mo.id,
              'option_text', mo.option_text,
              'total_amount', mo.total_amount
            )
            ORDER BY mo.id
          ) FILTER (WHERE mo.id IS NOT NULL),
          '[]'
        ) as options
      FROM markets m
      LEFT JOIN users u ON m.creator_id = u.id
      LEFT JOIN market_options mo ON m.id = mo.market_id
    `;

    const params = [];
    if (status) {
      query += ' WHERE m.status = $1';
      params.push(status);
    }

    query += ' GROUP BY m.id, u.username ORDER BY m.created_at DESC';

    const result = await pool.query(query, params);
    res.json({ markets: result.rows });
  } catch (error) {
    console.error('Get markets error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single market
app.get('/api/markets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      SELECT 
        m.*,
        u.username as creator_username,
        COALESCE(
          json_agg(
            json_build_object(
              'id', mo.id,
              'option_text', mo.option_text,
              'total_amount', mo.total_amount
            )
            ORDER BY mo.id
          ) FILTER (WHERE mo.id IS NOT NULL),
          '[]'
        ) as options
      FROM markets m
      LEFT JOIN users u ON m.creator_id = u.id
      LEFT JOIN market_options mo ON m.id = mo.market_id
      WHERE m.id = $1
      GROUP BY m.id, u.username
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Market not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get market error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create market
app.post('/api/markets', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { question, deadline, options } = req.body;

    if (!question || !deadline) {
      return res.status(400).json({ error: 'Question and deadline required' });
    }

    await client.query('BEGIN');

    const marketResult = await client.query(
      'INSERT INTO markets (creator_id, question, deadline, status) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.user.id, question, deadline, 'active']
    );

    const market = marketResult.rows[0];

    if (options && Array.isArray(options) && options.length > 0) {
      for (const option of options) {
        await client.query(
          'INSERT INTO market_options (market_id, option_text) VALUES ($1, $2)',
          [market.id, option]
        );
      }
    } else {
      await client.query(
        'INSERT INTO market_options (market_id, option_text) VALUES ($1, $2), ($1, $3)',
        [market.id, 'Yes', 'No']
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Market created successfully',
      market
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create market error:', error);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// Place bet
app.post('/api/bets', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { market_id, option_id, amount } = req.body;

    if (!market_id || !option_id || !amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid bet parameters' });
    }

    await client.query('BEGIN');

    const userResult = await client.query(
      'SELECT balance FROM users WHERE id = $1 FOR UPDATE',
      [req.user.id]
    );

    if (userResult.rows[0].balance < amount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    const marketResult = await client.query(
      'SELECT status FROM markets WHERE id = $1',
      [market_id]
    );

    if (marketResult.rows[0].status !== 'active') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Market is not active' });
    }

    await client.query(
      'UPDATE users SET balance = balance - $1 WHERE id = $2',
      [amount, req.user.id]
    );

    const betResult = await client.query(
      'INSERT INTO bets (user_id, market_id, option_id, amount) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.user.id, market_id, option_id, amount]
    );

    await client.query(
      'UPDATE market_options SET total_amount = total_amount + $1 WHERE id = $2',
      [amount, option_id]
    );

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Bet placed successfully',
      bet: betResult.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Place bet error:', error);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// Resolve market with AI (uses resolver authentication)
app.post('/api/resolve-with-ai', authenticateResolver, async (req, res) => {
  try {
    const { market_id, question, options } = req.body;

    console.log(`🤖 AI resolving market ${market_id}: ${question}`);

    let outcome = 'Unresolved';

    // Try Anthropic Claude first
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 100,
            messages: [{
              role: 'user',
              content: `Determine the outcome of this prediction market question: "${question}"

Available options: ${options ? options.join(', ') : 'Yes, No'}

Based on current events and facts, what is the correct outcome? Respond with ONLY the exact option text, nothing else.`
            }]
          })
        });

        if (response.ok) {
          const data = await response.json();
          const aiOutcome = data.content[0].text.trim();
          
          const validOptions = options || ['Yes', 'No'];
          if (validOptions.includes(aiOutcome)) {
            outcome = aiOutcome;
            console.log(`✅ Claude determined outcome: ${outcome}`);
          }
        }
      } catch (error) {
        console.log('⚠️ Claude API failed, trying fallback...');
      }
    }

    // Fallback to OpenAI if Claude fails
    if (outcome === 'Unresolved' && process.env.OPENAI_API_KEY) {
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: 'gpt-4',
            messages: [{
              role: 'user',
              content: `Determine the outcome of this prediction market question: "${question}"

Available options: ${options ? options.join(', ') : 'Yes, No'}

Based on current events and facts, what is the correct outcome? Respond with ONLY the exact option text, nothing else.`
            }],
            max_tokens: 50
          })
        });

        if (response.ok) {
          const data = await response.json();
          const aiOutcome = data.choices[0].message.content.trim();
          
          const validOptions = options || ['Yes', 'No'];
          if (validOptions.includes(aiOutcome)) {
            outcome = aiOutcome;
            console.log(`✅ OpenAI determined outcome: ${outcome}`);
          }
        }
      } catch (error) {
        console.log('⚠️ OpenAI API also failed, defaulting to Unresolved');
      }
    }

    res.json({ outcome });
  } catch (error) {
    console.error('AI resolution error:', error);
    res.status(500).json({ error: 'AI resolution failed', outcome: 'Unresolved' });
  }
});

// Resolve market (uses resolver authentication)
app.post('/api/markets/:id/resolve', authenticateResolver, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    const { outcome, winning_outcome } = req.body;

    await client.query('BEGIN');

    const marketResult = await client.query(
      'SELECT * FROM markets WHERE id = $1',
      [id]
    );

    if (marketResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Market not found' });
    }

    const market = marketResult.rows[0];

    if (market.status === 'resolved') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Market already resolved' });
    }

    await client.query(
      'UPDATE markets SET status = $1, outcome = $2, resolved_at = NOW() WHERE id = $3',
      ['resolved', outcome || winning_outcome, id]
    );

    if (winning_outcome && winning_outcome !== 'Unresolved') {
      const winningOptionResult = await client.query(
        'SELECT id, total_amount FROM market_options WHERE market_id = $1 AND option_text = $2',
        [id, winning_outcome]
      );

      if (winningOptionResult.rows.length > 0) {
        const winningOption = winningOptionResult.rows[0];

        const allOptionsResult = await client.query(
          'SELECT SUM(total_amount) as total_pool FROM market_options WHERE market_id = $1',
          [id]
        );

        const totalPool = parseFloat(allOptionsResult.rows[0].total_pool) || 0;

        if (totalPool > 0 && winningOption.total_amount > 0) {
          const winningBetsResult = await client.query(
            'SELECT user_id, amount FROM bets WHERE market_id = $1 AND option_id = $2',
            [id, winningOption.id]
          );

          for (const bet of winningBetsResult.rows) {
            const payout = (bet.amount / winningOption.total_amount) * totalPool;
            
            await client.query(
              'UPDATE users SET balance = balance + $1 WHERE id = $2',
              [payout, bet.user_id]
            );

            await client.query(
              'UPDATE bets SET payout = $1 WHERE user_id = $2 AND market_id = $3 AND option_id = $4',
              [payout, bet.user_id, id, winningOption.id]
            );
          }

          console.log(`💰 Paid out ${totalPool} tokens to winners of market ${id}`);
        }
      }
    }

    await client.query('COMMIT');

    res.json({
      message: 'Market resolved successfully',
      outcome: outcome || winning_outcome
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Resolve market error:', error);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// Get user's bets
app.get('/api/users/me/bets', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        b.*,
        m.question,
        m.status as market_status,
        m.outcome,
        mo.option_text
      FROM bets b
      JOIN markets m ON b.market_id = m.id
      JOIN market_options mo ON b.option_id = mo.id
      WHERE b.user_id = $1
      ORDER BY b.created_at DESC
    `, [req.user.id]);

    res.json({ bets: result.rows });
  } catch (error) {
    console.error('Get user bets error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get categories (stub - returns empty for now)
app.get('/api/categories', async (req, res) => {
  res.json({ categories: [] });
});

// Get leaderboard
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

// Get admin reports (stub - returns empty for now)
app.get('/api/admin/reports', async (req, res) => {
  res.json({ reports: [] });
});

// Get all bets for current user
app.get('/api/bets', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        b.*,
        m.question,
        m.status as market_status,
        m.outcome,
        mo.option_text
      FROM bets b
      JOIN markets m ON b.market_id = m.id
      JOIN market_options mo ON b.option_id = mo.id
      WHERE b.user_id = $1
      ORDER BY b.created_at DESC
    `, [req.user.id]);
    res.json({ bets: result.rows });
  } catch (error) {
    console.error('Get bets error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔐 Resolver Token: ${RESOLVER_TOKEN}`);
});
