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
      console.log(`   ⚠️  Connection failed, retrying in ${delay/1000}s... (attempt ${i + 2}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const API_URL = process.env.API_URL || 'http://binarybets-backend:5000/api';
const OPENAI_KEY = process.env.OPEN_AI_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

async function resolveExpiredMarkets() {
  console.log(`\n🤖 [${new Date().toISOString()}] Starting market resolution check...`);
  
  try {
    // Get all unresolved markets past their deadline
    const result = await pool.query(`
      SELECT m.*, c.name as category_name,
        COALESCE(json_agg(
          json_build_object(
            'id', mo.id,
            'option_text', mo.option_text,
            'option_order', mo.option_order
          ) ORDER BY mo.option_order
        ) FILTER (WHERE mo.id IS NOT NULL), '[]') as options
      FROM markets m
      LEFT JOIN categories c ON m.category_id = c.id
      LEFT JOIN market_options mo ON m.id = mo.market_id
      WHERE m.resolved = false 
        AND m.deadline < NOW()
      GROUP BY m.id, c.name
    `);
    
    const expiredMarkets = result.rows;
    
    if (expiredMarkets.length === 0) {
      console.log('✅ No expired markets to resolve');
      return;
    }
    
    console.log(`📋 Found ${expiredMarkets.length} expired market(s) to resolve`);
    
    for (const market of expiredMarkets) {
      await resolveMarket(market);
    }
    
    console.log('✅ Market resolution check complete\n');
  } catch (error) {
    console.error('❌ Error in market resolution:', error);
  }
}

// Helper function to clean AI response
function cleanJsonResponse(text) {
  // Remove markdown code blocks
  let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '');
  // Remove leading/trailing whitespace
  cleaned = cleaned.trim();
  return cleaned;
}

async function resolveMarket(market) {
  console.log(`\n🔍 Resolving: "${market.question}"`);
  console.log(`   Type: ${market.market_type}`);
  console.log(`   Deadline: ${market.deadline}`);
  
  try {
    // Use AI to determine the outcome
    const outcome = await determineOutcome(market);
    
    if (!outcome) {
      console.log('⚠️  Could not determine outcome, skipping...');
      return;
    }
    
    console.log(`✅ AI Determined Outcome: ${outcome.answer}`);
    console.log(`   Reasoning: ${outcome.reasoning}`);
    console.log(`   Confidence: ${outcome.confidence}`);
    
    // Resolve the market
    let winningOptionId = null;
    
    if (market.market_type === 'binary') {
      winningOptionId = outcome.answer.toLowerCase() === 'yes' ? 'yes' : 'no';
    } else {
      // Find matching option for multi-choice
      const matchingOption = market.options.find(opt => 
        opt.option_text.toLowerCase() === outcome.answer.toLowerCase()
      );
      winningOptionId = matchingOption?.id;
    }
    
    if (!winningOptionId) {
      console.log('⚠️  Could not match answer to option, skipping...');
      return;
    }
    
    // Call the resolve endpoint
   // Call the resolve endpoint with retry logic
    const response = await fetchWithRetry(`${API_URL}/markets/${market.id}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ winning_option_id: winningOptionId })
    }, 3, 5000);
    
    const data = await response.json();
    
    if (response.ok) {
      console.log(`💰 Market resolved! ${data.winners_count} winner(s) paid out`);
    } else {
      console.error(`❌ Failed to resolve market: ${data.error}`);
    }
    
  } catch (error) {
    console.error(`❌ Error resolving market ${market.id}:`, error.message);
  }
}

async function determineOutcome(market) {
  const prompt = `You are analyzing a prediction market to determine the actual outcome.

Market Question: ${market.question}
Market Type: ${market.market_type}
${market.market_type === 'multi-choice' ? `Options: ${market.options.map(o => o.option_text).join(', ')}` : ''}
Deadline: ${market.deadline}
Current Date: ${new Date().toISOString()}

Research and determine the actual outcome of this prediction. Use your knowledge and reasoning.

Respond with ONLY a JSON object (no markdown, no code blocks) in this format:
{
  "answer": "Yes" or "No" for binary, or the exact option text for multi-choice,
  "reasoning": "Brief explanation of why this is the correct outcome",
  "confidence": "high", "medium", or "low"
}`;

  try {
    // Try OpenAI first
    console.log('📡 Asking OpenAI to determine outcome...');
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a factual analyst determining prediction market outcomes. Respond ONLY with valid JSON, no markdown code blocks or extra text.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 500
      })
    });

    const openaiData = await openaiResponse.json();
    
    if (openaiData.error) {
      throw new Error(`OpenAI Error: ${openaiData.error.message}`);
    }
    
    const aiText = cleanJsonResponse(openaiData.choices[0].message.content);
    console.log('   Raw OpenAI response:', aiText.substring(0, 100));
    const outcome = JSON.parse(aiText);
    
    return outcome;
    
  } catch (openaiError) {
    console.warn('⚠️  OpenAI failed, trying Anthropic...', openaiError.message);
    
    try {
      const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          messages: [{
            role: 'user',
            content: prompt
          }]
        })
      });

      const anthropicData = await anthropicResponse.json();
      
      if (anthropicData.error) {
        throw new Error(`Anthropic Error: ${anthropicData.error.message || JSON.stringify(anthropicData.error)}`);
      }
      
      const aiText = cleanJsonResponse(anthropicData.content[0].text);
      console.log('   Raw Anthropic response:', aiText.substring(0, 100));
      const outcome = JSON.parse(aiText);
      
      return outcome;
      
    } catch (anthropicError) {
      console.error('❌ Both AI providers failed:', anthropicError.message);
      return null;
    }
  }
}

// Run the resolver
resolveExpiredMarkets()
  .then(() => {
    console.log('✅ Resolver completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Resolver failed:', error);
    process.exit(1);
  });
