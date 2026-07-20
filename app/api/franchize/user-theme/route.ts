// app/api/franchize/user-theme/route.ts
// Simple endpoint to read user's theme preference from Supabase metadata.
// Used by ThemeInitializer to restore theme when localStorage is cleared.
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ themeMode: null });
  }

  const { data: user, error } = await supabaseAdmin
    .from("users")
    .select("metadata")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !user?.metadata) {
    return NextResponse.json({ themeMode: null });
  }

  const metadata = user.metadata as Record<string, unknown> | null;
  const themeMode = metadata?.theme_mode === "light" ? "light" : "dark";

  return NextResponse.json({ themeMode });
}
