import express from 'express';
import pg from 'pg';
import cors from 'cors';
import bcrypt from 'bcrypt';
import jsonwebtoken from 'jsonwebtoken';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const app = express();
const PORT = process.env.PORT || 3000;

// OpenAI setup
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// PostgreSQL setup
const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'binarybets',
  user: process.env.DB_USER || 'binaryuser',
  password: process.env.DB_PASSWORD || 'binarypass',
});

app.use(cors());
app.use(express.json());

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'No token provided' });

  jsonwebtoken.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// ============================================
// AI ODDS GENERATION ENDPOINT
// ============================================
app.post('/api/generate-odds', authenticateToken, async (req, res) => {
  try {
    const { title, options } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Market title is required' });
    }

    // Determine if binary or multiple choice
    const isBinary = !options || options.length === 0;
    
    let prompt;
    if (isBinary) {
      prompt = `You are an expert odds maker for prediction markets. Given the following yes/no prediction market question, provide fair initial odds that reflect the true probability of each outcome.

Market Question: "${title}"

Analyze this question considering:
1. Historical data and trends
2. Current events and context
3. Expert opinions if relevant
4. Base rates for similar events
5. Any inherent biases in the question

Provide initial odds as percentages that sum to 100%. Return ONLY a JSON object with this exact format:
{
  "yes": <number between 1-99>,
  "no": <number between 1-99>,
  "reasoning": "<brief 1-2 sentence explanation>"
}

Example: {"yes": 65, "no": 35, "reasoning": "Historical data shows this outcome occurs about 2 out of 3 times."}`;
    } else {
      const optionsList = options.map((opt, i) => `${i + 1}. ${opt}`).join('\n');
      prompt = `You are an expert odds maker for prediction markets. Given the following multiple-choice prediction market question with options, provide fair initial odds that reflect the true probability of each outcome.

Market Question: "${title}"

Options:
${optionsList}

Analyze this question considering:
1. Historical data and trends for each option
2. Current events and context
3. Expert opinions if relevant
4. Base rates for similar events
5. Relative likelihood of each option

Provide initial odds as percentages that sum to 100%. Return ONLY a JSON object with this exact format:
{
  "odds": [
    {"option": "<option_name>", "percentage": <number>},
    ...
  ],
  "reasoning": "<brief 1-2 sentence explanation>"
}`;
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are an expert odds maker. Always respond with valid JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    const responseText = completion.choices[0].message.content.trim();
    
    // Parse the JSON response
    let oddsData;
    try {
      // Remove markdown code blocks if present
      const cleanedResponse = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      oddsData = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('Failed to parse AI response:', responseText);
      return res.status(500).json({ error: 'AI returned invalid format' });
    }

    console.log('AI Generated Odds:', oddsData);
    res.json(oddsData);

  } catch (error) {
    console.error('Error generating odds:', error);
    res.status(500).json({ error: 'Failed to generate odds', details: error.message });
  }
});

// ============================================
// AUTHENTICATION ENDPOINTS
// ============================================
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if user exists
    const existingUser = await pool.query(
      'SELECT * FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user (use password_hash column and add full_name)
    const result = await pool.query(
      'INSERT INTO users (username, email, password_hash, full_name, balance) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, email, balance',
      [username, email, hashedPassword, username, 1000] // Use username as full_name default
    );

    const user = result.rows[0];
    const token = jsonwebtoken.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ token, user });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Verify password (use password_hash column)
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jsonwebtoken.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });

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
    res.status(500).json({ error: 'Failed to login' });
  }
});

