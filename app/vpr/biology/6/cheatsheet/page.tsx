"use client";

import React from 'react';
import { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { VibeContentRenderer } from "@/components/VibeContentRenderer"; // Added import

// --- Tooltip Descriptions (Kept the original Russian text) ---
const tooltipDescriptions: Record<string, string> = {
  'bio-cell-*.png': "Иллюстрация: Строение растительной клетки. Основные органоиды: клеточная стенка (из целлюлозы, придает форму), плазматическая мембрана (контролирует транспорт веществ), ядро (содержит ДНК, управляет клеткой), цитоплазма (внутренняя среда), хлоропласты (место фотосинтеза, содержат хлорофилл), вакуоль (большая, с клеточным соком, запас воды и веществ), митохондрии (энергетические станции). Животная клетка отличается отсутствием клеточной стенки, хлоропластов и крупной центральной вакуоли.",
  'bio-photosynthesis-*.png': "Схема: Фотосинтез. Условия: свет, вода (H₂O), углекислый газ (CO₂). Место: хлоропласты в листьях (содержат зеленый пигмент хлорофилл). Продукты: глюкоза (C₆H₁₂O₆ - органическое вещество, пища для растения) и кислород (O₂ - выделяется в атмосферу как побочный продукт). Формула: 6CO₂ + 6H₂O + Свет → C₆H₁₂O₆ + 6O₂.",
  'bio-plant-organs-*.png': "Иллюстрация: Вегетативные и генеративные органы цветкового растения. Вегетативные (питание, рост): корень (поглощение воды и минералов, закрепление), стебель (опора, транспорт веществ), лист (фотосинтез, газообмен через устьица, испарение воды - транспирация). Генеративные (размножение): цветок (привлекает опылителей, образует плод и семена), плод (защищает семена, способствует распространению), семя (содержит зародыш и запас питательных веществ).",
  'bio-classification-*.png': "Схема: Царства живой природы. Бактерии (прокариоты - без ядра, одноклеточные, размножаются делением), Грибы (эукариоты - с ядром, гетеротрофы - питаются готовой органикой, есть клеточная стенка из хитина), Растения (эукариоты, автотрофы - фотосинтез, клеточная стенка из целлюлозы), Животные (эукариоты, гетеротрофы, активно передвигаются, нет клеточной стенки). Примеры: кишечная палочка, мухомор/дрожжи, ромашка/ель, заяц/инфузория.",
  'bio-food-chain-*.png': "Схема: Пищевая цепь (цепь питания) в экосистеме. Показывает передачу энергии. Звенья: Продуценты (производители - растения, создают органику), Консументы I порядка (растительноядные животные), Консументы II и последующих порядков (хищники), Редуценты (разрушители - бактерии, грибы, разлагают мертвую органику до неорганических веществ). Пример: Трава (Продуцент) → Кузнечик (Консумент I) → Лягушка (Консумент II) → Уж (Консумент III) → Бактерии (Редуценты).",
  'bio-ecosystem-*.png': "Иллюстрация: Компоненты экосистемы (на примере леса). Биотические (живые): продуценты (деревья, травы), консументы (животные - олени, волки, птицы, насекомые), редуценты (грибы, бактерии). Абиотические (неживые): свет, температура, вода, воздух, почва. Между компонентами существуют связи: пищевые, конкуренция, симбиоз и т.д. Круговорот веществ.",
  'bio-human-impact-*.png': "Коллаж: Влияние деятельности человека на природу. Положительное: создание заповедников и нац. парков, лесопосадки, очистка водоемов, защита редких видов. Отрицательное: вырубка лесов (исчезновение видов, эрозия почв), загрязнение воздуха (промышленность, транспорт), воды (сточные воды, мусор), почвы (пестициды, свалки), браконьерство, разрушение мест обитания.",
};

// --- Updated Image URLs ---
const imageUrls: Record<string, string> = {
  'bio-cell-*.png': 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/bio6/bio61.png', // This is likely portrait
  'bio-photosynthesis-*.png': 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/bio6/bio62.png', // Landscape
  'bio-plant-organs-*.png': 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/bio6/bio63.png', // This is likely portrait
  'bio-classification-*.png': 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/bio6/bio64.png', // Square-ish
  'bio-food-chain-*.png': 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/bio6/bio65.png', // Landscape
  'bio-ecosystem-*.png': 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/bio6/bio66.png', // Square-ish
  'bio-human-impact-*.png': 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/bio6/bio67.png', // Landscape
};

// --- Component ---
const VprBiologyCheatsheet6: NextPage = () => {
  const getTooltip = (keyPart: string) => {
    const key = Object.keys(tooltipDescriptions).find(k => k.includes(keyPart));
    return key ? tooltipDescriptions[key] : `Подробное описание для ${keyPart}`;
  };

  // Image Component: Container is aspect-square, Image uses object-contain
  const ImageWithTooltip = ({ src, alt, width, height, className = '', tooltipKeyPart, bgColor = 'bg-slate-100' }: {
    src: string, alt: string, width: number, height: number, className?: string, tooltipKeyPart: string, bgColor?: string
  }) => (
    <div className={`p-1.5 border border-emerald-200/80 rounded-lg ${bgColor} hover:shadow-md hover:shadow-emerald-200/70 transition-shadow duration-300 flex flex-col items-center`}>
      <Tooltip>
        <TooltipTrigger asChild>
          {/* This container enforces aspect ratio in the grid */}
          <div className={`w-full aspect-square overflow-hidden rounded ${bgColor} cursor-help border border-slate-200 flex justify-center items-center`}>
            {/* Image fits within the container, keeping its ratio */}
            <Image
              src={src}
              alt={alt}
              width={width} // Important for Next.js optimization & initial layout
              height={height}// Important for Next.js optimization & initial layout
              className={`w-auto h-auto max-w-full max-h-full object-contain ${className}`} // object-contain ensures full visibility
              loading="lazy"
              // Consider unoptimized if you still face issues with specific images and Next/Image optimization
              // unoptimized={true}
            />
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[350px] bg-emerald-50 border border-emerald-300 text-slate-700 p-3 shadow-lg z-50 rounded-md text-xs">
          <p>{getTooltip(tooltipKeyPart)}</p>
        </TooltipContent>
      </Tooltip>
      <p className="text-xs text-center text-slate-500 mt-1.5 italic px-1">{alt}</p>
    </div>
  );

  // Easter Egg Component
  const EasterEgg = () => (
      <div className="my-8 flex justify-center items-center space-x-2 text-sm text-amber-700/80 opacity-80 hover:opacity-100 transition-opacity duration-300">
          <VibeContentRenderer content="<FaBrain />" className="animate-pulse" />
          <Tooltip>
              <TooltipTrigger asChild>
                  <span className="cursor-help italic">Маленький секрет для самых упорных...</span>
              </TooltipTrigger>
              <TooltipContent side="top" className="bg-amber-100 border border-amber-300 text-amber-800 p-2 rounded-md shadow-md text-xs">
                  <p className="flex items-center">
                    <VibeContentRenderer content="<FaGrinStars />" className="mr-1.5 text-lg text-amber-600"/>
                    Ты молодец, что дошел до сюда! Продолжай в том же духе!
                  </p>
              </TooltipContent>
          </Tooltip>
      </div>
  );

  return (
    // Light Theme Background
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-emerald-50 via-sky-50 to-amber-50 text-slate-800">
      <Head>
        <title>Биология 6 класс: Подробная Шпаргалка к ВПР</title>
        <meta name="description" content="Детальная шпаргалка по биологии для 6 класса: клетки, фотосинтез, органы растений, царства живых, экосистемы, пищевые цепи, влияние человека. Готовься к ВПР эффективно!" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <TooltipProvider delayDuration={150}>
        <main className="flex-grow container mx-auto px-3 md:px-4 py-10 md:py-12">
          {/* Title */}
          <h1 className="text-2xl md:text-4xl font-bold mb-6 text-center text-emerald-700 flex items-center justify-center">
            <VibeContentRenderer content="<FaBookOpen />" className="mr-2 md:mr-3 text-emerald-600" />
            Биология 6 класс: Подробная Шпаргалка к ВПР
          </h1>
          {/* HERO-иллюстрация (task220) */}
          <div className="relative mb-6 overflow-hidden rounded-none border" style={{ borderColor: "#22c55e33" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/task220/biology-6.jpg"
              alt="Биология 6 класс — неоновая иллюстрация"
              className="w-full h-auto opacity-80"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#030712] via-transparent to-transparent" />
          </div>

          {/* Light Theme Card */}
          <Card className="max-w-7xl mx-auto bg-white/95 text-slate-800 rounded-xl border border-emerald-200/80 shadow-lg">
            <CardHeader className="text-center border-b border-emerald-200/60 pb-3 pt-4">
              <p className="text-sm md:text-base text-slate-600 mt-1 font-sans">
                Ключевые темы по биологии: структура, процессы, взаимосвязи. Все для успешной сдачи ВПР! 🔬🌿🌍
              </p>
            </CardHeader>

            {/* Adjusted padding and font size for content */}
            <CardContent className="space-y-12 p-3 md:p-6 text-sm md:text-base leading-normal">
              {/* Section 1: Basics of Life */}
              <section className="space-y-5">
                <h2 className="flex items-center text-xl md:text-2xl font-semibold text-emerald-800 mb-3 border-b-2 border-emerald-300 pb-2">
                  <VibeContentRenderer content="<FaMicroscope />" className="mr-2 md:mr-3 text-emerald-600/90 fa-fw" /> Основы Жизни: Клетки и Процессы
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
                   {/* Cell Structure */}
                   <div className="border-l-4 border-emerald-500 pl-3 md:pl-4">
                    <h3 className="flex items-center text-lg md:text-xl font-semibold text-emerald-700 mb-2">
                      <VibeContentRenderer content="<FaQuestionCircle />" className="mr-2 text-emerald-600/80 fa-fw" /> Строение Клетки
                    </h3>
                    <p className="text-slate-700 mb-3 text-sm leading-relaxed">
                      Клетка – наименьшая живая система. <strong className="font-semibold">Растительная:</strong> есть <strong className="font-semibold">клеточная стенка</strong> (форма), <strong className="font-semibold">мембрана</strong> (контроль), <strong className="font-semibold">ядро</strong> (ДНК, управление), <strong className="font-semibold">цитоплазма</strong>, <strong className="font-semibold">хлоропласты</strong> (фотосинтез, зеленые), <strong className="font-semibold">вакуоль</strong> (большая, с соком), <strong className="font-semibold">митохондрии</strong> (энергия). <strong className="font-semibold">Животная:</strong> нет стенки, хлоропластов, крупной вакуоли.
                    </p>
                    <ImageWithTooltip
                      src={imageUrls['bio-cell-*.png']}
                      alt="Детали строения растительной клетки"
                      width={500} height={889} // Approximate 9:16 ratio if known
                      tooltipKeyPart="bio-cell-*.png"
                    />
                  </div>
                  {/* Photosynthesis */}
                   <div className="border-l-4 border-emerald-500 pl-3 md:pl-4">
                    <h3 className="flex items-center text-lg md:text-xl font-semibold text-emerald-700 mb-2">
                      <VibeContentRenderer content="<FaSun />" className="mr-2 text-yellow-500 fa-fw" /> Фотосинтез: Рецепт Растений
                    </h3>
                    <p className="text-slate-700 mb-3 text-sm leading-relaxed">
                      Процесс создания <strong className="font-semibold">органических веществ</strong> (глюкозы) из <strong className="font-semibold">неорганических</strong> (CO₂ и H₂O) с использованием энергии <strong className="font-semibold">света</strong>. Происходит в <strong className="font-semibold">хлоропластах</strong> (содержат <strong className="font-semibold">хлорофилл</strong>). Побочный продукт – <strong className="font-semibold">кислород (O₂)</strong>. Формула: 6CO₂ + 6H₂O + Свет → C₆H₁₂O₆ + 6O₂. Основа питания на Земле.
                    </p>
                    <ImageWithTooltip
                      src={imageUrls['bio-photosynthesis-*.png']}
                      alt="Схема процесса фотосинтеза"
                      width={600} height={338} // Landscape
                      tooltipKeyPart="bio-photosynthesis-*.png"
                    />
                  </div>
                  {/* Classification */}
                   <div className="border-l-4 border-emerald-500 pl-3 md:pl-4">
                    <h3 className="flex items-center text-lg md:text-xl font-semibold text-emerald-700 mb-2">
                      <VibeContentRenderer content="<FaGlobe />" className="mr-2 text-sky-600 fa-fw" /> Царства Живой Природы
                    </h3>
                    <p className="text-slate-700 mb-3 text-sm leading-relaxed">
                      Основные группы (царства): <strong className="font-semibold">Бактерии</strong> (прокариоты, без ядра), <strong className="font-semibold">Грибы</strong> (эукариоты, гетеротрофы, хитин), <strong className="font-semibold">Растения</strong> (эукариоты, автотрофы/фотосинтез, целлюлоза), <strong className="font-semibold">Животные</strong> (эукариоты, гетеротрофы, подвижные). Важно знать их ключевые отличия.
                    </p>
                    <ImageWithTooltip
                      src={imageUrls['bio-classification-*.png']}
                      alt="Основные царства живых организмов"
                      width={500} height={500} // Square-ish
                      tooltipKeyPart="bio-classification-*.png"
                    />
                  </div>
                </div>
              </section>

              {/* Section 2: Plants */}
              <section className="space-y-5 border-t-2 border-lime-300/80 pt-6">
                <h2 className="flex items-center text-xl md:text-2xl font-semibold text-lime-800 mb-3 border-b-2 border-lime-300 pb-2">
                  <VibeContentRenderer content="<FaLeaf />" className="mr-2 md:mr-3 text-lime-600/90 fa-fw" /> Мир Растений: Строение и Жизнь
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
                   {/* Plant Organs */}
                   <div className="border-l-4 border-lime-500 pl-3 md:pl-4">
                    <h3 className="flex items-center text-lg md:text-xl font-semibold text-lime-700 mb-2">
                      <VibeContentRenderer content="<FaSeedling />" className="mr-2 text-lime-600/80 fa-fw" /> Органы Растений
                    </h3>
                    <ul className="space-y-1 text-slate-700 pl-1 text-sm leading-relaxed">
                      <li><strong className="font-semibold">Вегетативные</strong> (рост, питание):</li>
                      <li className="ml-4">- <strong className="font-semibold">Корень:</strong> Всасывание H₂O и мин. солей, якорь, запас веществ.</li>
                      <li className="ml-4">- <strong className="font-semibold">Стебель:</strong> Опора, транспорт (по сосудам и ситовидным трубкам), запас.</li>
                      <li className="ml-4">- <strong className="font-semibold">Лист:</strong> Фотосинтез, газообмен (через <strong className="font-semibold">устьица</strong>), испарение (<strong className="font-semibold">транспирация</strong>).</li>
                      <li><strong className="font-semibold">Генеративные</strong> (размножение):</li>
                      <li className="ml-4">- <strong className="font-semibold">Цветок:</strong> Образование <strong className="font-semibold">плода</strong> и <strong className="font-semibold">семян</strong> после <strong className="font-semibold">опыления</strong> и <strong className="font-semibold">оплодотворения</strong>.</li>
                      <li className="ml-4">- <strong className="font-semibold">Плод:</strong> Защита и распространение семян.</li>
                      <li className="ml-4">- <strong className="font-semibold">Семя:</strong> Содержит <strong className="font-semibold">зародыш</strong> и запас пит. веществ.</li>
                    </ul>
                    <ImageWithTooltip
                      src={imageUrls['bio-plant-organs-*.png']}
                      alt="Вегетативные и генеративные органы"
                      width={500} height={889} // Approximate 9:16 ratio
                      tooltipKeyPart="bio-plant-organs-*.png"
                      className="mt-3"
                    />
                  </div>
                  {/* Life Processes */}
                   <div className="border-l-4 border-lime-500 pl-3 md:pl-4">
                    <h3 className="flex items-center text-lg md:text-xl font-semibold text-lime-700 mb-2">
                      <VibeContentRenderer content="<FaFlask />" className="mr-2 text-lime-600/80 fa-fw" /> Жизнедеятельность Растений
                    </h3>
                    <ul className="space-y-1 text-slate-700 pl-1 text-sm leading-relaxed">
                       <li><strong className="font-semibold">Питание:</strong> <strong className="font-semibold">Фотосинтез</strong> (воздушное питание - CO₂) + <strong className="font-semibold">Минеральное</strong> (корневое - H₂O и соли).</li>
                      <li><strong className="font-semibold">Дыхание:</strong> Поглощают O₂, выделяют CO₂ (круглосуточно!). Энергия для жизни.</li>
                      <li><strong className="font-semibold">Транспорт веществ:</strong> Вода и соли – вверх по <strong className="font-semibold">сосудам</strong> (древесина). Органические в-ва – вниз по <strong className="font-semibold">ситовидным трубкам</strong> (луб).</li>
                      <li><strong className="font-semibold">Рост:</strong> Увеличение размеров за счет деления и роста клеток (особенно в <strong className="font-semibold">верхушках</strong> корня и побега).</li>
                      <li><strong className="font-semibold">Размножение:</strong> <strong className="font-semibold">Семенное</strong> (цветы, плоды, семена) и <strong className="font-semibold">Вегетативное</strong> (частями тела - черенками, усами и т.д.).</li>
                      <li><strong className="font-semibold">Движение:</strong> Ростовые движения (к свету, к опоре), движения листьев/устьиц.</li>
                    </ul>
                     <div className="mt-4 p-3 bg-lime-50 rounded-lg border border-lime-200 text-center text-lime-700 text-xs">
                       <VibeContentRenderer content='<FaLeaf size="24" />' className="mx-auto mb-1" />
                       Растения постоянно активны, хотя мы этого часто не замечаем!
                     </div>
                  </div>
                </div>
              </section>

               {/* <<< EASTER EGG PLACEMENT >>> */}
               <EasterEgg />

              {/* Section 3: Ecosystems */}
              <section className="space-y-5 border-t-2 border-teal-300/80 pt-6">
                <h2 className="flex items-center text-xl md:text-2xl font-semibold text-teal-800 mb-3 border-b-2 border-teal-300 pb-2">
                  <VibeContentRenderer content="<FaTree />" className="mr-2 md:mr-3 text-teal-600/90 fa-fw" /> Экосистемы и Взаимосвязи
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
                  {/* Food Chains */}
                   <div className="border-l-4 border-teal-500 pl-3 md:pl-4">
                    <h3 className="flex items-center text-lg md:text-xl font-semibold text-teal-700 mb-2">
                      <VibeContentRenderer content="<FaPaw />" className="mr-2 text-orange-600 fa-fw" /> Пищевые Цепи и Сети
                    </h3>
                    <p className="text-slate-700 mb-3 text-sm leading-relaxed">
                      Показывают передачу <strong className="font-semibold">энергии</strong> и веществ. Звенья: <strong className="font-semibold">Продуценты</strong> (растения - создают органику), <strong className="font-semibold">Консументы</strong> (потребители: I порядка – травоядные, II, III... – хищники), <strong className="font-semibold">Редуценты</strong> (грибы, бактерии - разлагают мертвые остатки до неорганики). В природе цепи переплетаются в <strong className="font-semibold">пищевые сети</strong>.
                    </p>
                    <ImageWithTooltip
                      src={imageUrls['bio-food-chain-*.png']}
                      alt="Пищевая цепь: продуценты, консументы, редуценты"
                      width={600} height={338} // Landscape
                      tooltipKeyPart="bio-food-chain-*.png"
                    />
                  </div>
                  {/* Ecosystems */}
                   <div className="border-l-4 border-teal-500 pl-3 md:pl-4">
                    <h3 className="flex items-center text-lg md:text-xl font-semibold text-teal-700 mb-2">
                      <VibeContentRenderer content="<FaFish />" className="mr-2 text-blue-600 fa-fw" /> Экосистемы: Живое + Неживое
                    </h3>
                    <p className="text-slate-700 mb-3 text-sm leading-relaxed">
                      Сообщество живых организмов (<strong className="font-semibold">биоценоз</strong>) и среды их обитания (<strong className="font-semibold">биотоп</strong>), связанные <strong className="font-semibold">круговоротом веществ</strong> и потоком энергии. Компоненты: <strong className="font-semibold">биотические</strong> (продуценты, консументы, редуценты) и <strong className="font-semibold">абиотические</strong> (свет, t°, вода, воздух, почва). Примеры: лес, луг, болото, пруд.
                    </p>
                    <ImageWithTooltip
                      src={imageUrls['bio-ecosystem-*.png']}
                      alt="Компоненты лесной экосистемы"
                      width={500} height={500} // Square-ish
                      tooltipKeyPart="bio-ecosystem-*.png"
                    />
                  </div>
                  {/* Human Impact */}
                   <div className="border-l-4 border-teal-500 pl-3 md:pl-4">
                    <h3 className="flex items-center text-lg md:text-xl font-semibold text-teal-700 mb-2">
                      <VibeContentRenderer content="<FaBalanceScale />" className="mr-2 text-gray-600 fa-fw" /> Человек и Природа
                    </h3>
                    <p className="text-slate-700 mb-3 text-sm leading-relaxed">
                       Деятельность человека сильно влияет на экосистемы. <strong className="font-semibold">Отрицательное влияние:</strong> загрязнение (воздуха, воды, почвы), вырубка лесов, осушение болот, браконьерство, разрушение озонового слоя. <strong className="font-semibold">Положительное:</strong> заповедники, нац. парки, лесовосстановление, очистные сооружения, Красная книга. Важен <strong className="font-semibold">баланс</strong>.
                    </p>
                    <ImageWithTooltip
                      src={imageUrls['bio-human-impact-*.png']}
                      alt="Положительное и отрицательное влияние человека"
                      width={600} height={338} // Landscape
                      tooltipKeyPart="bio-human-impact-*.png"
                    />
                  </div>
                </div>
              </section>

              {/* Final Tip */}
              <section className="border-t-2 border-emerald-200/80 pt-6 mt-10 text-center">
                <h2 className="flex items-center justify-center text-xl md:text-2xl font-semibold text-emerald-700 mb-3">
                  <VibeContentRenderer content="<FaBookOpen />" className="mr-2 md:mr-3 text-emerald-600/90 fa-fw" /> Советы для Подготовки
                </h2>
                <p className="text-slate-700 text-sm md:text-base leading-relaxed max-w-4xl mx-auto">
                  Эта шпаргалка - твой конспект! Чтобы закрепить знания: <strong>1)</strong> Решай <strong className="font-semibold text-emerald-700">демоверсии</strong> и <strong className="font-semibold text-emerald-700">задания ВПР</strong> прошлых лет. <strong>2)</strong> Внимательно <strong className="font-semibold">читай вопросы</strong>, обращай внимание на рисунки и схемы. <strong>3)</strong> <strong className="font-semibold">Повторяй термины</strong> (органоиды, продуценты, фотосинтез и т.д.). <strong>4)</strong> Старайся <strong className="font-semibold">объяснить</strong> каждый процесс своими словами.
                  <br /><br />
                  Наблюдай за природой, и биология станет еще понятнее! Удачи на ВПР! ✨
                </p>
                <div className="mt-8">
                  <Link href="/vpr-tests" legacyBehavior>
                    <a className="inline-block bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold py-2.5 px-5 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5 text-sm md:text-base">
                      <VibeContentRenderer content="<FaRecycle />" className="inline mr-1.5" /> К другим тестам и шпаргалкам ВПР
                    </a>
                  </Link>
                </div>
              </section>
            </CardContent>
          </Card>
        </main>
      </TooltipProvider>
    </div>
  );
};

export default VprBiologyCheatsheet6;