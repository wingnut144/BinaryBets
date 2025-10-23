import express from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import pkg from 'pg';
const { Pool } = pkg;
import OpenAI from 'openai';

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
const pool = new Pool(
  process.env.DATABASE_URL 
    ? {
        connectionString: process.env.DATABASE_URL,
      }
    : {
        host: process.env.DB_HOST || 'postgres',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'binarybets',
        user: process.env.DB_USER || 'binaryuser',
        password: process.env.DB_PASSWORD || 'binarypass',
      }
);

// OpenAI client (optional - only needed for AI odds calculation)
let openai = null;
const openaiKey = process.env.OPENAI_API_KEY || process.env.OPEN_AI_KEY;
if (openaiKey) {
  openai = new OpenAI({
    apiKey: openaiKey,
  });
  console.log('✅ OpenAI client initialized');
} else {
  console.log('⚠️  OpenAI API key not found - AI odds calculation will be disabled');
}

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection error:', err);
  } else {
    console.log('✅ Database connected successfully');
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================
// AUTH ENDPOINTS
// ============================================

// Register new user
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, username, fullName } = req.body;

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT * FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email or username already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert new user
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, username, full_name) VALUES ($1, $2, $3, $4) RETURNING id, email, username, full_name, balance, is_admin',
      [email, passwordHash, username, fullName]
    );

    res.status(201).json({ user: result.rows[0] });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// Login user
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Return user without password hash
    const { password_hash, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// ============================================
// CATEGORY ENDPOINTS
// ============================================

// Get all categories
app.get('/api/categories', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categories ORDER BY display_order, name');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Create new category (admin only)
app.post('/api/categories', async (req, res) => {
  try {
    const { name, color, icon } = req.body;
    
    // Get the next display_order
    const orderResult = await pool.query('SELECT COALESCE(MAX(display_order), 0) + 1 as next_order FROM categories');
    const nextOrder = orderResult.rows[0].next_order;
    
    const result = await pool.query(
      'INSERT INTO categories (name, color, icon, display_order) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, color, icon || null, nextOrder]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating category:', error);
    if (error.code === '23505') { // Unique violation
      res.status(400).json({ error: 'Category name already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create category' });
    }
  }
});

// Get subcategories for a specific category
app.get('/api/categories/:categoryId/subcategories', async (req, res) => {
  try {
    const { categoryId } = req.params;
    const result = await pool.query(
      'SELECT * FROM subcategories WHERE category_id = $1 ORDER BY display_order, name',
      [categoryId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching subcategories:', error);
    res.status(500).json({ error: 'Failed to fetch subcategories' });
  }
});

// Create new subcategory (admin only)
app.post('/api/subcategories', async (req, res) => {
  try {
    const { categoryId, name } = req.body;
    
    // Get the next display_order for this category
    const orderResult = await pool.query(
      'SELECT COALESCE(MAX(display_order), 0) + 1 as next_order FROM subcategories WHERE category_id = $1',
      [categoryId]
    );
    const nextOrder = orderResult.rows[0].next_order;
    
    const result = await pool.query(
      'INSERT INTO subcategories (category_id, name, display_order) VALUES ($1, $2, $3) RETURNING *',
      [categoryId, name, nextOrder]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating subcategory:', error);
    if (error.code === '23505') { // Unique violation
      res.status(400).json({ error: 'Subcategory name already exists in this category' });
    } else {
      res.status(500).json({ error: 'Failed to create subcategory' });
    }
  }
});

// ============================================
// MARKET ENDPOINTS
// ============================================

// Get all markets
app.get('/api/markets', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        m.*,
        c.name as category_name,
        c.color as category_color,
        c.icon as category_icon,
        s.name as subcategory_name,
        COALESCE(json_agg(
          json_build_object(
            'id', mo.id,
            'option_text', mo.option_text,
            'odds', mo.odds,
            'option_order', mo.option_order,
            'bet_count', (SELECT COUNT(*) FROM bets b WHERE b.market_option_id = mo.id)
          ) ORDER BY mo.option_order
        ) FILTER (WHERE mo.id IS NOT NULL), '[]') as options,
        (SELECT COUNT(*) FROM bets WHERE market_id = m.id) as bet_count
      FROM markets m
      LEFT JOIN categories c ON m.category_id = c.id
      LEFT JOIN subcategories s ON m.subcategory_id = s.id
      LEFT JOIN market_options mo ON m.id = mo.market_id
      GROUP BY m.id, c.name, c.color, c.icon, s.name
      ORDER BY m.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching markets:', error);
    res.status(500).json({ error: 'Failed to fetch markets' });
  }
});

// Get single market by ID
app.get('/api/markets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT 
        m.*,
        c.name as category_name,
        c.color as category_color,
        s.name as subcategory_name,
        COALESCE(json_agg(
          json_build_object(
            'id', mo.id,
            'option_text', mo.option_text,
            'odds', mo.odds,
            'option_order', mo.option_order
          ) ORDER BY mo.option_order
        ) FILTER (WHERE mo.id IS NOT NULL), '[]') as options
      FROM markets m
      LEFT JOIN categories c ON m.category_id = c.id
      LEFT JOIN subcategories s ON m.subcategory_id = s.id
      LEFT JOIN market_options mo ON m.id = mo.market_id
      WHERE m.id = $1
      GROUP BY m.id, c.name, c.color, s.name
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Market not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching market:', error);
    res.status(500).json({ error: 'Failed to fetch market' });
  }
});

// Create new market
app.post('/api/markets', async (req, res) => {
  try {
    const { question, categoryId, subcategoryId, marketType, yesOdds, noOdds, options, optionOdds, deadline, createdBy } = req.body;

    // Convert date-only to end of day timestamp (23:59:59)
    let deadlineTimestamp = deadline;
    if (deadline && !deadline.includes('T')) {
      // If it's just a date (YYYY-MM-DD), add end of day time
      deadlineTimestamp = `${deadline}T23:59:59`;
    }

    let marketResult;
    if (marketType === 'binary') {
      marketResult = await pool.query(
        `INSERT INTO markets (question, category_id, subcategory_id, market_type, yes_odds, no_odds, deadline, created_by) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
         RETURNING *`,
        [question, categoryId, subcategoryId || null, marketType, yesOdds, noOdds, deadlineTimestamp, createdBy]
      );
    } else {
      marketResult = await pool.query(
        `INSERT INTO markets (question, category_id, subcategory_id, market_type, deadline, created_by) 
         VALUES ($1, $2, $3, $4, $5, $6) 
         RETURNING *`,
        [question, categoryId, subcategoryId || null, marketType, deadlineTimestamp, createdBy]
      );

      // Insert market options with odds
      const marketId = marketResult.rows[0].id;
      for (let i = 0; i < options.length; i++) {
        const optionText = options[i];
        const odds = optionOdds ? optionOdds[i] : 2.0; // Default odds if not provided
        await pool.query(
          'INSERT INTO market_options (market_id, option_text, odds, option_order) VALUES ($1, $2, $3, $4)',
          [marketId, optionText, odds, i + 1]
        );
      }
    }

    res.status(201).json(marketResult.rows[0]);
  } catch (error) {
    console.error('Error creating market:', error);
    res.status(500).json({ error: 'Failed to create market' });
  }
});

// Calculate AI odds for a market
app.post('/api/markets/calculate-odds', async (req, res) => {
  try {
    // Check if OpenAI is available
    if (!openai) {
      return res.status(503).json({ 
        error: 'AI odds calculation is not available. OpenAI API key not configured.' 
      });
    }

    const { question, marketType, options } = req.body;

    let prompt;
    if (marketType === 'binary') {
      prompt = `Given this prediction market question: "${question}"
      
Analyze the question and provide odds for both Yes and No outcomes.
The odds should be in decimal format (e.g., 1.5, 2.0, 3.5) where:
- Lower odds = higher probability (e.g., 1.5x means ~67% chance)
- Higher odds = lower probability (e.g., 3.0x means ~33% chance)
- Yes odds + No odds should roughly balance the market

Respond in JSON format:
{
  "yes": <decimal odds>,
  "no": <decimal odds>,
  "reasoning": "<brief explanation>"
}`;
    } else {
      prompt = `Given this prediction market question: "${question}"
And these possible outcomes: ${options.join(', ')}

Analyze the question and provide fair odds for each outcome.
The odds should be in decimal format (e.g., 1.5, 2.0, 3.5, 5.0).

Respond in JSON format:
{
  "options": [
    {"text": "option 1", "odds": <decimal>},
    {"text": "option 2", "odds": <decimal>},
    ...
  ],
  "reasoning": "<brief explanation>"
}`;
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at analyzing prediction markets and calculating fair odds based on probability analysis.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      response_format: { type: "json_object" }
    });

    const oddsData = JSON.parse(completion.choices[0].message.content);

    if (marketType === 'binary') {
      res.json({
        odds: {
          yes: oddsData.yes,
          no: oddsData.no
        },
        reasoning: oddsData.reasoning
      });
    } else {
      res.json({
        odds: oddsData,
        reasoning: oddsData.reasoning
      });
    }
  } catch (error) {
    console.error('Error calculating odds:', error);
    res.status(500).json({ error: 'Failed to calculate odds' });
  }
});

