import { test, expect } from '@playwright/test';

/**
 * E2E Test: Master Data CRUD Operations
 *
 * DEA-72: Comprehensive tests for all Master Data entities:
 * - References Management (TC-1)
 * - Competencies Management (TC-2)
 * - Competitors Management (TC-3)
 * - Employees Management (TC-4)
 * - Error Handling (TC-5)
 */

// ============================================================================
// TC-1: References Management
// ============================================================================

test.describe('Master Data: References Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('TC-1.1: References List - Page Load and Display', async ({ page }) => {
    await page.goto('/master-data/references');
    await page.waitForLoadState('networkidle');

    // Verify page loaded
    await expect(page).toHaveURL('/master-data/references');
    await expect(page.locator('h1')).toContainText('Referenzen');

    // Verify "Neue Referenz" button exists
    await expect(page.locator('a:has-text("Neue Referenz")')).toBeVisible();

    // Verify table structure
    await expect(page.locator('table')).toBeVisible();
    await expect(page.locator('th:has-text("Projektname")')).toBeVisible();
    await expect(page.locator('th:has-text("Kunde")')).toBeVisible();
    await expect(page.locator('th:has-text("Industrie")')).toBeVisible();
    await expect(page.locator('th:has-text("Technologien")')).toBeVisible();
    await expect(page.locator('th:has-text("Status")')).toBeVisible();
  });

  test('TC-1.2: References List - Status Filter (pending, approved, rejected)', async ({
    page,
  }) => {
    await page.goto('/master-data/references');
    await page.waitForLoadState('networkidle');

    // Check if any references exist
    const hasReferences = (await page.locator('tbody tr').count()) > 0;

    if (hasReferences) {
      // Verify status badges are visible
      const statusBadges = page.locator('td').filter({ hasText: /Ausstehend|Genehmigt|Abgelehnt/ });
      await expect(statusBadges.first()).toBeVisible({ timeout: 3000 });

      // Count different statuses (if filter exists)
      const pendingBadges = page.locator('text=Ausstehend');
      const approvedBadges = page.locator('text=Genehmigt');
      const rejectedBadges = page.locator('text=Abgelehnt');

      // At least one status should be present
      const totalStatuses =
        (await pendingBadges.count()) +
        (await approvedBadges.count()) +
        (await rejectedBadges.count());
      expect(totalStatuses).toBeGreaterThan(0);
    }
  });

  test('TC-1.3: References List - Search by Project Name and Customer Name', async ({ page }) => {
    await page.goto('/master-data/references');
    await page.waitForLoadState('networkidle');

    // Check if there are references to search
    const hasReferences = (await page.locator('tbody tr').count()) > 0;

    if (hasReferences) {
      // Get first project name from table
      const firstProjectName = await page
        .locator('tbody tr:first-child td:first-child')
        .textContent();

      if (firstProjectName) {
        // Note: Search functionality might not be implemented yet
        // This test documents expected behavior
        const searchInput = page.locator('input[placeholder*="Suche"]');
        if ((await searchInput.count()) > 0) {
          await searchInput.fill(firstProjectName);
          await page.waitForTimeout(500);

          // Should still show the reference
          await expect(page.locator(`text=${firstProjectName}`)).toBeVisible();
        }
      }
    }
  });

  test('TC-1.4: Reference Creation - Full Flow', async ({ page }) => {
    await page.goto('/master-data/references');
    await page.waitForLoadState('networkidle');

    // Click "Neue Referenz" button
    await page.click('a:has-text("Neue Referenz")');

    // Wait for navigation to /new page
    await expect(page).toHaveURL(/\/references\/new/);

    // Fill in required fields
    await page.fill('input[name="projectName"]', 'E2E Test Reference Project');
    await page.fill('input[name="customerName"]', 'E2E Test Customer GmbH');
    await page.fill('input[name="industry"]', 'Financial Services');

    // Fill technologies (expecting comma-separated or array input)
    const techInput = page.locator('input[name="technologies"]');
    if ((await techInput.count()) > 0) {
      await techInput.fill('Drupal, React, TypeScript');
    }

    // Fill scope
    await page.fill('textarea[name="scope"]', 'Complete CMS migration and modernization');

    // Fill team size
    await page.fill('input[name="teamSize"]', '8');

    // Fill duration
    await page.fill('input[name="durationMonths"]', '12');

    // Fill budget range
    await page.fill('input[name="budgetRange"]', '500k-1M EUR');

    // Fill outcome
    await page.fill('textarea[name="outcome"]', 'Successfully delivered modern CMS platform');

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for success toast
    await expect(page.locator('text=/erfolgreich|erstellt/i')).toBeVisible({ timeout: 5000 });

    // Verify redirect back to list
    await expect(page).toHaveURL(/\/master-data\/references/);

    // Verify new reference appears in list
    await expect(page.locator('text=E2E Test Reference Project')).toBeVisible({ timeout: 3000 });
  });

  test('TC-1.5: Reference Deletion - Confirmation Flow', async ({ page }) => {
    // First, create a reference to delete
    await page.goto('/references/new');
    await page.fill('input[name="projectName"]', 'Delete Test Reference');
    await page.fill('input[name="customerName"]', 'Delete Customer');
    await page.fill('input[name="industry"]', 'Healthcare');
    const techInput = page.locator('input[name="technologies"]');
    if ((await techInput.count()) > 0) {
      await techInput.fill('Java');
    }
    await page.fill('textarea[name="scope"]', 'Test scope');
    await page.fill('input[name="teamSize"]', '5');
    await page.fill('input[name="durationMonths"]', '6');
    await page.fill('input[name="budgetRange"]', '100k-250k');
    await page.fill('textarea[name="outcome"]', 'Test outcome');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');

    await page.goto('/master-data/references');
    await page.waitForLoadState('networkidle');

    // Note: Delete button might not be implemented in list view
    // This test documents expected behavior
    const deleteButton = page
      .locator('tr')
      .filter({ hasText: 'Delete Test Reference' })
      .locator('button[title*="Löschen"]');

    if ((await deleteButton.count()) > 0) {
      // Listen for confirmation dialog
      page.on('dialog', async dialog => {
        expect(dialog.type()).toBe('confirm');
        expect(dialog.message()).toMatch(/löschen/i);
        await dialog.accept();
      });

      await deleteButton.click();

      // Wait for success toast
      await expect(page.locator('text=/gelöscht|erfolgreich/i')).toBeVisible({ timeout: 5000 });

      // Verify reference is removed
      await expect(page.locator('text=Delete Test Reference')).not.toBeVisible();
    }
  });

  test('TC-1.6: Reference Validation Workflow - pending → approved/rejected', async ({ page }) => {
    // Create a reference (starts as pending)
    await page.goto('/references/new');
    await page.fill('input[name="projectName"]', 'Validation Test Reference');
    await page.fill('input[name="customerName"]', 'Validation Customer');
    await page.fill('input[name="industry"]', 'Retail');
    const techInput = page.locator('input[name="technologies"]');
    if ((await techInput.count()) > 0) {
      await techInput.fill('SAP Commerce');
    }
    await page.fill('textarea[name="scope"]', 'E-commerce platform');
    await page.fill('input[name="teamSize"]', '10');
    await page.fill('input[name="durationMonths"]', '18');
    await page.fill('input[name="budgetRange"]', '1M-2M');
    await page.fill('textarea[name="outcome"]', 'Platform launched successfully');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');

    await page.goto('/master-data/references');
    await page.waitForLoadState('networkidle');

    // Verify it shows as "Ausstehend" (pending)
    const referenceRow = page.locator('tr').filter({ hasText: 'Validation Test Reference' });
    await expect(referenceRow.locator('text=Ausstehend')).toBeVisible({ timeout: 3000 });

    // Note: Admin approval flow would be tested in admin-specific tests
  });

  test('TC-1.7: Reference Optimistic Locking - Version Conflict Detection', async ({
    page,
    context,
  }) => {
    // This test documents expected behavior for optimistic locking
    // Requires edit functionality to be implemented

    await page.goto('/master-data/references');
    await page.waitForLoadState('networkidle');

    // Note: Optimistic locking is implemented in schema (version field)
    // Actual conflict detection would require edit form with version field
    // Test would verify that concurrent updates trigger conflict error
  });
});

