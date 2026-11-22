/**
 * Shared error type for all external-system connectors (ETM, 1С, future ones).
 *
 * Design rules:
 * - Zero app-specific imports: this folder must be liftable into any repo
 *   (megarepo port plan) without touching Supabase, Next.js or Telegram code.
 * - Every error carries a machine-readable `code` so callers can branch
 *   without string matching.
 */

export type ConnectorErrorCode =
  | "MISSING_CONFIG"
  | "NOT_IMPLEMENTED"
  | "HTTP_ERROR"
  | "PARSE_ERROR"
  | "TIMEOUT";

export type ConnectorCallContext = {
  /** Who initiated the call. In carTest this is filled by crew/auth middleware; in a bare runtime — `system`. */
  actor?: { id: string; kind: "crew" | "admin" | "system" };
  /** Free-form trace id, propagated to the external system as a header when supported. */
  correlationId?: string;
};

export class ConnectorError extends Error {
  readonly code: ConnectorErrorCode;
  readonly connector: string;
  readonly status?: number;
  /** Small body/status excerpt for logs — never the full payload. */
  readonly excerpt?: string;

  constructor(options: {
    connector: string;
    code: ConnectorErrorCode;
    message: string;
    status?: number;
    excerpt?: string;
  }) {
    super(options.message);
    this.name = "ConnectorError";
    this.connector = options.connector;
    this.code = options.code;
    if (options.status !== undefined) this.status = options.status;
    if (options.excerpt !== undefined) this.excerpt = options.excerpt;
  }

  toJSON() {
    return {
      name: this.name,
      connector: this.connector,
      code: this.code,
      status: this.status,
      excerpt: this.excerpt,
      message: this.message,
    };
  }
}

export function isConnectorError(value: unknown): value is ConnectorError {
  return value instanceof ConnectorError;
}
