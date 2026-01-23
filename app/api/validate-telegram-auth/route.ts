import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { validateTelegramInitData } from "@/lib/telegram-validator";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BYPASS_VALIDATION_ENV = process.env.TEMP_BYPASS_TG_AUTH_VALIDATION === "true";

if (BYPASS_VALIDATION_ENV) {
  logger.warn("⚠️  BYPASS MODE ACTIVE - All validations will be forced to pass!");
}

export async function POST(req: NextRequest) {
  logger.info("🚀 POST /api/validate-telegram-auth hit");

  try {
    const body = await req.json().catch((e) => {
      logger.error("❌ Failed to parse JSON body", e);
      return null;
    });

    if (!body || typeof body.initData !== "string") {
      logger.warn("⚠️  Invalid input: initData must be a non-empty string");
      return NextResponse.json(
        { isValid: false, error: "initData must be a non-empty string." },
        { status: 400 }
      );
    }

    const { initData } = body;
  
  // ✅ CORRECT (stringify it)
logger.log("🔍 INITDATA RAW BYTES: " + JSON.stringify({
  length: initData.length,
  first50: initData.substring(0, 50),
  last50: initData.substring(initData.length - 50),
  includesDoubleEncoded: initData.includes('%25'),
  hashFromData: initData.match(/hash=([a-f0-9]+)/)?.[1]
}, null, 2));

// 🔥 DEBUG: Log the raw string
logger.log("🔍 RAW INITDATA STRING:");
logger.log(initData); // This will show the actual string

// 🔥 DEBUG: Log what the validator sees
logger.log("🔍 BUILDING DATA CHECK STRING...");
const params = new URLSearchParams(initData);
const keys = Array.from(params.keys())
  .filter(k => k.toLowerCase() !== "hash") // Case-insensitive
  .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())); // Telegram's sort
const dataCheckString = keys.map(k => `${k}=${params.get(k)}`).join("\n");
logger.log("🔍 Data check string:", dataCheckString);
logger.log("🔍 Data check string length:", dataCheckString.length);

    if (!BOT_TOKEN) {
      logger.error("💥 TELEGRAM_BOT_TOKEN not configured");
      return NextResponse.json(
        { isValid: false, error: "Server bot token misconfigured." },
        { status: 500 }
      );
    }

    const result = await validateTelegramInitData(initData, BOT_TOKEN);

    if (BYPASS_VALIDATION_ENV) {
      logger.warn("🔓 BYPASS ACTIVE: Forcing success response");
      logger.log(`   Original validation: ${result.valid ? '✅ PASS' : '❌ FAIL'}${result.valid ? '' : ` (reason: ${result.reason})`}`);
      
      return NextResponse.json(
        { 
          isValid: true, 
          user: result.user ?? null, 
          note: "BYPASS_MODE_ACTIVE",
          debug: { 
            computed: result.computedHash, 
            received: result.receivedHash 
          } 
        },
        { status: 200 }
      );
    }

    const status = result.valid ? 200 : 401;
    
    if (result.valid) {
      logger.info(`✅ Validation PASSED for user ${result.user?.username ?? 'N/A'}`);
    } else {
      logger.warn(`❌ Validation FAILED: ${result.reason}`);
      logger.log(`   Computed: ${result.computedHash?.substring(0, 16)}...`);
      logger.log(`   Received: ${result.receivedHash?.substring(0, 16)}...`);
    }

    return NextResponse.json(
      { 
        isValid: result.valid, 
        user: result.user ?? null, 
        reason: result.reason,
        debug: { 
          computed: result.computedHash, 
          received: result.receivedHash 
        } 
      },
      { status }
    );

  } catch (err: any) {
    logger.error("💥 Unexpected server error:", err);
    return NextResponse.json(
      { isValid: false, error: `Server error: ${err?.message ?? "unknown"}` },
      { status: 500 }
    );
  }
}