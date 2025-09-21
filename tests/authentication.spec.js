const { test, expect } = require('@playwright/test');

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Go to home page before each test and wait for the login elements to be visible
    await page.goto('http://localhost:3002');
    await page.waitForSelector('#loginScreen', { state: 'visible' });
    await page.waitForSelector('#loginForm', { state: 'visible' });
  });
  test.beforeEach(async ({ page }) => {
    // Go to home page before each test
    // Already handled in the first beforeEach
  });

  test('should show login screen by default', async ({ page }) => {
    // Check that the login screen is visible
    await expect(page.locator('#loginScreen')).toBeVisible();
    await expect(page.locator('#appScreen')).toBeHidden();
  });

  test('should show error with invalid credentials', async ({ page }) => {
    await page.fill('#loginEmail', 'wrong@email.com');
    await page.fill('#loginPassword', 'wrongpassword');
await page.click('form#loginForm button[type="submit"]');

    // Check for error message
    const errorMessage = page.locator('#loginError');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText('Invalid email or password');
  });

  test('should login successfully with correct admin credentials', async ({ page }) => {
    await page.fill('#loginEmail', 'admin@khscrm.com');
    await page.fill('#loginPassword', 'admin123');
    await page.click('.login-button');

    // Check that we're logged in
    await expect(page.locator('#loginScreen')).toBeHidden();
    await expect(page.locator('#appScreen')).toBeVisible();
await expect(page.locator('#profileName')).toContainText('Administrator');
  });

test('should allow admin access to user management', async ({ page }) => {
    // Login as admin first
    await page.fill('#loginEmail', 'admin@khscrm.com');
    await page.fill('#loginPassword', 'admin123');
    await page.click('.login-button');

    // Go to profile page
// Go to profile page by clicking profile nav card
await page.click('div[data-page="profile"]');

    // Check for user management section
    await expect(page.locator('#userManagementSection')).toBeVisible();
  });

  test('should allow admin to create a new user', async ({ page }) => {
    // Login as admin
    await page.fill('#loginEmail', 'admin@khscrm.com');
    await page.fill('#loginPassword', 'admin123');
    await page.click('.login-button');

    // Go to profile page
// Go to profile page by clicking profile nav card
await page.click('div[data-page="profile"]');

    // Click add user button
await page.click('.add-btn');

    // Fill in new user details
    await page.fill('#userEmail', 'worker@khscrm.com');
    await page.fill('#userName', 'Test Worker');
    await page.fill('#userPassword', 'worker123');
    await page.selectOption('#userRole', 'WORKER');

    // Submit form
await page.click('button.save-btn');

    // Verify user was added
    await expect(page.locator('.user-card')).toContainText('Test Worker');
    await expect(page.locator('.user-card')).toContainText('worker@khscrm.com');
  });

  test('should allow changing password', async ({ page }) => {
    // Login as admin
    await page.fill('#loginEmail', 'admin@khscrm.com');
    await page.fill('#loginPassword', 'admin123');
    await page.click('.login-button');

    // Go to profile page
    await page.click('text=Profile');

    // Change password
    await page.fill('#currentPassword', 'admin123');
    await page.fill('#newPassword', 'newadmin123');
    await page.fill('#confirmPassword', 'newadmin123');
    await page.click('#changePasswordForm >> text=Update Password');

    // Verify success (will show alert)
    const alertPromise = page.waitForEvent('dialog');
    const alert = await alertPromise;
    expect(alert.message()).toBe('Password changed successfully!');
    await alert.accept();

    // Verify can login with new password (after logging out)
    await page.click('text=Logout');
    await page.fill('#loginEmail', 'admin@khscrm.com');
    await page.fill('#loginPassword', 'newadmin123');
    await page.click('.login-button');

    // Verify logged in
    await expect(page.locator('#appScreen')).toBeVisible();

    // Reset password back for other tests
    await page.click('text=Profile');
    await page.fill('#currentPassword', 'newadmin123');
    await page.fill('#newPassword', 'admin123');
    await page.fill('#confirmPassword', 'admin123');
    await page.click('#changePasswordForm >> text=Update Password');
  });
});