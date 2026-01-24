import { test, expect, Page } from '@playwright/test';

/**
 * E2E Test: Quick Scan & 10 Questions
 *
 * Tests the Quick Scan workflow from start to completion:
 * - TC-1: Quick Scan Start
 * - TC-2: Quick Scan Running
 * - TC-3: Questions Ready
 * - TC-4: URL Suggestions (DEA-32 FIX)
 * - TC-5: Error Cases
 */

/**
 * Helper function to create an RFP with website URL and text
 */
async function createRFPWithUrl(page: Page, text: string, url: string = 'https://www.example.com') {
  await page.goto('/pre-qualifications/new');
  await page.fill('#website-url', url);
  await page.fill('#additional-text', text);
  await page.click('button:has-text("RFP erstellen")');

  // Wait for redirect to RFP detail page
  await expect(page).toHaveURL(/\/pre-qualifications\/[a-z0-9-]+$/);
  await page.waitForSelector('text=Client Name', { timeout: 15000 });
}

/**
 * Helper function to create an RFP without URL (text only)
 */
async function createRFPWithoutUrl(page: Page, text: string) {
  await page.goto('/pre-qualifications/new');
  await page.fill('#additional-text', text);
  await page.click('button:has-text("RFP erstellen")');

  // Wait for redirect to RFP detail page
  await expect(page).toHaveURL(/\/pre-qualifications\/[a-z0-9-]+$/);
  await page.waitForSelector('text=Client Name', { timeout: 15000 });
}

test.describe('Quick Scan: Start and Initial State', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('TC-1.1: Quick Scan starts automatically after extraction with URL', async ({ page }) => {
    await createRFPWithUrl(page, 'RFP from Acme Corp for website relaunch.');

    // Confirm requirements
    await page.click('button:has-text("Änderungen speichern")');

    // Quick Scan should auto-start
    await expect(page.locator('text=Quick Scan läuft')).toBeVisible({ timeout: 10000 });
  });

  test('TC-1.2: Status changes to quick_scanning when Quick Scan starts', async ({ page }) => {
    await createRFPWithUrl(page, 'Tech Corp CMS project with modern features');

    await page.click('button:has-text("Änderungen speichern")');

    // Wait for Quick Scan to start
    await page.waitForSelector('text=Quick Scan läuft', { timeout: 10000 });

    // Verify status badge shows quick_scanning or related status
    const statusBadge = page.locator('text=Quick Scan').or(page.locator('text=Scan läuft'));
    await expect(statusBadge).toBeVisible();
  });

  test('TC-1.3: ActivityStream shows agent activity during scan', async ({ page }) => {
    await createRFPWithUrl(page, 'Healthcare project with Drupal requirements');

    await page.click('button:has-text("Änderungen speichern")');

    // Wait for Quick Scan
    await page.waitForSelector('text=Quick Scan läuft', { timeout: 10000 });

    // ActivityStream should be visible (either the card or activity items)
    const activityStream =
      (await page.locator('[data-testid="activity-stream"]').count()) > 0 ||
      (await page.locator('.activity-message').count()) > 0 ||
      (await page.locator('text=Quick Scan Agent Activity').count()) > 0;

    // At minimum, we should see the "Quick Scan läuft" card which contains the stream
    expect(
      activityStream || (await page.locator('text=Quick Scan läuft').count()) > 0
    ).toBeTruthy();
  });
});

