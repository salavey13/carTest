"use client";

// /app/comic-book/ComicBookClient.tsx
// ─────────────────────────────────────────────────────────────────────────────
// VIP BIKE COMICS · СЕЗОН 2026 — трилогия + счёт, версия 10.0 (task186).
//
// v1–v5: панели, GLITCH-арка, счёт № 0001, интерактивный телефон, Ведомость
//   (история в git; весь контент бережно переносится дальше).
// v6 (task186): CB CINE — cinematic engine (fullscreen-кадры, скролл=камера).
// v6.1: peek + цепочка проявления + end slate. v6.2: --ink-pace.
// v7: развороты (3/2/1 портретных панелей), тексты под цель, автоплей.
// v8: вертикаль едет по панелям разворота, чип «ещё N», перф (memo-кадры).
// v10 (текущее) — «hollywood preproduction slide deck, animated into rough
//   demo» (босс: «pacing still fast, ttl too low, deduce proper timings,
//   on pc show items one by one, animate even cursor, finish the trilogy»):
//  • панели разворота появляются ПО ОДНОЙ: stagger 0.42 → 1.4s (единая
//    ручка PANEL_STAGGER_S с движком), пузыри чаще разъезжаются (0.45s);
//  • хронометраж ПОД КОНТЕНТ: у каждого кадра свой ttl (сплэш 9–10.5s,
//    развороты 8.6–10.2s, интерактив 12.5–13.5s) — появление медленное,
//    но кадр держится достаточно долго, чтобы прочитать;
//  • КУРСОР-АКТЁР в автоплее: скользит по панелям каскада, открывает счёт
//    №0001, переворачивает телефон, щёлкает вкладки «Что проверить» и
//    жмёт вкладку «Зимнее хранение» — вся динамика проезжает сама;
//  • ФИНАЛ ТРИЛОГИИ (true story): эпизод III — голодный байк уходит на
//    зимовку, Рустам шепчет в диджей-микрофон «implement winter
//    storage» — и пуф: вкладка на главной каталога с формой заявок и
//    списком клиентов для владельца;
//  • Ken Burns стал заметнее (v9 был слишком тихим).
// v9 — темп и живость: каскад 0.42s, Ken Burns, WebP (−38% веса), scenes
//   в useMemo, финал в один кадр (10 ссылок → 3).
// ЦЕЛЬ КОМИКСА (v7): за ~3 минуты показать владельцу мото-экипажа (настоящему
//   или будущему), что платформа VibeRider собирает сайту экипажа витрину за
//   один вечер и начинает продавать аренды сама — на живых тарифах каталога,
//   без выдуманных рублей — и довести читателя до «Подключить экипаж».
// Референс героя — founder-rustam.jpg из /leorus hero (task179).
// ─────────────────────────────────────────────────────────────────────────────

