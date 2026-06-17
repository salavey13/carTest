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

const SERVICES = [
  {
    id: "rent",
    title: "Аренда",
    description: "Арендуйте электробайки и эндуро для тест-драйва или прогулки",
    icon: "🏍️",
    href: CATALOG_HREF,
  },
  {
    id: "sale",
    title: "Покупка",
    description: "Купите байк в собственность с гарантией от производителя",
    icon: "🔑",
    href: `${CATALOG_HREF}?sale=true`,
  },
  {
    id: "configurator",
    title: "Конфигуратор",
    description: "Соберите свой кастомный байк с нужными характеристиками",
    icon: "⚙️",
    href: CONFIGURATOR_HREF,
  },
  {
    id: "map",
    title: "Карта",
    description: "Смотрите доступные байки на карте в реальном времени",
    icon: "🗺️",
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
                <div className="text-4xl mb-4 transition-transform group-hover:scale-110">
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
