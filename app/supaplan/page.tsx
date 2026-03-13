import StatusClient from "./StatusClient";

export default function SupaPlanPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-900 p-6 text-white shadow-sm dark:border-slate-700/80 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-200">SupaPlan HQ</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Tasks dashboard</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-200">
          Live status, richer filtering, recent events feed, and one-tap Telegram routing for task ownership.
        </p>
      </header>

      <StatusClient />
    </div>
  );
}
