     import { WebhookHandler } from "./types";
     import { sendTelegramMessage } from "../actions";

     export const newTypeHandler: WebhookHandler = {
       canHandle: (invoice) => invoice.type === "new_type",
       handle: async (invoice, userId, userData, totalAmount, supabase, telegramToken, adminChatId) => {
         // Your logic here
         await sendTelegramMessage(telegramToken, "New type handled!", [], undefined, userId);
       },
     };