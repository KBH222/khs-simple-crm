const { test, expect } = require('@playwright/test');

test.describe('Critical Functionality Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    
    // Login if needed
    const loginBtn = page.locator('#loginBtn');
    if (await loginBtn.isVisible()) {
      await page.fill('input[type="email"]', 'admin@khscrm.com');
      await page.fill('input[type="password"]', 'admin123');
      await loginBtn.click();
    }
  });

  test('critical: all main navigation works', async ({ page }) => {
    // Test all critical navigation paths
    const pages = [
      { selector: '[data-page="customers"]', title: 'Customers' },
      { selector: '[data-page="workers"]', title: 'Workers' },
      { selector: '[data-page="schedule"]', title: 'Schedule' },
      { selector: '[data-page="settings"]', title: 'Settings' }
    ];

    for (const pageInfo of pages) {
      await page.click(pageInfo.selector);
      await expect(page.locator('.page.active h2')).toContainText(pageInfo.title);
      
      // Go back to dashboard
      await page.click('.back-btn');
      await expect(page.locator('.nav-grid')).toBeVisible();
    }
  });

  test('critical: customer form opens and closes', async ({ page }) => {
    // Navigate to customers
    await page.click('[data-page="customers"]');
    
    // Open add customer modal
    await page.click('#addCustomerBtn');
    await expect(page.locator('#customerModal')).toBeVisible();
    
    // Verify form elements exist
    await expect(page.locator('#customerName')).toBeVisible();
    await expect(page.locator('#customerPhone')).toBeVisible();
    await expect(page.locator('#customerEmail')).toBeVisible();
    await expect(page.locator('#customerStreet')).toBeVisible();
    await expect(page.locator('#customerCity')).toBeVisible();
    await expect(page.locator('#customerZip')).toBeVisible();
    
    // Verify radio buttons work
    await expect(page.locator('input[name="customerReference"]')).toBeVisible();
    await expect(page.locator('input[name="customerType"]')).toBeVisible();
    
    // Close modal
    await page.click('.cancel-btn');
    await expect(page.locator('#customerModal')).not.toBeVisible();
  });

  test('critical: phone number formatting works', async ({ page }) => {
    await page.click('[data-page="customers"]');
    await page.click('#addCustomerBtn');
    
    // Test phone formatting
    await page.fill('#customerPhone', '8081234567');
    await page.click('#customerName'); // Trigger blur
    
    const phoneValue = await page.locator('#customerPhone').inputValue();
    expect(phoneValue).toContain('(808)');
    expect(phoneValue).toContain('-');
  });

  test('critical: settings page loads', async ({ page }) => {
    await page.click('[data-page="settings"]');
    await expect(page.locator('.settings-tabs')).toBeVisible();
    
    // Test backup tab
    await page.click('.settings-tab[data-tab="backup"]');
    await expect(page.locator('#backupContent')).toBeVisible();
    await expect(page.locator('.backup-btn')).toBeVisible();
  });

  test('critical: workers page loads', async ({ page }) => {
    await page.click('[data-page="workers"]');
    await expect(page.locator('.workers-tabs')).toBeVisible();
    
    // Test add worker button
    await expect(page.locator('#addWorkerBtn')).toBeVisible();
  });

  test('critical: schedule page loads', async ({ page }) => {
    await page.click('[data-page="schedule"]');
    await expect(page.locator('.calendar-nav')).toBeVisible();
    await expect(page.locator('#addEventBtn')).toBeVisible();
  });

  test('critical: all modals can open and close', async ({ page }) => {
    // Test customer modal
    await page.click('[data-page="customers"]');
    await page.click('#addCustomerBtn');
    await expect(page.locator('#customerModal')).toBeVisible();
    await page.click('.close-btn');
    await expect(page.locator('#customerModal')).not.toBeVisible();

    // Test schedule event modal  
    await page.click('[data-page="schedule"]');
    await page.click('#addEventBtn');
    await expect(page.locator('#eventModal')).toBeVisible();
    await page.click('#eventModal .close-btn');
    await expect(page.locator('#eventModal')).not.toBeVisible();

    // Test workers modal
    await page.click('[data-page="workers"]');
    await page.click('#addWorkerBtn');
    await expect(page.locator('#workerModal')).toBeVisible();
    await page.click('#workerModal .close-btn');
    await expect(page.locator('#workerModal')).not.toBeVisible();
  });

  test('critical: form validation works', async ({ page }) => {
    await page.click('[data-page="customers"]');
    await page.click('#addCustomerBtn');
    
    // Try to submit empty form
    await page.click('.save-btn');
    
    // Form should not submit (modal stays visible)
    await expect(page.locator('#customerModal')).toBeVisible();
    
    // Required fields should have validation
    await expect(page.locator('#customerName')).toHaveAttribute('required');
  });

  test('critical: responsive design works', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Dashboard should be visible
    await expect(page.locator('.nav-grid')).toBeVisible();
    
    // Navigation should work on mobile
    await page.click('[data-page="customers"]');
    await expect(page.locator('.page.active h2')).toContainText('Customers');
    
    // Modal should work on mobile
    await page.click('#addCustomerBtn');
    await expect(page.locator('#customerModal')).toBeVisible();
    
    // Reset viewport
    await page.setViewportSize({ width: 1280, height: 720 });
  });
});

// Performance test to ensure cleanup doesn't slow things down
test.describe('Performance Check', () => {
  test('pages load quickly', async ({ page }) => {
    // Measure page load time
    const startTime = Date.now();
    
    await page.goto('/');
    
    const loginBtn = page.locator('#loginBtn');
    if (await loginBtn.isVisible()) {
      await page.fill('input[type="email"]', 'admin@khscrm.com');
      await page.fill('input[type="password"]', 'admin123');
      await loginBtn.click();
    }
    
    await expect(page.locator('.nav-grid')).toBeVisible();
    
    const loadTime = Date.now() - startTime;
    console.log(`Page load time: ${loadTime}ms`);
    
    // Should load in under 3 seconds
    expect(loadTime).toBeLessThan(3000);
  });
});