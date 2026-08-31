/**
 * modules/lead-watcher/watcher.ts — Realtime-подписчик на franchize_intents + rich-нотификации в Telegram.
 * =============================================================================
 *
 * Long-running процесс, отдельный от основного бота.
 *   Запуск:  npm run lead-watcher   (или: tsx modules/lead-watcher/watcher.ts)
 *
 * Что делает:
 *   1. Подключается к Supabase Realtime (service_role key, ws transport).
 *   2. Подписывается на INSERT в public.franchize_intents.
 *   3. На каждый новый лид шлёт rich-сообщение в LEAD_WATCHER_CHAT_ID
 *      (хардкод для тестов = 413553377; переопределяется env).
 *
 * Требует миграцию 20260722120000_enable_realtime_franchize_intents.sql
 * (add franchize_intents в publication supabase_realtime). Без неё Realtime
 * молча не пришлёт события — см. logs на старте.
 *
 * Источники лидов (contact_channel):
 *   - avito                → оператор форварднул заявку Авито (catalog add-avito-lead)
 *   - telegram_forward     → CTA «перезвоните» с vip-bike.ru (catalog add-callback-lead)
 *   - website / phone / operator / telegram / ... → прочие
 *
 * См. также:
 *   - modules/contract/lib/supabase.ts (addAvitoLead, addCallbackLead)
 *   - cartest-migrations/20260722120000_enable_realtime_franchize_intents.sql
 */

// Загружаем .env в process.env ДО импорта supabase.ts.
// readEnvFile populate'ит process.env (см. src/env.ts:36).
import { readEnvFile } from '../../src/env.js'
readEnvFile()

import { request } from 'undici'
import { getSupabaseClient } from '../contract/lib/supabase.js'

// ── Конфиг ───────────────────────────────────────────────────────────────────

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? ''
// Хардкод для тестов (см. задачу). Через env — когда выкатим на оператора.
const LEAD_WATCHER_CHAT_ID = process.env.LEAD_WATCHER_CHAT_ID ?? '413553377'
const SUPABASE_URL = process.env.SUPABASE_URL ?? ''

// Polling-fallback интервал. Realtime в supabase-js переподключается сам,
// но если событие INSERT всё-таки потерялось (timeout, race с подпиской),
// этот тик раз в 13 минут дёрнет БД и догонит пропущенное.
// 12 секунд тут были оверкиллом — спамили бы БД и Telegram.
const POLL_FALLBACK_MS = 13 * 60_000

// Кэш bot username (для построения deep-link https://t.me/<bot>/app?startapp=…).
// Заполняется один раз при старте через getMe.
let botUsernameCache: string | null = null

// ── Типы (mirror franchize_intents) ──────────────────────────────────────────

interface FranchizeIntentRow {
  id: string
  slug: string
  bike_id: string | null
  intent_type: string
  stage: string
  source_route: string | null
  contact_channel: string | null
  urgency_score: number
  metadata: Record<string, unknown>
  telegram_user_id: string | null
  phone: string | null
  created_at: string
}

interface RealtimePayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE' | 'SELECT'
  new: FranchizeIntentRow
  old: Partial<FranchizeIntentRow> | null
}

// ── Telegram send ────────────────────────────────────────────────────────────

async function sendTelegram(text: string): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('[lead-watcher] TELEGRAM_BOT_TOKEN не задан — не могу послать нотификацию')
    return
  }
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`
  const res = await request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: Number(LEAD_WATCHER_CHAT_ID),
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  })
  if (res.statusCode >= 400) {
    const body = await res.body.text()
    console.error(`[lead-watcher] Telegram API ${res.statusCode}: ${body.slice(0, 500)}`)
  }
}

// ── Bot username (для deep-link) ─────────────────────────────────────────────

async function fetchBotUsername(): Promise<string | null> {
  if (botUsernameCache) return botUsernameCache
  if (!TELEGRAM_BOT_TOKEN) return null
  try {
    const res = await request(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`)
    const body = await res.body.json() as { ok: boolean; result?: { username?: string } }
    if (body.ok && body.result?.username) {
      botUsernameCache = body.result.username
      console.log(`[lead-watcher] bot username = @${botUsernameCache}`)
    }
  } catch (e) {
    console.error('[lead-watcher] getMe не удался — deep-link будет без username:', e)
  }
  return botUsernameCache
}