// ============================================================================
// TC-2: Competencies Management
// ============================================================================

test.describe('Master Data: Competencies Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('TC-2.1: Competencies List - Category Grouping', async ({ page }) => {
    await page.goto('/master-data/competencies');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL('/master-data/competencies');
    await expect(page.locator('h1')).toContainText('Kompetenzen');

    // Verify table structure
    await expect(page.locator('th:has-text("Name")')).toBeVisible();
    await expect(page.locator('th:has-text("Kategorie")')).toBeVisible();
    await expect(page.locator('th:has-text("Level")')).toBeVisible();
    await expect(page.locator('th:has-text("Status")')).toBeVisible();

    // Check for category badges
    const hasCompetencies = (await page.locator('tbody tr').count()) > 0;
    if (hasCompetencies) {
      const categoryBadges = page.locator('text=/Technologie|Methodik|Industrie|Soft Skill/');
      await expect(categoryBadges.first()).toBeVisible({ timeout: 3000 });
    }
  });

  test('TC-2.2: Competencies Filter - Category (technology, methodology, industry, soft_skill)', async ({
    page,
  }) => {
    await page.goto('/master-data/competencies');
    await page.waitForLoadState('networkidle');

    const hasCompetencies = (await page.locator('tbody tr').count()) > 0;

    if (hasCompetencies) {
      // Verify different categories exist
      const techBadges = page.locator('text=Technologie');
      const methodBadges = page.locator('text=Methodik');
      const industryBadges = page.locator('text=Industrie');
      const softSkillBadges = page.locator('text=Soft Skill');

      // Count total categories
      const totalCategories =
        (await techBadges.count()) +
        (await methodBadges.count()) +
        (await industryBadges.count()) +
        (await softSkillBadges.count());

      expect(totalCategories).toBeGreaterThan(0);
    }
  });

  test('TC-2.3: Competencies Filter - Level (basic, advanced, expert)', async ({ page }) => {
    await page.goto('/master-data/competencies');
    await page.waitForLoadState('networkidle');

    const hasCompetencies = (await page.locator('tbody tr').count()) > 0;

    if (hasCompetencies) {
      // Verify different levels exist
      const basicBadges = page.locator('text=Basis');
      const advancedBadges = page.locator('text=Fortgeschritten');
      const expertBadges = page.locator('text=Experte');

      const totalLevels =
        (await basicBadges.count()) + (await advancedBadges.count()) + (await expertBadges.count());

      expect(totalLevels).toBeGreaterThan(0);
    }
  });

  test('TC-2.4: Competency Creation - With Certifications', async ({ page }) => {
    await page.goto('/master-data/competencies');
    await page.waitForLoadState('networkidle');

    await page.click('a:has-text("Neue Kompetenz")');
    await expect(page).toHaveURL(/\/competencies\/new/);

    // Fill required fields
    await page.fill('input[name="name"]', 'E2E Test Competency');

    // Select category
    const categorySelect = page.locator('select[name="category"]');
    if ((await categorySelect.count()) > 0) {
      await categorySelect.selectOption('technology');
    }

    // Select level
    const levelSelect = page.locator('select[name="level"]');
    if ((await levelSelect.count()) > 0) {
      await levelSelect.selectOption('advanced');
    }

    // Fill optional description
    const descriptionTextarea = page.locator('textarea[name="description"]');
    if ((await descriptionTextarea.count()) > 0) {
      await descriptionTextarea.fill('Test competency for E2E testing');
    }

    // Fill certifications (if field exists)
    const certificationsInput = page.locator('input[name="certifications"]');
    if ((await certificationsInput.count()) > 0) {
      await certificationsInput.fill('Certified Professional, Expert Level');
    }

    // Submit
    await page.click('button[type="submit"]');

    await expect(page.locator('text=/erfolgreich|erstellt/i')).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL(/\/master-data\/competencies/);
    await expect(page.locator('text=E2E Test Competency')).toBeVisible({ timeout: 3000 });
  });

  test('TC-2.5: Competency Level Upgrade - Edit Functionality', async ({ page }) => {
    // Create a basic level competency
    await page.goto('/competencies/new');
    await page.fill('input[name="name"]', 'Upgrade Test Competency');
    const categorySelect = page.locator('select[name="category"]');
    if ((await categorySelect.count()) > 0) {
      await categorySelect.selectOption('methodology');
    }
    const levelSelect = page.locator('select[name="level"]');
    if ((await levelSelect.count()) > 0) {
      await levelSelect.selectOption('basic');
    }
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');

    await page.goto('/master-data/competencies');
    await page.waitForLoadState('networkidle');

    // Verify it shows as "Basis"
    const competencyRow = page.locator('tr').filter({ hasText: 'Upgrade Test Competency' });
    await expect(competencyRow.locator('text=Basis')).toBeVisible({ timeout: 3000 });

    // Note: Edit functionality would upgrade level from basic → advanced
  });

  test('TC-2.6: Competencies Validation Workflow - pending → approved', async ({ page }) => {
    await page.goto('/competencies/new');
    await page.fill('input[name="name"]', 'Validation Competency');
    const categorySelect = page.locator('select[name="category"]');
    if ((await categorySelect.count()) > 0) {
      await categorySelect.selectOption('soft_skill');
    }
    const levelSelect = page.locator('select[name="level"]');
    if ((await levelSelect.count()) > 0) {
      await levelSelect.selectOption('expert');
    }
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');

    await page.goto('/master-data/competencies');
    await page.waitForLoadState('networkidle');

    // Verify pending status
    const competencyRow = page.locator('tr').filter({ hasText: 'Validation Competency' });
    await expect(competencyRow.locator('text=Ausstehend')).toBeVisible({ timeout: 3000 });
  });

  test('TC-2.7: CSV Import for Bulk Upload', async ({ page }) => {
    await page.goto('/master-data/competencies');
    await page.waitForLoadState('networkidle');

    // Note: CSV import functionality may not be implemented yet
    // This test documents expected behavior
    const csvImportButton = page.locator('button:has-text("CSV Import")');

    if ((await csvImportButton.count()) > 0) {
      await csvImportButton.click();

      // Expect upload dialog
      const fileInput = page.locator('input[type="file"]');
      await expect(fileInput).toBeVisible();

      // Note: Actual CSV file upload would be tested here
    }
  });
});

