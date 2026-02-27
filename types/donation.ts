export interface Donation {
  id: string;
  streamId: string;
  userId?: string; // optional anonymous
  amountUSD: number; // real money
  stars: number;     // platform stars awarded
  currency: string;
  paymentProvider: "stripe" | "yoomoney" | "manual";
  createdAt: string;
  message?: string;
}