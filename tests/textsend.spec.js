const { test, expect } = require('@playwright/test');

test.describe('Text Send', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin first (reuse the login helper if available)
    await page.goto('http://localhost:3002');
    await page.fill('#loginEmail', 'admin@khscrm.com');
    await page.fill('#loginPassword', 'admin123');
    await page.click('.login-button');
    
    // Go to settings page
    await page.click('div[data-page="settings"]');
    
    // Go to Text Send tab
    await page.click('.settings-tab[data-tab="textsend"]');
  });

  test('should show empty contact lists by default', async ({ page }) => {
    // Check that each table shows the empty state
    await expect(page.locator('.contact-table >> nth=0 >> .placeholder-row')).toContainText('No subs to display');
    await expect(page.locator('.contact-table >> nth=1 >> .placeholder-row')).toContainText('No workers to display');
    await expect(page.locator('.contact-table >> nth=2 >> .placeholder-row')).toContainText('No other contacts to display');
  });

  test('should be able to add a new contact', async ({ page }) => {
    // Click add contact button
    await page.click('button:has-text("+ Add Contact")');
    
    // Fill in contact details
    await page.fill('#contactName', 'Test Contact');
    await page.fill('#contactPhone', '(808) 555-1234');
    await page.fill('#contactAddress', '123 Test St');
    await page.check('input[name="contactType"][value="SUB"]');
    await page.fill('#contactNotes', 'Test notes');
    
    // Save the contact
    await page.click('button:has-text("Save Contact")');
    
    // Verify the contact appears in the subs table
    await expect(page.locator('.contact-table >> nth=0')).toContainText('Test Contact');
    await expect(page.locator('.contact-table >> nth=0')).toContainText('(808) 555-1234');
  });

  test('should validate phone numbers', async ({ page }) => {
    // Click add contact button
    await page.click('button:has-text("+ Add Contact")');
    
    // Fill in contact with invalid phone
    await page.fill('#contactName', 'Test Contact');
    await page.fill('#contactPhone', '(808) 555'); // Too short
    await page.check('input[name="contactType"][value="SUB"]');
    
    // Try to save
    await page.click('button:has-text("Save Contact")');
    
    // Verify error message
    const dialog = await page.waitForEvent('dialog');
    expect(dialog.message()).toBe('Phone number must be 7 or 10 digits');
    await dialog.accept();
    
    // Form should still be open
    await expect(page.locator('#contactModal')).toBeVisible();
  });

  test('should be able to edit a contact', async ({ page }) => {
    // First add a contact
    await page.click('button:has-text("+ Add Contact")');
    await page.fill('#contactName', 'Test Contact');
    await page.fill('#contactPhone', '(808) 555-1234');
    await page.check('input[name="contactType"][value="SUB"]');
    await page.click('button:has-text("Save Contact")');
    
    // Click edit button
    await page.click('button:has-text("Edit")');
    
    // Update contact details
    await page.fill('#contactName', 'Updated Contact');
    await page.fill('#contactPhone', '(808) 555-5678');
    
    // Save changes
    await page.click('button:has-text("Save Contact")');
    
    // Verify updates appear in table
    await expect(page.locator('.contact-table >> nth=0')).toContainText('Updated Contact');
    await expect(page.locator('.contact-table >> nth=0')).toContainText('(808) 555-5678');
  });

  test('should be able to delete a contact', async ({ page }) => {
    // First add a contact
    await page.click('button:has-text("+ Add Contact")');
    await page.fill('#contactName', 'Test Contact');
    await page.fill('#contactPhone', '(808) 555-1234');
    await page.check('input[name="contactType"][value="SUB"]');
    await page.click('button:has-text("Save Contact")');
    
    // Click delete button
    const deleteButton = page.locator('button:has-text("Delete")').first();
    await deleteButton.click();
    
    // Accept confirmation dialog
    const dialog = await page.waitForEvent('dialog');
    await dialog.accept();
    
    // Verify contact is removed
    await expect(page.locator('.contact-table >> nth=0 >> .placeholder-row')).toContainText('No subs to display');
  });
});