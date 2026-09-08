import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

import { NextRequest } from "next/server";

/**
 * Regression specs: Avito-originated leads must get a phone whenever the
 * buyer types one into the chat (Avito's API never exposes it directly).
 * Covers: first-message extraction (v3/monitor), late-message backfill
 * (updateLead) and bot_forward with phone only in the text.
 */

const mocks = vi.hoisted(() => ({
  builders: [] as any[],
  calls: {
    insert: [] as any[],
    update: [] as any[],
  },
  existingLead: null as { id: string; metadata: Record<string, unknown> } | null,
}));

vi.mock("@/lib/supabase-server", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === "crews" || table === "crew_members") {
        // notifyCrewOwnerAsync path (fire-and-forget) — just give it an empty
        // roster so it exits quickly and quietly.
        const builder: any = {};
        builder.select = () => builder;
        builder.eq = () => builder;
        builder.maybeSingle = async () => ({ data: null, error: null });
        return builder;
      }
      if (table !== "franchize_intents") {
        throw new Error(`Unexpected table: ${table}`);
      }
      const builder: any = {};
      builder.select = () => builder;
      builder.eq = () => builder;
      builder.filter = () => builder;
      builder.order = () => builder;
      builder.limit = () => builder;
      builder.maybeSingle = async () => ({ data: mocks.existingLead, error: null });
      builder.insert = (payload: any) => {
        mocks.calls.insert.push(payload);
        return { error: null };
      };
      builder.update = (payload: any) => {
        mocks.calls.update.push(payload);
        return builder;
      };
      mocks.builders.push(builder);
      return builder;
    },
  },
}));

vi.mock("@/app/franchize/lib/lead-events", () => ({
  recordLeadEvent: vi.fn(async () => true),
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { POST } from "../../app/api/webhooks/avito/route";

function monitorMessage(body: Record<string, unknown>) {
  return new NextRequest("https://rental.vip-bike.ru/api/webhooks/avito", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function firstMessage(text: string, chatId = "zz-spec-chat") {
  return monitorMessage({
    id: `monitor:rental:${chatId}:1788900000`,
    version: "3.0.0",
    payload: {
      type: "message",
      value: {
        chat_id: chatId,
        author_id: 1001,
        buyer_id: 1001,
        created: "2026-09-08T07:00:00Z",
        type: "text",
        item_title: "Прокат мотоциклов",
        text,
      },
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.builders.length = 0;
  mocks.calls.insert.length = 0;
  mocks.calls.update.length = 0;
  mocks.existingLead = null;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("avito webhook → phone from message text", () => {
  test("first message with a phone in the text creates a lead WITH phone", async () => {
    const response = await POST(
      firstMessage("Добрый день! Сколько стоит аренда? Мой номер +7 912 345-67-89"),
    );
    expect(response.status).toBe(200);

    expect(mocks.calls.insert).toHaveLength(1);
    const inserted = mocks.calls.insert[0];
    expect(inserted.phone).toBe("+79123456789");
    expect(inserted.metadata.phone).toBe("+79123456789");
    expect(inserted.metadata.phoneSource).toBe("message_text");
  });

  test("first message without any phone keeps the lead phoneless", async () => {
    const response = await POST(firstMessage("Добрый день! До скольких работаете?"));
    expect(response.status).toBe(200);

    const inserted = mocks.calls.insert[0];
    expect(inserted.phone).toBeNull();
    expect(inserted.metadata.phone).toBeNull();
    expect(inserted.metadata.phoneSource).toBeUndefined();
  });

  test("a late message backfills the phone when the lead had none", async () => {
    mocks.existingLead = {
      id: "intent-1",
      metadata: { avitoChatId: "zz-spec-chat", phone: null, phoneSource: undefined },
    };

    const response = await POST(firstMessage("Да, берите — вот телефон 8-921-555-12-34"));
    expect(response.status).toBe(200);

    expect(mocks.calls.update).toHaveLength(1);
    const patch = mocks.calls.update[0];
    expect(patch.phone).toBe("+79215551234");
    expect(patch.metadata.phone).toBe("+79215551234");
    expect(patch.metadata.phoneSource).toBe("message_text");
  });

  test("an existing phone is never overwritten by later messages", async () => {
    mocks.existingLead = {
      id: "intent-1",
      metadata: { avitoChatId: "zz-spec-chat", phone: "+79001112233" },
    };

    const response = await POST(firstMessage("пересылаю ещё раз: 8 900 777-66-55"));
    expect(response.status).toBe(200);

    const patch = mocks.calls.update[0];
    // Column untouched, metadata keeps the operator-visible original.
    expect(patch.phone).toBeUndefined();
    expect(patch.metadata.phone).toBe("+79001112233");
    expect(patch.metadata.phoneSource).toBeUndefined();
  });

  test("bot_forward without an operator phone extracts it from the text", async () => {
    const response = await POST(
      monitorMessage({
        type: "bot_forward",
        text: "Покупатель спрашивает цену. Позвонить можно по 89112345678.",
        name: "Олег",
      }),
    );
    expect(response.status).toBe(200);

    const inserted = mocks.calls.insert[0];
    expect(inserted.phone).toBe("+79112345678");
    expect(inserted.metadata.phoneSource).toBe("message_text");
    expect(inserted.metadata.capturedVia).toBe("bot_forward");
  });

  test("operator-provided bot_forward phone wins over the text", async () => {
    const response = await POST(
      monitorMessage({
        type: "bot_forward",
        text: "телефон в тексте 89112345678",
        phone: "+79009876543",
      }),
    );
    expect(response.status).toBe(200);

    const inserted = mocks.calls.insert[0];
    expect(inserted.phone).toBe("+79009876543");
    expect(inserted.metadata.phoneSource).toBe("operator");
  });
});
