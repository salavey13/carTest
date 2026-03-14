import StatusClient from "./StatusClient";

export default function SupaPlanPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-[radial-gradient(circle_at_top_right,#4338ca_0%,#0f172a_38%,#020617_100%)] p-6 text-white shadow-lg dark:border-slate-700/80">
        <div className="absolute -right-16 top-0 h-40 w-40 rounded-full bg-indigo-400/30 blur-3xl" aria-hidden />
        <div className="absolute -bottom-12 left-10 h-28 w-28 rounded-full bg-cyan-300/20 blur-2xl" aria-hidden />

        <p className="relative text-xs uppercase tracking-[0.22em] text-indigo-100">
          SupaPlan Marketplace
        </p>

        <h1 className="relative mt-2 text-3xl font-semibold sm:text-4xl">
          Витрина задач для мгновенного запуска Codex
        </h1>

        <p className="relative mt-3 max-w-3xl text-sm text-slate-200 sm:text-base">
          Здесь оператору не нужен CLI: выбери задачу, нажми <strong>«Отправить в Телеграм»</strong>,
          перешли сигнал в Codex и дождись команды на <strong>Create PR</strong>.
        </p>

        <div className="relative mt-4 grid gap-2 text-sm sm:grid-cols-3">
          <div className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 backdrop-blur">
            1. Поймал идею на доске задач
          </div>
          <div className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 backdrop-blur">
            2. Переслал уведомление в Codex
          </div>
          <div className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 backdrop-blur">
            3. Забрал PR и сам смёржил
          </div>
        </div>
      </header>

      <StatusClient />
    </div>
  );
}
