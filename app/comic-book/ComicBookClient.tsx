"use client";

// /app/comic-book/ComicBookClient.tsx
// ─────────────────────────────────────────────────────────────────────────────
// КОМИКС «КАК РУСТАМ СВОЙ ЭКИПАЖ СОБРАЛ» — выпуск №1, версия 2.0 (task180).
//
// v1 (task179): 8 панелей про сборку байк-экипажа, текст наложен кодом.
// v2 (task180, 2026-11-12) по брифу босса:
//  • X-Diavel → Falcon Lynx (босс переименовал флагман);
//  • GLITCH-арка «секретный уровень»: комикс глючит из байков в ЛЮБОЙ
//    бизнес — второй экипаж Рустама LEORUS, «арендуй не байк — арендуй
//    меня» (DJ-выступления тем же движком: каталог, бронь, депозит);
//  • вишенка в стиле Cavill «one last thing» — кнопка MUSTACHE PROTOCOL:
//    усы пружиной вылетают на лица всех панелей, SFX пускаются в пляс;
//  • баллоны переезжают с лиц на пустоты (карта по контакт-листу);
//  • десктоп увеличен (~1060px колонка), clamp-адаптив;
//  • framer-motion: прогресс-бар скролла, пружинные панельки, pop пузырей,
//    drop уведомлений, глитч-джиттер, stagger заголовка обложки.
// Референс героя — founder-rustam.jpg из /leorus hero (task179).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AnimatePresence,
  motion,
  useScroll,
  useSpring,
} from "framer-motion";
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

type Notify = {
  app: string;
  title: string;
  body: string;
  top: string;
  left?: string;
  right?: string;
  width: string;
};

type Stache = {
  top: string;
  left: string;
  width: string;
  rotate: number;
};

type Panel = {
  num: string;
  title: string;
  img: string;
  alt: string;
  accent: "cyan" | "magenta" | "gold";
  caption: string;
  captionWidth: string;
  bubbles?: Bubble[];
  notify?: Notify;
  sfx?: Sfx;
  terminal?: string[];
  stache?: Stache;
};