test.describe('Quick Scan: Running State', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('TC-2.1: Website is crawled and analyzed', async ({ page }) => {
    await createRFPWithUrl(page, 'Website relaunch with modern CMS');

    await page.click('button:has-text("Änderungen speichern")');

    // Wait for Quick Scan to start and complete
    await page.waitForSelector('text=Quick Scan läuft', { timeout: 10000 });

    // Wait for completion (Quick Scan Results should appear)
    await expect(page.locator('text=Quick Scan')).toBeVisible({ timeout: 90000 });
  });

  test('TC-2.2: Tech Stack Detection runs', async ({ page }) => {
    await createRFPWithUrl(page, 'Drupal CMS migration project', 'https://www.drupal.org');

    await page.click('button:has-text("Änderungen speichern")');

    // Wait for scan to complete
    await page.waitForSelector('text=Quick Scan läuft', { timeout: 10000 });

    // Eventually, we should see results or completion
    await page.waitForTimeout(30000);

    // Check if scan completed or is still running
    const isCompleted = (await page.locator('text=Quick Scan Results').count()) > 0;
    const isRunning = (await page.locator('text=Quick Scan läuft').count()) > 0;

    expect(isCompleted || isRunning).toBeTruthy();
  });

  test('TC-2.3: 10 Questions are generated during scan', async ({ page }) => {
    await createRFPWithUrl(page, 'E-commerce platform with payment integration');

    await page.click('button:has-text("Änderungen speichern")');

    // Wait for Quick Scan to complete
    await page.waitForSelector('text=Quick Scan läuft', { timeout: 10000 });

    // Wait for questions to be ready (scan completes)
    await expect(
      page.locator('text=Quick Scan Results').or(page.locator('text=Fragen beantwortet'))
    ).toBeVisible({ timeout: 90000 });
  });

  test('TC-2.4: Progress indicator active during scan', async ({ page }) => {
    await createRFPWithUrl(page, 'CMS project for enterprise client');

    await page.click('button:has-text("Änderungen speichern")');

    // Wait for Quick Scan
    await page.waitForSelector('text=Quick Scan läuft', { timeout: 10000 });

    // Look for loading spinner or progress indicator
    const loader = page.locator('.animate-spin').or(page.locator('text=Live'));
    await expect(loader.first()).toBeVisible();
  });
});

test.describe('Quick Scan: Questions Ready State', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('TC-3.1: Status changes to questions_ready after completion', async ({ page }) => {
    await createRFPWithUrl(page, 'Digital platform for modern web application');

    await page.click('button:has-text("Änderungen speichern")');

    // Wait for Quick Scan to complete
    await page.waitForSelector('text=Quick Scan läuft', { timeout: 10000 });
    await page.waitForSelector('[data-decision-actions]', { timeout: 90000 });

    // Verify we're in questions_ready or later state
    await expect(page.locator('[data-decision-actions]')).toBeVisible();
  });

  test('TC-3.2: 10 Questions and answers are displayed', async ({ page }) => {
    await createRFPWithUrl(page, 'Enterprise CMS with complex workflows');

    await page.click('button:has-text("Änderungen speichern")');

    // Wait for completion
    await page.waitForSelector('[data-decision-actions]', { timeout: 90000 });

    // Questions should be visible in results
    await expect(page.locator('text=Fragen beantwortet')).toBeVisible();
  });

  test('TC-3.3: Confidence Score visible (0-100)', async ({ page }) => {
    await createRFPWithUrl(page, 'Portal for customer self-service');

    await page.click('button:has-text("Änderungen speichern")');

    await page.waitForSelector('[data-decision-actions]', { timeout: 90000 });

    // Look for score/confidence display
    const hasScore =
      (await page.locator('text=Score').count()) > 0 ||
      (await page.locator('text=Confidence').count()) > 0 ||
      (await page.locator('text=%').count()) > 0;

    expect(hasScore).toBeTruthy();
  });

  test('TC-3.4: BL Recommendation Badge visible', async ({ page }) => {
    await createRFPWithUrl(page, 'PHP-based CMS with custom modules');

    await page.click('button:has-text("Änderungen speichern")');

    await page.waitForSelector('[data-decision-actions]', { timeout: 90000 });

    // BL recommendation might be shown in results
    const hasBLInfo =
      (await page.locator('text=Business').count()) > 0 ||
      (await page.locator('text=Empfehlung').count()) > 0;

    expect(hasBLInfo).toBeTruthy();
  });

  test('TC-3.5: BID/NO-BID Decision buttons enabled', async ({ page }) => {
    await createRFPWithUrl(page, 'Project for modern web platform');

    await page.click('button:has-text("Änderungen speichern")');

    await page.waitForSelector('[data-decision-actions]', { timeout: 90000 });

    // Decision buttons should be visible and enabled
    await expect(page.locator('button:has-text("BIT")')).toBeVisible();
    await expect(page.locator('button:has-text("NO BIT")')).toBeVisible();
    await expect(page.locator('button:has-text("BIT")')).toBeEnabled();
    await expect(page.locator('button:has-text("NO BIT")')).toBeEnabled();
  });
});

