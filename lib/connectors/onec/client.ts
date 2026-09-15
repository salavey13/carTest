/**
 * 1С HTTP-сервисы client + OData read helper.
 *
 * Usage:
 *   const onec = getOnecClientFromEnv();
 *   await onec.ping();                                        // health check
 *   const res = await onec.upsertOrder(payload, { actor });   // write channel
 *   const rows = await onec.odata("Document_ЗаказКлиента", { top: 50 }); // read/BI
 *
 * Contract with the 1С side (HTTP-сервис «megarepo»):
 *   GET  /hs/megarepo/ping            → { ok: true } (any JSON)
 *   POST /hs/megarepo/orders          → { ref, number?, alreadyExisted? }
 *   GET  /hs/megarepo/documents/{ref} → document JSON
 */

import { ConnectorError, type ConnectorCallContext } from "../shared/errors";
import { requestJson, type FetchLike } from "../shared/http";
import type { ZodType } from "zod";
import {
  onecConfigSchema,
  onecOrderPayloadSchema,
  onecUpsertResultSchema,
  type OnecConfig,
  type OnecOrderPayload,
  type OnecPingResult,
  type OnecResolvedConfig,
  type OnecUpsertResult,
} from "./types";

export class OnecHttpClient {
  private readonly config: OnecResolvedConfig;
  private readonly fetchImpl: FetchLike;

  constructor(config: OnecConfig, options: { fetchImpl?: FetchLike } = {}) {
    const parsed = onecConfigSchema.safeParse(config);
    if (!parsed.success) {
      throw new ConnectorError({
        connector: "onec",
        code: "MISSING_CONFIG",
        excerpt: parsed.error.issues
          .slice(0, 3)
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
        message: "onec: invalid config",
      });
    }
    this.config = parsed.data;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
  }

  get serviceName(): string {
    return this.config.serviceName;
  }

  private basicAuthHeader(): string {
    const raw = `${this.config.username}:${this.config.password}`;
    const encoded = Buffer.from(raw, "utf8").toString("base64");
    return `Basic ${encoded}`;
  }

  /** Absolute URL of an HTTP-сервис command: {baseUrl}/hs/{service}/{command}. */
  commandUrl(command: string): string {
    const base = this.config.baseUrl.replace(/\/+$/, "");
    const cmd = command.replace(/^\/+/, "");
    return `${base}/hs/${encodeURIComponent(this.config.serviceName)}/${cmd}`;
  }

  private guardResponse<T>(
    schema: ZodType<T>,
    value: unknown,
    what: string,
  ): T {
    const checked = schema.safeParse(value);
    if (!checked.success) {
      throw new ConnectorError({
        connector: "onec",
        code: "PARSE_ERROR",
        excerpt: checked.error.issues
          .slice(0, 3)
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
        message: `onec: ${what} response failed schema validation`,
      });
    }
    return checked.data;
  }

  async ping(context?: ConnectorCallContext): Promise<OnecPingResult> {
    const raw = await requestJson({
      connector: "onec",
      url: this.commandUrl("ping"),
      headers: { authorization: this.basicAuthHeader() },
      timeoutMs: this.config.timeoutMs,
      fetchImpl: this.fetchImpl,
      context,
    });
    const ok =
      typeof raw === "object" && raw !== null
        ? (raw as { ok?: unknown }).ok === true || (raw as { status?: unknown }).status === "ok"
        : raw !== null && raw !== undefined;
    return { ok, serviceName: this.config.serviceName, raw };
  }

  /** Create-or-update an order in 1С. Idempotent by externalId (1С-side mapping). */
  async upsertOrder(
    payload: OnecOrderPayload,
    context?: ConnectorCallContext,
  ): Promise<OnecUpsertResult> {
    const body = onecOrderPayloadSchema.parse(payload);
    const raw = await requestJson({
      connector: "onec",
      url: this.commandUrl("orders"),
      method: "POST",
      headers: {
        authorization: this.basicAuthHeader(),
        "content-type": "application/json; charset=utf-8",
      },
      body,
      timeoutMs: this.config.timeoutMs,
      fetchImpl: this.fetchImpl,
      context,
    });
    return this.guardResponse<OnecUpsertResult>(onecUpsertResultSchema, raw, "upsertOrder");
  }

