"use client";

// /app/comic-book/ComicBookClient.tsx
// ─────────────────────────────────────────────────────────────────────────────
// VIP BIKE COMICS · СЕЗОН 2026 — выпуски 1–2 + счёт, версия 7.0 (task186).
//
// v1–v5: панели, GLITCH-арка, счёт № 0001, интерактивный телефон, Ведомость
//   (история в git; весь контент бережно переносится дальше).
// v6 (task186): CB CINE — cinematic engine (fullscreen-кадры, скролл=камера).
// v6.1: peek + цепочка проявления + end slate. v6.2: --ink-pace.
// v7 (текущая) — большой раунд от босса:
//  • «define proper purpose first» — ЦЕЛЬ КОМИКСА:
//    за ~3 минуты показать владельцу мото-экипажа (настоящему или будущему),
//    что платформа VibeRider собирает сайту экипажа витрину за один вечер
//    и начинает продавать аренды сама — на живых тарифах каталога, без
//    выдуманных рублей — и довести читателя до «Подключить экипаж».
//    Каждая строка работает на одно из трёх: история-крючок / доказательство
//    платформы / CTA. Остальное срезано (тексты сжаты ~на треть);
//  • СУПЕР-УЛУЧШЕНИЕ: развороты — на PC 3 портретные панели в ряд,
//    на планшете 2, на мобиле 1 (те же картинки!); мобайл листает панели
//    ГОРИЗОНТАЛЬНЫМ свайпом; splash-кадры (обложка/титры/финал/тизер)
//    остались fullscreen — как splash-страницы настоящих комиксов;
//  • картинки панелей пересозданы в портрете 768×1344 (p*.png) под
//    композицию «текст сверху/снизу, герой в кадре»;
//  • «8fps reference was mistake» → проявление v7: ПЛАВНЫЙ каскад вместо
//    steps-ступеней: панель за панелью (--pd 0.3s), внутри панели
//    каптион → пузыри → нотификация → SFX, каждый элемент едет ~0.8s
//    ease-out; steps остался только на склейке кадров и живых фонах;
//  • анти-проскас: кулдаун 550мс после каждой склейки, один жест = один кадр;
//  • АВТОПЛЕЙ: ▶ в HUD + кнопка звука включает звук И автоплей («maybe
//    sound button can start autoplay ;))»); любой ручной жест — пауза;
//    лента-заряд показывает прогресс тика.
// Референс героя — founder-rustam.jpg из /leorus hero (task179).
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";
import "./comic-book.css";
import CineEngine, { type CinePanelDef, type CineSceneDef } from "./CineEngine";

type Bubble = {
  text: string;
  kind: "hero" | "agent" | "notify-cyan";
};

type Sfx = {
  text: string;
  color: "cyan" | "magenta" | "yellow";
  rotate: number;
};

type Notify = {
  app: string;
  title: string;
  body: string;
  delay?: number;
};

type SoundName = "ching" | "dzin" | "bip" | "boom" | "glitch";

type Panel = {
  num: string;
  title: string;
  img?: string;
  custom?: "phone";
  alt: string;
  accent: "cyan" | "magenta" | "gold";
  caption: string;
  bubbles?: Bubble[];
  notify?: Notify;
  sfx?: Sfx;
  terminal?: string[];
  sound?: SoundName;
  shake?: boolean;
  foot?: ReactNode; // нижний блок вместо каптиона (easter)
};

// ── WebAudio-синт для SFX: без ассетов, короткие синтезированные звуки ──────
function playSound(name: SoundName, ctx: AudioContext) {
  const t = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.value = 0.22;
  master.connect(ctx.destination);
  const tone = (
    type: OscillatorType,
    f0: number,
    f1: number,
    start: number,
    dur: number,
    vol: number,
  ) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t + start);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t + start + dur);
    gain.gain.setValueAtTime(0, t + start);
    gain.gain.linearRampToValueAtTime(vol, t + start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + start + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t + start);
    osc.stop(t + start + dur + 0.05);
  };
  switch (name) {
    case "ching": // КА-ЧИНГ — касса
      tone("triangle", 1318, 1318, 0, 0.5, 0.9);
      tone("triangle", 1976, 1976, 0.07, 0.7, 0.7);
      break;
    case "dzin": // ДЗЫНЬ — уведомление
      tone("sine", 880, 1760, 0, 0.85, 1);
      tone("sine", 1320, 2640, 0.02, 0.6, 0.4);
      break;
    case "bip": // БИП-БИП — пуш
      tone("square", 990, 990, 0, 0.09, 0.35);
      tone("square", 990, 990, 0.16, 0.09, 0.35);
      break;
    case "boom": // БУМ — вылет панели
      tone("sine", 160, 55, 0, 0.5, 1);
      break;
    case "glitch": // шумовой срыв
      {
        const len = Math.floor(ctx.sampleRate * 0.16);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = 1600;
        bp.Q.value = 0.8;
        const gain = ctx.createGain();
        gain.gain.value = 0.5;
        src.connect(bp);
        bp.connect(gain);
        gain.connect(master);
        src.start(t);
      }
      break;
  }
}

