// ==========================================
// BINARY BETS - COMPLETE BACKEND SERVER
// Location: backend/server.js
// ==========================================

import express from 'express';
import pg from 'pg';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import dotenv from 'dotenv';
import { 
  sendWelcomeEmail, 
  sendPasswordResetEmail, 
  generateToken 
} from './emailService.js';

dotenv.config();

const app = express();
const { Pool } = pg;

// Database connection
const pool = new Pool({
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST || 'postgres',
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  port: 5432,
});

// Middleware
app.use(cors());
app.use(express.json());

// Auth middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

// ==========================================
// AUTHENTICATION ENDPOINTS
// ==========================================

// Signup with email verification
app.post('/api/auth/signup', async (req, res) => {
  const { username, email, password, password_confirm } = req.body;
  
  console.log('📝 Signup attempt:', { username, email });

  try {
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields required' });
    }

    if (password !== password_confirm) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existingUser = await pool.query(
      'SELECT * FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existingUser.rows.length > 0) {
      if (existingUser.rows[0].username === username) {
        return res.status(400).json({ error: 'Username already exists' });
      }
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = generateToken();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const result = await pool.query(
      `INSERT INTO users 
       (username, email, password_hash, balance, email_verified, verification_token, verification_token_expires) 
       VALUES ($1, $2, $3, 10000, false, $4, $5) 
       RETURNING id, username, email, balance, created_at, email_verified`,
      [username, email, hashedPassword, verificationToken, verificationExpires]
    );

    const newUser = result.rows[0];

    const emailResult = await sendWelcomeEmail(email, username, verificationToken);
    
    if (!emailResult.success) {
      console.error('⚠️ Failed to send verification email:', emailResult.error);
    }

    console.log('✅ User created:', newUser.id, '| Email sent:', emailResult.success);

    res.status(201).json({
      message: 'Account created! Check your email to verify your account.',
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        balance: newUser.balance,
        email_verified: newUser.email_verified,
      },
      emailSent: emailResult.success,
    });
  } catch (error) {
    console.error('❌ Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  
  console.log('🔐 Login attempt:', { username });

  try {
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1 OR email = $1',
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
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log('✅ Login successful:', user.username);

    res.status(200).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        balance: user.balance,
        is_admin: user.is_admin || false,
        email_verified: user.email_verified || false,
      },
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
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

    res.status(200).json({ user: result.rows[0] });
  } catch (error) {
    console.error('❌ Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==========================================
// MARKET ENDPOINTS
// ==========================================

// Get all markets
app.get('/api/markets', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        m.*,
        c.name as category_name,
        c.color as category_color,
        c.icon as category_icon,
        u.username as creator_username,
        COALESCE(array_agg(
          json_build_object(
            'id', mo.id,
            'option_text', mo.option_text,
            'odds', mo.odds,
            'bet_count', COALESCE(mo.bet_count, 0)
          ) 
          ORDER BY mo.id
        ) FILTER (WHERE mo.id IS NOT NULL), '{}') as options
      FROM markets m
      LEFT JOIN categories c ON m.category_id = c.id
      LEFT JOIN users u ON m.creator_id = u.id
      LEFT JOIN market_options mo ON m.id = mo.market_id
      WHERE m.status = 'active'
      GROUP BY m.id, c.name, c.color, c.icon, u.username
      ORDER BY m.created_at DESC
    `);

    // Convert 'multi-choice' to 'multiple' for frontend
    const markets = result.rows.map(market => ({
      ...market,
      market_type: market.market_type === 'multi-choice' ? 'multiple' : market.market_type
    }));

    res.status(200).json({ markets });
  } catch (error) {
    console.error('❌ Get markets error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create market
app.post('/api/markets', authenticateToken, async (req, res) => {
  const { 
    question, 
    category_id, 
    market_type, 
    close_date,
    options,
    ai_odds
  } = req.body;

  console.log('📊 Creating market:', { question, market_type, options });

  try {
    if (!question || !category_id || !close_date) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    let yes_odds = null;
    let no_odds = null;

    // Only set odds for binary markets
    if (market_type === 'binary') {
      if (ai_odds && ai_odds.odds) {
        const yesPercentage = ai_odds.odds.Yes || 50;
        const noPercentage = ai_odds.odds.No || 50;
        yes_odds = (100 / yesPercentage).toFixed(2);
        no_odds = (100 / noPercentage).toFixed(2);
      } else {
        yes_odds = 2.0;
        no_odds = 2.0;
      }
    }
    // For multiple choice, yes_odds and no_odds remain NULL

    // Convert 'multiple' to 'multi-choice' for database
    const dbMarketType = market_type === 'multiple' ? 'multi-choice' : (market_type || 'binary');
    
    const result = await pool.query(
      `INSERT INTO markets 
       (question, category_id, creator_id, market_type, deadline, yes_odds, no_odds, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active') 
       RETURNING *`,
      [
        question, 
        category_id, 
        req.user.userId, 
        dbMarketType, 
        close_date,
        yes_odds,
        no_odds
      ]
    );

    const market = result.rows[0];
    console.log('✅ Market created:', market.id);

    // Add options for multi-choice markets
    if (market_type === 'multiple' && options && options.length > 0) {
      for (const option of options) {
        let optionOdds = 2.0;
        
        if (ai_odds && ai_odds.odds && ai_odds.odds[option]) {
          const percentage = ai_odds.odds[option];
          optionOdds = (100 / percentage).toFixed(2);
        }

        await pool.query(
          'INSERT INTO market_options (market_id, option_text, odds, bet_count, option_order) VALUES ($1, $2, $3, 0, $4)',
          [market.id, option, optionOdds, options.indexOf(option) + 1]
        );
      }
    }

    res.status(201).json({ 
      message: 'Market created successfully',
      market 
    });
  } catch (error) {
    console.error('❌ Create market error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Report market (FIXED: uses reported_by)
app.post('/api/markets/:id/report', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  try {
    if (!reason) {
      return res.status(400).json({ error: 'Reason required' });
    }

    await pool.query(
      `INSERT INTO market_reports (market_id, reported_by, reason, status) 
       VALUES ($1, $2, $3, 'pending')`,
      [id, req.user.userId, reason]
    );

    console.log('✅ Market reported:', id);
    res.status(200).json({ message: 'Market reported successfully' });
  } catch (error) {
    console.error('❌ Report market error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete market (admin only)
app.delete('/api/markets/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const userResult = await pool.query(
      'SELECT is_admin FROM users WHERE id = $1',
      [req.user.userId]
    );

    if (!userResult.rows[0]?.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    await pool.query('DELETE FROM markets WHERE id = $1', [id]);

    console.log('✅ Market deleted:', id);
    res.status(200).json({ message: 'Market deleted successfully' });
  } catch (error) {
    console.error('❌ Delete market error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==========================================
// BET ENDPOINTS
// ==========================================

// Get user's bets (FIXED: uses correct column names)
app.get('/api/bets', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        b.id,
        b.user_id,
        b.market_id,
        b.amount,
        b.odds,
        b.bet_type as prediction,
        b.placed_at as created_at,
        b.won,
        b.option_id,
        (b.amount * b.odds) as potential_payout,
        CASE 
          WHEN m.status = 'resolved' AND b.won = true THEN 'won'
          WHEN m.status = 'resolved' AND b.won = false THEN 'lost'
          ELSE 'pending'
        END as status,
        m.question as market_question,
        m.status as market_status,
        m.winning_outcome,
        mo.option_text
      FROM bets b
      JOIN markets m ON b.market_id = m.id
      LEFT JOIN market_options mo ON b.option_id = mo.id
      WHERE b.user_id = $1
      ORDER BY b.placed_at DESC
    `, [req.user.userId]);

    res.status(200).json({ bets: result.rows });
  } catch (error) {
    console.error('❌ Get bets error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Place bet
app.post('/api/bets', authenticateToken, async (req, res) => {
  const { market_id, amount, prediction, option_id } = req.body;

  console.log('💰 Placing bet:', { market_id, amount, prediction, option_id });

  try {
    if (!market_id || !amount) {
      return res.status(400).json({ error: 'Market ID and amount required' });
    }

    const userResult = await pool.query(
      'SELECT balance FROM users WHERE id = $1',
      [req.user.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userBalance = parseFloat(userResult.rows[0].balance);

    if (userBalance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    const marketResult = await pool.query(
      'SELECT * FROM markets WHERE id = $1',
      [market_id]
    );

    if (marketResult.rows.length === 0) {
      return res.status(404).json({ error: 'Market not found' });
    }

    const market = marketResult.rows[0];

    if (market.status !== 'active') {
      return res.status(400).json({ error: 'Market is not active' });
    }

    let odds = 2.0;
    let potential_payout = amount * odds;

    if (market.market_type === 'binary') {
      odds = prediction === 'yes' ? parseFloat(market.yes_odds) : parseFloat(market.no_odds);
      potential_payout = amount * odds;
    } else if (market.market_type === 'multi-choice' && option_id) {
      const optionResult = await pool.query(
        'SELECT odds FROM market_options WHERE id = $1',
        [option_id]
      );
      if (optionResult.rows.length > 0) {
        odds = parseFloat(optionResult.rows[0].odds);
        potential_payout = amount * odds;
      }
    }

    const betResult = await pool.query(
      `INSERT INTO bets 
       (user_id, market_id, amount, bet_type, option_id, odds) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [req.user.userId, market_id, amount, prediction, option_id, odds]
    );

    await pool.query(
      'UPDATE users SET balance = balance - $1 WHERE id = $2',
      [amount, req.user.userId]
    );

    await pool.query(
      'UPDATE markets SET total_bet_amount = COALESCE(total_bet_amount, 0) + $1 WHERE id = $2',
      [amount, market_id]
    );

    console.log('✅ Bet placed:', betResult.rows[0].id);

    res.status(201).json({
      message: 'Bet placed successfully',
      bet: betResult.rows[0],
      newBalance: userBalance - amount
    });
  } catch (error) {
    console.error('❌ Place bet error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==========================================
// CATEGORY ENDPOINTS
// ==========================================

app.get('/api/categories', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categories ORDER BY display_order');
    res.status(200).json({ categories: result.rows });
  } catch (error) {
    console.error('❌ Get categories error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==========================================
// LEADERBOARD ENDPOINT
// ==========================================

app.get('/api/leaderboard', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id,
        username,
        balance,
        created_at
      FROM users
      ORDER BY balance DESC
      LIMIT 100
    `);

    res.status(200).json({ leaderboard: result.rows });
  } catch (error) {
    console.error('❌ Get leaderboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==========================================
// ADMIN ENDPOINTS
// ==========================================

// Get reported markets (FIXED: uses reported_by)
app.get('/api/admin/reports', authenticateToken, async (req, res) => {
  try {
    const userResult = await pool.query(
      'SELECT is_admin FROM users WHERE id = $1',
      [req.user.userId]
    );

    if (!userResult.rows[0]?.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const result = await pool.query(`
      SELECT 
        mr.*,
        m.question,
        u.username as reporter_username
      FROM market_reports mr
      JOIN markets m ON mr.market_id = m.id
      JOIN users u ON mr.reported_by = u.id
      ORDER BY mr.created_at DESC
    `);

    res.status(200).json({ reports: result.rows });
  } catch (error) {
    console.error('❌ Get reports error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Resolve report
app.patch('/api/admin/reports/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { action } = req.body;

  try {
    const userResult = await pool.query(
      'SELECT is_admin FROM users WHERE id = $1',
      [req.user.userId]
    );

    if (!userResult.rows[0]?.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    if (action === 'approve') {
      const reportResult = await pool.query(
        'SELECT market_id FROM market_reports WHERE id = $1',
        [id]
      );

      if (reportResult.rows.length > 0) {
        await pool.query('DELETE FROM markets WHERE id = $1', [reportResult.rows[0].market_id]);
      }

      await pool.query(
        'UPDATE market_reports SET status = $1 WHERE id = $2',
        ['approved', id]
      );
    } else {
      await pool.query(
        'UPDATE market_reports SET status = $1 WHERE id = $2',
        ['dismissed', id]
      );
    }

    console.log('✅ Report resolved:', id, action);
    res.status(200).json({ message: 'Report resolved successfully' });
  } catch (error) {
    console.error('❌ Resolve report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==========================================
// AI ODDS GENERATION
// ==========================================

app.post('/api/generate-odds', authenticateToken, async (req, res) => {
  const { question, options } = req.body;

  console.log('🤖 Generating AI odds for:', question);

  try {
    // Priority 1: Try OpenAI first
    if (process.env.OPENAI_API_KEY) {
      console.log('🔵 Trying OpenAI API...');
      const openaiResult = await generateOddsWithOpenAI(question, options);
      if (openaiResult.success) {
        console.log('✅ OpenAI odds generated successfully');
        return res.status(200).json({
          odds: openaiResult.odds,
          reasoning: openaiResult.reasoning,
          source: 'OpenAI GPT-4'
        });
      }
      console.log('⚠️ OpenAI failed, trying Anthropic...');
    }

    // Priority 2: Try Anthropic Claude
    if (process.env.ANTHROPIC_API_KEY) {
      console.log('🟣 Trying Anthropic API...');
      const claudeResult = await generateOddsWithClaude(question, options);
      if (claudeResult.success) {
        console.log('✅ Claude odds generated successfully');
        return res.status(200).json({
          odds: claudeResult.odds,
          reasoning: claudeResult.reasoning,
          source: 'Anthropic Claude'
        });
      }
      console.log('⚠️ Claude failed, using defaults...');
    }

    // Priority 3: Default odds
    console.log('⚠️ No API keys configured or all APIs failed, using default odds');
    res.status(200).json({
      odds: generateDefaultOdds(options),
      reasoning: 'Default odds (AI APIs unavailable)',
      source: 'Default'
    });

  } catch (error) {
    console.error('❌ Generate odds error:', error);
    res.status(200).json({
      odds: generateDefaultOdds(options),
      reasoning: 'Error generating AI odds, using defaults',
      source: 'Default'
    });
  }
});

// OpenAI odds generation
async function generateOddsWithOpenAI(question, options) {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{
          role: 'system',
          content: 'You are a prediction market expert. Analyze questions and provide accurate probability estimates based on current events, historical data, and logical reasoning. Always respond with valid JSON only.'
        }, {
          role: 'user',
          content: `Analyze this prediction market question and provide probability estimates.

Question: "${question}"
Options: ${options.join(', ')}

Respond with ONLY this JSON format (no other text):
{
  "odds": {
    ${options.map(opt => `"${opt}": <percentage as integer>`).join(',\n    ')}
  },
  "reasoning": "<brief explanation of your probability estimates>"
}

Make sure the percentages add up to 100.`
        }],
        temperature: 0.7,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      console.error('❌ OpenAI API error:', response.status, await response.text());
      return { success: false };
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('❌ Could not parse OpenAI response');
      return { success: false };
    }

    const aiResponse = JSON.parse(jsonMatch[0]);
    
    // Validate odds sum to 100
    const total = Object.values(aiResponse.odds).reduce((sum, val) => sum + val, 0);
    if (Math.abs(total - 100) > 2) {
      console.warn('⚠️ OpenAI odds don\'t sum to 100:', total, '- normalizing...');
      Object.keys(aiResponse.odds).forEach(key => {
        aiResponse.odds[key] = Math.round((aiResponse.odds[key] / total) * 100);
      });
    }

    return {
      success: true,
      odds: aiResponse.odds,
      reasoning: aiResponse.reasoning || 'AI-generated probability estimates'
    };

  } catch (error) {
    console.error('❌ OpenAI generation error:', error.message);
    return { success: false };
  }
}

// Anthropic Claude odds generation
async function generateOddsWithClaude(question, options) {
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
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `You are a prediction market expert. Analyze this question and provide probability estimates.

Question: "${question}"
Options: ${options.join(', ')}

Provide your analysis in this exact JSON format:
{
  "odds": {
    ${options.map(opt => `"${opt}": <percentage as integer>`).join(',\n    ')}
  },
  "reasoning": "<brief explanation of your probability estimates>"
}

Make sure the percentages add up to 100. Base your estimates on current events, historical data, and logical reasoning.`
        }]
      })
    });

    if (!response.ok) {
      console.error('❌ Claude API error:', response.status, await response.text());
      return { success: false };
    }

    const data = await response.json();
    const content = data.content[0].text;
    
    // Parse JSON from Claude's response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('❌ Could not parse Claude response');
      return { success: false };
    }

    const aiResponse = JSON.parse(jsonMatch[0]);
    
    // Validate odds sum to 100
    const total = Object.values(aiResponse.odds).reduce((sum, val) => sum + val, 0);
    if (Math.abs(total - 100) > 2) {
      console.warn('⚠️ Claude odds don\'t sum to 100:', total, '- normalizing...');
      Object.keys(aiResponse.odds).forEach(key => {
        aiResponse.odds[key] = Math.round((aiResponse.odds[key] / total) * 100);
      });
    }

    return {
      success: true,
      odds: aiResponse.odds,
      reasoning: aiResponse.reasoning || 'AI-generated probability estimates'
    };

  } catch (error) {
    console.error('❌ Claude generation error:', error.message);
    return { success: false };
  }
}

// Helper function for default odds
function generateDefaultOdds(options) {
  const odds = {};
  if (options.length === 2 && options[0] === 'Yes' && options[1] === 'No') {
    odds.Yes = 50;
    odds.No = 50;
  } else {
    const percentage = Math.floor(100 / options.length);
    const remainder = 100 - (percentage * options.length);
    options.forEach((option, index) => {
      odds[option] = percentage + (index === 0 ? remainder : 0);
    });
  }
  return odds;
}

// ==========================================
// HEALTH CHECK
// ==========================================

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// ==========================================
// START SERVER
// ==========================================

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
