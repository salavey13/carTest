/**
 * ETM client facade over a transport + the contract-first partner API stub.
 *
 * Public mode (works TODAY, no заявка):
 *   const etm = getEtmClientFromEnv();          // ETM_MODE=public (default)
 *   const card = await etm.getCard("5517285");  // prices + stock + specs
 *   const hit  = await etm.findByRef({ mark: "ТМ-63", series: "PX" });
 *
 * Partner API mode (after the методичка):
 *   const api = getEtmApiClientFromEnv();       // ETM_MODE=api, ETM_API_TOKEN=…
 *   await api.createOrder({ externalId, lines });  // → NOT_IMPLEMENTED until wired
 */

import { ConnectorError } from "../shared/errors";
import type { ConnectorCallContext } from "../shared/errors";
import { parseEtmCard } from "./parser";
import {
  HttpEtmTransport,
  MockEtmTransport,
  type EtmTransport,
} from "./transport";
import {
  etmCardSnapshotSchema,
  etmOrderPayloadSchema,
  type EtmCardSnapshot,
  type EtmMode,
  type EtmOrderPayload,
  type EtmProductRef,
  type EtmSearchHit,
} from "./types";

export type EtmClientOptions = {
  transport: EtmTransport;
  baseUrl?: string;
};

export class EtmClient {
  private readonly transport: EtmTransport;
  readonly baseUrl: string;

  constructor(options: EtmClientOptions) {
    this.transport = options.transport;
    this.baseUrl = (options.baseUrl ?? "https://www.etm.ru").replace(/\/+$/, "");
  }

  cardUrl(code: string): string {
    return `${this.baseUrl}/cat/nn/${encodeURIComponent(code)}`;
  }

  /** Fetch + parse one public product card. Partial cards are returned as-is. */
  async getCard(code: string, context?: ConnectorCallContext): Promise<EtmCardSnapshot> {
    const html = await this.transport.fetchCardHtml(code, context);
    if (!html.trim()) {
      // Empty page (client-side-rendered card, throttle page, temporary glitch):
      // return a minimal snapshot instead of failing — bulk jobs decide their
      // own retry policy per card.
      return {
        code,
        url: this.cardUrl(code),
        prices: [],
        specs: {},
        parsedAt: new Date().toISOString(),
      };
    }
    const snapshot = parseEtmCard({ html, code, url: this.cardUrl(code) });
    const checked = etmCardSnapshotSchema.safeParse(snapshot);
    if (!checked.success) {
      throw new ConnectorError({
        connector: "etm",
        code: "PARSE_ERROR",
        excerpt: checked.error.issues
          .slice(0, 3)
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
        message: `etm: card ${code} failed schema validation`,
      });
    }
    return checked.data;
  }

  /** Search the public site; returns product codes found in result links. */
  async search(query: string, context?: ConnectorCallContext): Promise<EtmSearchHit[]> {
    const html = await this.transport.searchHtml(query, context);
    return extractSearchHits(html);
  }

  /** «марка + серия + артикул → код товара ЭТМ». Picks the hit whose title matches best. */
  async findByRef(
    ref: EtmProductRef,
    context?: ConnectorCallContext,
  ): Promise<EtmSearchHit | null> {
    const parts = [ref.mark, ref.series, ref.article].filter(Boolean) as string[];
    const query = (ref.query ?? parts.join(" ")).trim();
    if (!query) {
      throw new ConnectorError({
        connector: "etm",
        code: "MISSING_CONFIG",
        message: "etm.findByRef: nothing to search for (mark/series/article/query all empty)",
      });
    }
    const hits = await this.search(query, context);
    if (hits.length === 0) return null;
    if (ref.article) {
      const exact = hits.find((h) => (h.title ?? "").toLowerCase().includes(ref.article!.toLowerCase()));
      if (exact) return exact;
    }
    return hits[0];
  }
}

