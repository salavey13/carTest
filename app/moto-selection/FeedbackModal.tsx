"use client";

// app/moto-selection/FeedbackModal.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Feedback modal for the standalone landings (moto-selection + sly13), 2026-10-26.
//
// Boss: «there is also feedback form present in modal [on moto-selection.ru] -
// reuse our existing mechanics to send notification through bot to
// moto-selection crew owner (in the future) and me (admin, salavey13)».
//
// Mechanic reuse: the form POSTs to the EXISTING crew-generic endpoint
// /api/franchize/callback-lead (same one the vip-bike.ru marketing site
// proxies into). That endpoint already:
//   - validates + normalizes the phone (lib/vip-bike-callback-lead.ts),
//   - inserts the lead into franchize_intents (crew CRM),
//   - resolves recipients via resolveLeadNotifyRecipients(slug): crew owner +
//     owner/admin/co_owner + active members — so the future moto-selection
//     owner gets notified the moment one is configured — plus ADMIN_CHAT_ID
//     (salavey13) today,
//   - rate-limits and de-duplicates.
// Zero new server code.
//
// Trigger wiring: any server-rendered element with [data-lead-modal-open]
// opens the modal (document-level click delegation with preventDefault) —
// the landings are server components, so no state drilling needed.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2, X } from "lucide-react";

export type LeadModalAccent = {
  /** Primary accent (buttons, focus rings), e.g. "#ff7522". */
  brand: string;
  /** Lighter gradient stop for the primary button. */
  brandSoft: string;
};

type Phase = "idle" | "sending" | "success" | "error";

export default function FeedbackModal({
  slug,
  accent,
  formSource,
  landingPath,
}: {
  /** Crew slug the lead belongs to (recipients resolve from the crew roster). */
  slug: string;
  accent: LeadModalAccent;
  formSource: string;
  landingPath: string;
}) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    // Residual states must not leak into the next open.
    if (phase === "error") {
      setPhase("idle");
      setErrorMsg("");
    }
  }, [phase]);

  // Open triggers: click delegation on [data-lead-modal-open].
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.("[data-lead-modal-open]");
      if (!el) return;
      // task 145 — touch reveal-gate (GlassServiceCard): the FIRST tap on a
      // gated card only reveals it (glass fades). The gate marks the element
      // with data-reveal-pending synchronously inside the same click — a
      // plain stopPropagation() can't block this delegation (React's own
      // delegation and this listener end up on the same node). Consume the
      // mark and stay closed; the SECOND tap finds no mark and opens.
      if (el.getAttribute("data-reveal-pending") === "true") {
        el.removeAttribute("data-reveal-pending");
        e.preventDefault();
        return;
      }
      e.preventDefault();
      setOpen(true);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  // ESC to close + scroll lock + autofocus.
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
    if (name.trim().length < 2) {
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
          name: name.trim(),
          phone: phone.trim(),
          consent: true,
          formSource,
          landingPath,
        }),
      });
      const data = (await resp.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!resp.ok || data.success === false) {
        throw new Error(data.error || "Не удалось отправить заявку, попробуйте ещё раз");
      }
      setPhase("success");
      setName("");
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
      {/* backdrop */}
      <button
        aria-label="Закрыть"
        onClick={close}
        className="absolute inset-0 cursor-default bg-black/75 backdrop-blur-sm"
        style={{ animation: "leadModalFade .18s ease-out" }}
      />

      <div
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#0c0c0c] shadow-[0_24px_80px_rgba(0,0,0,0.7)]"
        style={{ animation: "leadModalPop .22s cubic-bezier(.2,.9,.3,1.2)" }}
      >
        {/* accent top line */}
        <div
          className="h-1 w-full"
          style={{ background: `linear-gradient(90deg, ${accent.brandSoft}, ${accent.brand})` }}
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
                style={{ background: `linear-gradient(135deg, ${accent.brandSoft}, ${accent.brand})` }}
              >
                <Check className="h-8 w-8 text-white" aria-hidden />
              </span>
              <h3 className="mt-5 text-xl font-black uppercase tracking-tight text-white">
                Заявка отправлена!
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-white/60">
                Мы перезвоним Вам в течение дня. Если вопрос срочный — напишите в Telegram, отвечаем быстрее.
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
              <p className="text-[10px] font-bold uppercase tracking-[0.3em]" style={{ color: accent.brand }}>
                обратная связь
              </p>
              <h3 className="mt-2 text-2xl font-black uppercase leading-tight tracking-tight text-white">
                Оставить заявку
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-white/60">
                Оставьте заявку и мы перезвоним Вам.
              </p>

              <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
                <div>
                  <label htmlFor="lead-name" className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-white/50">
                    Имя
                  </label>
                  <input
                    id="lead-name"
                    ref={nameRef}
                    type="text"
                    autoComplete="name"
                    maxLength={100}
                    placeholder="Как к Вам обращаться"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-12 w-full rounded-xl border border-white/12 bg-white/[0.05] px-4 text-base text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none focus:ring-2"
                    style={{ ["--tw-ring-color" as string]: `${accent.brand}55` }}
                  />
                </div>

                <div>
                  <label htmlFor="lead-phone" className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-white/50">
                    Телефон
                  </label>
                  <input
                    id="lead-phone"
                    type="tel"
                    autoComplete="tel"
                    inputMode="tel"
                    maxLength={40}
                    placeholder="+7 (___) ___-__-__"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="h-12 w-full rounded-xl border border-white/12 bg-white/[0.05] px-4 text-base text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none focus:ring-2"
                    style={{ ["--tw-ring-color" as string]: `${accent.brand}55` }}
                  />
                </div>

                <label className="flex cursor-pointer items-start gap-3 text-xs leading-relaxed text-white/50">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-white/20 bg-white/10"
                    style={{ accentColor: accent.brand }}
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
                  style={{ background: `linear-gradient(135deg, ${accent.brandSoft} 0%, ${accent.brand} 65%)` }}
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
                  Или сразу в Telegram / WhatsApp — кнопки в разделе «Контакты»
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
