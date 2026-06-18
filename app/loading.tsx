const LOADER_GIF_URL =
  "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/Loader-S1000RR-8cb0319b-acf7-4ed9-bfd2-97b4b3e2c6fc.gif";

const bikeGoldFilter =
  "invert(1) grayscale(1) contrast(3.2) brightness(1.1) sepia(1) saturate(2.4) hue-rotate(2deg)";

export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="rounded-full bg-[radial-gradient(circle,rgba(212,175,55,0.14)_0%,rgba(212,175,55,0.06)_42%,transparent_68%)] p-6">
          <img
            src={LOADER_GIF_URL}
            alt="Загрузка..."
            className="h-28 w-28 object-contain [image-rendering:auto]"
            style={{ filter: bikeGoldFilter }}
          />
        </div>
        <p className="text-sm font-semibold tracking-[0.22em] text-[#D4AF37]">
          ЗАГРУЖАЕМ БАЙКИ
        </p>
      </div>
    </div>
  );
}
