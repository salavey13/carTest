import Link from "next/link";

export default function FranchizeLoading() {
  return (
    <main className="min-h-screen flex items-center justify-center relative overflow-hidden bg-black" aria-busy="true">
      {/* Simple radial glow behind GIF */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className="rounded-full"
          style={{
            width: "300px",
            height: "300px",
            background: "radial-gradient(circle, rgba(212,175,55,0.15) 0%, rgba(212,175,55,0.05) 40%, transparent 70%)",
          }}
        />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-6 px-4">
        {/* S1000RR GIF */}
        <img
          src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/Loader-S1000RR-8cb0319b-acf7-4ed9-bfd2-97b4b3e2c6fc.gif"
          alt="Загрузка..."
          className="w-24 h-24 object-contain"
          style={{
            filter: "invert(1) grayscale(0.5) sepia(0.8) saturate(3) contrast(2)",
          }}
        />

        {/* Text */}
        <div className="text-center space-y-2">
          <p
            className="text-sm font-medium tracking-wider"
            style={{ color: "#D4AF37" }}
          >
            Загружаем каталог...
          </p>

          {/* Progress indicator */}
          <div className="flex items-center gap-2 justify-center">
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ backgroundColor: "#FFD700", animationDelay: "0s" }}
            />
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ backgroundColor: "#FFD700", animationDelay: "0.2s" }}
            />
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ backgroundColor: "#FFD700", animationDelay: "0.4s" }}
            />
          </div>
        </div>

        <Link href="/franchize" className="mt-4 text-sm font-semibold" style={{ color: "#D4AF37" }}>
          Вернуться в каталог
        </Link>
      </div>
    </main>
  );
}