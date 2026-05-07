export interface TelegramLaunchParams {
  initData: string | null;
  startParam: string | null;
}

function readLaunchParam(params: URLSearchParams, key: string): string | null {
  const value = params.get(key);
  return value && value.trim() ? value : null;
}

function collectParamsFromUrl(url: string): URLSearchParams[] {
  try {
    const parsed = new URL(url, "https://telegram.local");
    const paramSets = [parsed.searchParams];
    const hash = parsed.hash.replace(/^#/, "");

    if (hash) {
      paramSets.push(new URLSearchParams(hash));
    }

    return paramSets;
  } catch {
    return [];
  }
}

export function extractTelegramLaunchParams(url: string): TelegramLaunchParams {
  const paramSets = collectParamsFromUrl(url);
  let initData: string | null = null;
  let startParam: string | null = null;

  for (const params of paramSets) {
    initData ??= readLaunchParam(params, "tgWebAppData");
    startParam ??= readLaunchParam(params, "tgWebAppStartParam");
  }

  return { initData, startParam };
}

export function getTelegramLaunchParamsFromWindow(): TelegramLaunchParams {
  if (typeof window === "undefined") {
    return { initData: null, startParam: null };
  }

  return extractTelegramLaunchParams(window.location.href);
}
