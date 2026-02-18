#!/home/thibaut/Bureau/testApp/.claude/scripts/.venv/bin/python3
"""
pipeline.py — Orchestrateur du pipeline TDD+BMAD (Méthode.md).

Pipeline par US :
  1. Front Minimal (Facade) → coquille interactive
  2. Phoenix TDD → tests Playwright avant implémentation
  3. Dev Front + Dev Back (parallèle) → implémentation complète
  4. Tests Playwright → exécution
  5. Sherlock (niveaux 1→4) → diagnostic si échecs, boucle

Usage:
  python pipeline.py <story-id>         # Lancer le pipeline pour une US
  python pipeline.py --status           # Voir l'état du pipeline
  python pipeline.py --resume <story>   # Reprendre une US interrompue
"""

import argparse
import asyncio
import sys
from datetime import datetime
from pathlib import Path

# Ajouter scripts/ au path pour les imports locaux
sys.path.insert(0, str(Path(__file__).parent))

from config import (
    MAX_SHERLOCK_LEVEL,
    PIPELINE_STATE,
    PROJECT_ROOT,
    US_DIR,
)
from agents import (
    make_dev_back_agent,
    make_dev_front_agent,
    make_front_minimal_agent,
    make_phoenix_tdd_agent,
    make_sherlock_progressive_agent,
)
from agent_runner import run_agent, setup_logging, load_yaml, save_yaml


# --- Pipeline State ---

def load_pipeline_state() -> dict:
    """Charge l'état persistant du pipeline."""
    if PIPELINE_STATE.exists():
        return load_yaml(PIPELINE_STATE)
    return {"pipeline_version": 1, "stories": {}}


def save_pipeline_state(state: dict):
    """Sauvegarde l'état du pipeline."""
    save_yaml(PIPELINE_STATE, state)


def update_story_phase(state: dict, story_id: str, phase: str, **extra):
    """Met à jour la phase d'une story dans l'état du pipeline."""
    if story_id not in state["stories"]:
        state["stories"][story_id] = {
            "status": phase,
            "started_at": datetime.now().isoformat(),
            "phase_results": {},
            "sherlock": {"current_level": 0, "report_file": ""},
        }
    story_state = state["stories"][story_id]
    story_state["status"] = phase
    story_state["updated_at"] = datetime.now().isoformat()
    for k, v in extra.items():
        if k == "phase_result":
            story_state["phase_results"][phase] = v
        elif k == "sherlock_level":
            story_state["sherlock"]["current_level"] = v
        else:
            story_state[k] = v
    state["current_story"] = story_id
    state["status"] = "in-progress"
    save_pipeline_state(state)


# --- US Loading ---

def load_us_content(story_id: str) -> str | None:
    """Charge le contenu d'une US depuis US/{story_id}/{story_id}.md."""
    us_file = US_DIR / story_id / f"{story_id}.md"
    if us_file.exists():
        return us_file.read_text(encoding="utf-8")
    return None


def ensure_us_dir(story_id: str) -> Path:
    """Crée le répertoire US/{story_id}/ si nécessaire."""
    story_dir = US_DIR / story_id
    story_dir.mkdir(parents=True, exist_ok=True)
    return story_dir


# --- Sherlock Report ---

def load_sherlock_report(story_id: str) -> str:
    """Charge le rapport Sherlock existant (ou vide)."""
    report_file = US_DIR / story_id / "sherlock-report.md"
    if report_file.exists():
        return report_file.read_text(encoding="utf-8")
    return ""


def append_sherlock_report(story_id: str, new_section: str):
    """Ajoute une section au rapport Sherlock cumulatif."""
    report_file = US_DIR / story_id / "sherlock-report.md"
    existing = load_sherlock_report(story_id)
    if not existing:
        existing = f"# Rapport Sherlock — {story_id}\n\n"
    updated = existing + "\n" + new_section
    report_file.write_text(updated, encoding="utf-8")


# --- Pipeline Phases ---

