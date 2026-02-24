"""Module partage : run_agent(), logging, YAML utils.

Reutilisable tel quel dans tous les projets BMAD.
"""

import logging
import re
from datetime import datetime
from pathlib import Path

import yaml

from claude_agent_sdk import query, ClaudeAgentOptions
from claude_agent_sdk._internal import message_parser, client as _sdk_client
from claude_agent_sdk._internal.message_parser import SystemMessage
from config import LOGS_DIR, MAX_AGENT_TURNS, PROJECT_ROOT


# --- Monkey-patch SDK: ignorer les types de messages inconnus (rate_limit_event, etc.) ---
_original_parse_message = message_parser.parse_message

def _patched_parse_message(data):
    """Wrapper qui retourne un SystemMessage neutre pour les types inconnus."""
    try:
        return _original_parse_message(data)
    except Exception as e:
        if "Unknown message type" in str(e):
            return SystemMessage(subtype="ignored", data=data)
        raise

# Patcher a la fois le module et la reference du client
message_parser.parse_message = _patched_parse_message
_sdk_client.parse_message = _patched_parse_message


# --- Logging ---

def setup_logging(prefix: str, suffix: str | None = None) -> logging.Logger:
    """Configure un logger avec fichier et console."""
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    suffix_str = f"_{suffix}" if suffix else ""
    log_file = LOGS_DIR / f"{prefix}_{timestamp}{suffix_str}.log"

    logger = logging.getLogger(prefix)
    logger.setLevel(logging.INFO)

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


# --- Tool call logging helpers ---

def _log_tool_call(logger: logging.Logger, agent_label: str, tool_name: str, tool_input: dict):
    """Log un appel d'outil de maniere lisible."""
    if tool_name == "Write":
        path = tool_input.get("file_path", "?")
        logger.info(f"  [{agent_label}] WRITE  {_short_path(path)}")
    elif tool_name == "Edit":
        path = tool_input.get("file_path", "?")
        old = (tool_input.get("old_string") or "")[:60].replace("\n", " ")
        logger.info(f"  [{agent_label}] EDIT   {_short_path(path)}  ({old}...)")
    elif tool_name == "Read":
        path = tool_input.get("file_path", "?")
        logger.info(f"  [{agent_label}] READ   {_short_path(path)}")
    elif tool_name == "Bash":
        cmd = (tool_input.get("command") or "")[:120].replace("\n", " ; ")
        logger.info(f"  [{agent_label}] BASH   {cmd}")
    elif tool_name == "Glob":
        pattern = tool_input.get("pattern", "?")
        logger.info(f"  [{agent_label}] GLOB   {pattern}")
    elif tool_name == "Grep":
        pattern = tool_input.get("pattern", "?")
        path = tool_input.get("path", ".")
        logger.info(f"  [{agent_label}] GREP   '{pattern}' in {_short_path(path)}")
    else:
        logger.info(f"  [{agent_label}] {tool_name}")


def _short_path(path: str) -> str:
    """Raccourcit un chemin absolu pour le rendre lisible."""
    root = str(PROJECT_ROOT)
    if path.startswith(root):
        return path[len(root):].lstrip("/")
    return path


# --- Agent Execution ---

async def run_agent(
    prompt: str,
    tools: list[str],
    logger: logging.Logger,
    max_turns: int | None = None,
    cwd: str | None = None,
    agent_label: str = "agent",
) -> str:
    """Lance un agent SDK et retourne le resultat textuel.

    Args:
        agent_label: Label court pour identifier l'agent dans les logs (ex: "front", "back", "sherlock")
    """
    result_parts = []
    tool_count = 0
    turn_count = 0

    async for msg in query(
        prompt=prompt,
        options=ClaudeAgentOptions(
            allowed_tools=tools,
            permission_mode="bypassPermissions",
            max_turns=max_turns or MAX_AGENT_TURNS,
            cwd=cwd or str(PROJECT_ROOT),
        ),
    ):
        # Log les appels d'outils en temps reel
        if hasattr(msg, "tool_use"):
            tool = msg.tool_use
            tool_name = getattr(tool, "name", None)
            tool_input = getattr(tool, "input", {}) or {}
            if tool_name:
                _log_tool_call(logger, agent_label, tool_name, tool_input)
                tool_count += 1
        elif hasattr(msg, "content"):
            content = msg.content
            if isinstance(content, list):
                for block in content:
                    # Log les tool_use dans les content blocks
                    if hasattr(block, "type") and block.type == "tool_use":
                        tool_name = getattr(block, "name", None)
                        tool_input = getattr(block, "input", {}) or {}
                        if tool_name:
                            _log_tool_call(logger, agent_label, tool_name, tool_input)
                            tool_count += 1
                    elif hasattr(block, "text"):
                        result_parts.append(block.text)
            elif isinstance(content, str):
                result_parts.append(content)
            turn_count += 1

        if hasattr(msg, "result"):
            result_parts.append(str(msg.result))

    logger.info(f"  [{agent_label}] Terminé — {tool_count} appels d'outils, {turn_count} tours")
    return "\n".join(result_parts)
