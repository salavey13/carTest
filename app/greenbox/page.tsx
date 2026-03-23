import Link from "next/link";

import { supabaseAdmin } from "@/lib/supabase-server";
import { CapabilityLaunchGrid } from "@/components/CapabilityLaunchGrid";

import { IrrigationQueueForm } from "./IrrigationQueueForm";
import { demoTomatoBushes, healthTone } from "./demo-content";

type StatTone = "ok" | "warn" | "hot";

type GardenStat = {
  icon: string;
  label: string;
  value: string;
  tone: StatTone;
};

type GreenboxTask = {
  id: string;
  title: string;
  capability: string;
  status: string;
  priority: "высокий" | "средний";
  fakeTag: string;
};

type QueueItem = {
  id: string;
  requested_at: string;
  zone: string;
  intensity: string;
  status: string;
};

const toneStyle: Record<StatTone, string> = {
  ok: "border-emerald-300/60 bg-emerald-50/90 text-emerald-900 dark:border-emerald-400/35 dark:bg-emerald-500/10 dark:text-emerald-100",
  warn: "border-amber-300/60 bg-amber-50/90 text-amber-900 dark:border-amber-400/35 dark:bg-amber-500/10 dark:text-amber-100",
  hot: "border-rose-300/65 bg-rose-50/90 text-rose-900 dark:border-rose-400/40 dark:bg-rose-500/10 dark:text-rose-100",
};

const capabilityPriority: Record<string, number> = {
  "greenbox.telemetry": 1,
  "greenbox.irrigation": 2,
  "greenbox.disease": 3,
  "greenbox.voice": 4,
};

function capabilityToTag(capability: string, title: string): string {
  if (capability === "greenbox.irrigation") return "FAKE_DOOR:GBX-G1-S2/S3";
  if (capability === "greenbox.telemetry" || title.includes("G1-S1")) return "FAKE_DOOR:GBX-G1-S1";
  if (title.includes("G2") || capability === "greenbox.disease") return "FAKE_DOOR:GBX-G2-S1";
  if (title.includes("G3") || capability === "greenbox.voice") return "FAKE_DOOR:GBX-G3-S1";
  return "FAKE_DOOR:GBX";
}

function humanStatus(status: string): string {
  if (status === "running") return "в работе";
  if (status === "claimed") return "забрано";
  if (status === "ready_for_pr") return "готово к запросу на слияние";
  if (status === "done") return "выполнено";
  return "открыто";
}

async function loadGreenboxTasks(): Promise<GreenboxTask[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from("supaplan_tasks")
      .select("id,title,capability,status")
      .in("capability", ["greenbox.telemetry", "greenbox.irrigation", "greenbox.disease", "greenbox.voice"])
      .in("status", ["open", "claimed", "running", "ready_for_pr", "done"])
      .order("updated_at", { ascending: false })
      .limit(10);

    if (error || !data) return [];

    return data
      .map((task) => {
        const priority = (capabilityPriority[task.capability ?? ""] ?? 99) <= 2 ? "высокий" : "средний";
        return {
          id: String(task.id),
          title: String(task.title ?? "Без названия"),
          capability: String(task.capability ?? "greenbox"),
          status: String(task.status ?? "open"),
          priority,
          fakeTag: capabilityToTag(String(task.capability ?? ""), String(task.title ?? "")),
        } satisfies GreenboxTask;
      })
      .sort((a, b) => (capabilityPriority[a.capability] ?? 99) - (capabilityPriority[b.capability] ?? 99));
  } catch {
    return [];
  }
}

async function loadQueue(): Promise<QueueItem[]> {
  try {
    const admin = supabaseAdmin as any;
    const { data, error } = await admin
      .from("greenbox_irrigation_queue")
      .select("id,requested_at,zone,intensity,status")
      .order("requested_at", { ascending: false })
      .limit(6);

    if (error || !data) return [];

    return data.map((row: Record<string, unknown>) => ({
      id: String(row.id ?? ""),
      requested_at: String(row.requested_at ?? ""),
      zone: String(row.zone ?? "неизвестная зона"),
      intensity: String(row.intensity ?? "normal"),
      status: String(row.status ?? "queued"),
    }));
  } catch {
    return [];
  }
}

