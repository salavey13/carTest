export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center relative" style={{ backgroundColor: "#000000" }}>
      {/* Dark overlay for deeper black */}
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative flex flex-col items-center gap-4">
        {/* S1000RR GIF — inverted black→white, then sepia+gold tone */}
        <img
          src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/Loader-S1000RR-8cb0319b-acf7-4ed9-bfd2-97b4b3e2c6fc.gif"
          alt="Загрузка..."
          className="w-24 h-24 object-contain"
          style={{
            filter: "brightness(0.7) invert(1) sepia(1) saturate(2) hue-rotate(5deg)",
          }}
        />
        <p className="text-sm font-medium" style={{ color: "#D4AF37" }}>
          Загружаем байки...
        </p>
      </div>
    </div>
  );
}
