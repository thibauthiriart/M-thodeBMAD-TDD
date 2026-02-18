"""Module partagé : run_agent(), logging, YAML utils.

Extrait de dev_sprint.py pour être réutilisé par pipeline.py et d'autres orchestrateurs.
"""

import logging
from datetime import datetime
from pathlib import Path

import yaml

from claude_agent_sdk import query, ClaudeAgentOptions
from config import LOGS_DIR, MAX_AGENT_TURNS, PROJECT_ROOT


# --- Logging ---

def setup_logging(prefix: str, suffix: str | None = None) -> logging.Logger:
    """Configure un logger avec fichier et console.

    Args:
        prefix: Préfixe du logger et du fichier (ex: "dev_sprint", "pipeline").
        suffix: Suffixe optionnel pour le nom de fichier (ex: story_id).
    """
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    suffix_str = f"_{suffix}" if suffix else ""
    log_file = LOGS_DIR / f"{prefix}_{timestamp}{suffix_str}.log"

    logger = logging.getLogger(prefix)
    logger.setLevel(logging.INFO)

    # Éviter les handlers dupliqués si le logger existe déjà
    if not logger.handlers:
        file_handler = logging.FileHandler(log_file, encoding="utf-8")
        file_handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
        logger.addHandler(file_handler)

        console_handler = logging.StreamHandler()
        console_handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
        logger.addHandler(console_handler)

    logger.info(f"Logs: {log_file}")
    return logger


# --- YAML Utils ---

def load_yaml(path: Path) -> dict:
    """Charge un fichier YAML."""
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def save_yaml(path: Path, data: dict):
    """Sauvegarde un dict en YAML."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        yaml.dump(data, f, default_flow_style=False, allow_unicode=True, sort_keys=False)


# --- Agent Execution ---

async def run_agent(
    prompt: str,
    tools: list[str],
    logger: logging.Logger,
    max_turns: int | None = None,
    cwd: str | None = None,
) -> str:
    """Lance un agent SDK et retourne le résultat textuel.

    Args:
        prompt: Le prompt à envoyer à l'agent.
        tools: Liste des outils autorisés.
        logger: Logger pour les traces.
        max_turns: Nombre max de tours (défaut: MAX_AGENT_TURNS).
        cwd: Répertoire de travail (défaut: PROJECT_ROOT).
    """
    result_parts = []

    async for msg in query(
        prompt=prompt,
        options=ClaudeAgentOptions(
            allowed_tools=tools,
            permission_mode="bypassPermissions",
            max_turns=max_turns or MAX_AGENT_TURNS,
            cwd=cwd or str(PROJECT_ROOT),
        ),
    ):
        if hasattr(msg, "result"):
            result_parts.append(str(msg.result))
        elif hasattr(msg, "content"):
            content = msg.content
            if isinstance(content, list):
                for block in content:
                    if hasattr(block, "text"):
                        result_parts.append(block.text)
            elif isinstance(content, str):
                result_parts.append(content)

    return "\n".join(result_parts)
