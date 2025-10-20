import fetch from 'node-fetch';

async function searchNews(query, fromDate) {
  const NEWS_API_KEY = process.env.NEWS_API_KEY;
  
  if (!NEWS_API_KEY || NEWS_API_KEY === 'YOUR_NEWS_API_KEY_HERE' || NEWS_API_KEY === 'your_newsapi_key_here') {
    return { articles: [], totalResults: 0 };
  }

  try {
    const response = await fetch(
      `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&from=${fromDate}&sortBy=relevancy&language=en&pageSize=10&apiKey=${NEWS_API_KEY}`
    );
    
    if (!response.ok) {
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
    
    if (!response.ok) return [];
    
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

export async function verifyMarket(pool, marketId) {
  const marketResult = await pool.query(`
    SELECT m.*, c.name as category_name
    FROM markets m
    LEFT JOIN categories c ON m.category_id = c.id
    WHERE m.id = $1
  `, [marketId]);
  
  if (marketResult.rows.length === 0) {
    throw new Error('Market not found');
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
  
  return verificationResult;
}
