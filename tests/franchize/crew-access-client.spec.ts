/**
 * tests/franchize/crew-access-client.spec.ts
 *
 * Тесты общего client-probe crew-доступа (lib/crew-access-client.ts) —
 * «достижения только для экипажа» + оптимизация сети:
 *  1. Single-flight: N одновременных вызовов = 1 сетевой запрос.
 *  2. TTL: успех кэшируется, по истечении — новый запрос.
 *  3. Ошибка сети → canOpen:false, короткий TTL, быстрый ретрай.
 *  4. invalidate(slug)/invalidate() сбрасывают кэш.
 *  5. Пустой/пробельный slug — без сетевого вызова, canOpen:false.
 *  6. canOpen/falsy-ответы сервера маппятся в boolean без "success".
 */

import { describe, expect, it, vi } from "vitest";
import {
  createCrewAccessProbe,
  CREW_ACCESS_TTL_MS,
  CREW_ACCESS_ERROR_TTL_MS,
} from "@/app/franchize/lib/crew-access-client";

describe("crew-access-client probe", () => {
  it("single-flight: одновременные вызовы делят один сетевой запрос", async () => {
    const fetcher = vi.fn(async () => ({ canOpen: true, role: "admin" }));
    const { probe } = createCrewAccessProbe(fetcher);

    const [a, b, c] = await Promise.all([probe("crew"), probe("crew"), probe("crew")]);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(a).toEqual({ canOpen: true, role: "admin" });
    expect(b).toEqual({ canOpen: true, role: "admin" });
    expect(c).toEqual({ canOpen: true, role: "admin" });
  });

  it("TTL: успешный ответ кэшируется, после истечения — новый запрос", async () => {
    vi.useFakeTimers();
    try {
      const fetcher = vi.fn(async () => ({ canOpen: true }));
      const { probe } = createCrewAccessProbe(fetcher);

      await probe("crew");
      await probe("crew");
      expect(fetcher).toHaveBeenCalledTimes(1);

      // «Ждём» дольше TTL успеха — кэш истёк, фетчер зовётся снова.
      vi.setSystemTime(Date.now() + CREW_ACCESS_TTL_MS + 1);
      await probe("crew");
      expect(fetcher).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("ошибка сети → canOpen:false и НЕ прокидывается наверх", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("network down");
    });
    const { probe } = createCrewAccessProbe(fetcher);

    const res = await probe("crew");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(res).toEqual({ canOpen: false });
  });

  it("ошибка кэшируется коротко: после ERROR-TTL ретрай уходит на сервер", async () => {
    vi.useFakeTimers();
    try {
      let calls = 0;
      const fetcher = vi.fn(async () => {
        calls += 1;
        if (calls === 1) throw new Error("flaky");
        return { canOpen: true };
      });
      const { probe } = createCrewAccessProbe(fetcher);

      const first = await probe("crew");
      expect(first.canOpen).toBe(false);

      // До истечения короткого TTL — повторов нет.
      await probe("crew");
      expect(fetcher).toHaveBeenCalledTimes(1);

      // «Ждём» ERROR_TTL_MS — ретрай уходит и возвращает уже успех.
      vi.setSystemTime(Date.now() + CREW_ACCESS_ERROR_TTL_MS + 1);
      const second = await probe("crew");
      expect(fetcher).toHaveBeenCalledTimes(2);
      expect(second.canOpen).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("invalidate(slug) сбрасывает только указанный slug", async () => {
    const fetcher = vi.fn(async (slug: string) => ({ canOpen: slug === "a" }));
    const { probe, invalidate } = createCrewAccessProbe(fetcher);

    await probe("a");
    await probe("b");
    expect(fetcher).toHaveBeenCalledTimes(2);

    invalidate("a");
    await probe("a");
    await probe("b");
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher).toHaveBeenNthCalledWith(3, "a");
  });

  it("invalidate() без аргументов чистит весь кэш", async () => {
    const fetcher = vi.fn(async () => ({ canOpen: true }));
    const { probe, invalidate } = createCrewAccessProbe(fetcher);

    await probe("a");
    await probe("b");
    invalidate();
    await Promise.all([probe("a"), probe("b")]);
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it("пустой slug — без сетевого вызова", async () => {
    const fetcher = vi.fn(async () => ({ canOpen: true }));
    const { probe } = createCrewAccessProbe(fetcher);

    const res = await probe("   ");
    expect(fetcher).not.toHaveBeenCalled();
    expect(res.canOpen).toBe(false);
  });

  it("серверные falsy-ответы маппятся в canOpen:false без success-поля", async () => {
    const fetcher = vi.fn(async () => ({ canOpen: false, role: undefined }));
    const { probe } = createCrewAccessProbe(fetcher);

    const res = await probe("crew");
    expect(res.canOpen).toBe(false);
    expect(res.role).toBeUndefined();
  });
});
