import Image from "next/image";
import Link from "next/link";
import { getCrewPaletteBySlug } from "@/app/franchize/actions";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FaTelegramPlane,
  FaMotorcycle,
  FaCoins,
  FaSearchDollar,
  FaRocket,
  FaNetworkWired,
  FaCheck,
  FaChartBar,
  FaFileInvoice,
} from "react-icons/fa";

export const metadata = {
  title: "SLY13 — платформа франшиз проката · salavey13",
  description:
    "Боевой экипаж VIP BIKE как первый клиент: сезон-2026 в живых цифрах, сверка и комиссии операторов, запуск экипажей под ключ. Витрина salavey13.",
};

// Сезон-2026 по месяцам (аренды по agreed_start_date, Supabase, ретро-импорт учтён —
// worklog tasks 111/113, октябрь 2026). Октябрь ещё шёл на момент среза.
const SEASON_MONTHS = [
  { m: "Май", n: 10 },
  { m: "Июн", n: 9 },
  { m: "Июл", n: 49 },
  { m: "Авг", n: 83 },
  { m: "Сен", n: 109 },
  { m: "Окт", n: 31 },
];
const SEASON_MAX = Math.max(...SEASON_MONTHS.map((x) => x.n));

// Услуги sly13 — синхронизировано с docs/crewDocs/sly13-seed.sql (public.cars, type "service").
// Живые цены — в каталоге; здесь только витрина.
const SERVICES = [
  {
    title: "Запуск экипажа «Базовый»",
    price: "25 000 ₽",
    text: "Полный запуск витрины: брендинг, каталог, корзина, админка, Telegram-бот. Два дня работы.",
    tag: "установка",
  },
  {
    title: "Запуск экипажа «Под ключ»",
    price: "60 000 ₽",
    text: "Всё из «Базового» + аналитика, документооборот, обучение двух админов, неделя сопровождения.",
    tag: "установка",
  },
  {
    title: "Vibe-сессия «Аудит»",
    price: "5 000 ₽",
    text: "Разбор текущих процессов бизнеса. Онлайн 1,5 часа: план цифровизации и первые шаги, готовый roadmap.",
    tag: "консультация",
  },
  {
    title: "Vibe-сессия «Проектирование»",
    price: "7 000 ₽",
    text: "Проектируем структуру экипажа: каталог, роли, процессы, документы. Онлайн 2 часа.",
    tag: "консультация",
  },
  {
    title: "Обучение админа",
    price: "3 000 ₽ / час",
    text: "Индивидуально: товары, заказы, аналитика, пользователи. Пакет 5 часов — 12 000 ₽.",
    tag: "обучение",
  },
  {
    title: "Сопровождение (месяц)",
    price: "15 000 ₽",
    text: "Апдейты, новые фичи, помощь админу, Telegram-саппорт в рабочее время.",
    tag: "поддержка",
  },
];

// Экипажи, которые уже примеряют платформу (гидрация/услуги в docs/crewDocs/*).
const PIPELINE_CREWS = [
  { slug: "moto-selection", label: "moto-selection", note: "мотосервис, 8 услуг, свой owner" },
  { slug: "georg-electro", label: "georg-electro", note: "диагностика электро-систем" },
  { slug: "nn-mototeh-nn", label: "nn-mototeh-nn", note: "мототехника NN, колесо фортуны e2e" },
  { slug: "djorudjov", label: "djorudjov", note: "контент и рассылки экипажа" },
];

const SEASON_STATS = [
  { icon: FaMotorcycle, value: "308", label: "аренд за сезон 2026", sub: "май → октябрь, включая ретро-импорт архива" },
  { icon: FaCoins, value: "≈ 2,0 млн ₽", label: "выручка по аренде", sub: "пик сезона: 109 аренд в сентябре" },
  { icon: FaFileInvoice, value: "31 ДКП", label: "продажи байков", sub: "≈ 13,0 млн ₽ по договорам купли-продажи" },
  { icon: FaChartBar, value: "≈ 16,5 млн ₽", label: "оборот кассы", sub: "приход/расход со сдвигами и зарплатами" },
];

