import type { ReactNode } from "react";

export default function GreenboxLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f4ffe9_0%,#f8fff3_45%,#fffdf8_100%)] text-emerald-950 transition-colors dark:bg-[linear-gradient(180deg,#04140c_0%,#061e13_45%,#072217_100%)] dark:text-emerald-50">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8 lg:px-8">
        {children}
      </div>
    </main>
  );
}
