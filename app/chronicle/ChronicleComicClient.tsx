"use client";

// /app/chronicle/ChronicleComicClient.tsx
// ─────────────────────────────────────────────────────────────────────────────
// ХРОНИКА ОДНОЙ АРЕНДЫ (task189, 2026-11-15) — выпуск №3 комикс-вселенной
// (босс: «think what else can be described as comics and create it ;)»).
//
// Тот же движок CB CINE (CineEngine + comic-book.css). Формат: СУТКИ ЖИЗНИ
// ОДНОЙ АРЕНДЫ по таймкодам — тап в мини-аппе (09:41) → карточка и договор
// (09:47–09:52) → депозит (11:03) → дорога (14:20) → возврат (19:45) →
// депозит вернулся и отзыв (21:10) → сплит (21:30) → зарплата и сверка
// (23:00). Все факты — README.MD/worklog: QR-claim, DOCX из карточки,
// deposit_entries, live_status riding, продление в два тапа, отзывы,
// computePartnerSplit (отменённые ≠ доход), /salary, сверка ✅.
//
// Номера панелей — САМИ ТАЙМКОДЫ (бейдж 09:41 и т.д.), сквозные герои:
// райдер в шлеме, бот-клерк, чёрный naked-байк. Камео кадров из выпуска
// №2: rbotclerk (договоры) и rmoney (сплит — «тот же движок»).
//
// Динамика: панель C·02 — интерактивный флип-телефон (тап → карточка
// аренды), в автоплее курсор-актёр сам жмёт его (auto: data-claim-flip).
// Флип на чистом CSS-transition (урок v12: framer на входах — лишняя
// работа main thread); CSS-классы cb-phone переиспользованы из трилогии.
//
// Звука в выпуске нет — тумблер остался в трилогии; спокойный режим —
// ?calm=1. Уроки task188 соблюдены: подсказка про скролл ОДНА (родной
// HUD-hint движка), колофон финала в потоке CTA-стопки.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import CineEngine, { PANEL_STAGGER_S, type CineSceneDef } from "../comic-book/CineEngine";
import "../comic-book/comic-book.css";

type Sfx = { text: string; color: "cyan" | "magenta" | "gold" | "yellow"; rotate: number };
type Notify = { app: string; title: string; body: string };

type Panel = {
  num: string; // таймкод кадра: 09:41, 11:03…
  title: string;
  img?: string;
  alt: string;
  accent: "cyan" | "magenta" | "gold";
  caption?: string;
  bubbles?: { text: string; kind: "hero" | "agent" | "notify-cyan" }[];
  notify?: Notify;
  sfx?: Sfx;
  terminal?: string[];
  phone?: boolean; // вместо картинки — интерактивный флип-телефон (ClaimPhone)
};

// ── анимационные примитивы: те же правила v12, что у трилогии и README ─────
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

// стопка текста панели — СВЕРХУ ВНИЗ по DOM-порядку (v12)
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

// ── флип-телефон панели 09:47: тап — «оформить» → карточка аренды ───────────
// Классы cb-phone переиспользованы из трилогии (comic-book.css); флип —
// CSS-transition на inner (без framer, урок v12). Атрибут data-claim-flip —
// за него дёргает курсор-актёр в автоплее (auto-действие сцены).
function ClaimPhone() {
  const [flipped, setFlipped] = useState(false);
  return (
    <button
      type="button"
      className="cb-phone"
      data-claim-flip=""
      onClick={() => setFlipped((v) => !v)}
      aria-label="Тапни: оформить аренду — показать карточку"
    >
      <span
        className="cb-phone__inner"
        style={{
          display: "block",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          transition: "transform 0.55s cubic-bezier(0.3, 0.7, 0.25, 1)",
        }}
      >
        <span className="cb-phone__face">
          <span className="cb-phone__notch" aria-hidden="true" />
          <div className="cb-phone__app">
            <b>АРЕНДА</b>
            <span>Falcon GT · сутки</span>
          </div>
          <div className="cb-phone__rows">
            <span className="cb-phone__row">
              <span>депозит</span>
              <b>возвратный</b>
            </span>
            <span className="cb-phone__row">
              <span>QR-клэйм</span>
              <b>2 тапа</b>
            </span>
          </div>
          <span className="cb-phone__hint">тапни — оформить</span>
        </span>
        <span className="cb-phone__face cb-phone__face--back">
          <span className="cb-phone__notch" aria-hidden="true" />
          <div className="cb-phone__app">
            <b>КАРТОЧКА ✓</b>
            <span>аренда создана</span>
          </div>
          <div className="cb-phone__rows cb-phone__rows--full">
            <span className="cb-phone__row">
              <span>статус</span>
              <b>claim · QR</b>
            </span>
            <span className="cb-phone__row">
              <span>договор</span>
              <b>docx готов</b>
            </span>
            <span className="cb-phone__row">
              <span>депозит</span>
              <b>ожидает</b>
            </span>
          </div>
          <span className="cb-phone__hint">тапни — назад</span>
        </span>
      </span>
    </button>
  );
}

