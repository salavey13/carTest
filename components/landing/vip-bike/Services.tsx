/**
 * VIP Bike Electro Landing - Services Section
 * Brutalist, high-end fitness studio aesthetic
 */

import Link from "next/link";

const CATALOG_HREF = "/franchize/vip-bike";
const CONFIGURATOR_HREF = "/franchize/vip-bike/configurator";
const MAP_HREF = "/map";

// Brutalist icons
const BrutalistIcons = {
  rent: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      strokeLinejoin="miter"
      className="w-8 h-8"
      style={{ color: "#FF4500" }}
    >
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  ),
  sale: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      strokeLinejoin="miter"
      className="w-8 h-8"
      style={{ color: "#FF4500" }}
    >
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  ),
  configurator: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      strokeLinejoin="miter"
      className="w-8 h-8"
      style={{ color: "#FF4500" }}
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  map: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      strokeLinejoin="miter"
      className="w-8 h-8"
      style={{ color: "#FF4500" }}
    >
      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
      <line x1="9" x2="9" y1="3" y2="18" />
      <line x1="15" x2="15" y1="6" y2="21" />
    </svg>
  ),
};

const SERVICES = [
  {
    id: "rent",
    title: "RENT",
    description: "Hourly and daily rates. No commitment. Pure riding.",
    icon: BrutalistIcons.rent,
    href: CATALOG_HREF,
  },
  {
    id: "sale",
    title: "BUY",
    description: "Own the machine. Full warranty. Direct from source.",
    icon: BrutalistIcons.sale,
    href: `${CATALOG_HREF}?sale=true`,
  },
  {
    id: "configurator",
    title: "BUILD",
    description: "Custom specs. Your build. Your way.",
    icon: BrutalistIcons.configurator,
    href: CONFIGURATOR_HREF,
  },
  {
    id: "map",
    title: "LOCATE",
    description: "Real-time fleet tracking. Find what's available now.",
    icon: BrutalistIcons.map,
    href: MAP_HREF,
  },
];

export function Services() {
  return (
    <section
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
            Services
          </h2>
          <p
            className="text-sm uppercase tracking-widest"
            style={{ color: "#FF4500" }}
          >
            How we can serve you
          </p>
        </div>

        {/* Services grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-0">
          {SERVICES.map((service, idx) => (
            <Link key={service.id} href={service.href}>
              <div
                className="h-full p-8 border-2 transition-all"
                style={{
                  backgroundColor: "#050505",
                  borderColor: "#111",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#FF4500";
                  e.currentTarget.style.borderColor = "#FF4500";
                  const title = e.currentTarget.querySelector("h3");
                  if (title) title.style.color = "#050505";
                  const desc = e.currentTarget.querySelector("p");
                  if (desc) desc.style.color = "#050505";
                  const icon = e.currentTarget.querySelector("svg");
                  if (icon) icon.style.color = "#050505";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#050505";
                  e.currentTarget.style.borderColor = "#111";
                  const title = e.currentTarget.querySelector("h3");
                  if (title) title.style.color = "#E0E0E0";
                  const desc = e.currentTarget.querySelector("p");
                  if (desc) desc.style.color = "#666";
                  const icon = e.currentTarget.querySelector("svg");
                  if (icon) icon.style.color = "#FF4500";
                }}
              >
                {/* Icon */}
                <div className="mb-6">{service.icon}</div>

                {/* Title */}
                <h3
                  className="text-xl font-black uppercase tracking-tighter mb-3 transition-colors"
                  style={{ color: "#E0E0E0" }}
                >
                  {service.title}
                </h3>

                {/* Description */}
                <p
                  className="text-sm transition-colors"
                  style={{ color: "#666" }}
                >
                  {service.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
