/**
 * ETM transports: where raw card/search HTML comes from.
 *
 * - `HttpEtmTransport` — the public website (no credentials, works today).
 * - `MockEtmTransport` — in-memory fixtures (tests, offline dev, demo screens).
 * - The future partner API transport lives in `api-client.ts` and is switched
 *   on after ETM issues credentials following the «Заявка на настройку ЭДО».
 */

import { requestJson, type FetchLike } from "../shared/http";
import type { ConnectorCallContext } from "../shared/errors";

export interface EtmTransport {
  /** Raw HTML of the public product card for a numeric product code. */
  fetchCardHtml(code: string, context?: ConnectorCallContext): Promise<string>;
  /** Raw HTML of a search result page for a free-form query. */
  searchHtml(query: string, context?: ConnectorCallContext): Promise<string>;
}

export type HttpEtmTransportOptions = {
  /** Default: https://www.etm.ru */
  baseUrl?: string;
  /** Page whose HTML contains product links; must contain a `{query}` placeholder. */
  searchUrlTemplate?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
};

export class HttpEtmTransport implements EtmTransport {
  readonly baseUrl: string;
  private readonly searchUrlTemplate: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: FetchLike;

  constructor(options: HttpEtmTransportOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "https://www.etm.ru").replace(/\/+$/, "");
    this.searchUrlTemplate = options.searchUrlTemplate ?? `${this.baseUrl}/search?q={query}`;
    this.timeoutMs = options.timeoutMs ?? 20_000;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
  }

  cardUrl(code: string): string {
    return `${this.baseUrl}/cat/nn/${encodeURIComponent(code)}`;
  }

  async fetchCardHtml(code: string, context?: ConnectorCallContext): Promise<string> {
    const result = await requestJson({
      connector: "etm",
      url: this.cardUrl(code),
      headers: { accept: "text/html" },
      timeoutMs: this.timeoutMs,
      fetchImpl: this.fetchImpl,
      context,
    });
    return typeof result === "string" ? result : "";
  }

  async searchHtml(query: string, context?: ConnectorCallContext): Promise<string> {
    const url = this.searchUrlTemplate.replace("{query}", encodeURIComponent(query));
    const result = await requestJson({
      connector: "etm",
      url,
      headers: { accept: "text/html" },
      timeoutMs: this.timeoutMs,
      fetchImpl: this.fetchImpl,
      context,
    });
    return typeof result === "string" ? result : "";
  }
}

export type MockEtmTransportData = {
  /** product code → card HTML */
  cards?: Record<string, string>;
  /** query → search-result HTML */
  searches?: Record<string, string>;
};

export class MockEtmTransport implements EtmTransport {
  private readonly cards: Record<string, string>;
  private readonly searches: Record<string, string>;

  constructor(data: MockEtmTransportData = {}) {
    this.cards = { ...data.cards };
    this.searches = { ...data.searches };
  }

  addCard(code: string, html: string): this {
    this.cards[code] = html;
    return this;
  }

  async fetchCardHtml(code: string): Promise<string> {
    return this.cards[code] ?? "";
  }

  async searchHtml(query: string): Promise<string> {
    return this.searches[query] ?? "";
  }
}
