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
  FaBookOpen, FaFlask, FaGlobe, FaBacteria
} from "react-icons/fa6";

// --- Tooltip Descriptions and Image Prompts ---
const tooltipDescriptions: Record<string, string> = {
  'bio-cell-*.png': "Иллюстрация: Строение растительной клетки под микроскопом. Основные части: клеточная стенка (жесткая, из целлюлозы), мембрана (регулирует обмен веществ), ядро (хранит ДНК), цитоплазма (место реакций), хлоропласты (фотосинтез), вакуоль (хранит вещества). Животная клетка не имеет стенки и хлоропластов.",
  'bio-photosynthesis-*.png': "Схема: Процесс фотосинтеза. Лист поглощает солнечный свет (хлорофилл в хлоропластах), углекислый газ (CO₂) через устьица и воду (H₂O) из почвы. Результат: глюкоза (C₆H₁₂O₆) для питания растения и кислород (O₂) в атмосферу.",
  'bio-plant-organs-*.png': "Иллюстрация: Части цветкового растения. Корень (впитывает воду и минералы), стебель (поддержка и транспорт), лист (фотосинтез), цветок (размножение), плод (защита семян), семя (будущее растение). Показано срезанное растение с подписями.",
  'bio-classification-*.png': "Схема: Основные группы живых организмов. Бактерии (одноклеточные, без ядра), Грибы (питаются готовой органикой), Растения (фотосинтез), Животные (подвижные, питаются другими организмами). Примеры: кишечная палочка, мухомор, пшеница, волк.",
  'bio-food-chain-*.png': "Схема: Пищевая цепь в лесу. Пример: трава (продуцент) → заяц (потребитель 1-го порядка) → лиса (потребитель 2-го порядка) → бактерии/грибы (разрушители). Стрелки показывают поток энергии.",
  'bio-ecosystem-*.png': "Иллюстрация: Экосистема смешанного леса. Деревья, кустарники, травы, животные (олени, птицы, насекомые), грибы, бактерии. Показаны связи: растения дают кислород и пищу, животные питаются, грибы разлагают отходы.",
  'bio-human-impact-*.png': "Коллаж: Влияние человека на природу. Положительное (посадка деревьев, заповедники) и отрицательное (вырубка лесов, загрязнение рек, свалки). Подписи объясняют последствия для экосистем.",
};

// Placeholder URLs for images (to be replaced later)
const imageUrls: Record<string, string> = {
  'bio-cell-*.png': '/placeholders/bio-cell.png',
  'bio-photosynthesis-*.png': '/placeholders/bio-photosynthesis.png',
  'bio-plant-organs-*.png': '/placeholders/bio-plant-organs.png',
  'bio-classification-*.png': '/placeholders/bio-classification.png',
  'bio-food-chain-*.png': '/placeholders/bio-food-chain.png',
  'bio-ecosystem-*.png': '/placeholders/bio-ecosystem.png',
  'bio-human-impact-*.png': '/placeholders/bio-human-impact.png',
};

// Image Generation Prompts for Infographics
const imagePrompts: Record<string, string> = {
  'bio-cell-*.png': "Инфографика: Строение растительной клетки под микроскопом в ярком стиле для детей. Показать клеточную стенку, мембрану, ядро, цитоплазму, хлоропласты, вакуоль с подписями на русском. Цвета: зеленый, синий, желтый. Сравнение с животной клеткой (без стенки и хлоропластов). Фон: белый, стиль: плоский, образовательный.",
  'bio-photosynthesis-*.png': "Инфографика: Процесс фотосинтеза для 6 класса. Лист растения, солнечные лучи, углекислый газ (CO₂) через устьица, вода (H₂O) из корней. Стрелки показывают образование глюкозы (C₆H₁₂O₆) и кислорода (O₂). Подписи на русском, яркие цвета (зеленый, желтый, голубой). Стиль: мультяшный, фон: светло-голубой.",
  'bio-plant-organs-*.png': "Инфографика: Части цветкового растения (например, подсолнух). Показать корень, стебель, лист, цветок, плод, семя с подписями функций на русском. Цвета: зеленый, коричневый, красный, желтый. Стиль: реалистичный, но упрощенный для детей. Фон: белый с легким градиентом.",
  'bio-classification-*.png': "Инфографика: Классификация живых организмов. Четыре группы: Бактерии (кишечная палочка), Грибы (мухомор), Растения (пшеница), Животные (волк). Каждая группа в цветном блоке с примером и кратким описанием. Подписи на русском. Стиль: плоский, яркие цвета (синий, красный, зеленый, желтый). Фон: белый.",
  'bio-food-chain-*.png': "Инфографика: Пищевая цепь в лесу. Трава → заяц → лиса → бактерии/грибы. Стрелки показывают направление энергии. Подписи на русском: продуценты, потребители, разрушители. Цвета: зеленый, коричневый, оранжевый. Стиль: мультяшный, фон: лесной пейзаж.",
  'bio-ecosystem-*.png': "Инфографика: Экосистема смешанного леса. Деревья, травы, животные (олень, птица, насекомое), грибы, бактерии. Показать связи (растения дают кислород, животные питаются). Подписи на русском. Цвета: зеленый, коричневый, голубой. Стиль: реалистичный, фон: лес.",
  'bio-human-impact-*.png': "Инфографика: Влияние человека на природу. Два блока: положительное (посадка деревьев, заповедники) и отрицательное (вырубка лесов, свалки, загрязнение). Подписи на русском объясняют последствия. Цвета: зеленый, красный, серый. Стиль: плоский, фон: градиент от зеленого к серому.",
};

