# workspace/.claude/README.md

This directory holds Claude Code configuration for the bot instance deployed on a client VPS.

## settings.json

`settings.json` controls which MCP (Model Context Protocol) servers Claude Code has access to.
It is **generated automatically** during provisioning via `scripts/seed-mcp-settings.sh` --
never edit it by hand on the VPS; use the seeder to regenerate.

### MCP servers in settings.template.json

| Server | Type | Requires | What it provides |
|--------|------|----------|-----------------|
| `notionApi` | stdio (npx) | `NOTION_TOKEN` | Read/write Notion pages and databases |
| `playwright` | stdio (npx) | -- | Headless browser: screenshots, web scraping |
| `zai-vision` | stdio (npx) | `Z_AI_API_KEY` | Z.AI image generation and vision |
| `zai-search` | http | `Z_AI_API_KEY` | Web search via Z.AI |
| `zai-reader` | http | `Z_AI_API_KEY` | Web page reader via Z.AI |
| `kie-ai` | stdio (node) | `KIE_API_KEY` | Kie.ai image/video/avatar generation (local plugin) |

Servers whose required env vars are absent in `tenants/<slug>/.env` are **automatically omitted**
from the generated file. The bot starts fine without them; it just loses those capabilities.

### Composio MCP — отдельно

Composio MCP **не входит** в `settings.template.json` потому что это **per-user HTTP remote endpoint**
(`https://backend.composio.dev/tool_router/trs_XXX/mcp`), а не общий шаблон. URL генерируется через
`@composio/core` SDK однократно на пару `(COMPOSIO_API_KEY, COMPOSIO_USER_ID)` и прописывается
в `/home/claudeclaw/.claude.json` (per-user конфиг Claude CLI), а не в `~/.claude/settings.json`
(per-project конфиг).

Установка делается автоматически в `scripts/bootstrap-vps.sh` ШАГ 7.6 если `COMPOSIO_API_KEY`
задан в `tenants/<slug>/.env`. Шаблон самого bootstrap-скрипта — `scripts/composio-bootstrap-template/`.
Пропустить шаг: `SKIP_COMPOSIO_MCP=1`.

## Regenerating settings.json

Run from the project root on the ops machine (where tenants/ lives):

```bash
bash scripts/seed-mcp-settings.sh --slug=<tenant-slug> [--target-user=claudeclaw]
```

The script backs up the existing file as `settings.json.bak.<timestamp>` before overwriting.

## Adding a custom MCP server

1. Add the server entry to `workspace/.claude/settings.template.json` using `${YOUR_VAR}` for any secrets.
2. Add `YOUR_VAR=<value>` to `tenants/<slug>/.env`.
3. Re-run the seeder.

Example entry (stdio server):

```json
"my-server": {
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "my-mcp-package"],
  "env": {
    "MY_SECRET": "${MY_SECRET_VAR}"
  }
}
```

Example entry (HTTP server with auth header):

```json
"my-api": {
  "type": "http",
  "url": "https://example.com/mcp",
  "headers": {
    "Authorization": "Bearer ${MY_API_KEY}"
  }
}
```

## File permissions

The seeder sets `chmod 600` and `chown <user>:<user>` on the generated file because it contains
API keys. Do not widen permissions.
