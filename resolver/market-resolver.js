import express from 'express';
import cors from 'cors';
import pkg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

const { Pool } = pkg;
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
const pool = new Pool({
  user: process.env.POSTGRES_USER || 'binaryuser',
  host: process.env.POSTGRES_HOST || 'postgres',
  database: process.env.POSTGRES_DB || 'binarybets',
  password: process.env.POSTGRES_PASSWORD || 'binarypass',
  port: 5432,
});

// JWT secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here';

// Email transporter
let emailTransporter;
try {
  emailTransporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  emailTransporter.verify((error, success) => {
    if (error) {
      console.error('❌ Email service error:', error);
    } else {
      console.log('✅ Email service ready');
    }
  });
} catch (error) {
  console.error('❌ Failed to create email transporter:', error);
}

// Email templates
const getEmailTemplate = (type, data) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  
  if (type === 'welcome') {
    return {
      subject: '🎉 Welcome to Binary Bets!',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎲 Welcome to Binary Bets!</h1>
            </div>
            <div class="content">
              <h2>Hey ${data.username}! 🎉</h2>
              <p>Welcome to the most exciting prediction market platform! We're thrilled to have you join our community of savvy predictors.</p>
              <p><strong>Your account is ready to roll:</strong></p>
              <ul>
                <li>💰 Starting balance: $10,000</li>
                <li>🎯 Hundreds of markets to explore</li>
                <li>🏆 Compete on the leaderboard</li>
                <li>📊 Track your portfolio in real-time</li>
              </ul>
              <p>Please verify your email to unlock all features:</p>
              <a href="${frontendUrl}/verify-email?token=${data.token}" class="button">✅ Verify Email</a>
              <p>Ready to make your first prediction? Let's go! 🚀</p>
            </div>
            <div class="footer">
              <p>Binary Bets - Where predictions meet profits</p>
            </div>
          </div>
        </body>
        </html>
      `
    };
  }
  
  if (type === 'reset-password') {
    return {
      subject: '🔐 Reset Your Binary Bets Password',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Password Reset Request</h1>
            </div>
            <div class="content">
              <h2>Hey ${data.username}!</h2>
              <p>We received a request to reset your password. No worries, it happens to the best of us! 😊</p>
              <p>Click the button below to create a new password:</p>
              <a href="${frontendUrl}/reset-password?token=${data.token}" class="button">🔑 Reset Password</a>
              <p><strong>This link expires in 1 hour.</strong></p>
              <p>If you didn't request this, you can safely ignore this email. Your password won't change.</p>
            </div>
            <div class="footer">
              <p>Binary Bets - Secure predictions, secure accounts</p>
            </div>
          </div>
        </body>
        </html>
      `
    };
  }
};