// --- Component ---
const VprBiologyCheatsheet6: NextPage = () => {
  // Helper function to get tooltip text
  const getTooltip = (keyPart: string) => {
    const key = Object.keys(tooltipDescriptions).find(k => k.includes(keyPart));
    return key ? tooltipDescriptions[key] : `Описание для ${keyPart}`;
  };

  // Helper component for images with tooltips
  const ImageWithTooltip = ({ src, alt, width, height, className = '', tooltipKeyPart, aspect = 'video', bgColor = 'bg-gray-700/30' }: {
    src: string, alt: string, width: number, height: number, className?: string, tooltipKeyPart: string, aspect?: 'video' | 'square' | 'auto', bgColor?: string
  }) => (
    <div className={`p-2 border border-gray-500/30 rounded-lg ${bgColor} hover:shadow-lg hover:shadow-green-500/20 transition-shadow duration-300`}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`${aspect === 'video' ? 'aspect-video' : aspect === 'square' ? 'aspect-square' : ''} w-full h-auto overflow-hidden rounded ${bgColor} cursor-help`}>
            <Image
              src={src.startsWith('/placeholders/') ? src : src.replace('about//', 'about/')}
              alt={alt}
              width={width}
              height={height}
              className={`w-full h-full object-cover ${src.startsWith('/placeholders/') ? 'opacity-50' : ''} ${className}`}
              loading="lazy"
            />
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[300px] bg-gray-950 border border-green-500/60 text-white p-3 shadow-lg z-50">
          <p className="text-sm">{getTooltip(tooltipKeyPart)}</p>
        </TooltipContent>
      </Tooltip>
      <p className="text-xs text-center text-gray-400 mt-1 italic">{alt.split(':')[0]}</p>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 text-gray-200">
      <Head>
        <title>ВПР Биология 6 класс: Шпаргалка</title>
        <meta name="description" content="Интерактивная шпаргалка по биологии для 6 класса: клетки, растения, экосистемы, пищевые цепи, влияние человека." />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <TooltipProvider delayDuration={150}>
        <main className="flex-grow container mx-auto px-4 py-12 md:py-16">
          <h1 className="text-3xl md:text-5xl font-bold mb-8 text-center text-brand-green cyber-text glitch" data-text="ВПР Биология 6 класс: Шпаргалка">
            <FaBookOpen className="mr-3 text-brand-green/80" />
            ВПР Биология 6 класс: Шпаргалка
          </h1>

          <Card className="max-w-6xl mx-auto bg-black/85 backdrop-blur-lg text-white rounded-2xl border border-brand-green/40 shadow-[0_0_30px_rgba(0,255,157,0.3)]">
            <CardHeader className="text-center border-b border-brand-green/20 pb-4 pt-6">
              <p className="text-md md:text-lg text-gray-300 mt-2 font-mono">
                Основы биологии для успешной сдачи ВПР! 🌱🔬
              </p>
            </CardHeader>

            <CardContent className="space-y-16 p-4 md:p-8">
              {/* Section: Основы Жизни */}
              <section className="space-y-6">
                <h2 className="flex items-center text-2xl md:text-3xl font-semibold text-green-400 mb-4 border-b-2 border-green-500/40 pb-3">
                  <FaDna className="mr-3 text-green-400/80 fa-fw" /> Основы Жизни: Клетки и Процессы
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {/* Subsection: Строение Клетки */}
                  <div className="border-l-4 border-green-700 pl-4">
                    <h3 className="flex items-center text-xl font-semibold text-green-300 mb-3">
                      <FaMicroscope className="mr-2 text-green-300/80 fa-fw" /> Строение Клетки
                    </h3>
                    <p className="text-gray-300 text-base md:text-lg mb-4">
                      Клетка — основа жизни. Растительные клетки имеют жесткую клеточную стенку и хлоропласты для фотосинтеза, животные — нет. Умей называть части клетки и их функции.
                    </p>
                    <ImageWithTooltip
                      src={imageUrls['bio-cell-*.png']}
                      alt="Клетка: Что внутри?"
                      width={400}
                      height={400}
                      tooltipKeyPart="bio-cell-*.png"
                      aspect="square"
                    />
                  </div>
                  {/* Subsection: Фотосинтез */}
                  <div className="border-l-4 border-green-700 pl-4">
                    <h3 className="flex items-center text-xl font-semibold text-green-300 mb-3">
                      <FaSun className="mr-2 text-green-300/80 fa-fw" /> Фотосинтез
                    </h3>
                    <p className="text-gray-300 text-base md:text-lg mb-4">
                      Растения используют свет, воду и углекислый газ для создания глюкозы и кислорода. Это главный процесс, питающий жизнь на Земле.
                    </p>
                    <ImageWithTooltip
                      src={imageUrls['bio-photosynthesis-*.png']}
                      alt="Фотосинтез: Как это работает?"
                      width={600}
                      height={338}
                      tooltipKeyPart="bio-photosynthesis-*.png"
                      aspect="video"
                    />
                  </div>
                  {/* Subsection: Классификация Организмов */}
                  <div className="border-l-4 border-green-700 pl-4">
                    <h3 className="flex items-center text-xl font-semibold text-green-300 mb-3">
                      <FaGlobe className="mr-2 text-green-300/80 fa-fw" /> Классификация Организмов
                    </h3>
                    <p className="text-gray-300 text-base md:text-lg mb-4">
                      Живые организмы делятся на бактерии, грибы, растения и животных. Умей определять, к какой группе относится организм, по его признакам.
                    </p>
                    <ImageWithTooltip
                      src={imageUrls['bio-classification-*.png']}
                      alt="Классификация: Кто есть кто?"
                      width={400}
                      height={400}
                      tooltipKeyPart="bio-classification-*.png"
                      aspect="square"
                    />
                  </div>
                </div>
              </section>

              {/* Section: Растения */}
              <section className="space-y-6 border-t-2 border-lime-500/30 pt-8">
                <h2 className="flex items-center text-2xl md:text-3xl font-semibold text-lime-400 mb-4 border-b-2 border-lime-500/40 pb-3">
                  <FaLeaf className="mr-3 text-lime-400/80 fa-fw" /> Растения: Строение и Жизнь
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Subsection: Органы Растений */}
                  <div className="border-l-4 border-lime-700 pl-4">
                    <h3 className="flex items-center text-xl font-semibold text-lime-300 mb-3">
                      <FaSeedling className="mr-2 text-lime-300/80 fa-fw" /> Органы Растений
                    </h3>
                    <ul className="list-disc list-inside space-y-1.5 text-gray-300 pl-4 text-base md:text-lg mb-4">
                      <li><strong>Корень:</strong> Впитывает воду и минералы, закрепляет растение.</li>
                      <li><strong>Стебель:</strong> Поддерживает листья, транспортирует вещества.</li>
                      <li><strong>Лист:</strong> Место фотосинтеза, дыхания, испарения воды.</li>
                      <li><strong>Цветок:</strong> Орган размножения.</li>
                      <li><strong>Плод и семя:</strong> Защищают и распространяют семена.</li>
                    </ul>
                    <ImageWithTooltip
                      src={imageUrls['bio-plant-organs-*.png']}
                      alt="Растение: Из чего состоит?"
                      width={600}
                      height={338}
                      tooltipKeyPart="bio-plant-organs-*.png"
                      aspect="video"
                    />
                  </div>
                  {/* Subsection: Жизненные Процессы */}
                  <div className="border-l-4 border-lime-700 pl-4">
                    <h3 className="flex items-center text-xl font-semibold text-lime-300 mb-3">
                      <FaFlask className="mr-2 text-lime-300/80 fa-fw" /> Жизненные Процессы
                    </h3>
                    <ul className="list-disc list-inside space-y-1.5 text-gray-300 pl-4 text-base md:text-lg mb-4">
                      <li><strong>Фотосинтез:</strong> Создание пищи из света, воды и CO₂.</li>
                      <li><strong>Дыхание:</strong> Поглощение кислорода, выделение CO₂.</li>
                      <li><strong>Рост:</strong> Увеличение размеров за счет деления клеток.</li>
                      <li><strong>Размножение:</strong> Образование семян через цветы.</li>
                      <li><strong>Движение:</strong> Поворот листьев к свету, рост корней к воде.</li>
                    </ul>
                  </div>
                </div>
              </section>

              {/* Section: Экосистемы и Взаимосвязи */}
              <section className="space-y-6 border-t-2 border-teal-500/30 pt-8">
                <h2 className="flex items-center text-2xl md:text-3xl font-semibold text-teal-400 mb-4 border-b-2 border-teal-500/40 pb-3">
                  <FaTree className="mr-3 text-teal-400/80 fa-fw" /> Экосистемы и Взаимосвязи
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {/* Subsection: Пищевые Цепи */}
                  <div className="border-l-4 border-teal-700 pl-4">
                    <h3 className="flex items-center text-xl font-semibold text-teal-300 mb-3">
                      <FaPaw className="mr-2 text-teal-300/80 fa-fw" /> Пищевые Цепи
                    </h3>
                    <p className="text-gray-300 text-base md:text-lg mb-4">
                      Пищевые цепи показывают, кто кого ест. Растения (продуценты) → травоядные (потребители 1-го порядка) → хищники (потребители 2-го порядка) → разрушители (грибы, бактерии).
                    </p>
                    <ImageWithTooltip
                      src={imageUrls['bio-food-chain-*.png']}
                      alt="Пищевая цепь: Кто кого ест?"
                      width={600}
                      height={338}
                      tooltipKeyPart="bio-food-chain-*.png"
                      aspect="video"
                    />
                  </div>
                  {/* Subsection: Экосистемы */}
                  <div className="border-l-4 border-teal-700 pl-4">
                    <h3 className="flex items-center text-xl font-semibold text-teal-300 mb-3">
                      <FaFish className="mr-2 text-teal-300/80 fa-fw" /> Экосистемы
                    </h3>
                    <p className="text-gray-300 text-base md:text-lg mb-4">
                      Экосистема — сообщество живых организмов и их среды. Примеры: лес, озеро, луг. Все части связаны (растения дают кислород, животные питаются).
                    </p>
                    <ImageWithTooltip
                      src={imageUrls['bio-ecosystem-*.png']}
                      alt="Экосистема: Как все связано?"
                      width={400}
                      height={400}
                      tooltipKeyPart="bio-ecosystem-*.png"
                      aspect="square"
                    />
                  </div>
                  {/* Subsection: Влияние Человека */}
                  <div className="border-l-4 border-teal-700 pl-4">
                    <h3 className="flex items-center text-xl font-semibold text-teal-300 mb-3">
                      <FaBug className="mr-2 text-teal-300/80 fa-fw" /> Влияние Человека
                    </h3>
                    <p className="text-gray-300 text-base md:text-lg mb-4">
                      Человек может улучшать природу (заповедники, посадка деревьев) или вредить (вырубка лесов, загрязнение). Умей называть примеры и последствия.
                    </p>
                    <ImageWithTooltip
                      src={imageUrls['bio-human-impact-*.png']}
                      alt="Человек и природа: Друг или враг?"
                      width={600}
                      height={338}
                      tooltipKeyPart="bio-human-impact-*.png"
                      aspect="video"
                    />
                  </div>
                </div>
              </section>

              {/* Final Tip */}
              <section className="border-t-2 border-brand-green/30 pt-8 mt-12 text-center">
                <h2 className="flex items-center justify-center text-2xl md:text-3xl font-semibold text-brand-green mb-4">
                  <FaBookOpen className="mr-3 text-brand-green/80 fa-fw" /> Главное — Практика и Наблюдение!
                </h2>
                <p className="text-gray-300 text-base md:text-lg leading-relaxed max-w-3xl mx-auto">
                  Эта шпаргалка поможет запомнить основы. Для подготовки решай <strong className="text-brand-green font-semibold">демоверсии ВПР</strong> и наблюдай природу вокруг: рассматривай растения, изучай насекомых, думай о связях в экосистемах. 
                  <br /><br />
                  Учись отвечать на вопросы четко и используй рисунки в учебнике! Удачи! 🌿
                </p>
                <div className="mt-10">
                  <Link href="/vpr-tests" legacyBehavior>
                    <a className="inline-block bg-gradient-to-r from-green-500 to-cyan-500 hover:from-green-400 hover:to-cyan-400 text-white font-bold py-3 px-6 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5">
                      ← К другим тестам и шпаргалкам ВПР
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