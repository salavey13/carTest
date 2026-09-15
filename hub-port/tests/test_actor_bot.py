"""Tests for actor headers + bot command decision logic."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from hub_port.actor import (  # noqa: E402
    ACTOR_HEADER,
    CORRELATION_HEADER,
    Actor,
    ConnectorCallContext,
    actor_headers,
    context_from_mapping,
    new_correlation_id,
)
from hub_port.bot_commands import (  # noqa: E402
    AgentRunRequest,
    authorize_command,
    build_agent_request,
    format_reply,
    parse_command,
)


class TestActorHeaders:
    def test_wire_format_matches_ts_connectors(self):
        context = ConnectorCallContext(
            actor=Actor(id="413553377", kind="crew"),
            correlation_id="req:abc123",
        )
        headers = actor_headers(context)
        assert headers[ACTOR_HEADER] == "crew:413553377"
        assert headers[CORRELATION_HEADER] == "req:abc123"

    def test_none_context_no_headers(self):
        assert actor_headers(None) == {}
        assert actor_headers(ConnectorCallContext()) == {}

    def test_correlation_prefix(self):
        corr = new_correlation_id("bot")
        assert corr.startswith("bot:")
        assert 8 <= len(corr) <= 24

    def test_context_from_untrusted_mapping(self):
        context = context_from_mapping(
            {"actor": {"id": "u1", "kind": "crew"}, "correlationId": "req:x"}
        )
        assert context.actor is not None and context.actor.id == "u1"
        assert context.correlation_id == "req:x"

    def test_context_falls_back_to_system(self):
        context = context_from_mapping(None)
        assert context.actor is not None
        assert context.actor.kind == "system"

    def test_context_never_raises_on_garbage(self):
        context = context_from_mapping({"actor": "not-a-dict", 42: object()})
        assert context.correlation_id is None


class TestParseCommand:
    def test_agent_with_task(self):
        cmd = parse_command("/agent zayavka-assist Check ТМ-63 stock for Сочи")
        assert cmd is not None
        assert cmd.name == "agent"
        assert cmd.agent == "zayavka-assist"
        assert cmd.task == "Check ТМ-63 stock for Сочи"

    def test_bot_suffix_tolerated(self):
        cmd = parse_command("/agents@traversa_bot")
        assert cmd is not None and cmd.name == "agents"

    def test_agent_without_task_is_usage_error(self):
        cmd = parse_command("/agent zayavka-assist")
        assert cmd is not None and cmd.task is None

    def test_unknown_and_non_commands(self):
        assert parse_command("hello") is None
        assert parse_command("/start") is None


class TestAuthorize:
    def test_engineer_may_run_staged_agent(self):
        cmd = parse_command("/agent zayavka-assist Find analogs")
        decision = authorize_command(cmd, hub_role="engineer")
        assert decision.allowed is True

    def test_viewer_may_not(self):
        cmd = parse_command("/agent zayavka-assist Find analogs")
        decision = authorize_command(cmd, hub_role="viewer")
        assert decision.allowed is False

    def test_unknown_agent_refused(self):
        cmd = parse_command("/agent shell-exec rm -rf /")
        decision = authorize_command(cmd, hub_role="admin")
        assert decision.allowed is False
        assert "allowlisted" in decision.reason

    def test_owner_bypasses_to_admin(self):
        cmd = parse_command("/agent norm-navigator Check norms")
        decision = authorize_command(cmd, hub_role="engineer", is_owner=True)
        assert decision.allowed is True

    def test_usage_errors(self):
        empty_task = parse_command("/agent zayavka-assist")
        assert authorize_command(empty_task, hub_role="admin").allowed is False
        long_task = parse_command(f"/agent zayavka-assist {'x' * 3000}")
        assert authorize_command(long_task, hub_role="admin").allowed is False


class TestRequestBuilding:
    def test_request_shape(self):
        cmd = parse_command("/agent zayavka-assist Check stock")
        request = build_agent_request(cmd, actor_id="413553377")
        assert isinstance(request, AgentRunRequest)
        assert request.agent == "zayavka-assist"
        assert request.prompt == "Check stock"
        assert request.actor_id == "413553377"
        assert request.correlation_id.startswith("bot:")
        assert request.context.actor.kind == "crew"
        assert request.context.correlation_id == request.correlation_id

    def test_timeout_never_exceeds_default(self):
        cmd = parse_command("/agent zayavka-assist Check stock")
        request = build_agent_request(cmd, actor_id="1", timeout_s=999999)
        assert request.timeout_s == 300

    def test_rejects_non_agent_commands(self):
        cmd = parse_command("/whoami")
        try:
            build_agent_request(cmd, actor_id="1")
        except ValueError:
            return
        raise AssertionError("expected ValueError")


class TestReplies:
    def test_refusal(self):
        assert format_reply(command=parse_command("/whoami"), error="no crew").startswith("✖")

    def test_agents_listing(self):
        text = format_reply(command=parse_command("/agents"))
        assert "zayavka-assist" in text and "norm-navigator" in text

    def test_run_reply_truncates_long_output(self):
        cmd = parse_command("/agent zayavka-assist Do things")
        text = format_reply(
            command=cmd,
            agent_run={
                "status": "ok",
                "output": "y" * 5000,
                "correlation_id": "bot:abc",
            },
            elapsed_s=12.3,
        )
        assert len(text) < 4000
        assert "bot:abc" in text
        assert "AgentRun" in text
