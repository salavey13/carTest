import {
  captureBrowserMarketingAttribution,
  captureMarketingAttribution,
  getBrowserMarketingAttribution,
  MARKETING_ATTRIBUTION_STORAGE_KEY,
  marketingTouchFromUrl,
  readMarketingAttribution,
} from "../../lib/marketing-attribution";
import {
  buildVipBikeCallbackMessage,
  callbackLeadRequestSchema,
} from "../../lib/vip-bike-callback-lead";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    data,
  };
}

describe("VIP BIKE marketing attribution", () => {
  test("captures Direct parameters and keeps first/last touch", () => {
    const storage = memoryStorage();
    const firstAt = new Date("2026-08-14T09:00:00.000Z");
    const first = captureMarketingAttribution(
      storage,
      "https://rental.vip-bike.ru/franchize/vip-bike?utm_source=yandex&utm_medium=cpc&utm_campaign=rental-app-search&utm_term=%D0%B0%D1%80%D0%B5%D0%BD%D0%B4%D0%BE%D0%B2%D0%B0%D1%82%D1%8C+%D0%BC%D0%BE%D1%82%D0%BE&yclid=12345",
      "https://yandex.ru/search/",
      firstAt,
    );

    expect(first?.first_touch).toMatchObject({
      utm_source: "yandex",
      utm_medium: "cpc",
      utm_campaign: "rental-app-search",
      utm_term: "арендовать мото",
      yclid: "12345",
      landing_path: "/franchize/vip-bike",
      referrer_host: "yandex.ru",
    });

    const second = captureMarketingAttribution(
      storage,
      "https://rental.vip-bike.ru/?utm_source=vk&utm_medium=paid&utm_campaign=retarget",
      "",
      new Date("2026-08-15T09:00:00.000Z"),
    );

    expect(second?.first_touch.utm_source).toBe("yandex");
    expect(second?.last_touch).toMatchObject({
      utm_source: "vk",
      utm_medium: "paid",
      utm_campaign: "retarget",
    });
    expect(storage.data.has(MARKETING_ATTRIBUTION_STORAGE_KEY)).toBe(true);
  });

  test("ignores visits without campaign signals and expires stored data", () => {
    const storage = memoryStorage();
    expect(
      marketingTouchFromUrl("https://rental.vip-bike.ru/franchize/vip-bike"),
    ).toBeNull();
    expect(
      captureMarketingAttribution(
        storage,
        "https://rental.vip-bike.ru/franchize/vip-bike",
      ),
    ).toBeNull();

    captureMarketingAttribution(
      storage,
      "https://rental.vip-bike.ru/?yclid=123",
      "",
      new Date("2026-01-01T00:00:00.000Z"),
    );
    expect(
      readMarketingAttribution(storage, new Date("2026-08-01T00:00:00.000Z")),
    ).toBeNull();
  });

  test("fails open when browser storage is unavailable", () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("Storage blocked", "SecurityError");
      },
    });

    try {
      expect(getBrowserMarketingAttribution()).toBeNull();
      expect(captureBrowserMarketingAttribution()).toBeNull();
    } finally {
      if (descriptor) Object.defineProperty(window, "localStorage", descriptor);
    }
  });
});

describe("VIP BIKE callback lead payload", () => {
  test("builds a plain Telegram message with campaign details and no emoji", () => {
    const attribution = {
      first_touch: {
        landing_path: "/franchize/vip-bike",
        captured_at: "2026-08-14T09:00:00.000Z",
        utm_source: "yandex",
        utm_medium: "cpc",
        utm_campaign: "rental-app-search",
        utm_term: "арендовать мото в нижнем",
        yclid: "12345",
      },
      last_touch: {
        landing_path: "/franchize/vip-bike",
        captured_at: "2026-08-14T09:00:00.000Z",
        utm_source: "yandex",
        utm_medium: "cpc",
        utm_campaign: "rental-app-search",
        utm_term: "арендовать мото в нижнем",
        yclid: "12345",
      },
      expires_at: "2027-02-10T09:00:00.000Z",
    };

    const message = buildVipBikeCallbackMessage({
      name: "Иван",
      phone: "+79991234567",
      bikeTitle: "Falcon GT",
      sourceRoute: "/franchize/vip-bike?utm_source=yandex",
      attribution,
      createdAt: "2026-08-14T09:05:00.000Z",
    });

    expect(message).toContain("Кампания: rental-app-search");
    expect(message).toContain("Запрос: арендовать мото в нижнем");
    expect(message).toContain("yclid: 12345");
    expect(message).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  });

  test("rejects short phones and unknown payload fields", () => {
    expect(
      callbackLeadRequestSchema.safeParse({
        slug: "vip-bike",
        name: "Иван",
        phone: "123",
        consent: true,
      }).success,
    ).toBe(false);
    expect(
      callbackLeadRequestSchema.safeParse({
        slug: "vip-bike",
        name: "Иван",
        phone: "+79991234567",
        consent: true,
        unexpected: true,
      }).success,
    ).toBe(false);
    expect(
      callbackLeadRequestSchema.safeParse({
        slug: "another-crew",
        name: "Иван",
        phone: "+79991234567",
        consent: true,
      }).success,
    ).toBe(false);
  });

  test("removes line breaks from user-controlled Telegram fields", () => {
    const message = buildVipBikeCallbackMessage({
      name: "Иван\nПоддельное поле: да",
      phone: "+79991234567",
      bikeTitle: "Falcon GT\r\nКампания: подмена",
      createdAt: "2026-08-14T09:05:00.000Z",
    });

    expect(message).toContain("Имя: Иван Поддельное поле: да");
    expect(message).toContain("Байк: Falcon GT Кампания: подмена");
  });

  test("keeps Telegram notifications within the platform limit", () => {
    const longValue = "а".repeat(500);
    const touch = {
      landing_path: `/${longValue}`,
      captured_at: "2026-08-14T09:00:00.000Z",
      utm_source: longValue,
      utm_medium: longValue,
      utm_campaign: longValue,
      utm_content: longValue,
      utm_term: longValue,
      yclid: longValue,
      campaign_id: longValue,
      ad_id: longValue,
      adgroup_id: longValue,
      gbid: longValue,
      keyword: longValue,
      device: longValue,
      region_name: longValue,
      referrer_host: longValue,
    };
    const message = buildVipBikeCallbackMessage({
      name: "Иван",
      phone: "+79991234567",
      bikeTitle: "Falcon GT",
      attribution: {
        first_touch: touch,
        last_touch: touch,
        expires_at: "2027-02-10T09:00:00.000Z",
      },
      createdAt: "2026-08-14T09:05:00.000Z",
    });

    expect(message.length).toBeLessThanOrEqual(4_096);
    expect(message).toContain("[сообщение сокращено]");
  });
});