// Resolve market
app.post('/api/markets/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;
    const { outcome, resolvedBy } = req.body;

    // Get market details
    const marketResult = await pool.query('SELECT * FROM markets WHERE id = $1', [id]);
    if (marketResult.rows.length === 0) {
      return res.status(404).json({ error: 'Market not found' });
    }

    const market = marketResult.rows[0];

    // Update market as resolved
    await pool.query(
      'UPDATE markets SET resolved = true, outcome = $1, resolved_by = $2, resolved_at = NOW() WHERE id = $3',
      [outcome.toLowerCase(), resolvedBy, id]
    );

    // Pay out winning bets
    if (market.market_type === 'binary') {
      // For binary markets, outcome is 'yes' or 'no'
      const winningBets = await pool.query(
        'SELECT * FROM bets WHERE market_id = $1 AND LOWER(bet_type) = $2',
        [id, outcome.toLowerCase()]
      );

      for (const bet of winningBets.rows) {
        const winnings = parseFloat(bet.amount) * parseFloat(bet.odds);
        await pool.query(
          'UPDATE users SET balance = balance + $1 WHERE id = $2',
          [winnings, bet.user_id]
        );
        await pool.query(
          'UPDATE bets SET won = true WHERE id = $1',
          [bet.id]
        );
      }

      // Mark losing bets
      await pool.query(
        'UPDATE bets SET won = false WHERE market_id = $1 AND LOWER(bet_type) != $2',
        [id, outcome.toLowerCase()]
      );
    } else {
      // For multi-choice markets, outcome is the option ID
      const winningBets = await pool.query(
        'SELECT * FROM bets WHERE market_id = $1 AND market_option_id = $2',
        [id, outcome]
      );

      for (const bet of winningBets.rows) {
        const winnings = parseFloat(bet.amount) * parseFloat(bet.odds);
        await pool.query(
          'UPDATE users SET balance = balance + $1 WHERE id = $2',
          [winnings, bet.user_id]
        );
        await pool.query(
          'UPDATE bets SET won = true WHERE id = $1',
          [bet.id]
        );
      }

      // Mark losing bets
      await pool.query(
        'UPDATE bets SET won = false WHERE market_id = $1 AND market_option_id != $2',
        [id, outcome]
      );
    }

    res.json({ message: 'Market resolved successfully' });
  } catch (error) {
    console.error('Error resolving market:', error);
    res.status(500).json({ error: 'Failed to resolve market' });
  }
});

