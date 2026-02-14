import { BookOpenText, CheckCircle2, Lightbulb, PencilRuler } from "lucide-react";
import { hydrateHomeworkSolution } from "./actions";

type PageProps = {
  params: { jobId: string };
};

const sectionCard =
  "rounded-2xl border border-cyan-400/20 bg-slate-900/70 p-4 sm:p-5 shadow-[0_0_0_1px_rgba(34,211,238,0.08)] backdrop-blur";

export default async function HomeworkSolutionPage({ params }: PageProps) {
  const { jobId } = params;
  const homework = await hydrateHomeworkSolution(jobId);

  return (
    <main className="min-h-screen bg-slate-950 px-3 py-5 text-slate-100 sm:px-4 sm:py-7">
      <div className="mx-auto w-full max-w-xl space-y-4 sm:space-y-5">
        <header className="rounded-3xl border border-cyan-300/20 bg-gradient-to-br from-cyan-400/10 via-slate-900/90 to-violet-400/10 p-4 sm:p-5">
          <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-200">
            <BookOpenText className="h-3.5 w-3.5" />
            VPR homework solution
          </p>
          <h1 className="text-balance text-xl font-black leading-tight text-white sm:text-2xl">
            Решение задания #{homework?.jobId ?? jobId}
          </h1>
          <p className="mt-2 text-pretty text-sm leading-relaxed text-slate-300 sm:text-[15px]">
            {homework?.topic ?? "Разбор задания пока не готов"}
          </p>
        </header>

        <section className={sectionCard}>
          <h2 className="mb-2 flex items-center gap-2 text-base font-extrabold text-cyan-200 sm:text-lg">
            <Lightbulb className="h-4 w-4" /> Кратко тема
          </h2>
          <p className="text-pretty text-sm leading-relaxed text-slate-200 sm:text-[15px]">{homework?.topic ?? "Тема появится после обработки"}</p>
        </section>

        <section className={sectionCard}>
          <h2 className="mb-3 flex items-center gap-2 text-base font-extrabold text-cyan-200 sm:text-lg">
            <PencilRuler className="h-4 w-4" /> Дано/решение по шагам
          </h2>
          <div className="space-y-3">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm leading-relaxed text-slate-200 sm:text-[15px]">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Дано</p>
              <p className="text-pretty">{homework?.given ?? "Данные пока не загружены."}</p>
            </div>
            <ol className="space-y-2.5">
              {(homework?.steps ?? ["Подождите, решение ещё формируется."]).map((step, index) => (
                <li
                  key={`${homework?.jobId ?? jobId}-step-${index}`}
                  className="flex gap-3 rounded-xl border border-cyan-300/15 bg-cyan-300/5 p-3"
                >
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-300/20 text-xs font-bold text-cyan-100">
                    {index + 1}
                  </span>
                  <p className="text-sm leading-relaxed text-slate-100 sm:text-[15px]">{step}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="rounded-2xl border border-emerald-300/25 bg-emerald-400/10 p-4 shadow-[0_0_0_1px_rgba(16,185,129,0.12)] sm:p-5">
          <h2 className="mb-2 flex items-center gap-2 text-base font-extrabold text-emerald-100 sm:text-lg">
            <CheckCircle2 className="h-4 w-4" /> Ответ
          </h2>
          <p className="text-pretty text-base font-semibold leading-relaxed text-white sm:text-lg">{homework?.answer ?? "Ответ появится после генерации."}</p>
        </section>

        {homework?.rewriteForNotebook ? (
          <section className="rounded-2xl border border-violet-300/20 bg-violet-300/10 p-3.5 sm:p-4">
            <h3 className="mb-2 text-sm font-bold text-violet-100">перепиши в тетрадь</h3>
            <p className="text-pretty text-[13px] leading-relaxed text-violet-50 sm:text-sm">
              {homework?.rewriteForNotebook}
            </p>
          </section>
        ) : null}

        <footer className="rounded-xl border border-slate-700 bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-400">
          <p className="mb-1 font-semibold uppercase tracking-[0.12em] text-slate-500">Источник (для проверки)</p>
          {(homework?.sourceHints?.length ?? 0) > 0 ? (
            <ul className="space-y-1">
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
