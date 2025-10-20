import express from 'express';
import cors from 'cors';
import pkg from 'pg';
import fetch from 'node-fetch';

const { Pool } = pkg;

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  user: process.env.POSTGRES_USER || 'binaryuser',
  host: process.env.POSTGRES_HOST || 'postgres',
  database: process.env.POSTGRES_DB || 'binarybets',
  password: process.env.POSTGRES_PASSWORD || 'binarypass',
  port: 5432,
});

const NEWS_API_KEY = process.env.NEWS_API_KEY || 'YOUR_NEWS_API_KEY_HERE';
const NASA_API_KEY = process.env.NASA_API_KEY || 'DEMO_KEY';

// AI Odds Calculator
async function calculateOdds(question, options = null) {
  try {
    // Search for recent information about the topic
    const searchQuery = question.replace(/\?$/, '').toLowerCase();
    const newsData = await searchNews(searchQuery, new Date().toISOString().split('T')[0]);
    
    if (options) {
      // Multi-choice odds calculation
      const scores = analyzeNewsForOptions(newsData.articles, options.map(opt => ({ option_text: opt })));
      const totalScore = Object.values(scores).reduce((a, b) => a + b, 0) || options.length;
      
      // Convert scores to probabilities
      const probabilities = {};
      options.forEach(option => {
        const score = scores[option] || 1;
        probabilities[option] = score / totalScore;
      });
      
      // Convert probabilities to odds (with minimum 1.1x)
      const calculatedOdds = {};
      options.forEach(option => {
        const prob = probabilities[option];
        const baseOdds = prob > 0 ? 1 / prob : 10;
        // Add some variance and ensure minimum odds
        const variance = Math.random() * 0.3 - 0.15; // -15% to +15%
        calculatedOdds[option] = Math.max(1.1, Math.round((baseOdds + baseOdds * variance) * 10) / 10);
      });
      
      return calculatedOdds;
    } else {
      // Binary odds calculation (YES/NO)
      // Analyze sentiment from articles
      const yesIndicators = ['will', 'likely', 'expected', 'predicted', 'forecast', 'anticipate'];
      const noIndicators = ['unlikely', 'doubtful', 'won\'t', 'wont', 'not expected', 'improbable'];
      
      let yesScore = 1;
      let noScore = 1;
      
      newsData.articles.forEach(article => {
        const text = `${article.title} ${article.description || ''}`.toLowerCase();
        yesIndicators.forEach(indicator => {
          if (text.includes(indicator)) yesScore += 0.5;
        });
        noIndicators.forEach(indicator => {
          if (text.includes(indicator)) noScore += 0.5;
        });
      });
      
      // Calculate probabilities
      const total = yesScore + noScore;
      const yesProbability = yesScore / total;
      const noProbability = noScore / total;
      
      // Convert to odds
      let yesOdds = yesProbability > 0 ? 1 / yesProbability : 5.0;
      let noOdds = noProbability > 0 ? 1 / noProbability : 5.0;
      
      // Add variance
      const variance = Math.random() * 0.4 - 0.2; // -20% to +20%
      yesOdds = Math.max(1.1, Math.round((yesOdds + yesOdds * variance) * 10) / 10);
      noOdds = Math.max(1.1, Math.round((noOdds + noOdds * variance) * 10) / 10);
      
      return { yes: yesOdds, no: noOdds };
    }
  } catch (error) {
    console.error('Odds calculation error:', error);
    // Return default odds if calculation fails
    if (options) {
      const defaultOdds = {};
      options.forEach((opt, i) => {
        defaultOdds[opt] = 2.0 + (i * 0.5);
      });
      return defaultOdds;
    } else {
      return { yes: 2.0, no: 2.0 };
    }
  }
}

