---
stepsCompleted: [step-01-init, step-02-discovery, step-03-success, step-04-journeys, step-05-domain, step-06-innovation, step-07-project-type, step-08-scoping, step-09-functional, step-10-nonfunctional, step-11-polish]
inputDocuments: [product-brief-testApp-2026-02-18.md]
workflowType: 'prd'
documentCounts:
  briefs: 1
  research: 0
  brainstorming: 0
  projectDocs: 0
classification:
  projectType: web_app
  domain: general
  complexity: low
  projectContext: greenfield
---

# Product Requirements Document - testApp

**Author:** Thibaut
**Date:** 2026-02-18

## Executive Summary

testApp est une marketplace web specialisee dans les composants informatiques, destinee au grand public. Le differenciateur principal : **trouver le bon composant rapidement** grace a une interface minimaliste, des fiches produit claires et des filtres optimises pour le domaine informatique.

**Roles utilisateur :** Acheteurs (naviguent, ajoutent au panier, commandent), Vendeurs (publient et gerent des composants), Admin (modere la plateforme).

**Stack technique :** SPA Vue 3 + TypeScript (frontend), Laravel 12 API + MySQL 8 + Redis (backend), WebSockets pour le temps reel.

**MVP :** Parcours achat complet (browse → detail → panier → commande simulee), espace vendeur (CRUD catalogue), dashboard admin (moderation + analytics), stock live en temps reel.

## Success Criteria

### User Success

- Un acheteur trouve le composant cherche en **moins de 3 clics** depuis la page d'accueil
- L'ajout au panier se fait **en 1 clic** depuis la fiche detail
- Les fiches produit sont **claires et completes** — un non-expert comprend ce qu'il achete sans aide externe
- Un vendeur publie un composant complet (photo, specs, prix) en **moins de 5 minutes**
- Les recommandations generent un **taux de clic > 15%** sur les suggestions affichees

### Business Success

**A 3 mois :**
- Pipeline technique fonctionnel de bout en bout (inscription → catalogue → panier → commande)
- Au moins **50 composants** listes par des vendeurs
- Parcours acheteur et vendeur fluides, **zero bug bloquant** sur les parcours critiques

**A 12 mois :**
- Croissance organique des inscriptions (acheteurs + vendeurs)
- Volume de commandes en **progression mensuelle**
- Systeme de recommandation qui genere des clics (taux > 15%)

### Measurable Outcomes

| KPI | Cible | Mesure |
|-----|-------|--------|
| Inscriptions acheteurs | +20/mois | Comptes crees |
| Inscriptions vendeurs | +3/mois | Comptes vendeur valides |
| Produits listes | 50+ au lancement | Composants actifs en catalogue |
| Temps vers panier | < 3 clics | Analytics parcours utilisateur |
| Taux de conversion panier | > 5% | Paniers valides / visiteurs |
| Clic sur recommandations | > 15% | Clics reco / affichages reco |
| Publication vendeur | < 5 min | Temps moyen creation fiche |
| Uptime plateforme | > 99% | Monitoring serveur |
| Temps chargement catalogue | < 2s | Performance monitoring |

## Product Scope & Phased Development

### MVP Strategy

**Approche :** Experience MVP — livrer un parcours d'achat complet et fluide qui prouve que la specialisation verticale (composants info) + le minimalisme creent une experience superieure aux generalistes.

**Objectif :** Valider que les utilisateurs trouvent plus vite le bon composant sur testApp que sur Amazon/LDLC.

### Phase 1 — MVP

