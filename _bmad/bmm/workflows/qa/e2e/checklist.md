# E2E QA Checklist

## Coverage
- [ ] Every write operation (POST, PUT, PATCH, DELETE) identified in the story has a test
- [ ] Every test verifies BOTH the UI AND the DB
- [ ] Import operations verify all created records and their relationships

## DB Assertions
- [ ] Created records have correct values
- [ ] Foreign keys point to existing records (no dangling references)
- [ ] `parent_id` is valid for all categories (the orphan bug check)
- [ ] `entreprise_id` is correct on all created records (multi-tenancy)
- [ ] No orphan categories exist after operations (`assertNoOrphanCategories`)
- [ ] No data leaked to other entreprises (`assertCategoriesBelongToEntreprise`)

## UI Assertions
- [ ] Immediate feedback verified (toast, redirect, inline message)
- [ ] Result is visible on the destination page after navigation
- [ ] After each write, navigation to the display page via natural user flow (no direct page.goto)
- [ ] Created data VISIBLE on the display page
- [ ] Displayed amounts in UI = DB computed totals (UI ↔ DB consistency)
- [ ] "Aucune donnée" message (empty-year-message) does NOT appear after an import
- [ ] Error states tested (invalid input, missing required fields)

## Test Quality
- [ ] Semantic locators only (`data-testid`, ARIA roles, visible text)
- [ ] No CSS class selectors (`.btn-primary`, `.card`, etc.)
- [ ] No `waitForTimeout` / hardcoded waits
- [ ] Tests are independent (no order dependency between tests)
- [ ] Each test sets up its own state via `loginAs` helper
- [ ] `db.cleanup()` called in `afterAll`

## Execution
- [ ] All tests pass with `npx playwright test`
- [ ] No flaky tests (run 3 times, same result)
- [ ] Test report generated with write operation coverage summary
