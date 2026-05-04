export default function BuyBikeLoading() {
  return (
    <main className="min-h-screen px-3 pb-20 pt-4 sm:px-6 sm:pt-6">
      <div className="mx-auto flex w-full max-w-6xl animate-pulse flex-col gap-4">
        <div className="h-10 w-36 rounded-xl bg-white/10" />
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
          <div className="grid lg:grid-cols-[1.3fr_1fr]">
            <div className="space-y-2 p-2 sm:p-3">
              <div className="aspect-[9/16] rounded-2xl bg-white/10 sm:aspect-[4/3]" />
              <div className="grid grid-cols-5 gap-2">
                {Array.from({ length: 5 }).map((_, idx) => (
                  <div key={idx} className="aspect-[4/3] rounded-xl bg-white/10" />
                ))}
              </div>
            </div>
            <div className="space-y-3 p-4">
              <div className="h-6 w-24 rounded-full bg-white/10" />
              <div className="h-10 w-4/5 rounded-xl bg-white/10" />
              <div className="h-20 rounded-2xl bg-white/10" />
              <div className="h-12 rounded-xl bg-white/10" />
              <div className="h-12 rounded-xl bg-white/10" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
