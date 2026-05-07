import { createHmac } from "crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isTrustedTelegramBypassDeployment } from "@/lib/telegram-bypass-context";
import { isAllowedMockContext } from "@/lib/telegram-mock-context";
import { buildTelegramDataCheckString, computeTelegramWebAppHash } from "@/lib/telegram-webapp-auth";

function signInitData(initDataWithoutHash: string, botToken: string): string {
  const { dataCheckString } = buildTelegramDataCheckString(initDataWithoutHash);
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

  it("builds Telegram data-check-string by sorting fields and excluding hash/signature", () => {
    const hash = signInitData(initDataWithoutHash, botToken);
    const initData = `${initDataWithoutHash}&hash=${hash}`;

    expect(buildTelegramDataCheckString(initData)).toEqual({
      hashFromClient: hash,
      dataCheckString: `auth_date=1710000000\nquery_id=AAHdF6IQAAAAAN0XohDhrOrc\nuser=${user}`,
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
