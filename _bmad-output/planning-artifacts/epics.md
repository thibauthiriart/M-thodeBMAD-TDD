---
stepsCompleted: [step-01-validate-prerequisites, step-02-design-epics, step-03-create-stories, step-04-final-validation]
inputDocuments: [prd.md]
---

# testApp - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for testApp, decomposing the requirements from the PRD into implementable stories. 6 epics, 22 stories, 30/30 FRs covered.

## Requirements Inventory

### Functional Requirements

- FR1: Un visiteur peut creer un compte en choisissant son role (acheteur ou vendeur)
- FR2: Un utilisateur peut se connecter et se deconnecter avec email et mot de passe
- FR3: Un utilisateur peut consulter et modifier son profil
- FR4: Le systeme restreint les fonctionnalites selon le role (acheteur, vendeur, admin)
- FR5: Un visiteur ou acheteur peut parcourir les composants par categorie (CPU, GPU, RAM, Stockage, CM, Alimentation, Boitier, Peripheriques)
- FR6: Un visiteur ou acheteur peut voir une grille de produits avec photo et nom intuitif (vue Master)
- FR7: Un visiteur ou acheteur peut filtrer les produits par categorie, fourchette de prix et nom
- FR8: Un visiteur ou acheteur peut consulter la fiche detail d'un produit (photo, nom, description detaillee, specs techniques, prix, vendeur, stock)
- FR9: Le systeme affiche le stock en temps reel sur la fiche detail
- FR10: Le systeme indique la date de retour prevue lorsqu'un produit est en rupture de stock
- FR11: Le systeme affiche des recommandations de produits similaires sur chaque fiche detail
- FR12: Les recommandations sont basees sur la meme categorie et une gamme de prix proche
- FR13: Un acheteur peut ajouter un produit au panier en un clic depuis la fiche detail
- FR14: Un acheteur peut consulter son panier avec le recapitulatif (produits, quantites, prix total)
- FR15: Un acheteur peut modifier les quantites ou supprimer des produits du panier
- FR16: Un acheteur peut valider sa commande (paiement simule pour le MVP)
- FR17: Le systeme empeche l'ajout au panier pour les visiteurs non connectes et propose l'inscription
- FR18: Le systeme redirige le visiteur vers le produit consulte apres inscription
- FR19: Un vendeur peut ajouter un nouveau composant avec photo, nom, description, specs techniques, prix et quantite en stock
- FR20: Un vendeur peut modifier les informations d'un de ses produits
- FR21: Un vendeur peut activer ou desactiver un de ses produits (visible/invisible dans le catalogue)
- FR22: Un vendeur peut supprimer un de ses produits
- FR23: Un vendeur peut consulter son dashboard avec la liste de tous ses produits et leur statut
- FR24: Un admin peut consulter la liste de tous les comptes utilisateurs (acheteurs et vendeurs)
- FR25: Un admin peut activer ou desactiver un compte utilisateur
- FR26: Un admin peut consulter la liste de toutes les annonces
- FR27: Un admin peut activer ou desactiver une annonce
- FR28: Un admin peut consulter des analytics basiques (nombre de produits, nombre d'utilisateurs, nombre de commandes)
- FR29: Un visiteur non connecte peut naviguer dans le catalogue, les categories et les fiches detail
- FR30: Le systeme affiche les produits de plusieurs vendeurs dans le catalogue

### NonFunctional Requirements

- NFR1: Le catalogue (vue Master) se charge en < 2 secondes avec 500+ produits
- NFR2: La fiche detail se charge en < 1 seconde
- NFR3: L'ajout au panier repond en < 500ms avec feedback visuel instantane
- NFR4: Les filtres retournent les resultats en < 1 seconde
- NFR5: Les mises a jour de stock en temps reel arrivent en < 3 secondes apres le changement
- NFR6: Le systeme supporte 100 utilisateurs simultanes sans degradation
- NFR7: Les mots de passe sont haches avec bcrypt ou equivalent
- NFR8: Les tokens d'authentification expirent apres une periode d'inactivite
- NFR9: Toutes les communications client-serveur utilisent HTTPS
- NFR10: Les donnees personnelles sont protegees conformement au RGPD (acces, suppression sur demande)
- NFR11: Les vendeurs ne peuvent acceder et modifier que leurs propres produits
- NFR12: Les acheteurs ne peuvent acceder qu'a leur propre panier et commandes
- NFR13: Le systeme est protege contre les vulnerabilites OWASP Top 10
- NFR14: L'architecture supporte une croissance a 10x utilisateurs sans refonte majeure
- NFR15: Le catalogue supporte jusqu'a 10 000 produits sans degradation
- NFR16: Les images produit sont servies via un systeme de stockage scalable
- NFR17: Uptime plateforme > 99%
- NFR18: Les donnees du panier sont persistees (pas de perte en cas de deconnexion)
- NFR19: Les commandes validees sont stockees de maniere durable et ne peuvent etre perdues

### Additional Requirements

- SPA Vue 3 + TypeScript, Vue Router, Pinia
- Laravel 12 API + Passport (tokens)
- WebSockets via Laravel Broadcasting + Soketi (stock live MVP)
- Navigateurs modernes uniquement (dernieres versions)
- Desktop-first responsive, breakpoints mobile (< 768px), tablette (768-1024px), desktop (> 1024px)
- Pas de SSR, pas de PWA, pas de SEO
- Categories fixes : CPU, GPU, RAM, Stockage, CM, Alimentation, Boitier, Peripheriques

### FR Coverage Map

- FR1: Epic 1 / Story 1.1 — Inscription avec choix de role
- FR2: Epic 1 / Story 1.2 — Connexion/deconnexion
- FR3: Epic 1 / Story 1.3 — Profil utilisateur
- FR4: Epic 1 / Story 1.4 — Restriction par role (RBAC)
- FR5: Epic 3 / Story 3.1 — Browse par categorie
- FR6: Epic 3 / Story 3.2 — Grille Master (photo + nom)
- FR7: Epic 3 / Story 3.3 — Filtres categorie/prix/nom
- FR8: Epic 3 / Story 3.4 — Fiche detail complete
- FR9: Epic 5 / Story 5.2 — Stock temps reel
- FR10: Epic 3 / Story 3.4 — Date retour rupture stock
- FR11: Epic 5 / Story 5.1 — Recommandations similaires
- FR12: Epic 5 / Story 5.1 — Recommandations par categorie/prix
- FR13: Epic 4 / Story 4.1 — Ajout panier 1 clic
- FR14: Epic 4 / Story 4.3 — Recapitulatif panier
- FR15: Epic 4 / Story 4.3 — Modifier quantites/supprimer
- FR16: Epic 4 / Story 4.4 — Valider commande (simule)
- FR17: Epic 4 / Story 4.1 — Blocage panier visiteur
- FR18: Epic 4 / Story 4.2 — Redirection post-inscription
- FR19: Epic 2 / Story 2.2 — Ajouter un composant
- FR20: Epic 2 / Story 2.3 — Modifier un produit
- FR21: Epic 2 / Story 2.4 — Activer/desactiver produit
- FR22: Epic 2 / Story 2.5 — Supprimer un produit
- FR23: Epic 2 / Story 2.1 — Dashboard vendeur
- FR24: Epic 6 / Story 6.1 — Liste comptes utilisateurs
- FR25: Epic 6 / Story 6.1 — Activer/desactiver compte
- FR26: Epic 6 / Story 6.2 — Liste annonces
- FR27: Epic 6 / Story 6.2 — Activer/desactiver annonce
- FR28: Epic 6 / Story 6.3 — Analytics basiques
- FR29: Epic 3 / Story 3.1 — Navigation visiteur libre
- FR30: Epic 3 / Story 3.2 — Multi-vendeurs catalogue

## Epic List

### Epic 1: Authentication & User Roles
Les utilisateurs peuvent s'inscrire, se connecter et gerer leur profil. Le systeme applique les restrictions par role (acheteur, vendeur, admin).
**FRs couverts:** FR1, FR2, FR3, FR4

### Epic 2: Seller Product Management
Les vendeurs peuvent publier, modifier, activer/desactiver et supprimer des composants depuis leur dashboard.
**FRs couverts:** FR19, FR20, FR21, FR22, FR23

### Epic 3: Product Catalog & Discovery
Les visiteurs et acheteurs peuvent parcourir le catalogue par categorie, filtrer les produits, et consulter les fiches detail completes. Navigation libre sans compte.
**FRs couverts:** FR5, FR6, FR7, FR8, FR10, FR29, FR30

### Epic 4: Shopping Cart & Orders
Les acheteurs peuvent ajouter des produits au panier, gerer leur panier et valider une commande. Les visiteurs sont invites a s'inscrire pour acceder au panier.
**FRs couverts:** FR13, FR14, FR15, FR16, FR17, FR18

### Epic 5: Recommendations & Real-time Stock
Le systeme affiche des recommandations de produits similaires et met a jour le stock en temps reel via WebSockets.
**FRs couverts:** FR9, FR11, FR12

### Epic 6: Platform Administration
L'admin peut gerer les comptes utilisateurs, moderer les annonces et consulter les analytics de la plateforme.
**FRs couverts:** FR24, FR25, FR26, FR27, FR28

## Epic 1: Authentication & User Roles

Les utilisateurs peuvent s'inscrire, se connecter et gerer leur profil. Le systeme applique les restrictions par role (acheteur, vendeur, admin).

### Story 1.1: User Registration with Role Selection

As a visitor,
I want to create an account by choosing my role (buyer or seller),
So that I can access features specific to my profile.

**Acceptance Criteria:**

**Given** a visitor is on the registration page
**When** they fill in email, password, password confirmation and select a role (acheteur or vendeur)
**Then** an account is created with the selected role
**And** the password is hashed with bcrypt
**And** the user is automatically logged in and redirected to the homepage

**Given** a visitor submits a registration form with an already used email
**When** the form is submitted
**Then** an error message indicates the email is already taken

**Given** a visitor submits a registration form with an invalid password (< 8 characters)
**When** the form is submitted
**Then** an error message indicates password requirements

### Story 1.2: User Login & Logout

As a registered user,
I want to log in and log out,
So that I can securely access my account.

**Acceptance Criteria:**

**Given** a registered user is on the login page
**When** they enter valid email and password
**Then** they receive an auth token and are redirected to the homepage
**And** the token has an expiration period

**Given** a user enters incorrect credentials
**When** the form is submitted
**Then** an error message indicates invalid credentials without revealing which field is wrong

**Given** a logged-in user clicks logout
**When** the action is confirmed
**Then** the token is invalidated and the user is redirected to the homepage

### Story 1.3: User Profile Management

As a registered user,
I want to view and edit my profile,
So that I can keep my information up to date.

**Acceptance Criteria:**

**Given** a logged-in user navigates to their profile page
**When** the page loads
**Then** they see their email, role, and editable fields (name, etc.)

**Given** a user edits their profile information
**When** they save changes
**Then** the profile is updated and a success confirmation is shown

### Story 1.4: Role-Based Access Control

As a system,
I want to restrict features based on user roles,
So that buyers, sellers, and admins only access their authorized features.

**Acceptance Criteria:**

**Given** a user with role "acheteur"
**When** they try to access seller dashboard or admin dashboard
**Then** they are redirected with an unauthorized message

**Given** a user with role "vendeur"
**When** they try to access admin dashboard
**Then** they are redirected with an unauthorized message

**Given** a visitor (not logged in)
**When** they try to access protected routes (profile, cart, seller dashboard, admin)
**Then** they are redirected to the login page

## Epic 2: Seller Product Management

Les vendeurs peuvent publier, modifier, activer/desactiver et supprimer des composants depuis leur dashboard.

### Story 2.1: Seller Dashboard

As a seller,
I want to view my product dashboard,
So that I can see all my listings and their status at a glance.

**Acceptance Criteria:**

**Given** a logged-in seller navigates to their dashboard
**When** the page loads
**Then** they see a list of all their products with name, photo thumbnail, price, stock, and status (active/inactive)

**Given** a seller has no products yet
**When** they view their dashboard
**Then** they see an empty state with a clear call-to-action to add their first product

### Story 2.2: Create Product Listing

As a seller,
I want to add a new component with photo, name, description, specs, price and stock,
So that buyers can discover and purchase my products.

**Acceptance Criteria:**

**Given** a seller clicks "Add product" from their dashboard
**When** the creation form loads
**Then** they see fields for: photo upload, name, description, technical specs, price, stock quantity, and category selection (CPU, GPU, RAM, Stockage, CM, Alimentation, Boitier, Peripheriques)

**Given** a seller fills in all required fields and submits
**When** the form is valid
**Then** the product is created with status "active", the image is stored via scalable storage, and the seller is redirected to their dashboard with a success message

**Given** a seller submits an incomplete form (missing required fields)
**When** the form is submitted
**Then** validation errors are displayed for each missing field

### Story 2.3: Edit Product Listing

As a seller,
I want to modify the information of one of my products,
So that I can correct errors or update prices and stock.

**Acceptance Criteria:**

**Given** a seller clicks "Edit" on one of their products
**When** the edit form loads
**Then** all current values are pre-filled in the form

**Given** a seller modifies fields and saves
**When** the form is submitted with valid data
**Then** the product is updated and a success confirmation is shown

**Given** a seller tries to edit a product that belongs to another seller
**When** the request is made
**Then** the system returns an unauthorized error

### Story 2.4: Activate/Deactivate Product

As a seller,
I want to activate or deactivate one of my products,
So that I can temporarily hide a product without deleting it.

**Acceptance Criteria:**

**Given** a seller views an active product in their dashboard
**When** they click "Deactivate"
**Then** the product status changes to inactive and it is no longer visible in the public catalogue

**Given** a seller views an inactive product in their dashboard
**When** they click "Activate"
**Then** the product status changes to active and it becomes visible in the public catalogue

### Story 2.5: Delete Product

As a seller,
I want to permanently delete one of my products,
So that I can remove listings I no longer want.

**Acceptance Criteria:**

**Given** a seller clicks "Delete" on one of their products
**When** a confirmation dialog appears and they confirm
**Then** the product is permanently removed from the system

**Given** a seller clicks "Delete" and cancels the confirmation
**When** the dialog is dismissed
**Then** the product remains unchanged

## Epic 3: Product Catalog & Discovery

Les visiteurs et acheteurs peuvent parcourir le catalogue par categorie, filtrer les produits, et consulter les fiches detail completes. Navigation libre sans compte.

### Story 3.1: Category Navigation

As a visitor or buyer,
I want to browse components organized by category,
So that I can quickly find the type of component I need.

**Acceptance Criteria:**

**Given** a user arrives on the homepage
**When** the page loads
**Then** they see all 8 categories displayed clearly: CPU, GPU, RAM, Stockage, CM, Alimentation, Boitier, Peripheriques

**Given** a user clicks on a category
**When** the category page loads
**Then** only products from that category are displayed
**And** the page loads in under 2 seconds

**Given** a visitor is not logged in
**When** they browse categories and product listings
**Then** they can access all catalogue pages without restriction

### Story 3.2: Product Grid (Master View)

As a visitor or buyer,
I want to see a grid of products with photo and intuitive name,
So that I can visually scan and identify components quickly.

**Acceptance Criteria:**

**Given** a user is on a category page
**When** products are displayed
**Then** each product card shows a photo and an intuitive name
**And** products from multiple sellers are displayed together

**Given** there are more products than fit on one page
**When** the user scrolls or navigates
**Then** products are paginated or lazy-loaded for performance

**Given** a user clicks on a product card
**When** the click is registered
**Then** they are navigated to the product detail page

### Story 3.3: Product Filters

As a visitor or buyer,
I want to filter products by category, price range and name,
So that I can narrow down results to find exactly what I need.

**Acceptance Criteria:**

**Given** a user is on the catalogue page
**When** they apply a category filter
**Then** only products matching the selected category are displayed

**Given** a user sets a price range filter (min and/or max)
**When** the filter is applied
**Then** only products within the price range are displayed

**Given** a user types a search term in the name filter
**When** the filter is applied
**Then** only products whose name matches the search term are displayed

**Given** a user applies multiple filters simultaneously
**When** filters are combined
**Then** results match ALL active filters
**And** results return in under 1 second

### Story 3.4: Product Detail Page

As a visitor or buyer,
I want to view the complete detail page of a product,
So that I can make an informed purchase decision.

**Acceptance Criteria:**

**Given** a user clicks on a product from the grid
**When** the detail page loads
**Then** they see: photo, name, detailed description, technical specs, price, seller name, and stock quantity
**And** the page loads in under 1 second

**Given** a product is in stock (quantity > 0)
**When** the detail page is displayed
**Then** the stock is shown as available with the current quantity

**Given** a product is out of stock (quantity = 0)
**When** the detail page is displayed
**Then** a message shows "Out of stock" with the expected return date
**And** the add-to-cart button is disabled

## Epic 4: Shopping Cart & Orders

Les acheteurs peuvent ajouter des produits au panier, gerer leur panier et valider une commande. Les visiteurs sont invites a s'inscrire pour acceder au panier.

### Story 4.1: Add to Cart

As a buyer,
I want to add a product to my cart in one click from the detail page,
So that I can quickly build my order.

**Acceptance Criteria:**

**Given** a logged-in buyer is on a product detail page with stock > 0
**When** they click "Add to cart"
**Then** the product is added to their cart with quantity 1
**And** a visual feedback confirms the addition in under 500ms

**Given** a buyer adds a product already in their cart
**When** they click "Add to cart"
**Then** the quantity for that product is incremented by 1

**Given** a visitor (not logged in) clicks "Add to cart"
**When** the action is triggered
**Then** a message invites them to log in or create an account
**And** the product URL is saved for post-registration redirect

### Story 4.2: Visitor to Buyer Conversion

As a visitor,
I want to be redirected to the product I was viewing after registration,
So that I can continue my shopping without friction.

**Acceptance Criteria:**

**Given** a visitor was viewing a product and clicked "Add to cart"
**When** they complete registration or login
**Then** they are redirected to the product detail page they were viewing

**Given** a visitor registers after being prompted by the cart gate
**When** registration is complete
**Then** their account is created with role "acheteur" and they are logged in

### Story 4.3: Cart Management

As a buyer,
I want to view my cart with a summary of products, quantities and total price,
So that I can review my order before checkout.

**Acceptance Criteria:**

**Given** a logged-in buyer navigates to their cart
**When** the cart page loads
**Then** they see all products with photo, name, unit price, quantity, line total, and cart total

**Given** a buyer changes the quantity of a product in the cart
**When** the new quantity is saved
**Then** the line total and cart total are recalculated and updated

**Given** a buyer sets the quantity to 0 or clicks "Remove"
**When** the action is confirmed
**Then** the product is removed from the cart and totals are updated

**Given** a buyer has an empty cart
**When** they view the cart page
**Then** they see an empty state with a link to browse the catalogue

### Story 4.4: Order Checkout

As a buyer,
I want to validate my order,
So that I can complete my purchase.

**Acceptance Criteria:**

**Given** a buyer has products in their cart
**When** they click "Validate order"
**Then** an order is created with all cart items, quantities and total price
**And** the cart is emptied
**And** a confirmation page shows the order summary

**Given** a buyer validates an order
**When** the order is created
**Then** the order is durably stored and cannot be lost
**And** the stock of each purchased product is decremented

**Given** a buyer tries to validate an order with an empty cart
**When** the checkout action is triggered
**Then** an error message indicates the cart is empty

## Epic 5: Recommendations & Real-time Stock

Le systeme affiche des recommandations de produits similaires et met a jour le stock en temps reel via WebSockets.

### Story 5.1: Similar Product Recommendations

As a visitor or buyer,
I want to see similar product recommendations on each detail page,
So that I can discover alternatives or complementary components.

**Acceptance Criteria:**

**Given** a user is on a product detail page
**When** the page loads
**Then** a "Similar products" section displays up to 6 products from the same category and a close price range

**Given** similar products are displayed
**When** the user clicks on a recommendation
**Then** they are navigated to that product's detail page

**Given** no similar products exist (category empty or only this product)
**When** the detail page loads
**Then** the recommendations section is hidden gracefully

### Story 5.2: Real-time Stock Updates

As a visitor or buyer,
I want to see the stock update in real-time on the detail page,
So that I know if a product is still available while I'm browsing.

**Acceptance Criteria:**

**Given** a user is viewing a product detail page
**When** another buyer purchases the last unit of that product
**Then** the stock display updates to "Out of stock" within 3 seconds without page reload

**Given** a user is viewing a product detail page
**When** the seller updates the stock quantity
**Then** the displayed stock quantity updates within 3 seconds without page reload

**Given** a product's stock drops to 0 while a user is viewing the detail page
**When** the real-time update arrives
**Then** the "Add to cart" button becomes disabled and the out-of-stock message appears

## Epic 6: Platform Administration

L'admin peut gerer les comptes utilisateurs, moderer les annonces et consulter les analytics de la plateforme.

### Story 6.1: User Account Management

As an admin,
I want to view all user accounts and activate or deactivate them,
So that I can manage platform access and handle problematic users.

**Acceptance Criteria:**

**Given** an admin navigates to the user management page
**When** the page loads
**Then** they see a list of all users with: name, email, role, status (active/inactive), registration date

**Given** an admin clicks "Deactivate" on an active user account
**When** the action is confirmed
**Then** the account is deactivated, the user can no longer log in, and if the user is a seller all their products become invisible in the catalogue

**Given** an admin clicks "Activate" on an inactive user account
**When** the action is confirmed
**Then** the account is reactivated and the user can log in again

### Story 6.2: Listing Moderation

As an admin,
I want to view all product listings and activate or deactivate them,
So that I can remove inappropriate or fraudulent listings.

**Acceptance Criteria:**

**Given** an admin navigates to the listing moderation page
**When** the page loads
**Then** they see a list of all products with: name, seller, price, category, status (active/inactive)

**Given** an admin clicks "Deactivate" on an active listing
**When** the action is confirmed
**Then** the listing is hidden from the public catalogue immediately

**Given** an admin clicks "Activate" on an inactive listing
**When** the action is confirmed
**Then** the listing becomes visible in the public catalogue again

### Story 6.3: Platform Analytics Dashboard

As an admin,
I want to view basic platform analytics,
So that I can monitor the health and growth of the marketplace.

**Acceptance Criteria:**

**Given** an admin navigates to the analytics dashboard
**When** the page loads
**Then** they see: total number of products (active/inactive), total number of users (by role), total number of orders

**Given** the analytics data changes (new user, new product, new order)
**When** the admin refreshes the page
**Then** the counters reflect the current state
