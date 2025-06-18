import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { sendTelegramMessage } from "@/app/actions";
import { handleWebhookProxy } from "@/app/webhook-handlers/proxy"; // Import your main proxy handler

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BOT_USERNAME = "oneSitePlsBot"; // Or your actual bot username

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

// --- Main Webhook Handler (Master Dispatcher) ---
export async function POST(request: Request) {
  try {
    const update = await request.json();
    logger.info("[Master Webhook] Received update:", Object.keys(update));

    // --- MASTER DISPATCHER LOGIC ---

    // Route 1: Handle payment-related updates via the dedicated proxy handler
    if (update.pre_checkout_query || update.message?.successful_payment) {
      logger.info("[Master Webhook] Routing to Payment Proxy Handler...");
      await handleWebhookProxy(update);
      return NextResponse.json({ ok: true });
    }
    
    // Route 2: Handle Minibot file uploads directly
    else if (update.message?.document) {
      logger.info("[Master Webhook] Routing to Minibot File Handler...");
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

    // Route 3: Fallback for other message types (e.g., commands, text messages)
    // This can be expanded later if needed. For now, we can log it and acknowledge.
    else {
      logger.info("[Master Webhook] Received unhandled update type, ignoring.", { keys: Object.keys(update.message || {}) });
      // If you have a generic text message handler, you could call it here.
      // For example: await handleTextMessage(update);
      return NextResponse.json({ ok: true });
    }

  } catch (error) {
    logger.error("Critical error in Master Webhook dispatcher:", error);
    // Return 200 to Telegram to prevent it from re-sending the failed update.
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 200 });
  }
}