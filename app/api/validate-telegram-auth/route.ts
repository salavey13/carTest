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

    // 🔥 BYPASS CHECK MOVED TO TOP
    // This overrides everything else. If true, we don't care if token exists or if hash matches.
    if (BYPASS_VALIDATION_ENV) {
      logger.warn("🔓 BYPASS ACTIVE: Forcing success response");
      
      // Try to validate anyway just to log the result for debugging, but don't fail if it breaks
      let debugInfo = { computed: null, received: null, note: "BYPASS_MODE_ACTIVE" };
      let user = null;

      if (BOT_TOKEN) {
        try {
          const result = await validateTelegramInitData(initData, BOT_TOKEN);
          debugInfo = { 
            computed: result.computedHash, 
            received: result.receivedHash,
            note: "BYPASS_MODE_ACTIVE (Validation Attempted)" 
          };
          user = result.user; // Pass through the user if we managed to parse it
          logger.log(`   Original validation: ${result.valid ? '✅ PASS' : '❌ FAIL'}`);
        } catch (e) {
          logger.log(`   Validation skipped due to error: ${(e as Error).message}`);
        }
      } else {
        logger.log(`   Validation skipped (No BOT_TOKEN configured)`);
      }

      return NextResponse.json(
        { isValid: true, user, ...debugInfo },
        { status: 200 }
      );
    }

    // --- STANDARD VALIDATION FLOW (If Bypass is OFF) ---

    if (!BOT_TOKEN) {
      logger.error("💥 TELEGRAM_BOT_TOKEN not configured");
      return NextResponse.json(
        { isValid: false, error: "Server bot token misconfigured." },
        { status: 500 }
      );
    }

    const result = await validateTelegramInitData(initData, BOT_TOKEN);

    const status = result.valid ? 200 : 401;
    
    if (result.valid) {
      logger.info(`✅ Validation PASSED for user ${result.user?.username ?? 'N/A'}`);
    } else {
      logger.warn(`❌ Validation FAILED: ${result.reason}`);
    }

    return NextResponse.json(
      { 
        isValid: result.valid, 
        user: result.user ?? null, 
        reason: result.reason 
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