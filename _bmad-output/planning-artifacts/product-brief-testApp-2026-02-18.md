---
stepsCompleted: [1, 2, 3, 4, 5]
inputDocuments: []
date: 2026-02-18
author: Thibaut
---

# Product Brief: testApp

## Executive Summary

testApp est une marketplace specialisee dans les composants informatiques, destinee au grand public.
Le concept : un Amazon de l'informatique, minimaliste et intuitif, ou les acheteurs trouvent
rapidement le bon composant grace a des fiches detaillees et un systeme de recommandation,
et ou les vendeurs publient leurs produits en quelques clics.

Deux profils coexistent sur la plateforme : les vendeurs (qui mettent en vente des composants)
et les acheteurs (qui naviguent, ajoutent au panier et achetent). Le MVP cible un parcours
Master/Detail propre avec panier fonctionnel.

---

## Core Vision

### Problem Statement

Les plateformes actuelles de vente de composants informatiques (Amazon, LDLC, Materiel.net)
souffrent de deux problemes majeurs pour le grand public :
1. **Manque d'intuitivite** — L'utilisateur ne trouve pas ce qu'il cherche rapidement.
   Les interfaces sont surchargees, les filtres complexes, la navigation confuse.
2. **Informations techniques insuffisantes ou mal presentees** — Les fiches produit sont
   soit trop vagues (Amazon) soit trop techniques sans mise en forme claire (sites specialises).

### Problem Impact

Un acheteur non-expert perd du temps, hesite, et finit souvent par acheter le mauvais
composant ou payer trop cher. Le parcours d'achat devrait etre simple et rassurant,
pas un parcours du combattant.

### Why Existing Solutions Fall Short

- **Amazon** : Catalogue trop vaste, fiches produit inconsistantes, pas de specialisation info
- **LDLC / Materiel.net** : Interfaces datees, navigation peu intuitive, pas de marketplace (un seul vendeur)
- **Aucune** ne propose un systeme de recommandation adapte au contexte informatique
  (compatibilite, usage, budget)

### Proposed Solution

Une marketplace minimaliste et stylee, exclusivement dediee aux composants informatiques :

- **Navigation Master/Detail** sur plusieurs pages : le Master affiche photo + nom intuitif,
  le Detail presente la fiche complete avec specifications detaillees
- **Deux roles utilisateur** : Vendeurs (publient des composants) et Acheteurs (naviguent + achetent)
- **Panier d'achat** pour les acheteurs
- **Systeme de recommandation** pour guider les choix
- **Design minimaliste avec du style** — epure mais pas austere

### Key Differentiators

1. **Specialisation verticale** — 100% composants informatiques, donc UX et filtres optimises pour ce domaine
2. **Marketplace** — Plusieurs vendeurs, plus de choix et de concurrence sur les prix
3. **Recommandation intelligente** — Suggestions basees sur le contexte (compatibilite, usage, budget)
4. **Minimalisme intuitif** — Interface epuree ou on trouve ce qu'on cherche en quelques secondes

## Target Users

### Primary Users

#### Acheteur — "Le grand public informatique"

Profil mixte couvrant plusieurs sous-segments :

- **Lucas, 22 ans, etudiant/gamer** — Monte son PC gaming piece par piece avec un budget serre.
  Connait les specs, cherche le meilleur rapport performance/prix. Frustre par les interfaces
  surchargees ou il perd du temps a filtrer.
- **Sophie, 38 ans, parent** — Veut upgrader le PC familial (RAM, SSD) mais ne maitrise pas
  le jargon technique. A besoin de fiches claires et de recommandations fiables pour ne pas
  se tromper de composant.
- **Karim, 27 ans, freelance dev** — Cherche du materiel pro fiable (ecran, peripheriques,
  stockage). Sait ce qu'il veut mais veut comparer les prix entre vendeurs rapidement.

**Points communs :**
- Veulent trouver le bon composant vite, sans interface confuse
- Ont besoin d'infos techniques precises mais presentees clairement
- Sensibles au prix — comparent avant d'acheter
- Niveaux techniques variables (debutant a averti)

#### Vendeur — "La plateforme pro"

- **TechDistrib, revendeur agree** — Entreprise specialisee en composants informatiques.
  Gere un catalogue de centaines de references. Publie ses produits avec fiches detaillees,
  photos, prix. Cherche un canal de vente supplementaire avec une audience qualifiee.

