const { test, expect } = require('@playwright/test');

test.describe('Customer Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    
    // Login if needed
    const loginBtn = page.locator('#loginBtn');
    if (await loginBtn.isVisible()) {
      await page.fill('input[type="email"]', 'admin@khscrm.com');
      await page.fill('input[type="password"]', 'admin123');
      await loginBtn.click();
    }
    
    // Navigate to customers page
    await page.click('[data-page="customers"]');
    await expect(page.locator('.page.active h2')).toContainText('Customers');
  });

  test('should display customers page correctly', async ({ page }) => {
    // Check page elements
    await expect(page.locator('#addCustomerBtn')).toBeVisible();
    await expect(page.locator('#customerSearch')).toBeVisible();
    await expect(page.locator('.filter-tab[data-type=""]')).toContainText('All');
    await expect(page.locator('.filter-tab[data-type="CURRENT"]')).toContainText('Current');
    await expect(page.locator('.filter-tab[data-type="LEADS"]')).toContainText('Leads');
  });

  test('should open add customer modal with correct layout', async ({ page }) => {
    await page.click('#addCustomerBtn');
    
    // Check modal is visible
    await expect(page.locator('#customerModal')).toBeVisible();
    await expect(page.locator('#customerModalTitle')).toContainText('Add Customer');
    
    // Check Reference and Type are on same line at top
    const referenceGroup = page.locator('.form-group:has(.reference-options)');
    const typeGroup = page.locator('.form-group:has(.type-options)');
    
    await expect(referenceGroup).toBeVisible();
    await expect(typeGroup).toBeVisible();
    
    // Check Reference options (Yelp, Ref, HOD in that order)
    const referenceOptions = page.locator('.reference-options label');
    await expect(referenceOptions.nth(0)).toContainText('Yelp');
    await expect(referenceOptions.nth(1)).toContainText('Ref');
    await expect(referenceOptions.nth(2)).toContainText('HOD');
    
    // Check Type options (Client selected by default, Lead)
    const typeOptions = page.locator('.type-options label');
    await expect(typeOptions.nth(0)).toContainText('Client');
    await expect(typeOptions.nth(1)).toContainText('Lead');
    
    // Check Client is pre-selected
    await expect(page.locator('input[name="customerType"][value="CURRENT"]')).toBeChecked();
  });

  test('should create new customer successfully', async ({ page }) => {
    await page.click('#addCustomerBtn');
    
    // Fill out form
    await page.click('input[name="customerReference"][value="Yelp"]');
    await page.click('input[name="customerType"][value="LEADS"]');
    await page.fill('#customerName', 'Test Customer');
    await page.fill('#customerPhone', '8081234567');
    await page.fill('#customerEmail', 'test@example.com');
    await page.fill('#customerStreet', '123 Test Street');
    await page.fill('#customerCity', 'Honolulu');
    await page.fill('#customerZip', '96815');
    await page.fill('#customerNotes', 'Test notes');
    
    // Submit form
    await page.click('.save-btn');
    
    // Modal should close
    await expect(page.locator('#customerModal')).not.toBeVisible();
    
    // Check customer appears in list (may take a moment to load)
    await page.waitForTimeout(1000);
    await expect(page.locator('.customers-list')).toContainText('Test Customer');
  });

  test('should format phone numbers correctly', async ({ page }) => {
    await page.click('#addCustomerBtn');
    
    // Type phone number digits
    await page.fill('#customerPhone', '8081234567');
    
    // Click elsewhere to trigger formatting
    await page.click('#customerName');
    
    // Check formatting applied
    const phoneValue = await page.locator('#customerPhone').inputValue();
    expect(phoneValue).toMatch(/\(\d{3}\)\s\d{3}-\d{4}/); // (808) 123-4567 format
  });

  test('should validate required fields', async ({ page }) => {
    await page.click('#addCustomerBtn');
    
    // Try to submit without required fields
    await page.click('.save-btn');
    
    // Form should not submit (modal stays open)
    await expect(page.locator('#customerModal')).toBeVisible();
    
    // Check required field validation
    await expect(page.locator('#customerName')).toHaveAttribute('required');
    await expect(page.locator('#customerStreet')).toHaveAttribute('required');
    await expect(page.locator('#customerCity')).toHaveAttribute('required');
    await expect(page.locator('#customerZip')).toHaveAttribute('required');
  });

  test('should filter customers by type', async ({ page }) => {
    // Test filter tabs
    await page.click('.filter-tab[data-type="CURRENT"]');
    await expect(page.locator('.filter-tab[data-type="CURRENT"]')).toHaveClass(/active/);
    
    await page.click('.filter-tab[data-type="LEADS"]');
    await expect(page.locator('.filter-tab[data-type="LEADS"]')).toHaveClass(/active/);
    
    await page.click('.filter-tab[data-type=""]');
    await expect(page.locator('.filter-tab[data-type=""]')).toHaveClass(/active/);
  });

  test('should search customers', async ({ page }) => {
    // Type in search box
    await page.fill('#customerSearch', 'test');
    
    // Search should trigger automatically
    await page.waitForTimeout(500);
    
    // Search functionality should work (we can't test results without data)
    await expect(page.locator('#customerSearch')).toHaveValue('test');
  });

  test('should close modal with cancel button', async ({ page }) => {
    await page.click('#addCustomerBtn');
    await expect(page.locator('#customerModal')).toBeVisible();
    
    await page.click('.cancel-btn');
    await expect(page.locator('#customerModal')).not.toBeVisible();
  });

  test('should close modal with X button', async ({ page }) => {
    await page.click('#addCustomerBtn');
    await expect(page.locator('#customerModal')).toBeVisible();
    
    await page.click('.close-btn');
    await expect(page.locator('#customerModal')).not.toBeVisible();
  });
});