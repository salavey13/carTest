// /types/telegram.d.ts
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
  openLink: (url: string) => void;
  close: () => void;
  showPopup: (params: { message: string }) => void;
  sendData: (data: string) => void;
}

// types/telegram.ts
export interface WebAppUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  photo_url?: string
  chat_id?: number // Add this if available in initDataUnsafe
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp
    }
  }
}
