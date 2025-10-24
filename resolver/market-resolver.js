import fetch from 'node-fetch';

const BACKEND_URL = process.env.BACKEND_URL || 'http://backend:5000';
const RESOLVER_INTERVAL = parseInt(process.env.RESOLVER_INTERVAL) || 60000; // 1 minute default

console.log('🤖 Market Resolver Starting...');
console.log(`📡 Backend URL: ${BACKEND_URL}`);
console.log(`⏱️  Check Interval: ${RESOLVER_INTERVAL}ms`);

// Helper function to check if market should be resolved
function shouldResolveMarket(market) {
  const now = new Date();
  const closeDate = new Date(market.deadline);
  
  // Market must be closed and not already resolved
  if (market.resolved === true || closeDate > now) {
    return false;
  }
  
  console.log(`✅ Market ${market.id} is ready to resolve`);
  return true;
}

// Helper function to determine winning outcome
async function determineWinningOutcome(market) {
  console.log(`🔍 Determining outcome for market ${market.id}: "${market.question}"`);
  
  try {
    // For binary markets, use AI to determine yes/no
    if (market.market_type === 'binary') {
      console.log('📊 Binary market - using AI to determine Yes/No');
      const outcome = await callOpenAI(market);
      return outcome;
    }
    
    // For multiple choice, find option with most volume
    if (market.market_type === 'multi-choice') {
      console.log('📊 Multiple choice market - finding highest volume option');
      
      // Get current volumes for all options
      const response = await fetch(`${BACKEND_URL}/api/markets/${market.id}`);
      const marketData = await response.json();
      
      if (!marketData.options || marketData.options.length === 0) {
        throw new Error('No options found for multiple choice market');
      }
      
      // Find option with highest total volume
      const winningOption = marketData.options.reduce((prev, current) => {
        const prevVolume = prev.yes_shares + prev.no_shares;
        const currentVolume = current.yes_shares + current.no_shares;
        return currentVolume > prevVolume ? current : prev;
      });
      
      console.log(`🏆 Winning option: "${winningOption.text}" with volume ${winningOption.yes_shares + winningOption.no_shares}`);
      return winningOption.text;
    }
    
    throw new Error('Unknown market type');
  } catch (error) {
    console.error(`❌ Error determining outcome:`, error.message);
    throw error;
  }
}

// Call OpenAI to determine yes/no outcome
async function callOpenAI(market) {
  try {
    console.log('🤖 Calling OpenAI for market resolution...');
    
    const response = await fetch(`${BACKEND_URL}/api/resolve-with-ai`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        marketId: market.id,
        question: market.question,
        description: market.description,
        category: market.category_name
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API call failed: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    console.log(`🤖 OpenAI determined outcome: "${data.outcome}"`);
    console.log(`📝 Reasoning: ${data.reasoning}`);
    
    return data.outcome; // Will be "yes" or "no"
  } catch (error) {
    console.error('❌ OpenAI call failed:', error.message);
    throw error;
  }
}

// Resolve a specific market
async function resolveMarket(market, outcome) {
  try {
    console.log(`\n🎯 Resolving Market ${market.id}`);
    console.log(`   Question: "${market.question}"`);
    console.log(`   Type: ${market.market_type}`);
    console.log(`   Original Outcome: "${outcome}"`);
    
    // CRITICAL FIX: Convert outcome to lowercase for binary markets
    const normalizedOutcome = market.market_type === 'binary' 
      ? outcome.toLowerCase()  // "Yes" → "yes", "No" → "no"
      : outcome;
    
    console.log(`   Normalized Outcome: "${normalizedOutcome}"`);
    
    const response = await fetch(`${BACKEND_URL}/api/markets/${market.id}/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        outcome: normalizedOutcome,  // ✅ Correct parameter name (lowercase for binary)
        resolvedBy: 1  // ✅ Admin user ID
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Failed to resolve market: ${response.status} - ${JSON.stringify(errorData)}`);
    }
    
    const result = await response.json();
    console.log(`✅ Market ${market.id} resolved successfully!`);
    console.log(`   Outcome: "${normalizedOutcome}"`);
    return result;
    
  } catch (error) {
    console.error(`❌ Error resolving market ${market.id}:`, error.message);
    throw error;
  }
}

// Main resolver loop
async function resolveMarkets() {
  try {
    console.log('\n🔄 Checking for markets to resolve...');
    
    // Fetch all active markets
    const response = await fetch(`${BACKEND_URL}/api/markets`);
    if (!response.ok) {
      throw new Error(`Failed to fetch markets: ${response.status}`);
    }
    
    const markets = await response.json();
    console.log(`📋 Found ${markets.length} total markets`);
    
    // Filter markets that need resolution
    const marketsToResolve = markets.filter(shouldResolveMarket);
    
    if (marketsToResolve.length === 0) {
      console.log('✨ No markets need resolution at this time');
      return;
    }
    
    console.log(`⚡ ${marketsToResolve.length} markets need resolution`);
    
    // Resolve each market
    for (const market of marketsToResolve) {
      try {
        const outcome = await determineWinningOutcome(market);
        await resolveMarket(market, outcome);
        
        // Wait a bit between resolutions to avoid overwhelming the backend
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`❌ Failed to resolve market ${market.id}:`, error.message);
        // Continue with next market
      }
    }
    
    console.log('✅ Resolution cycle complete');
    
  } catch (error) {
    console.error('❌ Error in resolver loop:', error.message);
  }
}

// Start the resolver
console.log('🚀 Starting market resolver service...\n');

// Run immediately on start
resolveMarkets();

// Then run on interval
setInterval(resolveMarkets, RESOLVER_INTERVAL);

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('📴 Resolver shutting down...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('📴 Resolver shutting down...');
  process.exit(0);
});
