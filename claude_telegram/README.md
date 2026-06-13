# Claude Telegram Bot v2

Production-ready Telegram bot that connects to Claude CLI.

## Features

- ✅ **Async throughout** - Uses `httpx` instead of blocking `requests`
- 🔒 **Webhook secret verification** - Prevents unauthorized webhook calls
- ⏱️ **Claude timeout protection** - Kills runaway processes
- 🚀 **Background processing** - Returns immediately to Telegram
- 🔐 **Per-chat locks** - Prevents concurrent Claude calls per user
- ✍️ **Typing indicator** - Shows "typing..." while Claude thinks
- 📝 **Message splitting** - Handles responses longer than 4096 chars
- 🛡️ **Prompt length limits** - Prevents DoS via long prompts
- 🪵 **Structured logging** - Proper logging with levels
- 🌍 **Cross-platform** - Works on Windows (`claude.cmd`) and Linux (`claude`)

## Quick Start

### 1. Install Dependencies

```bash
cd claude_telegram
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your values
```

Required in `.env`:
- `TELEGRAM_TOKEN` - From [@BotFather](https://t.me/BotFather)
- `ALLOWED_CHAT_IDS` - Comma-separated list of authorized chat IDs
- `WEBHOOK_SECRET` - Random string for webhook verification

### 3. Run the Bot

```bash
# Local development (requires ngrok or similar for webhooks)
python app.py

# Or with uvicorn directly
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

## Setting Up Webhook

### With Ngrok (Local Testing)

```bash
# Start ngrok
ngrok http 8000

# Set webhook (replace with your ngrok URL and secret)
curl "https://api.telegram.org/bot$TELEGRAM_TOKEN/setWebhook?url=https://xxxx.ngrok.io/api/telegramWebhook&secret_token=your_secret"
```

### On VPS

```bash
# Set webhook to your domain
curl "https://api.telegram.org/bot$TELEGRAM_TOKEN/setWebhook?url=https://your-domain.com/api/telegramWebhook&secret_token=your_secret"

# Check current webhook
curl "https://api.telegram.org/bot$TELEGRAM_TOKEN/getWebhookInfo"
```

## Project Structure

```
claude_telegram/
├── app.py                 # Main FastAPI application
├── config.py              # Configuration loading
├── requirements.txt       # Python dependencies
├── .env.example           # Environment variables template
├── services/
│   ├── __init__.py
│   ├── security.py        # Webhook verification, auth
│   ├── telegram.py        # Telegram API client
│   └── claude.py          # Claude CLI service
└── README.md
```

## Architecture Decisions

### Background Processing

The webhook returns `200 OK` immediately and processes Claude in background. This prevents:

- Telegram timeout errors
- Duplicate message delivery retries
- Blocking the event loop

```python
asyncio.create_task(process_message(chat_id, user_text))
return {"ok": True}
```

### Per-Chat Locks

Each chat has its own `asyncio.Lock` to prevent concurrent Claude calls:

```python
chat_locks: Dict[int, asyncio.Lock] = {}
```

This prevents:
- Resource exhaustion from rapid messages
- Claude CLI conflicts

### httpx Over requests

All Telegram API calls use `httpx.AsyncClient`:
- Non-blocking I/O
- Connection pooling
- Proper async context management

### Message Splitting

Long Claude responses are split intelligently:
- Tries to split at newlines first
- Falls back to character limit if no good newline
- Sends multiple messages to Telegram

## Security Checklist

Before deploying to production:

- [ ] Set strong `WEBHOOK_SECRET`
- [ ] Configure `ALLOWED_CHAT_IDS`
- [ ] Use HTTPS for webhook URL
- [ ] Set appropriate `CLAUDE_TIMEOUT`
- [ ] Configure firewall rules
- [ ] Monitor logs for unauthorized access attempts

## Monitoring

### Health Check

```bash
curl http://localhost:8000/health
# Returns: {"status": "ok", "service": "claude-telegram-bot"}
```

### Logs

The bot logs at appropriate levels:
- `INFO` - Normal operations, accepted/rejected messages
- `WARNING` - Configuration issues, Claude errors
- `ERROR` - API failures, timeouts
- `DEBUG` - Detailed flow (enable with `LOG_LEVEL=DEBUG`)

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TELEGRAM_TOKEN` | ✅ | - | Bot token from @BotFather |
| `WEBHOOK_SECRET` | ⚠️ | "" | Secret for webhook verification |
| `ALLOWED_CHAT_IDS` | ✅ | - | Comma-separated chat IDs |
| `CLAUDE_BINARY` | - | "claude" | Path to Claude CLI |
| `MAX_PROMPT_LENGTH` | - | 8000 | Maximum prompt characters |
| `CLAUDE_TIMEOUT` | - | 120 | Claude process timeout (seconds) |
| `MESSAGE_CHUNK_SIZE` | - | 3900 | Size to split messages |
| `LOG_LEVEL` | - | "INFO" | Logging level |

## Troubleshooting

### Claude binary not found

```env
# Windows
CLAUDE_BINARY=claude.cmd

# Linux/Mac
CLAUDE_BINARY=claude
```

### Claude times out

Increase `CLAUDE_TIMEOUT` in `.env`:

```env
CLAUDE_TIMEOUT=300  # 5 minutes
```

### Webhook not receiving updates

1. Check webhook info: `curl "https://api.telegram.org/bot$TOKEN/getWebhookInfo"`
2. Verify URL is accessible: `curl https://your-domain.com/health`
3. Check logs for `X-Telegram-Bot-Api-Secret-Token` errors

## License

MIT
