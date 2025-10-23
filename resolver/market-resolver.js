import fetch from 'node-fetch';
import pg from 'pg';

// Retry helper function
async function fetchWithRetry(url, options, maxRetries = 3, delay = 5000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      return response;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      console.log(`   ⚠️  Request failed, retrying in ${delay/1000}s... (attempt ${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Wait for backend to be ready
async function waitForBackend(url, maxRetries = 30, delay = 2000) {
  console.log('Waiting for backend to be ready...');
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        console.log('Backend is ready!');
        return true;
      }
    } catch (error) {
      // Backend not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  throw new Error('Backend failed to become ready');
}

const BACKEND_URL = process.env.BACKEND_URL || 'http://backend:3001';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY environment variable is required');
  process.exit(1);
}

// Database connection
const pool = new pg.Pool({
  host: process.env.POSTGRES_HOST || 'postgres',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'binarybets',
  user: process.env.POSTGRES_USER || 'binaryuser',
  password: process.env.POSTGRES_PASSWORD || 'binarypassword',
});

async function getExpiredMarkets() {
  const result = await pool.query(
    `SELECT m.*, 
            COALESCE(
              json_agg(
                json_build_object('id', mo.id, 'name', mo.name)
                ORDER BY mo.id
              ) FILTER (WHERE mo.id IS NOT NULL),
              '[]'
            ) as options
     FROM markets m
     LEFT JOIN market_options mo ON m.id = mo.market_id
     WHERE m.deadline < NOW() AND m.resolved = false
     GROUP BY m.id
     ORDER BY m.deadline ASC`
  );
  return result.rows;
}

async function determineOutcome(market) {
  console.log(`📡 Asking OpenAI to determine outcome...`);
  
  let prompt;
  if (market.type === 'binary') {
    prompt = `You are analyzing a prediction market question to determine the outcome.

Question: "${market.question}"
Type: Binary (Yes/No)
Deadline: ${market.deadline}
Current Date: ${new Date().toISOString()}

Based on factual information available, determine if the answer is "Yes" or "No".

Respond in JSON format:
{
  "answer": "Yes" or "No",
  "reasoning": "Brief explanation",
  "confidence": "high" or "medium" or "low"
}`;
  } else {
    const optionsList = market.options.map(opt => `- ${opt.name}`).join('\n');
    prompt = `You are analyzing a prediction market question to determine the outcome.

Question: "${market.question}"
Type: Multiple Choice
Options:
${optionsList}
Deadline: ${market.deadline}
Current Date: ${new Date().toISOString()}

Based on factual information available, determine which option is correct.

Respond in JSON format:
{
  "answer": "Exact name of the winning option",
  "reasoning": "Brief explanation",
  "confidence": "high" or "medium" or "low"
}`;
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a factual analyst that determines outcomes of prediction market questions based on real-world events and data. Always respond with valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 500
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  
  // Try to extract JSON from markdown code blocks if present
  let jsonStr = content;
  const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }
  
  console.log(`   Raw OpenAI response: ${jsonStr.substring(0, 100)}...`);
  
  const aiResponse = JSON.parse(jsonStr);
  return aiResponse;
}

async function resolveMarket(market, outcome) {
  // Convert outcome to lowercase for binary markets
  const normalizedOutcome = market.type === 'binary' 
    ? outcome.toLowerCase() 
    : outcome;

  console.log(`🔧 Resolving market with outcome: "${normalizedOutcome}"`);

  const response = await fetchWithRetry(
    `${BACKEND_URL}/api/markets/${market.id}/resolve`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        outcome: normalizedOutcome,
        resolvedBy: 1  // Admin user ID
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`   ❌ Backend error response:`, errorText);
    throw new Error(`Failed to resolve market: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

async function resolveExpiredMarkets() {
  try {
    console.log(`🤖 [${new Date().toISOString()}] Starting market resolution check...`);
    
    const markets = await getExpiredMarkets();
    
    if (markets.length === 0) {
      console.log('✅ No expired markets to resolve');
      return;
    }

    console.log(`📋 Found ${markets.length} expired market(s) to resolve`);

    for (const market of markets) {
      try {
        console.log(`🔍 Resolving: "${market.question}"`);
        console.log(`   Type: ${market.type}`);
        console.log(`   Deadline: ${market.deadline}`);

        const aiResponse = await determineOutcome(market);
        
        console.log(`✅ AI Determined Outcome: ${aiResponse.answer}`);
        console.log(`   Reasoning: ${aiResponse.reasoning}`);
        console.log(`   Confidence: ${aiResponse.confidence}`);

        await resolveMarket(market, aiResponse.answer);
        
        console.log(`✅ Market resolved successfully!`);
        
      } catch (error) {
        console.error(`❌ Failed to resolve market: ${error.message}`);
        // Continue with next market
      }
    }

    console.log('✅ Market resolution check complete');
    
  } catch (error) {
    console.error('❌ Error in market resolver:', error);
    throw error;
  }
}

async function main() {
  try {
    // Wait for backend to be ready
    await waitForBackend(`${BACKEND_URL}/api/health`);
    
    console.log('Starting market resolver service...');
    
    // Run immediately on startup
    await resolveExpiredMarkets();
    
    // Then run every 24 hours
    console.log('Sleeping for 24 hours...');
    setInterval(async () => {
      await resolveExpiredMarkets();
    }, 24 * 60 * 60 * 1000);

    console.log('✅ Resolver completed successfully');
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  pool.end();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  pool.end();
  process.exit(0);
});

main();
