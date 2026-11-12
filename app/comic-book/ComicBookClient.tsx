"use client";

// /app/comic-book/ComicBookClient.tsx
// ─────────────────────────────────────────────────────────────────────────────
// VIP BIKE COMICS · СЕЗОН 2026 — выпуски 1–2 + счёт, версия 4.0 (task182).
//
// v1 (task179): 8 панелей про сборку байк-экипажа, текст наложен кодом.
// v2 (task180): X-Diavel → Falcon Lynx; GLITCH-арка «секретный уровень»
//   (LEORUS, «арендуй не байк — арендуй меня»); баллоны с лиц на пустоты;
//   десктоп ~1080px; framer-motion (прогресс, пружины).
// v3 (task181): выпуск №2 «СЧЁТЧИК ДЕНЕГ» — интерактивный телефон на живых
//   тарифах, WebAudio-SFX, пасхалка «ЕЩЁ ОДНА АРЕНДА», теза трилогии,
//   «экипаж/деплой» ушли из нарратива.
// v4 (task182) — второй раунд саджестов ChatGPT:
//  • MUSTACHE PROTOCOL списан на берег (босс: «0 of mustashes were on point»);
//  • вместо него вишенка эпизода I — СЧЁТ № 0001: шутливая стоимость
//    воспроизведения платформы $170 000, специальная цена для первого
//    владельца — ∞ (не оферта, цифры для разговора с инвестором);
//  • «выбор приключения» после II·05: телефон снова в руках — что проверим
//    первым? Зарплата / Мотопарк / Статистика; мотопарк — живые тарифы,
//    демо-числа помечены честно;
//  • тизер выпуска №3: BikeSoul — байк смотрит на читателя, уровни и
//    настроения из PRD (пометка: механика из роадмапа, в разработке);
//  • бесконечная камера: скролл ведёт зум/панораму внутри панелей
//    (useScroll + useTransform, reduced-motion и no-JS отключают);
//  • финал: VIP BIKE UNIVERSE — Every bike has a story · RIDE. EARN. EVOLVE.
// v5 (task183) — босс: «зарплатные листы прямо напрашиваются — yeah, like
//  tableview in rentals-analytics ;)»:
//  • вкладка «Ведомость» — мини-версия боевой таблицы «Аналитика аренды →
//    📋 Таблица и экспорт CSV»: sticky-рейка слева (время + марка), чипы
//    сверки 🤝 «все / ✅ / ⏳ / ⚠️» с живым фильтром (СВОДКА пересчитывается),
//    блоки АРЕНДЫ/СВОДКА, тонировка строк верификацией, колонки боевыми
//    именами (Цена, ЗП экип, Оператор (ЗП)); числа демо — помечено;
//  • deep link t.me/onebikeplsbot/app?startapp=comic-book подключён к
//    статическому fast-path (START_PARAM_PAGE_MAP + regression-тесты).
// v6 (task186) — CB CINE: движок «кинематографического комикса» (босс:
//  «new media type, between comics and video», «8fps anime», «each next
//  section on top of previous», «fullscreen, threshold ≈ screen height»):
//  • страница больше не скроллится: CineEngine (CineEngine.tsx) держит
//    кадры fullscreen-секциями; скролл/тач копятся в виртуальную ленту,
//    порог ≈ пол-экрана — следующий кадр НАКРЫВАЕТ предыдущий;
//  • переходы steps(8) = 8fps аниме; фон каждого кадра живёт (зум/панорама
//    steps(8)); HUD-рейка кадров + счётчик + deep-link #hash кадра;
//  • весь контент v1–v5 сохранён 1:1 (панели, GLITCH, счёт, Ведомость,
//    пасхалка, тизер, UNIVERSE); no-JS/боты — статичный вебтун (движок спит);
//  • «бесконечная камера» v4 (useScroll-зум внутри панели) снята — её роль
//    теперь играет живой фон кадра + камера-отъезд предыдущего кадра.
// Референс героя — founder-rustam.jpg из /leorus hero (task179).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState, type ReactNode } from "react";
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
import CineEngine, { type CineSceneDef } from "./CineEngine";

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
  captionWidth: string;
  captionPos?: { top?: string; left?: string; right?: string; bottom?: string };
  bubbles?: Bubble[];
  notify?: Notify;
  sfx?: Sfx;
  terminal?: string[];
  sound?: SoundName;
  shake?: boolean;
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
// позиции выверены по контакт-листу: ни один баллон не сидит на лице ────────
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
    sound: "dzin",
  },
  {
    num: "02",
    title: "ОДНА КНОПКА",
    img: "/comic-book/panel02.png",
    alt: "Палец нажимает огромную неоновую кнопку на голографическом экране",
    accent: "magenta",
    captionWidth: "46%",
    caption:
      "Никаких ТЗ на сорок страниц. Никакой команды разработки. Одна кнопка — и платформа уже строит каркас твоего сайта.",
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
    sound: "ching",
  },
  {
    num: "03",
    title: "ЛИЧНЫЙ ZAI",
    img: "/comic-book/panel03.png",
    alt: "Рустам пьёт кофе, пока голографический zai-агент собирает сайт",
    accent: "cyan",
    captionWidth: "42%",
    caption:
      "У каждого в команде — личный bootstrapped zai-агент. Не общий чат-бот на всех, а свой, с ключами к своей базе.",
    bubbles: [
      {
        text: "Не отвлекайся, шеф. Сайт сам себя не соберёт.",
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
    title: "МОЖНО ПРИНИМАТЬ АРЕНДЫ",
    img: "/comic-book/panel06.png",
    alt: "Ракета стартует с ноутбука, над которым парит дашборд сайта",
    accent: "magenta",
    captionWidth: "40%",
    caption:
      "Сказал утром — вечером в проде. Сайт команды в сети, домен работает, витрина уже продаёт.",
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
    sound: "boom",
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
    sound: "dzin",
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
  },
];

// ── секретный уровень эпизода I: глюк в другой бизнес ──────────────────────
const GLITCH_PANELS: Panel[] = [
  {
    num: "GLITCH",
    title: "ТЕСТ НА ГЛЮК",
    img: "/comic-book/glitch.png",
    alt: "Каталог байков распадается на глитч-пиксели и собирается в сцену фестиваля",
    accent: "gold",
    captionWidth: "46%",
    captionPos: { bottom: "14%" },
    caption:
      "Панель 07 вдруг заискрила. Не баг — фича: каталог — это просто список. Подставь другой список — получишь другой бизнес.",
    terminal: [
      "$ zai crew patch --catalog",
      "> bikes[]  → performances[]",
      "> движок: тот же",
      "> LEORUS.exe … ЗАПУЩЕН",
    ],
    sfx: { text: "ГЛЮК?!", color: "yellow", top: "7%", right: "5%", rotate: 6 },
    sound: "glitch",
  },
  {
    num: "LEORUS",
    title: "АРЕНДУЙ РУСТАМА",
    img: "/comic-book/dj.png",
    alt: "Рустам за диджейским пультом на главном фестивальном экране, толпа внизу",
    accent: "gold",
    captionWidth: "40%",
    caption:
      "Вторая команда Рустама — ивент-агентство LEORUS. Тот же движок, но вместо байков — сцены и выступления.",
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
      app: "LEORUS · веб-приложение",
      title: "НОВАЯ БРОНЬ ВЫСТУПЛЕНИЯ",
      body: "DJ Rustam · 3 часа · предоплата принята",
      top: "38%",
      right: "4%",
      width: "36%",
    },
    sfx: { text: "БУМ!", color: "magenta", top: "6%", right: "4%", rotate: 8 },
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
    img: "/comic-book/ep2-couch.png",
    alt: "Рустам лежит на диване ночью, лицо подсвечено экраном телефона",
    accent: "cyan",
    captionWidth: "46%",
    caption:
      "Месяц спустя. 23:48. Байки катают сами, сайт продаёт сам, смена давно закрыта. Оставалось только не трогать телефон.",
    bubbles: [
      {
        text: "Интересно, сколько сегодня заработали мои байки? Пять секунд — и спать.",
        kind: "hero",
        top: "64%",
        left: "4%",
        width: "33%",
      },
    ],
  },
  {
    num: "II·02",
    title: "ОПА!",
    custom: "phone",
    alt: "Экран аналитики VIP BIKE: закрытая аренда и счётчик заработка, тап открывает разбивку",
    accent: "magenta",
    captionWidth: "46%",
    caption:
      "Аренда закрылась — и деньги сразу видны в аналитике. Счётчик считает только закрытые аренды: ни одного выдуманного рубля.",
    bubbles: [
      {
        text: "Так. А ну-ка ещё раз обновим.",
        kind: "hero",
        top: "74%",
        right: "4%",
        width: "26%",
      },
    ],
    sfx: { text: "КА-ЧИНГ!", color: "yellow", top: "26%", right: "4%", rotate: 7 },
    sound: "ching",
  },
  {
    num: "II·03",
    title: "ЭТО УЖЕ ПОДОЗРИТЕЛЬНО",
    img: "/comic-book/ep2-coffee.png",
    alt: "Рустам с кружкой кофе смотрит на вибрирующий телефон на стойке",
    accent: "cyan",
    captionWidth: "38%",
    captionPos: { right: "3%", top: "46%" },
    caption:
      "Пока он делал глоток, закрылась ещё одна аренда. Он не нажимал ничего. Кофе тоже.",
    bubbles: [
      {
        text: "Я вообще-то просто кофе пил!",
        kind: "hero",
        top: "70%",
        right: "5%",
        width: "28%",
      },
    ],
    notify: {
      app: "VIP BIKE · аналитика",
      title: "АРЕНДА ЗАВЕРШЕНА",
      body: "Falcon Pro · 6 часов · +7 000 ₽",
      top: "30%",
      right: "5%",
      width: "34%",
    },
    sound: "bip",
  },
  {
    num: "II·04",
    title: "КАЖЕТСЯ, Я ПОНЯЛ",
    img: "/comic-book/ep2-garage.png",
    alt: "Рустам со спины смотрит на ряд мотоциклов в неоновом гараже",
    accent: "magenta",
    captionWidth: "44%",
    caption:
      "Ночной обход ангара: все на ходу, все в работе. Продюсер вдруг видит схему целиком — и она ему нравится.",
    bubbles: [
      {
        text: "Они там катаются — я тут считаю. Неплохая схема!",
        kind: "hero",
        top: "58%",
        left: "4%",
        width: "31%",
      },
    ],
  },
  {
    num: "II·05",
    title: "ПОСЛЕДНЯЯ ПРОВЕРКА",
    img: "/comic-book/ep2-phone-away.png",
    alt: "Рустам откинулся в кресле со скрещенными руками, телефон остался на столе",
    accent: "cyan",
    captionWidth: "42%",
    captionPos: { bottom: "12%" },
    caption:
      "Драматическая пауза. Он кладёт телефон на стол. Взрослый человек. Хозяин своего вечера.",
    bubbles: [
      {
        text: "Всё. Больше сегодня не проверяю.",
        kind: "hero",
        top: "70%",
        right: "5%",
        width: "27%",
      },
    ],
    sfx: { text: "ДЗЫНЬ!", color: "cyan", top: "5%", left: "47%", rotate: -8 },
    notify: {
      app: "VIP BIKE · аналитика",
      title: "ЕЩЁ ОДНА АРЕНДА",
      body: "Max Pro · 6 часов · +5 600 ₽",
      top: "30%",
      left: "7%",
      width: "33%",
      delay: 1.1,
    },
    sound: "dzin",
    shake: true,
  },
];

