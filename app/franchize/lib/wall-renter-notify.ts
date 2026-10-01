// app/franchize/lib/wall-renter-notify.ts
// ─────────────────────────────────────────────────────────────────────────────
// «Разослать пост прошлым арендаторам» — staff-only fanout к людям из БД,
// которые уже арендовали байки экипажа (rentals.user_id), через
// telegramDeliver (форвард через Vercel + прямой фолбэк — тот же транспорт,
// что /api/forward-telegram использует под капотом).
//
// БЕЗОПАСНОСТЬ (boss: «think how to do it securely - maybe show this flag
// only to crew members»):
//   · флаг виден в UI ТОЛЬКО crew-staff (viewer.isCrewStaff / staff-экшен);
//   · сервер отдельно перепроверяет isCrewStaffUser(актор, экипаж поста) —
//     и в createCommunityPostAction (постановка job), и в kick-роуте;
//   · chat_id арендаторов НИКОГДА не пишутся в crew_posts.metadata — там
//     живёт только ledger отправленных users.user_id (notify_job);
//   · получатели вычисляются заново на каждый прогон (детерминированный
//     запрос), exactly-once обеспечивает ledger sent_user_ids.
//
// ЛИМИТЫ TELEGRAM (brainstorm-ответ, зашит в константы):
//   · Bot API: ~30 сообщений/сек глобально на бота, ~1/сек на чат,
//     ~20/мин в группу — рассылка по приватным чатам упирается в глобальный
//     потолок;
//   · безопасный темп: пакеты по 20 сообщений с паузой 1.1с (~18/сек) —
//     запас ~40% до потолка, ни один чат не получает >1 сообщения;
//   · бюджет одного прогона 50с (maxDuration=60) → до ~800 получателей за
//     прогон; аудитория капится 500 на пост (crew-масштаб), хвост добивают
//     повторные kick-запросы / крон — курсор живёт в notify_job ledger.
//
// АУДИТОРИИ (rentals, статус cancelled исключён всегда):
//   · recent — аренды за последние 30 дней;
//   · past   — аренды 31–180 дней назад («старые, с такого-то месяца»);
//   · all    — все, кто когда-либо арендовал.
// Из любого сегмента исключаются активные члены экипажа (они уже получили
// wall-notify) и автор поста; prefs «Стена экипажа» уважаются
// (filterWallNotifyRecipients).
//
// Никогда не бросает наружу (ошибки → status='failed' + error в job);
// ожидается await от caller'а (урок d275c52: fire-and-forget на Vercel
// замирает после ответа).
// ─────────────────────────────────────────────────────────────────────────────

import { supabaseAdmin } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";
import {
  buildWallPostNotifyHtml,
  buildWallBroadcastCreatorHtml,
  buildWallRentButton,
  wallPhotoPublicUrl,
  WallPostNotifyBike,
} from "@/app/franchize/lib/community-wall";
import { filterWallNotifyRecipients } from "@/app/franchize/lib/wall-prefs";
import {
  buildTelegramAppLink,
  isUuidLike,
  wallPostStartParam,
} from "@/lib/wall-deeplink";
import { resolveCrewBotUsername } from "@/app/franchize/lib/crew-bot";
import { deliverWallPostNotify, WallNotifyKeyboard } from "@/app/franchize/lib/wall-notify-deliver";

// BOSS 2026-10-01 polish pack:
//   · уведомление несёт ПЕРВОЕ фото поста (sendPhoto через форвард-API,
//     caption = прежний текст, кнопки те же) — deliverWallPostNotify;
//   · автор поста получает СОБСТВЕННУЮ копию бродкаста («что было разослано»)
//     с кнопками и счётчиком аудитории — ровно один раз на job
//     (флаг creator_notified в ledger).

export type WallNotifyAudience = "recent" | "past" | "all";

export const WALL_RENTER_AUDIENCES: WallNotifyAudience[] = ["recent", "past", "all"];

