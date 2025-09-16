const { test, expect } = require('@playwright/test');

test.describe('CRM Basic Navigation', () => {
  test('should load the CRM homepage and login successfully', async ({ page }) => {
    await page.goto('/');
    
    // Check if we're on the login page or already logged in
    const isLoggedIn = await page.locator('.app-header').isVisible();
    
    if (!isLoggedIn) {
      // We're on login page - perform login
      await expect(page.locator('h1')).toContainText('KHS CRM');
      await expect(page.locator('input[type="email"]')).toBeVisible();
      
      // Login with admin credentials
      await page.fill('input[type="email"]', 'admin@khscrm.com');
      await page.fill('input[type="password"]', 'admin123');
      await page.click('#loginBtn');
    }
    
    // Should be on dashboard after login
    await expect(page.locator('.app-header')).toBeVisible();
    await expect(page.locator('.app-title')).toContainText('KHS CRM');
    await expect(page.locator('#currentDate')).toBeVisible();
    await expect(page.locator('#currentTime')).toBeVisible();
  });

  test('should navigate to all main sections', async ({ page }) => {
    await page.goto('/');
    
    // Ensure we're logged in
    const loginBtn = page.locator('#loginBtn');
    if (await loginBtn.isVisible()) {
      await page.fill('input[type="email"]', 'admin@khscrm.com');
      await page.fill('input[type="password"]', 'admin123');
      await loginBtn.click();
    }
    
    // Test navigation to each section
    const sections = [
      { card: '[data-page="customers"]', title: 'Customers' },
      { card: '[data-page="workers"]', title: 'Workers' },
      { card: '[data-page="schedule"]', title: 'Schedule' },
      { card: '[data-page="settings"]', title: 'Settings' }
    ];
    
    for (const section of sections) {
      await page.click(section.card);
      // Wait for navigation and check the active page has the correct title
      await expect(page.locator('.page.active h2')).toContainText(section.title);
      
      // Wait for back button to be visible and clickable, then navigate back to dashboard
      const backBtn = page.locator('.page.active .back-btn');
      await expect(backBtn).toBeVisible();
      await backBtn.click();
      await expect(page.locator('.nav-grid')).toBeVisible();
    }
  });

  test('should display correct dashboard quick access cards', async ({ page }) => {
    await page.goto('/');
    
    // Login if needed
    const loginBtn = page.locator('#loginBtn');
    if (await loginBtn.isVisible()) {
      await page.fill('input[type="email"]', 'admin@khscrm.com');
      await page.fill('input[type="password"]', 'admin123');
      await loginBtn.click();
    }
    
    // Check all quick access cards are present
    await expect(page.locator('[data-page="customers"]')).toBeVisible();
    await expect(page.locator('[data-page="workers"]')).toBeVisible();
    await expect(page.locator('[data-page="schedule"]')).toBeVisible();
    await expect(page.locator('[data-page="settings"]')).toBeVisible();
    await expect(page.locator('[data-page="materials"]')).toBeVisible();
    await expect(page.locator('[data-page="profile"]')).toBeVisible();
    
    // Check card content
    await expect(page.locator('[data-page="customers"] h3')).toContainText('Customers');
    await expect(page.locator('[data-page="workers"] h3')).toContainText('Workers');
    await expect(page.locator('[data-page="schedule"] h3')).toContainText('Schedule');
  });
});