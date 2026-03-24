import StatusClient from "./StatusClient";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Bike } from "lucide-react";

export default function SupaPlanPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-5 px-3 py-4 sm:space-y-6 sm:px-6 sm:py-6 lg:px-8">
      <header className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-[radial-gradient(circle_at_top_right,#4338ca_0%,#0f172a_38%,#020617_100%)] p-4 text-white shadow-lg sm:p-6 dark:border-slate-700/80">
        <div className="absolute -right-16 top-0 h-40 w-40 rounded-full bg-indigo-400/30 blur-3xl" aria-hidden />
        <div className="absolute -bottom-12 left-10 h-28 w-28 rounded-full bg-cyan-300/20 blur-2xl" aria-hidden />

        <p className="relative text-[11px] uppercase tracking-[0.22em] text-indigo-100">Витрина задач СупаПлана</p>

        <h1 className="relative mt-2 text-2xl font-semibold leading-tight sm:text-4xl">Задачи и события в одном рабочем пульте</h1>

        <p className="relative mt-2 max-w-3xl text-sm text-slate-200 sm:mt-3 sm:text-base">
          Оператору не нужен терминал: выбери задачу, нажми <strong>«Отправить в Телеграм»</strong>,
          передай сигнал в Codex и дождись команды на <strong>Create PR</strong>.
        </p>

        <div className="relative mt-3 grid gap-2 text-xs sm:mt-4 sm:grid-cols-3 sm:text-sm">
          <div className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 backdrop-blur">1. Поймал идею на доске</div>
          <div className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 backdrop-blur">2. Переслал уведомление в Codex</div>
          <div className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 backdrop-blur">3. Забрал PR и смёржил</div>
        </div>
      </header>

      <Card className="border-slate-800/70 bg-slate-950 text-slate-100">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bike className="h-5 w-5 text-cyan-300" />
            Franchize board for VIP Bike
          </CardTitle>
          <CardDescription className="text-slate-400">
            Отдельная human-first страница: идеи клиента, маппинг в SupaPlan capability и текущие статусы.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/supaplan/franchize"
            className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-sm text-cyan-200 hover:bg-cyan-400/20"
          >
            Открыть /supaplan/franchize <ArrowRight className="h-4 w-4" />
          </Link>
        </CardContent>
      </Card>

      <StatusClient />
    </div>
  );
}
