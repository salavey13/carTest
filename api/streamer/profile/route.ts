import { getStreamerProfile } from "../actions";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const streamerId = url.searchParams.get("streamerId");
  if (!streamerId) return new Response(JSON.stringify({ success: false, error: "missing streamerId" }), { status: 400 });
  const res = await getStreamerProfile({ streamerId });
  return new Response(JSON.stringify(res), { status: 200 });
}