/** Пакет отправки: 20 × 1.1с ≈ 18 сообщений/сек — под потолком Bot API. */
export const RENTER_NOTIFY_BATCH_SIZE = 20;
export const RENTER_NOTIFY_BATCH_PAUSE_MS = 1100;
/** Бюджет одного прогона (route/cron) — запас до maxDuration=60. */
export const RENTER_NOTIFY_TIME_BUDGET_MS = 50_000;
/** Hard cap аудитории на пост (хвост добивают повторные прогоны). */
export const RENTER_NOTIFY_MAX_RECIPIENTS = 500;
/** Окно жизни job для крон-досылки. */
export const RENTER_NOTIFY_JOB_TTL_DAYS = 7;

// ── job shape (crew_posts.metadata.notify_job) ───────────────────────────────

export interface WallRenterNotifyJob {
  status: "queued" | "running" | "done" | "failed";
  audience: WallNotifyAudience;
  requested_by: string;
  created_at: string;
  finished_at: string | null;
  /** Exactly-once ledger: users.user_id уже получивших сообщение. */
  sent_user_ids: string[];
  sent: number;
  failed: number;
  error: string | null;
  /** Копия автору («что было разослано») ушла — не дублируем на кронах. */
  creator_notified?: boolean;
}

/** Pure: достать валидный job из metadata (мусор → null). */
export function parseNotifyJob(metadata: unknown): WallRenterNotifyJob | null {
  if (typeof metadata !== "object" || !metadata) return null;
  const job = (metadata as Record<string, unknown>).notify_job;
  if (typeof job !== "object" || !job) return null;
  const j = job as Record<string, unknown>;
  const status = j.status;
  const audience = j.audience;
  if (typeof status !== "string" || !["queued", "running", "done", "failed"].includes(status)) return null;
  if (typeof audience !== "string" || !WALL_RENTER_AUDIENCES.includes(audience as WallNotifyAudience)) return null;
  if (typeof j.requested_by !== "string" || !j.requested_by) return null;
  return {
    status: status as WallRenterNotifyJob["status"],
    audience: audience as WallNotifyAudience,
    requested_by: j.requested_by,
    created_at: typeof j.created_at === "string" ? j.created_at : "",
    finished_at: typeof j.finished_at === "string" ? j.finished_at : null,
    sent_user_ids: Array.isArray(j.sent_user_ids) ? j.sent_user_ids.filter((v): v is string => typeof v === "string") : [],
    sent: typeof j.sent === "number" && Number.isFinite(j.sent) ? j.sent : 0,
    failed: typeof j.failed === "number" && Number.isFinite(j.failed) ? j.failed : 0,
    error: typeof j.error === "string" ? j.error : null,
    creator_notified: j.creator_notified === true,
  };
}

