/**
 * VIP Bike Landing - How It Works (Server Component)
 *
 * Preserved from Max's original design
 */

import Link from "next/link";

const BOT_HREF = "https://t.me/oneBikePlsBot";

const HOW_IT_WORKS_STEPS = [
  {
    n: "01",
    title: "Выбрал",
    desc: "Жмёшь «Выбрать байк» → попадаешь в каталог. Смотришь фото, читаешь спеку, выбираешь по сердцу.",
    emoji: "👆",
  },
  {
    n: "02",
    title: "Забронировал",
    desc: "В боте @oneBikePlsBot — 2 клика: даты + формат поездки. Депозит или СТС — на твой выбор.",
    emoji: "🤖",
  },
  {
    n: "03",
    title: "Пришёл",
    desc: "На пл. Комсомольская 2, в рабочее время (10:00–22:00). Подписал договор — и байк твой.",
    emoji: "🚶",
  },
  {
    n: "04",
    title: "Покатался",
    desc: "Отдал байк, получил залог. Если всё ок —_feedback в чат, следующий раз со скидкой.",
    emoji: "🏍️",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how"
      className="py-20 px-4 relative overflow-hidden"
      style={{ backgroundColor: "#1A1A1A" }}
    >
      <div className="container mx-auto max-w-6xl relative z-10">
        {/* Header */}
        <div className="text-center mb-16">
          <span
            className="inline-block px-4 py-2 rounded-full text-sm font-semibold mb-4"
            style={{
              backgroundColor: "rgba(255, 215, 0, 0.1)",
              color: "#FFD700",
              border: "1px solid #FFD700",
            }}
          >
            Как это работает 🛠️
          </span>
          <h2 className="text-4xl md:text-5xl font-bold mb-4" style={{ color: "#FFFAF0" }}>
            Забери. Покатайся.{" "}
            <span style={{ color: "#FFD700" }}>Верни.</span>
          </h2>
          <p className="text-lg max-w-2xl mx-auto" style={{ color: "#D4AF37" }}>
            От «хочу» до «катюсь» — 15 минут. Без очередей, без бумажной
            волокиты, без звонков «а можно забронировать?».
          </p>
        </div>

        {/* Steps */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
          {/* Connecting line (desktop) */}
          <div
            className="hidden lg:block absolute top-12 left-[12.5%] right-[12.5%] h-0.5 z-0"
            style={{
              background: "linear-gradient(to right, transparent, #FFD700, transparent)",
              opacity: 0.3,
            }}
          />

          {HOW_IT_WORKS_STEPS.map((step) => (
            <div key={step.n} className="relative z-10 text-center">
              <div
                className="relative w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-5 text-4xl transition-transform hover:scale-110"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(255, 215, 0, 0.05))",
                  border: "2px solid rgba(255, 215, 0, 0.4)",
                  backdropFilter: "blur(8px)",
                }}
              >
                <span>{step.emoji}</span>
                <span
                  className="absolute -top-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{
                    backgroundColor: "#FFD700",
                    color: "#0A0A0A",
                  }}
                >
                  {step.n}
                </span>
              </div>
              <h3 className="text-lg font-bold mb-2" style={{ color: "#FFFAF0" }}>
                {step.title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: "#D4AF37" }}>
                {step.desc}
              </p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center mt-14">
          <Link
            href={BOT_HREF}
            className="inline-flex items-center px-8 py-4 rounded-lg font-semibold text-lg transition-all hover:scale-105"
            style={{
              backgroundColor: "#FFD700",
              color: "#0A0A0A",
              boxShadow: "0 0 30px rgba(255, 215, 0, 0.4)",
            }}
          >
            Погнали в бот
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="ml-2"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
