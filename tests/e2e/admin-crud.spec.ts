import { test, expect } from '@playwright/test';

/**
 * E2E Test: Admin CRUD Operations
 *
 * Tests admin functionality for managing business units and employees
 */

test.describe('Admin: Business Unit Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin (assuming auth is set up)
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should create new business unit', async ({ page }) => {
    // Navigate to admin panel
    await page.click('text=Admin');
    await expect(page).toHaveURL(/\/admin/);

    // Click on Business Units tab
    await page.click('text=Business Units');

    // Open create dialog
    await page.click('button:has-text("Create Business Unit")');

    // Fill in form
    await page.fill('input[name="name"]', 'Digital Solutions');
    await page.fill('input[name="code"]', 'DS');
    await page.fill('textarea[name="description"]', 'Digital transformation and web development');

    // Submit
    await page.click('button:has-text("Create")');

    // Verify success
    await expect(page.locator('text=Digital Solutions')).toBeVisible();
    await expect(page.locator('text=Business unit created')).toBeVisible();
  });

  test('should edit business unit', async ({ page }) => {
    await page.goto('/admin');

    await page.click('text=Business Units');

    // Find first business unit and click edit
    await page.locator('table tbody tr').first().locator('button:has-text("Edit")').click();

    // Update description
    await page.fill('textarea[name="description"]', 'Updated description');

    // Save
    await page.click('button:has-text("Save")');

    // Verify update
    await expect(page.locator('text=Business unit updated')).toBeVisible();
  });
});

test.describe('Admin: Employee Management', () => {
  test('should create new employee', async ({ page }) => {
    await page.goto('/admin');

    // Navigate to Employees
    await page.click('text=Employees');

    // Create new employee
    await page.click('button:has-text("Create Employee")');

    // Fill in form
    await page.fill('input[name="name"]', 'Jane Doe');
    await page.fill('input[name="email"]', 'jane.doe@example.com');
    await page.selectOption('select[name="businessUnit"]', { index: 1 });

    // Add skills
    await page.fill('input[name="skills"]', 'React, Next.js, TypeScript');

    // Set role
    await page.check('input[value="developer"]');

    // Mark as available
    await page.check('input[name="isAvailable"]');

    // Submit
    await page.click('button:has-text("Create")');

    // Verify success
    await expect(page.locator('text=Jane Doe')).toBeVisible();
    await expect(page.locator('text=Employee created')).toBeVisible();
  });
});
