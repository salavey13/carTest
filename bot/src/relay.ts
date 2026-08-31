/**
 * relay.ts -- доставка ответа Олега обратно в клиентский бот
 *
 * Экспорты:
 *   loadTenantBotToken(tenantSlug) -> string | null
 *   relayAnswerToClient(tenantSlug, clientChatId, answer, escalationId?) -> Promise<boolean>
 */

import fs from 'node:fs'
import path from 'node:path'
import { updateEscalationStatus } from './db.js'
import { PROJECT_ROOT } from './config.js'
import { splitMessage } from './bot.js'
import { logger } from './logger.js'

// ---------------------------------------------------------------------------
// Token loading
// ---------------------------------------------------------------------------

/** Read TELEGRAM_BOT_TOKEN from tenants/<slug>/.env (dotenv-style). */
export function loadTenantBotToken(tenantSlug: string): string | null {
  const envPath = path.join(PROJECT_ROOT, 'tenants', tenantSlug, '.env')
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
      const m = line.match(/^TELEGRAM_BOT_TOKEN\s*=\s*(.+)$/)
      if (m) return m[1].trim().replace(/^['"]|['"]$/g, '')
    }
  }

  // Fallback: tenant.yaml (bot_token: <value>)
  const yamlPath = path.join(PROJECT_ROOT, 'tenants', tenantSlug, 'tenant.yaml')
  if (fs.existsSync(yamlPath)) {
    const content = fs.readFileSync(yamlPath, 'utf-8')
    for (const line of content.split('\n')) {
      const m = line.match(/^bot_token\s*:\s*(.+)$/)
      if (m) return m[1].trim()
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Relay
// ---------------------------------------------------------------------------

/**
 * Send owner's answer to the client via their tenant bot.
 * If escalationId is provided, marks the escalation as 'answered'.
 */
export async function relayAnswerToClient(
  tenantSlug: string,
  clientChatId: number,
  answer: string,
  escalationId?: number,
): Promise<boolean> {
  const token = loadTenantBotToken(tenantSlug)
  if (!token) {
    logger.error({ tenantSlug }, 'relay: no bot token found for tenant')
    appendOpsLog(tenantSlug, `relay_error: no token for tenant=${tenantSlug}`)
    return false
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`
  // Нарезка ≤4096 (лимит Telegram). Префикс «От владельца:» — только в первом чанке.
  const chunks = splitMessage(`От владельца: ${answer}`)

  try {
    for (const chunk of chunks) {
      const res = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: clientChatId, text: chunk }),
      })
      const data = await res.json() as { ok: boolean; description?: string }

      if (!data.ok) {
        logger.error(
          { tenantSlug, clientChatId, description: data.description },
          'relay: TG API error',
        )
        appendOpsLog(tenantSlug, `relay_error: TG API: ${data.description ?? 'unknown'}`)
        return false
      }
    }

    if (escalationId !== undefined) {
      updateEscalationStatus(escalationId, 'answered')
    }

    appendOpsLog(tenantSlug, `relay_ok: sent to client_chat_id=${clientChatId}`)
    return true

  } catch (err) {
    logger.error({ tenantSlug, clientChatId, err }, 'relay: fetch failed')
    appendOpsLog(tenantSlug, `relay_error: fetch failed: ${String(err)}`)
    return false
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function appendOpsLog(tenantSlug: string, msg: string): void {
  try {
    const logDir = path.join(PROJECT_ROOT, 'ops', 'logs', tenantSlug)
    fs.mkdirSync(logDir, { recursive: true })
    const ts = new Date().toISOString()
    fs.appendFileSync(path.join(logDir, 'ops-actions.log'), `[${ts}] relay.ts | ${msg}\n`)
  } catch {
    // non-fatal
  }
}
