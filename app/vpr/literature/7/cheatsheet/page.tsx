"use client";

import Link from "next/link";
import { useState, useCallback, useEffect } from "react";

/* ─── Data ────────────────────────────────────────────────────── */

const navItems = [
  { id: "concepts", label: "Понятия" },
  { id: "genres", label: "Жанры" },
  { id: "verse-prose", label: "Стих / Проза" },
  { id: "poetry", label: "Поэзия" },
  { id: "devices", label: "Приёмы" },
  { id: "algorithm", label: "Алгоритм" },
  { id: "essay", label: "Сочинение" },
  { id: "practice", label: "Практика" },
  { id: "works", label: "Произведения" },
  { id: "practice-link", label: "Тренировка" },
];

const terms = [
  {
    name: "Тема",
    value:
      "О чём произведение в широком смысле (дружба, долг, свобода, совесть). Спроси себя: «О чём здесь речь?» — ответ и есть тема.",
  },
  {
    name: "Идея",
    value:
      "Главная мысль автора: что он хочет донести читателю. Идея — это вывод, к которому автор подводит. Тема — «о чём», идея — «что хочет сказать».",
  },
  {
    name: "Сюжет",
    value:
      "Цепочка событий: что произошло сначала, потом и чем всё закончилось. Сюжет — это «дорожка» от завязки до развязки.",
  },
  {
    name: "Герой",
    value:
      "Персонаж, через поступки и слова которого раскрывается тема. Герой — не всегда «хороший», это просто действующее лицо.",
  },
  {
    name: "Автор",
    value:
      "Тот, кто создал произведение и выражает позицию через текст. Автор может говорить устами героя, но позиция автора ≠ мнение героя.",
  },
  {
    name: "Жанр",
    value:
      "Вид произведения: рассказ, повесть, сказка, басня, стихотворение, роман. Жанр подсказывает, чего ждать от текста.",
  },
];

const genreCards = [
  {
    name: "Рассказ",
    emoji: "📖",
    desc: "Небольшое произведение об одном событии из жизни героя. Короткий сюжет, мало героев.",
  },
  {
    name: "Повесть",
    emoji: "📚",
    desc: "Длиннее рассказа, короче романа. Несколько событий, жизнь героя показана глубже.",
  },
  {
    name: "Сказка",
    emoji: "✨",
    desc: "Вымысел, волшебство, чёткое деление на добро и зло. Часто — поучительный финал.",
  },
  {
    name: "Басня",
    emoji: "🦊",
    desc: "Короткий рассказ в стихах или прозе с моралью. Герои — часто животные.",
  },
];

const poetryKinds = [
  {
    name: "Лирика",
    value:
      "Передаёт чувства и переживания автора. Лирический герой — «я» стихотворения — не всегда сам поэт.",
  },
  {
    name: "Эпос",
    value:
      "Рассказывает историю, описывает события и героев. Примеры: рассказ, повесть, роман.",
  },
  {
    name: "Драма",
    value:
      "Произведение для театра: диалоги, ремарки, действие на сцене. Примеры: пьеса, трагедия, комедия.",
  },
];

const verseTerms = [
  {
    name: "Строфа",
    value: "Группа строк, объединённых ритмом и рифмой. Как абзац в прозе, только в стихах.",
  },
  {
    name: "Рифма",
    value: "Созвучие концов строк: «труд — идут», «падут — рухнут».",
  },
  {
    name: "Ритм",
    value: "Чередование ударных и безударных слогов — «пульс» стихотворения.",
  },
];

const verseSizes = [
  {
    name: "Хорей",
    value: "Ударение на нечётные слоги: ТА-та-ТА-та-ТА-та-ТА. Пример: «Буря мглою небо кроет».",
  },
  {
    name: "Ямб",
    value: "Ударение на чётные слоги: та-ТА-та-ТА-та-ТА-та-ТА. Пример: «Мой дядя самых честных правил».",
  },
];

