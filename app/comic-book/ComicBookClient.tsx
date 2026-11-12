"use client";

// /app/comic-book/ComicBookClient.tsx
// ─────────────────────────────────────────────────────────────────────────────
// VIP BIKE COMICS · СЕЗОН 2026 — выпуски 1–2, версия 3.0 (task181).
//
// v1 (task179): 8 панелей про сборку байк-экипажа, текст наложен кодом.
// v2 (task180): X-Diavel → Falcon Lynx; GLITCH-арка «секретный уровень»
//   (LEORUS, «арендуй не байк — арендуй меня»); MUSTACHE PROTOCOL; баллоны
//   с лиц на пустоты; десктоп ~1080px; framer-motion (прогресс, пружины).
// v3 (task181) — ВЫПУСК №2 «СЧЁТЧИК ДЕНЕГ» по саджестам ChatGPT (босс
//   переслал): комедийная формула Кевила — Рустам пытается перестать
//   проверять заработок, уведомления побеждают:
//  • эпизоды I/II с полосами-разделителями;
//  • анимированный счётчик денег — ТОЛЬКО реальные тарифы живого каталога
//    (Shiver 750 сутки 12 000 ₽, Falcon Pro 6ч 7 000 ₽, Max Pro сутки
//    8 000 ₽ / 6ч 5 600 ₽ — rent-csv), ни одного выдуманного рубля;
//  • интерактивный телефон: тап → флип → разбивка заработка за сегодня;
//  • звук SFX: WebAudio-синт (КА-ЧИНГ, ДЗЫНЬ, БИП, БУМ, ГЛЮЧНЫЙ ШУМ),
//    тумблер в мачте, выключен по умолчанию (жест пользователя);
//  • пасхалка после финала: экран гаснет → «ЕЩЁ ОДНА АРЕНДА» → рука
//    тянется к телефону (счёт вечера: телефон — 4, Рустам — 0);
//  • терминология: «экипаж»/«деплой» ушли из нарратива (команда, байки,
//    сайт); продукт-термин «экипаж» остался только в CTA платформы;
//  • финал-теза трилогии: «Зачем просто чувствовать себя владельцем?
//    Стань владельцем экипажа» + дорожная карта сезона (выпуски 1–4).
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
  useScroll,
  useSpring,
  useTransform,
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
  delay?: number;
};

type Stache = {
  top: string;
  left: string;
  width: string;
  rotate: number;
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
  stache?: Stache;
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
    stache: { top: "19%", left: "65%", width: "10%", rotate: -8 },
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
    stache: { top: "18%", left: "77%", width: "10%", rotate: 8 },
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
    stache: { top: "25%", left: "59%", width: "10%", rotate: -6 },
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
    stache: { top: "20%", left: "69%", width: "9%", rotate: -10 },
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
    stache: { top: "21%", left: "41%", width: "9%", rotate: -6 },
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
    stache: { top: "26%", left: "62%", width: "9%", rotate: -6 },
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
    stache: { top: "38%", left: "45%", width: "8%", rotate: 4 },
    sound: "ching",
  },
  {
    num: "II·03",
    title: "ЭТО УЖЕ ПОДОЗРИТЕЛЬНО",
    img: "/comic-book/ep2-coffee.png",
    alt: "Рустам с кружкой кофе смотрит на вибрирующий телефон на стойке",
    accent: "cyan",
    captionWidth: "38%",
    captionPos: { right: "3%" },
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
    stache: { top: "16%", left: "22%", width: "9%", rotate: -5 },
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
    stache: { top: "48%", left: "8%", width: "10%", rotate: -8 },
  },
  {
    num: "II·05",
    title: "ПОСЛЕДНЯЯ ПРОВЕРКА",
    img: "/comic-book/ep2-phone-away.png",
    alt: "Рустам откинулся в кресле со скрещенными руками, телефон остался на столе",
    accent: "cyan",
    captionWidth: "42%",
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
    stache: { top: "24%", left: "76%", width: "9%", rotate: 7 },
    sound: "dzin",
    shake: true,
  },
];

const FINAL_STACHE: Stache = { top: "19%", left: "45%", width: "9%", rotate: 5 };

// пружины framer-motion
const SPRING = { type: "spring" as const, stiffness: 210, damping: 17 };

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

