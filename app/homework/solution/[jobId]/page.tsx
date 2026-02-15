import { BookOpenText, CheckCircle2, Lightbulb, PencilRuler, Sparkles, Zap } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { hydrateHomeworkSolution } from "./actions";

type PageProps = {
  params: { jobId: string };
};

const detectStepTone = (step: string) => {
  const lower = step.toLowerCase();
  if (lower.includes("алгебра")) return { bar: "from-sky-300/80 via-cyan-300/80 to-blue-300/80", pill: "bg-sky-300/25 text-sky-50", chip: "border-sky-300/40 bg-sky-300/10 text-sky-100", label: "Алгебра" };
  if (lower.includes("геометр")) return { bar: "from-emerald-300/80 via-teal-300/80 to-lime-300/80", pill: "bg-emerald-300/25 text-emerald-50", chip: "border-emerald-300/40 bg-emerald-300/10 text-emerald-100", label: "Геометрия" };
  if (lower.includes("литератур")) return { bar: "from-fuchsia-300/80 via-pink-300/80 to-rose-300/80", pill: "bg-fuchsia-300/25 text-fuchsia-50", chip: "border-fuchsia-300/40 bg-fuchsia-300/10 text-fuchsia-100", label: "Литература" };
  if (lower.includes("англий") || lower.includes("ин. язык")) return { bar: "from-indigo-300/80 via-violet-300/80 to-purple-300/80", pill: "bg-indigo-300/25 text-indigo-50", chip: "border-indigo-300/40 bg-indigo-300/10 text-indigo-100", label: "Английский" };
  if (lower.includes("истори")) return { bar: "from-amber-300/80 via-orange-300/80 to-yellow-300/80", pill: "bg-amber-300/25 text-amber-50", chip: "border-amber-300/40 bg-amber-300/10 text-amber-100", label: "История" };
  if (lower.includes("изо")) return { bar: "from-rose-300/80 via-red-300/80 to-orange-300/80", pill: "bg-rose-300/25 text-rose-50", chip: "border-rose-300/40 bg-rose-300/10 text-rose-100", label: "ИЗО" };
  if (lower.includes("физкультур")) return { bar: "from-green-300/80 via-emerald-300/80 to-cyan-300/80", pill: "bg-green-300/25 text-green-50", chip: "border-green-300/40 bg-green-300/10 text-green-100", label: "Физкультура" };
  return { bar: "from-cyan-300/80 via-violet-300/80 to-fuchsia-300/80", pill: "bg-cyan-300/25 text-cyan-50", chip: "border-cyan-300/40 bg-cyan-300/10 text-cyan-100", label: "Общее" };
};

