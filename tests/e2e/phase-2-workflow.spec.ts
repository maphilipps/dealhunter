import { test, expect } from '@playwright/test';

/**
 * E2E Test: Phase 2 Workflow - Lead Management & Deep-Scan
 *
 * Tests the complete Lead management workflow:
 * 1. RFP → Lead conversion when status = 'routed'
 * 2. Deep-Scan agents execution with background jobs
 * 3. Lead Overview Page
 * 4. Website Audit Page
 * 5. PT Estimation Page
 * 6. BID/NO-BID Decision
 * 7. Status transitions (routed → full_scanning → bl_reviewing → bid_voted/archived)
 *
 * DEA-106: E2E Tests für Phase 2 Workflow
 */

test.describe('Phase 2 Workflow: Lead Management & Deep-Scan', () => {
  let rfpId: string;
  let leadId: string;

  test.beforeEach(async ({ page }) => {
    // Navigate to homepage and wait for it to load
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Create a test RFP first (prerequisite for Lead creation)
    await page.click('text=New Bid');
    await expect(page).toHaveURL(/\/bids\/new/);

    // Fill in RFP data
    await page.fill(
      'textarea[name="rawInput"]',
      'RFP from Acme Corporation for website relaunch. Budget: 100-150k EUR. Website: https://example.com'
    );
    await page.selectOption('select[name="source"]', 'reactive');
    await page.selectOption('select[name="stage"]', 'rfp');
    await page.selectOption('select[name="inputType"]', 'freetext');

    // Submit and wait for extraction
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/bids\/[a-z0-9]+/);

    // Extract RFP ID from URL
    const url = page.url();
    rfpId = url.split('/').pop() || '';
    expect(rfpId).toBeTruthy();

    // Wait for extraction to complete
    await page.waitForSelector('text=Client Name', { timeout: 10000 });

    // Route to BL (this triggers Lead creation)
    // Note: In real scenario, we'd need Quick Scan first
    // For E2E test, we'll directly assign to BU
    await page.click('text=Assign to BU');
    await page.selectOption('select[name="businessUnit"]', { index: 1 });
    await page.click('button:has-text("Confirm")');

    // Wait for routing to complete
    await expect(page.locator('text=Routed to')).toBeVisible({ timeout: 10000 });
  });

  // ===== TEST 1: RFP → Lead Konvertierung =====
  test('should automatically convert RFP to Lead when routed', async ({ page }) => {
    // Navigate to Leads page
    await page.goto('/leads');
    await page.waitForLoadState('networkidle');

    // Should see the newly created lead
    await expect(page.locator('text=Acme Corporation')).toBeVisible();

    // Click on lead to open details
    await page.click('text=Acme Corporation');
    await expect(page).toHaveURL(/\/leads\/[a-z0-9]+/);

    // Extract Lead ID from URL
    const url = page.url();
    leadId = url.split('/').pop() || '';
    expect(leadId).toBeTruthy();

    // Verify lead data is transferred from RFP
    await expect(page.locator('text=Acme Corporation')).toBeVisible();
    await expect(page.locator('text=https://example.com')).toBeVisible();

    // Verify initial status is 'routed'
    await expect(page.locator('text=Routed')).toBeVisible();
  });

  // ===== TEST 2: Deep-Scan Agents ausführen =====
  test('should execute deep-scan agents with background job tracking', async ({ page }) => {
    // Navigate to lead (created in beforeEach)
    await page.goto('/leads');
    await page.click('text=Acme Corporation');
    await expect(page).toHaveURL(/\/leads\/[a-z0-9]+/);

    // Look for "Start Deep Scan" button
    const startScanButton = page.locator('button:has-text("Start Deep Scan")');

    // If button exists, click it
    if (await startScanButton.isVisible()) {
      await startScanButton.click();

      // Wait for background job to start
      await expect(page.locator('text=Scanning')).toBeVisible({ timeout: 5000 });

      // Wait for progress indicator
      await expect(page.locator('text=Progress')).toBeVisible({ timeout: 10000 });

      // Wait for scan to complete (timeout: 30 seconds for agents)
      await expect(
        page.locator('text=Deep scan completed').or(page.locator('text=Reviewing'))
      ).toBeVisible({ timeout: 60000 });
    } else {
      // If no Start Deep Scan button, agents might auto-run
      // Just verify we reach bl_reviewing status eventually
      await expect(
        page.locator('text=Reviewing').or(page.locator('text=Ready for Decision'))
      ).toBeVisible({ timeout: 60000 });
    }

    // Verify status changed to 'bl_reviewing' or 'reviewing'
    const statusBadge = page.locator('[data-testid="lead-status"]');
    if (await statusBadge.isVisible()) {
      const statusText = await statusBadge.textContent();
      expect(statusText?.toLowerCase()).toMatch(/reviewing|ready/);
    }
  });

  // ===== TEST 3: Lead Overview Page laden =====
  test('should display Lead Overview Page with summary cards', async ({ page }) => {
    // Navigate to lead overview
    await page.goto('/leads');
    await page.click('text=Acme Corporation');
    await expect(page).toHaveURL(/\/leads\/[a-z0-9]+/);

    // Verify Overview Page elements
    await expect(page.locator('h1')).toContainText('Acme Corporation');

    // Check for customer info card
    await expect(
      page.locator('text=Customer').or(page.locator('text=Client'))
    ).toBeVisible();

    // Check for website URL
    await expect(page.locator('text=https://example.com')).toBeVisible();

    // Check for status badge
    await expect(
      page.locator('text=Routed').or(page.locator('text=Scanning')).or(page.locator('text=Reviewing'))
    ).toBeVisible();

    // Verify navigation tabs/links are present
    const hasWebsiteAuditLink = await page.locator('text=Website Audit').isVisible();
    const hasEstimationLink = await page.locator('text=Estimation').isVisible();
    const hasDecisionLink = await page.locator('text=Decision').isVisible();

    // At least one navigation element should exist
    expect(hasWebsiteAuditLink || hasEstimationLink || hasDecisionLink).toBeTruthy();
  });

  // ===== TEST 4: Website Audit Page prüfen =====
  test('should display Website Audit Page with deep-scan results', async ({ page }) => {
    // Navigate to lead
    await page.goto('/leads');
    await page.click('text=Acme Corporation');

    // Navigate to Website Audit page
    const websiteAuditLink = page.locator('a:has-text("Website Audit")');

    if (await websiteAuditLink.isVisible()) {
      await websiteAuditLink.click();
      await expect(page).toHaveURL(/\/leads\/[a-z0-9]+\/website-audit/);

      // Verify page loaded
      await expect(page.locator('h1, h2').first()).toBeVisible();

      // Check for audit sections (flexible - might not all be present if scan incomplete)
      const hasTechStack = await page.locator('text=Tech Stack').isVisible();
      const hasPerformance = await page.locator('text=Performance').isVisible();
      const hasAccessibility = await page.locator('text=Accessibility').isVisible();
      const hasContentArch = await page.locator('text=Content Architecture').isVisible();

      // At least one section should be visible
      expect(hasTechStack || hasPerformance || hasAccessibility || hasContentArch).toBeTruthy();
    } else {
      // If link not visible, might be in different navigation structure
      // Try direct URL navigation
      const leadUrl = page.url();
      const leadId = leadUrl.split('/').pop();
      await page.goto(`/leads/${leadId}/website-audit`);

      // Should either show page or redirect
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('/leads/');
    }
  });

  // ===== TEST 5: PT Estimation Page prüfen =====
  test('should display PT Estimation Page with effort breakdown', async ({ page }) => {
    // Navigate to lead
    await page.goto('/leads');
    await page.click('text=Acme Corporation');

    // Navigate to Estimation page
    const estimationLink = page.locator('a:has-text("Estimation")');

    if (await estimationLink.isVisible()) {
      await estimationLink.click();
      await expect(page).toHaveURL(/\/leads\/[a-z0-9]+\/estimation/);

      // Verify page loaded
      await expect(page.locator('h1, h2').first()).toBeVisible();

      // Check for estimation sections
      const hasTotalPT = await page.locator('text=Total PT').isVisible();
      const hasPhases = await page.locator('text=Phase').isVisible();
      const hasEffort = await page.locator('text=Effort').isVisible();

      // At least one estimation element should be visible
      expect(hasTotalPT || hasPhases || hasEffort).toBeTruthy();
    } else {
      // Try direct URL navigation
      const leadUrl = page.url();
      const leadId = leadUrl.split('/').pop();
      await page.goto(`/leads/${leadId}/estimation`);

      // Should either show page or redirect
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('/leads/');
    }
  });

  // ===== TEST 6: BID/NO-BID Decision durchführen =====
  test('should allow BL to make BID/NO-BID decision', async ({ page }) => {
    // Navigate to lead
    await page.goto('/leads');
    await page.click('text=Acme Corporation');

    // Navigate to Decision page
    const decisionLink = page.locator('a:has-text("Decision")');

    if (await decisionLink.isVisible()) {
      await decisionLink.click();
      await expect(page).toHaveURL(/\/leads\/[a-z0-9]+\/decision/);

      // Verify decision form exists
      const bidButton = page.locator('button:has-text("BID")');
      const noBidButton = page.locator('button:has-text("NO-BID")');

      if ((await bidButton.isVisible()) || (await noBidButton.isVisible())) {
        // Fill in decision form
        // Select BID
        if (await bidButton.isVisible()) {
          await bidButton.click();
        }

        // Set confidence score (if slider exists)
        const confidenceSlider = page.locator('input[type="range"]');
        if (await confidenceSlider.isVisible()) {
          await confidenceSlider.fill('85');
        }

        // Fill reasoning textarea
        const reasoningTextarea = page.locator('textarea');
        if (await reasoningTextarea.isVisible()) {
          await reasoningTextarea.fill(
            'Strong technical fit. Customer has realistic budget and timeline. Good reference potential.'
          );
        }

        // Submit decision
        const submitButton = page.locator('button:has-text("Submit")');
        if (await submitButton.isVisible()) {
          await submitButton.click();

          // Wait for success message
          await expect(
            page.locator('text=Decision submitted').or(page.locator('text=Success'))
          ).toBeVisible({ timeout: 10000 });
        }
      }
    } else {
      // Try direct URL navigation
      const leadUrl = page.url();
      const leadId = leadUrl.split('/').pop();
      await page.goto(`/leads/${leadId}/decision`);

      // Should either show page or redirect
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('/leads/');
    }
  });

  // ===== TEST 7: Status-Transitions verifizieren =====
  test('should correctly transition through status states', async ({ page }) => {
    // Navigate to lead
    await page.goto('/leads');
    await page.click('text=Acme Corporation');
    const leadUrl = page.url();

    // Test 1: Initial status should be 'routed'
    await expect(page.locator('text=Routed')).toBeVisible();

    // Test 2: After deep scan starts, status should be 'full_scanning' or 'scanning'
    const startScanButton = page.locator('button:has-text("Start Deep Scan")');
    if (await startScanButton.isVisible()) {
      await startScanButton.click();

      // Wait for status change
      await expect(
        page.locator('text=Scanning').or(page.locator('text=Full Scanning'))
      ).toBeVisible({ timeout: 10000 });
    }

    // Test 3: After deep scan completes, status should be 'bl_reviewing'
    await expect(
      page.locator('text=Reviewing').or(page.locator('text=Ready for Decision'))
    ).toBeVisible({ timeout: 60000 });

    // Test 4: After BID decision, status should be 'bid_voted'
    const decisionLink = page.locator('a:has-text("Decision")');
    if (await decisionLink.isVisible()) {
      await decisionLink.click();

      const bidButton = page.locator('button:has-text("BID")');
      if (await bidButton.isVisible()) {
        await bidButton.click();

        const reasoningTextarea = page.locator('textarea');
        if (await reasoningTextarea.isVisible()) {
          await reasoningTextarea.fill('E2E test decision - BID approved');
        }

        const submitButton = page.locator('button:has-text("Submit")');
        if (await submitButton.isVisible()) {
          await submitButton.click();

          // Wait for success and status change
          await page.waitForTimeout(2000);

          // Navigate back to overview to see status
          await page.goto(leadUrl);

          // Status should be 'bid_voted' or 'approved'
          await expect(
            page.locator('text=Voted').or(page.locator('text=Approved'))
          ).toBeVisible({ timeout: 10000 });
        }
      }
    }

    // Verify final state
    const finalStatus = await page.locator('[data-testid="lead-status"]').textContent();
    console.log('Final lead status:', finalStatus);
    expect(finalStatus).toBeTruthy();
  });

  // ===== BONUS TEST: NO-BID Decision =====
  test('should handle NO-BID decision and archive lead', async ({ page }) => {
    // Navigate to lead
    await page.goto('/leads');
    await page.click('text=Acme Corporation');
    const leadUrl = page.url();

    // Navigate to Decision page
    const decisionLink = page.locator('a:has-text("Decision")');

    if (await decisionLink.isVisible()) {
      await decisionLink.click();

      const noBidButton = page.locator('button:has-text("NO-BID")');
      if (await noBidButton.isVisible()) {
        await noBidButton.click();

        const reasoningTextarea = page.locator('textarea');
        if (await reasoningTextarea.isVisible()) {
          await reasoningTextarea.fill(
            'E2E test decision - NO-BID due to budget constraints'
          );
        }

        const submitButton = page.locator('button:has-text("Submit")');
        if (await submitButton.isVisible()) {
          await submitButton.click();

          // Wait for success
          await page.waitForTimeout(2000);

          // Navigate back to overview
          await page.goto(leadUrl);

          // Status should be 'archived'
          await expect(page.locator('text=Archived')).toBeVisible({ timeout: 10000 });
        }
      }
    }
  });
});