// ── позиции выверены по контакт-листу: ни один баллон не сидит на лице ──────
const PANELS: Panel[] = [
  {
    num: "01",
    title: "ЗВОНОК В НОЧЬ",
    img: "/comic-book/panel01.png",
    alt: "Рустам на крыше ночью смотрит в светящийся телефон",
    accent: "cyan",
    captionWidth: "46%",
    caption:
      "Нижний Новгород. Пятница. 23:47. Третий фестиваль сезона позади, смена закрыта. Телефон решает, что на сегодня ещё не всё.",
    bubbles: [
      {
        text: "Тебе открыт доступ к платформе. Собери свой экипаж.",
        kind: "notify-cyan",
        top: "56%",
        right: "4%",
        width: "30%",
      },
      {
        text: "Сначала гляну... а, ладно. СЕЙЧАС ГЛЯНУ.",
        kind: "hero",
        top: "62%",
        left: "4%",
        width: "30%",
      },
    ],
    sfx: { text: "ДЗЫНЬ!", color: "cyan", top: "9%", left: "33%", rotate: -8 },
    stache: { top: "19%", left: "65%", width: "10%", rotate: -8 },
  },
  {
    num: "02",
    title: "ОДНА КНОПКА",
    img: "/comic-book/panel02.png",
    alt: "Палец нажимает огромную неоновую кнопку на голографическом экране",
    accent: "magenta",
    captionWidth: "46%",
    caption:
      "Никаких ТЗ на сорок страниц. Никакой команды разработки. Одна кнопка — и платформа уже строит каркас экипажа.",
    bubbles: [
      {
        text: "«Создать экипаж». Ну, за кастомизацию!",
        kind: "hero",
        top: "62%",
        right: "6%",
        width: "30%",
      },
    ],
    sfx: { text: "КАЦ!", color: "yellow", top: "12%", right: "7%", rotate: 7 },
  },
  {
    num: "03",
    title: "ЛИЧНЫЙ ZAI",
    img: "/comic-book/panel03.png",
    alt: "Рустам пьёт кофе, пока голографический zai-агент собирает сайт",
    accent: "cyan",
    captionWidth: "42%",
    caption:
      "У каждого члена экипажа — личный bootstrapped zai-агент. Не общий чат-бот на всех, а свой, с ключами к своей базе.",
    bubbles: [
      {
        text: "Не отвлекайся, шеф. Деплой сам себя не сделает.",
        kind: "agent",
        top: "7%",
        left: "27%",
        width: "25%",
      },
      {
        text: "Он сайт собирает. Я кофе пью. Кто из нас тут продюсер?",
        kind: "hero",
        top: "60%",
        left: "4%",
        width: "30%",
      },
    ],
    stache: { top: "15%", left: "78%", width: "9%", rotate: 6 },
  },
  {
    num: "04",
    title: "БРЕНД-КУЗНИЦА",
    img: "/comic-book/panel04.png",
    alt: "Гигантский светящийся логотип влетает в неоновый билборд",
    accent: "magenta",
    captionWidth: "42%",
    caption:
      "Название, логотип, цвета, контакты — всё его. И всё это живёт в его репозитории, а не в чужом конструкторе.",
    bubbles: [
      {
        text: "LEORUS RIDES. Звучит как фест. Оставляю.",
        kind: "hero",
        top: "62%",
        left: "4%",
        width: "32%",
      },
    ],
    sfx: { text: "ВЖУХ!", color: "magenta", top: "6%", right: "4%", rotate: -6 },
    stache: { top: "20%", left: "61%", width: "11%", rotate: -5 },
  },
  {
    num: "05",
    title: "КАТАЛОГ ЗАЛЕТАЕТ",
    img: "/comic-book/panel05.png",
    alt: "Флагман Falcon Lynx на голографическом подиуме среди карточек каталога",
    accent: "cyan",
    captionWidth: "46%",
    caption:
      "Фото, цены, залоги, характеристики — каталог собран раньше, чем остыл кофе. Флагман уже на витрине.",
    bubbles: [
      {
        text: "Falcon Lynx — в сетку. Красавец.",
        kind: "hero",
        top: "62%",
        right: "5%",
        width: "30%",
      },
    ],
    sfx: { text: "БРРР!", color: "cyan", top: "64%", left: "5%", rotate: -5 },
  },
  {
    num: "06",
    title: "ДЕПЛОЙ",
    img: "/comic-book/panel06.png",
    alt: "Ракета стартует с ноутбука, над которым парит дашборд сайта",
    accent: "magenta",
    captionWidth: "40%",
    caption:
      "Сказал утром — вечером в проде. Сайт экипажа в сети, домен работает, витрина уже продаёт.",
    bubbles: [
      {
        text: "Это не аренда софта. Это мой актив.",
        kind: "hero",
        top: "56%",
        right: "5%",
        width: "32%",
      },
    ],
    sfx: { text: "ПУШ!", color: "yellow", top: "66%", left: "30%", rotate: 8 },
    stache: { top: "18%", left: "77%", width: "10%", rotate: 8 },
  },
  {
    num: "07",
    title: "КЛИЕНТ АРЕНДОВАЛ",
    img: "/comic-book/panel07.png",
    alt: "Клиент жмёт «Арендовать» в веб-приложении — Рустам получает уведомление",
    accent: "cyan",
    captionWidth: "48%",
    caption:
      "Никаких переписок с ботом — мы не даём клиентам чатиться, сайт продаёт сам. Клиент открыл веб-приложение, выбрал байк и арендовал. Уведомление прилетает Рустаму.",
    bubbles: [
      {
        text: "Сайт продаёт, пока я сплю. Так... что там с флагманом?",
        kind: "hero",
        top: "60%",
        left: "4%",
        width: "31%",
      },
    ],
    notify: {
      app: "LEORUS RIDES · веб-приложение",
      title: "НОВАЯ АРЕНДА",
      body: "Falcon Lynx · 3 дня · депозит принят",
      top: "16%",
      left: "58%",
      width: "38%",
    },
    sfx: { text: "ДЗЫНЬ!", color: "cyan", top: "68%", right: "4%", rotate: -7 },
    stache: { top: "25%", left: "59%", width: "10%", rotate: -6 },
  },
  {
    num: "08",
    title: "ВЫДАЧА",
    img: "/comic-book/panel08.png",
    alt: "Рустам передаёт ключи райдеру, над байком светится QR-код",
    accent: "magenta",
    captionWidth: "42%",
    caption:
      "QR-код, ключи, рукопожатие. Договор уже подписан, депозит уже на месте, бумагами занимается бот-клерк /doc.",
    bubbles: [
      {
        text: "Приятного сезона, боец.",
        kind: "hero",
        top: "60%",
        right: "5%",
        width: "28%",
      },
    ],
    sfx: { text: "ЩЁЛК!", color: "yellow", top: "66%", left: "5%", rotate: 6 },
    stache: { top: "20%", left: "69%", width: "9%", rotate: -10 },
  },
];

