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

// ============ AUTH ENDPOINTS ============

// Register
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;
  
  try {
    const existingUser = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const result = await pool.query(
      'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email, is_admin, balance, total_winnings, bets_won, avatar',
      [name, email, password]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const result = await pool.query(
      'SELECT id, name, email, is_admin, balance, total_winnings, bets_won, avatar FROM users WHERE email = $1 AND password = $2',
      [email, password]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ============ USER PROFILE ENDPOINTS ============

// Update user profile
app.put('/api/users/:userId/profile', async (req, res) => {
  const { userId } = req.params;
  const { email, avatar } = req.body;
  
  try {
    // Check if email is already taken by another user
    if (email) {
      const existingUser = await pool.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, userId]
      );
      if (existingUser.rows.length > 0) {
        return res.status(400).json({ error: 'Email already taken' });
      }
    }

    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (email) {
      updates.push(`email = $${paramCount++}`);
      values.push(email);
    }
    if (avatar !== undefined) {
      updates.push(`avatar = $${paramCount++}`);
      values.push(avatar);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    values.push(userId);
    const query = `
      UPDATE users 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, name, email, is_admin, balance, total_winnings, bets_won, avatar
    `;

    const result = await pool.query(query, values);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Get user balance
app.get('/api/users/:userId/balance', async (req, res) => {
  const { userId } = req.params;
  
  try {
    const result = await pool.query('SELECT balance FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ balance: result.rows[0].balance });
  } catch (err) {
    console.error('Balance fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

// ============ CATEGORY ENDPOINTS ============

// Get all categories
app.get('/api/categories', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categories ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    console.error('Categories fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Create category (admin only)
app.post('/api/categories', async (req, res) => {
  const { name, userId } = req.body;
  
  try {
    // Check if user is admin
    const userCheck = await pool.query('SELECT is_admin FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0 || !userCheck.rows[0].is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const result = await pool.query(
      'INSERT INTO categories (name) VALUES ($1) RETURNING *',
      [name]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Category creation error:', err);
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Category already exists' });
    }
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// Delete category (admin only)
app.delete('/api/categories/:id', async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  
  try {
    // Check if user is admin
    const userCheck = await pool.query('SELECT is_admin FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0 || !userCheck.rows[0].is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Check if category is in use
    const inUse = await pool.query('SELECT COUNT(*) FROM markets WHERE category_id = $1', [id]);
    if (parseInt(inUse.rows[0].count) > 0) {
      return res.status(400).json({ error: 'Cannot delete category with active markets' });
    }

    await pool.query('DELETE FROM categories WHERE id = $1', [id]);
    res.json({ message: 'Category deleted successfully' });
  } catch (err) {
    console.error('Category deletion error:', err);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

// ============ MARKET ENDPOINTS ============

// Get all markets with betting statistics
app.get('/api/markets', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        m.*,
        c.name as category_name
      FROM markets m
      LEFT JOIN categories c ON m.category_id = c.id
      WHERE m.deadline > NOW() AND m.resolved = FALSE
      ORDER BY m.created_at DESC
    `);
    
    // For each market, get options if it's multi-choice, or stats if it's binary
    const marketsWithDetails = await Promise.all(result.rows.map(async (market) => {
      if (market.market_type === 'multi-choice') {
        // Get options for multi-choice markets
        const optionsResult = await pool.query(`
          SELECT 
            mo.*,
            COUNT(DISTINCT b.id) as total_bets,
            COALESCE(SUM(b.amount), 0) as total_amount
          FROM market_options mo
          LEFT JOIN bets b ON mo.id = b.market_option_id AND b.status = 'pending'
          WHERE mo.market_id = $1
          GROUP BY mo.id
          ORDER BY mo.option_order
        `, [market.id]);
        
        return {
          ...market,
          options: optionsResult.rows
        };
      } else {
        // Get binary betting stats
        const statsResult = await pool.query(`
          SELECT 
            COUNT(DISTINCT b.id) as total_bets,
            COUNT(DISTINCT CASE WHEN b.choice = 'yes' THEN b.id END) as yes_bets,
            COUNT(DISTINCT CASE WHEN b.choice = 'no' THEN b.id END) as no_bets,
            COALESCE(SUM(CASE WHEN b.choice = 'yes' THEN b.amount ELSE 0 END), 0) as yes_amount,
            COALESCE(SUM(CASE WHEN b.choice = 'no' THEN b.amount ELSE 0 END), 0) as no_amount
          FROM bets b
          WHERE b.market_id = $1 AND b.status = 'pending'
        `, [market.id]);
        
        return {
          ...market,
          stats: statsResult.rows[0]
        };
      }
    }));
    
    res.json(marketsWithDetails);
  } catch (err) {
    console.error('Markets fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch markets' });
  }
});

// Get market statistics (for binary markets)
app.get('/api/markets/:marketId/stats', async (req, res) => {
  const { marketId } = req.params;
  
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(DISTINCT b.id) as total_bets,
        COUNT(DISTINCT CASE WHEN b.choice = 'yes' THEN b.id END) as yes_bets,
        COUNT(DISTINCT CASE WHEN b.choice = 'no' THEN b.id END) as no_bets,
        COALESCE(SUM(CASE WHEN b.choice = 'yes' THEN b.amount ELSE 0 END), 0) as yes_amount,
        COALESCE(SUM(CASE WHEN b.choice = 'no' THEN b.amount ELSE 0 END), 0) as no_amount
      FROM bets b
      WHERE b.market_id = $1 AND b.status = 'pending'
    `, [marketId]);
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Market stats fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch market stats' });
  }
});

// Create market (admin only) - supports both binary and multi-choice
app.post('/api/markets', async (req, res) => {
  const { question, marketType, yesOdds, noOdds, categoryId, deadline, options, userId } = req.body;
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Check if user is admin
    const userCheck = await client.query('SELECT is_admin FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0 || !userCheck.rows[0].is_admin) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Admin access required' });
    }

    if (marketType === 'binary') {
      // Create binary market
      const result = await client.query(
        'INSERT INTO markets (question, market_type, yes_odds, no_odds, category_id, deadline) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [question, 'binary', yesOdds, noOdds, categoryId, deadline]
      );
      await client.query('COMMIT');
      res.json(result.rows[0]);
    } else if (marketType === 'multi-choice') {
      // Create multi-choice market
      const marketResult = await client.query(
        'INSERT INTO markets (question, market_type, category_id, deadline) VALUES ($1, $2, $3, $4) RETURNING *',
        [question, 'multi-choice', categoryId, deadline]
      );
      
      const marketId = marketResult.rows[0].id;
      
      // Insert options
      for (let i = 0; i < options.length; i++) {
        await client.query(
          'INSERT INTO market_options (market_id, option_text, odds, option_order) VALUES ($1, $2, $3, $4)',
          [marketId, options[i].text, options[i].odds, i + 1]
        );
      }
      
      await client.query('COMMIT');
      res.json(marketResult.rows[0]);
    } else {
      await client.query('ROLLBACK');
      res.status(400).json({ error: 'Invalid market type' });
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Market creation error:', err);
    res.status(500).json({ error: 'Failed to create market' });
  } finally {
    client.release();
  }
});

// ============ BET ENDPOINTS ============

// Place a bet (supports both binary and multi-choice)
app.post('/api/bets', async (req, res) => {
  const { userId, marketId, choice, marketOptionId, amount, odds, potentialWin } = req.body;
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Check if user already has an active bet on this market
    const existingBet = await client.query(
      'SELECT id FROM bets WHERE user_id = $1 AND market_id = $2 AND status = $3',
      [userId, marketId, 'pending']
    );

    if (existingBet.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'You already have an active bet on this market' });
    }

    // Check for recent cancellation (within 5 minutes)
    const recentCancellation = await client.query(
      `SELECT id, amount, cancelled_at 
       FROM bets 
       WHERE user_id = $1 AND market_id = $2 AND status = 'cancelled' 
       AND cancelled_at > NOW() - INTERVAL '5 minutes'
       ORDER BY cancelled_at DESC
       LIMIT 1`,
      [userId, marketId]
    );

    let penaltyFee = 0;
    if (recentCancellation.rows.length > 0) {
      penaltyFee = Math.min(amount * 0.10, 5);
    }

    const totalCost = amount + penaltyFee;

    // Check user balance
    const userBalance = await client.query('SELECT balance FROM users WHERE id = $1', [userId]);
    if (userBalance.rows[0].balance < totalCost) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: `Insufficient balance. You need $${totalCost.toFixed(2)} (includes $${penaltyFee.toFixed(2)} penalty fee for rebetting within 5 minutes)` 
      });
    }

    // Deduct from user balance
    await client.query(
      'UPDATE users SET balance = balance - $1 WHERE id = $2',
      [totalCost, userId]
    );

    // Create bet (supports both binary and multi-choice)
    await client.query(
      'INSERT INTO bets (user_id, market_id, choice, market_option_id, amount, odds, potential_win) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [userId, marketId, choice || null, marketOptionId || null, amount, odds, potentialWin]
    );

    await client.query('COMMIT');
    
    let message = 'Bet placed successfully';
    if (penaltyFee > 0) {
      message += `. A penalty fee of $${penaltyFee.toFixed(2)} was charged for rebetting within 5 minutes.`;
    }
    
    res.json({ message });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Bet placement error:', err);
    res.status(500).json({ error: 'Failed to place bet' });
  } finally {
    client.release();
  }
});

// Cancel a bet
app.post('/api/bets/:betId/cancel', async (req, res) => {
  const { betId } = req.params;
  const { userId } = req.body;
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Get bet details
    const bet = await client.query(
      'SELECT * FROM bets WHERE id = $1 AND user_id = $2 AND status = $3',
      [betId, userId, 'pending']
    );

    if (bet.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Bet not found or already processed' });
    }

    const betAmount = bet.rows[0].amount;

    // Mark bet as cancelled
    await client.query(
      'UPDATE bets SET status = $1, cancelled_at = NOW() WHERE id = $2',
      ['cancelled', betId]
    );

    // Refund user
    await client.query(
      'UPDATE users SET balance = balance + $1 WHERE id = $2',
      [betAmount, userId]
    );

    await client.query('COMMIT');
    res.json({ 
      message: `Bet cancelled successfully. $${betAmount.toFixed(2)} refunded to your account.`,
      refundAmount: betAmount
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Bet cancellation error:', err);
    res.status(500).json({ error: 'Failed to cancel bet' });
  } finally {
    client.release();
  }
});

// Get user's bets
app.get('/api/users/:userId/bets', async (req, res) => {
  const { userId } = req.params;
  
  try {
    const result = await pool.query(`
      SELECT 
        b.*,
        m.question as market,
        m.deadline,
        c.name as category,
        mo.option_text as option_name
      FROM bets b
      JOIN markets m ON b.market_id = m.id
      LEFT JOIN categories c ON m.category_id = c.id
      LEFT JOIN market_options mo ON b.market_option_id = mo.id
      WHERE b.user_id = $1
      ORDER BY b.created_at DESC
    `, [userId]);
    res.json(result.rows);
  } catch (err) {
    console.error('User bets fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch bets' });
  }
});

// ============ USER STATS ENDPOINTS ============

// Get user statistics
app.get('/api/users/:userId/stats', async (req, res) => {
  const { userId } = req.params;
  
  try {
    // Get user's personal stats
    const userStats = await pool.query(`
      SELECT 
        COUNT(*) as total_bets,
        SUM(amount) as total_wagered,
        COUNT(CASE WHEN status = 'won' THEN 1 END) as wins,
        COUNT(CASE WHEN status = 'lost' THEN 1 END) as losses,
        SUM(CASE WHEN status = 'won' THEN potential_win ELSE 0 END) as total_winnings
      FROM bets
      WHERE user_id = $1
    `, [userId]);

    // Get favorite category
    const favoriteCategory = await pool.query(`
      SELECT c.name, COUNT(*) as bet_count
      FROM bets b
      JOIN markets m ON b.market_id = m.id
      LEFT JOIN categories c ON m.category_id = c.id
      WHERE b.user_id = $1
      GROUP BY c.name
      ORDER BY bet_count DESC
      LIMIT 1
    `, [userId]);

    // Get comparison with other users
    const avgStats = await pool.query(`
      SELECT 
        AVG(amount) as avg_bet_amount,
        COUNT(*) / NULLIF(COUNT(DISTINCT user_id), 0) as avg_bets_per_user
      FROM bets 
      WHERE user_id != $1
    `, [userId]);

    // Calculate win rate
    const stats = userStats.rows[0];
    const totalFinishedBets = parseInt(stats.wins) + parseInt(stats.losses);
    const winRate = totalFinishedBets > 0 ? (parseInt(stats.wins) / totalFinishedBets * 100).toFixed(1) : 0;

    res.json({
      totalBets: parseInt(stats.total_bets),
      totalWagered: parseFloat(stats.total_wagered || 0),
      winRate: parseFloat(winRate),
      totalWinnings: parseFloat(stats.total_winnings || 0),
      favoriteCategory: favoriteCategory.rows[0]?.name || 'None',
      avgBetAmount: parseFloat(avgStats.rows[0]?.avg_bet_amount || 0),
      avgBetsPerUser: parseFloat(avgStats.rows[0]?.avg_bets_per_user || 0)
    });
  } catch (err) {
    console.error('User stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Get leaderboard
app.get('/api/leaderboard', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.id,
        u.name,
        u.avatar,
        u.total_winnings,
        u.bets_won,
        u.balance
      FROM users u
      WHERE u.total_winnings > 0
      ORDER BY u.total_winnings DESC
      LIMIT 10
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Leaderboard fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// ============ MARKET RESOLUTION ENDPOINTS ============

// Get expired markets that need resolution (admin only)
app.get('/api/markets/expired', async (req, res) => {
  const { userId } = req.query;
  
  try {
    // Check if user is admin
    const userCheck = await pool.query('SELECT is_admin FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0 || !userCheck.rows[0].is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const result = await pool.query(`
      SELECT 
        m.*,
        c.name as category_name,
        COUNT(DISTINCT b.id) as total_bets
      FROM markets m
      LEFT JOIN categories c ON m.category_id = c.id
      LEFT JOIN bets b ON m.id = b.market_id AND b.status = 'pending'
      WHERE m.deadline <= NOW() AND m.resolved = FALSE
      GROUP BY m.id, c.name
      ORDER BY m.deadline DESC
    `);
    
    // Get options for multi-choice markets
    const marketsWithOptions = await Promise.all(result.rows.map(async (market) => {
      if (market.market_type === 'multi-choice') {
        const optionsResult = await pool.query(
          'SELECT * FROM market_options WHERE market_id = $1 ORDER BY option_order',
          [market.id]
        );
        return { ...market, options: optionsResult.rows };
      }
      return market;
    }));
    
    res.json(marketsWithOptions);
  } catch (err) {
    console.error('Expired markets fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch expired markets' });
  }
});

// Resolve a market manually (admin only)
app.post('/api/markets/:marketId/resolve', async (req, res) => {
  const { marketId } = req.params;
  const { userId, outcome, winningOptionId } = req.body;
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Check if user is admin
    const userCheck = await client.query('SELECT is_admin FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0 || !userCheck.rows[0].is_admin) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Get market details
    const marketResult = await client.query(
      'SELECT * FROM markets WHERE id = $1',
      [marketId]
    );
    
    if (marketResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Market not found' });
    }
    
    const market = marketResult.rows[0];

    if (market.market_type === 'binary') {
      // Resolve binary market
      const betsResult = await client.query(
        'SELECT * FROM bets WHERE market_id = $1 AND status = $2',
        [marketId, 'pending']
      );
      
      // Update bet status and pay out winners
      for (const bet of betsResult.rows) {
        if (bet.choice === outcome) {
          // Winner - update bet and pay out
          await client.query(
            'UPDATE bets SET status = $1 WHERE id = $2',
            ['won', bet.id]
          );
          
          await client.query(
            'UPDATE users SET balance = balance + $1, total_winnings = total_winnings + $2, bets_won = bets_won + 1 WHERE id = $3',
            [bet.potential_win, bet.potential_win - bet.amount, bet.user_id]
          );
        } else {
          // Loser
          await client.query(
            'UPDATE bets SET status = $1 WHERE id = $2',
            ['lost', bet.id]
          );
        }
      }
      
      // Mark market as resolved
      await client.query(
        'UPDATE markets SET resolved = TRUE WHERE id = $1',
        [marketId]
      );
      
    } else if (market.market_type === 'multi-choice') {
      // Resolve multi-choice market
      const betsResult = await client.query(
        'SELECT * FROM bets WHERE market_id = $1 AND status = $2',
        [marketId, 'pending']
      );
      
      // Update bet status and pay out winners
      for (const bet of betsResult.rows) {
        if (bet.market_option_id === winningOptionId) {
          // Winner
          await client.query(
            'UPDATE bets SET status = $1 WHERE id = $2',
            ['won', bet.id]
          );
          
          await client.query(
            'UPDATE users SET balance = balance + $1, total_winnings = total_winnings + $2, bets_won = bets_won + 1 WHERE id = $3',
            [bet.potential_win, bet.potential_win - bet.amount, bet.user_id]
          );
        } else {
          // Loser
          await client.query(
            'UPDATE bets SET status = $1 WHERE id = $2',
            ['lost', bet.id]
          );
        }
      }
      
      // Mark market as resolved
      await client.query(
        'UPDATE markets SET resolved = TRUE, winning_option_id = $1 WHERE id = $2',
        [winningOptionId, marketId]
      );
    }
    
    await client.query('COMMIT');
    res.json({ message: 'Market resolved successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Market resolution error:', err);
    res.status(500).json({ error: 'Failed to resolve market' });
  } finally {
    client.release();
  }
});

// Auto-verify market outcome using news API (admin trigger)
app.post('/api/markets/:marketId/auto-verify', async (req, res) => {
  const { marketId } = req.params;
  const { userId } = req.body;
  
  try {
    // Check if user is admin
    const userCheck = await pool.query('SELECT is_admin FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0 || !userCheck.rows[0].is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Get market details with options
    const marketResult = await pool.query(`
      SELECT m.*, mo.id as option_id, mo.option_text 
      FROM markets m 
      LEFT JOIN market_options mo ON m.id = mo.market_id 
      WHERE m.id = $1
      ORDER BY mo.option_order
    `, [marketId]);
    
    if (marketResult.rows.length === 0) {
      return res.status(404).json({ error: 'Market not found' });
    }
    
    const market = marketResult.rows[0];
    const options = marketResult.rows.map(r => ({
      id: r.option_id,
      text: r.option_text
    })).filter(opt => opt.id);
    
    // This is a placeholder for news API integration
    // To enable, add NEWS_API_KEY to your environment and install node-fetch
    const newsApiKey = process.env.NEWS_API_KEY;
    
    if (!newsApiKey) {
      return res.json({
        message: 'Auto-verification requires NewsAPI key',
        setup: 'Add NEWS_API_KEY to environment variables',
        searchQuery: market.question,
        options: options,
        instructions: `Search news for: "${market.question}" and check which location/option was mentioned most frequently`
      });
    }
    
    // Example implementation with NewsAPI:
    /*
    const fetch = (await import('node-fetch')).default;
    const searchResults = await Promise.all(options.map(async (option) => {
      const response = await fetch(
        `https://newsapi.org/v2/everything?q=${encodeURIComponent(market.question + ' ' + option.text)}&apiKey=${newsApiKey}&pageSize=10`
      );
      const data = await response.json();
      return {
        option: option.text,
        optionId: option.id,
        mentions: data.totalResults || 0
      };
    }));
    
    const suggested = searchResults.sort((a, b) => b.mentions - a.mentions)[0];
    
    return res.json({
      suggestion: suggested.option,
      suggestedOptionId: suggested.optionId,
      confidence: suggested.mentions,
      allResults: searchResults
    });
    */
    
    res.json({
      message: 'Auto-verification framework ready',
      instructions: 'Uncomment the code above and add node-fetch to package.json'
    });
    
  } catch (err) {
    console.error('Auto-verify error:', err);
    res.status(500).json({ error: 'Failed to auto-verify' });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
