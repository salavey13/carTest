export interface TelegramWebApp {
  ready: () => void
  disableVerticalSwipes: () => void
  initDataUnsafe: {
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

