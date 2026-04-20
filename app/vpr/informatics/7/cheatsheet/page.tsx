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
    <div className="min-h-screen bg-[#020c02] text-white relative">
      <MatrixRainBg />
      <div className="relative z-10">
        <style>{`
          .glow-text { text-shadow: 0 0 10px rgba(0,255,65,0.5), 0 0 40px rgba(0,255,65,0.15); }
          .glow-text-sm { text-shadow: 0 0 6px rgba(0,255,65,0.3); }
          .hud-border { border: 1px solid rgba(0,255,65,0.15); }
          .hud-border::before, .hud-border::after { content:''; position:absolute; width:8px; height:8px; }
          ::-webkit-scrollbar { width: 6px; }
          ::-webkit-scrollbar-track { background: #020c02; }
          ::-webkit-scrollbar-thumb { background: #00ff4130; border-radius: 3px; }
          ::-webkit-scrollbar-thumb:hover { background: #00ff4150; }
        `}</style>

        <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12">
          {/* ══════ HEADER ══════ */}
          <motion.header
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="mb-16"
          >
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="w-64 h-48 md:w-80 md:h-56 flex-shrink-0">
                <MatrixRainSVG />
              </div>
              <div className="text-center md:text-left">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-green-900/30 border border-green-500/40 text-green-300 text-xs mb-4 uppercase tracking-[0.2em] font-bold">
                  <Terminal className="w-3.5 h-3.5" /> Protocol_Initiated // v7.0
                </div>
                <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-3 font-mono">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-300 via-emerald-200 to-[#00ff41] glow-text">
                    NET
                  </span>{" "}
                  <span className="text-white">ARCHITECT</span>
                </h1>
                <p className="text-green-400/70 text-lg">
                  7 класс // Информатика, Алгоритмы, Логика, Архитектура
                </p>
                <div className="mt-3 font-mono text-xs text-green-600/80">
                  {systemMsg}
                </div>
                {/* Score */}
                <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-green-900/20 border border-green-800/30">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span className="font-mono text-xs text-amber-400">XP: {score}</span>
                </div>
              </div>
            </div>
          </motion.header>

          {/* ══════ SECTION 1: СИСТЕМЫ СЧИСЛЕНИЯ ══════ */}
          <motion.section
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-50px" }}
            className="mb-20"
          >
            <SectionHeader icon={Binary} title="СИСТЕМЫ СЧИСЛЕНИЯ" subtitle="number_systems.scan()" />
            <div className="grid md:grid-cols-2 gap-6">
              <HUDPanel className="p-6" glow>
                <h3 className="font-mono text-sm text-green-300 mb-4 glow-text-sm">{'>'} binary_converter.exe</h3>
                <BinaryConverterSVG activeBits={activeBits} onBitToggle={toggleBit} />
              </HUDPanel>
              <div className="space-y-4">
                {[
                  { base: "10", name: "Десятичная", digits: "0–9", example: "42₁₀ = 4×10 + 2×1", color: "green" },
                  { base: "2", name: "Двоичная", digits: "0–1", example: "42₁₀ = 101010₂", color: "emerald" },
                  { base: "8", name: "Восьмеричная", digits: "0–7", example: "42₁₀ = 52₈", color: "cyan" },
                  { base: "16", name: "Шестнадцатеричная", digits: "0–9, A–F", example: "42₁₀ = 2A₁₆", color: "amber" },
                ].map((s, i) => (
                  <motion.div
                    key={s.base}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="bg-[#030f03] rounded-xl border border-green-800/30 p-4 hover:border-green-500/40 transition-all"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono font-bold text-sm text-white">Основание {s.base}</span>
                      <span className={cn(
                        "font-mono text-[10px] px-2 py-0.5 rounded-full",
                        s.color === "green" && "bg-green-900/30 text-green-400",
                        s.color === "emerald" && "bg-emerald-900/30 text-emerald-400",
                        s.color === "cyan" && "bg-cyan-900/30 text-cyan-400",
                        s.color === "amber" && "bg-amber-900/30 text-amber-400",
                      )}>
                        {s.name}
                      </span>
                    </div>
                    <p className="font-mono text-xs text-green-600 mb-1">Цифры: {s.digits}</p>
                    <p className="font-mono text-sm text-green-300">{s.example}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.section>

          {/* ══════ SECTION 2: ЛОГИЧЕСКИЕ ОПЕРАЦИИ ══════ */}
          <motion.section
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-50px" }}
            className="mb-20"
          >
            <SectionHeader icon={GitBranch} title="ЛОГИЧЕСКИЕ ОПЕРАЦИИ" subtitle="logic_gates.scan()" />
            <LogicGatesSVG />
            <div className="mt-6 grid sm:grid-cols-2 gap-4">
              <Expandable title="> Булева алгебра — основы">
                <p className="mb-2"><strong className="text-[#00ff41]">Логическое И (AND / &amp;)</strong> — истинно, когда оба операнда истинны.</p>
                <p className="mb-2"><strong className="text-[#00ff41]">Логическое ИЛИ (OR / |)</strong> — истинно, когда хотя бы один операнд истинен.</p>
                <p className="mb-2"><strong className="text-[#00ff41]">Логическое НЕ (NOT / !)</strong> — инвертирует значение.</p>
                <p><strong className="text-[#00ff41]">Исключающее ИЛИ (XOR / ^)</strong> — истинно, когда операнды различны.</p>
              </Expandable>
              <Expandable title="> Примеры применения">
                <p className="mb-2">Проверка пароля: <span className="text-cyan-400">if (login &amp;&amp; password)</span></p>
                <p className="mb-2">Поиск: <span className="text-cyan-400">if (hasKeyword || hasTag)</span></p>
                <p>Инверсия: <span className="text-cyan-400">if (!isBlocked)</span></p>
              </Expandable>
            </div>
          </motion.section>

          {/* ══════ SECTION 3: КОДИРОВАНИЕ ИНФОРМАЦИИ ══════ */}
          <motion.section
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-50px" }}
            className="mb-20"
          >
            <SectionHeader icon={Code2} title="КОДИРОВАНИЕ ИНФОРМАЦИИ" subtitle="encoding.scan()" />
            <div className="grid md:grid-cols-2 gap-6">
              <HUDPanel className="p-6">
                <h3 className="font-mono text-sm text-green-300 mb-4 glow-text-sm">{'>'} ascii_table.decoder()</h3>
                <AsciiTable />
              </HUDPanel>
              <div className="space-y-4">
                <h3 className="font-mono text-sm text-green-300 glow-text-sm">{'>'} data_units.measure()</h3>
                {[
                  { unit: "1 Бит", desc: "Минимальная единица: 0 или 1", bar: 2 },
                  { unit: "1 Байт", desc: "8 бит = 1 символ ASCII", bar: 8 },
                  { unit: "1 КБ", desc: "1024 байта ≈ страничка текста", bar: 25 },
                  { unit: "1 МБ", desc: "1024 КБ ≈ 1 фотография", bar: 40 },
                  { unit: "1 ГБ", desc: "1024 МБ ≈ 1 фильм", bar: 60 },
                  { unit: "1 ТБ", desc: "1024 ГБ ≈ 500 фильмов", bar: 80 },
                ].map((u, i) => (
                  <motion.div
                    key={u.unit}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-3"
                  >
                    <span className="font-mono text-xs text-green-300 w-14 text-right shrink-0">{u.unit}</span>
                    <div className="flex-1 h-4 bg-[#020c02] rounded-full overflow-hidden border border-green-900/30">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${u.bar}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, delay: i * 0.05 }}
                        className="h-full bg-gradient-to-r from-green-600 to-[#00ff41] rounded-full"
                      />
                    </div>
                    <span className="text-[10px] text-green-600 font-mono hidden sm:block w-48 shrink-0">{u.desc}</span>
                  </motion.div>
                ))}
                <Expandable title="> Unicode и кодировка">
                  <p className="mb-1">ASCII: 128 символов (0–127)</p>
                  <p className="mb-1">Unicode: 149 000+ символов, включая кириллицу</p>
                  <p className="mb-1">UTF-8: переменная длина 1–4 байта</p>
                  <p>Кириллица «А» в Unicode: U+0410 = 1040</p>
                </Expandable>
                <Expandable title="> Расширения файлов — что важно знать для ВПР">
                  <p className="mb-1"><span className="text-cyan-400">Расширение файла</span> — часть имени после точки: <span className="text-green-300">доклад.docx</span>.</p>
                  <p className="mb-1">Оно помогает ОС выбрать программу: <span className="text-green-300">.jpg</span> открывается как изображение, <span className="text-green-300">.mp3</span> — как аудио.</p>
                  <p className="mb-1">Типичные форматы: <span className="text-green-300">.txt, .docx, .pdf, .png, .jpg, .mp4, .zip, .exe</span>.</p>
                  <p>Будь внимателен: похожие имена (<span className="text-green-300">photo.jpg.exe</span>) могут маскировать вредоносный файл.</p>
                </Expandable>
              </div>
            </div>
          </motion.section>

          {/* ══════ SECTION 4: АЛГОРИТМЫ ══════ */}
          <motion.section
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-50px" }}
            className="mb-20"
          >
            <SectionHeader icon={Activity} title="АЛГОРИТМЫ" subtitle="algorithms.scan()" />
            <div className="grid md:grid-cols-2 gap-6">
              <HUDPanel className="p-6" glow>
                <h3 className="font-mono text-sm text-green-300 mb-4 glow-text-sm">{'>'}flowchart.render() — Проверка чётности</h3>
                <FlowchartSVG />
              </HUDPanel>
              <div className="space-y-4">
                <h3 className="font-mono text-sm text-green-300 glow-text-sm mb-2">{'>'} algorithm_types.list()</h3>
                {[
                  { type: "Линейный", desc: "Команды выполняются последовательно", icon: ArrowRight },
                  { type: "Ветвление", desc: "Выбор пути в зависимости от условия", icon: GitBranch },
                  { type: "Цикл", desc: "Повторение блока команд", icon: RotateCcw },
                ].map((a, i) => (
                  <motion.div
                    key={a.type}
                    initial={{ opacity: 0, y: 15 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-start gap-3 bg-[#030f03] rounded-xl border border-green-800/30 p-4"
                  >
                    <a.icon className="w-5 h-5 text-green-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-mono font-bold text-sm text-white">{a.type}</p>
                      <p className="font-mono text-xs text-green-600">{a.desc}</p>
                    </div>
                  </motion.div>
                ))}
                <Expandable title="> Свойства алгоритмов" defaultOpen>
                  <p className="mb-1">• <strong className="text-[#00ff41]">Дискретность</strong> — разделён на шаги</p>
                  <p className="mb-1">• <strong className="text-[#00ff41]">Детерминированность</strong> — каждый шаг определён однозначно</p>
                  <p className="mb-1">• <strong className="text-[#00ff41]">Конечность</strong> — завершается за конечное время</p>
                  <p className="mb-1">• <strong className="text-[#00ff41]">Массовость</strong> — подходит для набора входных данных</p>
                  <p>• <strong className="text-[#00ff41]">Результативность</strong> — приводит к результату</p>
                </Expandable>
                <Expandable title="> Пример псевдокода">
                  <pre className="bg-[#020c02] rounded-lg p-3 text-xs overflow-x-auto text-cyan-300 border border-green-900/20">{`Алг Чётность
  нач
    ввод N
    если N mod 2 = 0
      то вывод "Чётное"
    иначе вывод "Нечётное"
    всё
  кон`}</pre>
                </Expandable>
              </div>
            </div>
          </motion.section>

          {/* ══════ SECTION 5: АРХИТЕКТУРА КОМПЬЮТЕРА ══════ */}
          <motion.section
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-50px" }}
            className="mb-20"
          >
            <SectionHeader icon={Cpu} title="АРХИТЕКТУРА КОМПЬЮТЕРА" subtitle="architecture.scan()" />
            <div className="grid md:grid-cols-2 gap-6">
              <HUDPanel className="p-6" glow>
                <h3 className="font-mono text-sm text-green-300 mb-4 glow-text-sm">{'>'}von_neumann.arch()</h3>
                <VonNeumannSVG />
              </HUDPanel>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { name: "Процессор (CPU)", icon: Cpu, desc: "Мозг компьютера. Выполняет команды программы." },
                  { name: "ОЗУ (RAM)", icon: Server, desc: "Оперативная память. Быстро, но исчезает при выключении." },
                  { name: "ПЗУ (ROM)", icon: HardDrive, desc: "Постоянная память. Хранит BIOS для загрузки." },
                  { name: "HDD / SSD", icon: Database, desc: "Долговременное хранение данных. Жёсткий диск или твердотельный." },
                  { name: "Ввод", icon: MousePointerClick, desc: "Клавиатура, мышь, сканер, микрофон, веб-камера." },
                  { name: "Вывод", icon: Monitor, desc: "Монитор, принтер, колонки, наушники." },
                ].map((comp, i) => (
                  <InfoCard key={comp.name} icon={comp.icon} title={comp.name}>
                    <p className="text-xs text-green-500/70 font-mono">{comp.desc}</p>
                  </InfoCard>
                ))}
              </div>
              <div className="col-span-full">
                <HUDPanel className="p-5">
                  <h3 className="font-mono text-sm text-amber-400 mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> Принцип фон Неймана
                  </h3>
                  <p className="text-sm text-green-300/80 font-mono leading-relaxed">
                    Программа и данные хранятся в одной и той же памяти. Процессор последовательно читает и выполняет команды из памяти.
                    Данные обрабатываются в АЛУ, а управление координируется устройством управления (УУ).
                  </p>
                </HUDPanel>
              </div>
            </div>
          </motion.section>

          {/* ══════ SECTION 6: СЕТИ И ИНТЕРНЕТ ══════ */}
          <motion.section
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-50px" }}
            className="mb-20"
          >
            <SectionHeader icon={Wifi} title="СЕТИ И ИНТЕРНЕТ" subtitle="networks.scan()" />
            <div className="grid md:grid-cols-2 gap-6">
              <HUDPanel className="p-6" glow>
                <h3 className="font-mono text-sm text-green-300 mb-4 glow-text-sm">{'>'}topology.visualizer()</h3>
                <NetworkTopologySVG />
              </HUDPanel>
              <div className="space-y-4">
                {[
                  { type: "LAN", name: "Локальная сеть", desc: "Ограниченная область (школа, офис). Скорость высокая, радиус до сотен метров." },
                  { type: "WAN", name: "Глобальная сеть", desc: "Охватывает большие территории. Интернет — крупнейшая WAN." },
                  { type: "PAN", name: "Персональная сеть", desc: "Расстояние до 10 метров. Bluetooth, ИК-порт." },
                ].map((net, i) => (
                  <motion.div
                    key={net.type}
                    initial={{ opacity: 0, x: 15 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="bg-[#030f03] rounded-xl border border-green-800/30 p-4"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono font-bold text-[#00ff41] text-sm">{net.type}</span>
                      <span className="text-green-600 font-mono text-xs">— {net.name}</span>
                    </div>
                    <p className="font-mono text-xs text-green-500/70">{net.desc}</p>
                  </motion.div>
                ))}
                <Expandable title="> TCP/IP и DNS">
                  <p className="mb-1"><strong className="text-cyan-400">TCP/IP</strong> — протокол передачи данных. TCP гарантирует доставку, IP — адресацию.</p>
                  <p className="mb-1"><strong className="text-cyan-400">IP-адрес</strong> — уникальный адрес устройства в сети (например, 192.168.1.1)</p>
                  <p><strong className="text-cyan-400">DNS</strong> — Domain Name System, переводит доменные имена в IP-адреса (школа.рф → 93.184.216.34)</p>
                </Expandable>
                <URLRoutingGame />
              </div>
            </div>
          </motion.section>

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
