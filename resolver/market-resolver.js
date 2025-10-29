import fetch from 'node-fetch';

const BACKEND_URL = process.env.BACKEND_URL || 'http://backend:5000';
const RESOLVER_INTERVAL = parseInt(process.env.RESOLVER_INTERVAL) || 60000;
const RESOLVER_TOKEN = process.env.RESOLVER_TOKEN || 'resolver-secure-token-change-this';

console.log('🤖 Market Resolver Starting...');
console.log(`📡 Backend URL: ${BACKEND_URL}`);
console.log(`⏱️ Check interval: ${RESOLVER_INTERVAL / 1000} seconds`);
console.log(`🔐 Using resolver authentication token`);

async function waitForBackend() {
  console.log('Waiting for backend to be ready...');
  let attempts = 0;
  const maxAttempts = 30;

  while (attempts < maxAttempts) {
    try {
      const response = await fetch(`${BACKEND_URL}/health`);
      if (response.ok) {
        console.log('✅ Backend is ready!');
        return true;
      }
    } catch (error) {
      // Backend not ready yet
    }
    
    attempts++;
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.error('❌ Backend failed to start after 60 seconds');
  return false;
}

async function resolveMarkets() {
  try {
    console.log('🔄 Checking for markets to resolve...');
    
    const response = await fetch(`${BACKEND_URL}/api/markets?status=active`);
    
    if (!response.ok) {
      console.error('❌ Failed to fetch markets:', response.status);
      return;
    }
    
    const data = await response.json();
    const markets = data.markets || [];
    
    console.log(`📋 Found ${markets.length} total markets`);
    
    const now = new Date();
    const expiredMarkets = markets.filter(m => {
      const deadline = new Date(m.deadline);
      return deadline < now && m.status === 'active';
    });
    
    if (expiredMarkets.length === 0) {
      console.log('✅ No expired markets to resolve');
      return;
    }
    
    console.log(`⏰ Found ${expiredMarkets.length} expired markets to resolve`);
    
    for (const market of expiredMarkets) {
      try {
        console.log(`🎯 Resolving market ${market.id}: "${market.question}"`);
        
        // Get AI outcome with resolver token
        const aiResponse = await fetch(`${BACKEND_URL}/api/resolve-with-ai`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${RESOLVER_TOKEN}`
          },
          body: JSON.stringify({
            market_id: market.id,
            question: market.question,
            options: market.options ? market.options.map(o => o.option_text) : ['Yes', 'No']
          })
        });
        
        if (!aiResponse.ok) {
          const errorText = await aiResponse.text();
          console.error(`❌ Failed to get AI outcome for market ${market.id}: ${errorText}`);
          continue;
        }
        
        const { outcome } = await aiResponse.json();
        console.log(`🤖 AI determined outcome: ${outcome}`);
        
        // Resolve the market with resolver token
        const resolveResponse = await fetch(`${BACKEND_URL}/api/markets/${market.id}/resolve`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${RESOLVER_TOKEN}`
          },
          body: JSON.stringify({
            outcome: outcome,
            winning_outcome: outcome
          })
        });
        
        if (resolveResponse.ok) {
          console.log(`✅ Market ${market.id} resolved: ${outcome}`);
        } else {
          const errorText = await resolveResponse.text();
          console.error(`❌ Failed to resolve market ${market.id}: ${errorText}`);
        }
        
      } catch (error) {
        console.error(`❌ Error resolving market ${market.id}:`, error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Error in resolver loop:', error.message);
  }
}

async function main() {
  const backendReady = await waitForBackend();
  if (!backendReady) {
    process.exit(1);
  }
  
  await resolveMarkets();
  setInterval(resolveMarkets, RESOLVER_INTERVAL);
  console.log('🤖 Resolver running successfully');
}

main();
