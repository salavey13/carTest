import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { sendTelegramMessage } from "@/app/actions";
import { handleWebhookProxy } from "@/app/webhook-handlers/proxy";
import { handleCommand } from "@/app/webhook-handlers/commands/command-handler";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BOT_USERNAME = "oneSitePlsBot";

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
  // --- GLOBAL, TOP-LEVEL ERROR HANDLING TO PREVENT ALL LOOPS ---
  try {
    const update = await request.json();
    logger.info("[Master Webhook] Received update:", Object.keys(update));

    if (update.pre_checkout_query || update.message?.successful_payment) {
      await handleWebhookProxy(update);
    }
    else if (update.message?.document) {
      const { document, chat } = update.message;
      const fileId = document.file_id;
      const chatId = chat.id;

      const fileInfoResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`);
      const fileInfo = await fileInfoResponse.json();

      if (!fileInfo.ok) {
        logger.error("[Minibot Logic] Error getting file info:", fileInfo);
        await sendTelegramMessage("Error retrieving file info.", [], undefined, chatId.toString());
      } else {
        const filePath = fileInfo.result.file_path;
        const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`;
        const fileContentResponse = await fetch(fileUrl);
        const fileContent = await fileContentResponse.text();

        const codeBlocks = extractCodeBlocks(fileContent);
        if (codeBlocks.length === 0) {
          await sendTelegramMessage("File received, but no code blocks ``` found.", [], undefined, chatId.toString());
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
    else if (update.message?.text || update.callback_query) {
      await handleCommand(update);
    }
    else {
      logger.info("[Master Webhook] Unhandled update type, ignoring.", { keys: Object.keys(update || {}) });
    }

  } catch (error) {
    // THIS BLOCK IS THE MOST IMPORTANT PIECE OF CODE.
    // IT CATCHES ANY UNHANDLED EXCEPTION FROM THE LOGIC ABOVE.
    logger.error("!!! CRITICAL UNHANDLED ERROR IN WEBHOOK, PREVENTING LOOP !!!", error);
    // BY RETURNING 200 OK, WE TELL TELEGRAM THE UPDATE WAS RECEIVED,
    // EVEN THOUGH IT FAILED. THIS STOPS THE RETRY CYCLE.
    return NextResponse.json({ ok: true, error: "Internal error handled gracefully to prevent webhook loop." }, { status: 200 });
  }

  // If no error was thrown, we return 200 OK normally.
  return NextResponse.json({ ok: true });
}