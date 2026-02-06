import { test, expect } from '@playwright/test';

/**
 * E2E Test: Accounts Section
 *
 * Comprehensive tests for Account Management:
 * - TC-1: Accounts List View
 * - TC-2: Account Creation
 * - TC-3: Account Detail View
 * - TC-4: Account Edit
 * - TC-5: Account Deletion
 * - TC-6: Account-RFP Linking
 */

test.describe('Accounts: List View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('TC-1.1: Page Load and Display', async ({ page }) => {
    // Navigate to Accounts
    await page.goto('/accounts');
    await page.waitForLoadState('domcontentloaded');

    // Verify page loaded
    await expect(page).toHaveURL('/accounts');
    await expect(page.locator('h1')).toContainText('Accounts');

    // Verify "Neuer Account" button exists
    await expect(page.locator('button:has-text("Neuer Account")')).toBeVisible();
  });

  test('TC-1.2: Empty State Display', async ({ page }) => {
    await page.goto('/accounts');
    await page.waitForLoadState('domcontentloaded');

    // Check if empty state or list is displayed
    const accountCards = await page.locator('.grid > a').count();

    if (accountCards === 0) {
      // Verify empty state
      await expect(page.locator('text=Noch keine Accounts vorhanden')).toBeVisible();
      await expect(page.locator('button:has-text("Ersten Account erstellen")')).toBeVisible();
    }
  });

  test('TC-1.3: Account Cards Display Information', async ({ page }) => {
    // First create an account to ensure we have data
    await page.goto('/accounts/new');
    await page.fill('input[name="name"]', 'Display Test Account');
    await page.fill('input[name="industry"]', 'Technology');
    await page.fill('input[name="website"]', 'https://example.com');
    await page.fill('textarea[name="notes"]', 'Test notes for display');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('domcontentloaded');

    await page.goto('/accounts');
    await page.waitForLoadState('domcontentloaded');

    // Find the account card we just created
    const accountCard = page.locator('text=Display Test Account').locator('..').locator('..');

    // Verify card shows: Name
    await expect(accountCard.locator('h3:has-text("Display Test Account")')).toBeVisible();

    // Verify card shows: Industry
    await expect(accountCard.locator('text=Branche:')).toBeVisible();
    await expect(accountCard.locator('text=Technology')).toBeVisible();

    // Verify card shows: Website
    await expect(accountCard.locator('text=Website:')).toBeVisible();
    await expect(accountCard.locator('text=https://example.com')).toBeVisible();

    // Verify card shows: Created date
    await expect(accountCard.locator('text=Erstellt am:')).toBeVisible();

    // Verify card shows: Notes
    await expect(accountCard.locator('text=Notizen:')).toBeVisible();
  });
});

test.describe('Accounts: Account Creation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('TC-2.1: Account Creation - Full Flow with Required Fields', async ({ page }) => {
    await page.goto('/accounts');
    await page.waitForLoadState('domcontentloaded');

    // Click "Neuer Account" button
    await page.click('button:has-text("Neuer Account")');

    // Wait for navigation to /new page
    await expect(page).toHaveURL('/accounts/new');

    // Verify page title
    await expect(page.locator('h1')).toContainText('Neuen Account erstellen');

    // Fill in required fields only
    await page.fill('input[name="name"]', 'E2E Test Account');
    await page.fill('input[name="industry"]', 'Automotive');

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for success toast and redirect
    await expect(page.locator('text=erfolgreich')).toBeVisible({ timeout: 5000 });

    // Verify redirect back to list
    await expect(page).toHaveURL('/accounts');

    // Verify new account appears in list
    await expect(page.locator('text=E2E Test Account')).toBeVisible();
    await expect(page.locator('text=Automotive')).toBeVisible();
  });

  test('TC-2.2: Account Creation - Full Flow with All Fields', async ({ page }) => {
    await page.goto('/accounts/new');
    await page.waitForLoadState('domcontentloaded');

    // Fill in all fields
    await page.fill('input[name="name"]', 'Complete Test Account');
    await page.fill('input[name="industry"]', 'Finance');
    await page.fill('input[name="website"]', 'https://www.complete-test.com');
    await page.fill(
      'textarea[name="notes"]',
      'This is a comprehensive test account with all fields filled.'
    );

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for success
    await expect(page.locator('text=erfolgreich')).toBeVisible({ timeout: 5000 });

    // Verify redirect
    await expect(page).toHaveURL('/accounts');

    // Verify all data appears
    await expect(page.locator('text=Complete Test Account')).toBeVisible();
    await expect(page.locator('text=Finance')).toBeVisible();
  });

  test('TC-2.3: Account Creation - Validation for Required Fields', async ({ page }) => {
    await page.goto('/accounts/new');
    await page.waitForLoadState('domcontentloaded');

    // Try to submit without filling fields
    await page.click('button[type="submit"]');

    // HTML5 validation should prevent submission
    // The form should still be on the same page
    await expect(page).toHaveURL('/accounts/new');
  });

  test('TC-2.4: Account Creation - Cancel Button', async ({ page }) => {
    await page.goto('/accounts/new');
    await page.waitForLoadState('domcontentloaded');

    // Fill some data
    await page.fill('input[name="name"]', 'Cancelled Account');

    // Click cancel button
    await page.click('button:has-text("Abbrechen")');

    // Should navigate back
    await expect(page).not.toHaveURL('/accounts/new');
  });
});

