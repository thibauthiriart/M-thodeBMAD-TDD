#!/usr/bin/env python3
"""
pipeline.py — Orchestrateur du pipeline TDD+BMAD (Méthode.md).

Deux modes :
  Feature : Facade → Phoenix TDD → Dev → Tests → Sherlock loop
  Bug     : Investigator → Phoenix Regression → Dev → Tests → Sherlock loop

Usage:
  python pipeline.py <story-id>              # Lancer le pipeline feature
  python pipeline.py <story-id> --bug        # Lancer le pipeline bug
  python pipeline.py --status                # Voir l'état du pipeline
  python pipeline.py --resume <story>        # Reprendre (mode auto-détecté)
  python pipeline.py --batch all             # Lancer TOUTES les stories
  python pipeline.py --batch 2-1,2-3 --bug   # Batch en mode bug
  python pipeline.py --batch 2 --skip-done   # Sauter les stories déjà done
"""

import argparse
import asyncio
import sys
from datetime import datetime
from pathlib import Path

# Ajouter scripts/ au path pour les imports locaux
sys.path.insert(0, str(Path(__file__).parent))

import re
import time

from config import (
    BMAD_OUTPUT,
    BUG_INVESTIGATION_REPORT,
    MAX_SHERLOCK_LEVEL,
    PIPELINE_STATE,
    PROJECT_ROOT,
    US_DIR,
)
from agents import (
    make_bug_investigator_agent,
    make_dev_back_agent,
    make_dev_front_agent,
    make_front_minimal_agent,
    make_phoenix_regression_agent,
    make_phoenix_tdd_agent,
    make_sherlock_progressive_agent,
)
from agent_runner import run_agent, setup_logging, load_yaml, save_yaml


# --- Result Parsing Helpers ---

def _extract_section(text: str, header: str) -> list[str]:
    """Extrait les lignes sous un header markdown (## ou ###)."""
    lines = []
    in_section = False
    header_lower = header.lower()
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.lower().startswith(("#",)):
            # C'est un header — est-ce le bon ?
            clean = stripped.lstrip("#").strip().lower()
            if header_lower in clean:
                in_section = True
                continue
            elif in_section:
                # On a atteint le header suivant, on sort
                break
        elif in_section and stripped:
            lines.append(stripped)
    return lines


def _extract_files_from_result(result: str) -> list[str]:
    """Extrait les chemins de fichiers mentionnés dans un résultat d'agent."""
    files = set()
    for line in result.splitlines():
        # Patterns courants: "- fichier.vue : description" ou "fichier:ligne"
        m = re.search(r"[`]?([a-zA-Z0-9_./-]+\.(vue|ts|tsx|js|php|py|yaml|md|css))[`]?", line)
        if m:
            files.add(m.group(1))
    return sorted(files)


def _extract_testids(result: str) -> list[str]:
    """Extrait les data-testid d'un résultat d'agent."""
    ids = set()
    for m in re.finditer(r'data-testid="([^"]+)"', result):
        ids.add(m.group(1))
    return sorted(ids)


def _count_tests_from_result(result: str) -> dict[str, int]:
    """Parse le nombre de tests depuis le rapport Playwright."""
    counts = {"passed": 0, "failed": 0, "skipped": 0, "total": 0}
    # Pattern Playwright: "X passed", "X failed", "X skipped"
    for label, key in [("passed", "passed"), ("failed", "failed"), ("skipped", "skipped")]:
        m = re.search(rf"(\d+)\s+{label}", result)
        if m:
            counts[key] = int(m.group(1))
    counts["total"] = counts["passed"] + counts["failed"] + counts["skipped"]
    return counts


def _extract_failed_tests(result: str) -> list[str]:
    """Extrait les noms des tests qui ont échoué depuis la sortie Playwright."""
    failed = []
    for line in result.splitlines():
        stripped = line.strip()
        # Playwright list reporter: "  ✘  [chromium] › test-name" ou "FAIL" patterns
        if any(marker in stripped for marker in ["✘", "FAIL", "✗", "×", "failed"]):
            # Nettoyer pour garder le nom du test
            clean = re.sub(r"^\s*[✘✗×]\s*", "", stripped)
            clean = re.sub(r"^\[\w+\]\s*›\s*", "", clean)
            clean = re.sub(r"\s*\(\d+(\.\d+)?s\)\s*$", "", clean)
            if clean and len(clean) > 5:
                failed.append(clean)
    # Aussi chercher les lignes "Error:" juste après un test
    errors = []
    for m in re.finditer(r"(Error|AssertionError|expect\(.*\)).*", result):
        err = m.group(0)[:150]
        if err not in errors:
            errors.append(err)
    return failed, errors


def _extract_bugs_from_sherlock(result: str) -> list[str]:
    """Extrait les BUG-XXX depuis un rapport Sherlock."""
    bugs = []
    for m in re.finditer(r"###\s*(BUG-\d+)\s*:\s*(.*)", result):
        bugs.append(f"{m.group(1)}: {m.group(2).strip()}")
    return bugs


def _check_db_escalation(result: str) -> tuple[bool, str]:
    """Vérifie si un agent a déclenché une escalade DB_CHANGE_REQUIRED.

    Returns:
        (escalade_detected, details)
    """
    marker = "ESCALADE: DB_CHANGE_REQUIRED"
    if marker not in result:
        return False, ""

    # Extraire les détails de l'escalade
    details_lines = []
    in_escalade = False
    for line in result.splitlines():
        if marker in line:
            in_escalade = True
            continue
        if in_escalade:
            if line.strip().startswith("## ") and marker not in line:
                break  # Section suivante
            if line.strip():
                details_lines.append(line.strip())
    return True, "\n".join(details_lines)


