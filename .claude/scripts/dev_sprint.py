#!/usr/bin/env python3
"""
dev_sprint.py — Orchestrateur de sprint BMAD.

Lance le cycle complet pour une story :
  dev (implémenter) → review (code review) → qa (tests) → fix loop si nécessaire.

Usage:
  python dev_sprint.py <story-id>              # Une story spécifique
  python dev_sprint.py --all                    # Toutes les stories ready-for-dev
  python dev_sprint.py --list                   # Lister les stories disponibles
"""

import argparse
import asyncio
import sys
from datetime import datetime
from pathlib import Path

# Ajouter scripts/ au path pour les imports locaux
sys.path.insert(0, str(Path(__file__).parent))

from config import (
    BMAD_OUTPUT,
    MAX_FIX_ITERATIONS,
    REVIEWS_DIR,
    SPRINT_STATUS,
    STORIES_DIR,
)
from agents import make_dev_agent, make_qa_agent, make_reviewer_agent
from agent_runner import run_agent, setup_logging, load_yaml, save_yaml


# --- Sprint Status ---

def load_sprint_status() -> dict:
    return load_yaml(SPRINT_STATUS)


def save_sprint_status(data: dict):
    data["generated"] = datetime.now().strftime("%Y-%m-%d")
    save_yaml(SPRINT_STATUS, data)


def find_ready_stories(status: dict) -> list[str]:
    """Trouve toutes les stories en ready-for-dev."""
    dev_status = status.get("development_status", {})
    return [k for k, v in dev_status.items() if v == "ready-for-dev" and not k.startswith("epic-")]


def update_story_status(story_id: str, new_status: str):
    status = load_sprint_status()
    dev_status = status.get("development_status", {})
    if story_id in dev_status:
        dev_status[story_id] = new_status
        save_sprint_status(status)


# --- Story Loading ---

def load_story_content(story_id: str) -> str | None:
    """Charge le contenu d'un fichier story depuis US/{story_id}/{story_id}.md."""
    candidates = [
        STORIES_DIR / story_id / f"{story_id}.md",  # US/{story_id}/{story_id}.md
        STORIES_DIR / f"{story_id}.md",              # US/{story_id}.md (fallback)
        BMAD_OUTPUT / f"{story_id}.md",              # Legacy fallback
    ]
    for path in candidates:
        if path.exists():
            return path.read_text(encoding="utf-8")
    return None


# --- Agent Execution ---

async def run_dev(story_id: str, story_content: str, fix_context: str, logger) -> str:
    """Lance l'agent dev pour implémenter ou fixer."""
    agent_def = make_dev_agent(story_id, story_content)
    prompt = agent_def.prompt
    if fix_context:
        prompt += f"\n\nCONTEXTE FIX — Problemes a corriger :\n{fix_context}"

    logger.info(f"[DEV] Lancement agent dev pour {story_id}")
    result = await run_agent(prompt, agent_def.tools, logger)
    logger.info(f"[DEV] Agent dev terminé")
    return result


async def run_review(story_id: str, dev_result: str, logger) -> tuple[str, bool]:
    """Lance l'agent reviewer. Retourne (rapport, passed)."""
    agent_def = make_reviewer_agent(story_id, dev_result)

    logger.info(f"[REVIEW] Lancement code review pour {story_id}")
    result = await run_agent(agent_def.prompt, agent_def.tools, logger)
    logger.info(f"[REVIEW] Code review terminée")

    # Sauvegarder le rapport
    REVIEWS_DIR.mkdir(parents=True, exist_ok=True)
    review_file = REVIEWS_DIR / f"{story_id}-review.md"
    review_file.write_text(
        f"# Code Review — {story_id}\n\nDate: {datetime.now().isoformat()}\n\n{result}",
        encoding="utf-8",
    )
    logger.info(f"[REVIEW] Rapport sauvegardé: {review_file}")

    passed = "PASS" in result.upper() and "FAIL" not in result.upper().split("VERDICT")[-1] if "VERDICT" in result.upper() else "CRITICAL" not in result.upper() and "MAJOR" not in result.upper()
    return result, passed


async def run_qa(story_id: str, dev_result: str, logger) -> tuple[str, bool]:
    """Lance l'agent QA. Retourne (rapport, passed)."""
    agent_def = make_qa_agent(story_id, dev_result)

    logger.info(f"[QA] Lancement QA pour {story_id}")
    result = await run_agent(agent_def.prompt, agent_def.tools, logger)
    logger.info(f"[QA] QA terminée")

    # Sauvegarder le rapport
    REVIEWS_DIR.mkdir(parents=True, exist_ok=True)
    qa_file = REVIEWS_DIR / f"{story_id}-qa.md"
    qa_file.write_text(
        f"# QA Report — {story_id}\n\nDate: {datetime.now().isoformat()}\n\n{result}",
        encoding="utf-8",
    )
    logger.info(f"[QA] Rapport sauvegardé: {qa_file}")

    passed = "PASS" in result.upper() and "FAIL" not in result.upper().split("VERDICT")[-1] if "VERDICT" in result.upper() else "FAIL" not in result.upper()
    return result, passed


# --- Orchestration ---

