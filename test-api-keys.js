// Quick script to test OpenRouter API keys
const fs = require('fs');
const path = require('path');

async function testApiKey(apiKey, index, total) {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    const rateLimitRemaining = response.headers.get('x-ratelimit-remaining-requests');
    const rateLimitLimit = response.headers.get('x-ratelimit-limit-requests');
    const rateLimitReset = response.headers.get('x-ratelimit-reset-requests');

    if (response.ok) {
      console.log(`✓ API Key ${index + 1}/${total}: Valid`);
      if (rateLimitRemaining !== null) {
        console.log(`  Rate Limit: ${rateLimitRemaining}/${rateLimitLimit} requests remaining`);
        if (rateLimitReset) {
          const resetDate = new Date(rateLimitReset * 1000);
          console.log(`  Resets at: ${resetDate.toLocaleString()}`);
        }
      }
      return true;
    } else {
      console.log(`✗ API Key ${index + 1}/${total}: Failed (${response.status})`);
      const data = await response.json().catch(() => ({}));
      if (data.error) {
        console.log(`  Error: ${data.error.message}`);
      }
      return false;
    }
  } catch (err) {
    console.log(`✗ API Key ${index + 1}/${total}: Error - ${err.message}`);
    return false;
  }
}

async function main() {
  const configPath = path.join(__dirname, 'config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  
  const provider = config.providers.find(p => p.name === 'openrouter');
  if (!provider) {
    console.error('OpenRouter provider not found');
    return;
  }

  console.log(`Testing ${provider.apiKeys.length} API keys...\n`);

  for (let i = 0; i < provider.apiKeys.length; i++) {
    await testApiKey(provider.apiKeys[i], i, provider.apiKeys.length);
    console.log('');
    
    // Small delay between requests
    if (i < provider.apiKeys.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
}

main();
