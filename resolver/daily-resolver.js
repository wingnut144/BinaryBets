import fetch from 'node-fetch';
import pg from 'pg';

const { Pool } = pg;

// Configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'binarybets',
  user: process.env.DB_USER || 'binaryuser',
  password: process.env.DB_PASSWORD
};

const pool = new Pool(DB_CONFIG);

// Logging
function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

// Save decision to database
async function logDecision(marketId, marketQuestion, decision, aiProvider) {
  try {
    await pool.query(`
      INSERT INTO resolver_logs (market_id, market_question, decision, outcome, confidence, reasoning, ai_provider)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      marketId,
      marketQuestion,
      decision.decision,
      decision.winner || null,
      decision.confidence,
      decision.reasoning,
      aiProvider
    ]);
  } catch (error) {
    log(`Error saving log to database: ${error.message}`);
  }
}

// ChatGPT API call
async function resolveWithChatGPT(question, options, deadline) {
  try {
    log(`Trying ChatGPT for: "${question}"`);
    
    const prompt = `You are resolving a prediction market. Analyze if the outcome is clear enough to resolve now.

Market Question: ${question}
Options: ${options.join(', ')}
Original Deadline: ${new Date(deadline).toLocaleDateString()}
Today's Date: ${new Date().toLocaleDateString()}

Instructions:
1. Search your knowledge for factual information about this topic
2. If the outcome is DEFINITIVELY CLEAR (e.g., election results confirmed, event definitely happened/didn't happen), respond with the winning option
3. If the outcome is UNCERTAIN or requires real-time data you don't have, respond with "KEEP_OPEN"
4. Only resolve if you are 95%+ confident in the outcome

Response format (JSON):
{
  "decision": "RESOLVE" or "KEEP_OPEN",
  "winner": "option name" or null,
  "confidence": 0-100,
  "reasoning": "brief explanation"
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are a precise prediction market resolver. Only resolve markets when the outcome is definitively clear.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      throw new Error(`ChatGPT API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Try to parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      log(`ChatGPT decision: ${result.decision} (confidence: ${result.confidence}%)`);
      return { result, provider: 'ChatGPT' };
    }
    
    throw new Error('Could not parse ChatGPT response');
  } catch (error) {
    log(`ChatGPT failed: ${error.message}`);
    return null;
  }
}

// Anthropic API call (fallback)
async function resolveWithAnthropic(question, options, deadline) {
  try {
    log(`Trying Anthropic for: "${question}"`);
    
    const prompt = `You are resolving a prediction market. Analyze if the outcome is clear enough to resolve now.

Market Question: ${question}
Options: ${options.join(', ')}
Original Deadline: ${new Date(deadline).toLocaleDateString()}
Today's Date: ${new Date().toLocaleDateString()}

Instructions:
1. Search your knowledge for factual information about this topic
2. If the outcome is DEFINITIVELY CLEAR (e.g., election results confirmed, event definitely happened/didn't happen), respond with the winning option
3. If the outcome is UNCERTAIN or requires real-time data you don't have, respond with "KEEP_OPEN"
4. Only resolve if you are 95%+ confident in the outcome

Response format (JSON):
{
  "decision": "RESOLVE" or "KEEP_OPEN",
  "winner": "option name" or null,
  "confidence": 0-100,
  "reasoning": "brief explanation"
}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 500,
        temperature: 0.1,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.content[0].text;
    
    // Try to parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      log(`Anthropic decision: ${result.decision} (confidence: ${result.confidence}%)`);
      return { result, provider: 'Anthropic' };
    }
    
    throw new Error('Could not parse Anthropic response');
  } catch (error) {
    log(`Anthropic failed: ${error.message}`);
    return null;
  }
}

// Main resolver function
async function resolveMarkets() {
  log('🤖 Starting daily market resolution check...');
  
  try {
    // Get all active markets
    const result = await pool.query(`
      SELECT m.id, m.question, m.deadline, m.status,
             json_agg(json_build_object('id', o.id, 'name', o.name)) as options
      FROM markets m
      LEFT JOIN options o ON o.market_id = m.id
      WHERE m.status = 'open' OR m.status = 'active'
      GROUP BY m.id
    `);

    const markets = result.rows;
    log(`Found ${markets.length} active markets`);

    let resolvedCount = 0;
    let keptOpenCount = 0;
    let errorCount = 0;

    for (const market of markets) {
      try {
        log(`\n--- Evaluating Market #${market.id} ---`);
        log(`Question: ${market.question}`);
        
        const options = market.options.map(o => o.name);
        
        // Try ChatGPT first
        let aiResponse = await resolveWithChatGPT(market.question, options, market.deadline);
        
        // Fallback to Anthropic if ChatGPT fails
        if (!aiResponse) {
          aiResponse = await resolveWithAnthropic(market.question, options, market.deadline);
        }
        
        if (!aiResponse) {
          log(`❌ Both AI providers failed for market #${market.id}`);
          errorCount++;
          continue;
        }
        
        const { result: decision, provider } = aiResponse;
        log(`Reasoning: ${decision.reasoning}`);
        
        // Save to database
        await logDecision(market.id, market.question, decision, provider);
        
        if (decision.decision === 'RESOLVE' && decision.winner && decision.confidence >= 95) {
          // Resolve the market
          const winningOption = market.options.find(o => o.name === decision.winner);
          
          if (!winningOption) {
            log(`❌ Could not find winning option: ${decision.winner}`);
            errorCount++;
            continue;
          }
          
          await pool.query(`
            UPDATE markets 
            SET status = 'resolved', 
                outcome = $1, 
                resolved_at = NOW()
            WHERE id = $2
          `, [decision.winner, market.id]);
          
          // Pay out winners
          await pool.query(`
            UPDATE bets b
            SET payout = b.potential_payout, paid_out = true
            FROM options o
            WHERE b.option_id = o.id 
              AND o.market_id = $1 
              AND o.id = $2
          `, [market.id, winningOption.id]);
          
          // Credit winners
          await pool.query(`
            UPDATE users u
            SET balance = u.balance + b.payout
            FROM bets b
            WHERE b.user_id = u.id 
              AND b.market_id = $1 
              AND b.paid_out = true 
              AND b.payout > 0
          `, [market.id]);
          
          log(`✅ Market #${market.id} RESOLVED: ${decision.winner}`);
          resolvedCount++;
        } else {
          log(`⏳ Market #${market.id} KEPT OPEN (confidence: ${decision.confidence}%)`);
          keptOpenCount++;
        }
        
      } catch (error) {
        log(`❌ Error processing market #${market.id}: ${error.message}`);
        errorCount++;
      }
    }
    
    log('\n=== Daily Resolution Summary ===');
    log(`✅ Resolved: ${resolvedCount} markets`);
    log(`⏳ Kept Open: ${keptOpenCount} markets`);
    log(`❌ Errors: ${errorCount} markets`);
    log('================================\n');
    
  } catch (error) {
    log(`❌ Fatal error: ${error.message}`);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run
resolveMarkets()
  .then(() => {
    log('✅ Resolver completed successfully');
    process.exit(0);
  })
  .catch(error => {
    log(`❌ Resolver failed: ${error.message}`);
    process.exit(1);
  });