def _log_phase_summary(logger, phase_name: str, duration: float, result: str, extra_logs=None):
    """Log un résumé structuré après chaque phase."""
    logger.info(f"{'─'*50}")
    logger.info(f"[{phase_name}] Terminé en {_format_duration(duration)}")

    # Fichiers touchés
    files = _extract_files_from_result(result)
    if files:
        logger.info(f"[{phase_name}] Fichiers touchés ({len(files)}) :")
        for f in files[:15]:  # Max 15 pour pas spammer
            logger.info(f"  → {f}")
        if len(files) > 15:
            logger.info(f"  ... et {len(files) - 15} autres")

    # data-testid (pour front-minimal et phoenix)
    testids = _extract_testids(result)
    if testids:
        logger.info(f"[{phase_name}] data-testid créés ({len(testids)}) :")
        for tid in testids[:10]:
            logger.info(f"  → {tid}")
        if len(testids) > 10:
            logger.info(f"  ... et {len(testids) - 10} autres")

    # Logs supplémentaires
    if extra_logs:
        for line in extra_logs:
            logger.info(f"[{phase_name}] {line}")

    logger.info(f"{'─'*50}")


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
    logger.info(f"Story : {story_id}")
    logger.info(f"{'═'*60}")

    t0 = time.time()
    agent_def = make_front_minimal_agent(story_id, story_content)
    result = await run_agent(agent_def.prompt, agent_def.tools, logger, agent_label="facade")

    # Résumé
    extra = []
    neg_criteria = [l for l in result.splitlines() if l.strip().startswith("### NEG-")]
    if neg_criteria:
        extra.append(f"Critères négatifs générés : {len(neg_criteria)}")
        for nc in neg_criteria[:5]:
            extra.append(f"  {nc.strip()}")
    _log_phase_summary(logger, "FRONT MINIMAL", time.time() - t0, result, extra)

    return result


async def phase_phoenix_tdd(story_id: str, story_content: str, front_result: str, logger) -> str:
    """Phase 2 : Phoenix TDD — écriture des tests avant implémentation."""
    logger.info(f"\n{'═'*60}")
    logger.info(f"PHASE 2 : PHOENIX TDD")
    logger.info(f"Story : {story_id}")
    logger.info(f"{'═'*60}")

    t0 = time.time()
    agent_def = make_phoenix_tdd_agent(story_id, story_content, front_result)
    result = await run_agent(agent_def.prompt, agent_def.tools, logger, agent_label="phoenix-tdd")

    # Résumé
    extra = []
    pos_tests = _extract_section(result, "tests positifs")
    neg_tests = _extract_section(result, "tests negatifs")
    if pos_tests:
        extra.append(f"Tests positifs : {len(pos_tests)} lignes")
    if neg_tests:
        extra.append(f"Tests négatifs : {len(neg_tests)} lignes")
    scenarios = _extract_section(result, "scenarios couverts")
    if scenarios:
        extra.append(f"Scénarios couverts : {len(scenarios)}")
        for s in scenarios[:5]:
            extra.append(f"  {s}")
    _log_phase_summary(logger, "PHOENIX TDD", time.time() - t0, result, extra)

    return result


async def phase_investigation(story_id: str, story_content: str, logger) -> str:
    """Phase 1 (bug) : Investigation du bug."""
    logger.info(f"\n{'═'*60}")
    logger.info(f"PHASE 1 : BUG INVESTIGATION")
    logger.info(f"Story : {story_id}")
    logger.info(f"{'═'*60}")

    t0 = time.time()
    agent_def = make_bug_investigator_agent(story_id, story_content)
    result = await run_agent(agent_def.prompt, agent_def.tools, logger, agent_label="investigator")

    # Sauvegarder le rapport d'investigation
    report_path = US_DIR / story_id / BUG_INVESTIGATION_REPORT
    report_path.write_text(result, encoding="utf-8")

    # Résumé
    extra = [f"Rapport sauvegardé : {report_path}"]
    root_cause = _extract_section(result, "cause racine")
    if root_cause:
        extra.append("Cause racine identifiée :")
        for line in root_cause[:3]:
            extra.append(f"  {line}")
    affected = _extract_section(result, "fichiers concernes")
    if affected:
        extra.append(f"Fichiers concernés : {len(affected)}")
        for f in affected[:5]:
            extra.append(f"  {f}")
    correction = _extract_section(result, "correction suggeree")
    if correction:
        extra.append("Correction suggérée :")
        for line in correction[:3]:
            extra.append(f"  {line}")
    _log_phase_summary(logger, "INVESTIGATION", time.time() - t0, result, extra)

    return result


