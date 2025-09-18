const { chromium } = require('playwright');

async function debugCustomers() {
  console.log('🔍 Starting Playwright debugging for customer loading...');
  
  const browser = await chromium.launch({ headless: false, slowMo: 1000 });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Listen for console messages
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    console.log(`[BROWSER ${type.toUpperCase()}] ${text}`);
  });
  
  // Listen for errors
  page.on('pageerror', error => {
    console.log(`[PAGE ERROR] ${error.message}`);
  });
  
  // Listen for network requests
  page.on('request', request => {
    if (request.url().includes('/api/')) {
      console.log(`[REQUEST] ${request.method()} ${request.url()}`);
    }
  });
  
  page.on('response', response => {
    if (response.url().includes('/api/')) {
      console.log(`[RESPONSE] ${response.status()} ${response.url()}`);
    }
  });
  
  try {
    console.log('📂 Navigating to CRM app...');
    await page.goto('http://localhost:3002');
    
    console.log('⏳ Waiting for page load...');
    await page.waitForTimeout(2000);
    
    console.log('👥 Clicking Customers nav card...');
    await page.click('[data-page="customers"]');
    
    console.log('⏳ Waiting for customers page...');
    await page.waitForTimeout(3000);
    
    // Check if customers list exists
    const customersList = await page.locator('#customersList');
    const exists = await customersList.count();
    console.log(`📋 Customers list element exists: ${exists > 0}`);
    
    // Get the content of customers list
    const content = await customersList.innerHTML();
    console.log(`📋 Customers list content: "${content.substring(0, 200)}..."`);
    
    // Check for customer cards
    const customerCards = await page.locator('.customer-card-grid').count();
    console.log(`👥 Number of customer cards found: ${customerCards}`);
    
    // Check if loading message is still showing
    const loadingText = await page.textContent('#customersList');
    console.log(`📝 Customers list text content: "${loadingText?.substring(0, 100)}..."`);
    
    // Check the global customers array
    const customersArray = await page.evaluate(() => {
      return window.customers || [];
    });
    console.log(`📊 Global customers array length: ${customersArray.length}`);
    console.log(`📊 Global customers data:`, customersArray);
    
    // Test API call directly in browser
    console.log('🔗 Testing API call directly in browser...');
    const apiResult = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/customers');
        const data = await response.json();
        return { status: response.status, data: data };
      } catch (error) {
        return { error: error.message };
      }
    });
    console.log('🔗 API call result:', apiResult);
    
    // Check if loadCustomers function exists and call it
    console.log('🔧 Testing loadCustomers function...');
    const loadResult = await page.evaluate(async () => {
      try {
        if (typeof loadCustomers === 'function') {
          await loadCustomers();
          return { success: true, customersLength: customers.length };
        } else {
          return { error: 'loadCustomers function not found' };
        }
      } catch (error) {
        return { error: error.message };
      }
    });
    console.log('🔧 loadCustomers result:', loadResult);
    
    // Wait a bit more and check again
    await page.waitForTimeout(2000);
    const finalCount = await page.locator('.customer-card-grid').count();
    console.log(`👥 Final customer cards count: ${finalCount}`);
    
    console.log('✅ Debug session complete. Browser will stay open for manual inspection.');
    console.log('Press Ctrl+C when done...');
    
    // Keep browser open for manual inspection
    await page.waitForTimeout(60000);
    
  } catch (error) {
    console.error('❌ Debug error:', error);
  } finally {
    await browser.close();
  }
}

debugCustomers().catch(console.error);