const devices = [
  [
    "Эпитет",
    "Образное определение: «суровый взгляд», «гордое терпенье». Это прилагательное, которое рисует картину, а не просто описывает.",
  ],
  [
    "Метафора",
    "Скрытое сравнение: «оковы падут», «свободный глас». Одно выражено через другое без «как».",
  ],
  [
    "Сравнение",
    "Сопоставление через «как, будто, словно, что»: «смелый как лев», «как птица в клетке».",
  ],
  [
    "Олицетворение",
    "Неживому даются свойства живого: «ветер шепчет», «зима пришла», «гроза прошла мимо».",
  ],
  [
    "Анафора",
    "Повтор слов в начале строк для усиления мысли: «Жди меня, и я вернусь. / Жди, когда наводят грусть…».",
  ],
  [
    "Гипербола",
    "Преувеличение: «море слёз», «я говорил это тысячу раз».",
  ],
];

const answerSteps = [
  { text: "Назови тему одним предложением: «В произведении раскрывается тема…».", icon: "1" },
  { text: "Приведи 1–2 эпизода или поступка героя, которые это подтверждают.", icon: "2" },
  { text: "Объясни, как эти эпизоды раскрывают идею: что автор хочет показать.", icon: "3" },
  { text: "Сделай короткий вывод: «Таким образом, автор показывает…».", icon: "4" },
];

const essayTemplate = [
  {
    step: "Вступление",
    num: "01",
    text: "Я считаю, что в произведении «…» раскрывается тема … . Эта тема важна, потому что … .",
  },
  {
    step: "Аргумент",
    num: "02",
    text: "Это видно в эпизоде, когда … . Герой поступает так, потому что … . Автор использует … (средство выразительности), чтобы подчеркнуть … .",
  },
  {
    step: "Вывод",
    num: "03",
    text: "Таким образом, главная мысль текста — … . Автор показывает, что … .",
  },
];

const works = [
  {
    title: "Н.В. Гоголь «Тарас Бульба»",
    desc: "Долг, честь, отечество. Тарас жертвует сыном ради верности товарищам; Остап умирает героем, Андрий предаёт семью. Честь — высшая ценность, а предательство ведёт к трагедии.",
    tag: "долг и честь",
  },
  {
    title: "И.С. Тургенев «Бирюк»",
    desc: "Человечность и справедливость в трудных условиях. Лесник Бирюк, суровый и одинокий, отпускает бедного крестьянина, пойманного на рубке леса. Жестокость законов vs милосердие человека.",
    tag: "милосердие",
  },
  {
    title: "А.П. Платонов «Юшка»",
    desc: "Доброта, сострадание, непонимание общества. Старик Юшка живёт для других, но окружающие жестоки к нему. После его смерти люди осознают, кого потеряли.",
    tag: "доброта",
  },
  {
    title: "В.Г. Распутин «Уроки французского»",
    desc: "Милосердие, взросление, нравственный выбор. Учительница Лидия Михайловна помогает мальчику, нарушая правила. Доброта важнее формальных приличий.",
    tag: "нравственный выбор",
  },
  {
    title: "М. Горький «Детство»",
    desc: "Взросление, влияние среды, поиск добра. Алёша Пешков растёт в жестокой семье деда, но сохраняет душу благодаря бабушке и добрым людям вокруг.",
    tag: "взросление",
  },
  {
    title: "М.М. Пришвин «Кладовая солнца»",
    desc: "Дружба, взаимовыручка, природа. Настя и Митраша идут в лес за клюквой, ссорятся, но преодолевают опасности и возвращаются вместе.",
    tag: "дружба",
  },
  {
    title: "В.К. Железников «Чучело»",
    desc: "Школьный буллинг, смелость, самопожертвование. Лена Бессольцева берёт чужую вину на себя, а класс жестоко с ней обходится. Её поступок показывает, кто настоящий человек.",
    tag: "смелость",
  },
];

