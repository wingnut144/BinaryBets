const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================================================
// CONFIGURATION
// ============================================================================

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const RESOLVER_TOKEN = process.env.RESOLVER_TOKEN || 'resolver-secure-token-' + Math.random().toString(36).substring(2, 15);

console.log('🔐 Resolver Token:', RESOLVER_TOKEN);

// Database configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection error:', err);
  } else {
    console.log('✅ Database connected at:', res.rows[0].now);
  }
});

// ============================================================================
// MIDDLEWARE
// ============================================================================

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// ============================================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================================

const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    console.log(`🔐 Authenticated user:`, decoded);
    next();
  } catch (error) {
    console.error('❌ Token verification failed:', error.message);
    res.status(401).json({ error: 'Invalid token' });
  }
};

const authenticateAdmin = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Check if user is admin
    const result = await pool.query(
      'SELECT is_admin FROM users WHERE id = $1',
      [decoded.id]
    );
    
    if (!result.rows[0] || !result.rows[0].is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    req.user = decoded;
    next();
  } catch (error) {
    console.error('❌ Admin authentication failed:', error.message);
    res.status(401).json({ error: 'Invalid token' });
  }
};

const authenticateResolver = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (token === RESOLVER_TOKEN) {
    next();
  } else {
    res.status(403).json({ error: 'Invalid resolver token' });
  }
};

// ============================================================================
// HEALTH CHECK
// ============================================================================

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// ============================================================================
// AUTH ROUTES
// ============================================================================

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields required' });
    }
    
    // Check if user exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );
    
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Create user
    const result = await pool.query(
      'INSERT INTO users (username, email, password_hash, balance) VALUES ($1, $2, $3, $4) RETURNING id, username, email, balance',
      [username, email, passwordHash, 1000.00]
    );
    
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    
    console.log('✅ New user registered:', username);
    
    res.status(201).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        balance: parseFloat(user.balance),
        is_admin: false
      }
    });
  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    
    // Get user
    const result = await pool.query(
      'SELECT id, username, email, password_hash, balance, is_admin FROM users WHERE username = $1',
      [username]
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
    
    // Generate token
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    
    console.log('✅ User logged in:', username);
    
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        balance: parseFloat(user.balance),
        is_admin: user.is_admin || false
      }
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ============================================================================
// EMAIL VERIFICATION & PASSWORD RESET ROUTES
// ============================================================================

// Temporary in-memory storage (use Redis in production)
const verificationCodes = new Map();
const resetTokens = new Map();

// Send verification email
app.post('/api/auth/send-verification', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    verificationCodes.set(userId, {
      code,
      expires: Date.now() + 10 * 60 * 1000
    });
    
    const result = await pool.query(
      'SELECT email, username FROM users WHERE id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const { email, username } = result.rows[0];
    
    console.log('📧 Verification code for', username, ':', code);
    
    // In development, return the code
    if (process.env.NODE_ENV === 'development') {
      return res.json({ 
        message: 'Verification code sent',
        code
      });
    }
    
    res.json({ 
      message: 'Verification code sent to your email',
      email: email.replace(/(.{2})(.*)(@.*)/, '$1***$3')
    });
    
  } catch (error) {
    console.error('❌ Error sending verification:', error);
    res.status(500).json({ error: 'Failed to send verification code' });
  }
});

// Verify email with code
app.post('/api/auth/verify-email', authenticate, async (req, res) => {
  try {
    const { code } = req.body;
    const userId = req.user.id;
    
    if (!code) {
      return res.status(400).json({ error: 'Verification code required' });
    }
    
    const stored = verificationCodes.get(userId);
    
    if (!stored) {
      return res.status(400).json({ error: 'No verification code found' });
    }
    
    if (Date.now() > stored.expires) {
      verificationCodes.delete(userId);
      return res.status(400).json({ error: 'Verification code expired' });
    }
    
    if (stored.code !== code) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }
    
    await pool.query(
      'UPDATE users SET email_verified = TRUE WHERE id = $1',
      [userId]
    );
    
    verificationCodes.delete(userId);
    
    console.log('✅ Email verified for user:', userId);
    
    res.json({ 
      message: 'Email verified successfully',
      verified: true
    });
    
  } catch (error) {
    console.error('❌ Error verifying email:', error);
    res.status(500).json({ error: 'Failed to verify email' });
  }
});

