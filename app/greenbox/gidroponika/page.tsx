import Link from "next/link";

const roadmap = [
  {
    title: "Неделя 1: стабильный раствор",
    details: "Контроль pH два раза в день и мягкая корректировка без резких скачков.",
  },
  {
    title: "Неделя 2: понятный полив",
    details: "Переход к очереди полива и журналу циклов, чтобы видеть причину стресса.",
  },
  {
    title: "Неделя 3: зрение + голос",
    details: "Фото-диагностика листа и голосовой помощник, который объясняет простыми словами.",
  },
];

export default function GreenboxHydroponicsPage() {
  return (
    <div className="space-y-6">
      <header className="rounded-[2rem] border border-cyan-300/60 bg-white/80 p-6 dark:border-cyan-400/20 dark:bg-cyan-950/35">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-900/75 dark:text-cyan-100/75">GREENBOX LAB</p>
        <h1 className="mt-2 text-3xl font-semibold text-cyan-950 dark:text-cyan-50">Гидропоника шаг за шагом</h1>
        <p className="mt-2 text-cyan-900/80 dark:text-cyan-100/80">
          Реалистичный план на ближайшее будущее: что можно автоматизировать уже в этом месяце в эпоху самостоятельных помощников.
        </p>
      </header>

      <section className="space-y-3">
        {roadmap.map((step, index) => (
          <article key={step.title} className="rounded-2xl border border-cyan-200/70 bg-white/85 p-4 dark:border-cyan-400/20 dark:bg-slate-950/45">
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-900/70 dark:text-cyan-100/70">Этап {index + 1}</p>
            <h2 className="mt-1 text-xl font-semibold text-cyan-950 dark:text-cyan-50">{step.title}</h2>
            <p className="mt-2 text-sm text-cyan-900/85 dark:text-cyan-100/85">{step.details}</p>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-violet-200/70 bg-violet-50/70 p-4 dark:border-violet-400/25 dark:bg-violet-950/25">
        <h2 className="text-lg font-semibold text-violet-950 dark:text-violet-50">Что дальше по интеграциям</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-violet-900/90 dark:text-violet-100/90">
          <li>Разложить профиль пользователя на независимые части: доступ к базе, уведомления, предпочтения.</li>
          <li>Сделать единый канал уведомлений для очереди полива и тревог по растениям.</li>
          <li>Добавить мягкие пуши в мессенджер только при реальном отклонении от нормы.</li>
        </ul>
      </section>

      <footer>
        <Link href="/greenbox" className="rounded-xl border border-cyan-300/70 bg-cyan-100 px-3 py-2 text-cyan-900 transition hover:bg-cyan-200 dark:border-cyan-400/35 dark:bg-cyan-500/20 dark:text-cyan-50 dark:hover:bg-cyan-500/35">
          Назад в Greenbox
        </Link>
      </footer>
    </div>
  );
}
