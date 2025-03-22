// /app/webhook-handlers/types.ts
import { SupabaseClient } from "@supabase/supabase-js";

export interface WebhookHandler {
  canHandle: (invoice: any, payload: string) => boolean;
  handle: (
    invoice: any,
    userId: string,
    userData: any,
    totalAmount: number,
    supabase: SupabaseClient,
    telegramToken: string,
    adminChatId: string,
    baseUrl: string
  ) => Promise<void>;
}
