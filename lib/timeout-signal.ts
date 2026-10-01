// lib/timeout-signal.ts
//
// AbortSignal.timeout() is not available in older Telegram WebViews
// (Safari < 16 / Chrome < 103). Wall posting must not hard-crash there —
// degrade to "no timeout" instead of throwing on the fetch call itself.

/** AbortSignal that fires after `ms`, or undefined when unsupported. */
export function timeoutSignal(ms: number): AbortSignal | undefined {
  try {
    if (typeof AbortSignal !== "undefined" && typeof (AbortSignal as unknown as { timeout?: unknown }).timeout === "function") {
      return AbortSignal.timeout(ms);
    }
  } catch {
    // Some locked-down environments throw even on property access.
  }
  return undefined;
}

/** Did this error come from a fetch timeout (vs a plain network refusal)? */
export function isTimeoutError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === "TimeoutError" || err.name === "AbortError") &&
    /time|abort|signal/i.test(err.message + " " + err.name)
  );
}
