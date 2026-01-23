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
    logger.log(`📥 Received initData (${initData.length} chars)`);

    if (!BOT_TOKEN) {
      logger.error("💥 TELEGRAM_BOT_TOKEN not configured");
      return NextResponse.json(
        { isValid: false, error: "Server bot token misconfigured." },
        { status: 500 }
      );
    }

    const result = await validateTelegramInitData(initData, BOT_TOKEN);

    // 🚨 PRODUCTION: REMOVE THIS BLOCK ENTIRELY
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
    // 🚨 END REMOVE BLOCK

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