import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import { buildTelegramDataCheckString, computeTelegramWebAppHash } from "@/lib/telegram-webapp-auth";

function signInitData(initDataWithoutHash: string, botToken: string): string {
  const { dataCheckString } = buildTelegramDataCheckString(initDataWithoutHash);
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  return createHmac("sha256", secret).update(dataCheckString).digest("hex");
}

describe("Telegram WebApp initData validation", () => {
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
});