// ── секретный уровень: глюк в другой бизнес ────────────────────────────────
const GLITCH_PANELS: Panel[] = [
  {
    num: "GLITCH",
    title: "ТЕСТ НА ГЛЮК",
    img: "/comic-book/glitch.png",
    alt: "Каталог байков распадается на глитч-пиксели и собирается в сцену фестиваля",
    accent: "gold",
    captionWidth: "46%",
    caption:
      "Панель 07 вдруг заискрила. Не баг — фича: каталог — это просто список. Подставь другой список — получишь другой бизнес.",
    terminal: [
      "$ zai crew patch --catalog",
      "> bikes[]  → performances[]",
      "> движок: тот же",
      "> LEORUS.exe … ЗАПУЩЕН",
    ],
    sfx: { text: "ГЛЮК?!", color: "yellow", top: "7%", right: "5%", rotate: 6 },
  },
  {
    num: "LEORUS",
    title: "АРЕНДУЙ РУСТАМА",
    img: "/comic-book/dj.png",
    alt: "Рустам за диджейским пультом на главном фестивальном экране, толпа внизу",
    accent: "gold",
    captionWidth: "40%",
    caption:
      "Второй экипаж Рустама — ивент-агентство LEORUS. Тот же движок, но вместо байков — сцены и выступления.",
    bubbles: [
      {
        text: "Арендуй не байк. Арендуй меня.",
        kind: "hero",
        top: "68%",
        left: "4%",
        width: "28%",
      },
    ],
    notify: {
      app: "ЭКИПАЖ LEORUS · веб-приложение",
      title: "НОВАЯ БРОНЬ ВЫСТУПЛЕНИЯ",
      body: "DJ Rustam · 3 часа · предоплата принята",
      top: "38%",
      right: "4%",
      width: "36%",
    },
    sfx: { text: "БУМ!", color: "magenta", top: "6%", right: "4%", rotate: 8 },
    stache: { top: "21%", left: "41%", width: "9%", rotate: -6 },
  },
];

const FINAL_STACHE: Stache = { top: "19%", left: "45%", width: "9%", rotate: 5 };

// пружины framer-motion
const SPRING = { type: "spring" as const, stiffness: 210, damping: 17 };
const PANEL_SPRING = { type: "spring" as const, stiffness: 90, damping: 16 };

