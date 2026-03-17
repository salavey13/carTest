import type { ReactNode } from "react";

export default function GreenboxLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-950 text-emerald-100">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 py-8 md:px-8">
        {children}
      </div>
    </main>
  );
}