// ── ЭПИЗОД I «КАК БАЙКИ НАЧАЛИ ЗАРАБАТЫВАТЬ» ───────────────────────────────
// v7: тексты сжаты под цель (крючок / доказательство / CTA). Картинки —
// портретные p*.png (768×1344), композиция: верх и низ свободны под текст.
const PANELS: Panel[] = [
  {
    num: "01",
    title: "ЗВОНОК В НОЧЬ",
    img: "/comic-book/p01.png",
    alt: "Рустам ночью на набережной смотрит в светящийся телефон",
    accent: "cyan",
    caption: "Пятница. 23:47. Смена закрыта. Телефон решает, что на сегодня ещё не всё.",
    bubbles: [
      { text: "Доступ открыт. Собери свой экипаж.", kind: "notify-cyan" },
      { text: "Сначала гляну… а, ладно. СЕЙЧАС ГЛЯНУ.", kind: "hero" },
    ],
    sfx: { text: "ДЗЫНЬ!", color: "cyan", rotate: -8 },
    sound: "dzin",
  },
  {
    num: "02",
    title: "ОДНА КНОПКА",
    img: "/comic-book/p02.png",
    alt: "Палец нажимает огромную неоновую кнопку на голографическом экране",
    accent: "magenta",
    caption: "Никаких ТЗ и команды разработки. Одна кнопка — и каркас сайта уже строится.",
    bubbles: [{ text: "«Создать экипаж». Ну, за кастомизацию!", kind: "hero" }],
    sfx: { text: "КАЦ!", color: "yellow", rotate: 7 },
    sound: "ching",
  },
  {
    num: "03",
    title: "ЛИЧНЫЙ ZAI",
    img: "/comic-book/p03.png",
    alt: "Рустам пьёт кофе, пока робот-агент собирает сайт",
    accent: "cyan",
    caption: "У каждого — личный zai-агент со своими ключами. Не общий чат-бот на всех.",
    bubbles: [
      { text: "Не отвлекайся, шеф. Сайт сам себя не соберёт.", kind: "agent" },
      { text: "Он сайт собирает. Я кофе пью. Кто из нас продюсер?", kind: "hero" },
    ],
  },
  {
    num: "04",
    title: "БРЕНД-КУЗНИЦА",
    img: "/comic-book/p04.png",
    alt: "Гигантский светящийся логотип влетает в неоновый билборд",
    accent: "magenta",
    caption: "Название, логотип, цвета — всё живёт в его репозитории, а не в чужом конструкторе.",
    bubbles: [{ text: "LEORUS RIDES. Звучит как фест. Оставляю.", kind: "hero" }],
    sfx: { text: "ВЖУХ!", color: "magenta", rotate: -6 },
  },
  {
    num: "05",
    title: "КАТАЛОГ ЗАЛЕТАЕТ",
    img: "/comic-book/p05.png",
    alt: "Флагман Falcon Lynx на голографическом подиуме среди карточек каталога",
    accent: "cyan",
    caption: "Фото, цены, залоги — каталог собран раньше, чем остыл кофе.",
    bubbles: [{ text: "Falcon Lynx — в сетку. Красавец.", kind: "hero" }],
    sfx: { text: "БРРР!", color: "cyan", rotate: -5 },
  },
  {
    num: "06",
    title: "ВЕЧЕРОМ — В ПРОДЕ",
    img: "/comic-book/p06.png",
    alt: "Ракета стартует с ноутбука, над которым парит дашборд сайта",
    accent: "magenta",
    caption: "Сказал утром — вечером в проде. Витрина уже продаёт.",
    bubbles: [{ text: "Это не аренда софта. Это мой актив.", kind: "hero" }],
    sfx: { text: "ПУШ!", color: "yellow", rotate: 8 },
    sound: "boom",
  },
  {
    num: "07",
    title: "КЛИЕНТ АРЕНДОВАЛ",
    img: "/comic-book/p07.png",
    alt: "Клиент жмёт «Арендовать» в веб-приложении — Рустам получает уведомление",
    accent: "cyan",
    caption: "Клиент открыл приложение, выбрал байк, арендовал. Сайт продаёт сам — уведомление летит Рустаму.",
    bubbles: [{ text: "Сайт продаёт, пока я сплю. Что там с флагманом?", kind: "hero" }],
    notify: {
      app: "LEORUS RIDES · веб-приложение",
      title: "НОВАЯ АРЕНДА",
      body: "Falcon Lynx · 3 дня · депозит принят",
    },
    sfx: { text: "ДЗЫНЬ!", color: "cyan", rotate: -7 },
    sound: "dzin",
  },
  {
    num: "08",
    title: "ВЫДАЧА",
    img: "/comic-book/p08.png",
    alt: "Рустам передаёт ключи райдеру, над байком светится QR-код",
    accent: "magenta",
    caption: "QR, ключи, рукопожатие. Договор подписан, депозит на месте — бумаги ведёт бот-клерк.",
    bubbles: [{ text: "Приятного сезона, боец.", kind: "hero" }],
    sfx: { text: "ЩЁЛК!", color: "yellow", rotate: 6 },
  },
];

// ── секретный уровень эпизода I: глюк в другой бизнес ──────────────────────
const GLITCH_PANELS: Panel[] = [
  {
    num: "GLITCH",
    title: "ТЕСТ НА ГЛЮК",
    img: "/comic-book/pglitch.png",
    alt: "Каталог байков распадается на глитч-пиксели и собирается в сцену фестиваля",
    accent: "gold",
    caption: "Каталог — это просто список. Подставь другой — получишь другой бизнес.",
    terminal: [
      "$ zai crew patch --catalog",
      "> bikes[]  → performances[]",
      "> движок: тот же",
      "> LEORUS.exe … ЗАПУЩЕН",
    ],
    sfx: { text: "ГЛЮК?!", color: "yellow", rotate: 6 },
    sound: "glitch",
  },
  {
    num: "LEORUS",
    title: "АРЕНДУЙ РУСТАМА",
    img: "/comic-book/pdj.png",
    alt: "Рустам за диджейским пультом на главном фестивальном экране, толпа внизу",
    accent: "gold",
    caption: "Вторая команда Рустама — ивент-агентство LEORUS. Тот же движок: вместо байков — сцены.",
    bubbles: [{ text: "Арендуй не байк. Арендуй меня.", kind: "hero" }],
    notify: {
      app: "LEORUS · веб-приложение",
      title: "НОВАЯ БРОНЬ ВЫСТУПЛЕНИЯ",
      body: "DJ Rustam · 3 часа · предоплата принята",
    },
    sfx: { text: "БУМ!", color: "magenta", rotate: 8 },
    sound: "boom",
  },
];