/**
 * Deep-link, который открывает web-app с конкретным лидом.
 *   https://t.me/<bot>/app?startapp=lead_<id>
 *
 * Парсится в `useStartParamRouter.ts` (префикс `lead_` / `lead-`) и ведёт на
 * `/franchize/<slug>/leads?leadId=<id>` — LeadsClient подсветит строку и откроет
 * детальную панель. Если username бота unknown (getMe не сработал), вернёт null
 * и ссылка не покажется.
 */
async function buildLeadDeepLink(leadId: string): Promise<string | null> {
  const bot = await fetchBotUsername()
  if (!bot) return null
  // startapp-параметр ограничен ~4096 символов; leadId — это UUID или
  // phone/userId (короткие), так что `lead_<id>` всегда влезает.
  return `https://t.me/${bot}/app?startapp=lead_${encodeURIComponent(leadId)}`
}

// ── HTML escaping (для контента из лидов — там могут быть <, >, &) ────────────

function esc(s: unknown): string {
  if (s === null || s === undefined) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// ── Бейдж источника ──────────────────────────────────────────────────────────

function sourceBadge(channel: string | null): { label: string; emoji: string } {
  switch (channel) {
    case 'avito':              return { label: 'Avito',       emoji: '🟠' }
    case 'telegram_forward':   return { label: 'Сайт (CTA)',  emoji: '🌐' }
    case 'website':            return { label: 'Сайт',        emoji: '🌐' }
    case 'telegram':           return { label: 'Telegram',    emoji: '✈️' }
    case 'phone':              return { label: 'Телефон',     emoji: '📞' }
    case 'operator':           return { label: 'Оператор',    emoji: '👤' }
    default:                   return { label: channel ?? 'неизвестно', emoji: '❓' }
  }
}

// ── Supabase Studio link ─────────────────────────────────────────────────────

function studioUrl(): string | null {
  // SUPABASE_URL = https://<project-ref>.supabase.co
  const m = SUPABASE_URL.match(/^https?:\/\/([a-z0-9]+)\.supabase\./i)
  if (!m) return null
  return `https://supabase.com/dashboard/project/${m[1]}/editor?schema=public&table=franchize_intents`
}

// ── Rich-форматирование ──────────────────────────────────────────────────────

async function formatLeadMessage(row: FranchizeIntentRow): Promise<string> {
  const md = row.metadata ?? {}
  const badge = sourceBadge(row.contact_channel)
  const lines: string[] = []

  lines.push(`🔔 <b>Новый лид</b>  ${badge.emoji} <b>${esc(badge.label)}</b>`)
  lines.push('')

  const name = typeof md.name === 'string' && md.name.trim() ? md.name.trim() : null
  const phone = row.phone ?? (typeof md.phone === 'string' ? md.phone : null)
  const bikeTitle = typeof md.bikeTitle === 'string' && md.bikeTitle.trim() ? md.bikeTitle.trim() : null
  const message = typeof md.message === 'string' && md.message.trim() ? md.message.trim() : null

  if (name)        lines.push(`<b>Имя:</b> ${esc(name)}`)
  if (phone)       lines.push(`<b>Телефон:</b> ${esc(phone)}`)
  if (bikeTitle)   lines.push(`<b>Байк:</b> ${esc(bikeTitle)}`)
  if (row.bike_id) lines.push(`<b>Bike ID:</b> <code>${esc(row.bike_id)}</code>`)
  if (message) {
    const snippet = message.length > 240 ? message.slice(0, 237) + '...' : message
    lines.push(`<b>Сообщение:</b> «${esc(snippet)}»`)
  }

  // Ссылки
  const links: string[] = []
  // Deep-link в web-app на карточку лида — первый в списке, самая полезная ссылка.
  // leadId — это franchize_intents.id (UUID). Используем user-facing идентификатор
  // лида из metadata.user_id / phone / telegram_user_id, если есть (так строка
  // реально находится в /leads, который ключуется по user_id, не по UUID).
  const leadKey =
    (typeof md.user_id === 'string' && md.user_id) ||
    row.telegram_user_id ||
    row.phone ||
    row.id
  const deepLink = await buildLeadDeepLink(String(leadKey))
  if (deepLink) {
    links.push(`📲 <a href="${esc(deepLink)}">Открыть лида в web-app</a>`)
  }
  if (badge.label === 'Avito' && typeof md.avitoUrl === 'string' && md.avitoUrl) {
    links.push(`🔗 <a href="${esc(md.avitoUrl)}">Переписка на Авито</a>`)
  } else if (row.source_route && /^https?:\/\//i.test(row.source_route)) {
    links.push(`🔗 <a href="${esc(row.source_route)}">Источник</a>`)
  }
  const studio = studioUrl()
  if (studio) {
    links.push(`📊 <a href="${esc(studio)}">Открыть в Supabase</a>`)
  }
  if (links.length) {
    lines.push('')
    lines.push(links.join('  ·  '))
  }

  lines.push('')
  lines.push(
    `<i>${esc(row.intent_type)}/${esc(row.stage)} · urgency ${row.urgency_score} · ` +
    `<code>${esc(row.id)}</code></i>`,
  )

  return lines.join('\n')
}

// ── Handler ──────────────────────────────────────────────────────────────────

// Дедупликация: Realtime и polling-fallback могут поймать один и тот же INSERT.
// Set хранит id лидов, по которым уже послали нотификацию. Растёт без ограничений
// — для долгоживущего процесса можно заменить на LRU, но реальный объём (десятки
// лидов в день) делает проблему преждевременной оптимизацией.
const notifiedIds = new Set<string>()

async function onInsert(payload: RealtimePayload): Promise<void> {
  const row = payload.new
  if (!row?.id) {
    console.warn('[lead-watcher] INSERT без row.new.id — пропускаю', JSON.stringify(payload).slice(0, 200))
    return
  }
  console.log(`[lead-watcher] INSERT id=${row.id} channel=${row.contact_channel} intent=${row.intent_type}/${row.stage}`)

  try {
    if (notifiedIds.has(row.id)) {
      // Уже слали (Realtime + polling могли дважды поймать один и тот же INSERT).
      return
    }
    notifiedIds.add(row.id)
    const text = await formatLeadMessage(row)
    await sendTelegram(text)
    console.log(`[lead-watcher] → notified chat ${LEAD_WATCHER_CHAT_ID}`)
  } catch (e) {
    console.error('[lead-watcher] не удалось послать нотификацию:', e)
  }
}

// ── Polling fallback ─────────────────────────────────────────────────────────

/**
 * Раз в POLL_FALLBACK_MS (13 минут) дёргает БД и догоняет лиды, созданные за
 * последние 15 минут, если Realtime-событие потерялось. Realtime в supabase-js
 * сам переподключается, но эта страховка полезна на случай рассинхрона подписки
 * или длительного network blip. 13 минут — компромисс между «ловить пропущенное
 * быстро» и «не спамить БД». Раньше тут было 12 секунд — оверкилл.
 */
async function pollFallback(): Promise<void> {
  const sb = getSupabaseClient()
  const since = new Date(Date.now() - 15 * 60_000).toISOString()
  try {
    const { data, error } = await sb
      .from('franchize_intents')
      .select('id, slug, bike_id, intent_type, stage, source_route, contact_channel, urgency_score, metadata, telegram_user_id, phone, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('[lead-watcher] poll error:', error.message)
      return
    }
    if (!data || data.length === 0) return

    const fresh = (data as FranchizeIntentRow[]).filter((r) => !notifiedIds.has(r.id))
    if (fresh.length === 0) return

    console.log(`[lead-watcher] poll: догоняю ${fresh.length} пропущенных лид(ов)`)
    for (const row of fresh) {
      // Имитируем Realtime-payload, чтобы переиспользовать onInsert.
      await onInsert({ eventType: 'INSERT', new: row, old: null })
    }
  } catch (e) {
    console.error('[lead-watcher] poll unexpected error:', e)
  }
}

function startPollFallback(): void {
  // Первый тик — через POLL_FALLBACK_MS после старта (не сразу), чтобы дать
  // Realtime время подписаться и не дублировать свежие INSERT'ы сразу при пуше.
  setInterval(() => {
    void pollFallback().catch((e) => console.error('[lead-watcher] pollFallback async error:', e))
  }, POLL_FALLBACK_MS)
  console.log(`[lead-watcher] polling fallback активен (раз в ${POLL_FALLBACK_MS / 60_000} мин)`)
}

// ── Realtime subscription ────────────────────────────────────────────────────

function subscribe(): void {
  const sb = getSupabaseClient()

  const channel = sb.channel('franchize-intents-inserts')

  channel.on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'franchize_intents' },
    (payload: unknown) => {
      onInsert(payload as RealtimePayload).catch((e) => {
        console.error('[lead-watcher] onInsert async error:', e)
      })
    },
  )

  channel.subscribe((status: string, err?: Error) => {
    if (status === 'SUBSCRIBED') {
      console.log('[lead-watcher] ✅ SUBSCRIBED — слушаю новые лиды franchize_intents')
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      console.error(`[lead-watcher] ❌ ${status}`, err?.message ?? '')
      console.error('[lead-watcher] Проверь, что миграция 20260722120000_enable_realtime_franchize_intents.sql применена.')
    } else if (status === 'CLOSED') {
      console.warn('[lead-watcher] 🔌 канал закрыт (supabase-js переподключит автоматически)')
    } else {
      console.log(`[lead-watcher] channel status: ${status}`)
    }
  })
}