test.describe('Accounts: Account Detail View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('TC-3.1: Account Detail - Navigation and Header', async ({ page }) => {
    // Create an account first
    await page.goto('/accounts/new');
    await page.fill('input[name="name"]', 'Detail Test Account');
    await page.fill('input[name="industry"]', 'Healthcare');
    await page.fill('input[name="website"]', 'https://www.healthcare-test.com');
    await page.fill('textarea[name="notes"]', 'Healthcare industry test notes');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('domcontentloaded');

    // Navigate to accounts list and click on the account
    await page.goto('/accounts');
    await page.click('text=Detail Test Account');

    // Verify we're on the detail page
    await expect(page).toHaveURL(/\/accounts\/[a-z0-9-]+$/);

    // Verify account header shows name
    await expect(page.locator('h1:has-text("Detail Test Account")')).toBeVisible();

    // Verify back button exists
    await expect(page.locator('a[href="/accounts"]')).toBeVisible();

    // Verify edit button exists
    await expect(page.locator('a:has-text("Bearbeiten")')).toBeVisible();

    // Verify delete button exists
    await expect(page.locator('button:has-text("Löschen")')).toBeVisible();
  });

  test('TC-3.2: Account Detail - Account Information Card', async ({ page }) => {
    // Create an account with all fields
    await page.goto('/accounts/new');
    await page.fill('input[name="name"]', 'Info Card Test');
    await page.fill('input[name="industry"]', 'Retail');
    await page.fill('input[name="website"]', 'https://www.retail-test.com');
    await page.fill('textarea[name="notes"]', 'Retail test notes');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('domcontentloaded');

    await page.goto('/accounts');
    await page.click('text=Info Card Test');
    await page.waitForLoadState('domcontentloaded');

    // Find Account Information card
    const infoCard = page
      .locator('h3:has-text("Account Informationen")')
      .locator('..')
      .locator('..');

    // Verify all fields are displayed
    await expect(infoCard.locator('text=Kundenname')).toBeVisible();
    await expect(infoCard.locator('text=Info Card Test')).toBeVisible();

    await expect(infoCard.locator('text=Branche')).toBeVisible();
    await expect(infoCard.locator('text=Retail')).toBeVisible();

    await expect(infoCard.locator('text=Website')).toBeVisible();
    await expect(infoCard.locator('a[href="https://www.retail-test.com"]')).toBeVisible();

    await expect(infoCard.locator('text=Erstellt am')).toBeVisible();

    await expect(infoCard.locator('text=Notizen')).toBeVisible();
    await expect(infoCard.locator('text=Retail test notes')).toBeVisible();
  });

  test('TC-3.3: Account Detail - Statistics Card', async ({ page }) => {
    // Create an account
    await page.goto('/accounts/new');
    await page.fill('input[name="name"]', 'Stats Test Account');
    await page.fill('input[name="industry"]', 'Manufacturing');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('domcontentloaded');

    await page.goto('/accounts');
    await page.click('text=Stats Test Account');
    await page.waitForLoadState('domcontentloaded');

    // Find Statistics card
    const statsCard = page.locator('h3:has-text("Statistiken")').locator('..').locator('..');

    // Verify opportunity count is displayed
    await expect(statsCard.locator('text=Anzahl Opportunities')).toBeVisible();
    await expect(statsCard.locator('text=0')).toBeVisible(); // Should be 0 initially
  });

  test('TC-3.4: Account Detail - Opportunities Table Empty State', async ({ page }) => {
    // Create an account
    await page.goto('/accounts/new');
    await page.fill('input[name="name"]', 'Empty Opps Account');
    await page.fill('input[name="industry"]', 'Education');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('domcontentloaded');

    await page.goto('/accounts');
    await page.click('text=Empty Opps Account');
    await page.waitForLoadState('domcontentloaded');

    // Find Opportunities card
    const oppsCard = page.locator('h3:has-text("Opportunities")').locator('..').locator('..');

    // Verify empty state message
    await expect(
      oppsCard.locator('text=Noch keine Opportunities für diesen Account')
    ).toBeVisible();
  });
});