// ============================================
// CATEGORY ENDPOINTS
// ============================================
app.get('/api/categories', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categories ORDER BY id');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

app.get('/api/subcategories', async (req, res) => {
  try {
    const { category_id } = req.query;
    
    let query = 'SELECT * FROM subcategories';
    let params = [];
    
    if (category_id) {
      query += ' WHERE category_id = $1';
      params.push(category_id);
    }
    
    query += ' ORDER BY name';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching subcategories:', error);
    res.status(500).json({ error: 'Failed to fetch subcategories' });
  }
});

// ============================================
// MARKET ENDPOINTS
// ============================================
app.get('/api/markets', async (req, res) => {
  try {
    const { category_id, subcategory_id, status } = req.query;
    
    let query = `
      SELECT m.*, c.name as category_name, s.name as subcategory_name,
             COUNT(DISTINCT b.id) as bet_count,
             COALESCE(SUM(b.amount), 0) as total_volume
      FROM markets m
      LEFT JOIN categories c ON m.category_id = c.id
      LEFT JOIN subcategories s ON m.subcategory_id = s.id
      LEFT JOIN bets b ON m.id = b.market_id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 1;
    
    if (category_id && category_id !== 'all') {
      query += ` AND m.category_id = $${paramCount}`;
      params.push(category_id);
      paramCount++;
    }
    
    if (subcategory_id) {
      query += ` AND m.subcategory_id = $${paramCount}`;
      params.push(subcategory_id);
      paramCount++;
    }
    
    if (status) {
      // Map status filter to resolved boolean
      if (status === 'active') {
        query += ` AND m.resolved = false`;
      } else if (status === 'resolved') {
        query += ` AND m.resolved = true`;
      }
    }
    
    query += ' GROUP BY m.id, c.name, s.name ORDER BY m.created_at DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching markets:', error);
    res.status(500).json({ error: 'Failed to fetch markets' });
  }
});

app.post('/api/markets', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { 
      title,  // Will map to 'question' column
      description, 
      category_id, 
      subcategory_id, 
      close_date,  // Will map to 'deadline' column
      market_type,
      options // For multiple choice markets
    } = req.body;

    if (!title || !category_id || !close_date) {
      return res.status(400).json({ error: 'Title, category, and close date are required' });
    }

    // Determine if binary or multiple choice
    const isBinary = market_type === 'binary' || !options || options.length === 0;
    const dbMarketType = isBinary ? 'binary' : 'multi-choice';

    // Create the market with placeholder odds (use 'question' and 'deadline' to match DB)
    const marketResult = await client.query(
      `INSERT INTO markets 
       (question, category_id, subcategory_id, deadline, resolved, created_by, market_type, yes_odds, no_odds) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING *`,
      [title, category_id, subcategory_id || null, close_date, false, req.user.id, 
       dbMarketType, 50, 50] // Default 50/50 split, will be updated by AI
    );

    const market = marketResult.rows[0];

    // If multiple choice, create options
    if (!isBinary && options && options.length > 0) {
      for (const option of options) {
        await client.query(
          'INSERT INTO market_options (market_id, option_name, votes) VALUES ($1, $2, $3)',
          [market.id, option, 0]
        );
      }
    }

    await client.query('COMMIT');
    
    res.status(201).json(market);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating market:', error);
    res.status(500).json({ error: 'Failed to create market' });
  } finally {
    client.release();
  }
});

// ============================================
// BETTING ENDPOINT WITH DYNAMIC ODDS
// ============================================
app.post('/api/bets', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { market_id, position, amount } = req.body;
    const user_id = req.user.id;

    if (!market_id || !position || !amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid bet parameters' });
    }

    // Get market info (check 'resolved' instead of 'status')
    const marketResult = await client.query(
      'SELECT * FROM markets WHERE id = $1 AND resolved = false',
      [market_id]
    );

    if (marketResult.rows.length === 0) {
      return res.status(404).json({ error: 'Market not found or already resolved' });
    }

    const market = marketResult.rows[0];

    // Check user balance
    const userResult = await client.query(
      'SELECT balance FROM users WHERE id = $1',
      [user_id]
    );

    const userBalance = parseFloat(userResult.rows[0].balance);

    if (userBalance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Get current bet volumes (stored in yes_odds/no_odds as volumes)
    let yesVolume = parseFloat(market.yes_odds) || 0;
    let noVolume = parseFloat(market.no_odds) || 0;
    
    // Calculate total pool
    const totalVolume = yesVolume + noVolume;
    
    // Calculate CURRENT odds before this bet
    let currentYesOdds = totalVolume > 0 ? totalVolume / yesVolume : 2.0;
    let currentNoOdds = totalVolume > 0 ? totalVolume / noVolume : 2.0;
    
    // This bet locks in at CURRENT odds
    const lockedOdds = position.toLowerCase() === 'yes' ? currentYesOdds : currentNoOdds;
    const potentialPayout = amount * lockedOdds;

    // Create the bet with locked odds
    const betResult = await client.query(
      `INSERT INTO bets (user_id, market_id, position, amount, odds, potential_payout, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [user_id, market_id, position.toLowerCase(), amount, lockedOdds, potentialPayout, 'pending']
    );

    // Update user balance
    await client.query(
      'UPDATE users SET balance = balance - $1 WHERE id = $2',
      [amount, user_id]
    );

    // NOW update the volumes for NEXT bettor
    if (position.toLowerCase() === 'yes') {
      yesVolume += amount;
    } else {
      noVolume += amount;
    }

    // Store updated volumes back to database (we use yes_odds/no_odds columns as volume storage)
    await client.query(
      'UPDATE markets SET yes_odds = $1, no_odds = $2 WHERE id = $3',
      [yesVolume, noVolume, market_id]
    );

    // Calculate NEW odds for display (for next bettor)
    const newTotalVolume = yesVolume + noVolume;
    const newYesOdds = newTotalVolume / yesVolume;
    const newNoOdds = newTotalVolume / noVolume;

    await client.query('COMMIT');

    res.status(201).json({
      bet: betResult.rows[0],
      newOdds: {
        yes: newYesOdds.toFixed(2),
        no: newNoOdds.toFixed(2)
      }
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
app.get('/api/bets', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT b.*, m.title as market_title 
       FROM bets b 
       JOIN markets m ON b.market_id = m.id 
       WHERE b.user_id = $1 
       ORDER BY b.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching bets:', error);
    res.status(500).json({ error: 'Failed to fetch bets' });
  }
});

// ============================================
// USER & LEADERBOARD ENDPOINTS
// ============================================
app.get('/api/user', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, email, balance FROM users WHERE id = $1',
      [req.user.id]
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
      LIMIT 10
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// ============================================
// MARKET RESOLUTION ENDPOINT
// ============================================
app.post('/api/markets/:id/resolve', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const marketId = req.params.id;
    const { outcome } = req.body;

    if (!outcome || typeof outcome !== 'string') {
      return res.status(400).json({ error: 'Valid outcome is required (yes/no or option name)' });
    }

    // Get market details
    const marketResult = await client.query(
      'SELECT * FROM markets WHERE id = $1',
      [marketId]
    );

    if (marketResult.rows.length === 0) {
      return res.status(404).json({ error: 'Market not found' });
    }

    const market = marketResult.rows[0];

    // Normalize outcome to lowercase for binary markets
    const normalizedOutcome = market.market_type === 'binary' ? outcome.toLowerCase() : outcome;

    // Update market as resolved (use 'resolved' boolean and 'outcome' column)
    await client.query(
      'UPDATE markets SET resolved = true, outcome = $1, resolved_by = $2, resolved_at = NOW() WHERE id = $3',
      [normalizedOutcome, req.user.id, marketId]
    );

    // Get all bets for this market
    const betsResult = await client.query(
      'SELECT * FROM bets WHERE market_id = $1 AND status = $2',
      [marketId, 'pending']
    );

    // Process each bet
    for (const bet of betsResult.rows) {
      const won = bet.position.toLowerCase() === normalizedOutcome;
      const newStatus = won ? 'won' : 'lost';

      // Update bet status
      await client.query(
        'UPDATE bets SET status = $1 WHERE id = $2',
        [newStatus, bet.id]
      );

      // If won, credit the payout
      if (won) {
        await client.query(
          'UPDATE users SET balance = balance + $1 WHERE id = $2',
          [parseFloat(bet.potential_payout), bet.user_id]
        );
      }
    }

    await client.query('COMMIT');
    
    res.json({ 
      message: 'Market resolved successfully',
      winning_outcome: normalizedOutcome,
      bets_processed: betsResult.rows.length
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error resolving market:', error);
    res.status(500).json({ error: 'Failed to resolve market', details: error.message });
  } finally {
    client.release();
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🔗 API available at http://localhost:${PORT}`);
});
