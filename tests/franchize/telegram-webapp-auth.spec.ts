import { createHmac } from "crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isTrustedTelegramBypassDeployment } from "@/lib/telegram-bypass-context";
import { isAllowedMockContext } from "@/lib/telegram-mock-context";
import { buildTelegramDataCheckString, computeTelegramWebAppHash, computeTelegramWebAppHashDiagnostics, explainTelegramHashMismatchReasons } from "@/lib/telegram-webapp-auth";
import { extractTelegramLaunchParams } from "@/lib/telegram-launch-params";

function signInitData(initDataWithoutHash: string, botToken: string): string {
  const { dataCheckString } = buildTelegramDataCheckString(initDataWithoutHash);
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  return createHmac("sha256", secret).update(dataCheckString).digest("hex");
}

function signLegacyInitDataWithoutSignature(initDataWithoutHash: string, botToken: string): string {
  const params = new URLSearchParams(initDataWithoutHash);
  params.delete("signature");
  const keys = Array.from(params.keys()).sort();
  const dataCheckString = keys.map((key) => `${key}=${params.get(key)}`).join("\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  return createHmac("sha256", secret).update(dataCheckString).digest("hex");
}

describe("Telegram WebApp initData validation", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });
  const botToken = "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11";
  const user = JSON.stringify({ id: 413553377, first_name: "Mock", username: "mockuser", language_code: "ru" });
  const initDataWithoutHash = new URLSearchParams({
    query_id: "AAHdF6IQAAAAAN0XohDhrOrc",
    user,
    auth_date: "1710000000",
    signature: "ignored-third-party-signature",
  }).toString();

  it("builds Telegram data-check-string by sorting fields and excluding only hash", () => {
    const hash = signInitData(initDataWithoutHash, botToken);
    const initData = `${initDataWithoutHash}&hash=${hash}`;

    expect(buildTelegramDataCheckString(initData)).toEqual({
      hashFromClient: hash,
      dataCheckString: `auth_date=1710000000
query_id=AAHdF6IQAAAAAN0XohDhrOrc
signature=ignored-third-party-signature
user=${user}`,
    });
  });

  it("rejects legacy signatures that omit Telegram's third-party signature field", async () => {
    const legacyHash = signLegacyInitDataWithoutSignature(initDataWithoutHash, botToken);
    const result = await computeTelegramWebAppHash(`${initDataWithoutHash}&hash=${legacyHash}`, botToken);

    expect(result.isValid).toBe(false);
    expect(result.computedHash).not.toBe(legacyHash);
  });

  it("signs every duplicate query pair instead of collapsing to params.get(key)", async () => {
    const duplicatePayload = "auth_date=1710000000&tag=a&tag=b&user=" + encodeURIComponent(user);
    const dataCheckString = `auth_date=1710000000
tag=a
tag=b
user=${user}`;
    const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
    const hash = createHmac("sha256", secret).update(dataCheckString).digest("hex");

    expect(buildTelegramDataCheckString(`${duplicatePayload}&hash=${hash}`)).toEqual({
      hashFromClient: hash,
      dataCheckString,
    });
    await expect(computeTelegramWebAppHash(`${duplicatePayload}&hash=${hash}`, botToken)).resolves.toMatchObject({
      isValid: true,
      computedHash: hash,
    });
  });

  it("produces a mismatch variant matrix for production sha debugging", () => {
    const legacyHash = signLegacyInitDataWithoutSignature(initDataWithoutHash, botToken);
    const diagnostics = computeTelegramWebAppHashDiagnostics(`${initDataWithoutHash}&hash=${legacyHash}`, botToken);

    expect(diagnostics.hashFromClient).toBe(legacyHash);
    expect(diagnostics.variants.map((variant) => variant.id)).toEqual([
      "official_include_signature_exclude_hash",
      "legacy_exclude_signature_and_hash",
      "wrong_reversed_derivation",
      "wrong_direct_bot_token_key",
      "wrong_direct_webappdata_key",
      "wrong_sha256_token_secret",
      "wrong_include_hash",
      "wrong_preserve_input_order",
    ]);
    expect(diagnostics.variants.find((variant) => variant.id === "legacy_exclude_signature_and_hash")).toMatchObject({
      matches: true,
      excludedFields: ["signature", "hash"],
    });
    expect(explainTelegramHashMismatchReasons()).toEqual(
      expect.arrayContaining([expect.stringContaining("Wrong bot token or wrong bot/environment")]),
    );
  });

  it("extracts initData and start_param from Telegram launch URL hash fallback", () => {
    const launchInitData = new URLSearchParams({
      query_id: "AAE_HASH_FALLBACK",
      user,
      auth_date: "1710000000",
    }).toString();
    const href = `https://vip-bike.ee/franchize/vip-bike#tgWebAppData=${encodeURIComponent(launchInitData)}&tgWebAppStartParam=mapriders_vip-bike`;

    expect(extractTelegramLaunchParams(href)).toEqual({
      initData: launchInitData,
      startParam: "mapriders_vip-bike",
    });
  });

  it("validates HMAC using WebAppData as key and bot token as message", async () => {
    const hash = signInitData(initDataWithoutHash, botToken);
    const result = await computeTelegramWebAppHash(`${initDataWithoutHash}&hash=${hash}`, botToken);

    expect(result.isValid).toBe(true);
    expect(result.computedHash).toBe(hash);
  });

  it("rejects tampered initData", async () => {
    const hash = signInitData(initDataWithoutHash, botToken);
    const tampered = `${initDataWithoutHash.replace("mockuser", "hackerboy")}&hash=${hash}`;
    const result = await computeTelegramWebAppHash(tampered, botToken);

    expect(result.isValid).toBe(false);
    expect(result.computedHash).not.toBe(hash);
  });

  it("recreates a live-like WebApp initData payload and validates it end-to-end", async () => {
    const liveLikePayload = new URLSearchParams({
      auth_date: String(Math.floor(Date.now() / 1000)),
      chat_type: "sender",
      query_id: "AAEAAAEAAAA_LIFELINE_FIXTURE",
      start_param: "mapriders_vip-bike",
      user: JSON.stringify({
        id: 417553377,
        first_name: "Pavel",
        last_name: "Preview",
        username: "salavey13",
        language_code: "ru",
        allows_write_to_pm: true,
      }),
    }).toString();
    const hash = signInitData(liveLikePayload, botToken);
    const initData = `${liveLikePayload}&hash=${hash}`;

    await expect(computeTelegramWebAppHash(initData, botToken)).resolves.toMatchObject({
      isValid: true,
      hashFromClient: hash,
      computedHash: hash,
    });
  });

  it("gates mock-user auth to preview/development and blocks production spoof attempts", async () => {
    const buildMockInitData = (username = "mockuser") => {
      const payload = new URLSearchParams({
        query_id: "AAE_MOCK_USER_EDGE_CASE",
        user: JSON.stringify({
          id: 413553377,
          first_name: "Mock",
          username,
          language_code: "ru",
        }),
        auth_date: "1710000000",
      }).toString();
      return `${payload}&hash=${signInitData(payload, botToken)}`;
    };

    const validateMockUserAttempt = async ({
      vercelEnv,
      initData,
      href = "/",
    }: {
      vercelEnv: "preview" | "development" | "production";
      initData: string;
      href?: string;
    }) => {
      vi.stubEnv("VERCEL_ENV", vercelEnv);
      vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", vercelEnv);
      window.history.replaceState({}, "", href);

      const validation = await computeTelegramWebAppHash(initData, botToken);

      return {
        isValid: isAllowedMockContext() && validation.isValid,
        hmacIsValid: validation.isValid,
        mockContextAllowed: isAllowedMockContext(),
      };
    };

    const validMockInitData = buildMockInitData();
    const tamperedMockInitData = validMockInitData.replace("mockuser", "hackerboy");

    await expect(
      validateMockUserAttempt({ vercelEnv: "preview", initData: validMockInitData }),
    ).resolves.toMatchObject({ isValid: true, hmacIsValid: true, mockContextAllowed: true });

    await expect(
      validateMockUserAttempt({ vercelEnv: "development", initData: validMockInitData }),
    ).resolves.toMatchObject({ isValid: true, hmacIsValid: true, mockContextAllowed: true });

    await expect(
      validateMockUserAttempt({ vercelEnv: "production", initData: validMockInitData }),
    ).resolves.toMatchObject({ isValid: false, hmacIsValid: true, mockContextAllowed: false });

    await expect(
      validateMockUserAttempt({ vercelEnv: "production", initData: tamperedMockInitData }),
    ).resolves.toMatchObject({ isValid: false, hmacIsValid: false, mockContextAllowed: false });

    await expect(
      validateMockUserAttempt({
        vercelEnv: "production",
        initData: validMockInitData,
        href: "/franchize/vip-bike/map-riders?salavey13",
      }),
    ).resolves.toMatchObject({ isValid: false, hmacIsValid: true, mockContextAllowed: false });
  });

  it("does not trust caller-controlled query/origin markers for server bypass", () => {
    vi.stubEnv("TEMP_BYPASS_TG_AUTH_VALIDATION", "true");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VERCEL_URL", "vip-bike.ee/api/validate-telegram-auth?salavey13");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://vip-bike.ee");

    expect(isTrustedTelegramBypassDeployment()).toBe(false);
  });

  it("allows bypass only from server-known preview deployment metadata or exact allowlist", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_URL", "v0-car-test-git-fix-auth-salavey13s-projects.vercel.app");
    expect(isTrustedTelegramBypassDeployment()).toBe(true);

    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VERCEL_URL", "vip-bike.ee");
    vi.stubEnv("TELEGRAM_AUTH_BYPASS_ALLOWED_HOSTS", "preview-auth.vip-bike.ee");
    expect(isTrustedTelegramBypassDeployment()).toBe(false);

    vi.stubEnv("VERCEL_URL", "preview-auth.vip-bike.ee");
    expect(isTrustedTelegramBypassDeployment()).toBe(true);
  });
});
