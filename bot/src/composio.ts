import { COMPOSIO_API_KEY, COMPOSIO_USER_ID } from './config.js'
import { logger } from './logger.js'
import {
  markComposioConnected,
  isComposioConnected,
  getComposioConnectedServices,
  markComposioPending,
  getComposioPending,
  updateComposioPendingStatus,
  removeComposioPending,
  forgetComposioConnection,
} from './db.js'

/** Polling interval in milliseconds. */
export const POLL_INTERVAL_MS = 7_000
/** Maximum time to wait for OAuth completion before timing out. */
export const MAX_POLL_MS = 300_000

const COMPOSIO_BASE = 'https://backend.composio.dev/api/v3'

// Дефолтный список тулкитов которые можно подключить через /connect
export const DEFAULT_TOOLKITS: { slug: string; label: string; emoji: string }[] = [
  { slug: 'notion', label: 'Notion', emoji: '📝' },
  { slug: 'googlecalendar', label: 'Google Calendar', emoji: '📅' },
  { slug: 'googledrive', label: 'Google Drive', emoji: '📁' },
  { slug: 'gmail', label: 'Gmail', emoji: '✉️' },
  { slug: 'googlesheets', label: 'Google Sheets', emoji: '📊' },
  { slug: 'googledocs', label: 'Google Docs', emoji: '📄' },
]

type AuthConfig = { id: string; toolkit?: { slug: string } }
type ConnectedAccount = { id: string; status: string; user_id: string; toolkit: { slug: string } }