// ── «выбор приключения»: четыре экрана живой платформы после II·05 ──────────
// Ведомость (task183) — мини-версия боевой таблицы аналитики; мотопарк —
// живые тарифы rent-csv; зарплата/статистика — названия из боевых модулей,
// числа демо (помечено в примечании каждого экрана).
type BossTab = "sheet" | "salary" | "park" | "stats";

// ── ВЕДОМОСТЬ: данные демо-вечера (та же шестёрка аренд, что в «Статистике»:
// «Аренды сегодня — 6»). Часы/цены — живой каталог; ЗП экип — демо-процент:
// боевой модуль считает по закрытым арендам (subrent-сплит: партнёру
// owner_pct% байк-части, экипажу экип + наценка — rental-price-split.ts).
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

// пружины framer-motion
const SPRING = { type: "spring" as const, stiffness: 210, damping: 17 };

// ── интерактивный телефон эпизода II: счётчик + флип к разбивке ────────────
// Суммы из живого каталога: Shiver 750 сутки 12 000 · Falcon Pro 6ч 7 000 ·
// Max Pro сутки 8 000. Итого вечера: 27 000 ₽.
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

// ── ВЕДОМОСТЬ (task183): мини-версия боевой «Таблицы и экспорта CSV» из
// аналитики аренды (ExportCsvModal). Что взято из боевой модалки один в один:
//   • горизонтальный скролл со sticky-рейкой слева (время + марка);
//   • чипы сверки 🤝 «все / ✅ / ⏳ / ⚠️» — клик фильтрует строки,
//     СВОДКА пересчитывается под фильтр (в бою это quick-filter Task 126);
//   • секции АРЕНДЫ и СВОДКА (Блок · Записей · Выручка · ЗП);
//   • тонировка строк статусом сверки (зелёный/янтарный/красный);
//   • колонки боевыми именами: Часы, Цена, ЗП экип, Оператор (ЗП),
//     Верификация.
// Числа демо: боевой модуль ЗП считает по закрытым арендам платформы.
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
  const soundRef = useRef(false);
  const audioRef = useRef<AudioContext | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const scenesRef = useRef<CineSceneDef[]>([]);
  const reduceMotion = useReducedMotion();

  // JS жив → включается CB CINE (движок кадров). Без JS — статичный вебтун.
  useEffect(() => {
    setJsReady(true);
  }, []);

  // SFX кадра: движок сообщает о показе кадра — если звук включён, играем.
  const handleSceneShown = (index: number) => {
    const s = scenesRef.current[index];
    if (s?.sound && soundRef.current && audioRef.current) {
      playSound(s.sound as SoundName, audioRef.current);
    }
  };

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
  };

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

  // ── CB CINE v6: текстовый слой кадра (титры/пузыри/SFX поверх fullscreen-фона) ──
  // позиция титра: дефолт «под заголовком кадра» (CSS), captionPos перекрывает
  const captionStyle = (panel: Panel): React.CSSProperties => ({
    maxWidth: panel.captionWidth,
    top: panel.captionPos?.top ?? (panel.captionPos?.bottom ? "auto" : undefined),
    bottom: panel.captionPos?.bottom,
    left: panel.captionPos?.left ?? (panel.captionPos?.right ? "auto" : undefined),
    right: panel.captionPos?.right,
  });

  const panelNode = (panel: Panel) => (
    <>
      {panel.custom === "phone" && (
        <div className="cb-scene__phonebox">
          <PhoneCounter jsReady={jsReady} label={panel.alt} />
        </div>
      )}

      <Pop className="cb-caption" style={captionStyle(panel)}>
        {panel.caption}
      </Pop>

      {panel.terminal && (
        <Pop
          className="cb-terminal"
          style={{ top: "24%", left: "6%", width: "min(440px, 42%)" }}
          delay={0.35}
        >
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
          delay={panel.notify.delay}
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

      {renderSfx(panel)}
    </>
  );

  // панель → кадр (номер/заголовок рисует движок из def)
  const panelDef = (panel: Panel): CineSceneDef => ({
    id: `p${panel.num.toLowerCase().replace(/[^a-z0-9]/g, "")}`,
    title: panel.title,
    num: panel.num,
    img: panel.img,
    alt: panel.alt,
    accent: panel.accent,
    sound: panel.sound,
    shake: panel.shake,
    glitch: Boolean(panel.terminal),
    node: panelNode(panel),
  });

  // титульная карточка — «склейка» между эпизодами
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
    chrome: false,
    node: (
      <div className="cb-cinediv" {...(ghost ? { "data-ghost": ghost } : {})}>
        <span className="cb-cinediv__tag">{tag}</span>
        <span className="cb-cinediv__title">{title}</span>
        <span className="cb-cinediv__sub">{sub}</span>
      </div>
    ),
  });

  // ════════════════════════════════════════════════════════════════════════
  // CB CINE v6: сборка кадров. Порядок = хронометраж выпуска:
  // обложка → титр I → панели 01–08 → секретный уровень → финал → счёт
  // → титр II → панели II·01–II·05 → интерактив → пасхалка → тизер →
  // UNIVERSE → колофон. Весь контент v1–v5 сохранён 1:1.
  // ════════════════════════════════════════════════════════════════════════
  const scenes: CineSceneDef[] = [
    // ── обложка (1:1 — вписываем в кадр, атмосферу даёт блюр-слой) ────────
    {
      id: "cover",
      title: "ОБЛОЖКА",
      img: "/comic-book/cover.png",
      alt: "Рустам — герой комикса — стоит с телефоном и электромотоциклом на фоне неонового города",
      accent: "cyan",
      contain: true,
      chrome: false,
      node: (
        <div className="cb-cinecover">
          <span className="cb-cover__kicker">VIP BIKE COMICS · сезон 2026 · выпуски 1–2</span>
          <h1 className="cb-cover__title">
            {["КАК БАЙКИ", "НАЧАЛИ", "ЗАРАБАТЫВАТЬ"].map((word, i) => (
              <Pop
                key={word}
                delay={0.1 + i * 0.12}
                className={`cb-cover__line${word === "ЗАРАБАТЫВАТЬ" ? " cb-cover__line--accent" : ""}`}
              >
                {word}
              </Pop>
            ))}
          </h1>
          <p className="cb-cover__sub">
            История одного вечера — и одного месяца, когда байки начали
            зарабатывать. Всё, что нарисовано, — реально работает на платформе.
          </p>
          <div className="cb-cover__price" aria-hidden="true">
            <span>ЦЕНА ВОПРОСА:</span>
            <b>10 минут вечера</b>
          </div>
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

    // ── панели эпизода I ───────────────────────────────────────────────────
    ...PANELS.map(panelDef),

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

    ...GLITCH_PANELS.map(panelDef),

    // ── финал эпизода I ────────────────────────────────────────────────────
    {
      id: "finale",
      title: "ТВОЙ ХОД",
      num: "финал",
      img: "/comic-book/final.png",
      alt: "Рустам ведёт экипаж через мост на рассвете",
      accent: "cyan",
      node: (
        <>
          <Pop
            className="cb-caption"
            style={{ maxWidth: "min(560px, 44%)", top: "26%", left: "4%" }}
          >
            Один вечер — две команды: байки катают, сцены гремят. Один движок —
            любой бизнес. Дальше по сценарию — ты.
          </Pop>
          <div className="cb-scene__cta">
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

    // ── вишенка эпизода I: счёт № 0001 ─────────────────────────────────────
    {
      id: "invoice",
      title: "СЧЁТ № 0001",
      num: "бонус",
      accent: "gold",
      scrollable: true,
      node: (
        <div className="cb-cherry">
          <button
            type="button"
            className="cb-cherry__btn"
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
                  цифры для разговора с первым владельцем, не коммерческое
                  предложение. Инвестиции в развитие принимаются. P.S. Оплата
                  кофе и топлива в стоимость не включена.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
          <p className="cb-cherry__hint">
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

    // ── панели эпизода II ──────────────────────────────────────────────────
    ...EP2_PANELS.map(panelDef),

    // ── выбор приключения: четыре экрана живой платформы ───────────────────
    {
      id: "choose",
      title: "ЧТО ПРОВЕРИМ ПЕРВЫМ?",
      num: "интерактив",
      accent: "cyan",
      scrollable: true,
      sound: "bip",
      node: (
        <div
          className={`cb-choose${bossTab === "sheet" ? " cb-choose--sheet" : ""}`}
          aria-label="Что проверим первым"
        >
          <div className="cb-choose__tabs" role="tablist" aria-label="Экраны платформы">
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
          <div className="cb-choose__stage">
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
                Четыре экрана из живой платформы. Ведомость — мини-версия боевой
                таблицы аналитики аренды, мотопарк считает по настоящим тарифам
                каталога — выдуманных рублей здесь нет ни в одном выпуске.
              </p>
            )}
          </div>
        </div>
      ),
    },

    // ── пасхалка эпизода II: экран гаснет, но... ───────────────────────────
    {
      id: "easter",
      title: "ЭКРАН ГАСНЕТ",
      num: "II·∞",
      img: "/comic-book/ep2-hand.png",
      alt: "Рука в темноте хватает светящийся телефон",
      accent: "magenta",
      sound: "dzin",
      node: (
        <>
          <Drop delay={0.9} style={{ top: "16%", right: "5%", width: "min(380px, 42%)" }}>
            <div className="cb-notify">
              <span className="cb-notify__app">VIP BIKE · аналитика</span>
              <span className="cb-notify__title">ЕЩЁ ОДНА АРЕНДА</span>
              <span className="cb-notify__body">Shiver 750 · 6 часов · +5 000 ₽</span>
            </div>
          </Drop>
          <div className="cb-scene__footnote">
            <span className="cb-easter__score">СЧЁТ ВЕЧЕРА: ТЕЛЕФОН — 4 · РУСТАМ — 0</span>
            <p className="cb-easter__line">
              Байки катают, счётчик считает, телефон пишет первым. Так и выглядит
              бизнес, который не нужно проверять силой воли.
            </p>
          </div>
        </>
      ),
    },

    // ── тизер выпуска №3: BikeSoul — байки смотрят на читателя ─────────────
    {
      id: "teaser",
      title: "БАЙКИ ТОЖЕ ХОТЯТ КУШАТЬ",
      num: "тизер · вып. 3",
      img: "/comic-book/ep3-bike.png",
      alt: "Чёрный электроспортбайк смотрит прямо на читателя из неонового гаража, Рустам со спины в углу",
      accent: "gold",
      sound: "dzin",
      node: (
        <>
          <Pop
            className="cb-caption"
            style={{ maxWidth: "min(520px, 40%)", top: "26%", left: "4%" }}
          >
            Пока Рустам считал деньги, байки начали считать свои.
          </Pop>
          <Pop
            className="cb-bubble cb-bubble--agent"
            style={{ top: "50%", left: "4%", width: "min(360px, 34%)" }}
            delay={0.2}
          >
            Хозяин, я вообще-то уже 12 дней без работы.
          </Pop>
          <Pop
            className="cb-bubble"
            style={{ top: "66%", right: "4%", width: "min(320px, 30%)" }}
            delay={0.35}
          >
            Да я сам без выходных!
          </Pop>
          <div className="cb-scene__footnote">
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
              BikeSoul — геймификация из роадмапа платформы: у каждого мотоцикла
              появятся свой уровень, характер и настроение, а по утрам — сводка
              «твой байк вчера заработал». Механика в разработке: комикс просто
              забежал вперёд.
            </p>
          </div>
        </>
      ),
    },

    // ── VIP BIKE UNIVERSE: сообщение трилогии + дорожная карта ─────────────
    {
      id: "universe",
      title: "СТАНЬ ВЛАДЕЛЬЦЕМ ЭКИПАЖА",
      num: "VIP BIKE UNIVERSE",
      accent: "magenta",
      scrollable: true,
      chrome: false,
      node: (
        <section className="cb-trilogy" aria-label="Сообщение трилогии">
          <span className="cb-trilogy__kicker">VIP BIKE UNIVERSE · сообщение трилогии</span>
          <h2 className="cb-trilogy__title">
            ЗАЧЕМ ПРОСТО ЧУВСТВОВАТЬ СЕБЯ ВЛАДЕЛЬЦЕМ?
            <span className="cb-trilogy__title-accent">СТАНЬ ВЛАДЕЛЬЦЕМ ЭКИПАЖА.</span>
          </h2>
          <div className="cb-universe">
            <p className="cb-universe__en">
              Every bike has a story. Every rental creates a moment.
              <br />
              Every owner builds something bigger.
            </p>
            <p className="cb-universe__ru">
              У каждого байка своя история. Каждая аренда создаёт момент. Каждый
              владелец строит что-то большее.
            </p>
            <div className="cb-universe__motto" aria-hidden="true">
              <span>RIDE.</span>
              <span>EARN.</span>
              <span>EVOLVE.</span>
            </div>
          </div>
          <p className="cb-trilogy__sub">
            Выпуск 1 — байки начали зарабатывать. Выпуск 2 — счётчик доказал.
            Сезон продолжается:
          </p>
          <div className="cb-trilogy__season">
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
          <div className="cb-final__cta cb-trilogy__cta">
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

    // ── колофон ────────────────────────────────────────────────────────────
    {
      id: "colophon",
      title: "КОЛОФОН",
      num: "конец выпуска",
      scrollable: true,
      chrome: false,
      node: (
        <footer className="cb-colophon">
          <p>
            Выпуски 1–2 + счёт · панели нарисованы AI · реплики, титры и SFX
            наложены кодом, звуки синтезированы WebAudio · счётчик и мотопарк
            считают по живым тарифам каталога, ни одного выдуманного рубля ·
            счёт № 0001 — шутливая оценка стоимости разработки, не оферта ·
            BikeSoul — механика из роадмапа · клиенты не переписываются с ботом —
            сайт продаёт сам · один движок — любой бизнес: байки, сцены, твой
            черёд.
          </p>
          <nav aria-label="Комикс-навигация">
            <a href="/">На главную</a>
            <a href="/salavey13">Как это устроено</a>
            <a href="/leorus">Команда LEORUS</a>
            <a href="/franchize/discovery">Кто уже варится</a>
            <a href="https://t.me/onebikeplsbot/app?startapp=comic-book">Открыть в Telegram</a>
          </nav>
        </footer>
      ),
    },
  ];
  scenesRef.current = scenes;

  return (
    <div className={`cb-root${jsReady ? " cb-js" : ""}`} ref={pageRef}>
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
          >
            {soundOn ? "♪ звук вкл" : "♪ звук выкл"}
          </button>
        )}
        <a className="cb-masthead__cta" href="/salavey13">
          Подключить экипаж
        </a>
      </header>

      {/* ── CB CINE: кадры + HUD; без JS — статичный вебтун ──────────────── */}
      <CineEngine
        scenes={scenes}
        active={jsReady}
        reduceMotion={!!reduceMotion}
        onSceneShown={handleSceneShown}
      />
    </div>
  );
}
