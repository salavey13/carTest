"use client";

// /app/readme/ReadmeComicClient.tsx
// ─────────────────────────────────────────────────────────────────────────────
// README КАК ВЫПУСК КОМИКСА (task187, 2026-11-14) — «create README in comics
// style using comics engine we created ;) /readme».
//
// Тот же движок CB CINE (CineEngine + comic-book.css), что и у трилогии на
// /comic-book, но кадры — это документация репозитория: главы про платформу,
// кухню денег/бумаг и франшизу. Все факты — из README.MD и worklog (ни одного
// выдуманного модуля). Панели — 9 новых AI-картинок r*.webp + cameo pdj.webp
// из выпуска №1 (LEORUS — «движок тот же»), финал — final.webp.
// Правила v12 соблюдены: интервал панелей PANEL_STAGGER_S (2.1s), текст
// стопки СВЕРХУ ВНИЗ (нотиф → терминал → пузыри → каптион, шаг 0.4s,
// старт 1.15s), ttl под контент. Звука в выпуске нет — тумблер остался
// в трилогии; спокойный режим — ?calm=1 (как в v11).
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import CineEngine, { PANEL_STAGGER_S, type CineSceneDef } from "../comic-book/CineEngine";
import "../comic-book/comic-book.css";

type Sfx = { text: string; color: "cyan" | "magenta" | "gold"; rotate: number };
type Notify = { app: string; title: string; body: string };

type Panel = {
  num: string;
  title: string;
  img?: string;
  alt: string;
  accent: "cyan" | "magenta" | "gold";
  caption?: string;
  bubbles?: { text: string; kind: "hero" | "agent" | "notify-cyan" }[];
  notify?: Notify;
  sfx?: Sfx;
  terminal?: string[];
};

// ── анимационные примитивы: те же правила v12, что у трилогии ──────────────
// Pop/Drop — простые элементы: вход ведёт CSS-каскад по --ink-d (без framer —
// урок v12: JS-спринги на входах кадров были невидимой работой main thread).
const Pop = ({
  children,
  style,
  className,
}: {
  children: ReactNode;
  style?: React.CSSProperties;
  className?: string;
}) => (
  <span className={className} style={style}>
    {children}
  </span>
);

const Drop = ({ children, style }: { children: ReactNode; style?: React.CSSProperties }) => (
  <div className="cb-notify-wrap" style={style} role="status">
    {children}
  </div>
);

const ink = (base: React.CSSProperties, d: string): React.CSSProperties =>
  ({ ...base, "--ink-d": `calc(${d} * var(--ink-pace, 1))` }) as React.CSSProperties;

// стопка текста панели — СВЕРХУ ВНИЗ по DOM-порядку (v12: босс «text appears
// in reverse order» — каскад идёт нотиф → терминал → пузыри → каптион)
const sfxNode = (panel: Panel, k: number) =>
  panel.sfx ? (
    <span
      className={`cb-sfx cb-sfx--${panel.sfx.color}`}
      style={
        ink(
          {
            "--rot": `${panel.sfx.rotate}deg`,
            transform: `rotate(${panel.sfx.rotate}deg)`,
          } as React.CSSProperties,
          `${(1.0 + k * PANEL_STAGGER_S).toFixed(2)}s`,
        ) as React.CSSProperties
      }
      aria-hidden="true"
    >
      {panel.sfx.text}
    </span>
  ) : null;

