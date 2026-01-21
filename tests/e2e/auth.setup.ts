import { test as setup, expect } from '@playwright/test';

const authFile = 'tests/e2e/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Navigate to login page
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  // Fill in login form with E2E test user
  await page.fill('input[name="email"]', 'e2e@test.com');
  await page.fill('input[name="password"]', 'test1234');

  // Submit form and wait for navigation
  await Promise.all([page.waitForURL('/'), page.click('button[type="submit"]')]);

  // Verify we're logged in
  await page.waitForLoadState('networkidle');

  // Save authentication state
  await page.context().storageState({ path: authFile });
});
