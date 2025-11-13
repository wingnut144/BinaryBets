
// AI Odds Generation Function
async function generateAIodds(question, options) {
  console.log('Generating AI odds for:', question, 'Options:', options);
  
  const prompt = `You are an expert prediction market analyst. Given this prediction market question and options, provide realistic probability estimates for each option.

Question: ${question}

Options:
${options.map((opt, i) => `${i + 1}. ${opt}`).join('\n')}

Analyze the question carefully and provide probability estimates that:
1. Add up to 100%
2. Are based on current knowledge and reasonable expectations
3. Reflect real-world likelihood

Respond ONLY with a JSON array of numbers (the probabilities as percentages), like: [45, 35, 20]`;

  // Try OpenAI first
  try {
    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey) {
      console.log('Trying OpenAI for odds generation...');
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are a prediction market analyst. Respond only with valid JSON arrays of probabilities.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 150
        })
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices[0].message.content.trim();
        console.log('OpenAI response:', content);
        
        // Parse the probabilities
        const match = content.match(/\[[\d\s,\.]+\]/);
        if (match) {
          const probabilities = JSON.parse(match[0]);
          console.log('Parsed probabilities:', probabilities);
          
          // Convert probabilities to odds (odds = 100 / probability)
          const odds = probabilities.map(p => {
            const odd = p > 0 ? (100 / p).toFixed(2) : options.length;
            return parseFloat(odd);
          });
          
          console.log('Generated odds from OpenAI:', odds);
          return odds;
        }
      }
    }
  } catch (error) {
    console.error('OpenAI failed:', error.message);
  }

  // Try Anthropic as fallback
  try {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (anthropicKey) {
      console.log('Trying Anthropic for odds generation...');
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 150,
          messages: [
            { role: 'user', content: prompt }
          ]
        })
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.content[0].text.trim();
        console.log('Anthropic response:', content);
        
        // Parse the probabilities
        const match = content.match(/\[[\d\s,\.]+\]/);
        if (match) {
          const probabilities = JSON.parse(match[0]);
          console.log('Parsed probabilities:', probabilities);
          
          // Convert probabilities to odds
          const odds = probabilities.map(p => {
            const odd = p > 0 ? (100 / p).toFixed(2) : options.length;
            return parseFloat(odd);
          });
          
          console.log('Generated odds from Anthropic:', odds);
          return odds;
        }
      }
    }
  } catch (error) {
    console.error('Anthropic failed:', error.message);
  }

  // Fallback to equal odds
  console.log('AI generation failed, using equal odds');
  return options.map(() => parseFloat(options.length.toFixed(2)));
}

