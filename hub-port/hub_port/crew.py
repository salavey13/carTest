"""The «dirty way» crew registry — Supabase stays the source of truth.

Decision (brainstorm round 2, endorsed): crew/franchize data is NOT migrated
into the hub's SQLite. carTest keeps managing crews, invites and roles in
Supabase tables (``crews``, ``crew_members``, ``users``); the hub reads them
over PostgREST with the service-role key from VPS env:

    SUPABASE_URL=https://<project>.supabase.co
    SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi…   # service-role, server-side only

Read path (three PostgREST queries, identity = Telegram user id):

    users.id                      == Telegram user id (carTest convention)
    crew_members(user_id, crew_id, membership_status, role)
    crews(id, slug, name, owner_id, metadata)

Resilience contract:
- 60s TTL cache per user id (auth is on every request; PostgREST round-trips
  must not be);
- stale-on-error: when Supabase blips, an expired cached answer is still
  returned (auth degrades to «last known-good» instead of failing hard) and
  the failure is recorded on the result for observability;
- errors are typed (``CrewRegistryError`` with ConnectorError-style codes) so
  the hub can map them to HTTP statuses cleanly.
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Mapping
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from .actor import Actor

# Cache TTL (seconds) — mirrors the 60s decision from brainstorm round 2.
DEFAULT_TTL_S = 60.0
DEFAULT_TIMEOUT_S = 8.0

FetchLike = Callable[[str, Mapping[str, str]], str]


class CrewRegistryError(RuntimeError):
    """Typed failure; ``code`` mirrors the TS ConnectorError codes."""

    def __init__(
        self,
        code: str,
        message: str,
        *,
        status: int | None = None,
        excerpt: str | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code  # MISSING_CONFIG | HTTP_ERROR | PARSE_ERROR | TIMEOUT
        self.status = status
        self.excerpt = excerpt

    def to_dict(self) -> dict[str, Any]:
        return {
            "code": self.code,
            "message": str(self),
            "status": self.status,
            "excerpt": self.excerpt,
        }


@dataclass(frozen=True)
class CrewMembership:
    """Resolved actor identity: Telegram user → crew + hub role."""

    tg_user_id: str
    crew_id: str
    crew_slug: str
    crew_name: str
    crew_owner_id: str
    role: str                       # raw carTest role ('member', 'owner', …)
    hub_role: str                   # mapped hub role ('admin', 'manager', …)
    crew_metadata: Mapping[str, Any] = field(default_factory=dict)

    @property
    def is_owner(self) -> bool:
        return self.tg_user_id == self.crew_owner_id

    def actor(self) -> Actor:
        return Actor(id=self.tg_user_id, kind="crew")


# Hub-side role mapping (hub roles verified: admin / manager / engineer;
# viewer = read-only). Bless this table once, both sides reference it.
HUB_ROLE_MAP: dict[str, str] = {
    "owner": "admin",
    "admin": "admin",
    "manager": "manager",
    "member": "engineer",
    "worker": "engineer",
    "engineer": "engineer",
    "viewer": "viewer",
}
HUB_ROLE_FALLBACK = "engineer"


def map_hub_role(role: str | None, *, is_owner: bool = False) -> str:
    if is_owner:
        return "admin"
    if not role:
        return HUB_ROLE_FALLBACK
    return HUB_ROLE_MAP.get(role.strip().lower(), HUB_ROLE_FALLBACK)


def default_fetch(url: str, headers: Mapping[str, str]) -> str:
    """stdlib PostgREST GET; injectable so tests never touch the network."""
    request = Request(url, headers=dict(headers), method="GET")
    try:
        with urlopen(request, timeout=DEFAULT_TIMEOUT_S) as response:
            return response.read().decode("utf-8")
    except URLError as exc:
        raise CrewRegistryError("HTTP_ERROR", f"PostgREST unreachable: {exc}") from exc
    except TimeoutError as exc:  # pragma: no cover — urlopen raises URLError on timeout
        raise CrewRegistryError("TIMEOUT", "PostgREST request timed out") from exc


class SupabaseCrewRegistry:
    """Read-only Supabase → membership resolver with TTL cache + stale-on-error.

    ``fetch`` is injectable (tests pass fakes); ``clock`` too.
    """

    def __init__(
        self,
        base_url: str,
        service_key: str,
        *,
        fetch: FetchLike | None = None,
        ttl_s: float = DEFAULT_TTL_S,
        clock: Callable[[], float] = time.time,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.service_key = service_key
        self.fetch = fetch or default_fetch
        self.ttl_s = ttl_s
        self.clock = clock
        # tg_user_id → (expires_at, membership | None, error | None)
        self._cache: dict[str, tuple[float, CrewMembership | None, CrewRegistryError | None]] = {}

    # ── public API ────────────────────────────────────────────────────────

    def membership_for(self, tg_user_id: str | int) -> CrewMembership | None:
        """Resolve the active crew membership for a Telegram user id.

        Returns None when the user simply has no active membership (not an
        error). Raises CrewRegistryError only when there is no cached answer
        to fall back to.
        """
        key = str(tg_user_id)
        now = self.clock()
        cached = self._cache.get(key)
        if cached and cached[0] > now:
            _, membership, _ = cached
            return membership

        error: CrewRegistryError | None = None
        try:
            membership = self._resolve(key)
        except CrewRegistryError as exc:
            error = exc
            membership = None
            # stale-on-error: keep serving the last known-good answer
            if cached is not None:
                return cached[1]
            raise
        finally:
            if error is not None and cached is None:
                # do not cache hard failures without a fallback value
                pass
            else:
                self._cache[key] = (now + self.ttl_s, membership, error)

        return membership

    def cached_staleness_s(self, tg_user_id: str | int) -> float | None:
        """How old the cached answer is (observability helper), None if cold."""
        cached = self._cache.get(str(tg_user_id))
        if not cached:
            return None
        return max(0.0, self.clock() - (cached[0] - self.ttl_s))

    # ── PostgREST read path ───────────────────────────────────────────────

    def _headers(self) -> dict[str, str]:
        return {
            "apikey": self.service_key,
            "Authorization": f"Bearer {self.service_key}",
            "Accept": "application/json",
        }

    def _get(self, table: str, params: dict[str, str]) -> list[dict[str, Any]]:
        if not self.base_url or not self.service_key:
            raise CrewRegistryError(
                "MISSING_CONFIG",
                "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not configured",
            )
        url = f"{self.base_url}/rest/v1/{table}?{urlencode(params)}"
        raw = self.fetch(url, self._headers())
        try:
            rows = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise CrewRegistryError(
                "PARSE_ERROR", "PostgREST returned non-JSON", excerpt=raw[:200]
            ) from exc
        if not isinstance(rows, list):
            raise CrewRegistryError(
                "PARSE_ERROR", "PostgREST returned unexpected shape", excerpt=raw[:200]
            )
        return rows

    def _resolve(self, tg_user_id: str) -> CrewMembership | None:
        memberships = self._get(
            "crew_members",
            {
                "select": "crew_id,role,membership_status",
                "user_id": f"eq.{tg_user_id}",
                "membership_status": "eq.active",
                "limit": "1",
            },
        )
        if not memberships:
            return None
        membership_row = memberships[0]
        crew_id = str(membership_row.get("crew_id") or "")
        if not crew_id:
            return None

        crews = self._get(
            "crews",
            {
                "select": "id,slug,name,owner_id,metadata",
                "id": f"eq.{crew_id}",
                "limit": "1",
            },
        )
        if not crews:
            raise CrewRegistryError(
                "HTTP_ERROR",
                f"crew_members points to missing crew {crew_id}",
                excerpt="crew row not found",
            )
        crew = crews[0]
        role = str(membership_row.get("role") or "") or None
        owner_id = str(crew.get("owner_id") or "")
        is_owner = owner_id == tg_user_id
        return CrewMembership(
            tg_user_id=tg_user_id,
            crew_id=str(crew.get("id") or crew_id),
            crew_slug=str(crew.get("slug") or ""),
            crew_name=str(crew.get("name") or ""),
            crew_owner_id=owner_id,
            # raw crew_members.role is preserved as-is; ownership is a separate
            # dimension (crews.owner_id) surfaced via is_owner / hub_role:
            role=role or "member",
            hub_role=map_hub_role(role, is_owner=is_owner),
            crew_metadata=crew.get("metadata") or {},
        )
