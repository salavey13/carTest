"""OpenCode sessions from the existing traversa bot — pure decision logic.

Facts this encodes (verified against Jeezzzy/traversa @ a7a629d):

- The hub ALREADY ships ``src/agents/runner.py``: a fail-closed *synchronous*
  runner for allowlisted OpenCode agents (``agents/opencode.json``), with a
  single-flight fcntl lock, timeout/token budgets and an ``AgentRun`` audit
  row. Two agents are staged: ``zayavka-assist``, ``norm-navigator``.
- The traversa Telegram bot is ALREADY configured on the VPS — no BotFather,
  no webhook setter work. The bot just needs one thin handler that calls the
  runner; this module is that handler's brain, transport-agnostic (no
  aiogram/python-telegram-bot imports), so it is unit-testable here and the
  VPS-side glue stays ~30 lines.

Command grammar (bot side, role-gated by ``authorize_command``):

    /agents                      → list allowlisted agents + who may run them
    /agent <name> <task text>    → run one agent synchronously, reply formatted
    /whoami                      → echo resolved crew identity + hub role

Because ``runner.py`` is synchronous, the VPS handler should execute
``build_agent_request`` in a worker thread/process and either poll the
AgentRun audit row or await the runner's return — bot commands MUST NOT
block the event loop. The single-flight lock means a second /agent while one
is running gets a polite refusal, not a queue.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Mapping

from .actor import Actor, ConnectorCallContext, new_correlation_id

# Budgets mirror runner.py's own defaults; the bot may tighten, never widen —
# runner.py is fail-closed and re-validates everything server-side.
DEFAULT_AGENT_TIMEOUT_S = 300
MAX_TASK_LENGTH = 2000

# Role gate. Hub roles (verified): admin / manager / engineer (+ viewer read-only).
# owners/admins from the crew side map to 'admin' via crew.HUB_ROLE_MAP.
AGENT_ROLE_MATRIX: dict[str, frozenset[str]] = {
    "zayavka-assist": frozenset({"admin", "manager", "engineer"}),
    "norm-navigator": frozenset({"admin", "manager", "engineer"}),
}
ADMIN_ONLY_COMMANDS = frozenset({"agents"})


@dataclass(frozen=True)
class BotCommand:
    name: str            # 'agent' | 'agents' | 'whoami'
    agent: str | None    # for /agent
    task: str | None     # for /agent
    raw: str


@dataclass(frozen=True)
class AgentRunRequest:
    """Shape handed to hub's runner (fields match runner.py's expectations)."""

    agent: str
    prompt: str
    timeout_s: int
    actor_id: str
    correlation_id: str
    context: ConnectorCallContext = field(default_factory=ConnectorCallContext)


@dataclass(frozen=True)
class Decision:
    allowed: bool
    reason: str | None = None


def parse_command(text: str | None) -> BotCommand | None:
    """/agent@BotName task → BotCommand('agent', None, 'task'). Bot-name
    suffixes are tolerated; unknown commands → None."""
    if not text or not text.startswith("/"):
        return None
    parts = text.strip().split(maxsplit=2)
    head = parts[0][1:].split("@", 1)[0].lower()
    if head == "agents":
        return BotCommand("agents", None, None, text)
    if head == "whoami":
        return BotCommand("whoami", None, None, text)
    if head == "agent":
        if len(parts) < 2:
            return BotCommand("agent", None, None, text)
        agent = parts[1].strip().lower()
        task = parts[2].strip() if len(parts) > 2 else ""
        return BotCommand("agent", agent or None, task or None, text)
    return None


def authorize_command(
    command: BotCommand,
    *,
    hub_role: str,
    is_owner: bool = False,
) -> Decision:
    """Role gate BEFORE anything touches the runner. Owners are admins."""
    effective = "admin" if is_owner else hub_role
    if command.name == "agents":
        allowed = effective in {"admin", "manager", "engineer"}
        return Decision(allowed, None if allowed else f"role '{effective}' cannot list agents")

    if command.name == "whoami":
        return Decision(True, None)

    if command.name == "agent":
        if not command.agent:
            return Decision(False, "usage: /agent <name> <task>")
        if not command.task:
            return Decision(False, "usage: /agent <name> <task text>")
        if len(command.task) > MAX_TASK_LENGTH:
            return Decision(False, f"task too long (max {MAX_TASK_LENGTH} chars)")
        allowlist = AGENT_ROLE_MATRIX.get(command.agent)
        if allowlist is None:
            return Decision(False, f"agent '{command.agent}' is not allowlisted")
        if effective not in allowlist:
            return Decision(
                False,
                f"agent '{command.agent}' requires one of: {', '.join(sorted(allowlist))}",
            )
        return Decision(True, None)

    return Decision(False, f"unknown command '{command.name}'")


def build_agent_request(
    command: BotCommand,
    *,
    actor_id: str,
    correlation_id: str | None = None,
    timeout_s: int = DEFAULT_AGENT_TIMEOUT_S,
) -> AgentRunRequest:
    """Shape the runner request; audit fields ride along (correlationId makes
    the bot-triggered run traceable in connector_calls + AgentRun)."""
    if command.name != "agent" or not command.agent or not command.task:
        raise ValueError("build_agent_request expects a parsed /agent command")
    corr = correlation_id or new_correlation_id("bot")
    return AgentRunRequest(
        agent=command.agent,
        prompt=command.task,
        timeout_s=max(1, min(int(timeout_s), DEFAULT_AGENT_TIMEOUT_S)),
        actor_id=str(actor_id),
        correlation_id=corr,
        context=ConnectorCallContext(
            actor=Actor(id=str(actor_id), kind="crew"),
            correlation_id=corr,
        ),
    )


def format_reply(
    *,
    command: BotCommand,
    agent_run: Mapping[str, object] | None = None,
    error: str | None = None,
    elapsed_s: float | None = None,
) -> str:
    """Turn a runner result (or refusal) into a Telegram-sized reply.
    Long outputs truncate with a pointer to the hub web UI (AgentRun page)."""
    if error:
        return f"✖ {error}"

    if command.name == "whoami":
        return "Identity resolved — see the hub profile page for details."

    if command.name == "agents":
        lines = ["Allowlisted agents:"]
        for name, roles in sorted(AGENT_ROLE_MATRIX.items()):
            lines.append(f"• /agent {name} <task> — roles: {', '.join(sorted(roles))}")
        lines.append("")
        lines.append("Runs are synchronous + single-flight; budgets are capped server-side.")
        return "\n".join(lines)

    if command.name == "agent" and agent_run is not None:
        corr = str(agent_run.get("correlation_id", ""))
        output = str(agent_run.get("output", ""))
        status = str(agent_run.get("status", "ok"))
        took = f" · {elapsed_s:.1f}s" if elapsed_s is not None else ""
        head = f"◆ {command.agent} — {status}{took}"
        if len(output) > 3000:
            output = output[:2950] + "…\n(full output: hub → AgentRun " + corr + ")"
        tail = f"\ncorr: {corr}" if corr else ""
        return f"{head}\n\n{output}{tail}"

    return "Nothing to report."
