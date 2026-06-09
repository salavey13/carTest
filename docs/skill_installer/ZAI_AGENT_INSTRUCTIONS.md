# ZAI Agent Instructions - Telegram Delivery API

> **For ZAI Agent working with installed codebase.**

---

## ⛔ CRITICAL: API-ONLY TELEGRAM DELIVERY

**You MUST NOT attempt to call Telegram Bot API directly.** All telegram deliveries must go through the provided API endpoint.

---

## Why API-Only?

The ZAI agent environment typically:
- Does NOT have `TELEGRAM_BOT_TOKEN` configured
- May have Telegram API blocked/restricted
- Cannot reach `api.telegram.org` directly

**Solution:** Use the forward-telegram API on the hosted server.

---

## API Endpoint

**Base URL:** `https://v0-car-test.vercel.app/api/forward-telegram`

**Method:** `POST`

**Headers:**
```
Content-Type: application/json
```

---

## Supported Delivery Modes

### 1. Send Text Message

```bash
curl -X POST "https://v0-car-test.vercel.app/api/forward-telegram" \
  -H "Content-Type: application/json" \
  -d '{
    "chat_id": "123456789",
    "method": "sendMessage",
    "payload": {
      "text": "Your contract is ready!",
      "parse_mode": "HTML"
    }
  }'
```

### 2. Send Photo

**From URL:**
```json
{
  "chat_id": "123456789",
  "method": "sendPhoto",
  "payload": {
    "photo": "https://example.com/image.png",
    "caption": "Preview of changes",
    "parse_mode": "HTML"
  }
}
```

**From base64-encoded file:**
```json
{
  "chat_id": "123456789",
  "method": "sendPhoto",
  "payload": {
    "caption": "Generated preview",
    "parse_mode": "HTML"
  },
  "files": {
    "photo": {
      "data": "iVBORw0KGgoAAAANSUhEUg...",
      "filename": "preview.png",
      "contentType": "image/png"
    }
  }
}
```

### 3. Send Document (DOCX, PDF, etc.)

**For contract delivery:**
```json
{
  "chat_id": "123456789",
  "method": "sendDocument",
  "payload": {
    "caption": "Your rental contract is ready",
    "parse_mode": "HTML"
  },
  "files": {
    "document": {
      "data": "UEsDBBQABgAIAAAAIQ...",
      "filename": "rental-contract.docx",
      "contentType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    }
  }
}
```

### 4. Send Media Group (Document + QR Code)

**When you need to send contract with QR code:**
```json
{
  "chat_id": "123456789",
  "method": "sendMediaGroup",
  "payload": {
    "media": [
      {
        "type": "document",
        "media": "attach://docx",
        "parse_mode": "HTML"
      },
      {
        "type": "photo",
        "media": "attach://qr",
        "caption": "QR for quick access"
      }
    ]
  },
  "files": {
    "docx": {
      "data": "UEsDBBQABgAIAAAAIQ...",
      "filename": "contract.docx",
      "contentType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    },
    "qr": {
      "data": "iVBORw0KGgoAAAANSUhEUg...",
      "filename": "qr-code.png",
      "contentType": "image/png"
    }
  }
}
```

---

## Using the Helper Script (Recommended)

The installed codebase includes `scripts/codex-notify.mjs` which wraps the API:

```bash
# Send text
node scripts/codex-notify.mjs telegram-api --chatId 123456789 --text "Hello"

# Send photo from file
node scripts/codex-notify.mjs telegram-photo-api --chatId 123456789 --photo ./preview.png --caption "Preview"

# Send document
node scripts/codex-notify.mjs telegram-doc --chatId 123456789 --document ./contract.docx --caption "Contract ready"

# Send document + QR
node scripts/codex-notify.mjs telegram-media-group --chatId 123456789 --document ./contract.docx --qr ./qr.png
```

---

## Supported File Types

| Extension | MIME Type |
|-----------|-----------|
| `.docx` | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |
| `.pdf` | `application/pdf` |
| `.png` | `image/png` |
| `.jpg` / `.jpeg` | `image/jpeg` |
| `.gif` | `image/gif` |
| `.txt` | `text/plain` |
| `.zip` | `application/zip` |

---

## Response Format

**Success:**
```json
{
  "ok": true,
  "result": { ... },
  "message_id": 123
}
```

**Error:**
```json
{
  "ok": false,
  "error": "Telegram API error",
  "telegram": { ... }
}
```

---

## Common Use Cases

### Contract Generation Delivery

When `scripts/make-deal-contract-skill.mjs` fails with `telegram_send_failed`:

```bash
# Retry via API
node scripts/codex-notify.mjs telegram-doc \
  --chatId 123456789 \
  --document /tmp/generated-contract.docx \
  --caption "Ваш договор готов"
```

### Screenshot Delivery

When you need to send a visual confirmation:

```bash
node scripts/codex-notify.mjs telegram-photo-api \
  --chatId 123456789 \
  --photo ./screenshots/result.png \
  --caption "Задача выполнена"
```

---

## ⛔ PROHIBITED

- ❌ Do NOT call `https://api.telegram.org/bot<TOKEN>/...` directly
- ❌ Do NOT attempt to use `TELEGRAM_BOT_TOKEN` (it won't exist in your environment)
- ❌ Do NOT write custom Telegram API integration code
- ❌ Do NOT use other telegram libraries/npm packages

---

## ✅ CORRECT APPROACH

- ✅ Use `https://v0-car-test.vercel.app/api/forward-telegram`
- ✅ Use `scripts/codex-notify.mjs` helper modes
- ✅ Send files as base64-encoded data in request body
- ✅ Handle API errors gracefully and report to operator

---

## Example: Full Contract Generation Flow

```bash
# 1. Generate contract (this may fail telegram delivery)
node scripts/make-deal-contract-skill.mjs \
  --dealType sale \
  --phrase "создай договор продажи falcon-gt" \
  --passportJson /tmp/passport.json \
  --telegramChatId 123456789 \
  --saveMetadata 1

# 2. If script fails with telegram_send_failed, deliver via API:
node scripts/codex-notify.mjs telegram-doc \
  --chatId 123456789 \
  --document ./sale-contract-Falcon-GT-*.docx \
  --caption "Ваш договор купли-продажи готов"
```

---

## Troubleshooting

**API returns 403:** Check CORS headers - your origin may not be allowed
**API returns 400:** Check payload format - files must be base64 encoded
**Telegram error inside response:** The API reached Telegram but Telegram rejected it (invalid chat_id, file too large, etc.)

---

**End of Instructions.**
