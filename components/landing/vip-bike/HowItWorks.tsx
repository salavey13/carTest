/**
 * VIP Bike Electro Landing - How It Works Section
 * Brutalist, high-end fitness studio aesthetic
 */

import Link from "next/link";

const BOT_HREF = "https://t.me/oneBikePlsBot";

const STEPS = [
  {
    n: "01",
    title: "Выбор",
    desc: "Открой каталог, посмотри характеристики, выбери байк.",
  },
  {
    n: "02",
    title: "Бронь",
    desc: "Telegram-бот. Два клика. Депозит или документы — на выбор.",
  },
  {
    n: "03",
    title: "Выдача",
    desc: "пл. Комсомольская 2. Договор, экипировка, инструкции.",
  },
  {
    n: "04",
    title: "Поездка",
    desc: "Катаешься. Возвращаешь. Получаешь депозит.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how"
      className="py-20 px-4 relative overflow-hidden"
      style={{ backgroundColor: "#0A0A0A" }}
    >
      {/* Neon orange overlay accent */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "rgba(255, 69, 0, 0.05)",
          mixBlendMode: "multiply",
        }}
      />

      <div className="container mx-auto max-w-6xl relative z-10">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2
            className="text-4xl md:text-5xl lg:text-6xl font-black uppercase tracking-tighter mb-4"
            style={{ color: "#E0E0E0" }}
          >
            Как это работает
          </h2>
          <p
            className="text-sm uppercase tracking-widest"
            style={{ color: "#FF4500" }}
          >
            4 шага до поездки
          </p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-0 mb-16">
          {STEPS.map((step, idx) => (
            <div
              key={step.n}
              className="p-8 border-2 relative"
              style={{
                backgroundColor: "#050505",
                borderColor: idx === 0 || idx === 3 ? "#FF4500" : "#111",
              }}
            >
              {/* Step number */}
              <div
                className="text-5xl font-black uppercase tracking-tighter mb-4 leading-none"
                style={{ color: "#FF4500" }}
              >
                {step.n}
              </div>

              {/* Title */}
              <h3
                className="text-xl font-black uppercase tracking-tighter mb-3"
                style={{ color: "#E0E0E0" }}
              >
                {step.title}
              </h3>

              {/* Description */}
              <p className="text-sm" style={{ color: "#666" }}>
                {step.desc}
              </p>

              {/* Connector arrow */}
              {idx < 3 && (
                <div
                  className="hidden lg:block absolute top-1/2 -right-4 transform -translate-y-1/2 z-10"
                  style={{ color: "#FF4500" }}
                >
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link
            href={BOT_HREF}
            className="inline-flex items-center gap-3 px-8 py-4 font-black uppercase tracking-wider text-lg transition-all"
            style={{
              backgroundColor: "#FF4500",
              color: "#050505",
            }}
          >
            Записаться на тест-драйв
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
