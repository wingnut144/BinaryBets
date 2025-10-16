import express from 'express';
import cors from 'cors';
import pool from './db.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ============ AUTH ROUTES ============

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND password = $2',
      [email, password]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      isAdmin: user.is_admin,
      balance: parseFloat(user.balance),
      totalWinnings: parseFloat(user.total_winnings),
      betsWon: user.bets_won
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Sign up
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    const existing = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    
    const result = await pool.query(
      'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING *',
      [name, email, password]
    );
    
    const user = result.rows[0];
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      isAdmin: user.is_admin,
      balance: parseFloat(user.balance),
      totalWinnings: parseFloat(user.total_winnings),
      betsWon: user.bets_won
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ USER ROUTES ============

// Get user balance
app.get('/api/users/:userId/balance', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query('SELECT balance FROM users WHERE id = $1', [userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ balance: parseFloat(result.rows[0].balance) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ MARKET ROUTES ============

// Get all markets (with optional category filter)
app.get('/api/markets', async (req, res) => {
  try {
    const { category_id } = req.query;
    
    let query = `
      SELECT m.*, c.name as category_name 
      FROM markets m 
      LEFT JOIN categories c ON m.category_id = c.id 
      WHERE m.status = $1
    `;
    const params = ['active'];
    
    if (category_id) {
      query += ' AND m.category_id = $2';
      params.push(category_id);
    }
    
    query += ' ORDER BY m.id';
    
    const result = await pool.query(query, params);
    res.json(result.rows.map(m => ({
      id: m.id,
      question: m.question,
      category: m.category_name || 'Other',
      categoryId: m.category_id,
      yesOdds: parseFloat(m.yes_odds),
      noOdds: parseFloat(m.no_odds),
      deadline: m.deadline,
      status: m.status
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get market statistics (how others are betting)
app.get('/api/markets/:marketId/stats', async (req, res) => {
  try {
    const { marketId } = req.params;
    
    const result = await pool.query(
      `SELECT 
        choice,
        COUNT(*) as bet_count,
        SUM(amount) as total_amount,
        AVG(amount) as avg_amount
      FROM bets 
      WHERE market_id = $1 AND status = 'pending'
      GROUP BY choice`,
      [marketId]
    );
    
    const stats = {
      yes: { count: 0, total: 0, avg: 0 },
      no: { count: 0, total: 0, avg: 0 }
    };
    
    result.rows.forEach(row => {
      stats[row.choice] = {
        count: parseInt(row.bet_count),
        total: parseFloat(row.total_amount),
        avg: parseFloat(row.avg_amount)
      };
    });
    
    const totalBets = stats.yes.count + stats.no.count;
    stats.yesPercentage = totalBets > 0 ? (stats.yes.count / totalBets * 100).toFixed(1) : 0;
    stats.noPercentage = totalBets > 0 ? (stats.no.count / totalBets * 100).toFixed(1) : 0;
    
    res.json(stats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create market (admin only)
app.post('/api/markets', async (req, res) => {
  try {
    const { question, categoryId, yesOdds, noOdds, deadline } = req.body;
    
    const result = await pool.query(
      'INSERT INTO markets (question, category_id, yes_odds, no_odds, deadline) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [question, categoryId, yesOdds, noOdds, deadline]
    );
    
    const market = result.rows[0];
    
    // Get category name
    const categoryResult = await pool.query('SELECT name FROM categories WHERE id = $1', [market.category_id]);
    
    res.json({
      id: market.id,
      question: market.question,
      category: categoryResult.rows[0]?.name || 'Other',
      categoryId: market.category_id,
      yesOdds: parseFloat(market.yes_odds),
      noOdds: parseFloat(market.no_odds),
      deadline: market.deadline,
      status: market.status
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ CATEGORY ROUTES (Admin Only) ============

// Get all categories
app.get('/api/categories', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categories ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create category (admin only)
app.post('/api/categories', async (req, res) => {
  try {
    const { name } = req.body;
    
    const result = await pool.query(
      'INSERT INTO categories (name) VALUES ($1) RETURNING *',
      [name]
    );
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === '23505') { // Unique violation
      res.status(400).json({ error: 'Category already exists' });
    } else {
      res.status(500).json({ error: 'Server error' });
    }
  }
});

// Delete category (admin only)
app.delete('/api/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM categories WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ BET ROUTES ============

// Get user's bets
app.get('/api/users/:userId/bets', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query(
      `SELECT b.*, m.question as market_question 
       FROM bets b 
       JOIN markets m ON b.market_id = m.id 
       WHERE b.user_id = $1 
       ORDER BY b.created_at DESC`,
      [userId]
    );
    
    res.json(result.rows.map(b => ({
      id: b.id,
      market: b.market_question,
      marketId: b.market_id,
      choice: b.choice,
      amount: parseFloat(b.amount),
      odds: parseFloat(b.odds),
      potentialWin: parseFloat(b.potential_win),
      status: b.status,
      createdAt: b.created_at
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user bet statistics
app.get('/api/users/:userId/stats', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Get user's total bets and amount wagered
    const userStats = await pool.query(
      `SELECT 
        COUNT(*) as total_bets,
        SUM(amount) as total_wagered,
        SUM(CASE WHEN status = 'won' THEN potential_win ELSE 0 END) as total_won,
        SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) as bets_won
      FROM bets 
      WHERE user_id = $1`,
      [userId]
    );
    
    // Get comparison with other users
    const avgStats = await pool.query(
      `SELECT 
        AVG(amount) as avg_bet_amount,
        COUNT(*) / COUNT(DISTINCT user_id) as avg_bets_per_user
      FROM bets 
      WHERE user_id != $1`,
      [userId]
    );
    
    // Get user's favorite categories
    const categoryStats = await pool.query(
      `SELECT 
        c.name as category,
        COUNT(*) as bet_count
      FROM bets b
      JOIN markets m ON b.market_id = m.id
      LEFT JOIN categories c ON m.category_id = c.id
      WHERE b.user_id = $1
      GROUP BY c.name
      ORDER BY bet_count DESC
      LIMIT 3`,
      [userId]
    );
    
    res.json({
      totalBets: parseInt(userStats.rows[0].total_bets) || 0,
      totalWagered: parseFloat(userStats.rows[0].total_wagered) || 0,
      totalWon: parseFloat(userStats.rows[0].total_won) || 0,
      betsWon: parseInt(userStats.rows[0].bets_won) || 0,
      winRate: userStats.rows[0].total_bets > 0 
        ? ((userStats.rows[0].bets_won / userStats.rows[0].total_bets) * 100).toFixed(1) 
        : 0,
      avgBetAmount: avgStats.rows[0]?.avg_bet_amount || 0,
      avgBetsPerUser: parseFloat(avgStats.rows[0]?.avg_bets_per_user) || 0,
      favoriteCategories: categoryStats.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Place a bet
app.post('/api/bets', async (req, res) => {
  try {
    const { userId, marketId, choice, amount, odds, potentialWin } = req.body;
    
    // Check user balance
    const userResult = await pool.query('SELECT balance FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const balance = parseFloat(userResult.rows[0].balance);
    if (balance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    // Start transaction
    await pool.query('BEGIN');
    
    // Deduct balance
    await pool.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [amount, userId]);
    
    // Create bet
    const betResult = await pool.query(
      'INSERT INTO bets (user_id, market_id, choice, amount, odds, potential_win) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [userId, marketId, choice, amount, odds, potentialWin]
    );
    
    await pool.query('COMMIT');
    
    const bet = betResult.rows[0];
    res.json({
      id: bet.id,
      userId: bet.user_id,
      marketId: bet.market_id,
      choice: bet.choice,
      amount: parseFloat(bet.amount),
      odds: parseFloat(bet.odds),
      potentialWin: parseFloat(bet.potential_win),
      status: bet.status
    });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ LEADERBOARD ROUTES ============

// Get leaderboard
app.get('/api/leaderboard', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, total_winnings, bets_won FROM users WHERE total_winnings > 0 ORDER BY total_winnings DESC LIMIT 20'
    );
    
    res.json(result.rows.map(u => ({
      id: u.id,
      name: u.name,
      winnings: parseFloat(u.total_winnings),
      betsWon: u.bets_won
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

/* ============ AI-POWERED ODDS CALCULATION ============
 * 
 * To implement AI-driven odds based on news and data:
 * 
 * 1. News API Integration:
 *    - Use services like NewsAPI.org, Google News API, or Bing News API
 *    - Fetch recent news articles related to the market question
 * 
 * 2. Sentiment Analysis:
 *    - Use OpenAI GPT-4, Anthropic Claude, or Google Gemini API
 *    - Analyze news sentiment to gauge market direction
 * 
 * 3. Odds Calculation:
 *    app.post('/api/markets/calculate-odds', async (req, res) => {
 *      const { question } = req.body;
 *      
 *      // Fetch news
 *      const newsResponse = await fetch(
 *        `https://newsapi.org/v2/everything?q=${encodeURIComponent(question)}&apiKey=YOUR_KEY`
 *      );
 *      const news = await newsResponse.json();
 *      
 *      // Analyze with AI
 *      const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
 *        method: 'POST',
 *        headers: {
 *          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
 *          'Content-Type': 'application/json'
 *        },
 *        body: JSON.stringify({
 *          model: 'gpt-4',
 *          messages: [{
 *            role: 'system',
 *            content: 'You are a betting odds calculator. Analyze news and return probability as a number between 0-100.'
 *          }, {
 *            role: 'user',
 *            content: `Based on these news articles, what's the probability of: "${question}"?\n\nNews: ${JSON.stringify(news.articles.slice(0, 10))}`
 *          }]
 *        })
 *      });
 *      
 *      const aiResult = await aiResponse.json();
 *      const probability = parseFloat(aiResult.choices[0].message.content);
 *      
 *      // Calculate odds (probability to decimal odds)
 *      const yesOdds = (100 / probability).toFixed(2);
 *      const noOdds = (100 / (100 - probability)).toFixed(2);
 *      
 *      res.json({ yesOdds, noOdds, probability });
 *    });
 * 
 * 4. Required Environment Variables:
 *    - OPENAI_API_KEY or ANTHROPIC_API_KEY
 *    - NEWS_API_KEY
 * 
 * 5. Cost Considerations:
 *    - OpenAI GPT-4: ~$0.03 per request
 *    - NewsAPI: Free tier available
 *    - Cache results to minimize API calls
 */