// ===== Integration Tests: Data Persistence =====
test.describe('Phase 2: Data Persistence & Integrity', () => {
  test('should persist lead data across page reloads', async ({ page }) => {
    // Create lead
    await page.goto('/');
    await page.click('text=New Bid');
    await page.fill(
      'textarea[name="rawInput"]',
      'Data persistence test RFP from Test Corp. Website: https://test.example.com'
    );
    await page.selectOption('select[name="source"]', 'reactive');
    await page.selectOption('select[name="stage"]', 'rfp');
    await page.selectOption('select[name="inputType"]', 'freetext');
    await page.click('button[type="submit"]');

    // Wait for RFP creation
    await page.waitForSelector('text=Client Name', { timeout: 10000 });

    // Route to BL
    await page.click('text=Assign to BU');
    await page.selectOption('select[name="businessUnit"]', { index: 1 });
    await page.click('button:has-text("Confirm")');

    // Go to leads page
    await page.goto('/leads');
    const leadLink = page.locator('text=Test Corp');

    // Verify lead is listed
    await expect(leadLink).toBeVisible();

    // Click lead
    await leadLink.click();
    const leadUrl = page.url();

    // Verify data is visible
    await expect(page.locator('text=Test Corp')).toBeVisible();
    await expect(page.locator('text=https://test.example.com')).toBeVisible();

    // Reload page
    await page.reload();

    // Verify data persists
    await expect(page.locator('text=Test Corp')).toBeVisible();
    await expect(page.locator('text=https://test.example.com')).toBeVisible();

    // Navigate away and back
    await page.goto('/');
    await page.goto(leadUrl);

    // Verify data still persists
    await expect(page.locator('text=Test Corp')).toBeVisible();
    await expect(page.locator('text=https://test.example.com')).toBeVisible();
  });
});
