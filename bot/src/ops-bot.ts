/**
 * ops-bot.ts -- TG-бот владельца (Ops Hub)
 *
 * Long-running процесс, отдельный от main.ts.
 * Запуск: npm run ops-bot  (или: tsx src/ops-bot.ts)
 *
 * Обрабатывает callback-запросы:
 *   M7 -- патчи:      apply:<id> | reject:<id> | details:<id>
 *   M8 -- эскалации:  escalation:accept|escalate|ignore:<chatId>:<ts>
 *
 * Использует существующую таблицу escalations из db.ts (создана escalation-router).
 * Бизнес-логика экспортируется для тестирования.
 * startBot() вызывается только при прямом запуске файла.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { Bot } from 'grammy'
import { getDb, updateEscalationStatus, type EscalationRow } from './db.js'
import { PROJECT_ROOT } from './config.js'
import { logger } from './logger.js'
import { relayAnswerToClient } from './relay.js'

export type { EscalationRow }

const PATCHES_DIR = path.join(PROJECT_ROOT, 'ops', 'auto-fix', 'patches')
const APPLY_SCRIPT = path.join(PROJECT_ROOT, 'ops', 'auto-fix', 'apply-patch.sh')

// ---------------------------------------------------------------------------
// Payload helpers (tenant_slug and per-escalation answers live in payload_json)
// ---------------------------------------------------------------------------

type EscalationPayloadJson = {
  tenant_slug: string
  client_chat_id: number
  auto_reply?: string | null
  suggested_answer?: string | null
  [key: string]: unknown
}

export function parsePayload(row: EscalationRow): EscalationPayloadJson {
  try {
    return JSON.parse(row.payload_json) as EscalationPayloadJson
  } catch {
    return { tenant_slug: 'unknown', client_chat_id: row.chat_id }
  }
}

// ---------------------------------------------------------------------------
// M7: patch business logic
// ---------------------------------------------------------------------------

/** Write approved=true to patch JSON, then spawn apply-patch.sh detached. */
export function applyPatch(
  patchId: string,
  approvedBy: string,
): { ok: boolean; error?: string } {
  const patchPath = path.join(PATCHES_DIR, `${patchId}.json`)
  if (!fs.existsSync(patchPath)) {
    return { ok: false, error: `patch not found: ${patchId}` }
  }

  const patch = JSON.parse(fs.readFileSync(patchPath, 'utf-8')) as Record<string, unknown>
  patch.approved    = true
  patch.approved_by = approvedBy
  patch.approved_at = new Date().toISOString()
  fs.writeFileSync(patchPath, JSON.stringify(patch, null, 2))

  // spawn is safe: patchId is a system-generated string passed as array arg (no shell)
  const child = spawn('bash', [APPLY_SCRIPT, patchId], {
    detached: true,
    stdio:    'ignore',
  })
  child.unref()

  return { ok: true }
}

/** Mark patch as rejected. */
export function rejectPatch(patchId: string): { ok: boolean; error?: string } {
  const patchPath = path.join(PATCHES_DIR, `${patchId}.json`)
  if (!fs.existsSync(patchPath)) {
    return { ok: false, error: `patch not found: ${patchId}` }
  }

  const patch = JSON.parse(fs.readFileSync(patchPath, 'utf-8')) as Record<string, unknown>
  patch.status      = 'rejected'
  patch.rejected_at = new Date().toISOString()
  fs.writeFileSync(patchPath, JSON.stringify(patch, null, 2))

  return { ok: true }
}

/** Return parsed patch JSON or null if not found. */
export function getPatchDetails(patchId: string): Record<string, unknown> | null {
  const patchPath = path.join(PATCHES_DIR, `${patchId}.json`)
  if (!fs.existsSync(patchPath)) return null
  return JSON.parse(fs.readFileSync(patchPath, 'utf-8')) as Record<string, unknown>
}

// ---------------------------------------------------------------------------
// M8: escalation business logic
// ---------------------------------------------------------------------------

/**
 * Find escalation by chat_id + created_at.
 * callback_data encodes: escalation:<action>:<chatId>:<ts>
 */
export function findEscalation(
  chatId: number,
  ts: number,
): EscalationRow | undefined {
  return getDb()
    .prepare(
      `SELECT * FROM escalations
       WHERE chat_id = ? AND created_at = ?
       LIMIT 1`,
    )
    .get(chatId, ts) as EscalationRow | undefined
}

/**
 * Accept: relay auto_reply (or suggested_answer from payload_json) to client.
 */
export async function handleEscalationAccept(
  row: EscalationRow,
): Promise<{ ok: boolean; relayed: boolean }> {
  const payload = parsePayload(row)
  const answer  = payload.auto_reply ?? payload.suggested_answer
  if (!answer) return { ok: false, relayed: false }

  const ok = await relayAnswerToClient(
    payload.tenant_slug,
    payload.client_chat_id,
    answer,
    row.id,
  )
  return { ok, relayed: ok }
}