// Request password reset
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }
    
    const result = await pool.query(
      'SELECT id, username, email FROM users WHERE email = $1',
      [email]
    );
    
    if (result.rows.length === 0) {
      console.log('⚠️  Password reset requested for non-existent email:', email);
      return res.json({ 
        message: 'If that email exists, a reset link has been sent'
      });
    }
    
    const user = result.rows[0];
    const resetToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
    
    resetTokens.set(resetToken, {
      userId: user.id,
      expires: Date.now() + 60 * 60 * 1000
    });
    
    console.log('🔐 Password reset token for', user.username, ':', resetToken);
    console.log('   Reset link: https://binary-bets.com/reset-password?token=' + resetToken);
    
    if (process.env.NODE_ENV === 'development') {
      return res.json({ 
        message: 'Password reset link sent',
        token: resetToken,
        resetLink: `https://binary-bets.com/reset-password?token=${resetToken}`
      });
    }
    
    res.json({ 
      message: 'If that email exists, a reset link has been sent'
    });
    
  } catch (error) {
    console.error('❌ Error requesting password reset:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// Verify reset token
app.get('/api/auth/verify-reset-token/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const stored = resetTokens.get(token);
    
    if (!stored) {
      return res.status(400).json({ 
        valid: false,
        error: 'Invalid or expired reset token' 
      });
    }
    
    if (Date.now() > stored.expires) {
      resetTokens.delete(token);
      return res.status(400).json({ 
        valid: false,
        error: 'Reset token has expired' 
      });
    }
    
    res.json({ 
      valid: true,
      message: 'Token is valid'
    });
    
  } catch (error) {
    console.error('❌ Error verifying reset token:', error);
    res.status(500).json({ error: 'Failed to verify token' });
  }
});

