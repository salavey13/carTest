// app/franchize/lib/wall-engage-notify.ts
// ─────────────────────────────────────────────────────────────────────────────
// TG-уведомления «у твоего поста новая активность» (wall v4):
//   · реакция добила пост до круглого числа (1/3/5/10/25/50/100) — автору;
//   · новый комментарий на пост — автору поста, автору корневого комментария
//     (если отвечают) и упомянутым @users;
//   · всё кроме того, что автор сам сделал со своим же постом.
//
// Антиспам-архитектура (честно, без stateful-иллюзий):
//   · милистоуны реакций — exactly-once через crew_post_notify_log
//     (INSERT .. ON CONFLICT DO NOTHING; послали только если вставка прошла).
//     Повторный toggle реакции на границе милистоуна не роняет второй DM.
//   · комментарии — один DM на один комментарий получателю (dedup-ключ
//     commentId:userId в той же таблице), rate-limit самих комментариев
//     уже есть (WALL_RATE_COMMENTS_PER_HOUR).
//   · упомянутых извещаем максимум WALL_ENGAGE_MAX_MENTIONS за комментарий.
//
// Доставка — telegramDeliver (тот же транспорт, что у wall-notify /
// new-lead-notify: форвард через Vercel + прямой фолбэк). Функции НИКОГДА
// не бросают: реакция/комментарий не должны «пропасть» из-за уведомления.
// Ожидается await от caller'а (урок d275c52: fire-and-forget на Vercel
// подмораживается после ответа).
//
// Deeplink — startapp=post_<postId>_<slug> (lib/wall-deeplink.ts); роутер
// ведёт прямо к посту на стене с подсветкой.
// ─────────────────────────────────────────────────────────────────────────────

import { logger } from "@/lib/logger";
import { supabaseAdmin } from "@/lib/supabase-server";
import { telegramDeliver } from "@/lib/telegram-transport";
import { escapeTelegramHtml, parseWallText } from "@/app/franchize/lib/community-wall";
import {
  buildTelegramAppLink,
  sanitizeWallSlug,
  wallPostStartParam,
} from "@/lib/wall-deeplink";
import { filterWallNotifyRecipients, userWantsWallActivity } from "@/app/franchize/lib/wall-prefs";

/** Круглые числа, на которые автор получает «твой пост набрал N реакций». */
export const WALL_REACTION_MILESTONES: readonly number[] = [1, 3, 5, 10, 25, 50, 100];

/** Сколько упомянутых пользователей извещаем одним комментарием (максимум). */
export const WALL_ENGAGE_MAX_MENTIONS = 3;

export function isReactionMilestone(totalReactions: number): boolean {
  return WALL_REACTION_MILESTONES.includes(totalReactions);
}

// ── message builders (pure, юнит-тестируются) ────────────────────────────────

export interface ReactionMilestoneNotifyInfo {
  /** Новое суммарное число реакций (сработавший милистоун). */
  total: number;
  /** Самая популярная эмодзи поста — для «лица» уведомления. */
  topEmoji: string | null;
  /** Превью текста поста (уже обрезано вызывающим до ~160 символов). */
  postPreview: string;
  /** Имя реагирующего (для «<имя> поставил реакцию» на милистоуне 1). */
  reactorName: string | null;
}

export function buildReactionMilestoneHtml(info: ReactionMilestoneNotifyInfo): string {
  const emoji = info.topEmoji || "🔥";
  const who = info.reactorName ? `${escapeTelegramHtml(info.reactorName)} ` : "";
  const preview = escapeTelegramHtml(info.postPreview || "твой пост");
  if (info.total <= 1) {
    return [
      `${emoji} <b>${who}отреагировал(а) на твой пост</b>`,
      ``,
      `«${preview}»`,
    ].join("\n");
  }
  return [
    `${emoji} <b>Твой пост собрал ${info.total} реакций</b>`,
    ``,
    `«${preview}»`,
  ].join("\n");
}

export type WallCommentNotifyReason = "post_author" | "reply_author" | "mentioned";

export interface CommentNotifyInfo {
  reason: WallCommentNotifyReason;
  /** Имя комментатора. */
  commenterName: string;
  /** Имя автора корневого комментария (для reply — «ответил …»). */
  replyToName: string | null;
  /** Текст комментария (обрезан вызывающим до ~200 символов). */
  commentBody: string;
  /** Превью текста поста. */
  postPreview: string;
}

const COMMENT_REASON_HEADLINE: Record<WallCommentNotifyReason, string> = {
  post_author: "Новый комментарий на твой пост",
  reply_author: "Ответ на твой комментарий",
  mentioned: "Тебя упомянули в комментарии",
};