// Calculate odds endpoint
app.post('/api/calculate-odds', async (req, res) => {
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

// Helper functions
async function searchNews(query, fromDate) {
  if (!NEWS_API_KEY || NEWS_API_KEY === 'YOUR_NEWS_API_KEY_HERE') {
    return { articles: [], totalResults: 0 };
  }

  try {
    const response = await fetch(
      `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&from=${fromDate}&sortBy=relevancy&language=en&pageSize=10&apiKey=${NEWS_API_KEY}`
    );
    
    if (!response.ok) {
      console.error('NewsAPI error:', response.status, response.statusText);
      return { articles: [], totalResults: 0 };
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching news:', error);
    return { articles: [], totalResults: 0 };
  }
}

async function getUSGSEarthquakes(startDate, endDate) {
  try {
    const response = await fetch(
      `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${startDate}&endtime=${endDate}&minmagnitude=4.0`
    );
    
    if (!response.ok) return { features: [] };
    
    const data = await response.json();
    
    return data.features.map(eq => ({
      magnitude: eq.properties.mag,
      place: eq.properties.place,
      time: new Date(eq.properties.time),
      state: extractStateFromPlace(eq.properties.place)
    }));
  } catch (error) {
    console.error('Error fetching USGS data:', error);
    return [];
  }
}

function extractStateFromPlace(place) {
  const statePatterns = {
    'California': /California|CA\b/i,
    'Alaska': /Alaska|AK\b/i,
    'Oklahoma': /Oklahoma|OK\b/i,
    'Hawaii': /Hawaii|HI\b/i,
    'Texas': /Texas|TX\b/i,
    'Arizona': /Arizona|AZ\b/i,
    'Nevada': /Nevada|NV\b/i
  };
  
  for (const [state, pattern] of Object.entries(statePatterns)) {
    if (pattern.test(place)) return state;
  }
  
  return null;
}

function analyzeNewsForOptions(articles, options) {
  const scores = {};
  
  options.forEach(option => {
    scores[option.option_text] = 0;
  });
  
  articles.forEach(article => {
    const text = `${article.title} ${article.description || ''} ${article.content || ''}`.toLowerCase();
    
    options.forEach(option => {
      const optionText = option.option_text.toLowerCase();
      const mentions = (text.match(new RegExp(optionText, 'gi')) || []).length;
      scores[option.option_text] += mentions;
      
      if (article.title && article.title.toLowerCase().includes(optionText)) {
        scores[option.option_text] += 3;
      }
    });
  });
  
  return scores;
}

function calculateConfidence(scores, totalArticles) {
  const maxScore = Math.max(...Object.values(scores));
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  
  if (totalScore === 0 || totalArticles === 0) return 0;
  
  const dominance = maxScore / totalScore;
  const coverage = Math.min(maxScore / 5, 1);
  
  return (dominance * 0.6 + coverage * 0.4);
}

// Verification endpoint
app.get('/api/markets/:marketId/verify', async (req, res) => {
  try {
    const { marketId } = req.params;
    
    const marketResult = await pool.query(`
      SELECT m.*, c.name as category_name
      FROM markets m
      LEFT JOIN categories c ON m.category_id = c.id
      WHERE m.id = $1
    `, [marketId]);
    
    if (marketResult.rows.length === 0) {
      return res.status(404).json({ error: 'Market not found' });
    }
    
    const market = marketResult.rows[0];
    
    let options = [];
    if (market.market_type === 'multi-choice') {
      const optionsResult = await pool.query(`
        SELECT * FROM market_options
        WHERE market_id = $1
        ORDER BY option_order
      `, [marketId]);
      options = optionsResult.rows;
    } else {
      options = [
        { option_text: 'YES', id: 'yes' },
        { option_text: 'NO', id: 'no' }
      ];
    }
    
    const deadline = new Date(market.deadline);
    const searchStartDate = new Date(deadline);
    searchStartDate.setDate(searchStartDate.getDate() - 30);
    
    const fromDate = searchStartDate.toISOString().split('T')[0];
    const toDate = deadline.toISOString().split('T')[0];
    
    const newsQuery = market.question.replace(/\?$/, '');
    const newsData = await searchNews(newsQuery, fromDate);
    
    let verificationResult = {
      market: {
        id: market.id,
        question: market.question,
        type: market.market_type,
        deadline: market.deadline,
        category: market.category_name
      },
      options: options.map(opt => ({ 
        id: opt.id, 
        text: opt.option_text,
        odds: opt.odds
      })),
      news: {
        articles: newsData.articles.slice(0, 10).map(article => ({
          title: article.title,
          description: article.description,
          url: article.url,
          source: article.source.name,
          publishedAt: article.publishedAt
        })),
        totalResults: newsData.totalResults
      },
      analysis: null,
      suggested_winner: null,
      confidence: 0
    };
    
    if (market.category_name === 'Science' && market.question.toLowerCase().includes('earthquake')) {
      const earthquakes = await getUSGSEarthquakes(fromDate, toDate);
      
      verificationResult.data = {
        source: 'USGS Earthquake Catalog',
        earthquakes: earthquakes.slice(0, 10).map(eq => ({
          magnitude: eq.magnitude,
          location: eq.place,
          state: eq.state,
          time: eq.time
        }))
      };
      
      const stateCounts = {};
      options.forEach(opt => {
        stateCounts[opt.option_text] = earthquakes.filter(eq => 
          eq.state === opt.option_text
        ).length;
      });
      
      verificationResult.analysis = stateCounts;
      
      const strongestByState = {};
      earthquakes.forEach(eq => {
        if (eq.state && options.some(opt => opt.option_text === eq.state)) {
          if (!strongestByState[eq.state] || eq.magnitude > strongestByState[eq.state]) {
            strongestByState[eq.state] = eq.magnitude;
          }
        }
      });
      
      if (Object.keys(strongestByState).length > 0) {
        const winner = Object.entries(strongestByState)
          .sort(([,a], [,b]) => b - a)[0];
        
        verificationResult.suggested_winner = winner[0];
        verificationResult.confidence = earthquakes.length > 5 ? 0.85 : 0.60;
      }
    } else {
      const scores = analyzeNewsForOptions(newsData.articles, options);
      verificationResult.analysis = scores;
      
      const maxScore = Math.max(...Object.values(scores));
      if (maxScore > 0) {
        const winner = Object.entries(scores).find(([, score]) => score === maxScore);
        verificationResult.suggested_winner = winner[0];
        verificationResult.confidence = calculateConfidence(scores, newsData.articles.length);
      }
    }
    
    res.json(verificationResult);
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ error: 'Verification failed', details: error.message });
  }
});

// Auth endpoints
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND password = $2',
      [email, password]
    );
    
    if (result.rows.length > 0) {
      const user = result.rows[0];
      res.json({ user: { ...user, password: undefined } });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, name, email, password } = req.body;
    
    if (!username || !name || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    const result = await pool.query(
      'INSERT INTO users (username, name, email, password) VALUES ($1, $2, $3, $4) RETURNING *',
      [username, name, email, password]
    );
    
    const user = result.rows[0];
    res.json({ user: { ...user, password: undefined } });
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      if (error.constraint === 'users_username_key') {
        return res.status(400).json({ error: 'Username already taken' });
      } else if (error.constraint === 'users_email_key') {
        return res.status(400).json({ error: 'Email already registered' });
      }
    }
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Markets endpoints
app.get('/api/markets', async (req, res) => {
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

app.post('/api/markets', async (req, res) => {
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

app.get('/api/markets/expired', async (req, res) => {
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

app.post('/api/markets/:marketId/resolve', async (req, res) => {
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

// Bets endpoints
app.post('/api/bets', async (req, res) => {
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

app.post('/api/bets/:betId/cancel', async (req, res) => {
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

app.get('/api/users/:userId/bets', async (req, res) => {
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

// Users endpoints
app.get('/api/users/:userId/stats', async (req, res) => {
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

app.put('/api/users/:userId/profile', async (req, res) => {
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

app.get('/api/leaderboard', async (req, res) => {
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

// Categories endpoints
app.get('/api/categories', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categories ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    console.error('Categories fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

app.post('/api/categories', async (req, res) => {
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

app.delete('/api/categories/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM categories WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