import {
  AnimatePresence,
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import "./comic-book.css";
import CineEngine, { PANEL_STAGGER_S, type CineAutoAction, type CinePanelDef, type CineSceneDef } from "./CineEngine";

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
    img: "/comic-book/p01.webp",
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
    img: "/comic-book/p02.webp",
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
    img: "/comic-book/p03.webp",
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
    img: "/comic-book/p04.webp",
    alt: "Гигантский светящийся логотип влетает в неоновый билборд",
    accent: "magenta",
    caption: "Название, логотип, цвета — всё живёт в его репозитории, а не в чужом конструкторе.",
    bubbles: [{ text: "LEORUS RIDES. Звучит как фест. Оставляю.", kind: "hero" }],
    sfx: { text: "ВЖУХ!", color: "magenta", rotate: -6 },
  },
  {
    num: "05",
    title: "КАТАЛОГ ЗАЛЕТАЕТ",
    img: "/comic-book/p05.webp",
    alt: "Флагман Falcon Lynx на голографическом подиуме среди карточек каталога",
    accent: "cyan",
    caption: "Фото, цены, залоги — каталог собран раньше, чем остыл кофе.",
    bubbles: [{ text: "Falcon Lynx — в сетку. Красавец.", kind: "hero" }],
    sfx: { text: "БРРР!", color: "cyan", rotate: -5 },
  },
  {
    num: "06",
    title: "ВЕЧЕРОМ — В ПРОДЕ",
    img: "/comic-book/p06.webp",
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
    img: "/comic-book/p07.webp",
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
    img: "/comic-book/p08.webp",
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
    img: "/comic-book/pglitch.webp",
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
    img: "/comic-book/pdj.webp",
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
    img: "/comic-book/pcouch.webp",
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
    img: "/comic-book/pcoffee.webp",
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
    img: "/comic-book/pgarage.webp",
    alt: "Рустам со спины смотрит на ряд мотоциклов в неоновом гараже",
    accent: "magenta",
    caption: "Ночной обход ангара: все в работе. Схема видна целиком — и она нравится.",
    bubbles: [{ text: "Они катаются — я считаю. Неплохая схема!", kind: "hero" }],
  },
  {
    num: "II·05",
    title: "ПОСЛЕДНЯЯ ПРОВЕРКА",
    img: "/comic-book/pphoneaway.webp",
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
    img: "/comic-book/phand.webp",
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

// ── ЭПИЗОД III «БАЙКИ ТОЖЕ ХОТЯТ КУШАТЬ» — финал трилогии (true story) ──────
// Байк голодает на зимовке → идея: хранение = тоже аренда → Рустам шепчет
// в диджей-микрофон «implement winter storage» → пуф: вкладка в каталоге.
const EP3_PANELS: Panel[] = [
  {
    num: "III·01",
    title: "ГОЛОДНЫЙ СЕЗОН",
    img: "/comic-book/phungry.webp",
    alt: "Чёрный электроспортбайк с грустными светящимися глазами стоит один в тёмном гараже, из решётки пар",
    accent: "gold",
    caption: "Ноябрь. Дождь сдался и выпал снегом. Сезон закрыт — байки загоняют на зимовку, и флагман остаётся один.",
    bubbles: [{ text: "Хозяин, я вообще-то уже 12 дней без работы…", kind: "agent" }],
    sfx: { text: "БУУУ…", color: "cyan", rotate: -7 },
    sound: "dzin",
  },
  {
    num: "III·02",
    title: "ЗИМНЕЕ ХРАНЕНИЕ",
    img: "/comic-book/pstorage.webp",
    alt: "Байк в тёплом зимнем боксе среди полок, пледов и шин, за окном снег",
    accent: "cyan",
    caption: "Тёплый бокс, плед, тишина. И тут до него доходит: пустой бокс зимой — это не расход. Это услуга, которую никто не продаёт.",
    bubbles: [{ text: "Постой… хранение — это же тоже аренда?!", kind: "hero" }],
    sfx: { text: "ИДЕЯ!", color: "yellow", rotate: 6 },
  },
  {
    num: "III·03",
    title: "ШЁПОТ В МИКРОФОН",
    img: "/comic-book/pmic.webp",
    alt: "Рустам пытает дыханием диджей-микрофон, подключенный проводом к телефону",
    accent: "magenta",
    caption: "Рустам подключает диджей-микрофон к телефону и пытает его шёпотом в самое дыхание:",
    bubbles: [{ text: "implement winter storage…", kind: "hero" }],
    terminal: [
      "$ zai crew service add --winter-storage",
      "> каталог: вкладка создана",
      "> форма заявок: готова",
    ],
    sfx: { text: "ПШШШ…", color: "magenta", rotate: -6 },
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

// ── ЭПИЗОД III: «И ПУФ!» — вкладка «Зимнее хранение» на главной каталога ───
// Мок главной страницы каталога: вкладки Аренда / Продажа / Зимнее хранение
// (NEW). Внутри — форма заявки для клиентов и список заявок для владельца.
// Форма живая: сабмит добавляет клиента в список (демо). Тарифы — живой каталог.
type StorageTab = "rent" | "sale" | "winter";

const STORAGE_RENT: [string, string, string][] = [
  ["Falcon GT", "сутки", "12 000 ₽"],
  ["Aprilia Shiver 750", "сутки", "12 000 ₽"],
  ["Max Pro", "сутки", "8 000 ₽"],
];

function StorageCatalog({
  jsReady,
  sfx,
}: {
  jsReady: boolean;
  sfx?: (n: SoundName) => void;
}) {
  const [tab, setTab] = useState<StorageTab>("rent");
  const [clients, setClients] = useState([
    { name: "Марк", bike: "Falcon GT", period: "дек — мар", status: "оплачено" },
    { name: "Алина", bike: "Shiver 750", period: "дек — апр", status: "оплачено" },
    { name: "Тимур", bike: "Max Pro", period: "янв — мар", status: "счёт выставлен" },
  ]);
  const [form, setForm] = useState({ name: "", bike: "" });

  const pick = (t: StorageTab) => {
    setTab(t);
    sfx?.(t === "winter" ? "dzin" : "bip");
  };

  return (
    <div className="cb-storage" aria-label="Главная страница каталога с новой вкладкой «Зимнее хранение»">
      <div className="cb-storage__bar" aria-hidden="true">
        <i />
        <i />
        <i />
        <span>viberider · салон «salavey13» · каталог</span>
      </div>
      <div className="cb-storage__tabs" role="tablist" aria-label="Вкладки каталога">
        {(
          [
            ["rent", "Аренда"],
            ["sale", "Продажа"],
            ["winter", "Зимнее хранение"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            data-tab={key}
            aria-selected={tab === key}
            className={`cb-storage__tab${key === "winter" ? " cb-storage__tab--winter" : ""}`}
            onClick={() => pick(key)}
          >
            {label}
            {key === "winter" && <i className="cb-storage__new" aria-hidden="true">NEW</i>}
          </button>
        ))}
      </div>

      <div className="cb-storage__pane" role="tabpanel">
        {tab === "rent" && (
          <div className="cb-storage__rent">
            {STORAGE_RENT.map(([bike, per, price]) => (
              <span key={bike} className="cb-storage__card">
                <b>{bike}</b>
                <span>{per}</span>
                <i>{price}</i>
              </span>
            ))}
            <span className="cb-storage__hint">обычный сезон: каталог продаёт сам · вкладку «Зимнее хранение» ещё не открыли</span>
          </div>
        )}
        {tab === "sale" && (
          <p className="cb-storage__hint cb-storage__hint--alone">
            Витрина продажи — в следующем выпуске :)
          </p>
        )}
        {tab === "winter" && (
          <div className="cb-storage__grid">
            <form
              className="cb-storage__form"
              onSubmit={(e) => {
                e.preventDefault();
                setClients((cs) => [
                  ...cs,
                  {
                    name: form.name.trim() || "Без имени",
                    bike: form.bike.trim() || "любой",
                    period: "по запросу",
                    status: "только что",
                  },
                ]);
                setForm({ name: "", bike: "" });
                sfx?.("ching");
              }}
            >
              <b>Заявка на хранение</b>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Имя"
                aria-label="Имя"
                maxLength={40}
              />
              <input
                value={form.bike}
                onChange={(e) => setForm((f) => ({ ...f, bike: e.target.value }))}
                placeholder="Байк"
                aria-label="Байк"
                maxLength={40}
              />
              <button type="submit">Оставить заявку</button>
              <span>форма для клиентов · падает в список владельцу</span>
            </form>
            <div className="cb-storage__list" aria-live="polite">
              <b>Заявки <i>{clients.length}</i></b>
              <div className="cb-storage__rows">
                {clients.map((c, i) => (
                  <span key={`${c.name}-${i}`} className="cb-storage__row">
                    <b>{c.name}</b>
                    <span>{c.bike} · {c.period}</span>
                    <i>{c.status}</i>
                  </span>
                ))}
              </div>
              <span>список заявок — вид владельца экипажа</span>
            </div>
          </div>
        )}
      </div>
      {!jsReady && (
        <span className="cb-storage__hint">
          И пуф: вкладка «Зимнее хранение» появилась на главной каталога — форма для клиентов, список заявок для владельца.
        </span>
      )}
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

  // v10: SFX интерфейсных моков (вкладки каталога, форма заявки)
  const uiSfx = useCallback((n: SoundName) => {
    if (soundRef.current && audioRef.current) playSound(n, audioRef.current);
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

  // v10: задержки каскада РАСТЯНУТЫ (босс: «pacing of appearance still fast»
  // + «ttl of section is too low» — появление медленное, но кадр держится).
  // Панель за панелью — PANEL_STAGGER_S (1.4s, единая ручка с движком):
  // на PC три панели разворота появляются ПО ОДНОЙ, с читаемым интервалом.
  // Внутри панели каптион 1.35 → пузыри 1.85 → нотиф 2.3 → SFX 2.7.
  // Все числа умножаются на --ink-pace из CSS (единый темп, сейчас 1).
  const ink = (base: React.CSSProperties, d: string): React.CSSProperties =>
    ({ ...base, "--ink-d": `calc(${d} * var(--ink-pace, 1))` }) as React.CSSProperties;

  // ── стопка текста ПАНЕЛИ (внутри портретной колонки разворота) ──────────
  // каскад на панель k: каптион 1.35 → пузыри 1.85 → нотиф 2.3 → SFX 2.7,
  // каждая панель сдвинута на +0.42s (--pd выставляет движок для картинки).
  const sfxNode = (panel: Panel, k: number) =>
    panel.sfx ? (
      <span
        className={`cb-sfx cb-sfx--${panel.sfx.color}`}
        style={
          ink(
            { "--rot": `${panel.sfx.rotate}deg`, transform: `rotate(${panel.sfx.rotate}deg)` },
            `${(2.7 + k * PANEL_STAGGER_S).toFixed(2)}s`,
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
          style={ink({}, `${(2.3 + k * PANEL_STAGGER_S + (panel.notify.delay ?? 0)).toFixed(2)}s`)}
        >
          <div className="cb-notify">
            <span className="cb-notify__app">{panel.notify.app}</span>
            <span className="cb-notify__title">{panel.notify.title}</span>
            <span className="cb-notify__body">{panel.notify.body}</span>
          </div>
        </Drop>
      )}
      {panel.terminal && (
        <div className="cb-terminal" style={ink({}, `${(1.75 + k * PANEL_STAGGER_S).toFixed(2)}s`)}>
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
          style={ink({}, `${(1.85 + k * PANEL_STAGGER_S + i * 0.45).toFixed(2)}s`)}
        >
          {bubble.text}
        </Pop>
      ))}
      {panel.foot ?? (
        <p className="cb-caption" style={ink({}, `${(1.35 + k * PANEL_STAGGER_S).toFixed(2)}s`)}>
          {panel.caption}
        </p>
      )}
    </>
  );

  // телефон II·02 — отдельный слот «картинки» панели (в стопке текста ему тесно)
  const phoneSlot = (panel: Panel, k: number) => (
    <div className="cb-scene__phonebox" style={ink({}, `${(1.2 + k * PANEL_STAGGER_S).toFixed(2)}s`)}>
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
  // v10: ttl — хронометраж кадра в автоплее (титру хватает 6s)
  const dividerDef = (
    id: string,
    tag: string,
    title: string,
    sub: string,
    accent: "cyan" | "magenta" | "gold",
    sound?: SoundName,
    ghost?: string,
    ttl = 6000,
  ): CineSceneDef => ({
    id,
    title,
    accent,
    sound,
    ttl,
    kind: "splash",
    chrome: false,
    node: (
      <div className="cb-cinediv" style={ink({}, "0.25s")} {...(ghost ? { "data-ghost": ghost } : {})}>
        <span className="cb-cinediv__tag" style={ink({}, "0.6s")}>{tag}</span>
        <span className="cb-cinediv__title" style={ink({}, "1s")}>{title}</span>
        <span className="cb-cinediv__sub" style={ink({}, "1.45s")}>{sub}</span>
      </div>
    ),
  });

  // разворот из панелей (row): 3 колонки на PC, 2 на планшете, 1 на мобиле
  // v10: ttl — хронометраж под контент (последняя панель каскада + чтение);
  // auto — сценарные действия курсора (кликает динамику разворота)
  const rowDef = (
    id: string,
    title: string,
    accent: "cyan" | "magenta" | "gold",
    panels: Panel[],
    sound?: SoundName,
    opts?: { ttl?: number; auto?: CineAutoAction[] },
  ): CineSceneDef => ({
    id,
    title,
    accent,
    sound,
    kind: "row",
    ...(opts?.ttl ? { ttl: opts.ttl } : {}),
    ...(opts?.auto ? { auto: opts.auto } : {}),
    chrome: false, // у каждой панели свой бейдж-номер и заголовок
    panels: panels.map(panelDef),
  });

  // ════════════════════════════════════════════════════════════════════════
  // CB CINE v10: сборка кадров + хронометраж. Порядок выпуска:
  // обложка → титр I → развороты A/B/C (панели 01–08) → титр GLITCH →
  // разворот D → финал I → счёт → титр II → развороты E/F → интерактив →
  // титр III → разворот twist (зимнее хранение) → И ПУФ (вкладка каталога)
  // → финал трилогии. TTL каждого кадра — под его контент (слайд-дек).
  // Развороты = ряды портретных панелей; splash-кадры = «splash-страницы».
  // v9-перф: массив в useMemo — звук/автоплей-клики не пересобирают 15 кадров
  // (scene = сто+ узлов; каждый пересбор ломал memo SceneView в движке).
  // ════════════════════════════════════════════════════════════════════════
  const scenes: CineSceneDef[] = useMemo(() => [
    // ── обложка (splash, 1:1 — вписываем в кадр, атмосферу даёт блюр) ──────
    {
      id: "cover",
      title: "ОБЛОЖКА",
      img: "/comic-book/cover.webp",
      alt: "Рустам — герой комикса — стоит с телефоном и электромотоциклом на фоне неонового города",
      accent: "cyan",
      kind: "splash",
      contain: true,
      chrome: false,
      ttl: 9800,
      overlay: (
        <span className="cb-cover__cue cb-cover__cue--overlay" aria-hidden="true" style={ink({}, "2.9s")}>
          <i>▼</i> скролл — камера едет, следующий кадр уже выезжает
        </span>
      ),
      node: (
        <div className="cb-cinecover" style={ink({}, "0.2s")}>
          <span className="cb-cover__kicker" style={ink({}, "0.6s")}>
            VIP BIKE COMICS · сезон 2026 · трилогия
          </span>
          <h1 className="cb-cover__title" style={ink({}, "0.45s")}>
            {["КАК БАЙКИ", "НАЧАЛИ", "ЗАРАБАТЫВАТЬ"].map((word, i) => (
              <Pop
                key={word}
                className={`cb-cover__line${word === "ЗАРАБАТЫВАТЬ" ? " cb-cover__line--accent" : ""}`}
                style={ink({}, `${(0.95 + i * 0.3).toFixed(2)}s`)}
              >
                {word}
              </Pop>
            ))}
          </h1>
          <p className="cb-cover__sub" style={ink({}, "2s")}>
            Один вечер — и байки начали зарабатывать. Всё нарисованное — реально
            работает на платформе.
          </p>
          <div className="cb-cover__price" aria-hidden="true" style={ink({}, "2.4s")}>
            <span>ЦЕНА ВОПРОСА:</span>
            <b>10 минут вечера</b>
          </div>
          <span className="cb-cover__cue" aria-hidden="true" style={ink({}, "2.9s")}>
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

    // ── развороты эпизода I (панели 01–08) — каскад по одной, ttl под контент
    rowDef("p01-03", "ЗВОНОК В НОЧЬ · ОДНА КНОПКА · ЛИЧНЫЙ ZAI", "cyan", PANELS.slice(0, 3), undefined, { ttl: 10200 }),
    rowDef("p04-06", "БРЕНД-КУЗНИЦА · КАТАЛОГ · В ПРОДЕ", "magenta", PANELS.slice(3, 6), undefined, { ttl: 10200 }),
    rowDef("p07-08", "КЛИЕНТ АРЕНДОВАЛ · ВЫДАЧА", "cyan", PANELS.slice(6, 8), undefined, { ttl: 8600 }),

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
    rowDef("glitch-leorus", "ТЕСТ НА ГЛЮК · АРЕНДУЙ РУСТАМА", "gold", GLITCH_PANELS, undefined, { ttl: 8600 }),

    // ── финал эпизода I (splash с CTA) ─────────────────────────────────────
    {
      id: "finale",
      title: "ТВОЙ ХОД",
      num: "финал",
      img: "/comic-book/final.webp",
      alt: "Рустам ведёт экипаж через мост на рассвете",
      accent: "cyan",
      kind: "splash",
      ttl: 10500,
      node: (
        <>
          <Pop
            className="cb-caption"
            style={ink({ maxWidth: "min(560px, 44%)", top: "26%", left: "4%" }, "1.2s")}
          >
            Один вечер — две команды: байки катают, сцены гремят. Один движок —
            любой бизнес. Дальше по сценарию — ты.
          </Pop>
          <div className="cb-scene__cta" style={ink({}, "2.6s")}>
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

    // ── вишенка эпизода I: счёт № 0001 (scroll) — курсор сам открывает ────
    {
      id: "invoice",
      title: "СЧЁТ № 0001",
      num: "бонус",
      accent: "gold",
      kind: "scroll",
      scrollable: true,
      ttl: 12500,
      auto: [{ at: 2400, sel: ".cb-cherry__btn" }],
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

    // ── развороты эпизода II (панели II·01–II·∞); телефон переворачивает курсор
    rowDef("ep2-a", "ПРОСТО ПРОВЕРЮ · ОПА! · ПОДОЗРИТЕЛЬНО", "cyan", EP2_PANELS.slice(0, 3), undefined, {
      ttl: 10200,
      auto: [
        { at: 3600, sel: ".cb-phone" },
        { at: 6800, sel: ".cb-phone" },
      ],
    }),
    rowDef("ep2-b", "КАЖЕТСЯ, Я ПОНЯЛ · ПОСЛЕДНЯЯ ПРОВЕРКА · ЭКРАН ГАСНЕТ", "magenta", EP2_PANELS.slice(3, 6), undefined, { ttl: 10200 }),

    // ── выбор приключения: четыре экрана живой платформы (scroll) ──────────
    {
      id: "choose",
      title: "ЧТО ПРОВЕРИМ ПЕРВЫМ?",
      num: "интерактив",
      accent: "cyan",
      kind: "scroll",
      scrollable: true,
      sound: "bip",
      ttl: 13500,
      auto: [
        { at: 2800, sel: '[data-tab="salary"]' },
        { at: 7000, sel: '[data-tab="park"]' },
        { at: 10800, sel: '[data-tab="stats"]' },
      ],
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
                data-tab={key}
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

    // ── ЭПИЗОД III — финал трилогии (true story, босс: «finish the trilogy
    // with a twist: starving bike gets into his winter storage… rustam
    // whispers kinda torturing his dj mic: implement winter storage — and
    // puff — a tab on the main catalog page appears with a form for clients
    // and a list of clients for owner») ────────────────────────────────────
    dividerDef(
      "ep3",
      "/// ЭПИЗОД III ///",
      "БАЙКИ ТОЖЕ ХОТЯТ КУШАТЬ",
      "финал трилогии · и это true story",
      "gold",
      "dzin",
      "III",
    ),

    // разворот twist: голодный байк → зимнее хранение → шёпот в микрофон
    rowDef("ep3-twist", "ГОЛОДНЫЙ СЕЗОН · ЗИМНЕЕ ХРАНЕНИЕ · ШЁПОТ", "gold", EP3_PANELS, undefined, { ttl: 10200 }),

    // «И ПУФ!» — вкладка «Зимнее хранение» на главной каталога (scroll);
    // курсор в автоплее сам жмёт новую вкладку (поп-выезд на 1.15s)
    {
      id: "puff",
      title: "И ПУФ!",
      num: "true story",
      accent: "gold",
      kind: "scroll",
      scrollable: true,
      sound: "dzin",
      ttl: 12500,
      auto: [{ at: 3300, sel: '[data-tab="winter"]' }],
      node: (
        <div className="cb-puff" style={ink({}, "0.3s")}>
          <StorageCatalog jsReady={jsReady} sfx={uiSfx} />
          <p className="cb-caption cb-puff__caption" style={ink({}, "1.4s")}>
            И пуф — на главной странице каталога появилась вкладка «Зимнее
            хранение»: форма для клиентов, список заявок для владельца. Это не
            сюжет — это релиз.
          </p>
        </div>
      ),
    },

    // ── ФИНАЛ ТРИЛОГИИ: UNIVERSE + «КОНЕЦ ПЕРЕДАЧИ» в ОДНОМ кадре (scroll).
    // v10: трилогия завершена выпуском III — тизер больше не нужен,
    // «Вып. 3» стал «вы только что его прочитали» (twist-aware).
    {
      id: "universe",
      title: "СТАНЬ ВЛАДЕЛЬЦЕМ ЭКИПАЖА",
      num: "VIP BIKE UNIVERSE",
      accent: "magenta",
      kind: "scroll",
      scrollable: true,
      chrome: false,
      ttl: 13000,
      node: (
        <section className="cb-trilogy cb-trilogy--end" style={ink({}, "0.4s")} aria-label="Сообщение трилогии и конец выпуска">
          <span className="cb-trilogy__kicker" style={ink({}, "0.65s")}>VIP BIKE UNIVERSE · конец трилогии</span>
          <h2 className="cb-trilogy__title" style={ink({}, "0.9s")}>
            ЗАЧЕМ ПРОСТО ЧУВСТВОВАТЬ СЕБЯ ВЛАДЕЛЬЦЕМ?
            <span className="cb-trilogy__title-accent">СТАНЬ ВЛАДЕЛЬЦЕМ ЭКИПАЖА.</span>
          </h2>
          <div className="cb-universe" style={ink({}, "1.2s")}>
            <div className="cb-universe__motto" aria-hidden="true">
              <span>RIDE.</span>
              <span>EARN.</span>
              <span>EVOLVE.</span>
            </div>
          </div>
          <span className="cb-endslate__off" style={ink({}, "1.5s")}>
            /// КОНЕЦ ТРИЛОГИИ ///
          </span>
          <p className="cb-endslate__next" style={ink({}, "1.8s")}>
            Вып. 3 · «БАЙКИ ТОЖЕ ХОТЯТ КУШАТЬ» — вы его только что прочитали.
            True story: зимнее хранение появилось ровно так.
            <i className="cb-endslate__cursor" aria-hidden="true" />
          </p>
          <div className="cb-final__cta cb-trilogy__cta" style={ink({}, "2.15s")}>
            <motion.a
              className="cb-final__btn"
              href="/salavey13"
              {...(jsReady
                ? { whileHover: { scale: 1.05, rotate: -1.2 }, whileTap: { scale: 0.96 } }
                : {})}
            >
              Собрать свой экипаж →
            </motion.a>
            <a
              className="cb-final__ghost"
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
              ⟲ Перечитать
            </a>
            <a
              className="cb-final__ghost"
              href="https://t.me/onebikeplsbot/app?startapp=comic-book"
            >
              Telegram
            </a>
          </div>
          <p className="cb-trilogy__fine" style={ink({}, "2.4s")}>
            сценарий, код, звук — zai-агент VIP BIKE · панели — AI-иллюстрация ·
            тарифы — живой каталог, ни одного выдуманного рубля · счёт № 0001 —
            шутка, не оферта
          </p>
        </section>
      ),
    },
  ], [jsReady, invoiceOpen, bossTab, reduceMotion]);
  scenesRef.current = scenes;

  return (
    <div className={`cb-root${jsReady ? " cb-js" : ""}`}>
      {/* ── мачта комикса (в cine — фиксированная плашка над кадрами) ─────── */}
      <header className="cb-masthead">
        <a className="cb-masthead__brand" href="/">
          VIBERIDER<span> · PLATFORM</span>
        </a>
        <span className="cb-masthead__issue">ТРИЛОГИЯ · СЕЗОН 2026</span>
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

      {/* ── CB CINE v9: кадры + HUD; без JS — статичный вебтун ───────────── */}
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