// Reset password with token
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    
    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password required' });
    }
    
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    
    const stored = resetTokens.get(token);
    
    if (!stored) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }
    
    if (Date.now() > stored.expires) {
      resetTokens.delete(token);
      return res.status(400).json({ error: 'Reset token has expired' });
    }
    
    const passwordHash = await bcrypt.hash(password, 10);
    
    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [passwordHash, stored.userId]
    );
    
    resetTokens.delete(token);
    
    console.log('✅ Password reset for user:', stored.userId);
    
    res.json({ 
      message: 'Password reset successfully',
      success: true
    });
    
  } catch (error) {
    console.error('❌ Error resetting password:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// ============================================================================
// CATEGORY ROUTES
// ============================================================================

// Get all categories
app.get('/api/categories', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        c.id,
        c.name,
        c.icon,
        c.color,
        c.description,
        COUNT(DISTINCT m.id) as market_count
      FROM categories c
      LEFT JOIN markets m ON m.category_id = c.id
      GROUP BY c.id
      ORDER BY c.name
    `);
    
    const categories = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      icon: row.icon,
      color: row.color,
      description: row.description,
      market_count: parseInt(row.market_count)
    }));
    
    console.log(`📁 Categories loaded: (${categories.length})`, categories.map(c => c.name));
    
    res.json({ categories });
  } catch (error) {
    console.error('❌ Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Get category with subcategories
app.get('/api/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get category
    const categoryResult = await pool.query(
      'SELECT * FROM categories WHERE id = $1',
      [id]
    );
    
    if (categoryResult.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    // Get subcategories
    const subcategoriesResult = await pool.query(
      'SELECT id, name, description FROM subcategories WHERE category_id = $1 ORDER BY name',
      [id]
    );
    
    const category = {
      ...categoryResult.rows[0],
      subcategories: subcategoriesResult.rows
    };
    
    res.json({ category });
  } catch (error) {
    console.error('❌ Error fetching category:', error);
    res.status(500).json({ error: 'Failed to fetch category' });
  }
});

// ============================================================================
// ADMIN CATEGORY MANAGEMENT ROUTES
// ============================================================================

// Create category
app.post('/api/admin/categories', authenticateAdmin, async (req, res) => {
  try {
    const { name, icon, color, description } = req.body;
    
    const result = await pool.query(
      'INSERT INTO categories (name, icon, color, description) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, icon || '📁', color || '#667eea', description]
    );
    
    console.log('✅ Category created:', name);
    res.status(201).json({ category: result.rows[0] });
  } catch (error) {
    console.error('❌ Error creating category:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// Update category
app.put('/api/admin/categories/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, icon, color, description } = req.body;
    
    const result = await pool.query(
      'UPDATE categories SET name = $1, icon = $2, color = $3, description = $4 WHERE id = $5 RETURNING *',
      [name, icon, color, description, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    console.log('✅ Category updated:', name);
    res.json({ category: result.rows[0] });
  } catch (error) {
    console.error('❌ Error updating category:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// Delete category
app.delete('/api/admin/categories/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    await pool.query('DELETE FROM categories WHERE id = $1', [id]);
    
    console.log('✅ Category deleted:', id);
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting category:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

// Create subcategory
app.post('/api/admin/subcategories', authenticateAdmin, async (req, res) => {
  try {
    const { category_id, name, description } = req.body;
    
    const result = await pool.query(
      'INSERT INTO subcategories (category_id, name, description) VALUES ($1, $2, $3) RETURNING *',
      [category_id, name, description]
    );
    
    console.log('✅ Subcategory created:', name);
    res.status(201).json({ subcategory: result.rows[0] });
  } catch (error) {
    console.error('❌ Error creating subcategory:', error);
    res.status(500).json({ error: 'Failed to create subcategory' });
  }
});

// Update subcategory
app.put('/api/admin/subcategories/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    
    const result = await pool.query(
      'UPDATE subcategories SET name = $1, description = $2 WHERE id = $3 RETURNING *',
      [name, description, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Subcategory not found' });
    }
    
    console.log('✅ Subcategory updated:', name);
    res.json({ subcategory: result.rows[0] });
  } catch (error) {
    console.error('❌ Error updating subcategory:', error);
    res.status(500).json({ error: 'Failed to update subcategory' });
  }
});

// Delete subcategory
app.delete('/api/admin/subcategories/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    await pool.query('DELETE FROM subcategories WHERE id = $1', [id]);
    
    console.log('✅ Subcategory deleted:', id);
    res.json({ message: 'Subcategory deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting subcategory:', error);
    res.status(500).json({ error: 'Failed to delete subcategory' });
  }
});

// ============================================================================
// AI ODDS GENERATION ROUTE (CHATGPT PRIMARY, ANTHROPIC FALLBACK)
// ============================================================================

app.post('/api/generate-odds', authenticate, async (req, res) => {
  try {
    const { question, options } = req.body;
    
    if (!question || !options || !Array.isArray(options) || options.length < 2) {
      return res.status(400).json({ 
        error: 'Please provide a question and at least 2 options' 
      });
    }

    console.log('🤖 Generating odds for:', question);
    console.log('📊 Options:', options);
    
    // ========================================================================
    // PRIMARY: Try OpenAI ChatGPT first
    // ========================================================================
    if (process.env.OPENAI_API_KEY) {
      try {
        console.log('🎯 Attempting ChatGPT odds generation...');
        
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: 'gpt-4',
            messages: [{
              role: 'system',
              content: 'You are a prediction market odds estimator. Analyze questions and provide probability estimates in JSON format only.'
            }, {
              role: 'user',
              content: `Estimate probabilities for: "${question}"\nOptions: ${options.join(', ')}\nRespond with ONLY valid JSON: {"${options[0]}": 0.XX, "${options[1]}": 0.XX}\nProbabilities must sum to 1.0.`
            }],
            max_tokens: 200,
            temperature: 0.7
          })
        });
        
        if (openaiResponse.ok) {
          const data = await openaiResponse.json();
          const responseText = data.choices[0].message.content.trim();
          
          console.log('📝 ChatGPT response:', responseText);
          
          const jsonMatch = responseText.match(/\{[^}]+\}/);
          if (jsonMatch) {
            const odds = JSON.parse(jsonMatch[0]);
            
            const sum = Object.values(odds).reduce((a, b) => a + b, 0);
            const hasAllOptions = options.every(opt => odds.hasOwnProperty(opt));
            
            if (hasAllOptions && Math.abs(sum - 1.0) < 0.02) {
              const normalizationFactor = 1.0 / sum;
              Object.keys(odds).forEach(key => {
                odds[key] = parseFloat((odds[key] * normalizationFactor).toFixed(3));
              });
              
              console.log('✅ ChatGPT odds:', odds);
              return res.json({ 
                odds, 
                provider: 'chatgpt',
                message: 'AI-generated odds powered by ChatGPT-4'
              });
            }
          }
        }
      } catch (error) {
        console.error('❌ ChatGPT failed:', error.message);
      }
    }
    
    // ========================================================================
    // FALLBACK: Try Anthropic Claude
    // ========================================================================
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        console.log('🎯 Attempting Anthropic (fallback)...');
        
        const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 250,
            messages: [{
              role: 'user',
              content: `Estimate probabilities for: "${question}"\nOptions: ${options.join(', ')}\nRespond with ONLY JSON: {"${options[0]}": 0.XX, "${options[1]}": 0.XX}\nSum must equal 1.0.`
            }]
          })
        });
        
        if (anthropicResponse.ok) {
          const data = await anthropicResponse.json();
          const responseText = data.content[0].text.trim();
          
          console.log('📝 Anthropic response:', responseText);
          
          const jsonMatch = responseText.match(/\{[^}]+\}/);
          if (jsonMatch) {
            const odds = JSON.parse(jsonMatch[0]);
            
            const sum = Object.values(odds).reduce((a, b) => a + b, 0);
            const hasAllOptions = options.every(opt => odds.hasOwnProperty(opt));
            
            if (hasAllOptions && Math.abs(sum - 1.0) < 0.02) {
              const normalizationFactor = 1.0 / sum;
              Object.keys(odds).forEach(key => {
                odds[key] = parseFloat((odds[key] * normalizationFactor).toFixed(3));
              });
              
              console.log('✅ Anthropic odds:', odds);
              return res.json({ 
                odds, 
                provider: 'anthropic',
                message: 'AI-generated odds powered by Claude'
              });
            }
          }
        }
      } catch (error) {
        console.error('❌ Anthropic failed:', error.message);
      }
    }
    
    // Equal odds fallback
    console.log('⚠️ Using equal odds fallback');
    const equalProb = 1.0 / options.length;
    const odds = {};
    options.forEach(option => {
      odds[option] = parseFloat(equalProb.toFixed(3));
    });
    
    res.json({ 
      odds, 
      provider: 'fallback',
      message: 'Using equal probabilities'
    });
    
  } catch (error) {
    console.error('❌ Odds generation error:', error);
    res.status(500).json({ error: 'Failed to generate odds' });
  }
});

// ============================================================================
// MARKET ROUTES
// ============================================================================

// Get all markets
app.get('/api/markets', async (req, res) => {
  try {
    const { category, subcategory } = req.query;
    
    let query = `
      SELECT 
        m.*,
        c.name as category_name,
        c.icon as category_icon,
        c.color as category_color,
        s.name as subcategory_name,
        u.username as creator_username
      FROM markets m
      LEFT JOIN categories c ON m.category_id = c.id
      LEFT JOIN subcategories s ON m.subcategory_id = s.id
      LEFT JOIN users u ON m.created_by = u.id
      WHERE m.status = 'active'
    `;
    
    const params = [];
    
    if (category && category !== 'all') {
      params.push(category);
      query += ` AND m.category_id = $${params.length}`;
    }
    
    if (subcategory) {
      params.push(subcategory);
      query += ` AND m.subcategory_id = $${params.length}`;
    }
    
    query += ' ORDER BY m.created_at DESC';
    
    const result = await pool.query(query, params);
    
    const markets = result.rows.map(row => ({
      ...row,
      options: row.options || [],
      close_date: row.close_date
    }));
    
    console.log(`📊 Loaded ${markets.length} markets`);
    res.json({ markets });
  } catch (error) {
    console.error('❌ Error fetching markets:', error);
    res.status(500).json({ error: 'Failed to fetch markets' });
  }
});

// Create market
app.post('/api/markets', authenticate, async (req, res) => {
  try {
    const { question, options, close_date, category_id, subcategory_id, ai_odds } = req.body;
    
    if (!question || !options || !close_date) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (!Array.isArray(options) || options.length < 2) {
      return res.status(400).json({ error: 'At least 2 options required' });
    }
    
    const result = await pool.query(
      `INSERT INTO markets (question, options, close_date, created_by, category_id, subcategory_id, ai_odds) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [question, JSON.stringify(options), close_date, req.user.id, category_id, subcategory_id, ai_odds ? JSON.stringify(ai_odds) : null]
    );
    
    console.log('✅ Market created:', question);
    res.status(201).json({ market: result.rows[0] });
  } catch (error) {
    console.error('❌ Error creating market:', error);
    res.status(500).json({ error: 'Failed to create market' });
  }
});