async def phase_phoenix_regression(
    story_id: str, story_content: str, investigation_result: str, logger
) -> str:
    """Phase 2 (bug) : Phoenix Regression — tests de regression pour le bug."""
    logger.info(f"\n{'═'*60}")
    logger.info(f"PHASE 2 : PHOENIX REGRESSION")
    logger.info(f"Story : {story_id}")
    logger.info(f"{'═'*60}")

    t0 = time.time()
    agent_def = make_phoenix_regression_agent(story_id, story_content, investigation_result)
    result = await run_agent(agent_def.prompt, agent_def.tools, logger, agent_label="phoenix-regr")

    # Résumé
    extra = []
    main_test = _extract_section(result, "test principal")
    if main_test:
        extra.append(f"Test principal (reproduit le bug) :")
        for line in main_test[:3]:
            extra.append(f"  {line}")
    regr_tests = _extract_section(result, "tests de non-regression")
    if regr_tests:
        extra.append(f"Tests de non-régression : {len(regr_tests)} lignes")
    _log_phase_summary(logger, "PHOENIX REGRESSION", time.time() - t0, result, extra)

    return result


async def phase_dev_parallel(
    story_id: str, story_content: str, test_file: str, logger, mode: str = "feature"
) -> tuple[str, str]:
    """Phase 3 : Dev Front + Dev Back en parallèle."""
    logger.info(f"\n{'═'*60}")
    logger.info(f"PHASE 3 : DEV PARALLELE (Front + Back)")
    logger.info(f"Story : {story_id}")
    if mode == "bug":
        logger.info(f"MODE BUG : protection DB activée — aucune migration autorisée")
    logger.info(f"{'═'*60}")

    agent_front = make_dev_front_agent(story_id, story_content, test_file, mode=mode)
    agent_back = make_dev_back_agent(story_id, story_content, test_file, mode=mode)

    logger.info(f"[DEV] Lancement Front et Back en parallèle...")

    t0 = time.time()
    front_result, back_result = await asyncio.gather(
        run_agent(agent_front.prompt, agent_front.tools, logger, agent_label="dev-front"),
        run_agent(agent_back.prompt, agent_back.tools, logger, agent_label="dev-back"),
    )
    elapsed = time.time() - t0

    # Résumé Front
    front_files = _extract_files_from_result(front_result)
    extra_front = []
    services = _extract_section(front_result, "services api")
    stores = _extract_section(front_result, "stores")
    if services:
        extra_front.append(f"Services API créés : {len(services)}")
    if stores:
        extra_front.append(f"Stores créés/modifiés : {len(stores)}")
    logger.info(f"{'─'*50}")
    logger.info(f"[DEV FRONT] Terminé — {len(front_files)} fichiers touchés")
    for f in front_files[:10]:
        logger.info(f"  → {f}")
    for line in extra_front:
        logger.info(f"  {line}")

    # Résumé Back
    back_files = _extract_files_from_result(back_result)
    extra_back = []
    endpoints = _extract_section(back_result, "endpoints api")
    tests_backend = _extract_section(back_result, "tests backend")
    if endpoints:
        extra_back.append(f"Endpoints API créés : {len(endpoints)}")
        for ep in endpoints[:5]:
            extra_back.append(f"  {ep}")
    if tests_backend:
        extra_back.append(f"Tests backend : {len(tests_backend)} lignes")
    logger.info(f"[DEV BACK] Terminé — {len(back_files)} fichiers touchés")
    for f in back_files[:10]:
        logger.info(f"  → {f}")
    for line in extra_back:
        logger.info(f"  {line}")

    logger.info(f"[DEV] Durée totale phase dev : {_format_duration(elapsed)}")
    logger.info(f"{'─'*50}")

    return front_result, back_result


async def phase_run_tests(story_id: str, logger) -> tuple[str, bool]:
    """Phase 4 : Exécution des tests Playwright."""
    logger.info(f"\n{'═'*60}")
    logger.info(f"PHASE 4 : EXECUTION DES TESTS")
    logger.info(f"Story : {story_id}")
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
    t0 = time.time()
    result = await run_agent(test_prompt, ["Bash", "Glob", "Read"], logger, agent_label="test-runner")
    elapsed = time.time() - t0

    passed = "VERDICT: PASS" in result

    # Parsing détaillé des résultats
    counts = _count_tests_from_result(result)
    logger.info(f"{'─'*50}")
    logger.info(f"[TESTS] Durée : {_format_duration(elapsed)}")
    if counts["total"] > 0:
        logger.info(f"[TESTS] Résultats : {counts['passed']} passed, {counts['failed']} failed, {counts['skipped']} skipped / {counts['total']} total")
    else:
        logger.info(f"[TESTS] {'PASS' if passed else 'FAIL'}")

    if not passed:
        # Détailler les tests qui ont échoué
        failed_tests, errors = _extract_failed_tests(result)
        if failed_tests:
            logger.warning(f"[TESTS] Tests en échec ({len(failed_tests)}) :")
            for ft in failed_tests[:10]:
                logger.warning(f"  ✘ {ft}")
            if len(failed_tests) > 10:
                logger.warning(f"  ... et {len(failed_tests) - 10} autres")
        if errors:
            logger.warning(f"[TESTS] Erreurs détectées ({len(errors)}) :")
            for err in errors[:5]:
                logger.warning(f"  → {err}")
            if len(errors) > 5:
                logger.warning(f"  ... et {len(errors) - 5} autres")
    else:
        logger.info(f"[TESTS] TOUS LES TESTS PASSENT")

    logger.info(f"{'─'*50}")
    return result, passed


