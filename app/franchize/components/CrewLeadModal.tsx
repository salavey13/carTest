"use client";

// /app/franchize/components/CrewLeadModal.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Working CTA-форма лендингов зелёных экипажей (task205, 2026-11-23; босс:
// «polish landings once more, make working CTAs like moto-selection form»).
//
// Механика 1:1 с app/moto-selection/FeedbackModal.tsx (boss 2026-10-26:
// «reuse our existing mechanics») — POST в crew-generic эндпоинт
// /api/franchize/callback-lead, который валидирует телефон, пишет lead в
// franchize_intents (CRM экипажа), резолвит получателей через
// resolveLeadNotifyRecipients(slug) (владелец + админы + активные члены —
// future owner экипажа получит заявку сразу после настройки) и шлёт
// ADMIN_CHAT_ID (salavey13). Ноль нового серверного кода.
//
// Отличия от moto-selection-версии: палитра из crews.metadata (accent +
// accentSoft вместо фиксированного оранжевого), eyebrow — имя экипажа,
// formSource "crew-landing". Триггер тот же: клик-делегация на
// [data-lead-modal-open] — лендинг остаётся серверным компонентом.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2, X } from "lucide-react";

type Phase = "idle" | "sending" | "success" | "error";

export default function CrewLeadModal({
  slug,
  name,
  accent,
  accentSoft,
}: {
  /** Crew slug — из него резолвятся получатели заявки. */
  slug: string;
  /** Имя экипажа для eyebrow и fallback-заголовка. */
  name: string;
  /** Акцент палитры экипажа (кнопка/фокус/чекбокс). */
  accent: string;
  /** Мягкий стоп градиента кнопки (accentSoft лендинга). */
  accentSoft: string;
}) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [user, setUser] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    if (phase === "error") {
      setPhase("idle");
      setErrorMsg("");
    }
  }, [phase]);

  // Триггер открытия: клик-делегация на [data-lead-modal-open] (RSC-кнопки).
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.("[data-lead-modal-open]");
      if (!el) return;
      e.preventDefault();
      setOpen(true);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  // ESC + блокировка скролла + автоподсветка имени.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => nameRef.current?.focus(), 120);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      window.clearTimeout(t);
    };
  }, [open, close]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phase === "sending") return;
    setErrorMsg("");
    if (user.trim().length < 2) {
      setPhase("error");
      setErrorMsg("Укажите имя (минимум 2 буквы)");
      return;
    }
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setPhase("error");
      setErrorMsg("Укажите телефон — минимум 10 цифр");
      return;
    }
    if (!consent) {
      setPhase("error");
      setErrorMsg("Нужно согласие на обработку персональных данных");
      return;
    }
    setPhase("sending");
    try {
      const resp = await fetch("/api/franchize/callback-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          name: user.trim(),
          phone: phone.trim(),
          consent: true,
          formSource: "crew-landing",
          landingPath: `/${slug}`,
        }),
      });
      const data = (await resp.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
      };
      if (!resp.ok || data.success === false) {
        throw new Error(data.error || "Не удалось отправить заявку, попробуйте ещё раз");
      }
      setPhase("success");
      setUser("");
      setPhone("");
      setConsent(false);
    } catch (err) {
      setPhase("error");
      setErrorMsg(err instanceof Error ? err.message : "Что-то пошло не так, попробуйте ещё раз");
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center p-3 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Форма заявки"
    >
      <style>{`
        @keyframes crewLeadFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes crewLeadPop {
          from { opacity: 0; transform: translateY(14px) scale(.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      {/* backdrop */}
      <button
        aria-label="Закрыть"
        onClick={close}
        className="absolute inset-0 cursor-default bg-black/75 backdrop-blur-sm"
        style={{ animation: "crewLeadFade .18s ease-out" }}
      />

      <div
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#0c0c0c] shadow-[0_24px_80px_rgba(0,0,0,0.7)]"
        style={{ animation: "crewLeadPop .22s cubic-bezier(.2,.9,.3,1.2)" }}
      >
        {/* акцентная линия сверху */}
        <div
          className="h-1 w-full"
          style={{ background: `linear-gradient(90deg, ${accentSoft}, ${accent})` }}
          aria-hidden
        />

        <button
          onClick={close}
          aria-label="Закрыть"
          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:text-white active:scale-95"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>

        <div className="p-6 sm:p-8">
          {phase === "success" ? (
            <div className="flex flex-col items-center py-6 text-center">
              <span
                className="inline-flex h-16 w-16 items-center justify-center rounded-full"
                style={{ background: `linear-gradient(135deg, ${accentSoft}, ${accent})` }}
              >
                <Check className="h-8 w-8 text-white" aria-hidden />
              </span>
              <h3 className="mt-5 text-xl font-black uppercase tracking-tight text-white">
                Заявка отправлена!
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-white/60">
                {name} перезвонит Вам в течение дня. Если вопрос срочный — напишите в Telegram, отвечаем быстрее.
              </p>
              <button
                onClick={close}
                className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-full border border-white/20 text-sm font-bold uppercase tracking-[0.08em] text-white transition hover:border-white/50 active:scale-95"
              >
                Отлично
              </button>
            </div>
          ) : (
            <>
              <p className="text-[10px] font-bold uppercase tracking-[0.3em]" style={{ color: accent }}>
                {name} · SLY13
              </p>
              <h3 className="mt-2 text-2xl font-black uppercase leading-tight tracking-tight text-white">
                Оставить заявку
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-white/60">
                Оставьте имя и телефон — перезвоним и подберём вариант под Ваши даты.
              </p>

              <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
                <div>
                  <label htmlFor="crew-lead-name" className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-white/50">
                    Имя
                  </label>
                  <input
                    id="crew-lead-name"
                    ref={nameRef}
                    type="text"
                    autoComplete="name"
                    maxLength={100}
                    placeholder="Как к Вам обращаться"
                    value={user}
                    onChange={(e) => setUser(e.target.value)}
                    className="h-12 w-full rounded-xl border border-white/12 bg-white/[0.05] px-4 text-base text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none focus:ring-2"
                    style={{ ["--tw-ring-color" as string]: `${accent}55` }}
                  />
                </div>

                <div>
                  <label htmlFor="crew-lead-phone" className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-white/50">
                    Телефон
                  </label>
                  <input
                    id="crew-lead-phone"
                    type="tel"
                    autoComplete="tel"
                    inputMode="tel"
                    maxLength={40}
                    placeholder="+7 (___) ___-__-__"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="h-12 w-full rounded-xl border border-white/12 bg-white/[0.05] px-4 text-base text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none focus:ring-2"
                    style={{ ["--tw-ring-color" as string]: `${accent}55` }}
                  />
                </div>

                <label className="flex cursor-pointer items-start gap-3 text-xs leading-relaxed text-white/50">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-white/20 bg-white/10"
                    style={{ accentColor: accent }}
                  />
                  Соглашаюсь на обработку персональных данных для обратной связи
                </label>

                {phase === "error" && errorMsg && (
                  <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300" role="alert">
                    {errorMsg}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={phase === "sending"}
                  className="inline-flex h-13 w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-black uppercase tracking-[0.1em] text-white transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
                  style={{ background: `linear-gradient(135deg, ${accentSoft} 0%, ${accent} 65%)` }}
                >
                  {phase === "sending" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      Отправляем…
                    </>
                  ) : (
                    "Оставить заявку"
                  )}
                </button>

                <p className="text-center text-[11px] text-white/35">
                  Или сразу в Telegram — кнопка «Забронировать в Telegram» на странице
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
