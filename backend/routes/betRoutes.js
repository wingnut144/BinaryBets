import express from 'express';

const router = express.Router();

export default function betRoutes(pool) {
  // Place bet
  router.post('/', async (req, res) => {
    try {
      const { userId, marketId, choice, marketOptionId, amount, odds, potentialWin } = req.body;
      
      const userResult = await pool.query('SELECT balance FROM users WHERE id = $1', [userId]);
      if (parseFloat(userResult.rows[0].balance) < parseFloat(amount)) {
        return res.status(400).json({ error: 'Insufficient balance' });
      }
      
      const existingBet = await pool.query(
        'SELECT * FROM bets WHERE user_id = $1 AND market_id = $2 AND status = $3',
        [userId, marketId, 'pending']
      );
      
      if (existingBet.rows.length > 0) {
        return res.status(400).json({ error: 'You already have a bet on this market' });
      }
      
      await pool.query(
        'UPDATE users SET balance = balance - $1 WHERE id = $2',
        [amount, userId]
      );
      
      await pool.query(
        'INSERT INTO bets (user_id, market_id, choice, market_option_id, amount, odds, potential_win, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [userId, marketId, choice, marketOptionId, amount, odds, potentialWin, 'pending']
      );
      
      res.json({ success: true });
    } catch (error) {
      console.error('Place bet error:', error);
      res.status(500).json({ error: 'Failed to place bet' });
    }
  });

  // Cancel bet
  router.post('/:betId/cancel', async (req, res) => {
    try {
      const { betId } = req.params;
      const { userId } = req.body;
      
      const betResult = await pool.query(
        'SELECT * FROM bets WHERE id = $1 AND user_id = $2 AND status = $3',
        [betId, userId, 'pending']
      );
      
      if (betResult.rows.length === 0) {
        return res.status(404).json({ error: 'Bet not found or already cancelled' });
      }
      
      const bet = betResult.rows[0];
      const refundAmount = parseFloat(bet.amount) * 0.95;
      
      await pool.query(
        'UPDATE bets SET status = $1, cancelled_at = NOW() WHERE id = $2',
        ['cancelled', betId]
      );
      
      await pool.query(
        'UPDATE users SET balance = balance + $1 WHERE id = $2',
        [refundAmount, userId]
      );
      
      const userResult = await pool.query('SELECT balance FROM users WHERE id = $1', [userId]);
      
      res.json({ success: true, newBalance: userResult.rows[0].balance });
    } catch (error) {
      console.error('Cancel bet error:', error);
      res.status(500).json({ error: 'Failed to cancel bet' });
    }
  });

  return router;
}
