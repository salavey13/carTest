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