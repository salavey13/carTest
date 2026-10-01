// app/franchize/discovery/loading.tsx
// Route-level skeleton for the global crew discovery page (2026-10-02).
// The page itself is force-dynamic (fresh network on every visit), so a
// nav from a crew footer / map-riders tab would otherwise stare at a blank
// screen for the whole DB roundtrip. Same gradient, same proportions —
// pure presentation, no data, no client JS beyond CSS.

export default function CrewDiscoveryLoading() {
  return (
    <main
      className="min-h-screen w-full text-white"
      style={{
        background:
          "radial-gradient(1100px 700px at 50% -12%, #1c2c50 0%, #0d1526 52%, #070b16 100%)",
      }}
      aria-busy="true"
      aria-label="Загружаем сеть экипажей"
    >
      <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-10 md:pt-14">
        {/* header */}
        <div className="flex flex-col items-center gap-3">
          <div className="cg-pulse h-3 w-40 rounded-full bg-white/10" />
          <div className="cg-pulse h-9 w-72 rounded-full bg-white/15" />
          <div className="cg-pulse h-4 w-full max-w-xl rounded-full bg-white/10" />
        </div>

        {/* stats chips */}
        <div className="mt-6 flex justify-center gap-2">
          {[64, 80, 72].map((w, i) => (
            <div key={i} className="cg-pulse h-7 rounded-full bg-white/10" style={{ width: w }} />
          ))}
        </div>

        {/* the graph canvas */}
        <div className="mt-6 h-[340px] rounded-3xl border border-white/10 bg-white/[0.04] sm:h-[460px]" />

        {/* crew cards */}
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-3xl border border-white/10 bg-white/[0.05] p-5">
              <div className="flex items-center gap-3">
                <div className="cg-pulse h-11 w-11 rounded-full bg-white/10" />
                <div className="flex-1 space-y-2">
                  <div className="cg-pulse h-4 w-2/5 rounded-full bg-white/10" />
                  <div className="cg-pulse h-3 w-1/5 rounded-full bg-white/10" />
                </div>
              </div>
              <div className="cg-pulse mt-3 h-3 w-3/4 rounded-full bg-white/10" />
              <div className="cg-pulse mt-4 h-11 w-full rounded-full bg-white/10" />
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes cg-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
        .cg-pulse { animation: cg-pulse 1.4s ease-in-out infinite; }
      `}</style>
    </main>
  );
}
