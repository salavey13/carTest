/**
 * API Route: /api/forward-telegram
 * =================================
 * Forwards notifications to Telegram when direct Telegram API access is blocked.
 *
 * Use case: When the bot or client cannot reach Telegram API directly,
 * they can call this endpoint on Vercel, which will forward the request.
 *
 * POST /api/forward-telegram
 *
 * Body:
 * {
 *   "chat_id": string | number,    // Target chat ID
 *   "method": "sendMessage" | "sendPhoto" | "sendDocument" | "sendMediaGroup",
 *   "payload": { ... },             // Method-specific payload
 *   "files"?: { [key: string]: base64 }  // Optional: base64-encoded files
 * }
 *
 * Example: Send a message
 * POST /api/forward-telegram
 * {
 *   "chat_id": "123456789",
 *   "method": "sendMessage",
 *   "payload": {
 *     "text": "Hello from the API!",
 *     "parse_mode": "HTML"
 *   }
 * }
 *
 * Example: Send a document with caption
 * POST /api/forward-telegram
 * {
 *   "chat_id": "123456789",
 *   "method": "sendDocument",
 *   "payload": {
 *     "caption": "Here is your document with QR code",
 *     "parse_mode": "HTML"
 *   },
 *   "files": {
 *     "document": "base64_encoded_docx_buffer",
 *     "filename": "contract.docx"
 *   }
 * }
 *
 * Example: Send media group (DOCX + QR)
 * POST /api/forward-telegram
 * {
 *   "chat_id": "123456789",
 *   "method": "sendMediaGroup",
 *   "payload": {
 *     "media": [
 *       { "type": "document", "media": "attach://docx", "parse_mode": "HTML" },
 *       { "type": "photo", "media": "attach://qr", "caption": "QR for quick rent", "parse_mode": "HTML" }
 *     ]
 *   },
 *   "files": {
 *     "docx": { "data": "base64...", "filename": "contract.docx", "contentType": "application/vnd.openxmlformats..." },
 *     "qr": { "data": "base64...", "filename": "qr.png", "contentType": "image/png" }
 *   }
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ALLOWED_ORIGINS = process.env.ALLOWED_FORWARD_ORIGINS?.split(",") || [
  "http://localhost:*",
  "https://v0-car-test.vercel.app",
  "https://car-test-git-*.salavey13.vercel.app",
];

interface ForwardRequest {
  chat_id: string | number;
  method: "sendMessage" | "sendPhoto" | "sendDocument" | "sendMediaGroup";
  payload: Record<string, any>;
  files?: Record<string, { data: string; filename: string; contentType?: string } | string>;
}

function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  for (const allowed of ALLOWED_ORIGINS) {
    const pattern = allowed.replace("*", ".*");
    const regex = new RegExp(`^${pattern}$`);
    if (regex.test(origin)) return true;
  }
  return false;
}

async function forwardToTelegram(method: string, chatId: string | number, payload: Record<string, any>, files?: ForwardRequest["files"]) {
  const token = TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN not configured");
  }

  const url = `https://api.telegram.org/bot${token}/${method}`;

  if (files && Object.keys(files).length > 0) {
    // Multipart form data with files
    const form = new FormData();
    form.append("chat_id", String(chatId));

    // Add payload fields
    for (const [key, value] of Object.entries(payload)) {
      if (key !== "media") {
        form.append(key, typeof value === "object" ? JSON.stringify(value) : String(value));
      } else if (Array.isArray(value)) {
        // media array needs special handling for sendMediaGroup
        form.append(key, JSON.stringify(value));
      }
    }

    // Add files
    for (const [attachName, fileData] of Object.entries(files)) {
      let data: string;
      let filename: string;
      let contentType: string | undefined;

      if (typeof fileData === "string") {
        // Legacy: raw base64 string
        data = fileData;
        filename = `${attachName}.bin`;
      } else {
        // New format: { data, filename, contentType }
        data = fileData.data;
        filename = fileData.filename;
        contentType = fileData.contentType;
      }

      const buffer = Buffer.from(data, "base64");
      const blob = new Blob([buffer], { type: contentType || "application/octet-stream" });
      form.append(attachName, blob, filename);
    }

    const response = await fetch(url, { method: "POST", body: form });
    return response.json();
  } else {
    // Simple JSON request
    const body = {
      chat_id: chatId,
      ...payload,
    };

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return response.json();
  }
}

export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");
    if (!isOriginAllowed(origin)) {
      logger.warn("[forward-telegram] Blocked request from disallowed origin", { origin });
      return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
    }

    const body: ForwardRequest = await request.json();

    if (!body.chat_id || !body.method) {
      return NextResponse.json({ error: "Missing required fields: chat_id, method" }, { status: 400 });
    }

    logger.info("[forward-telegram] Forwarding request", {
      method: body.method,
      chat_id: body.chat_id,
      hasFiles: !!body.files,
    });

    const result = await forwardToTelegram(body.method, body.chat_id, body.payload, body.files);

    if (!result.ok) {
      logger.error("[forward-telegram] Telegram API error", result);
      return NextResponse.json({ error: "Telegram API error", telegram: result }, { status: 400 });
    }

    const response = NextResponse.json({
      ok: true,
      result: result.result,
      message_id: result.result?.[0]?.message_id || result.result?.message_id,
    });

    // CORS headers
    if (origin) {
      response.headers.set("Access-Control-Allow-Origin", origin);
      response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    }

    return response;
  } catch (error) {
    logger.error("[forward-telegram] Request failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");
  const response = new NextResponse(null, { status: 204 });

  if (origin && isOriginAllowed(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }

  return response;
}
