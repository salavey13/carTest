// types/telegram.ts
export interface WebAppUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  photo_url?: string
  chat_id?: number // Add this if available in initDataUnsafe
  is_premium?: boolean
  is_bot?: boolean
  added_to_attachment_menu?: boolean
  allows_write_to_pm?: boolean
}

export interface WebAppInitData {
  user?: WebAppUser
  auth_date?: number
  hash?: string
  query_id?: string
  start_param?: string
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp
    }
  }
}
