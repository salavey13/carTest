import { ChevronRight, MapPin, Phone, Send } from "lucide-react";
import type { FranchizeCrewVM } from "../actions";
import { isExternalHref } from "../lib/navigation";

interface CrewFooterProps {
  crew: FranchizeCrewVM;
}

export function CrewFooter({ crew }: CrewFooterProps) {
  const bg = crew.theme.palette.accentMain;
  const text = crew.footer.textColor || "#16130A";
  const border = "#b78609";
  const socialLinks = crew.footer.socialLinks.length > 0
    ? crew.footer.socialLinks
    : crew.contacts.telegram
      ? [{ label: crew.contacts.telegram, href: `https://t.me/${crew.contacts.telegram.replace("@", "")}` }]
      : [{ label: "Telegram", href: "https://t.me/oneBikePlsBot" }];

  return (
    <footer className="mt-12" style={{ backgroundColor: bg, color: text }}>
      <div className="mx-auto grid w-full max-w-4xl gap-x-8 gap-y-10 px-4 py-8 md:grid-cols-2">
        <section>
          <h3 className="text-3xl font-semibold leading-none" style={{ color: text }}>Контакты</h3>
          <ul className="mt-5 space-y-1 text-base">
            <li className="flex items-center gap-3 border-b py-3" style={{ borderColor: border }}>
              <MapPin className="h-4 w-4" />
              <span>{crew.contacts.address || "Адрес скоро добавим"}</span>
            </li>
            <li className="flex items-center gap-3 py-3">
              <Phone className="h-4 w-4" />
              <span>{crew.contacts.phone || "Телефон скоро добавим"}</span>
            </li>
          </ul>
        </section>

        <section>
          <h3 className="text-3xl font-semibold leading-none" style={{ color: text }}>Меню</h3>
          <ul className="mt-5 space-y-1 text-base">
            {crew.header.menuLinks.map((link) => (
              <li key={`${link.href}-${link.label}`} className="border-b" style={{ borderColor: border }}>
                {isExternalHref(link.href) ? (
                  <a href={link.href} className="flex items-center gap-2 py-3" target="_blank" rel="noreferrer">
                    <ChevronRight className="h-4 w-4" />
                    <span>{link.label}</span>
                  </a>
                ) : (
                  <a href={link.href} className="flex items-center gap-2 py-3">
                    <ChevronRight className="h-4 w-4" />
                    <span>{link.label}</span>
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="md:col-span-2">
          <h3 className="text-3xl font-semibold leading-none" style={{ color: text }}>Онлайн-каналы экипажа</h3>
          <ul className="mt-5 grid gap-1 text-base md:grid-cols-2">
            {socialLinks.map((item) => (
              <li key={`${item.label}-${item.href}`} className="border-b" style={{ borderColor: border }}>
                <a href={item.href} className="flex items-center gap-2 py-3" target="_blank" rel="noreferrer">
                  <Send className="h-4 w-4" />
                  <span>{item.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="border-t" style={{ borderColor: border, backgroundColor: "#cd940d" }}>
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 py-3 text-xs">
          <span>{new Date().getFullYear()} © {crew.header.brandName}</span>
          <span>Версия: FR-PEP-02</span>
        </div>
      </div>
    </footer>
  );
}