export function buildCommentNotifyHtml(info: CommentNotifyInfo): string {
  const headline = COMMENT_REASON_HEADLINE[info.reason];
  const commenter = escapeTelegramHtml(info.commenterName);
  const body = escapeTelegramHtml(info.commentBody || "…");
  const preview = escapeTelegramHtml(info.postPreview || "");
  const lines = [`💬 <b>${commenter} — ${headline}</b>`];
  if (info.reason === "reply_author" && info.replyToName) {
    lines.push(`↩️ в ответ ${escapeTelegramHtml(info.replyToName)}`);
  }
  lines.push(``, `${body}`);
  if (preview) lines.push(``, `📜 «${preview}»`);
  return lines.join("\n");
}

// ── 3. post mentions (profile v1 / notifications polish) ─────────────────────
// Comments had mention-DMs since wall v4 — posts did not. Parity: @user in a
// POST body now pings the mentioned rider (exactly-once per post+user via the
// same ledger, prefs-aware, capped by WALL_ENGAGE_MAX_MENTIONS).

export interface PostMentionNotifyInput {
  slug: string;
  postId: string;
  authorId: string;
  authorName: string;
  /** Raw post body (mentions extracted here). */
  body: string;
  postPreview: string;
  botUsername?: string | null;
}

export function buildPostMentionHtml(info: {
  authorName: string;
  postPreview: string;
}): string {
  return [
    `📢 <b>${escapeTelegramHtml(info.authorName)} упомянул(а) тебя в посте</b>`,
    ``,
    `📜 «${escapeTelegramHtml(info.postPreview || "")}»`,
  ].join("\n");
}

/** Уведомить @упомянутых в новом посте. Никогда не бросает. */
export async function notifyWallPostMentions(input: PostMentionNotifyInput): Promise<void> {
  try {
    const mentionNames = extractMentionUsernames(input.body);
    if (mentionNames.length === 0) return;

    // Same two-case exact lookup as the comment flow: DB may store «Sly13»
    // while the author typed «@sly13» (and vice versa). No ilike wildcards —
    // «_» in usernames is an underscore, not a pattern.
    const variants = [...new Set([...mentionNames, ...mentionNames.map((n) => n.toLowerCase())])];
    const { data: mentionedUsers } = await supabaseAdmin
      .from("users")
      .select("user_id")
      .in("username", variants)
      .limit(WALL_ENGAGE_MAX_MENTIONS * 2);

    const mentionedIds = ((mentionedUsers ?? []) as { user_id: string }[])
      .map((u) => u.user_id)
      .filter((id) => id && id !== input.authorId);
    if (mentionedIds.length === 0) return;

    const allowed = await filterWallNotifyRecipients(mentionedIds, input.slug);
    let sent = 0;
    for (const userId of allowed.slice(0, WALL_ENGAGE_MAX_MENTIONS)) {
      // exactly-once per (post, mentioned user)
      const claimed = await claimNotifySlot(input.postId, "post_mention", userId);
      if (!claimed) continue;
      const text = buildPostMentionHtml({ authorName: input.authorName, postPreview: input.postPreview });
      const ok = await sendEngagementDm({
        chatId: userId,
        text,
        botUsername: input.botUsername ?? null,
        postId: input.postId,
        slug: input.slug,
      });
      if (ok) sent += 1;
    }
    if (sent > 0) logger.info("[wall-engage-notify] post mentions delivered", { postId: input.postId, sent });
  } catch (error) {
    logger.warn("[wall-engage-notify] post mention notify crashed (post unaffected)", error);
  }
}

// ── delivery (never throws) ──────────────────────────────────────────────────

function engagementDeeplinkUrl(botUsername: string | null, postId: string, slug: string): string {
  try {
    const param = wallPostStartParam(postId, sanitizeWallSlug(slug) ?? slug);
    if (botUsername) return buildTelegramAppLink(botUsername, param);
    // Fallback: web-ссылка со скроллом к посту (работает и анонимно).
    const site = process.env.NEXT_PUBLIC_SITE_URL || "https://v0-car-test.vercel.app";
    return `${site.replace(/\/+$/, "")}/franchize/${encodeURIComponent(sanitizeWallSlug(slug) ?? slug)}/community#post-${postId}`;
  } catch {
    return "";
  }
}

