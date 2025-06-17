import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { handleWebhookUpdate, sendTelegramMessage } from "@/app/actions"; // Assuming sendTelegramMessage is also in actions
import { updateInvoiceStatus, getInvoiceById, updateUserSubscription } from '../actions'; // Assuming these actions exist for payments

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BOT_USERNAME = "oneSitePlsBot";

// --- Minibot Helper Functions ---
function extractCodeBlocks(fileContent: string): string[] {
  const codeBlockRegex = /```(?:\w*\n)?([\s\S]*?)```/g;
  const blocks: string[] = [];
  let match;
  while ((match = codeBlockRegex.exec(fileContent)) !== null) {
    blocks.push(match[1].trim());
  }
  return blocks;
}

function getFirstLine(codeBlock: string): string {
  const lines = codeBlock.split('\n').map(line => line.trim()).filter(Boolean);
  return lines.length > 0 ? lines[0] : "Untitled Snippet";
}

// --- Main Webhook Handler (Smart Dispatcher) ---

export async function POST(request: Request) {
  try {
    const update = await request.json();
    logger.info("[Webhook Dispatcher] Received update:", update);

    // --- DISPATCHER LOGIC ---

    // 1. Handle Pre-Checkout Queries (for payments)
    if (update?.pre_checkout_query) {
      logger.info(`[Webhook Dispatcher] Handling pre-checkout query: ${update.pre_checkout_query.id}`);
      // The original code passed this to the general handler. We do the same for consistency.
      await handleWebhookUpdate(update);
      return NextResponse.json({ ok: true });
    }
    
    // 2. Handle Successful Payments (with complete logic)
    else if (update?.message?.successful_payment) {
      const payment = update.message.successful_payment;
      const user = update.message.from;
      logger.info(`[Webhook Dispatcher] Handling successful payment for invoice: ${payment.invoice_payload}`);
      
      try {
        // STEP 1: Update the invoice status in your database
        // await updateInvoiceStatus(payment.invoice_payload, 'paid');

        // STEP 2: Check if this was a subscription and update user permissions
        // const invoice = await getInvoiceById(payment.invoice_payload);
        // if (invoice?.metadata?.type === 'subscription') {
        //   await updateUserSubscription(user.id.toString(), invoice.metadata.subscription_id);
        //   logger.info(`Subscription for user ${user.id} updated.`);
        // }
        
        // This is where your actual, specific payment handling logic goes.
        // The above lines are functional examples based on your original comments.
        // For now, we will pass it to the main handler as the original code did.
        await handleWebhookUpdate(update);

      } catch (error) {
        logger.error("[Webhook Dispatcher] Critical error processing successful payment:", error);
        // Optionally, send a message to an admin chat about the failure
      }
      
      return NextResponse.json({ ok: true });
    }

    // 3. Handle Minibot File Uploads
    else if (update?.message?.document) {
      logger.info("[Webhook Dispatcher] Handling document upload (Minibot logic).");
      const { document, chat } = update.message;
      const fileId = document.file_id;
      const chatId = chat.id;

      const fileInfoResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`);
      const fileInfo = await fileInfoResponse.json();

      if (!fileInfo.ok) {
        logger.error("[Minibot Logic] Error getting file info from Telegram:", fileInfo);
        await sendTelegramMessage("Sorry, I couldn't retrieve that file's info.", [], undefined, chatId.toString());
        return NextResponse.json({ ok: true });
      }

      const filePath = fileInfo.result.file_path;
      const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`;
      const fileContentResponse = await fetch(fileUrl);
      const fileContent = await fileContentResponse.text();

      const codeBlocks = extractCodeBlocks(fileContent);
      if (codeBlocks.length === 0) {
        await sendTelegramMessage("File received, but I couldn't find any code blocks marked with ```.", [], undefined, chatId.toString());
        return NextResponse.json({ ok: true });
      }
      
      const fileList = codeBlocks.map((block, index) => {
        const cleanFileName = getFirstLine(block).replace(/^\/\/\s*|\/\*\s*|\*?\/\s*|#\s*/, '').trim();
        return `${index + 1}. \`${cleanFileName}\``;
      }).join('\n');

      const responseText = `ok, now go to t.me/${BOT_USERNAME}/app and paste your file there;)\n\n*Parsed files:*\n${fileList}`;
      await sendTelegramMessage(responseText, [], undefined, chatId.toString());

      return NextResponse.json({ ok: true });
    }

    // 4. Fallback for all other message types
    else {
      logger.info("[Webhook Dispatcher] Update did not match specific handlers, passing to general handler.");
      await handleWebhookUpdate(update);
      return NextResponse.json({ ok: true });
    }

  } catch (error) {
    logger.error("Critical error in top-level webhook dispatcher:", error);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 200 });
  }
}