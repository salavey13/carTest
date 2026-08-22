"use client";

import Link from "next/link";
import { ChevronRight, MapPin, Phone, Send } from "lucide-react";
import type { FranchizeCrewVM } from "../actions";
import { toInternalHref } from "../lib/navigation";
import { readablePaletteTextOnColor, withAlpha } from "../lib/theme";
import { useFranchizeTheme } from "../hooks/useFranchizeTheme";

interface CrewFooterProps {
  crew: FranchizeCrewVM;
}

export function CrewFooter({ crew }: CrewFooterProps) {
  // Apply franchize theme CSS variables
  useFranchizeTheme(crew.theme);

  const palette = crew.theme.palette;
  const isAuto = crew.theme.isAuto;

  // The footer's main zone is painted on the accent color, so its text must
  // contrast with the accent — not with the base background. In auto mode we
  // resolve against the dark palette so a bright accent (e.g. gold on a dark
  // theme) gets dark text instead of the white text-primary. Same pattern as
  // FranchizePageShell / sales / community — keeps this readable for any dark
  // theme with a light accent, not just vip-bike.
  const accentPalette = isAuto
    ? crew.theme.palettes?.dark || crew.theme.palettes?.light || palette
    : palette;
  const accentText = readablePaletteTextOnColor(accentPalette.accentMain, accentPalette);
  const footerBorder = withAlpha(accentText, 0.22);

  // The copyright strip sits on the base background (not the accent), so it
  // needs the regular primary text rather than the accent-on color.
  const subBg = isAuto ? "var(--franchize-bg-base)" : withAlpha(palette.bgBase, 0.12);
  const subText = isAuto ? "var(--franchize-text-primary)" : accentText;

  // Build columns from hydration data, fall back to header.menuLinks if empty
  const columns = crew.footer.columns.length > 0
    ? crew.footer.columns
    : [
        {
          title: "Меню",
          items: crew.header.menuLinks.map((link) => ({
            type: "link" as const,
            label: link.label,
            href: link.href,
            icon: "",
          })),
        },
      ];

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
        : crew.contacts.telegramBotUsername
          ? [{
              label: "Telegram",
              href: `https://t.me/${crew.contacts.telegramBotUsername}`,
            }]
          : [];

  return (
    <footer
      className="mt-8 overflow-hidden border-t border-[var(--footer-border)]"
      style={{
        background: `linear-gradient(135deg, ${isAuto ? "var(--franchize-accent-main)" : palette.accentMain} 0%, ${isAuto ? "var(--franchize-accent-main)" : (palette.accentDeep || palette.accentMain)} 100%)`,
        color: accentText,
        ["--footer-text" as string]: accentText,
        ["--footer-border" as string]: footerBorder,
        ["--footer-sub-bg" as string]: subBg,
      }}
    >
      <div className="mx-auto grid w-full max-w-7xl gap-x-8 gap-y-6 px-4 py-6 md:grid-cols-3">
        {columns.map((col, ci) => (
          <section key={ci}>
            {col.title && (
              <h3 className="text-xl font-semibold leading-none text-[var(--footer-text)]">
                {col.title}
              </h3>
            )}
            {col.items.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm">
                {col.items.map((item, ii) => {
                  const key = `${ci}-${ii}`;
                  const resolvedHref = item.href
                    ? (item.href.includes("{slug}")
                      ? item.href.replaceAll("{slug}", crew.slug || "")
                      : item.href)
                    : "";

                  switch (item.type) {
                    case "link":
                      return (
                        <li key={key} className="border-b border-[var(--footer-border)]">
                          <Link
                            href={toInternalHref(resolvedHref) ?? resolvedHref}
                            className="flex items-center gap-2 py-2 transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                          >
                            <ChevronRight className="h-4 w-4 shrink-0" />
                            <span>{item.label || item.value}</span>
                          </Link>
                        </li>
                      );

                    case "external":
                      return (
                        <li key={key} className="border-b border-[var(--footer-border)]">
                          <a
                            href={resolvedHref}
                            className="flex items-center gap-2 py-2 transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`${item.label || item.value} (откроется в новой вкладке)`}
                          >
                            <Send className="h-4 w-4 shrink-0" />
                            <span>{item.label || item.value}</span>
                          </a>
                        </li>
                      );

                    case "phone":
                      return (
                        <li key={key} className="border-b border-[var(--footer-border)]">
                          <a
                            href={resolvedHref || `tel:${item.label}`}
                            className="flex items-center gap-2 py-2 transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                          >
                            <Phone className="h-4 w-4 shrink-0" />
                            <span>{item.label}</span>
                          </a>
                        </li>
                      );

                    case "text":
                    default:
                      return (
                        <li key={key} className="flex items-center gap-2 py-2 border-b border-[var(--footer-border)]">
                          {item.icon && <MapPin className="h-4 w-4 shrink-0" />}
                          <span>{item.label || item.value}</span>
                        </li>
                      );
                  }
                })}
              </ul>
            )}
          </section>
        ))}

        {/* Social links section — always shown if available */}
        {socialLinks.length > 0 && (
          <section>
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
                    <Send className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <div
        className="border-t border-[var(--footer-border)] bg-[var(--footer-sub-bg)]"
        style={{ color: subText }}
      >
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
