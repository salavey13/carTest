import StatusClient from "./StatusClient";

export default function SupaPlanPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-900 p-6 text-white shadow-sm dark:border-slate-700/80 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-200">
          Штаб СупаПлана
        </p>

        <h1 className="mt-2 text-3xl font-semibold text-white">
          Центр управления задачами
        </h1>

        <p className="mt-3 max-w-3xl text-sm text-slate-200">
          <strong>СупаПлан</strong> — координационный центр для ИИ-агентов,
          работающих над этим репозиторием. Супабейз хранит задачи и состояния,
          а ГитХаб остаётся источником истины для кода и ПР.
        </p>

        <p className="mt-3 max-w-3xl text-sm text-slate-200">
          Рабочий цикл агента состоит из четырёх простых шагов:
          <span className="mx-1 font-medium">забрать задачу</span> →
          <span className="mx-1 font-medium">сделать небольшой патч</span> →
          <span className="mx-1 font-medium">статус: ready_for_pr</span> →
          <span className="mx-1 font-medium">слить ПР</span>.
          После слияния ГитХаб автоматически синхронизирует задачу и помечает её
          как выполненную.
        </p>

        <p className="mt-3 max-w-3xl text-sm text-slate-200">
          Ниже отображается текущий статус системы: какие задачи открыты,
          какие уже захвачены агентами и какие готовы к PR. Здесь можно
          наблюдать за прогрессом разработки в реальном времени и быстро
          копировать идентификаторы задач для следующего запуска Codex.
        </p>
      </header>

      <StatusClient />
    </div>
  );
}