async function sendEngagementDm(input: {
  chatId: string;
  text: string;
  botUsername: string | null;
  postId: string;
  slug: string;
}): Promise<boolean> {
  const url = engagementDeeplinkUrl(input.botUsername, input.postId, input.slug);
  const payload: Record<string, unknown> = {
    text: input.text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(url
      ? { reply_markup: { inline_keyboard: [[{ text: "🟣 Открыть пост", url }]] } }
      : {}),
  };
  try {
    const res = await telegramDeliver("sendMessage", input.chatId, payload);
    if (!res.ok) {
      logger.warn("[wall-engage-notify] delivery failed", { chatId: input.chatId, error: res.error });
    }
    return res.ok;
  } catch (error) {
    logger.warn("[wall-engage-notify] delivery exception", { chatId: input.chatId, error });
    return false;
  }
}

/** Dedup-вставка в ledger; true — мы первые, можно слать.
 *  PostgREST: upsert c ignoreDuplicates → `Prefer: resolution=ignore-duplicates`
 *  + `on_conflict=post_id,kind,key`. Конфликт PK возвращает ПУСТОЙ массив (не
 *  ошибку) — значит, слот уже занят, молчим. Ошибка же (например, миграция ещё
 *  не применена) → один лишний DM лучше, чем никакого уведомления. */
async function claimNotifySlot(postId: string, kind: string, key: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("crew_post_notify_log")
    .upsert(
      { post_id: postId, kind, key },
      { onConflict: "post_id,kind,key", ignoreDuplicates: true },
    )
    .select("post_id")
    .abortSignal(AbortSignal.timeout(5000));
  if (error) {
    logger.warn("[wall-engage-notify] dedup insert failed (notify anyway)", { error: error.message });
    return true;
  }
  return (data ?? []).length > 0;
}

/** Сколько comment-DM получил получатель за последний час (по ledger). */
async function countRecentCommentNotifies(
  postId: string,
  recipientId: string,
  sinceIso: string,
): Promise<number> {
  const { count } = await supabaseAdmin
    .from("crew_post_notify_log")
    .select("key", { count: "exact", head: true })
    .eq("post_id", postId)
    .eq("kind", "comment")
    .like("key", `${recipientId}:%`)
    .gte("created_at", sinceIso)
    .abortSignal(AbortSignal.timeout(5000));
  return count ?? 0;
}

// ── 1. reaction milestone ────────────────────────────────────────────────────

export interface ReactionMilestoneNotifyInput {
  slug: string;
  postId: string;
  /** Автор поста (users.user_id = TG chat id). */
  postAuthorId: string;
  /** Кто поставил реакцию. */
  reactorId: string;
  reactorName: string | null;
  total: number;
  topEmoji: string | null;
  postPreview: string;
  botUsername?: string | null;
}

/**
 * Уведомить автора о милистоуне реакций. Вызывать ТОЛЬКО когда RPC вернул
 * added=true и isReactionMilestone(total) — здесь только exactly-once-щит.
 * Никогда не бросает.
 */
export async function maybeNotifyReactionMilestone(input: ReactionMilestoneNotifyInput): Promise<void> {
  try {
    if (input.postAuthorId === input.reactorId) return; // сам себе не пишем
    if (!isReactionMilestone(input.total)) return;
    // Preference check (wall v6): автор мог замьютить стену — читаем его
    // metadata одним точечным запросом (fail-open: сбой не глушит уведомление).
    try {
      // NOTE: no .abortSignal() here — this supabase-js build only types it
      // on a subset of builder overloads; the try/catch below is the guard.
      const { data: authorRow } = await supabaseAdmin
        .from("users")
        .select("metadata")
        .eq("user_id", input.postAuthorId)
        .maybeSingle();
      if (authorRow && !userWantsWallActivity(authorRow.metadata, input.slug)) return;
    } catch {
      // prefs недоступны — уведомляем как раньше
    }
    const claimed = await claimNotifySlot(input.postId, "reaction_milestone", String(input.total));
    if (!claimed) return;

    const text = buildReactionMilestoneHtml({
      total: input.total,
      topEmoji: input.topEmoji,
      postPreview: input.postPreview,
      reactorName: input.reactorName,
    });
    await sendEngagementDm({
      chatId: input.postAuthorId,
      text,
      botUsername: input.botUsername ?? null,
      postId: input.postId,
      slug: input.slug,
    });
  } catch (error) {
    logger.warn("[wall-engage-notify] reaction milestone notify crashed (reaction unaffected)", error);
  }
}

// ── 2. comment fanout ────────────────────────────────────────────────────────

export interface CommentNotifyRecipient {
  userId: string;
  reason: WallCommentNotifyReason;
  replyToName?: string | null;
}

