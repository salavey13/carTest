import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { validateTelegramInitData } from "@/lib/telegram-validator";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BYPASS_VALIDATION_ENV = process.env.TEMP_BYPASS_TG_AUTH_VALIDATION === "true";

if (BYPASS_VALIDATION_ENV) {
  logger.warn(
    "API_VALIDATE_INIT: TEMP_BYPASS_TG_AUTH_VALIDATION is TRUE. Hash validation will be bypassed! FOR DEBUGGING ONLY."
  );
}

/**
 * Request body shape expected:
 * { initData: string }
 */
export async function POST(req: NextRequest) {
  logger.info("[API_VALIDATE_POST_ENTRY] /api/validate-telegram-auth POST hit.");

  try {
    const body = await req.json().catch((e) => {
      logger.warn("[API_VALIDATE_POST_WARN] Failed to parse JSON body.", e);
      return null;
    });

    if (!body || typeof body.initData !== "string") {
      logger.warn("[API_VALIDATE_POST_WARN] Invalid input. initData must be a non-empty string.");
      return NextResponse.json(
        { isValid: false, error: "initData must be a non-empty string." },
        { status: 400 }
      );
    }

    const { initData } = body as { initData: string };

    if (!BOT_TOKEN) {
      logger.error("[API_VALIDATE_POST_ERROR] TELEGRAM_BOT_TOKEN is not set.");
      return NextResponse.json(
        { isValid: false, error: "Server bot token misconfigured." },
        { status: 500 }
      );
    }

    // Delegate to shared validator
    const res = await validateTelegramInitData(initData, BOT_TOKEN);

    // If bypass env active - always return success but keep detailed logs
    if (BYPASS_VALIDATION_ENV) {
      if (!res.valid) {
        logger.warn("[API_VALIDATE_POST_WARN] Bypass active but validation failed.", {
          reason: res.reason,
          computed: res.computedHash,
          received: res.receivedHash,
        });
      } else {
        logger.info("[API_VALIDATE_POST_INFO] Bypass active and validation passed (ok).");
      }
      // Return user if parsed (helpful for debug), and note that bypass is active
      return NextResponse.json(
        { isValid: true, user: res.user ?? null, note: "bypass active", debug: { computed: res.computedHash, received: res.receivedHash } },
        { status: 200 }
      );
    }

    const status = res.valid ? 200 : 401;
    logger.log(`[API_VALIDATE_POST_INFO] Validation result: valid=${res.valid}, reason=${res.reason}`);

    return NextResponse.json(
      { isValid: res.valid, user: res.user ?? null, reason: res.reason, debug: { computed: res.computedHash, received: res.receivedHash } },
      { status }
    );
  } catch (err: any) {
    logger.error("[API_VALIDATE_POST_ERROR] Unexpected server error:", err?.message ?? err, err?.stack);
    return NextResponse.json(
      { isValid: false, error: `Server error: ${err?.message ?? "unknown"}` },
      { status: 500 }
    );
  }
}