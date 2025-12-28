// Script to list available Gemini models
const fs = require('fs');
const path = require('path');

// Read .env.local file manually
const envPath = path.join(__dirname, '.env.local');
let apiKey = '';

try {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const match = envContent.match(/GEMINI_API_KEY=(.+)/);
  if (match) {
    apiKey = match[1].trim();
  }
} catch (err) {
  console.error('❌ Could not read .env.local');
  process.exit(1);
}

if (!apiKey) {
  console.error('❌ No GEMINI_API_KEY found in .env.local');
  process.exit(1);
}

console.log('🔍 Fetching available Gemini models...\n');

fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
  .then(res => res.json())
  .then(data => {
    if (data.models) {
      console.log('✅ Available models:\n');
      data.models.forEach(model => {
        console.log(`📌 ${model.name}`);
        if (model.displayName) {
          console.log(`   Display Name: ${model.displayName}`);
        }
        if (model.supportedGenerationMethods) {
          console.log(`   Supported Methods: ${model.supportedGenerationMethods.join(', ')}`);
        }
        console.log('');
      });
      
      // Filter for models supporting generateContent
      const contentModels = data.models.filter(m => 
        m.supportedGenerationMethods?.includes('generateContent')
      );
      
      console.log('\n🎯 Models supporting generateContent:');
      contentModels.forEach(m => {
        console.log(`   - ${m.name.replace('models/', '')}`);
      });
    } else {
      console.error('❌ Error:', data);
    }
  })
  .catch(err => {
    console.error('❌ Error fetching models:', err);
  });
