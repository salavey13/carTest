'use server'

import { sendMessage } from '@/gateway/telegram/sendMessage'
import { supabaseAdmin } from '@/lib/supabase-server'

// ─────────────────────────────────────────────────────
// SvarProfi ORDERX — Server Action
// ─────────────────────────────────────────────────────
// Sends a notification to the CREW OWNER via Telegram bot
// when a new order request is submitted.
//
// Resolution: crews.owner_id IS the Telegram chat ID
// (user_id === telegram chat_id in this system).
//
// Fallback: ADMIN_CHAT_ID env → hardcoded constant.
// ─────────────────────────────────────────────────────

const CREW_SLUG = 'svarprofi'
const FALLBACK_CHAT_ID = process.env.ADMIN_CHAT_ID || '413553377'

export interface SvarProfiOrderPayload {
  /** Auth status: 'authenticated' or 'anonymous' */
  auth_status: 'authenticated' | 'anonymous'
  /** Customer name */
  name: string
  /** TG @username — the handle for replying directly */
  username?: string
  /** TG user_id — internal, for reference only */
  telegram_user_id?: string
  /** Contact method provided by anonymous user */
  contact_method?: string
  /** Phone number */
  phone?: string
  /** Email */
  email?: string
  /** Selected product type */
  product_type: string
  /** Approximate dimensions */
  dimensions?: string
  /** Free-form comment */
  comment?: string
  /** Which product page the request came from (optional) */
  vehicle_slug?: string
}

/**
 * Resolves crew owner's Telegram chat ID.
 * owner_id in crews = user_id = telegram chat_id — one lookup, done.
 */
async function resolveCrewOwnerChatId(): Promise<string> {
  try {
    const { data: crewRow } = await supabaseAdmin
      .from('crews')
      .select('owner_id')
      .eq('slug', CREW_SLUG)
      .maybeSingle()

    if (crewRow?.owner_id) {
      return String(crewRow.owner_id)
    }
  } catch (err) {
    console.warn('[ORDERX] Failed to resolve crew owner, using fallback:', err)
  }

  return FALLBACK_CHAT_ID
}

export async function submitSvarProfiOrder(payload: SvarProfiOrderPayload): Promise<{ ok: boolean; error?: string }> {
  try {
    const lines: string[] = []

    lines.push('<b>🔧 Новая заявка — СварПрофи-НН</b>')
    lines.push('')

    // Auth status badge
    if (payload.auth_status === 'authenticated') {
      const handle = payload.username ? `@${payload.username}` : 'не указан'
      lines.push(`👤 <b>Авторизован:</b> ${handle}`)
      if (payload.telegram_user_id) {
        lines.push(`   ID: <code>${payload.telegram_user_id}</code>`)
      }
    } else {
      lines.push(`👤 <b>Гость</b> (не авторизован)`)
    }

    lines.push('')
    lines.push(`📋 <b>Имя:</b> ${payload.name}`)

    if (payload.phone) {
      lines.push(`📞 <b>Телефон:</b> ${payload.phone}`)
    }
    if (payload.email) {
      lines.push(`📧 <b>Email:</b> ${payload.email}`)
    }
    if (payload.contact_method) {
      lines.push(`🔗 <b>Связь:</b> ${payload.contact_method}`)
    }

    lines.push('')
    lines.push(`🏗 <b>Тип конструкции:</b> ${payload.product_type}`)

    if (payload.dimensions) {
      lines.push(`📏 <b>Размеры:</b> ${payload.dimensions}`)
    }
    if (payload.vehicle_slug) {
      lines.push(`🔗 <b>Из карточки:</b> ${payload.vehicle_slug}`)
    }
    if (payload.comment) {
      lines.push(`💬 <b>Комментарий:</b> ${payload.comment}`)
    }

    const text = lines.join('\n')

    const targetChatId = await resolveCrewOwnerChatId()

    await sendMessage(targetChatId, text, {
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    })

    return { ok: true }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[ORDERX] Failed to send notification:', message)
    return { ok: false, error: message }
  }
}
