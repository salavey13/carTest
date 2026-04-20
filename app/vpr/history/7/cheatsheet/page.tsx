'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Landmark, Crown, Swords, Shield, Star, BookOpen, MapPin,
  Clock, AlertTriangle, Users, Eye, MousePointerClick,
  ChevronDown, ChevronUp, Scroll,
} from 'lucide-react';

/* ───────────── DATA ARRAYS ───────────── */

const empireEvents = [
  { year: '1900', title: 'Начало XX века', desc: 'Россия — аграрная держава, 80% населения — крестьяне. Промышленный рост замедлен.' },
  { year: '1904–05', title: 'Русско-японская война', desc: 'Поражение России. Потеря Порт-Артура, Цусимское сражение. Удар по авторитету монархии.' },
  { year: '1905', title: 'Революция 1905 г.', desc: '«Кровавое воскресенье» (9 января). Манифест 17 октября — Дума, свободы. Первые советы рабочих.' },
  { year: '1906–11', title: 'Столыпинские реформы', desc: 'Аграрная реформа: хутора и отруба. Уничтожение общины. «Тихая революция сверху».' },
  { year: '1914', title: 'Вступление в ПМВ', desc: '1 августа — объявление войны Германии. Патриотический подъём → экономический кризис, поражения на фронте.' },
  { year: '1917', title: 'Февраль → крах империи', desc: 'Нехватка продовольствия, забастовки, массовые дезертирства. 2 марта — отречение Николая II.' },
];

const revolutionData = {
  february: {
    title: 'Февральская революция',
    date: '23 февраля – 2 марта 1917',
    causes: [
      'Кризис снабжения городов (хлеб, топливо)',
      'Миллионные потери на фронте',
      'Нерешённый аграрный вопрос',
      'Слабость и раздробленность оппозиции',
    ],
    outcomes: [
      'Отречение Николая II',
      'Двоевластие: Временное правительство ↔ Петросовет',
      'Амнистия политзаключённых',
      'Декларация прав гражданина',
    ],
    figures: ['Керенский А.Ф.', 'Милюков П.Н.', 'Чхеидзе Н.С.'],
  },
  october: {
    title: 'Октябрьская революция',
    date: '24–26 октября 1917',
    causes: [
      'Корниловский мятеж (август)',
      'Кадровый кризис Временного правительства',
      'Лозунг большевиков: «Мир — земле — хлеб»',
      'Роспуск Учредительного собрания',
    ],
    outcomes: [
      'Захват власти большевиками',
      'Декреты о мире и о земле',
      'Учреждение Совнаркома во главе с Лениным',
      'Начало Гражданской войны',
    ],
    figures: ['Ленин В.И.', 'Троцкий Л.Д.', 'Дзержинский Ф.Э.'],
  },
};

const civilWarFigures = [
  { name: 'Ленин В.И.', role: 'Руководитель РСФСР', side: 'красные', color: '#ef4444' },
  { name: 'Троцкий Л.Д.', role: 'Наркомвоенмор, создатель РККА', side: 'красные', color: '#ef4444' },
  { name: 'Деникин А.И.', role: 'Белая Добровольческая армия', side: 'белые', color: '#e2e8f0' },
  { name: 'Колчак А.В.', role: 'Верховный правитель, Сибирь', side: 'белые', color: '#e2e8f0' },
  { name: 'Махно Н.И.', role: 'Анархист, Революционная повстанческая армия', side: 'зелёные', color: '#22c55e' },
  { name: 'Врангель П.Н.', role: 'Русская армия в Крыму (1920)', side: 'белые', color: '#e2e8f0' },
];

const warCommunismPolicies = [
  { title: 'Продразвёрстка', desc: 'Принудительное изъятие продовольствия у крестьян по твёрдым нормам.' },
  { title: 'Трудовая повинность', desc: 'Всеобщая трудовая мобилизация. Военный коммунизм в экономике.' },
  { title: 'Национализация', desc: 'Передача всей крупной и средней промышленности под контроль государства.' },
  { title: 'Красный террор', desc: 'Массовые репрессии ВЧК против «классовых врагов».' },
];

const nepPolicies = [
  { title: 'Продовольственный налог', desc: 'Замена продразвёрстки — крестьянин сдаёт фиксированный налог, излишки продаёт свободно.' },
  { title: 'Мелкая частная торговля', desc: 'Разрешение мелкого частного предпринимательства и торговли.' },
  { title: 'Концессии', desc: 'Сдача предприятий в аренду иностранным капиталистам.' },
  { title: 'Хозрасчёт', desc: 'Предприятия переходят на самоокупаемость, появляется прибыль и убытки.' },
];

const stalinTabs = [
  {
    id: 'industrialization',
    label: 'Индустриализация',
    icon: '⚙️',
    content: [
      { title: 'Пятилетки', desc: '1-я (1928–1932) и 2-я (1933–1937) пятилетки. Форсированное развитие тяжёлой промышленности.' },
      { title: 'Урал-Кузбасс', desc: 'Создание второй угольно-металлургической базы на востоке страны.' },
      { title: 'Днепрогэс (1932)', desc: 'Крупнейшая ГЭС Европы. Символ индустриализации.' },
      { title: 'Стахановское движение', desc: 'Соцсоревнование за перевыполнение норм. Алексей Стаханов — 1935 г.' },
    ],
  },
  {
    id: 'collectivization',
    label: 'Коллективизация',
    icon: '🌾',
    content: [
      { title: 'Раскулачивание', desc: 'Ликвидация кулачества как класса. Массовые высылки и депортации (1929–1932).' },
      { title: 'Колхозы и совхозы', desc: 'Объединение крестьянских хозяйств. Обобществление скота и инвентаря.' },
      { title: 'Голод 1932–33', desc: 'Катастрофический голод в Поволжье, Украине, Казахстане. Миллионы жертв.' },
      { title: 'МТС', desc: 'Машинно-тракторные станции — техническая помощь колхозам.' },
    ],
  },
  {
    id: 'culture',
    label: 'Культура',
    icon: '🎭',
    content: [
      { title: '«Культурная революция»', desc: 'Ликвидация неграмотности (ликбез). Создание единой системы образования.' },
      { title: 'Социалистический реализм', desc: 'Единственный разрешённый метод в искусстве. Кинематограф, литература, архитектура.' },
      { title: 'Репрессии 1937–38', desc: 'Большой террор. Репрессии против партийных кадров, военачальников, интеллигенции.' },
      { title: 'Конституция 1936', desc: '"Сталинская конституция" — «самая демократическая в мире». Всеобщее право голоса.' },
    ],
  },
];

