/**
 * 1С connector — data contracts.
 *
 * Channel plan (matches the megarepo blueprint §5.3):
 * - HTTP-сервисы — primary write channel (order/document upserts). This client.
 * - OData        — read/BI channel only (queries against the publication).
 * - EnterpriseData / файловый обмен — deliberately not implemented (overkill/fallback).
 *
 * All config comes from env or explicit options; nothing is hard-coded.
 */

import { z } from "zod";

export const onecConfigSchema = z.object({
  /** Publication root, e.g. https://1c.example.com/baseru (no /hs suffix). */
  baseUrl: z.string().url(),
  username: z.string().min(1),
  password: z.string().min(1),
  /** HTTP-сервис name registered on the 1С side, default «megarepo». */
  serviceName: z.string().min(1).default("megarepo"),
  timeoutMs: z.number().int().positive().default(15_000),
});
export type OnecConfig = z.input<typeof onecConfigSchema>;
export type OnecResolvedConfig = z.output<typeof onecConfigSchema>;

/** Order/document payload pushed to 1С (system-of-record upsert). */
export const onecOrderPayloadSchema = z.object({
  /** Our internal id (request/rental id) — 1С stores it for idempotency. */
  externalId: z.string().min(1),
  docType: z.enum(["order", "rental", "invoice", "custom"]),
  /** 1С document date, ISO 8601. */
  date: z.string().datetime().optional(),
  counterparty: z.object({
    name: z.string().min(1),
    inn: z.string().min(1).optional(),
    phone: z.string().optional(),
    email: z.string().email().optional(),
  }),
  lines: z
    .array(
      z.object({
        /** Our SKU; 1С maps it to its own nomenclature. */
        sku: z.string().min(1),
        name: z.string().optional(),
        quantity: z.number().positive(),
        price: z.number().nonnegative(),
        discountPercent: z.number().min(0).max(100).optional(),
      }),
    )
    .min(1),
  total: z.number().nonnegative().optional(),
  comment: z.string().optional(),
  /** Free-form extension bag so schema evolution doesn't break the wire. */
  metadata: z.record(z.unknown()).optional(),
});
export type OnecOrderPayload = z.infer<typeof onecOrderPayloadSchema>;

/** What 1С answers after an upsert (shape is agreed with the 1С developer). */
export const onecUpsertResultSchema = z.object({
  ok: z.boolean().optional(),
  /** 1С document ref (GUID) or code. */
  ref: z.string().min(1),
  number: z.string().optional(),
  /** When 1С already had this externalId → true (idempotent replay). */
  alreadyExisted: z.boolean().optional(),
});
export type OnecUpsertResult = z.infer<typeof onecUpsertResultSchema>;

export type OnecPingResult = {
  ok: boolean;
  serviceName: string;
  raw: unknown;
};