// ── ЭПИЗОД II «СЧЁТЧИК ДЕНЕГ» ──────────────────────────────────────────────
// Суммы — реальные тарифы живого каталога (docs/autoreply/vip-bike-rent.csv):
// Shiver 750 сутки 12 000 / 6ч 5 000 · Falcon Pro 6ч 7 000 · Max Pro сутки
// 8 000 / 6ч 5 600. Комедийная формула Кевила: последняя шутка — после финала.
const EP2_PANELS: Panel[] = [
  {
    num: "II·01",
    title: "ПРОСТО ПРОВЕРЮ",
    img: "/comic-book/pcouch.png",
    alt: "Рустам лежит на диване ночью, лицо подсвечено экраном телефона",
    accent: "cyan",
    caption: "Месяц спустя. 23:48. Всё работает само. Оставалось не трогать телефон.",
    bubbles: [{ text: "Интересно, сколько заработали байки? Пять секунд — и спать.", kind: "hero" }],
  },
  {
    num: "II·02",
    title: "ОПА!",
    custom: "phone",
    alt: "Экран аналитики VIP BIKE: закрытая аренда и счётчик заработка, тап открывает разбивку",
    accent: "magenta",
    caption: "Деньги видны сразу. Счётчик считает только закрытые аренды — ни одного выдуманного рубля.",
    bubbles: [{ text: "Так. А ну-ка ещё раз обновим.", kind: "hero" }],
    sfx: { text: "КА-ЧИНГ!", color: "yellow", rotate: 7 },
    sound: "ching",
  },
  {
    num: "II·03",
    title: "ЭТО УЖЕ ПОДОЗРИТЕЛЬНО",
    img: "/comic-book/pcoffee.png",
    alt: "Рустам с кружкой кофе смотрит на вибрирующий телефон на стойке",
    accent: "cyan",
    caption: "Пока он делал глоток, закрылась ещё одна аренда. Он не нажимал ничего. Кофе тоже.",
    bubbles: [{ text: "Я вообще-то просто кофе пил!", kind: "hero" }],
    notify: {
      app: "VIP BIKE · аналитика",
      title: "АРЕНДА ЗАВЕРШЕНА",
      body: "Falcon Pro · 6 часов · +7 000 ₽",
    },
    sound: "bip",
  },
  {
    num: "II·04",
    title: "КАЖЕТСЯ, Я ПОНЯЛ",
    img: "/comic-book/pgarage.png",
    alt: "Рустам со спины смотрит на ряд мотоциклов в неоновом гараже",
    accent: "magenta",
    caption: "Ночной обход ангара: все в работе. Схема видна целиком — и она нравится.",
    bubbles: [{ text: "Они катаются — я считаю. Неплохая схема!", kind: "hero" }],
  },
  {
    num: "II·05",
    title: "ПОСЛЕДНЯЯ ПРОВЕРКА",
    img: "/comic-book/pphoneaway.png",
    alt: "Рустам откинулся в кресле со скрещенными руками, телефон остался на столе",
    accent: "cyan",
    caption: "Он кладёт телефон на стол. Взрослый человек. Хозяин своего вечера.",
    bubbles: [{ text: "Всё. Больше сегодня не проверяю.", kind: "hero" }],
    sfx: { text: "ДЗЫНЬ!", color: "cyan", rotate: -8 },
    notify: {
      app: "VIP BIKE · аналитика",
      title: "ЕЩЁ ОДНА АРЕНДА",
      body: "Max Pro · 6 часов · +5 600 ₽",
      delay: 0.4,
    },
    sound: "dzin",
    shake: true,
  },
  {
    num: "II·∞",
    title: "ЭКРАН ГАСНЕТ",
    img: "/comic-book/phand.png",
    alt: "Рука в темноте хватает светящийся телефон",
    accent: "magenta",
    notify: {
      app: "VIP BIKE · аналитика",
      title: "ЕЩЁ ОДНА АРЕНДА",
      body: "Shiver 750 · 6 часов · +5 000 ₽",
    },
    foot: (
      <div className="cb-panel__score">
        <span>СЧЁТ ВЕЧЕРА: ТЕЛЕФОН — 4 · РУСТАМ — 0</span>
        <p>Байки катают, счётчик считает, телефон пишет первым.</p>
      </div>
    ),
    sound: "dzin",
  },
];

// ── «выбор приключения»: четыре экрана живой платформы после II·05 ──────────
type BossTab = "sheet" | "salary" | "park" | "stats";

type VerState = "verified" | "waiting" | "disputed";

type SheetRow = {
  time: string;
  bike: string;
  hours: string;
  price: number;
  zp: number;
  operator: string;
  ver: VerState;
};

const SHEET_ROWS: SheetRow[] = [
  { time: "14:10", bike: "Falcon GT", hours: "6 ч", price: 5000, zp: 1500, operator: "Рустам", ver: "disputed" },
  { time: "15:30", bike: "Kayo TSD 110", hours: "сутки", price: 4000, zp: 1200, operator: "Женя", ver: "waiting" },
  { time: "17:05", bike: "Ninja 650", hours: "сутки", price: 10000, zp: 3000, operator: "Женя", ver: "verified" },
  { time: "19:40", bike: "Max Pro", hours: "сутки", price: 8000, zp: 2400, operator: "Рустам", ver: "verified" },
  { time: "21:15", bike: "Falcon Pro", hours: "6 ч", price: 7000, zp: 2100, operator: "Рустам", ver: "verified" },
  { time: "23:48", bike: "Shiver 750", hours: "сутки", price: 12000, zp: 3600, operator: "Рустам", ver: "verified" },
];

const VER_META: Record<VerState, { chip: string; label: string }> = {
  verified: { chip: "✅", label: "сверка сошлась" },
  waiting: { chip: "⏳", label: "ожидает" },
  disputed: { chip: "⚠️", label: "вопросы" },
};

const fmtRub = (n: number) => `${n.toLocaleString("ru-RU")} ₽`;

const BOSS_SCREENS: Record<
  Exclude<BossTab, "sheet">,
  { title: string; time: string; rows: [string, string][]; total: [string, string]; note: string }
> = {
  salary: {
    title: "ЛИСТ ЗАРПЛАТЫ",
    time: "смена закрыта",
    rows: [
      ["Смена · 8 часов на выдаче", "4 000 ₽"],
      ["Стрик · 12 смен подряд", "+1 200 ₽"],
      ["Премия · отзыв на 5 звёзд", "+500 ₽"],
    ],
    total: ["К ВЫПЛАТЕ", "5 700 ₽"],
    note: "формулы — боевой модуль зарплат платформы · числа демо",
  },
  park: {
    title: "МОТОПАРК · ВИТРИНА",
    time: "живой каталог",
    rows: [
      ["LiveWire ONE · сутки", "24 000 ₽"],
      ["Falcon GT · сутки", "12 000 ₽"],
      ["Aprilia Shiver 750 · сутки", "12 000 ₽"],
      ["Kawasaki Ninja 650 · сутки", "10 000 ₽"],
      ["Kayo TSD 110 · сутки", "4 000 ₽"],
    ],
    total: ["ЗАЛОГ ФЛАГМАНА", "50 000 ₽"],
    note: "тарифы и залоги — из живого каталога, ни одного выдуманного рубля",
  },
  stats: {
    title: "АНАЛИТИКА АРЕНДЫ",
    time: "вечерний дашборд",
    rows: [
      ["Аренды сегодня", "6"],
      ["Возвраты по расписанию", "3 / 3"],
      ["Документы в порядке", "100 %"],
      ["QR-claim на выдаче", "вкл"],
    ],
    total: ["ПРОСРОЧКИ", "0"],
    note: "названия метрик — из живого дашборда аренды · числа демо",
  },
};

// пружины framer-motion (статичный/no-JS режим и интерактив внутри кадров)
const SPRING = { type: "spring" as const, stiffness: 210, damping: 17 };