/** Pull `/cat/nn/{code}` links out of any HTML page (search results, catalogs). */
export function extractSearchHits(html: string): EtmSearchHit[] {
  const hits = new Map<string, EtmSearchHit>();
  const linkRe = /<a[^>]+href="([^"]*\/cat\/nn\/(\d+)[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html)) !== null) {
    const code = m[2];
    if (hits.has(code)) continue;
    const title = m[3]
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    hits.set(code, {
      code,
      title: title || undefined,
      url: m[1].startsWith("http") ? m[1] : undefined,
    });
  }
  return [...hits.values()];
}

/* ------------------------------------------------------------------ */
/* Partner API (заявка-gated) — contract-first stub                    */
/* ------------------------------------------------------------------ */

export type EtmApiClientOptions = {
  baseUrl?: string;
  token?: string;
  timeoutMs?: number;
  fetchImpl?: EtmClientOptions["transport"] extends never ? never : typeof globalThis.fetch;
};

/**
 * The partner API surface we will implement once ETM sends the методичка.
 * Every method validates configuration today and throws NOT_IMPLEMENTED —
 * so the megarepo call sites can be written now and survive unchanged.
 */
export class EtmApiClient {
  readonly baseUrl: string;
  readonly token: string | undefined;

  constructor(options: EtmApiClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "https://api.etm.ru").replace(/\/+$/, "");
    this.token = options.token;
  }

  private assertReady(_operation: string): never {
    if (!this.token) {
      throw new ConnectorError({
        connector: "etm",
        code: "MISSING_CONFIG",
        message:
          "etm api: ETM_API_TOKEN is not set — request it via «Заявка на настройку ЭДО» (способ обмена: API)",
      });
    }
    throw new ConnectorError({
      connector: "etm",
      code: "NOT_IMPLEMENTED",
      message:
        "etm api: waiting for the методичка (endpoints + auth scheme) after the ЭДО заявка; wire the real transport here",
    });
  }

  async getPersonalPrices(codes: string[]): Promise<never> {
    void codes;
    this.assertReady("getPersonalPrices");
  }

  async createOrder(payload: EtmOrderPayload): Promise<never> {
    etmOrderPayloadSchema.parse(payload);
    this.assertReady("createOrder");
  }

  async downloadDocuments(orderExternalId: string): Promise<never> {
    void orderExternalId;
    this.assertReady("downloadDocuments");
  }
}

/* ------------------------------------------------------------------ */
/* Env factories                                                       */
/* ------------------------------------------------------------------ */

export type EtmEnv = {
  ETM_MODE?: string;
  ETM_BASE_URL?: string;
  ETM_API_TOKEN?: string;
  ETM_SEARCH_URL_TEMPLATE?: string;
};

/** process.env-compatible view (any string-keyed bag). */
type EtmEnvSource = EtmEnv | Record<string, string | undefined>;

export function getEtmClientFromEnv(
  env: EtmEnvSource = process.env,
  transportOverride?: EtmTransport,
): EtmClient {
  const mode: EtmMode = parseMode(env.ETM_MODE);
  const baseUrl = env.ETM_BASE_URL ?? "https://www.etm.ru";
  let transport: EtmTransport;
  if (transportOverride) {
    transport = transportOverride;
  } else if (mode === "mock") {
    transport = new MockEtmTransport();
  } else {
    transport = new HttpEtmTransport({
      baseUrl,
      searchUrlTemplate: env.ETM_SEARCH_URL_TEMPLATE,
    });
  }
  return new EtmClient({ transport, baseUrl });
}

export function getEtmApiClientFromEnv(env: EtmEnvSource = process.env): EtmApiClient {
  const token = env.ETM_API_TOKEN;
  if (!token) {
    throw new ConnectorError({
      connector: "etm",
      code: "MISSING_CONFIG",
      message: "etm api: ETM_API_TOKEN is required (mode api is заявка-gated)",
    });
  }
  return new EtmApiClient({ baseUrl: env.ETM_BASE_URL, token });
}

function parseMode(raw: string | undefined): EtmMode {
  const mode = (raw ?? "public").toLowerCase();
  if (mode === "public" || mode === "mock" || mode === "api") return mode;
  throw new ConnectorError({
    connector: "etm",
    code: "MISSING_CONFIG",
    message: `etm: unknown ETM_MODE "${raw}" (expected public | mock | api)`,
  });
}
