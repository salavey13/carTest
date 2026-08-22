/**
 * VIP Bike Landing - Footer (Server Component)
 *
 * Contact info and final CTAs
 */

import Link from "next/link";

const OPERATOR_HREF = "https://t.me/I_O_S_NN";
const BOT_HREF = "https://t.me/oneBikePlsBot";

const CONTACT_INFO = {
  phone: "+7 9200-789-888",
  phoneHref: "tel:+79200789888",
  address: "Н. Новгород, пл. Комсомольская 2",
  workingHours: "10:00 — 22:00 (ежедневно)",
};

export function Footer() {
  return (
    <footer
      className="py-16 px-4 border-t"
      style={{
        backgroundColor: "#0A0A0A",
        borderColor: "#2A2A2A",
      }}
    >
      <div className="container mx-auto max-w-6xl">
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {/* Brand */}
          <div>
            <h3
              className="text-2xl font-bold mb-4"
              style={{ color: "#FFD700" }}
            >
              VIP BIKE
            </h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Аренда электробайков и эндуро в Нижнем Новгороде.
              <br />
              Электро без категории А, шлем в комплекте.
            </p>
          </div>

          {/* Contact */}
          <div>
            <h4
              className="text-lg font-bold mb-4"
              style={{ color: "#FFFAF0" }}
            >
              Контакты
            </h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>
                <a
                  href={CONTACT_INFO.phoneHref}
                  className="hover:text-white transition-colors"
                  style={{ color: "#D4AF37" }}
                >
                  {CONTACT_INFO.phone}
                </a>
              </li>
              <li>{CONTACT_INFO.address}</li>
              <li>{CONTACT_INFO.workingHours}</li>
            </ul>
          </div>

          {/* Quick links */}
          <div>
            <h4
              className="text-lg font-bold mb-4"
              style={{ color: "#FFFAF0" }}
            >
              Быстрые ссылки
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/franchize/vip-bike"
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  Каталог байков
                </Link>
              </li>
              <li>
                <Link
                  href="/franchize/vip-bike/configurator"
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  Конфигуратор
                </Link>
              </li>
              <li>
                <Link
                  href="/map"
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  Карта
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t flex flex-col md:flex-row justify-between items-center gap-4" style={{ borderColor: "#1A1A1A" }}>
          <p className="text-sm text-gray-500">
            © 2025 VIP BIKE. Все права защищены.
          </p>
          <div className="flex gap-4">
            <a
              href={BOT_HREF}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm px-4 py-2 rounded-lg transition-all hover:scale-105"
              style={{
                backgroundColor: "rgba(255, 215, 0, 0.1)",
                color: "#FFD700",
                border: "1px solid rgba(255, 215, 0, 0.3)",
              }}
            >
              Telegram Бот
            </a>
            <a
              href={OPERATOR_HREF}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm px-4 py-2 rounded-lg transition-all hover:scale-105"
              style={{
                backgroundColor: "transparent",
                color: "#D4AF37",
                border: "1px solid #2A2A2A",
              }}
            >
              Оператор
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
