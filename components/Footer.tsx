"use client";

import { motion } from "framer-motion";
import { Gift, Heart, ExternalLink, Code, Sparkles, ShieldQuestion, FileText, Bolt, BrainCircuit, Network } from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FaGithub, FaTelegram } from "react-icons/fa6";

export default function Footer() {
  const { tg, isInTelegramContext } = useAppContext();
  const pathname = usePathname();

  const handleShare = () => {
    const shareUrl =
      "https://t.me/share/url?url=" +
      encodeURIComponent("https://t.me/oneSitePlsBot/app") +
      "&text=" +
      encodeURIComponent("Зацени oneSitePls — твой ИИ-дев ассистент в Телеграме!");

    if (isInTelegramContext && tg) {
      tg.openLink(shareUrl);
      return;
    }

    window.open(shareUrl, "_blank");
  };

  if (pathname?.startsWith("/franchize")) {
    return (
      <footer className="border-t border-border bg-background/90 py-2">
        <div className="mx-auto flex max-w-7xl items-center justify-center px-4 text-center text-[11px] text-muted-foreground">
          oneSitePls :: Nexus-ready operator stack ::{" "}
          <Link href="/nexus" className="ml-1 underline-offset-2 hover:underline">
            /nexus
          </Link>
        </div>
      </footer>
    );
  }

  const subtleLinkClass =
    "inline-flex items-center gap-1.5 text-sm text-slate-700 transition hover:text-indigo-700 dark:text-slate-300 dark:hover:text-indigo-300";

  return (
    <footer className="border-t border-slate-200 bg-slate-50 py-10 dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-2 text-base font-semibold text-slate-900 dark:text-slate-100">oneSitePls</h3>
            <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              Твоя ИИ-дев студия и самоулучшаемая платформа. Создавай, обновляй и управляй кодом прямо из Телеграма.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-3 text-base font-semibold text-slate-900 dark:text-slate-100">Ключевые модули</h3>
            <ul className="space-y-2.5">
              <li>
                <Link
                  href="/repo-xml"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-violet-300 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-900 transition hover:bg-violet-100 dark:border-violet-500/40 dark:bg-violet-500/10 dark:text-violet-200 dark:hover:bg-violet-500/20"
                >
                  <Sparkles className="h-4 w-4" /> Супервайб Студия
                </Link>
              </li>
              <li>
                <Link
                  href="/nexus"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-100 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200 dark:hover:bg-emerald-500/20"
                >
                  <Network className="h-4 w-4" /> Нексус Хаб
                </Link>
              </li>
              <li>
                <Link href="/selfdev/gamified" className={subtleLinkClass}>
                  <Sparkles className="h-3.5 w-3.5 text-fuchsia-500" /> КиберДев ОС
                </Link>
              </li>
              <li>
                <Link href="/p-plan" className={subtleLinkClass}>
                  <Code className="h-3.5 w-3.5 text-amber-500" /> Вайб-план
                </Link>
              </li>
              <li>
                <Link href="/cybervibe" className={subtleLinkClass}>
                  <Bolt className="h-3.5 w-3.5 text-amber-500" /> КиберВайб апгрейд
                </Link>
              </li>
              <li>
                <Link href="/veritasium" className={subtleLinkClass}>
                  <BrainCircuit className="h-3.5 w-3.5 text-cyan-500" /> Озарения Veritasium
                </Link>
              </li>
            </ul>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-3 text-base font-semibold text-slate-900 dark:text-slate-100">Ресурсы</h3>
            <ul className="space-y-2.5">
              <li>
                <Link href="/about" className={subtleLinkClass}>
                  <ExternalLink className="h-3.5 w-3.5" /> О проекте
                </Link>
              </li>
              <li>
                <a href="https://t.me/oneSitePlsBot" target="_blank" rel="noopener noreferrer" className={subtleLinkClass}>
                  <FaTelegram className="h-3.5 w-3.5" /> Телеграм-бот
                </a>
              </li>
              <li>
                <a href="https://github.com/salavey13/carTest" target="_blank" rel="noopener noreferrer" className={subtleLinkClass}>
                  <FaGithub className="h-3.5 w-3.5" /> ГитХаб-репо
                </a>
              </li>
              <li>
                <Link href="/donate" className={subtleLinkClass}>
                  <Heart className="h-3.5 w-3.5 text-rose-500" /> Поддержать вайб
                </Link>
              </li>
            </ul>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-3 text-base font-semibold text-slate-900 dark:text-slate-100">Связь</h3>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleShare}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 p-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
            >
              {isInTelegramContext ? (
                <>
                  <Gift className="h-4 w-4" />
                  <span>Поделиться oneSitePls</span>
                </>
              ) : (
                <>
                  <FaTelegram className="h-4 w-4" />
                  <span>Открыть в Телеграме</span>
                </>
              )}
            </motion.button>
            <p className="mt-3 text-center text-xs text-slate-600 dark:text-slate-400">Отправь ссылку другу или открой бота для старта.</p>
          </section>
        </div>

        <div className="mt-8 border-t border-slate-200 pt-5 dark:border-slate-800">
          <div className="flex flex-col items-center justify-between gap-3 text-center text-xs text-slate-600 dark:text-slate-400 md:flex-row">
            <p>
              © {new Date().getFullYear()} oneSitePls <span className="mx-1">•</span> Powered by CyberVibe <span className="mx-1">•</span> @SALAVEY13
            </p>
            <div className="flex items-center gap-4">
              <Link href="/privacy-policy" className={subtleLinkClass}>
                <ShieldQuestion className="h-3 w-3" /> Конфиденциальность
              </Link>
              <Link
                href="https://github.com/salavey13/carTest/blob/main/LICENSE"
                target="_blank"
                rel="noopener noreferrer"
                className={subtleLinkClass}
              >
                <FileText className="h-3 w-3" /> MIT License
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