test.describe('Accounts: Account Edit', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('TC-4.1: Account Edit - Navigation and Pre-filled Data', async ({ page }) => {
    // Create an account
    await page.goto('/accounts/new');
    await page.fill('input[name="name"]', 'Edit Test Original');
    await page.fill('input[name="industry"]', 'Energy');
    await page.fill('input[name="website"]', 'https://www.original.com');
    await page.fill('textarea[name="notes"]', 'Original notes');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('domcontentloaded');

    // Navigate to detail page
    await page.goto('/accounts');
    await page.click('text=Edit Test Original');
    await page.waitForLoadState('domcontentloaded');

    // Click edit button
    await page.click('a:has-text("Bearbeiten")');

    // Verify we're on edit page
    await expect(page).toHaveURL(/\/accounts\/[a-z0-9-]+\/edit$/);

    // Verify page title
    await expect(page.locator('h1:has-text("Account bearbeiten")')).toBeVisible();

    // Verify form is pre-filled
    await expect(page.locator('input[name="name"]')).toHaveValue('Edit Test Original');
    await expect(page.locator('input[name="industry"]')).toHaveValue('Energy');
    await expect(page.locator('input[name="website"]')).toHaveValue('https://www.original.com');
    await expect(page.locator('textarea[name="notes"]')).toHaveValue('Original notes');
  });

  test('TC-4.2: Account Edit - Update All Fields', async ({ page }) => {
    // Create an account
    await page.goto('/accounts/new');
    await page.fill('input[name="name"]', 'Update Test Account');
    await page.fill('input[name="industry"]', 'Logistics');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('domcontentloaded');

    // Navigate to edit
    await page.goto('/accounts');
    await page.click('text=Update Test Account');
    await page.click('a:has-text("Bearbeiten")');
    await page.waitForLoadState('domcontentloaded');

    // Update all fields
    await page.fill('input[name="name"]', 'Updated Account Name');
    await page.fill('input[name="industry"]', 'Transportation');
    await page.fill('input[name="website"]', 'https://www.updated.com');
    await page.fill('textarea[name="notes"]', 'Updated comprehensive notes');

    // Submit
    await page.click('button:has-text("Änderungen speichern")');

    // Wait for success
    await expect(page.locator('text=erfolgreich aktualisiert')).toBeVisible({ timeout: 5000 });

    // Verify redirect to detail page
    await expect(page).toHaveURL(/\/accounts\/[a-z0-9-]+$/);

    // Verify updated data is displayed
    await expect(page.locator('h1:has-text("Updated Account Name")')).toBeVisible();
    await expect(page.locator('text=Transportation')).toBeVisible();
    await expect(page.locator('a[href="https://www.updated.com"]')).toBeVisible();
    await expect(page.locator('text=Updated comprehensive notes')).toBeVisible();
  });

  test('TC-4.3: Account Edit - Cancel Button', async ({ page }) => {
    // Create an account
    await page.goto('/accounts/new');
    await page.fill('input[name="name"]', 'Cancel Edit Test');
    await page.fill('input[name="industry"]', 'Construction');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('domcontentloaded');

    // Navigate to edit
    await page.goto('/accounts');
    await page.click('text=Cancel Edit Test');
    const detailUrl = page.url();
    await page.click('a:has-text("Bearbeiten")');
    await page.waitForLoadState('domcontentloaded');

    // Make changes but cancel
    await page.fill('input[name="name"]', 'Should Not Save');

    // Click cancel
    await page.click('button:has-text("Abbrechen")');

    // Should navigate back to detail page
    await expect(page).toHaveURL(/\/accounts\/[a-z0-9-]+/);

    // Original name should still be there
    await expect(page.locator('h1:has-text("Cancel Edit Test")')).toBeVisible();
  });
});

