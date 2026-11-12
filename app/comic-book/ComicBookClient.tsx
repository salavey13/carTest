"use client";

// /app/comic-book/ComicBookClient.tsx
// ─────────────────────────────────────────────────────────────────────────────
// КОМИКС «КАК РУСТАМ СВОЙ ЭКИПАЖ СОБРАЛ» — выпуск №1 · сезон 2026 (task179).
//
// Как устроено: панели нарисованы AI (public/comic-book/*.png, БЕЗ текста —
// генерация буквы ломает), весь текст наложен кодом поверх картинок:
//  • .cb-caption  — жёлтый титр-коробка (классическая narration box);
//  • .cb-bubble   — белая/циановая реплика с хвостом (CSS-треугольник);
//  • .cb-sfx      — огромный звуковой эффект Unbounded 900 с обводкой;
//  • .cb-notify   — push-уведомление (панель 07: «аренда через веб-приложение»).
//
// Бриф босса (2026-11-12) соблюдён: никаких «чатов с ботом» — клиент арендует
// через веб-приложение и приходит уведомление; у каждого члена экипажа личный
// bootstrapped zai-агент. Стиль — привет кевилу: смешно, дерзко, комиксово.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import "./comic-book.css";

type Bubble = {
  text: string;
  kind: "hero" | "agent" | "notify-cyan";
  top: string;
  left?: string;
  right?: string;
  width: string;
};

type Sfx = {
  text: string;
  color: "cyan" | "magenta" | "yellow";
  top: string;
  left?: string;
  right?: string;
  rotate: number;
};

type Panel = {
  num: string;
  title: string;
  img: string;
  alt: string;
  accent: "cyan" | "magenta";
  caption: string;
  bubbles?: Bubble[];
  sfx?: Sfx;
};

