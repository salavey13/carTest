/**
 * VIP Bike Electro Landing - FAQ Section
 * Brutalist, high-end fitness studio aesthetic
 */

const FAQ_ITEMS = [
  {
    q: "Нужна ли категория А?",
    a: "Для электробайков до 4 кВт — нет. Обычные права категории B подходят. Для ICE-байков — нужна категория A. Проверяем.",
  },
  {
    q: "ОСАГО? Регистрация?",
    a: "Электробайки до 4 кВт не требуют регистрации и ОСАГО. Никакой бюрократии. Ездишь легально.",
  },
  {
    q: "А если прав вообще нет?",
    a: "Без прав — без поездки. Безопасность превыше всего. Без исключений.",
  },
  {
    q: "Возврат депозита?",
    a: "В тот же день. Проверяем состояние байка, подписываем акты, деньги возвращаются на карту. Обычно в течение часа.",
  },
  {
    q: "Экипировка?",
    a: "Шлем и перчатки — обязательно, бесплатно. Куртка/защита/второй шлем — по запросу. Порча — по прайсу.",
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
            Вопросы
          </h2>
          <p
            className="text-sm uppercase tracking-widest"
            style={{ color: "#FF4500" }}
          >
            Вопросы. Ответы.
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
