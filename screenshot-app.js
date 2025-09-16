const { chromium } = require('playwright');

async function screenshotApp() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    console.log('📸 Taking screenshots of KHS-CRM application...');
    
    // Set viewport size
    await page.setViewportSize({ width: 1200, height: 800 });
    
    // Navigate to the app
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    
    // Take dashboard screenshot
    await page.screenshot({ 
      path: 'dashboard-screenshot.png', 
      fullPage: true 
    });
    console.log('✅ Dashboard screenshot saved: dashboard-screenshot.png');
    
    // Navigate to customers page
    await page.click('[data-page="customers"]');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000); // Wait for customers to load
    
    // Take customers screenshot
    await page.screenshot({ 
      path: 'customers-screenshot.png', 
      fullPage: true 
    });
    console.log('✅ Customers screenshot saved: customers-screenshot.png');
    
    // Take mobile view screenshot (iPhone size)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ 
      path: 'customers-mobile-screenshot.png', 
      fullPage: true 
    });
    console.log('✅ Mobile customers screenshot saved: customers-mobile-screenshot.png');
    
  } catch (error) {
    console.error('❌ Error taking screenshots:', error.message);
  } finally {
    await browser.close();
  }
}

screenshotApp();