const PANELS: Panel[] = [
  {
    num: "01",
    title: "ЗВОНОК В НОЧЬ",
    img: "/comic-book/panel01.png",
    alt: "Рустам на крыше ночью смотрит в светящийся телефон",
    accent: "cyan",
    caption: "Нижний Новгород. Пятница. 23:47. Третий фестиваль сезона позади, смена закрыта. Телефон решает, что на сегодня ещё не всё.",
    bubbles: [
      {
        text: "Тебе открыт доступ к платформе. Собери свой экипаж.",
        kind: "notify-cyan",
        top: "12%",
        right: "6%",
        width: "34%",
      },
      {
        text: "Сначала гляну... а, ладно. СЕЙЧАС ГЛЯНУ.",
        kind: "hero",
        top: "58%",
        left: "5%",
        width: "30%",
      },
    ],
    sfx: { text: "ДЗЫНЬ!", color: "cyan", top: "40%", left: "38%", rotate: -8 },
  },
  {
    num: "02",
    title: "ОДНА КНОПКА",
    img: "/comic-book/panel02.png",
    alt: "Палец нажимает огромную неоновую кнопку на голографическом экране",
    accent: "magenta",
    caption: "Никаких ТЗ на сорок страниц. Никакой команды разработки. Одна кнопка — и платформа уже строит каркас экипажа.",
    bubbles: [
      {
        text: "«Создать экипаж». Ну, за кастомизацию!",
        kind: "hero",
        top: "60%",
        right: "6%",
        width: "32%",
      },
    ],
    sfx: { text: "КАЦ!", color: "yellow", top: "12%", right: "8%", rotate: 7 },
  },
  {
    num: "03",
    title: "ЛИЧНЫЙ ZAI",
    img: "/comic-book/panel03.png",
    alt: "Рустам пьёт кофе, пока голографический zai-агент собирает сайт",
    accent: "cyan",
    caption: "У каждого члена экипажа — личный bootstrapped zai-агент. Не общий чат-бот на всех, а свой, с ключами к своей базе.",
    bubbles: [
      {
        text: "Не отвлекайся, шеф. Деплой сам себя не сделает.",
        kind: "agent",
        top: "10%",
        right: "5%",
        width: "30%",
      },
      {
        text: "Он сайт собирает. Я кофе пью. Кто из нас тут продюсер?",
        kind: "hero",
        top: "62%",
        left: "5%",
        width: "32%",
      },
    ],
  },
  {
    num: "04",
    title: "БРЕНД-КУЗНИЦА",
    img: "/comic-book/panel04.png",
    alt: "Гигантский светящийся логотип влетает в неоновый билборд",
    accent: "magenta",
    caption: "Название, логотип, цвета, контакты — всё его. И всё это живёт в его репозитории, а не в чужом конструкторе.",
    bubbles: [
      {
        text: "LEORUS RIDES. Звучит как фест. Оставляю.",
        kind: "hero",
        top: "62%",
        right: "6%",
        width: "32%",
      },
    ],
    sfx: { text: "ВЖУХ!", color: "magenta", top: "10%", right: "7%", rotate: -6 },
  },
  {
    num: "05",
    title: "КАТАЛОГ ЗАЛЕТАЕТ",
    img: "/comic-book/panel05.png",
    alt: "Чёрный флагман на голографическом подиуме среди карточек каталога",
    accent: "cyan",
    caption: "Фото, цены, залоги, характеристики — каталог собран раньше, чем остыл кофе. Флагман уже на витрине.",
    bubbles: [
      {
        text: "X-Diavel — в сетку. Красавец.",
        kind: "hero",
        top: "60%",
        right: "6%",
        width: "30%",
      },
    ],
    sfx: { text: "БРРР!", color: "cyan", top: "68%", left: "6%", rotate: -5 },
  },
  {
    num: "06",
    title: "ДЕПЛОЙ",
    img: "/comic-book/panel06.png",
    alt: "Ракета стартует с ноутбука, над которым парит дашборд сайта",
    accent: "magenta",
    caption: "Сказал утром — вечером в проде. Сайт экипажа в сети, домен работает, витрина уже продаёт.",
    bubbles: [
      {
        text: "Это не аренда софта. Это мой актив.",
        kind: "hero",
        top: "58%",
        right: "6%",
        width: "32%",
      },
    ],
    sfx: { text: "ПУШ!", color: "yellow", top: "10%", right: "8%", rotate: 8 },
  },
  {
    num: "07",
    title: "КЛИЕНТ АРЕНДОВАЛ",
    img: "/comic-book/panel07.png",
    alt: "Клиент жмёт «Арендовать» в веб-приложении — Рустам получает уведомление",
    accent: "cyan",
    caption:
      "Никаких переписок с ботом — мы не даём клиентам чатиться, сайт продаёт сам. Клиент открыл веб-приложение, выбрал байк и арендовал. Уведомление прилетает Рустаму.",
    bubbles: [
      {
        text: "Сайт продаёт, пока я сплю. Так... что там с флагманом?",
        kind: "hero",
        top: "64%",
        left: "5%",
        width: "32%",
      },
    ],
    sfx: { text: "ДЗЫНЬ!", color: "cyan", top: "70%", right: "5%", rotate: -7 },
  },
  {
    num: "08",
    title: "ВЫДАЧА",
    img: "/comic-book/panel08.png",
    alt: "Рустам передаёт ключи райдеру, над байком светится QR-код",
    accent: "magenta",
    caption: "QR-код, ключи, рукопожатие. Договор уже подписан, депозит уже на месте, бумагами занимается бот-клерк /doc.",
    bubbles: [
      {
        text: "Приятного сезона, боец.",
        kind: "hero",
        top: "12%",
        right: "6%",
        width: "28%",
      },
    ],
    sfx: { text: "ЩЁЛК!", color: "yellow", top: "58%", right: "8%", rotate: 6 },
  },
];

// Панель 07: поверх пустого баннера на картинке кладём код-уведомление.
const RENT_NOTIFICATION = {
  app: "ЭКИПАЖ LEORUS · веб-приложение",
  title: "НОВАЯ АРЕНДА",
  body: "X-Diavel · 3 дня · депозит принят",
};

