# E2E QA Workflow — Full Chain Testing

## Overview

This workflow generates Playwright E2E tests that follow the "full chain" pattern:
**UI action -> UI feedback -> Navigation to result -> UI verification -> DB verification -> Side effect check**

## Prerequisites

- `e2e/` package installed (`npm install` done)
- Playwright browsers installed (`npx playwright install chromium`)
- Docker Sail running (`cd api && ./vendor/bin/sail up -d`)
- Frontend dev server running (`cd frontend && npm run dev`)
- E2E data seeded (`cd api && ./vendor/bin/sail artisan db:seed --class=E2ETestSeeder`)

## Step 1: Analyze the Story

Read the story file and identify ALL write operations:
- **CREATE**: POST endpoints, form submissions that create records
- **UPDATE**: PUT/PATCH endpoints, inline editing
- **DELETE**: DELETE endpoints, delete buttons
- **IMPORT**: File uploads that create multiple records

For each write operation, note:
- Which DB tables are affected
- What relationships should be created (foreign keys)
- What the UI should show after the operation

## Step 2: Generate Tests — The "Full Chain" Pattern

For EACH write operation identified in Step 1, generate a test following this exact structure:

```typescript
test('description of the user action', async ({ page }) => {
  // === SETUP ===
  // Login via API helper (fast, no UI)
  await loginAs(page, 'e2e@test.com', 'password');

  // === ACTION UI ===
  // Perform the action through the UI (click, fill, upload, etc.)
  // Use semantic locators: data-testid, ARIA roles, visible text
  // NEVER use CSS class selectors

  // === VERIFICATION UI (feedback) ===
  // Check the immediate feedback (toast, redirect, message)
  // This is what existing tests do — but we DON'T stop here

  // === VERIFICATION UI DISPLAY (OBLIGATOIRE) ===
  // Follow the natural user navigation to the result page:
  // - Click the navigation button (e.g., "Voir mes données")
  // - Wait for the destination page to load
  // - Verify that the created data is VISIBLE
  // - Compare displayed amounts with DB totals (UI ↔ DB consistency)
  //
  // ROUTES DE VÉRIFICATION PAR DOMAINE :
  // | Opération              | Navigation                    | Page destination   | Vérification                                          |
  // |------------------------|-------------------------------|--------------------|-------------------------------------------------------|
  // | Import budget_plan     | view-data-button → /tresorerie| PlanTresorerieView | summary cards non-zéro, table visible, montants = DB  |
  // | Import relevé bancaire | view-data-button → /import/history | ImportView    | import listé, statut correct                          |
  // | CRUD catégorie         | Naviguer vers /categories     | CategoriesView     | catégorie visible dans l'arbre                        |
  // | Saisie ligne PT        | Rester sur /tresorerie        | PlanTresorerieView | cellule mise à jour, totaux recalculés                |
  //
  // Helper available: verifyBudgetPlanDisplay() in e2e/helpers/verify-display.ts

  // === VERIFICATION UI (result) ===
  // Navigate to where the result should appear
  // Verify the data is displayed correctly

  // === VERIFICATION DB (the real truth) ===
  // Query the database directly to verify:
  // 1. The record exists with correct values
  // 2. Foreign keys point to real records
  // 3. entreprise_id is correct (multi-tenancy)

  // === VERIFICATION: NO SIDE EFFECTS ===
  // Check for absence of damage:
  // - No orphan categories (parent_id pointing to nothing)
  // - No data leaked to other entreprises
  // - No duplicate records
});
```

## Step 3: Mandatory DB Assertions

Every test that performs a write MUST include these DB checks:

### For Category Operations:
```typescript
// Category has a valid parent (not orphan)
const cat = await db.findOne('categories', { id: createdCategoryId });
expect(cat.parent_id).not.toBeNull();
const parent = await db.findOne('categories', { id: cat.parent_id });
expect(parent).toBeTruthy();

// No orphan categories exist
await assertions.assertNoOrphanCategories(entrepriseId);
```

### For Any Created Record:
```typescript
// Multi-tenancy: correct entreprise_id
expect(record.entreprise_id).toBe(entrepriseId);

// Belongs to correct user when applicable
expect(record.user_id).toBe(userId);
```

### For Import Operations:
```typescript
// Import record exists and has correct status
await assertions.assertImportStatus(importId, 'validated');

// All imported lines reference valid categories
const lignes = await db.findMany('import_lignes', { import_id: importId });
for (const ligne of lignes) {
  if (ligne.categorie_id) {
    const cat = await db.findOne('categories', { id: ligne.categorie_id });
    expect(cat).toBeTruthy();
    expect(cat.entreprise_id).toBe(entrepriseId);
  }
}
```

## Step 4: Run Tests

```bash
cd e2e && npx playwright test
```

If tests fail:
1. Read the error message carefully
2. Check if the failure is in UI (locator not found) or DB (assertion failed)
3. For UI failures: verify the locator exists in the component code
4. For DB failures: this is a REAL BUG — do not "fix" the test, flag it

## Step 5: Report

Generate a report with:

```markdown
## E2E Test Report — {story-id}

### Write Operations Identified
- [ ] Operation 1: {description} → test in {file}:{line}
- [ ] Operation 2: ...

### Test Results
- Total: X tests
- Passed: Y
- Failed: Z

### DB Assertions Coverage
- Records created: verified ✓/✗
- Foreign keys: verified ✓/✗
- Multi-tenancy: verified ✓/✗
- No orphans: verified ✓/✗
- No side effects: verified ✓/✗

### Verdict
PASS / FAIL (with details)
```

## Available Helpers

### `e2e/helpers/database.ts`
- `db.query(sql, params)` — raw SQL
- `db.findOne(table, where)` — find single row
- `db.findMany(table, where)` — find multiple rows
- `db.assertExists(table, where)` — throw if not found
- `db.assertNotExists(table, where)` — throw if found
- `db.count(table, where)` — count rows
- `db.cleanup()` — close pool (afterAll)

### `e2e/helpers/auth.ts`
- `loginAs(page, email, password)` — API login + localStorage injection
- `logout(page)` — clear auth

### `e2e/helpers/assertions.ts`
- `assertions.assertCategoryHasParent(catId, parentId)`
- `assertions.assertLignePtInCategory(ligneId, catId)`
- `assertions.assertImportStatus(importId, status)`
- `assertions.assertNoOrphanCategories(entrepriseId)`
- `assertions.assertCategoriesBelongToEntreprise(entrepriseId)`

## Anti-Patterns — FORBIDDEN

1. **Surface-only test**: checking `assertOk()` or toast without DB verification
2. **Hardcoded waits**: `waitForTimeout(5000)` — use `waitForSelector` or `expect().toBeVisible()`
3. **CSS class selectors**: `.btn-primary` — use `data-testid` or text
4. **Order-dependent tests**: test B depends on data from test A
5. **Ignoring DB failures**: "the test works if I remove the DB check" — NO, the bug is real