export default function ChronicleComicClient() {
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
    ...(panel.phone
      ? { custom: "phone" as const, phone: <ClaimPhone /> }
      : { img: panel.img, alt: panel.alt }),
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
    opts?: { ttl?: number; auto?: CineSceneDef["auto"] },
  ): CineSceneDef => ({
    id,
    title,
    accent,
    kind: "row",
    ttl: opts?.ttl ?? 10400, // v2-урок task188: 3 каптиона + каскад ~3.4s
    chrome: false,
    ...(opts?.auto ? { auto: opts.auto } : {}),
    panels: panels.map(panelDef),
  });

  // ════════════════════════════════════════════════════════════════════════
  // ХРОНИКА ОДНОЙ АРЕНДЫ — кадры-таймкоды. Сюжет суток: тап в мини-аппе,
  // карточка + договор, депозит, дорога, возврат, депозит вернулся, сплит,
  // зарплата. Все факты — README.MD и worklog, ни одного выдуманного модуля.
  // ════════════════════════════════════════════════════════════════════════
  const scenes: CineSceneDef[] = useMemo(
    () => [
      // ── обложка выпуска ──────────────────────────────────────────────────
      {
        id: "cc-cover",
        title: "ХРОНИКА",
        img: "/comic-book/ccover.webp",
        alt: "Райдер в шлеме у гаража на закате держит телефон, из экрана взлетает неоновый самолётик",
        accent: "cyan",
        kind: "splash",
        contain: true,
        chrome: false,
        ttl: 8800,
        // подсказка про скролл — одна: родной HUD-hint движка (урок task188)
        node: (
          <div className="cb-cinecover" style={ink({}, "0.2s")}>
            <span className="cb-cover__kicker" style={ink({}, "0.6s")}>
              VIBERIDER PLATFORM · ХРОНИКА · ВЫПУСК №3
            </span>
            <h1 className="cb-cover__title" style={ink({}, "0.45s")}>
              {["ХРОНИКА", "ОДНОЙ", "АРЕНДЫ"].map((word, i) => (
                <Pop
                  key={word}
                  className={`cb-cover__line${word === "АРЕНДЫ" ? " cb-cover__line--accent" : ""}`}
                  style={ink({}, `${(0.95 + i * 0.3).toFixed(2)}s`)}
                >
                  {word}
                </Pop>
              ))}
            </h1>
            <p className="cb-cover__sub" style={ink({}, "2s")}>
              Один тап в Telegram — и сутки жизни аренды: документы, депозит,
              дорога, возврат и деньги. Все события настоящие — таймкоды из
              жизни платформы.
            </p>
            <div className="cb-cover__price" aria-hidden="true" style={ink({}, "2.4s")}>
              <span>ФОРМАТ ВЫПУСКА:</span>
              <b>таймкоды · герои · камео №1–2</b>
            </div>
          </div>
        ),
      },

      // ── ГЛАВА 1: тап ─────────────────────────────────────────────────────
      dividerDef("c-ep1", "/// ГЛАВА 1 ///", "ТАП", "09:41 — мини-апп открывает сезон", "cyan", "09"),
      rowDef("c-rowA", "КАТАЛОГ · КАРТОЧКА · ДОГОВОР", "cyan", [
        {
          num: "09:41",
          title: "КАТАЛОГ ИЗ МЕТАДАННЫХ",
          img: "/comic-book/c01.webp",
          alt: "Руки в перчатках держат телефон, из экрана вылетает голографическая карточка мотоцикла",
          accent: "cyan",
          caption: "Райдер открывает мини-апп @oneBikePlsBot: каталог экипажа собран из crews.metadata — палитра, состав, цены. Выбор падает на Falcon GT.",
          bubbles: [{ text: "Витрина та же — код не трогали.", kind: "hero" }],
          sfx: { text: "ДЗЫНЬ!", color: "cyan", rotate: -7 },
        },
        {
          num: "09:47",
          title: "КАРТОЧКА ПО КНОПКЕ",
          phone: true,
          alt: "Интерактивный телефон: тап по кнопке — карточка аренды создана",
          accent: "magenta",
          caption: "Тап по кнопке — карточка аренды уже живёт в системе: QR-claim, статус, история. Никаких переписок «ну как оплатить».",
          sfx: { text: "ПИП!", color: "yellow", rotate: 7 },
        },
        {
          num: "09:52",
          title: "БУМАГИ ВЕДЁТ КЛЕРК",
          img: "/comic-book/rbotclerk.webp",
          alt: "Камео выпуска №2: робот-клерк в наушниках разбирает стопку документов",
          accent: "cyan",
          caption: "Договор DOCX собирается прямо из карточки — со статусом и историей согласования. Кадр-камео из выпуска №2: клерк тот же.",
          terminal: ["$ docx: договор_аренды.docx", "> статус: на согласовании", "> подпись: ✓"],
          sfx: { text: "ЧАК!", color: "gold", rotate: 6 },
        },
      ], { auto: [{ at: 7200, sel: "[data-claim-flip]" }] }),

      // ── ГЛАВА 2: кольцо ──────────────────────────────────────────────────
      dividerDef("c-ep2", "/// ГЛАВА 2 ///", "КОЛЬЦО", "день на дороге — статус riding", "magenta", "14"),
      rowDef("c-rowB", "ДЕПОЗИТ · ДОРОГА · ВОЗВРАТ", "magenta", [
        {
          num: "11:03",
          title: "ДЕПОЗИТ ПОД ЗАМОК",
          img: "/comic-book/c04.webp",
          alt: "Райдер и экипаж кладут купюры и карту в металлический депозитный бокс с замком",
          accent: "gold",
          caption: "Депозит собран — наличными или переводом, каждый рубль записан в deposit_entries. Это не «на доверии», это бухгалтерия.",
          bubbles: [{ text: "Залог принял. Чек — в карточке.", kind: "hero" }],
          sfx: { text: "КЛАНК!", color: "gold", rotate: 6 },
        },
        {
          num: "14:20",
          title: "ПОЛДНЯ НА ДОРОГЕ",
          img: "/comic-book/c05.webp",
          alt: "Чёрный мотоцикл входит в вираж на неоновой улице города, длинные линии скорости",
          accent: "cyan",
          caption: "Полдня на асфальте: статус в системе — riding, смена видна экипажу вживую. Если праздник затянется — продление аренды в два тапа.",
          sfx: { text: "ВЖУХ!", color: "cyan", rotate: -7 },
        },
        {
          num: "19:45",
          title: "ВОЗВРАТ ПО ЧЕК-ЛИСТУ",
          img: "/comic-book/c06.webp",
          alt: "Байк на подножке в гараже, экипаж с планшетом и фонариком обходит его на закате",
          accent: "magenta",
          caption: "Байк на подножке, экипаж обходит его по чек-листу — и аренда закрывается. Тише, чем была взята.",
          bubbles: [{ text: "По царапинам чисто.", kind: "agent" }],
          sfx: { text: "ЩЁЛК!", color: "cyan", rotate: -6 },
        },
      ]),

      // ── ГЛАВА 3: полночь ─────────────────────────────────────────────────
      dividerDef("c-ep3", "/// ГЛАВА 3 ///", "ПОЛНОЧЬ", "депозит, сплит, зарплата", "gold", "23"),
      rowDef("c-rowC", "ОТЗЫВ · СПЛИТ · ЗАРПЛАТА", "gold", [
        {
          num: "21:10",
          title: "ДЕПОЗИТ ВЕРНУЛСЯ",
          img: "/comic-book/c07.webp",
          alt: "Пять золотых звёзд сияют над крышей гаража, райдер внизу смотрит вверх и улыбается",
          accent: "gold",
          caption: "Депозит возвращён тем же путём, каким пришёл. Райдер ставит оценку — отзывы живут прямо в карточке аренды.",
          sfx: { text: "★★★★★", color: "magenta", rotate: -5 },
        },
        {
          num: "21:30",
          title: "СПЛИТ БЕЗ СЮРПРИЗОВ",
          img: "/comic-book/rmoney.webp",
          alt: "Камео выпуска №2: два сейфа — партнёр и компания — и конвейер монет",
          accent: "gold",
          caption: "Деньги делит computePartnerSplit: партнёр и компания, отменённые аренды в доходе — никогда. Тот же движок, что в выпуске №2.",
          notify: {
            app: "computePartnerSplit",
            title: "СПЛИТ ГОТОВ",
            body: "партнёр ← доля → компания",
          },
          sfx: { text: "ЧАК!", color: "gold", rotate: 6 },
        },
        {
          num: "23:00",
          title: "СМЕНА ЗАКРЫТА",
          img: "/comic-book/c09.webp",
          alt: "Робот-клерк ночью за столом с лампой, в ведомости горят зелёные галочки, за окном луна",
          accent: "cyan",
          caption: "Полночь: бот закрывает смену — зарплата посчитана, сверка сошлась. Завтра каталог снова открыт.",
          terminal: ["$ /salary", "> смена закрыта", "> сверка: ✅"],
          sfx: { text: "ДЗЫНЬ!", color: "magenta", rotate: -7 },
        },
      ]),

      // ── финал выпуска: следующий тап ─────────────────────────────────────
      {
        id: "cc-fin",
        title: "СЛЕДУЮЩИЙ ТАП",
        num: "fin",
        img: "/comic-book/cfin.webp",
        alt: "Раннее утро, пустая улица, чёрный мотоцикл на подножке в розово-золотом рассвете",
        accent: "cyan",
        kind: "splash",
        ttl: 9500,
        node: (
          <>
            <Pop
              className="cb-caption"
              style={ink({ maxWidth: "min(560px, 44%)", top: "26%", left: "4%" }, "1.2s")}
            >
              Сутки прошли: тап, бумаги, дорога, возврат, сплит — и утро снова
              начинается с открытого каталога. Дальше по таймкоду — твой.
            </Pop>
            <div className="cb-scene__cta" style={ink({}, "2.6s")}>
              <a className="cb-final__btn" href="/comic-book">
                Трилогия: как всё началось →
              </a>
              <a className="cb-final__ghost" href="/readme">
                README: как это устроено
              </a>
              <a className="cb-final__ghost" href="/salavey13">
                Витрина флагмана
              </a>
              {/* колофон в потоке CTA-стопки (урок task188: absolute
                  bottom-left наезжал на HUD-счётчик) */}
              <p className="cb-trilogy__fine" style={ink({}, "3.2s")}>
                выпуск №3 · сценарий, код, панели — zai-агент VIP BIKE ·
                факты — README.MD и worklog · камео кадров из выпусков №1–2
              </p>
            </div>
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
        <span className="cb-masthead__issue">ХРОНИКА · ВЫПУСК №3</span>
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
      />
    </div>
  );
}