test.describe('Accounts: Account Deletion', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('TC-5.1: Account Deletion - Confirmation Dialog', async ({ page }) => {
    // Create an account without opportunities
    await page.goto('/accounts/new');
    await page.fill('input[name="name"]', 'Delete Dialog Test');
    await page.fill('input[name="industry"]', 'Media');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('domcontentloaded');

    // Navigate to detail page
    await page.goto('/accounts');
    await page.click('text=Delete Dialog Test');
    await page.waitForLoadState('domcontentloaded');

    // Click delete button
    await page.click('button:has-text("Löschen")');

    // Verify confirmation dialog appears
    await expect(page.locator('text=Account wirklich löschen?')).toBeVisible();
    await expect(page.locator('text=Delete Dialog Test')).toBeVisible();
    await expect(
      page.locator('text=Accounts mit verknüpften Opportunities können nicht gelöscht werden.')
    ).toBeVisible();

    // Verify cancel button exists
    await expect(page.locator('button:has-text("Abbrechen")')).toBeVisible();

    // Verify delete button exists
    await expect(page.locator('button:has-text("Jetzt löschen")')).toBeVisible();
  });

  test('TC-5.2: Account Deletion - Cancel Deletion', async ({ page }) => {
    // Create an account
    await page.goto('/accounts/new');
    await page.fill('input[name="name"]', 'Cancel Delete Test');
    await page.fill('input[name="industry"]', 'Telecom');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('domcontentloaded');

    // Navigate to detail and open delete dialog
    await page.goto('/accounts');
    await page.click('text=Cancel Delete Test');
    await page.click('button:has-text("Löschen")');

    // Cancel deletion
    await page.click('button:has-text("Abbrechen")');

    // Should still be on detail page
    await expect(page).toHaveURL(/\/accounts\/[a-z0-9-]+$/);
    await expect(page.locator('h1:has-text("Cancel Delete Test")')).toBeVisible();
  });

  test('TC-5.3: Account Deletion - Successful Deletion', async ({ page }) => {
    // Create an account
    await page.goto('/accounts/new');
    await page.fill('input[name="name"]', 'Successful Delete Test');
    await page.fill('input[name="industry"]', 'Agriculture');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('domcontentloaded');

    // Navigate to detail and delete
    await page.goto('/accounts');
    await page.click('text=Successful Delete Test');
    await page.click('button:has-text("Löschen")');

    // Confirm deletion
    await page.click('button:has-text("Jetzt löschen")');

    // Wait for success toast
    await expect(page.locator('text=erfolgreich gelöscht')).toBeVisible({ timeout: 5000 });

    // Should redirect to accounts list
    await expect(page).toHaveURL('/accounts');

    // Account should no longer appear in list
    await expect(page.locator('text=Successful Delete Test')).not.toBeVisible();
  });
});

