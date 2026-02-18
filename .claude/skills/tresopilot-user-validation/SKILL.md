---
name: tresopilot-user-validation
description: Valider les features TresoPilot depuis la perspective utilisateur. Phase 1 = pilotage MCP avec logging. Phase 2 = generation Playwright apres sprint.
---

# TresoPilot User Validation Skill

> **Workflow en 2 phases :**
>
> **Phase 1 - Pendant le sprint (rapide) :**
> - Piloter avec MCP chrome-devtools
> - Logger chaque action dans un fichier YAML
> - Valider visuellement → story "done"
>
> **Phase 2 - Après le sprint (batch) :**
> - Reprendre les logs MCP du sprint
> - Générer les tests Playwright
> - Intégrer dans la CI

## Persona

**Role :** Comptable / DAF d'une TPE/PME francaise
**Contexte :** Je gere la tresorerie de mon entreprise avec TresoPilot
**Objectifs :**
- Importer mes releves bancaires (PDF ou Excel)
- Verifier que les montants extraits correspondent a mes documents papier
- Categoriser mes transactions pour mon suivi budgetaire

---

## Phase 1 : Validation MCP avec Logging

### Format de log MCP

Pour chaque validation, creer un fichier :
`_bmad-output/qa/mcp-logs/{story-id}-{date}.yaml`

```yaml
session:
  story_id: "wiz-007"
  scenario_id: "import-pdf-alpha"
  date: "2026-02-06"
  status: "passed"

config:
  base_url: "http://localhost:5176"
  credentials:
    email: "cancey@solutik.fr"
    password: "test1234"

steps:
  - action: navigate
    url: "/import"

  - action: upload_file
    selector: "input[type='file']"
    file: "fixtures/releve_pro_factice_1.pdf"

  - action: wait_for
    text: "Releve bancaire"
    timeout: 30000

  - action: assert
    type: "visible"
    selector: "[data-testid='file-type-title']"
    contains: "Releve bancaire"

  - action: click
    selector: "button"
    text: "Continuer avec ce type"

  - action: wait_for
    text: "Extraction terminee"
    timeout: 120000

  - action: click
    selector: "button"
    text: "Suivant"

  - action: assert
    type: "visible"
    text: "+449,00"
    description: "Montant Telecom Orange Pro"

  - action: assert
    type: "visible"
    text: "+18 800,00"
    description: "Solde final"

  - action: screenshot
    path: "screenshots/wiz-007-validated.png"

assertions_summary:
  - "Detection type = Releve bancaire (100%)"
  - "Montant Telecom = +449,00"
  - "Solde final = +18 800,00"
  - "Pas d'erreurs console"

selectors_discovered:
  file_input: "input[type='file']"
  file_type_title: "[data-testid='file-type-title']"
  continue_btn: "button:has-text('Continuer avec ce type')"
  next_btn: "button:has-text('Suivant')"
```

### Instructions pendant le pilotage MCP

1. **Avant de commencer** : Créer le fichier YAML avec session info
2. **À chaque action MCP** : Ajouter l'étape dans `steps[]`
3. **À chaque assertion** : Noter le sélecteur et la valeur attendue
4. **À la fin** : Mettre `status: passed` ou `status: failed`

### Commandes MCP à logger

| Action MCP | Format YAML |
|------------|-------------|
| `navigate_page` | `action: navigate, url: "..."` |
| `upload_file` | `action: upload_file, selector: "...", file: "..."` |
| `click` | `action: click, selector: "...", text: "..."` |
| `fill` | `action: fill, selector: "...", value: "..."` |
| `wait_for` | `action: wait_for, text: "...", timeout: N` |
| `take_snapshot` + assertion | `action: assert, type: visible, ...` |
| `take_screenshot` | `action: screenshot, path: "..."` |

---

## Phase 2 : Génération Playwright (après sprint)

### Commande

```
/qa-generate-playwright sprint=epic-wizard-fixes
```

### Process

1. Lire tous les fichiers `_bmad-output/qa/mcp-logs/*.yaml`
2. Pour chaque session avec `status: passed` :
   - Transformer les `steps` en code Playwright
   - Générer le fichier `e2e/{scenario_id}.spec.ts`
3. Lancer les tests pour validation

### Mapping YAML → Playwright

```typescript
// action: navigate
await page.goto(url)

// action: upload_file
await page.locator(selector).setInputFiles(file)

// action: click avec text
await page.getByRole('button', { name: text }).click()

// action: click avec selector
await page.locator(selector).click()

// action: wait_for
await expect(page.locator(`text=${text}`)).toBeVisible({ timeout })

// action: assert visible
await expect(page.locator(selector)).toBeVisible()
await expect(page.locator(selector)).toContainText(contains)

// action: screenshot
// (optionnel dans les tests, utile pour debug)
```

---

## Scenarios de référence

### Scenario 1 : Import PDF - Relevé Alpha Consulting

**ID :** `import-pdf-alpha`
**Priorité :** critical
**Fichier test :** `frontend/e2e/import-pdf-alpha.spec.ts` ✅

#### Fixtures
```yaml
file: fixtures/releve_pro_factice_1.pdf
expected:
  solde_initial: 10000.00
  solde_final: 18800.00
  sample_amounts: [449, 666, 5549, 5615]
```

#### Assertions clés
- Détection "Relevé bancaire" avec confiance > 90%
- Montants extraits correctement (pas de +0,00)
- Dropdowns catégorie fonctionnels
- Bouton "Ignorer" présent sur chaque ligne

---

### Scenario 2 : Import Excel - Plan de Trésorerie

**ID :** `import-excel-pt`
**Priorité :** critical (non-régression)
**Fichier test :** `frontend/e2e/import-excel-pt.spec.ts` ✅

#### Fixtures
```yaml
file: fixtures/plan_tresorerie_12_mois.xlsx
expected:
  periodes: 12
  sections: [VENTES, DEPENSES, RH]
  categories: 12
```

#### Assertions clés
- Détection "Plan de trésorerie" avec confiance > 90%
- 12 mois détectés (Janvier → Décembre)
- 3 sections identifiées
- Mapping des catégories fonctionnel
- PAS d'étape OCR (non-régression)

---

## Checklist de validation

### Phase 1 (pendant sprint)
- [ ] Session MCP loggée dans `_bmad-output/qa/mcp-logs/`
- [ ] Toutes les assertions passent
- [ ] Screenshot de validation sauvegardé
- [ ] Status = passed

### Phase 2 (après sprint)
- [ ] Tests Playwright générés
- [ ] Tests passent (`npm run test:e2e`)
- [ ] Intégré dans CI

---

## Output

| Phase | Fichier |
|-------|---------|
| Phase 1 | `_bmad-output/qa/mcp-logs/{story-id}-{date}.yaml` |
| Phase 1 | `_bmad-output/qa/screenshots/{story-id}-validated.png` |
| Phase 2 | `frontend/e2e/{scenario-id}.spec.ts` |