export default function ComicBookClient() {
  const pageRef = useRef<HTMLDivElement>(null);
  // Класс cb-js ставится только когда JS реально работает: без него панели
  // никогда не прячутся (no-JS и полностраничные скриншоты видят весь комикс).
  const [jsReady, setJsReady] = useState(false);

  useEffect(() => {
    setJsReady(true);
    // Панели «проявляются» при скролле — как будто их оттушевали на глазах.
    const root = pageRef.current;
    if (!root) return;
    const frames = root.querySelectorAll(".cb-panel");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    frames.forEach((frame) => io.observe(frame));
    // Страховка: через 2.5s весь комикс виден независимо от скролла —
    // боты, полноразмерные скриншоты и странные окружения не теряют контент.
    const failsafe = setTimeout(() => {
      frames.forEach((frame) => frame.classList.add("is-visible"));
    }, 2500);
    return () => {
      clearTimeout(failsafe);
      io.disconnect();
    };
  }, []);

  return (
    <div className={`cb-root${jsReady ? " cb-js" : ""}`} ref={pageRef}>
      {/* ── мачта комикса ─────────────────────────────────────────────── */}
      <header className="cb-masthead">
        <a className="cb-masthead__brand" href="/">
          VIBERIDER<span> · PLATFORM</span>
        </a>
        <span className="cb-masthead__issue">ВЫПУСК №1 · СЕЗОН 2026</span>
        <a className="cb-masthead__cta" href="/salavey13">
          Подключить экипаж
        </a>
      </header>

      {/* ── обложка ───────────────────────────────────────────────────── */}
      <section className="cb-cover" aria-label="Обложка комикса">
        <div className="cb-cover__frame cb-halftone">
          <img
            src="/comic-book/cover.png"
            alt="Рустам — герой комикса — стоит с телефоном и электромотоциклом на фоне неонового города"
            className="cb-cover__art"
          />
          <div className="cb-cover__title-wrap">
            <span className="cb-cover__kicker">комикс · основан на реальных событиях</span>
            <h1 className="cb-cover__title">
              <span>КАК РУСТАМ</span>
              <span>СВОЙ ЭКИПАЖ</span>
              <span className="cb-cover__title--accent">СОБРАЛ</span>
            </h1>
            <p className="cb-cover__sub">
              История одного вечера: от приглашения в ночь до первой аренды через
              веб-приложение. Всё, что нарисовано, — реально работает на платформе.
            </p>
          </div>
          <div className="cb-cover__price" aria-hidden="true">
            <span>ЦЕНА ВОПРОСА:</span>
            <b>10 минут вечера</b>
          </div>
        </div>
      </section>

      {/* ── панели ────────────────────────────────────────────────────── */}
      <main className="cb-page">
        {PANELS.map((panel) => (
          <figure
            key={panel.num}
            className={`cb-panel cb-panel--${panel.accent}`}
          >
            <span className="cb-panel__num" aria-hidden="true">
              {panel.num}/08
            </span>
            <h2 className="cb-panel__title">{panel.title}</h2>

            <div className="cb-panel__frame">
              <img src={panel.img} alt={panel.alt} loading="lazy" />

              <span className="cb-caption">{panel.caption}</span>

              {panel.num === "07" && (
                <div className="cb-notify" role="status">
                  <span className="cb-notify__app">{RENT_NOTIFICATION.app}</span>
                  <span className="cb-notify__title">{RENT_NOTIFICATION.title}</span>
                  <span className="cb-notify__body">{RENT_NOTIFICATION.body}</span>
                </div>
              )}

              {panel.bubbles?.map((bubble) => (
                <span
                  key={bubble.text}
                  className={`cb-bubble cb-bubble--${bubble.kind}`}
                  style={{
                    top: bubble.top,
                    left: bubble.left,
                    right: bubble.right,
                    width: bubble.width,
                  }}
                >
                  {bubble.text}
                </span>
              ))}

              {panel.sfx && (
                <span
                  className={`cb-sfx cb-sfx--${panel.sfx.color}`}
                  style={{
                    top: panel.sfx.top,
                    left: panel.sfx.left,
                    right: panel.sfx.right,
                    transform: `rotate(${panel.sfx.rotate}deg)`,
                  }}
                  aria-hidden="true"
                >
                  {panel.sfx.text}
                </span>
              )}
            </div>
          </figure>
        ))}

        {/* ── финал ───────────────────────────────────────────────────── */}
        <figure className="cb-panel cb-panel--cyan cb-final">
          <span className="cb-panel__num" aria-hidden="true">
            финал
          </span>
          <h2 className="cb-panel__title">ТВОЙ ХОД</h2>
          <div className="cb-panel__frame">
            <img
              src="/comic-book/final.png"
              alt="Рустам ведёт экипаж через мост на рассвете"
              loading="lazy"
            />
            <span className="cb-caption">
              Сезон 2026. Экипаж в сети, катает и приносит деньги. Утром сказал —
              вечером в проде. Дальше по сценарию — ты.
            </span>
          </div>
          <figcaption className="cb-final__cta">
            <a className="cb-final__btn" href="/salavey13">
              Собрать свой экипаж →
            </a>
            <a className="cb-final__ghost" href="/franchize/discovery">
              Посмотреть, кто уже варится
            </a>
          </figcaption>
        </figure>
      </main>

      {/* ── колофон ───────────────────────────────────────────────────── */}
      <footer className="cb-colophon">
        <p>
          Выпуск №1 · панели нарисованы AI · реплики, титры и SFX наложены кодом ·
          клиенты не переписываются с ботом — сайт продаёт сам, у каждого в
          экипаже личный zai-агент.
        </p>
        <nav aria-label="Комикс-навигация">
          <a href="/">На главную</a>
          <a href="/salavey13">Как это устроено</a>
          <a href="/leorus">Экипаж LEORUS</a>
        </nav>
      </footer>
    </div>
  );
}
