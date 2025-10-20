import express from 'express';

const router = express.Router();

export default function userRoutes(pool) {
  // Get user bets
  router.get('/users/:userId/bets', async (req, res) => {
    try {
      const { userId } = req.params;
      const result = await pool.query(`
        SELECT 
          b.*,
          m.question as market_question,
          mo.option_text as option_name
        FROM bets b
        JOIN markets m ON b.market_id = m.id
        LEFT JOIN market_options mo ON b.market_option_id = mo.id
        WHERE b.user_id = $1
        ORDER BY b.created_at DESC
      `, [userId]);
      
      res.json(result.rows);
    } catch (error) {
      console.error('Fetch user bets error:', error);
      res.status(500).json({ error: 'Failed to fetch user bets' });
    }
  });

  // Get user stats
  router.get('/users/:userId/stats', async (req, res) => {
    try {
      const { userId } = req.params;
      const result = await pool.query(
        'SELECT balance, total_winnings, bets_won FROM users WHERE id = $1',
        [userId]
      );
      
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Fetch user stats error:', error);
      res.status(500).json({ error: 'Failed to fetch user stats' });
    }
  });

  // Update user profile
  router.put('/users/:userId/profile', async (req, res) => {
    try {
      const { userId } = req.params;
      const { avatar, email } = req.body;
      
      let query, params;
      if (avatar) {
        query = 'UPDATE users SET avatar = $1 WHERE id = $2 RETURNING *';
        params = [avatar, userId];
      } else if (email) {
        query = 'UPDATE users SET email = $1 WHERE id = $2 RETURNING *';
        params = [email, userId];
      }
      
      const result = await pool.query(query, params);
      res.json({ user: { ...result.rows[0], password: undefined } });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  });

  // Get leaderboard
  router.get('/leaderboard', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT id, username, name, email, avatar, balance, total_winnings, bets_won
        FROM users
        ORDER BY total_winnings DESC
        LIMIT 10
      `);
      
      res.json(result.rows);
    } catch (error) {
      console.error('Leaderboard error:', error);
      res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
  });

  // Get categories
  router.get('/categories', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM categories ORDER BY name');
      res.json(result.rows);
    } catch (error) {
      console.error('Categories fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch categories' });
    }
  });

  // Create category (admin only)
  router.post('/categories', async (req, res) => {
    try {
      const { name } = req.body;
      const result = await pool.query(
        'INSERT INTO categories (name) VALUES ($1) RETURNING *',
        [name]
      );
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Create category error:', error);
      res.status(500).json({ error: 'Failed to create category' });
    }
  });

  // Delete category (admin only)
  router.delete('/categories/:id', async (req, res) => {
    try {
      await pool.query('DELETE FROM categories WHERE id = $1', [req.params.id]);
      res.json({ success: true });
    } catch (error) {
      console.error('Delete category error:', error);
      res.status(500).json({ error: 'Failed to delete category' });
    }
  });

  return router;
}
