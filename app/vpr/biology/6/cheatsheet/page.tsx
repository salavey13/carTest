"use client";

import React from 'react';
import { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  FaLeaf, FaDna, FaMicroscope, FaTree, FaPaw, FaBug,
  FaSeedling, FaAppleAlt, FaWater, FaSun, FaFish,
  FaBookOpen, FaFlask, FaGlobe, FaBacteria, FaQuestionCircle
} from "react-icons/fa"; // Using Fa (FontAwesome 5) instead of Fa6 for broader icon availability if needed, adjust if Fa6 is strictly required and available

// --- Tooltip Descriptions (Kept the original Russian text) ---
const tooltipDescriptions: Record<string, string> = {
  'bio-cell-*.png': "Иллюстрация: Строение растительной клетки под микроскопом. Основные части: клеточная стенка (жесткая, из целлюлозы), мембрана (регулирует обмен веществ), ядро (хранит ДНК), цитоплазма (место реакций), хлоропласты (фотосинтез), вакуоль (хранит вещества). Животная клетка не имеет стенки и хлоропластов.",
  'bio-photosynthesis-*.png': "Схема: Процесс фотосинтеза. Лист поглощает солнечный свет (хлорофилл в хлоропластах), углекислый газ (CO₂) через устьица и воду (H₂O) из почвы. Результат: глюкоза (C₆H₁₂O₆) для питания растения и кислород (O₂) в атмосферу.",
  'bio-plant-organs-*.png': "Иллюстрация: Части цветкового растения. Корень (впитывает воду и минералы), стебель (поддержка и транспорт), лист (фотосинтез), цветок (размножение), плод (защита семян), семя (будущее растение). Показано срезанное растение с подписями.",
  'bio-classification-*.png': "Схема: Основные группы живых организмов. Бактерии (одноклеточные, без ядра), Грибы (питаются готовой органикой), Растения (фотосинтез), Животные (подвижные, питаются другими организмами). Примеры: кишечная палочка, мухомор, пшеница, волк.",
  'bio-food-chain-*.png': "Схема: Пищевая цепь в лесу. Пример: трава (продуцент) → заяц (потребитель 1-го порядка) → лиса (потребитель 2-го порядка) → бактерии/грибы (разрушители). Стрелки показывают поток энергии.",
  'bio-ecosystem-*.png': "Иллюстрация: Экосистема смешанного леса. Деревья, кустарники, травы, животные (олени, птицы, насекомые), грибы, бактерии. Показаны связи: растения дают кислород и пищу, животные питаются, грибы разлагают отходы.",
  'bio-human-impact-*.png': "Коллаж: Влияние человека на природу. Положительное (посадка деревьев, заповедники) и отрицательное (вырубка лесов, загрязнение рек, свалки). Подписи объясняют последствия для экосистем.",
};

// --- Updated Image URLs ---
const imageUrls: Record<string, string> = {
  'bio-cell-*.png': 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/bio6/bio61.png',
  'bio-photosynthesis-*.png': 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/bio6/bio62.png',
  'bio-plant-organs-*.png': 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/bio6/bio63.png',
  'bio-classification-*.png': 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/bio6/bio64.png',
  'bio-food-chain-*.png': 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/bio6/bio65.png',
  'bio-ecosystem-*.png': 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/bio6/bio66.png',
  'bio-human-impact-*.png': 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/bio6/bio67.png',
};

