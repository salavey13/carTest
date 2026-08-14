export const MARKETING_ATTRIBUTION_STORAGE_KEY = "vip-bike-marketing-attribution:v1";

const ATTRIBUTION_TTL_MS = 180 * 24 * 60 * 60 * 1000;
const MAX_VALUE_LENGTH = 500;

const TRACKING_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "yclid",
  "campaign_id",
  "ad_id",
  "adgroup_id",
  "gbid",
  "keyword",
  "device",
  "region_name",
] as const;

type TrackingParam = (typeof TRACKING_PARAMS)[number];

export type MarketingTouch = Partial<Record<TrackingParam, string>> & {
  landing_path: string;
  referrer_host?: string;
  captured_at: string;
};

export type MarketingAttribution = {
  first_touch: MarketingTouch;
  last_touch: MarketingTouch;
  expires_at: string;
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function cleanValue(value: string | null): string | undefined {
  const cleaned = value?.trim().replace(/[\u0000-\u001F\u007F]/g, "");
  return cleaned ? cleaned.slice(0, MAX_VALUE_LENGTH) : undefined;
}

function safeReferrerHost(referrer: string): string | undefined {
  if (!referrer) return undefined;
  try {
    return cleanValue(new URL(referrer).hostname);
  } catch {
    return undefined;
  }
}

function hasCampaignSignal(touch: MarketingTouch): boolean {
  return TRACKING_PARAMS.some((param) => Boolean(touch[param]));
}

export function marketingTouchFromUrl(
  rawUrl: string,
  referrer = "",
  capturedAt = new Date().toISOString(),
): MarketingTouch | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  const touch: MarketingTouch = {
    landing_path: `${url.pathname}${url.hash || ""}`.slice(0, MAX_VALUE_LENGTH),
    captured_at: capturedAt,
  };

  for (const param of TRACKING_PARAMS) {
    const value = cleanValue(url.searchParams.get(param));
    if (value) touch[param] = value;
  }

  const referrerHost = safeReferrerHost(referrer);
  if (referrerHost && referrerHost !== url.hostname) {
    touch.referrer_host = referrerHost;
  }

  return hasCampaignSignal(touch) ? touch : null;
}

function parseStoredAttribution(raw: string | null, nowMs: number): MarketingAttribution | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as MarketingAttribution;
    const expiresAt = Date.parse(parsed.expires_at);
    if (
      !parsed.first_touch ||
      !parsed.last_touch ||
      !Number.isFinite(expiresAt) ||
      expiresAt <= nowMs
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function captureMarketingAttribution(
  storage: StorageLike,
  rawUrl: string,
  referrer = "",
  now = new Date(),
): MarketingAttribution | null {
  const touch = marketingTouchFromUrl(rawUrl, referrer, now.toISOString());
  const existing = parseStoredAttribution(
    storage.getItem(MARKETING_ATTRIBUTION_STORAGE_KEY),
    now.getTime(),
  );

  if (!touch) return existing;

  const next: MarketingAttribution = {
    first_touch: existing?.first_touch ?? touch,
    last_touch: touch,
    expires_at: new Date(now.getTime() + ATTRIBUTION_TTL_MS).toISOString(),
  };
  storage.setItem(MARKETING_ATTRIBUTION_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function readMarketingAttribution(
  storage: Pick<Storage, "getItem">,
  now = new Date(),
): MarketingAttribution | null {
  return parseStoredAttribution(
    storage.getItem(MARKETING_ATTRIBUTION_STORAGE_KEY),
    now.getTime(),
  );
}

export function getBrowserMarketingAttribution(): MarketingAttribution | null {
  if (typeof window === "undefined") return null;
  try {
    return readMarketingAttribution(window.localStorage);
  } catch {
    return null;
  }
}

export function captureBrowserMarketingAttribution(): MarketingAttribution | null {
  if (typeof window === "undefined") return null;
  try {
    return captureMarketingAttribution(
      window.localStorage,
      window.location.href,
      document.referrer,
    );
  } catch {
    return null;
  }
}

export function attributionForEvent(attribution: MarketingAttribution | null) {
  if (!attribution) return {};
  const touch = attribution.last_touch;
  return {
    utm_source: touch.utm_source,
    utm_medium: touch.utm_medium,
    utm_campaign: touch.utm_campaign,
    utm_content: touch.utm_content,
    utm_term: touch.utm_term,
    yclid: touch.yclid,
    landing_path: attribution.first_touch.landing_path,
  };
}
