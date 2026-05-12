import Link from "next/link";

const terms = [
  {
    name: "Тема",
    value: "О чём произведение в широком смысле (дружба, долг, свобода, совесть).",
  },
  {
    name: "Идея",
    value: "Главная мысль автора: что он хочет донести читателю.",
  },
  {
    name: "Сюжет",
    value: "Цепочка событий: что произошло сначала, потом и чем всё закончилось.",
  },
  {
    name: "Герой",
    value: "Персонаж, через поступки и слова которого раскрывается тема.",
  },
  {
    name: "Автор",
    value: "Тот, кто создал произведение и выражает позицию через текст.",
  },
];

const devices = [
  ["Эпитет", "Образное определение: «суровый взгляд», «гордое терпенье»."],
  ["Метафора", "Скрытое сравнение: «оковы падут», «свободный глас»."],
  ["Сравнение", "Сопоставление через «как, будто, словно»: «смелый как лев»."],
  ["Олицетворение", "Неживому даются свойства живого: «ветер шепчет»."],
  ["Анафора", "Повтор слов в начале строк для усиления мысли."],
];

const answerSteps = [
  "Назови тему одним предложением.",
  "Приведи 1–2 эпизода или поступка героя.",
  "Объясни, как эти эпизоды раскрывают идею.",
  "Сделай короткий вывод: «Таким образом, автор показывает…».",
];

export default function Literature7CheatsheetPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-10 md:px-6">
        <h1 className="text-3xl font-bold md:text-4xl">Шпаргалка для ВПР по литературе, 7 класс</h1>
        <p className="mt-3 max-w-3xl text-slate-300">
          Быстрый конспект без «каши в голове»: термины, шаблоны ответов, разбор стихотворения и мини-карточки
          произведений, которые часто встречаются в школьной программе.
        </p>

        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 className="text-2xl font-semibold">1) Основные понятия</h2>
          <ul className="mt-4 space-y-3">
            {terms.map((term) => (
              <li key={term.name} className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                <p className="font-semibold text-cyan-300">{term.name}</p>
                <p className="text-slate-300">{term.value}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 className="text-2xl font-semibold">2) Средства выразительности</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {devices.map(([name, desc]) => (
              <article key={name} className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                <h3 className="font-semibold text-violet-300">{name}</h3>
                <p className="text-slate-300">{desc}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 className="text-2xl font-semibold">3) Алгоритм развёрнутого ответа</h2>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-slate-300">
            {answerSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <p className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-200">
            Шаблон: «Я считаю, что в произведении раскрывается тема … Это видно в эпизоде … Автор показывает …
            Таким образом, главная мысль текста …».
          </p>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 className="text-2xl font-semibold">4) Практика: «Во глубине сибирских руд»</h2>
          <p className="mt-3 text-slate-300">
            Кому адресовано: декабристам. Тема: свобода, верность идеалам, надежда. Идея: даже в тяжёлых условиях
            человек может сохранить внутреннюю силу.
          </p>
          <p className="mt-3 text-slate-300">
            Что сказать на ВПР: «Образы цепей, темницы и свободы создают контраст. Автор поддерживает адресатов и
            убеждает, что борьба за правду не напрасна».
          </p>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 className="text-2xl font-semibold">5) Частые произведения 7 класса (кратко)</h2>
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {[
              "Н.В. Гоголь «Тарас Бульба» — долг, честь, выбор между личным и общим.",
              "И.С. Тургенев «Бирюк» — человечность и справедливость в трудных условиях.",
              "А.П. Платонов «Юшка» — доброта, сострадание, непонимание общества.",
              "В.Г. Распутин «Уроки французского» — милосердие, взросление, нравственный выбор.",
            ].map((item) => (
              <li key={item} className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-slate-300">
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 className="text-2xl font-semibold">6) Полезная ссылка для тренировки</h2>
          <p className="mt-3 text-slate-300">Перед ВПР потренируйся на вступительном тесте:</p>
          <Link
            href="https://rus-vpr.sdamgia.ru/"
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 font-medium text-cyan-200 hover:bg-cyan-500/20"
          >
            Открыть «Решу ВПР»
          </Link>
        </section>
      </div>
    </main>
  );
}
