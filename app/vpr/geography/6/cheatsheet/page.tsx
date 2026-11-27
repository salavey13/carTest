"use client";
 // Ensure this is at the top

import React from 'react';
import { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Standardized ALL icon imports from react-icons/fa6
import {
 FaWater, FaCompass, FaRulerCombined, FaMountainSun, // Replaced FaMountain
    FaUserSecret, FaTemperatureHalf, // Replaced FaThermometerHalf
    FaCloudSunRain, FaWind, FaTree, FaPaw, FaGlobe, FaTable, FaRegCompass,
    FaImage, FaMapLocationDot, // Replaced FaMapMarkedAlt
    FaBookOpen, FaMap, FaUsers, FaBookAtlas, FaSmog, FaSatelliteDish // Added missing + Replaced FaAtlas
} from "react-icons/fa6";
 
const tooltipDescriptions: Record<string, string> = {
    'continents-*.png': "Карта мира с выделенными и подписанными 6 материками (Евразия, Африка, Сев. Америка, Юж. Америка, Австралия, Антарктида) и 4 основными океанами (Тихий, Атлантический, Индийский, Северный Ледовитый). Важно помнить их взаимное расположение и примерные очертания.",
    'latitude-*.png': "Земной шар с градусной сеткой. Параллели (горизонтальные линии) показывают широту (от 0° на экваторе до 90° на полюсах, северная или южная). Меридианы (вертикальные линии) показывают долготу (от 0° на Гринвиче до 180°, западная или восточная). Координаты точки - это пересечение ее параллели и меридиана.",
    'explorers-*.png': "Коллаж портретов: Магеллан (первое кругосветное плавание), Колумб (открытие Америки для европейцев), Васко да Гама (морской путь в Индию), Кук (исследование Тихого океана, Австралии), Беллинсгаузен и Лазарев (открытие Антарктиды), Миклухо-Маклай и Тасман (исследование Океании и Австралии). Важно знать их вклад в изучение Земли.",
    'IMG_20250420_010735.jpg': "Численный масштаб (1:10000) показывает, во сколько раз уменьшено изображение. Именованный (в 1 см 100 м) говорит, сколько метров/км на местности соответствует 1 см на карте. Для расчета расстояния измеряем отрезок линейкой (см) и умножаем на величину именованного масштаба (например, на 100 м/см). Не забывай переводить метры в километры при необходимости (1 км = 1000 м).",
    'IMG_20250420_010521.jpg': "Стороны горизонта (Север, Юг, Запад, Восток и промежуточные СЗ, СВ, ЮЗ, ЮВ) помогают определить общее направление движения или расположения объектов. Азимут - точный угол (от 0° до 360°) от направления на Север по часовой стрелке до направления на объект. Определяется компасом или транспортиром на карте.",
    '3topo.png': "Топографическая карта: Горизонтали (линии равных высот) показывают рельеф (близко = круто, далеко = полого). Бергштрих - короткая черточка на горизонтали, показывающая направление понижения склона (куда стекает вода). Стрелка на реке указывает направление течения (правый/левый берег определяются стоя по течению). Условные знаки обозначают объекты (лес, дом, родник, болото, дорога, мост, школа и т.д.).",
    'geo-natural-zones-*.png': "Коллаж ландшафтов: Арктическая пустыня/Тундра (снег, лед, мхи, лишайники, мало тепла), Тайга (хвойный лес, умеренный климат, четкие сезоны), Степь (травы, плодородные почвы, засушливое лето), Пустыня (жарко/холодно, очень сухо, песок/камни, редкая растительность), Саванна (травы, редкие деревья, жаркий климат с сухим и влажным сезонами, Африка), Влажный экваториальный лес (джунгли, жарко и влажно круглый год, буйная растительность).",
    'geo-weather-symbols-*.png': "Основные условные знаки погоды: Солнце (ясно), Солнце за тучей (переменная облачность), Туча (облачно), Туча с каплями (дождь), Туча со снежинками (снег), Стрелка ветра (показывает направление ОТКУДА дует, скорость по числу 'перьев' на хвосте), Три горизонтальные линии (туман), Капля на поверхности (роса).",
    'geo-wind-rose-*.png': "Роза ветров: График повторяемости ветров разных направлений. Лучи показывают частоту ветра С указанного направления (самый длинный луч = преобладающий ветер). Длина луча пропорциональна числу дней или %. Цифра в центре круга - процент штиля (безветрия). Разные цвета/отрезки на лучах могут показывать разную скорость ветра.",
    'geo-atmosphere-*.png': "Примеры атмосферных явлений: Гроза (мощные кучево-дождевые облака, молнии, гром, сильный ливень, иногда град, шквалистый ветер) и Торнадо/Смерч (сильный вращающийся вихрь воздуха, связанный с грозовым облаком, опускающийся к земле). Оба явления происходят в нижнем слое атмосферы - Тропосфере.",
    'life-*.png': "Биосфера - это 'оболочка жизни', охватывающая все живые организмы (растения, животные, грибы, микроорганизмы) и ту часть Земли, где они обитают (нижняя атмосфера, вся гидросфера, верхняя литосфера). Организмы тесно взаимодействуют друг с другом и с неживой природой.",
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
        <div className={`p-2 border border-gray-500/30 rounded-lg ${bgColor} hover:shadow-lg hover:shadow-purple-500/20 transition-shadow duration-300`}>

            <p className="text-xs text-center text-gray-400 mt-1 italic">{alt.split(':')[0]}</p> {/* Shorten alt for caption */}
        </div>
    );


    return (
        <div className="flex flex-col min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 text-gray-200">
            <Head>
                <title>ВПР География 6 класс: Шпаргалка</title>
                <meta name="description" content="Подробная шпаргалка по географии для подготовки к ВПР в 6 классе: карты, оболочки Земли, погода, климат, топография, страны." />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            
                <main className="flex-grow container mx-auto px-4 py-12 md:py-16">
                    <h1 className="text-3xl md:text-5xl font-bold mb-8 text-center text-brand-green cyber-text glitch" data-text="ВПР География 6 класс: Шпаргалка">
                        {/* Use Fa6 icon */}
                        <FaBookOpen className="mr-3 text-brand-green/80 inline-block" />
                        ВПР География 6 класс: Шпаргалка
                    </h1>
          {/* HERO-иллюстрация (task220) */}
          <div className="relative mb-6 overflow-hidden rounded-none border" style={{ borderColor: "#14b8a633" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/task220/geography-6.jpg"
              alt="География 6 класс — неоновая иллюстрация"
              className="w-full h-auto opacity-80"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#030712] via-transparent to-transparent" />
          </div>

                    <Card className="max-w-6xl mx-auto bg-black/85 backdrop-blur-lg text-white rounded-2xl border border-brand-purple/40 shadow-[0_0_30px_rgba(157,0,255,0.3)]">
                         <CardHeader className="text-center border-b border-brand-purple/20 pb-4 pt-6">
                            <p className="text-md md:text-lg text-gray-300 mt-2 font-mono">
                              Ключевые темы для успешной сдачи ВПР! 🌍🧭📊
                            </p>
                         </CardHeader>

                        <CardContent className="space-y-16 p-4 md:p-8">

                            {/* Section: Карта Мира */}
                            <section className="space-y-6">
                                <h2 className="flex items-center text-2xl md:text-3xl font-semibold text-cyan-400 mb-4 border-b-2 border-cyan-500/40 pb-3">
                                    {/* Use Fa6 icon */}
                                    <FaGlobe className="mr-3 text-cyan-400/80 fa-fw" /> Карта Мира: Основы
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                    {/* Subsection: Материки и Океаны */}
                                    <div className="border-l-4 border-cyan-700 pl-4">
                                         {/* Use Fa6 icon */}
                                        <h3 className="flex items-center text-xl font-semibold text-cyan-300 mb-3"> <FaWater className="mr-2 text-cyan-300/80 fa-fw" /> Материки и Океаны </h3>
                                        <p className="text-gray-300 text-base md:text-lg mb-4">Необходимо уверенно находить на карте 6 материков (Евразия, Африка, Северная Америка, Южная Америка, Австралия, Антарктида) и 4-5 океанов (Тихий, Атлантический, Индийский, Северный Ледовитый; Южный). Обращай внимание на их относительные размеры и расположение друг относительно друга (кто соседи?).</p>
                                        <ImageWithTooltip src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/continents-99913414-d4cb-4624-9779-6a7498cbf67a.png" alt="Материки и океаны: Где какой?" width={600} height={338} tooltipKeyPart="continents-*.png" aspect="square" />
                                    </div>
                                    {/* Subsection: Координаты и Направления */}
                                    <div className="border-l-4 border-cyan-700 pl-4">
                                         {/* Use Fa6 icon */}
                                        <h3 className="flex items-center text-xl font-semibold text-cyan-300 mb-3"> <FaCompass className="mr-2 text-cyan-300/80 fa-fw" /> Координаты и Направления </h3>
                                        <ul className="list-disc list-inside space-y-1.5 text-gray-300 pl-4 text-base md:text-lg mb-4">
                                            <li><strong>Географические координаты:</strong> Широта (градусы к северу или югу от экватора, 0-90°, с.ш./ю.ш.) + Долгота (градусы к западу или востоку от Гринвича, 0-180°, з.д./в.д.). Практикуйся находить точку по координатам и определять координаты заданного объекта.</li>
                                            <li><strong>Стороны горизонта:</strong> Определяй направление от одного объекта к другому (например, Африка находится к югу от Евразии, Тихий океан к востоку от Азии). Используй основные (С, Ю, З, В) и промежуточные (СЗ, СВ, ЮЗ, ЮВ) направления.</li>
                                        </ul>
                                        <ImageWithTooltip src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/latitude-d685bb88-e694-408c-b01d-d285edc6ff29.png" alt="Координаты: Широта и долгота?" width={400} height={400} tooltipKeyPart="latitude-*.png" aspect="square" />
                                    </div>
                                    {/* Subsection: Путешественники */}
                                    <div className="border-l-4 border-cyan-700 pl-4 lg:col-span-1 md:col-span-2">
                                         {/* Use Fa6 icon */}
                                        <h3 className="flex items-center text-xl font-semibold text-cyan-300 mb-3"> <FaUserSecret className="mr-2 text-cyan-300/80 fa-fw" /> Великие Путешественники </h3>
                                        <p className="text-gray-300 text-base md:text-lg mb-4">Узнавай по портретам и кратко опиши главные открытия/маршруты (особенно тех, кто связан с материками А и Б из задания 1 ВПР). Например: Магеллан (доказал шарообразность Земли), Колумб (путь в Америку), Васко да Гама (морской путь в Индию), Джеймс Кук (Тихий океан), Беллинсгаузен и Лазарев (Антарктида), Тасман и Миклухо-Маклай (Австралия, Океания).</p>
                                        <ImageWithTooltip src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/explorers-673a4b3e-1fdb-42e3-bc14-990493afe92d.png" alt="Путешественники: Узнаешь их?" width={600} height={338} tooltipKeyPart="explorers-*.png" aspect="video" />
                                    </div>
                                    {/* Subsection: Географические Объекты по описанию */}
                                     <div className="border-l-4 border-cyan-700 pl-4 md:col-span-2 lg:col-span-3">
                                         {/* Use Fa6 icon */}
                                        <h3 className="flex items-center text-xl font-semibold text-cyan-300 mb-3"> <FaImage className="mr-2 text-cyan-300/80 fa-fw" /> Узнаем по Описанию / Фото / Снимку </h3>
                                        <p className="text-gray-300 text-base md:text-lg">Часто нужно определить крупный географический объект (остров, полуостров, горы, равнину, реку, озеро, море, залив, пролив) по его характерным чертам, краткому описанию или космическому снимку. Обращай внимание на форму, размеры, положение относительно других объектов, климатические особенности. Пример: Мадагаскар (крупный остров у Африки), Амазонка (самая полноводная река в Южной Америке), Анды (длинные горы на западе Южной Америки), Гималаи (высочайшие горы в Азии), Аравийский п-ов (крупнейший полуостров).</p>
                                    </div>
                                </div>
                            </section>

                            {/* Section: Топографическая Карта */}
                            <section className="space-y-6 border-t-2 border-orange-500/30 pt-8">
                                <h2 className="flex items-center text-2xl md:text-3xl font-semibold text-orange-400 mb-4 border-b-2 border-orange-500/40 pb-3">
                                     {/* Use Fa6 icon */}
                                    <FaMapLocationDot className="mr-3 text-orange-400/80 fa-fw" /> Топографическая Карта: Читаем Местность
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    {/* Subsection: Масштаб и Расстояния */}
                                    <div className="border-l-4 border-orange-700 pl-4">
                                         {/* Use Fa6 icon */}
                                        <h3 className="flex items-center text-xl font-semibold text-orange-300 mb-3"> <FaRulerCombined className="mr-2 text-orange-300/80 fa-fw" /> Масштаб и Расстояния </h3>
                                        <ul className="list-disc list-inside space-y-1.5 text-gray-300 pl-4 text-base md:text-lg mb-4">
                                            <li><strong>Виды масштаба:</strong> Численный (дробь, 1:10000) показывает степень уменьшения. Именованный (текстом, в 1 см - 100 м) удобен для расчетов. Линейный (график) для измерения циркулем.</li>
                                            <li><strong>Измерение:</strong> Приложи линейку к карте, измерь расстояние между точками в сантиметрах.</li>
                                            <li><strong>Расчет:</strong> Умножь измеренное расстояние (см) на величину именованного масштаба (число метров или км в 1 см). Пример: на карте 3 см, масштаб в 1 см 100 м. Расстояние = 3 * 100 = 300 м.</li>
                                            <li><strong>Точность:</strong> Старайся измерять как можно точнее, особенно если линия изогнутая (используй нитку или курвиметр, если разрешено).</li>
                                        </ul>
                                        <ImageWithTooltip src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/IMG_20250420_010735.jpg" alt="Масштаб: Как рассчитать расстояние?" width={600} height={338} tooltipKeyPart="IMG_20250420_010735.jpg" aspect="video" />
                                    </div>

                                    {/* Subsection: Направления и Азимут */}
                                    <div className="border-l-4 border-orange-700 pl-4">
                                        {/* Use Fa6 icon */}
                                        <h3 className="flex items-center text-xl font-semibold text-orange-300 mb-3"> <FaRegCompass className="mr-2 text-orange-300/80 fa-fw" /> Направления и Азимут </h3>
                                        <ul className="list-disc list-inside space-y-1.5 text-gray-300 pl-4 text-base md:text-lg mb-4">
                                            <li><strong>Стороны горизонта:</strong> Основные (Север, Юг, Запад, Восток) и промежуточные (Северо-Запад, Северо-Восток, Юго-Запад, Юго-Восток). Умей определять их на карте (обычно север сверху).</li>
                                            <li><strong>Определение направления:</strong> Мысленно встань в начальную точку, посмотри на конечную и определи, в каком секторе она находится (например, школа находится от моста на юго-восток).</li>
                                            <li><strong>Азимут (важно!):</strong> Угол от 0° до 360° между направлением на СЕВЕР и направлением на объект, измеряемый ПО ЧАСОВОЙ СТРЕЛКЕ. Используй транспортир: центр в начальной точке, 0° на север, измерь угол до линии на объект.</li>
                                        </ul>
                                         <ImageWithTooltip src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/IMG_20250420_010521.jpg" alt="Направления и азимут: Определяем курс?" width={400} height={400} tooltipKeyPart="IMG_20250420_010521.jpg" aspect="square" />
                                    </div>

                                    {/* Subsection: Рельеф и Условные Знаки */}
                                    <div className="border-l-4 border-orange-700 pl-4">
                                        {/* Use Fa6 icon */}
                                        <h3 className="flex items-center text-xl font-semibold text-orange-300 mb-3"> <FaMountainSun className="mr-2 text-orange-300/80 fa-fw" /> Рельеф и Условные Знаки </h3>
                                        <ul className="list-disc list-inside space-y-1.5 text-gray-300 pl-4 text-base md:text-lg mb-4">
                                            <li><strong>Горизонтали (Изогипсы):</strong> Линии, соединяющие точки с одинаковой абсолютной высотой. Их значения подписаны. Сближение = крутой склон, расхождение = пологий.</li>
                                            <li><strong>Бергштрих:</strong> Короткая черточка на горизонтали, направленная в сторону понижения склона. Помогает определить холм или впадину.</li>
                                            <li><strong>Условные знаки:</strong> Выучи НАИЗУСТЬ основные знаки ВПР: лес (хвойный, лиственный, смешанный), луг, кустарник, река (со стрелкой течения), озеро, болото, родник, колодец, мост (деревянный, металлический), дом (жилой, нежилой), школа, церковь, пашня, сад, обрыв, яма, шоссе, улучшенная грунтовая дорога, тропа, ЛЭП.</li>
                                            <li><strong>Профиль рельефа:</strong> График, показывающий вид местности в разрезе по заданной линии. Строится по высотам точек пересечения линии с горизонталями.</li>
                                            <li><strong>Выбор участка:</strong> Анализируй карту для выбора места под разные цели (ровная площадка для футбола - горизонтали далеко; крутой склон для санок - горизонтали близко; ферма - у воды, у дороги, на ровном месте).</li>
                                        </ul>
                                        <ImageWithTooltip src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/3topo.png" alt="Топокарта: Читаем рельеф и знаки?" width={600} height={338} tooltipKeyPart="3topo.png" aspect="square" />
                                    </div>
                                </div>
                            </section>

                            {/* Section: Географические Оболочки и Природа Земли */}
                            <section className="space-y-6 border-t-2 border-green-500/30 pt-8">
                                <h2 className="flex items-center text-2xl md:text-3xl font-semibold text-green-400 mb-4 border-b-2 border-green-500/40 pb-3">
                                    {/* Use Fa6 icon */}
                                    <FaGlobe className="mr-3 text-green-400/80 fa-fw" /> Оболочки Земли и Природа
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                    {/* Subsection: Оболочки */}
                                    <div className="border-l-4 border-green-700 pl-4">
                                         {/* Use Fa6 icon */}
                                        <h3 className="flex items-center text-xl font-semibold text-green-300 mb-3"> <FaGlobe className="mr-2 text-green-300/80 fa-fw" /> Оболочки Земли </h3>
                                        <ul className="list-disc list-inside space-y-1.5 text-gray-300 pl-4 text-base md:text-lg mb-4">
                                            <li><strong>Литосфера:</strong> Твердая оболочка (земная кора, верхняя мантия). Включает рельеф (горы, равнины). Процессы: землетрясения, вулканизм, выветривание, движение литосферных плит.</li>
                                            <li><strong>Гидросфера:</strong> Водная оболочка (океаны, моря, реки, озера, ледники, подземные воды, вода в атмосфере). Процессы: круговорот воды, течения, волны, приливы/отливы, замерзание/таяние.</li>
                                            <li><strong>Атмосфера:</strong> Воздушная оболочка. Слои: тропосфера (где погода), стратосфера (озоновый слой), и т.д. Состав: азот, кислород и др. Процессы: ветер, осадки, облака, грозы, изменение давления и температуры.</li>
                                            <li><strong>Биосфера:</strong> Оболочка жизни (все живые организмы). Процессы: фотосинтез, дыхание, питание, размножение, взаимодействие организмов, образование почвы.</li>
                                        </ul>
                                         <p className="text-gray-300 text-base md:text-lg mb-4">Умей относить природные явления (дождь, землетрясение, цветение, извержение вулкана, таяние ледника) к соответствующей оболочке.</p>
                                         <div className="space-y-4">
                                            <ImageWithTooltip src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/geo-atmosphere-collage-eff574ec-a074-4dea-be8c-4746a9175e86.png" alt="Атмосфера: Гроза и торнадо?" width={400} height={225} tooltipKeyPart="geo-atmosphere-*.png" aspect="square" />
                                            <ImageWithTooltip src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/life-77b646d5-16f4-45e1-ab80-a810340f6c40.png" alt="Биосфера: Разнообразие жизни?" width={400} height={225} tooltipKeyPart="life-*.png" aspect="square" />
                                         </div>
                                    </div>
                                    {/* Subsection: Природные Зоны */}
                                    <div className="border-l-4 border-green-700 pl-4">
                                        {/* Use Fa6 icon */}
                                        <h3 className="flex items-center text-xl font-semibold text-green-300 mb-3"> <FaPaw className="mr-2 text-green-300/80 fa-fw" /> Природные Зоны (ПЗ) </h3>
                                        <p className="text-gray-300 text-base md:text-lg mb-4">Крупные участки суши с закономерно повторяющимися сочетаниями климата, почв, растительности и животного мира. Их смена зависит в первую очередь от географической широты (количества тепла и влаги).</p>
                                        <ul className="list-disc list-inside space-y-1 text-gray-300 pl-4 text-sm md:text-base mb-4">
                                             <li><strong>Аркт. пустыни/Тундра:</strong> Очень холодно, мало осадков, вечная мерзлота, мхи, лишайники, карликовые ивы/березы, сев. олень, песец, лемминг.</li>
                                             <li><strong>Тайга:</strong> Умеренный пояс (холодная зима, теплое лето), хвойные леса (ель, пихта, сосна, лиственница), подзолистые почвы, бурый медведь, лось, волк, белка.</li>
                                             <li><strong>Смешанные/Широколиств. леса:</strong> Умеренный пояс (теплее тайги), смешанные или лиственные деревья (дуб, клен, береза), более плодородные почвы, олень, кабан, лиса.</li>
                                             <li><strong>Степи/Лесостепи:</strong> Умеренный пояс (теплое, засушливое лето), преобладание трав, плодородные черноземы, грызуны (суслики, хомяки), степные орлы, сайгаки.</li>
                                             <li><strong>Пустыни/Полупустыни:</strong> Разные пояса, очень сухо, большие перепады температур, песок/камни, скудная растительность (саксаул, верблюжья колючка, кактусы), верблюды, змеи, ящерицы.</li>
                                             <li><strong>Саванны:</strong> Субэкваториальный пояс, жарко, четкий сухой и влажный сезоны, высокие травы, редкие деревья (акация, баобаб), красно-бурые почвы, слоны, жирафы, зебры, львы (особенно в Африке).</li>
                                             <li><strong>Влажные экваториальные леса (Гилея):</strong> Экваториальный пояс, жарко и влажно круглый год, многоярусный вечнозеленый лес, лианы, красно-желтые ферраллитные почвы, обезьяны, попугаи, змеи, огромное разнообразие насекомых.</li>
                                        </ul>
                                         <ImageWithTooltip src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/geo-natural-zones-3f1c6f06-3cdd-49e4-91ee-b551ed244290.png" alt="Природные зоны: Где кто живет?" width={600} height={338} tooltipKeyPart="geo-natural-zones-*.png" aspect="square" />
                                    </div>
                                     {/* Subsection: Погода и Климат */}
                                    <div className="border-l-4 border-green-700 pl-4">
                                         {/* Use Fa6 icon */}
                                        <h3 className="flex items-center text-xl font-semibold text-green-300 mb-3"> <FaCloudSunRain className="mr-2 text-green-300/80 fa-fw" /> Погода и Климат </h3>
                                        <ul className="list-disc list-inside space-y-1.5 text-gray-300 pl-4 text-base md:text-lg mb-4">
                                            <li><strong>Погода:</strong> Состояние тропосферы в данном месте в данный момент (или за короткий период). Характеристики: температура воздуха (t°), атм. давление, ветер (направление, скорость), влажность, облачность, осадки. Погода изменчива.</li>
                                            <li><strong>Климат:</strong> Многолетний (десятки лет) режим погоды, типичный для данной местности. Определяется климатообразующими факторами (геогр. широта, близость океана, рельеф и др.). Климат определяет ПЗ.</li>
                                            <li><strong>Условные знаки погоды:</strong> Необходимо знать для чтения синоптических карт и дневников наблюдений.</li>
                                            <li><strong>Ветер:</strong> Горизонтальное движение воздуха из области высокого давления в область низкого. Роза ветров показывает преобладающие направления (откуда дует чаще всего). Скорость измеряется анемометром (м/с).</li>
                                            <li><strong>Температура воздуха:</strong> Измеряется термометром (°C). Среднесуточная t° = сумма всех измерений за сутки / число измерений. Амплитуда t° = max t° - min t°.</li>
                                            <li><strong>Смена дня и ночи:</strong> Результат вращения Земли вокруг своей оси (период ~24 часа).</li>
                                            <li><strong>Смена времен года:</strong> Результат вращения Земли вокруг Солнца и наклона земной оси к плоскости орбиты (период ~365 дней).</li>
                                        </ul>
                                        <div className="grid grid-cols-2 gap-4">
                                          <ImageWithTooltip src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/geo-weather-symbols-9deca9a2-1000-47f7-a13b-cf3c2e4980dd.png" alt="Знаки погоды: Расшифровываем?" width={400} height={400} tooltipKeyPart="geo-weather-symbols-*.png" aspect="square" bgColor="bg-white/90" />
                                          <ImageWithTooltip src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/geo-wind-rose.png-bc50103a-016a-4d39-a1a6-595d018ec926.jpg" alt="Роза ветров: Какой ветер главный?" width={400} height={400} tooltipKeyPart="geo-wind-rose-*.png" aspect="square" />
                                        </div>
                                    </div>
                                </div>
                             </section>

                            {/* Section: Человек на Земле */}
                            <section className="space-y-6 border-t-2 border-yellow-500/30 pt-8">
                                <h2 className="flex items-center text-2xl md:text-3xl font-semibold text-yellow-400 mb-4 border-b-2 border-yellow-500/40 pb-3">
                                    {/* Use Fa6 icon */}
                                    <FaUsers className="mr-3 text-yellow-400/80 fa-fw" /> Человек на Земле: Страны и Статистика
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="border-l-4 border-yellow-700 pl-4">
                                         {/* Use Fa6 icon */}
                                        <h3 className="flex items-center text-xl font-semibold text-yellow-300 mb-3"> <FaTable className="mr-2 text-yellow-300/80 fa-fw" /> Работа с Таблицами и Диаграммами </h3>
                                        <ul className="list-disc list-inside space-y-1.5 text-gray-300 pl-4 text-base md:text-lg">
                                            <li><strong>Извлечение данных:</strong> Внимательно читай заголовки строк и столбцов. Находи конкретные значения (например, численность населения Китая, площадь России).</li>
                                            <li><strong>Сравнение:</strong> Сравнивай показатели разных стран (У какой страны ВВП на душу населения выше? Какая страна имеет большую площадь?).</li>
                                            <li><strong>Ранжирование:</strong> Располагай страны/регионы в порядке возрастания или убывания по заданному показателю (например, по численности населения).</li>
                                            <li><strong>Расчет доли:</strong> Вычисляй долю городского/сельского населения (например, (число горожан / общая численность) * 100%).</li>
                                            <li><strong>Анализ диаграмм:</strong> Определяй наибольшие/наименьшие значения по столбчатым или круговым диаграммам (например, какая отрасль экономики преобладает в стране?).</li>
                                        </ul>
                                        {/* Use Fa6 icon */}
                                        <div className="text-center my-6"><FaTable className="text-6xl text-yellow-400/60 mx-auto hover:text-yellow-300 transition-colors"/> <p className="text-sm text-gray-400 mt-2">Таблицы и диаграммы - ключ к успеху в заданиях 7-8!</p></div>
                                    </div>
                                    <div className="border-l-4 border-yellow-700 pl-4">
                                         {/* Use Fa6 icon */}
                                        <h3 className="flex items-center text-xl font-semibold text-yellow-300 mb-3"> <FaMap className="mr-2 text-yellow-300/80 fa-fw" /> Страны, Народы, Объекты </h3>
                                        <ul className="list-disc list-inside space-y-1.5 text-gray-300 pl-4 text-base md:text-lg">
                                            <li><strong>Фото и страна/регион:</strong> Умей соотносить фотографии типичных ландшафтов, известных достопримечательностей, национальных костюмов или животных с определенной страной или регионом России (например, самурай - Япония, тундра с оленями - Север России).</li>
                                            <li><strong>Столицы:</strong> Знай столицы крупнейших стран мира и стран-соседей России (Пекин, Вашингтон, Дели, Астана, Минск, Киев и др.).</li>
                                            <li><strong>Народы России:</strong> Имей представление о народах, населяющих разные регионы России (татары, башкиры, якуты, народы Кавказа и др.) и их традициях.</li>
                                            <li><strong>Всемирное наследие:</strong> Знай несколько объектов Всемирного природного и культурного наследия ЮНЕСКО в России (Байкал, вулканы Камчатки, Кремль и Красная площадь) и в мире (Пирамиды Египта, Великая Китайская стена, Тадж-Махал).</li>
                                            <li><strong>Влияние человека на природу:</strong> Понимай основные экологические проблемы (загрязнение воздуха/воды, мусор, вырубка лесов, истощение ресурсов) и пути их решения (заповедники, переработка отходов, 'зеленая' энергетика).</li>
                                        </ul>
                                    </div>
                                </div>
                            </section>

                            {/* Final Tip */}
                            <section className="border-t-2 border-brand-green/30 pt-8 mt-12 text-center">
                                <h2 className="flex items-center justify-center text-2xl md:text-3xl font-semibold text-brand-green mb-4">
                                     {/* Use Fa6 icon */}
                                    <FaBookAtlas className="mr-3 text-brand-green/80 fa-fw" /> Главное - Практика и Атлас!
                                </h2>
                                <p className="text-gray-300 text-base md:text-lg leading-relaxed max-w-3xl mx-auto">
                                    Эта шпаргалка поможет вспомнить ключевые моменты. Но самый эффективный способ подготовки - это <strong className="text-brand-green font-semibold">решение демоверсий ВПР</strong> и заданий прошлых лет с использованием <strong className="text-brand-green font-semibold">школьного атласа за 6 класс</strong>. Учись быстро находить нужную информацию на картах, понимать условные знаки и анализировать таблицы.
                                    <br /> <br />
                                    Не бойся заданий, внимательно читай условия и используй все свои знания! Удачи!
                                </p>
                                <div className="mt-10">
                                    <Link href="/vpr-tests" legacyBehavior>
                                      <a className="inline-block bg-gradient-to-r from-green-500 to-cyan-500 hover:from-green-400 hover:to-cyan-400 text-white font-bold py-3 px-6 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5">
                                         &larr; К другим тестам и шпаргалкам ВПР
                                      </a>
                                    </Link>
                                </div>
                            </section>

                        </CardContent>
                    </Card>
                </main>
            

            {/* Optional Footer could be added here */}
        </div>
    );
};

export default VprGeographyCheatsheet6;