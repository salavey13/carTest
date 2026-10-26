"use client";

// /app/leorus/LeorusLandingClient.tsx
// ─────────────────────────────────────────────────────────────────────────────
// LEORUS — агентство мероприятий Рустама Оруджова × Влада Иващенко (djorudjov).
//
// Порт лендинга /var/www/orudjov-x-vlad/index.html (VPS 212.67.11.25) в
// cartest по запросу босса 2026-10-26: «find a repo with a landing page for
// djorudjov and port it to our cartest repo as a landing like /moto-selection
// and sly13». Маршрут /leorus — по бренду (как /sly13 — по нику), DNA паттерн
// тот же: собственные nav+footer, хром платформы подавлен в THEME_CONFIG.
//
// Что перенесено 1:1: тёмная клубная эстетика (cyan/magenta/violet на
// #0A0612), все 11 фото (public/leorus/*), секции hero/duet/directions/
// portfolio/partner/process/cta/contacts, шрифты Unbounded + Manrope +
// JetBrains Mono, CSS дословно из оригинала (leorus.css).
//
// Что переписано на React: sticky-nav состояние (is-scrolled), мобильный
// бургер, и — вместо мок-сабмита — форма заявки POST-ит в существующий
// /api/franchize/callback-lead (slug «vip-bike»: Rustam — vip-bike админ,
// получатели резолвятся через resolveLeadNotifyRecipients + ADMIN_CHAT_ID,
// т.е. босс и ростер vip-bike получают лид в Telegram). Успех/ошибка — в
// стилистике оригинального [data-success] блока.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from "react";
import "./leorus.css";

type FormPhase = "idle" | "sending" | "success" | "error";

