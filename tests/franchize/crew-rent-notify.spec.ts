// tests/franchize/crew-rent-notify.spec.ts
//
// 2026-09-24 (owner request): «notify all members about new rents created via
// web app and send to crew email as well» + «give renter the powers» (odometer).
//
// Покрываем:
//   1. crew-rent-notify lib (behavior, с моками supabase/sendComplexMessage/
//      nodemailer/private-secrets):
//      • TG-сводка каждому АКТИВНОМУ члену экипажа, кроме excludeChatIds,
//        дедупликация, HTML parse mode, кнопка «Открыть сделку»,
//      • частичный фейл отправки — non-fatal, остальные доставлены,
//      • crew не найден / ошибка crew_members — never-throw,
//      • email → private.crew_secrets.email (фолбэк SMTP-аккаунт), subject
//        с байком, EMAIL_FROM; SMTP не сконфигурирован → письмо скипнуто.
//   2. Pure-билдеры: buildCrewNewRentMessage (Telegram HTML + экранирование),
//      buildCrewNewRentEmailText (plain text, без HTML-тегов).
//   3. Source-contracts:
//      • franchize-order webhook вызывает notifyCrewOfNewWebAppRental только
//        для не-sale флоу, в try/catch, с excludeChatIds = [renter, bike owner,
//        platform admin] (никто не пингуется дважды),
//      • rental-odometer route: рентер (rentals.user_id) и субарендатор
//        (cars.specs.subrenter_chat_id) допущены ПОДПИСАННОЙ кукой, crew-путь
//        verifyCrewAccess сохранён,
//      • rental page: guard одометра пускает роль "renter" + передаёт
//        рентер-идентичности в редактор,
//      • RentalOdometerInput: детект рентера + рентерские формулировки.

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => {
  type Chain = {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    /** Thenable — supabase builder is awaited directly for list queries. */
    then: PromiseLike<{ data: unknown; error: unknown }>["then"];
    __state: { result: { data: unknown; error: unknown } };
  };
  const makeChain = (): Chain => {
    const state = { result: { data: null as unknown, error: null as unknown } };
    const chain: Record<string, unknown> = {};
    chain.select = vi.fn(() => chain);
    chain.eq = vi.fn(() => chain);
    chain.maybeSingle = vi.fn(async () => state.result);
    (chain as { then: Chain["then"] }).then = (
      resolve: (v: { data: unknown; error: unknown }) => unknown,
      reject: (e: unknown) => unknown,
    ) => Promise.resolve(state.result).then(resolve, reject);
    (chain as { __state: typeof state }).__state = state;
    return chain as Chain;
  };
  return {
    supabaseTables: {} as Record<string, Chain>,
    privateTables: {} as Record<string, Chain>,
    makeChain,
    sendComplexMessage: vi.fn(async () => ({ success: true })),
    sendMail: vi.fn(async () => ({ messageId: "spec-mail" })),
  };
});

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/supabase-server", () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => {
      const tableMocks = mocks.supabaseTables as Record<string, ReturnType<typeof mocks.makeChain>>;
      if (!tableMocks[table]) tableMocks[table] = mocks.makeChain();
      return tableMocks[table];
    }),
  },
}));

vi.mock("@/lib/private-secrets", () => ({
  privateSchema: () => ({
    from: (table: string) => {
      const tableMocks = mocks.privateTables as Record<string, ReturnType<typeof mocks.makeChain>>;
      if (!tableMocks[table]) tableMocks[table] = mocks.makeChain();
      return tableMocks[table];
    },
  }),
}));

vi.mock("@/app/webhook-handlers/actions/sendComplexMessage", () => ({
  sendComplexMessage: mocks.sendComplexMessage,
}));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({ sendMail: mocks.sendMail })),
  },
}));

import {
  buildCrewNewRentEmailText,
  buildCrewNewRentMessage,
  notifyCrewOfNewWebAppRental,
} from "@/app/franchize/lib/crew-rent-notify";
import { logger } from "@/lib/logger";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