const panelStack = (panel: Panel, k: number) => {
  let step = 0;
  const d = () => `${(1.15 + k * PANEL_STAGGER_S + step++ * 0.4).toFixed(2)}s`;
  return (
    <>
      {panel.notify && (
        <Drop style={ink({}, d())}>
          <div className="cb-notify">
            <span className="cb-notify__app">{panel.notify.app}</span>
            <span className="cb-notify__title">{panel.notify.title}</span>
            <span className="cb-notify__body">{panel.notify.body}</span>
          </div>
        </Drop>
      )}
      {panel.terminal && (
        <div className="cb-terminal" style={ink({}, d())}>
          {panel.terminal.map((line) => (
            <span key={line} className="cb-terminal__line">
              {line}
            </span>
          ))}
          <span className="cb-terminal__cursor" aria-hidden="true" />
        </div>
      )}
      {panel.bubbles?.map((bubble) => (
        <Pop key={bubble.text} className={`cb-bubble cb-bubble--${bubble.kind}`} style={ink({}, d())}>
          {bubble.text}
        </Pop>
      ))}
      {panel.caption && (
        <p className="cb-caption" style={ink({}, d())}>
          {panel.caption}
        </p>
      )}
    </>
  );
};

export default function ReadmeComicClient() {
  const [jsReady, setJsReady] = useState(false);
  const [auto, setAuto] = useState(false); // HUD ▶ — автоплей без звука
  const restartRef = useRef<(() => void) | null>(null);
  // v11-правило: ОС-настройка prefers-reduced-motion НЕ глушит кино —
  // спокойный режим только вручную: ?calm=1
  const [calm] = useState(
    () =>
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).has("calm"),
  );

  useEffect(() => {
    setJsReady(true);
  }, []);

  const pauseAuto = useCallback(() => setAuto(false), []);

  // панель данных → CinePanelDef (движок рисует колонку разворота)
  const panelDef = (panel: Panel, k: number) => ({
    key: panel.num,
    num: panel.num,
    title: panel.title,
    accent: panel.accent,
    img: panel.img,
    alt: panel.alt,
    node: panelStack(panel, k),
    sfx: sfxNode(panel, k),
  });

  const dividerDef = (
    id: string,
    tag: string,
    title: string,
    sub: string,
    accent: "cyan" | "magenta" | "gold",
    ghost: string,
  ): CineSceneDef => ({
    id,
    title,
    accent,
    kind: "splash",
    chrome: false,
    ttl: 5400,
    node: (
      <div className="cb-cinediv" style={ink({}, "0.25s")} data-ghost={ghost}>
        <span className="cb-cinediv__tag" style={ink({}, "0.6s")}>{tag}</span>
        <span className="cb-cinediv__title" style={ink({}, "1s")}>{title}</span>
        <span className="cb-cinediv__sub" style={ink({}, "1.45s")}>{sub}</span>
      </div>
    ),
  });

  const rowDef = (
    id: string,
    title: string,
    accent: "cyan" | "magenta" | "gold",
    panels: Panel[],
    ttl = 9400,
  ): CineSceneDef => ({
    id,
    title,
    accent,
    kind: "row",
    ttl,
    chrome: false,
    panels: panels.map(panelDef),
  });

  // ════════════════════════════════════════════════════════════════════════
  // README · ТЕХНИЧЕСКИЙ ВЫПУСК — кадры-главы. Все факты из README.MD:
  // Telegram-first платформа (мини-апп @oneBikePlsBot), витрины из
  // crews.metadata/THEME_CONFIG, бот закрывает операционку, один движок
  // денег (computePartnerSplit, отменённые ≠ доход), DOCX-документы,
  // аналитика с сверами, 6 витрин с общей ДНК, клон → Supabase → Vercel
  // (184 миграции), гайд OWN_LANDING_OWN_BOT_RU.
  // ════════════════════════════════════════════════════════════════════════
  const scenes: CineSceneDef[] = useMemo(
    () => [
      // ── обложка выпуска ──────────────────────────────────────────────────
      {
        id: "rcover",
        title: "README",
        img: "/comic-book/rcover.webp",
        alt: "Мотцикл в мастерской среди парящих комикс-панелей и терминалов",
        accent: "cyan",
        kind: "splash",
        contain: true,
        chrome: false,
        ttl: 8800,
        overlay: (
          <span
            className="cb-cover__cue cb-cover__cue--overlay"
            aria-hidden="true"
            style={ink({}, "2.9s")}
          >
            <i>▼</i> скролл — камера едет, следующий кадр уже выезжает
          </span>
        ),
        node: (
          <div className="cb-cinecover" style={ink({}, "0.2s")}>
            <span className="cb-cover__kicker" style={ink({}, "0.6s")}>
              VIBERIDER PLATFORM · README · технический выпуск
            </span>
            <h1 className="cb-cover__title" style={ink({}, "0.45s")}>
              {["КАК УСТРОЕН", "ЭТОТ", "РЕПОЗИТОРИЙ"].map((word, i) => (
                <Pop
                  key={word}
                  className={`cb-cover__line${word === "РЕПОЗИТОРИЙ" ? " cb-cover__line--accent" : ""}`}
                  style={ink({}, `${(0.95 + i * 0.3).toFixed(2)}s`)}
                >
                  {word}
                </Pop>
              ))}
            </h1>
            <p className="cb-cover__sub" style={ink({}, "2s")}>
              README, начитанный как выпуск комикса: три главы — платформа,
              кухня денег и франшиза. Всё нарисовано AI, всё написано кодом,
              всё реально работает.
            </p>
            <div className="cb-cover__price" aria-hidden="true" style={ink({}, "2.4s")}>
              <span>СТЕК ВЫПУСКА:</span>
              <b>Telegram · Next.js · Supabase</b>
            </div>
            <span className="cb-cover__cue" aria-hidden="true" style={ink({}, "2.9s")}>
              <i>▼</i> скролл — камера едет
            </span>
          </div>
        ),
      },

      // ── ГЛАВА 1: платформа ───────────────────────────────────────────────
      dividerDef("r-ep1", "/// ГЛАВА 1 ///", "ПРИЁМ: ЧТО ЭТО ЗА ПЛАТФОРМА", "Telegram-first: витрина, CRM и боты в одном мессенджере", "cyan", "R"),
      rowDef("r-rowA", "СВОЙ БОТ · КАТАЛОГ · ОПЕРАЦИОНКА", "cyan", [
        {
          num: "R·01",
          title: "СВОЙ БОТ — СВОЁ ПРИЛОЖЕНИЕ",
          img: "/comic-book/rmini.webp",
          alt: "Райдер открывает Telegram мини-апп, из телефона вылетает бумажный самолётик",
          accent: "cyan",
          caption: "Всё живёт внутри Telegram: мини-апп @oneBikePlsBot — и ты уже в CRM экипажа. Никаких отдельных приложений и паролей.",
          bubbles: [{ text: "Мини-апп в меню бота — витрина, CRM и бот в одном чате.", kind: "hero" }],
          sfx: { text: "ДЗЫНЬ!", color: "cyan", rotate: -7 },
        },
        {
          num: "R·02",
          title: "ВИТРИНА ИЗ МЕТАДАННЫХ",
          img: "/comic-book/rcat.webp",
          alt: "Стена мотоциклов в голографических подиумах с парящими ценниками",
          accent: "magenta",
          caption: "Витрина экипажа собирается из crews.metadata: палитра, состав, контакты. Новая витрина — запись в THEME_CONFIG, ноль нового серверного кода.",
          bubbles: [{ text: "Фирменные цвета на автомате. Код не трогаем.", kind: "hero" }],
          sfx: { text: "ПАУ!", color: "yellow", rotate: 7 },
        },
        {
          num: "R·03",
          title: "БОТ ЗАКРЫВАЕТ ОПЕРАЦИОНКУ",
          img: "/comic-book/rbotclerk.webp",
          alt: "Робот-клерк в наушниках разбирает стопку документов, прилетают бумажные самолётики",
          accent: "cyan",
          caption: "Смены, документы (docx), отчёты, /testdrive, /salary — операционку ведёт бот, экипаж занимается байками и клиентами.",
          terminal: ["$ /shift", "$ /salary", "$ /testdrive", "> операционка закрыта"],
          sfx: { text: "ЩЁЛК!", color: "cyan", rotate: -6 },
        },
      ]),

      // ── ГЛАВА 2: деньги и бумаги ─────────────────────────────────────────
      dividerDef("r-ep2", "/// ГЛАВА 2 ///", "КУХНЯ: ДЕНЬГИ И БУМАГИ", "один движок расчёта · отменённые аренды — никогда не доход", "magenta", "₽"),
      rowDef("r-rowB", "СПЛИТ · ДОКУМЕНТЫ · СВЕРКА", "magenta", [
        {
          num: "R·04",
          title: "СПЛИТ БЕЗ СЮРПРИЗОВ",
          img: "/comic-book/rmoney.webp",
          alt: "Два сейфа — партнёр и компания — и конвейер монет, серые монеты падают в шредер с нулём",
          accent: "gold",
          caption: "Дисциплина денег: один движок computePartnerSplit делит доход партнёр/компания. Отменённые аренды в доходе не считаются никогда — ноль выдуманных рублей.",
          terminal: ["computePartnerSplit(rental)", "> партнёр ← доля → компания", "> отменённые: 0 ₽"],
          sfx: { text: "ЧАК!", color: "gold", rotate: 6 },
        },
        {
          num: "R·05",
          title: "БУМАГИ ВЕДЁТ КЛЕРК",
          img: "/comic-book/rdocs.webp",
          alt: "Робот-клерк ставит огромную печать на стопку договоров",
          accent: "cyan",
          caption: "DOCX-генерация прямо из карточки: договоры аренды и продажи, тест-драйвы, субаренда, КП. У каждого артефакта — статус и история согласования.",
          bubbles: [{ text: "Договор собран. Печать на месте. Депозит учтён.", kind: "hero" }],
          sfx: { text: "БУМ!", color: "cyan", rotate: -6 },
        },
        {
          num: "R·06",
          title: "АНАЛИТИКА С ВЕРИФИКАЦИЕЙ",
          img: "/comic-book/ranalytics.webp",
          alt: "Стена дашборда с графиками и чипами-галочками, лупа подсвечивает график",
          accent: "magenta",
          caption: "Аналитика аренд с парольным входом по TTL: KPI, разделение партнёр/компания, сверки аренд. Считает платформа, а не калькулятор в чате.",
          notify: {
            app: "VIP BIKE · аналитика",
            title: "СВЕРКА СОШЛАСЬ",
            body: "Falcon GT · смена закрыта · ✅",
          },
          sfx: { text: "ДЗЫНЬ!", color: "magenta", rotate: -7 },
        },
      ]),

      // ── ГЛАВА 3: франшиза ────────────────────────────────────────────────
      dividerDef("r-ep3", "/// ГЛАВА 3 ///", "ФРАНШИЗА: КЛОН → ДЕПЛОЙ", "fork → свой Supabase → бот у @BotFather → Vercel", "gold", "F"),
      rowDef("r-rowC", "ВИТРИНЫ · ДЕПЛОЙ · КАМЕО", "gold", [
        {
          num: "R·07",
          title: "ШЕСТЬ ВИТРИН — ОДНА ДНК",
          img: "/comic-book/rmap.webp",
          alt: "Неоновая карта города с шестью светящимися точками-витринами, соединёнными маршрутами",
          accent: "cyan",
          caption: "vip-bike, moto-selection, sly13, LEORUS, georg-electro, mototehnn: общая сетка hero → услуги → портфолио → форма. Заявка уходит своему экипажу.",
          bubbles: [{ text: "Один движок — шесть магазинов.", kind: "hero" }],
          sfx: { text: "ВЖУХ!", color: "cyan", rotate: -7 },
        },
        {
          num: "R·08",
          title: "КЛОН → ДЕПЛОЙ ЗА ВЕЧЕР",
          img: "/comic-book/rdeploy.webp",
          alt: "Ноутбук с деревом веток и огромная кнопка запуска, ракета стартует с экрана",
          accent: "gold",
          caption: "Fork репозитория → свой Supabase → бот у @BotFather → Vercel с env → мини-апп в твоём боте. Заявки приходят уже от твоего бота.",
          terminal: ["$ supabase db push", "> 184 миграции … OK", "$ vercel --prod", "> готово к сезону"],
          notify: {
            app: "Гайд · docs/OWN_LANDING_OWN_BOT_RU.md",
            title: "СВОЙ ЛЕНДИНГ — СВОЙ БОТ",
            body: "пошагово, с таблицей граблей",
          },
          sfx: { text: "ПУШ!", color: "gold", rotate: 8 },
        },
        {
          num: "R·09",
          title: "ТЕСТ НА ГЛЮК (КАМЕО)",
          img: "/comic-book/pdj.webp",
          alt: "Камео из выпуска №1: Рустам за диджейским пультом на главном фестивальном экране",
          accent: "magenta",
          caption: "Подставь другой каталог — получишь другой бизнес: движок тот же. Уже проверено в выпуске №1 — ивент-агентство LEORUS живёт на этом же репо.",
          bubbles: [{ text: "Арендуй не байк. Арендуй движок.", kind: "hero" }],
          sfx: { text: "ГЛЮК?!", color: "gold", rotate: 6 },
        },
      ]),

      // ── финал выпуска: дорога дальше (cameo финала трилогии) ─────────────
      {
        id: "r-finale",
        title: "ДОРОГА ДАЛЬШЕ",
        num: "fin",
        img: "/comic-book/final.webp",
        alt: "Рустам ведёт экипаж через мост на рассвете — камео финала трилогии",
        accent: "cyan",
        kind: "splash",
        ttl: 9500,
        node: (
          <>
            <Pop
              className="cb-caption"
              style={ink({ maxWidth: "min(560px, 44%)", top: "26%", left: "4%" }, "1.2s")}
            >
              Это весь README: Telegram-first платформа, честная кухня денег,
              франшиза с клоном за вечер. Остальное — в коде, worklog и живом
              каталоге. Дальше по сценарию — ты.
            </Pop>
            <div className="cb-scene__cta" style={ink({}, "2.6s")}>
              <a className="cb-final__btn" href="/comic-book">
                Читать трилогию комикса →
              </a>
              <a className="cb-final__ghost" href="/salavey13">
                Витрина флагмана
              </a>
              <a
                className="cb-final__ghost"
                href="https://github.com/salavey13/carTest/blob/main/docs/OWN_LANDING_OWN_BOT_RU.md"
              >
                Гайд: свой лендинг — свой бот
              </a>
            </div>
            <p
              className="cb-trilogy__fine"
              style={ink({ position: "absolute", bottom: "3%", left: "4%" }, "3.2s")}
            >
              выпуск README · сценарий, код, панели — zai-агент VIP BIKE ·
              иллюстрации — AI · факты — README.MD и worklog, ни одного
              выдуманного модуля
            </p>
          </>
        ),
      },
    ],
    [jsReady],
  );

  return (
    <div className={`cb-root${jsReady ? " cb-js" : ""}`}>
      {/* ── мачта выпуска (в cine — фиксированная плашка) ─────────────────── */}
      <header className="cb-masthead">
        <a className="cb-masthead__brand" href="/">
          VIBERIDER<span> · PLATFORM</span>
        </a>
        <span className="cb-masthead__issue">README · ТЕХНИЧЕСКИЙ ВЫПУСК</span>
        <a className="cb-masthead__cta" href="/salavey13">
          Подключить экипаж
        </a>
      </header>

      {/* ── CB CINE: кадры + HUD; без JS — статичный вебтун ───────────────── */}
      <CineEngine
        scenes={scenes}
        active={jsReady}
        reduceMotion={calm}
        restartRef={restartRef}
        auto={auto}
        onAutoToggle={() => setAuto((v) => !v)}
        onAutoInterrupt={pauseAuto}
        onAutoEnd={pauseAuto}
      />
    </div>
  );
}