// ── интерактивный телефон эпизода II: счётчик + флип к разбивке ────────────
function PhoneCounter({ jsReady, label }: { jsReady: boolean; label: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const inView = useInView(boxRef, { once: true, amount: 0.4 });
  const mv = useMotionValue(0);
  const counterText = useTransform(mv, (v) => `+${Math.round(v).toLocaleString("ru-RU")} ₽`);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(mv, 12000, { duration: 1.7, delay: 0.5, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [inView, mv]);

  return (
    <div className="cb-phonepanel" ref={boxRef} role="img" aria-label={label}>
      <button
        type="button"
        className="cb-phone"
        onClick={() => setFlipped((v) => !v)}
        aria-pressed={flipped}
        aria-label="Экран аналитики — тапни, чтобы открыть разбивку за сегодня"
      >
        <motion.div
          className="cb-phone__inner"
          animate={jsReady ? { rotateY: flipped ? 180 : 0 } : undefined}
          transition={{ type: "spring", stiffness: 150, damping: 17 }}
        >
          <div className="cb-phone__face cb-phone__face--front">
            <span className="cb-phone__notch" aria-hidden="true" />
            <div className="cb-phone__app">
              <b>VIP BIKE</b>
              <span>аналитика · 23:48</span>
            </div>
            <div className="cb-phone__notif">
              <span>АРЕНДА ЗАВЕРШЕНА</span>
              <b>Shiver 750 · сутки</b>
            </div>
            {jsReady ? (
              <motion.span className="cb-phone__counter">{counterText}</motion.span>
            ) : (
              <span className="cb-phone__counter">+12 000 ₽</span>
            )}
            <div className="cb-phone__rows">
              <span className="cb-phone__row">
                <span>Falcon Pro · 6 ч</span>
                <b>+7 000 ₽</b>
              </span>
              <span className="cb-phone__row">
                <span>Max Pro · сутки</span>
                <b>+8 000 ₽</b>
              </span>
            </div>
            <span className="cb-phone__hint">тапни — разбивка</span>
          </div>
          <div className="cb-phone__face cb-phone__face--back">
            <span className="cb-phone__notch" aria-hidden="true" />
            <div className="cb-phone__app">
              <b>РАЗБИВКА</b>
              <span>сегодня</span>
            </div>
            <div className="cb-phone__rows cb-phone__rows--full">
              <span className="cb-phone__row">
                <span>Shiver 750 · сутки</span>
                <b>12 000 ₽</b>
              </span>
              <span className="cb-phone__row">
                <span>Falcon Pro · 6 часов</span>
                <b>7 000 ₽</b>
              </span>
              <span className="cb-phone__row">
                <span>Max Pro · сутки</span>
                <b>8 000 ₽</b>
              </span>
            </div>
            <div className="cb-phone__total">
              <span>ИТОГО</span>
              <b>27 000 ₽</b>
            </div>
            <span className="cb-phone__note">
              тарифы — из живого каталога,
              <br />
              ни одного выдуманного рубля
            </span>
            <span className="cb-phone__hint">тапни — назад</span>
          </div>
        </motion.div>
      </button>
    </div>
  );
}

// ── ВЕДОМОСТЬ (task183): мини-версия боевой «Таблицы и экспорта CSV» ───────
function SalarySheet({
  onTap,
  animate,
}: {
  onTap: () => void;
  animate: boolean;
}) {
  const [filter, setFilter] = useState<"all" | VerState>("all");
  const rows = SHEET_ROWS.filter((r) => filter === "all" || r.ver === filter);
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const revenue = sum(rows.map((r) => r.price));
  const zp = sum(rows.map((r) => r.zp));

  return (
    <div className="cb-sheet">
      <div className="cb-sheet__ver" role="group" aria-label="Фильтр сверки">
        <span className="cb-sheet__ver-label">🤝 Сверка:</span>
        {(
          [
            ["all", "all"],
            ["verified", "verified"],
            ["waiting", "waiting"],
            ["disputed", "disputed"],
          ] as const
        ).map(([key]) => {
          const n =
            key === "all"
              ? SHEET_ROWS.length
              : SHEET_ROWS.filter((r) => r.ver === key).length;
          const label =
            key === "all" ? `все · ${n}` : `${n} ${VER_META[key].chip}`;
          return (
            <button
              key={key}
              type="button"
              className={`cb-sheet__chip cb-sheet__chip--${key}`}
              aria-pressed={filter === key}
              onClick={() => {
                setFilter(key);
                onTap();
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div
        className="cb-sheet__scroll"
        tabIndex={0}
        role="region"
        aria-label="Таблица ведомости — прокручивается по горизонтали"
      >
        <span className="cb-sheet__scrollhint" aria-hidden="true">
          листай →
        </span>
        <table className="cb-sheet__table">
          <thead>
            <tr>
              <th className="cb-sheet__th cb-sheet__th--pin">Время · марка</th>
              <th className="cb-sheet__th">Часы</th>
              <th className="cb-sheet__th cb-sheet__th--num">Цена</th>
              <th className="cb-sheet__th cb-sheet__th--num">ЗП экип</th>
              <th className="cb-sheet__th">Оператор (ЗП)</th>
              <th className="cb-sheet__th">Верификация</th>
            </tr>
          </thead>
          <tbody key={filter}>
            {rows.map((r, i) => (
              <motion.tr
                key={r.time}
                className={`cb-sheet__row cb-sheet__row--${r.ver}`}
                initial={animate ? { opacity: 0, x: 14 } : undefined}
                animate={animate ? { opacity: 1, x: 0 } : undefined}
                transition={animate ? { duration: 0.26, delay: i * 0.05 } : undefined}
              >
                <td className="cb-sheet__td cb-sheet__td--pin">
                  <div className="cb-sheet__pinwrap">
                    <span className="cb-sheet__time">{r.time}</span>
                    <b>{r.bike}</b>
                  </div>
                </td>
                <td className="cb-sheet__td">{r.hours}</td>
                <td className="cb-sheet__td cb-sheet__td--num">{fmtRub(r.price)}</td>
                <td className="cb-sheet__td cb-sheet__td--num cb-sheet__td--zp">
                  {fmtRub(r.zp)}
                </td>
                <td className="cb-sheet__td">{r.operator}</td>
                <td className="cb-sheet__td cb-sheet__td--ver">
                  {VER_META[r.ver].chip} {VER_META[r.ver].label}
                </td>
              </motion.tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="cb-sheet__td cb-sheet__td--empty" colSpan={6}>
                  пусто — как и в бою после чистой сверки :)
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="cb-sheet__summary" aria-label="Сводка по фильтру">
        <span className="cb-sheet__summary-title">СВОДКА</span>
        <span className="cb-sheet__summary-block">АРЕНДЫ</span>
        <span className="cb-sheet__summary-cell">
          записей <b>{rows.length}</b>
        </span>
        <span className="cb-sheet__summary-cell">
          выручка <b>{fmtRub(revenue)}</b>
        </span>
        <span className="cb-sheet__summary-cell">
          ЗП экип <b>{fmtRub(zp)}</b>
        </span>
      </div>

      <span className="cb-sheet__note">
        колонки, чипы сверки и СВОДКА — из боевой таблицы «Аналитика аренды →
        📋 Таблица и экспорт CSV» · тарифы и часы — живой каталог · ЗП и сверки
        — демо: боевой модуль считает по закрытым арендам платформы
      </span>
    </div>
  );
}

export default function ComicBookClient() {
  // Класс cb-js ставится только когда JS реально работает: без него весь
  // комикс (и все оверлеи) виден статично — no-JS и скриншотеры не теряют
  // ни панели, ни тексты.
  const [jsReady, setJsReady] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [bossTab, setBossTab] = useState<BossTab | null>(null);
  const [soundOn, setSoundOn] = useState(false);
  const [auto, setAuto] = useState(false); // v7: автоплей (кнопка/звук)
  const soundRef = useRef(false);
  const audioRef = useRef<AudioContext | null>(null);
  const scenesRef = useRef<CineSceneDef[]>([]);
  const restartRef = useRef<(() => void) | null>(null);
  const reduceMotion = useReducedMotion();

  // JS жив → включается CB CINE (движок кадров). Без JS — статичный вебтун.
  useEffect(() => {
    setJsReady(true);
  }, []);

  // SFX кадра: движок сообщает о показе кадра — если звук включён, играем.
  const handleSceneShown = useCallback((index: number) => {
    const s = scenesRef.current[index];
    if (s?.sound && soundRef.current && audioRef.current) {
      playSound(s.sound as SoundName, audioRef.current);
    }
  }, []);

  // v7: звук+автоплей в одной кнопке (босс: «maybe sound button can start
  // autoplay ;))»). Любой ручной жест ставит автоплей на паузу.
  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    soundRef.current = next;
    if (next) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!audioRef.current && AC) audioRef.current = new AC();
      void audioRef.current?.resume();
      if (audioRef.current) playSound("ching", audioRef.current);
    }
    setAuto(next);
  };

  const pauseAuto = useCallback(() => setAuto(false), []);
  const toggleAuto = useCallback(() => setAuto((v) => !v), []);

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

  const Drop = ({
    children,
    style,
    delay = 0,
  }: {
    children: ReactNode;
    style?: React.CSSProperties;
    delay?: number;
  }) =>
    jsReady ? (
      <motion.div
        className="cb-notify-wrap"
        style={style}
        role="status"
        initial={{ opacity: 0, y: -26, rotate: -2 }}
        whileInView={{ opacity: 1, y: 0, rotate: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ ...SPRING, delay }}
      >
        {children}
      </motion.div>
    ) : (
      <div className="cb-notify-wrap" style={style} role="status">
        {children}
      </div>
    );

  // v7: задержка каскада проявления. Плавный режим (босс: «8fps reference
  // was mistake») — каждый элемент едет ~0.8s ease-out, порядок читается.
  // Все числа умножаются на --ink-pace из CSS (единый темп, сейчас 1).
  const ink = (base: React.CSSProperties, d: string): React.CSSProperties =>
    ({ ...base, "--ink-d": `calc(${d} * var(--ink-pace, 1))` }) as React.CSSProperties;

  // ── стопка текста ПАНЕЛИ (внутри портретной колонки разворота) ──────────
  // каскад на панель k: каптион 1.0 → пузыри 1.35+ → нотиф 1.65 → SFX 2.0,
  // каждая панель сдвинута на +0.3s (--pd выставляет движок для картинки).
  const sfxNode = (panel: Panel, k: number) =>
    panel.sfx ? (
      <span
        className={`cb-sfx cb-sfx--${panel.sfx.color}`}
        style={
          ink(
            { "--rot": `${panel.sfx.rotate}deg`, transform: `rotate(${panel.sfx.rotate}deg)` },
            `${(2 + k * 0.3).toFixed(2)}s`,
          ) as React.CSSProperties
        }
        aria-hidden="true"
      >
        {panel.sfx.text}
      </span>
    ) : null;

  const panelStack = (panel: Panel, k: number) => (
    <>
      {panel.notify && (
        <Drop
          delay={panel.notify.delay}
          style={ink({}, `${(1.65 + k * 0.3 + (panel.notify.delay ?? 0)).toFixed(2)}s`)}
        >
          <div className="cb-notify">
            <span className="cb-notify__app">{panel.notify.app}</span>
            <span className="cb-notify__title">{panel.notify.title}</span>
            <span className="cb-notify__body">{panel.notify.body}</span>
          </div>
        </Drop>
      )}
      {panel.terminal && (
        <div className="cb-terminal" style={ink({}, `${(1.3 + k * 0.3).toFixed(2)}s`)}>
          {panel.terminal.map((line) => (
            <span key={line} className="cb-terminal__line">
              {line}
            </span>
          ))}
          <span className="cb-terminal__cursor" aria-hidden="true" />
        </div>
      )}
      {panel.bubbles?.map((bubble, i) => (
        <Pop
          key={bubble.text}
          className={`cb-bubble cb-bubble--${bubble.kind}`}
          style={ink({}, `${(1.35 + k * 0.3 + i * 0.25).toFixed(2)}s`)}
        >
          {bubble.text}
        </Pop>
      ))}
      {panel.foot ?? (
        <p className="cb-caption" style={ink({}, `${(1 + k * 0.3).toFixed(2)}s`)}>
          {panel.caption}
        </p>
      )}
    </>
  );

  // телефон II·02 — отдельный слот «картинки» панели (в стопке текста ему тесно)
  const phoneSlot = (panel: Panel, k: number) => (
    <div className="cb-scene__phonebox" style={ink({}, `${(0.9 + k * 0.3).toFixed(2)}s`)}>
      <PhoneCounter jsReady={jsReady} label={panel.alt} />
    </div>
  );

  // панель данных → CinePanelDef (движок рисует колонку разворота; SFX —
  // обычный span, проявление ведёт CSS-каскад по --ink-d)
  const panelDef = (panel: Panel, k: number): CinePanelDef => ({
    key: panel.num,
    num: panel.num,
    title: panel.title,
    accent: panel.accent,
    img: panel.img,
    alt: panel.alt,
    custom: panel.custom,
    phone: panel.custom === "phone" ? phoneSlot(panel, k) : undefined,
    node: panelStack(panel, k),
    sfx: sfxNode(panel, k),
  });

  // титульная карточка — «склейка» между эпизодами (splash)
  const dividerDef = (
    id: string,
    tag: string,
    title: string,
    sub: string,
    accent: "cyan" | "magenta" | "gold",
    sound?: SoundName,
    ghost?: string,
  ): CineSceneDef => ({
    id,
    title,
    accent,
    sound,
    kind: "splash",
    chrome: false,
    node: (
      <div className="cb-cinediv" style={ink({}, "0.2s")} {...(ghost ? { "data-ghost": ghost } : {})}>
        <span className="cb-cinediv__tag" style={ink({}, "0.45s")}>{tag}</span>
        <span className="cb-cinediv__title" style={ink({}, "0.75s")}>{title}</span>
        <span className="cb-cinediv__sub" style={ink({}, "1.1s")}>{sub}</span>
      </div>
    ),
  });

  // разворот из панелей (row): 3 колонки на PC, 2 на планшете, 1 на мобиле
  const rowDef = (
    id: string,
    title: string,
    accent: "cyan" | "magenta" | "gold",
    panels: Panel[],
    sound?: SoundName,
  ): CineSceneDef => ({
    id,
    title,
    accent,
    sound,
    kind: "row",
    chrome: false, // у каждой панели свой бейдж-номер и заголовок
    panels: panels.map(panelDef),
  });

  // ════════════════════════════════════════════════════════════════════════
  // CB CINE v7: сборка кадров. Хронометраж выпуска:
  // обложка → титр I → развороты A/B/C (панели 01–08) → титр GLITCH →
  // разворот D (глюк + LEORUS) → финал → счёт → титр II → развороты E/F
  // (II·01–II·∞) → интерактив → тизер вып. 3 → UNIVERSE → колофон.
  // Развороты = ряды портретных панелей; splash-кадры = «splash-страницы».
  // ════════════════════════════════════════════════════════════════════════
  const scenes: CineSceneDef[] = [
    // ── обложка (splash, 1:1 — вписываем в кадр, атмосферу даёт блюр) ──────
    {
      id: "cover",
      title: "ОБЛОЖКА",
      img: "/comic-book/cover.png",
      alt: "Рустам — герой комикса — стоит с телефоном и электромотоциклом на фоне неонового города",
      accent: "cyan",
      kind: "splash",
      contain: true,
      chrome: false,
      overlay: (
        <span className="cb-cover__cue cb-cover__cue--overlay" aria-hidden="true" style={ink({}, "2.2s")}>
          <i>▼</i> скролл — камера едет, следующий кадр уже выезжает
        </span>
      ),
      node: (
        <div className="cb-cinecover" style={ink({}, "0.15s")}>
          <span className="cb-cover__kicker" style={ink({}, "0.45s")}>
            VIP BIKE COMICS · сезон 2026 · выпуски 1–2
          </span>
          <h1 className="cb-cover__title" style={ink({}, "0.35s")}>
            {["КАК БАЙКИ", "НАЧАЛИ", "ЗАРАБАТЫВАТЬ"].map((word, i) => (
              <Pop
                key={word}
                className={`cb-cover__line${word === "ЗАРАБАТЫВАТЬ" ? " cb-cover__line--accent" : ""}`}
                style={ink({}, `${(0.7 + i * 0.25).toFixed(2)}s`)}
              >
                {word}
              </Pop>
            ))}
          </h1>
          <p className="cb-cover__sub" style={ink({}, "1.5s")}>
            Один вечер — и байки начали зарабатывать. Всё нарисованное — реально
            работает на платформе.
          </p>
          <div className="cb-cover__price" aria-hidden="true" style={ink({}, "1.85s")}>
            <span>ЦЕНА ВОПРОСА:</span>
            <b>10 минут вечера</b>
          </div>
          <span className="cb-cover__cue" aria-hidden="true" style={ink({}, "2.2s")}>
            <i>▼</i> скролл — камера едет, следующий кадр уже выезжает
          </span>
        </div>
      ),
    },

    // ── титр эпизода I ─────────────────────────────────────────────────────
    dividerDef(
      "ep1",
      "/// ЭПИЗОД I ///",
      "КАК БАЙКИ НАЧАЛИ ЗАРАБАТЫВАТЬ",
      "один вечер — от звонка в ночь до первой закрытой аренды",
      "cyan",
      undefined,
      "I",
    ),

    // ── развороты эпизода I (панели 01–08) ─────────────────────────────────
    rowDef("p01-03", "ЗВОНОК В НОЧЬ · ОДНА КНОПКА · ЛИЧНЫЙ ZAI", "cyan", PANELS.slice(0, 3)),
    rowDef("p04-06", "БРЕНД-КУЗНИЦА · КАТАЛОГ · В ПРОДЕ", "magenta", PANELS.slice(3, 6)),
    rowDef("p07-08", "КЛИЕНТ АРЕНДОВАЛ · ВЫДАЧА", "cyan", PANELS.slice(6, 8)),

    // ── секретный уровень: глюк в другой бизнес ────────────────────────────
    dividerDef(
      "glitch-intro",
      "/// СЕКРЕТНЫЙ УРОВЕНЬ ///",
      "СИГНАЛ ПОТЕРЯН...",
      "найден другой каталог — тот же движок, другой бизнес",
      "gold",
      "glitch",
      "?!",
    ),
    rowDef("glitch-leorus", "ТЕСТ НА ГЛЮК · АРЕНДУЙ РУСТАМА", "gold", GLITCH_PANELS),

    // ── финал эпизода I (splash с CTA) ─────────────────────────────────────
    {
      id: "finale",
      title: "ТВОЙ ХОД",
      num: "финал",
      img: "/comic-book/final.png",
      alt: "Рустам ведёт экипаж через мост на рассвете",
      accent: "cyan",
      kind: "splash",
      node: (
        <>
          <Pop
            className="cb-caption"
            style={ink({ maxWidth: "min(560px, 44%)", top: "26%", left: "4%" }, "0.9s")}
          >
            Один вечер — две команды: байки катают, сцены гремят. Один движок —
            любой бизнес. Дальше по сценарию — ты.
          </Pop>
          <div className="cb-scene__cta" style={ink({}, "2.4s")}>
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
              Команда LEORUS
            </a>
          </div>
        </>
      ),
    },

    // ── вишенка эпизода I: счёт № 0001 (scroll) ────────────────────────────
    {
      id: "invoice",
      title: "СЧЁТ № 0001",
      num: "бонус",
      accent: "gold",
      kind: "scroll",
      scrollable: true,
      node: (
        <div className="cb-cherry" style={ink({}, "0.3s")}>
          <button
            type="button"
            className="cb-cherry__btn"
            style={ink({}, "0.6s")}
            onClick={() => setInvoiceOpen((v) => !v)}
            aria-expanded={invoiceOpen}
          >
            {invoiceOpen ? "спрятать счёт обратно" : "...одно последнее дело (привет, Стив)"}
          </button>
          <AnimatePresence>
            {invoiceOpen && (
              <motion.div
                className="cb-invoice"
                initial={{ opacity: 0, y: 46, rotate: -7, scale: 0.88 }}
                animate={{ opacity: 1, y: 0, rotate: -2, scale: 1 }}
                exit={{ opacity: 0, y: 30, rotate: 4, scale: 0.92 }}
                transition={SPRING}
              >
                <div className="cb-invoice__head">
                  <span>VIP BIKE · TECHNOLOGY &amp; FRANCHISE DIVISION · 2026</span>
                  <b>СЧЁТ № 0001</b>
                  <i>за создание маленького сайта для аренды мотоциклов</i>
                </div>
                <div className="cb-invoice__rows">
                  {[
                    ["Система аренды и CRM", "$45 000"],
                    ["Telegram-автоматизация", "$20 000"],
                    ["Финансы и аналитика", "$25 000"],
                    ["Документы и цифровые процессы", "$20 000"],
                    ["Франшизная инфраструктура", "$30 000"],
                    ["AI и персонализация", "$15 000"],
                    ["BikeSoul и геймификация", "$15 000"],
                  ].map(([name, price]) => (
                    <span key={name} className="cb-invoice__row">
                      <span>{name}</span>
                      <b>{price}</b>
                    </span>
                  ))}
                  <span className="cb-invoice__row cb-invoice__row--total">
                    <span>ИТОГО</span>
                    <b>$170 000</b>
                  </span>
                </div>
                <div className="cb-invoice__infinity">
                  <span>специальная цена для первого владельца:</span>
                  <b>∞</b>
                </div>
                <div className="cb-invoice__stamp">оценка стоимости · не оферта</div>
                <p className="cb-invoice__ps">
                  Шутливая оценка воспроизведения платформы командой разработки —
                  цифры для разговора, не коммерческое предложение. Инвестиции в
                  развитие принимаются. P.S. Кофе и топливо не включены.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
          <p className="cb-cherry__hint" style={ink({}, "1.1s")}>
            Первый вопрос нового владельца: «сколько это стоило?» — держите
            готовый ответ.
          </p>
        </div>
      ),
    },

    // ── титр эпизода II ────────────────────────────────────────────────────
    dividerDef(
      "ep2",
      "/// ЭПИЗОД II ///",
      "СЧЁТЧИК ДЕНЕГ",
      "куда делся мой вечер? — аренды идут сами",
      "magenta",
      "glitch",
      "II",
    ),

    // ── развороты эпизода II (панели II·01–II·∞) ───────────────────────────
    rowDef("ep2-a", "ПРОСТО ПРОВЕРЮ · ОПА! · ПОДОЗРИТЕЛЬНО", "cyan", EP2_PANELS.slice(0, 3)),
    rowDef("ep2-b", "КАЖЕТСЯ, Я ПОНЯЛ · ПОСЛЕДНЯЯ ПРОВЕРКА · ЭКРАН ГАСНЕТ", "magenta", EP2_PANELS.slice(3, 6)),

    // ── выбор приключения: четыре экрана живой платформы (scroll) ──────────
    {
      id: "choose",
      title: "ЧТО ПРОВЕРИМ ПЕРВЫМ?",
      num: "интерактив",
      accent: "cyan",
      kind: "scroll",
      scrollable: true,
      sound: "bip",
      node: (
        <div
          className={`cb-choose${bossTab === "sheet" ? " cb-choose--sheet" : ""}`}
          style={ink({}, "0.3s")}
          aria-label="Что проверим первым"
        >
          <div className="cb-choose__tabs" role="tablist" aria-label="Экраны платформы" style={ink({}, "0.55s")}>
            {(
              [
                ["sheet", "Ведомость"],
                ["salary", "Зарплата"],
                ["park", "Мотопарк"],
                ["stats", "Статистика"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={bossTab === key}
                className="cb-choose__tab"
                onClick={() => {
                  setBossTab(key);
                  if (soundRef.current && audioRef.current) playSound("bip", audioRef.current);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="cb-choose__stage" style={ink({}, "0.8s")}>
            <AnimatePresence mode="wait">
              {bossTab && (
                <motion.div
                  key={bossTab}
                  className="cb-miniscreen cb-miniscreen--sheet"
                  initial={{ opacity: 0, y: 18, rotate: -1.5 }}
                  animate={{ opacity: 1, y: 0, rotate: 0 }}
                  exit={{ opacity: 0, y: -14, rotate: 1.5 }}
                  transition={{ duration: 0.28, ease: "easeOut" }}
                >
                  {bossTab === "sheet" ? (
                    <SalarySheet
                      onTap={() => {
                        if (soundRef.current && audioRef.current) playSound("bip", audioRef.current);
                      }}
                      animate={jsReady && !reduceMotion}
                    />
                  ) : (
                    <>
                      <div className="cb-miniscreen__app">
                        <b>{BOSS_SCREENS[bossTab].title}</b>
                        <span>{BOSS_SCREENS[bossTab].time}</span>
                      </div>
                      {BOSS_SCREENS[bossTab].rows.map(([name, value]) => (
                        <span key={name} className="cb-miniscreen__row">
                          <span>{name}</span>
                          <b>{value}</b>
                        </span>
                      ))}
                      <div className="cb-miniscreen__total">
                        <span>{BOSS_SCREENS[bossTab].total[0]}</span>
                        <b>{BOSS_SCREENS[bossTab].total[1]}</b>
                      </div>
                      <span className="cb-miniscreen__note">{BOSS_SCREENS[bossTab].note}</span>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
            {!bossTab && (
              <p className="cb-choose__hint">
                Четыре экрана живой платформы. Тарифы — из настоящего каталога,
                выдуманных рублей нет ни в одном выпуске.
              </p>
            )}
          </div>
        </div>
      ),
    },

    // ── тизер выпуска №3: BikeSoul — байки смотрят на читателя (splash) ────
    {
      id: "teaser",
      title: "БАЙКИ ТОЖЕ ХОТЯТ КУШАТЬ",
      num: "тизер · вып. 3",
      img: "/comic-book/ep3-bike.png",
      alt: "Чёрный электроспортбайк смотрит прямо на читателя из неонового гаража, Рустам со спины в углу",
      accent: "gold",
      kind: "splash",
      sound: "dzin",
      node: (
        <>
          <Pop
            className="cb-caption"
            style={ink({ maxWidth: "min(520px, 40%)", top: "26%", left: "4%" }, "0.9s")}
          >
            Пока Рустам считал деньги, байки начали считать свои.
          </Pop>
          <Pop
            className="cb-bubble cb-bubble--agent"
            style={ink({ top: "50%", left: "4%", width: "min(360px, 34%)" }, "1.4s")}
          >
            Хозяин, я вообще-то уже 12 дней без работы.
          </Pop>
          <Pop
            className="cb-bubble"
            style={ink({ top: "66%", right: "4%", width: "min(320px, 30%)" }, "1.75s")}
          >
            Да я сам без выходных!
          </Pop>
          <div className="cb-scene__footnote" style={ink({}, "2.2s")}>
            <div className="cb-teaser__hud">
              <span className="cb-teaser__chip cb-teaser__chip--level">
                УРОВЕНЬ 5 · ГОРОДСКОЙ ВОЛК
                <i aria-hidden="true">
                  <b style={{ width: "62%" }} />
                </i>
              </span>
              <span className="cb-teaser__chip cb-teaser__chip--mood">
                НАСТРОЕНИЕ: СКУЧАЕТ · 12 ДНЕЙ БЕЗ ДОРОГИ
              </span>
            </div>
            <p className="cb-teaser__punch">— Это не мои проблемы.</p>
            <p className="cb-teaser__note">
              BikeSoul — механика из роадмапа: у каждого байка свой уровень,
              характер и настроение. В разработке — комикс забежал вперёд.
            </p>
          </div>
        </>
      ),
    },

    // ── VIP BIKE UNIVERSE: сообщение трилогии (scroll) ─────────────────────
    {
      id: "universe",
      title: "СТАНЬ ВЛАДЕЛЬЦЕМ ЭКИПАЖА",
      num: "VIP BIKE UNIVERSE",
      accent: "magenta",
      kind: "scroll",
      scrollable: true,
      chrome: false,
      node: (
        <section className="cb-trilogy" style={ink({}, "0.3s")} aria-label="Сообщение трилогии">
          <span className="cb-trilogy__kicker" style={ink({}, "0.5s")}>VIP BIKE UNIVERSE · сообщение трилогии</span>
          <h2 className="cb-trilogy__title" style={ink({}, "0.8s")}>
            ЗАЧЕМ ПРОСТО ЧУВСТВОВАТЬ СЕБЯ ВЛАДЕЛЬЦЕМ?
            <span className="cb-trilogy__title-accent">СТАНЬ ВЛАДЕЛЬЦЕМ ЭКИПАЖА.</span>
          </h2>
          <div className="cb-universe" style={ink({}, "1.05s")}>
            <p className="cb-universe__en">
              Every bike has a story. Every rental creates a moment.
              <br />
              Every owner builds something bigger.
            </p>
            <div className="cb-universe__motto" aria-hidden="true">
              <span>RIDE.</span>
              <span>EARN.</span>
              <span>EVOLVE.</span>
            </div>
          </div>
          <p className="cb-trilogy__sub" style={ink({}, "1.4s")}>
            Выпуск 1 — байки начали зарабатывать. Выпуск 2 — счётчик доказал.
            Сезон продолжается:
          </p>
          <div className="cb-trilogy__season" style={ink({}, "1.65s")}>
            <span className="cb-trilogy__chip cb-trilogy__chip--done">
              Вып. 1 · Свой сайт за вечер — прочитан ✓
            </span>
            <span className="cb-trilogy__chip cb-trilogy__chip--done">
              Вып. 2 · Счётчик денег — только что ✓
            </span>
            <span className="cb-trilogy__chip cb-trilogy__chip--soon">
              Вып. 3 · Байки тоже хотят кушать — тизер уже выше
            </span>
            <span className="cb-trilogy__chip cb-trilogy__chip--soon">
              Вып. 4 · Кажется, это бизнес — в сценарии
            </span>
          </div>
          <div className="cb-final__cta cb-trilogy__cta" style={ink({}, "2s")}>
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
              Кто уже варится
            </a>
            <a className="cb-final__ghost" href="/leorus">
              Команда LEORUS
            </a>
          </div>
        </section>
      ),
    },

    // ── колофон → END SLATE «КОНЕЦ ПЕРЕДАЧИ» (scroll) ──────────────────────
    {
      id: "colophon",
      title: "КОНЕЦ ПЕРЕДАЧИ",
      num: "конец выпуска",
      accent: "gold",
      kind: "scroll",
      scrollable: true,
      chrome: false,
      node: (
        <footer className="cb-colophon" style={ink({}, "0.3s")}>
          <div className="cb-endslate">
            <span className="cb-endslate__off" style={ink({}, "0.5s")}>
              /// КОНЕЦ ПЕРЕДАЧИ ///
            </span>
            <p className="cb-endslate__next" style={ink({}, "0.8s")}>
              Вып. 3 · «БАЙКИ ТОЖЕ ХОТЯТ КУШАТЬ» — уже в монтаже
              <i className="cb-endslate__cursor" aria-hidden="true" />
            </p>
            <div className="cb-endslate__actions" style={ink({}, "1.15s")}>
              <a
                className="cb-final__btn"
                href="#cover"
                onClick={(e) => {
                  e.preventDefault();
                  e.currentTarget
                    .closest(".cb-scene")
                    ?.querySelector<HTMLElement>(".cb-scene__text")
                    ?.scrollTo({ top: 0 });
                  restartRef.current?.();
                }}
              >
                ⟲ Перечитать с обложки
              </a>
              <a
                className="cb-final__ghost"
                href="https://t.me/onebikeplsbot/app?startapp=comic-book"
              >
                Открыть в Telegram
              </a>
              <a className="cb-final__ghost" href="/salavey13">
                Подключить экипаж
              </a>
            </div>
            <dl className="cb-endslate__credits" style={ink({}, "1.45s")}>
              {[
                ["сценарий, код, звук", "zai-агент VIP BIKE"],
                ["панели", "AI-иллюстрация"],
                ["Рустам", "играет самого себя"],
                ["тарифы и суммы", "живой каталог — ни одного выдуманного рубля"],
                ["счёт № 0001", "шутливая оценка, не оферта"],
              ].map(([role, name]) => (
                <div key={role} className="cb-endslate__row">
                  <dt>{role}</dt>
                  <dd>{name}</dd>
                </div>
              ))}
            </dl>
            <p style={ink({}, "1.7s")}>
              Выпуски 1–2 + счёт · панели AI · текст, SFX и счётчик — код ·
              тарифы из живого каталога · счёт № 0001 — шутка, не оферта ·
              один движок — любой бизнес: байки, сцены, твой черёд.
            </p>
            <nav aria-label="Комикс-навигация" style={ink({}, "1.95s")}>
              <a href="/">На главную</a>
              <a href="/salavey13">Как это устроено</a>
              <a href="/leorus">Команда LEORUS</a>
              <a href="/franchize/discovery">Кто уже варится</a>
            </nav>
          </div>
        </footer>
      ),
    },
  ];
  scenesRef.current = scenes;

  return (
    <div className={`cb-root${jsReady ? " cb-js" : ""}`}>
      {/* ── мачта комикса (в cine — фиксированная плашка над кадрами) ─────── */}
      <header className="cb-masthead">
        <a className="cb-masthead__brand" href="/">
          VIBERIDER<span> · PLATFORM</span>
        </a>
        <span className="cb-masthead__issue">ВЫПУСКИ 1–2 · СЕЗОН 2026</span>
        {jsReady && (
          <button
            type="button"
            className="cb-soundtoggle"
            onClick={toggleSound}
            aria-pressed={soundOn}
            title="Звук + автоплей"
          >
            {soundOn ? "♪ звук вкл · авто" : "♪ звук выкл"}
          </button>
        )}
        <a className="cb-masthead__cta" href="/salavey13">
          Подключить экипаж
        </a>
      </header>

      {/* ── CB CINE v7: кадры + HUD; без JS — статичный вебтун ───────────── */}
      <CineEngine
        scenes={scenes}
        active={jsReady}
        reduceMotion={!!reduceMotion}
        onSceneShown={handleSceneShown}
        restartRef={restartRef}
        auto={auto}
        onAutoToggle={toggleAuto}
        onAutoInterrupt={pauseAuto}
        onAutoEnd={pauseAuto}
      />
    </div>
  );
}
