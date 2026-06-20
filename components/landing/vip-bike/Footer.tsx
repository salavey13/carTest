/**
 * VIP Bike Electro Landing - Footer Section
 * Brutalist, high-end fitness studio aesthetic
 */

import Link from "next/link";

const OPERATOR_HREF = "https://t.me/I_O_S_NN";
const BOT_HREF = "https://t.me/oneBikePlsBot";

const CONTACT_INFO = {
  phone: "+7 9200-789-888",
  phoneHref: "tel:+79200789888",
  address: "Nizhny Novgorod, Komsoomolskaya 2",
  hours: "10:00 — 22:00 (Daily)",
};

export function Footer() {
  return (
    <footer
      className="py-16 px-4 border-t-2"
      style={{
        backgroundColor: "#050505",
        borderColor: "#111",
      }}
    >
      <div className="container mx-auto max-w-6xl">
        {/* Top section */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {/* Brand */}
          <div>
            <h3
              className="text-3xl font-black uppercase tracking-tighter mb-4"
              style={{ color: "#E0E0E0" }}
            >
              VIP BIKE
              <br />
              <span style={{ color: "#FF4500" }}>ELECTRO</span>
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: "#666" }}>
              Premium electro bike rental.
              <br />
              No bullshit. Just ride.
            </p>
          </div>

          {/* Contact */}
          <div>
            <h4
              className="text-sm font-black uppercase tracking-widest mb-4"
              style={{ color: "#FF4500" }}
            >
              Contact
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href={CONTACT_INFO.phoneHref}
                  className="hover:text-white transition-colors"
                  style={{ color: "#E0E0E0" }}
                >
                  {CONTACT_INFO.phone}
                </a>
              </li>
              <li style={{ color: "#666" }}>{CONTACT_INFO.address}</li>
              <li style={{ color: "#666" }}>{CONTACT_INFO.hours}</li>
            </ul>
          </div>

          {/* Quick links */}
          <div>
            <h4
              className="text-sm font-black uppercase tracking-widest mb-4"
              style={{ color: "#FF4500" }}
            >
              Navigate
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/franchize/vip-bike"
                  className="hover:text-white transition-colors"
                  style={{ color: "#666" }}
                >
                  FLEET
                </Link>
              </li>
              <li>
                <Link
                  href="/franchize/vip-bike/configurator"
                  className="hover:text-white transition-colors"
                  style={{ color: "#666" }}
                >
                  CONFIGURATOR
                </Link>
              </li>
              <li>
                <Link
                  href="/map"
                  className="hover:text-white transition-colors"
                  style={{ color: "#666" }}
                >
                  MAP
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t-2 flex flex-col md:flex-row justify-between items-center gap-4" style={{ borderColor: "#111" }}>
          <p className="text-sm font-black uppercase tracking-wider" style={{ color: "#333" }}>
            © 2025 VIP BIKE ELECTRO
          </p>
          <div className="flex gap-0">
            <a
              href={BOT_HREF}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 text-sm font-black uppercase tracking-wider transition-all border-2"
              style={{
                backgroundColor: "#FF4500",
                color: "#050505",
                borderColor: "#FF4500",
              }}
            >
              BOT
            </a>
            <a
              href={OPERATOR_HREF}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 text-sm font-black uppercase tracking-wider transition-all border-2"
              style={{
                backgroundColor: "transparent",
                color: "#E0E0E0",
                borderColor: "#111",
              }}
            >
              OPERATOR
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
