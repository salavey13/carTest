import Link from "next/link";

type BushStage = "Росток" | "Цветение" | "Плодоношение" | "Восстановление";
type BushHealth = "Отлично" | "Норма" | "Требует внимания";

type TomatoBush = {
  name: string;
  stage: BushStage;
  health: BushHealth;
  progress: number;
  hydration: number;
  ec: number;
  ph: number;
  fruitCount: number;
  note: string;
  emoji: string;
  tone: string;
};

type EnvironmentStat = {
  label: string;
  value: string;
  status: "ok" | "warn" | "hot";
  hint: string;
};

type FakeDoor = {
  title: string;
  text: string;
  fakeTag: string;
  unfakeTask: string;
  dependency: string;
};

const tomatoBushes: TomatoBush[] = [
  {
    name: "Черри #1",
    stage: "Росток",
    health: "Отлично",
    progress: 28,
    hydration: 73,
    ec: 1.2,
    ph: 6.1,
    fruitCount: 0,
    note: "Наращивает корневую массу после пересадки.",
    emoji: "🌱",
    tone: "from-lime-100/80 to-emerald-100/70 dark:from-emerald-900/40 dark:to-lime-900/20",
  },
  {
    name: "Розовый мёд #2",
    stage: "Цветение",
    health: "Норма",
    progress: 58,
    hydration: 66,
    ec: 1.6,
    ph: 6.4,
    fruitCount: 4,
    note: "Первые кисти раскрылись, нужен стабильный обдув.",
    emoji: "🌿",
    tone: "from-emerald-100/80 to-teal-100/70 dark:from-emerald-900/35 dark:to-teal-900/20",
  },
  {
    name: "Бычье сердце #3",
    stage: "Плодоношение",
    health: "Отлично",
    progress: 84,
    hydration: 71,
    ec: 2.0,
    ph: 6.2,
    fruitCount: 11,
    note: "Плоды наливаются, вес кистей растёт.",
    emoji: "🍅",
    tone: "from-orange-100/90 to-rose-100/70 dark:from-rose-900/35 dark:to-orange-900/20",
  },
  {
    name: "Сливка #4",
    stage: "Восстановление",
    health: "Требует внимания",
    progress: 42,
    hydration: 54,
    ec: 1.1,
    ph: 5.7,
    fruitCount: 2,
    note: "Стресс после жары, нужен мягкий полив и тень.",
    emoji: "🪴",
    tone: "from-amber-100/90 to-yellow-100/70 dark:from-amber-900/40 dark:to-yellow-900/20",
  },
];

const environmentStats: EnvironmentStat[] = [
  { label: "Температура", value: "24.8°C", status: "ok", hint: "Оптимально для вегетации." },
  { label: "Влажность", value: "62%", status: "ok", hint: "Листья не пересыхают." },
  { label: "CO₂", value: "735 ppm", status: "warn", hint: "Можно усилить вентиляцию в обед." },
  { label: "Освещённость", value: "39 200 lux", status: "ok", hint: "Равномерный свет по рядам." },
  { label: "Раствор", value: "6.0 pH / 1.7 EC", status: "warn", hint: "Есть разброс между контейнерами." },
  { label: "Стресс-сигнал", value: "1 активный куст", status: "hot", hint: "Куст #4 просит сценарий восстановления." },
];

const fakeDoors: FakeDoor[] = [
  {
    title: "Авто-полив с мягким спасением",
    text: "Сейчас это имитация: кнопка красивая, но живой команды на насос нет.",
    fakeTag: "FAKE_DOOR:GBX-G1-S2",
    unfakeTask: "Расфейк: серверное действие + очередь полива",
    dependency: "Группа G1 / шаг 2 после датчиков",
  },
  {
    title: "Диагностика болезней листа",
    text: "Пока это атмосферная карточка без загрузки фото и реальной модели.",
    fakeTag: "FAKE_DOOR:GBX-G2-S1",
    unfakeTask: "Расфейк: OCR + классификатор симптомов",
    dependency: "Группа G2 / шаг 1 (параллельно G1)",
  },
  {
    title: "Голосовой ИИ-садовник",
    text: "Сейчас даёт вайб-ответы без настоящего распознавания речи.",
    fakeTag: "FAKE_DOOR:GBX-G3-S1",
    unfakeTask: "Расфейк: распознавание речи + синтез ответа",
    dependency: "Группа G3 / шаг 1 (параллельно G1/G2)",
  },
];

