/**
 * 1С connector — public surface.
 *
 * Portable by design: no app-specific imports here. To move this connector
 * into another repo (megarepo port plan), copy lib/connectors/onec + the two
 * shared files it depends on (shared/errors, shared/http). See ../README.md.
 */

export { ConnectorError, isConnectorError } from "../shared/errors";
export type { ConnectorCallContext, ConnectorErrorCode } from "../shared/errors";

export {
  onecConfigSchema,
  onecOrderPayloadSchema,
  onecUpsertResultSchema,
} from "./types";
export type {
  OnecConfig,
  OnecOrderPayload,
  OnecPingResult,
  OnecResolvedConfig,
  OnecUpsertResult,
} from "./types";

export {
  OnecHttpClient,
  buildOdataUrl,
  getOnecClientFromEnv,
} from "./client";
export type { OdataCollection, OdataQuery, OnecEnv } from "./client";
