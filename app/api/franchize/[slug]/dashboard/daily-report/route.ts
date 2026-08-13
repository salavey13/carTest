// app/api/franchize/[slug]/dashboard/daily-report/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDailyCashReport } from "@/app/franchize/server-actions/cash-transactions";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { searchParams } = new URL(req.url);

  const actorUserId = searchParams.get("actorUserId") || "";
  const date = searchParams.get("date") || "";

  if (!actorUserId) {
    return NextResponse.json({ success: false, error: "Требуется actorUserId" }, { status: 400 });
  }
  if (!date) {
    return NextResponse.json({ success: false, error: "Требуется date" }, { status: 400 });
  }

  const result = await getDailyCashReport({
    slug,
    actorUserId,
    date,
  });

  return NextResponse.json(result);
}