/** Pure: pending = аудитория минус ledger, минус исключения. Стабильный порядок. */
export function pendingRecipients(
  recipients: string[],
  sentUserIds: string[],
  exclude: Set<string>,
): string[] {
  const sent = new Set(sentUserIds);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of recipients) {
    if (!id || sent.has(id) || exclude.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

// ── audience resolver ────────────────────────────────────────────────────────

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Distinct renter user_ids экипажа по сегменту. Отменённые аренды не считаются
 * («previously rented» = фактический контакт с сервисом). Свежайшие — первыми
 * (order by created_at desc): при срабатывании капа 500 рассылка идёт самым
 * тёплым арендаторам.
 */
export async function resolveRenterAudience(crewId: string, audience: WallNotifyAudience): Promise<string[]> {
  try {
    let query = supabaseAdmin
      .from("rentals")
      .select("user_id, created_at")
      .eq("crew_id", crewId)
      .not("user_id", "is", null)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(2000);
    if (audience === "recent") {
      query = query.gte("created_at", daysAgoIso(30));
    } else if (audience === "past") {
      query = query.lt("created_at", daysAgoIso(30)).gte("created_at", daysAgoIso(180));
    }
    const { data, error } = await query;
    if (error) {
      logger.warn("[wall-renter-notify] audience query failed", { error: error.message });
      return [];
    }
    const seen = new Set<string>();
    const out: string[] = [];
    for (const row of (data ?? []) as { user_id: string | null }[]) {
      const id = row.user_id?.trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(id);
      if (out.length >= RENTER_NOTIFY_MAX_RECIPIENTS) break;
    }
    return out;
  } catch (error) {
    logger.warn("[wall-renter-notify] audience resolver crashed", error);
    return [];
  }
}

// ── metadata writer (best-effort, non-throwing) ──────────────────────────────

async function writeNotifyJob(postId: string, job: WallRenterNotifyJob): Promise<void> {
  try {
    const { data: row } = await supabaseAdmin
      .from("crew_posts")
      .select("metadata")
      .eq("id", postId)
      .maybeSingle();
    const metadata = (row?.metadata as Record<string, unknown> | null) ?? {};
    await supabaseAdmin
      .from("crew_posts")
      .update({ metadata: { ...metadata, notify_job: job } })
      .eq("id", postId);
  } catch (error) {
    logger.warn("[wall-renter-notify] job write failed (non-fatal)", error);
  }
}

// ── processor ────────────────────────────────────────────────────────────────

export interface WallRenterNotifyRunResult {
  ok: boolean;
  status: WallRenterNotifyJob["status"] | "absent";
  sent: number;
  failed: number;
  remaining: number;
  error?: string;
}

/**
 * Обработать notify_job поста: дослать всем pending в рамках бюджета.
 * Вызывается из kick-роута (staff) и крона; идемпотентен — повторный вызов
 * продолжает с ledger. Никогда не бросает.
 */
export async function processWallRenterNotifyJob(
  postId: string,
  timeBudgetMs: number = RENTER_NOTIFY_TIME_BUDGET_MS,
): Promise<WallRenterNotifyRunResult> {
  const run: WallRenterNotifyRunResult = { ok: false, status: "absent", sent: 0, failed: 0, remaining: 0 };
  try {
    if (!isUuidLike(postId)) return { ...run, error: "bad post id" };

    const { data: postRow } = await supabaseAdmin
      .from("crew_posts")
      .select("id, crew_id, author_id, body, kind, metadata, is_hidden")
      .eq("id", postId)
      .maybeSingle();
    const post = postRow as
      | { id: string; crew_id: string; author_id: string; body: string; kind: string; metadata: unknown; is_hidden: boolean }
      | null;
    if (!post) return { ...run, error: "post not found" };

    const job = parseNotifyJob(post.metadata);
    if (!job) return run;
    run.status = job.status;
    if (job.status === "done" || job.status === "failed") {
      return { ...run, ok: true, sent: job.sent, failed: job.failed, remaining: 0 };
    }

    // Скрытый/удалённый пост рассылке не подлежит (ghost guard как в wall-notify).
    if (post.is_hidden) {
      await writeNotifyJob(postId, { ...job, status: "failed", error: "post hidden before fanout", finished_at: new Date().toISOString() });
      return { ...run, status: "failed", error: "post hidden" };
    }

    const { data: crewRow } = await supabaseAdmin
      .from("crews")
      .select("id, slug")
      .eq("id", post.crew_id)
      .maybeSingle();
    const crew = crewRow as { id: string; slug: string | null } | null;
    if (!crew) return { ...run, error: "crew not found" };
    const slug = crew.slug || "";

    // Исключения: автор, активные члены экипажа (уже получили wall-notify).
    const exclude = new Set<string>([post.author_id, job.requested_by]);
    try {
      const { data: members } = await supabaseAdmin
        .from("crew_members")
        .select("user_id")
        .eq("crew_id", crew.id)
        .eq("membership_status", "active");
      for (const m of (members ?? []) as { user_id: string }[]) exclude.add(m.user_id);
    } catch {
      // members read failed → не блокируем рассылку (дубль staff'у лучше нуля доставки)
    }

    const audience = await resolveRenterAudience(crew.id, job.audience);
    // prefs «Стена экипажа»: opt-out уважаем, сбой prefs → шлём всем.
    const filtered = await filterWallNotifyRecipients(audience, slug).catch(() => audience);
    const pending = pendingRecipients(filtered, job.sent_user_ids, exclude);
    run.remaining = pending.length;

    // ── delivery payload (как wall-notify: превью + кнопка к посту) ──
    // Без PostgREST-embed'ов (та же логика «верифицируем отдельно», что и в
    // createCommunityPostAction) — вложенные select'ы валит PGRST200 при
    // неоднозначных FK.
    // BOSS 2026-10-01: выбираем СТРОКИ фото (storage_path, position asc) —
    // первая становится обложкой sendPhoto-уведомления (через форвард-API),
    // длина — прежним счётчиком «📷 N фото».
    const [photoRowsRes, bikeIdRes, botUsername] = await Promise.all([
      supabaseAdmin
        .from("crew_post_photos")
        .select("storage_path")
        .eq("post_id", postId)
        .order("position", { ascending: true }),
      supabaseAdmin
        .from("crew_post_bikes")
        .select("bike_id")
        .eq("post_id", postId)
        // Author's attach order — the FIRST bike is the post's headline offer.
        .order("position", { ascending: true })
        .limit(8),
      resolveCrewBotUsername(slug),
    ]);
    const photoRows = ((photoRowsRes.data ?? []) as { storage_path: string | null }[])
      .map((p) => (p.storage_path || "").trim())
      .filter(Boolean);
    const photoCount = photoRows.length;
    // Обложка — публичный URL бакета (Telegram сам скачает картинку). Падение
    // скачивания на стороне TG означает откат на текст внутри deliver helper.
    const coverPhotoUrl = photoRows[0] ? wallPhotoPublicUrl(photoRows[0]) : null;
    const bikeIds = ((bikeIdRes.data ?? []) as { bike_id: string }[]).map((b) => b.bike_id);
    let bikeTitles: string[] = [];
    let bikes: WallPostNotifyBike[] = [];
    if (bikeIds.length > 0) {
      const { data: bikeModels } = await supabaseAdmin
        .from("cars")
        .select("id, model")
        .in("id", bikeIds);
      const modelById = new Map(
        ((bikeModels ?? []) as { id: string; model: string | null }[]).map((c) => [String(c.id), c.model || ""]),
      );
      bikes = bikeIds.map((id) => ({ bikeId: id, title: modelById.get(String(id)) || "" }));
      bikeTitles = bikes.map((b) => b.title || "").filter(Boolean);
    }

    const { data: authorRow } = await supabaseAdmin
      .from("users")
      .select("full_name, username")
      .eq("user_id", post.author_id)
      .maybeSingle();
    const authorName =
      (authorRow as { full_name: string | null; username: string | null } | null)?.full_name ||
      (authorRow as { full_name: string | null; username: string | null } | null)?.username ||
      "Экипаж";

    let deeplink: string | null = null;
    if (botUsername) {
      try {
        deeplink = buildTelegramAppLink(botUsername, wallPostStartParam(postId, slug));
      } catch {
        deeplink = null;
      }
    }
    const text = buildWallPostNotifyHtml({
      authorName,
      body: post.body,
      photoCount,
      bikeTitles,
      hasStats: post.kind === "stats",
    });
    // Quick-rent row FIRST: когда в посте указан байк из каталога, кнопка
    // ведёт straight на его страницу (startapp=rent_<bikeId>, бот экипажа из
    // metadata — boss: «deep link for quick rent action»). Обычная кнопка
    // поста остаётся вторым рядом; без байка/бота раскладка прежняя.
    const rentButton = buildWallRentButton({ bikes, botUsername });
    const keyboard: WallNotifyKeyboard["inline_keyboard"] = [];
    if (rentButton) keyboard.push([rentButton]);
    if (deeplink) keyboard.push([{ text: "🟣 Открыть пост", url: deeplink }]);
    const replyMarkup: WallNotifyKeyboard | null = keyboard.length > 0 ? { inline_keyboard: keyboard } : null;

    // ── копия АВТОРУ («что было разослано») — ровно один раз на job ──
    // Boss: «send notification to post creator as well to be aware what was
    // broadcasted». Уходит ДО fanout (первый же прогон), с теми же кнопками,
    // счётчиком аудитории и флагом creator_notified против дублей кронов.
    if (!job.creator_notified) {
      try {
        const creatorText = buildWallBroadcastCreatorHtml({
          body: post.body,
          photoCount,
          bikeTitles,
          hasStats: post.kind === "stats",
          recipients: filtered.length,
          failed: 0,
        });
        const creatorRes = await deliverWallPostNotify(post.author_id, creatorText, replyMarkup, coverPhotoUrl);
        if (creatorRes.ok) {
          job.creator_notified = true;
          await writeNotifyJob(postId, { ...job, status: job.status, creator_notified: true });
        } else {
          logger.warn("[wall-renter-notify] creator copy failed (will not retry this run)", {
            error: creatorRes.error,
          });
        }
      } catch (creatorError) {
        logger.warn("[wall-renter-notify] creator copy crashed", creatorError);
      }
    }

    if (pending.length === 0) {
      await writeNotifyJob(postId, { ...job, status: "done", finished_at: new Date().toISOString() });
      return { ...run, ok: true, sent: job.sent, failed: job.failed, remaining: 0 };
    }

    // ── пакетный цикл с бюджетом ──
    const startedAt = Date.now();
    const sentLedger = [...job.sent_user_ids];
    let sent = job.sent;
    let failed = job.failed;
    await writeNotifyJob(postId, { ...job, status: "running" });
    for (let i = 0; i < pending.length; i += RENTER_NOTIFY_BATCH_SIZE) {
      if (Date.now() - startedAt > timeBudgetMs) {
        // Бюджет исчерпан — статус 'running', ledger уже в metadata: следующий
        // kick/крон продолжает ровно с этого места.
        run.remaining = pending.length - i;
        return { ...run, ok: true, sent, failed, remaining: run.remaining };
      }
      const batch = pending.slice(i, i + RENTER_NOTIFY_BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async (chatId) => ({
          chatId,
          res: await deliverWallPostNotify(chatId, text, replyMarkup, coverPhotoUrl),
        })),
      );
      const delivered: string[] = [];
      for (const r of results) {
        if (r.status === "fulfilled" && r.value.res.ok) {
          delivered.push(r.value.chatId);
          sent += 1;
        } else {
          failed += 1;
        }
      }
      sentLedger.push(...delivered);
      // Ledger после КАЖДОГО пакета: крэш теряет максимум один пакет.
      await writeNotifyJob(postId, {
        ...job,
        status: "running",
        sent_user_ids: sentLedger,
        sent,
        failed,
      });
      if (i + RENTER_NOTIFY_BATCH_SIZE < pending.length) {
        await new Promise((resolve) => setTimeout(resolve, RENTER_NOTIFY_BATCH_PAUSE_MS));
      }
    }

    await writeNotifyJob(postId, {
      ...job,
      status: "done",
      sent_user_ids: sentLedger,
      sent,
      failed,
      finished_at: new Date().toISOString(),
    });
    return { ok: true, status: "done", sent, failed, remaining: 0 };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn("[wall-renter-notify] run crashed", error);
    return { ...run, ok: false, error: message };
  }
}

/** Постановка job после создания поста (staff-путь проверяется вызывающим). */
export async function queueWallRenterNotifyJob(
  postId: string,
  audience: WallNotifyAudience,
  requestedBy: string,
): Promise<boolean> {
  try {
    const { data: row } = await supabaseAdmin
      .from("crew_posts")
      .select("metadata")
      .eq("id", postId)
      .maybeSingle();
    const metadata = (row?.metadata as Record<string, unknown> | null) ?? {};
    const job: WallRenterNotifyJob = {
      status: "queued",
      audience,
      requested_by: requestedBy,
      created_at: new Date().toISOString(),
      finished_at: null,
      sent_user_ids: [],
      sent: 0,
      failed: 0,
      error: null,
    };
    const { error } = await supabaseAdmin
      .from("crew_posts")
      .update({ metadata: { ...metadata, notify_job: job } })
      .eq("id", postId);
    if (error) {
      logger.error("[wall-renter-notify] queue failed:", error.message);
      return false;
    }
    return true;
  } catch (error) {
    logger.warn("[wall-renter-notify] queue crashed", error);
    return false;
  }
}
