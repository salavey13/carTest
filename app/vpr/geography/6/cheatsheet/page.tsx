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
    FaGlobeEurope, FaWater, FaWind, FaTree, FaMountain, FaSmog, FaCloudSunRain,
    FaCompass, FaThermometerHalf, FaMapMarkedAlt, FaBookOpen, FaRulerCombined,
    FaSatelliteDish, FaGlobeAmericas, FaAtlas, FaMapLocationDot, FaRegCompass,
    FaUserSecret, FaPaw, FaUsers, FaTable, FaImage, FaArrowRight, FaArrowDown, FaArrowsLeftRight, FaArrowUp
} from '@fortawesome/free-solid-svg-icons'; // Use FaArrow* for directions
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

// --- Tooltip Descriptions ---
const tooltipDescriptions: Record<string, string> = {
    'continents-*.png': "Карта мира с выделенными и подписанными 6 материками (Евразия, Африка, Сев. Америка, Юж. Америка, Австралия, Антарктида) и 4 основными океанами (Тихий, Атлантический, Индийский, Северный Ледовитый). Важно помнить их взаимное расположение.",
    'latitude-*.png': "Земной шар с градусной сеткой. Параллели (горизонтальные) показывают широту (от 0° на экваторе до 90° на полюсах, северная или южная). Меридианы (вертикальные) показывают долготу (от 0° на Гринвиче до 180°, западная или восточная).",
    'explorers-*.png': "Коллаж портретов: Магеллан (кругосветка), Колумб (Америка), Васко да Гама (морской путь в Индию), Кук (исследование Тихого океана), Беллинсгаузен и Лазарев (Антарктида), Миклухо-Маклай и Тасман (Австралия и Океания). Важно знать их вклад.",
    'IMG_20250420_010735.jpg': "Численный масштаб (1:10000) показывает, во сколько раз уменьшено изображение. Именованный (в 1 см 100 м) говорит, сколько метров/км на местности соответствует 1 см на карте. Для расчета расстояния измеряем отрезок линейкой (см) и умножаем на величину именованного масштаба (м/см).",
    'IMG_20250420_010521.jpg': "Стороны горизонта (С, Ю, З, В и промежуточные СЗ, СВ, ЮЗ, ЮВ) помогают определить общее направление. Азимут - точный угол (0°-360°) от направления на Север по часовой стрелке до направления на объект. Определяется компасом.",
    '3topo.png': "Топографическая карта: Горизонтали (линии равных высот) показывают рельеф (близко = круто, далеко = полого). Бергштрих - черточка, показывающая направление понижения склона. Стрелка на реке указывает течение (правый/левый берег определяются по течению). Условные знаки обозначают объекты (лес, дом, родник, болото, дорога и т.д.).",
    'geo-natural-zones-*.png': "Коллаж ландшафтов: Арктич. пустыня/Тундра (снег, мох), Тайга (хвойный лес), Степь (травы), Пустыня (песок, жара), Саванна (травы, редкие деревья, Африка), Влажный экваториальный лес (джунгли). У каждой зоны свой климат, флора и фауна.",
    'geo-weather-symbols-*.png': "Основные условные знаки: Солнце (ясно), Солнце за тучей (перем. облачность), Туча (облачно), Туча с каплями (дождь), Туча со снежинками (снег), Стрелка ветра (направление ОТКУДА дует, скорость по 'оперению'), Горизонтальные линии (туман), Капля (роса).",
    'geo-wind-rose-*.png': "Роза ветров: Лучи показывают частоту ветра С указанного направления (самый длинный = преобладающий). Длина луча пропорциональна числу дней/%. Цифра в центре - % штиля (безветрия). Цвета могут обозначать скорость.",
    'geo-atmosphere-*.png': "Примеры атмосферных явлений: Гроза (мощные кучево-дождевые облака, молнии, гром, ливень, иногда град) и Торнадо/Смерч (вращающийся вихрь, связанный с грозовым облаком). Оба - явления в Тропосфере.",
    'life-*.png': "Биосфера - 'сфера жизни', включающая все живые организмы (растения, животные, грибы, бактерии) и среду их обитания. Организмы взаимодействуют друг с другом и с другими оболочками Земли.",
};


