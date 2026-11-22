/**
 * ETM (ЭТМ, etm.ru) connector — data contracts.
 *
 * Two access modes are modeled explicitly:
 * - `public`  — no credentials needed: the public product cards (etm.ru/cat/nn/{code})
 *               expose retail/opt price tiers, stock and full specs without login.
 *               This is what we can use BEFORE the «Заявка на настройку ЭДО» is approved.
 * - `api`     — the partner API behind the ЭДО заявка (personal price tiers, orders,
 *               УПД document flow). Shape is defined here contract-first; the real
 *               transport is plugged in the day the методичка arrives.
 */

import { z } from "zod";

/** Price tier for one product code. */
export const etmPricePointSchema = z.object({
  kind: z.enum(["retail", "opt", "personal"]),
  amount: z.number().nonnegative(),
  currency: z.string().min(1).default("RUB"),
  /** Discount percent as shown on the card (e.g. 27 for «-27 %»), if present. */
  discountPercent: z.number().min(0).max(100).nullish(),
  /** Cashback points ETM promises for the purchase, if present. */
  cashbackPoints: z.number().nonnegative().nullish(),
});
export type EtmPricePoint = z.infer<typeof etmPricePointSchema>;

export const etmStockSchema = z.object({
  availableToday: z.number().int().nonnegative().nullish(),
  availableLater: z.number().int().nonnegative().nullish(),
  /** Raw stock sentence from the card, kept for auditability. */
  raw: z.string().optional(),
});
export type EtmStock = z.infer<typeof etmStockSchema>;

/** A parsed public product card (one ETM product code). */
export const etmCardSnapshotSchema = z.object({
  /** ETM numeric product code («Код товара»), the stable card id. */
  code: z.string().min(1),
  url: z.string().url().optional(),
  title: z.string().optional(),
  article: z.string().optional(),
  brand: z.string().optional(),
  /** «Марка» on the card, e.g. ТМ-63. */
  mark: z.string().optional(),
  /** «Серия» on the card, e.g. PX. */
  series: z.string().optional(),
  unit: z.string().optional(),
  prices: z.array(etmPricePointSchema).default([]),
  stock: etmStockSchema.nullish(),
  /** Spec label → value pairs parsed from the card («Масса, кг» → «18.4», …). */
  specs: z.record(z.string()).default({}),
  parsedAt: z.string().optional(),
});
export type EtmCardSnapshot = z.infer<typeof etmCardSnapshotSchema>;

/** Search hit linking a human reference (марка+серия+арткул) to an ETM product code. */
export const etmSearchHitSchema = z.object({
  code: z.string().min(1),
  title: z.string().optional(),
  url: z.string().url().optional(),
});
export type EtmSearchHit = z.infer<typeof etmSearchHitSchema>;

/** Reference for finding a product without knowing the numeric code. */
export type EtmProductRef = {
  mark?: string;
  series?: string;
  article?: string;
  query?: string;
};

/** Order payload for the future partner API (заявка-gated; stubbed for now). */
export const etmOrderPayloadSchema = z.object({
  /** Our internal reference (request/rental id) for idempotent mapping. */
  externalId: z.string().min(1),
  lines: z
    .array(
      z.object({
        code: z.string().min(1),
        quantity: z.number().positive(),
        price: z.number().nonnegative().optional(),
      }),
    )
    .min(1),
  comment: z.string().optional(),
});
export type EtmOrderPayload = z.infer<typeof etmOrderPayloadSchema>;

export type EtmMode = "public" | "mock" | "api";