async def phase_front_minimal(story_id: str, story_content: str, logger) -> str:
    """Phase 1 : Front Minimal (Facade)."""
    logger.info(f"\n{'═'*60}")
    logger.info(f"PHASE 1 : FRONT MINIMAL (Facade)")
    logger.info(f"{'═'*60}")

    agent_def = make_front_minimal_agent(story_id, story_content)
    result = await run_agent(agent_def.prompt, agent_def.tools, logger)

    logger.info(f"[FRONT MINIMAL] Terminé")
    return result


async def phase_phoenix_tdd(story_id: str, story_content: str, front_result: str, logger) -> str:
    """Phase 2 : Phoenix TDD — écriture des tests avant implémentation."""
    logger.info(f"\n{'═'*60}")
    logger.info(f"PHASE 2 : PHOENIX TDD")
    logger.info(f"{'═'*60}")

    agent_def = make_phoenix_tdd_agent(story_id, story_content, front_result)
    result = await run_agent(agent_def.prompt, agent_def.tools, logger)

    logger.info(f"[PHOENIX TDD] Terminé")
    return result


async def phase_dev_parallel(story_id: str, story_content: str, test_file: str, logger) -> tuple[str, str]:
    """Phase 3 : Dev Front + Dev Back en parallèle."""
    logger.info(f"\n{'═'*60}")
    logger.info(f"PHASE 3 : DEV PARALLELE (Front + Back)")
    logger.info(f"{'═'*60}")

    agent_front = make_dev_front_agent(story_id, story_content, test_file)
    agent_back = make_dev_back_agent(story_id, story_content, test_file)

    logger.info(f"[DEV] Lancement Front et Back en parallèle")

    front_result, back_result = await asyncio.gather(
        run_agent(agent_front.prompt, agent_front.tools, logger),
        run_agent(agent_back.prompt, agent_back.tools, logger),
    )

    logger.info(f"[DEV FRONT] Terminé")
    logger.info(f"[DEV BACK] Terminé")
    return front_result, back_result


async def phase_run_tests(story_id: str, logger) -> tuple[str, bool]:
    """Phase 4 : Exécution des tests Playwright."""
    logger.info(f"\n{'═'*60}")
    logger.info(f"PHASE 4 : EXECUTION DES TESTS PLAYWRIGHT")
    logger.info(f"{'═'*60}")

    # Lancer les tests Playwright pour cette story
    test_prompt = f"""Lance les tests Playwright pour la story {story_id}.

Commande : cd {PROJECT_ROOT}/e2e && npx playwright test tests/{story_id}.e2e.ts --reporter=list

Si le fichier de test n'existe pas exactement avec ce nom, cherche dans e2e/tests/ un fichier
contenant "{story_id}" dans son nom.

Retourne le résultat COMPLET des tests (stdout + stderr).
Termine par une ligne :
- "VERDICT: PASS" si tous les tests passent
- "VERDICT: FAIL" si au moins un test échoue
"""
    result = await run_agent(test_prompt, ["Bash", "Glob", "Read"], logger)

    passed = "VERDICT: PASS" in result
    logger.info(f"[TESTS] {'PASS' if passed else 'FAIL'}")
    return result, passed


async def phase_sherlock(
    story_id: str, story_content: str, test_results: str, level: int, logger
) -> str:
    """Phase 5 : Diagnostic Sherlock progressif."""
    logger.info(f"\n{'═'*60}")
    logger.info(f"PHASE 5 : SHERLOCK — NIVEAU {level}/{MAX_SHERLOCK_LEVEL}")
    logger.info(f"{'═'*60}")

    previous_report = load_sherlock_report(story_id)

    agent_def = make_sherlock_progressive_agent(
        story_id, story_content, test_results, level, previous_report
    )
    result = await run_agent(agent_def.prompt, agent_def.tools, logger)

    # Ajouter au rapport cumulatif
    append_sherlock_report(story_id, result)

    logger.info(f"[SHERLOCK L{level}] Rapport mis à jour : US/{story_id}/sherlock-report.md")
    return result