  async getDocument(ref: string, context?: ConnectorCallContext): Promise<unknown> {
    return requestJson({
      connector: "onec",
      url: this.commandUrl(`documents/${encodeURIComponent(ref)}`),
      headers: { authorization: this.basicAuthHeader() },
      timeoutMs: this.config.timeoutMs,
      fetchImpl: this.fetchImpl,
      context,
    });
  }

  /** OData URL for a collection (read/BI channel only — never for writes). */
  odataUrl(entity: string, query: OdataQuery = {}): string {
    return buildOdataUrl(this.config.baseUrl, entity, query);
  }

  /** Minimal OData reader returning a validated collection. */
  async fetchOdata<T = Record<string, unknown>>(
    entity: string,
    query: OdataQuery = {},
    context?: ConnectorCallContext,
  ): Promise<OdataCollection<T>> {
    const raw = await requestJson({
      connector: "onec",
      url: this.odataUrl(entity, query),
      headers: { authorization: this.basicAuthHeader() },
      timeoutMs: this.config.timeoutMs,
      fetchImpl: this.fetchImpl,
      context,
    });
    if (
      typeof raw !== "object" ||
      raw === null ||
      !Array.isArray((raw as { value?: unknown }).value)
    ) {
      throw new ConnectorError({
        connector: "onec",
        code: "PARSE_ERROR",
        message: `onec: OData ${entity} did not return a collection`,
      });
    }
    return raw as OdataCollection<T>;
  }
}

/* ------------------------------------------------------------------ */
/* OData (read/BI channel only — never for writes)                     */
/* ------------------------------------------------------------------ */

export type OdataQuery = {
  top?: number;
  skip?: number;
  filter?: string;
  select?: string[];
  orderBy?: string;
  expand?: string;
};

/** Build an encoded OData URL against the standard.odata publication root. */
export function buildOdataUrl(baseUrl: string, entity: string, query: OdataQuery = {}): string {
  const base = baseUrl.replace(/\/+$/, "");
  const params = new URLSearchParams();
  params.set("$format", "json");
  if (query.top !== undefined) params.set("$top", String(query.top));
  if (query.skip !== undefined) params.set("$skip", String(query.skip));
  if (query.filter) params.set("$filter", query.filter);
  if (query.select?.length) params.set("$select", query.select.join(","));
  if (query.orderBy) params.set("$orderby", query.orderBy);
  if (query.expand) params.set("$expand", query.expand);
  return `${base}/odata/standard.odata/${entity}?${params.toString()}`;
}

export type OdataCollection<T = Record<string, unknown>> = {
  odataMetadata?: string;
  value: T[];
};

/* ------------------------------------------------------------------ */
/* Env factory                                                         */
/* ------------------------------------------------------------------ */

export type OnecEnv = {
  ONC_BASE_URL?: string;
  ONEC_BASE_URL?: string;
  ONC_USERNAME?: string;
  ONC_PASSWORD?: string;
  ONC_SERVICE_NAME?: string;
};

/** process.env-compatible view (any string-keyed bag). */
type OnecEnvSource = OnecEnv | Record<string, string | undefined>;

export function getOnecClientFromEnv(
  env: OnecEnvSource = process.env,
  options: { fetchImpl?: FetchLike } = {},
): OnecHttpClient {
  const baseUrl = env.ONC_BASE_URL ?? env.ONEC_BASE_URL;
  const username = env.ONC_USERNAME;
  const password = env.ONC_PASSWORD;
  const missing: string[] = [];
  if (!baseUrl) missing.push("ONC_BASE_URL");
  if (!username) missing.push("ONC_USERNAME");
  if (!password) missing.push("ONC_PASSWORD");
  if (missing.length > 0) {
    throw new ConnectorError({
      connector: "onec",
      code: "MISSING_CONFIG",
      message: `onec: missing env vars: ${missing.join(", ")} (1С publication + HTTP-сервис credentials)`,
    });
  }
  return new OnecHttpClient(
    {
      baseUrl: baseUrl!,
      username: username!,
      password: password!,
      serviceName: env.ONC_SERVICE_NAME ?? "megarepo",
    },
    options,
  );
}