export default function ComicBookClient() {
  // Класс cb-js ставится только когда JS реально работает: без него весь
  // комикс (и все оверлеи) виден статично — no-JS и скриншотеры не теряют
  // ни панели, ни тексты.
  const [jsReady, setJsReady] = useState(false);
  const [stacheMode, setStacheMode] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const soundRef = useRef(false);
  const audioRef = useRef<AudioContext | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

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

  // Звук SFX: элементы с data-sound срабатывают один раз при появлении,
  // но только если читатель включил звук тумблером (жест → AudioContext).
  useEffect(() => {
    const root = pageRef.current;
    if (!root) return;
    const els = root.querySelectorAll("[data-sound]");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          io.unobserve(entry.target);
          const name = entry.target.getAttribute("data-sound") as SoundName | null;
          if (name && soundRef.current && audioRef.current) {
            playSound(name, audioRef.current);
          }
        });
      },
      { threshold: 0.35 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

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

  const renderPanel = (panel: Panel) => {
    const frameCls = `cb-panel__frame cb-halftone${panel.terminal ? " cb-panel__frame--glitch" : ""}${
      panel.custom === "phone" ? " cb-panel__frame--phone" : ""
    }`;
    const captionStyle: React.CSSProperties = {
      maxWidth: panel.captionWidth,
      top: panel.captionPos?.top,
      bottom: panel.captionPos?.bottom,
      left: panel.captionPos?.left ?? (panel.captionPos?.right ? "auto" : undefined),
      right: panel.captionPos?.right,
    };
    const shakeProps =
      jsReady && panel.shake && !reduceMotion
        ? {
            initial: { rotate: 0 },
            whileInView: { rotate: [0, -1.4, 1.4, -0.9, 0] },
            viewport: { once: true, amount: 0.5 },
            transition: { duration: 0.55, delay: 0.55, times: [0, 0.3, 0.55, 0.8, 1] },
          }
        : {};

    const frameInner = (
      <>
        {panel.custom === "phone" ? (
          <PhoneCounter jsReady={jsReady} label={panel.alt} />
        ) : (
          <img src={panel.img} alt={panel.alt} loading="lazy" />
        )}

        <Pop className="cb-caption" style={captionStyle}>
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

        {panel.stache && (
          <div className="cb-stache-wrap" style={{ top: panel.stache.top, left: panel.stache.left }}>
            <AnimatePresence>
              {stacheMode && <Mustache width={panel.stache.width} rotate={panel.stache.rotate} />}
            </AnimatePresence>
          </div>
        )}

        {renderDancingSfx(panel)}
      </>
    );

    return (
      <figure
        key={`${panel.num}-${panel.title}`}
        className={`cb-panel cb-panel--${panel.accent}`}
        data-num={panel.num}
        data-sound={panel.sound}
      >
        <span className="cb-panel__num" aria-hidden="true">
          {panel.num}
        </span>
        <h2 className="cb-panel__title">{panel.title}</h2>
        {jsReady ? (
          <motion.div className={frameCls} {...shakeProps}>
            {frameInner}
          </motion.div>
        ) : (
          <div className={frameCls}>{frameInner}</div>
        )}
      </figure>
    );
  };

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

      {/* ── обложка ───────────────────────────────────────────────────── */}
      <section className="cb-cover" aria-label="Обложка комикса">
        <div className="cb-cover__frame cb-halftone">
          <img
            src="/comic-book/cover.png"
            alt="Рустам — герой комикса — стоит с телефоном и электромотоциклом на фоне неонового города"
            className="cb-cover__art"
          />
          <div className="cb-cover__title-wrap">
            <span className="cb-cover__kicker">VIP BIKE COMICS · сезон 2026 · выпуски 1–2</span>
            <h1 className="cb-cover__title">
              {["КАК БАЙКИ", "НАЧАЛИ", "ЗАРАБАТЫВАТЬ"].map((word, i) => (
                <Pop key={word} delay={0.1 + i * 0.12} className={`cb-cover__line${word === "ЗАРАБАТЫВАТЬ" ? " cb-cover__line--accent" : ""}`}>
                  {word}
                </Pop>
              ))}
            </h1>
            <p className="cb-cover__sub">
              История одного вечера — и одного месяца, когда байки начали
              зарабатывать. Всё, что нарисовано, — реально работает на платформе.
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
        {/* ── эпизод I ──────────────────────────────────────────────────── */}
        <div className="cb-episode cb-episode--calm">
          <span className="cb-episode__tag">/// ЭПИЗОД I ///</span>
          <span className="cb-episode__title">КАК БАЙКИ НАЧАЛИ ЗАРАБАТЫВАТЬ</span>
          <span className="cb-episode__text">
            один вечер — от звонка в ночь до первой закрытой аренды
          </span>
        </div>

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

        {/* ── финал эпизода I ─────────────────────────────────────────── */}
        <figure className="cb-panel cb-panel--cyan cb-final">
          <span className="cb-panel__num" aria-hidden="true">
            финал
          </span>
          <h2 className="cb-panel__title">ТВОЙ ХОД</h2>
          <div className="cb-panel__frame cb-halftone">
            <img
              src="/comic-book/final.png"
              alt="Рустам ведёт экипаж через мост на рассвете"
              loading="lazy"
            />
            <Pop className="cb-caption" style={{ maxWidth: "44%" }}>
              Один вечер — две команды: байки катают, сцены гремят. Один движок —
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
              Команда LEORUS
            </a>
          </figcaption>
        </figure>

        {/* ── вишенка эпизода I: one last thing ───────────────────────── */}
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

        {/* ── эпизод II ────────────────────────────────────────────────── */}
        <div className="cb-episode cb-episode--glitch" data-sound="glitch">
          <span className="cb-episode__tag">/// ЭПИЗОД II ///</span>
          <span className="cb-episode__title">СЧЁТЧИК ДЕНЕГ</span>
          <span className="cb-episode__text">
            куда делся мой вечер? — аренды идут сами
          </span>
        </div>

        {EP2_PANELS.map((panel) => renderPanel(panel))}

        {/* ── пасхалка эпизода II: экран гаснет, но... ────────────────── */}
        <section className="cb-easter" data-sound="dzin" aria-label="Пасхалка после финала">
          <span className="cb-easter__cut">/// ЭКРАН ГАСНЕТ ///</span>
          <div className="cb-easter__frame">
            <img
              src="/comic-book/ep2-hand.png"
              alt="Рука в темноте хватает светящийся телефон"
              loading="lazy"
            />
            <Drop
              delay={0.9}
              style={{ top: "12%", right: "5%", width: "40%" }}
            >
              <div className="cb-notify">
                <span className="cb-notify__app">VIP BIKE · аналитика</span>
                <span className="cb-notify__title">ЕЩЁ ОДНА АРЕНДА</span>
                <span className="cb-notify__body">Shiver 750 · 6 часов · +5 000 ₽</span>
              </div>
            </Drop>
          </div>
          <span className="cb-easter__score">СЧЁТ ВЕЧЕРА: ТЕЛЕФОН — 4 · РУСТАМ — 0</span>
          <p className="cb-easter__line">
            Байки катают, счётчик считает, телефон пишет первым. Так и выглядит
            бизнес, который не нужно проверять силой воли.
          </p>
        </section>

        {/* ── теза трилогии + дорожная карта сезона ───────────────────── */}
        <section className="cb-trilogy" aria-label="Сообщение трилогии">
          <span className="cb-trilogy__kicker">сообщение трилогии</span>
          <h2 className="cb-trilogy__title">
            ЗАЧЕМ ПРОСТО ЧУВСТВОВАТЬ СЕБЯ ВЛАДЕЛЬЦЕМ?
            <span className="cb-trilogy__title-accent">СТАНЬ ВЛАДЕЛЬЦЕМ ЭКИПАЖА.</span>
          </h2>
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
              Вып. 3 · Байки тоже хотят кушать — скоро
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
      </main>

      {/* ── колофон ───────────────────────────────────────────────────── */}
      <footer className="cb-colophon">
        <p>
          Выпуски 1–2 · панели нарисованы AI · реплики, титры и SFX наложены кодом,
          звуки синтезированы WebAudio · счётчик считает по живым тарифам каталога,
          ни одного выдуманного рубля · клиенты не переписываются с ботом — сайт
          продаёт сам, у каждого в команде личный zai-агент · один движок — любой
          бизнес: байки, сцены, твой черёд.
        </p>
        <nav aria-label="Комикс-навигация">
          <a href="/">На главную</a>
          <a href="/salavey13">Как это устроено</a>
          <a href="/leorus">Команда LEORUS</a>
          <a href="/franchize/discovery">Кто уже варится</a>
        </nav>
      </footer>
    </div>
  );
}
