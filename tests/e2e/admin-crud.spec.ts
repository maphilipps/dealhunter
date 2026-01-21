import { test, expect } from '@playwright/test';

/**
 * E2E Test: Admin CRUD Operations
 *
 * Comprehensive tests for admin functionality:
 * - Business Units Management (TC-1 to TC-4)
 * - Technologies Management (TC-5 to TC-9)
 * - Admin Access Control (TC-10)
 */

test.describe('Admin: Business Units Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('TC-1: Business Units List - Page Load and Display', async ({ page }) => {
    // Navigate to Business Units
    await page.goto('/admin/business-units');
    await page.waitForLoadState('networkidle');

    // Verify page loaded
    await expect(page).toHaveURL('/admin/business-units');
    await expect(page.locator('h1')).toContainText('Business Units');

    // Verify "New Business Unit" button exists
    await expect(page.locator('button:has-text("Neue Business Unit")')).toBeVisible();

    // Check if list or empty state is displayed
    const hasBusinessUnits = await page.locator('.grid').count();
    if (hasBusinessUnits > 0) {
      // Verify grid layout with cards
      await expect(page.locator('.grid > div')).toHaveCount(
        await page.locator('.grid > div').count()
      );
    } else {
      // Verify empty state
      await expect(page.locator('text=Noch keine Business Units erfasst')).toBeVisible();
    }
  });

  test('TC-2: Business Unit Creation - Full Flow', async ({ page }) => {
    await page.goto('/admin/business-units');
    await page.waitForLoadState('networkidle');

    // Click "New Business Unit" button
    await page.click('button:has-text("Neue Business Unit")');

    // Wait for navigation to /new page
    await expect(page).toHaveURL('/admin/business-units/new');

    // Fill in required fields
    await page.fill('input[name="name"]', 'E2E Test Business Unit');
    await page.fill('input[name="leaderName"]', 'Test Leader');
    await page.fill('input[name="leaderEmail"]', 'test.leader@adesso.de');

    // Fill in optional keywords field
    const keywordsInput = page.locator('input[name="keywords"]');
    if ((await keywordsInput.count()) > 0) {
      await keywordsInput.fill('e2e, testing, playwright');
    }

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for success toast and redirect
    await expect(page.locator('text=erfolgreich')).toBeVisible({ timeout: 5000 });

    // Verify redirect back to list or detail page
    await expect(page).toHaveURL(/\/admin\/business-units/);

    // Verify new business unit appears in list
    await expect(page.locator('text=E2E Test Business Unit')).toBeVisible();
  });

  test('TC-3: Business Unit Display - Card Information', async ({ page }) => {
    await page.goto('/admin/business-units');
    await page.waitForLoadState('networkidle');

    // Find first business unit card
    const firstCard = page.locator('.grid > div').first();

    if ((await firstCard.count()) > 0) {
      // Verify card shows: Name
      await expect(firstCard.locator('h3')).toBeVisible();

      // Verify card shows: Leader Name
      await expect(firstCard.locator('text=Leiter:')).toBeVisible();

      // Verify card shows: Leader Email
      const leaderEmail = firstCard.locator('text=/.*@.*/');
      await expect(leaderEmail).toBeVisible();

      // Verify card shows: Keywords section
      await expect(firstCard.locator('text=Keywords:')).toBeVisible();

      // Verify delete button exists
      await expect(firstCard.locator('button[title="Löschen"]')).toBeVisible();
    }
  });

  test('TC-4: Business Unit Deletion - Confirmation Flow', async ({ page }) => {
    // First, ensure we have at least one business unit
    await page.goto('/admin/business-units/new');
    await page.fill('input[name="name"]', 'Delete Test BU');
    await page.fill('input[name="leaderName"]', 'Delete Leader');
    await page.fill('input[name="leaderEmail"]', 'delete@adesso.de');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');

    await page.goto('/admin/business-units');
    await page.waitForLoadState('networkidle');

    // Find the business unit we just created
    const deleteCard = page.locator('text=Delete Test BU').locator('..').locator('..');

    // Listen for confirmation dialog
    page.on('dialog', async dialog => {
      expect(dialog.type()).toBe('confirm');
      expect(dialog.message()).toContain('wirklich löschen');
      await dialog.accept();
    });

    // Click delete button
    await deleteCard.locator('button[title="Löschen"]').click();

    // Wait for success toast
    await expect(page.locator('text=erfolgreich gelöscht')).toBeVisible({ timeout: 5000 });

    // Verify business unit is removed from list
    await expect(page.locator('text=Delete Test BU')).not.toBeVisible();
  });
});

