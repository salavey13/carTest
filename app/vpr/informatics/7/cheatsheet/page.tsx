"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { Copy, CheckCircle2 } from "lucide-react";

import { SimpleChart } from "@/components/vpr/SimpleChart";
import { TableDisplay } from "@/components/vpr/TableDisplay";

const formulasMd = `
## ⚡ Быстрые формулы

- **1 байт = 8 бит**
- **1 Кбайт = 1024 байт** (в школьных задачах)
- Чтобы закодировать \(N\) символов, нужно найти минимальное \(n\), где **2^n ≥ N**.
- Пример: 8 символов → **3 бита**.
`;

const rulesMd = `
## ✅ Правила, которые дают баллы

1. В алгоритмах всегда проверяй **порядок шагов**.
2. В логике: ` + "`if`" + ` — это проверка условия, ` + "`else`" + ` — иначе.
3. В коде ` + "`=`" + ` и ` + "`==`" + ` — **не одно и то же**.
4. Пароли: длинный + цифры + спецсимволы.
`;

const mistakesMd = `
## ❌ Частые ошибки

- Путают **бит** и **байт**.
- Путают **IP-адрес** и доменное имя.
- Считают, что фишинговое письмо — "просто реклама".
- Пишут алгоритм без ветвления там, где есть условие.
`;

const hackMd = `
## 💡 Лайфхаки перед тестом

- Решай сначала простые задания, сложные оставь на второй круг.
- На каждом шаге спрашивай себя: "Что здесь проверяют — формулу, логику или внимательность?"
- Если сомневаешься, исключи 2 заведомо неверных варианта.
`;

const speedChart = {
  type: "chart" as const,
  chartType: "bar" as const,
  title: "Как распределить 40 минут теста",
  labels: ["Лёгкие", "Средние", "Сложные", "Проверка"],
  data: [12, 14, 10, 4],
  colors: ["#22d3ee", "#38bdf8", "#818cf8", "#34d399"],
};

const compareTable = {
  type: "table" as const,
  title: "Что не перепутать",
  headers: ["Тема", "Правильно", "Ошибочно"],
  rows: [
    ["Бит/байт", "1 байт = 8 бит", "1 бит = 8 байт"],
    ["Сравнение", "!= — не равно", "= — не равно"],
    ["Кибербезопасность", "2FA + уникальные пароли", "Один пароль везде"],
  ],
};

const copyItems = [
  "1 байт = 8 бит",
  "1 Кбайт = 1024 байт",
  "2^n ≥ N — формула для кодирования",
  "Никому не сообщай пароль и коды 2FA",
];

export default function VprInformatics7CheatsheetPage() {
  const [copied, setCopied] = useState<string | null>(null);

  const cards = useMemo(() => [formulasMd, rulesMd, mistakesMd, hackMd], []);

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 1200);
  };

  return (
    <main className="min-h-screen bg-page-gradient text-light-text px-4 py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="rounded-2xl border border-brand-cyan/30 bg-dark-card/80 p-6">
          <h1 className="text-2xl md:text-3xl font-bold text-brand-cyan">Информатика 7 класс — шпаргалка перед ВПР</h1>
          <p className="text-sm md:text-base text-gray-300 mt-2">Коротко, ясно, по делу. Пробежал за 7 минут — и в бой 🚀</p>
        </header>

        <section className="grid md:grid-cols-2 gap-4">
          {cards.map((md, idx) => (
            <article key={idx} className="rounded-xl border border-white/10 bg-dark-card p-5 prose prose-invert prose-sm max-w-none">
              <ReactMarkdown>{md}</ReactMarkdown>
            </article>
          ))}
        </section>

        <section className="grid md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-white/10 bg-dark-card p-4">
            <SimpleChart chartData={speedChart} />
          </div>
          <div className="rounded-xl border border-white/10 bg-dark-card p-4">
            <TableDisplay tableData={compareTable} />
          </div>
        </section>

        <section className="rounded-xl border border-brand-cyan/30 bg-dark-card p-5">
          <h2 className="text-xl font-semibold text-brand-cyan mb-4">📌 Копировать формулы и правила</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {copyItems.map((item) => (
              <button
                key={item}
                onClick={() => handleCopy(item)}
                className="w-full bg-brand-cyan text-white py-3 rounded-lg font-semibold hover:bg-brand-cyan/80 transition flex items-center justify-center gap-2"
              >
                {copied === item ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied === item ? "Скопировано" : "Копировать формулу"}
              </button>
            ))}
          </div>
        </section>

        <div className="text-center pt-2">
          <Link href="/vpr-tests" className="inline-block bg-brand-blue text-white py-3 px-6 rounded-lg font-semibold hover:bg-brand-blue/80 transition">
            Вернуться к тестам
          </Link>
        </div>
      </div>
    </main>
  );
}
