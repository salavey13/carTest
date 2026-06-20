/**
 * VIP Bike Electro Landing - FAQ Section
 * Brutalist, high-end fitness studio aesthetic
 */

const FAQ_ITEMS = [
  {
    q: "Do I need motorcycle license?",
    a: "For electric bikes under 4kW — no. Regular B license works. For ICE bikes — A category required. We check.",
  },
  {
    q: "Insurance? Registration?",
    a: "Electric bikes under 4kW don't need registration or insurance. No paperwork. Ride legal.",
  },
  {
    q: "What if I don't have a license?",
    a: "No license — no ride. Safety first. No exceptions.",
  },
  {
    q: "Deposit refund?",
    a: "Same day. Check bike condition, sign off, money back on your card. Usually within an hour.",
  },
  {
    q: "Gear?",
    a: "Helmet and gloves included — free. Jacket/armor/second helmet — ask. Damage = pay per price list.",
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
            Questions. Answers.
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
            Still have questions?{" "}
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
