/**
 * VIP Bike Electro Landing - FAQ Section
 * Brutalist, high-end fitness studio aesthetic
 */

const FAQ_ITEMS = [
  {
    q: "Нужна ли категория А?",
    a: "Зависит от байка. Электробайки до 4 кВт — права категории B. Более мощные электро и остальные мотоциклы — категория A. Уточняй при бронировании.",
  },
  {
    q: "Нужно ли ОСАГО?",
    a: "Электробайки до 4 кВт не требуют регистрации и ОСАГО. Для остальных — стандартные требования.",
  },
  {
    q: "А если прав вообще нет?",
    a: "Без прав — без поездки. Проверяем права строго при выдаче.",
  },
  {
    q: "Возврат депозита?",
    a: "В день возврата. Проверяем состояние байка, подписываем акт — деньги у тебя в течение часа.",
  },
  {
    q: "Что с экипировкой?",
    a: "Шлем и перчатки — бесплатно. Куртка, защита, второй шлем — по запросу. За порчу — по прайсу.",
  },
];

export function FAQ() {
  return (
    <section
      id="faq"
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

      <div className="container mx-auto max-w-4xl relative z-10">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2
            className="text-4xl md:text-5xl lg:text-6xl font-black uppercase tracking-tighter mb-4"
            style={{ color: "#E0E0E0" }}
          >
            FAQ
          </h2>
          <p
            className="text-sm uppercase tracking-widest"
            style={{ color: "#FF4500" }}
          >
            Частые вопросы
          </p>
        </div>

        {/* FAQ items */}
        <div className="space-y-0">
          {FAQ_ITEMS.map((item, idx) => (
            <div
              key={idx}
              className="p-8 border-2"
              style={{
                backgroundColor: "#0A0A0A",
                borderColor: "#111",
              }}
            >
              <h3
                className="text-lg font-black uppercase tracking-tighter mb-3"
                style={{ color: "#FF4500" }}
              >
                {item.q}
              </h3>
              <p className="text-base" style={{ color: "#E0E0E0" }}>
                {item.a}
              </p>
            </div>
          ))}
        </div>

        {/* Contact */}
        <div className="text-center mt-12">
          <p className="text-sm" style={{ color: "#666" }}>
            Остались вопросы?{" "}
            <a
              href="https://t.me/I_O_S_NN"
              target="_blank"
              rel="noopener noreferrer"
              className="font-black uppercase tracking-wider underline"
              style={{ color: "#FF4500" }}
            >
              @I_O_S_NN
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