export default async function HomeworkSolutionPage({ params }: PageProps) {
  const { jobId } = params;
  const homework = await hydrateHomeworkSolution(jobId);
  const steps = homework?.steps ?? ["Подождите, решение ещё формируется."];

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#040714] px-3 py-6 text-slate-100 sm:px-6 sm:py-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-20 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-cyan-400/20 blur-[110px]" />
        <div className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-fuchsia-500/15 blur-[140px]" />
        <div className="absolute bottom-0 left-0 h-72 w-72 rounded-full bg-emerald-400/10 blur-[120px]" />
      </div>

      <div className="relative mx-auto w-full max-w-5xl space-y-5">
        <header className="rounded-[34px] border border-white/10 bg-white/5 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_24px_65px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-7">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/35 bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100">
              <Zap className="h-3.5 w-3.5" /> CyberTutor
            </span>
            <span className="rounded-full border border-white/15 bg-slate-900/70 px-3 py-1 text-xs font-medium text-slate-200">job: {homework?.jobId ?? jobId}</span>
            <span className="rounded-full border border-emerald-300/30 bg-emerald-300/15 px-3 py-1 text-xs font-semibold text-emerald-100">solution ready</span>
          </div>

          <h1 className="text-balance text-3xl font-black leading-tight text-white sm:text-5xl">Решение задания</h1>
          <p className="mt-3 max-w-3xl text-pretty text-lg leading-relaxed text-slate-200">{homework?.topic ?? "Разбор задания пока не готов"}</p>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
          <article className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-[0_10px_45px_rgba(8,15,35,0.45)] backdrop-blur-lg sm:p-6">
            <h2 className="mb-4 flex items-center gap-2 text-2xl font-extrabold text-cyan-100">
              <PencilRuler className="h-5 w-5" /> Дано и пошаговое решение
            </h2>

            <div className="mb-4 rounded-2xl border border-cyan-200/20 bg-cyan-500/10 p-4">
              <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-cyan-200/80">Дано</p>
              <p className="text-base leading-relaxed text-slate-100">{homework?.given ?? "Данные пока не загружены."}</p>
            </div>

            <ol className="space-y-3">
              {steps.map((step, index) => {
                const tone = detectStepTone(step);
                return (
                  <li
                    key={`${homework?.jobId ?? jobId}-step-${index}`}
                    className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-slate-900/85 to-slate-800/70 p-4"
                  >
                    <div className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${tone.bar}`} />
                    <div className="mb-2 pl-2">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${tone.chip}`}>{tone.label}</span>
                    </div>
                    <div className="flex gap-3 pl-2">
                      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-black ${tone.pill}`}>{index + 1}</span>
                      <p className="text-base leading-relaxed text-slate-100">{step}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </article>

          <div className="space-y-4">
            <article className="rounded-3xl border border-emerald-200/20 bg-emerald-500/10 p-5 shadow-[0_10px_40px_rgba(16,185,129,0.16)]">
              <h2 className="mb-3 flex items-center gap-2 text-2xl font-extrabold text-emerald-100">
                <CheckCircle2 className="h-5 w-5" /> Ответ
              </h2>
              <p className="text-lg font-semibold leading-relaxed text-white">{homework?.answer ?? "Ответ появится после генерации."}</p>
            </article>

            <article className="rounded-3xl border border-cyan-200/20 bg-cyan-500/10 p-5">
              <h3 className="mb-2 flex items-center gap-2 text-lg font-black uppercase tracking-wide text-cyan-100">
                <Lightbulb className="h-4 w-4" /> Кратко тема
              </h3>
              <p className="text-sm leading-relaxed text-cyan-50/95">{homework?.topic ?? "Тема появится после обработки"}</p>
            </article>

            {homework?.rewriteForNotebook ? (
              <article className="rounded-3xl border border-fuchsia-300/20 bg-fuchsia-400/10 p-5">
                <h3 className="mb-2 text-lg font-black uppercase tracking-wide text-fuchsia-100">Перепиши в тетрадь</h3>
                <p className="text-sm leading-relaxed text-fuchsia-50">{homework?.rewriteForNotebook}</p>
              </article>
            ) : null}
          </div>
        </section>

        <section className="rounded-3xl border border-violet-200/20 bg-violet-500/10 p-5 shadow-[0_10px_40px_rgba(139,92,246,0.16)] sm:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-2xl font-extrabold text-violet-100">
            <Sparkles className="h-5 w-5" /> Полное решение (rich markdown)
          </h2>
          <div className="prose prose-invert prose-sm sm:prose-base max-w-none leading-relaxed prose-headings:font-black prose-headings:text-cyan-100 prose-p:text-slate-100 prose-li:text-slate-100 prose-strong:text-white prose-code:text-cyan-200 prose-code:bg-slate-900/70 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{homework?.fullSolutionRich ?? "## Решение\nДанные пока не готовы."}</ReactMarkdown>
          </div>
        </section>

        <footer className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 text-sm leading-relaxed text-slate-300">
          <p className="mb-2 flex items-center gap-2 font-bold uppercase tracking-[0.14em] text-slate-400">
            <BookOpenText className="h-4 w-4" /> Источники (проверка)
          </p>
          {(homework?.sourceHints?.length ?? 0) > 0 ? (
            <ul className="space-y-1.5">
              {(homework?.sourceHints ?? []).map((hint, index) => (
                <li key={`hint-${index}`}>
                  [{index + 1}] {hint.book ?? "книга не указана"}
                  {hint.page ? ` · стр. ${hint.page}` : ""}
                  {hint.exercise ? ` · упр. ${hint.exercise}` : ""}
                  {hint.chunkLabel ? ` · chunk ${hint.chunkLabel}` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p>Подсказки источника пока не найдены — можно уточнить книгу/страницу в чате.</p>
          )}
        </footer>
      </div>
    </main>
  );
}
