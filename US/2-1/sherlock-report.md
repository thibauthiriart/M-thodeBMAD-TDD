# Sherlock Report — Story 2-1: Seller Dashboard

## Niveau 1 — Diagnostic rapide (2026-02-19)

**Tests** : 15/35 PASS, 20/35 FAIL
**Pattern identifie** : Tous les 20 echecs partagent la meme erreur racine — le login de `e2e-vendeur@test.com` (vendeur1) renvoie du HTML au lieu de JSON.

---

### BUG-001: Login API renvoie HTML (`<!DOCTYPE ...`) au lieu de JSON pour vendeur1

- **Statut** : :red_circle: EN COURS
- **Impact** : 20 tests sur 35 (tous les tests utilisant `loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD)`)
- **Erreur** :
  ```
  SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
    at ../helpers/auth.ts:49
    const json: LoginApiResponse = await response.json();
  ```

- **Diagnostic** :

  **Cause racine double (les deux doivent etre corrigees) :**

  **1. CAUSE PRIMAIRE — Header `Accept: application/json` manquant dans `loginAs()`**

  Le helper `loginAs()` dans `e2e/helpers/auth.ts:40-42` envoie la requete POST sans header `Accept` :

  ```typescript
  // e2e/helpers/auth.ts:40-42
  const response = await page.request.post(`${API_URL}/auth/login`, {
    data: { email, password },
    // PAS DE HEADER Accept: application/json !
  });
  ```

  Comparaison avec `createProductForSeller()` dans `e2e/tests/2-1.e2e.ts:63-67` qui, lui, envoie correctement le header :
  ```typescript
  headers: {
    Accept: 'application/json',  // <-- Present ici
    Authorization: `Bearer ${token}`,
  },
  ```

  **Consequence** : Quand le login echoue (user inexistant, mauvais password), Laravel lance une `ValidationException` (`api/app/Services/AuthService.php:49`). Le handler d'exceptions par defaut verifie `$request->wantsJson()` qui retourne `false` sans le header `Accept: application/json`. Laravel effectue alors un **redirect HTTP 302** avec les erreurs flashees en session, ce qui renvoie la page HTML de `routes/web.php` (`view('welcome')` = `<!DOCTYPE ...>`).

  **Confirmation** : `bootstrap/app.php:19-21` — le callback `withExceptions` est vide, aucun rendu JSON force pour les routes API :
  ```php
  ->withExceptions(function (Exceptions $exceptions): void {
      //  <-- VIDE
  })->create();
  ```

  **2. CAUSE SECONDAIRE — User `e2e-vendeur@test.com` probablement absent de la base E2E**

  Le seeder `E2ETestSeeder.php` cree bien `e2e-vendeur@test.com`, MAIS le `DatabaseSeeder.php` par defaut n'appelle PAS `E2ETestSeeder`. Si la base a ete recree avec `migrate:fresh` sans re-executer `php artisan db:seed --class=E2ETestSeeder`, le user n'existe pas.

  Quand le user n'existe pas, `AuthService::login()` (ligne 48-51) lance `ValidationException` -> sans `Accept: application/json` -> HTML au lieu de JSON.

  **Pourquoi vendeur2 fonctionne** : vendeur2 est cree dynamiquement via l'API `POST /api/auth/register` dans `ensureVendeur2()` (`2-1.e2e.ts:89-108`) AVANT chaque suite de tests. Il existe donc toujours. De plus, les tests AC2 qui utilisent vendeur2 passent car le login reussit (pas de ValidationException declenchee).

  **Pourquoi acheteur fonctionne** : `e2e@test.com` est aussi dans `E2ETestSeeder`, mais il semble exister en base (les tests de role protection avec acheteur passent). Cela suggere que le seeder a ete execute une fois mais que `e2e-vendeur@test.com` a un probleme specifique (password hash corrompu, ou le seeder n'a pas ete re-execute apres un changement de schema).

- **Lien avec bugs precedents** : Aucun (premier diagnostic)

- **Correction suggeree** :

  **Fix 1 (E2E Helper — OBLIGATOIRE) :**
  `e2e/helpers/auth.ts:40-42` — Ajouter le header `Accept: application/json` :
  ```typescript
  // AVANT (ligne 40-42)
  const response = await page.request.post(`${API_URL}/auth/login`, {
    data: { email, password },
  });

  // APRES
  const response = await page.request.post(`${API_URL}/auth/login`, {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    data: { email, password },
  });
  ```

  **Fix 2 (Backend — RECOMMANDE, defense en profondeur) :**
  `api/bootstrap/app.php:19-21` — Forcer le rendu JSON pour toutes les exceptions sur les routes `/api/*` :
  ```php
  // AVANT (ligne 19-21)
  ->withExceptions(function (Exceptions $exceptions): void {
      //
  })->create();

  // APRES
  ->withExceptions(function (Exceptions $exceptions): void {
      $exceptions->shouldRenderJsonWhen(function ($request, $throwable) {
          return $request->is('api/*');
      });
  })->create();
  ```

  **Fix 3 (Seeder — OBLIGATOIRE, verification) :**
  Re-executer le seeder E2E sur la base de test :
  ```bash
  php artisan db:seed --class=E2ETestSeeder
  ```

- **Agent concerne** : Les deux (Front pour Fix 1, Back pour Fix 2, Ops/Infra pour Fix 3)

---

### Resume des 20 tests en echec (tous lies a BUG-001)

| Categorie | Tests en echec | Cause |
|---|---|---|
| AC1: Dashboard & product list | 10 tests | `loginAs(VENDEUR_EMAIL)` echoue |
| Backend API | 2 tests (200 + fields) | `loginAs(VENDEUR_EMAIL)` echoue |
| NFR11: Isolation | 1 test (vendeur1) | `loginAs(VENDEUR_EMAIL)` echoue |
| DB verification | 3 tests | `loginAs(VENDEUR_EMAIL)` echoue |
| Loading/error states | 1 test | `loginAs(VENDEUR_EMAIL)` echoue |
| Product row actions | 3 tests | `loginAs(VENDEUR_EMAIL)` echoue |

### Tests qui passent (15) — Confirmation du diagnostic

Tous les tests qui passent utilisent soit :
- `vendeur2` (cree dynamiquement via register API) : AC2 empty state (6 tests), isolation vendeur2 (2 tests), DB count (1 test)
- `acheteur` (e2e@test.com, existe en base) : API 403 (1 test), role protection acheteur (1 test)
- Aucune auth : API 401 (1 test), visitor redirect (1 test), vendeur access (1 test — utilise vendeur2 indirectement)

Cela confirme que le probleme est specifiquement lie au login du user `e2e-vendeur@test.com`.



Je vais diagnostiquer ce problème. L'erreur est claire : l'API de login renvoie du HTML au lieu de JSON pour `vendeur1`. Laissons-moi investiguer les fichiers pertinents.
I need to investigate a Playwright test failure where the login API returns HTML instead of JSON for a specific user (vendeur1). 

Please find and read these files thoroughly:
1. The Playwright test helper for auth at e2e/helpers/auth.ts (look around /home/thibaut/Bureau/testApp/)
2. The Playwright test file for story 2-1 (look in e2e/ directory)
3. The Laravel login controller/route (look in api/ directory)
4. The seeder files that create vendeur1 user (look in api/database/seeders/)
5. Any test fixture or data setup files for vendeur1

Search broadly in /home/thibaut/Bureau/testApp/ for these files. Look for:
- "vendeur1" in any file
- auth.ts in e2e/helpers/
- login route in api/routes/
- UserSeeder or DatabaseSeeder in api/database/

Give me the full content of each file found.
In /home/thibaut/Bureau/testApp/, I need to understand why "vendeur1" (which uses e2e-vendeur@test.com) fails to login but "vendeur2" succeeds in E2E tests.

Please:
1. Read the full E2E test file at e2e/tests/2-1.e2e.ts - I need the COMPLETE file content
2. Look at how vendeur2 is created/used differently from vendeur1
3. Check if there's a second vendeur email used (e2e-vendeur2@test.com) in the seeder
4. Read the E2ETestSeeder completely to see what products are seeded for which users
5. Check if there are products seeded for e2e-vendeur@test.com

This is critical: some tests pass (those using vendeur2 or the vendeur without products) but fail for vendeur1 (the one WITH products). I need to understand the data setup difference.
Excellent. Maintenant, laissez-moi vérifier quelques points supplémentaires pour confirmer le diagnostic et identifier la cause précise.
Maintenant, vérifions le contrôleur d'authentification et la configuration Laravel pour comprendre pourquoi le login renvoie du HTML.
Maintenant, vérifions le handler d'exceptions Laravel et la configuration Passport pour comprendre pourquoi le login pourrait renvoyer du HTML.
In /home/thibaut/Bureau/testApp/api/, I need to understand why the login API might return HTML instead of JSON. Please find and read:

1. The exception handler - look in app/Exceptions/Handler.php or bootstrap/app.php (Laravel 11+ uses bootstrap/app.php for exception handling)
2. The LoginRequest form request - app/Http/Requests/LoginRequest.php
3. The Passport configuration - config/auth.php 
4. Check if there's any middleware that might redirect or return HTML
5. Check app/Http/Middleware/ for any custom middleware
6. Check app/Http/Kernel.php or bootstrap/app.php for middleware registration
7. Check if there's a .env file with APP_URL or similar config

The key symptom: POST /api/auth/login returns `<!DOCTYPE ...` (HTML) instead of JSON for a specific user (e2e-vendeur@test.com) but works for other users (e2e@test.com, vendeur2 dynamic users).

The request does NOT include `Accept: application/json` header. Could this cause Laravel to return HTML when a ValidationException is thrown?

Read all relevant files completely.
Maintenant, vérifions un dernier point crucial — est-ce que le user `e2e-vendeur@test.com` existe réellement dans la base de données E2E, et regardons le `bootstrap/app.php` :
Parfait. J'ai maintenant toutes les données nécessaires pour un diagnostic complet. Vérifions un dernier détail — les tests qui passent vs ceux qui échouent pour confirmer le pattern :
J'ai maintenant un diagnostic complet et précis. Vérifions si le fichier rapport existe déjà :
Le fichier n'existe pas encore, je vais le créer avec le rapport initial. Voici le contenu complet du rapport Sherlock :
## Rapport Sherlock — Niveau 1 termine

**Fichier cree** : `/home/thibaut/Bureau/testApp/US/2-1/sherlock-report.md`

### Synthese du diagnostic

**1 seul bug identifie (BUG-001)** qui cause les 20 echecs sur 35 tests :

L'API de login renvoie du HTML au lieu de JSON pour `e2e-vendeur@test.com`. **Double cause racine** :

| # | Cause | Fichier | Criticite |
|---|---|---|---|
| **1** | Header `Accept: application/json` **manquant** dans `loginAs()` | `e2e/helpers/auth.ts:40-42` | OBLIGATOIRE |
| **2** | `bootstrap/app.php` n'a **aucun rendu JSON force** pour les routes API — quand une exception est levee sans header Accept, Laravel renvoie du HTML | `api/bootstrap/app.php:19-21` | RECOMMANDE |
| **3** | User `e2e-vendeur@test.com` **probablement absent** de la base E2E (seeder non re-execute) | `E2ETestSeeder.php` | A VERIFIER |

### 3 corrections suggerees (precises) :

1. **Fix 1** (`e2e/helpers/auth.ts:40`) — Ajouter `headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }` a la requete POST login
2. **Fix 2** (`api/bootstrap/app.php:19`) — Ajouter `$exceptions->shouldRenderJsonWhen(fn($req) => $req->is('api/*'))` pour forcer JSON sur toutes les routes API
3. **Fix 3** — Re-executer `php artisan db:seed --class=E2ETestSeeder` sur la base E2E

Les Fix 1 + Fix 3 devraient suffire a faire passer les 20 tests. Le Fix 2 est une mesure defensive qui previent le meme type de probleme a l'avenir.
## Rapport Sherlock — Niveau 1 termine

**Fichier cree** : `/home/thibaut/Bureau/testApp/US/2-1/sherlock-report.md`

### Synthese du diagnostic

**1 seul bug identifie (BUG-001)** qui cause les 20 echecs sur 35 tests :

L'API de login renvoie du HTML au lieu de JSON pour `e2e-vendeur@test.com`. **Double cause racine** :

| # | Cause | Fichier | Criticite |
|---|---|---|---|
| **1** | Header `Accept: application/json` **manquant** dans `loginAs()` | `e2e/helpers/auth.ts:40-42` | OBLIGATOIRE |
| **2** | `bootstrap/app.php` n'a **aucun rendu JSON force** pour les routes API — quand une exception est levee sans header Accept, Laravel renvoie du HTML | `api/bootstrap/app.php:19-21` | RECOMMANDE |
| **3** | User `e2e-vendeur@test.com` **probablement absent** de la base E2E (seeder non re-execute) | `E2ETestSeeder.php` | A VERIFIER |

### 3 corrections suggerees (precises) :

1. **Fix 1** (`e2e/helpers/auth.ts:40`) — Ajouter `headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }` a la requete POST login
2. **Fix 2** (`api/bootstrap/app.php:19`) — Ajouter `$exceptions->shouldRenderJsonWhen(fn($req) => $req->is('api/*'))` pour forcer JSON sur toutes les routes API
3. **Fix 3** — Re-executer `php artisan db:seed --class=E2ETestSeeder` sur la base E2E

Les Fix 1 + Fix 3 devraient suffire a faire passer les 20 tests. Le Fix 2 est une mesure defensive qui previent le meme type de probleme a l'avenir.