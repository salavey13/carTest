// app/api/franchize/[slug]/earnings/route.ts
import { NextRequest } from "next/server";
import { getMemberEarnings, getTeamEarnings } from "@/app/franchize/server-actions/team-earnings";

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const slug = params.slug;
  const searchParams = request.nextUrl.searchParams;
  const from = searchParams.get("from") || "";
  const to = searchParams.get("to") || "";
  const memberId = searchParams.get("memberId") || undefined;
  const actorUserId = searchParams.get("actorUserId") || undefined;
  const scope = searchParams.get("scope") || "self"; // "self" or "team"

  if (!from || !to) {
    return Response.json({ success: false, error: "Требуется указать даты from и to" }, { status: 400 });
  }

  try {
    if (scope === "team") {
      const result = await getTeamEarnings({ slug, actorUserId, from, to });
      return Response.json(result);
    } else {
      const result = await getMemberEarnings({ slug, actorUserId, memberId, from, to });
      return Response.json(result);
    }
  } catch (error) {
    console.error("[earnings] API error:", error);
    return Response.json({ success: false, error: "Ошибка сервера" }, { status: 500 });
  }
}
