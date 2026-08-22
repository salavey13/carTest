// /types/telegram.ts
// ─────────────────────────────────────────────────────
// All Telegram WebApp types in one module.
// ─────────────────────────────────────────────────────
// Previously split across telegram.ts and telegram.d.ts,
// causing broken cross-references: telegram.d.ts used
// WebAppUser without importing it, and telegram.ts used
// TelegramWebApp in `declare global` without importing it.
//
// Now consolidated: everything lives here. The .d.ts file
// just re-exports for backward compatibility.
// ─────────────────────────────────────────────────────

export interface WebAppUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  photo_url?: string
  chat_id?: number
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

export interface TelegramLocationData {
  latitude: number
  longitude: number
  altitude?: number | null
  speed?: number | null
  course?: number | null
  horizontal_accuracy?: number | null
}

export interface TelegramWebApp {
  ready: () => void
  expand?: () => void
  disableVerticalSwipes: () => void
  setHeaderColor?: (color: string) => void
  setBackgroundColor?: (color: string) => void
  platform?: string
  themeParams?: Record<string, string>
  colorScheme?: 'light' | 'dark'
  initData?: string
  initDataUnsafe: {
    start_param?: string
    user?: WebAppUser
  }
  openLink: (url: string) => void
  openTelegramLink?: (url: string) => void
  switchInlineQuery?: (query: string, choose_chat_types?: string[]) => void
  close: () => void
  showPopup: (params: {
    title?: string
    message: string
    buttons?: Array<{ id?: string; type?: string; text?: string }>
  }) => void
  BackButton?: {
    isVisible?: boolean
    show: () => void
    hide: () => void
    onClick: (callback: () => void) => void
    offClick: (callback: () => void) => void
  }
  sendData: (data: string) => void
  requestLocation?: (
    callback?: (location: TelegramLocationData) => void
  ) => Promise<TelegramLocationData | void> | void
  HapticFeedback?: {
    impactOccurred?: (
      style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'
    ) => void
  }
  // Version checking
  version?: string
  isVersionAtLeast?: (version: string) => boolean
  // Closing confirmation (v6.2+)
  enableClosingConfirmation?: () => void
  disableClosingConfirmation?: () => void
  // Fullscreen (v7.7+)
  requestFullscreen?: () => void
  exitFullscreen?: () => void
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp
    }
  }
}