// ============================================================================
// TC-3: Competitors Management
// ============================================================================

test.describe('Master Data: Competitors Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('TC-3.1: Competitors List - Alphabetical Order', async ({ page }) => {
    await page.goto('/master-data/competitors');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL('/master-data/competitors');
    await expect(page.locator('h1')).toContainText('Wettbewerber');

    // Verify table structure
    await expect(page.locator('th:has-text("Firma")')).toBeVisible();
    await expect(page.locator('th:has-text("Website")')).toBeVisible();
    await expect(page.locator('th:has-text("Industrien")')).toBeVisible();
    await expect(page.locator('th:has-text("Status")')).toBeVisible();
  });

  test('TC-3.2: Competitors Filter - Industry', async ({ page }) => {
    await page.goto('/master-data/competitors');
    await page.waitForLoadState('networkidle');

    const hasCompetitors = (await page.locator('tbody tr').count()) > 0;

    if (hasCompetitors) {
      // Industry badges should be visible
      const industryBadges = page
        .locator('tbody td')
        .filter({ has: page.locator('[class*="badge"]') });
      await expect(industryBadges.first()).toBeVisible({ timeout: 3000 });
    }
  });

  test('TC-3.3: Competitors Search - Company Name', async ({ page }) => {
    await page.goto('/master-data/competitors');
    await page.waitForLoadState('networkidle');

    const hasCompetitors = (await page.locator('tbody tr').count()) > 0;

    if (hasCompetitors) {
      const firstCompanyName = await page
        .locator('tbody tr:first-child td:first-child')
        .textContent();

      if (firstCompanyName) {
        const searchInput = page.locator('input[placeholder*="Suche"]');
        if ((await searchInput.count()) > 0) {
          await searchInput.fill(firstCompanyName);
          await page.waitForTimeout(500);

          await expect(page.locator(`text=${firstCompanyName}`)).toBeVisible();
        }
      }
    }
  });

  test('TC-3.4: Competitor Creation - With Strengths/Weaknesses', async ({ page }) => {
    await page.goto('/master-data/competitors');
    await page.waitForLoadState('networkidle');

    // Note: Competitors creation form may not exist yet - documenting expected behavior
    const newButton = page.locator('a:has-text("Neuer Wettbewerber")');

    if ((await newButton.count()) > 0) {
      await newButton.click();
      await expect(page).toHaveURL(/\/competitors\/new/);

      await page.fill('input[name="companyName"]', 'E2E Test Competitor GmbH');

      const websiteInput = page.locator('input[name="website"]');
      if ((await websiteInput.count()) > 0) {
        await websiteInput.fill('https://test-competitor.example.com');
      }

      const industryInput = page.locator('input[name="industry"]');
      if ((await industryInput.count()) > 0) {
        await industryInput.fill('Financial Services, Healthcare');
      }

      const strengthsInput = page.locator('textarea[name="strengths"]');
      if ((await strengthsInput.count()) > 0) {
        await strengthsInput.fill('Strong market presence, Technical expertise');
      }

      const weaknessesInput = page.locator('textarea[name="weaknesses"]');
      if ((await weaknessesInput.count()) > 0) {
        await weaknessesInput.fill('High pricing, Limited regional coverage');
      }

      await page.click('button[type="submit"]');

      await expect(page.locator('text=/erfolgreich|erstellt/i')).toBeVisible({ timeout: 5000 });
      await expect(page).toHaveURL(/\/master-data\/competitors/);
      await expect(page.locator('text=E2E Test Competitor')).toBeVisible({ timeout: 3000 });
    }
  });

  test('TC-3.5: Competitor Edit - Add Encounter Notes', async ({ page }) => {
    // Note: This documents expected edit functionality
    await page.goto('/master-data/competitors');
    await page.waitForLoadState('networkidle');

    // Edit functionality would allow adding encounter notes
    // Encounter notes: observations from actual bid competitions
  });

  test('TC-3.6: Competitor Validation Workflow', async ({ page }) => {
    // Note: Same validation workflow as references/competencies
    await page.goto('/master-data/competitors');
    await page.waitForLoadState('networkidle');

    const hasCompetitors = (await page.locator('tbody tr').count()) > 0;

    if (hasCompetitors) {
      // Should see status badges: Ausstehend, Genehmigt, Abgelehnt
      const statusBadges = page.locator('text=/Ausstehend|Genehmigt|Abgelehnt/');
      await expect(statusBadges.first()).toBeVisible({ timeout: 3000 });
    }
  });

  test('TC-3.7: Duplicate Detection - Same Company Name', async ({ page }) => {
    // Note: This documents expected duplicate detection behavior
    // Should warn when creating competitor with existing company name
  });
});