const pushkinAnalysis = {
  addressed: "Декабристам — участникам восстания 1825 года, сосланным в Сибирь.",
  theme: "Свобода, верность идеалам, надежда на освобождение.",
  idea: "Даже в самых тяжёлых условиях человек может сохранить внутреннюю силу и веру в правду.",
  images: [
    { term: "«оковы падут»", meaning: "Метафора: цепи рабства рухнут — наступит свобода." },
    { term: "«тюрьмы рухнут»", meaning: "Метафора: стены темницы падут — узники освободятся." },
    { term: "«свободный глас»", meaning: "Метафора: голос свободного человека, который не молчит." },
    { term: "«гордое терпенье»", meaning: "Эпитет: не просто терпение, а достойное, гордое — подчёркивает силу духа." },
    { term: "«грубые цепи»", meaning: "Эпитет: цепи тяжёлые, жестокие — усиливают контраст с надеждой." },
  ],
  vprAnswer:
    "Образы цепей, темницы и свободы создают контраст. Автор поддерживает адресатов и убеждает, что борьба за правду не напрасна. Средства выразительности (метафоры «оковы падут», эпитет «гордое терпенье») усиливают веру в освобождение.",
};

/* ─── Easter egg: incorrect definition of "проза" ─── */

const prozaReactions = [
  "Проза — это когда текст написан без рифмы и ритма. Простой язык, обычные предложения. Рассказы, повести, романы — всё это проза.",
  "Проза — это… ну… типа… когда не стих? А что именно — никто толком не знает 🤷",
  "Проза — это загадочная субстанция. Экзамен мы сдали, а что это такое — до сих пор mystery.",
  "Проза — это текст, который вообще без ритма. Или с ритмом? Короче, мы прошли мимо этого термина и так и не вернулись.",
  "Проза — это… стой, не подсказывай… забыл. Ладно, забей, на ВПР не спросят… наверное.",
];

/* ─── Component ──────────────────────────────────────────────── */

