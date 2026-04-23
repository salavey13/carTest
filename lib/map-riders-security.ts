import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { supabaseAdmin } from "@/lib/supabase-server";

const TELEGRAM_ORIGINS = ["https://web.telegram.org", "https://web.telegram.org.a", "https://web.telegram.org.k"];

type GuardResult =
  | { ok: true; token: string; subject: string; authSource: "supabase" | "app_jwt" }
  | { ok: false; response: NextResponse };

function toOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function allowedOriginsForRequest(request: NextRequest): Set<string> {
  const allowed = new Set<string>(TELEGRAM_ORIGINS);
  allowed.add(request.nextUrl.origin);

  const site = toOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  if (site) allowed.add(site);

  const production = toOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  if (production) allowed.add(production);

  const extra = (process.env.TELEGRAM_WEBAPP_ALLOWED_ORIGINS || "")
    .split(",")
    .map((item) => item.trim())
    .map((item) => toOrigin(item) || item)
    .filter(Boolean) as string[];

  for (const item of extra) {
    allowed.add(item);
  }

  return allowed;
}

export async function guardMapRidersWriteRequest(request: NextRequest): Promise<GuardResult> {
  const xRequestedWith = request.headers.get("x-requested-with");
  if (xRequestedWith !== "XMLHttpRequest") {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 403 }) };
  }

  const origin = request.headers.get("origin");
  const allowedOrigins = allowedOriginsForRequest(request);
  if (!origin || !allowedOrigins.has(origin)) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 403 }) };
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const token = authHeader.slice("Bearer ".length).trim();
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (!error && data?.user?.id) {
    return { ok: true, token, subject: data.user.id, authSource: "supabase" };
  }

  const jwtSecret = process.env.SUPABASE_JWT_SECRET;
  if (!jwtSecret) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as { sub?: string; chat_id?: string };
    const subject = String(decoded.chat_id || decoded.sub || "");
    if (!subject) {
      return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    }
    return { ok: true, token, subject, authSource: "app_jwt" };
  } catch {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
}

export function applyRateLimitHeaders(response: NextResponse, retryAfterSeconds: number, remaining: number, limit: number) {
  response.headers.set("Retry-After", String(retryAfterSeconds));
  response.headers.set("X-RateLimit-Limit", String(limit));
  response.headers.set("X-RateLimit-Remaining", String(Math.max(0, remaining)));
}