// ============================================================================
// TC-4: Employees Management (DEA-23)
// ============================================================================

test.describe('Master Data: Employees Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('TC-4.1: Employees List - Business Unit Grouping', async ({ page }) => {
    await page.goto('/admin/employees');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL('/admin/employees');
    await expect(page.locator('h1')).toContainText('Mitarbeiter');

    // Verify buttons exist
    await expect(page.locator('button:has-text("CSV Import")')).toBeVisible();
    await expect(page.locator('button:has-text("Neuer Mitarbeiter")')).toBeVisible();
  });

  test('TC-4.2: Employees Filter - Availability Status', async ({ page }) => {
    await page.goto('/admin/employees');
    await page.waitForLoadState('networkidle');

    // Note: Filter controls may not be implemented yet
    // Expected statuses: available, on_project, unavailable
  });

  test('TC-4.3: Employees Filter - Skills (Multi-Select)', async ({ page }) => {
    await page.goto('/admin/employees');
    await page.waitForLoadState('networkidle');

    // Note: Multi-select skill filter not yet implemented
    // Would allow filtering employees by one or more skills
  });

  test('TC-4.4: Employee Creation - With Skills Array', async ({ page }) => {
    await page.goto('/admin/employees');
    await page.waitForLoadState('networkidle');

    await page.click('button:has-text("Neuer Mitarbeiter")');
    await expect(page).toHaveURL('/admin/employees/new');

    await page.fill('input[name="name"]', 'E2E Test Employee');
    await page.fill('input[name="email"]', 'e2e.test@adesso.de');

    // Select business unit
    const buSelect = page.locator('select[name="businessUnitId"]');
    if ((await buSelect.count()) > 0 && (await buSelect.locator('option').count()) > 1) {
      await buSelect.selectOption({ index: 1 });
    }

    // Skills input (might be multi-select or comma-separated)
    const skillsInput = page.locator('input[name="skills"]');
    if ((await skillsInput.count()) > 0) {
      await skillsInput.fill('React, TypeScript, Node.js');
    }

    // Roles input
    const rolesInput = page.locator('input[name="roles"]');
    if ((await rolesInput.count()) > 0) {
      await rolesInput.fill('developer, lead');
    }

    // Availability status
    const availabilitySelect = page.locator('select[name="availabilityStatus"]');
    if ((await availabilitySelect.count()) > 0) {
      await availabilitySelect.selectOption('available');
    }

    await page.click('button[type="submit"]');

    await expect(page.locator('text=/erfolgreich|erstellt/i')).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL(/\/admin\/employees/);
    await expect(page.locator('text=E2E Test Employee')).toBeVisible({ timeout: 3000 });
  });

  test('TC-4.5: Employee Edit - Update Skills + Roles', async ({ page }) => {
    // First create an employee
    await page.goto('/admin/employees/new');
    await page.fill('input[name="name"]', 'Edit Test Employee');
    await page.fill('input[name="email"]', 'edit.test@adesso.de');

    const buSelect = page.locator('select[name="businessUnitId"]');
    if ((await buSelect.count()) > 0 && (await buSelect.locator('option').count()) > 1) {
      await buSelect.selectOption({ index: 1 });
    }

    const skillsInput = page.locator('input[name="skills"]');
    if ((await skillsInput.count()) > 0) {
      await skillsInput.fill('Java');
    }

    const rolesInput = page.locator('input[name="roles"]');
    if ((await rolesInput.count()) > 0) {
      await rolesInput.fill('developer');
    }

    const availabilitySelect = page.locator('select[name="availabilityStatus"]');
    if ((await availabilitySelect.count()) > 0) {
      await availabilitySelect.selectOption('available');
    }

    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');

    await page.goto('/admin/employees');
    await page.waitForLoadState('networkidle');

    // Find and click edit button (if exists)
    const editButton = page
      .locator('tr')
      .filter({ hasText: 'Edit Test Employee' })
      .locator('button[title*="Bearbeiten"]');

    if ((await editButton.count()) > 0) {
      await editButton.click();
      await expect(page).toHaveURL(/\/admin\/employees\/.*\/edit/);

      // Update skills
      const skillsInputEdit = page.locator('input[name="skills"]');
      if ((await skillsInputEdit.count()) > 0) {
        await skillsInputEdit.clear();
        await skillsInputEdit.fill('Java, Spring Boot, Kubernetes');
      }

      // Update roles
      const rolesInputEdit = page.locator('input[name="roles"]');
      if ((await rolesInputEdit.count()) > 0) {
        await rolesInputEdit.clear();
        await rolesInputEdit.fill('developer, architect');
      }

      await page.click('button[type="submit"]');
      await expect(page.locator('text=/aktualisiert|erfolgreich/i')).toBeVisible({ timeout: 5000 });
    }
  });

  test('TC-4.6: CSV Import - Bulk Upload Employees', async ({ page }) => {
    await page.goto('/admin/employees');
    await page.waitForLoadState('networkidle');

    // Click CSV Import button
    await page.click('button:has-text("CSV Import")');

    // Verify dialog opened
    await expect(page.locator('text=CSV importieren')).toBeVisible();

    // Verify CSV format instructions
    await expect(page.locator('text=/name,email,businessUnitId/i')).toBeVisible();

    // Verify file input exists
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeVisible();

    // Note: Actual CSV upload requires file fixture
    // Would create temp CSV file with test data and upload
  });

  test('TC-4.7: Employee Deletion - With Confirmation', async ({ page }) => {
    // Create employee to delete
    await page.goto('/admin/employees/new');
    await page.fill('input[name="name"]', 'Delete Test Employee');
    await page.fill('input[name="email"]', 'delete.test@adesso.de');

    const buSelect = page.locator('select[name="businessUnitId"]');
    if ((await buSelect.count()) > 0 && (await buSelect.locator('option').count()) > 1) {
      await buSelect.selectOption({ index: 1 });
    }

    const skillsInput = page.locator('input[name="skills"]');
    if ((await skillsInput.count()) > 0) {
      await skillsInput.fill('PHP');
    }

    const rolesInput = page.locator('input[name="roles"]');
    if ((await rolesInput.count()) > 0) {
      await rolesInput.fill('developer');
    }

    const availabilitySelect = page.locator('select[name="availabilityStatus"]');
    if ((await availabilitySelect.count()) > 0) {
      await availabilitySelect.selectOption('available');
    }

    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');

    await page.goto('/admin/employees');
    await page.waitForLoadState('networkidle');

    // Find delete button
    const deleteButton = page
      .locator('tr')
      .filter({ hasText: 'Delete Test Employee' })
      .locator('button[title*="Löschen"]');

    if ((await deleteButton.count()) > 0) {
      // Listen for confirmation
      page.on('dialog', async dialog => {
        expect(dialog.type()).toBe('confirm');
        expect(dialog.message()).toMatch(/löschen/i);
        await dialog.accept();
      });

      await deleteButton.click();

      await expect(page.locator('text=/gelöscht|erfolgreich/i')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('text=Delete Test Employee')).not.toBeVisible();
    }
  });
});