export default function LeorusLandingClient() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [formPhase, setFormPhase] = useState<FormPhase>("idle");
  const [formError, setFormError] = useState("");

  // sticky nav state (original: onScroll → is-scrolled)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // body scroll lock while the mobile menu is open
  useEffect(() => {
    document.body.classList.toggle("no-scroll", menuOpen);
    return () => document.body.classList.remove("no-scroll");
  }, [menuOpen]);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const onFormSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const form = e.currentTarget;
      if (formPhase === "sending" || formPhase === "success") return;
      setFormError("");
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      const fd = new FormData(form);
      setFormPhase("sending");
      try {
        const resp = await fetch("/api/franchize/callback-lead", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug: "vip-bike",
            name: String(fd.get("name") || "").trim(),
            phone: String(fd.get("phone") || "").trim(),
            consent: true,
            formSource: "leorus-landing",
            landingPath: "/leorus",
            message: [
              `Формат: ${fd.get("format") || "—"}`,
              fd.get("date") ? `Дата: ${fd.get("date")}` : "",
              fd.get("budget") ? `Бюджет: ${fd.get("budget")}` : "",
              fd.get("message") ? String(fd.get("message")) : "",
            ]
              .filter(Boolean)
              .join(" · "),
          }),
        });
        const data = (await resp.json().catch(() => ({}))) as {
          success?: boolean;
          error?: string;
        };
        if (!resp.ok || data.success === false) {
          throw new Error(data.error || "Не удалось отправить заявку");
        }
        setFormPhase("success");
      } catch (err) {
        setFormPhase("error");
        setFormError(
          err instanceof Error
            ? err.message
            : "Что-то пошло не так — позвоните или напишите Рустаму напрямую"
        );
      }
    },
    [formPhase]
  );

  return (
    <div className="leorus-root">
  <header className={"nav" + (scrolled ? " is-scrolled" : "")} id="nav">
    <div className="nav__inner container">
      <a href="#top" className="nav__brand" aria-label="LEORUS — на главную">
        <span className="nav__x nav__x--logo" aria-hidden="true">
          <svg className="logo-mark" viewBox="0 0 120 120" fill="none" aria-hidden="true">
            <circle cx="60" cy="60" r="46" stroke="currentColor" strokeWidth="5"/>
            <path d="M46 33V80H61" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M61 33V80M61 33H71a13 13 0 0 1 0 26H61M65 59L80 80" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
        <span className="nav__brand-text">
          <span className="nav__brand-name">LEORUS</span>
          <span className="nav__brand-sub">Event Bureau · NN</span>
        </span>
      </a>

      <nav className="nav__links" aria-label="Главное меню">
        <a href="#duet">Дуэт</a>
        <a href="#directions">Направления</a>
        <a href="#portfolio">Портфолио</a>
        <a href="#process">Процесс</a>
        <a href="#contacts">Контакты</a>
      </nav>

      <a href="#cta" className="nav__cta">
        <span>Обсудить событие</span>
        <svg className="nav__cta-arr" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M3 8h9M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </a>

      <button
        className="nav__burger"
        type="button"
        aria-label="Открыть меню"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((v) => !v)}
      >
        <span></span><span></span><span></span>
      </button>
    </div>

    <div
        className="nav__mobile"
        hidden={!menuOpen}
        onClick={closeMenu}
      >
      <a href="#duet">Дуэт</a>
      <a href="#directions">Направления</a>
      <a href="#portfolio">Портфолио</a>
      <a href="#process">Процесс</a>
      <a href="#contacts">Контакты</a>
      <a href="#cta" className="nav__mobile-cta">Обсудить событие</a>
    </div>
  </header>

  <main id="top">
    
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero__bg" aria-hidden="true">
        <div className="hero__grid"></div>
        <div className="hero__orb hero__orb--1"></div>
        <div className="hero__orb hero__orb--2"></div>
        <div className="hero__orb hero__orb--3"></div>
        <div className="hero__scan"></div>
      </div>

      <div className="container hero__inner">
        <div className="hero__text">
          <div className="hero__top">
            <span className="hero__chip">
              <span className="hero__chip-dot" aria-hidden="true"></span>
              Агентство мероприятий · Нижний Новгород
            </span>
            <span className="hero__chip hero__chip--ghost">
              <span className="hero__chip-line"></span>
              20 лет в индустрии
            </span>
          </div>

          <h1 className="hero__title" id="hero-title">
            <span className="hero__title-word"><span className="hero__title-line">LEO</span><span className="hero__title-line hero__title-line--alt">RUS</span></span>
            <span className="hero__title-tag">Создание интригующих мероприятий.</span>
          </h1>

          <p className="hero__sub">
            Топовые мероприятия и&nbsp;крупные корпоративы для&nbsp;больших компаний. 20&nbsp;лет проводим фестивали, шоу и&nbsp;корпоративные события — от&nbsp;идеи до&nbsp;финального аккорда, под&nbsp;ключ.
          </p>

          <div className="hero__cta-row">
            <a href="#cta" className="btn btn--primary">
              <span>Обсудить мероприятие</span>
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </a>
            <a href="#portfolio" className="btn btn--ghost">
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span>Смотреть кейсы</span>
            </a>
          </div>

          <ul className="hero__stats" aria-label="Ключевые показатели агентства">
            <li>
              <span className="hero__stat-num">20 лет</span>
              <span className="hero__stat-lbl">в&nbsp;event и&nbsp;шоу-бизнесе</span>
            </li>
            <li>
              <span className="hero__stat-num">300+</span>
              <span className="hero__stat-lbl">реализованных проектов</span>
            </li>
            <li>
              <span className="hero__stat-num">1&nbsp;000&nbsp;000</span>
              <span className="hero__stat-lbl">зрителей на&nbsp;наших событиях</span>
            </li>
          </ul>
        </div>

        <div className="hero__media" aria-label="Основатели LEORUS">
          <figure className="hero-face hero-face--rustam">
            <img src="/leorus/founder-rustam.jpg" alt="Рустам Оруджов — продюсер LEORUS" loading="eager" width="600" height="800" />
            <figcaption>Рустам Оруджов<span>Продакшн-директор · DJ</span></figcaption>
          </figure>
          <span className="hero__media-badge" aria-hidden="true"><span>×</span></span>
          <figure className="hero-face hero-face--vlad">
            <img src="/leorus/founder-vlad.jpg" alt="Влад — продакшн и постановка LEORUS" loading="eager" width="600" height="800" />
            <figcaption>Влад Иващенко<span>Продюсер · LEORUS</span></figcaption>
          </figure>
        </div>
      </div>

      <div className="hero__ticker" aria-hidden="true">
        <div className="hero__ticker-track">
          <span>Корпоративы</span><span className="dot"></span>
          <span>Фестивали</span><span className="dot"></span>
          <span>Шоу-программы</span><span className="dot"></span>
          <span>Видео-продакшн</span><span className="dot"></span>
          <span>DJ-сеты</span><span className="dot"></span>
          <span>MatreshkaFest</span><span className="dot"></span>
          <span>ORUDJOV NEWS</span><span className="dot"></span>
          <span>Корпоративы</span><span className="dot"></span>
          <span>Фестивали</span><span className="dot"></span>
          <span>Шоу-программы</span><span className="dot"></span>
          <span>Видео-продакшн</span><span className="dot"></span>
          <span>DJ-сеты</span><span className="dot"></span>
          <span>MatreshkaFest</span><span className="dot"></span>
          <span>ORUDJOV NEWS</span><span className="dot"></span>
        </div>
      </div>
    </section>

    
    <section className="duet section" id="duet" aria-labelledby="duet-title">
      <div className="container">
        <div className="sec-head">
          <span className="sec-head__eyebrow">01 / ДУЭТ</span>
          <h2 className="sec-head__title" id="duet-title">
            Продюсер и продакшн-директор. <span className="grad-violet">Один нерв.</span>
          </h2>
          <p className="sec-head__sub">
            Влад продюсирует событие: концепция, заказчик, артисты и площадки. Рустам держит продакшн — саунд, сцену, свет и драматургию вечера. Вместе за 20 лет собрали события, которые обсуждают ещё неделю после финала.
          </p>
        </div>

        <div className="duet__grid">
          <article className="duet-card duet-card--rustam">
            <div className="duet-card__media">
              <img className="duet-card__bg" src="/leorus/duet-rustam.jpg" alt="Рустам Оруджов на сцене" loading="lazy" width="900" height="720" />
            </div>
            <div className="duet-card__body">
              <div className="duet-card__head">
                <span className="duet-card__role">Продакшн-директор · DJ</span>
                <h3 className="duet-card__name">Рустам Оруджов</h3>
              </div>
              <p className="duet-card__desc">
                20&nbsp;лет в&nbsp;event и&nbsp;шоу-бизнесе. Отвечает за&nbsp;продакшн и&nbsp;саунд на&nbsp;событиях до&nbsp;2000&nbsp;гостей: сцена, свет, драматургия и&nbsp;DJ-сеты. Куратор международного фестиваля MatreshkaFest, DJ&nbsp;с&nbsp;международными сетами (Goa, Индия). Ведёт медиа ORUDJOV&nbsp;NEWS.
              </p>
              <ul className="duet-card__tags">
                <li>Продакшн</li>
                <li>Саунд и&nbsp;сцена</li>
                <li>DJ-сеты</li>
              </ul>
              <div className="duet-card__contacts">
                <a href="tel:+79877453737" className="duet-card__contact">
                  <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3.5C3 3.2 3.2 3 3.5 3h2l1 3-1.5 1c.8 1.7 2.3 3.2 4 4l1-1.5 3 1v2c0 .3-.2.5-.5.5C7 13 3 9 3 3.5z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>
                  +7&nbsp;(987)&nbsp;745-37-37
                </a>
                <a href="https://t.me/orudjov_news" target="_blank" rel="noopener" className="duet-card__contact">
                  <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M14 3L1.5 7.5l4 1.5 1.5 4.5 2-3 3.5 2.5L14 3z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>
                  t.me/orudjov_news
                </a>
              </div>
            </div>
          </article>

          <article className="duet-card duet-card--vlad">
            <div className="duet-card__media">
              <img className="duet-card__bg" src="/leorus/duet-vlad.jpg" alt="Влад — продакшн и постановка LEORUS" loading="lazy" width="900" height="720" />
            </div>
            <div className="duet-card__body">
              <div className="duet-card__head">
                <span className="duet-card__role">Продюсер · Основатель LEORUS</span>
                <h3 className="duet-card__name">Влад Иващенко</h3>
              </div>
              <p className="duet-card__desc">
                Продюсер LEORUS, известен как Vlad&nbsp;Leo. Отвечает за&nbsp;продюсирование под&nbsp;ключ: концепция события, работа с&nbsp;заказчиком, бюджет, подбор артистов и&nbsp;площадок. Собирает событие как целостную историю&nbsp;— от&nbsp;идеи до&nbsp;финала.
              </p>
              <ul className="duet-card__tags">
                <li>Продюсирование</li>
                <li>Концепция</li>
                <li>Работа с&nbsp;артистами</li>
              </ul>
              <div className="duet-card__contacts">
                <a href="#cta" className="duet-card__contact">
                  <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Обсудить ваше событие
                </a>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>

    
    <section className="directions section" id="directions" aria-labelledby="dir-title">
      <div className="container">
        <div className="sec-head">
          <span className="sec-head__eyebrow">02 / НАПРАВЛЕНИЯ</span>
          <h2 className="sec-head__title" id="dir-title">
            Что мы делаем. <span className="grad-cyan">Громко.</span>
          </h2>
          <p className="sec-head__sub">
            Четыре направления — от корпоратива крупной компании до международного фестиваля. Своя команда, свой продакшн, своё видео.
          </p>
        </div>

        <div className="dir-grid">
          
          <article className="dir-card dir-card--festival">
            <div className="dir-card__num">01</div>
            <div className="dir-card__icon" aria-hidden="true">
              <svg viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="2"/>
                <path d="M14 32v-8m6 8V20m6 12V14m6 18v-10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <path d="M10 36h28" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <circle cx="14" cy="32" r="1.5" fill="currentColor"/>
                <circle cx="20" cy="20" r="1.5" fill="currentColor"/>
                <circle cx="26" cy="14" r="1.5" fill="currentColor"/>
                <circle cx="32" cy="22" r="1.5" fill="currentColor"/>
              </svg>
            </div>
            <h3 className="dir-card__title">Фестивали под ключ</h3>
            <p className="dir-card__desc">
              Сцена, лайнап, райдер, безопасность, согласования. От&nbsp;локального open-air до&nbsp;международного формата.
            </p>
            <ul className="dir-card__list">
              <li><span>Опыт</span><strong>MatreshkaFest · 8 стран</strong></li>
              <li><span>Охват</span><strong>до 1 000 000 зрителей</strong></li>
              <li><span>Свет и звук</span><strong>Сцена под масштаб</strong></li>
              <li><span>Площадка</span><strong>Подбор под задачу</strong></li>
            </ul>
            <a href="#cta" className="dir-card__more">
              Запросить смету
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </a>
          </article>

          
          <article className="dir-card dir-card--dj">
            <div className="dir-card__num">02</div>
            <div className="dir-card__icon" aria-hidden="true">
              <svg viewBox="0 0 48 48" fill="none">
                <rect x="6" y="14" width="36" height="20" rx="2" stroke="currentColor" strokeWidth="2"/>
                <circle cx="16" cy="24" r="4" stroke="currentColor" strokeWidth="2"/>
                <circle cx="32" cy="24" r="4" stroke="currentColor" strokeWidth="2"/>
                <circle cx="16" cy="24" r="1.5" fill="currentColor"/>
                <circle cx="32" cy="24" r="1.5" fill="currentColor"/>
                <path d="M22 20h4M22 28h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <path d="M10 18v12M38 18v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.4"/>
              </svg>
            </div>
            <h3 className="dir-card__title">DJ и шоу-программа</h3>
            <p className="dir-card__desc">
              Open-format, клубные и&nbsp;фестивальные сеты, шоу-номера и&nbsp;ведущий. Программа под&nbsp;вашу аудиторию и&nbsp;формат вечера.
            </p>
            <ul className="dir-card__list">
              <li><span>Формат</span><strong>Open format / шоу</strong></li>
              <li><span>Хронометраж</span><strong>1–4 часа</strong></li>
              <li><span>География</span><strong>Россия · Goa (Индия)</strong></li>
              <li><span>Опыт</span><strong>20 лет за пультом</strong></li>
            </ul>
            <a href="#cta" className="dir-card__more">
              Забронировать дату
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </a>
          </article>

          
          <article className="dir-card dir-card--video">
            <div className="dir-card__num">03</div>
            <div className="dir-card__icon" aria-hidden="true">
              <svg viewBox="0 0 48 48" fill="none">
                <rect x="6" y="10" width="28" height="28" rx="2" stroke="currentColor" strokeWidth="2"/>
                <path d="M34 18l8-5v22l-8-5v-12z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                <circle cx="20" cy="24" r="4" stroke="currentColor" strokeWidth="2"/>
                <circle cx="20" cy="24" r="1.5" fill="currentColor"/>
                <path d="M14 18l3 3M26 18l-3 3M14 30l3-3M26 30l-3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <h3 className="dir-card__title">Видео-продакшн</h3>
            <p className="dir-card__desc">
              Промо, репортаж, афиши, монтаж для&nbsp;соцсетей. Освещаем событие так, чтобы оно&nbsp;жило и&nbsp;после финала. Опыт медиа ORUDJOV&nbsp;NEWS.
            </p>
            <ul className="dir-card__list">
              <li><span>Медиа</span><strong>ORUDJOV NEWS</strong></li>
              <li><span>Монтаж</span><strong>Reels · Shorts · клипы</strong></li>
              <li><span>Графика</span><strong>Афиши · титры · лого</strong></li>
              <li><span>Репортаж</span><strong>Съёмка события под ключ</strong></li>
            </ul>
            <a href="#cta" className="dir-card__more">
              Обсудить ролик
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </a>
          </article>

          
          <article className="dir-card dir-card--corp">
            <div className="dir-card__num">04</div>
            <div className="dir-card__icon" aria-hidden="true">
              <svg viewBox="0 0 48 48" fill="none">
                <path d="M8 18h32v22H8V18z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                <path d="M14 18V12a4 4 0 014-4h12a4 4 0 014 4v6" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                <path d="M8 26h32" stroke="currentColor" strokeWidth="2"/>
                <path d="M20 30v6M28 30v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <circle cx="24" cy="22" r="2" fill="currentColor"/>
              </svg>
            </div>
            <h3 className="dir-card__title">Корпоративы крупным&nbsp;компаниям</h3>
            <p className="dir-card__desc">
              Корпоративы, юбилеи компаний, конференции, тимбилдинги. Полный цикл: сценарий, продакшн, подрядчики, ведущий, финал — под&nbsp;уровень крупного бренда.
            </p>
            <ul className="dir-card__list">
              <li><span>Опыт</span><strong>15+ корпоративов · MASTER PLAZA</strong></li>
              <li><span>Гостей</span><strong>от 50 до 2 000</strong></li>
              <li><span>Сценарий</span><strong>Под вашу компанию</strong></li>
              <li><span>Подрядчики</span><strong>Свои · проверенные</strong></li>
            </ul>
            <a href="#cta" className="dir-card__more">
              Рассчитать событие
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </a>
          </article>
        </div>
      </div>
    </section>

    
    <section className="portfolio section" id="portfolio" aria-labelledby="port-title">
      <div className="container">
        <div className="sec-head sec-head--row">
          <div>
            <span className="sec-head__eyebrow">03 / ПОРТФОЛИО</span>
            <h2 className="sec-head__title" id="port-title">
              Что уже <span className="grad-magenta">прожито.</span>
            </h2>
          </div>
          <p className="sec-head__sub sec-head__sub--side">
            Клипы, лайнапы, фото — здесь подборка ивентов, на&nbsp;которых мы&nbsp;делали саунд, свет и&nbsp;продакшн. Полный архив — в&nbsp;Telegram.
          </p>
        </div>

        <div className="port-grid">
          
          <article className="port-card port-card--big port-card--magenta">
            <div className="port-card__media">
              <img className="port-card__bg" src="/leorus/case-ananda.jpg" alt="ANANDA — музыкальный фестиваль, репортаж ORUDJOV NEWS" loading="lazy" width="1000" height="562" />
            </div>
            <div className="port-card__overlay">
              <span className="port-card__year">2025</span>
              <h3 className="port-card__title">ANANDA FEST</h3>
              <p className="port-card__meta">Музыкальный фестиваль · сцена · репортаж</p>
            </div>
            <span className="port-card__tag">Festival</span>
          </article>

          
          <article className="port-card port-card--cyan">
            <div className="port-card__media">
              <img className="port-card__bg" src="/leorus/case-oldhouse.jpg" alt="THE OLD HOUSE — клубный сет" loading="lazy" width="900" height="900" />
            </div>
            <div className="port-card__overlay">
              <span className="port-card__year">2025</span>
              <h3 className="port-card__title">THE OLD HOUSE</h3>
              <p className="port-card__meta">Клубный сет · open format</p>
            </div>
            <span className="port-card__tag">DJ-set</span>
          </article>

          
          <article className="port-card port-card--violet">
            <div className="port-card__media" aria-hidden="true">
              <svg className="port-card__bg" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice">
                <defs>
                  <linearGradient id="p3g" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1B0A3A"/>
                    <stop offset="100%" stopColor="#3F1370"/>
                  </linearGradient>
                </defs>
                <rect width="400" height="400" fill="url(#p3g)"/>
                <g fill="#8338EC" opacity="0.5">
                  <circle cx="200" cy="200" r="100"/>
                </g>
                <g fill="#FF2D9B" opacity="0.6">
                  <circle cx="160" cy="180" r="30"/>
                  <circle cx="240" cy="220" r="20"/>
                </g>
                <g stroke="#F5F2FF" strokeWidth="1" fill="none" opacity="0.4">
                  <path d="M100 280 Q200 250 300 280"/>
                  <path d="M100 300 Q200 270 300 300"/>
                </g>
              </svg>
            </div>
            <div className="port-card__overlay">
              <span className="port-card__year">2019–2020</span>
              <h3 className="port-card__title">MatreshkaFest</h3>
              <p className="port-card__meta">8 стран · 1 000 000 зрителей · президентская премия</p>
            </div>
            <span className="port-card__tag">Int'l</span>
          </article>

          
          <article className="port-card port-card--cyan port-card--wide">
            <div className="port-card__media">
              <img className="port-card__bg" src="/leorus/case-corporates.jpg" alt="Корпоративное мероприятие крупной компании" loading="lazy" width="1000" height="667" />
            </div>
            <div className="port-card__overlay">
              <span className="port-card__year">MASTER PLAZA</span>
              <h3 className="port-card__title">Корпоративы крупных компаний</h3>
              <p className="port-card__meta">15+ событий · до 2 000 гостей · под ключ</p>
            </div>
            <span className="port-card__tag">Corporate</span>
          </article>

          
          <article className="port-card port-card--magenta">
            <div className="port-card__media" aria-hidden="true">
              <svg className="port-card__bg" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice">
                <defs>
                  <radialGradient id="p5r" cx="0.5" cy="0.5" r="0.7">
                    <stop offset="0%" stopColor="#5A0E2E"/>
                    <stop offset="100%" stopColor="#0A0414"/>
                  </radialGradient>
                </defs>
                <rect width="400" height="400" fill="url(#p5r)"/>
                <g stroke="#FF2D9B" strokeWidth="1" fill="none" opacity="0.6">
                  <circle cx="200" cy="200" r="120"/>
                  <circle cx="200" cy="200" r="90"/>
                  <circle cx="200" cy="200" r="60"/>
                </g>
                <g fill="#FF2D9B">
                  <circle cx="200" cy="80" r="4"/>
                  <circle cx="320" cy="200" r="4"/>
                  <circle cx="200" cy="320" r="4"/>
                  <circle cx="80" cy="200" r="4"/>
                </g>
              </svg>
            </div>
            <div className="port-card__overlay">
              <span className="port-card__year">Goa · Индия</span>
              <h3 className="port-card__title">Goa-freaks</h3>
              <p className="port-card__meta">Международные музыкальные фестивали</p>
            </div>
            <span className="port-card__tag">Int'l</span>
          </article>

          
          <article className="port-card port-card--violet port-card--big">
            <div className="port-card__media">
              <img className="port-card__bg" src="/leorus/case-orudjovnews.jpg" alt="ORUDJOV NEWS — медиа о событиях" loading="lazy" width="1000" height="667" />
            </div>
            <div className="port-card__overlay">
              <span className="port-card__year">2020–2026</span>
              <h3 className="port-card__title">ORUDJOV NEWS</h3>
              <p className="port-card__meta">Медиа о событиях · интервью · репортаж</p>
            </div>
            <span className="port-card__tag">Media</span>
          </article>

          
          <article className="port-card port-card--cyan">
            <div className="port-card__media">
              <img className="port-card__bg" src="/leorus/case-liveshows.jpg" alt="Живое выступление · лайнап" loading="lazy" width="900" height="900" />
            </div>
            <div className="port-card__overlay">
              <span className="port-card__year">2025</span>
              <h3 className="port-card__title">Живые выступления</h3>
              <p className="port-card__meta">Лайнап · сцена · шоу-программа</p>
            </div>
            <span className="port-card__tag">Show</span>
          </article>

          
          <article className="port-card port-card--magenta">
            <div className="port-card__media">
              <img className="port-card__bg" src="/leorus/case-clubs.jpg" alt="Клубные и частные вечера" loading="lazy" width="900" height="600" />
            </div>
            <div className="port-card__overlay">
              <span className="port-card__year">2024–2025</span>
              <h3 className="port-card__title">Клубные вечера</h3>
              <p className="port-card__meta">Частные события · атмосфера · гости</p>
            </div>
            <span className="port-card__tag">Private</span>
          </article>
        </div>
      </div>
    </section>

    
    <section className="partner section" aria-labelledby="partner-title">
      <div className="container">
        <article className="partner-card">
          <div className="partner-card__left">
            <span className="partner-card__eyebrow">04 / ПАРТНЁРЫ</span>
            <h2 className="partner-card__title" id="partner-title">
              Постоянные партнёры. <span className="grad-cyan">VIP&nbsp;BIKE&nbsp;ELECTRO.</span>
            </h2>
            <p className="partner-card__desc">
              Работаем с&nbsp;постоянными партнёрами города. Магазин электромотоциклов VIP&nbsp;BIKE&nbsp;ELECTRO — площадка, логистика и&nbsp;техническая поддержка наших событий. С&nbsp;проверенными командами быстрее и&nbsp;спокойнее.
            </p>
            <a href="https://vip-bike.ru" target="_blank" rel="noopener" className="btn btn--ghost btn--ghost-ink">
              <span>vip-bike.ru</span>
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 11l6-6M7 5h4v4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </a>
          </div>
          <div className="partner-card__right">
            <img className="partner-card__logo partner-card__logo--img" src="/leorus/partner-vipbike.png" alt="VIP BIKE ELECTRO — магазин электромотоциклов, партнёр LEORUS" loading="lazy" width="520" height="380" />
          </div>
        </article>

        {/* task 141: interlink all-to-all — витрина экипажей платформы SLY13.
            LEORUS (экипаж djorudjov) живёт на одном софте с арендой, мотосервисом
            и электрикой: ссылаемся на их лендинги, они ссылаются на нас. */}
        <div className="crew-links" role="list" aria-label="Витрины партнёров платформы">
          <p className="crew-links__eyebrow">витрина платформы · экипажи на одном софте</p>
          <div className="crew-links__grid">
            <a href="/vipbikerental" className="crew-link" role="listitem">
              <span className="crew-link__title">VIP BIKE Rental</span>
              <span className="crew-link__note">аренда электромото · экипировка · карта райдеров · зимнее хранение</span>
              <span className="crew-link__more">Открыть витрину →</span>
            </a>
            <a href="/moto-selection" className="crew-link" role="listitem">
              <span className="crew-link__title">Moto.Selection</span>
              <span className="crew-link__note">мотосервис · обучение · подбор мото · ТО · хранение 24/7</span>
              <span className="crew-link__more">Открыть витрину →</span>
            </a>
            <a href="/sly13" className="crew-link" role="listitem">
              <span className="crew-link__title">SLY13</span>
              <span className="crew-link__note">платформа франшиз проката — каталог, CRM, договоры, лиды</span>
              <span className="crew-link__more">Открыть витрину →</span>
            </a>
            <a href="/georg-electro" className="crew-link" role="listitem">
              <span className="crew-link__title">Georg.Electro</span>
              <span className="crew-link__note">электрик электробайков — диагностика, контроллеры, проводка, свет</span>
              <span className="crew-link__more">Открыть витрину →</span>
            </a>
          </div>
        </div>
      </div>
    </section>

    
    <section className="process section" id="process" aria-labelledby="proc-title">
      <div className="container">
        <div className="sec-head sec-head--center">
          <span className="sec-head__eyebrow">05 / ПРОЦЕСС</span>
          <h2 className="sec-head__title" id="proc-title">
            Как мы <span className="grad-violet">работаем.</span>
          </h2>
          <p className="sec-head__sub">
            Четыре шага от&nbsp;заявки до&nbsp;реализации. Без сюрпризов, без переносов, без чужих людей на&nbsp;площадке.
          </p>
        </div>

        <ol className="proc-grid">
          <li className="proc-step">
            <span className="proc-step__num">01</span>
            <h3 className="proc-step__title">Заявка</h3>
            <p className="proc-step__desc">
              Опишите формат и&nbsp;дату. 10&nbsp;минут&nbsp;— и&nbsp;мы&nbsp;уже думаем, как это собрать.
            </p>
          </li>
          <li className="proc-step">
            <span className="proc-step__num">02</span>
            <h3 className="proc-step__title">Бриф</h3>
            <p className="proc-step__desc">
              Личная встреча или&nbsp;звонок. Обсуждаем площадку, бюджет, аудиторию, ограничения.
            </p>
          </li>
          <li className="proc-step">
            <span className="proc-step__num">03</span>
            <h3 className="proc-step__title">Концепция</h3>
            <p className="proc-step__desc">
              Сцена, лайнап, райдер, тайминг, смета. Утверждаем&nbsp;— и&nbsp;только тогда запускаем.
            </p>
          </li>
          <li className="proc-step">
            <span className="proc-step__num">04</span>
            <h3 className="proc-step__title">Реализация</h3>
            <p className="proc-step__desc">
              Делаем ивент под&nbsp;ключ. Своя команда, своя аппаратура, своя ответственность.
            </p>
          </li>
        </ol>
      </div>
    </section>

    
    <section className="cta section" id="cta" aria-labelledby="cta-title">
      <div className="container">
        <div className="cta-card">
          <div className="cta-card__head">
            <span className="cta-card__eyebrow">06 / ЗАЯВКА</span>
            <h2 className="cta-card__title" id="cta-title">
              Обсудим ваше <span className="grad-cyan">событие?</span>
            </h2>
            <p className="cta-card__sub">
              Оставьте короткую заявку&nbsp;— перезвоним в&nbsp;течение часа. Если ивент срочный, пишите Рустаму напрямую.
            </p>
          </div>

          <form className="cta-form" noValidate onSubmit={onFormSubmit}>
            <div className="cta-form__row">
              <label className="cta-form__field">
                <span className="cta-form__lbl">Имя</span>
                <input type="text" name="name" required placeholder="Как к вам обращаться" autoComplete="name" />
              </label>
              <label className="cta-form__field">
                <span className="cta-form__lbl">Телефон</span>
                <input type="tel" name="phone" required placeholder="+7 (___) ___-__-__" autoComplete="tel" inputMode="tel" />
              </label>
            </div>

            <div className="cta-form__row">
              <label className="cta-form__field">
                <span className="cta-form__lbl">Дата ивента</span>
                <input type="date" name="date" />
              </label>
              <label className="cta-form__field">
                <span className="cta-form__lbl">Формат</span>
                <select name="format" required defaultValue="">
                  <option value="" disabled>Выберите формат</option>
                  <option value="festival">Фестиваль</option>
                  <option value="dj">DJ-сет</option>
                  <option value="video">Видео-продакшн</option>
                  <option value="corporate">Корпоратив</option>
                  <option value="private">Частный ивент</option>
                  <option value="other">Другое</option>
                </select>
              </label>
            </div>

            <label className="cta-form__field cta-form__field--full">
              <span className="cta-form__lbl">Бюджет</span>
              <select name="budget" required defaultValue="">
                <option value="" disabled>Выберите бюджет</option>
                <option value="300">до 300 000 ₽</option>
                <option value="700">300 000 — 700 000 ₽</option>
                <option value="1500">700 000 — 1 500 000 ₽</option>
                <option value="3000">от 1 500 000 ₽</option>
                <option value="discuss">Обсудим лично</option>
              </select>
            </label>

            <label className="cta-form__field cta-form__field--full">
              <span className="cta-form__lbl">Кратко о&nbsp;событии</span>
              <textarea name="message" rows={3} placeholder="Площадка, гости, пожелания — что важно знать"></textarea>
            </label>

            <div className="cta-form__bottom">
              <button
                type="submit"
                className="btn btn--primary btn--big"
                disabled={formPhase === "sending" || formPhase === "success"}
              >
                <span>{formPhase === "sending" ? "Отправляем…" : "Отправить заявку"}</span>
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <p className="cta-form__note">
                Нажимая кнопку, вы&nbsp;соглашаетесь на&nbsp;обработку персональных данных.
              </p>
            </div>

            {formPhase === "error" && formError && (
              <p className="cta-form__note" role="alert" style={{ color: "var(--magenta)" }}>
                {formError}
              </p>
            )}

            <div className="cta-form__success" hidden={formPhase !== "success"}>
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span>Заявка улетела. Перезвоним в&nbsp;течение часа.</span>
            </div>
          </form>
        </div>
      </div>
    </section>

    
    <section className="contacts section" id="contacts" aria-labelledby="contacts-title">
      <div className="container">
        <div className="sec-head">
          <span className="sec-head__eyebrow">07 / КОНТАКТЫ</span>
          <h2 className="sec-head__title" id="contacts-title">
            Звоните, пишите, <span className="grad-magenta">приходите.</span>
          </h2>
        </div>

        <div className="contacts-grid">
          <article className="contact-tile contact-tile--rustam">
            <div className="contact-tile__head">
              <span className="contact-tile__initials" aria-hidden="true">R</span>
              <div>
                <span className="contact-tile__role">Рустам Оруджов</span>
                <span className="contact-tile__sub">Продакшн-директор · DJ</span>
              </div>
            </div>
            <a href="tel:+79877453737" className="contact-tile__main">
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3.5C3 3.2 3.2 3 3.5 3h2l1 3-1.5 1c.8 1.7 2.3 3.2 4 4l1-1.5 3 1v2c0 .3-.2.5-.5.5C7 13 3 9 3 3.5z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>
              +7 (987) 745-37-37
            </a>
            <div className="contact-tile__links">
              <a href="https://t.me/orudjov_news" target="_blank" rel="noopener">ORUDJOV NEWS →</a>
              <a href="https://vk.com/vip_bike_electro" target="_blank" rel="noopener">VK →</a>
            </div>
          </article>

          <article className="contact-tile contact-tile--vlad">
            <div className="contact-tile__head">
              <span className="contact-tile__initials" aria-hidden="true">В</span>
              <div>
                <span className="contact-tile__role">Влад Иващенко</span>
                <span className="contact-tile__sub">Продюсер · LEORUS</span>
              </div>
            </div>
            <a href="#cta" className="contact-tile__main">
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Обсудить событие
            </a>
            <div className="contact-tile__links">
              <a href="#cta">Оставить заявку →</a>
            </div>
          </article>

          <article className="contact-tile contact-tile--kprod">
            <div className="contact-tile__head">
              <span className="contact-tile__initials contact-tile__initials--violet" aria-hidden="true">N</span>
              <div>
                <span className="contact-tile__role">ORUDJOV NEWS</span>
                <span className="contact-tile__sub">Медиа · видео-продакшн</span>
              </div>
            </div>
            <a href="https://t.me/orudjov_news" target="_blank" rel="noopener" className="contact-tile__main">
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M14 3L1.5 7.5l4 1.5 1.5 4.5 2-3 3.5 2.5L14 3z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>
              t.me/orudjov_news
            </a>
            <div className="contact-tile__links">
              <a href="https://t.me/orudjov_news" target="_blank" rel="noopener">Заказать ролик →</a>
            </div>
          </article>

          <article className="contact-tile contact-tile--location">
            <div className="contact-tile__head">
              <span className="contact-tile__initials contact-tile__initials--magenta" aria-hidden="true">
                <svg viewBox="0 0 16 16" aria-hidden="true" fill="none">
                  <path d="M8 14s5-4.5 5-8.5A5 5 0 003 5.5C3 9.5 8 14 8 14z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                  <circle cx="8" cy="6" r="1.6" fill="currentColor"/>
                </svg>
              </span>
              <div>
                <span className="contact-tile__role">Площадка-партнёр</span>
                <span className="contact-tile__sub">VIP BIKE ELECTRO</span>
              </div>
            </div>
            <a href="https://vip-bike.ru" target="_blank" rel="noopener" className="contact-tile__main">
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 11l6-6M7 5h4v4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              vip-bike.ru
            </a>
            <div className="contact-tile__links">
              <span>пл. Комсомольская, 2 · НН</span>
            </div>
          </article>
        </div>
      </div>
    </section>
  </main>

  
  <footer className="footer">
    <div className="container footer__inner">
      <div className="footer__top">
        <div className="footer__brand">
          <span className="footer__x footer__x--logo" aria-hidden="true">
            <svg className="logo-mark" viewBox="0 0 120 120" fill="none" aria-hidden="true">
              <circle cx="60" cy="60" r="46" stroke="currentColor" strokeWidth="5"/>
              <path d="M46 33V80H61" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M61 33V80M61 33H71a13 13 0 0 1 0 26H61M65 59L80 80" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
          <div>
            <span className="footer__name">LEORUS</span>
            <span className="footer__sub">Создание мероприятий · Нижний Новгород</span>
          </div>
        </div>
        <div className="footer__cols">
          <div className="footer__col">
            <span className="footer__col-head">Дуэт</span>
            <a href="#duet">О нас</a>
            <a href="#directions">Направления</a>
            <a href="#portfolio">Портфолио</a>
            <a href="#process">Процесс</a>
          </div>
          <div className="footer__col">
            <span className="footer__col-head">Связь</span>
            <a href="tel:+79877453737">+7 (987) 745-37-37</a>
            <a href="https://t.me/orudjov_news" target="_blank" rel="noopener">ORUDJOV NEWS</a>
            <a href="https://vk.com/vip_bike_electro" target="_blank" rel="noopener">VK</a>
          </div>
          <div className="footer__col">
            <span className="footer__col-head">Партнёр</span>
            <a href="https://vip-bike.ru" target="_blank" rel="noopener">vip-bike.ru</a>
            <span>пл. Комсомольская, 2 · НН</span>
          </div>
        </div>
      </div>
      <div className="footer__bottom">
        <span className="footer__copy">© 2026 LEORUS. Агентство мероприятий · Рустам Оруджов × Влад Иващенко · Нижний Новгород.</span>
        <span className="footer__small">Партнёр: <a href="https://vip-bike.ru" target="_blank" rel="noopener">VIP BIKE ELECTRO</a></span>
      </div>
    </div>
  </footer>


    </div>
  );
}
