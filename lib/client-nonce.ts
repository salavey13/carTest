// lib/client-nonce.ts
//
// Client-side idempotency key generator (robustness pack 2026-10-02).
// The nonce is stable across retry taps of ONE user intent (e.g. «Опубликовать»
// on the crew wall) and rotated after success, so the server's
// metadata->>client_nonce dedupe can return the original row instead of
// creating a duplicate when a network response is lost after commit.

/** uuid when the runtime has crypto.randomUUID, timestamped fallback otherwise. */
export function makeClientNonce(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // locked-down crypto — fall through
  }
  return `post-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}
