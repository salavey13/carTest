/**
 * Error watcher — перехватывает logger.error/fatal и периодически
 * шлёт владельцу бота диагностическую сводку.
 *
 * Поведение:
 *  - Hook на pino logger.error / logger.fatal
 *  - Дедупликация: одинаковый message за 30 мин = 1 запись
 *  - Сканирование очереди каждые 5 мин
 *  - Rate-limit: не чаще 1 отчёта в 20 мин (чтобы не флудить и не сжигать API-квоту)
 *  - Получатель: ALLOWED_CHAT_ID (владелец бота)
 */

import { logger as baseLogger } from './logger.js'
import { runAgent } from './agent.js'
import { ALLOWED_CHAT_ID } from './config.js'

type ErrorEntry = {
  ts: number
  level: number
  message: string
  detail: string
}

const queue: ErrorEntry[] = []
const seenHashes = new Map<string, number>()
const DEDUP_WINDOW_MS = 30 * 60 * 1000
const SCAN_INTERVAL_MS = 5 * 60 * 1000
const MIN_GAP_BETWEEN_REPORTS_MS = 20 * 60 * 1000
const MAX_QUEUE = 50
let lastReportAt = 0
let watcherStarted = false

function hashOf(msg: string): string {
  return msg.slice(0, 80).replace(/\s+/g, ' ').trim()
}

function captureError(entry: ErrorEntry): void {
  const h = hashOf(entry.message + ' ' + entry.detail)
  const seen = seenHashes.get(h)
  if (seen && Date.now() - seen < DEDUP_WINDOW_MS) return
  seenHashes.set(h, Date.now())
  queue.push(entry)
  if (queue.length > MAX_QUEUE) queue.splice(0, queue.length - MAX_QUEUE)
}

// Сериализует Error-объект в plain object (message, stack, name, code и enumerable props).
// JSON.stringify(new Error('x')) даёт '{}' — non-enumerable props. Этот хелпер их раскрывает.
function serializeForLog(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj
  if (obj instanceof Error) {
    return { type: obj.name, message: obj.message, stack: obj.stack, ...((obj as any).code ? { code: (obj as any).code } : {}) }
  }
  const out: Record<string, any> = {}
  for (const k of Object.keys(obj)) {
    const v = obj[k]
    if (v instanceof Error) {
      out[k] = { type: v.name, message: v.message, stack: v.stack, ...((v as any).code ? { code: (v as any).code } : {}) }
    } else {
      out[k] = v
    }
  }
  return out
}

export function installErrorHook(): void {
  const origError = baseLogger.error.bind(baseLogger)
  const origFatal = baseLogger.fatal.bind(baseLogger)

  ;(baseLogger as any).error = (...args: any[]) => {
    try {
      const [first, second] = args
      let message = ''
      let detail = ''
      if (typeof first === 'string') {
        message = first
        detail = second ? JSON.stringify(serializeForLog(second)).slice(0, 500) : ''
      } else if (first && typeof first === 'object') {
        const errLike = first.err ?? first.error ?? first
        message = String(second ?? errLike?.message ?? 'error')
        detail = JSON.stringify(serializeForLog(first)).slice(0, 800)
      }
      captureError({ ts: Date.now(), level: 50, message, detail })
    } catch {}
    return origError(...args)
  }
  ;(baseLogger as any).fatal = (...args: any[]) => {
    try {
      const [first, second] = args
      let message = ''
      let detail = ''
      if (typeof first === 'string') message = first
      else if (first && typeof first === 'object') {
        const errLike = first.err ?? first.error ?? first
        message = String(second ?? errLike?.message ?? 'fatal')
        detail = JSON.stringify(serializeForLog(first)).slice(0, 800)
      }
      captureError({ ts: Date.now(), level: 60, message, detail })
    } catch {}
    return origFatal(...args)
  }
}

async function notifyOwner(api: any, text: string): Promise<void> {
  if (!ALLOWED_CHAT_ID) return
  try {
    await api.sendMessage(ALLOWED_CHAT_ID, text)
  } catch (err) {
    console.warn('[error-watcher] DM to owner failed:', err)
  }
}

async function runDiagnosticPass(api: any): Promise<void> {
  if (queue.length === 0) return
  const now = Date.now()
  if (now - lastReportAt < MIN_GAP_BETWEEN_REPORTS_MS) return

  const batch = queue.splice(0, queue.length)
  lastReportAt = now

  const summary = batch
    .map((e, i) => `${i + 1}. [${new Date(e.ts).toISOString().slice(11, 19)}] ${e.message}\n   ${e.detail.slice(0, 300)}`)
    .join('\n\n')

  const prompt =
    `Я бот, обнаружил ${batch.length} ошибок за последние минуты:\n\n` +
    summary + '\n\n' +
    'Для каждой определи тип (квота API, парсинг, сеть, конфиг, баг) и одной строкой — что проверить/починить. ' +
    'Объединяй одинаковые. Кратко (≤10 строк). Не правь код — только диагноз для владельца.'

  try {
    const result = await runAgent(prompt)
    const text = result.text?.trim() || '(агент не вернул текст)'
    await notifyOwner(api, `⚠️ Авто-диагностика бота\nОшибок: ${batch.length}\n\n${text}`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await notifyOwner(api, `⚠️ Авто-диагностика упала\nОшибок было: ${batch.length}\nАгент не ответил: ${msg.slice(0, 200)}\n\nЗапусти /diagnose вручную.`)
  }
}

export function startErrorWatcher(api: any): void {
  if (watcherStarted) return
  watcherStarted = true
  installErrorHook()
  setInterval(() => {
    runDiagnosticPass(api).catch((e) => console.warn('[error-watcher]', e))
  }, SCAN_INTERVAL_MS)
}