- **Auth & 3 roles** : inscription/connexion email + mot de passe, choix du role (acheteur/vendeur), compte admin
- **Catalogue Master/Detail** : grille par categorie (photo + nom), fiche detail complete (specs, prix, vendeur)
- **Categories** : CPU, GPU, RAM, Stockage, CM, Alimentation, Boitier, Peripheriques
- **Recherche & filtres** : par categorie, prix, nom
- **Espace vendeur** : dashboard, creation/edition de composant, activation/desactivation/suppression
- **Panier & commande** : ajout/suppression 1 clic, recapitulatif, validation (paiement simule)
- **Recommandations basiques** : composants similaires (meme categorie, gamme de prix)
- **Stock live** : mise a jour en temps reel via WebSockets
- **Dashboard admin** : moderation comptes/annonces + analytics basiques (compteurs)
- **Navigation visiteur** : catalogue accessible sans compte, panier reserve aux connectes
- **Responsive** : desktop-first avec support mobile

### Phase 2 — Growth

- Paiement reel (Stripe)
- Systeme d'avis et notes acheteurs
- Alertes retour en stock (notifications in-app)
- Alertes panier (produit devenu indisponible)
- Compatibilite hardware automatique
- Comparateur de composants cote a cote

### Phase 3 — Expansion

- Messagerie vendeur/acheteur
- Notifications email/push
- API publique vendeurs (import catalogue en masse)
- App mobile (PWA ou native)
- Expansion categories tech (gaming, reseaux, domotique)
- Programme de fidelite / cashback

### Risk Mitigation

| Risque | Mitigation |
|--------|------------|
| WebSockets complexite | Laravel Echo + Soketi (self-hosted). Fallback : polling 30s |
| Performance catalogue | Pagination, lazy loading images, cache Redis |
| Pas assez de vendeurs | Pre-seed 50+ composants, demarcher 3-5 vendeurs avant lancement |
| Difference invisible vs Amazon | Focus UX sur rapidite (< 3 clics) et clarte des fiches |
| Scope elargi (admin + RT) | Admin minimal (compteurs), RT limite au stock live |

## User Journeys

### Journey 1 : Lucas cherche une GPU — Acheteur expert, happy path

Lucas, 22 ans, etudiant en informatique, veut monter son PC gaming. Il a 350€ de budget pour une carte graphique.

**Opening :** Lucas arrive sur testApp. Il voit la page d'accueil avec les categories clairement disposees. Pas de pub, pas de bruit — juste les categories de composants.

**Rising Action :** Il clique sur "GPU". La grille s'affiche : photo + nom intuitif pour chaque carte. Il filtre par prix (200-400€). En 2 clics, il a une liste courte et pertinente. Il clique sur une RTX 4060 — fiche detail avec specs completes, prix, vendeur, et recommandations "Composants similaires".

**Climax :** Les specs sont claires, le prix est bon. Il clique "Ajouter au panier" — 1 clic. Une suggestion lui montre une RTX 4060 Ti a 30€ de plus chez un autre vendeur.

**Resolution :** Lucas ajoute la Ti a la place, valide sa commande en moins de 2 minutes.

> **Capabilities :** Catalogue par categorie, filtres prix, fiche detail, ajout panier 1 clic, recommandations, multi-vendeurs

### Journey 2 : Sophie cherche de la RAM — Non-experte, edge case stock

Sophie, 38 ans, veut ajouter de la RAM au PC familial. Elle ne connait pas les specs.

**Opening :** Sophie voit "RAM" dans les categories et clique. La grille affiche des barrettes avec des noms comprehensibles et des photos.

**Rising Action :** Elle clique sur une barrette DDR4 16Go. La fiche detail explique clairement chaque spec.

**Climax :** Elle clique "Ajouter au panier" — mais le produit est **en rupture de stock**. Elle voit : "Retour prevu le 25 fevrier".

**Resolution :** Les recommandations lui montrent une barrette equivalente en stock chez un autre vendeur. Elle l'ajoute au panier.

> **Capabilities :** Fiches accessibles non-experts, gestion rupture stock avec date retour, recommandations fallback

### Journey 3 : TechDistrib publie son catalogue — Vendeur pro

Marc, responsable e-commerce chez TechDistrib, publie 50 references de GPU.

**Opening :** Marc cree son compte vendeur pro et accede a son dashboard.

**Rising Action :** Il clique "Ajouter un produit" : photo, nom, description, specs, prix, stock. 4 minutes par produit.

