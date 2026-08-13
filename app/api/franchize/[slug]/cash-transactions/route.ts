// app/api/franchize/[slug]/cash-transactions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCashTransactions, createManualCashTransaction } from "@/app/franchize/server-actions/cash-transactions";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { searchParams } = new URL(req.url);

  const actorUserId = searchParams.get("actorUserId") || "";
  const from = searchParams.get("from") || "";
  const to = searchParams.get("to") || "";
  const transactionType = searchParams.get("transactionType") || "";

  if (!actorUserId) {
    return NextResponse.json({ success: false, error: "Требуется actorUserId" }, { status: 400 });
  }

  const result = await getCashTransactions({
    slug,
    actorUserId,
    from: from || undefined,
    to: to || undefined,
    transactionType: transactionType || undefined,
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = await req.json();

  const { actorUserId, transactionType, amount, flowDirection, category, description, paymentMethod } = body;

  if (!actorUserId) {
    return NextResponse.json({ success: false, error: "Требуется actorUserId" }, { status: 400 });
  }
  if (!transactionType || !amount || !flowDirection) {
    return NextResponse.json({ success: false, error: "Требуются transactionType, amount, flowDirection" }, { status: 400 });
  }
  if (Number(amount) <= 0) {
    return NextResponse.json({ success: false, error: "Сумма должна быть больше 0" }, { status: 400 });
  }

  const result = await createManualCashTransaction({
    slug,
    actorUserId,
    transactionType,
    amount: Number(amount),
    flowDirection,
    category,
    description,
    paymentMethod,
  });

  return NextResponse.json(result);
}
