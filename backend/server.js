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
        c.name as category_name,
        COUNT(DISTINCT b.id) as total_bets,
        COUNT(DISTINCT CASE WHEN b.choice = 'yes' THEN b.id END) as yes_bets,
        COUNT(DISTINCT CASE WHEN b.choice = 'no' THEN b.id END) as no_bets,
        COALESCE(SUM(CASE WHEN b.choice = 'yes' THEN b.amount ELSE 0 END), 0) as yes_amount,
        COALESCE(SUM(CASE WHEN b.choice = 'no' THEN b.amount ELSE 0 END), 0) as no_amount
      FROM markets m
      LEFT JOIN categories c ON m.category_id = c.id
      LEFT JOIN bets b ON m.id = b.market_id AND b.status = 'pending'
      WHERE m.deadline > NOW()
      GROUP BY m.id, c.name
      ORDER BY m.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Markets fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch markets' });
  }
});

// Get market statistics
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

// Create market (admin only)
app.post('/api/markets', async (req, res) => {
  const { question, yesOdds, noOdds, categoryId, deadline, userId } = req.body;
  
  try {
    // Check if user is admin
    const userCheck = await pool.query('SELECT is_admin FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0 || !userCheck.rows[0].is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const result = await pool.query(
      'INSERT INTO markets (question, yes_odds, no_odds, category_id, deadline) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [question, yesOdds, noOdds, categoryId, deadline]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Market creation error:', err);
    res.status(500).json({ error: 'Failed to create market' });
  }
});

// ============ BET ENDPOINTS ============

// Place a bet
app.post('/api/bets', async (req, res) => {
  const { userId, marketId, choice, amount, odds, potentialWin } = req.body;
  
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
      // Calculate penalty: 10% of new bet amount or $5, whichever is less
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

    // Create bet
    await client.query(
      'INSERT INTO bets (user_id, market_id, choice, amount, odds, potential_win) VALUES ($1, $2, $3, $4, $5, $6)',
      [userId, marketId, choice, amount, odds, potentialWin]
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
        c.name as category
      FROM bets b
      JOIN markets m ON b.market_id = m.id
      LEFT JOIN categories c ON m.category_id = c.id
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

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
