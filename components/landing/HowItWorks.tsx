/**
 * VIP Bike Landing - How It Works (Server Component)
 *
 * Preserved from Max's original design
 */

import Link from "next/link";

const BOT_HREF = "https://t.me/oneBikePlsBot";

// Golden SVG icons for each step
const StepIcons = {
  choose: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-12 h-12"
      style={{ color: "#FFD700" }}
    >
      <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
      <path d="M13 13l6 6" />
    </svg>
  ),
  book: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-12 h-12"
      style={{ color: "#FFD700" }}
    >
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M12 18v-6" />
      <path d="M8 15h8" />
    </svg>
  ),
  arrive: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-12 h-12"
      style={{ color: "#FFD700" }}
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  ride: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-12 h-12"
      style={{ color: "#FFD700" }}
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
};

const HOW_IT_WORKS_STEPS = [
  {
    n: "01",
    title: "Выбрал",
    desc: "Жмёшь «Выбрать байк» → попадаешь в каталог. Смотришь фото, читаешь спеку, выбираешь по сердцу.",
    icon: StepIcons.choose,
  },
  {
    n: "02",
    title: "Забронировал",
    desc: "В боте @oneBikePlsBot — 2 клика: даты + формат поездки. Депозит или СТС — на твой выбор.",
    icon: StepIcons.book,
  },
  {
    n: "03",
    title: "Пришёл",
    desc: "На пл. Комсомольская 2, в рабочее время (10:00–22:00). Подписал договор — и байк твой.",
    icon: StepIcons.arrive,
  },
  {
    n: "04",
    title: "Покатался",
    desc: "Отдал байк, получил залог. Если всё ок — feedback в чат, следующий раз со скидкой.",
    icon: StepIcons.ride,
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
        <div className="text-center mb-12 md:mb-16">
          <span
            className="inline-block px-4 py-2 rounded-full text-sm font-bold mb-4 tracking-wide"
            style={{
              backgroundColor: "rgba(255, 215, 0, 0.1)",
              color: "#FFD700",
              border: "1px solid #FFD700",
            }}
          >
            Как это работает
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-black mb-4 tracking-tight leading-tight" style={{ color: "#FFFAF0" }}>
            Забери. Покатайся.{" "}
            <span style={{ color: "#FFD700" }}>Верни.</span>
          </h2>
          <p className="text-base md:text-lg max-w-2xl mx-auto leading-relaxed" style={{ color: "#D4AF37" }}>
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
                className="relative w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-5 text-3xl md:text-4xl transition-transform hover:scale-110"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(255, 215, 0, 0.05))",
                  border: "2px solid rgba(255, 215, 0, 0.4)",
                  backdropFilter: "blur(8px)",
                }}
              >
                {step.icon}
                <span
                  className="absolute -top-2 -right-2 w-6 h-6 md:w-7 md:h-7 rounded-full flex items-center justify-center text-xs md:text-sm font-black"
                  style={{
                    backgroundColor: "#FFD700",
                    color: "#0A0A0A",
                  }}
                >
                  {step.n}
                </span>
              </div>
              <h3 className="text-base md:text-lg font-black mb-2 tracking-tight" style={{ color: "#FFFAF0" }}>
                {step.title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: "#D4AF37" }}>
                {step.desc}
              </p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center mt-12 md:mt-14">
          <Link
            href={BOT_HREF}
            className="inline-flex items-center px-6 md:px-8 py-3 md:py-4 rounded-lg font-bold text-base md:text-lg transition-all hover:scale-105"
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