// ============================================
// BET ENDPOINTS
// ============================================

// Place a bet
app.post('/api/bets', async (req, res) => {
  try {
    const { userId, marketId, marketOptionId, amount, betType, odds } = req.body;

    // Check user balance
    const userResult = await pool.query('SELECT balance FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userBalance = parseFloat(userResult.rows[0].balance);
    const betAmount = parseFloat(amount);

    if (userBalance < betAmount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Deduct bet amount from user balance
    await pool.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [betAmount, userId]);

    // Insert bet (include bet_type for binary markets)
    await pool.query(
      'INSERT INTO bets (user_id, market_id, market_option_id, amount, odds, bet_type) VALUES ($1, $2, $3, $4, $5, $6)',
      [userId, marketId, marketOptionId || null, betAmount, odds, betType || null]
    );

    // Get new balance
    const newBalanceResult = await pool.query('SELECT balance FROM users WHERE id = $1', [userId]);
    const newBalance = newBalanceResult.rows[0].balance;

    res.json({ message: 'Bet placed successfully', newBalance });
  } catch (error) {
    console.error('Error placing bet:', error);
    res.status(500).json({ error: 'Failed to place bet' });
  }
});

// Get user's bets
app.get('/api/users/:userId/bets', async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await pool.query(`
      SELECT 
        b.*,
        m.question as market_question,
        m.resolved as resolved,
        mo.option_text
      FROM bets b
      JOIN markets m ON b.market_id = m.id
      LEFT JOIN market_options mo ON b.market_option_id = mo.id
      WHERE b.user_id = $1
      ORDER BY b.placed_at DESC
    `, [userId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching user bets:', error);
    res.status(500).json({ error: 'Failed to fetch bets' });
  }
});

// ============================================
// LEADERBOARD ENDPOINT
// ============================================

app.get('/api/leaderboard', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.id,
        u.username,
        u.full_name,
        u.balance,
        COUNT(b.id) as total_bets
      FROM users u
      LEFT JOIN bets b ON u.id = b.user_id
      GROUP BY u.id, u.username, u.full_name, u.balance
      ORDER BY u.balance DESC
      LIMIT 50
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// ============================================
// START SERVER
// ============================================

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 BinaryBets API server running on port ${port}`);
});
