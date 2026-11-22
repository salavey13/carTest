import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import os from 'node:os'
import path from 'node:path'
import { PROJECT_ROOT, ANTHROPIC_MODEL } from './config.js'
import { logger } from './logger.js'
import {
  insertEscalation,
  getOnboardingRow,
  getComposioConnectedServices,
  getChatModel,
} from './db.js'

const execFileAsync = promisify(execFile)

// ─── Trigger detection ────────────────────────────────────────────────────────

const ESCALATION_PATTERNS: RegExp[] = [
  /не\s+работает/i,
  /не\s+отвечает/i,
  /не\s+работа/i,
  /ошибка/i,
  /помоги/i,
  /помощь/i,
  /починить/i,
  /сломался/i,
  /сломалось/i,
  /глюк/i,
  /баг/i,
]

export function isEscalationTrigger(text: string): boolean {
  return ESCALATION_PATTERNS.some(re => re.test(text))
}

// ─── Payload ──────────────────────────────────────────────────────────────────

export type EscalationPayload = {
  tenant_slug: string
  user_message: string
  last_50_log_lines: string
  bot_state: {
    onboarding_step: number | null
    connected_services: string[]
    model_in_use: string
  }
  client_chat_id: number
  timestamp: number
}

async function readLastLogLines(): Promise<string> {
  const logPath = path.join(PROJECT_ROOT, 'data', 'bot.log')
  try {
    const { stdout } = await execFileAsync('tail', ['-50', logPath])
    return stdout.trim()
  } catch {
    return ''
  }
}

function getTenantSlug(): string {
  const fromEnv = process.env['TENANT_SLUG']
  if (fromEnv) return fromEnv
  try {
    return os.hostname()
  } catch {
    return 'unknown'
  }
}

export async function buildEscalationPayload(
  chatId: number,
  userMessage: string,
): Promise<EscalationPayload> {
  const [logLines] = await Promise.all([readLastLogLines()])
  const onboardingRow = getOnboardingRow(chatId)
  const connectedServices = getComposioConnectedServices(chatId)
  const currentModel = getChatModel(String(chatId)) ?? ANTHROPIC_MODEL

  return {
    tenant_slug: getTenantSlug(),
    user_message: userMessage,
    last_50_log_lines: logLines,
    bot_state: {
      onboarding_step: onboardingRow?.current_step ?? null,
      connected_services: connectedServices,
      model_in_use: currentModel,
    },
    client_chat_id: chatId,
    timestamp: Date.now(),
  }
}

// ─── Ops channel delivery ─────────────────────────────────────────────────────

export type OpsDeliveryResult = {
  delivered: boolean
  message_id?: number
  error?: string
}

function formatPayloadText(payload: EscalationPayload): string {
  const ts = new Date(payload.timestamp).toISOString().replace('T', ' ').slice(0, 19)
  const logPreview = payload.last_50_log_lines
    ? payload.last_50_log_lines.split('\n').slice(-10).join('\n')
    : '(лог недоступен)'

  const services = payload.bot_state.connected_services.length
    ? payload.bot_state.connected_services.join(', ')
    : 'нет'

  const step =
    payload.bot_state.onboarding_step !== null
      ? `шаг ${payload.bot_state.onboarding_step}`
      : 'завершён'

  return [
    `[Эскалация] ${payload.tenant_slug} | ${ts}`,
    `Клиент (chat_id ${payload.client_chat_id}): ${payload.user_message}`,
    '',
    `Онбординг: ${step}`,
    `Сервисы: ${services}`,
    `Модель: ${payload.bot_state.model_in_use}`,
    '',
    'Последние строки лога:',
    logPreview,
  ].join('\n')
}

function buildInlineKeyboard(
  chatId: number,
  ts: number,
): { inline_keyboard: { text: string; callback_data: string }[][] } {
  return {
    inline_keyboard: [
      [{ text: 'Принять (auto-FAQ)', callback_data: `escalation:accept:${chatId}:${ts}` }],
      [{ text: 'Эскалировать (мне ответить)', callback_data: `escalation:escalate:${chatId}:${ts}` }],
      [{ text: 'Игнорировать', callback_data: `escalation:ignore:${chatId}:${ts}` }],
    ],
  }
}

export async function sendToOpsChannel(payload: EscalationPayload): Promise<OpsDeliveryResult> {
  const opsToken = process.env['KLODBOX_OPS_BOT_TOKEN']
  const opsChatId = process.env['KLODBOX_OPS_OWNER_CHAT_ID']

  if (!opsToken || !opsChatId) {
    logger.warn(
      'KLODBOX_OPS_BOT_TOKEN or KLODBOX_OPS_OWNER_CHAT_ID not set - escalation skipped',
    )
    return { delivered: false, error: 'ops env vars not configured' }
  }

  const url = `https://api.telegram.org/bot${opsToken}/sendMessage`
  const body = {
    chat_id: opsChatId,
    text: formatPayloadText(payload),
    parse_mode: 'HTML',
    reply_markup: buildInlineKeyboard(payload.client_chat_id, payload.timestamp),
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      logger.warn({ status: res.status, body: errText }, 'sendToOpsChannel: Telegram API error')
      return { delivered: false, error: `Telegram ${res.status}: ${errText.slice(0, 100)}` }
    }
    const data = (await res.json()) as { ok: boolean; result?: { message_id: number } }
    if (!data.ok) {
      return { delivered: false, error: 'Telegram returned ok=false' }
    }
    return { delivered: true, message_id: data.result?.message_id }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error({ err }, 'sendToOpsChannel: network error')
    return { delivered: false, error: msg }
  }
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

export async function handleEscalation(
  chatId: number,
  userMessage: string,
  sendReplyToClient: (text: string) => Promise<void>,
): Promise<void> {
  try {
    const payload = await buildEscalationPayload(chatId, userMessage)
    const result = await sendToOpsChannel(payload)

    const rowId = insertEscalation({
      chat_id: chatId,
      user_message: userMessage,
      payload_json: JSON.stringify(payload),
      status: 'pending',
    })
    logger.info({ chatId, rowId, delivered: result.delivered }, 'escalation recorded')

    if (result.delivered) {
      await sendReplyToClient('Передал владельцу, он скоро ответит.')
    } else {
      await sendReplyToClient('Возникла проблема. Попробуй ещё раз или опиши подробнее.')
    }
  } catch (err) {
    logger.error({ err, chatId }, 'handleEscalation failed')
    try {
      await sendReplyToClient('Не удалось передать запрос. Попробуй написать ещё раз.')
    } catch {}
  }
}