async def phase_sherlock(
    story_id: str, story_content: str, test_results: str, level: int, logger, mode: str = "feature"
) -> str:
    """Phase 5 : Diagnostic Sherlock progressif."""
    level_labels = {
        1: "Diagnostic rapide",
        2: "Analyse sémantique + anti-faux-positif",
        3: "Audit cross-feature",
        4: "Escalade humaine",
    }
    label = level_labels.get(level, "Analyse")

    logger.info(f"\n{'═'*60}")
    logger.info(f"PHASE 5 : SHERLOCK — NIVEAU {level}/{MAX_SHERLOCK_LEVEL}")
    logger.info(f"Type : {label}")
    logger.info(f"Story : {story_id}")
    logger.info(f"{'═'*60}")

    previous_report = load_sherlock_report(story_id)

    t0 = time.time()
    agent_def = make_sherlock_progressive_agent(
        story_id, story_content, test_results, level, previous_report, mode=mode
    )
    result = await run_agent(agent_def.prompt, agent_def.tools, logger, agent_label=f"sherlock-L{level}")
    elapsed = time.time() - t0

    # Ajouter au rapport cumulatif
    append_sherlock_report(story_id, result)

    # Résumé
    bugs = _extract_bugs_from_sherlock(result)
    extra = [f"Rapport mis à jour : US/{story_id}/sherlock-report.md"]
    if bugs:
        extra.append(f"Bugs identifiés ({len(bugs)}) :")
        for bug in bugs:
            extra.append(f"  → {bug}")
    # Extraire les corrections suggérées
    corrections = _extract_section(result, "correction suggeree")
    if corrections:
        extra.append(f"Corrections suggérées :")
        for c in corrections[:5]:
            extra.append(f"  → {c}")
    _log_phase_summary(logger, f"SHERLOCK L{level}", elapsed, result, extra)

    return result


async def phase_dev_fix(
    story_id: str, story_content: str, test_file: str, sherlock_report: str, logger, mode: str = "feature"
) -> tuple[str, str]:
    """Relance les devs avec le rapport Sherlock comme contexte."""
    logger.info(f"\n{'─'*50}")
    logger.info(f"FIX : Relance des devs avec rapport Sherlock")
    if mode == "bug":
        logger.info(f"MODE BUG : protection DB activée — aucune migration autorisée")
    logger.info(f"{'─'*50}")

    fix_context = f"\nRAPPORT SHERLOCK (historique complet) :\n{sherlock_report}"

    agent_front = make_dev_front_agent(story_id, story_content, test_file + fix_context, mode=mode)
    agent_back = make_dev_back_agent(story_id, story_content, test_file + fix_context, mode=mode)

    t0 = time.time()
    front_result, back_result = await asyncio.gather(
        run_agent(agent_front.prompt, agent_front.tools, logger, agent_label="fix-front"),
        run_agent(agent_back.prompt, agent_back.tools, logger, agent_label="fix-back"),
    )
    elapsed = time.time() - t0

    front_files = _extract_files_from_result(front_result)
    back_files = _extract_files_from_result(back_result)

    logger.info(f"[FIX FRONT] {len(front_files)} fichiers modifiés")
    for f in front_files[:5]:
        logger.info(f"  → {f}")
    logger.info(f"[FIX BACK] {len(back_files)} fichiers modifiés")
    for f in back_files[:5]:
        logger.info(f"  → {f}")
    logger.info(f"[FIX] Durée totale : {_format_duration(elapsed)}")

    return front_result, back_result


# --- Main Pipeline ---

