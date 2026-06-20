/**
 * VIP Bike Electro Landing - Social Banner
 * Brutalist, high-end fitness studio aesthetic
 */

const SOCIAL_LINKS = [
  {
    id: "vk",
    label: "VK",
    href: "https://vk.com/vip_bike",
    description: "Паблик",
  },
  {
    id: "instagram",
    label: "INSTAGRAM",
    href: "https://www.instagram.com/vipbikerental_nn",
    description: "@VIPBIKERENTAL_NN",
  },
  {
    id: "telegram-bot",
    label: "БОТ",
    href: "https://t.me/oneBikePlsBot",
    description: "Мгновенная бронь",
  },
  {
    id: "telegram-contact",
    label: "ОПЕРАТОР",
    href: "https://t.me/I_O_S_NN",
    description: "@I_O_S_NN",
  },
];

// Brutalist icons
const ICONS: Record<string, JSX.Element> = {
  vk: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
      <path d="M15.684 0H8.316C1.592 0 0 1.592 0 8.316v7.368C0 22.408 1.592 24 8.316 24h7.368C22.408 24 24 22.408 24 15.684V8.316C24 1.592 22.391 0 15.684 0zm3.692 17.123h-1.744c-.66 0-.864-.525-2.05-1.727-1.033-1-1.49-1.135-1.744-1.135-.356 0-.458.102-.458.593v1.575c0 .424-.135.678-1.253.678-1.846 0-3.896-1.12-5.335-3.202C4.624 10.857 4.03 8.57 4.03 8.096c0-.254.102-.491.593-.491h1.744c.44 0,.61.203.78.678.847 2.49 2.27 4.675 2.85 4.675.22 0,.322-.102.322-.66V9.721c-.068-1.186-.695-1.287-.695-1.71 0-.204.17-.407.44-.407h2.744c.373 0,.508.203.508.644v3.49c0 .373.17.508.271.508.22 0,.407-.135.813-.542 1.254-1.406 2.152-3.574 2.152-3.574.119-.254.322-.491.763-.491h1.744c.525 0,.644.27.525.644-.22 1.017-2.354 4.031-2.354 4.031-.186.305-.254.44 0 .78.186.254.796.78 1.203 1.253.746.847 1.32 1.558 1.473 2.05.17.49-.085.744-.576.744z" />
    </svg>
  ),
  instagram: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  ),
  "telegram-bot": (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
      <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  ),
  "telegram-contact": (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
      <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  ),
};

export function SocialBanner() {
  return (
    <section
      className="py-16 px-4 relative overflow-hidden"
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
        <div className="text-center mb-10">
          <h2
            className="text-4xl md:text-5xl font-black uppercase tracking-tighter mb-3"
            style={{ color: "#E0E0E0" }}
          >
            Связь
          </h2>
          <p className="text-sm uppercase tracking-widest" style={{ color: "#FF4500" }}>
            Присоединяйся к сообществу
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-0">
          {SOCIAL_LINKS.map((link) => (
            <a
              key={link.id}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col items-center justify-center p-8 border-2 transition-all"
              style={{
                backgroundColor: "#0A0A0A",
                borderColor: "#111",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#FF4500";
                e.currentTarget.style.borderColor = "#FF4500";
                const label = e.currentTarget.querySelector("label");
                if (label) label.style.color = "#050505";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#0A0A0A";
                e.currentTarget.style.borderColor = "#111";
                const label = e.currentTarget.querySelector("label");
                if (label) label.style.color = "#FF4500";
              }}
            >
              <div className="mb-4 transition-transform group-hover:scale-110" style={{ color: "#FF4500" }}>
                {ICONS[link.id]}
              </div>
              <label
                className="text-xs font-black uppercase tracking-widest mb-2 transition-colors"
                style={{ color: "#FF4500" }}
              >
                {link.label}
              </label>
              <span
                className="text-xs uppercase tracking-wider"
                style={{ color: "#E0E0E0" }}
              >
                {link.description}
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
