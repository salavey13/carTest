# Franchize Telegram capability

Franchize uses Telegram as the primary operator/customer handoff layer.

## Native WebApp UX

- Use native Telegram controls only through the shared hooks/context.
- Keep same-origin navigation on Next.js router/`Link`; do not replace internal route changes with hard reloads.
- Native BackButton guard behavior is intentionally conservative: while a back tap is pending, visibility/auth dependency refreshes must not clear the pending state until `currentRoute` changes.

## Deep-link payloads

- Buy card: `buy_<bikeId>` → `/franchize/<slug>/market/<bikeId>/buy`.
- Rental legacy payloads currently support `rental-*`, `rentals-*`, and `rental_*`.
- MapRiders payloads support `mapriders_<slug>` / `mapriders-<slug>`.

Use the repo helper in `app/franchize/lib/telegram-links.ts` for WebApp URLs so bot usernames and payload separators stay consistent.

## Notifications + invoices

- Customer/operator notifications should use Telegram server transport, never client-side bot tokens.
- XTR/test-drive invoices should be created from franchize server actions and recorded to the franchize intent ledger when possible.
- Recovery/closer flows should include enough metadata for the dashboard: bike id/title, contact channel, selected option, payment state, and source route.

## Printable sale sheets

The sale buy page exposes owner/admin-only **Распечатать**:

1. Client checks operator dashboard access for display only.
2. Server action revalidates admin/owner access from the signed Telegram actor cookie.
3. PDF is generated server-side with bike details, image, and a QR code to `https://t.me/{crewBotUsername}/app?startapp=buy_{bikeId}` (crew-specific bot username from metadata).
4. PDF is delivered with `sendTelegramDocument` to the current Telegram actor.

This pattern is the recommended template for future franchize documents: contracts, inspection sheets, pickup labels, and printed sale tags.