// Send email helper
async function sendEmail(to, template, data) {
  if (!emailTransporter) {
    console.warn('⚠️ Email transporter not configured, skipping email');
    return false;
  }

  try {
    const { subject, html } = getEmailTemplate(template, data);
    await emailTransporter.sendMail({
      from: `"Binary Bets" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html
    });
    console.log(`✅ Email sent to ${to}`);
    return true;
  } catch (error) {
    console.error('❌ Error sending email:', error);
    return false;
  }
}

// Middleware to authenticate JWT token
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

// ============================================
// AUTHENTICATION ENDPOINTS
// ============================================

// Signup
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if user exists
    const existing = await pool.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create user
    const result = await pool.query(
      `INSERT INTO users (username, email, password, balance, email_verified, verification_token, verification_token_expires)
       VALUES ($1, $2, $3, 10000, false, $4, $5)
       RETURNING id, username, email, balance`,
      [username, email, hashedPassword, verificationToken, tokenExpires]
    );

    const user = result.rows[0];

    // Send welcome email
    await sendEmail(email, 'welcome', {
      username,
      token: verificationToken
    });

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        balance: parseFloat(user.balance)
      }
    });
  } catch (error) {
    console.error('❌ Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login
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
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(200).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        balance: parseFloat(user.balance),
        email_verified: user.email_verified
      }
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
      'SELECT id, username, email, balance, email_verified, is_admin FROM users WHERE id = $1',
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    res.status(200).json({
      id: user.id,
      username: user.username,
      email: user.email,
      balance: parseFloat(user.balance),
      email_verified: user.email_verified,
      is_admin: user.is_admin
    });
  } catch (error) {
    console.error('❌ Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// MARKET ENDPOINTS
// ============================================

// Get all markets
app.get('/api/markets', async (req, res) => {
  try {
    const { status, category } = req.query;
    
    let query = `
      SELECT 
        m.*,
        c.name as category_name,
        c.color as category_color,
        c.icon as category_icon,
        COUNT(DISTINCT b.id) as total_bets,
        COALESCE(SUM(b.amount), 0) as total_volume
      FROM markets m
      LEFT JOIN categories c ON m.category_id = c.id
      LEFT JOIN bets b ON m.id = b.market_id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 1;
    
    if (status) {
      query += ` AND m.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }
    
    if (category) {
      query += ` AND m.category_id = $${paramCount}`;
      params.push(category);
      paramCount++;
    }
    
    query += ` GROUP BY m.id, c.name, c.color, c.icon ORDER BY m.created_at DESC`;
    
    const result = await pool.query(query, params);
    
    // Get options for multi-choice markets
    const marketsWithOptions = await Promise.all(result.rows.map(async (market) => {
      if (market.market_type === 'multi-choice') {
        const optionsResult = await pool.query(
          `SELECT id, option_text, odds, bet_count FROM market_options WHERE market_id = $1 ORDER BY option_order`,
          [market.id]
        );
        return {
          ...market,
          market_type: 'multiple', // Convert for frontend
          options: optionsResult.rows,
          total_bets: parseInt(market.total_bets),
          total_volume: parseFloat(market.total_volume)
        };
      }
      return {
        ...market,
        total_bets: parseInt(market.total_bets),
        total_volume: parseFloat(market.total_volume)
      };
    }));
    
    res.status(200).json({ markets: marketsWithOptions });
  } catch (error) {
    console.error('❌ Get markets error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create market
app.post('/api/markets', authenticateToken, async (req, res) => {
  try {
    const { question, category_id, bet_type, options, yes_odds, no_odds, deadline } = req.body;

    // Convert frontend 'multiple' to database 'multi-choice'
    const dbMarketType = bet_type === 'multiple' ? 'multi-choice' : 'binary';

    console.log('📊 Creating market:', { question, market_type: bet_type, options });

    // For multi-choice markets, ensure yes_odds and no_odds are NULL
    const finalYesOdds = dbMarketType === 'multi-choice' ? null : (yes_odds || 2.0);
    const finalNoOdds = dbMarketType === 'multi-choice' ? null : (no_odds || 2.0);

    const result = await pool.query(
      `INSERT INTO markets (question, category_id, market_type, yes_odds, no_odds, deadline, status, creator_id)
       VALUES ($1, $2, $3, $4, $5, $6, 'active', $7)
       RETURNING *`,
      [question, category_id, dbMarketType, finalYesOdds, finalNoOdds, deadline, req.user.userId]
    );

    const market = result.rows[0];
    console.log('✅ Market created:', market.id);

    // If multi-choice, create options
    if (dbMarketType === 'multi-choice' && options && options.length > 0) {
      for (let i = 0; i < options.length; i++) {
        const option = options[i];
        await pool.query(
          `INSERT INTO market_options (market_id, option_text, odds, option_order)
           VALUES ($1, $2, $3, $4)`,
          [market.id, option.text || option, option.odds || 2.0, i + 1]
        );
      }
    }

    res.status(201).json({ market });
  } catch (error) {
    console.error('❌ Create market error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// MARKET RESOLUTION ENDPOINTS (FOR RESOLVER)
// ============================================

// Resolve a market manually
app.post('/api/markets/:id/resolve', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { outcome, winning_outcome } = req.body;

    console.log(`🎯 Resolving market ${id} with outcome:`, outcome, winning_outcome);

    // Update market status
    await pool.query(
      `UPDATE markets 
       SET status = 'resolved', 
           outcome = $1, 
           winning_outcome = $2,
           resolved_at = CURRENT_TIMESTAMP,
           resolved_by = $3
       WHERE id = $4`,
      [outcome, winning_outcome, req.user.userId, id]
    );

    // Get market info
    const marketResult = await pool.query(
      'SELECT * FROM markets WHERE id = $1',
      [id]
    );
    const market = marketResult.rows[0];

    // Process bets for binary markets
    if (market.market_type === 'binary') {
      await pool.query(
        `UPDATE bets 
         SET won = (bet_type = $1),
             updated_at = CURRENT_TIMESTAMP
         WHERE market_id = $2`,
        [winning_outcome, id]
      );

      // Update user balances for winners
      const winningBets = await pool.query(
        `SELECT user_id, amount, odds FROM bets 
         WHERE market_id = $1 AND bet_type = $2`,
        [id, winning_outcome]
      );

      for (const bet of winningBets.rows) {
        const payout = parseFloat(bet.amount) * parseFloat(bet.odds);
        await pool.query(
          'UPDATE users SET balance = balance + $1 WHERE id = $2',
          [payout, bet.user_id]
        );
      }
    } else {
      // Multi-choice markets
      await pool.query(
        `UPDATE bets b
         SET won = (mo.option_text = $1),
             updated_at = CURRENT_TIMESTAMP
         FROM market_options mo
         WHERE b.option_id = mo.id 
           AND b.market_id = $2`,
        [winning_outcome, id]
      );

      // Update user balances for winners
      const winningBets = await pool.query(
        `SELECT b.user_id, b.amount, b.odds 
         FROM bets b
         JOIN market_options mo ON b.option_id = mo.id
         WHERE b.market_id = $1 AND mo.option_text = $2`,
        [id, winning_outcome]
      );

      for (const bet of winningBets.rows) {
        const payout = parseFloat(bet.amount) * parseFloat(bet.odds);
        await pool.query(
          'UPDATE users SET balance = balance + $1 WHERE id = $2',
          [payout, bet.user_id]
        );
      }
    }

    console.log(`✅ Market ${id} resolved successfully`);
    res.status(200).json({ message: 'Market resolved successfully' });
  } catch (error) {
    console.error('❌ Resolve market error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Resolve market with AI
app.post('/api/resolve-with-ai', authenticateToken, async (req, res) => {
  try {
    const { market_id, question, options } = req.body;

    console.log(`🤖 AI resolving market ${market_id}:`, question);

    let outcome = null;

    // Try OpenAI first
    if (process.env.OPENAI_API_KEY && !outcome) {
      try {
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
              {
                role: 'system',
                content: 'You are an expert at determining outcomes of prediction markets based on real-world events. Analyze the question and determine the outcome. Respond with ONLY the winning option text, nothing else.'
              },
              {
                role: 'user',
                content: `Question: ${question}\nOptions: ${options ? options.join(', ') : 'Yes, No'}\n\nWhat is the correct outcome based on current information?`
              }
            ],
            temperature: 0.3
          })
        });

        if (openaiResponse.ok) {
          const data = await openaiResponse.json();
          outcome = data.choices[0].message.content.trim();
          console.log('✅ OpenAI determined outcome:', outcome);
        }
      } catch (error) {
        console.warn('⚠️ OpenAI resolution failed:', error.message);
      }
    }

    // Try Anthropic if OpenAI failed
    if (process.env.ANTHROPIC_API_KEY && !outcome) {
      try {
        const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 1024,
            messages: [
              {
                role: 'user',
                content: `You are an expert at determining outcomes of prediction markets based on real-world events. Analyze the question and determine the outcome. Respond with ONLY the winning option text, nothing else.\n\nQuestion: ${question}\nOptions: ${options ? options.join(', ') : 'Yes, No'}\n\nWhat is the correct outcome based on current information?`
              }
            ],
            temperature: 0.3
          })
        });

        if (anthropicResponse.ok) {
          const data = await anthropicResponse.json();
          outcome = data.content[0].text.trim();
          console.log('✅ Claude determined outcome:', outcome);
        }
      } catch (error) {
        console.warn('⚠️ Anthropic resolution failed:', error.message);
      }
    }

    // Default to "Unresolved" if AI failed
    if (!outcome) {
      outcome = 'Unresolved';
      console.warn('⚠️ AI resolution failed, marking as Unresolved');
    }

    res.status(200).json({ outcome });
  } catch (error) {
    console.error('❌ AI resolve error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// BET ENDPOINTS
// ============================================

// Get all bets for authenticated user
app.get('/api/bets', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        b.id,
        b.user_id,
        b.market_id,
        b.amount,
        b.odds,
        b.bet_type as prediction,
        b.placed_at as created_at,
        b.won,
        (b.amount * b.odds) as potential_payout,
        CASE 
          WHEN m.status = 'resolved' AND b.won = true THEN 'won'
          WHEN m.status = 'resolved' AND b.won = false THEN 'lost'
          WHEN m.status = 'active' THEN 'active'
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
      ORDER BY b.placed_at DESC`,
      [req.user.userId]
    );

    res.status(200).json({ bets: result.rows });
  } catch (error) {
    console.error('❌ Get bets error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Place a bet
app.post('/api/bets', authenticateToken, async (req, res) => {
  try {
    const { market_id, amount, prediction, option_id } = req.body;

    // Get market
    const marketResult = await pool.query('SELECT * FROM markets WHERE id = $1', [market_id]);
    if (marketResult.rows.length === 0) {
      return res.status(404).json({ error: 'Market not found' });
    }
    const market = marketResult.rows[0];

    // Check user balance
    const userResult = await pool.query('SELECT balance FROM users WHERE id = $1', [req.user.userId]);
    const balance = parseFloat(userResult.rows[0].balance);

    if (balance < parseFloat(amount)) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Get odds
    let odds;
    if (market.market_type === 'multi-choice') {
      const optionResult = await pool.query('SELECT odds FROM market_options WHERE id = $1', [option_id]);
      odds = parseFloat(optionResult.rows[0].odds);
    } else {
      odds = prediction === 'yes' ? parseFloat(market.yes_odds) : parseFloat(market.no_odds);
    }

    // Deduct from balance
    await pool.query(
      'UPDATE users SET balance = balance - $1 WHERE id = $2',
      [amount, req.user.userId]
    );

    // Create bet (using bet_type, not prediction)
    const result = await pool.query(
      `INSERT INTO bets (user_id, market_id, amount, odds, bet_type, option_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.user.userId, market_id, amount, odds, prediction, option_id]
    );

    res.status(201).json({ bet: result.rows[0] });
  } catch (error) {
    console.error('❌ Place bet error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// CATEGORY ENDPOINTS
// ============================================

app.get('/api/categories', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categories ORDER BY display_order');
    res.status(200).json({ categories: result.rows });
  } catch (error) {
    console.error('❌ Get categories error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// LEADERBOARD ENDPOINT
// ============================================

app.get('/api/leaderboard', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, balance, created_at FROM users ORDER BY balance DESC LIMIT 100'
    );
    res.status(200).json({ leaderboard: result.rows });
  } catch (error) {
    console.error('❌ Get leaderboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// ADMIN ENDPOINTS
// ============================================

app.get('/api/admin/reports', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        mr.id,
        mr.market_id,
        mr.reason,
        mr.status,
        mr.created_at,
        mr.admin_notes,
        m.question as market_question,
        u.username as reporter_username
      FROM market_reports mr
      JOIN markets m ON mr.market_id = m.id
      JOIN users u ON mr.reported_by = u.id
      WHERE mr.status = 'pending'
      ORDER BY mr.created_at DESC`
    );

    res.status(200).json({ reports: result.rows });
  } catch (error) {
    console.error('❌ Get reports error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.patch('/api/admin/reports/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { action, admin_notes } = req.body;

    await pool.query(
      `UPDATE market_reports 
       SET status = $1, 
           admin_notes = $2, 
           resolved_by = $3, 
           resolved_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [action, admin_notes, req.user.userId, id]
    );

    console.log('✅ Report resolved:', id, action);
    res.status(200).json({ message: 'Report resolved successfully' });
  } catch (error) {
    console.error('❌ Resolve report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// AI ODDS GENERATION ENDPOINT
// ============================================

app.post('/api/generate-odds', async (req, res) => {
  try {
    const { question, options } = req.body;
    console.log('🤖 Generating AI odds for:', question);

    let aiOdds = null;
    let reasoning = '';
    let source = 'Default';

    // Try OpenAI first (Priority 1)
    if (process.env.OPENAI_API_KEY) {
      try {
        console.log('🔵 Trying OpenAI API...');
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
              {
                role: 'system',
                content: 'You are an expert prediction market analyst. Provide probability estimates for outcomes based on current information and historical trends. Return ONLY valid JSON.'
              },
              {
                role: 'user',
                content: `Question: ${question}\nOptions: ${options.join(', ')}\n\nProvide probability estimates (as percentages that sum to 100) and brief reasoning. Format: {"odds": {"option1": percentage, "option2": percentage}, "reasoning": "brief explanation"}`
              }
            ],
            temperature: 0.7
          })
        });

        if (openaiResponse.ok) {
          const data = await openaiResponse.json();
          const parsed = JSON.parse(data.choices[0].message.content);
          aiOdds = parsed.odds;
          reasoning = parsed.reasoning;
          source = 'OpenAI GPT-4';
          console.log('✅ OpenAI odds generated:', aiOdds);
        }
      } catch (error) {
        console.warn('⚠️ OpenAI failed:', error.message);
      }
    }

    // Try Anthropic if OpenAI failed (Priority 2)
    if (!aiOdds && process.env.ANTHROPIC_API_KEY) {
      try {
        console.log('🟣 Trying Anthropic API...');
        const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 1024,
            messages: [
              {
                role: 'user',
                content: `You are an expert prediction market analyst. Question: ${question}\nOptions: ${options.join(', ')}\n\nProvide probability estimates (as percentages that sum to 100) and brief reasoning. Format: {"odds": {"option1": percentage, "option2": percentage}, "reasoning": "brief explanation"}`
              }
            ],
            temperature: 0.7
          })
        });

        if (anthropicResponse.ok) {
          const data = await anthropicResponse.json();
          const parsed = JSON.parse(data.content[0].text);
          aiOdds = parsed.odds;
          reasoning = parsed.reasoning;
          source = 'Anthropic Claude';
          console.log('✅ Claude odds generated:', aiOdds);
        }
      } catch (error) {
        console.warn('⚠️ Anthropic failed:', error.message);
      }
    }

    // Use default odds if both AI providers failed (Priority 3)
    if (!aiOdds) {
      console.log('⚠️ Using default odds');
      aiOdds = {};
      const evenOdds = Math.round(100 / options.length);
      options.forEach(option => {
        aiOdds[option] = evenOdds;
      });
      reasoning = 'Default even distribution';
      source = 'Default';
    }

    // Normalize to ensure sum is 100
    const total = Object.values(aiOdds).reduce((sum, val) => sum + val, 0);
    if (total !== 100) {
      const factor = 100 / total;
      Object.keys(aiOdds).forEach(key => {
        aiOdds[key] = Math.round(aiOdds[key] * factor);
      });
    }

    res.status(200).json({ odds: aiOdds, reasoning, source });
  } catch (error) {
    console.error('❌ Error generating odds:', error);
    // Return default odds on error
    const defaultOdds = {};
    const evenOdds = Math.round(100 / req.body.options.length);
    req.body.options.forEach(option => {
      defaultOdds[option] = evenOdds;
    });
    res.status(200).json({ 
      odds: defaultOdds, 
      reasoning: 'Default even distribution due to error', 
      source: 'Default' 
    });
  }
});

// ============================================
// HEALTH CHECK
// ============================================

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