**Points communs vendeurs :**
- Professionnels fiables avec stock reel
- Publient des fiches produit completes (specs, photos, prix)
- Gerent leur catalogue (ajout, mise a jour, retrait)
- Cherchent de la visibilite aupres du grand public

### User Journey

**Parcours Acheteur :**
1. **Decouverte** — Arrive sur la page d'accueil, voit les categories de composants (Master)
2. **Navigation** — Browse par categorie, chaque carte affiche photo + nom intuitif
3. **Detail** — Clique sur un composant, voit la fiche complete (specs, prix, vendeur, recommandations)
4. **Panier** — Ajoute au panier, continue ses achats ou passe commande
5. **Moment "aha!"** — Le systeme recommande un composant compatible/complementaire qu'il n'avait pas envisage

**Parcours Vendeur :**
1. **Inscription** — Cree un compte vendeur pro
2. **Publication** — Ajoute ses composants (photo, nom, description detaillee, prix)
3. **Gestion** — Suit son catalogue, met a jour les prix/stock
4. **Ventes** — Recoit les commandes des acheteurs

## Success Metrics

### User Success
- Un acheteur trouve le composant cherche en **moins de 3 clics** depuis la page d'accueil
- L'ajout au panier se fait **sans friction** (1 clic depuis la fiche detail)
- Les recommandations sont **pertinentes** — l'utilisateur clique sur au moins 1 suggestion sur 3
- Un vendeur publie un composant complet (photo, specs, prix) en **moins de 5 minutes**

### Business Objectives

**A 3 mois :**
- Pipeline technique fonctionnel de bout en bout (inscription → catalogue → panier → commande)
- Au moins 50 composants listes par des vendeurs
- Parcours acheteur et vendeur fluides sans bugs bloquants

**A 12 mois :**
- Croissance organique des inscriptions (acheteurs + vendeurs)
- Volume de commandes en progression mensuelle
- Systeme de recommandation qui genere des clics (taux > 15%)

### Key Performance Indicators

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

## MVP Scope

### Core Features

**Authentification & Roles :**
- Inscription / connexion (email + mot de passe)
- Deux roles : Acheteur et Vendeur (choisi a l'inscription)
- Profil utilisateur basique

**Catalogue Composants (Master/Detail) :**
- Page Master : grille de composants avec photo + nom intuitif par categorie
- Page Detail : fiche complete (photo, nom, description detaillee, specs techniques, prix, vendeur)
- Categories de composants : CPU, GPU, RAM, Stockage, CM, Alimentation, Boitier, Peripheriques
- Recherche et filtres basiques (categorie, prix, nom)

**Espace Vendeur :**
- Dashboard vendeur : liste de ses produits
- Formulaire de creation/edition de composant (photo, nom, description, specs, prix, stock)
- Gestion du catalogue (activer/desactiver/supprimer un produit)

**Panier & Commande :**
- Ajout/suppression au panier (1 clic depuis la fiche detail)
- Page panier avec recapitulatif (composants, quantites, prix total)
- Validation de commande (sans paiement reel pour le MVP)

**Recommandations :**
- Suggestions basiques sur la page detail ("Composants similaires", "Les clients ont aussi regarde")
- Basees sur la meme categorie et gamme de prix

### Out of Scope for MVP

- Paiement reel (Stripe, PayPal) — simule pour le MVP
- Systeme d'avis et de notes
- Messagerie vendeur/acheteur
- Suivi de livraison
- Comparateur de composants cote a cote
- Compatibilite hardware automatique (ex: "ce CPU est compatible avec cette CM")
- Notifications push/email
- App mobile native
- Administration plateforme (moderation, dashboard admin)

### MVP Success Criteria

- Le parcours acheteur fonctionne de bout en bout : browse → detail → panier → commande
- Le parcours vendeur fonctionne : inscription → ajout produit → gestion catalogue
- Les recommandations s'affichent sur chaque fiche detail
- Le design est minimaliste, propre et intuitif
- Pas de bug bloquant sur les parcours critiques

### Future Vision

**V2 — Enrichissement :**
- Paiement reel integre (Stripe)
- Systeme d'avis et notes acheteurs
- Compatibilite hardware automatique (recommendations intelligentes basees sur la config)
- Comparateur de composants

**V3 — Plateforme :**
- Messagerie vendeur/acheteur
- Dashboard admin (moderation, analytics)
- Notifications email/push
- API publique pour les vendeurs (import catalogue en masse)

**Long terme :**
- App mobile (PWA ou native)
- Expansion vers d'autres categories tech (peripheriques gaming, reseaux, domotique)
- Programme de fidelite / cashback
