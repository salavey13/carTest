// app/api/franchize/[slug]/cash-transactions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCashTransactions, createManualCashTransaction } from "@/app/franchize/server-actions/cash-transactions";

/**
 * API routes for cash transactions.
 * GET: List transactions with filters
 * POST: Create manual transaction
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(request.url);

    // Support both 'type' (legacy) and 'transactionType' (new) parameters
    const type = searchParams.get("type");
    const transactionType = searchParams.get("transactionType") || type || "";
    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";

    const result = await getCashTransactions({
      slug,
      from: from || undefined,
      to: to || undefined,
      transactionType: transactionType || undefined,
    });

    if (!result.success) {
      const status = result.error?.includes("не найден") ? 404 : result.error?.includes("Не авторизовано") || result.error?.includes("Недостаточно прав") ? 401 : 400;
      return NextResponse.json({ success: false, error: result.error }, { status });
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      summary: result.summary,
    });
  } catch (error) {
    console.error("[cash-transactions GET] Error:", error);
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
    const { type, transactionType, amount, flowDirection, category, description, paymentMethod } = body;

    // Support both 'type' (legacy) and 'transactionType' (new) parameters
    const finalTransactionType = transactionType || type;

    if (!finalTransactionType || !amount) {
      return NextResponse.json(
        { success: false, error: "Missing required fields (transactionType, amount)" },
        { status: 400 }
      );
    }

    if (Number(amount) <= 0) {
      return NextResponse.json(
        { success: false, error: "Сумма должна быть больше 0" },
        { status: 400 }
      );
    }

    const result = await createManualCashTransaction({
      slug,
      transactionType: finalTransactionType,
      amount: Number(amount),
      paymentMethod: paymentMethod || undefined,
      category: category || undefined,
      description: description || undefined,
    });

    if (!result.success) {
      const status = result.error?.includes("не найден") ? 404 : result.error?.includes("Не авторизовано") || result.error?.includes("Недостаточно прав") ? 401 : 400;
      return NextResponse.json({ success: false, error: result.error }, { status });
    }

    return NextResponse.json(
      { success: true, data: result.data },
      { status: 201 }
    );
  } catch (error) {
    console.error("[cash-transactions POST] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