export default async function GreenboxPage() {
  const [tasks, queue] = await Promise.all([loadGreenboxTasks(), loadQueue()]);
  const totalFruits = demoTomatoBushes.reduce((sum, bush) => sum + bush.fruitCount, 0);
  const avgHydration = Math.round(demoTomatoBushes.reduce((sum, bush) => sum + bush.hydration, 0) / demoTomatoBushes.length);

  const gardenStats: GardenStat[] = [
    { icon: "🌿", label: "Кустов в демо-грядке", value: String(demoTomatoBushes.length), tone: "ok" },
    { icon: "🍅", label: "Плодов в симуляции", value: String(totalFruits), tone: "ok" },
    { icon: "💧", label: "Средняя влажность", value: `${avgHydration}%`, tone: "warn" },
    { icon: "🧪", label: "Очередь полива", value: `${queue.length} заявок`, tone: queue.length > 4 ? "hot" : "ok" },
  ];

  return (
    <div className="space-y-6">
      <header className="rounded-[2rem] border border-emerald-300/60 bg-white/80 p-5 shadow-[0_16px_40px_-24px_rgba(16,185,129,0.45)] backdrop-blur dark:border-emerald-400/20 dark:bg-emerald-950/45">
        <p className="text-xs uppercase tracking-[0.2em] text-emerald-900/75 dark:text-emerald-100/75">GREENBOX · цифровой сад</p>
        <h1 className="mt-2 text-3xl font-semibold text-emerald-950 dark:text-emerald-50">Спокойная панель для мамы 🌿</h1>
        <p className="mt-2 max-w-3xl text-emerald-900/80 dark:text-emerald-100/80">
          Вернули живую демо-грядку и вынесли её в отдельный контент-файл до запуска полноценных таблиц растений.
        </p>
      </header>

      <section className="rounded-[2rem] border border-emerald-200/70 bg-white/85 p-4 dark:border-emerald-400/20 dark:bg-slate-950/45">
        <h2 className="text-xl font-semibold text-emerald-950 dark:text-emerald-50">Маршруты оператора</h2>
        <p className="mt-2 text-sm text-emerald-900/80 dark:text-emerald-100/80">Тот же capability-пакет, что на главной и в Nexus: вход в Codex, Nexus, Repo XML и VIP Bike Rental без расхождения по CTA.</p>
        <CapabilityLaunchGrid includeVipBikeRental className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4" />
      </section>

      <section className="rounded-[2rem] border border-emerald-200/70 bg-white/85 p-4 dark:border-emerald-400/20 dark:bg-slate-950/45">
        <h2 className="text-xl font-semibold text-emerald-950 dark:text-emerald-50">Иконки и цвета (легенда)</h2>
        <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
          <li className="rounded-xl border border-emerald-300/60 bg-emerald-50/80 p-3 text-emerald-900 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-100">🟢 Норма — всё хорошо</li>
          <li className="rounded-xl border border-amber-300/60 bg-amber-50/80 p-3 text-amber-900 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100">🟡 Внимание — стоит проверить</li>
          <li className="rounded-xl border border-rose-300/60 bg-rose-50/80 p-3 text-rose-900 dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-100">🔴 Срочно — нужен уход</li>
        </ul>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {gardenStats.map((stat) => (
          <article key={stat.label} className={`rounded-2xl border p-4 ${toneStyle[stat.tone]}`}>
            <p className="text-sm opacity-85">{stat.icon} {stat.label}</p>
            <p className="mt-2 text-2xl font-semibold">{stat.value}</p>
          </article>
        ))}
      </section>

      <section className="rounded-[2rem] border border-emerald-200/70 bg-white/85 p-4 shadow-[0_14px_36px_-26px_rgba(16,185,129,0.45)] backdrop-blur sm:p-6 dark:border-emerald-400/20 dark:bg-slate-950/45">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold text-emerald-950 dark:text-emerald-50">Демо-грядка (временный контент)</h2>
          <span className="rounded-full border border-emerald-300/70 bg-emerald-100/70 px-3 py-1 text-xs uppercase tracking-widest text-emerald-900 dark:border-emerald-400/35 dark:bg-emerald-500/10 dark:text-emerald-200">demo</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {demoTomatoBushes.map((bush) => (
            <article key={bush.name} className={`rounded-2xl border border-emerald-300/45 bg-gradient-to-br p-4 shadow-[0_8px_24px_-18px_rgba(16,185,129,0.5)] dark:border-emerald-500/25 ${bush.tone}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-emerald-900/70 dark:text-emerald-200/75">{bush.stage}</p>
                  <h3 className="mt-1 text-xl font-semibold text-emerald-950 dark:text-emerald-50">{bush.emoji} {bush.name}</h3>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs ${healthTone[bush.health]}`}>{bush.health}</span>
              </div>
              <p className="mt-3 text-sm text-emerald-900/85 dark:text-emerald-100/85">{bush.note}</p>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-xl border border-emerald-300/50 bg-white/65 p-2 dark:border-emerald-500/20 dark:bg-emerald-950/35"><dt>Влажность</dt><dd className="font-medium">{bush.hydration}%</dd></div>
                <div className="rounded-xl border border-emerald-300/50 bg-white/65 p-2 dark:border-emerald-500/20 dark:bg-emerald-950/35"><dt>EC</dt><dd className="font-medium">{bush.ec}</dd></div>
                <div className="rounded-xl border border-emerald-300/50 bg-white/65 p-2 dark:border-emerald-500/20 dark:bg-emerald-950/35"><dt>pH</dt><dd className="font-medium">{bush.ph}</dd></div>
                <div className="rounded-xl border border-emerald-300/50 bg-white/65 p-2 dark:border-emerald-500/20 dark:bg-emerald-950/35"><dt>Плоды</dt><dd className="font-medium">{bush.fruitCount}</dd></div>
              </dl>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[2rem] border border-cyan-200/70 bg-white/85 p-4 dark:border-cyan-400/20 dark:bg-slate-950/45">
        <h2 className="text-2xl font-semibold text-cyan-950 dark:text-cyan-50">Авто-полив и журнал (GBX-G1-S2/S3)</h2>
        <p className="mt-2 text-cyan-900/80 dark:text-cyan-100/80">Кнопка пишет в отдельную таблицу журнала Greenbox, не затрагивая SupaPlan events.</p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <IrrigationQueueForm />
          <article className="rounded-2xl border border-cyan-300/60 bg-cyan-50/75 p-4 dark:border-cyan-400/25 dark:bg-cyan-500/10">
            <h3 className="font-medium text-cyan-950 dark:text-cyan-50">Последние циклы</h3>
            <ul className="mt-3 space-y-2 text-sm text-cyan-900 dark:text-cyan-100">
              {queue.length ? queue.map((item) => (
                <li key={item.id} className="rounded-xl border border-cyan-300/50 bg-white/75 p-2 dark:border-cyan-400/20 dark:bg-cyan-950/30">
                  <span className="font-medium">{item.zone}</span> · {item.intensity} · {item.status} · {new Date(item.requested_at).toLocaleString("ru-RU")}
                </li>
              )) : <li className="rounded-xl border border-cyan-300/50 bg-white/75 p-2 dark:border-cyan-400/20 dark:bg-cyan-950/30">Журнал пока пуст.</li>}
            </ul>
          </article>
        </div>
      </section>

      <section className="rounded-[2rem] border border-fuchsia-200/75 bg-white/85 p-4 dark:border-violet-400/20 dark:bg-slate-950/45">
        <h2 className="text-2xl font-semibold text-fuchsia-950 dark:text-violet-50">Живая дорожная карта расфейковки</h2>
        <p className="mt-2 text-fuchsia-900/80 dark:text-violet-100/80">Список идёт из SupaPlan, но данные Greenbox пишем в отдельные таблицы домена.</p>
        <div className="mt-4 space-y-3">
          {tasks.length ? tasks.map((task) => (
            <article key={task.id} className="rounded-2xl border border-fuchsia-300/55 bg-fuchsia-50/80 p-4 dark:border-violet-400/30 dark:bg-violet-950/30">
              <p className="text-xs uppercase tracking-widest text-fuchsia-900/75 dark:text-violet-200/80">{task.fakeTag}</p>
              <h3 className="mt-1 text-lg font-medium text-fuchsia-950 dark:text-violet-50">{task.title}</h3>
              <p className="mt-2 text-sm text-fuchsia-900/85 dark:text-violet-100/85">Состояние: {humanStatus(task.status)} · Приоритет: {task.priority}</p>
            </article>
          )) : <p className="rounded-xl border border-fuchsia-300/50 bg-fuchsia-50/80 p-3 text-fuchsia-900 dark:border-violet-400/20 dark:bg-violet-950/30 dark:text-violet-100">Не удалось загрузить задачи SupaPlan.</p>}
        </div>
      </section>

      <section className="rounded-[2rem] border border-lime-200/70 bg-white/85 p-4 dark:border-lime-400/20 dark:bg-slate-950/45">
        <h2 className="text-2xl font-semibold text-lime-950 dark:text-lime-50">Учебные подстраницы</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link className="rounded-xl border border-lime-300/70 bg-lime-100 px-3 py-2 text-lime-900 transition hover:bg-lime-200 dark:border-lime-400/35 dark:bg-lime-500/20 dark:text-lime-50" href="/greenbox/botanika">Ботаника для дома</Link>
          <Link className="rounded-xl border border-lime-300/70 bg-lime-100 px-3 py-2 text-lime-900 transition hover:bg-lime-200 dark:border-lime-400/35 dark:bg-lime-500/20 dark:text-lime-50" href="/greenbox/gidroponika">Гидропоника шаг за шагом</Link>
        </div>
      </section>
    </div>
  );
}
