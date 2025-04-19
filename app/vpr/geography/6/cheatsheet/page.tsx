"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    FaGlobeAmericas, // Corrected: Added to import
    FaMapLocationDot,
    FaCompass,
    FaRulerCombined,
    FaMountain,
    FaRoute,
    FaUserSecret,
    FaWater,
    FaThermometerHalf,
    FaCloudSunRain,
    FaWind,
    FaTree,
    FaPaw,
    FaGlobe,
    FaAtlas, // Corrected: Added to import
    FaTable,
    FaChartBar,
    FaRegCompass,
    FaImage,
    FaPercent,
    FaMap,
    FaUsers
} from "react-icons/fa6";
import Link from "next/link";
import Image from "next/image";

// --- Component ---
const VprGeographyCheatsheet: React.FC = () => {

  // Tooltip descriptions for image placeholders
  const tooltipDescriptions: Record<string, string> = {
      'geo-continents.png': "Карта мира с выделенными и подписанными материками (Евразия, Африка, Сев. Америка, Юж. Америка, Австралия, Антарктида) и океанами (Тихий, Атлантический, Индийский, Северный Ледовитый).",
      'geo-coordinates.png': "Изображение Земли с сеткой координат (параллели и меридианы). Показано, как определять широту (от экватора к полюсам) и долготу (от Гринвича на восток и запад).",
      'geo-explorers.png': "Коллаж из портретов известных путешественников 6 класса (например, Магеллан, Колумб, Васко да Гама, Кук, Беллинсгаузен и Лазарев, Миклухо-Маклай, Тасман) с краткими подписями об их главных открытиях.",
      'geo-topo-map.png': "Фрагмент типичной топографической карты для ВПР с условными знаками (лес, река, луг, родник, строения, горизонтали, шоссе) и масштабом.",
      'geo-scale.png': "Иллюстрация использования линейки для измерения расстояния на карте и его пересчета в реальное расстояние с помощью именованного или численного масштаба.",
      'geo-azimuth.png': "Изображение компаса, показывающего основные и промежуточные стороны горизонта и принцип определения азимута (угол от северного направления по часовой стрелке).",
      'geo-relief.png': "Схематическое изображение холма с горизонталями. Показано, как по сгущению/разрежению горизонталей определить крутизну склона и направление понижения/повышения рельефа.",
      'geo-natural-zones.png': "Коллаж из фотографий типичных ландшафтов разных природных зон (тундра, тайга, степь, пустыня, саванна, влажные экваториальные леса) с характерными растениями и животными.",
      'geo-weather-symbols.png': "Таблица с основными условными знаками погоды, используемыми в ВПР (ясно, облачно, пасмурно, дождь, снег, роса, туман, направление и сила ветра).",
      'geo-wind-rose.png': "Пример розы ветров с объяснением, как определить преобладающее направление ветра и штиль.",
      'geo-atmosphere.png': "Изображение грозового облака с молнией или торнадо как пример явления в атмосфере.",
      'geo-biosphere.png': "Фотография разнообразных живых организмов (растения, животные, грибы) во взаимодействии, символизирующая биосферу.",
      // NEW Tooltips
      'geo-scale-explained.png': "Пояснение: Численный масштаб (1:10000) показывает, во сколько раз уменьшено изображение. Именованный (в 1 см 100 м) говорит, сколько метров на местности соответствует 1 см на карте. Для расчета расстояния измеряем отрезок линейкой и умножаем на величину именованного масштаба.",
      'geo-azimuth-explained.png': "Пояснение: Стороны горизонта (С, Ю, З, В и промежуточные) помогают определить общее направление. Азимут - точный угол (0°-360°) от направления на Север по часовой стрелке до направления на объект.",
      'geo-topo-elements.png': "Основные элементы топокарты: Горизонтали показывают высоту и форму рельефа (близко = круто). Стрелка на реке указывает течение (правый/левый берег определяются по течению). Условные знаки обозначают объекты (лес, дом, родник и т.д.).",
  };


  return (
    <div className="relative min-h-screen overflow-hidden pt-20 pb-10 bg-gradient-to-br from-gray-900 via-black to-gray-800 text-gray-200">
       <div
        className="absolute inset-0 bg-repeat opacity-5 z-0"
        style={{
          backgroundImage: `linear-gradient(to right, rgba(0, 255, 157, 0.2) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(0, 255, 157, 0.2) 1px, transparent 1px)`,
          backgroundSize: '50px 50px',
        }}
      ></div>

      <TooltipProvider delayDuration={200}>
          <div className="relative z-10 container mx-auto px-4">
            <Card className="max-w-5xl mx-auto bg-black/80 backdrop-blur-md text-white rounded-2xl border border-brand-green/30 shadow-[0_0_25px_rgba(0,255,157,0.4)]">
              <CardHeader className="text-center border-b border-brand-green/20 pb-4">
                <CardTitle className="text-3xl md:text-5xl font-bold text-brand-green cyber-text glitch" data-text="ВПР География 6 класс: Шпаргалка">
                 ВПР География 6 класс: Шпаргалка
                </CardTitle>
                <p className="text-md md:text-lg text-gray-300 mt-3 font-mono">
                  Все карты в твоих руках! 🌍🧭
                </p>
              </CardHeader>

              <CardContent className="space-y-12 p-4 md:p-8">

                {/* Section: Карта Мира */}
                <section className="space-y-4">
                  {/* Corrected icon: FaGlobeAmericas */}
                  <h2 className="flex items-center text-2xl md:text-3xl font-semibold text-cyan-400 mb-4">
                    <FaGlobeAmericas className="mr-3 text-cyan-400/80" /> 🗺️ Карта Мира: Основы
                  </h2>
                  {/* ... rest of the section ... */}
                   {/* Subsection: Материки и Океаны */}
                   <h3 className="flex items-center text-xl font-semibold text-cyan-300 mt-6 mb-2"> <FaWater className="mr-2 text-cyan-300/80" /> Материки и Океаны </h3> <p className="text-gray-300 text-base md:text-lg">Умей находить и называть 6 материков и 4 океана.</p> <div className="my-6 p-2 border border-cyan-500/30 rounded-lg bg-black/30"> <Tooltip> <TooltipTrigger asChild> <span> <div className="aspect-video w-full h-auto overflow-hidden rounded bg-gray-700/30 cursor-help"> <Image src="/placeholders/geo-continents.png" alt="Карта мира с подписанными материками и океанами" width={600} height={338} className="w-full h-full object-cover opacity-50" loading="lazy"/> </div> </span> </TooltipTrigger> <TooltipContent side="bottom" className="max-w-[250px] bg-gray-950 border border-cyan-500/60 text-white p-2"><p className="text-xs">{tooltipDescriptions['geo-continents.png']}</p></TooltipContent> </Tooltip> <p className="text-xs text-center text-gray-400 mt-1 italic">Знаешь, где какой?</p> </div>
                   {/* Subsection: Координаты и Направления */}
                   <h3 className="flex items-center text-xl font-semibold text-cyan-300 mt-6 mb-2"> <FaCompass className="mr-2 text-cyan-300/80" /> Координаты и Направления </h3> <ul className="list-disc list-inside space-y-1 text-gray-300 pl-4 text-base md:text-lg"> <li><strong>Координаты:</strong> Широта (ю.ш., с.ш.) + Долгота (з.д., в.д.). Умей находить точку по координатам.</li> <li><strong>Направления:</strong> Определяй направление от одной точки к другой (север, юг, запад, восток и промежуточные).</li> </ul> <div className="my-6 p-2 border border-cyan-500/30 rounded-lg bg-black/30 max-w-sm mx-auto"> <Tooltip> <TooltipTrigger asChild> <span> <div className="aspect-square w-full h-auto overflow-hidden rounded bg-gray-700/30 cursor-help"> <Image src="/placeholders/geo-coordinates.png" alt="Земля с сеткой координат: параллели (широта) и меридианы (долгота)" width={400} height={400} className="w-full h-full object-cover opacity-50" loading="lazy"/> </div> </span> </TooltipTrigger> <TooltipContent side="bottom" className="max-w-[250px] bg-gray-950 border border-cyan-500/60 text-white p-2"><p className="text-xs">{tooltipDescriptions['geo-coordinates.png']}</p></TooltipContent> </Tooltip> <p className="text-xs text-center text-gray-400 mt-1 italic">Широта, долгота - легко!</p> </div>
                   {/* Subsection: Путешественники */}
                   <h3 className="flex items-center text-xl font-semibold text-cyan-300 mt-6 mb-2"> <FaUserSecret className="mr-2 text-cyan-300/80" /> Великие Путешественники </h3> <p className="text-gray-300 text-base md:text-lg">Знай портреты и основные открытия (особенно связанные с материками А и Б из задания 1). Пример: Тасман, Миклухо-Маклай - часто связаны с Австралией.</p> <div className="my-6 p-2 border border-cyan-500/30 rounded-lg bg-black/30"> <Tooltip> <TooltipTrigger asChild> <span> <div className="aspect-video w-full h-auto overflow-hidden rounded bg-gray-700/30 cursor-help"> <Image src="/placeholders/geo-explorers.png" alt="Коллаж: портреты Магеллана, Колумба, Миклухо-Маклая, Тасмана" width={600} height={338} className="w-full h-full object-cover opacity-50" loading="lazy"/> </div> </span> </TooltipTrigger> <TooltipContent side="bottom" className="max-w-[250px] bg-gray-950 border border-cyan-500/60 text-white p-2"><p className="text-xs">{tooltipDescriptions['geo-explorers.png']}</p></TooltipContent> </Tooltip> <p className="text-xs text-center text-gray-400 mt-1 italic">Узнаешь их в лицо?</p> </div>
                   {/* Subsection: Географические Объекты */}
                   <h3 className="flex items-center text-xl font-semibold text-cyan-300 mt-6 mb-2"> <FaImage className="mr-2 text-cyan-300/80" /> Узнаем по Описанию </h3> <p className="text-gray-300 text-base md:text-lg">Умей определять крупные объекты (острова, горы, равнины) по описанию и космическому снимку (Пример: Мадагаскар).</p>
                </section>

                {/* Section: Топографическая Карта */}
                <section className="space-y-4 border-t border-orange-500/20 pt-8">
                  <h2 className="flex items-center text-2xl md:text-3xl font-semibold text-orange-400 mb-4">
                    {/* Corrected icon: FaMapLocationDot */}
                    <FaMapLocationDot className="mr-3 text-orange-400/80" /> 🗺️ Топографическая Карта: Читаем Местность
                  </h2>
                  {/* ... rest of the section ... */}
                   {/* Subsection: Масштаб и Расстояния */}
                   <h3 className="flex items-center text-xl font-semibold text-orange-300 mt-6 mb-2"> <FaRulerCombined className="mr-2 text-orange-300/80" /> Масштаб и Расстояния </h3> <ul className="list-disc list-inside space-y-1 text-gray-300 pl-4 text-base md:text-lg"> <li><strong>Масштаб:</strong> Численный (1:10000) и Именованный (в 1 см 100 м). Понимай, что он значит.</li> <li><strong>Измерение:</strong> Линейкой измерь расстояние на карте (в см).</li> <li><strong>Расчет:</strong> Расстояние (см) * Величина масштаба (м/см) = Расстояние на местности (м).</li> </ul>
                   {/* NEW Image Placeholder: Scale Explained */}
                   <div className="my-6 p-2 border border-orange-500/30 rounded-lg bg-black/30"> <Tooltip> <TooltipTrigger asChild> <span> {/* Prompt: Инфографика: Слева - карта с отрезком и линейкой, измерено 3 см. Справа - пояснение: Численный масштаб 1:10000, Именованный масштаб 'в 1 см 100 м'. Расчет: 3 см * 100 м/см = 300 м. Понятные иконки. */} <div className="aspect-video w-full h-auto overflow-hidden rounded bg-gray-700/30 cursor-help"> <Image src="/placeholders/geo-scale-explained.png" alt="Инфографика, объясняющая численный и именованный масштаб и расчет расстояния по карте." width={600} height={338} className="w-full h-full object-cover opacity-50" loading="lazy"/> </div> </span> </TooltipTrigger> <TooltipContent side="bottom" className="max-w-[250px] bg-gray-950 border border-orange-500/60 text-white p-2"><p className="text-xs">{tooltipDescriptions['geo-scale-explained.png']}</p></TooltipContent> </Tooltip> <p className="text-xs text-center text-gray-400 mt-1 italic">Как работает масштаб?</p> </div>

                   {/* Subsection: Направления и Азимут */}
                   <h3 className="flex items-center text-xl font-semibold text-orange-300 mt-6 mb-2"> <FaRegCompass className="mr-2 text-orange-300/80" /> Направления и Азимут </h3> <ul className="list-disc list-inside space-y-1 text-gray-300 pl-4 text-base md:text-lg"> <li><strong>Стороны горизонта:</strong> С, Ю, З, В, СЗ, СВ, ЮЗ, ЮВ.</li> <li><strong>Направление на карте:</strong> Определяй по расположению объектов (от церкви на СВ).</li> <li><strong>Азимут (редко в 6 кл, но полезно):</strong> Угол между направлением на север и направлением на объект (по часовой стрелке).</li> </ul>
                   {/* NEW Image Placeholder: Azimuth Explained */}
                   <div className="my-6 p-2 border border-orange-500/30 rounded-lg bg-black/30 max-w-sm mx-auto"> <Tooltip> <TooltipTrigger asChild> <span> {/* Prompt: Схема: Компас с четко обозначенными сторонами С, Ю, З, В, СВ, ЮВ, ЮЗ, СЗ. От центра (точки 'Вы') проведены стрелки: 1) На Север (азимут 0°/360°), 2) На Восток (азимут 90°), 3) На Юго-Запад (азимут 225°). Подпись 'Азимут - угол от Севера по часовой стрелке'. */} <div className="aspect-square w-full h-auto overflow-hidden rounded bg-gray-700/30 cursor-help"> <Image src="/placeholders/geo-azimuth-explained.png" alt="Схема компаса, объясняющая стороны горизонта и определение азимута." width={400} height={400} className="w-full h-full object-cover opacity-50" loading="lazy"/> </div> </span> </TooltipTrigger> <TooltipContent side="bottom" className="max-w-[250px] bg-gray-950 border border-orange-500/60 text-white p-2"><p className="text-xs">{tooltipDescriptions['geo-azimuth-explained.png']}</p></TooltipContent> </Tooltip> <p className="text-xs text-center text-gray-400 mt-1 italic">Определяем курс!</p> </div>

                  {/* Subsection: Рельеф и Условные Знаки */}
                  <h3 className="flex items-center text-xl font-semibold text-orange-300 mt-6 mb-2"> <FaMountain className="mr-2 text-orange-300/80" /> Рельеф и Условные Знаки </h3> <ul className="list-disc list-inside space-y-1 text-gray-300 pl-4 text-base md:text-lg"> <li><strong>Горизонтали:</strong> Линии равных высот. Чем ближе - тем круче склон. Бергштрих показывает направление понижения.</li> <li><strong>Условные знаки:</strong> Знай основные (река, лес, луг, шоссе, церковь, родник, обрыв, болото).</li> <li><strong>Характеристики участка (для выбора):</strong> Ровная поверхность (горизонтали далеко), склон (горизонтали близко), близость к реке/дороге, лес/луг.</li> </ul>
                  {/* NEW Image Placeholder: Topo Elements */}
                  <div className="my-6 p-2 border border-orange-500/30 rounded-lg bg-black/30"> <Tooltip> <TooltipTrigger asChild> <span> {/* Prompt: Инфографика: Фрагмент топокарты. 1) Горизонтали с подписями высот и бергштрихами, указывающими на понижение склона. 2) Река со стрелкой, показывающей направление течения. 3) Несколько ключевых условных знаков (лес, луг, родник, дом) с выносками и подписями. */} <div className="aspect-video w-full h-auto overflow-hidden rounded bg-gray-700/30 cursor-help"> <Image src="/placeholders/geo-topo-elements.png" alt="Инфографика с ключевыми элементами топокарты: горизонтали, река, условные знаки." width={600} height={338} className="w-full h-full object-cover opacity-50" loading="lazy"/> </div> </span> </TooltipTrigger> <TooltipContent side="bottom" className="max-w-[250px] bg-gray-950 border border-orange-500/60 text-white p-2"><p className="text-xs">{tooltipDescriptions['geo-topo-elements.png']}</p></TooltipContent> </Tooltip> <p className="text-xs text-center text-gray-400 mt-1 italic">Читаем карту как книгу!</p> </div>
                </section>

                {/* Section: Природа Земли */}
                <section className="space-y-4 border-t border-green-500/20 pt-8">
                  <h2 className="flex items-center text-2xl md:text-3xl font-semibold text-green-400 mb-4">
                    <FaTree className="mr-3 text-green-400/80" /> 🌳 Природа Земли
                  </h2>
                  {/* ... rest of the section ... */}
                  {/* Subsection: Природные Зоны */} <h3 className="flex items-center text-xl font-semibold text-green-300 mt-6 mb-2"> <FaPaw className="mr-2 text-green-300/80" /> Природные Зоны </h3> <p className="text-gray-300 text-base md:text-lg">Умей сопоставлять ПЗ (тайга, саванна, пустыня и т.д.) с их географическими особенностями (климат, растительность, животные). Узнавай ПЗ по фото.</p> <ul className="list-disc list-inside space-y-1 text-gray-300 pl-4 text-base md:text-lg"> <li><strong>Тайга:</strong> Хвойные леса, умеренный пояс, снежная зима.</li> <li><strong>Саванны и редколесья:</strong> Травы, редкие деревья, жаркий климат с сухим и влажным сезонами, зебры, жирафы (Африка).</li> </ul> <div className="my-6 p-2 border border-green-500/30 rounded-lg bg-black/30"> <Tooltip> <TooltipTrigger asChild> <span> <div className="aspect-video w-full h-auto overflow-hidden rounded bg-gray-700/30 cursor-help"> <Image src="/placeholders/geo-natural-zones.png" alt="Коллаж: Фотографии тайги, саванны, пустыни, тундры" width={600} height={338} className="w-full h-full object-cover opacity-50" loading="lazy"/> </div> </span> </TooltipTrigger> <TooltipContent side="bottom" className="max-w-[250px] bg-gray-950 border border-green-500/60 text-white p-2"><p className="text-xs">{tooltipDescriptions['geo-natural-zones.png']}</p></TooltipContent> </Tooltip> <p className="text-xs text-center text-gray-400 mt-1 italic">Где кто живет?</p> </div>
                  {/* Subsection: Погода и Климат */} <h3 className="flex items-center text-xl font-semibold text-green-300 mt-6 mb-2"> <FaCloudSunRain className="mr-2 text-green-300/80" /> Погода и Климат </h3> <ul className="list-disc list-inside space-y-1 text-gray-300 pl-4 text-base md:text-lg"> <li><strong>Погода:</strong> Состояние атмосферы СЕЙЧАС (температура, осадки, ветер, облачность).</li> <li><strong>Условные знаки погоды:</strong> Знай основные значки.</li> <li><strong>Ветер:</strong> Определяй направление по розе ветров (дует ОТТУДА, куда показывает самый длинный луч).</li> <li><strong>Причина смены дня/ночи и времен года:</strong> Осевое вращение Земли (день/ночь, разница во времени), движение Земли вокруг Солнца + наклон оси (времена года).</li> </ul> <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6"> <div className="p-2 border border-green-500/30 rounded-lg bg-black/30"> <Tooltip> <TooltipTrigger asChild> <span> {/* Image Placeholder: Знаки погоды */} <div className="aspect-square w-full h-auto overflow-hidden rounded bg-gray-700/30 cursor-help"> <Image src="/placeholders/geo-weather-symbols.png" alt="Таблица с условными знаками погоды" width={400} height={400} className="w-full h-full object-cover opacity-50" loading="lazy"/> </div> </span> </TooltipTrigger> <TooltipContent side="bottom" className="max-w-[250px] bg-gray-950 border border-green-500/60 text-white p-2"><p className="text-xs">{tooltipDescriptions['geo-weather-symbols.png']}</p></TooltipContent> </Tooltip> <p className="text-xs text-center text-gray-400 mt-1 italic">Что значит этот значок?</p> </div> <div className="p-2 border border-green-500/30 rounded-lg bg-black/30"> <Tooltip> <TooltipTrigger asChild> <span> {/* Image Placeholder: Роза ветров */} <div className="aspect-square w-full h-auto overflow-hidden rounded bg-gray-700/30 cursor-help"> <Image src="/placeholders/geo-wind-rose.png" alt="Пример розы ветров с объяснением" width={400} height={400} className="w-full h-full object-cover opacity-50" loading="lazy"/> </div> </span> </TooltipTrigger> <TooltipContent side="bottom" className="max-w-[250px] bg-gray-950 border border-green-500/60 text-white p-2"><p className="text-xs">{tooltipDescriptions['geo-wind-rose.png']}</p></TooltipContent> </Tooltip> <p className="text-xs text-center text-gray-400 mt-1 italic">Откуда ветер дует?</p> </div> </div>
                  {/* Subsection: Географическая Оболочка */} <h3 className="flex items-center text-xl font-semibold text-green-300 mt-6 mb-2"> <FaGlobe className="mr-2 text-green-300/80" /> Географическая Оболочка </h3> <ul className="list-disc list-inside space-y-1 text-gray-300 pl-4 text-base md:text-lg"> <li><strong>Состав:</strong> Литосфера (земная кора), Гидросфера (вода), Атмосфера (воздух), Биосфера (жизнь).</li> <li><strong>Явления:</strong> Умей относить явления (землетрясение, дождь, торнадо, рост растений) к соответствующей оболочке.</li> <li><strong>Влияние человека:</strong> Понимай негативные последствия (загрязнение, вырубка лесов) на биосферу.</li> </ul> <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6"> <div className="p-2 border border-green-500/30 rounded-lg bg-black/30"> <Tooltip> <TooltipTrigger asChild> <span> {/* Image Placeholder: Явление атмосферы */} <div className="aspect-video w-full h-auto overflow-hidden rounded bg-gray-700/30 cursor-help"> <Image src="/placeholders/geo-atmosphere.png" alt="Изображение торнадо или грозы" width={400} height={225} className="w-full h-full object-cover opacity-50" loading="lazy"/> </div> </span> </TooltipTrigger> <TooltipContent side="bottom" className="max-w-[250px] bg-gray-950 border border-green-500/60 text-white p-2"><p className="text-xs">{tooltipDescriptions['geo-atmosphere.png']}</p></TooltipContent> </Tooltip> <p className="text-xs text-center text-gray-400 mt-1 italic">Явления в атмосфере.</p> </div> <div className="p-2 border border-green-500/30 rounded-lg bg-black/30"> <Tooltip> <TooltipTrigger asChild> <span> {/* Image Placeholder: Биосфера */} <div className="aspect-video w-full h-auto overflow-hidden rounded bg-gray-700/30 cursor-help"> <Image src="/placeholders/geo-biosphere.png" alt="Изображение разнообразных живых организмов" width={400} height={225} className="w-full h-full object-cover opacity-50" loading="lazy"/> </div> </span> </TooltipTrigger> <TooltipContent side="bottom" className="max-w-[250px] bg-gray-950 border border-green-500/60 text-white p-2"><p className="text-xs">{tooltipDescriptions['geo-biosphere.png']}</p></TooltipContent> </Tooltip> <p className="text-xs text-center text-gray-400 mt-1 italic">Всё живое - Биосфера.</p> </div> </div>
                </section>

                {/* Section: Человек на Земле */}
                <section className="space-y-4 border-t border-yellow-500/20 pt-8">
                  <h2 className="flex items-center text-2xl md:text-3xl font-semibold text-yellow-400 mb-4">
                    <FaUsers className="mr-3 text-yellow-400/80" /> 🧍 Человек на Земле
                  </h2>
                  {/* ... rest of the section ... */}
                   <ul className="list-disc list-inside space-y-2 text-gray-300 pl-4 text-base md:text-lg"> <li><strong>Работа с таблицами:</strong> Умей находить нужные данные (численность населения, % городского/сельского), сравнивать, ранжировать страны.</li> <li><strong>Городское/Сельское население:</strong> Понимай, где больше (%).</li> <li><strong>Фото и страна:</strong> Соотноси фотографии (часто с узнаваемыми объектами/животными) со страной из таблицы.</li> <li><strong>Уникальные объекты:</strong> Знай несколько всемирно известных объектов и их примерное расположение (Большой Барьерный риф - Австралия).</li> </ul>
                   {/* Example: Table icon */} <div className="text-center my-4"><FaTable className="text-6xl text-yellow-400/60 mx-auto"/></div>
                </section>

                {/* Final Tip */}
                <section className="border-t border-brand-green/20 pt-8 mt-10 text-center">
                  <h2 className="flex items-center justify-center text-2xl md:text-3xl font-semibold text-brand-green mb-4">
                    {/* Corrected icon: FaAtlas */}
                    <FaAtlas className="mr-3 text-brand-green/80" /> Главное - Практика!
                  </h2>
                  {/* ... rest of the section ... */}
                   <p className="text-gray-300 text-base md:text-lg leading-relaxed"> Эта шпаргалка - твой компас. Но лучший способ подготовиться - решать <strong className="text-brand-green font-semibold">демоверсии</strong> и <strong className="text-brand-green font-semibold">задания прошлых лет</strong>. Обращай внимание на работу с <strong className="text-brand-green font-semibold">картами</strong> и <strong className="text-brand-green font-semibold">условными знаками</strong>. Ты справишься! </p>
                </section>

              </CardContent>
            </Card>
          </div>
      </TooltipProvider>
    </div>
  );
};

export default VprGeographyCheatsheet;