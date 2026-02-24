"""Configuration pour l'orchestrateur dev-sprint et le pipeline TDD+BMAD.

IMPORTANT: Lancez setup.sh a la racine du projet pour configurer automatiquement,
ou modifiez les valeurs ci-dessous manuellement.
"""

from pathlib import Path

# === A CONFIGURER ===
# Le setup.sh remplace automatiquement ces valeurs
PROJECT_ROOT = Path("__PROJECT_ROOT__")  # Ex: Path("/home/user/projects/mon-app")

# === Chemins derives (ne pas modifier) ===
BMAD_OUTPUT = PROJECT_ROOT / "_bmad-output"
SPRINT_STATUS = BMAD_OUTPUT / "sprint-status.yaml"
STORIES_DIR = PROJECT_ROOT / "US"
REVIEWS_DIR = BMAD_OUTPUT / "reviews"
LOGS_DIR = PROJECT_ROOT / ".claude" / "scripts" / "logs"

# Pipeline TDD+BMAD
US_DIR = STORIES_DIR
PIPELINE_STATE = BMAD_OUTPUT / "pipeline-state.yaml"
MAX_SHERLOCK_LEVEL = 4
BUG_INVESTIGATION_REPORT = "investigation-report.md"

# Limites
MAX_FIX_ITERATIONS = 3
MAX_AGENT_TURNS = 200

# Modeles Claude
DEFAULT_MODEL = "claude-sonnet-4-5-20250929"
REVIEW_MODEL = "claude-opus-4-6"
