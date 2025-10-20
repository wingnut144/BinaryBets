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
      console.error('NewsAPI error:', response.status);
      return { articles: [], totalResults: 0 };
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching news:', error);
    return { articles: [], totalResults: 0 };
  }
}

function analyzeNewsForOptions(articles, options) {
  const scores = {};
  
  options.forEach(option => {
    scores[option] = 0;
  });
  
  articles.forEach(article => {
    const text = `${article.title} ${article.description || ''} ${article.content || ''}`.toLowerCase();
    
    options.forEach(option => {
      const optionText = option.toLowerCase();
      const mentions = (text.match(new RegExp(optionText, 'gi')) || []).length;
      scores[option] += mentions;
      
      if (article.title && article.title.toLowerCase().includes(optionText)) {
        scores[option] += 3;
      }
    });
  });
  
  return scores;
}

export async function calculateOdds(question, options = null) {
  try {
    const searchQuery = question.replace(/\?$/, '').toLowerCase();
    const newsData = await searchNews(searchQuery, new Date().toISOString().split('T')[0]);
    
    if (options) {
      const scores = analyzeNewsForOptions(newsData.articles, options);
      const totalScore = Object.values(scores).reduce((a, b) => a + b, 0) || options.length;
      
      const calculatedOdds = {};
      options.forEach(option => {
        const score = scores[option] || 1;
        const probability = score / totalScore;
        const baseOdds = probability > 0 ? 1 / probability : 10;
        const variance = Math.random() * 0.3 - 0.15;
        calculatedOdds[option] = Math.max(1.1, Math.round((baseOdds + baseOdds * variance) * 10) / 10);
      });
      
      return calculatedOdds;
    } else {
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
      
      const total = yesScore + noScore;
      const yesProbability = yesScore / total;
      const noProbability = noScore / total;
      
      let yesOdds = yesProbability > 0 ? 1 / yesProbability : 5.0;
      let noOdds = noProbability > 0 ? 1 / noProbability : 5.0;
      
      const variance = Math.random() * 0.4 - 0.2;
      yesOdds = Math.max(1.1, Math.round((yesOdds + yesOdds * variance) * 10) / 10);
      noOdds = Math.max(1.1, Math.round((noOdds + noOdds * variance) * 10) / 10);
      
      return { yes: yesOdds, no: noOdds };
    }
  } catch (error) {
    console.error('Odds calculation error:', error);
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