// --- Component ---
const VprGeographyCheatsheet6: NextPage = () => {
    // Helper function to get tooltip text
    const getTooltip = (keyPart: string) => {
        const key = Object.keys(tooltipDescriptions).find(k => k.includes(keyPart));
        return key ? tooltipDescriptions[key] : `Описание для ${keyPart}`;
    };

    // Helper component for images with tooltips
    const ImageWithTooltip = ({ src, alt, width, height, className = '', tooltipKeyPart, aspect = 'video', bgColor = 'bg-gray-700/30' }: { src: string, alt: string, width: number, height: number, className?: string, tooltipKeyPart: string, aspect?: 'video' | 'square' | 'auto', bgColor?: string }) => (
        <div className={`p-2 border border-gray-500/30 rounded-lg ${bgColor}`}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className={`${aspect === 'video' ? 'aspect-video' : aspect === 'square' ? 'aspect-square' : ''} w-full h-auto overflow-hidden rounded ${bgColor} cursor-help`}>
                        <Image
                            src={src.startsWith('/placeholders/') ? src : src.replace('about//', 'about/')} // Fix double slash if needed
                            alt={alt}
                            width={width}
                            height={height}
                            className={`w-full h-full object-cover ${src.startsWith('/placeholders/') ? 'opacity-50' : ''} ${className}`}
                            loading="lazy"
                        />
                    </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[280px] bg-gray-950 border border-purple-500/60 text-white p-3 shadow-lg">
                    <p className="text-sm">{getTooltip(tooltipKeyPart)}</p>
                </TooltipContent>
            </Tooltip>
            <p className="text-xs text-center text-gray-400 mt-1 italic">{alt.split(':')[0]}?</p> {/* Shorten alt for caption */}
        </div>
    );


    return (
        <div className="flex flex-col min-h-screen bg-gradient-to-b from-gray-900 via-black to-gray-800 text-gray-200">
            <Head>
                <title>ВПР География 6 класс: Шпаргалка</title>
                <meta name="description" content="Подробная шпаргалка по географии для подготовки к ВПР в 6 классе: карты, оболочки Земли, погода, климат, топография." />
                <link rel="icon" href="/favicon.ico" />
            

            

            <TooltipProvider delayDuration={200}>
                <main className="flex-grow container mx-auto px-4 py-12 md:py-16"> {/* Increased padding */}
                     <h1 className="text-3xl md:text-5xl font-bold mb-8 text-center text-brand-green cyber-text glitch" data-text="ВПР География 6 класс: Шпаргалка">
                        <FontAwesomeIcon icon={FaBookOpen} className="mr-3 text-brand-green/80" />
                        ВПР География 6 класс: Шпаргалка
                    </h1>

                    <Card className="max-w-6xl mx-auto bg-black/80 backdrop-blur-md text-white rounded-2xl border border-brand-purple/30 shadow-[0_0_25px_rgba(157,0,255,0.4)]">
                         <CardHeader className="text-center border-b border-brand-purple/20 pb-4 pt-6">
                            <p className="text-md md:text-lg text-gray-300 mt-2 font-mono">
                              Ключевые темы для успешной сдачи! 🌍🧭
                            </p>
                         </CardHeader>

                        <CardContent className="space-y-12 p-4 md:p-8">

                            {/* Section: Карта Мира */}
                            <section className="space-y-4">
                                <h2 className="flex items-center text-2xl md:text-3xl font-semibold text-cyan-400 mb-4 border-b border-cyan-500/30 pb-2">
                                    <FontAwesomeIcon icon={FaGlobeAmericas} className="mr-3 text-cyan-400/80" /> Карта Мира: Основы
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {/* Subsection: Материки и Океаны */}
                                    <div className="border-l-4 border-cyan-700 pl-4">
                                        <h3 className="flex items-center text-xl font-semibold text-cyan-300 mb-2"> <FontAwesomeIcon icon={FaWater} className="mr-2 text-cyan-300/80" /> Материки и Океаны </h3>
                                        <p className="text-gray-300 text-base md:text-lg mb-3">Уверенно находи на карте 6 материков (Евразия, Африка, Северная Америка, Южная Америка, Австралия, Антарктида) и 4-5 океанов (Тихий, Атлантический, Индийский, Северный Ледовитый, иногда выделяют Южный). Запомни их примерные очертания и расположение.</p>
                                        <ImageWithTooltip src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/continents-99913414-d4cb-4624-9779-6a7498cbf67a.png" alt="Материки и океаны: Где какой?" width={600} height={338} tooltipKeyPart="continents-*.png" aspect="video" />
                                    </div>
                                    {/* Subsection: Координаты и Направления */}
                                    <div className="border-l-4 border-cyan-700 pl-4">
                                        <h3 className="flex items-center text-xl font-semibold text-cyan-300 mb-2"> <FontAwesomeIcon icon={FaCompass} className="mr-2 text-cyan-300/80" /> Координаты и Направления </h3>
                                        <ul className="list-disc list-inside space-y-1 text-gray-300 pl-4 text-base md:text-lg mb-3">
                                            <li><strong>Координаты:</strong> Широта (северная/южная, от 0° до 90°) + Долгота (западная/восточная, от 0° до 180°). Учись находить точку по заданным координатам и определять координаты объекта на карте.</li>
                                            <li><strong>Направления:</strong> Определяй направление от одной точки к другой по сторонам горизонта (С, Ю, З, В, СЗ, СВ, ЮЗ, ЮВ).</li>
                                        </ul>
                                        <ImageWithTooltip src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/latitude-d685bb88-e694-408c-b01d-d285edc6ff29.png" alt="Координаты: Широта и долгота" width={400} height={400} tooltipKeyPart="latitude-*.png" aspect="square" />
                                    </div>
                                    {/* Subsection: Путешественники */}
                                    <div className="border-l-4 border-cyan-700 pl-4">
                                        <h3 className="flex items-center text-xl font-semibold text-cyan-300 mb-2"> <FontAwesomeIcon icon={FaUserSecret} className="mr-2 text-cyan-300/80" /> Великие Путешественники </h3>
                                        <p className="text-gray-300 text-base md:text-lg mb-3">Узнавай по портретам и знай главные открытия (особенно связанные с материками А и Б из задания 1 ВПР). Кто открыл Америку? Кто совершил первое кругосветное плавание? Кто исследовал Австралию или Антарктиду?</p>
                                        <ImageWithTooltip src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/explorers-673a4b3e-1fdb-42e3-bc14-990493afe92d.png" alt="Путешественники: Узнаешь их?" width={600} height={338} tooltipKeyPart="explorers-*.png" aspect="video" />
                                    </div>
                                     {/* Subsection: Географические Объекты по описанию */}
                                     <div className="border-l-4 border-cyan-700 pl-4">
                                        <h3 className="flex items-center text-xl font-semibold text-cyan-300 mb-2"> <FontAwesomeIcon icon={FaImage} className="mr-2 text-cyan-300/80" /> Узнаем по Описанию / Фото </h3>
                                        <p className="text-gray-300 text-base md:text-lg">Часто нужно определить крупный географический объект (остров, полуостров, горы, равнину, реку, озеро) по его характерным чертам, описанию или космическому снимку. Обращай внимание на форму, размеры, положение относительно других объектов. Пример: Гренландия (крупнейший остров), Амазонка (самая полноводная река), Анды (длиннейшие горы).</p>
                                    </div>
                                </div>
                            </section>

                             {/* Section: Топографическая Карта */}
                            <section className="space-y-4 border-t border-orange-500/20 pt-8">
                                <h2 className="flex items-center text-2xl md:text-3xl font-semibold text-orange-400 mb-4 border-b border-orange-500/30 pb-2">
                                    <FontAwesomeIcon icon={FaMapLocationDot} className="mr-3 text-orange-400/80" /> Топографическая Карта: Читаем Местность
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    {/* Subsection: Масштаб и Расстояния */}
                                    <div className="border-l-4 border-orange-700 pl-4">
                                        <h3 className="flex items-center text-xl font-semibold text-orange-300 mb-2"> <FontAwesomeIcon icon={FaRulerCombined} className="mr-2 text-orange-300/80" /> Масштаб и Расстояния </h3>
                                        <ul className="list-disc list-inside space-y-1 text-gray-300 pl-4 text-base md:text-lg mb-3">
                                            <li><strong>Виды:</strong> Численный (1:10000), Именованный (в 1 см - 100 м). Понимай их значение.</li>
                                            <li><strong>Измерение:</strong> Используй линейку для измерения расстояния между точками на карте (в см).</li>
                                            <li><strong>Расчет:</strong> Умножь измеренное расстояние (см) на величину именованного масштаба (число метров в 1 см) = получишь реальное расстояние (м). Переводи в км при необходимости (1 км = 1000 м).</li>
                                        </ul>
                                        <ImageWithTooltip src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/IMG_20250420_010735.jpg" alt="Масштаб: Как рассчитать расстояние?" width={600} height={338} tooltipKeyPart="IMG_20250420_010735.jpg" aspect="video" />
                                    </div>

                                    {/* Subsection: Направления и Азимут */}
                                    <div className="border-l-4 border-orange-700 pl-4">
                                        <h3 className="flex items-center text-xl font-semibold text-orange-300 mb-2"> <FontAwesomeIcon icon={FaRegCompass} className="mr-2 text-orange-300/80" /> Направления и Азимут </h3>
                                        <ul className="list-disc list-inside space-y-1 text-gray-300 pl-4 text-base md:text-lg mb-3">
                                            <li><strong>Стороны горизонта:</strong> Основные (С, Ю, З, В) и промежуточные (СЗ, СВ, ЮЗ, ЮВ).</li>
                                            <li><strong>Определение направления:</strong> Определяй, в каком направлении один объект находится от другого (например, дом от родника на СЗ).</li>
                                            <li><strong>Азимут (важно!):</strong> Угол от 0° до 360° между направлением на СЕВЕР и направлением на объект, измеряемый ПО ЧАСОВОЙ СТРЕЛКЕ. Транспортир в помощь!</li>
                                        </ul>
                                         <ImageWithTooltip src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/IMG_20250420_010521.jpg" alt="Направления и азимут: Определяем курс" width={400} height={400} tooltipKeyPart="IMG_20250420_010521.jpg" aspect="square" />
                                    </div>

                                    {/* Subsection: Рельеф и Условные Знаки */}
                                    <div className="border-l-4 border-orange-700 pl-4">
                                        <h3 className="flex items-center text-xl font-semibold text-orange-300 mb-2"> <FontAwesomeIcon icon={FaMountain} className="mr-2 text-orange-300/80" /> Рельеф и Условные Знаки </h3>
                                        <ul className="list-disc list-inside space-y-1 text-gray-300 pl-4 text-base md:text-lg mb-3">
                                            <li><strong>Горизонтали:</strong> Линии равных высот. Сближение = крутой склон, расхождение = пологий.</li>
                                            <li><strong>Бергштрих:</strong> Указывает направление понижения склона (от горизонтали).</li>
                                            <li><strong>Условные знаки:</strong> Выучи основные (лес, луг, река+направление течения, мост, родник, дом, школа, болото, обрыв, шоссе, грунтовка).</li>
                                            <li><strong>Профиль рельефа:</strong> Умей строить график высот по линии на карте.</li>
                                            <li><strong>Выбор участка:</strong> Оценивай уклон, тип поверхности (лес/луг), близость к объектам (река/дорога) для разных задач (футбол, санки, ферма).</li>
                                        </ul>
                                        <ImageWithTooltip src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/3topo.png" alt="Топокарта: Читаем рельеф и знаки" width={600} height={338} tooltipKeyPart="3topo.png" aspect="video" />
                                    </div>
                                </div>
                            </section>

                            {/* Section: Географические Оболочки и Природа Земли */}
                             <section className="space-y-4 border-t border-green-500/20 pt-8">
                                <h2 className="flex items-center text-2xl md:text-3xl font-semibold text-green-400 mb-4 border-b border-green-500/30 pb-2">
                                    <FontAwesomeIcon icon={FaGlobeEurope} className="mr-3 text-green-400/80" /> Оболочки Земли и Природа
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                    {/* Subsection: Оболочки */}
                                    <div className="border-l-4 border-green-700 pl-4 lg:col-span-1">
                                        <h3 className="flex items-center text-xl font-semibold text-green-300 mb-2"> <FontAwesomeIcon icon={FaGlobeEurope} className="mr-2 text-green-300/80" /> Оболочки Земли </h3>
                                        <ul className="list-disc list-inside space-y-1 text-gray-300 pl-4 text-base md:text-lg mb-3">
                                            <li><strong>Литосфера:</strong> Твердая (земная кора, рельеф). Явления: землетрясения, вулканы, движение плит.</li>
                                            <li><strong>Гидросфера:</strong> Водная (океаны, реки, ледники). Явления: течения, волны, круговорот воды.</li>
                                            <li><strong>Атмосфера:</strong> Воздушная (воздух, погода). Явления: ветер, осадки, грозы, туман.</li>
                                            <li><strong>Биосфера:</strong> "Живая" (растения, животные). Явления: фотосинтез, миграции, пищевые цепи.</li>
                                        </ul>
                                         <p className="text-gray-300 text-base md:text-lg mb-3">Умей относить природные явления (дождь, землетрясение, рост цветка) к своей оболочке.</p>
                                         <ImageWithTooltip src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/geo-atmosphere-collage-eff574ec-a074-4dea-be8c-4746a9175e86.png" alt="Атмосфера: Гроза и торнадо" width={400} height={225} tooltipKeyPart="geo-atmosphere-*.png" aspect="video" />
                                         <div className="mt-4">
                                           <ImageWithTooltip src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/life-77b646d5-16f4-45e1-ab80-a810340f6c40.png" alt="Биосфера: Разнообразие жизни" width={400} height={225} tooltipKeyPart="life-*.png" aspect="video" />
                                         </div>
                                    </div>
                                    {/* Subsection: Природные Зоны */}
                                    <div className="border-l-4 border-green-700 pl-4 lg:col-span-1">
                                        <h3 className="flex items-center text-xl font-semibold text-green-300 mb-2"> <FontAwesomeIcon icon={FaPaw} className="mr-2 text-green-300/80" /> Природные Зоны (ПЗ) </h3>
                                        <p className="text-gray-300 text-base md:text-lg mb-3">Крупные территории с похожим климатом, почвами, растениями и животными. Учись узнавать ПЗ по описанию или фото, знать их основные характеристики и типичных обитателей.</p>
                                        <ul className="list-disc list-inside space-y-1 text-gray-300 pl-4 text-base md:text-lg mb-3">
                                             <li><strong>Тундра:</strong> Холод, вечная мерзлота, мхи, лишайники, карликовые деревья, олени, лемминги.</li>
                                             <li><strong>Тайга:</strong> Умеренный климат, хвойные деревья (ель, сосна), бурый медведь, лось.</li>
                                             <li><strong>Степи:</strong> Умеренный климат, травы, плодородные почвы (чернозем), грызуны, орлы.</li>
                                             <li><strong>Пустыни:</strong> Жарко/холодно, сухо, песок/камни, редкая растительность (кактусы, саксаул), верблюды, ящерицы.</li>
                                             <li><strong>Саванны:</strong> Жарко, сухой и влажный сезоны, травы, редкие деревья (баобаб, акация), зебры, львы (Африка).</li>
                                             <li><strong>Влажные экв. леса:</strong> Жарко, влажно, многоярусный лес, лианы, обезьяны, попугаи.</li>
                                        </ul>
                                         <ImageWithTooltip src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/geo-natural-zones-3f1c6f06-3cdd-49e4-91ee-b551ed244290.png" alt="Природные зоны: От тундры до джунглей" width={600} height={338} tooltipKeyPart="geo-natural-zones-*.png" aspect="video" />
                                    </div>
                                     {/* Subsection: Погода и Климат */}
                                    <div className="border-l-4 border-green-700 pl-4 lg:col-span-1">
                                        <h3 className="flex items-center text-xl font-semibold text-green-300 mb-2"> <FontAwesomeIcon icon={FaCloudSunRain} className="mr-2 text-green-300/80" /> Погода и Климат </h3>
                                        <ul className="list-disc list-inside space-y-1 text-gray-300 pl-4 text-base md:text-lg mb-3">
                                            <li><strong>Погода:</strong> Состояние тропосферы здесь и сейчас (t°, давление, ветер, влажность, облачность, осадки). Изменчива.</li>
                                            <li><strong>Климат:</strong> Многолетний режим погоды. Определяет природные зоны.</li>
                                            <li><strong>Условные знаки погоды:</strong> Важно знать для анализа карт и дневников погоды.</li>
                                            <li><strong>Ветер:</strong> Движение воздуха. Роза ветров показывает преобладающие направления (откуда дует).</li>
                                            <li><strong>t° воздуха:</strong> Измеряется термометром. Среднесуточная t° = сумма t° / число измерений.</li>
                                            <li><strong>Смена дня/ночи:</strong> Вращение Земли вокруг своей оси (24 часа).</li>
                                            <li><strong>Смена времен года:</strong> Движение Земли вокруг Солнца + наклон земной оси (365 дней).</li>
                                        </ul>
                                        <div className="grid grid-cols-2 gap-4">
                                          <ImageWithTooltip src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/geo-weather-symbols-9deca9a2-1000-47f7-a13b-cf3c2e4980dd.png" alt="Знаки погоды: Расшифровываем?" width={400} height={400} tooltipKeyPart="geo-weather-symbols-*.png" aspect="square" bgColor="bg-white/90" />
                                          <ImageWithTooltip src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/geo-wind-rose.png-bc50103a-016a-4d39-a1a6-595d018ec926.jpg" alt="Роза ветров: Какой ветер главный?" width={400} height={400} tooltipKeyPart="geo-wind-rose-*.png" aspect="square" />
                                        </div>
                                    </div>
                                </div>
                             </section>


                            {/* Section: Человек на Земле */}
                            <section className="space-y-4 border-t border-yellow-500/20 pt-8">
                                <h2 className="flex items-center text-2xl md:text-3xl font-semibold text-yellow-400 mb-4 border-b border-yellow-500/30 pb-2">
                                    <FontAwesomeIcon icon={FaUsers} className="mr-3 text-yellow-400/80" /> Человек на Земле
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="border-l-4 border-yellow-700 pl-4">
                                        <h3 className="flex items-center text-xl font-semibold text-yellow-300 mb-2"> <FontAwesomeIcon icon={FaTable} className="mr-2 text-yellow-300/80" /> Работа с Таблицами и Диаграммами </h3>
                                        <ul className="list-disc list-inside space-y-1 text-gray-300 pl-4 text-base md:text-lg">
                                            <li><strong>Чтение данных:</strong> Умей находить нужную информацию в таблице (например, численность населения страны, площадь, ВВП).</li>
                                            <li><strong>Сравнение:</strong> Сравнивай показатели разных стран или регионов (где больше/меньше население, площадь и т.д.).</li>
                                            <li><strong>Ранжирование:</strong> Располагай страны в порядке возрастания/убывания по какому-либо показателю.</li>
                                            <li><strong>Доля населения:</strong> Рассчитывай долю городского или сельского населения (часть / целое * 100%).</li>
                                            <li><strong>Диаграммы:</strong> Анализируй столбчатые или круговые диаграммы (например, структура ВВП, возрастная структура населения).</li>
                                        </ul>
                                    </div>
                                    <div className="border-l-4 border-yellow-700 pl-4">
                                        <h3 className="flex items-center text-xl font-semibold text-yellow-300 mb-2"> <FontAwesomeIcon icon={FaMap} className="mr-2 text-yellow-300/80" /> Страны и Узнаваемые Объекты </h3>
                                        <ul className="list-disc list-inside space-y-1 text-gray-300 pl-4 text-base md:text-lg">
                                            <li><strong>Фото и страна:</strong> Умей соотносить фотографии типичных ландшафтов, известных достопримечательностей или животных с определенной страной (например, кенгуру - Австралия, пирамиды - Египет).</li>
                                            <li><strong>Столицы:</strong> Знай столицы крупнейших стран и стран-соседей России.</li>
                                            <li><strong>Уникальные объекты:</strong> Понимай, где находятся всемирно известные природные и культурные объекты (Большой Барьерный риф, Байкал, Великая Китайская стена, Эйфелева башня).</li>
                                            <li><strong>Влияние человека:</strong> Осознавай положительное (заповедники, парки) и отрицательное (загрязнение, вырубка лесов, опустынивание) влияние хозяйственной деятельности человека на природу.</li>
                                        </ul>
                                    </div>
                                </div>
                                <div className="text-center my-6"><FontAwesomeIcon icon={FaTable} className="text-6xl text-yellow-400/60 mx-auto"/> <p className="text-sm text-gray-400 mt-2">Таблицы и диаграммы - важная часть ВПР!</p></div>
                            </section>

                            {/* Final Tip */}
                            <section className="border-t border-brand-green/20 pt-8 mt-10 text-center">
                                <h2 className="flex items-center justify-center text-2xl md:text-3xl font-semibold text-brand-green mb-4">
                                    <FontAwesomeIcon icon={FaAtlas} className="mr-3 text-brand-green/80" /> Главное - Практика!
                                </h2>
                                <p className="text-gray-300 text-base md:text-lg leading-relaxed max-w-3xl mx-auto">
                                    Эта шпаргалка - твой надежный помощник. Но лучший способ подготовиться - решать <strong className="text-brand-green font-semibold">демоверсии ВПР</strong> и <strong className="text-brand-green font-semibold">задания прошлых лет</strong>. Особое внимание удели работе с <strong className="text-brand-green font-semibold">топографическими картами</strong>, <strong className="text-brand-green font-semibold">атласом</strong>, <strong className="text-brand-green font-semibold">условными знаками</strong> и <strong className="text-brand-green font-semibold">таблицами</strong>. Тренируйся, и у тебя все получится!
                                </p>
                                <div className="mt-8">
                                    <Link href="/vpr-tests" legacyBehavior>
                                      <a className="text-blue-400 hover:text-blue-300 hover:underline text-lg font-semibold transition-colors duration-200">
                                         &larr; Вернуться к выбору тестов ВПР
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

export default VprGeographyCheatsheet6; // Updated component name