const wwiiBattles = [
  { year: '1941', battle: 'Битва за Москву', date: 'сентябрь 1941 – апрель 1942', result: 'Поражение плана «Барбаросса»', icon: '🏛️' },
  { year: '1942–43', battle: 'Сталинградская битва', date: 'июль 1942 – февраль 1943', result: 'Коренной перелом. 91 000 пленных.', icon: '⚔️' },
  { year: '1943', battle: 'Курская битва', date: 'июль – август 1943', result: 'Крупнейшее танковое сражение. Инициатива — у СССР.', icon: '🛡️' },
  { year: '1944', battle: 'Операция «Багратион»', date: 'июнь – август 1944', result: 'Освобождение Белоруссии, выход к Висле.', icon: '🗡️' },
  { year: '1945', battle: 'Взятие Берлина', date: 'апрель – май 1945', result: 'Победа. Подписание капитуляции 8 мая.', icon: '🏴' },
];

const coldWarEvents = [
  { year: '1947', title: 'План Маршалла', desc: 'Программа экономической помощи США Европе. СССР отказался и заставил отказать страны Восточного блока.' },
  { year: '1949', title: 'Создание НАТО', desc: 'Североатлантический альянс. Противовес — Организация Варшавского договора (1955).' },
  { year: '1955', title: 'Организация Варшавского договора', desc: 'Военный союз социалистических стран во главе с СССР.' },
  { year: '1957', title: 'Запуск «Спутника-1»', desc: 'Первый искусственный спутник Земли. Начало космической эры.' },
  { year: '1961', title: 'Полет Гагарина', desc: '12 апреля 1961 — Юрий Гагарин. Первый человек в космосе.' },
  { year: '1961', title: 'Берлинская стена', desc: 'Возведение стены, разделившей Берлин. Символ холодной войны.' },
  { year: '1962', title: 'Карибский кризис', desc: 'Размещение ракет на Кубе. Мир на грани ядерной войны. Отступление Хрущёва и Кеннеди.' },
  { year: '1979', title: 'Ввод войск в Афганистан', desc: 'Афганская война (1979–1989). Международная изоляция, экономический кризис.' },
];

const ussrCollapseEvents = [
  { year: '1985', title: 'Перестройка', desc: 'М.С. Горбачёв — Генеральный секретарь. Курс на ускорение, гласность, демократизацию.' },
  { year: '1986', title: 'Авария на ЧАЭС', desc: 'Чернобыльская катастрофа. Усиление критики системы. Начало гласности.' },
  { year: '1989', title: 'Выборы Съезда народных депутатов', desc: 'Первые альтернативные выборы. Падение Берлинской стены. Выход стран из ОВД.' },
  { year: '1990', title: 'Декларация о суверенитете РСФСР', desc: '12 июня 1990 — Декларация о государственном суверенитете России. «Парад суверенитетов».' },
  { year: '1991', title: 'ГКЧП (август)', desc: 'Попытка переворота. Провал путчистов. Усиление Ельцина.' },
  { year: '1991', title: 'Беловежские соглашения', desc: '8 декабря — прекращение существования СССР. Создание СНГ.' },
];

const industrialData = [
  { year: '1928', value: 18, label: 'Базовый' },
  { year: '1932', value: 46, label: '+155%' },
  { year: '1937', value: 78, label: '+333%' },
  { year: '1940', value: 100, label: '+455%' },
];

/* ───────────── SVG COMPONENTS ───────────── */

function CenturyTimelineSVG() {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const eras = [
    { start: 0, end: 17, color: '#b45309', label: 'Российская империя' },
    { start: 17, end: 22, color: '#ef4444', label: 'Революции' },
    { start: 22, end: 28, color: '#dc2626', label: 'Гражданская война' },
    { start: 28, end: 45, color: '#f59e0b', label: 'СССР: сталинская эпоха' },
    { start: 45, end: 53, color: '#16a34a', label: 'Холодная война' },
    { start: 53, end: 65, color: '#6366f1', label: 'Оттепель/Застой' },
    { start: 65, end: 70, color: '#8b5cf6', label: 'Перестройка' },
  ];
  const markers = [
    { pos: 5, label: '1905' }, { pos: 14, label: '1914' }, { pos: 17, label: '1917' },
    { pos: 22, label: '1922' }, { pos: 28, label: '1928' }, { pos: 41, label: '1941' },
    { pos: 45, label: '1945' }, { pos: 57, label: '1957' }, { pos: 61, label: '1961' },
    { pos: 65, label: '1985' }, { pos: 69, label: '1991' },
  ];
  const w = 900, h = 100;
  return (
    <svg viewBox={`0 0 ${w} ${h + 40}`} className="w-full max-w-4xl mx-auto" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="tlGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#b45309" />
          <stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      {/* Background bar */}
      <rect x="20" y="45" width={w - 40} height="10" rx="5" fill="url(#tlGrad)" opacity="0.25" />
      {/* Era blocks */}
      {eras.map((e, i) => (
        <motion.rect
          key={i}
          initial={{ width: 0 }}
          animate={{ width: ((e.end - e.start) / 70) * (w - 40) }}
          transition={{ duration: 1, delay: i * 0.15 }}
          x={20 + (e.start / 70) * (w - 40)}
          y="47"
          height="6"
          rx="3"
          fill={e.color}
          opacity="0.7"
        />
      ))}
      {/* Year markers */}
      {markers.map((m, i) => (
        <g key={i} onMouseEnter={() => setHoveredIdx(i)} onMouseLeave={() => setHoveredIdx(null)} className="cursor-pointer">
          <motion.line
            initial={{ y2: 0 }}
            animate={{ y2: hoveredIdx === i ? 35 : 20 }}
            x1={20 + (m.pos / 70) * (w - 40)} y1="52"
            x2={20 + (m.pos / 70) * (w - 40)} y2="52"
            stroke="#f59e0b" strokeWidth="1.5"
          />
          <motion.circle
            animate={{ r: hoveredIdx === i ? 6 : 4 }}
            cx={20 + (m.pos / 70) * (w - 40)} cy="52"
            fill="#f59e0b"
          >
            <animate attributeName="opacity" values="1;0.5;1" dur="2s" repeatCount="indefinite" />
          </motion.circle>
          <text x={20 + (m.pos / 70) * (w - 40)} y="100" textAnchor="middle" fill="#fbbf24" fontSize="11" fontFamily="monospace">
            {m.label}
          </text>
        </g>
      ))}
      {/* Era labels */}
      {eras.map((e, i) => (
        <text key={`l${i}`} x={20 + ((e.start + e.end) / 2 / 70) * (w - 40)} y="30" textAnchor="middle" fill={e.color} fontSize="9" opacity="0.8">
          {e.label}
        </text>
      ))}
    </svg>
  );
}

