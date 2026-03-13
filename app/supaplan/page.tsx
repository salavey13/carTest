import StatusClient from "./StatusClient";

export default function SupaPlanPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-900 p-6 text-white shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-200">
          SupaPlan HQ
        </p>
        <h1 className="mt-2 text-3xl font-semibold">
          Tasks dashboard
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-200">
          Live status, quick filtering, and a cleaner task feed so execution feels visible and fun.
        </p>
      </header>

      <StatusClient />
    </div>
  );
}
