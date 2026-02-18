"""Configuration pour l'orchestrateur dev-sprint et le pipeline TDD+BMAD."""

from pathlib import Path

# Chemins
PROJECT_ROOT = Path("/home/thibaut/Bureau/testApp")
BMAD_OUTPUT = PROJECT_ROOT / "_bmad-output"
SPRINT_STATUS = BMAD_OUTPUT / "sprint-status.yaml"
STORIES_DIR = PROJECT_ROOT / "US"  # Toutes les stories sont dans US/{story_id}/{story_id}.md
REVIEWS_DIR = BMAD_OUTPUT / "reviews"
LOGS_DIR = PROJECT_ROOT / ".claude" / "scripts" / "logs"

# Pipeline TDD+BMAD (alias pour clarté)
US_DIR = STORIES_DIR
PIPELINE_STATE = BMAD_OUTPUT / "pipeline-state.yaml"
MAX_SHERLOCK_LEVEL = 4

# Limites
MAX_FIX_ITERATIONS = 3
MAX_AGENT_TURNS = 200

# Modeles
DEFAULT_MODEL = "claude-sonnet-4-5-20250929"
REVIEW_MODEL = "claude-opus-4-6"