async def run_pipeline(
    story_id: str, logger, resume_from: str | None = None, mode: str = "feature"
) -> bool:
    """Exécute le pipeline complet pour une US.

    Args:
        mode: "feature" (Facade → Phoenix TDD) ou "bug" (Investigation → Phoenix Regression)
    """
    pipeline_start = time.time()

    logger.info(f"\n{'═'*60}")
    logger.info(f"PIPELINE TDD+BMAD — {story_id}")
    logger.info(f"Mode : {mode}")
    logger.info(f"Début : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info(f"{'═'*60}")

    # Charger la US
    story_content = load_us_content(story_id)
    if not story_content:
        logger.error(f"US introuvable : US/{story_id}/{story_id}.md")
        logger.error(f"Créez le fichier avant de lancer le pipeline.")
        return False

    # Log le contenu de la US (titre + AC)
    story_lines = story_content.splitlines()
    title = next((l for l in story_lines if l.startswith("# ")), story_id)
    logger.info(f"Story : {title}")
    ac_count = sum(1 for l in story_lines if l.strip().startswith("- ["))
    if ac_count:
        logger.info(f"Critères d'acceptation : {ac_count}")

    # Préparer le répertoire
    ensure_us_dir(story_id)

    # Charger/initialiser l'état
    state = load_pipeline_state()
    story_state = state.get("stories", {}).get(story_id, {})
    current_phase = story_state.get("status", "") if resume_from else ""

    # Auto-détecter le mode depuis le state pour --resume
    if resume_from and story_state.get("mode"):
        mode = story_state["mode"]
        logger.info(f"Mode auto-détecté depuis le state : {mode}")

    # Phases selon le mode
    if mode == "bug":
        phases = ["investigation", "phoenix", "dev-parallel", "testing", "sherlock", "done"]
        phase1_name = "investigation"
    else:
        phases = ["front-minimal", "phoenix", "dev-parallel", "testing", "sherlock", "done"]
        phase1_name = "front-minimal"

    start_idx = 0
    if resume_from and current_phase in phases:
        start_idx = phases.index(current_phase)
        logger.info(f"Reprise depuis la phase : {current_phase}")

    # --- Phase 1 : Front Minimal (feature) ou Investigation (bug) ---
    if start_idx <= 0:
        update_story_phase(state, story_id, phase1_name, mode=mode)
        if mode == "bug":
            phase1_result = await phase_investigation(story_id, story_content, logger)
            # Vérifier si l'investigation a détecté un besoin de changement DB
            escalade, details = _check_db_escalation(phase1_result)
            if escalade:
                pipeline_elapsed = time.time() - pipeline_start
                update_story_phase(state, story_id, "escalated-db")
                state["status"] = "escalated-db"
                save_pipeline_state(state)
                logger.error(f"\n{'═'*60}")
                logger.error(f"PIPELINE {story_id} — ESCALADE DB REQUISE")
                logger.error(f"{'═'*60}")
                logger.error(f"L'investigation a déterminé qu'un changement de base de données")
                logger.error(f"est nécessaire pour corriger ce bug.")
                logger.error(f"")
                logger.error(f"DÉTAILS :")
                for line in details.splitlines():
                    logger.error(f"  {line}")
                logger.error(f"")
                logger.error(f"ACTION REQUISE : Intervention humaine pour valider/appliquer")
                logger.error(f"la modification de schema, puis relancer le pipeline.")
                logger.error(f"Rapport : US/{story_id}/{BUG_INVESTIGATION_REPORT}")
                logger.error(f"Durée : {_format_duration(pipeline_elapsed)}")
                logger.error(f"{'═'*60}")
                return False
        else:
            phase1_result = await phase_front_minimal(story_id, story_content, logger)
        update_story_phase(state, story_id, phase1_name, phase_result="done")
    else:
        phase1_result = story_state.get("phase_results", {}).get(phase1_name, "")

    # --- Phase 2 : Phoenix TDD (feature) ou Phoenix Regression (bug) ---
    if start_idx <= 1:
        update_story_phase(state, story_id, "phoenix")
        if mode == "bug":
            tdd_result = await phase_phoenix_regression(
                story_id, story_content, phase1_result, logger
            )
        else:
            tdd_result = await phase_phoenix_tdd(story_id, story_content, phase1_result, logger)
        update_story_phase(state, story_id, "phoenix", phase_result="done")
    else:
        tdd_result = story_state.get("phase_results", {}).get("phoenix", "")

    # --- Phase 3 : Dev parallèle ---
    if start_idx <= 2:
        update_story_phase(state, story_id, "dev-parallel")
        dev_front_result, dev_back_result = await phase_dev_parallel(
            story_id, story_content, tdd_result, logger, mode=mode
        )

        # En mode bug, vérifier si un dev a détecté un besoin de changement DB
        if mode == "bug":
            for agent_name, agent_result in [("Dev Front", dev_front_result), ("Dev Back", dev_back_result)]:
                escalade, details = _check_db_escalation(agent_result)
                if escalade:
                    pipeline_elapsed = time.time() - pipeline_start
                    update_story_phase(state, story_id, "escalated-db")
                    state["status"] = "escalated-db"
                    save_pipeline_state(state)
                    logger.error(f"\n{'═'*60}")
                    logger.error(f"PIPELINE {story_id} — ESCALADE DB REQUISE ({agent_name})")
                    logger.error(f"{'═'*60}")
                    logger.error(f"L'agent {agent_name} a déterminé qu'un changement de base de données")
                    logger.error(f"est nécessaire pour corriger ce bug.")
                    logger.error(f"")
                    logger.error(f"DÉTAILS :")
                    for line in details.splitlines():
                        logger.error(f"  {line}")
                    logger.error(f"")
                    logger.error(f"ACTION REQUISE : Intervention humaine pour valider/appliquer")
                    logger.error(f"la modification de schema, puis relancer le pipeline.")
                    logger.error(f"Durée : {_format_duration(pipeline_elapsed)}")
                    logger.error(f"{'═'*60}")
                    return False

        update_story_phase(state, story_id, "dev-parallel", phase_result="done")

    # --- Phase 4 + 5 : Tests + Boucle Sherlock ---
    sherlock_level = story_state.get("sherlock", {}).get("current_level", 0)
    iteration = 0

    while True:
        iteration += 1
        if iteration > 1:
            logger.info(f"\n{'▓'*60}")
            logger.info(f"ITERATION {iteration} — Sherlock L{sherlock_level} → Tests")
            logger.info(f"{'▓'*60}")

        # Phase 4 : Tests
        update_story_phase(state, story_id, "testing")
        test_results, tests_passed = await phase_run_tests(story_id, logger)

        if tests_passed:
            # DONE !
            pipeline_elapsed = time.time() - pipeline_start
            update_story_phase(state, story_id, "done")
            state["status"] = "done"
            save_pipeline_state(state)

            logger.info(f"\n{'═'*60}")
            logger.info(f"PIPELINE {story_id} — TERMINÉ AVEC SUCCÈS")
            logger.info(f"{'═'*60}")
            phase1_label = "Investigation" if mode == "bug" else "Front Minimal"
            phase2_label = "Phoenix Regr." if mode == "bug" else "Phoenix TDD"
            logger.info(f"  {phase1_label:16s}: OK")
            logger.info(f"  {phase2_label:16s}: OK")
            logger.info(f"  {'Dev parallèle':16s}: OK")
            logger.info(f"  {'Tests':16s}: PASS")
            logger.info(f"  {'Sherlock':16s}: {sherlock_level} itération(s)")
            logger.info(f"  {'Durée totale':16s}: {_format_duration(pipeline_elapsed)}")
            logger.info(f"{'═'*60}")
            return True

        # Tests échouent → Sherlock
        sherlock_level += 1

        if sherlock_level > MAX_SHERLOCK_LEVEL:
            pipeline_elapsed = time.time() - pipeline_start
            update_story_phase(state, story_id, "escalated")
            state["status"] = "escalated"
            save_pipeline_state(state)

            logger.error(f"\n{'═'*60}")
            logger.error(f"PIPELINE {story_id} — ESCALADE HUMAINE")
            logger.error(f"{'═'*60}")
            logger.error(f"Sherlock a épuisé ses {MAX_SHERLOCK_LEVEL} niveaux d'analyse.")
            logger.error(f"Rapport complet : US/{story_id}/sherlock-report.md")
            logger.error(f"Durée totale : {_format_duration(pipeline_elapsed)}")
            logger.error(f"{'═'*60}")
            return False

        # Phase 5 : Sherlock
        update_story_phase(state, story_id, "sherlock", sherlock_level=sherlock_level)
        sherlock_result = await phase_sherlock(
            story_id, story_content, test_results, sherlock_level, logger, mode=mode
        )

        # En mode bug, vérifier si Sherlock a détecté un besoin de changement DB
        if mode == "bug":
            escalade, details = _check_db_escalation(sherlock_result)
            if escalade:
                pipeline_elapsed = time.time() - pipeline_start
                update_story_phase(state, story_id, "escalated-db")
                state["status"] = "escalated-db"
                save_pipeline_state(state)
                logger.error(f"\n{'═'*60}")
                logger.error(f"PIPELINE {story_id} — ESCALADE DB REQUISE (Sherlock L{sherlock_level})")
                logger.error(f"{'═'*60}")
                logger.error(f"Sherlock a déterminé qu'un changement de base de données")
                logger.error(f"est nécessaire pour corriger ce bug.")
                logger.error(f"")
                logger.error(f"DÉTAILS :")
                for line in details.splitlines():
                    logger.error(f"  {line}")
                logger.error(f"")
                logger.error(f"ACTION REQUISE : Intervention humaine pour valider/appliquer")
                logger.error(f"la modification de schema, puis relancer le pipeline.")
                logger.error(f"Rapport : US/{story_id}/sherlock-report.md")
                logger.error(f"Durée : {_format_duration(pipeline_elapsed)}")
                logger.error(f"{'═'*60}")
                return False

        if sherlock_level >= MAX_SHERLOCK_LEVEL:
            pipeline_elapsed = time.time() - pipeline_start
            update_story_phase(state, story_id, "escalated")
            state["status"] = "escalated"
            save_pipeline_state(state)

            logger.error(f"\n{'═'*60}")
            logger.error(f"PIPELINE {story_id} — ESCALADE HUMAINE (Sherlock niveau {MAX_SHERLOCK_LEVEL})")
            logger.error(f"{'═'*60}")
            logger.error(f"Rapport complet : US/{story_id}/sherlock-report.md")
            logger.error(f"Durée totale : {_format_duration(pipeline_elapsed)}")
            return False

        # Relancer les devs avec le rapport Sherlock
        full_report = load_sherlock_report(story_id)
        fix_front, fix_back = await phase_dev_fix(
            story_id, story_content, tdd_result, full_report, logger, mode=mode
        )

        # En mode bug, vérifier si les devs ont détecté un besoin de changement DB après le fix
        if mode == "bug":
            for agent_name, agent_result in [("Fix Front", fix_front), ("Fix Back", fix_back)]:
                escalade, details = _check_db_escalation(agent_result)
                if escalade:
                    pipeline_elapsed = time.time() - pipeline_start
                    update_story_phase(state, story_id, "escalated-db")
                    state["status"] = "escalated-db"
                    save_pipeline_state(state)
                    logger.error(f"\n{'═'*60}")
                    logger.error(f"PIPELINE {story_id} — ESCALADE DB REQUISE ({agent_name})")
                    logger.error(f"{'═'*60}")
                    logger.error(f"L'agent {agent_name} a déterminé qu'un changement de base de données")
                    logger.error(f"est nécessaire pour corriger ce bug.")
                    logger.error(f"")
                    logger.error(f"DÉTAILS :")
                    for line in details.splitlines():
                        logger.error(f"  {line}")
                    logger.error(f"")
                    logger.error(f"ACTION REQUISE : Intervention humaine pour valider/appliquer")
                    logger.error(f"la modification de schema, puis relancer le pipeline.")
                    logger.error(f"Durée : {_format_duration(pipeline_elapsed)}")
                    logger.error(f"{'═'*60}")
                    return False

        logger.info(f"[BOUCLE] Retour aux tests après fix Sherlock L{sherlock_level}")


# --- Batch: Discovery & Sorting ---

def discover_stories() -> list[str]:
    """Découvre toutes les stories disponibles dans US/."""
    stories = []
    if US_DIR.exists():
        for d in sorted(US_DIR.iterdir()):
            if d.is_dir() and (d / f"{d.name}.md").exists():
                stories.append(d.name)
    return sorted(stories, key=_story_sort_key)


def _story_sort_key(story_id: str) -> tuple[int, int]:
    """Tri naturel : '1-2' → (1, 2), '10-3' → (10, 3)."""
    m = re.match(r"(\d+)-(\d+)", story_id)
    if m:
        return int(m.group(1)), int(m.group(2))
    return (999, 999)


def resolve_batch_target(target: str) -> list[str]:
    """Résout la cible batch en liste de story IDs.

    Formats supportés :
      'all'       → toutes les stories
      '2'         → toutes les stories de l'epic 2 (2-1, 2-2, ...)
      '2-1,2-3'   → stories spécifiques
      '2-5'       → stories 2-1 à 2-5
    """
    all_stories = discover_stories()

    if target == "all":
        return all_stories

    # Liste explicite : '2-1,2-3,3-1'
    if "," in target:
        requested = [s.strip() for s in target.split(",")]
        return [s for s in requested if s in all_stories]

    # Epic entier : '2' → toutes les stories 2-*
    if re.match(r"^\d+$", target):
        epic = target
        return [s for s in all_stories if s.startswith(f"{epic}-")]

    # Story unique : '2-1'
    if target in all_stories:
        return [target]

    print(f"Erreur : cible batch '{target}' non reconnue.")
    print(f"Stories disponibles : {', '.join(all_stories)}")
    return []


# --- Batch: Execution & Report ---

async def run_batch(
    stories: list[str],
    logger,
    skip_done: bool = False,
    mode: str = "feature",
) -> dict:
    """Exécute le pipeline pour une liste de stories séquentiellement.

    Returns:
        Dict avec les résultats de chaque story.
    """
    state = load_pipeline_state()
    results = {}
    batch_start = time.time()

    total = len(stories)
    logger.info(f"\n{'═'*60}")
    logger.info(f"BATCH PIPELINE — {total} stories (mode: {mode})")
    logger.info(f"{'═'*60}")
    logger.info(f"Stories : {', '.join(stories)}")
    if skip_done:
        logger.info(f"Mode : --skip-done (les stories 'done' seront sautées)")
    logger.info("")

    for i, story_id in enumerate(stories, 1):
        story_start = time.time()

        # Vérifier si déjà done
        story_state = state.get("stories", {}).get(story_id, {})
        if skip_done and story_state.get("status") == "done":
            elapsed = 0.0
            results[story_id] = {
                "status": "skipped",
                "sherlock": 0,
                "duration_s": 0,
                "reason": "déjà done",
            }
            logger.info(f"[{i}/{total}] {story_id} — SKIPPED (déjà done)")
            continue

        logger.info(f"\n{'▓'*60}")
        logger.info(f"[{i}/{total}] STORY {story_id}")
        logger.info(f"{'▓'*60}")

        # Reprendre si interrompu, sinon lancer depuis le début
        resume_from = story_id if story_state.get("status") not in ("", "done", "escalated") else None

        try:
            success = await run_pipeline(story_id, logger, resume_from=resume_from, mode=mode)
            elapsed = time.time() - story_start

            # Recharger l'état après le pipeline
            state = load_pipeline_state()
            sherlock_lvl = state.get("stories", {}).get(story_id, {}).get("sherlock", {}).get("current_level", 0)

            results[story_id] = {
                "status": "pass" if success else "fail",
                "sherlock": sherlock_lvl,
                "duration_s": elapsed,
            }

            status_str = "PASS" if success else "FAIL (escalade)"
            logger.info(f"[{i}/{total}] {story_id} — {status_str} ({_format_duration(elapsed)}, Sherlock L{sherlock_lvl})")

        except Exception as e:
            elapsed = time.time() - story_start
            results[story_id] = {
                "status": "error",
                "sherlock": 0,
                "duration_s": elapsed,
                "reason": str(e),
            }
            logger.error(f"[{i}/{total}] {story_id} — ERROR: {e}")

    batch_elapsed = time.time() - batch_start

    # Générer le rapport
    report_path = generate_batch_report(results, batch_elapsed, logger)

    # Résumé final
    passed = sum(1 for r in results.values() if r["status"] == "pass")
    failed = sum(1 for r in results.values() if r["status"] == "fail")
    errors = sum(1 for r in results.values() if r["status"] == "error")
    skipped = sum(1 for r in results.values() if r["status"] == "skipped")

    logger.info(f"\n{'═'*60}")
    logger.info(f"BATCH TERMINÉ — {len(stories)} stories en {_format_duration(batch_elapsed)}")
    logger.info(f"{'═'*60}")
    logger.info(f"  PASS    : {passed}")
    logger.info(f"  FAIL    : {failed}")
    logger.info(f"  ERROR   : {errors}")
    logger.info(f"  SKIPPED : {skipped}")
    logger.info(f"  Rapport : {report_path}")
    logger.info(f"{'═'*60}")

    return results


def generate_batch_report(results: dict, total_elapsed: float, logger) -> Path:
    """Génère un rapport markdown consolidé."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    report_path = BMAD_OUTPUT / f"batch-report-{timestamp}.md"
    report_path.parent.mkdir(parents=True, exist_ok=True)

    passed = sum(1 for r in results.values() if r["status"] == "pass")
    failed = sum(1 for r in results.values() if r["status"] == "fail")
    errors = sum(1 for r in results.values() if r["status"] == "error")
    skipped = sum(1 for r in results.values() if r["status"] == "skipped")
    total = len(results)

    lines = [
        f"# Rapport Batch Pipeline — {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        "",
        "## Résumé",
        "",
        f"| Métrique | Valeur |",
        f"|----------|--------|",
        f"| Stories traitées | {total} |",
        f"| PASS | {passed} |",
        f"| FAIL | {failed} |",
        f"| ERROR | {errors} |",
        f"| SKIPPED | {skipped} |",
        f"| Durée totale | {_format_duration(total_elapsed)} |",
        f"| Taux de réussite | {passed}/{total - skipped} ({_pct(passed, total - skipped)}) |",
        "",
        "## Détail par story",
        "",
        "| Story | Statut | Sherlock | Durée | Détail |",
        "|-------|--------|----------|-------|--------|",
    ]

    for story_id, r in results.items():
        status = r["status"]
        if status == "pass":
            status_icon = "PASS"
        elif status == "fail":
            status_icon = "FAIL"
        elif status == "skipped":
            status_icon = "SKIP"
        else:
            status_icon = "ERR"

        sherlock_str = f"L{r['sherlock']}" if r["sherlock"] > 0 else "—"
        duration_str = _format_duration(r["duration_s"]) if r["duration_s"] > 0 else "—"
        detail = r.get("reason", "")
        lines.append(f"| {story_id} | {status_icon} | {sherlock_str} | {duration_str} | {detail} |")

    # Section échecs détaillés
    failures = {k: v for k, v in results.items() if v["status"] in ("fail", "error")}
    if failures:
        lines.append("")
        lines.append("## Stories en échec")
        lines.append("")
        for story_id, r in failures.items():
            lines.append(f"### {story_id} — {r['status'].upper()}")
            if r.get("reason"):
                lines.append(f"**Raison** : {r['reason']}")
            sherlock_file = US_DIR / story_id / "sherlock-report.md"
            if sherlock_file.exists():
                lines.append(f"**Rapport Sherlock** : `US/{story_id}/sherlock-report.md`")
            lines.append("")
    else:
        lines.append("")
        lines.append("## Toutes les stories sont passées !")
        lines.append("")

    report_content = "\n".join(lines)
    report_path.write_text(report_content, encoding="utf-8")
    logger.info(f"[RAPPORT] Généré : {report_path}")
    return report_path


def _format_duration(seconds: float) -> str:
    """Formate une durée en 'Xm Ys'."""
    if seconds < 60:
        return f"{seconds:.0f}s"
    minutes = int(seconds // 60)
    secs = int(seconds % 60)
    return f"{minutes}m {secs:02d}s"


def _pct(n: int, total: int) -> str:
    """Pourcentage formaté."""
    if total == 0:
        return "—"
    return f"{n / total * 100:.0f}%"


# --- CLI ---

def show_status():
    """Affiche l'état du pipeline."""
    state = load_pipeline_state()
    stories = state.get("stories", {})

    if not stories:
        print("\nAucune story dans le pipeline.\n")
        return

    print(f"\nPipeline TDD+BMAD — État\n")
    print(f"{'Story':<25} {'Mode':<10} {'Phase':<18} {'Sherlock':<12} {'Mis à jour'}")
    print(f"{'─'*25} {'─'*10} {'─'*18} {'─'*12} {'─'*20}")

    for sid, s in stories.items():
        mode = s.get("mode", "feature")
        phase = s.get("status", "?")
        sherlock_lvl = s.get("sherlock", {}).get("current_level", 0)
        updated = s.get("updated_at", "?")[:16]
        sherlock_str = f"L{sherlock_lvl}/{MAX_SHERLOCK_LEVEL}" if sherlock_lvl > 0 else "—"
        print(f"{sid:<25} {mode:<10} {phase:<18} {sherlock_str:<12} {updated}")

    print()


async def main():
    parser = argparse.ArgumentParser(
        description="Pipeline TDD+BMAD (Méthode.md)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Exemples :
  python pipeline.py 1-1                    # Lancer une story (feature)
  python pipeline.py BUG-001 --bug          # Lancer en mode bug
  python pipeline.py --status               # Voir l'état
  python pipeline.py --resume BUG-001       # Reprendre (mode auto-détecté)
  python pipeline.py --batch all            # Lancer TOUTES les stories
  python pipeline.py --batch BUG-001,BUG-002 --bug  # Batch en mode bug
  python pipeline.py --batch all --skip-done  # Sauter les stories déjà terminées
        """,
    )
    parser.add_argument("story_id", nargs="?", help="ID de la story (ex: 1-1)")
    parser.add_argument("--bug", action="store_true",
        help="Bug mode: Investigation + regression tests au lieu de Facade + TDD")
    parser.add_argument("--status", action="store_true", help="Afficher l'état du pipeline")
    parser.add_argument("--resume", metavar="STORY", help="Reprendre une story interrompue")
    parser.add_argument("--batch", metavar="TARGET", help="Batch: 'all', epic number, or comma-separated story IDs")
    parser.add_argument("--skip-done", action="store_true", help="En mode batch, sauter les stories déjà done")

    args = parser.parse_args()

    if args.status:
        show_status()
        return

    mode = "bug" if args.bug else "feature"

    if args.batch:
        stories = resolve_batch_target(args.batch)
        if not stories:
            print("Aucune story trouvée pour cette cible.")
            return
        logger = setup_logging("batch", args.batch.replace(",", "_"))
        await run_batch(stories, logger, skip_done=args.skip_done, mode=mode)
        return

    if args.resume:
        logger = setup_logging("pipeline", args.resume)
        await run_pipeline(args.resume, logger, resume_from=args.resume, mode=mode)
        return

    if args.story_id:
        logger = setup_logging("pipeline", args.story_id)
        await run_pipeline(args.story_id, logger, mode=mode)
        return

    parser.print_help()


if __name__ == "__main__":
    asyncio.run(main())
