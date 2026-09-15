/**
 * ETM connector — public surface.
 *
 * Portable by design: no app-specific imports here. To move this connector
 * into another repo (megarepo port plan), copy lib/connectors/etm + the two
 * shared files it depends on (shared/errors, shared/http). See ../README.md.
 */

export { ConnectorError, isConnectorError } from "../shared/errors";
export type { ConnectorCallContext, ConnectorErrorCode } from "../shared/errors";

export {
  etmCardSnapshotSchema,
  etmOrderPayloadSchema,
  etmPricePointSchema,
  etmStockSchema,
  etmSearchHitSchema,
} from "./types";
export type {
  EtmCardSnapshot,
  EtmMode,
  EtmOrderPayload,
  EtmPricePoint,
  EtmProductRef,
  EtmSearchHit,
  EtmStock,
} from "./types";

export { cardHtmlToText, parseAmount, parseEtmCard } from "./parser";
export { HttpEtmTransport, MockEtmTransport } from "./transport";
export type { EtmTransport, HttpEtmTransportOptions, MockEtmTransportData } from "./transport";
export {
  EtmApiClient,
  EtmClient,
  extractSearchHits,
  getEtmApiClientFromEnv,
  getEtmClientFromEnv,
} from "./client";
export type { EtmApiClientOptions, EtmClientOptions, EtmEnv } from "./client";
export {
  ETM_CARD_TM63_FIXTURE_HTML,
  ETM_SEARCH_TM63_FIXTURE_HTML,
} from "./fixtures/etm-card-tm63";