async def phase_dev_fix(
    story_id: str, story_content: str, test_file: str, sherlock_report: str, logger
) -> tuple[str, str]:
    """Relance les devs avec le rapport Sherlock comme contexte."""
    logger.info(f"\n{'─'*40}")
    logger.info(f"FIX : Relance des devs avec rapport Sherlock")
    logger.info(f"{'─'*40}")

    fix_context = f"\nRAPPORT SHERLOCK (historique complet) :\n{sherlock_report}"

    agent_front = make_dev_front_agent(story_id, story_content, test_file + fix_context)
    agent_back = make_dev_back_agent(story_id, story_content, test_file + fix_context)

    front_result, back_result = await asyncio.gather(
        run_agent(agent_front.prompt, agent_front.tools, logger),
        run_agent(agent_back.prompt, agent_back.tools, logger),
    )

    logger.info(f"[FIX FRONT] Terminé")
    logger.info(f"[FIX BACK] Terminé")
    return front_result, back_result


# --- Main Pipeline ---

async def run_pipeline(story_id: str, logger, resume_from: str | None = None) -> bool:
    """Exécute le pipeline complet pour une US."""
    logger.info(f"{'═'*60}")
    logger.info(f"PIPELINE TDD+BMAD — {story_id}")
    logger.info(f"{'═'*60}")

    # Charger la US
    story_content = load_us_content(story_id)
    if not story_content:
        logger.error(f"US introuvable : US/{story_id}/{story_id}.md")
        logger.error(f"Créez le fichier avant de lancer le pipeline.")
        return False

    # Préparer le répertoire
    ensure_us_dir(story_id)

    # Charger/initialiser l'état
    state = load_pipeline_state()
    story_state = state.get("stories", {}).get(story_id, {})
    current_phase = story_state.get("status", "") if resume_from else ""

    # Déterminer la phase de départ (pour la reprise)
    phases = ["front-minimal", "phoenix", "dev-parallel", "testing", "sherlock", "done"]
    start_idx = 0
    if resume_from and current_phase in phases:
        start_idx = phases.index(current_phase)
        logger.info(f"Reprise depuis la phase : {current_phase}")

    # --- Phase 1 : Front Minimal ---
    if start_idx <= 0:
        update_story_phase(state, story_id, "front-minimal")
        front_result = await phase_front_minimal(story_id, story_content, logger)
        update_story_phase(state, story_id, "front-minimal", phase_result="done")
    else:
        front_result = story_state.get("phase_results", {}).get("front-minimal", "")

    # --- Phase 2 : Phoenix TDD ---
    if start_idx <= 1:
        update_story_phase(state, story_id, "phoenix")
        tdd_result = await phase_phoenix_tdd(story_id, story_content, front_result, logger)
        update_story_phase(state, story_id, "phoenix", phase_result="done")
    else:
        tdd_result = story_state.get("phase_results", {}).get("phoenix", "")

    # --- Phase 3 : Dev parallèle ---
    if start_idx <= 2:
        update_story_phase(state, story_id, "dev-parallel")
        dev_front_result, dev_back_result = await phase_dev_parallel(
            story_id, story_content, tdd_result, logger
        )
        update_story_phase(state, story_id, "dev-parallel", phase_result="done")

    # --- Phase 4 + 5 : Tests + Boucle Sherlock ---
    sherlock_level = story_state.get("sherlock", {}).get("current_level", 0)

    while True:
        # Phase 4 : Tests
        update_story_phase(state, story_id, "testing")
        test_results, tests_passed = await phase_run_tests(story_id, logger)

        if tests_passed:
            # DONE !
            update_story_phase(state, story_id, "done")
            state["status"] = "done"
            save_pipeline_state(state)

            logger.info(f"\n{'═'*60}")
            logger.info(f"PIPELINE {story_id} — TERMINÉ")
            logger.info(f"{'═'*60}")
            logger.info(f"Front Minimal : OK")
            logger.info(f"Phoenix TDD   : OK")
            logger.info(f"Dev parallèle : OK")
            logger.info(f"Tests         : PASS")
            logger.info(f"Sherlock      : {sherlock_level} itération(s)")
            logger.info(f"{'═'*60}")
            return True

        # Tests échouent → Sherlock
        sherlock_level += 1

        if sherlock_level > MAX_SHERLOCK_LEVEL:
            # Escalade déjà faite, on arrête
            update_story_phase(state, story_id, "escalated")
            state["status"] = "escalated"
            save_pipeline_state(state)

            logger.error(f"\n{'═'*60}")
            logger.error(f"PIPELINE {story_id} — ESCALADE HUMAINE")
            logger.error(f"{'═'*60}")
            logger.error(f"Sherlock a épuisé ses {MAX_SHERLOCK_LEVEL} niveaux d'analyse.")
            logger.error(f"Rapport complet : US/{story_id}/sherlock-report.md")
            logger.error(f"{'═'*60}")
            return False

        # Phase 5 : Sherlock
        update_story_phase(state, story_id, "sherlock", sherlock_level=sherlock_level)
        sherlock_result = await phase_sherlock(
            story_id, story_content, test_results, sherlock_level, logger
        )

        if sherlock_level >= MAX_SHERLOCK_LEVEL:
            # Niveau 4 = escalade, pas de fix automatique
            update_story_phase(state, story_id, "escalated")
            state["status"] = "escalated"
            save_pipeline_state(state)

            logger.error(f"\n{'═'*60}")
            logger.error(f"PIPELINE {story_id} — ESCALADE HUMAINE (Sherlock niveau {MAX_SHERLOCK_LEVEL})")
            logger.error(f"{'═'*60}")
            logger.error(f"Rapport complet : US/{story_id}/sherlock-report.md")
            return False

        # Relancer les devs avec le rapport Sherlock
        full_report = load_sherlock_report(story_id)
        await phase_dev_fix(story_id, story_content, tdd_result, full_report, logger)

        logger.info(f"[BOUCLE] Retour aux tests après fix Sherlock L{sherlock_level}")


