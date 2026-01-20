import { test, expect } from '@playwright/test';

/**
 * E2E Test: Happy Path - Upload → Bid → Team → Notify
 *
 * Tests the complete user journey from RFP upload to team notification
 */

test.describe('Happy Path: Complete Bid Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to homepage and wait for it to load
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should complete full bid workflow', async ({ page }) => {
    // Step 1: Navigate to new bid page
    await page.click('text=New Bid');
    await expect(page).toHaveURL(/\/bids\/new/);

    // Step 2: Upload RFP (using text input for test)
    await page.fill('textarea[name="rawInput"]', 'Test RFP from Acme Corporation for website relaunch');
    await page.selectOption('select[name="source"]', 'reactive');
    await page.selectOption('select[name="stage"]', 'rfp');
    await page.selectOption('select[name="inputType"]', 'freetext');

    // Step 3: Submit and wait for extraction
    await page.click('button[type="submit"]');

    // Should redirect to RFP detail page
    await expect(page).toHaveURL(/\/bids\/[a-z0-9]+/);

    // Wait for extraction to complete (should show extracted requirements)
    await page.waitForSelector('text=Client Name', { timeout: 10000 });

    // Step 4: Review and confirm extracted data
    await expect(page.locator('text=Acme Corporation')).toBeVisible();

    // Step 5: Trigger quick scan
    await page.click('text=Start Quick Scan');
    await page.waitForSelector('text=Quick Scan Results', { timeout: 15000 });

    // Step 6: Check recommendation
    await expect(page.locator('text=Recommendation')).toBeVisible();

    // Step 7: Make Bid decision
    await page.click('text=Proceed to Evaluation');
    await page.waitForSelector('text=Decision Tree', { timeout: 20000 });

    // Step 8: Verify decision is made
    await expect(page.locator('text=Decision: Bid')).toBeVisible();

    // Step 9: Assign to Business Unit
    await page.click('text=Assign to BU');
    await page.selectOption('select[name="businessUnit"]', { index: 1 });
    await page.click('button:has-text("Confirm")');

    // Step 10: Verify routing completed
    await expect(page.locator('text=Routed to')).toBeVisible();

    // Step 11: Navigate to BL dashboard (simulated)
    // In a real test, we would switch user roles here

    // Success: Complete workflow executed
    await expect(page).toHaveURL(/\/bids\/[a-z0-9]+/);
  });
});

test.describe('No Bid with Alternative Recommendation', () => {
  test('should handle no-bid decision gracefully', async ({ page }) => {
    await page.goto('/');

    // Create new bid
    await page.click('text=New Bid');
    await page.fill('textarea[name="rawInput"]', 'Small WordPress project with limited budget');
    await page.selectOption('select[name="source"]', 'reactive');
    await page.selectOption('select[name="stage"]', 'cold');
    await page.selectOption('select[name="inputType"]', 'freetext');

    await page.click('button[type="submit"]');

    // Wait for extraction
    await page.waitForSelector('text=Client Name', { timeout: 10000 });

    // Quick scan should recommend no-bid
    await page.click('text=Start Quick Scan');
    await page.waitForSelector('text=Quick Scan Results', { timeout: 15000 });

    // Make No-Bid decision
    await page.click('text=Archive (No Bid)');

    // Should show alternative recommendation
    await expect(page.locator('text=Alternative')).toBeVisible();

    // Verify status is archived
    await expect(page.locator('text=Archived')).toBeVisible();
  });
});
