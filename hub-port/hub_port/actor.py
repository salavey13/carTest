"""Actor/correlation context — Python twin of carTest's connector contract.

Mirrors:
- ``lib/connectors/shared/errors.ts`` → ``ConnectorCallContext``
- ``lib/connectors/shared/http.ts``  → ``contextHeaders()``

The wire format is byte-identical so the hub's audit trail (connector_calls
grouped by correlationId) and the external-system headers stay uniform across
the TypeScript connectors (carTest / connectors-mcp) and the Python hub code:

    x-megarepo-actor:            "crew:413553377"
    x-megarepo-correlation-id:   "req:9f2c…"
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Mapping

ACTOR_HEADER = "x-megarepo-actor"
CORRELATION_HEADER = "x-megarepo-correlation-id"

# Same kinds as the TS ConnectorCallContext.
ACTOR_KINDS = ("crew", "admin", "system")


@dataclass(frozen=True)
class Actor:
    id: str
    kind: str = "crew"  # one of ACTOR_KINDS

    def header_value(self) -> str:
        return f"{self.kind}:{self.id}"


@dataclass(frozen=True)
class ConnectorCallContext:
    """Who initiated an external call, and under which trace id."""

    actor: Actor | None = None
    correlation_id: str | None = None


def new_correlation_id(prefix: str = "req") -> str:
    return f"{prefix}:{uuid.uuid4().hex[:12]}"


def actor_headers(context: ConnectorCallContext | None) -> dict[str, str]:
    """Headers to attach to outbound connector calls (TS ``contextHeaders``)."""
    headers: dict[str, str] = {}
    if context is None:
        return headers
    if context.actor is not None:
        headers[ACTOR_HEADER] = context.actor.header_value()
    if context.correlation_id:
        headers[CORRELATION_HEADER] = context.correlation_id
    return headers


def context_from_mapping(
    data: Mapping[str, object] | None,
    *,
    system_fallback: bool = True,
) -> ConnectorCallContext:
    """Best-effort context builder from untrusted input (MCP tool args, HTTP
    query, bot payloads). Never raises; falls back to a system actor so the
    audit trail can always name the source."""
    if not data:
        if system_fallback:
            return ConnectorCallContext(actor=Actor(id="system", kind="system"))
        return ConnectorCallContext()

    actor_raw = data.get("actor")
    actor: Actor | None = None
    if isinstance(actor_raw, Mapping):
        actor_id = str(actor_raw.get("id") or "").strip()
        kind = str(actor_raw.get("kind") or "crew").strip()
        if actor_id:
            actor = Actor(id=actor_id, kind=kind if kind in ACTOR_KINDS else "crew")

    correlation_raw = str(data.get("correlationId") or "").strip()
    if actor is None and not correlation_raw and system_fallback:
        actor = Actor(id="system", kind="system")

    return ConnectorCallContext(actor=actor, correlation_id=correlation_raw or None)
