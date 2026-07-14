// app/api/franchize/toggle-troubled/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";
import { verifyCrewAccess } from "../_auth";

/**
 * Toggle the "troubled" flag on a user.
 *
 * POST body: { userId: string, reason?: string }
 * - If user is already troubled, removes the flag
 * - If user is not troubled, sets the flag with optional reason
 *
 * The flag is stored in users.metadata.troubled
 */
export async function POST(request: NextRequest) {
  try {
    // Auth check: only crew members can toggle troubled flags
    const auth = await verifyCrewAccess(request);
    if (auth.ok === false) return auth.response;

    const body = await request.json();
    const { userId, reason } = body;

    if (!userId) {
      return NextResponse.json({ success: false, error: "Missing userId" }, { status: 400 });
    }

    // Get current user metadata
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("metadata")
      .eq("user_id", userId)
      .maybeSingle();

    const currentMeta = (user?.metadata as Record<string, unknown>) || {};
    const isCurrentlyTroubled = currentMeta.troubled === true;

    if (isCurrentlyTroubled) {
      // Remove troubled flag — clean up all three keys (troubled, troubled_reason, troubled_at)
      const { [String("troubled")]: _, [String("troubled_reason")]: __, [String("troubled_at")]: ___, ...restMeta } = currentMeta as Record<string, unknown>;
      await supabaseAdmin.from("users").update({
        metadata: restMeta,
        updated_at: new Date().toISOString(),
      }).eq("user_id", userId);

      logger.info(`[toggle-troubled] Removed troubled flag for ${userId}`);
      return NextResponse.json({ success: true, troubled: false });
    } else {
      // Set troubled flag
      await supabaseAdmin.from("users").update({
        metadata: {
          ...currentMeta,
          troubled: true,
          troubled_reason: reason || null,
          troubled_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      }).eq("user_id", userId);

      logger.info(`[toggle-troubled] Set troubled flag for ${userId}: ${reason || "no reason"}`);
      return NextResponse.json({ success: true, troubled: true });
    }
  } catch (error) {
    logger.error("[toggle-troubled] Exception:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
