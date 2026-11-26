"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Swords, BookOpen, Map } from "lucide-react";

/**
 * VprCtaTest (task217) — блок межлинковки в конце шпаргалки.
 * Заменил промо-CTA с legacy /start-training: теперь «проверь себя в бою»
 * ведёт на ТЕСТ ИМЕННО ЭТОГО предмета (/vpr-test/<id> — id тянется из
 * /api/vpr-roadmap/subjects по слагу), плюс «следующая шпаргалка» цепочки
 * и возврат в Матрицу.
 */
type SubjectRow = { id: number; name: string; gradeLevel: number | null; slug: string };

export function VprCtaTest({
  slug,
  subjectTitle,
  nextHref,
  nextTitle,
  accentShadow,
}: {
  slug: string;
  subjectTitle: string;
  /** следующая шпаргалка цепочки */
  nextHref: string;
  nextTitle: string;
  /** rgb-строка для жёсткой тени в стиле страницы, напр. "rgba(0,194,255,1)" */
  accentShadow: string;
}) {
  const [testHref, setTestHref] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/vpr-roadmap/subjects")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d?.success) return;
        const hit = (d.subjects as SubjectRow[]).find((s) => s.slug === slug);
        if (hit) setTestHref(`/vpr-test/${hit.id}`);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [slug]);

  return (
    <section className="mb-20">
      <div
        className="bg-white text-black p-6 sm:p-8 rounded-none flex flex-col md:flex-row items-center gap-6 md:gap-8"
        style={{ boxShadow: `10px 10px 0 ${accentShadow}` }}
      >
        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-zinc-950 flex items-center justify-center rounded-full shrink-0">
          <Swords className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
        </div>
        <div className="min-w-0">
          <h3 className="text-xl sm:text-2xl font-black uppercase mb-2">Шпаргалка загружена. Проверь себя в бою</h3>
          <p className="text-zinc-700 text-sm leading-relaxed mb-5">
            10 вопросов реального ВПР-варианта по «{subjectTitle}». Сдал на ≥70% — открывается следующий уровень
            Матрицы. Провалился — итерация: второй заход всегда точнее.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href={testHref || "/vpr-tests"}>
              <Button className="bg-zinc-950 text-white hover:bg-zinc-800 font-bold px-6 py-4 rounded-none uppercase text-xs tracking-widest">
                <Swords className="w-4 h-4 mr-2" /> Тест-бой: {subjectTitle}
              </Button>
            </Link>
            <Link href={nextHref}>
              <Button
                variant="outline"
                className="border-black text-black font-bold px-6 py-4 rounded-none uppercase text-xs tracking-widest"
              >
                <BookOpen className="w-4 h-4 mr-2" /> Следующая шпаргалка: {nextTitle}
              </Button>
            </Link>
            <Link href="/vpr-matrix">
              <Button
                variant="outline"
                className="border-zinc-400 text-zinc-600 hover:text-black font-bold px-6 py-4 rounded-none uppercase text-xs tracking-widest"
              >
                <Map className="w-4 h-4 mr-2" /> Матрица
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
