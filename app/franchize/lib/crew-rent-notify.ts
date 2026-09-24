// app/franchize/lib/crew-rent-notify.ts
// ──────────────────────────────────────────────────────────────────────────
// Crew-wide notification for NEW rents created via the web app (2026-09-24,
// owner request: «notify all members about new rents created via web app and
// send to crew email as well»).
//
// Trigger point: the franchize_order payment webhook — the single funnel
// through which every web-app checkout becomes a real rental row. Before
// this lib the webhook pinged only the renter (his confirmation message),
// the BIKE owner (hot-lead ping) and the platform admin — the rest of the
// crew learned about the deal by accident, and the crew mailbox got nothing.
//
// What it does:
//   1. Resolves the crew by slug + its ACTIVE crew_members.
//   2. Sends a compact Telegram summary to every active member EXCEPT the
//      chat ids already notified by the webhook (renter, bike owner, platform
//      admin) — no double pings.
//   3. Sends an email to the crew address (private.crew_secrets.email, then
//      falls back to the SMTP account itself) via nodemailer SMTP — same
//      transport activateRental uses for the activation email.
//
// Contract mirrors subrenter-notify: ALL failures are non-fatal — a missing
// notification must never break the payment webhook. The caller (webhook)
// wraps the invocation in its own try/catch too.

import { supabaseAdmin } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";

export interface CrewRentNotifyInput {
  /** Crew slug (franchize_order metadata.slug). */
  slug: string;
  rentalId: string;
  /** e.g. «Kawasaki EX650K» — already assembled by the caller. */
  bikeTitle: string;
  /** Renter display label: «@username» / name / chat id fallback. */
  renterLabel?: string | null;
  /** Renter phone from checkout metadata — the crew needs it for the handover. */
  renterPhone?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  totalRub?: number | null;
  depositRub?: number | null;
  /** Web-app rental card link (TG inline button + email body). */
  appLink?: string | null;
  /** Chat ids already notified by the webhook — skipped here. */
  excludeChatIds?: Array<string | number | null | undefined>;
}

export interface CrewRentNotifyResult {
  /** Chat ids the TG summary was dispatched to (dispatch-level success). */
  notified: string[];
  /** Email recipient, null when skipped (no SMTP env / no send). */
  emailedTo: string | null;
}

// ── Message builders ────────────────────────────────────────────────────────

function money(v: number | null | undefined): string {
  return `${Math.max(0, Math.round(Number(v || 0))).toLocaleString("ru-RU")} ₽`;
}

function safeLine(v: unknown, fallback = "—"): string {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return fallback;
}