**Climax :** 3 semaines plus tard, il modifie des prix en quelques clics et desactive une reference en rupture temporaire.

**Resolution :** Gestion fluide du catalogue — ajout, modification, desactivation, reactivation, suppression.

> **Capabilities :** Dashboard vendeur, CRUD produits, activation/desactivation, gestion stock

### Journey 4 : Lea — Visiteur non-connecte

Lea, 30 ans, arrive sur testApp sans compte. Elle navigue librement dans le catalogue, les categories, les fiches detail. Quand elle clique "Ajouter au panier", elle est invitee a s'inscrire. L'inscription est rapide, et elle est redirigee vers le produit qu'elle regardait.

> **Capabilities :** Navigation libre sans compte, blocage panier non-connectes, inscription rapide, redirection post-inscription

### Journey 5 : Alex — Admin moderation

Alex, administrateur, surveille la qualite. Il desactive une annonce suspecte et peut desactiver un compte vendeur problematique, ce qui retire instantanement toutes ses annonces. Il consulte des compteurs (produits, utilisateurs, commandes) pour piloter la plateforme.

> **Capabilities :** Dashboard admin, gestion comptes/annonces, analytics basiques

### Journey Requirements Summary

| Capability | Journeys |
|------------|----------|
| Catalogue par categorie + filtres | Lucas, Sophie, Lea |
| Fiche detail complete et accessible | Lucas, Sophie, Lea |
| Ajout panier 1 clic | Lucas, Sophie |
| Recommandations similaires | Lucas, Sophie |
| Gestion rupture stock + date retour | Sophie |
| Navigation libre sans compte | Lea |
| Inscription rapide + redirection | Lea |
| Dashboard vendeur + CRUD produits | TechDistrib |
| Activation/desactivation produits | TechDistrib |
| Dashboard admin + analytics | Alex |
| Moderation annonces + comptes | Alex |
| Multi-vendeurs | Lucas |

## Web App Technical Requirements

### Architecture

- **SPA pure** : Vue 3 + TypeScript, Vue Router, pas de SSR ni pre-rendering
- **API REST** : Laravel 12, API Resources, authentification via Passport (tokens)
- **State management** : Pinia (stores auth, panier, catalogue)
- **WebSockets** : Laravel Broadcasting + Soketi pour le stock live
- **Pas de SEO** : pas d'indexation Google, acquisition hors-plateforme
- **Pas de PWA** : application web classique

### Browser Support

Navigateurs modernes uniquement (dernieres versions) : Chrome, Firefox, Safari, Edge, Chrome Android, Safari iOS.

### Responsive Design

Desktop-first, responsive mobile. Breakpoints : mobile (< 768px), tablette (768-1024px), desktop (> 1024px). Catalogue Master utilisable sur mobile (grille adaptative).

### Real-Time (MVP vs Post-MVP)

- **MVP** : Stock live sur la fiche detail via WebSockets
- **Phase 2** : Alerte retour en stock, alerte panier produit indisponible

## Functional Requirements

### User Management & Authentication

- **FR1:** Un visiteur peut creer un compte en choisissant son role (acheteur ou vendeur)
- **FR2:** Un utilisateur peut se connecter et se deconnecter avec email et mot de passe
- **FR3:** Un utilisateur peut consulter et modifier son profil
- **FR4:** Le systeme restreint les fonctionnalites selon le role (acheteur, vendeur, admin)

### Product Catalog & Discovery

- **FR5:** Un visiteur ou acheteur peut parcourir les composants par categorie (CPU, GPU, RAM, Stockage, CM, Alimentation, Boitier, Peripheriques)
- **FR6:** Un visiteur ou acheteur peut voir une grille de produits avec photo et nom intuitif (vue Master)
- **FR7:** Un visiteur ou acheteur peut filtrer les produits par categorie, fourchette de prix et nom
- **FR8:** Un visiteur ou acheteur peut consulter la fiche detail d'un produit (photo, nom, description detaillee, specs techniques, prix, vendeur, stock)
- **FR9:** Le systeme affiche le stock en temps reel sur la fiche detail
- **FR10:** Le systeme indique la date de retour prevue lorsqu'un produit est en rupture de stock

