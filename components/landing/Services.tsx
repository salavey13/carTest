/**
 * VIP Bike Landing - Services Section (Server Component)
 *
 * Shows: rents, sale, configurator, map
 * CSS-only hover effects, no JavaScript event handlers
 */

import Link from "next/link";

const CATALOG_HREF = "/franchize/vip-bike";
const CONFIGURATOR_HREF = "/franchize/vip-bike/configurator";
const MAP_HREF = "/map";

// Golden SVG icons matching the site's aesthetic
const GoldenIcons = {
  rent: (
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
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-12 h-12"
      style={{ color: "#FFD700" }}
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
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-12 h-12"
      style={{ color: "#FFD700" }}
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
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-12 h-12"
      style={{ color: "#FFD700" }}
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
    title: "Аренда",
    description: "Арендуйте электробайки и эндуро для тест-драйва или прогулки",
    icon: GoldenIcons.rent,
    href: CATALOG_HREF,
  },
  {
    id: "sale",
    title: "Покупка",
    description: "Купите байк в собственность с гарантией от производителя",
    icon: GoldenIcons.sale,
    href: `${CATALOG_HREF}?sale=true`,
  },
  {
    id: "configurator",
    title: "Конфигуратор",
    description: "Соберите свой кастомный байк с нужными характеристиками",
    icon: GoldenIcons.configurator,
    href: CONFIGURATOR_HREF,
  },
  {
    id: "map",
    title: "Карта",
    description: "Смотрите доступные байки на карте в реальном времени",
    icon: GoldenIcons.map,
    href: MAP_HREF,
  },
];

export function Services() {
  return (
    <section
      className="py-20 px-4"
      style={{ backgroundColor: "#0A0A0A" }}
    >
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <h2
            className="text-4xl md:text-5xl font-bold mb-4"
            style={{ color: "#FFD700" }}
          >
            Что мы предлагаем
          </h2>
          <p className="text-gray-400 text-lg">
            Выберите подходящий формат взаимодействия
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {SERVICES.map((service) => (
            <Link key={service.id} href={service.href}>
              <article
                className="group h-full p-6 rounded-xl transition-all hover:scale-105"
                style={{
                  backgroundColor: "#1A1A1A",
                  border: "2px solid #2A2A2A",
                }}
              >
                <div className="mb-4 transition-transform group-hover:scale-110 flex justify-center">
                  {service.icon}
                </div>
                <h3
                  className="text-xl font-bold mb-3"
                  style={{ color: "#FFFAF0" }}
                >
                  {service.title}
                </h3>
                <p className="text-gray-400 text-sm">{service.description}</p>
              </article>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