function RevolutionSVG() {
  const [hovered, setHovered] = useState<'feb' | 'oct' | null>(null);
  return (
    <svg viewBox="0 0 800 300" className="w-full max-w-3xl mx-auto" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="febGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fb923c" />
          <stop offset="100%" stopColor="#ea580c" />
        </linearGradient>
        <linearGradient id="octGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ef4444" />
          <stop offset="100%" stopColor="#991b1b" />
        </linearGradient>
        <filter id="revGlow">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {/* Divider */}
      <motion.line x1="400" y1="20" x2="400" y2="280" stroke="#f59e0b" strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />
      {/* Left: February */}
      <g onMouseEnter={() => setHovered('feb')} onMouseLeave={() => setHovered(null)} className="cursor-pointer">
        <motion.rect animate={{ opacity: hovered === 'feb' ? 1 : 0.6, scale: hovered === 'feb' ? 1.02 : 1 }}
          x="40" y="40" width="310" height="220" rx="16" fill="url(#febGrad)" filter={hovered === 'feb' ? 'url(#revGlow)' : undefined} />
        {/* Winter Palace silhouette */}
        <rect x="80" y="140" width="60" height="90" rx="2" fill="#7c2d12" opacity="0.6" />
        <rect x="150" y="160" width="50" height="70" rx="2" fill="#7c2d12" opacity="0.6" />
        <rect x="210" y="130" width="70" height="100" rx="2" fill="#7c2d12" opacity="0.6" />
        {/* Dome */}
        <ellipse cx="180" cy="135" rx="45" ry="20" fill="#92400e" opacity="0.5" />
        <rect x="178" y="100" width="4" height="35" fill="#fbbf24" opacity="0.6" />
        <circle cx="180" cy="97" r="4" fill="#fbbf24" opacity="0.7" />
        {/* Crowd */}
        {[100, 140, 180, 220, 260, 300].map((cx, i) => (
          <g key={i}>
            <circle cx={cx} cy={245 + (i % 2) * 5} r="5" fill="#fed7aa" opacity="0.7" />
            <rect x={cx - 3} y={250 + (i % 2) * 5} width="6" height="8" fill="#fdba74" opacity="0.5" />
          </g>
        ))}
        <text x="195" y="75" textAnchor="middle" fill="#fff" fontSize="18" fontWeight="bold">ФЕВРАЛЬ</text>
        <text x="195" y="95" textAnchor="middle" fill="#fed7aa" fontSize="12">23 фев – 2 марта 1917</text>
      </g>
      {/* Right: October */}
      <g onMouseEnter={() => setHovered('oct')} onMouseLeave={() => setHovered(null)} className="cursor-pointer">
        <motion.rect animate={{ opacity: hovered === 'oct' ? 1 : 0.6, scale: hovered === 'oct' ? 1.02 : 1 }}
          x="450" y="40" width="310" height="220" rx="16" fill="url(#octGrad)" filter={hovered === 'oct' ? 'url(#revGlow)' : undefined} />
        {/* Smolny */}
        <rect x="520" y="140" width="80" height="90" rx="4" fill="#450a0a" opacity="0.5" />
        <rect x="610" y="155" width="55" height="75" rx="4" fill="#450a0a" opacity="0.5" />
        {/* Star on Smolny */}
        <motion.polygon
          animate={{ rotate: hovered === 'oct' ? 360 : 0 }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
          points="560,120 565,135 580,135 568,144 572,158 560,149 548,158 552,144 540,135 555,135"
          fill="#fbbf24" opacity="0.8"
        />
        {/* Aurora cruiser silhouette */}
        <path d="M480 240 L510 240 L515 250 L510 255 L480 255 Z" fill="#1c1917" opacity="0.4" />
        <rect x="490" y="230" width="3" height="10" fill="#fbbf24" opacity="0.4" />
        <text x="605" y="75" textAnchor="middle" fill="#fff" fontSize="18" fontWeight="bold">ОКТЯБРЬ</text>
        <text x="605" y="95" textAnchor="middle" fill="#fecaca" fontSize="12">24–26 октября 1917</text>
      </g>
    </svg>
  );
}

function SovietMapSVG() {
  const republics = [
    { id: 'rsfsr', name: 'РСФСР', color: '#ef4444', cx: 280, cy: 120, rx: 110, ry: 65 },
    { id: 'ukraine', name: 'УССР', color: '#3b82f6', cx: 200, cy: 200, rx: 55, ry: 40 },
    { id: 'belarus', name: 'БССР', color: '#22c55e', cx: 250, cy: 175, rx: 35, ry: 25 },
    { id: 'uzbek', name: 'УзССР', color: '#f59e0b', cx: 340, cy: 230, rx: 40, ry: 35 },
    { id: 'kazakh', name: 'КазССР', color: '#8b5cf6', cx: 350, cy: 160, rx: 70, ry: 35 },
    { id: 'georgia', name: 'ГрССР', color: '#ec4899', cx: 310, cy: 210, rx: 25, ry: 22 },
    { id: 'azer', name: 'АзССР', color: '#06b6d4', cx: 360, cy: 200, rx: 28, ry: 20 },
    { id: 'lit', name: 'ЛитССР', color: '#a3e635', cx: 240, cy: 125, rx: 18, ry: 15 },
    { id: 'lat', name: 'ЛатССР', color: '#fbbf24', cx: 255, cy: 115, rx: 18, ry: 15 },
    { id: 'est', name: 'ЭстССР', color: '#fb923c', cx: 270, cy: 105, rx: 18, ry: 15 },
    { id: 'mold', name: 'МолССР', color: '#a78bfa', cx: 245, cy: 210, rx: 20, ry: 15 },
    { id: 'kyrgyz', name: 'КирССР', color: '#2dd4bf', cx: 380, cy: 220, rx: 25, ry: 20 },
    { id: 'tajik', name: 'ТаджССР', color: '#f472b6', cx: 365, cy: 240, rx: 25, ry: 18 },
    { id: 'arm', name: 'АрмССР', color: '#f97316', cx: 375, cy: 210, rx: 18, ry: 16 },
    { id: 'turk', name: 'ТуркССР', color: '#facc15', cx: 320, cy: 240, rx: 40, ry: 20 },
  ];
  const [hovered, setHovered] = useState<string | null>(null);
  return (
    <svg viewBox="0 0 500 300" className="w-full max-w-xl mx-auto" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="mapGlow"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      {/* Background */}
      <rect width="500" height="300" fill="#0d0a04" rx="12" />
      <text x="250" y="22" textAnchor="middle" fill="#f59e0b" fontSize="13" fontWeight="bold">СССР — 15 республик</text>
      {republics.map((r) => (
        <g key={r.id} onMouseEnter={() => setHovered(r.id)} onMouseLeave={() => setHovered(null)} className="cursor-pointer">
          <motion.ellipse
            animate={{ rx: hovered === r.id ? r.rx + 5 : r.rx, ry: hovered === r.id ? r.ry + 5 : r.ry, opacity: hovered === r.id ? 1 : 0.7 }}
            cx={r.cx} cy={r.cy} rx={r.rx} ry={r.ry}
            fill={r.color} filter={hovered === r.id ? 'url(#mapGlow)' : undefined}
            style={{ transition: 'all 0.3s' }}
          />
          {(hovered === r.id || r.rx > 40) && (
            <text x={r.cx} y={r.cy + 4} textAnchor="middle" fill="#fff" fontSize={hovered === r.id ? 11 : 9} fontWeight="bold">
              {r.name}
            </text>
          )}
        </g>
      ))}
      {/* Year label */}
      <text x="250" y="288" textAnchor="middle" fill="#92400e" fontSize="11">Образовано: 30 декабря 1922 г.</text>
    </svg>
  );
}

function WarBattlesSVG() {
  const cities = [
    { name: 'Москва', x: 180, y: 80, year: '1941' },
    { name: 'Сталинград', x: 310, y: 140, year: '1942–43' },
    { name: 'Курск', x: 200, y: 115, year: '1943' },
    { name: 'Берлин', x: 100, y: 65, year: '1945' },
  ];
  const [hoveredCity, setHoveredCity] = useState<number | null>(null);
  const frontLine1941 = 'M340 60 Q290 100 310 140 Q280 170 260 190';
  const frontLine1943 = 'M200 70 Q220 90 200 115 Q210 130 180 140';
  const frontLine1945 = 'M100 65 Q90 70 95 80';

  return (
    <svg viewBox="0 0 420 240" className="w-full max-w-2xl mx-auto" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="redGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.3" />
        </linearGradient>
        <marker id="arrowR" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <path d="M0,0 L8,3 L0,6 Z" fill="#fbbf24" />
        </marker>
      </defs>
      {/* Simplified map background */}
      <rect width="420" height="240" fill="#0d0a04" rx="10" />
      {/* USSR area */}
      <ellipse cx="300" cy="140" rx="130" ry="90" fill="#1a0f00" opacity="0.5" />
      {/* Front lines */}
      <path d={frontLine1941} stroke="#ef4444" strokeWidth="2" fill="none" strokeDasharray="6 3" opacity="0.6">
        <animate attributeName="stroke-dashoffset" from="0" to="-18" dur="2s" repeatCount="indefinite" />
      </path>
      <text x={360} y={175} fill="#ef4444" fontSize="9" opacity="0.7">1941</text>
      <path d={frontLine1943} stroke="#f59e0b" strokeWidth="2" fill="none" strokeDasharray="6 3" opacity="0.7">
        <animate attributeName="stroke-dashoffset" from="0" to="-18" dur="2s" repeatCount="indefinite" />
      </path>
      <text x={200} y={160} fill="#f59e0b" fontSize="9" opacity="0.8">1943</text>
      <path d={frontLine1945} stroke="#22c55e" strokeWidth="3" fill="none" markerEnd="url(#arrowR)">
        <animate attributeName="stroke-dashoffset" from="0" to="-12" dur="1s" repeatCount="indefinite" />
      </path>
      <text x={75} y={95} fill="#22c55e" fontSize="9">1945</text>
      {/* Cities */}
      {cities.map((c, i) => (
        <g key={i} onMouseEnter={() => setHoveredCity(i)} onMouseLeave={() => setHoveredCity(null)} className="cursor-pointer">
          <motion.circle
            animate={{ r: hoveredCity === i ? 8 : 5 }}
            cx={c.x} cy={c.y} fill="#fbbf24"
          >
            <animate attributeName="opacity" values="1;0.4;1" dur="1.5s" repeatCount="indefinite" />
          </motion.circle>
          <motion.text
            animate={{ fontSize: hoveredCity === i ? 13 : 10, y: hoveredCity === i ? c.y - 14 : c.y - 10 }}
            x={c.x} textAnchor="middle" fill="#fef3c7" fontWeight="bold"
          >
            {c.name}
          </motion.text>
          {hoveredCity === i && (
            <motion.text
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              x={c.x} y={c.y + 18} textAnchor="middle" fill="#f59e0b" fontSize="10"
            >
              {c.year}
            </motion.text>
          )}
        </g>
      ))}
      {/* Legend */}
      <circle cx="30" cy="220" r="4" fill="#ef4444" /><text x="40" y="223" fill="#fca5a5" fontSize="9">Отступление</text>
      <circle cx="130" cy="220" r="4" fill="#f59e0b" /><text x="140" y="223" fill="#fde68a" fontSize="9">Перелом</text>
      <circle cx="210" cy="220" r="4" fill="#22c55e" /><text x="220" y="223" fill="#86efac" fontSize="9">Наступление</text>
    </svg>
  );
}

function IndustrialGrowthSVG() {
  return (
    <svg viewBox="0 0 500 280" className="w-full max-w-2xl mx-auto" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="barGrad" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#b45309" />
          <stop offset="100%" stopColor="#fbbf24" />
        </linearGradient>
      </defs>
      <rect width="500" height="280" fill="#0d0a04" rx="10" />
      <text x="250" y="25" textAnchor="middle" fill="#f59e0b" fontSize="14" fontWeight="bold">Рост промышленного производства (1928–1940)</text>
      {/* Axes */}
      <line x1="60" y1="250" x2="460" y2="250" stroke="#f59e0b" strokeWidth="1" opacity="0.4" />
      <line x1="60" y1="40" x2="60" y2="250" stroke="#f59e0b" strokeWidth="1" opacity="0.4" />
      {/* Y-axis labels */}
      {[0, 25, 50, 75, 100].map((v) => (
        <g key={v}>
          <line x1="55" y1={250 - v * 2} x2="60" y2={250 - v * 2} stroke="#f59e0b" strokeWidth="1" opacity="0.3" />
          <text x="50" y={254 - v * 2} textAnchor="end" fill="#92400e" fontSize="9">{v}%</text>
        </g>
      ))}
      {/* Bars */}
      {industrialData.map((d, i) => (
        <g key={i}>
          <motion.rect
            initial={{ height: 0, y: 250 }}
            animate={{ height: d.value * 2, y: 250 - d.value * 2 }}
            transition={{ duration: 1.2, delay: i * 0.3, type: 'spring' }}
            x={100 + i * 100} width="50" rx="4"
            fill="url(#barGrad)" opacity="0.85"
          />
          <text x={125 + i * 100} y={250 - d.value * 2 - 8} textAnchor="middle" fill="#fbbf24" fontSize="11" fontWeight="bold">
            {d.label}
          </text>
          <text x={125 + i * 100} y={268} textAnchor="middle" fill="#fde68a" fontSize="11">{d.year}</text>
        </g>
      ))}
    </svg>
  );
}

function ColdWarIronCurtainSVG() {
  return (
    <svg viewBox="0 0 500 200" className="w-full max-w-xl mx-auto" xmlns="http://www.w3.org/2000/svg">
      <rect width="500" height="200" fill="#0d0a04" rx="10" />
      {/* West */}
      <rect x="10" y="30" width="210" height="140" rx="8" fill="#1e3a5f" opacity="0.3" />
      <text x="115" y="60" textAnchor="middle" fill="#60a5fa" fontSize="13" fontWeight="bold">ЗАПАД</text>
      <text x="115" y="80" textAnchor="middle" fill="#93c5fd" fontSize="10">США • НАТО</text>
      <text x="115" y="100" textAnchor="middle" fill="#93c5fd" fontSize="9">Капитализм</text>
      {/* East */}
      <rect x="280" y="30" width="210" height="140" rx="8" fill="#7f1d1d" opacity="0.3" />
      <text x="385" y="60" textAnchor="middle" fill="#f87171" fontSize="13" fontWeight="bold">ВОСТОК</text>
      <text x="385" y="80" textAnchor="middle" fill="#fca5a5" fontSize="10">СССР • ОВД</text>
      <text x="385" y="100" textAnchor="middle" fill="#fca5a5" fontSize="9">Социализм</text>
      {/* Iron Curtain */}
      <motion.rect
        animate={{ opacity: [0.4, 0.9, 0.4] }}
        transition={{ duration: 2, repeat: Infinity }}
        x="238" y="25" width="24" height="150" rx="2"
        fill="#6b21a8" opacity="0.6"
      />
      <text x="250" y="55" textAnchor="middle" fill="#c084fc" fontSize="8" fontWeight="bold">ЖЕЛЕЗ</text>
      <text x="250" y="66" textAnchor="middle" fill="#c084fc" fontSize="8" fontWeight="bold">НЫЙ</text>
      <text x="250" y="77" textAnchor="middle" fill="#c084fc" fontSize="8" fontWeight="bold">ЗАНАВЕС</text>
      {/* Arrows */}
      <path d="M225 100 L235 100" stroke="#60a5fa" strokeWidth="1.5" markerEnd="url(#arrowR)" opacity="0.4" />
      <path d="M275 100 L265 100" stroke="#f87171" strokeWidth="1.5" opacity="0.4" />
      {/* Year */}
      <text x="250" y="190" textAnchor="middle" fill="#92400e" fontSize="10">1946–1991</text>
    </svg>
  );
}

/* ───────────── MAIN COMPONENT ───────────── */

export default function History7Cheatsheet() {
  const [expandedEvent, setExpandedEvent] = useState<number | null>(null);
  const [activeStalinTab, setActiveStalinTab] = useState('industrialization');
  const [hoveredRevSide, setHoveredRevSide] = useState<'feb' | 'oct' | null>(null);

  const sectionVariants = {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
  };

  const cardVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.4 } },
  };

  return (
    <div className="min-h-screen bg-[#0d0a04] text-amber-50 relative overflow-hidden">
      {/* Background pattern: subtle parchment dots */}
      <div className="fixed inset-0 opacity-[0.03]" style={{
        backgroundImage: 'radial-gradient(circle, #f59e0b 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }} />
      {/* Glow orbs */}
      <div className="fixed top-20 -left-32 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-20 -right-32 w-80 h-80 bg-amber-500/8 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-700/5 rounded-full blur-3xl pointer-events-none" />

      <main className="relative z-10 max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* ── HEADER ── */}
        <motion.section
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-12"
        >
          {/* Back link */}
          <motion.div whileHover={{ x: -4 }} className="inline-block mb-8">
            <Link href="/vpr-tests" className="flex items-center gap-2 text-amber-400 hover:text-amber-300 text-sm transition-colors">
              <ChevronDown className="w-4 h-4 rotate-90" />
              <span>Назад к ВПР тестам</span>
            </Link>
          </motion.div>

          {/* Crown / Shield SVG emblem */}
          <div className="flex justify-center mb-6">
            <motion.svg viewBox="0 0 80 80" className="w-20 h-20" initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', delay: 0.3 }}>
              <defs>
                <linearGradient id="emblemGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#b45309" />
                </linearGradient>
              </defs>
              <circle cx="40" cy="40" r="38" fill="none" stroke="url(#emblemGrad)" strokeWidth="2" />
              <circle cx="40" cy="40" r="30" fill="none" stroke="#d97706" strokeWidth="1" opacity="0.5" />
              {/* Crown */}
              <path d="M22 52 L22 38 L28 42 L34 30 L40 40 L46 30 L52 42 L58 38 L58 52 Z" fill="#f59e0b" opacity="0.8" />
              {/* Star */}
              <motion.polygon animate={{ rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                points="40,15 42,22 49,22 43,26 45,33 40,29 35,33 37,26 31,22 38,22" fill="#fbbf24" />
              <text x="40" y="62" textAnchor="middle" fill="#d97706" fontSize="8" fontWeight="bold">VPR</text>
            </motion.svg>
          </div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
            <span className="inline-block px-3 py-1 bg-amber-900/40 border border-amber-700/50 rounded-full text-xs text-amber-400 font-mono mb-4">
              Protocol_Decrypted
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-extrabold bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 bg-clip-text text-transparent mb-4 tracking-tight"
          >
            MECHANICS OF HISTORY
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="text-amber-200/60 text-lg max-w-2xl mx-auto"
          >
            XX век. Анализ пропаганды и исторических цепочек.
          </motion.p>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
            className="flex flex-wrap justify-center gap-3 mt-6"
          >
            {['История', '7 класс', 'ВПР', '1900–1991'].map((tag) => (
              <span key={tag} className="px-3 py-1 bg-amber-950/50 border border-amber-800/30 rounded-full text-xs text-amber-500">
                {tag}
              </span>
            ))}
          </motion.div>
        </motion.section>

        {/* ── CENTURY TIMELINE ── */}
        <motion.section variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true }} className="mb-14">
          <SectionHeader icon={<Clock className="w-5 h-5" />} title="ВЕК В ОБЗОРЕ" subtitle="Ключевые эпохи России XX века" />
          <div className="bg-[#120d04] rounded-xl border border-amber-800/40 p-6">
            <CenturyTimelineSVG />
          </div>
        </motion.section>

        {/* ── SECTION 1: RUSSIAN EMPIRE 1900-1917 ── */}
        <motion.section variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true }} className="mb-14">
          <SectionHeader icon={<Crown className="w-5 h-5" />} title="РОССИЙСКАЯ ИМПЕРИЯ 1900–1917" subtitle="Кризис самодержавия, войны и революции" />
          <div className="grid gap-4">
            {empireEvents.map((evt, i) => (
              <motion.div key={i} variants={cardVariants} whileHover={{ scale: 1.01, borderColor: 'rgba(245,158,11,0.5)' }}
                className="bg-[#120d04] rounded-xl border border-amber-800/30 p-4 cursor-pointer"
                onClick={() => setExpandedEvent(expandedEvent === i ? null : i)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-amber-500 font-mono text-sm font-bold">{evt.year}</span>
                      <span className="text-amber-100 font-semibold">{evt.title}</span>
                    </div>
                    <AnimatePresence>
                      {expandedEvent === i && (
                        <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                          className="text-amber-200/70 text-sm leading-relaxed overflow-hidden">
                          {evt.desc}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                  <motion.div animate={{ rotate: expandedEvent === i ? 180 : 0 }}>
                    <ChevronDown className="w-4 h-4 text-amber-600 mt-1" />
                  </motion.div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ── SECTION 2: REVOLUTIONS OF 1917 ── */}
        <motion.section variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true }} className="mb-14">
          <SectionHeader icon={<Swords className="w-5 h-5" />} title="РЕВОЛЮЦИИ 1917" subtitle="Две революции, изменившие ход истории" />
          <div className="bg-[#120d04] rounded-xl border border-amber-800/40 p-6">
            <RevolutionSVG />
            {/* Revolution details cards */}
            <div className="grid md:grid-cols-2 gap-4 mt-6">
              {(['feb', 'oct'] as const).map((side) => {
                const data = side === 'feb' ? revolutionData.february : revolutionData.october;
                return (
                  <motion.div key={side}
                    onMouseEnter={() => setHoveredRevSide(side)}
                    onMouseLeave={() => setHoveredRevSide(null)}
                    whileHover={{ y: -2 }}
                    className={`rounded-xl border p-4 transition-colors ${side === 'feb' ? 'bg-orange-950/20 border-orange-700/40' : 'bg-red-950/20 border-red-700/40'}`}
                  >
                    <h4 className={`font-bold text-base mb-1 ${side === 'feb' ? 'text-orange-300' : 'text-red-300'}`}>{data.title}</h4>
                    <p className="text-amber-400/60 text-xs mb-3 font-mono">{data.date}</p>
                    <div className="mb-3">
                      <p className="text-xs text-amber-500 font-semibold mb-1">Причины:</p>
                      <ul className="space-y-1">
                        {data.causes.map((c, ci) => (
                          <motion.li key={ci} initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }}
                            transition={{ delay: ci * 0.1 }} className="text-amber-200/70 text-xs flex gap-2">
                            <span className="text-amber-600 mt-0.5">•</span>{c}
                          </motion.li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs text-amber-500 font-semibold mb-1">Итоги:</p>
                      <ul className="space-y-1">
                        {data.outcomes.map((o, oi) => (
                          <motion.li key={oi} initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }}
                            transition={{ delay: oi * 0.1 }} className="text-amber-200/70 text-xs flex gap-2">
                            <span className="text-green-500 mt-0.5">✓</span>{o}
                          </motion.li>
                        ))}
                      </ul>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {data.figures.map((f) => (
                        <span key={f} className="px-2 py-0.5 bg-amber-900/30 rounded text-[10px] text-amber-400">{f}</span>
                      ))}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </motion.section>

        {/* ── SECTION 3: CIVIL WAR 1918-1922 ── */}
        <motion.section variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true }} className="mb-14">
          <SectionHeader icon={<Shield className="w-5 h-5" />} title="ГРАЖДАНСКАЯ ВОЙНА 1918–1922" subtitle="Красные, белые, зелёные — борьба за власть" />
          {/* Figures grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            {civilWarFigures.map((fig, i) => (
              <motion.div key={i} whileHover={{ scale: 1.03, y: -4 }} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
                transition={{ delay: i * 0.1 }} className="bg-[#120d04] rounded-xl border border-amber-800/30 p-4 text-center">
                <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 3, repeat: Infinity, delay: i * 0.5 }}
                  className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center text-white text-lg font-bold"
                  style={{ backgroundColor: fig.color + '33', border: `2px solid ${fig.color}` }}>
                  {fig.name[0]}
                </motion.div>
                <p className="text-amber-100 text-sm font-semibold">{fig.name}</p>
                <p className="text-amber-400/50 text-xs">{fig.role}</p>
                <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] ${
                  fig.side === 'красные' ? 'bg-red-900/40 text-red-300' :
                  fig.side === 'белые' ? 'bg-slate-700/40 text-slate-300' :
                  'bg-green-900/40 text-green-300'
                }`}>{fig.side}</span>
              </motion.div>
            ))}
          </div>
          {/* War Communism policies */}
          <h4 className="text-amber-400 font-semibold mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Политика «военного коммунизма»
          </h4>
          <div className="grid sm:grid-cols-2 gap-3">
            {warCommunismPolicies.map((p, i) => (
              <motion.div key={i} whileHover={{ x: 4 }} className="bg-red-950/20 border border-red-800/30 rounded-lg p-3">
                <p className="text-red-300 text-sm font-semibold">{p.title}</p>
                <p className="text-amber-200/60 text-xs mt-1">{p.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ── SECTION 4: USSR FORMATION 1922-1928 ── */}
        <motion.section variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true }} className="mb-14">
          <SectionHeader icon={<Star className="w-5 h-5" />} title="ОБРАЗОВАНИЕ СССР 1922–1928" subtitle="НЭП, объединение республик, начало индустриализации" />
          <div className="bg-[#120d04] rounded-xl border border-amber-800/40 p-6">
            <SovietMapSVG />
            {/* NEP policies */}
            <h4 className="text-amber-400 font-semibold mt-6 mb-3 flex items-center gap-2">
              <BookOpen className="w-4 h-4" /> Новая экономическая политика (НЭП)
            </h4>
            <div className="grid sm:grid-cols-2 gap-3">
              {nepPolicies.map((p, i) => (
                <motion.div key={i} whileHover={{ x: 4, borderColor: 'rgba(245,158,11,0.4)' }}
                  className="bg-[#0d0a04] rounded-lg border border-amber-800/20 p-3">
                  <p className="text-amber-200 text-sm font-semibold">{p.title}</p>
                  <p className="text-amber-200/60 text-xs mt-1">{p.desc}</p>
                </motion.div>
              ))}
            </div>
            {/* Key dates */}
            <div className="mt-6 flex flex-wrap gap-3">
              {[
                { date: '30.12.1922', event: 'Подписание Договора об образовании СССР' },
                { date: '1924', event: 'Принятие первой Конституции СССР' },
                { date: '1925', event: 'Начало восстановительного периода' },
              ].map((item, i) => (
                <motion.span key={i} whileHover={{ scale: 1.05 }}
                  className="px-3 py-1.5 bg-amber-950/40 border border-amber-800/30 rounded-lg text-xs">
                  <span className="text-amber-400 font-mono">{item.date}</span>
                  <span className="text-amber-200/50 ml-2">{item.event}</span>
                </motion.span>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ── SECTION 5: STALIN ERA 1928-1953 ── */}
        <motion.section variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true }} className="mb-14">
          <SectionHeader icon={<Eye className="w-5 h-5" />} title="СТАЛИНСКАЯ ЭПОХА 1928–1953" subtitle="Пятилетки, коллективизация, Большой террор" />
          {/* Tabs */}
          <div className="flex flex-wrap gap-2 mb-6">
            {stalinTabs.map((tab) => (
              <motion.button key={tab.id} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={() => setActiveStalinTab(tab.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  activeStalinTab === tab.id
                    ? 'bg-amber-600 text-amber-950 shadow-lg shadow-amber-900/30'
                    : 'bg-[#120d04] text-amber-400 border border-amber-800/30 hover:border-amber-600/50'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </motion.button>
            ))}
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStalinTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="grid sm:grid-cols-2 gap-4"
            >
              {stalinTabs.find(t => t.id === activeStalinTab)?.content.map((item, i) => (
                <motion.div key={i} whileHover={{ y: -3, borderColor: 'rgba(245,158,11,0.5)' }}
                  className="bg-[#120d04] rounded-xl border border-amber-800/30 p-4">
                  <p className="text-amber-100 text-sm font-semibold mb-1">{item.title}</p>
                  <p className="text-amber-200/60 text-xs leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>
          {/* Industrial Growth Chart */}
          <div className="mt-8">
            <IndustrialGrowthSVG />
          </div>
        </motion.section>

        {/* ── SECTION 6: WORLD WAR II 1941-1945 ── */}
        <motion.section variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true }} className="mb-14">
          <SectionHeader icon={<Swords className="w-5 h-5" />} title="ВЕЛИКАЯ ОТЕЧЕСТВЕННАЯ ВОЙНА 1941–1945" subtitle="1418 дней и ночей. Цена победы — 27 млн жизней." />
          <div className="bg-[#120d04] rounded-xl border border-amber-800/40 p-6">
            <WarBattlesSVG />
            {/* Battles timeline */}
            <div className="mt-6 space-y-3">
              {wwiiBattles.map((b, i) => (
                <motion.div key={i} whileHover={{ x: 4, scale: 1.01 }} initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} viewport={{ once: true }}
                  className="flex items-start gap-3 bg-[#0d0a04] rounded-lg border border-amber-800/20 p-3">
                  <span className="text-xl">{b.icon}</span>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                      <span className="text-amber-500 font-mono text-xs">{b.year}</span>
                      <span className="text-amber-100 text-sm font-bold">{b.battle}</span>
                    </div>
                    <p className="text-amber-300/50 text-xs font-mono">{b.date}</p>
                    <p className="text-amber-200/70 text-xs mt-1">{b.result}</p>
                  </div>
                </motion.div>
              ))}
            </div>
            {/* Casualties */}
            <div className="mt-6 grid grid-cols-3 gap-3">
              {[
                { label: 'Потери СССР', value: '~27 млн', color: 'text-red-400' },
                { label: 'Потери Германии', value: '~8 млн', color: 'text-amber-400' },
                { label: 'Длительность', value: '1418 дней', color: 'text-amber-300' },
              ].map((s, i) => (
                <motion.div key={i} whileHover={{ y: -3 }} className="bg-amber-950/30 border border-amber-800/20 rounded-lg p-3 text-center">
                  <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-amber-400/50 text-xs mt-1">{s.label}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ── SECTION 7: COLD WAR ── */}
        <motion.section variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true }} className="mb-14">
          <SectionHeader icon={<GlobeIcon className="w-5 h-5" />} title="ХОЛОДНАЯ ВОЙНА 1945–1991" subtitle="Биполярный мир, гонка вооружений, космос" />
          <div className="bg-[#120d04] rounded-xl border border-amber-800/40 p-6">
            <ColdWarIronCurtainSVG />
            <div className="mt-6 space-y-3 max-h-[400px] overflow-y-auto pr-2" style={{ scrollbarWidth: 'thin', scrollbarColor: '#b45309 #120d04' }}>
              {coldWarEvents.map((evt, i) => (
                <motion.div key={i} whileHover={{ x: 3 }} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
                  transition={{ delay: i * 0.05 }} viewport={{ once: true }}
                  className="flex items-start gap-3 py-2 border-b border-amber-900/20 last:border-0">
                  <span className="text-amber-500 font-mono text-sm font-bold min-w-[40px]">{evt.year}</span>
                  <div>
                    <p className="text-amber-100 text-sm font-semibold">{evt.title}</p>
                    <p className="text-amber-200/60 text-xs leading-relaxed">{evt.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ── SECTION 8: USSR COLLAPSE ── */}
        <motion.section variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true }} className="mb-14">
          <SectionHeader icon={<MapPin className="w-5 h-5" />} title="РАСПАД СССР 1985–1991" subtitle="Перестройка, гласность, конец эпохи" />
          <div className="space-y-4">
            {ussrCollapseEvents.map((evt, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                whileHover={{ x: 6 }}
                className="bg-[#120d04] rounded-xl border border-amber-800/30 p-4 relative overflow-hidden"
              >
                {/* Connecting line */}
                {i < ussrCollapseEvents.length - 1 && (
                  <div className="absolute left-6 bottom-0 w-px h-full bg-amber-700/20 translate-y-full" />
                )}
                <div className="flex items-start gap-4">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
                    className="w-12 h-12 rounded-full bg-amber-950 border border-amber-700/40 flex items-center justify-center shrink-0"
                  >
                    <span className="text-amber-400 font-mono text-xs font-bold">{evt.year}</span>
                  </motion.div>
                  <div className="flex-1">
                    <p className="text-amber-100 font-semibold mb-1">{evt.title}</p>
                    <p className="text-amber-200/60 text-sm leading-relaxed">{evt.desc}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
          {/* Summary card */}
          <motion.div whileHover={{ y: -3 }} className="mt-6 bg-gradient-to-r from-amber-950/40 to-red-950/30 rounded-xl border border-amber-700/30 p-6 text-center">
            <p className="text-amber-200/80 text-sm mb-2">
              <span className="text-amber-400 font-bold">8 декабря 1991</span> — Беловежские соглашения.
              Прекращение существования СССР как субъекта международного права.
            </p>
            <p className="text-amber-400/50 text-xs">
              На смену пришло Содружество Независимых Государств (СНГ).
            </p>
          </motion.div>
        </motion.section>

        {/* ── KEY DATES REFERENCE ── */}
        <motion.section variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true }} className="mb-14">
          <SectionHeader icon={<Scroll className="w-5 h-5" />} title="КЛЮЧЕВЫЕ ДАТЫ ДЛЯ ВПР" subtitle="Запомни эти даты — они встречаются чаще всего" />
          <div className="bg-[#120d04] rounded-xl border border-amber-800/40 p-6">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { date: '1905', event: 'Революция, Манифест 17 октября' },
                { date: '1914–1918', event: 'Первая мировая война' },
                { date: 'февраль 1917', event: 'Февральская революция' },
                { date: 'октябрь 1917', event: 'Октябрьская революция' },
                { date: '1918–1922', event: 'Гражданская война' },
                { date: '30.12.1922', event: 'Образование СССР' },
                { date: '1922–1928', event: 'НЭП' },
                { date: '1928', event: 'Начало 1-й пятилетки' },
                { date: '1929', event: 'Начало коллективизации' },
                { date: '22.06.1941', event: 'Начало ВОВ' },
                { date: '1942–1943', event: 'Сталинградская битва' },
                { date: '09.05.1945', event: 'День Победы' },
                { date: '1953', event: 'Смерть Сталина' },
                { date: '1956', event: 'Доклад Хрущёва о культе личности' },
                { date: '12.04.1961', event: 'Полет Ю. Гагарина' },
                { date: '1962', event: 'Карибский кризис' },
                { date: '1985', event: 'Начало перестройки' },
                { date: '26.04.1986', event: 'Авария на ЧАЭС' },
                { date: '08.12.1991', event: 'Распад СССР (Беловежье)' },
              ].map((item, i) => (
                <motion.div key={i} whileHover={{ scale: 1.03, borderColor: 'rgba(245,158,11,0.5)' }}
                  className="bg-[#0d0a04] rounded-lg border border-amber-800/20 p-2.5 flex items-start gap-2">
                  <MousePointerClick className="w-3 h-3 text-amber-600 mt-1 shrink-0" />
                  <div>
                    <span className="text-amber-400 font-mono text-xs font-bold">{item.date}</span>
                    <p className="text-amber-200/70 text-xs">{item.event}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ── FOOTER ── */}
        <motion.footer initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
          className="text-center py-8 border-t border-amber-900/20">
          <p className="text-amber-600/50 text-xs mb-3">
            Механики Истории • VPR Exam Protocol • 7 класс
          </p>
          <motion.div whileHover={{ x: -4 }}>
            <Link href="/vpr-tests" className="inline-flex items-center gap-2 text-amber-500 hover:text-amber-400 text-sm transition-colors">
              <ChevronDown className="w-4 h-4 rotate-90" />
              Назад к списку тестов ВПР
            </Link>
          </motion.div>
        </motion.footer>
      </main>
    </div>
  );
}

/* ───────────── HELPER COMPONENTS ───────────── */

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <motion.div whileHover={{ scale: 1.1, rotate: 5 }}
        className="w-10 h-10 rounded-lg bg-amber-900/40 border border-amber-700/40 flex items-center justify-center text-amber-400">
        {icon}
      </motion.div>
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-amber-100 tracking-tight">{title}</h2>
        <p className="text-amber-400/50 text-xs sm:text-sm">{subtitle}</p>
      </div>
    </div>
  );
}

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  );
}
