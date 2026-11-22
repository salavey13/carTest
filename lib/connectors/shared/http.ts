/**
 * Minimal HTTP helper shared by all connectors.
 *
 * - Injectable `fetchImpl` (tests pass a fake, no global stubbing needed).
 * - Hard timeout via AbortController → ConnectorError(TIMEOUT).
 * - Non-2xx → ConnectorError(HTTP_ERROR) with a small body excerpt.
 * - `context` (actor/correlationId) is propagated as headers when the
 *   future crew-access layer starts feeding it in — call sites don't change.
 */

import { ConnectorError, type ConnectorCallContext } from "./errors";

export type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  },
) => Promise<Response>;

export type JsonRequestOptions = {
  connector: string;
  url: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
  context?: ConnectorCallContext;
  /** Accept any status and return the raw Response (skip the 2xx gate). */
  acceptAnyStatus?: boolean;
};

export function contextHeaders(context?: ConnectorCallContext): Record<string, string> {
  const headers: Record<string, string> = {};
  if (context?.actor) {
    headers["x-megarepo-actor"] = `${context.actor.kind}:${context.actor.id}`;
  }
  if (context?.correlationId) {
    headers["x-megarepo-correlation-id"] = context.correlationId;
  }
  return headers;
}

export async function requestJson(options: JsonRequestOptions): Promise<unknown> {
  const {
    connector,
    url,
    method = "GET",
    headers = {},
    body,
    timeoutMs = 15_000,
    fetchImpl = globalThis.fetch,
    context,
    acceptAnyStatus = false,
  } = options;

  if (typeof fetchImpl !== "function") {
    throw new ConnectorError({
      connector,
      code: "HTTP_ERROR",
      message: "No fetch implementation available (pass fetchImpl or run on Node 18+)",
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method,
      headers: { accept: "application/json", ...contextHeaders(context), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    throw new ConnectorError({
      connector,
      code: aborted ? "TIMEOUT" : "HTTP_ERROR",
      message: aborted
        ? `${connector}: request timed out after ${timeoutMs}ms: ${url}`
        : `${connector}: network failure for ${url}: ${error instanceof Error ? error.message : String(error)}`,
    });
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();
  if (!acceptAnyStatus && !response.ok) {
    throw new ConnectorError({
      connector,
      code: "HTTP_ERROR",
      status: response.status,
      excerpt: text.slice(0, 300),
      message: `${connector}: ${method} ${url} failed with HTTP ${response.status}`,
    });
  }

  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    // Not JSON (HTML page, plain text) — return the raw text so parsers can decide.
    return text;
  }
}
