import Link from "next/link";

const modules = [
  {
    title: "Корень, лист, стебель — кто за что отвечает",
    text: "Понимаем, почему слабый корень почти всегда даёт вялый лист, даже если света много.",
    horizon: "Можно внедрить уже сейчас",
  },
  {
    title: "Сигналы дефицита без паники",
    text: "Пожелтение, скручивание, пятна: простая таблица признаков, чтобы не лечить всё сразу.",
    horizon: "Подходит для быстрого дежурного осмотра",
  },
  {
    title: "Недельный ритуал ухода",
    text: "Пятиминутный осмотр по чек-листу, который можно отправлять в чат семье как мини-отчёт.",
    horizon: "Легко автоматизировать через напоминания",
  },
];

export default function GreenboxBotanikaPage() {
  return (
    <div className="space-y-6">
      <header className="rounded-[2rem] border border-emerald-300/60 bg-white/80 p-6 dark:border-emerald-400/20 dark:bg-emerald-950/45">
        <p className="text-xs uppercase tracking-[0.2em] text-emerald-900/75 dark:text-emerald-100/75">GREENBOX ACADEMY</p>
        <h1 className="mt-2 text-3xl font-semibold text-emerald-950 dark:text-emerald-50">Ботаника для мамы: без перегруза</h1>
        <p className="mt-2 text-emerald-900/80 dark:text-emerald-100/80">
          Короткий курс про живые процессы растения. Наша цель — видеть причины, а не только симптомы.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        {modules.map((item) => (
          <article key={item.title} className="rounded-2xl border border-emerald-200/70 bg-white/85 p-4 dark:border-emerald-400/20 dark:bg-slate-950/45">
            <h2 className="text-lg font-semibold text-emerald-950 dark:text-emerald-50">{item.title}</h2>
            <p className="mt-2 text-sm text-emerald-900/85 dark:text-emerald-100/85">{item.text}</p>
            <p className="mt-3 rounded-lg border border-emerald-300/60 bg-emerald-50/80 p-2 text-xs text-emerald-900 dark:border-emerald-400/25 dark:bg-emerald-500/10 dark:text-emerald-100">
              Горизонт: {item.horizon}
            </p>
          </article>
        ))}
      </section>

      <footer className="flex flex-wrap gap-3">
        <Link href="/greenbox" className="rounded-xl border border-emerald-300/70 bg-emerald-100 px-3 py-2 text-emerald-900 transition hover:bg-emerald-200 dark:border-emerald-400/35 dark:bg-emerald-500/20 dark:text-emerald-50 dark:hover:bg-emerald-500/35">
          Назад в Greenbox
        </Link>
        <Link href="/greenbox/gidroponika" className="rounded-xl border border-cyan-300/70 bg-cyan-100 px-3 py-2 text-cyan-900 transition hover:bg-cyan-200 dark:border-cyan-400/35 dark:bg-cyan-500/20 dark:text-cyan-50 dark:hover:bg-cyan-500/35">
          Перейти к гидропонике
        </Link>
      </footer>
    </div>
  );
}