async def process_story(story_id: str, logger) -> bool:
    """Orchestre le cycle complet pour une story."""
    logger.info(f"{'='*60}")
    logger.info(f"STORY {story_id} — DEBUT DU CYCLE")
    logger.info(f"{'='*60}")

    # Charger la story
    story_content = load_story_content(story_id)
    if not story_content:
        logger.error(f"Story {story_id} introuvable dans {STORIES_DIR} ou {BMAD_OUTPUT}")
        return False

    # Mettre à jour le statut
    update_story_status(story_id, "in-progress")

    # Phase 1 : Implementation
    logger.info(f"\n{'─'*40}\nPHASE 1 : IMPLEMENTATION\n{'─'*40}")
    dev_result = await run_dev(story_id, story_content, "", logger)

    fix_iterations = 0
    review_issues = ""
    qa_issues = ""

    while fix_iterations <= MAX_FIX_ITERATIONS:
        # Phase 2 : Code Review
        logger.info(f"\n{'─'*40}\nPHASE 2 : CODE REVIEW (iteration {fix_iterations})\n{'─'*40}")
        review_result, review_passed = await run_review(story_id, dev_result, logger)

        if not review_passed:
            fix_iterations += 1
            if fix_iterations > MAX_FIX_ITERATIONS:
                logger.error(f"MAX FIX ITERATIONS ({MAX_FIX_ITERATIONS}) atteint pour la review")
                break
            logger.info(f"\n{'─'*40}\nPHASE 4 : FIX LOOP (iteration {fix_iterations})\n{'─'*40}")
            review_issues = review_result
            dev_result = await run_dev(story_id, story_content, f"REVIEW ISSUES:\n{review_issues}", logger)
            continue

        # Phase 3 : QA
        logger.info(f"\n{'─'*40}\nPHASE 3 : TESTS AUTOMATISES\n{'─'*40}")
        qa_result, qa_passed = await run_qa(story_id, dev_result, logger)

        if not qa_passed:
            fix_iterations += 1
            if fix_iterations > MAX_FIX_ITERATIONS:
                logger.error(f"MAX FIX ITERATIONS ({MAX_FIX_ITERATIONS}) atteint pour les tests")
                break
            logger.info(f"\n{'─'*40}\nPHASE 4 : FIX LOOP (iteration {fix_iterations})\n{'─'*40}")
            qa_issues = qa_result
            dev_result = await run_dev(story_id, story_content, f"QA ISSUES:\n{qa_issues}", logger)
            continue

        # Tout passe !
        update_story_status(story_id, "done")
        logger.info(f"\n{'='*60}")
        logger.info(f"STORY {story_id} — TERMINEE")
        logger.info(f"{'─'*40}")
        logger.info(f"Implementation : OK")
        logger.info(f"Code Review    : OK")
        logger.info(f"Tests          : OK")
        logger.info(f"Fix iterations : {fix_iterations}")
        logger.info(f"Resultats :")
        logger.info(f"  - {REVIEWS_DIR}/{story_id}-review.md")
        logger.info(f"  - {REVIEWS_DIR}/{story_id}-qa.md")
        logger.info(f"{'='*60}")
        return True

    # Echec après max iterations
    update_story_status(story_id, "review")
    logger.error(f"\nSTORY {story_id} — ECHEC apres {fix_iterations} iterations de fix")
    logger.error(f"Derniers problemes review: {review_issues[:200] if review_issues else 'aucun'}")
    logger.error(f"Derniers problemes QA: {qa_issues[:200] if qa_issues else 'aucun'}")
    return False


# --- CLI ---

def list_stories():
    """Affiche les stories disponibles."""
    status = load_sprint_status()
    dev_status = status.get("development_status", {})

    print("\nStories par statut :\n")
    for s in ["ready-for-dev", "in-progress", "review", "backlog"]:
        stories = [k for k, v in dev_status.items() if v == s and not k.startswith("epic-")]
        if stories:
            print(f"  [{s}]")
            for story in stories:
                print(f"    - {story}")
            print()


async def main():
    parser = argparse.ArgumentParser(
        description="Orchestrateur de sprint BMAD",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Exemples :
  python dev_sprint.py 12-1-notifications-push     # Une story
  python dev_sprint.py --all                        # Toutes les ready-for-dev
  python dev_sprint.py --list                       # Lister les stories
        """,
    )
    parser.add_argument("story_id", nargs="?", help="ID de la story à traiter")
    parser.add_argument("--all", action="store_true", help="Traiter toutes les stories ready-for-dev")
    parser.add_argument("--list", action="store_true", help="Lister les stories disponibles")

    args = parser.parse_args()

    if args.list:
        list_stories()
        return

    if args.all:
        status = load_sprint_status()
        stories = find_ready_stories(status)
        if not stories:
            print("Aucune story en ready-for-dev.")
            return

        logger = setup_logging("dev_sprint", "batch")
        logger.info(f"Batch : {len(stories)} stories à traiter")
        results = {}
        for story_id in stories:
            success = await process_story(story_id, logger)
            results[story_id] = "OK" if success else "ECHEC"

        logger.info(f"\n{'='*60}\nBATCH TERMINE\n{'='*60}")
        for sid, result in results.items():
            logger.info(f"  {sid} : {result}")
        return

    if args.story_id:
        logger = setup_logging("dev_sprint", args.story_id)
        await process_story(args.story_id, logger)
        return

    parser.print_help()


if __name__ == "__main__":
    asyncio.run(main())
