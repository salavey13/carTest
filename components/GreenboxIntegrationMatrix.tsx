import { AlertTriangle, CheckCircle2, Gauge, ShieldAlert, Sprout, Wrench } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const integrations = [
  {
    name: "Plugin contract v0.1",
    owner: "greenbox.platform",
    readiness: 92,
    risk: "Низкий",
    note: "Контракт манифестов уже собран, можно опираться на стабильные capability names.",
    icon: CheckCircle2,
    tone: "text-emerald-300",
  },
  {
    name: "Simulator write queue",
    owner: "greenbox.simulator",
    readiness: 58,
    risk: "Средний",
    note: "Нужно упорядочить запись полива и реплеев до массового мобильного трафика.",
    icon: Gauge,
    tone: "text-amber-300",
  },
  {
    name: "Shared inventory bridge",
    owner: "greenbox.franchize",
    readiness: 46,
    risk: "Средний",
    note: "Связка Greenbox ↔ VIP-bike нужна для каталога растений, слотов и клиентских сценариев.",
    icon: Sprout,
    tone: "text-lime-300",
  },
  {
    name: "Demo scenario pack",
    owner: "greenbox.demo",
    readiness: 39,
    risk: "Высокий",
    note: "Нужен понятный walkthrough, чтобы оператор видел fake-first ценность без железа.",
    icon: Wrench,
    tone: "text-cyan-300",
  },
  {
    name: "Alert storytelling cards",
    owner: "greenbox.storytelling",
    readiness: 34,
    risk: "Высокий",
    note: "Пока нет дружелюбных карточек тревог для нетехнической аудитории и мамы-садовода.",
    icon: ShieldAlert,
    tone: "text-fuchsia-300",
  },
  {
    name: "Telegram delivery loop",
    owner: "gateway.telegram",
    readiness: 28,
    risk: "Высокий",
    note: "Канал уведомлений ещё не закрыт end-to-end, значит магия алертов пока не полная.",
    icon: AlertTriangle,
    tone: "text-rose-300",
  },
];

function readinessTone(readiness: number): string {
  if (readiness >= 80) return "bg-emerald-400";
  if (readiness >= 50) return "bg-amber-400";
  return "bg-rose-400";
}

export function GreenboxIntegrationMatrix() {
  return (
    <section className="container mx-auto mt-10 px-4">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-mono uppercase tracking-[0.22em] text-emerald-300/90">Greenbox integration matrix</p>
          <h2 className="mt-2 text-2xl font-bold text-zinc-50">Что уже собрано, а что ещё держит интеграционный коридор</h2>
        </div>
        <p className="max-w-xl text-sm text-zinc-400">
          Секция нужна оператору до глубоких реализаций: видно владельца capability, риск и реальный процент готовности.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {integrations.map((integration) => {
          const Icon = integration.icon;
          return (
            <Card key={integration.name} className="border-zinc-800 bg-zinc-900/70 backdrop-blur">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center text-zinc-100">
                      <Icon className={`mr-2 h-5 w-5 ${integration.tone}`} />
                      {integration.name}
                    </CardTitle>
                    <p className="mt-2 text-xs font-mono uppercase tracking-wide text-zinc-400">owner: {integration.owner}</p>
                  </div>
                  <span className="rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1 text-xs font-mono text-zinc-200">
                    риск: {integration.risk}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between gap-3">
                  <div className="w-full rounded-full bg-zinc-800/90 p-1">
                    <div
                      className={`h-2.5 rounded-full ${readinessTone(integration.readiness)}`}
                      style={{ width: `${integration.readiness}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-zinc-100">{integration.readiness}%</span>
                </div>
                <p className="mt-3 text-sm text-zinc-400">{integration.note}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
