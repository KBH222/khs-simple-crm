const { test, expect } = require('@playwright/test');

test.describe('Workers - Team Member Centric Workflow', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    
    // Login if needed
    const loginBtn = page.locator('#loginBtn');
    if (await loginBtn.isVisible()) {
      await page.fill('input[type="email"]', 'admin@khscrm.com');
      await page.fill('input[type="password"]', 'admin123');
      await loginBtn.click();
    }
    
    // Navigate to Workers page
    await page.click('[data-page="workers"]');
    await expect(page.locator('#workers h2')).toContainText('Workers');
  });

  test('should display team members grid instead of tabs', async ({ page }) => {
    // Should show team members section
    await expect(page.locator('.team-members-section')).toBeVisible();
    await expect(page.locator('.team-members-section h3')).toContainText('Team Members');
    
    // Should have team members grid
    await expect(page.locator('.team-members-grid')).toBeVisible();
    
    // Should have Add Worker button
    await expect(page.locator('#addWorkerBtn')).toBeVisible();
    await expect(page.locator('#addWorkerBtn')).toContainText('+ Add Worker');
    
    // Should NOT have the old tab structure
    await expect(page.locator('.workers-tabs')).not.toBeVisible();
  });

  test('should display existing workers as colorful tiles', async ({ page }) => {
    // Check if workers are loaded (sample workers should exist)
    const workerTiles = page.locator('.team-member-tile');
    
    // Should have at least some worker tiles
    await expect(workerTiles.first()).toBeVisible();
    
    // Check tile structure
    const firstTile = workerTiles.first();
    await expect(firstTile.locator('.member-avatar')).toBeVisible();
    await expect(firstTile.locator('.member-name')).toBeVisible();
    await expect(firstTile.locator('.member-role')).toBeVisible();
    await expect(firstTile.locator('.member-hours')).toBeVisible();
    
    // Should have hover effect (checking for cursor pointer)
    await expect(firstTile).toHaveCSS('cursor', 'pointer');
  });

  test('should open Add Worker modal when button is clicked', async ({ page }) => {
    // Click Add Worker button
    await page.click('#addWorkerBtn');
    
    // Modal should appear
    await expect(page.locator('#workerModal')).toHaveClass(/active/);
    await expect(page.locator('#workerModalTitle')).toContainText('Add Worker');
    
    // Check form fields are present
    await expect(page.locator('#workerName')).toBeVisible();
    await expect(page.locator('#workerRole')).toBeVisible();
    await expect(page.locator('#workerHourlyRate')).toBeVisible();
    await expect(page.locator('#workerPhone')).toBeVisible();
    await expect(page.locator('#workerEmail')).toBeVisible();
    
    // Should have save button with correct text
    await expect(page.locator('#workerModal .save-btn')).toContainText('Save Worker');
  });

  test('should successfully create a new worker', async ({ page }) => {
    // Click Add Worker button
    await page.click('#addWorkerBtn');
    
    // Fill out worker form
    await page.fill('#workerName', 'John Playwright');
    await page.selectOption('#workerRole', 'Carpenter');
    await page.fill('#workerHourlyRate', '25.50');
    await page.fill('#workerPhone', '(555) 123-4567');
    await page.fill('#workerEmail', 'john.playwright@test.com');
    await page.fill('#workerNotes', 'Test worker created by Playwright');
    
    // Submit form
    await page.click('#workerModal .save-btn');
    
    // Modal should close
    await expect(page.locator('#workerModal')).not.toHaveClass(/active/);
    
    // New worker tile should appear in grid
    await expect(page.locator('.team-member-tile').last()).toBeVisible();
    
    // Check the new worker appears in the list
    const newWorkerTile = page.locator('.team-member-tile').filter({ hasText: 'John Playwright' }).first();
    await expect(newWorkerTile).toBeVisible();
  });

  test('should open worker detail modal when tile is clicked', async ({ page }) => {
    // Wait for worker tiles to load
    await page.waitForSelector('.team-member-tile', { timeout: 10000 });
    
    // Click on the first worker tile
    const firstTile = page.locator('.team-member-tile').first();
    await firstTile.click();
    
    // Worker detail modal should open
    await expect(page.locator('#workerDetailModal')).toHaveClass(/active/);
    await expect(page.locator('#workerDetailTitle')).toBeVisible();
    
    // Should have 4 tabs
    await expect(page.locator('.worker-detail-tab[data-tab="info"]')).toBeVisible();
    await expect(page.locator('.worker-detail-tab[data-tab="hours"]')).toBeVisible();
    await expect(page.locator('.worker-detail-tab[data-tab="tasks"]')).toBeVisible();
    await expect(page.locator('.worker-detail-tab[data-tab="notes"]')).toBeVisible();
    
    // Info tab should be active by default
    await expect(page.locator('.worker-detail-tab[data-tab="info"]')).toHaveClass(/active/);
    await expect(page.locator('#workerInfoTab')).toHaveClass(/active/);
  });

  test('should display worker info correctly in detail modal', async ({ page }) => {
    // Wait for worker tiles to load
    await page.waitForSelector('.team-member-tile', { timeout: 10000 });
    
    // Click on the first worker tile
    await page.locator('.team-member-tile').first().click();
    
    // Check worker info tab content
    await expect(page.locator('#workerDisplayName')).toBeVisible();
    await expect(page.locator('#workerDisplayRole')).toBeVisible();
    await expect(page.locator('#workerDisplayStatus')).toBeVisible();
    await expect(page.locator('#workerAvatar')).toBeVisible();
    
    // Check contact information section
    await expect(page.locator('#workerDisplayPhone')).toBeVisible();
    await expect(page.locator('#workerDisplayEmail')).toBeVisible();
    
    // Check employment details section
    await expect(page.locator('#workerDisplayRate')).toBeVisible();
    await expect(page.locator('#workerDisplayHireDate')).toBeVisible();
    
    // Check statistics section
    await expect(page.locator('#workerTotalHours')).toBeVisible();
    await expect(page.locator('#workerTotalEntries')).toBeVisible();
    await expect(page.locator('#workerWeekHours')).toBeVisible();
    
    // Should have Edit Info button
    await expect(page.locator('.edit-worker-detail-btn')).toContainText('Edit Info');
  });

  test('should switch between worker detail tabs correctly', async ({ page }) => {
    // Wait for worker tiles to load
    await page.waitForSelector('.team-member-tile', { timeout: 10000 });
    
    // Click on first worker tile
    await page.locator('.team-member-tile').first().click();
    
    // Test Hours tab
    await page.click('.worker-detail-tab[data-tab="hours"]');
    await expect(page.locator('.worker-detail-tab[data-tab="hours"]')).toHaveClass(/active/);
    await expect(page.locator('#workerHoursTab')).toHaveClass(/active/);
    await expect(page.locator('#workerTimesheetTable')).toBeVisible();
    
    // Test Tasks tab
    await page.click('.worker-detail-tab[data-tab="tasks"]');
    await expect(page.locator('.worker-detail-tab[data-tab="tasks"]')).toHaveClass(/active/);
    await expect(page.locator('#workerTasksTab')).toHaveClass(/active/);
    
    // Test Notes tab
    await page.click('.worker-detail-tab[data-tab="notes"]');
    await expect(page.locator('.worker-detail-tab[data-tab="notes"]')).toHaveClass(/active/);
    await expect(page.locator('#workerNotesTab')).toHaveClass(/active/);
    
    // Return to Info tab
    await page.click('.worker-detail-tab[data-tab="info"]');
    await expect(page.locator('.worker-detail-tab[data-tab="info"]')).toHaveClass(/active/);
    await expect(page.locator('#workerInfoTab')).toHaveClass(/active/);
  });

  test('should display worker timesheet in Hours tab', async ({ page }) => {
    // Wait for worker tiles to load
    await page.waitForSelector('.team-member-tile', { timeout: 10000 });
    
    // Click on first worker tile
    await page.locator('.team-member-tile').first().click();
    
    // Switch to Hours tab
    await page.click('.worker-detail-tab[data-tab="hours"]');
    
    // Check timesheet components
    await expect(page.locator('.worker-hours-header h4')).toContainText('Weekly Timesheet');
    await expect(page.locator('#workerCurrentWeek')).toBeVisible();
    await expect(page.locator('#workerPrevWeek')).toBeVisible();
    await expect(page.locator('#workerNextWeek')).toBeVisible();
    await expect(page.locator('#workerThisWeek')).toBeVisible();
    
    // Check Load/Save buttons
    await expect(page.locator('#loadWorkerHoursBtn')).toContainText('Load Hours');
    await expect(page.locator('#saveWorkerHoursBtn')).toContainText('Save Hours');
    
    // Check timesheet table
    await expect(page.locator('#workerTimesheetTable')).toBeVisible();
    await expect(page.locator('#workerTimesheetTable thead')).toBeVisible();
    await expect(page.locator('#workerTimesheetTable tbody')).toBeVisible();
    
    // Check all days are present
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    for (const day of days) {
      await expect(page.locator(`#workerTimesheetTable .day-header`).filter({ hasText: day })).toBeVisible();
    }
    
    // Check totals row
    await expect(page.locator('#workerTotalHoursWeek')).toBeVisible();
    await expect(page.locator('#workerTotalLunchWeek')).toBeVisible();
  });

  test('should close worker detail modal when close button is clicked', async ({ page }) => {
    // Wait for worker tiles to load
    await page.waitForSelector('.team-member-tile', { timeout: 10000 });
    
    // Click on first worker tile
    await page.locator('.team-member-tile').first().click();
    
    // Modal should be open
    await expect(page.locator('#workerDetailModal')).toHaveClass(/active/);
    
    // Click close button
    await page.click('#workerDetailModal .close-btn');
    
    // Modal should close
    await expect(page.locator('#workerDetailModal')).not.toHaveClass(/active/);
  });

  test('should handle empty workers state properly', async ({ page }) => {
    // If no workers exist, should show empty state message
    const workerTiles = page.locator('.team-member-tile');
    const count = await workerTiles.count();
    
    if (count === 0) {
      await expect(page.locator('.team-members-loading')).toContainText('No team members found');
      await expect(page.locator('.team-members-loading')).toContainText('+ Add Worker');
    }
  });
});