export default function Literature7CheatsheetPage() {
  const [prozaClickCount, setProzaClickCount] = useState(0);
  const [prozaShake, setProzaShake] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  /* scroll-to-top visibility */
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* track active section for nav highlight */
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: "-20% 0px -60% 0px" }
    );

    for (const item of navItems) {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  const handleProzaClick = useCallback(() => {
    setProzaClickCount((prev) => prev + 1);
    setProzaShake(true);
    setTimeout(() => setProzaShake(false), 400);
  }, []);

  const prozaText =
    prozaClickCount === 0
      ? prozaReactions[0]
      : prozaReactions[Math.min(prozaClickCount, prozaReactions.length - 1)];

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 scroll-smooth">
      <div className="mx-auto max-w-5xl px-4 py-10 md:px-6">
        {/* ── Header ── */}
        <header className="relative">
          <div className="absolute -top-10 -left-4 h-40 w-40 rounded-full bg-cyan-500/5 blur-3xl" />
          <div className="absolute -top-6 right-0 h-32 w-32 rounded-full bg-violet-500/5 blur-3xl" />
          <h1 className="relative text-3xl font-bold md:text-4xl bg-gradient-to-r from-cyan-200 via-slate-100 to-violet-200 bg-clip-text text-transparent">
            Шпаргалка для ВПР по литературе, 7 класс
          </h1>
          <p className="relative mt-3 max-w-3xl text-slate-400 leading-relaxed">
            Быстрый конспект без «каши в голове»: термины, шаблоны ответов,
            разбор стихотворения и мини-карточки произведений, которые часто
            встречаются в школьной программе.
          </p>
        </header>

        {/* ── Quick Nav ── */}
        <nav className="mt-6 flex flex-wrap gap-2" aria-label="Быстрый переход">
          {navItems.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-all duration-200 ${
                activeSection === item.id
                  ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-200"
                  : "border-slate-700 bg-slate-900/60 text-slate-400 hover:border-slate-600 hover:text-slate-200"
              }`}
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* ── 1. Основные понятия ── */}
        <section id="concepts" className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 md:p-6">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-sm font-bold text-cyan-300">
              1
            </span>
            Основные понятия
          </h2>
          <ul className="mt-4 space-y-3">
            {terms.map((term) => (
              <li
                key={term.name}
                className="group rounded-xl border border-slate-800 bg-slate-900 p-4 transition-all duration-200 hover:border-cyan-500/30 hover:bg-slate-800/80"
              >
                <p className="font-semibold text-cyan-300 group-hover:text-cyan-200 transition-colors">
                  {term.name}
                </p>
                <p className="mt-1 text-slate-300 text-sm leading-relaxed">{term.value}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* ── 2. Жанры ── */}
        <section id="genres" className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 md:p-6">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-sm font-bold text-amber-300">
              2
            </span>
            Жанры
          </h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {genreCards.map((g) => (
              <article
                key={g.name}
                className="group rounded-xl border border-slate-800 bg-slate-900 p-4 transition-all duration-200 hover:border-amber-500/30 hover:bg-slate-800/80"
              >
                <h3 className="font-semibold text-amber-300 flex items-center gap-2 group-hover:text-amber-200 transition-colors">
                  <span className="text-lg">{g.emoji}</span>
                  {g.name}
                </h3>
                <p className="mt-1 text-slate-300 text-sm leading-relaxed">{g.desc}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ── 3. Стих и проза (with easter egg) ── */}
        <section id="verse-prose" className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 md:p-6">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-sm font-bold text-emerald-300">
              3
            </span>
            Стих и проза
          </h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <article className="group rounded-xl border border-slate-800 bg-slate-900 p-4 transition-all duration-200 hover:border-emerald-500/30 hover:bg-slate-800/80">
              <h3 className="font-semibold text-emerald-300 group-hover:text-emerald-200 transition-colors">
                Стих (стихотворение)
              </h3>
              <p className="mt-1 text-slate-300 text-sm leading-relaxed">
                Текст, записанный строками. Часто есть рифма и ритм. Автор — поэт,
                рассказчик в стихах — лирический герой.
              </p>
            </article>
            <article
              className={`group rounded-xl border bg-slate-900 p-4 cursor-pointer select-none transition-all duration-200 hover:border-rose-500/40 hover:bg-slate-800/80 ${
                prozaShake ? "animate-shake border-rose-500/60" : "border-slate-800"
              }`}
              onClick={handleProzaClick}
              title="Нажми на меня…"
            >
              <h3 className="font-semibold text-rose-300 flex items-center gap-2 group-hover:text-rose-200 transition-colors">
                Проза
                <span className="text-[10px] text-slate-500 font-normal animate-pulse">
                  (нажми)
                </span>
                {prozaClickCount > 0 && (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500/20 px-1.5 text-[10px] font-bold text-rose-300">
                    {prozaClickCount}
                  </span>
                )}
              </h3>
              <p
                className={`mt-1 text-sm leading-relaxed transition-all duration-300 ${
                  prozaClickCount > 0 ? "text-rose-200/90" : "text-slate-300"
                }`}
              >
                {prozaText}
              </p>
              {prozaClickCount >= 4 && (
                <p className="mt-2 text-xs text-slate-500 italic">
                  {"\\_(ツ)_/"} ну, экзамен-то сдан…
                </p>
              )}
            </article>
          </div>
        </section>

        {/* ── 4. Поэзия: виды, строфа, рифма, ритм ── */}
        <section id="poetry" className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 md:p-6">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sm font-bold text-sky-300">
              4
            </span>
            Поэзия: ключевые термины
          </h2>

          <h3 className="mt-4 text-sm font-medium uppercase tracking-wider text-slate-500">
            Роды литературы
          </h3>
          <div className="mt-2 grid gap-3 md:grid-cols-3">
            {poetryKinds.map((kind) => (
              <article
                key={kind.name}
                className="group rounded-xl border border-slate-800 bg-slate-900 p-4 transition-all duration-200 hover:border-sky-500/30 hover:bg-slate-800/80"
              >
                <h3 className="font-semibold text-sky-300 group-hover:text-sky-200 transition-colors">
                  {kind.name}
                </h3>
                <p className="mt-1 text-slate-300 text-sm leading-relaxed">{kind.value}</p>
              </article>
            ))}
          </div>

          <h3 className="mt-5 text-sm font-medium uppercase tracking-wider text-slate-500">
            Строфика и звучание
          </h3>
          <div className="mt-2 grid gap-3 md:grid-cols-3">
            {verseTerms.map((v) => (
              <article
                key={v.name}
                className="group rounded-xl border border-slate-800 bg-slate-900 p-4 transition-all duration-200 hover:border-teal-500/30 hover:bg-slate-800/80"
              >
                <h3 className="font-semibold text-teal-300 group-hover:text-teal-200 transition-colors">
                  {v.name}
                </h3>
                <p className="mt-1 text-slate-300 text-sm leading-relaxed">{v.value}</p>
              </article>
            ))}
          </div>

          <h3 className="mt-5 text-sm font-medium uppercase tracking-wider text-slate-500">
            Стихотворные размеры
          </h3>
          <div className="mt-2 grid gap-3 md:grid-cols-2">
            {verseSizes.map((s) => (
              <article
                key={s.name}
                className="group rounded-xl border border-slate-800 bg-slate-900 p-4 transition-all duration-200 hover:border-orange-500/30 hover:bg-slate-800/80"
              >
                <h3 className="font-semibold text-orange-300 group-hover:text-orange-200 transition-colors">
                  {s.name}
                </h3>
                <p className="mt-1 text-slate-300 text-sm leading-relaxed">{s.value}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ── 5. Средства выразительности ── */}
        <section id="devices" className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 md:p-6">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-sm font-bold text-violet-300">
              5
            </span>
            Средства выразительности
          </h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {devices.map(([name, desc]) => (
              <article
                key={name}
                className="group rounded-xl border border-slate-800 bg-slate-900 p-4 transition-all duration-200 hover:border-violet-500/30 hover:bg-slate-800/80"
              >
                <h3 className="font-semibold text-violet-300 group-hover:text-violet-200 transition-colors">
                  {name}
                </h3>
                <p className="mt-1 text-slate-300 text-sm leading-relaxed">{desc}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ── 6. Алгоритм развёрнутого ответа ── */}
        <section id="algorithm" className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 md:p-6">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-sm font-bold text-emerald-300">
              6
            </span>
            Алгоритм развёрнутого ответа
          </h2>
          <ol className="mt-4 space-y-3">
            {answerSteps.map((step, i) => (
              <li
                key={step.text}
                className="group flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4 transition-all duration-200 hover:border-emerald-500/30 hover:bg-slate-800/80"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-xs font-bold text-emerald-300 mt-0.5">
                  {step.icon}
                </span>
                <span className="text-slate-300 text-sm leading-relaxed">{step.text}</span>
              </li>
            ))}
          </ol>
          <div className="mt-4 space-y-3">
            <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-200 text-sm leading-relaxed">
              <span className="font-semibold">Шаблон:</span> «Я считаю, что в произведении раскрывается тема … Это видно в
              эпизоде … Автор показывает … Таким образом, главная мысль текста …».
            </p>
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-amber-200 text-sm leading-relaxed">
              <span className="font-semibold">Слово по контексту:</span> найди незнакомое слово → прочитай
              предложение целиком → подставь синоним, который подходит по смыслу.
              Пример: «стремленье» → желание что-либо изменить.
            </p>
          </div>
        </section>

        {/* ── 7. Шаблон сочинения ── */}
        <section id="essay" className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 md:p-6">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-pink-500/10 text-sm font-bold text-pink-300">
              7
            </span>
            Шаблон сочинения
          </h2>
          <p className="mt-2 text-slate-400 text-sm">
            Используй эту структуру для задания «Напишите о любимом произведении»
            или любого развёрнутого ответа.
          </p>
          <div className="mt-4 space-y-3">
            {essayTemplate.map((t) => (
              <article
                key={t.step}
                className="group rounded-xl border border-slate-800 bg-slate-900 p-4 transition-all duration-200 hover:border-pink-500/30 hover:bg-slate-800/80"
              >
                <p className="font-semibold text-pink-300 flex items-center gap-2 group-hover:text-pink-200 transition-colors">
                  <span className="text-xs text-slate-600 font-mono">{t.num}</span>
                  {t.step}
                </p>
                <p className="mt-1 text-slate-300 italic text-sm leading-relaxed">{t.text}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ── 8. Практика: «Во глубине сибирских руд» ── */}
        <section id="practice" className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 md:p-6">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-sm font-bold text-cyan-300">
              8
            </span>
            Практика: «Во глубине сибирских руд»
          </h2>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="group rounded-xl border border-slate-800 bg-slate-900 p-4 transition-all duration-200 hover:border-cyan-500/30 hover:bg-slate-800/80">
              <p className="font-semibold text-cyan-300 text-sm">Кому адресовано</p>
              <p className="mt-1 text-slate-300 text-sm leading-relaxed">{pushkinAnalysis.addressed}</p>
            </div>
            <div className="group rounded-xl border border-slate-800 bg-slate-900 p-4 transition-all duration-200 hover:border-cyan-500/30 hover:bg-slate-800/80">
              <p className="font-semibold text-cyan-300 text-sm">Тема</p>
              <p className="mt-1 text-slate-300 text-sm leading-relaxed">{pushkinAnalysis.theme}</p>
            </div>
            <div className="group rounded-xl border border-slate-800 bg-slate-900 p-4 transition-all duration-200 hover:border-cyan-500/30 hover:bg-slate-800/80">
              <p className="font-semibold text-cyan-300 text-sm">Идея</p>
              <p className="mt-1 text-slate-300 text-sm leading-relaxed">{pushkinAnalysis.idea}</p>
            </div>
          </div>

          <h3 className="mt-5 font-semibold text-violet-300 text-sm flex items-center gap-2">
            Образы и средства выразительности
          </h3>
          <ul className="mt-3 space-y-2">
            {pushkinAnalysis.images.map((img) => (
              <li
                key={img.term}
                className="group rounded-xl border border-slate-800 bg-slate-900 p-3 transition-all duration-200 hover:border-violet-500/30 hover:bg-slate-800/80"
              >
                <span className="font-semibold text-amber-300 group-hover:text-amber-200 transition-colors text-sm">
                  {img.term}
                </span>
                <span className="text-slate-300 text-sm"> — {img.meaning}</span>
              </li>
            ))}
          </ul>

          <h3 className="mt-5 font-semibold text-emerald-300 text-sm flex items-center gap-2">
            Что сказать на ВПР
          </h3>
          <p className="mt-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-200 text-sm leading-relaxed">
            {pushkinAnalysis.vprAnswer}
          </p>
        </section>

        {/* ── 9. Частые произведения 7 класса ── */}
        <section id="works" className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 md:p-6">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-sm font-bold text-cyan-300">
              9
            </span>
            Частые произведения 7 класса
          </h2>
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {works.map((w) => (
              <li
                key={w.title}
                className="group rounded-xl border border-slate-800 bg-slate-900 p-4 transition-all duration-200 hover:border-cyan-500/30 hover:bg-slate-800/80"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-cyan-300 group-hover:text-cyan-200 transition-colors text-sm">
                    {w.title}
                  </p>
                  <span className="shrink-0 rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                    {w.tag}
                  </span>
                </div>
                <p className="mt-1 text-slate-300 text-sm leading-relaxed">{w.desc}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* ── 10. Полезная ссылка ── */}
        <section id="practice-link" className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 md:p-6">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-sm font-bold text-cyan-300">
              10
            </span>
            Тренировка перед ВПР
          </h2>
          <p className="mt-3 text-slate-400 text-sm leading-relaxed">
            Потренируйся на тестах, чтобы чувствовать себя увереннее:
          </p>
          <Link
            href="/vpr-tests"
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-5 py-2.5 font-medium text-cyan-200 transition-all duration-200 hover:border-cyan-500/60 hover:bg-cyan-500/20 hover:shadow-lg hover:shadow-cyan-500/10"
          >
            <span>Открыть тесты ВПР</span>
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </section>

        {/* ── Footer ── */}
        <footer className="mt-12 border-t border-slate-800/60 pt-6 pb-4 text-center text-sm text-slate-600">
          Удачи на ВПР! Ты справишься 💪
        </footer>
      </div>

      {/* ── Scroll-to-top button ── */}
      <button
        onClick={scrollToTop}
        aria-label="Наверх"
        className={`fixed bottom-6 right-6 flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-900/90 text-slate-400 shadow-lg backdrop-blur-sm transition-all duration-300 hover:bg-slate-800 hover:text-slate-200 ${
          showScrollTop
            ? "translate-y-0 opacity-100"
            : "translate-y-4 opacity-0 pointer-events-none"
        }`}
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
        </svg>
      </button>
    </main>
  );
}
