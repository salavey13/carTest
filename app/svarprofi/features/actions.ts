'use server'

import { sendMessage } from '@/gateway/telegram/sendMessage'

// ─────────────────────────────────────────────────────
// SvarProfi ORDERX — Server Action
// ─────────────────────────────────────────────────────
// Sends a notification to the franchise admin (owner)
// via Telegram bot when a new order request is submitted.
//
// For authenticated users: includes their TG handle so
// admin can reply directly via Telegram.
//
// For anonymous users: includes the contact_method they
// provided so admin can reach back.
// ─────────────────────────────────────────────────────

const SVARPROFI_ADMIN_CHAT_ID = '413553377'

export interface SvarProfiOrderPayload {
  /** Auth status: 'authenticated' or 'anonymous' */
  auth_status: 'authenticated' | 'anonymous'
  /** Customer name */
  name: string
  /** TG username (only for authenticated users) */
  telegram_nickname?: string
  /** TG user_id — can be used to message the user back */
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

export async function submitSvarProfiOrder(payload: SvarProfiOrderPayload): Promise<{ ok: boolean; error?: string }> {
  try {
    const lines: string[] = []

    lines.push('<b>🔧 Новая заявка — СварПрофи-НН</b>')
    lines.push('')

    // Auth status badge
    if (payload.auth_status === 'authenticated') {
      lines.push(`👤 <b>Авторизован:</b> @${payload.telegram_nickname || 'не указан'}`)
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

    await sendMessage(SVARPROFI_ADMIN_CHAT_ID, text, {
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