import Link from "next/link";

const fakeDoors = [
  {
    title: "Полив на автопилоте",
    text: "Открывает задачу на авто-полив и график ухода.",
  },
  {
    title: "Симуляция болезней",
    text: "Включает режим диагностики листьев и подсказки лечения.",
  },
  {
    title: "ИИ-садовник",
    text: "Голосовой помощник объясняет всё простыми словами для мамы.",
  },
];

const pulseDots = ["🌱", "🫧", "✨", "🌿", "💧", "🪴"];

export default function GreenboxPage() {
  return (
    <>
      <header className="rounded-3xl border border-emerald-500/40 bg-emerald-500/10 p-6 md:p-8">
        <p className="text-sm uppercase tracking-[0.2em] text-emerald-300">Greenbox</p>
        <h1 className="mt-3 text-3xl font-semibold leading-tight md:text-5xl">
          Магический огород уже живёт,
          <br />
          даже если вы только открыли страницу
        </h1>
        <p className="mt-4 max-w-3xl text-base text-emerald-100/80 md:text-lg">
          Сначала чудо за 90 секунд, потом регистрация. Это стартовая площадка Greenbox для
          подготовки интеграции: быстрый вход, живой демо-ритм и понятные кнопки для новых задач.
        </p>
      </header>

      <section className="rounded-3xl border border-emerald-400/30 bg-slate-900/70 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Живой демо-ритм</h2>
          <span className="rounded-full border border-emerald-400/50 px-3 py-1 text-xs uppercase tracking-widest text-emerald-300">
            instant mode
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {pulseDots.map((dot, index) => (
            <div
              key={`${dot}-${index}`}
              className="flex h-20 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/5 text-3xl"
            >
              {dot}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-violet-400/30 bg-violet-500/10 p-6">
        <h2 className="text-2xl font-semibold">Фейковые двери (genie-lamp)</h2>
        <p className="mt-2 text-violet-100/80">
          Нажмите любую кнопку — и можно сразу заводить задачу в SupaPlan для следующего шага.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {fakeDoors.map((door) => (
            <article key={door.title} className="rounded-2xl border border-violet-300/30 bg-slate-950/40 p-4">
              <h3 className="text-lg font-medium">{door.title}</h3>
              <p className="mt-2 text-sm text-violet-100/80">{door.text}</p>
              <button
                type="button"
                className="mt-4 rounded-xl bg-violet-400/20 px-4 py-2 text-sm font-medium transition hover:bg-violet-400/35"
              >
                Зажечь лампу
              </button>
            </article>
          ))}
        </div>
      </section>

      <footer className="flex flex-wrap items-center gap-3 text-sm text-emerald-200/80">
        <Link className="rounded-xl border border-emerald-400/40 px-3 py-2 hover:bg-emerald-500/15" href="/supaplan">
          Открыть SupaPlan
        </Link>
        <Link className="rounded-xl border border-emerald-400/40 px-3 py-2 hover:bg-emerald-500/15" href="/repo-xml">
          Перейти к операторам
        </Link>
      </footer>
    </>
  );
}
