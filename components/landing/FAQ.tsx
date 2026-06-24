/**
 * VIP Bike Landing - FAQ (Server Component)
 *
 * Preserved from Max's original design - static list (no accordion)
 */

const FAQ_ITEMS = [
  {
    q: "Так, мне правда не нужна категория А? 🤨",
    a: "Правда. Наши электромотоциклы до 4 кВт — это L1e-B, по закону категория B (или M, если есть). Права обычные, без мотоциклетной категории. Покажешь — садишься.",
  },
  {
    q: "А ОСАГО и ПТС точно не нужны?",
    a: "Точно. Электро до 4 кВт не регистрируется в ГИБДД, ПТС нет, ОСАГО нет. Никакой бюрократии. Сел — поехал.",
  },
  {
    q: "А если без прав категории B? 🙃",
    a: "Без прав — никак. Для ICE-байков нужна категория А. Для электробайков до 4 кВт — B. Права проверяем при выдаче.",
  },
  {
    q: "Залог возвращается?",
    a: "Да. В день возврата байка проверяем состояние, и если всё ок — залог возвращается на той же карте. Обычно в течение часа.",
  },
  {
    q: "А экипировка? 🪖",
    a: "Шлем и перчатки — обязательно, выдаём бесплатно. Куртка/черепаха/второй шлем — по запросу. За утрату или порчу экипировки — по прайсу из приложения №3 к договору.",
  },
];

export function FAQ() {
  return (
    <section id="faq" className="py-20 px-4" style={{ backgroundColor: "#0A0A0A" }}>
      <div className="container mx-auto max-w-4xl">
        {/* Header */}
        <div className="text-center mb-10 md:mb-12">
          <span
            className="inline-block px-4 py-2 rounded-full text-sm font-bold mb-4 tracking-wide"
            style={{
              backgroundColor: "rgba(255, 215, 0, 0.1)",
              color: "#FFD700",
              border: "1px solid #FFD700",
            }}
          >
            Частые вопросы ❓
          </span>
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-black mb-4 tracking-tight" style={{ color: "#FFFAF0" }}>
            Вопросы — ответы
          </h2>
          <p className="text-gray-400 text-sm md:text-base max-w-xl mx-auto leading-relaxed">
            Всё, что ты хотел спросить, но стеснялся
          </p>
        </div>

        {/* FAQ items */}
        <div className="space-y-3 md:space-y-4">
          {FAQ_ITEMS.map((item, idx) => (
            <div
              key={idx}
              className="p-5 md:p-6 rounded-xl"
              style={{
                backgroundColor: "#1A1A1A",
                border: "1px solid #2A2A2A",
              }}
            >
              <h3
                className="text-base md:text-lg font-black mb-2 md:mb-3 tracking-tight leading-tight"
                style={{ color: "#FFD700" }}
              >
                {item.q}
              </h3>
              <p className="text-gray-300 text-sm md:text-base leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>

        {/* Contact */}
        <div className="text-center mt-6 md:mt-8">
          <p className="text-xs md:text-sm leading-relaxed" style={{ color: "#D4AF37" }}>
            💡 Остались вопросы? Напиши оператору{" "}
            <a
              href="https://t.me/I_O_S_NN"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-black"
              style={{ color: "#FFD700" }}
            >
              @I_O_S_NN
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
