import express from 'express';
import cors from 'cors';
import pg from 'pg';
import bcrypt from 'bcrypt';
import OpenAI from 'openai';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL connection
const pool = new pg.Pool({
  host: process.env.POSTGRES_HOST || 'postgres',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'binarybets',
  user: process.env.POSTGRES_USER || 'binaryuser',
  password: process.env.POSTGRES_PASSWORD || 'binarypassword',
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

// Initialize OpenAI
let openai;
try {
  if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    console.log('✅ OpenAI client initialized');
  } else {
    console.warn('⚠️  OPENAI_API_KEY not set - AI features will be disabled');
  }
} catch (error) {
  console.error('❌ Failed to initialize OpenAI:', error);
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth endpoints
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email, balance, is_admin',
      [username, email, hashedPassword]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Registration error:', error);
    if (error.code === '23505') {
      res.status(400).json({ error: 'Username or email already exists' });
    } else {
      res.status(500).json({ error: 'Registration failed' });
    }
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await pool.query(
      'SELECT id, username, email, password, balance, is_admin FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    delete user.password;
    res.json(user);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get user by ID
app.get('/api/users/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, email, balance, is_admin FROM users WHERE id = $1',
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Category endpoints
app.get('/api/categories', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categories ORDER BY id');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Market endpoints
app.get('/api/markets', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT m.*, c.name as category_name, c.color as category_color,
             COALESCE(
               json_agg(
                 json_build_object('id', mo.id, 'name', mo.name, 'total_bets', mo.total_bets)
                 ORDER BY mo.id
               ) FILTER (WHERE mo.id IS NOT NULL),
               '[]'
             ) as options
      FROM markets m
      LEFT JOIN categories c ON m.category_id = c.id
      LEFT JOIN market_options mo ON m.id = mo.market_id
      GROUP BY m.id, c.name, c.color
      ORDER BY m.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching markets:', error);
    res.status(500).json({ error: 'Failed to fetch markets' });
  }
});

app.get('/api/markets/:id', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT m.*, c.name as category_name, c.color as category_color,
             COALESCE(
               json_agg(
                 json_build_object('id', mo.id, 'name', mo.name, 'total_bets', mo.total_bets)
                 ORDER BY mo.id
               ) FILTER (WHERE mo.id IS NOT NULL),
               '[]'
             ) as options
      FROM markets m
      LEFT JOIN categories c ON m.category_id = c.id
      LEFT JOIN market_options mo ON m.id = mo.market_id
      WHERE m.id = $1
      GROUP BY m.id, c.name, c.color
    `, [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Market not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching market:', error);
    res.status(500).json({ error: 'Failed to fetch market' });
  }
});

app.post('/api/markets', async (req, res) => {
  try {
    const { question, type, category_id, deadline, created_by, options } = req.body;
    
    if (!question || !type || !category_id || !deadline || !created_by) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (type === 'multiple' && (!options || options.length < 2)) {
      return res.status(400).json({ error: 'Multiple choice markets need at least 2 options' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const marketResult = await client.query(
        'INSERT INTO markets (question, type, category_id, deadline, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [question, type, category_id, deadline, created_by]
      );

      const market = marketResult.rows[0];

      if (type === 'multiple' && options) {
        for (const option of options) {
          await client.query(
            'INSERT INTO market_options (market_id, name) VALUES ($1, $2)',
            [market.id, option]
          );
        }
      }

      await client.query('COMMIT');
      
      const fullMarket = await client.query(`
        SELECT m.*, c.name as category_name, c.color as category_color,
               COALESCE(
                 json_agg(
                   json_build_object('id', mo.id, 'name', mo.name, 'total_bets', mo.total_bets)
                   ORDER BY mo.id
                 ) FILTER (WHERE mo.id IS NOT NULL),
                 '[]'
               ) as options
        FROM markets m
        LEFT JOIN categories c ON m.category_id = c.id
        LEFT JOIN market_options mo ON m.id = mo.market_id
        WHERE m.id = $1
        GROUP BY m.id, c.name, c.color
      `, [market.id]);

      res.status(201).json(fullMarket.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error creating market:', error);
    res.status(500).json({ error: 'Failed to create market' });
  }
});

// FIXED RESOLVE ENDPOINT
app.post('/api/markets/:marketId/resolve', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { marketId } = req.params;
    const { outcome, resolvedBy } = req.body;

    // VALIDATION: Check if parameters exist
    if (!outcome) {
      console.error('❌ Missing outcome parameter');
      return res.status(400).json({ error: 'Missing outcome parameter' });
    }

    if (!resolvedBy) {
      console.error('❌ Missing resolvedBy parameter');
      return res.status(400).json({ error: 'Missing resolvedBy parameter' });
    }

    console.log(`📋 Resolving market ${marketId} with outcome: "${outcome}" by user ${resolvedBy}`);

    await client.query('BEGIN');

    // Get market details
    const marketResult = await client.query(
      `SELECT m.*, 
              COALESCE(
                json_agg(
                  json_build_object('id', mo.id, 'name', mo.name)
                  ORDER BY mo.id
                ) FILTER (WHERE mo.id IS NOT NULL),
                '[]'
              ) as options
       FROM markets m
       LEFT JOIN market_options mo ON m.id = mo.market_id
       WHERE m.id = $1
       GROUP BY m.id`,
      [marketId]
    );

    if (marketResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Market not found' });
    }

    const market = marketResult.rows[0];

    if (market.resolved) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Market already resolved' });
    }

    let winningOptionId = null;

    // Handle binary market
    if (market.type === 'binary') {
      // FIXED: Safely convert to lowercase
      const normalizedOutcome = String(outcome).toLowerCase();
      
      if (normalizedOutcome !== 'yes' && normalizedOutcome !== 'no') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Binary market outcome must be "yes" or "no"' });
      }

      console.log(`✅ Binary market: outcome = "${normalizedOutcome}"`);

      // Get all bets for this market
      const betsResult = await client.query(
        'SELECT * FROM bets WHERE market_id = $1',
        [marketId]
      );

      // Process each bet
      for (const bet of betsResult.rows) {
        const betType = String(bet.bet_type).toLowerCase();
        const amount = parseFloat(bet.amount);
        
        console.log(`   Processing bet ${bet.id}: user=${bet.user_id}, bet_type="${betType}", amount=$${amount}`);

        if (betType === normalizedOutcome) {
          // Winner - double their money
          const payout = amount * 2;
          await client.query(
            'UPDATE bets SET payout = $1 WHERE id = $2',
            [payout, bet.id]
          );
          await client.query(
            'UPDATE users SET balance = balance + $1 WHERE id = $2',
            [payout, bet.user_id]
          );
          console.log(`   ✅ Winner! Paid out $${payout}`);
        } else {
          // Loser - no payout
          await client.query(
            'UPDATE bets SET payout = 0 WHERE id = $1',
            [bet.id]
          );
          console.log(`   ❌ Loser - no payout`);
        }
      }
    } 
    // Handle multiple choice market
    else if (market.type === 'multiple') {
      // Find the winning option
      const optionResult = await client.query(
        'SELECT id FROM market_options WHERE market_id = $1 AND LOWER(name) = LOWER($2)',
        [marketId, outcome]
      );

      if (optionResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Invalid outcome for this market' });
      }

      winningOptionId = optionResult.rows[0].id;
      console.log(`✅ Multiple choice market: winning option = ${winningOptionId}`);

      // Get all bets for this market
      const betsResult = await client.query(
        'SELECT * FROM bets WHERE market_id = $1',
        [marketId]
      );

      // Process each bet
      for (const bet of betsResult.rows) {
        const amount = parseFloat(bet.amount);
        
        if (bet.option_id === winningOptionId) {
          // Winner - double their money
          const payout = amount * 2;
          await client.query(
            'UPDATE bets SET payout = $1 WHERE id = $2',
            [payout, bet.id]
          );
          await client.query(
            'UPDATE users SET balance = balance + $1 WHERE id = $2',
            [payout, bet.user_id]
          );
          console.log(`   ✅ Winner! Bet ${bet.id} paid out $${payout}`);
        } else {
          // Loser - no payout
          await client.query(
            'UPDATE bets SET payout = 0 WHERE id = $1',
            [bet.id]
          );
          console.log(`   ❌ Loser - Bet ${bet.id} no payout`);
        }
      }
    }

    // Mark market as resolved
    await client.query(
      'UPDATE markets SET resolved = true, winning_option_id = $1, resolved_by = $2, resolved_at = NOW() WHERE id = $3',
      [winningOptionId, resolvedBy, marketId]
    );

    await client.query('COMMIT');

    console.log(`✅ Market ${marketId} resolved successfully`);

    // Return updated market
    const updatedMarket = await client.query(
      `SELECT m.*, c.name as category_name, c.color as category_color,
              COALESCE(
                json_agg(
                  json_build_object('id', mo.id, 'name', mo.name, 'total_bets', mo.total_bets)
                  ORDER BY mo.id
                ) FILTER (WHERE mo.id IS NOT NULL),
                '[]'
              ) as options
       FROM markets m
       LEFT JOIN categories c ON m.category_id = c.id
       LEFT JOIN market_options mo ON m.id = mo.market_id
       WHERE m.id = $1
       GROUP BY m.id, c.name, c.color`,
      [marketId]
    );

    res.json(updatedMarket.rows[0]);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error resolving market:', error);
    res.status(500).json({ error: 'Failed to resolve market' });
  } finally {
    client.release();
  }
});

// Get market results (winners/losers)
app.get('/api/markets/:marketId/results', async (req, res) => {
  try {
    const { marketId } = req.params;

    const result = await pool.query(`
      SELECT 
        b.id,
        b.amount,
        b.payout,
        b.bet_type,
        b.option_id,
        u.username,
        mo.name as option_name
      FROM bets b
      JOIN users u ON b.user_id = u.id
      LEFT JOIN market_options mo ON b.option_id = mo.id
      WHERE b.market_id = $1
      ORDER BY b.payout DESC, b.amount DESC
    `, [marketId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching market results:', error);
    res.status(500).json({ error: 'Failed to fetch market results' });
  }
});

// Bet endpoints
app.post('/api/bets', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { user_id, market_id, amount, bet_type, option_id } = req.body;
    
    if (!user_id || !market_id || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const betAmount = parseFloat(amount);
    if (isNaN(betAmount) || betAmount <= 0) {
      return res.status(400).json({ error: 'Invalid bet amount' });
    }

    await client.query('BEGIN');

    // Check user balance
    const userResult = await client.query(
      'SELECT balance FROM users WHERE id = $1',
      [user_id]
    );

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }

    const userBalance = parseFloat(userResult.rows[0].balance);

    if (userBalance < betAmount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Check market exists and isn't resolved
    const marketResult = await client.query(
      'SELECT * FROM markets WHERE id = $1',
      [market_id]
    );

    if (marketResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Market not found' });
    }

    const market = marketResult.rows[0];

    if (market.resolved) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Market is already resolved' });
    }

    if (new Date(market.deadline) < new Date()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Market deadline has passed' });
    }

    // Validate bet type/option based on market type
    if (market.type === 'binary') {
      if (!bet_type || (bet_type.toLowerCase() !== 'yes' && bet_type.toLowerCase() !== 'no')) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Binary markets require bet_type of "yes" or "no"' });
      }
    } else if (market.type === 'multiple') {
      if (!option_id) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Multiple choice markets require option_id' });
      }

      const optionCheck = await client.query(
        'SELECT id FROM market_options WHERE id = $1 AND market_id = $2',
        [option_id, market_id]
      );

      if (optionCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Invalid option for this market' });
      }
    }

    // Deduct from user balance
    await client.query(
      'UPDATE users SET balance = balance - $1 WHERE id = $2',
      [betAmount, user_id]
    );

    // Create bet
    const betResult = await client.query(
      'INSERT INTO bets (user_id, market_id, amount, bet_type, option_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [user_id, market_id, betAmount, bet_type, option_id]
    );

    // Update market option totals if applicable
    if (market.type === 'binary') {
      const betTypeLower = bet_type.toLowerCase();
      const column = betTypeLower === 'yes' ? 'yes_bets' : 'no_bets';
      await client.query(
        `UPDATE markets SET ${column} = ${column} + $1 WHERE id = $2`,
        [betAmount, market_id]
      );
    } else if (market.type === 'multiple') {
      await client.query(
        'UPDATE market_options SET total_bets = total_bets + $1 WHERE id = $2',
        [betAmount, option_id]
      );
    }

    await client.query('COMMIT');

    res.status(201).json(betResult.rows[0]);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error placing bet:', error);
    res.status(500).json({ error: 'Failed to place bet' });
  } finally {
    client.release();
  }
});

app.get('/api/users/:userId/bets', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT b.*, m.question, m.type, m.resolved, m.deadline,
             mo.name as option_name
      FROM bets b
      JOIN markets m ON b.market_id = m.id
      LEFT JOIN market_options mo ON b.option_id = mo.id
      WHERE b.user_id = $1
      ORDER BY b.created_at DESC
    `, [req.params.userId]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching user bets:', error);
    res.status(500).json({ error: 'Failed to fetch bets' });
  }
});

// Leaderboard endpoint
app.get('/api/leaderboard', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, username, balance
      FROM users
      WHERE is_admin = false
      ORDER BY balance DESC
      LIMIT 10
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 BinaryBets API server running on port ${PORT}`);
});
