/**
 * Env-based client wiring for the sidecar (mirrors lib/connectors env
 * factories). Kept separate from tools.ts so tests inject mocks instead.
 *
 * Startup rule: the sidecar MUST boot even with no connector env configured —
 * ETM public mode needs nothing, 1С needs ONC_*. So 1С clients are built
 * lazily on first call: with no env, onec_* tools fail with a typed
 * MISSING_CONFIG result instead of crashing the server.
 *
 * ETM (see lib/connectors/README.md):
 *   ETM_MODE=public (default, works today) | mock | api
 *   ETM_API_TOKEN=…        → api mode, waits for the ЭДО заявка/методичка
 *   ETM_BASE_URL, ETM_SEARCH_URL_TEMPLATE, ETM_TIMEOUT_MS
 * 1С:
 *   ONC_BASE_URL (or ONEC_BASE_URL), ONC_USERNAME, ONC_PASSWORD,
 *   ONC_SERVICE_NAME (default «megarepo»), ONC_TIMEOUT_MS
 */

import { ConnectorError } from "../../lib/connectors/shared/errors";
import type { ConnectorCallContext } from "../../lib/connectors/shared/errors";
import { getEtmClientFromEnv } from "../../lib/connectors/etm/client";
import type { EtmClient } from "../../lib/connectors/etm/client";
import { getOnecClientFromEnv } from "../../lib/connectors/onec/client";
import type {
  OnecHttpClient,
} from "../../lib/connectors/onec/client";
import type {
  OnecPingResult,
  OnecUpsertResult,
} from "../../lib/connectors/onec/types";
import { buildTools, type ConnectorClients, type ConnectorTool } from "./tools";

export interface EnvLike {
  [key: string]: string | undefined;
}

/** 1С client surface with lazy construction + call-time MISSING_CONFIG. */
function lazyOnec(env: EnvLike): ConnectorClients["onec"] {
  let real: OnecHttpClient | null = null;
  const ensure = (): OnecHttpClient => {
    if (!real) real = getOnecClientFromEnv(env as NodeJS.ProcessEnv);
    return real;
  };
  const missingConfig = (): ConnectorError =>
    new ConnectorError({
      connector: "onec",
      code: "MISSING_CONFIG",
      message:
        "onec: ONC_BASE_URL/ONC_USERNAME/ONC_PASSWORD are not configured on the sidecar host",
    });
  return {
    ping(context?: ConnectorCallContext): Promise<OnecPingResult> {
      try {
        return ensure().ping(context);
      } catch (error) {
        if (error instanceof ConnectorError) throw error;
        throw missingConfig();
      }
    },
    upsertOrder(
      payload: Parameters<OnecHttpClient["upsertOrder"]>[0],
      context?: ConnectorCallContext,
    ): Promise<OnecUpsertResult> {
      try {
        return ensure().upsertOrder(payload, context);
      } catch (error) {
        if (error instanceof ConnectorError) throw error;
        throw missingConfig();
      }
    },
    getDocument(
      ref: string,
      context?: ConnectorCallContext,
    ): Promise<unknown> {
      try {
        return ensure().getDocument(ref, context);
      } catch (error) {
        if (error instanceof ConnectorError) throw error;
        throw missingConfig();
      }
    },
  };
}

export function buildClientsFromEnv(env: EnvLike): ConnectorClients {
  return {
    etm: getEtmClientFromEnv(env as NodeJS.ProcessEnv),
    onec: lazyOnec(env),
  };
}

/**
 * Build the 6-tool set. With `env === process.env` the ETM factory reads
 * process.env directly anyway (same result); explicit env objects are used
 * by tests.
 */
export function buildDefaultTools(env: EnvLike = process.env as EnvLike): ConnectorTool[] {
  return buildTools(buildClientsFromEnv(env));
}

export type { EtmClient, OnecHttpClient };
