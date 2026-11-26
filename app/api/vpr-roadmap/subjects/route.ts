import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { getVprSubjectSlug } from "@/lib/vprCheatsheet";
import { logger } from "@/lib/logger";

// task217: слаг → id subjects для CTA-линков «Тест-бой по предмету» в шпаргалках.
// Хардкод id запрещён: они нестабильны между контурами (Алгебра-8 = 71 здесь).
// Клиентская межлинковка шпаргалок тянет эту карту один раз и строит
// /vpr-test/<id> по слагу своей шпаргалки.

export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("subjects")
    .select("id, name, grade_level")
    .in("grade_level", [6, 7, 8]);

  if (error || !data) {
    logger.error(`[VprSubjects] error: ${error?.message || "no data"}`);
    return NextResponse.json({ success: false, subjects: [] }, { status: 500 });
  }

  const subjects = data.map((s) => ({
    id: s.id,
    name: s.name,
    gradeLevel: s.grade_level,
    slug: getVprSubjectSlug(s.name, s.grade_level),
  }));

  return NextResponse.json({ success: true, subjects });
}