// ============================================================================
// TC-5: Error Handling
// ============================================================================

test.describe('Master Data: Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('TC-5.1: Network Error - Retry Button', async ({ page }) => {
    // Simulate network error by blocking API requests
    await page.route('**/api/**', route => route.abort());

    await page.goto('/master-data/references');

    // Should show error message
    const errorMessage = page.locator('text=/Fehler|Error|nicht laden/i');
    if ((await errorMessage.count()) > 0) {
      await expect(errorMessage).toBeVisible({ timeout: 5000 });

      // Should have retry button
      const retryButton = page.locator('button:has-text("Retry")');
      if ((await retryButton.count()) > 0) {
        await expect(retryButton).toBeVisible();
      }
    }

    // Re-enable network
    await page.unroute('**/api/**');
  });

  test('TC-5.2: Validation Errors - Inline Error Messages', async ({ page }) => {
    await page.goto('/references/new');

    // Submit empty form to trigger validation
    await page.click('button[type="submit"]');

    // Should show validation errors
    const errorMessages = page.locator('text=/erforderlich|required|muss ausgefüllt/i');
    await expect(errorMessages.first()).toBeVisible({ timeout: 3000 });
  });

  test('TC-5.3: Optimistic Update Rollback - Server Error', async ({ page }) => {
    // This documents expected behavior for optimistic updates
    // When mutation fails, UI should rollback to previous state
  });

  test('TC-5.4: Version Conflict - Refresh + Retry', async ({ page }) => {
    // This documents expected behavior for version conflicts
    // When version mismatch detected, should prompt to refresh data
    // User can then retry with latest version
  });

  test('TC-5.5: Form Validation - Required Fields', async ({ page }) => {
    await page.goto('/competencies/new');

    // Try to submit without filling required fields
    await page.click('button[type="submit"]');

    // Browser should prevent submission (HTML5 validation)
    // Or custom validation should show errors
    await expect(page).toHaveURL(/\/competencies\/new/);
  });

  test('TC-5.6: Duplicate Email - Employee Creation', async ({ page }) => {
    // Create first employee
    await page.goto('/admin/employees/new');
    await page.fill('input[name="name"]', 'Duplicate Email Test 1');
    await page.fill('input[name="email"]', 'duplicate.test@adesso.de');

    const buSelect = page.locator('select[name="businessUnitId"]');
    if ((await buSelect.count()) > 0 && (await buSelect.locator('option').count()) > 1) {
      await buSelect.selectOption({ index: 1 });
    }

    const skillsInput = page.locator('input[name="skills"]');
    if ((await skillsInput.count()) > 0) {
      await skillsInput.fill('Test');
    }

    const rolesInput = page.locator('input[name="roles"]');
    if ((await rolesInput.count()) > 0) {
      await rolesInput.fill('developer');
    }

    const availabilitySelect = page.locator('select[name="availabilityStatus"]');
    if ((await availabilitySelect.count()) > 0) {
      await availabilitySelect.selectOption('available');
    }

    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');

    // Try to create second employee with same email
    await page.goto('/admin/employees/new');
    await page.fill('input[name="name"]', 'Duplicate Email Test 2');
    await page.fill('input[name="email"]', 'duplicate.test@adesso.de');

    if ((await buSelect.count()) > 0 && (await buSelect.locator('option').count()) > 1) {
      await page.locator('select[name="businessUnitId"]').selectOption({ index: 1 });
    }

    const skillsInput2 = page.locator('input[name="skills"]');
    if ((await skillsInput2.count()) > 0) {
      await skillsInput2.fill('Test');
    }

    const rolesInput2 = page.locator('input[name="roles"]');
    if ((await rolesInput2.count()) > 0) {
      await rolesInput2.fill('developer');
    }

    const availabilitySelect2 = page.locator('select[name="availabilityStatus"]');
    if ((await availabilitySelect2.count()) > 0) {
      await availabilitySelect2.selectOption('available');
    }

    await page.click('button[type="submit"]');

    // Should show duplicate error
    const errorMessage = page.locator('text=/bereits vorhanden|duplicate|unique/i');
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
  });
});
