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
  openTelegramLink?: (url: string) => void;
  switchInlineQuery?: (query: string, choose_chat_types?: string[]) => void;
  close: () => void;
  showPopup: (params: { title?: string; message: string; buttons?: Array<{ id?: string; type?: string; text?: string }> }) => void;
  BackButton?: {
    isVisible?: boolean;
    show: () => void;
    hide: () => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
  };
  sendData: (data: string) => void;
  requestLocation?: (callback?: (location: TelegramLocationData) => void) => Promise<TelegramLocationData | void> | void;
  HapticFeedback?: {
    impactOccurred?: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void;
  };
}

export interface TelegramLocationData {
  latitude: number;
  longitude: number;
  altitude?: number | null;
  speed?: number | null;
  course?: number | null;
  horizontal_accuracy?: number | null;
}
