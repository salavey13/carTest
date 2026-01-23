import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { validateTelegramInitData } from "@/lib/telegram-validator";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BYPASS_VALIDATION_ENV = process.env.TEMP_BYPASS_TG_AUTH_VALIDATION === "true";

if (BYPASS_VALIDATION_ENV) {
  logger.warn("⚠️  BYPASS MODE ACTIVE - All validations will be forced to pass!");
}

// 🔥 Manual parser to match validator
function parseQueryStringPreserveCase(queryString: string): Map<string, string> {
  const params = new Map<string, string>();
  const pairs = queryString.split('&');
  
  for (const pair of pairs) {
    const eqIndex = pair.indexOf('=');
    if (eqIndex === -1) continue;
    
    const key = pair.substring(0, eqIndex);
    const value = pair.substring(eqIndex + 1);
    params.set(key, decodeURIComponent(value));
  }
  return params;
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
  
    // 🔥 DEBUG: Character-level analysis
    logger.log("🔍 INITDATA HEX DUMP (first 200 chars):", Buffer.from(initData).toString('hex').substring(0, 200));
    logger.log("🔍 INITDATA CHAR CODES (first 10 chars):", initData.substring(0, 10).split('').map(c => c.charCodeAt(0)));

    // ✅ Log structured data
    logger.log("🔍 INITDATA RAW BYTES: " + JSON.stringify({
      length: initData.length,
      first50: initData.substring(0, 50),
      last50: initData.substring(initData.length - 50),
      includesDoubleEncoded: initData.includes('%25'),
      hashFromData: initData.match(/hash=([a-f0-9]+)/i)?.[1]
    }, null, 2));

    // 🔥 DEBUG: Log the raw string
    logger.log("🔍 RAW INITDATA STRING:");
    logger.log(initData);

    // 🔥 DEBUG: Log what the validator sees
    logger.log("🔍 BUILDING DATA CHECK STRING...");
    const params = parseQueryStringPreserveCase(initData); // Use manual parser
    
    // Log the ACTUAL keys extracted
    const actualKeys = Array.from(params.keys());
    logger.log("🔍 PARAM KEYS FROM MANUAL PARSER:", actualKeys);

    const keys = actualKeys
      .filter(k => k.toLowerCase() !== "hash")
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    
    const dataCheckString = keys.map(k => `${k}=${params.get(k)}`).join("\n");
    logger.log("🔍 DATA CHECK STRING:", dataCheckString);
    logger.log("🔍 DATA CHECK STRING LENGTH:", dataCheckString.length);

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