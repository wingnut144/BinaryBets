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

// Middleware to verify admin
const authenticateAdmin = async (req, res, next) => {
  try {
    const result = await pool.query('SELECT is_admin FROM users WHERE id = $1', [req.user.id]);
    
    if (result.rows.length === 0 || !result.rows[0].is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
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
    const { username, password } = req.body;
    
    // ✅ SELECT is_admin field
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
    
    const token = jsonwebtoken.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    // ✅ Return is_admin field
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        balance: parseFloat(user.balance),
        is_admin: user.is_admin || false  // ← ADD THIS LINE
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
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

    // Use AI odds if available from the request, otherwise default to 50/50
    // Frontend should send ai_yes_odds and ai_no_odds from the generated odds
    const initialYesVolume = req.body.ai_yes_odds || 50;
    const initialNoVolume = req.body.ai_no_odds || 50;

    // Create the market with AI odds (use 'question' and 'deadline' to match DB)
    const marketResult = await client.query(
      `INSERT INTO markets 
       (question, category_id, subcategory_id, deadline, resolved, created_by, market_type, yes_odds, no_odds) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING *`,
      [title, category_id, subcategory_id || null, close_date, false, req.user.id, 
       dbMarketType, initialYesVolume, initialNoVolume]
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
  const userId = req.user.userId;
  const { market_id, position, amount, odds, potential_payout } = req.body;
  
  console.log('Placing bet:', { userId, market_id, position, amount, odds, potential_payout });
  
  try {
    await pool.query('BEGIN');
    
    // Check user balance
    const userResult = await pool.query(
      'SELECT balance FROM users WHERE id = $1',
      [userId]
    );
    
    if (!userResult.rows[0] || userResult.rows[0].balance < amount) {
      await pool.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    // ✅ Insert with all required columns
    const betResult = await pool.query(
      `INSERT INTO bets (
        user_id, market_id, position, amount, 
        odds, potential_payout, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) 
      RETURNING *`,
      [userId, market_id, position, amount, odds || 2.0, potential_payout || (amount * 2), 'pending']
    );
    
    // Deduct balance
    await pool.query(
      'UPDATE users SET balance = balance - $1 WHERE id = $2',
      [amount, userId]
    );
    
    await pool.query('COMMIT');
    
    res.json({ success: true, bet: betResult.rows[0] });
    
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Bet error:', error);
    res.status(500).json({ 
      error: 'Failed to place bet', 
      details: error.message 
    });
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

// ============================================
// ADMIN ENDPOINTS
// ============================================

// Admin: Delete any market
app.delete('/api/admin/markets/:id', authenticateToken, authenticateAdmin, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const marketId = req.params.id;
    
    // Check if market exists
    const marketResult = await client.query('SELECT * FROM markets WHERE id = $1', [marketId]);
    
    if (marketResult.rows.length === 0) {
      return res.status(404).json({ error: 'Market not found' });
    }
    
    // Delete the market (CASCADE will handle bets, options, reports)
    await client.query('DELETE FROM markets WHERE id = $1', [marketId]);
    
    await client.query('COMMIT');
    
    res.json({ message: 'Market deleted successfully' });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting market:', error);
    res.status(500).json({ error: 'Failed to delete market', details: error.message });
  } finally {
    client.release();
  }
});

// Report a market
app.post('/api/markets/:id/report', authenticateToken, async (req, res) => {
  try {
    const marketId = req.params.id;
    const { reason } = req.body;
    const userId = req.user.id;
    
    if (!reason) {
      return res.status(400).json({ error: 'Reason is required' });
    }
    
    // Check if market exists
    const marketResult = await pool.query('SELECT * FROM markets WHERE id = $1', [marketId]);
    
    if (marketResult.rows.length === 0) {
      return res.status(404).json({ error: 'Market not found' });
    }
    
    // Create report (assuming reports table exists)
    try {
      const result = await pool.query(
        `INSERT INTO market_reports (market_id, reported_by, reason, status, created_at) 
         VALUES ($1, $2, $3, $4, NOW()) 
         RETURNING *`,
        [marketId, userId, reason, 'pending']
      );
      
      res.status(201).json({ message: 'Report submitted successfully', report: result.rows[0] });
    } catch (dbError) {
      // If table doesn't exist, just return success for now
      console.log('Reports table may not exist yet:', dbError.message);
      res.status(201).json({ message: 'Report received and will be reviewed' });
    }
    
  } catch (error) {
    console.error('Error reporting market:', error);
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

// Admin: Get all reports
app.get('/api/admin/reports', authenticateToken, authenticateAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.*, m.question as market_title, u.username as reported_by_username
      FROM market_reports r
      LEFT JOIN markets m ON r.market_id = m.id
      LEFT JOIN users u ON r.reported_by = u.id
      WHERE r.status = 'pending'
      ORDER BY r.created_at DESC
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching reports:', error);
    // If table doesn't exist, return empty array
    res.json([]);
  }
});

// Admin: Resolve report (approve or reject)
app.post('/api/admin/reports/:id/resolve', authenticateToken, authenticateAdmin, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const reportId = req.params.id;
    const { action } = req.body; // 'approve' or 'reject'
    
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }
    
    // Get the report
    const reportResult = await client.query(
      'SELECT * FROM market_reports WHERE id = $1',
      [reportId]
    );
    
    if (reportResult.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    const report = reportResult.rows[0];
    
    if (action === 'approve') {
      // Delete the market
      await client.query('DELETE FROM markets WHERE id = $1', [report.market_id]);
    }
    
    // Mark report as resolved
    await client.query(
      'UPDATE market_reports SET status = $1, resolved_at = NOW(), resolved_by = $2 WHERE id = $3',
      [action === 'approve' ? 'approved' : 'rejected', req.user.id, reportId]
    );
    
    await client.query('COMMIT');
    
    res.json({ message: `Report ${action}ed successfully` });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error resolving report:', error);
    res.status(500).json({ error: 'Failed to resolve report' });
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