function Mustache({ width, rotate }: { width: string; rotate: number }) {
  return (
    <motion.svg
      viewBox="0 0 100 40"
      className="cb-stache"
      style={{ width, rotate }}
      initial={{ scale: 0, y: -14, opacity: 0 }}
      animate={{ scale: 1, y: 0, opacity: 1 }}
      exit={{ scale: 0, y: -10, opacity: 0, rotate: rotate - 25 }}
      transition={SPRING}
      aria-hidden="true"
    >
      <path
        d="M50 22 C40 8 20 6 8 16 C2 21 4 30 12 30 C22 30 30 24 38 26 C44 27.5 47 30 50 33 C53 30 56 27.5 62 26 C70 24 78 30 88 30 C96 30 98 21 92 16 C80 6 60 8 50 22 Z"
        fill="#0b0b0f"
        stroke="#f4f1ff"
        strokeWidth="2.5"
      />
    </motion.svg>
  );
}

export default function ComicBookClient() {
  // Класс cb-js ставится только когда JS реально работает: без него весь
  // комикс (и все оверлеи) виден статично — no-JS и скриншотеры не теряют
  // ни панели, ни тексты.
  const [jsReady, setJsReady] = useState(false);
  const [stacheMode, setStacheMode] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 24 });

  useEffect(() => {
    setJsReady(true);
    // Страховка: панели проявляются по CSS-наблюдателю (ниже), а таймер —
    // гарантия, что боты и полноразмерные скриншоты видят весь комикс.
    const root = pageRef.current;
    if (!root) return;
    const frames = root.querySelectorAll(".cb-panel");
    const failsafe = setTimeout(() => {
      frames.forEach((frame) => frame.classList.add("is-visible"));
    }, 2500);
    return () => clearTimeout(failsafe);
  }, []);

  // Проявление панелей при скролле: IntersectionObserver + CSS-классы.
  // (framer-motion отвечает за пружины внутри, CSS — за видимость панелей.)
  useEffect(() => {
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
      { threshold: 0.12 }
    );
    frames.forEach((frame) => io.observe(frame));
    return () => io.disconnect();
  }, []);

  // ── анимированные оверлеи (только при JS; без JS — статичные span) ──────
  const Pop = ({
    children,
    delay = 0,
    style,
    className,
  }: {
    children: ReactNode;
    delay?: number;
    style?: React.CSSProperties;
    className?: string;
  }) =>
    jsReady ? (
      <motion.span
        className={className}
        style={style}
        initial={{ opacity: 0, scale: 0.6, y: 12 }}
        whileInView={{ opacity: 1, scale: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ ...SPRING, delay }}
      >
        {children}
      </motion.span>
    ) : (
      <span className={className} style={style}>
        {children}
      </span>
    );

  const Drop = ({ children, style }: { children: ReactNode; style?: React.CSSProperties }) =>
    jsReady ? (
      <motion.div
        className="cb-notify-wrap"
        style={style}
        role="status"
        initial={{ opacity: 0, y: -26, rotate: -2 }}
        whileInView={{ opacity: 1, y: 0, rotate: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={SPRING}
      >
        {children}
      </motion.div>
    ) : (
      <div className="cb-notify-wrap" style={style} role="status">
        {children}
      </div>
    );

  const renderSfx = (panel: Panel) => {
    if (!panel.sfx) return null;
    const { text, color, top, left, right, rotate } = panel.sfx;
    const style: React.CSSProperties = { top, left, right };
    if (jsReady) {
      return (
        <motion.span
          className={`cb-sfx cb-sfx--${color}`}
          style={style}
          initial={{ opacity: 0, scale: 0.4, rotate: rotate - 14 }}
          whileInView={{ opacity: 1, scale: 1, rotate }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ ...SPRING, delay: 0.25 }}
          aria-hidden="true"
        >
          {text}
        </motion.span>
      );
    }
    return (
      <span
        className={`cb-sfx cb-sfx--${color}`}
        style={{ ...style, transform: `rotate(${rotate}deg)` }}
        aria-hidden="true"
      >
        {text}
      </span>
    );
  };

  // SFX в плясу при Mustache Protocol
  const renderDancingSfx = (panel: Panel) => {
    const node = renderSfx(panel);
    if (!node || !stacheMode || !jsReady || !panel.sfx) return node;
    const { rotate } = panel.sfx;
    return (
      <motion.span
        key="dance"
        className={(node.props as { className?: string }).className}
        style={(node.props as { style?: React.CSSProperties }).style}
        animate={{ rotate: [rotate, rotate + 7, rotate - 7, rotate], scale: [1, 1.08, 0.95, 1] }}
        transition={{ repeat: Infinity, duration: 0.7, ease: "easeInOut" }}
        aria-hidden="true"
      >
        {panel.sfx.text}
      </motion.span>
    );
  };

  const renderPanel = (panel: Panel, extraClass = "") => (
    <figure key={`${panel.num}-${panel.title}`} className={`cb-panel cb-panel--${panel.accent} ${extraClass}`}>
      <span className="cb-panel__num" aria-hidden="true">
        {panel.num}
      </span>
      <h2 className="cb-panel__title">{panel.title}</h2>

      <div className={`cb-panel__frame${panel.terminal ? " cb-panel__frame--glitch" : ""}`}>
        <img src={panel.img} alt={panel.alt} loading="lazy" />

        <Pop className="cb-caption" style={{ maxWidth: panel.captionWidth }}>
          {panel.caption}
        </Pop>

        {panel.terminal && (
          <Pop className="cb-terminal" style={{ top: "26%", left: "9%", width: "33%" }} delay={0.35}>
            {panel.terminal.map((line) => (
              <span key={line} className="cb-terminal__line">
                {line}
              </span>
            ))}
            <span className="cb-terminal__cursor" aria-hidden="true" />
          </Pop>
        )}

        {panel.notify && (
          <Drop
            style={{
              top: panel.notify.top,
              left: panel.notify.left,
              right: panel.notify.right,
              width: panel.notify.width,
            }}
          >
            <div className="cb-notify">
              <span className="cb-notify__app">{panel.notify.app}</span>
              <span className="cb-notify__title">{panel.notify.title}</span>
              <span className="cb-notify__body">{panel.notify.body}</span>
            </div>
          </Drop>
        )}

        {panel.bubbles?.map((bubble, i) => (
          <Pop
            key={bubble.text}
            delay={0.15 + i * 0.12}
            className={`cb-bubble cb-bubble--${bubble.kind}`}
            style={{ top: bubble.top, left: bubble.left, right: bubble.right, width: bubble.width }}
          >
            {bubble.text}
          </Pop>
        ))}

        {panel.stache && (
          <div className="cb-stache-wrap" style={{ top: panel.stache.top, left: panel.stache.left }}>
            <AnimatePresence>
              {stacheMode && <Mustache width={panel.stache.width} rotate={panel.stache.rotate} />}
            </AnimatePresence>
          </div>
        )}

        {renderDancingSfx(panel)}
      </div>
    </figure>
  );

  return (
    <div className={`cb-root${jsReady ? " cb-js" : ""}`} ref={pageRef}>
      {/* ── прогресс скролла (webtoon-ритм) ───────────────────────────── */}
      {jsReady && (
        <motion.div
          className="cb-progress"
          style={{ scaleX: progress }}
          aria-hidden="true"
        />
      )}

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
              {["КАК РУСТАМ", "СВОЙ ЭКИПАЖ", "СОБРАЛ"].map((word, i) => (
                <Pop key={word} delay={0.1 + i * 0.12} className={`cb-cover__line${word === "СОБРАЛ" ? " cb-cover__line--accent" : ""}`}>
                  {word}
                </Pop>
              ))}
            </h1>
            <p className="cb-cover__sub">
              История одного вечера: от приглашения в ночь до двух экипажей — байки
              катают, сцены гремят. Всё, что нарисовано, — реально работает на платформе.
            </p>
          </div>
          <div className="cb-stache-wrap" style={{ top: "28%", left: "45%" }}>
            <AnimatePresence>
              {stacheMode && <Mustache width="15%" rotate={-6} />}
            </AnimatePresence>
          </div>
          <div className="cb-cover__price" aria-hidden="true">
            <span>ЦЕНА ВОПРОСА:</span>
            <b>10 минут вечера</b>
          </div>
        </div>
      </section>

      {/* ── панели ────────────────────────────────────────────────────── */}
      <main className="cb-page">
        {PANELS.map((panel) => renderPanel(panel))}

        {/* ── секретный уровень: глюк в другой бизнес ─────────────────── */}
        <motion.div
          className="cb-glitch-strip"
          {...(jsReady
            ? {
                initial: { opacity: 0, x: 0 },
                whileInView: { opacity: 1, x: [0, -7, 6, -4, 0] },
                viewport: { once: true, amount: 0.6 },
                transition: { duration: 0.45, times: [0, 0.3, 0.6, 0.85, 1] },
              }
            : {})}
        >
          <span className="cb-glitch-strip__tag">/// СЕКРЕТНЫЙ УРОВЕНЬ ///</span>
          <span className="cb-glitch-strip__text">
            сигнал потерян... найден другой каталог
          </span>
        </motion.div>

        {GLITCH_PANELS.map((panel) => renderPanel(panel))}

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
            <Pop className="cb-caption" style={{ maxWidth: "44%" }}>
              Один вечер — два экипажа: байки катают, сцены гремят. Один движок —
              любой бизнес. Дальше по сценарию — ты.
            </Pop>
            <div className="cb-stache-wrap" style={{ top: FINAL_STACHE.top, left: FINAL_STACHE.left }}>
              <AnimatePresence>
                {stacheMode && <Mustache width={FINAL_STACHE.width} rotate={FINAL_STACHE.rotate} />}
              </AnimatePresence>
            </div>
          </div>
          <figcaption className="cb-final__cta">
            <motion.a
              className="cb-final__btn"
              href="/salavey13"
              {...(jsReady
                ? { whileHover: { scale: 1.05, rotate: -1.2 }, whileTap: { scale: 0.96 } }
                : {})}
            >
              Собрать свой экипаж →
            </motion.a>
            <a className="cb-final__ghost" href="/franchize/discovery">
              Посмотреть, кто уже варится
            </a>
            <a className="cb-final__ghost" href="/leorus">
              Экипаж LEORUS
            </a>
          </figcaption>
        </figure>

        {/* ── вишенка: one last thing ─────────────────────────────────── */}
        <div className="cb-lastthing">
          <button
            type="button"
            className="cb-lastthing__btn"
            onClick={() => setStacheMode((v) => !v)}
            aria-pressed={stacheMode}
          >
            {stacheMode ? "сдать усы в депозит" : "...одно последнее дело (привет, Кавилл)"}
          </button>
          <AnimatePresence>
            {stacheMode && (
              <motion.p
                className="cb-lastthing__hint"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={SPRING}
              >
                MUSTACHE PROTOCOL АКТИВИРОВАН: усы выдаются в VIP BIKE вместе с
                ключами. SFX танцуют — это норма.
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* ── колофон ───────────────────────────────────────────────────── */}
      <footer className="cb-colophon">
        <p>
          Выпуск №1 · панели нарисованы AI · реплики, титры и SFX наложены кодом ·
          клиенты не переписываются с ботом — сайт продаёт сам, у каждого в
          экипаже личный zai-агент · один движок — любой бизнес: байки, сцены,
          твой черёд.
        </p>
        <nav aria-label="Комикс-навигация">
          <a href="/">На главную</a>
          <a href="/salavey13">Как это устроено</a>
          <a href="/leorus">Экипаж LEORUS</a>
          <a href="/franchize/discovery">Кто уже варится</a>
        </nav>
      </footer>
    </div>
  );
}