### Recommendations

- **FR11:** Le systeme affiche des recommandations de produits similaires sur chaque fiche detail
- **FR12:** Les recommandations sont basees sur la meme categorie et une gamme de prix proche

### Shopping Cart & Orders

- **FR13:** Un acheteur peut ajouter un produit au panier en un clic depuis la fiche detail
- **FR14:** Un acheteur peut consulter son panier avec le recapitulatif (produits, quantites, prix total)
- **FR15:** Un acheteur peut modifier les quantites ou supprimer des produits du panier
- **FR16:** Un acheteur peut valider sa commande (paiement simule pour le MVP)
- **FR17:** Le systeme empeche l'ajout au panier pour les visiteurs non connectes et propose l'inscription
- **FR18:** Le systeme redirige le visiteur vers le produit consulte apres inscription

### Product Management (Seller)

- **FR19:** Un vendeur peut ajouter un nouveau composant avec photo, nom, description, specs techniques, prix et quantite en stock
- **FR20:** Un vendeur peut modifier les informations d'un de ses produits
- **FR21:** Un vendeur peut activer ou desactiver un de ses produits (visible/invisible dans le catalogue)
- **FR22:** Un vendeur peut supprimer un de ses produits
- **FR23:** Un vendeur peut consulter son dashboard avec la liste de tous ses produits et leur statut

### Platform Administration

- **FR24:** Un admin peut consulter la liste de tous les comptes utilisateurs (acheteurs et vendeurs)
- **FR25:** Un admin peut activer ou desactiver un compte utilisateur
- **FR26:** Un admin peut consulter la liste de toutes les annonces
- **FR27:** Un admin peut activer ou desactiver une annonce
- **FR28:** Un admin peut consulter des analytics basiques (nombre de produits, nombre d'utilisateurs, nombre de commandes)

### Visitor Experience

- **FR29:** Un visiteur non connecte peut naviguer dans le catalogue, les categories et les fiches detail
- **FR30:** Le systeme affiche les produits de plusieurs vendeurs dans le catalogue

## Non-Functional Requirements

### Performance

- **NFR1:** Le catalogue (vue Master) se charge en < 2 secondes avec 500+ produits
- **NFR2:** La fiche detail se charge en < 1 seconde
- **NFR3:** L'ajout au panier repond en < 500ms avec feedback visuel instantane
- **NFR4:** Les filtres retournent les resultats en < 1 seconde
- **NFR5:** Les mises a jour de stock en temps reel arrivent en < 3 secondes apres le changement
- **NFR6:** Le systeme supporte 100 utilisateurs simultanes sans degradation

### Security

- **NFR7:** Les mots de passe sont haches avec bcrypt ou equivalent
- **NFR8:** Les tokens d'authentification expirent apres une periode d'inactivite
- **NFR9:** Toutes les communications client-serveur utilisent HTTPS
- **NFR10:** Les donnees personnelles sont protegees conformement au RGPD (acces, suppression sur demande)
- **NFR11:** Les vendeurs ne peuvent acceder et modifier que leurs propres produits
- **NFR12:** Les acheteurs ne peuvent acceder qu'a leur propre panier et commandes
- **NFR13:** Le systeme est protege contre les vulnerabilites OWASP Top 10

### Scalability

- **NFR14:** L'architecture supporte une croissance a 10x utilisateurs sans refonte majeure
- **NFR15:** Le catalogue supporte jusqu'a 10 000 produits sans degradation
- **NFR16:** Les images produit sont servies via un systeme de stockage scalable

### Reliability

- **NFR17:** Uptime plateforme > 99%
- **NFR18:** Les donnees du panier sont persistees (pas de perte en cas de deconnexion)
- **NFR19:** Les commandes validees sont stockees de maniere durable et ne peuvent etre perdues
