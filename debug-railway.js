// Debug Railway Database Issues
const https = require('https');

// Test Railway API connectivity
async function testRailwayAPI() {
  const railwayUrl = 'YOUR_RAILWAY_URL_HERE'; // Replace with actual Railway URL
  
  console.log('🔍 Testing Railway API connectivity...');
  
  try {
    // Test health endpoint
    const healthUrl = `${railwayUrl}/api/health`;
    console.log(`Testing: ${healthUrl}`);
    
    const healthResponse = await fetch(healthUrl);
    const healthData = await healthResponse.json();
    console.log('✅ Health check:', healthData);
    
    // Test customers endpoint  
    const customersUrl = `${railwayUrl}/api/customers`;
    console.log(`Testing: ${customersUrl}`);
    
    const customersResponse = await fetch(customersUrl);
    const customersData = await customersResponse.json();
    console.log('📊 Railway customers count:', customersData.length);
    console.log('📋 Railway customers:', customersData.map(c => c.name));
    
    // Compare with local
    const sqlite3 = require('sqlite3');
    const db = new sqlite3.Database('crm.db');
    
    db.all('SELECT name, created_at FROM customers ORDER BY created_at DESC', (err, rows) => {
      if (err) {
        console.error('❌ Local DB error:', err);
      } else {
        console.log('🏠 Local customers count:', rows.length);
        console.log('🏠 Local customers:', rows.map(c => `${c.name} (${c.created_at})`));
      }
      db.close();
    });
    
  } catch (error) {
    console.error('❌ Error testing Railway API:', error);
  }
}

// Run if executed directly
if (require.main === module) {
  testRailwayAPI();
}

module.exports = { testRailwayAPI };