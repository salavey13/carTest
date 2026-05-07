import { NextResponse } from "next/server";

import { getFranchizeBySlug } from "@/app/franchize/actions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug") || "vip-bike";

  const data = await getFranchizeBySlug(slug);

  return NextResponse.json({ success: true, data });
}
