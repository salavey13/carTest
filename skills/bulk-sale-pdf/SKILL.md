# bulk-sale-pdf

## Trigger Phrases
- "сгенерируй PDF для всех байков на продажу"
- "bulk generate sale PDFs"
- "создай прайс-лист PDF для всех байков и отправь в телеграм"
- "отправь PDF карточки для всей категории"

## When to Use

Use this skill when:
- Bulk generating product-sheet PDFs for sale bikes in a franchize
- Sending PDF catalogs to Telegram chat
- Creating marketing materials for bike listings
- Distributing bike catalogs to customers

## Pipeline Position

```
Franchize catalog (Supabase)
  ↓
THIS SKILL (bulk PDF generation)
  ↓
PDFs sent to Telegram
```

## Usage

### Generate PDFs for all sale bikes in a franchize:

```bash
# Send all sale bikes to Telegram
node scripts/bulk-sale-pdf-skill.mjs \
  --slug vip-bike \
  --telegramChatId 123456789

# Generate for specific bikes only
node scripts/bulk-sale-pdf-skill.mjs \
  --slug vip-bike \
  --bikeIds falcon-gt,electro-enduro,racer-x \
  --telegramChatId 123456789

# Custom page size (A5 instead of default A4)
node scripts/bulk-sale-pdf-skill.mjs \
  --slug vip-bike \
  --pageSize A5 \
  --telegramChatId 123456789

# Limit number of PDFs
node scripts/bulk-sale-pdf-skill.mjs \
  --slug vip-bike \
  --limit 5 \
  --telegramChatId 123456789
```

## CLI Flags

| Flag | Required | Description |
|------|----------|-------------|
| `--slug` | ✅ | Franchize slug (e.g., "vip-bike") |
| `--telegramChatId` | ✅ | Telegram chat ID to send PDFs |
| `--bikeIds` | ❌ | Comma-separated list of bike IDs (default: all bikes with sale pricing) |
| `--pageSize` | ❌ | Page size: "A4" (default) or "A5" |
| `--limit` | ❌ | Maximum number of PDFs to generate (default: unlimited) |
| `--delayMs` | ❌ | Delay between PDFs in ms (default: 500, rate limiting) |

## Output

PDFs are sent to Telegram as individual messages. Returns JSON with results:

```json
{
  "ok": true,
  "sent": [
    {"bikeId": "falcon-gt", "fileName": "BUY_falcon-gt.pdf"},
    {"bikeId": "electro-enduro", "fileName": "BUY_electro-enduro.pdf"}
  ],
  "total": 2,
  "skipped": 0,
  "skippedDetails": []
}
```

## PDF Content

Each PDF includes:
- **Header**: Franchise branding + accent line
- **Title**: Bike name (full page width)
- **Price**: Sale price from specs
- **Description**: Bike description
- **Specs Table**: Key specifications (power, torque, range, weight, etc.)
- **Image**: Cover-fit bike photo (9:16 ratio)
- **QR Codes**: Buy link + VK group link
- **Rental Box**: Hourly/daily rental rates (if available)

## Bike Selection

By default, generates PDFs for bikes where:
- `specs.sale` is truthy (true, "1", "true")
- OR `specs.sale_price` > 0
- OR `specs.price_rub` > 0

Use `--bikeIds` to override and select specific bikes.

## Rate Limiting

The script includes built-in rate limiting:
- Default delay: 500ms between PDFs
- Prevents overwhelming external APIs (QR generation, image fetch)
- Adjust with `--delayMs` if needed

## Required Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SITE_URL=https://your-site.com  # For API calls (default: localhost:3000)
FORWARD_TELEGRAM_API=https://v0-car-test.vercel.app/api/forward-telegram  # Telegram forwarding
```

## Error Handling

- Skips bikes without required data (no image, no title)
- Continues processing even if individual PDFs fail
- Returns partial results with `skipped` count
- Logs errors for debugging

## Examples

### Send all sale bikes to admin:
```bash
node scripts/bulk-sale-pdf-skill.mjs \
  --slug vip-bike \
  --telegramChatId $ADMIN_CHAT_ID
```

### Send first 5 bikes (rate limited):
```bash
node scripts/bulk-sale-pdf-skill.mjs \
  --slug vip-bike \
  --telegramChatId $ADMIN_CHAT_ID \
  --limit 5 \
  --delayMs 1000
```

### Send specific bikes in A5 format:
```bash
node scripts/bulk-sale-pdf-skill.mjs \
  --slug vip-bike \
  --bikeIds falcon-gt,racer-x \
  --pageSize A5 \
  --telegramChatId $ADMIN_CHAT_ID
```