test.describe('Accounts: Account-RFP Linking', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('TC-6.1: RFP Creation with Account Selection', async ({ page }) => {
    // First create an account
    await page.goto('/accounts/new');
    await page.fill('input[name="name"]', 'RFP Link Test Account');
    await page.fill('input[name="industry"]', 'Technology');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('domcontentloaded');

    // Now create an RFP and link to this account
    await page.goto('/qualifications/new');
    await page.waitForLoadState('domcontentloaded');

    // Check if account dropdown/select exists
    const accountSelect = page.locator('select[name="accountId"]');
    const accountCombobox = page.locator('[role="combobox"]');

    if ((await accountSelect.count()) > 0) {
      // It's a select dropdown
      await accountSelect.selectOption({ label: 'RFP Link Test Account' });
    } else if ((await accountCombobox.count()) > 0) {
      // It's a combobox/autocomplete
      await accountCombobox.click();
      await page.click('text=RFP Link Test Account');
    }

    // Fill in RFP data
    await page.fill('textarea[name="rawInput"]', 'Test RFP for account linking');
    await page.selectOption('select[name="source"]', 'reactive');
    await page.selectOption('select[name="stage"]', 'preQualification');
    await page.selectOption('select[name="inputType"]', 'freetext');

    // Submit
    await page.click('button[type="submit"]');

    // Wait for redirect to RFP detail
    await expect(page).toHaveURL(/\/qualifications\/[a-z0-9-]+/);
  });

  test('TC-6.2: View Linked RFPs in Account Detail', async ({ page }) => {
    // Create account
    await page.goto('/accounts/new');
    await page.fill('input[name="name"]', 'View Linked RFPs Account');
    await page.fill('input[name="industry"]', 'Finance');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('domcontentloaded');

    // Create RFP linked to this account
    await page.goto('/qualifications/new');
    await page.waitForLoadState('domcontentloaded');

    const accountSelect = page.locator('select[name="accountId"]');
    if ((await accountSelect.count()) > 0) {
      await accountSelect.selectOption({ label: 'View Linked RFPs Account' });
    }

    await page.fill('textarea[name="rawInput"]', 'Linked RFP test');
    await page.selectOption('select[name="source"]', 'reactive');
    await page.selectOption('select[name="stage"]', 'preQualification');
    await page.selectOption('select[name="inputType"]', 'freetext');
    await page.click('button[type="submit"]');

    // Wait for extraction
    await page.waitForLoadState('domcontentloaded');

    // Now go back to account detail
    await page.goto('/accounts');
    await page.click('text=View Linked RFPs Account');
    await page.waitForLoadState('domcontentloaded');

    // Find Opportunities table
    const oppsTable = page.locator('h3:has-text("Opportunities")').locator('..').locator('..');

    // Verify opportunity count updated
    const statsCard = page.locator('h3:has-text("Statistiken")').locator('..').locator('..');
    await expect(statsCard.locator('text=1')).toBeVisible(); // Should show 1 opportunity

    // Verify table shows the RFP
    await expect(oppsTable.locator('table')).toBeVisible();
    await expect(oppsTable.locator('text=FREETEXT')).toBeVisible();
  });

  test('TC-6.3: Cannot Delete Account with Linked Opportunities', async ({ page }) => {
    // Create account
    await page.goto('/accounts/new');
    await page.fill('input[name="name"]', 'Cannot Delete Account');
    await page.fill('input[name="industry"]', 'Insurance');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('domcontentloaded');

    // Create linked RFP
    await page.goto('/qualifications/new');
    await page.waitForLoadState('domcontentloaded');

    const accountSelect = page.locator('select[name="accountId"]');
    if ((await accountSelect.count()) > 0) {
      await accountSelect.selectOption({ label: 'Cannot Delete Account' });
    }

    await page.fill('textarea[name="rawInput"]', 'Blocking deletion test');
    await page.selectOption('select[name="source"]', 'reactive');
    await page.selectOption('select[name="stage"]', 'preQualification');
    await page.selectOption('select[name="inputType"]', 'freetext');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('domcontentloaded');

    // Try to delete account
    await page.goto('/accounts');
    await page.click('text=Cannot Delete Account');
    await page.click('button:has-text("Löschen")');

    // Confirm deletion
    await page.click('button:has-text("Jetzt löschen")');

    // Should show error toast
    await expect(
      page.locator('text=Account kann nicht gelöscht werden, da noch Opportunities verknüpft sind')
    ).toBeVisible({ timeout: 5000 });

    // Should still be on detail page
    await expect(page).toHaveURL(/\/accounts\/[a-z0-9-]+$/);
  });
});