/**
 * Escalate: owner will type a manual reply next.
 * Maps to status 'escalated' in db.ts schema.
 */
export function handleEscalationEscalate(id: number): void {
  updateEscalationStatus(id, 'escalated')
}

/**
 * Ignore: close escalation without reply.
 */
export function handleEscalationIgnore(id: number): void {
  updateEscalationStatus(id, 'ignored')
}

/**
 * Most recent escalation waiting for owner's manual reply.
 */
export function getPendingEscalation(): EscalationRow | undefined {
  return getDb()
    .prepare(
      `SELECT * FROM escalations
       WHERE status = 'escalated'
       ORDER BY created_at DESC
       LIMIT 1`,
    )
    .get() as EscalationRow | undefined
}

// ---------------------------------------------------------------------------
// grammy bot -- only started when running as entry point
// ---------------------------------------------------------------------------

function startBot(): void {
  const token   = process.env.KLODBOX_OPS_BOT_TOKEN
  const ownerId = parseInt(process.env.KLODBOX_OPS_OWNER_CHAT_ID ?? '0')

  if (!token || !ownerId) {
    throw new Error('KLODBOX_OPS_BOT_TOKEN and KLODBOX_OPS_OWNER_CHAT_ID required')
  }

  const opsBot = new Bot(token)

  // M7: patch callbacks
  opsBot.callbackQuery(/^(apply|reject|details):(.+)$/, async (ctx) => {
    const [, action, patchId] = ctx.match as RegExpMatchArray
    await ctx.answerCallbackQuery()

    if (action === 'apply') {
      const approvedBy = ctx.from?.username ?? String(ctx.from?.id ?? 'owner')
      const result = applyPatch(patchId, approvedBy)
      await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } })
      await ctx.reply(
        result.ok ? `Применяю патч ${patchId}...` : `Ошибка: ${result.error}`,
      )

    } else if (action === 'reject') {
      const result = rejectPatch(patchId)
      await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } })
      await ctx.reply(
        result.ok ? `Патч ${patchId} отклонён.` : `Ошибка: ${result.error}`,
      )

    } else if (action === 'details') {
      const patch = getPatchDetails(patchId)
      if (!patch) {
        await ctx.reply(`Патч ${patchId} не найден.`)
        return
      }
      const text    = JSON.stringify(patch, null, 2)
      const preview = text.length > 3800 ? text.slice(0, 3800) + '\n...' : text
      await ctx.reply(
        `Детали патча ${patchId}:\n\`\`\`json\n${preview}\n\`\`\``,
        { parse_mode: 'Markdown' },
      )
    }
  })

  // M8: escalation callbacks
  opsBot.callbackQuery(
    /^escalation:(accept|escalate|ignore):(\d+):(\d+)$/,
    async (ctx) => {
      const [, action, rawChatId, rawTs] = ctx.match as RegExpMatchArray
      await ctx.answerCallbackQuery()

      const row = findEscalation(parseInt(rawChatId), parseInt(rawTs))
      if (!row) {
        await ctx.reply(`Эскалация не найдена (chat=${rawChatId}, ts=${rawTs}).`)
        return
      }

      if (action === 'accept') {
        const { ok } = await handleEscalationAccept(row)
        await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } })
        await ctx.reply(
          ok ? `Ответ доставлен клиенту.` : `Ошибка доставки. Попробуй ещё раз.`,
        )

      } else if (action === 'escalate') {
        handleEscalationEscalate(row.id)
        await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } })
        await ctx.reply(`Напиши ответ для клиента - я перешлю.`)

      } else if (action === 'ignore') {
        handleEscalationIgnore(row.id)
        await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } })
        await ctx.reply(`Эскалация проигнорирована.`)
      }
    },
  )

  // Owner's manual reply after "escalate" action
  opsBot.on('message:text', async (ctx) => {
    if (ctx.chat.id !== ownerId) return

    const row = getPendingEscalation()
    if (!row) return

    const payload = parsePayload(row)
    const ok = await relayAnswerToClient(
      payload.tenant_slug,
      payload.client_chat_id,
      ctx.message.text,
      row.id,
    )

    if (ok) {
      await ctx.reply(`Ответ переслан клиенту ${payload.tenant_slug}.`)
    } else {
      await ctx.reply(
        `Не удалось переслать ответ. Проверь токен тенанта ${payload.tenant_slug}.`,
      )
    }
  })

  logger.info('ops-bot started')
  opsBot.start()
}

// Run only when executed as entry point, not when imported in tests
const _thisFile = fileURLToPath(import.meta.url)
if (process.argv[1] === _thisFile) {
  startBot()
}
