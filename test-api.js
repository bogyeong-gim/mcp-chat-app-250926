// API 키 테스트 스크립트
const { GoogleGenAI } = require('@google/genai');
require('dotenv').config({ path: '.env.local' });

async function testAPI() {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY not found in environment variables');
    return;
  }
  
  if (apiKey === 'YOUR_NEW_API_KEY_HERE') {
    console.error('❌ Please replace YOUR_NEW_API_KEY_HERE with your actual API key');
    return;
  }
  
  console.log('🔑 API Key found:', apiKey.substring(0, 10) + '...');
  
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-001',
      contents: 'Hello, this is a test message.'
    });
    
    console.log('✅ API Key is valid!');
    console.log('📝 Response:', response.text);
  } catch (error) {
    console.error('❌ API Key test failed:', error.message);
  }
}

testAPI();
