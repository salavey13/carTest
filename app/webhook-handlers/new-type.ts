   import { WebhookHandler } from "./types";
   import { sendTelegramMessage } from "../actions";

   export const newTypeHandler: WebhookHandler = {
     canHandle: (invoice) => invoice.type === "new_type",
     handle: async (invoice, userId, userData, totalAmount, supabase, telegramToken, adminChatId) => {
       await sendTelegramMessage(telegramToken, "New type handled!", [], undefined, userId);
     },
   };