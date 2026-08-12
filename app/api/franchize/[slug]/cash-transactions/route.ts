// /app/api/franchize/[slug]/cash-transactions/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  getCashTransactions,
  createManualCashTransaction,
} from "@/app/franchize/server-actions/cash-transactions";
import { logger } from "@/lib/logger";
import { verifyTelegramActorCookieValue, TELEGRAM_ACTOR_COOKIE } from "@/lib/telegram-actor-cookie";
import { cookies } from "next/headers";

/**
 * API routes for cash transactions.
 * GET: List transactions with filters
 * POST: Create manual transaction
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const type = searchParams.get("type");
    const category = searchParams.get("category");

    // SECURITY: Derive actorUserId from auth cookie, not query params
    const cookieStore = await cookies();
    const actorUserId = verifyTelegramActorCookieValue(
      cookieStore.get(TELEGRAM_ACTOR_COOKIE)?.value,
    );

    if (!actorUserId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!slug) {
      return NextResponse.json(
        { success: false, error: "Missing slug" },
        { status: 400 }
      );
    }

    const result = await getCashTransactions({
      slug,
      actorUserId,
      from: from || undefined,
      to: to || undefined,
      transactionType: type || undefined,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.error?.includes("не найден") ? 404 : 401 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      summary: result.summary,
    });
  } catch (error) {
    logger.error("[cash-transactions GET] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const body = await request.json();
    const { type, category, amount, method, description } = body;

    // SECURITY: Derive actorUserId from auth cookie, not request body
    const cookieStore = await cookies();
    const actorUserId = verifyTelegramActorCookieValue(
      cookieStore.get(TELEGRAM_ACTOR_COOKIE)?.value,
    );

    if (!actorUserId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!slug || !type || !amount) {
      return NextResponse.json(
        { success: false, error: "Missing required fields (slug, type, amount)" },
        { status: 400 }
      );
    }

    const result = await createManualCashTransaction({
      slug,
      actorUserId,
      transactionType: type,
      amount: Number(amount),
      paymentMethod: method || undefined,
      category: category || undefined,
      description: description || undefined,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.error?.includes("недостаточно") ? 401 : 400 }
      );
    }

    return NextResponse.json(
      { success: true, data: result.data },
      { status: 201 }
    );
  } catch (error) {
    logger.error("[cash-transactions POST] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}