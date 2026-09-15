"""Tests for the dirty-way Supabase crew registry (fake fetch, no network)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest  # noqa: E402

from hub_port.crew import (  # noqa: E402
    CrewRegistryError,
    SupabaseCrewRegistry,
    map_hub_role,
)

SERVICE_KEY = "test-service-role-key"
BASE_URL = "https://stub.supabase.co"


class FakePostgrest:
    """Routes URLs to canned rows; counts calls; can be made to fail."""

    def __init__(self):
        self.calls: list[str] = []
        self.fail = False

    def __call__(self, url: str, headers: dict) -> str:
        self.calls.append(url)
        if self.fail:
            raise CrewRegistryError("HTTP_ERROR", "supabase down (test)")
        assert headers["apikey"] == SERVICE_KEY
        assert headers["Authorization"] == f"Bearer {SERVICE_KEY}"
        if "/crew_members?" in url:
            assert "membership_status=eq.active" in url
            return json.dumps(
                [{"crew_id": "crew-1", "role": "member", "membership_status": "active"}]
            )
        if "/crews?" in url:
            return json.dumps(
                [
                    {
                        "id": "crew-1",
                        "slug": "alpha",
                        "name": "Alpha Crew",
                        "owner_id": "413553377",
                        "metadata": {"city": "MSK"},
                    }
                ]
            )
        raise AssertionError(f"unexpected url {url}")


def make_registry(fetch, ttl_s=60.0, clock=lambda: 1000.0):
    return SupabaseCrewRegistry(
        BASE_URL, SERVICE_KEY, fetch=fetch, ttl_s=ttl_s, clock=clock
    )


class TestResolution:
    def test_active_member_resolved_and_role_mapped(self):
        fetch = FakePostgrest()
        registry = make_registry(fetch)
        membership = registry.membership_for(413553377)
        assert membership is not None
        assert membership.crew_slug == "alpha"
        assert membership.crew_name == "Alpha Crew"
        assert membership.role == "member"  # raw crew_members.role (owner is tracked via crews.owner_id)
        assert membership.hub_role == "admin"  # ownership maps to admin
        assert membership.is_owner is True
        assert membership.actor().header_value() == "crew:413553377"

    def test_pending_membership_is_none(self):
        # the registry queries membership_status=eq.active, so 'pending' rows
        # never arrive (the filter is server-side); emulate an empty result:
        def fetch(url, headers):
            if "/crew_members?" in url:
                return "[]"
            raise AssertionError("no crew lookup expected")

        registry = make_registry(fetch)
        assert registry.membership_for(999) is None

    def test_plain_member_maps_to_engineer(self):
        def fetch(url, headers):
            if "/crew_members?" in url:
                return json.dumps(
                    [{"crew_id": "c2", "role": "member", "membership_status": "active"}]
                )
            return json.dumps(
                [
                    {
                        "id": "c2",
                        "slug": "beta",
                        "name": "Beta",
                        "owner_id": "111",
                        "metadata": {},
                    }
                ]
            )

        registry = make_registry(fetch)
        membership = registry.membership_for("222")
        assert membership.role == "member"
        assert membership.hub_role == "engineer"
        assert membership.is_owner is False


class TestCache:
    def test_ttl_cache_serves_without_refetch(self):
        fetch = FakePostgrest()
        now = [1000.0]
        registry = make_registry(fetch, ttl_s=60.0, clock=lambda: now[0])
        registry.membership_for("413553377")
        calls_after_first = len(fetch.calls)
        registry.membership_for("413553377")
        assert len(fetch.calls) == calls_after_first  # cache hit

        now[0] += 61.0  # TTL expired → refetch
        registry.membership_for("413553377")
        assert len(fetch.calls) > calls_after_first

    def test_stale_on_error_returns_last_known_good(self):
        fetch = FakePostgrest()
        now = [1000.0]
        registry = make_registry(fetch, ttl_s=10.0, clock=lambda: now[0])
        first = registry.membership_for("413553377")
        now[0] += 11.0  # expire
        fetch.fail = True
        second = registry.membership_for("413553377")
        assert second is not None and second.crew_slug == first.crew_slug

    def test_error_without_cache_raises(self):
        fetch = FakePostgrest()
        fetch.fail = True
        registry = make_registry(fetch)
        with pytest.raises(CrewRegistryError) as excinfo:
            registry.membership_for("413553377")
        assert excinfo.value.code == "HTTP_ERROR"

    def test_missing_config_raises(self):
        registry = SupabaseCrewRegistry("", "", fetch=lambda url, h: "[]")
        with pytest.raises(CrewRegistryError) as excinfo:
            registry.membership_for("1")
        assert excinfo.value.code == "MISSING_CONFIG"

    def test_non_json_response_is_parse_error(self):
        registry = SupabaseCrewRegistry(
            BASE_URL,
            SERVICE_KEY,
            fetch=lambda url, h: "<html>gateway error</html>",
        )
        with pytest.raises(CrewRegistryError) as excinfo:
            registry.membership_for("1")
        assert excinfo.value.code == "PARSE_ERROR"


class TestRoleMap:
    def test_mapping_table(self):
        assert map_hub_role("owner") == "admin"
        assert map_hub_role("admin") == "admin"
        assert map_hub_role("manager") == "manager"
        assert map_hub_role("member") == "engineer"
        assert map_hub_role("worker") == "engineer"
        assert map_hub_role("viewer") == "viewer"

    def test_owner_flag_overrides(self):
        assert map_hub_role("member", is_owner=True) == "admin"

    def test_unknown_role_falls_back(self):
        assert map_hub_role("captain") == "engineer"
        assert map_hub_role(None) == "engineer"
