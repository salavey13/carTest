import { BookOpenText, CheckCircle2, Lightbulb, PencilRuler, Sparkles, Zap } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { hydrateHomeworkSolution } from "./actions";

type PageProps = {
  params: { jobId: string };
};

const detectStepTone = (step: string) => {
  const lower = step.toLowerCase();
  if (lower.includes("алгебра")) return { bar: "from-sky-400 via-cyan-400 to-blue-400", pill: "bg-sky-100 text-sky-700 dark:bg-sky-300/25 dark:text-sky-50", chip: "border-sky-200 bg-sky-100/80 text-sky-700 dark:border-sky-300/40 dark:bg-sky-300/10 dark:text-sky-100", label: "Алгебра" };
  if (lower.includes("геометр")) return { bar: "from-emerald-400 via-teal-400 to-lime-400", pill: "bg-emerald-100 text-emerald-700 dark:bg-emerald-300/25 dark:text-emerald-50", chip: "border-emerald-200 bg-emerald-100/80 text-emerald-700 dark:border-emerald-300/40 dark:bg-emerald-300/10 dark:text-emerald-100", label: "Геометрия" };
  if (lower.includes("литератур")) return { bar: "from-fuchsia-400 via-pink-400 to-rose-400", pill: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-300/25 dark:text-fuchsia-50", chip: "border-fuchsia-200 bg-fuchsia-100/80 text-fuchsia-700 dark:border-fuchsia-300/40 dark:bg-fuchsia-300/10 dark:text-fuchsia-100", label: "Литература" };
  if (lower.includes("англий") || lower.includes("ин. язык")) return { bar: "from-indigo-400 via-violet-400 to-purple-400", pill: "bg-indigo-100 text-indigo-700 dark:bg-indigo-300/25 dark:text-indigo-50", chip: "border-indigo-200 bg-indigo-100/80 text-indigo-700 dark:border-indigo-300/40 dark:bg-indigo-300/10 dark:text-indigo-100", label: "Английский" };
  if (lower.includes("истори")) return { bar: "from-amber-400 via-orange-400 to-yellow-400", pill: "bg-amber-100 text-amber-700 dark:bg-amber-300/25 dark:text-amber-50", chip: "border-amber-200 bg-amber-100/80 text-amber-700 dark:border-amber-300/40 dark:bg-amber-300/10 dark:text-amber-100", label: "История" };
  if (lower.includes("изо")) return { bar: "from-rose-400 via-red-400 to-orange-400", pill: "bg-rose-100 text-rose-700 dark:bg-rose-300/25 dark:text-rose-50", chip: "border-rose-200 bg-rose-100/80 text-rose-700 dark:border-rose-300/40 dark:bg-rose-300/10 dark:text-rose-100", label: "ИЗО" };
  if (lower.includes("физкультур")) return { bar: "from-green-400 via-emerald-400 to-cyan-400", pill: "bg-green-100 text-green-700 dark:bg-green-300/25 dark:text-green-50", chip: "border-green-200 bg-green-100/80 text-green-700 dark:border-green-300/40 dark:bg-green-300/10 dark:text-green-100", label: "Физкультура" };
  return { bar: "from-cyan-400 via-violet-400 to-fuchsia-400", pill: "bg-cyan-100 text-cyan-700 dark:bg-cyan-300/25 dark:text-cyan-50", chip: "border-cyan-200 bg-cyan-100/80 text-cyan-700 dark:border-cyan-300/40 dark:bg-cyan-300/10 dark:text-cyan-100", label: "Общее" };
};

export default async function HomeworkSolutionPage({ params }: PageProps) {
  const { jobId } = params;
  const homework = await hydrateHomeworkSolution(jobId);
  const steps = homework?.steps ?? ["Подождите, решение ещё формируется."];

  return (
    <main className="relative min-h-screen overflow-hidden bg-[hsl(var(--homework-bg))] px-3 py-6 text-[hsl(var(--homework-text))] sm:px-6 sm:py-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-20 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-cyan-400/20 blur-[110px] dark:bg-cyan-400/20" />
        <div className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-fuchsia-500/10 blur-[140px] dark:bg-fuchsia-500/15" />
        <div className="absolute bottom-0 left-0 h-72 w-72 rounded-full bg-emerald-400/10 blur-[120px]" />
      </div>

      <div className="relative mx-auto w-full max-w-5xl space-y-5">
        <header className="rounded-[34px] border border-slate-200 bg-white/90 p-6 shadow-[0_10px_40px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-white/5 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_24px_65px_rgba(0,0,0,0.45)] sm:p-7">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-100/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700 dark:border-cyan-300/35 dark:bg-cyan-300/10 dark:text-cyan-100">
              <Zap className="h-3.5 w-3.5" /> CyberTutor
            </span>
            <span className="rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 dark:border-white/15 dark:bg-slate-900/70 dark:text-slate-200">job: {homework?.jobId ?? jobId}</span>
            <span className="rounded-full border border-emerald-200 bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-300/30 dark:bg-emerald-300/15 dark:text-emerald-100">solution ready</span>
          </div>

          <h1 className="text-balance text-3xl font-black leading-tight text-slate-900 dark:text-white sm:text-5xl">Решение задания</h1>
          <p className="mt-3 max-w-3xl text-pretty text-lg leading-relaxed text-slate-700 dark:text-slate-200">{homework?.topic ?? "Разбор задания пока не готов"}</p>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
          <article className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-[0_10px_35px_rgba(15,23,42,0.12)] backdrop-blur-lg dark:border-white/10 dark:bg-white/[0.04] dark:shadow-[0_10px_45px_rgba(8,15,35,0.45)] sm:p-6">
            <h2 className="mb-4 flex items-center gap-2 text-2xl font-extrabold text-cyan-700 dark:text-cyan-100">
              <PencilRuler className="h-5 w-5" /> Дано и пошаговое решение
            </h2>

            <div className="mb-4 rounded-2xl border border-cyan-200 bg-cyan-50/90 p-4 dark:border-cyan-200/20 dark:bg-cyan-500/10">
              <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-cyan-700/80 dark:text-cyan-200/80">Дано</p>
              <p className="text-base leading-relaxed text-slate-800 dark:text-slate-100">{homework?.given ?? "Данные пока не загружены."}</p>
            </div>

            <ol className="space-y-3">
              {steps.map((step, index) => {
                const tone = detectStepTone(step);
                return (
                  <li
                    key={`${homework?.jobId ?? jobId}-step-${index}`}
                    className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-r from-white to-slate-100 p-4 dark:border-white/10 dark:from-slate-900/85 dark:to-slate-800/70"
                  >
                    <div className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${tone.bar}`} />
                    <div className="mb-2 pl-2">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${tone.chip}`}>{tone.label}</span>
                    </div>
                    <div className="flex gap-3 pl-2">
                      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-black ${tone.pill}`}>{index + 1}</span>
                      <p className="text-base leading-relaxed text-slate-800 dark:text-slate-100">{step}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </article>

          <div className="space-y-4">
            <article className="rounded-3xl border border-emerald-200 bg-emerald-50/90 p-5 shadow-[0_10px_35px_rgba(16,185,129,0.12)] dark:border-emerald-200/20 dark:bg-emerald-500/10 dark:shadow-[0_10px_40px_rgba(16,185,129,0.16)]">
              <h2 className="mb-3 flex items-center gap-2 text-2xl font-extrabold text-emerald-700 dark:text-emerald-100">
                <CheckCircle2 className="h-5 w-5" /> Ответ
              </h2>
              <p className="text-lg font-semibold leading-relaxed text-slate-900 dark:text-white">{homework?.answer ?? "Ответ появится после генерации."}</p>
            </article>

            <article className="rounded-3xl border border-cyan-200 bg-cyan-50/90 p-5 dark:border-cyan-200/20 dark:bg-cyan-500/10">
              <h3 className="mb-2 flex items-center gap-2 text-lg font-black uppercase tracking-wide text-cyan-700 dark:text-cyan-100">
                <Lightbulb className="h-4 w-4" /> Кратко тема
              </h3>
              <p className="text-sm leading-relaxed text-cyan-800/95 dark:text-cyan-50/95">{homework?.topic ?? "Тема появится после обработки"}</p>
            </article>

            {homework?.rewriteForNotebook ? (
              <article className="rounded-3xl border border-fuchsia-200 bg-fuchsia-50/90 p-5 dark:border-fuchsia-300/20 dark:bg-fuchsia-400/10">
                <h3 className="mb-2 text-lg font-black uppercase tracking-wide text-fuchsia-700 dark:text-fuchsia-100">Перепиши в тетрадь</h3>
                <p className="text-sm leading-relaxed text-fuchsia-900/90 dark:text-fuchsia-50">{homework?.rewriteForNotebook}</p>
              </article>
            ) : null}
          </div>
        </section>

        <section className="rounded-3xl border border-violet-200 bg-violet-50/90 p-5 shadow-[0_10px_35px_rgba(139,92,246,0.12)] dark:border-violet-200/20 dark:bg-violet-500/10 dark:shadow-[0_10px_40px_rgba(139,92,246,0.16)] sm:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-2xl font-extrabold text-violet-700 dark:text-violet-100">
            <Sparkles className="h-5 w-5" /> Полное решение (rich markdown)
          </h2>
          <div className="prose prose-slate prose-sm sm:prose-base max-w-none leading-relaxed prose-headings:font-black prose-headings:text-cyan-700 prose-p:text-slate-800 prose-li:text-slate-800 prose-strong:text-slate-900 prose-code:text-cyan-700 prose-code:bg-slate-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md dark:prose-invert dark:prose-headings:text-cyan-100 dark:prose-p:text-slate-100 dark:prose-li:text-slate-100 dark:prose-strong:text-white dark:prose-code:text-cyan-200 dark:prose-code:bg-slate-900/70">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{homework?.fullSolutionRich ?? "## Решение\nДанные пока не готовы."}</ReactMarkdown>
          </div>
        </section>

        <footer className="rounded-3xl border border-slate-200 bg-white/90 p-5 text-sm leading-relaxed text-slate-700 dark:border-white/10 dark:bg-slate-900/80 dark:text-slate-300">
          <p className="mb-2 flex items-center gap-2 font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
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