async function composioFetch(path: string, opts: RequestInit = {}): Promise<unknown> {
  if (!COMPOSIO_API_KEY) throw new Error('COMPOSIO_API_KEY не задан в .env')
  const res = await fetch(`${COMPOSIO_BASE}${path}`, {
    ...opts,
    headers: {
      'x-api-key': COMPOSIO_API_KEY,
      'Content-Type': 'application/json',
      ...(opts.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Composio ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json()
}

export async function listAuthConfigs(): Promise<AuthConfig[]> {
  const data = await composioFetch('/auth_configs?limit=50') as { items?: AuthConfig[] }
  return data.items ?? []
}

export async function listConnectedAccounts(): Promise<ConnectedAccount[]> {
  const data = await composioFetch(`/connected_accounts?user_ids=${encodeURIComponent(COMPOSIO_USER_ID)}&limit=50`) as { items?: ConnectedAccount[] }
  return data.items ?? []
}

// Найти или создать auth_config для тулкита
async function ensureAuthConfig(slug: string): Promise<string> {
  const configs = await listAuthConfigs()
  const existing = configs.find(c => c.toolkit?.slug === slug)
  if (existing) return existing.id

  const created = await composioFetch('/auth_configs', {
    method: 'POST',
    body: JSON.stringify({
      toolkit: { slug },
      auth_config: { type: 'use_composio_managed_auth' },
    }),
  }) as { auth_config?: { id: string } }
  if (!created.auth_config?.id) throw new Error(`Не получилось создать auth_config для ${slug}`)
  return created.auth_config.id
}

// Сгенерировать СВЕЖУЮ OAuth-ссылку для тулкита. Возвращает URL и connection_id.
export async function generateConnectUrl(slug: string): Promise<{ url: string; connectionId: string }> {
  const ac_id = await ensureAuthConfig(slug)
  const data = await composioFetch('/connected_accounts', {
    method: 'POST',
    body: JSON.stringify({
      auth_config: { id: ac_id },
      connection: { user_id: COMPOSIO_USER_ID },
    }),
  }) as { id?: string; redirect_url?: string; connectionData?: { redirectUrl?: string } }
  const url = data.redirect_url ?? data.connectionData?.redirectUrl
  if (!url) throw new Error(`Composio не вернул redirect_url для ${slug}`)
  const connectionId = data.id ?? ''
  return { url, connectionId }
}

// Статус подключений: какие тулкиты ACTIVE, EXPIRED, не подключены
export async function getConnectionsStatus(): Promise<{ slug: string; label: string; emoji: string; status: 'ACTIVE' | 'EXPIRED' | 'NONE' }[]> {
  let connected: ConnectedAccount[] = []
  try {
    connected = await listConnectedAccounts()
  } catch (err) {
    logger.warn({ err }, 'listConnectedAccounts failed')
  }
  return DEFAULT_TOOLKITS.map(t => {
    const acc = connected.find(c => c.toolkit.slug === t.slug)
    let status: 'ACTIVE' | 'EXPIRED' | 'NONE' = 'NONE'
    if (acc) {
      status = acc.status === 'ACTIVE' ? 'ACTIVE' : 'EXPIRED'
    }
    return { slug: t.slug, label: t.label, emoji: t.emoji, status }
  })
}

export function findToolkit(query: string): { slug: string; label: string; emoji: string } | undefined {
  const q = query.toLowerCase().trim()
  return DEFAULT_TOOLKITS.find(t =>
    t.slug === q ||
    t.label.toLowerCase() === q ||
    t.label.toLowerCase().replace(/\s+/g, '') === q.replace(/\s+/g, '')
  )
}

// ─── Onboarding-level OAuth helpers ──────────────────────────────────────────

/** Onboarding service names (short aliases used in onboarding FSM). */
export type ComposioService = 'notion' | 'googledrive' | 'googlecalendar' | 'gmail' | 'googlesheets' | 'googledocs'

const COMPOSIO_SERVICES = new Set<ComposioService>(['notion', 'googledrive', 'googlecalendar', 'gmail', 'googlesheets', 'googledocs'])

/** Maps onboarding service alias → Composio toolkit slug. */
const SERVICE_TO_SLUG: Record<ComposioService, string> = {
  notion: 'notion',
  googledrive: 'googledrive',
  googlecalendar: 'googlecalendar',
  gmail: 'gmail',
  googlesheets: 'googlesheets',
  googledocs: 'googledocs',
}

export function isValidService(s: string): s is ComposioService {
  return COMPOSIO_SERVICES.has(s as ComposioService)
}

/**
 * Генерирует OAuth-ссылку для сервиса.
 * Если COMPOSIO_API_KEY не задан — возвращает stub URL, сразу помечает сервис подключённым.
 * Если ключ задан — создаёт реальную ссылку и сохраняет connection_id в composio_pending
 * для последующего polling через pollOAuthCompletion.
 */
export async function getOAuthUrl(service: ComposioService, chatId: number): Promise<string> {
  if (!COMPOSIO_API_KEY) {
    throw new Error('COMPOSIO_API_KEY не задан в .env — попроси админа настроить')
  }
  const slug = SERVICE_TO_SLUG[service]
  const { url, connectionId } = await generateConnectUrl(slug)
  markComposioPending(chatId, service, connectionId)
  return url
}

/**
 * Live-проверка через Composio API: подключён ли сервис у текущего COMPOSIO_USER_ID.
 * Reconcile с локальным SQLite: если API говорит ACTIVE — отмечаем в SQLite;
 * если API говорит NONE/EXPIRED а SQLite думает ACTIVE — чистим SQLite.
 * Возвращает true если по API ACTIVE.
 */
async function reconcileConnection(service: ComposioService, chatId: number): Promise<boolean> {
  if (!COMPOSIO_API_KEY) return false
  try {
    const slug = SERVICE_TO_SLUG[service]
    const accounts = await listConnectedAccounts()
    const acc = accounts.find(a => a.toolkit.slug === slug)
    const apiActive = acc?.status === 'ACTIVE'
    const sqliteActive = isComposioConnected(chatId, service)
    if (apiActive && !sqliteActive) {
      markComposioConnected(chatId, service)
    } else if (!apiActive && sqliteActive) {
      forgetComposioConnection(chatId, service)
    }
    return apiActive
  } catch (err) {
    logger.warn({ err, service }, 'reconcileConnection failed, falling back to SQLite')
    return isComposioConnected(chatId, service)
  }
}

/** Отметить сервис подключённым в SQLite. */
export function markConnected(service: ComposioService, chatId: number): void {
  markComposioConnected(chatId, service)
}

/** Проверить, подключён ли сервис для данного chatId. */
export function isConnected(service: ComposioService, chatId: number): boolean {
  return isComposioConnected(chatId, service)
}

/** Вернуть список всех подключённых сервисов для chatId. */
export function getConnectedServices(chatId: number): string[] {
  return getComposioConnectedServices(chatId)
}

/**
 * Обработать команду /connect <service>.
 * Экспортируется для регистрации в bot.ts через bot-integrator.
 */
export async function handleConnectCommand(chatId: number, service: string): Promise<string> {
  const trimmed = (service ?? '').trim()
  if (!trimmed) {
    return [
      'Подключить сервис',
      '',
      'Доступные:',
      '📝 /connect notion          — Notion',
      '📅 /connect googlecalendar  — Google Calendar',
      '📁 /connect googledrive     — Google Drive',
      '✉️ /connect gmail           — Gmail',
      '📊 /connect googlesheets    — Google Sheets',
      '📄 /connect googledocs      — Google Docs',
      '',
      'Например: /connect notion',
    ].join('\n')
  }
  if (!isValidService(trimmed)) {
    return `Неизвестный сервис "${trimmed}". Доступные: notion, googlecalendar, googledrive, gmail, googlesheets, googledocs`
  }
  // Live-check через Composio API + reconcile SQLite. Защищает от stale SQLite-кеша.
  const apiActive = await reconcileConnection(trimmed, chatId)
  if (apiActive) {
    return `${trimmed} уже подключен`
  }
  try {
    const url = await getOAuthUrl(trimmed, chatId)
    return `Для подключения ${trimmed} перейди по ссылке:\n${url}`
  } catch (err) {
    logger.error({ err }, `handleConnectCommand failed for ${trimmed}`)
    return `Не удалось получить ссылку для ${trimmed}. ${(err as Error).message}`
  }
}

/**
 * Опрашивает Composio API до получения статуса ACTIVE, FAILED или TIMEOUT.
 * Запускается в фоне (fire-and-forget) после выдачи OAuth-ссылки пользователю.
 *
 * Stub-режим (COMPOSIO_API_KEY не задан): pending-запись не существует,
 * функция сразу возвращает управление без создания интервала.
 */
export async function pollOAuthCompletion(
  chatId: number,
  service: ComposioService,
  sendReply: (text: string) => Promise<void>,
): Promise<void> {
  const pending = getComposioPending(chatId, service)
  if (!pending) return // stub mode или уже обработано

  const { connection_id, started_at } = pending
  const deadline = started_at + MAX_POLL_MS

  const handle = setInterval(() => {
    void (async () => {
      try {
        // Проверка таймаута
        if (Date.now() >= deadline) {
          clearInterval(handle)
          updateComposioPendingStatus(chatId, service, 'TIMEOUT')
          await sendReply(
            `Время на подключение ${service} истекло. /connect ${service} чтобы попробовать снова.`,
          )
          return
        }

        // Проверяем запись — могла быть удалена из БД пока интервал работал
        const current = getComposioPending(chatId, service)
        if (!current) {
          clearInterval(handle)
          return
        }

        // Запрос статуса к Composio API
        const data = (await composioFetch(`/connected_accounts/${connection_id}`)) as {
          status?: string
        }
        const status = data.status

        if (status === 'ACTIVE') {
          clearInterval(handle)
          markConnected(service, chatId)
          removeComposioPending(chatId, service)
          await sendReply(`${service} подключён.`)
        } else if (status === 'FAILED') {
          clearInterval(handle)
          updateComposioPendingStatus(chatId, service, 'FAILED')
          await sendReply(`Не удалось подключить ${service}. Попробуй /connect ${service} снова.`)
        }
        // Иначе статус PENDING / INITIATED — продолжаем опрос
      } catch (err) {
        logger.warn({ err, chatId, service }, 'pollOAuthCompletion: fetch error, will retry')
      }
    })()
  }, POLL_INTERVAL_MS)
}
