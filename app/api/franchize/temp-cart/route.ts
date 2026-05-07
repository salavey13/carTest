import { NextRequest, NextResponse } from "next/server";

import { upsertTempFranchizeCartAction } from "@/contexts/actions";

export async function POST(request: NextRequest) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json({ ok: false, error: "Body must be an object" }, { status: 400 });
  }

  const { cartId, cartBySlug } = payload as {
    cartId?: unknown;
    cartBySlug?: unknown;
  };

  if (typeof cartId !== "string" || !cartId.trim()) {
    return NextResponse.json({ ok: false, error: "Missing cartId" }, { status: 400 });
  }

  if (!cartBySlug || typeof cartBySlug !== "object" || Array.isArray(cartBySlug)) {
    return NextResponse.json({ ok: false, error: "cartBySlug must be an object" }, { status: 400 });
  }

  const result = await upsertTempFranchizeCartAction({
    cartId,
    cartBySlug: cartBySlug as Record<string, unknown>,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
