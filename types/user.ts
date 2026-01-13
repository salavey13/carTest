export interface Creator {
  id: string;
  username: string;
  displayName: string;
  payoutAccountId?: string; // Stripe Connect account id
  telegramChatId?: string;
  createdAt: string;
}