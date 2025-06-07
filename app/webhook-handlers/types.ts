// /app/webhook-handlers/types.ts
import { SupabaseClient } from "@supabase/supabase-js";

// Define a more specific type for the invoice object if possible
// For now, using 'any' for flexibility but consider refining this
interface InvoiceData {
  id: string; // Assuming invoice ID is always present
  type?: string; // Type might be optional depending on handler logic
  status?: string; // Status like 'paid', 'pending'
  description?: string; // Optional description
  metadata?: {
    boost_type?: string; // Specific for selfdev boosts
    description?: string; // Can also be here
    // Add other potential metadata fields
    [key: string]: any; // Allow other arbitrary metadata
  };
  created_at?: string; // Timestamp
  updated_at?: string; // Timestamp
  // Add other relevant invoice fields
}

// Define a more specific type for userData
interface UserData {
  user_id: string;
  username?: string | null;
  first_name?: string | null;
  metadata?: Record<string, any>; // Generic metadata object
  // Add other relevant user fields
}


export interface WebhookHandler {
  /**
   * Determines if this handler can process the given invoice and payload.
   * @param invoice The invoice data fetched from the database.
   * @param payload The raw invoice_payload string from the Telegram payment.
   * @returns True if the handler can handle this request, false otherwise.
   */
  canHandle: (invoice: InvoiceData, payload: string) => boolean;

  /**
   * Handles the successful payment logic.
   * @param invoice The invoice data fetched from the database.
   * @param userId The Telegram user ID who made the payment.
   * @param userData The user data fetched from the database (could be a default object if user not found).
   * @param totalAmount The payment amount in the base currency unit (e.g., XTR, not kopecks/cents).
   * @param supabase The Supabase client instance (admin client).
   * @param telegramToken The Telegram Bot Token.
   * @param adminChatId The chat ID for sending admin notifications.
   * @param baseUrl The base URL of the application (e.g., for generating links).
   */
  handle: (
    invoice: InvoiceData,
    userId: string,
    userData: UserData,
    totalAmount: number,
    supabase: SupabaseClient, // Keep SupabaseClient type
    telegramToken: string,
    adminChatId: string,
    baseUrl: string
  ) => Promise<void>;
}