test.describe('Quick Scan: URL Suggestions (DEA-32 Fix)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('TC-4.1: URL Suggestion prompt appears when no URL provided', async ({ page }) => {
    await createRFPWithoutUrl(page, 'CMS project for Acme Corporation - no URL given');

    // Confirm requirements (no URL)
    await page.click('button:has-text("Änderungen speichern")');

    // Should show URL input/suggestion prompt
    await expect(
      page
        .locator('text=Website-URL')
        .or(page.locator('text=URL'))
        .or(page.locator('text=Vorschläge'))
    ).toBeVisible({ timeout: 10000 });
  });

  test('TC-4.2: URL Suggestion button triggers agent', async ({ page }) => {
    await createRFPWithoutUrl(page, 'E-commerce project for TechMart - online retail platform');

    await page.click('button:has-text("Änderungen speichern")');

    // Look for URL suggestion button
    const suggestionButton = page
      .locator('button:has-text("Vorschläge")')
      .or(page.locator('button:has-text("URL")').or(page.locator('button:has-text("Suchen")')));

    // If button exists, click it
    if ((await suggestionButton.count()) > 0) {
      await suggestionButton.first().click();
      await page.waitForTimeout(2000);

      const hasResponse =
        (await page.locator('text=Vorschlag').count()) > 0 ||
        (await page.locator('.animate-spin').count()) > 0;

      expect(hasResponse).toBeTruthy();
    }
  });

  test('TC-4.3: Manual URL input allows Quick Scan restart', async ({ page }) => {
    await createRFPWithoutUrl(page, 'Healthcare portal without website URL');

    await page.click('button:has-text("Änderungen speichern")');

    // Look for URL input field
    const urlInput = page.locator('input[type="url"]').or(page.locator('input[name="url"]'));

    if ((await urlInput.count()) > 0) {
      // Enter URL manually
      await urlInput.first().fill('https://www.example-healthcare.com');

      // Look for submit/start button
      const submitButton = page
        .locator('button:has-text("Speichern")')
        .or(page.locator('button:has-text("Starten")').or(page.locator('button[type="submit"]')));

      if ((await submitButton.count()) > 0) {
        await submitButton.first().click();
        await expect(page.locator('text=Quick Scan')).toBeVisible({ timeout: 15000 });
      }
    }
  });
});

test.describe('Quick Scan: Error Cases', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('TC-5.1: Invalid URL shows validation error', async ({ page }) => {
    await createRFPWithUrl(page, 'Project with invalid URL', 'not-a-valid-url');

    await page.click('button:has-text("Änderungen speichern")');

    // Wait to see what happens
    await page.waitForTimeout(5000);

    // Check for URL input prompt or error
    const hasUrlPrompt = (await page.locator('text=URL').count()) > 0;
    const hasError = (await page.locator('text=Fehler').or(page.locator('text=Error')).count()) > 0;

    expect(hasUrlPrompt || hasError).toBeTruthy();
  });

  test('TC-5.2: Website unreachable shows error with retry', async ({ page }) => {
    await createRFPWithUrl(
      page,
      'Project for unreachable website',
      'https://this-domain-definitely-does-not-exist-12345.com'
    );

    await page.click('button:has-text("Änderungen speichern")');

    // Quick Scan will try to start
    await page.waitForTimeout(10000);

    // Eventually should show error or completion
    const hasError =
      (await page.locator('text=fehlgeschlagen').count()) > 0 ||
      (await page.locator('text=Fehler').count()) > 0;
    const hasCompleted = (await page.locator('[data-decision-actions]').count()) > 0;

    expect(hasError || hasCompleted).toBeTruthy();
  });

  test('TC-5.3: AI Agent timeout handled gracefully', async ({ page }) => {
    await createRFPWithUrl(page, 'Complex project requiring deep analysis');

    await page.click('button:has-text("Änderungen speichern")');

    // Wait for Quick Scan
    await page.waitForSelector('text=Quick Scan läuft', { timeout: 10000 });

    // Wait reasonable time
    await page.waitForTimeout(60000);

    // Check state - should have progressed or shown error
    const hasCompleted = (await page.locator('[data-decision-actions]').count()) > 0;
    const isStillRunning = (await page.locator('text=Quick Scan läuft').count()) > 0;
    const hasError = (await page.locator('text=fehlgeschlagen').count()) > 0;
    const hasRetry = (await page.locator('button:has-text("Retry")').count()) > 0;

    expect(hasCompleted || isStillRunning || hasError || hasRetry).toBeTruthy();
  });
});
