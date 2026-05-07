# Telegram auth SHA/HMAC mismatch checklist

Use this as the production debug runbook when `/api/validate-telegram-auth` rejects real `Telegram.WebApp.initData`.
The server now logs `API_VALIDATE_HASH_DIAG` with a variant matrix on every strict mismatch, so each hypothesis below can be tested one by one from Vercel logs without returning forgery-friendly hashes to the browser.

## Canonical algorithm we expect

1. Read the raw `Telegram.WebApp.initData` query string on the client and POST it unchanged to the backend.
2. Parse query params for validation.
3. Build `data-check-string` from all received `key=value` pairs sorted by key.
4. Exclude only `hash` from the bot-token HMAC data-check-string.
5. If Telegram includes the newer `signature` field, keep it in this bot-token HMAC data-check-string; `signature` is only excluded for the separate third-party Ed25519 validation flow.
6. Derive the binary secret as `HMAC-SHA256(key = "WebAppData", message = TELEGRAM_BOT_TOKEN)`.
7. Compute `HMAC-SHA256(key = derivedSecret, message = dataCheckString)` and compare its hex digest to the received `hash`.

## Hypotheses to test in production

- **Wrong bot token / wrong bot launched the app.** Production may be opened from one Telegram bot while Vercel has another `TELEGRAM_BOT_TOKEN`.
- **`signature` field confusion.** Bot-token HMAC should exclude `hash` but include `signature`; old snippets sometimes exclude both.
- **Reversed derivation.** Some code uses `HMAC(key = botToken, message = "WebAppData")`; Telegram expects the opposite.
- **Wrong final signing key.** Legacy snippets may use raw bot token, raw `WebAppData`, or `SHA256(botToken)` directly instead of Telegram's derived binary secret.
- **Accidental `hash` inclusion.** The received `hash` must not be part of the signed data-check-string.
- **Ordering bug.** Telegram requires sorted pairs; preserving original query order changes the digest.
- **URL decoding mismatch.** Differences around `+`, `%20`, Unicode names, JSON slash escaping in `photo_url`, and double-encoded payloads can change the string we sign.
- **Duplicate param handling.** Rare duplicate keys must be signed as received; collapsing with `params.get(key)` signs only the first value.
- **Client sends wrong source.** Backend must receive `window.Telegram.WebApp.initData`, not `initDataUnsafe`, not `tgWebAppData` after accidental partial decoding/re-encoding, and not the full launch URL.
- **Stale auth date is a separate failure.** `auth_date` freshness can reject a request later, but it should not change the HMAC digest itself.

## How to read the new log matrix

Look for `API_VALIDATE_HASH_DIAG` in server logs after a 401 response:

- `official_include_signature_exclude_hash` matching means the strict path is correct and any failure is likely outside hash comparison.
- `legacy_exclude_signature_and_hash` matching means `signature` handling is the bug.
- `wrong_reversed_derivation` matching means key/message were flipped somewhere.
- `wrong_direct_bot_token_key`, `wrong_direct_webappdata_key`, or `wrong_sha256_token_secret` matching identifies legacy secret derivation snippets.
- `wrong_include_hash` matching means the client hash was accidentally signed.
- `wrong_preserve_input_order` matching means sorting is missing or differs from production.
- No variants matching usually points to wrong bot token, mutated initData, or an unlisted encoding transformation.