export default async function Sly13Landing() {
  // Resilience: supabaseAdmin THROWS synchronously when Supabase is
  // unreachable/misconfigured (lib/supabase-server.ts proxy), which would take
  // the whole landing down with it. Landing must survive a DB hiccup — fall
  // back to the sly13 palette from docs/crewDocs/sly13-franchize-hydration.sql
  // ("SLY13 — Cyan on Graphite", dark), identical to what hydration would set.
  let p;
  try {
    p = (await getCrewPaletteBySlug("sly13")).palette;
  } catch {
    p = {
      bgBase: "#0F1419",
      bgCard: "#1A1F26",
      accentMain: "#06B6D4",
      accentMainHover: "#22D3EE",
      textPrimary: "#E5E7EB",
      textSecondary: "#9CA3AF",
      borderSoft: "#2A2F36",
    };
  }
  const textOnAccent = p.bgBase; // тёмный текст на циановом акценте (sly13-палитра)

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ background: p.bgBase, color: p.textPrimary }}>
      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative flex min-h-[88vh] items-center justify-center px-6 py-20 text-center">
        <div className="absolute inset-0">
          <Image
            src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/46f34997-2589-4ae7-9082-a374f19419a6-c899f118-1692-45b9-b6ef-d1066a607426.jpg"
            alt="vip-bike season hero"
            fill
            className="object-cover opacity-40"
            priority
          />
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(to bottom, ${p.bgBase}cc, ${p.bgBase}99, ${p.bgBase})` }}
          />
        </div>
        <div className="relative z-10 max-w-4xl">
          <p
            className="mx-auto mb-5 w-fit rounded-full px-4 py-1.5 text-xs uppercase tracking-[0.2em]"
            style={{ border: `1px solid ${p.borderSoft}`, background: p.bgCard, color: p.textSecondary }}
          >
            личная витрина salavey13 · франшизы проката
          </p>
          <h1 className="text-4xl font-bold md:text-6xl" style={{ color: p.accentMain }}>
            SLY13
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg md:text-xl" style={{ color: p.textPrimary }}>
            Платформа франшиз проката, выросшая из боевого экипажа{" "}
            <Link href="/franchize/vip-bike" className="underline decoration-dotted underline-offset-4" style={{ color: p.accentMain }}>
              VIP BIKE
            </Link>{" "}
            — не демо в вакууме, а софт, который каждый день работает на живом прокате электробайков в Нижнем Новгороде.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            {/* каталог — дефолтная вкладка витрины экипажа, отдельного /catalog-роута нет */}
            <Link href="/franchize/sly13">
              <Button style={{ background: p.accentMain, color: textOnAccent }}>Каталог услуг и запусков</Button>
            </Link>
            <a href="https://t.me/SALAVEY13" target="_blank" rel="noopener noreferrer">
              <Button variant="secondary">
                <FaTelegramPlane className="mr-2 inline" /> Написать в Telegram
              </Button>
            </a>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl space-y-20 px-6 pb-24">
        {/* ── 1. БОЕВОЙ КЛИЕНТ: сезон в цифрах ─────────────────────────────── */}
        <section id="proof">
          <h2 className="text-2xl font-bold md:text-3xl">
            Первый клиент — <span style={{ color: p.accentMain }}>боевой</span>, не синтетика
          </h2>
          <p className="mt-4 max-w-3xl text-base md:text-lg" style={{ color: p.textSecondary }}>
            VIP BIKE — тестовый экипаж в самом честном смысле: сначала платформа в бою, потом продукт.
            Весь сезон 2026 идёт через неё: заказы из Telegram Mini App, договоры DOCX с OCR паспорта и ВУ,
            депозиты, касса, смены и зарплаты операторов. Ни одна цифра ниже не нарисована — всё считается
            из Supabase на странице «Сезон-2026» экипажа.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SEASON_STATS.map(({ icon: Icon, value, label, sub }) => (
              <Card key={label} style={{ background: p.bgCard, borderColor: p.borderSoft }}>
                <CardContent className="pt-6">
                  <Icon className="mb-3 text-xl" style={{ color: p.accentMain }} />
                  <div className="text-2xl font-bold" style={{ color: p.textPrimary }}>{value}</div>
                  <div className="mt-1 text-sm font-medium" style={{ color: p.accentMain }}>{label}</div>
                  <p className="mt-2 text-xs" style={{ color: p.textSecondary }}>{sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* мини-таймлайн по месяцам — CSS-бары, без картинок */}
          <Card className="mt-6" style={{ background: p.bgCard, borderColor: p.borderSoft }}>
            <CardHeader>
              <CardTitle className="text-base">Сезон по месяцам — аренды</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-3" style={{ height: 120 }}>
                {SEASON_MONTHS.map(({ m, n }) => (
                  <div key={m} className="flex flex-1 flex-col items-center justify-end gap-2">
                    <span className="text-xs font-semibold" style={{ color: p.textPrimary }}>{n}</span>
                    <div
                      className="w-full rounded-t-md"
                      style={{
                        height: `${Math.max(6, Math.round((n / SEASON_MAX) * 100))}%`,
                        background: p.accentMain,
                        opacity: 0.85,
                      }}
                    />
                    <span className="text-xs" style={{ color: p.textSecondary }}>{m}</span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs" style={{ color: p.textSecondary }}>
                Рост 10 аренд в мае до 109 в сентябре. Архив из 145 бумажных договоров оцифрован и сведён с базой —
                ретро-импорт вернул в книги ≈188 000 ₽ и закрыл «слепое пятно» весны.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* ── 2. СВЕРКА: считаем каждую копейку ───────────────────────────── */}
        <section id="audit">
          <h2 className="text-2xl font-bold md:text-3xl">
            Считаем каждую копейку — <span style={{ color: p.accentMain }}>прямо сейчас</span>
          </h2>
          <p className="mt-4 max-w-3xl text-base md:text-lg" style={{ color: p.textSecondary }}>
            Все данные сезона сохранены, и текущая задача — финальная сверка: считаем комиссии операторов
            по типам операций (аренда почасовая/посуточная, продажи, оборудование), депозиты и возвраты.
            Жёлтый октябрь-разбор показал, зачем это нужно: автоматический аудит нашёл расхождения
            «бумажный договор против книг» — и вернул потерянные деньги в учёт.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              { n: "154", t: "аренды октября разобраны автоматическим аудитом" },
              { n: "32", t: "находки «sus»: бумага против книг — от депозита до итога" },
              { n: "18", t: "утерянных депозитов из старых договоров восстановлено в книгах" },
            ].map(({ n, t }) => (
              <Card key={n} style={{ background: p.bgCard, borderColor: p.borderSoft }}>
                <CardContent className="pt-6">
                  <div className="text-3xl font-bold" style={{ color: p.accentMain }}>{n}</div>
                  <p className="mt-2 text-sm" style={{ color: p.textSecondary }}>{t}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="mt-6 max-w-3xl text-sm" style={{ color: p.textSecondary }}>
            Под капотом: комиссия по правилам экипажа (процент или фикс, по типу операции), планы зарплат
            и кассовая книга с проводками, сверка расчёта с оператором в один тап и payout-хаб.
            То, что для обычного проката — «тетрадка и калькулятор», здесь — код.
          </p>
        </section>

        {/* ── 3. ЭКОНОМИКА ФРАНШИЗЫ ───────────────────────────────────────── */}
        <section id="vision">
          <h2 className="text-2xl font-bold md:text-3xl">
            Экономика простая: <span style={{ color: p.accentMain }}>сначала заработать — потом продавать</span>
          </h2>
          <p className="mt-4 max-w-3xl text-base md:text-lg" style={{ color: p.textSecondary }}>
            Если комиссии и деньги экипажа сходятся на платформе — это лучшее доказательство для продажи
            установок другим прокатам. Пайплайн уже собран: несколько экипажей подготовлены заранее,
            у каждого свой slug, каталог, брендинг и Telegram-бот.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <Card style={{ background: p.bgCard, borderColor: p.borderSoft }}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FaNetworkWired className="inline" style={{ color: p.accentMain }} /> Экипажи на подходе
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {PIPELINE_CREWS.map((c) => (
                  <div key={c.slug} className="flex items-start gap-2">
                    <FaCheck className="mt-1 shrink-0 text-xs" style={{ color: p.accentMain }} />
                    <div>
                      <Link
                        href={`/franchize/${c.slug}`}
                        className="text-sm font-semibold underline decoration-dotted underline-offset-4"
                        style={{ color: p.textPrimary }}
                      >
                        {c.label}
                      </Link>
                      <span className="ml-2 text-xs" style={{ color: p.textSecondary }}>{c.note}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card style={{ background: p.bgCard, borderColor: p.borderSoft }}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FaRocket className="inline" style={{ color: p.accentMain }} /> Как продаётся установка
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm" style={{ color: p.textSecondary }}>
                  <li>
                    <span style={{ color: p.textPrimary }}>White-label за 1–2 недели</span> — бренд клиента,
                    свой каталог, витрина в Telegram Mini App (бот уже в проде).
                  </li>
                  <li>
                    <span style={{ color: p.textPrimary }}>Вертикаль из коробки</span>: договоры DOCX, OCR
                    паспорта/ВУ, QR-claim, касса, депозиты — то, что generic-CRM строят месяцами.
                  </li>
                  <li>
                    <span style={{ color: p.textPrimary }}>Модель монетизации</span>: запуск под ключ +
                    подписка на сопровождение, платежи в Telegram (XTR), каркас Pro-пакетов
                    single-city / multi-city / enterprise уже спроектирован.
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* ── 4. УСЛУГИ ───────────────────────────────────────────────────── */}
        <section id="services">
          <h2 className="text-2xl font-bold md:text-3xl">Услуги и запуск экипажей</h2>
          <p className="mt-4 max-w-3xl text-base md:text-lg" style={{ color: p.textSecondary }}>
            Продуктизированный список: от разовой сессии до полного запуска витрины под ключ.
            Актуальные цены и оформление заказа — в каталоге.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((s) => (
              <Card key={s.title} style={{ background: p.bgCard, borderColor: p.borderSoft }}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">{s.title}</CardTitle>
                    <span
                      className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                      style={{ background: p.accentMain, color: textOnAccent }}
                    >
                      {s.price}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm" style={{ color: p.textSecondary }}>{s.text}</p>
                  <p className="mt-3 text-[11px] uppercase tracking-wider" style={{ color: p.accentMain }}>
                    {s.tag}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link href="/franchize/sly13">
              <Button style={{ background: p.accentMain, color: textOnAccent }}>
                <FaSearchDollar className="mr-2 inline" /> Открыть каталог
              </Button>
            </Link>
          </div>
        </section>

        {/* ── ФИНАЛЬНЫЙ CTA ───────────────────────────────────────────────── */}
        <section
          className="rounded-2xl px-6 py-12 text-center"
          style={{ background: p.bgCard, border: `1px solid ${p.borderSoft}` }}
        >
          <h2 className="text-xl font-bold md:text-2xl">Есть прокат — нужна такая же витрина?</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm md:text-base" style={{ color: p.textSecondary }}>
            Напишите: покажу живой экипаж изнутри, посчитаем запуск под ваш каталог и город.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <a href="https://t.me/SALAVEY13" target="_blank" rel="noopener noreferrer">
              <Button style={{ background: p.accentMain, color: textOnAccent }}>
                <FaTelegramPlane className="mr-2 inline" /> @SALAVEY13
              </Button>
            </a>
            <Link href="/franchize/sly13/contacts">
              <Button variant="secondary">Контакты</Button>
            </Link>
          </div>
          <p className="mt-8 text-[11px]" style={{ color: p.textSecondary }}>
            Цифры сезона — из базы экипажа vip-bike (Supabase), срез октябрь 2026 · платформа: Next.js + Supabase + Telegram Mini App
          </p>
        </section>
      </main>
    </div>
  );
}