# --- CLI ---

def show_status():
    """Affiche l'état du pipeline."""
    state = load_pipeline_state()
    stories = state.get("stories", {})

    if not stories:
        print("\nAucune story dans le pipeline.\n")
        return

    print(f"\nPipeline TDD+BMAD — État\n")
    print(f"{'Story':<25} {'Phase':<18} {'Sherlock':<12} {'Mis à jour'}")
    print(f"{'─'*25} {'─'*18} {'─'*12} {'─'*20}")

    for sid, s in stories.items():
        phase = s.get("status", "?")
        sherlock_lvl = s.get("sherlock", {}).get("current_level", 0)
        updated = s.get("updated_at", "?")[:16]
        sherlock_str = f"L{sherlock_lvl}/{MAX_SHERLOCK_LEVEL}" if sherlock_lvl > 0 else "—"
        print(f"{sid:<25} {phase:<18} {sherlock_str:<12} {updated}")

    print()


async def main():
    parser = argparse.ArgumentParser(
        description="Pipeline TDD+BMAD (Méthode.md)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Exemples :
  python pipeline.py story-001              # Lancer le pipeline
  python pipeline.py --status               # Voir l'état
  python pipeline.py --resume story-001     # Reprendre une US interrompue
        """,
    )
    parser.add_argument("story_id", nargs="?", help="ID de la story (ex: story-001)")
    parser.add_argument("--status", action="store_true", help="Afficher l'état du pipeline")
    parser.add_argument("--resume", metavar="STORY", help="Reprendre une story interrompue")

    args = parser.parse_args()

    if args.status:
        show_status()
        return

    if args.resume:
        logger = setup_logging("pipeline", args.resume)
        await run_pipeline(args.resume, logger, resume_from=args.resume)
        return

    if args.story_id:
        logger = setup_logging("pipeline", args.story_id)
        await run_pipeline(args.story_id, logger)
        return

    parser.print_help()


if __name__ == "__main__":
    asyncio.run(main())