/** Escape user-supplied fragments for Telegram HTML parse mode. */
function escHtml(v: unknown): string {
  return safeLine(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Shared line set for the TG message and the plain-text email — one source
 * of truth so the two channels never disagree about the facts.
 */
function crewNewRentLines(input: CrewRentNotifyInput): string[] {
  const lines: string[] = [];
  lines.push(`Техника: ${safeLine(input.bikeTitle)}`);
  lines.push(`Арендатор: ${safeLine(input.renterLabel)}`);
  if (input.renterPhone && String(input.renterPhone).trim()) {
    lines.push(`Телефон: ${String(input.renterPhone).trim()}`);
  }
  if (input.startDate || input.endDate) {
    lines.push(`Период: ${safeLine(input.startDate, "?")} → ${safeLine(input.endDate, "?")}`);
  }
  if (input.totalRub != null && Number(input.totalRub) > 0) {
    const deposit = input.depositRub != null && Number(input.depositRub) > 0
      ? ` (депозит: ${money(input.depositRub)})`
      : "";
    lines.push(`Итого: ${money(input.totalRub)}${deposit}`);
  }
  if (input.rentalId) lines.push(`Rental: ${String(input.rentalId).slice(0, 8)}`);
  return lines;
}

/** Telegram HTML message for the crew members. */
export function buildCrewNewRentMessage(input: CrewRentNotifyInput): string {
  const header = "🆕 <b>Новая аренда через веб-приложение</b>";
  const footer = input.appLink
    ? "\n\nОткройте карточку сделки — проверьте документы и подтвердите выдачу."
    : "\n\nПроверьте документы и подтвердите выдачу.";
  return `${header}\n\n${crewNewRentLines(input).map(escHtml).join("\n")}${footer}`;
}

/** Plain-text email body (same facts as the TG message). */
export function buildCrewNewRentEmailText(input: CrewRentNotifyInput): string {
  return [
    "Новая аренда через веб-приложение",
    "",
    ...crewNewRentLines(input),
    input.appLink ? `\nКарточка сделки: ${input.appLink}` : "",
    "\nЭто автоматическое уведомление One Bike Platform.",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

// ── Main entry ──────────────────────────────────────────────────────────────

/**
 * Notify every active crew member about a fresh web-app rent + send the
 * crew email. Returns what was actually dispatched; never throws.
 */
export async function notifyCrewOfNewWebAppRental(
  input: CrewRentNotifyInput,
): Promise<CrewRentNotifyResult> {
  const result: CrewRentNotifyResult = { notified: [], emailedTo: null };
  try {
    const slug = (input.slug || "").trim();
    if (!slug || !input.rentalId) {
      logger.warn("[crew-rent-notify] missing slug/rentalId — skipped", {
        slug,
        rentalId: input.rentalId,
      });
      return result;
    }

    // ── 1. Crew + active members ──
    const { data: crew } = await supabaseAdmin
      .from("crews")
      .select("id, slug")
      .eq("slug", slug)
      .maybeSingle();
    if (!crew?.id) {
      logger.warn("[crew-rent-notify] crew not found — skipped", { slug });
      return result;
    }

    const { data: members, error: membersError } = await supabaseAdmin
      .from("crew_members")
      .select("user_id")
      .eq("crew_id", crew.id)
      .eq("membership_status", "active");
    if (membersError) {
      logger.warn("[crew-rent-notify] crew_members fetch failed — skipped", {
        slug,
        error: membersError.message,
      });
      return result;
    }

    const exclude = new Set(
      (input.excludeChatIds ?? [])
        .map((v) => (v == null ? "" : String(v)))
        .filter(Boolean),
    );
    const chatIds = Array.from(
      new Set(
        ((members ?? []) as Array<{ user_id?: string | number | null }>)
          .map((m) => (m.user_id == null ? "" : String(m.user_id)))
          .filter(Boolean),
      ),
    ).filter((id) => !exclude.has(id));

    // ── 2. TG summary to every remaining member ──
    if (chatIds.length > 0) {
      const text = buildCrewNewRentMessage(input);
      const buttons = input.appLink
        ? [[{ text: "🏍 Открыть сделку", url: input.appLink }]]
        : [];
      const { sendComplexMessage } = await import(
        "@/app/webhook-handlers/actions/sendComplexMessage"
      );
      // keyboardType "inline" is REQUIRED for a working URL button — the
      // default "reply" keyboard serializes KeyboardButton (no url field),
      // so the CTA would render as a dead text button (review 2026-09-24).
      const outcomes = await Promise.allSettled(
        chatIds.map((chatId) =>
          sendComplexMessage(chatId, text, buttons, { parseMode: "HTML", keyboardType: "inline" })),
      );
      for (let i = 0; i < chatIds.length; i++) {
        const outcome = outcomes[i];
        if (outcome.status === "fulfilled" && outcome.value?.success !== false) {
          result.notified.push(chatIds[i]);
        } else {
          logger.warn("[crew-rent-notify] member notify failed (non-fatal)", {
            rentalId: input.rentalId,
            chatId: chatIds[i],
            reason:
              outcome.status === "rejected"
                ? String(outcome.reason)
                : (outcome as PromiseFulfilledResult<{ success: boolean; error?: string }>).value?.error,
          });
        }
      }
    }

    // ── 3. Email to the crew mailbox ──
    try {
      const emailUser =
        process.env.SMTP_USER || process.env.SMTP_YANDEX_USER || process.env.SMTP_GMAIL_USER;
      const emailPass =
        process.env.SMTP_PASS || process.env.SMTP_YANDEX_PASS || process.env.SMTP_GMAIL_PASS;
      if (!emailUser || !emailPass) {
        logger.warn("[crew-rent-notify] SMTP is not configured — email skipped", {
          rentalId: input.rentalId,
        });
        return result;
      }

      const { privateSchema } = await import("@/lib/private-secrets");
      const { data: crewSecrets } = await privateSchema()
        .from("crew_secrets")
        .select("email")
        .eq("crew_id", crew.id)
        .maybeSingle();
      const crewEmail = (crewSecrets as { email?: string | null } | null)?.email?.trim();
      const emailTo = crewEmail || emailUser;

      const nodemailer = (await import("nodemailer")).default;
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || process.env.SMTP_YANDEX_HOST || "smtp.yandex.ru",
        port: Number(process.env.SMTP_PORT || process.env.SMTP_YANDEX_PORT) || 465,
        secure: true,
        auth: { user: emailUser, pass: emailPass },
        // Bounded SMTP leg: this runs inside the payment-critical webhook —
        // a wedged mail server must not stall handle() for minutes
        // (review 2026-09-24; the TG leg is already bounded by the
        // 20s FORWARD_TIMEOUT in telegram-transport).
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 15_000,
      });

      await transporter.sendMail({
        from: process.env.EMAIL_FROM || emailUser,
        to: emailTo,
        subject: `🆕 Новая аренда через веб-приложение — ${safeLine(input.bikeTitle)}`,
        text: buildCrewNewRentEmailText(input),
      });
      result.emailedTo = emailTo;
    } catch (emailErr) {
      logger.warn("[crew-rent-notify] email send failed (non-fatal)", {
        rentalId: input.rentalId,
        error: emailErr instanceof Error ? emailErr.message : String(emailErr),
      });
    }

    return result;
  } catch (error) {
    logger.warn("[crew-rent-notify] non-fatal failure", {
      rentalId: input.rentalId,
      error: error instanceof Error ? error.message : String(error),
    });
    return result;
  }
}