// ── Heartbeat (для системника — простой лог «я жив») ─────────────────────────

setInterval(() => {
  const mem = process.memoryUsage()
  console.log(
    `[lead-watcher] alive · rss ${(mem.rss / 1024 / 1024).toFixed(1)}MB · ` +
    `${new Date().toISOString()}`,
  )
}, 5 * 60_000)

// ── Main ─────────────────────────────────────────────────────────────────────

function main(): void {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('[lead-watcher] FATAL: TELEGRAM_BOT_TOKEN не задан в .env')
    process.exit(1)
  }
  if (!SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[lead-watcher] FATAL: SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY не заданы в .env')
    process.exit(1)
  }

  console.log(`[lead-watcher] start · notify chat_id=${LEAD_WATCHER_CHAT_ID}`)
  console.log(`[lead-watcher] supabase=${SUPABASE_URL}`)
  console.log('[lead-watcher] подключаюсь к Realtime...')

  // Предзагрузка bot username для deep-link в нотификациях.
  void fetchBotUsername()

  subscribe()
  startPollFallback()

  // Стартовая «проверка связи» — короткое сообщение в чат, чтобы оператор видел,
  // что демон поднялся. Однократно.
  sendTelegram(
    '🟢 <b>Lead watcher запущен</b>\n\n' +
    `<i>Слушаю новые лиды в franchize_intents. Уведомления будут приходить в этот чат.</i>`,
  ).catch((e) => console.error('[lead-watcher] стартовый ping не отправлен:', e))
}

main()
