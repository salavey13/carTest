"use client";

import Link from "next/link";
import { ChevronRight, MapPin, Phone, Send } from "lucide-react";
import { useAppContext } from "@/contexts/AppContext"; // ← NEW
import type { FranchizeCrewVM } from "../actions";
import { isExternalHref } from "../lib/navigation";

interface CrewFooterProps {
  crew: FranchizeCrewVM;
}

export function CrewFooter({ crew }: CrewFooterProps) {
  const { openLink } = useAppContext(); // ← SAFE TELEGRAM NAVIGATION
  const bg = crew.theme.palette.accentMain;
  const text = crew.footer.textColor || "#16130A";
  const border = "#b78609";

  const socialLinks = crew.footer.socialLinks.length > 0
    ? crew.footer.socialLinks
    : crew.contacts.telegram
      ? [{ label: crew.contacts.telegram, href: `https://t.me/${crew.contacts.telegram.replace("@", "")}` }]
      : [{ label: "Telegram", href: "https://t.me/oneBikePlsBot" }];

  const handleInternalLink = (href: string) => {
    openLink(href); // ← THIS IS THE FIX
  };

  return (
    <footer
      className="mt-12"
      style={{
        backgroundColor: bg,
        color: text,
        ["--footer-text" as string]: text,
        ["--footer-border" as string]: border,
        ["--footer-sub-bg" as string]: "#cd940d",
      }}
    >
      <div className="mx-auto grid w-full max-w-4xl gap-x-8 gap-y-10 px-4 py-8 md:grid-cols-2">
        <section>
          <h3 className="text-3xl font-semibold leading-none text-[var(--footer-text)]">Контакты</h3>
          <ul className="mt-5 space-y-1 text-base">
            <li className="flex items-center gap-3 border-b border-[var(--footer-border)] py-3">
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
          <h3 className="text-3xl font-semibold leading-none text-[var(--footer-text)]">Меню</h3>
          <ul className="mt-5 space-y-1 text-base">
            {crew.header.menuLinks.map((link) => {
              const isExternal = isExternalHref(link.href);
              return (
                <li key={`${link.href}-${link.label}`} className="border-b border-[var(--footer-border)]">
                  {isExternal ? (
                    <a href={link.href} className="flex items-center gap-2 py-3" target="_blank" rel="noreferrer">
                      <ChevronRight className="h-4 w-4" />
                      <span>{link.label}</span>
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleInternalLink(link.href)}
                      className="flex w-full items-center gap-2 py-3 text-left hover:opacity-90 transition"
                    >
                      <ChevronRight className="h-4 w-4" />
                      <span>{link.label}</span>
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <section className="md:col-span-2">
          <h3 className="text-3xl font-semibold leading-none text-[var(--footer-text)]">Онлайн-каналы экипажа</h3>
          <ul className="mt-5 grid gap-1 text-base md:grid-cols-2">
            {socialLinks.map((item) => (
              <li key={`${item.label}-${item.href}`} className="border-b border-[var(--footer-border)]">
                <a href={item.href} className="flex items-center gap-2 py-3" target="_blank" rel="noreferrer">
                  <Send className="h-4 w-4" />
                  <span>{item.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="border-t border-[var(--footer-border)] bg-[var(--footer-sub-bg)]">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 py-3 text-xs">
          <span>{new Date().getFullYear()} © {crew.header.brandName}</span>
          <span>Версия: FR-PEP-02</span>
        </div>
      </div>
    </footer>
  );
}