// --- Component ---
const VprBiologyCheatsheet6: NextPage = () => {
  // Helper function to get tooltip text
  const getTooltip = (keyPart: string) => {
    const key = Object.keys(tooltipDescriptions).find(k => k.includes(keyPart));
    return key ? tooltipDescriptions[key] : `Подробное описание для ${keyPart}`;
  };

  // Helper component for images with tooltips - adjusted for light theme
  const ImageWithTooltip = ({ src, alt, width, height, className = '', tooltipKeyPart, aspect = 'video', bgColor = 'bg-slate-100' }: {
    src: string, alt: string, width: number, height: number, className?: string, tooltipKeyPart: string, aspect?: 'video' | 'square' | 'auto', bgColor?: string
  }) => (
    <div className={`p-2 border border-emerald-200/80 rounded-lg ${bgColor} hover:shadow-md hover:shadow-emerald-200/70 transition-shadow duration-300`}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`${aspect === 'video' ? 'aspect-video' : aspect === 'square' ? 'aspect-square' : ''} w-full h-auto overflow-hidden rounded ${bgColor} cursor-help border border-slate-200`}>
            <Image
              src={src} // Direct URL now
              alt={alt}
              width={width}
              height={height}
              className={`w-full h-full object-cover ${className}`}
              loading="lazy"
            />
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[300px] bg-emerald-50 border border-emerald-300 text-slate-700 p-3 shadow-lg z-50 rounded-md">
          <p className="text-sm">{getTooltip(tooltipKeyPart)}</p>
        </TooltipContent>
      </Tooltip>
      <p className="text-xs text-center text-slate-500 mt-1 italic">{alt}</p> {/* Simplified alt text display */}
    </div>
  );

  return (
    // Light Theme Background
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-emerald-50 via-sky-50 to-amber-50 text-slate-800">
      <Head>
        <title>Биология 6 класс: Шпаргалка-Помощник к ВПР!</title>
        <meta name="description" content="Увлекательная шпаргалка по биологии для 6 класса: клетки, фотосинтез, растения, экосистемы и многое другое. Готовься к ВПР с интересом!" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <TooltipProvider delayDuration={150}>
        <main className="flex-grow container mx-auto px-4 py-12 md:py-16">
          {/* Engaging Title */}
          <h1 className="text-3xl md:text-5xl font-bold mb-8 text-center text-emerald-700 flex items-center justify-center">
            <FaBookOpen className="mr-3 text-emerald-600" />
            Биология 6 класс: Шпаргалка-Помощник к ВПР!
          </h1>

          {/* Light Theme Card */}
          <Card className="max-w-6xl mx-auto bg-white/95 text-slate-800 rounded-2xl border border-emerald-200/80 shadow-lg">
            <CardHeader className="text-center border-b border-emerald-200/60 pb-4 pt-6">
              {/* Friendly Introduction */}
              <p className="text-md md:text-lg text-slate-600 mt-2 font-sans">
                Самое важное о клетках, растениях и природе – просто и понятно! 🌳✨ Готовься легко!
              </p>
            </CardHeader>

            <CardContent className="space-y-16 p-4 md:p-8">
              {/* Section 1: Basics of Life - Adjusted Colors and Titles */}
              <section className="space-y-6">
                <h2 className="flex items-center text-2xl md:text-3xl font-semibold text-emerald-800 mb-4 border-b-2 border-emerald-300 pb-3">
                  <FaMicroscope className="mr-3 text-emerald-600/90 fa-fw" /> Заглянем в Микромир: Клетки и Их Секреты
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {/* Subsection: Cell Structure */}
                  <div className="border-l-4 border-emerald-500 pl-4">
                    <h3 className="flex items-center text-xl font-semibold text-emerald-700 mb-3">
                      <FaQuestionCircle className="mr-2 text-emerald-600/80 fa-fw" /> Клетка: Маленький Город Жизни?
                    </h3>
                    <p className="text-slate-700 text-base md:text-lg mb-4 leading-relaxed">
                      Всё живое состоит из клеток! У растений есть крепкая стенка и "фабрики" света (хлоропласты). У животных их нет. Узнай, из чего состоит клетка!
                    </p>
                    <ImageWithTooltip
                      src={imageUrls['bio-cell-*.png']}
                      alt="Строение растительной клетки"
                      width={400}
                      height={400}
                      tooltipKeyPart="bio-cell-*.png"
                      aspect="square"
                    />
                  </div>
                  {/* Subsection: Photosynthesis */}
                  <div className="border-l-4 border-emerald-500 pl-4">
                    <h3 className="flex items-center text-xl font-semibold text-emerald-700 mb-3">
                      <FaSun className="mr-2 text-yellow-500 fa-fw" /> Фотосинтез: Как Растения Готовят Обед?
                    </h3>
                    <p className="text-slate-700 text-base md:text-lg mb-4 leading-relaxed">
                      Растения — настоящие повара! Используя свет, воду и воздух (CO₂), они создают себе еду (глюкозу) и дарят нам кислород. Супер-процесс! ☀️💧
                    </p>
                    <ImageWithTooltip
                      src={imageUrls['bio-photosynthesis-*.png']}
                      alt="Схема фотосинтеза"
                      width={600}
                      height={338}
                      tooltipKeyPart="bio-photosynthesis-*.png"
                      aspect="video"
                    />
                  </div>
                  {/* Subsection: Classification */}
                  <div className="border-l-4 border-emerald-500 pl-4">
                    <h3 className="flex items-center text-xl font-semibold text-emerald-700 mb-3">
                      <FaGlobe className="mr-2 text-sky-600 fa-fw" /> Кто Есть Кто в Мире Живых?
                    </h3>
                    <p className="text-slate-700 text-base md:text-lg mb-4 leading-relaxed">
                      Всё живое делят на группы: крошечные Бактерии <FaBacteria className="inline text-xs text-gray-500" />, загадочные Грибы 🍄, зелёные Растения 🌱 и подвижные Животные 🐾. Узнай их отличия!
                    </p>
                    <ImageWithTooltip
                      src={imageUrls['bio-classification-*.png']}
                      alt="Классификация организмов"
                      width={400}
                      height={400}
                      tooltipKeyPart="bio-classification-*.png"
                      aspect="square"
                    />
                  </div>
                </div>
              </section>

              {/* Section 2: Plants - Adjusted Colors and Titles */}
              <section className="space-y-6 border-t-2 border-lime-300/80 pt-8">
                <h2 className="flex items-center text-2xl md:text-3xl font-semibold text-lime-800 mb-4 border-b-2 border-lime-300 pb-3">
                  <FaLeaf className="mr-3 text-lime-600/90 fa-fw" /> Зелёные Фабрики: Всё о Растениях
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Subsection: Plant Organs */}
                  <div className="border-l-4 border-lime-500 pl-4">
                    <h3 className="flex items-center text-xl font-semibold text-lime-700 mb-3">
                      <FaSeedling className="mr-2 text-lime-600/80 fa-fw" /> Части Растения: От Корня до Цветка
                    </h3>
                    <ul className="list-disc list-inside space-y-1.5 text-slate-700 pl-4 text-base md:text-lg mb-4 leading-relaxed">
                      <li><strong>Корень:</strong> Пьёт воду, держит крепко.</li>
                      <li><strong>Стебель:</strong> Опора и "лифт" для воды/еды.</li>
                      <li><strong>Лист:</strong> Готовит еду (фотосинтез), дышит.</li>
                      <li><strong>Цветок:</strong> Для красоты и новых растений! 🌸</li>
                      <li><strong>Плод и семя:</strong> Защищают и помогают малышам-семенам путешествовать.</li>
                    </ul>
                    <ImageWithTooltip
                      src={imageUrls['bio-plant-organs-*.png']}
                      alt="Органы цветкового растения"
                      width={600}
                      height={338}
                      tooltipKeyPart="bio-plant-organs-*.png"
                      aspect="video"
                    />
                  </div>
                  {/* Subsection: Life Processes */}
                  <div className="border-l-4 border-lime-500 pl-4">
                    <h3 className="flex items-center text-xl font-semibold text-lime-700 mb-3">
                      <FaFlask className="mr-2 text-lime-600/80 fa-fw" /> Как Живут Растения?
                    </h3>
                    <ul className="list-disc list-inside space-y-1.5 text-slate-700 pl-4 text-base md:text-lg mb-4 leading-relaxed">
                      <li><strong>Фотосинтез:</strong> Делают еду на свету.</li>
                      <li><strong>Дыхание:</strong> Вдыхают кислород (да, они тоже дышат!).</li>
                      <li><strong>Рост:</strong> Становятся больше и сильнее.</li>
                      <li><strong>Размножение:</strong> Создают новые семена.</li>
                      <li><strong>Движение:</strong> Тянутся к солнышку! ☀️</li>
                    </ul>
                    {/* Optional: Add a simple relevant icon or placeholder if no specific image */}
                    <div className="mt-4 p-4 bg-lime-50 rounded-lg border border-lime-200 text-center text-lime-700">
                      <FaLeaf size={40} className="mx-auto mb-2" />
                      <p className="text-sm">Растения постоянно заняты важными делами!</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 3: Ecosystems - Adjusted Colors and Titles */}
              <section className="space-y-6 border-t-2 border-teal-300/80 pt-8">
                <h2 className="flex items-center text-2xl md:text-3xl font-semibold text-teal-800 mb-4 border-b-2 border-teal-300 pb-3">
                  <FaTree className="mr-3 text-teal-600/90 fa-fw" /> Кто с Кем Дружит: Экосистемы
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {/* Subsection: Food Chains */}
                  <div className="border-l-4 border-teal-500 pl-4">
                    <h3 className="flex items-center text-xl font-semibold text-teal-700 mb-3">
                      <FaPaw className="mr-2 text-orange-600 fa-fw" /> Пищевые Цепочки: Кто Кого Съел?
                    </h3>
                    <p className="text-slate-700 text-base md:text-lg mb-4 leading-relaxed">
                      В природе все связаны обедом! Растение ➡️ Заяц ➡️ Лиса. Это показывает, как энергия идёт от одного к другому. Не забудь про грибы и бактерий - "уборщиков"! ♻️
                    </p>
                    <ImageWithTooltip
                      src={imageUrls['bio-food-chain-*.png']}
                      alt="Пример пищевой цепи"
                      width={600}
                      height={338}
                      tooltipKeyPart="bio-food-chain-*.png"
                      aspect="video"
                    />
                  </div>
                  {/* Subsection: Ecosystems */}
                  <div className="border-l-4 border-teal-500 pl-4">
                    <h3 className="flex items-center text-xl font-semibold text-teal-700 mb-3">
                      <FaFish className="mr-2 text-blue-600 fa-fw" /> Экосистемы: Большой Общий Дом
                    </h3>
                    <p className="text-slate-700 text-base md:text-lg mb-4 leading-relaxed">
                      Лес, озеро, луг — это экосистемы, где живые существа и природа живут вместе. Растения дают кислород, животные едят, грибы всё перерабатывают. Все важны! 🤝
                    </p>
                    <ImageWithTooltip
                      src={imageUrls['bio-ecosystem-*.png']}
                      alt="Лесная экосистема"
                      width={400}
                      height={400}
                      tooltipKeyPart="bio-ecosystem-*.png"
                      aspect="square"
                    />
                  </div>
                  {/* Subsection: Human Impact */}
                  <div className="border-l-4 border-teal-500 pl-4">
                    <h3 className="flex items-center text-xl font-semibold text-teal-700 mb-3">
                      <FaBug className="mr-2 text-red-600 fa-fw" /> Человек и Природа: Друзья или...?
                    </h3>
                    <p className="text-slate-700 text-base md:text-lg mb-4 leading-relaxed">
                      Мы можем помогать природе (сажать деревья 🌳, создавать заповедники) или вредить (мусорить 🗑️, загрязнять). Важно знать, как наши дела влияют на общий дом!
                    </p>
                    <ImageWithTooltip
                      src={imageUrls['bio-human-impact-*.png']}
                      alt="Влияние человека на природу"
                      width={600}
                      height={338}
                      tooltipKeyPart="bio-human-impact-*.png"
                      aspect="video"
                    />
                  </div>
                </div>
              </section>

              {/* Final Tip - Adjusted Colors and Tone */}
              <section className="border-t-2 border-emerald-200/80 pt-8 mt-12 text-center">
                <h2 className="flex items-center justify-center text-2xl md:text-3xl font-semibold text-emerald-700 mb-4">
                  <FaBookOpen className="mr-3 text-emerald-600/90 fa-fw" /> Главное – Понять и Запомнить!
                </h2>
                <p className="text-slate-700 text-base md:text-lg leading-relaxed max-w-3xl mx-auto">
                  Эта шпаргалка – твой помощник! Чтобы лучше подготовиться, решай <strong className="text-emerald-700 font-semibold">задания из ВПР</strong> и наблюдай за природой вокруг. Смотри на листочки 🍃, ищи насекомых 🐞, думай, как всё связано.
                  <br /><br />
                  Отвечай на вопросы смело и пользуйся картинками! У тебя всё получится! 👍
                </p>
                <div className="mt-10">
                  <Link href="/vpr-tests" legacyBehavior>
                    {/* Light Theme Button */}
                    <a className="inline-block bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold py-3 px-6 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5">
                      ← Назад к тестам ВПР
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