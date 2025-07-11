import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { sendTelegramMessage } from "@/app/actions";
import { handleWebhookProxy } from "@/app/webhook-handlers/proxy";
import { handleCommand } from "@/app/webhook-handlers/commands/command-handler";

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

export async function POST(request: Request) {
  // --- ГЛОБАЛЬНЫЙ БЛОК TRY...CATCH для предотвращения циклов ---
  try {
    const update = await request.json();
    logger.info("[Master Webhook] Received update:", Object.keys(update));

    // Route 1: Handle payment-related updates via the dedicated proxy handler
    if (update.pre_checkout_query || update.message?.successful_payment) {
      logger.info("[Master Webhook] Routing to Payment Proxy Handler...");
      await handleWebhookProxy(update);
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
      } else {
        const filePath = fileInfo.result.file_path;
        const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`;
        const fileContentResponse = await fetch(fileUrl);
        const fileContent = await fileContentResponse.text();

        const codeBlocks = extractCodeBlocks(fileContent);
        if (codeBlocks.length === 0) {
          await sendTelegramMessage("File received, but I couldn't find any code blocks marked with ```.", [], undefined, chatId.toString());
        } else {
          const fileList = codeBlocks.map((block, index) => {
            const cleanFileName = getFirstLine(block).replace(/^\/\/\s×|\/\×\s×|\×?\/\s×|#\s×/, '').trim();
            return `${index + 1}. \`${cleanFileName}\``;
          }).join('\n');

          const responseText = `ok, now go to t.me/${BOT_USERNAME}/app and paste your file there;)\n\nParsed files:\n${fileList}`;
          await sendTelegramMessage(responseText, [], undefined, chatId.toString());
        }
      }
    }

    // Route 3 & 4: Handle text messages and callback queries
    else if (update.message?.text || update.callback_query) {
      logger.info("[Master Webhook] Routing to Main Command Handler...");
      await handleCommand(update);
    }

    // Route 5: Fallback for other message types
    else {
      logger.info("[Master Webhook] Received unhandled update type, ignoring.", { keys: Object.keys(update || {}) });
    }

    // Если все прошло без падений, возвращаем 200 OK
    return NextResponse.json({ ok: true });

  } catch (error) {
    // --- ЭТО САМАЯ ВАЖНАЯ ЧАСТЬ ---
    // Если любая часть кода выше выбросила необработанное исключение, мы ловим его здесь.
    logger.error("!!! CRITICAL UNHANDLED ERROR IN MASTER WEBHOOK !!!", error);
    
    // Мы НЕ даем функции упасть. Вместо этого мы отправляем 200 OK Telegram,
    // чтобы он прекратил посылать повторные запросы и разорвал цикл.
    return NextResponse.json({ ok: true, error: "Internal error handled gracefully to prevent webhook loop." }, { status: 200 });
  }
}