function setChain(table: string, result: { data?: unknown; error?: unknown }, scope: Record<string, ReturnType<typeof mocks.makeChain>> = mocks.supabaseTables) {
  if (!scope[table]) scope[table] = mocks.makeChain();
  (scope[table].maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({
    data: result?.data ?? null,
    error: result?.error ?? null,
  });
  (scope[table] as unknown as { __state: { result: { data: unknown; error: unknown } } }).__state.result = {
    data: result?.data ?? null,
    error: result?.error ?? null,
  };
}

const SMTP_KEYS = [
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_YANDEX_USER",
  "SMTP_YANDEX_PASS",
  "SMTP_YANDEX_HOST",
  "SMTP_YANDEX_PORT",
  "SMTP_GMAIL_USER",
  "SMTP_GMAIL_PASS",
  "EMAIL_FROM",
];
let envSnapshot: Record<string, string | undefined> = {};

beforeEach(() => {
  envSnapshot = {};
  for (const key of SMTP_KEYS) {
    envSnapshot[key] = process.env[key];
    delete process.env[key];
  }
  mocks.sendComplexMessage.mockReset();
  mocks.sendComplexMessage.mockImplementation(async () => ({ success: true }));
  mocks.sendMail.mockReset();
  mocks.sendMail.mockImplementation(async () => ({ messageId: "spec-mail" }));
});

afterEach(() => {
  for (const key of SMTP_KEYS) {
    const value = envSnapshot[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.clearAllMocks();
});

const BASE_INPUT = {
  slug: "vip-bike",
  rentalId: "12345678-abcd-ef01-2345-6789abcdef01",
  bikeTitle: "Kawasaki EX650K",
  renterLabel: "@salavey13",
  renterPhone: "+7 900 000-00-00",
  startDate: "2026-09-25",
  endDate: "2026-09-28",
  totalRub: 12000,
  depositRub: 5000,
  appLink: "https://v0-car-test.vercel.app/franchize/vip-bike/rental/12345678-abcd-ef01-2345-6789abcdef01",
};

// ── 1. Pure builders ─────────────────────────────────────────────────────────

describe("crew-rent-notify — message builders", () => {
  it("TG message: header + facts + footer, HTML-escapes user fragments", () => {
    const text = buildCrewNewRentMessage({
      ...BASE_INPUT,
      renterLabel: "<script>alert(1)</script>",
    });
    expect(text).toContain("🆕");
    expect(text).toContain("Новая аренда через веб-приложение");
    expect(text).toContain("Kawasaki EX650K");
    expect(text).toContain("&lt;script&gt;");
    expect(text).not.toContain("<script>");
    expect(text).toMatch(/12\s000\s₽/);
    expect(text).toMatch(/5\s000\s₽/);
    expect(text).toContain("12345678");
    expect(text).toContain("Откройте карточку сделки");
  });

  it("TG message: footer without CTA line when appLink is absent", () => {
    const text = buildCrewNewRentMessage({ ...BASE_INPUT, appLink: null });
    expect(text).not.toContain("Откройте карточку сделки");
    expect(text).toContain("Проверьте документы и подтвердите выдачу.");
  });

  it("email text: plain, no HTML tags, carries the link", () => {
    const text = buildCrewNewRentEmailText(BASE_INPUT);
    expect(text).not.toMatch(/<[^>]+>/);
    expect(text).toContain("Kawasaki EX650K");
    expect(text).toContain(BASE_INPUT.appLink);
    expect(text).toContain("+7 900 000-00-00");
  });
});

// ── 2. Behavior ──────────────────────────────────────────────────────────────

describe("crew-rent-notify — notifyCrewOfNewWebAppRental", () => {
  it("sends the TG summary to every active member except excluded ids (deduped), with button + HTML", async () => {
    setChain("crews", { data: { id: "crew-1", slug: "vip-bike" } });
    setChain("crew_members", {
      data: [{ user_id: "m-1" }, { user_id: "m-2" }, { user_id: "m-2" }, { user_id: null }, { user_id: "m-3" }],
      error: null,
    });

    const res = await notifyCrewOfNewWebAppRental({
      ...BASE_INPUT,
      excludeChatIds: ["m-3", "999", null, undefined],
    });

    expect(res.notified.sort()).toEqual(["m-1", "m-2"]);
    expect(mocks.sendComplexMessage).toHaveBeenCalledTimes(2);
    const [chatId, text, buttons, opts] = mocks.sendComplexMessage.mock.calls[0];
    expect(chatId).toBe("m-1");
    expect(text).toContain("Новая аренда через веб-приложение");
    expect((opts as { parseMode?: string }).parseMode).toBe("HTML");
    // Inline keyboard — a reply keyboard would render a DEAD url button
    // (KeyboardButton has no url field; review 2026-09-24 finding #1).
    expect((opts as { keyboardType?: string }).keyboardType).toBe("inline");
    expect(buttons).toEqual([
      [{ text: "🏍 Открыть сделку", url: BASE_INPUT.appLink }],
    ]);
  });

  it("numeric excludeChatIds are String()-coerced before matching member ids", async () => {
    setChain("crews", { data: { id: "crew-1", slug: "vip-bike" } });
    setChain("crew_members", {
      data: [{ user_id: "12345" }, { user_id: "m-1" }],
      error: null,
    });

    const res = await notifyCrewOfNewWebAppRental({
      ...BASE_INPUT,
      excludeChatIds: [12345, null, undefined],
    });

    expect(res.notified).toEqual(["m-1"]);
    expect(mocks.sendComplexMessage).toHaveBeenCalledTimes(1);
    expect(mocks.sendComplexMessage.mock.calls[0][0]).toBe("m-1");
  });

  it("partial TG failure is non-fatal: successes still counted, failure logged", async () => {
    setChain("crews", { data: { id: "crew-1", slug: "vip-bike" } });
    setChain("crew_members", { data: [{ user_id: "m-1" }, { user_id: "m-2" }], error: null });
    mocks.sendComplexMessage.mockImplementation(async (chatId: string) => {
      if (chatId === "m-2") throw new Error("telegram down");
      return { success: true };
    });

    const res = await notifyCrewOfNewWebAppRental(BASE_INPUT);

    expect(res.notified).toEqual(["m-1"]);
    expect(logger.warn).toHaveBeenCalledWith(
      "[crew-rent-notify] member notify failed (non-fatal)",
      expect.objectContaining({ chatId: "m-2" }),
    );
  });

  it("explicit success:false reply also excluded from notified", async () => {
    setChain("crews", { data: { id: "crew-1", slug: "vip-bike" } });
    setChain("crew_members", { data: [{ user_id: "m-1" }], error: null });
    mocks.sendComplexMessage.mockImplementation(async () => ({ success: false, error: "blocked" }));

    const res = await notifyCrewOfNewWebAppRental(BASE_INPUT);
    expect(res.notified).toEqual([]);
  });

  it("crew not found → empty result, never throws", async () => {
    setChain("crews", { data: null });
    const res = await notifyCrewOfNewWebAppRental(BASE_INPUT);
    expect(res).toEqual({ notified: [], emailedTo: null });
    expect(mocks.sendComplexMessage).not.toHaveBeenCalled();
  });

  it("crew_members fetch error → empty result, never throws", async () => {
    setChain("crews", { data: { id: "crew-1", slug: "vip-bike" } });
    setChain("crew_members", { data: null, error: { message: "PGRST204" } });
    const res = await notifyCrewOfNewWebAppRental(BASE_INPUT);
    expect(res).toEqual({ notified: [], emailedTo: null });
  });

  it("missing slug/rentalId → skipped without touching supabase", async () => {
    const res = await notifyCrewOfNewWebAppRental({ ...BASE_INPUT, slug: "  " });
    expect(res).toEqual({ notified: [], emailedTo: null });
  });

  it("email goes to crew_secrets.email with EMAIL_FROM and the bike in subject", async () => {
    process.env.SMTP_USER = "ops@yandex.ru";
    process.env.SMTP_PASS = "secret";
    process.env.EMAIL_FROM = "noreply@onebike.pls";
    setChain("crews", { data: { id: "crew-1", slug: "vip-bike" } });
    setChain("crew_members", { data: [{ user_id: "m-1" }], error: null });
    setChain("crew_secrets", { data: { email: "crew@vip.bike" } }, mocks.privateTables);

    const res = await notifyCrewOfNewWebAppRental(BASE_INPUT);

    expect(res.emailedTo).toBe("crew@vip.bike");
    expect(mocks.sendMail).toHaveBeenCalledTimes(1);
    const mail = mocks.sendMail.mock.calls[0][0] as {
      from: string;
      to: string;
      subject: string;
      text: string;
    };
    expect(mail.to).toBe("crew@vip.bike");
    expect(mail.from).toBe("noreply@onebike.pls");
    expect(mail.subject).toContain("Kawasaki EX650K");
    expect(mail.subject).toContain("Новая аренда");
    expect(mail.text).toContain("Арендатор: @salavey13");
    expect(mail.text).toContain(BASE_INPUT.appLink);
  });

  it("email falls back to the SMTP account when crew_secrets has no email", async () => {
    process.env.SMTP_USER = "ops@yandex.ru";
    process.env.SMTP_PASS = "secret";
    setChain("crews", { data: { id: "crew-1", slug: "vip-bike" } });
    setChain("crew_members", { data: [{ user_id: "m-1" }], error: null });
    setChain("crew_secrets", { data: null }, mocks.privateTables);

    const res = await notifyCrewOfNewWebAppRental(BASE_INPUT);
    expect(res.emailedTo).toBe("ops@yandex.ru");
    expect((mocks.sendMail.mock.calls[0][0] as { to: string }).to).toBe("ops@yandex.ru");
  });

  it("SMTP unconfigured → email skipped, TG still delivered", async () => {
    setChain("crews", { data: { id: "crew-1", slug: "vip-bike" } });
    setChain("crew_members", { data: [{ user_id: "m-1" }], error: null });

    const res = await notifyCrewOfNewWebAppRental(BASE_INPUT);

    expect(mocks.sendMail).not.toHaveBeenCalled();
    expect(res.emailedTo).toBeNull();
    expect(res.notified).toEqual(["m-1"]);
  });

  it("SMTP send failure is non-fatal", async () => {
    process.env.SMTP_USER = "ops@yandex.ru";
    process.env.SMTP_PASS = "secret";
    setChain("crews", { data: { id: "crew-1", slug: "vip-bike" } });
    setChain("crew_members", { data: [{ user_id: "m-1" }], error: null });
    setChain("crew_secrets", { data: { email: "crew@vip.bike" } }, mocks.privateTables);
    mocks.sendMail.mockRejectedValueOnce(new Error("smtp 535"));

    const res = await notifyCrewOfNewWebAppRental(BASE_INPUT);
    expect(res.emailedTo).toBeNull();
    expect(res.notified).toEqual(["m-1"]);
  });
});

// ── 3. Source contracts ──────────────────────────────────────────────────────

describe("crew-rent-notify — source contracts", () => {
  it("crew-rent-notify lib: inline keyboard, bounded SMTP leg (source contract)", () => {
    const src = read("app/franchize/lib/crew-rent-notify.ts");
    expect(src).toContain('keyboardType: "inline"');
    expect(src).toContain("connectionTimeout");
    expect(src).toContain("socketTimeout");
    // audit-relevant: every member send goes through Promise.allSettled (no
    // unhandled rejection can escape)
    expect(src).toContain("Promise.allSettled");
  });

  it("rental-odometer route: draft save leaves an audit trail with the actor", () => {
    const src = read("app/api/franchize/rental-odometer/route.ts");
    expect(src).toContain('[rental-odometer] draft saved');
    expect(src).toContain("actor: access.ok ? access.userId : cookieUserId");
  });

  it("franchize-order webhook: crew notify for non-sale flows, exclusions + non-fatal wrapper", () => {
    const src = read("app/webhook-handlers/franchize-order.ts");
    expect(src).toMatch(/import\(\s*"@\/app\/franchize\/lib\/crew-rent-notify"\s*\)/);
    expect(src).toContain("notifyCrewOfNewWebAppRental({");
    expect(src).toContain('if (metadata.flowType !== "sale") {');
    expect(src).toContain("excludeChatIds: [userId, vehicle.owner_id, adminChatId]");
    expect(src).toMatch(/try \{[\s\S]*?notifyCrewOfNewWebAppRental[\s\S]*?\} catch \(notifyErr\)/);
    // no double pings: renter + bike owner + admin are the excluded set
    expect(src).toMatch(/excludeChatIds:\s*\[userId,\s*vehicle\.owner_id,\s*adminChatId\]/);
  });

  it("rental-odometer route: renter/subrenter allowed behind the SIGNED cookie, crew path intact", () => {
    const src = read("app/api/franchize/rental-odometer/route.ts");
    // signed-cookie identity is extracted explicitly
    expect(src).toContain("verifyTelegramActorCookieValue");
    expect(src).toContain("TELEGRAM_ACTOR_COOKIE");
    // renter path — rentals.user_id match
    expect(src).toContain("cookieUserId === rental.user_id");
    // subrenter path — cars.specs.subrenter_chat_id
    expect(src).toContain('?.["subrenter_chat_id"]');
    // crew path unchanged + rental select extended with user_id/vehicle_id
    expect(src).toContain("verifyCrewAccess(request, rental.crew_id ?? undefined)");
    expect(src).toContain("rental_id, crew_id, user_id, vehicle_id, status, metadata");
    // status guard intact
    expect(src).toContain('rental.status !== "active"');
  });

  it("rental page: odometer guard admits the renter; editor receives renter identities", () => {
    const src = read("app/franchize/[slug]/rental/[id]/page.tsx");
    expect(src).toContain('allowedRoles={["owner", "operator", "admin", "subrenter", "renter"]}');
    expect(src).toMatch(
      /<RentalOdometerInput[\s\S]*?renterId=\{rental\.renterId\}[\s\S]*?renterTelegramChatId=\{rental\.renterTelegramChatId\}/,
    );
  });

  it("RentalOdometerInput: renter detection + renter-worded hints", () => {
    const src = read("app/franchize/components/RentalOdometerInput.tsx");
    expect(src).toContain("isRenterViewer");
    expect(src).toContain("dbUser.user_id === renterId");
    expect(src).toContain("оператор увидит их при закрытии");
    expect(src).toContain("может быть удержано из депозита");
    // operator wording preserved for operator viewers
    expect(src).toContain("удержите из депозита");
  });
});
