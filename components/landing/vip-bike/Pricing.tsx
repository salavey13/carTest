/**
 * VIP Bike Electro Landing - Pricing Section
 * Brutalist, high-end fitness studio aesthetic
 */

const PRICING_TIERS = [
  {
    id: "hourly",
    title: "ПОЧАСОВОЙ",
    subtitle: "Минимум 3 часа",
    examples: [
      { bike: "Falcon GT 2025", price: "10 000 ₽ / 3 часа" },
      { bike: "Y-Volt Surge V", price: "10 000 ₽ / 3 часа" },
    ],
    minDuration: "от 3 часов",
  },
  {
    id: "daily",
    title: "ПОСУТОЧНЫЙ",
    subtitle: "Будни и выходные",
    examples: [
      { bike: "Kawasaki Ninja 650", price: "16 000 ₽ / сутки" },
      { bike: "Suzuki GSX-S1000F", price: "14 000 ₽ / сутки" },
      { bike: "Falcon Pro", price: "10 000 ₽ / сутки" },
      { bike: "Nibbler 300", price: "6 000 ₽ / сутки" },
    ],
    note: "Выходные +20-40%",
  },
  {
    id: "weekly",
    title: "ПОНЕДЕЛЬНЫЙ",
    subtitle: "Скидки от 2 до 10 дней",
    examples: [
      { period: "2–4 дня", discount: "от 10% скидки" },
      { period: "5–10 дней", discount: "до 30% скидки" },
    ],
    popular: true,
  },
  {
    id: "monthly",
    title: "ПОМЕСЯЧНЫЙ",
    subtitle: "От 11 дней до месяца",
    examples: [
      { period: "11–30 дней", discount: "до 50% скидки" },
    ],
  },
];

export function Pricing() {
  return (
    <section
      className="py-20 px-4 relative overflow-hidden"
      style={{ backgroundColor: "#050505" }}
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
          <span className="text-[#FF4500] text-sm font-black uppercase tracking-widest">Цены</span>
          <h2
            className="text-4xl md:text-5xl lg:text-6xl font-black uppercase tracking-tighter mt-2 mb-4"
            style={{ color: "#E0E0E0" }}
          >
            Тарифы
          </h2>
          <p
            className="text-sm uppercase tracking-widest max-w-2xl mx-auto"
            style={{ color: "#FF4500" }}
          >
            Гибкие условия — от 3 часов до месяца
          </p>
        </div>

        {/* Pricing grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-0">
          {PRICING_TIERS.map((tier, idx) => (
            <div
              key={tier.id}
              className="p-8 border-2 relative"
              style={{
                backgroundColor: "#0A0A0A",
                borderColor: tier.popular ? "#FF4500" : "#111",
              }}
            >
              {tier.popular && (
                <div
                  className="absolute top-0 right-0 px-3 py-1 text-xs font-black uppercase"
                  style={{ backgroundColor: "#FF4500", color: "#050505" }}
                >
                  Популярный
                </div>
              )}

              {/* Title */}
              <h3
                className="text-2xl font-black uppercase tracking-tighter mb-1"
                style={{ color: "#E0E0E0" }}
              >
                {tier.title}
              </h3>
              <p
                className="text-xs uppercase tracking-widest mb-6"
                style={{ color: "#FF4500" }}
              >
                {tier.subtitle}
              </p>

              {/* Examples */}
              <div className="space-y-3 mb-6">
                {tier.examples.map((example, i) => (
                  <div
                    key={i}
                    className="flex justify-between items-center text-xs pb-2"
                    style={{ borderBottom: "1px solid #222" }}
                  >
                    <span style={{ color: "#999" }}>
                      {example.bike || example.period}
                    </span>
                    <span
                      className="font-black uppercase"
                      style={{ color: "#FF4500" }}
                    >
                      {example.price || example.discount}
                    </span>
                  </div>
                ))}
              </div>

              {/* Note */}
              {tier.note && (
                <p className="text-xs" style={{ color: "#666" }}>
                  {tier.note}
                </p>
              )}
              {tier.minDuration && (
                <p className="text-xs mt-auto pt-4" style={{ color: "#666" }}>
                  {tier.minDuration}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center mt-12">
          <a
            href="https://t.me/oneBikePlsBot"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-8 py-4 font-black uppercase tracking-wider text-lg transition-all"
            style={{
              backgroundColor: "#FF4500",
              color: "#050505",
            }}
          >
            Рассчитать стоимость
          </a>
        </div>
      </div>
    </section>
  );
}