// ============================================================================
// BET ROUTES
// ============================================================================

// Get user's bets
app.get('/api/bets', authenticate, async (req, res) => {
  try {
    console.log(`📊 GET /api/bets - User: ${req.user.id} (${req.user.username})`);
    
    const result = await pool.query(
      `SELECT b.*, m.question, m.options, m.status as market_status
       FROM bets b
       JOIN markets m ON b.market_id = m.id
       WHERE b.user_id = $1
       ORDER BY b.created_at DESC`,
      [req.user.id]
    );
    
    res.json({ 
      bets: result.rows,
      username: req.user.username
    });
  } catch (error) {
    console.error('❌ Error fetching bets:', error);
    res.status(500).json({ error: 'Failed to fetch bets' });
  }
});

// Place bet
app.post('/api/bets', authenticate, async (req, res) => {
  try {
    const { market_id, position, amount } = req.body;
    
    if (!market_id || !position || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (amount <= 0) {
      return res.status(400).json({ error: 'Amount must be positive' });
    }
    
    // Check user balance
    const userResult = await pool.query(
      'SELECT balance FROM users WHERE id = $1',
      [req.user.id]
    );
    
    if (parseFloat(userResult.rows[0].balance) < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    // Check market exists and is active
    const marketResult = await pool.query(
      'SELECT * FROM markets WHERE id = $1 AND status = $2',
      [market_id, 'active']
    );
    
    if (marketResult.rows.length === 0) {
      return res.status(404).json({ error: 'Market not found or closed' });
    }
    
    // Create bet and update balance in transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Deduct from user balance
      await client.query(
        'UPDATE users SET balance = balance - $1 WHERE id = $2',
        [amount, req.user.id]
      );
      
      // Create bet
      const betResult = await client.query(
        'INSERT INTO bets (user_id, market_id, position, amount, odds) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [req.user.id, market_id, position, amount, 1.5] // Default odds
      );
      
      await client.query('COMMIT');
      
      console.log(`✅ Bet placed: ${req.user.username} - $${amount} on ${position}`);
      res.status(201).json({ bet: betResult.rows[0] });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ Error placing bet:', error);
    res.status(500).json({ error: 'Failed to place bet' });
  }
});

// ============================================================================
// LEADERBOARD ROUTE
// ============================================================================

app.get('/api/leaderboard', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id,
        username,
        balance,
        COALESCE((SELECT COUNT(*) FROM bets WHERE user_id = users.id), 0) as total_bets,
        created_at
      FROM users
      ORDER BY balance DESC
      LIMIT 10
    `);
    
    const leaderboard = result.rows.map(row => ({
      id: row.id,
      username: row.username,
      balance: parseFloat(row.balance),
      total_bets: parseInt(row.total_bets),
      created_at: row.created_at
    }));
    
    res.json({ leaderboard });
  } catch (error) {
    console.error('❌ Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// ============================================================================
// RESOLVER ROUTES (Protected with resolver token)
// ============================================================================

app.post('/api/resolve-with-ai', authenticateResolver, async (req, res) => {
  try {
    const { question, options } = req.body;
    
    // Try Anthropic first
    if (process.env.ANTHROPIC_API_KEY) {
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
            max_tokens: 100,
            messages: [{
              role: 'user',
              content: `You are a prediction market resolver. Given this question: "${question}", and these options: ${options.join(', ')}, determine which option is correct based on current facts. Respond with ONLY the exact option text, nothing else. If you cannot determine the outcome with certainty, respond with "Unresolved".`
            }]
          })
        });
        
        if (anthropicResponse.ok) {
          const data = await anthropicResponse.json();
          const outcome = data.content[0].text.trim();
          console.log('✅ Anthropic determined outcome:', outcome);
          return res.json({ outcome, provider: 'anthropic' });
        }
      } catch (error) {
        console.error('❌ Anthropic resolution failed:', error.message);
      }
    }
    
    // Try OpenAI as fallback
    if (process.env.OPENAI_API_KEY) {
      try {
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: 'gpt-4',
            messages: [{
              role: 'system',
              content: 'You are a prediction market resolver. Determine the correct outcome based on current facts. Respond with ONLY the exact option text. If uncertain, respond with "Unresolved".'
            }, {
              role: 'user',
              content: `Question: "${question}"\nOptions: ${options.join(', ')}`
            }],
            max_tokens: 50
          })
        });
        
        if (openaiResponse.ok) {
          const data = await openaiResponse.json();
          const outcome = data.choices[0].message.content.trim();
          console.log('✅ OpenAI determined outcome:', outcome);
          return res.json({ outcome, provider: 'openai' });
        }
      } catch (error) {
        console.error('❌ OpenAI resolution failed:', error.message);
      }
    }
    
    res.status(503).json({ error: 'AI resolution unavailable', outcome: 'Unresolved' });
  } catch (error) {
    console.error('❌ Resolution error:', error);
    res.status(500).json({ error: 'Resolution failed' });
  }
});

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 Binary Bets API Server');
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📊 Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
  console.log(`🤖 OpenAI: ${process.env.OPENAI_API_KEY ? 'Configured' : 'Not configured'}`);
  console.log(`🤖 Anthropic: ${process.env.ANTHROPIC_API_KEY ? 'Configured' : 'Not configured'}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('⏳ SIGTERM received, shutting down gracefully...');
  await pool.end();
  process.exit(0);
});
