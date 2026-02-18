# Méthode d'appels des Agents boostés par BMAD

## 1) Chronologie

Pour notre méthode, j'aimerai faire un systeme hybride entre TDD et BMAD.

Pour cela, j'ai besoin que l'on utilise la méthode bmad pour creer les différentes US. Jusque la rien de nouveau ni d'innovant.
Mais pour la suite, c'est là que ça va changer.

Une fois que j'ai mes US décrits dans des fichiers séparés. (tous les us sont stockés dans un dossier nommé 'US')

Je veux d'abord que l'on fasse une partie du front ce que l'on va appeler 'Minimal'. ici pas de logique, juste un affichage afin de correspondre à la US que l'on a.

**Précision "Front Minimal" :** Le front minimal inclut le HTML/Tailwind, les composants Vue, le routing fonctionnel et les boutons cliquables. L'utilisateur peut naviguer et interagir avec l'interface. En revanche, il n'y a aucune vraie logique derrière : pas d'appels API, pas de traitement de données, pas de persistence. C'est une coquille interactive.

Puis avec ce front qui a été fait, je veux que l'on réalise des tests playwrite afin de mettre en place un TDD.

Enfin, on re-appel les agents afin de finir de developper la feature et correspondre aux tests du TDD.
Si les tests ne passent pas ce n'est pas à l'agent qui dev de comprendre pourquoi. Il y a un agent pour cela : Sherlock.

## 2) Appels des différents agents

Si on suit notre chronologie on peut donc avoir cet ordre d'appel:

1. **BMAD** -> Création des US (stockées dans `US/`), et tout ce qui va avec.
2. **Agent Front Minimal (Facade)** -> Dev le front : composants Vue, routing, interactions UI. Pas de logique métier, pas d'appels API. Une coquille interactive. data-testid sur tous les éléments interactifs.
3. **Phoenix (mode TDD)** -> Crée les tests Playwright (TDD). Se base sur **les US** (critères d'acceptance, comportements attendus) + **le front minimal** (éléments affichés, boutons, navigation, data-testid) pour écrire des tests E2E complets.
4. **Agent Front + Agent Back (en parallèle via asyncio)** -> Développent la feature complète pour faire passer les tests Playwright. Front : logique métier, appels API, stores Pinia. Back : controllers, services, migrations, routes API.
5. **Exécution des tests Playwright** :
   - **Tests passent** -> La feature est terminée, on passe à la US suivante.
   - **Tests échouent** -> On appelle **Sherlock**.

## 3) La boucle Sherlock

Quand les tests Playwright échouent, ce n'est **jamais** à l'agent dev de comprendre pourquoi. Sherlock est l'agent dédié au diagnostic.

**Fonctionnement de la boucle :**
1. Sherlock analyse les résultats des tests qui échouent
2. Sherlock rédige un **rapport de diagnostic cumulatif** dans `US/{story-id}/sherlock-report.md`
3. Le rapport complet (incluant l'historique) est transmis aux agents dev
4. Les agents dev corrigent en suivant le rapport
5. Les tests Playwright sont relancés
6. Si ça échoue encore → retour à l'étape 1 avec un niveau supérieur

### Analyse progressive de Sherlock

Sherlock ne répète jamais la même analyse. À chaque itération sur un même problème, il **approfondit** son diagnostic :

- **Niveau 1 — Diagnostic rapide** : Lecture des erreurs de test, identification de la cause probable, suggestion de correction ciblée.
- **Niveau 2 — Analyse élargie** : Si le même test échoue après correction, Sherlock élargit son périmètre. Il examine le contexte autour du bug (dépendances, état de la base, données de test, interactions entre composants).
- **Niveau 3 — Analyse structurelle** : Si le problème persiste, Sherlock remet en question l'approche. Il analyse l'architecture du code impliqué, vérifie la cohérence avec la US, et peut proposer une refonte partielle plutôt qu'un patch.
- **Niveau 4 — Escalade humaine** : Si après une analyse structurelle le problème n'est toujours pas résolu, Sherlock produit un rapport complet de tout ce qui a été tenté et escalade vers l'humain. C'est le dernier recours.

Chaque rapport de Sherlock inclut le **numéro de niveau** et un **historique des tentatives précédentes**, pour que les agents dev aient le contexte complet et ne répètent pas les mêmes corrections.

### Rapport Sherlock cumulatif

Le rapport Sherlock est un fichier **unique** par US. **On ne supprime jamais rien.** Chaque bug reste tracé avec son statut et la correction appliquée. Format :

```markdown
# Rapport Sherlock — {story-id}

## Niveau 1 — Diagnostic rapide (date heure)

### BUG-001: Description courte
- **Statut** : ✅ RÉSOLU | 🔴 EN COURS
- **Diagnostic** : Analyse détaillée
- **Correction appliquée** : Fichier:ligne, modification (Agent Front/Back, itération N)
- **Date résolution** : Si résolu

### BUG-002: ...
```

## 4) Structure des fichiers

```
US/
  {story-id}/
    {story-id}.md              # La User Story (spec, AC, scénarios)
    sherlock-report.md         # Rapport Sherlock UNIQUE et CUMULATIF
```

## 5) Implémentation technique

### Commande `/pipeline`

```bash
/pipeline <story-id>           # Lancer le pipeline complet
```

### Script d'orchestration

```bash
cd .claude/scripts

python pipeline.py <story-id>         # Lancer le pipeline
python pipeline.py --status            # Voir l'état
python pipeline.py --resume <story>    # Reprendre après coupure
```

### État persistant

L'état du pipeline est sauvegardé dans `_bmad-output/pipeline-state.yaml` pour permettre la reprise après coupure.

### Agents impliqués

| Agent | Fichier YAML | Factory (agents.py) | Rôle |
|-------|-------------|---------------------|------|
| Facade | `front-minimal.agent.yaml` | `make_front_minimal_agent` | Coquille interactive |
| Phoenix TDD | `e2e-qa.agent.yaml` (mode TDD) | `make_phoenix_tdd_agent` | Tests avant implémentation |
| Dev Front | — | `make_dev_front_agent` | Logique frontend |
| Dev Back | — | `make_dev_back_agent` | Backend Laravel |
| Sherlock | `e2e-diagnostic.agent.yaml` | `make_sherlock_progressive_agent` | Diagnostic progressif |

### Schéma du pipeline

```
US/{story-id}/
  story-id.md            ← La US (spec)
  sherlock-report.md     ← Rapport Sherlock cumulatif
        │
        ▼
┌──────────────────┐
│ 1. Front Minimal │ → Coquille interactive (Vue + Tailwind + routing + data-testid)
│    (Facade)      │   ZERO logique métier, ZERO appels API
└────────┬─────────┘
         ▼
┌──────────────────┐
│ 2. Phoenix TDD   │ → Tests Playwright AVANT implémentation
│                  │   Basé sur US + front minimal + data-testid
└────────┬─────────┘
         ▼
┌──────────────────┐
│ 3. Dev Front +   │ → Implémentation complète en parallèle
│    Dev Back      │   Front: API calls, Pinia, logique
│    (asyncio)     │   Back: Controllers, Services, Migrations
└────────┬─────────┘
         ▼
┌──────────────────┐
│ 4. Tests         │ → Exécution Playwright
└────────┬─────────┘
    ┌────┴────┐
    │  PASS?  │
    ├─oui──► DONE
    └─non──► Sherlock (niveaux 1→2→3→4)
              │ rapport cumulatif → devs → re-test → boucle
              │ niveau 4 = escalade humaine
```