/** Уникальные получатели в стабильном порядке (post_author → reply → mentions). */
export function dedupeCommentRecipients(
  candidates: CommentNotifyRecipient[],
  commenterId: string,
): CommentNotifyRecipient[] {
  const seen = new Set<string>();
  const out: CommentNotifyRecipient[] = [];
  for (const c of candidates) {
    if (!c.userId || c.userId === commenterId) continue;
    if (seen.has(c.userId)) continue;
    seen.add(c.userId);
    out.push(c);
  }
  return out;
}

/** @user-токены из тела комментария (тот же парсер, что рендерит стену).
 *  Регистр СОХРАНЯЕМ (в users.username Telegram хранит @Sly13 как есть),
 *  дедуп по нижнему регистру. Exact-lookup в экшене сам пробует оба варианта. */
export function extractMentionUsernames(body: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const token of parseWallText(body)) {
    if (token.type === "mention") {
      const v = token.value.replace(/^@/, "").trim();
      const key = v.toLowerCase();
      if (v && !seen.has(key)) {
        seen.add(key);
        out.push(v);
      }
    }
  }
  return out.slice(0, WALL_ENGAGE_MAX_MENTIONS);
}

export interface CommentNotifyInput {
  slug: string;
  postId: string;
  commentId: string;
  commenterId: string;
  commenterName: string;
  commentBody: string;
  postPreview: string;
  /** Уже собранные кандидаты (автор поста / корневой комментарий). */
  recipients: CommentNotifyRecipient[];
  botUsername?: string | null;
}

/** Анти-пушка: сколько comment-DM максимум получает один получатель по ОДНОМУ
 *  посту за час (лимит самих комментариев 40/ч × 5 получателей = до 200 DM/ч —
 *  потолок превращает это в максимум 3 DM/пост/получатель/час). */
export const WALL_COMMENT_NOTIFY_HOURLY_CAP_PER_POST = 3;

/**
 * Разослать уведомления о комментарии. Один DM получателю на один
 * комментарий (dedup commentId:userId + часовой потолок на получателя),
 * отправки параллельно (Promise.allSettled). Никогда не бросает.
 */
export async function notifyWallComment(input: CommentNotifyInput): Promise<void> {
  try {
    const candidates = dedupeCommentRecipients(input.recipients, input.commenterId);
    if (candidates.length === 0) return;
    // Preference-aware fanout (wall v6): «Стена экипажа» opt-out.
    const recipients = await filterWallNotifyRecipients(
      candidates.map((c) => c.userId),
      input.slug,
    ).then((allowed) => candidates.filter((c) => allowed.includes(c.userId)));
    if (recipients.length === 0) return;

    const hourAgoIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    // Claim slots последовательно (быстрые upsert'ы), отправки — параллельно.
    const claimed: { userId: string; reason: WallCommentNotifyReason; replyToName: string | null }[] = [];
    for (const recipient of recipients) {
      // Часовой потолок на (получатель, пост): читаем из того же ledger.
      // Ключ слота `${recipientId}:${commentId}` — получатель ПЕРВЫМ, чтобы
      // prefix-LIKE в countRecentCommentNotifies совпадал и был index-friendly.
      try {
        const recent = await countRecentCommentNotifies(input.postId, recipient.userId, hourAgoIso);
        if (recent >= WALL_COMMENT_NOTIFY_HOURLY_CAP_PER_POST) continue;
      } catch {
        // Счёт не получился — потолок пропускаем, dedup-ключ всё равно стоит.
      }
      let ok = true;
      try {
        ok = await claimNotifySlot(
          input.postId,
          "comment",
          `${recipient.userId}:${input.commentId}`,
        );
      } catch {
        // Сбой claim'а не должен обрывать цикл: уже занятые слоты других
        // получателей обязаны всё равно отправиться (иначе их DM навсегда
        // подавлен занятой записью в ledger).
        ok = true;
      }
      if (ok) {
        claimed.push({
          userId: recipient.userId,
          reason: recipient.reason,
          replyToName: recipient.replyToName ?? null,
        });
      }
    }
    if (claimed.length === 0) return;

    await Promise.allSettled(
      claimed.map(async (recipient) => {
        const text = buildCommentNotifyHtml({
          reason: recipient.reason,
          commenterName: input.commenterName,
          replyToName: recipient.replyToName,
          commentBody: input.commentBody,
          postPreview: input.postPreview,
        });
        await sendEngagementDm({
          chatId: recipient.userId,
          text,
          botUsername: input.botUsername ?? null,
          postId: input.postId,
          slug: input.slug,
        });
      }),
    );
  } catch (error) {
    logger.warn("[wall-engage-notify] comment notify crashed (comment unaffected)", error);
  }
}
