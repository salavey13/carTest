"use client";

import Link from "next/link";
import { ChevronRight, MapPin, Phone, Send } from "lucide-react";
import type { FranchizeCrewVM } from "../actions";
import { isExternalHref } from "../lib/navigation";

interface CrewFooterProps {
  crew: FranchizeCrewVM;
}

export function CrewFooter({ crew }: CrewFooterProps) {
  const bg = crew.theme.palette.accentMain;
  const text = crew.footer.textColor || "#16130A";
  const border = "rgba(22, 19, 10, 0.22)";

  const socialLinks =
    crew.footer.socialLinks.length > 0
      ? crew.footer.socialLinks
      : crew.contacts.telegram
        ? [
            {
              label: crew.contacts.telegram,
              href: `https://t.me/${crew.contacts.telegram.replace("@", "")}`,
            },
          ]
        : [{ label: "Telegram", href: "https://t.me/oneBikePlsBot" }];

  return (
    <footer
      className="mt-8 overflow-hidden border-t border-black/10"
      style={{
        background: `linear-gradient(135deg, ${bg} 0%, ${crew.theme.palette.accentDeep || bg} 100%)`,
        color: text,
        ["--footer-text" as string]: text,
        ["--footer-border" as string]: border,
        ["--footer-sub-bg" as string]: "rgba(0, 0, 0, 0.12)",
      }}
    >
      <div className="mx-auto grid w-full max-w-7xl gap-x-8 gap-y-6 px-4 py-6 md:grid-cols-3">
        <section>
          <h3 className="text-xl font-semibold leading-none text-[var(--footer-text)]">
            Контакты
          </h3>
          <ul className="mt-3 space-y-1 text-sm">
            <li className="flex items-center gap-3 border-b border-[var(--footer-border)] py-2">
              <MapPin className="h-4 w-4" />
              <span>{crew.contacts.address || "Адрес скоро добавим"}</span>
            </li>
            <li className="flex items-center gap-3 py-2">
              <Phone className="h-4 w-4" />
              <span>{crew.contacts.phone || "Телефон скоро добавим"}</span>
            </li>
          </ul>
        </section>

        <section>
          <h3 className="text-xl font-semibold leading-none text-[var(--footer-text)]">
            Меню
          </h3>
          <ul className="mt-3 space-y-1 text-sm">
            {crew.header.menuLinks.map((link) => {
              const isExternal = isExternalHref(link.href);
              return (
                <li
                  key={`${link.href}-${link.label}`}
                  className="border-b border-[var(--footer-border)]"
                >
                  {isExternal ? (
                    <a
                      href={link.href}
                      className="flex items-center gap-2 py-2 transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`${link.label} (откроется в новой вкладке)`}
                    >
                      <ChevronRight className="h-4 w-4" />
                      <span>{link.label}</span>
                    </a>
                  ) : (
                    <Link
                      href={link.href}
                      className="flex items-center gap-2 py-2 hover:opacity-90 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      <ChevronRight className="h-4 w-4" />
                      <span>{link.label}</span>
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <section className="">
          <h3 className="text-xl font-semibold leading-none text-[var(--footer-text)]">
            Онлайн-каналы экипажа
          </h3>
          <ul className="mt-3 grid gap-1 text-sm">
            {socialLinks.map((item) => (
              <li
                key={`${item.label}-${item.href}`}
                className="border-b border-[var(--footer-border)]"
              >
                <a
                  href={item.href}
                  className="flex items-center gap-2 py-2 transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${item.label} (откроется в новой вкладке)`}
                >
                  <Send className="h-4 w-4" />
                  <span>{item.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="border-t border-[var(--footer-border)] bg-[var(--footer-sub-bg)]">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-2 text-xs">
          <span>
            {new Date().getFullYear()} © {crew.header.brandName}
          </span>
          <span>Версия: FR-PEP-02</span>
        </div>
      </div>
    </footer>
  );
}
