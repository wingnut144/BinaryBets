import express from 'express';
import { calculateOdds } from '../services/oddsCalculator.js';
import { verifyMarket } from '../services/verificationService.js';
import { sendWinnerEmail } from '../services/emailService.js';

const router = express.Router();

export default function marketRoutes(pool) {
  // Get all active markets
  router.get('/', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT 
          m.*,
          c.name as category_name,
          COUNT(DISTINCT b.id) as total_bets,
          COUNT(DISTINCT CASE WHEN b.choice = 'yes' THEN b.id END) as yes_bets,
          COUNT(DISTINCT CASE WHEN b.choice = 'no' THEN b.id END) as no_bets
        FROM markets m
        LEFT JOIN categories c ON m.category_id = c.id
        LEFT JOIN bets b ON m.id = b.market_id AND b.status = 'pending'
        WHERE m.deadline > NOW() AND m.resolved = FALSE
        GROUP BY m.id, c.name
        ORDER BY m.created_at DESC
      `);
      
      const markets = result.rows;
      
      for (let market of markets) {
        if (market.market_type === 'multi-choice') {
          const optionsResult = await pool.query(`
            SELECT 
              mo.*,
              COUNT(DISTINCT b.id) as bet_count
            FROM market_options mo
            LEFT JOIN bets b ON mo.id = b.market_option_id AND b.status = 'pending'
            WHERE mo.market_id = $1
            GROUP BY mo.id
            ORDER BY mo.option_order
          `, [market.id]);
          
          market.options = optionsResult.rows;
        }
      }
      
      res.json(markets);
    } catch (error) {
      console.error('Markets fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch markets' });
    }
  });

  // Create market
  router.post('/', async (req, res) => {
    try {
      const { question, categoryId, marketType, yesOdds, noOdds, deadline, options } = req.body;
      
      const result = await pool.query(
        'INSERT INTO markets (question, category_id, market_type, yes_odds, no_odds, deadline) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [question, categoryId, marketType, yesOdds || null, noOdds || null, deadline]
      );
      
      const market = result.rows[0];
      
      if (marketType === 'multi-choice' && options) {
        for (let i = 0; i < options.length; i++) {
          await pool.query(
            'INSERT INTO market_options (market_id, option_text, odds, option_order) VALUES ($1, $2, $3, $4)',
            [market.id, options[i].text, options[i].odds, options[i].order || i + 1]
          );
        }
      }
      
      res.json(market);
    } catch (error) {
      console.error('Create market error:', error);
      res.status(500).json({ error: 'Failed to create market' });
    }
  });

  // Get expired markets (admin only)
  router.get('/expired', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT m.*, c.name as category_name
        FROM markets m
        LEFT JOIN categories c ON m.category_id = c.id
        WHERE m.deadline < NOW() AND m.resolved = FALSE
        ORDER BY m.deadline DESC
      `);
      
      const markets = result.rows;
      
      for (let market of markets) {
        if (market.market_type === 'multi-choice') {
          const optionsResult = await pool.query(
            'SELECT * FROM market_options WHERE market_id = $1 ORDER BY option_order',
            [market.id]
          );
          market.options = optionsResult.rows;
        }
      }
      
      res.json(markets);
    } catch (error) {
      console.error('Fetch expired markets error:', error);
      res.status(500).json({ error: 'Failed to fetch expired markets' });
    }
  });

  // Verify market (get verification data)
  router.get('/:marketId/verify', async (req, res) => {
    try {
      const { marketId } = req.params;
      const verificationResult = await verifyMarket(pool, marketId);
      res.json(verificationResult);
    } catch (error) {
      console.error('Verification error:', error);
      res.status(500).json({ error: 'Verification failed', details: error.message });
    }
  });

  // Resolve market (admin only)
  router.post('/:marketId/resolve', async (req, res) => {
    try {
      const { marketId } = req.params;
      const { winningOptionId } = req.body;
      
      const client = await pool.connect();
      
      try {
        await client.query('BEGIN');
        
        const marketResult = await client.query(
          'SELECT * FROM markets WHERE id = $1',
          [marketId]
        );
        
        if (marketResult.rows.length === 0) {
          throw new Error('Market not found');
        }
        
        const market = marketResult.rows[0];
        
        let winningBets;
        if (market.market_type === 'binary') {
          winningBets = await client.query(
            'SELECT * FROM bets WHERE market_id = $1 AND choice = $2 AND status = $3',
            [marketId, winningOptionId, 'pending']
          );
        } else {
          winningBets = await client.query(
            'SELECT * FROM bets WHERE market_id = $1 AND market_option_id = $2 AND status = $3',
            [marketId, winningOptionId, 'pending']
          );
        }
        
        let totalPayout = 0;
        
        for (const bet of winningBets.rows) {
          const payout = parseFloat(bet.potential_win);
          totalPayout += payout;
          
          await client.query(
            'UPDATE bets SET status = $1 WHERE id = $2',
            ['won', bet.id]
          );
          
          await client.query(
            'UPDATE users SET balance = balance + $1, total_winnings = total_winnings + $2, bets_won = bets_won + 1 WHERE id = $3',
            [payout, payout - parseFloat(bet.amount), bet.user_id]
          );
          
          // Get updated user details
          const userResult = await client.query('SELECT * FROM users WHERE id = $1', [bet.user_id]);
          const user = userResult.rows[0];
          
          // Send winner email (async, don't wait)
          sendWinnerEmail(user, bet, market, payout).catch(err => 
            console.error('Failed to send winner email:', err)
          );
        }
        
        const losingBets = await client.query(
          market.market_type === 'binary'
            ? 'UPDATE bets SET status = $1 WHERE market_id = $2 AND choice != $3 AND status = $4 RETURNING id'
            : 'UPDATE bets SET status = $1 WHERE market_id = $2 AND market_option_id != $3 AND status = $4 RETURNING id',
          ['lost', marketId, winningOptionId, 'pending']
        );
        
        await client.query(
          'UPDATE markets SET resolved = TRUE, winning_option_id = $1 WHERE id = $2',
          [winningOptionId, marketId]
        );
        
        await client.query('COMMIT');
        
        res.json({
          success: true,
          winnersCount: winningBets.rows.length,
          losersCount: losingBets.rows.length,
          totalPayout: totalPayout.toFixed(2)
        });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Resolve market error:', error);
      res.status(500).json({ error: 'Failed to resolve market' });
    }
  });

  // Calculate AI odds
  router.post('/calculate-odds', async (req, res) => {
    try {
      const { question, options } = req.body;
      
      if (!question) {
        return res.status(400).json({ error: 'Question is required' });
      }
      
      const odds = await calculateOdds(question, options);
      res.json({ odds });
    } catch (error) {
      console.error('Calculate odds error:', error);
      res.status(500).json({ error: 'Failed to calculate odds' });
    }
  });

  return router;
}