test.describe('Admin: Technologies Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('TC-5: Technologies List - Page Load and Display', async ({ page }) => {
    await page.goto('/admin/technologies');
    await page.waitForLoadState('networkidle');

    // Verify page loaded
    await expect(page).toHaveURL('/admin/technologies');
    await expect(page.locator('h1')).toContainText('Technologien');

    // Verify "New Technology" button exists
    await expect(page.locator('button:has-text("Neue Technologie")')).toBeVisible();

    // Check if list or empty state is displayed
    const hasTechnologies = await page.locator('.grid').count();
    if (hasTechnologies > 0) {
      // Verify grid layout with cards
      const cards = page.locator('.grid > div');
      await expect(cards.first()).toBeVisible();
    } else {
      // Verify empty state
      await expect(page.locator('text=Noch keine Technologien erfasst')).toBeVisible();
    }
  });

  test('TC-6: Technology Creation - Full Flow', async ({ page }) => {
    // First create a Business Unit for the technology
    await page.goto('/admin/business-units/new');
    await page.fill('input[name="name"]', 'Tech Test BU');
    await page.fill('input[name="leaderName"]', 'Tech Leader');
    await page.fill('input[name="leaderEmail"]', 'tech@adesso.de');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');

    // Now create technology
    await page.goto('/admin/technologies');
    await page.waitForLoadState('networkidle');

    // Click "New Technology" button
    await page.click('button:has-text("Neue Technologie")');

    // Wait for navigation
    await expect(page).toHaveURL('/admin/technologies/new');

    // Fill in required fields
    await page.fill('input[name="name"]', 'E2E Test Technology');

    // Select Business Unit
    const businessUnitSelect = page.locator('select[name="businessUnitId"]');
    if ((await businessUnitSelect.count()) > 0) {
      await businessUnitSelect.selectOption({ index: 1 });
    }

    // Fill in optional fields
    const baselineHoursInput = page.locator('input[name="baselineHours"]');
    if ((await baselineHoursInput.count()) > 0) {
      await baselineHoursInput.fill('120');
    }

    const baselineNameInput = page.locator('input[name="baselineName"]');
    if ((await baselineNameInput.count()) > 0) {
      await baselineNameInput.fill('Standard Drupal Setup');
    }

    // Check isDefault checkbox if exists
    const isDefaultCheckbox = page.locator('input[name="isDefault"]');
    if ((await isDefaultCheckbox.count()) > 0) {
      await isDefaultCheckbox.check();
    }

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for success
    await expect(page.locator('text=erfolgreich')).toBeVisible({ timeout: 5000 });

    // Verify redirect
    await expect(page).toHaveURL(/\/admin\/technologies/);

    // Verify new technology appears
    await expect(page.locator('text=E2E Test Technology')).toBeVisible();
  });

  test('TC-7: Technology Display - Card Information', async ({ page }) => {
    await page.goto('/admin/technologies');
    await page.waitForLoadState('networkidle');

    // Find first technology card
    const firstCard = page.locator('.grid > div').first();

    if ((await firstCard.count()) > 0) {
      // Verify card shows: Name (as CardTitle)
      await expect(firstCard.locator('h3')).toBeVisible();

      // Verify card shows: Business Unit
      await expect(firstCard.locator('text=Business Unit:')).toBeVisible();

      // Verify action buttons exist (Research, Delete)
      await expect(firstCard.locator('button[title*="Recherche"]')).toBeVisible();
      await expect(firstCard.locator('button:has-text(""), svg.lucide-trash-2')).toBeVisible();

      // Check for optional badges
      const defaultBadge = firstCard.locator('text=Default');
      if ((await defaultBadge.count()) > 0) {
        await expect(defaultBadge).toBeVisible();
      }
    }
  });

  test('TC-8: Technology Deletion - Confirmation Flow', async ({ page }) => {
    // Create a technology to delete
    await page.goto('/admin/business-units/new');
    await page.fill('input[name="name"]', 'Delete Tech BU');
    await page.fill('input[name="leaderName"]', 'Delete Leader');
    await page.fill('input[name="leaderEmail"]', 'deletetech@adesso.de');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');

    await page.goto('/admin/technologies/new');
    await page.fill('input[name="name"]', 'Delete Test Tech');
    const businessUnitSelect = page.locator('select[name="businessUnitId"]');
    if ((await businessUnitSelect.count()) > 0) {
      await businessUnitSelect.selectOption({ index: 1 });
    }
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');

    await page.goto('/admin/technologies');
    await page.waitForLoadState('networkidle');

    // Find the technology card
    const deleteCard = page.locator('text=Delete Test Tech').locator('..').locator('..');

    // Listen for confirmation dialog
    page.on('dialog', async dialog => {
      expect(dialog.type()).toBe('confirm');
      expect(dialog.message()).toContain('wirklich löschen');
      await dialog.accept();
    });

    // Click delete button
    await deleteCard.locator('button', { has: page.locator('svg.lucide-trash-2') }).click();

    // Wait for success toast
    await expect(page.locator('text=erfolgreich gelöscht')).toBeVisible({ timeout: 5000 });

    // Verify technology is removed
    await expect(page.locator('text=Delete Test Tech')).not.toBeVisible();
  });

  test('TC-9: Baseline Entity Counts - JSON Structure', async ({ page }) => {
    await page.goto('/admin/technologies');
    await page.waitForLoadState('networkidle');

    // Find a technology with entity counts
    const cardWithEntities = page.locator('text=Entities:').locator('..').locator('..');

    if ((await cardWithEntities.count()) > 0) {
      // Verify entity counts are displayed as badges
      const entityBadges = cardWithEntities.locator('[class*="badge"]');
      await expect(entityBadges.first()).toBeVisible();

      // Verify badge format shows entity: count
      const firstBadge = await entityBadges.first().textContent();
      expect(firstBadge).toMatch(/.*:\s*\d+/);
    }
  });
});

test.describe('Admin: Access Control', () => {
  test('TC-10: Admin Section Visibility', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check if Admin link exists in sidebar/navigation
    const adminLink = page.locator('a:has-text("Admin")');

    // If admin link is visible, we should be able to access admin pages
    if ((await adminLink.count()) > 0) {
      await adminLink.click();
      await expect(page).toHaveURL(/\/admin/);

      // Verify we're not seeing 403 Forbidden
      await expect(page.locator('text=403')).not.toBeVisible();
      await expect(page.locator('text=Forbidden')).not.toBeVisible();
    }
  });
});
