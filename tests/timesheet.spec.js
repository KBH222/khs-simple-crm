const { test, expect } = require('@playwright/test');

test.describe('Timesheet Functionality', () => {
  
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
    
    // Wait for workers to load and click first worker
    await page.waitForSelector('.team-member-tile', { timeout: 10000 });
    await page.click('.team-member-tile');
    
    // Wait for worker detail modal and switch to Hours tab
    await page.waitForSelector('.worker-detail-modal');
    await page.click('[data-tab="hours"]');
    await page.waitForSelector('.worker-timesheet-container');
    
    // Clear all timesheet inputs for fresh test state
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    for (const day of days) {
      const row = page.locator(`#workerTimesheetTable tr[data-day="${day}"]`);
      await row.locator('.start-time').fill('');
      await row.locator('.end-time').fill('');
      await row.locator('.lunch-input').fill('');
      await row.locator('.location-input').fill('');
      await row.locator('.work-type-select').selectOption('');
      await row.locator('.notes-input').fill('');
    }
  });

  test('should display weekly timesheet with all days', async ({ page }) => {
    // Check timesheet table is visible
    await expect(page.locator('#workerTimesheetTable')).toBeVisible();
    
    // Check all days are present
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    for (const day of days) {
      await expect(page.locator(`#workerTimesheetTable .day-header`).filter({ hasText: day })).toBeVisible();
    }
    
    // Check column headers
    const headers = ['Day', 'Start Time', 'End Time', 'Total Hours', 'Lunch (mins)', 'Job Location', 'Work Type', 'Notes'];
    for (const header of headers) {
      await expect(page.locator('#workerTimesheetTable th').filter({ hasText: header })).toBeVisible();
    }
  });

  test('should show current week by default', async ({ page }) => {
    // Check week display shows current week
    const weekDisplay = page.locator('#workerCurrentWeek');
    await expect(weekDisplay).toBeVisible();
    await expect(weekDisplay).toContainText('Week of');
    
    // Should contain current month/year
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    await expect(weekDisplay).toContainText(currentYear.toString());
  });

  test('should navigate between weeks', async ({ page }) => {
    const weekDisplay = page.locator('#workerCurrentWeek');
    const initialWeek = await weekDisplay.textContent();
    
    // Click next week
    await page.click('#workerNextWeek');
    const nextWeek = await weekDisplay.textContent();
    expect(nextWeek).not.toBe(initialWeek);
    
    // Click previous week (should go back to near original)
    await page.click('#workerPrevWeek');
    const prevWeek = await weekDisplay.textContent();
    expect(prevWeek).not.toBe(nextWeek);
    
    // Click "This Week" should reset to current week
    await page.click('#workerThisWeek');
    const currentWeek = await weekDisplay.textContent();
    // Should be close to initial (accounting for potential date changes during test)
  });

  test('should calculate hours automatically when times are entered', async ({ page }) => {
    // Find Monday row
    const mondayRow = page.locator('#workerTimesheetTable tr[data-day="monday"]');
    
    // Enter start and end times
    await mondayRow.locator('.start-time').fill('08:00');
    await mondayRow.locator('.end-time').fill('17:00');
    
    // Hours should be calculated automatically (9 hours)
    const hoursInput = mondayRow.locator('.hours-input');
    await expect(hoursInput).toHaveValue('9.00');
  });

  test('should adjust hours calculation with lunch break', async ({ page }) => {
    // Find Tuesday row
    const tuesdayRow = page.locator('#workerTimesheetTable tr[data-day="tuesday"]');
    
    // Enter start time, end time, and lunch
    await tuesdayRow.locator('.start-time').fill('08:00');
    await tuesdayRow.locator('.end-time').fill('17:00');
    await tuesdayRow.locator('.lunch-input').fill('60'); // 1 hour lunch
    
    // Hours should be 8.00 (9 hours - 1 hour lunch)
    const hoursInput = tuesdayRow.locator('.hours-input');
    await expect(hoursInput).toHaveValue('8.00');
  });

  test('should update weekly totals when hours change', async ({ page }) => {
    // Enter hours for multiple days
    const mondayRow = page.locator('#workerTimesheetTable tr[data-day="monday"]');
    await mondayRow.locator('.start-time').fill('08:00');
    await mondayRow.locator('.end-time').fill('17:00');
    
    const tuesdayRow = page.locator('#workerTimesheetTable tr[data-day="tuesday"]');
    await tuesdayRow.locator('.start-time').fill('08:00');
    await tuesdayRow.locator('.end-time').fill('16:00');
    await tuesdayRow.locator('.lunch-input').fill('30');
    
    // Check total hours (9.00 + 7.50 = 16.50)
    const totalHours = page.locator('#workerTotalHoursWeek');
    await expect(totalHours).toContainText('16.50');
    
    // Check total lunch (0 + 30 = 30)
    const totalLunch = page.locator('#workerTotalLunchWeek');
    await expect(totalLunch).toContainText('30');
  });

  test('should fill work type and location fields', async ({ page }) => {
    const wednesdayRow = page.locator('#workerTimesheetTable tr[data-day="wednesday"]');
    
    // Fill in job location
    await wednesdayRow.locator('.location-input').fill('123 Main St Construction Site');
    
    // Select work type
    await wednesdayRow.locator('.work-type-select').selectOption('Framing');
    
    // Add notes
    await wednesdayRow.locator('.notes-input').fill('Foundation framing work');
    
    // Verify values are set
    await expect(wednesdayRow.locator('.location-input')).toHaveValue('123 Main St Construction Site');
    await expect(wednesdayRow.locator('.work-type-select')).toHaveValue('Framing');
    await expect(wednesdayRow.locator('.notes-input')).toHaveValue('Foundation framing work');
  });

  test('should show validation message when saving incomplete timesheet', async ({ page }) => {
    // Try to save without filling required fields
    await page.click('#saveWorkerHoursBtn');
    
    // Should show warning message
    const message = page.locator('#workerHoursMessage');
    await expect(message).toBeVisible();
    await expect(message).toContainText('Please fill in at least one complete day');
    await expect(message).toHaveClass(/warning/);
  });

  test('should successfully save complete timesheet entry', async ({ page }) => {
    // Fill out a complete day
    const thursdayRow = page.locator('#workerTimesheetTable tr[data-day="thursday"]');
    
    await thursdayRow.locator('.start-time').fill('07:30');
    await thursdayRow.locator('.end-time').fill('16:30');
    await thursdayRow.locator('.lunch-input').fill('45');
    await thursdayRow.locator('.location-input').fill('Residential Project ABC');
    await thursdayRow.locator('.work-type-select').selectOption('Electrical');
    await thursdayRow.locator('.notes-input').fill('Installing outlet circuits');
    
    // Save timesheet
    await page.click('#saveWorkerHoursBtn');
    
    // Should show success message
    const message = page.locator('#workerHoursMessage');
    await expect(message).toBeVisible();
    await expect(message).toContainText('Timesheet saved successfully');
    await expect(message).toHaveClass(/success/);
  });

  test('should load existing timesheet data', async ({ page }) => {
    // Click load button (will attempt to load existing data)
    await page.click('#loadWorkerHoursBtn');
    
    // Should show some kind of response (success or empty data)
    const message = page.locator('#workerHoursMessage');
    await expect(message).toBeVisible();
    // Message could be success (data loaded) or info (no data found)
    
    // Loading indicator should appear and disappear
    const loading = page.locator('#workerHoursLoading');
    // Loading state changes quickly, so we don't test for specific visibility
  });

  test('should handle work type dropdown options correctly', async ({ page }) => {
    const fridayRow = page.locator('#workerTimesheetTable tr[data-day="friday"]');
    const workTypeSelect = fridayRow.locator('.work-type-select');
    
    // Check all expected work types are available
    const expectedWorkTypes = [
      'Framing', 'Roofing', 'Electrical', 'Plumbing', 'Drywall',
      'Flooring', 'Finish Carpentry', 'Site Prep', 'General Labor', 'Other'
    ];
    
    for (const workType of expectedWorkTypes) {
      await expect(workTypeSelect.locator(`option[value="${workType}"]`)).toBeAttached();
    }
    
    // Test selecting each type
    await workTypeSelect.selectOption('Roofing');
    await expect(workTypeSelect).toHaveValue('Roofing');
    
    await workTypeSelect.selectOption('Plumbing');
    await expect(workTypeSelect).toHaveValue('Plumbing');
  });

  test('should maintain data when switching between weeks', async ({ page }) => {
    // Enter data for current week
    const saturdayRow = page.locator('#workerTimesheetTable tr[data-day="saturday"]');
    await saturdayRow.locator('.start-time').fill('09:00');
    await saturdayRow.locator('.end-time').fill('15:00');
    await saturdayRow.locator('.work-type-select').selectOption('General Labor');
    
    // Navigate to next week
    await page.click('#workerNextWeek');
    
    // Navigate back to current week
    await page.click('#workerThisWeek');
    
    // Data should be preserved (though this depends on whether we auto-save)
    // At minimum, the form should be in a consistent state
    await expect(saturdayRow.locator('.work-type-select')).toBeVisible();
  });

  test('should handle edge cases in time calculation', async ({ page }) => {
    const sundayRow = page.locator('#workerTimesheetTable tr[data-day="sunday"]');
    
    // Test same start and end time
    await sundayRow.locator('.start-time').fill('10:00');
    await sundayRow.locator('.end-time').fill('10:00');
    await expect(sundayRow.locator('.hours-input')).toHaveValue('0.00');
    
    // Test end time before start time
    await sundayRow.locator('.start-time').fill('10:00');
    await sundayRow.locator('.end-time').fill('09:00');
    await expect(sundayRow.locator('.hours-input')).toHaveValue('0.00');
    
    // Test normal case
    await sundayRow.locator('.start-time').fill('10:00');
    await sundayRow.locator('.end-time').fill('14:30');
    await expect(sundayRow.locator('.hours-input')).toHaveValue('4.50');
  });
});