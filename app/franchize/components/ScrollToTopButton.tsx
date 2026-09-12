"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowUp } from "lucide-react";

/**
 * ScrollToTopButton — «пролистать вверх», как у главного каталога.
 *
 * Босс: на главном каталоге есть кнопка для пролистывания вверх
 * (стрелка в плавающей панели корзины, FloatingCartIconLink) — сделать
 * такую же на всех страницах, где нужно много листать, НЕ мешая другим
 * плавающим кнопкам.
 *
 * КАК РАБОТАЕТ:
 *  • Монтируется один раз в app/franchize/[slug]/layout.tsx — видна на всех
 *    страницах экипажа (лиды, туду, аренды, аналитика, запчасти, комьюнити…).
 *  • Появляется, когда страница реально прокручена: window.scrollY > 400
 *    ИЛИ внутренний скролл-контейнер (список лидов #leads-list-scroll,
 *    у листа свой overflow-y-auto, окно при этом не скроллится) > 400.
 *    Наверху страницы кнопка скрыта — не занимает экран зря.
 *  • Клик — плавный скролл наверх и окна, и внутренних контейнеров.
 *  • СТРАНИЦА «КЛИЕНТЫ И ЗАЯВКИ» (/franchize/[slug]/leads) — исключение
 *    (просьба босса: «кнопку прокрутки вверх сделай только для списка
 *    клиентов»): кнопка привязана ТОЛЬКО к списку лидов #leads-list-scroll.
 *    Скролл самой страницы (KPI-плиты, плейбук, аналитика) стрелку НЕ
 *    включает, и клик не уносит к плиткам — список честно возвращается
 *    к своему началу (тулбар с фильтрами), остальная страница стоит на месте.
 *  • Клик по стрелке на КАТАЛОГЕ не дублируется: маршруты каталога
 *    (где стрелка уже живёт в FloatingCartIconLinkBySlug) и страницы со
 *    своей нижней фиксированной UI (карточка аренды, конфигуратор,
 *    зарплатные коэффициенты, корзина, заказ) — в denylist ниже.
 *
 * КУДА ПОСТАВЛЕНА (чтобы не мешать):
 *  • bottom-[calc(6rem+env(safe-area-inset-bottom))] — та же высота, что
 *    плавающая панель корзины каталога; над FAB «Экскурсия» на лидах
 *    (bottom-4 + h-11 ≈ 60px) и над нижними панелями.
 *  • z-40 — ПОД шторками (z-[55]/z-[60]), под тостами ачивок (z-50) и
 *    уведомлениями лидов (z-[70]): если что-то всплывает — оно сверху.
 */
const SHOW_AFTER_PX = 400;

/** Маршруты, где кнопка НЕ нужна: там уже есть своя стрелка вверх или нижняя фиксированная панель. */
function isExcludedPathname(pathname: string): boolean {
  // Каталог и его витрины — стрелка уже есть в плавающей панели корзины.
  if (/^\/franchize\/[^/]+\/?$/.test(pathname)) return true; // /franchize/[slug]
  if (/^\/franchize\/[^/]+\/(equipment|electro-enduro)(\/|$)/.test(pathname)) return true;
  // Страницы со своей фиксированной нижней UI — не создаём свалку кнопок.
  if (/^\/franchize\/[^/]+\/rental\/[^/]+/.test(pathname)) return true; // RentalQuickActionBar FAB
  if (/^\/franchize\/[^/]+\/configurator/.test(pathname)) return true; // sticky-бар конфигуратора
  if (/^\/franchize\/[^/]+\/salary-coefficients/.test(pathname)) return true; // нижняя панель сохранения
  if (/^\/franchize\/[^/]+\/cart(\/|$)/.test(pathname)) return true; // checkout со своим CTA
  if (/^\/franchize\/[^/]+\/order(\/|$)/.test(pathname)) return true; // оформление заказа
  return false;
}

/**
 * Страница «Клиенты и заявки»: кнопка обслуживает ТОЛЬКО список лидов
 * (#leads-list-scroll) — ни окно страницы, ни другие контейнеры.
 */
function isLeadsListOnlyPathname(pathname: string): boolean {
  return /\/franchize\/[^/]+\/leads(\/|$)/.test(pathname);
}

export function ScrollToTopButton() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const listOnly = isLeadsListOnlyPathname(pathname);

  useEffect(() => {
    if (isExcludedPathname(pathname)) {
      setVisible(false);
      return;
    }

    const readDepth = (): number => {
      // Окно + внутренние скролл-контейнеры (список лидов скроллится
      // внутри собственного overflow-y-auto — окно стоит на месте).
      // На странице «Клиенты и заявки» окно НЕ учитываем: стрелка
      // обслуживает только список лидов (см. isLeadsListOnlyPathname).
      if (listOnly) {
        return document.getElementById("leads-list-scroll")?.scrollTop || 0;
      }
      let deepest = window.scrollY || 0;
      const inner = document.getElementById("leads-list-scroll");
      if (inner) deepest = Math.max(deepest, inner.scrollTop || 0);
      return deepest;
    };

    const onScroll = () => setVisible(readDepth() > SHOW_AFTER_PX);

    // capture: ловим scroll и внутренних контейнеров (scroll не всплывает,
    // но capture-фаза document проходит через ВСЕ элементы).
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    onScroll();
    return () => document.removeEventListener("scroll", onScroll, { capture: true });
  }, [pathname, listOnly]);

  const handleClick = useCallback(() => {
    // List-only (страница «Клиенты и заявки»): прокручиваем ТОЛЬКО список —
    // страница (KPI/плейбук/аналитика) остаётся на месте, оператор не
    // теряет свою позицию в ней.
    const inner = document.getElementById("leads-list-scroll");
    if (inner) inner.scrollTo({ top: 0, behavior: "smooth" });
    if (!listOnly) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [listOnly]);

  if (isExcludedPathname(pathname)) return null;

  return (
    <button
      type="button"
      aria-label="Прокрутить страницу вверх"
      onClick={handleClick}
      className={`fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] right-4 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full border border-border/50 bg-background/90 text-foreground shadow-lg backdrop-blur transition-all duration-300 active:scale-95 hover:brightness-105 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current ${
        visible ? "opacity-100 translate-y-0" : "pointer-events-none translate-y-3 opacity-0"
      }`}
    >
      <ArrowUp className="h-5 w-5" aria-hidden />
    </button>
  );
}