const healthTone: Record<BushHealth, string> = {
  Отлично:
    "border-emerald-300/70 bg-emerald-100/80 text-emerald-900 dark:border-emerald-400/40 dark:bg-emerald-500/15 dark:text-emerald-100",
  Норма:
    "border-lime-300/70 bg-lime-100/80 text-lime-900 dark:border-lime-400/40 dark:bg-lime-500/15 dark:text-lime-100",
  "Требует внимания":
    "border-amber-300/70 bg-amber-100/80 text-amber-900 dark:border-amber-400/45 dark:bg-amber-500/15 dark:text-amber-100",
};

const envTone: Record<EnvironmentStat["status"], string> = {
  ok: "border-emerald-300/60 bg-emerald-50/90 text-emerald-900 dark:border-emerald-400/35 dark:bg-emerald-500/10 dark:text-emerald-100",
  warn: "border-amber-300/60 bg-amber-50/90 text-amber-900 dark:border-amber-400/35 dark:bg-amber-500/10 dark:text-amber-100",
  hot: "border-rose-300/65 bg-rose-50/90 text-rose-900 dark:border-rose-400/40 dark:bg-rose-500/10 dark:text-rose-100",
};

export default function GreenboxPage() {
  const totalFruits = tomatoBushes.reduce((sum, bush) => sum + bush.fruitCount, 0);
  const avgHydration = Math.round(
    tomatoBushes.reduce((sum, bush) => sum + bush.hydration, 0) / tomatoBushes.length,
  );

  return (
    <>
      <header className="relative overflow-hidden rounded-[2rem] border border-emerald-300/60 bg-white/75 p-5 shadow-[0_18px_45px_-25px_rgba(16,185,129,0.5)] backdrop-blur md:p-8 dark:border-emerald-400/20 dark:bg-emerald-950/40 dark:shadow-[0_24px_50px_-30px_rgba(16,185,129,0.65)]">
        <div className="pointer-events-none absolute -left-20 -top-20 h-52 w-52 rounded-full bg-lime-300/35 blur-3xl dark:bg-emerald-400/15" />
        <div className="pointer-events-none absolute -right-16 top-8 h-56 w-56 rounded-full bg-yellow-200/35 blur-3xl dark:bg-teal-400/10" />

        <p className="relative text-xs font-medium uppercase tracking-[0.24em] text-emerald-800/90 dark:text-emerald-200/90">
          Greenbox · дачный вайб-пульт
        </p>
        <h1 className="relative mt-3 text-3xl font-semibold leading-tight text-emerald-950 md:text-5xl dark:text-emerald-50">
          Живой томатный сад уже дышит,
          <br className="hidden sm:block" />
          а атмосфера — как тёплое утро в теплице
        </h1>
        <p className="relative mt-4 max-w-3xl text-base text-emerald-900/85 md:text-lg dark:text-emerald-100/90">
          Это фейк-first витрина для вдохновения: всё выглядит живо, чтобы хотелось расфейковывать дальше.
          Железо пока в планах, но интерфейс уже приятный, домашний и не пугающий.
        </p>

        <div className="relative mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <article className="rounded-2xl border border-emerald-300/60 bg-emerald-50/90 p-4 dark:border-emerald-400/25 dark:bg-emerald-900/25">
            <p className="text-sm text-emerald-800/85 dark:text-emerald-200/80">Кустов в контуре</p>
            <p className="mt-1 text-3xl font-semibold text-emerald-950 dark:text-emerald-50">{tomatoBushes.length}</p>
          </article>
          <article className="rounded-2xl border border-emerald-300/60 bg-emerald-50/90 p-4 dark:border-emerald-400/25 dark:bg-emerald-900/25">
            <p className="text-sm text-emerald-800/85 dark:text-emerald-200/80">Плодов в симуляции</p>
            <p className="mt-1 text-3xl font-semibold text-emerald-950 dark:text-emerald-50">{totalFruits}</p>
          </article>
          <article className="rounded-2xl border border-emerald-300/60 bg-emerald-50/90 p-4 dark:border-emerald-400/25 dark:bg-emerald-900/25">
            <p className="text-sm text-emerald-800/85 dark:text-emerald-200/80">Средняя влажность корней</p>
            <p className="mt-1 text-3xl font-semibold text-emerald-950 dark:text-emerald-50">{avgHydration}%</p>
          </article>
        </div>
      </header>

      <section className="rounded-[2rem] border border-emerald-200/70 bg-white/85 p-4 shadow-[0_14px_36px_-26px_rgba(16,185,129,0.45)] backdrop-blur sm:p-6 dark:border-emerald-400/20 dark:bg-slate-950/45 dark:shadow-[0_14px_36px_-26px_rgba(16,185,129,0.55)]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold text-emerald-950 dark:text-emerald-50">Грядка в реальном времени</h2>
          <span className="rounded-full border border-emerald-300/70 bg-emerald-100/70 px-3 py-1 text-xs uppercase tracking-widest text-emerald-900 dark:border-emerald-400/35 dark:bg-emerald-500/10 dark:text-emerald-200">
            life-like demo
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {tomatoBushes.map((bush) => (
            <article
              key={bush.name}
              className={`rounded-2xl border border-emerald-300/45 bg-gradient-to-br p-4 shadow-[0_8px_24px_-18px_rgba(16,185,129,0.5)] dark:border-emerald-500/25 ${bush.tone}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-emerald-900/70 dark:text-emerald-200/75">{bush.stage}</p>
                  <h3 className="mt-1 text-xl font-semibold text-emerald-950 dark:text-emerald-50">
                    {bush.emoji} {bush.name}
                  </h3>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs ${healthTone[bush.health]}`}>{bush.health}</span>
              </div>

              <div className="mt-3 h-2 rounded-full bg-emerald-900/10 dark:bg-emerald-950/60">
                <div className="h-full rounded-full bg-emerald-500 dark:bg-emerald-400" style={{ width: `${bush.progress}%` }} />
              </div>
              <p className="mt-2 text-xs text-emerald-900/75 dark:text-emerald-100/75">Прогресс цикла: {bush.progress}%</p>

              <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-xl border border-emerald-300/50 bg-white/65 p-2 dark:border-emerald-500/20 dark:bg-emerald-950/35">
                  <dt className="text-emerald-900/75 dark:text-emerald-100/70">Влажность</dt>
                  <dd className="font-medium text-emerald-950 dark:text-emerald-50">{bush.hydration}%</dd>
                </div>
                <div className="rounded-xl border border-emerald-300/50 bg-white/65 p-2 dark:border-emerald-500/20 dark:bg-emerald-950/35">
                  <dt className="text-emerald-900/75 dark:text-emerald-100/70">Раствор EC</dt>
                  <dd className="font-medium text-emerald-950 dark:text-emerald-50">{bush.ec}</dd>
                </div>
                <div className="rounded-xl border border-emerald-300/50 bg-white/65 p-2 dark:border-emerald-500/20 dark:bg-emerald-950/35">
                  <dt className="text-emerald-900/75 dark:text-emerald-100/70">Раствор pH</dt>
                  <dd className="font-medium text-emerald-950 dark:text-emerald-50">{bush.ph}</dd>
                </div>
                <div className="rounded-xl border border-emerald-300/50 bg-white/65 p-2 dark:border-emerald-500/20 dark:bg-emerald-950/35">
                  <dt className="text-emerald-900/75 dark:text-emerald-100/70">Плоды</dt>
                  <dd className="font-medium text-emerald-950 dark:text-emerald-50">{bush.fruitCount}</dd>
                </div>
              </dl>

              <p className="mt-3 text-sm text-emerald-900/85 dark:text-emerald-100/85">{bush.note}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[2rem] border border-cyan-200/70 bg-white/85 p-4 shadow-[0_14px_36px_-26px_rgba(14,165,233,0.4)] backdrop-blur sm:p-6 dark:border-cyan-400/20 dark:bg-slate-950/45 dark:shadow-[0_14px_36px_-26px_rgba(14,165,233,0.5)]">
        <h2 className="text-2xl font-semibold text-cyan-950 dark:text-cyan-50">Панель среды</h2>
        <p className="mt-2 text-cyan-900/80 dark:text-cyan-100/85">
          Лёгкая читаемая сводка — чтобы мама сразу видела, где всё хорошо, а где нужна забота.
        </p>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {environmentStats.map((stat) => (
            <article key={stat.label} className={`rounded-2xl border p-4 ${envTone[stat.status]}`}>
              <p className="text-xs uppercase tracking-[0.18em] opacity-80">{stat.label}</p>
              <p className="mt-2 text-2xl font-semibold">{stat.value}</p>
              <p className="mt-2 text-sm opacity-85">{stat.hint}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[2rem] border border-fuchsia-200/75 bg-white/85 p-4 shadow-[0_14px_36px_-26px_rgba(217,70,239,0.35)] backdrop-blur sm:p-6 dark:border-violet-400/20 dark:bg-slate-950/45 dark:shadow-[0_14px_36px_-26px_rgba(217,70,239,0.45)]">
        <h2 className="text-2xl font-semibold text-fuchsia-950 dark:text-violet-50">Фейковые двери (с планом расфейковки)</h2>
        <p className="mt-2 text-fuchsia-900/80 dark:text-violet-100/80">
          Функции пока декоративные, но каждая помечена кодом и понятным следующим шагом.
        </p>
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          {fakeDoors.map((door) => (
            <article
              key={door.title}
              className="rounded-2xl border border-fuchsia-300/55 bg-fuchsia-50/80 p-4 dark:border-violet-400/30 dark:bg-violet-950/30"
            >
              <p className="text-xs uppercase tracking-widest text-fuchsia-900/75 dark:text-violet-200/80">{door.fakeTag}</p>
              <h3 className="mt-2 text-lg font-medium text-fuchsia-950 dark:text-violet-50">{door.title}</h3>
              <p className="mt-2 text-sm text-fuchsia-900/85 dark:text-violet-100/85">{door.text}</p>
              <p className="mt-3 rounded-lg border border-fuchsia-300/50 bg-white/70 p-2 text-xs text-fuchsia-900/80 dark:border-violet-400/25 dark:bg-violet-900/30 dark:text-violet-100/85">
                {door.unfakeTask}
              </p>
              <p className="mt-2 text-xs text-fuchsia-900/75 dark:text-violet-200/80">{door.dependency}</p>
              <button
                type="button"
                className="mt-4 w-full rounded-xl border border-fuchsia-300/55 bg-fuchsia-100 px-4 py-2 text-sm font-medium text-fuchsia-900 transition hover:bg-fuchsia-200 dark:border-violet-400/35 dark:bg-violet-500/20 dark:text-violet-50 dark:hover:bg-violet-500/35"
              >
                Зажечь лампу
              </button>
            </article>
          ))}
        </div>
      </section>

      <footer className="flex flex-wrap items-center gap-3 text-sm text-emerald-900/85 dark:text-emerald-100/80">
        <Link
          className="rounded-xl border border-emerald-300/70 bg-emerald-50 px-3 py-2 text-emerald-900 transition hover:bg-emerald-100 dark:border-emerald-400/35 dark:bg-emerald-500/15 dark:text-emerald-100 dark:hover:bg-emerald-500/25"
          href="/supaplan"
        >
          Открыть SupaPlan
        </Link>
        <Link
          className="rounded-xl border border-emerald-300/70 bg-emerald-50 px-3 py-2 text-emerald-900 transition hover:bg-emerald-100 dark:border-emerald-400/35 dark:bg-emerald-500/15 dark:text-emerald-100 dark:hover:bg-emerald-500/25"
          href="/repo-xml"
        >
          Перейти к операторам
        </Link>
      </footer>
    </>
  );
}
