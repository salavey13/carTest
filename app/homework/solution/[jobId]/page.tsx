import { BookOpenText, CheckCircle2, Lightbulb, PencilRuler, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { hydrateHomeworkSolution } from "./actions";

type PageProps = {
  params: { jobId: string };
};

const sectionCard =
  "rounded-3xl border border-cyan-300/20 bg-slate-900/80 p-5 shadow-[0_0_0_1px_rgba(34,211,238,0.1),0_16px_50px_rgba(2,8,23,0.6)] backdrop-blur";

export default async function HomeworkSolutionPage({ params }: PageProps) {
  const { jobId } = params;
  const homework = await hydrateHomeworkSolution(jobId);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(15,23,42,1)_0%,rgba(2,6,23,1)_55%,rgba(1,4,16,1)_100%)] px-3 py-6 text-slate-100 sm:px-5 sm:py-9">
      <div className="mx-auto w-full max-w-4xl space-y-5" style={{ zoom: 1.12 }}>
        <header className="rounded-[30px] border border-cyan-300/25 bg-gradient-to-br from-cyan-400/15 via-slate-900/90 to-violet-400/15 p-6 shadow-[0_0_0_1px_rgba(34,211,238,0.16),0_22px_56px_rgba(15,23,42,0.55)]">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-cyan-100">
            <BookOpenText className="h-4 w-4" /> Homework snapshot ready
          </p>
          <h1 className="text-balance text-3xl font-black leading-tight text-white sm:text-4xl">
            Решение задания #{homework?.jobId ?? jobId}
          </h1>
          <p className="mt-3 text-pretty text-lg leading-relaxed text-slate-200">
            {homework?.topic ?? "Разбор задания пока не готов"}
          </p>
        </header>

        <section className={sectionCard}>
          <h2 className="mb-3 flex items-center gap-2 text-2xl font-extrabold text-cyan-100">
            <Lightbulb className="h-5 w-5" /> Кратко тема
          </h2>
          <p className="text-lg leading-relaxed text-slate-100">{homework?.topic ?? "Тема появится после обработки"}</p>
        </section>

        <section className={sectionCard}>
          <h2 className="mb-4 flex items-center gap-2 text-2xl font-extrabold text-cyan-100">
            <PencilRuler className="h-5 w-5" /> Дано и пошаговое решение
          </h2>
          <div className="space-y-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-lg leading-relaxed text-slate-100">
              <p className="mb-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Дано</p>
              <p>{homework?.given ?? "Данные пока не загружены."}</p>
            </div>
            <ol className="space-y-3">
              {(homework?.steps ?? ["Подождите, решение ещё формируется."]).map((step, index) => (
                <li
                  key={`${homework?.jobId ?? jobId}-step-${index}`}
                  className="flex gap-3 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3"
                >
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-300/30 text-sm font-black text-cyan-50">
                    {index + 1}
                  </span>
                  <p className="text-lg leading-relaxed text-slate-50">{step}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="rounded-3xl border border-violet-300/25 bg-violet-400/10 p-6 shadow-[0_0_0_1px_rgba(167,139,250,0.18)]">
          <h2 className="mb-4 flex items-center gap-2 text-2xl font-extrabold text-violet-100">
            <Sparkles className="h-5 w-5" /> Полное решение (rich markdown)
          </h2>
          <div className="prose prose-invert prose-lg max-w-none font-medium leading-relaxed prose-headings:font-black prose-headings:text-cyan-100 prose-h2:mt-2 prose-h2:mb-3 prose-h2:text-2xl prose-p:text-slate-100 prose-li:text-slate-100 prose-strong:text-white prose-code:text-cyan-200 prose-code:bg-slate-900/70 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-ul:space-y-1 prose-ol:space-y-1">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {homework?.fullSolutionRich ?? "## Решение\nДанные пока не готовы."}
            </ReactMarkdown>
          </div>
        </section>

        <section className="rounded-3xl border border-emerald-300/30 bg-emerald-400/12 p-6 shadow-[0_0_0_1px_rgba(16,185,129,0.14)]">
          <h2 className="mb-3 flex items-center gap-2 text-2xl font-extrabold text-emerald-100">
            <CheckCircle2 className="h-5 w-5" /> Ответ
          </h2>
          <p className="text-xl font-semibold leading-relaxed text-white">{homework?.answer ?? "Ответ появится после генерации."}</p>
        </section>

        {homework?.rewriteForNotebook ? (
          <section className="rounded-3xl border border-fuchsia-300/20 bg-fuchsia-400/10 p-5">
            <h3 className="mb-2 text-lg font-black uppercase tracking-wide text-fuchsia-100">Перепиши в тетрадь</h3>
            <p className="text-base leading-relaxed text-fuchsia-50">{homework?.rewriteForNotebook}</p>
          </section>
        ) : null}

        <footer className="rounded-2xl border border-slate-700 bg-slate-900/85 p-4 text-sm leading-relaxed text-slate-300">
          <p className="mb-2 font-bold uppercase tracking-[0.12em] text-slate-500">Источник (для проверки)</p>
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
