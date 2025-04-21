import React from 'react';
import { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { FaGlobeEurope, FaWater, FaWind, FaTree, FaMountain, FaTint, FaSmog, FaLeaf, FaCloudSunRain, FaCompass, FaThermometerHalf, FaMapMarkedAlt, FaBookOpen, FaRulerCombined, FaSatelliteDish } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';


const GeographyCheatsheet: NextPage = () => {
    return (
        <div className="flex flex-col min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
            <Head>
                <title>Шпаргалка по Географии (6 класс)</title>
                <meta name="description" content="Краткая шпаргалка по основным темам географии для 6 класса: оболочки Земли, погода, климат, план и карта." />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            

            <main className="flex-grow container mx-auto px-4 py-8">
                <h1 className="text-3xl md:text-4xl font-bold mb-6 text-center text-blue-700 dark:text-blue-300">
                    <FontAwesomeIcon icon={FaBookOpen} className="mr-3" />
                    Шпаргалка по Географии (6 класс)
                </h1>

                {/* Оболочки Земли */}
                <section className="mb-12 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                    <h2 className="text-2xl font-semibold mb-4 text-blue-600 dark:text-blue-400 flex items-center">
                        <FontAwesomeIcon icon={FaGlobeEurope} className="mr-2" /> Географические оболочки Земли
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Литосфера */}
                        <div className="border-l-4 border-yellow-500 pl-4">
                            <h3 className="text-xl font-medium mb-2 text-yellow-700 dark:text-yellow-400 flex items-center">
                                <FontAwesomeIcon icon={FaMountain} className="mr-2" /> Литосфера
                            </h3>
                            <p className="text-gray-700 dark:text-gray-300">
                                <strong>Литосфера</strong> - это твердая, каменная оболочка Земли. Она включает земную кору и верхнюю часть мантии.
                                <br />
                                <strong>Земная кора</strong> бывает двух типов:
                                <ul>
                                    <li><strong>Материковая:</strong> толще (30-70 км), состоит из 3 слоев (осадочный, гранитный, базальтовый). Образует материки и шельфы.</li>
                                    <li><strong>Океаническая:</strong> тоньше (5-10 км), состоит из 2 слоев (осадочный, базальтовый). Образует дно океанов.</li>
                                </ul>
                                <strong>Рельеф</strong> - это совокупность неровностей земной поверхности (горы, равнины, холмы, овраги). Основные формы рельефа суши: горы и равнины. Основные формы рельефа дна океана: шельф, материковый склон, ложе океана, глубоководные желоба, срединно-океанические хребты.
                                <br />
                                Литосферные плиты находятся в постоянном движении из-за конвекционных потоков в мантии, что приводит к землетрясениям, вулканизму и образованию гор.
                            </p>
                        </div>

                        {/* Гидросфера */}
                        <div className="border-l-4 border-blue-500 pl-4">
                            <h3 className="text-xl font-medium mb-2 text-blue-700 dark:text-blue-400 flex items-center">
                                <FontAwesomeIcon icon={FaWater} className="mr-2" /> Гидросфера
                            </h3>
                            <p className="text-gray-700 dark:text-gray-300">
                                <strong>Гидросфера</strong> - это водная оболочка Земли. Она включает всю воду в жидком, твердом (лед, снег) и газообразном (водяной пар) состоянии.
                                <br />
                                <strong>Состав:</strong>
                                <ul>
                                    <li><strong>Мировой океан:</strong> Основная часть гидросферы (~96.5%). Включает океаны (Тихий, Атлантический, Индийский, Северный Ледовитый, Южный), моря, заливы, проливы. Вода соленая.</li>
                                    <li><strong>Воды суши:</strong> Реки, озера, болота, ледники, подземные воды. В основном пресные (кроме некоторых соленых озер и подземных вод). Ледники содержат основной запас пресной воды.</li>
                                    <li><strong>Вода в атмосфере:</strong> Водяной пар, облака, осадки.</li>
                                </ul>
                                <strong>Круговорот воды в природе</strong> - непрерывный процесс перемещения воды из океана на сушу (через атмосферу) и обратно. Основные этапы: испарение, перенос водяного пара, конденсация (образование облаков), выпадение осадков, сток (поверхностный и подземный).
                            </p>
                        </div>

                        {/* Атмосфера */}
                        <div className="border-l-4 border-sky-500 pl-4">
                            <h3 className="text-xl font-medium mb-2 text-sky-700 dark:text-sky-400 flex items-center">
                                <FontAwesomeIcon icon={FaWind} className="mr-2" /> Атмосфера
                            </h3>
                            <p className="text-gray-700 dark:text-gray-300">
                                <strong>Атмосфера</strong> - это газовая (воздушная) оболочка Земли, удерживаемая силой притяжения. Защищает Землю от вредного излучения и метеоритов.
                                <br />
                                <strong>Состав воздуха:</strong> Азот (~78%), Кислород (~21%), Аргон (~0.9%), Углекислый газ (~0.04%), другие газы.
                                <br />
                                <strong>Строение:</strong>
                                <ul>
                                    <li><strong>Тропосфера:</strong> Нижний слой (до 8-18 км). Содержит ~80% массы атмосферы и почти весь водяной пар. Здесь формируется погода. Температура убывает с высотой.</li>
                                    <li><strong>Стратосфера:</strong> Выше тропосферы (до 50-55 км). Содержит озоновый слой, защищающий от УФ-излучения. Температура растет с высотой.</li>
                                    <li><strong>Верхние слои:</strong> Мезосфера, термосфера, экзосфера. Воздух очень разрежен.</li>
                                </ul>
                                Атмосфера влияет на климат, погоду, обеспечивает дыхание живых организмов.
                            </p>
                             <img src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/geo-atmosphere-collage-eff574ec-a074-4dea-be8c-4746a9175e86.png" alt="Атмосферные явления" className="mt-4 rounded-lg shadow-sm w-full max-w-xs mx-auto" />
                        </div>

                        {/* Биосфера */}
                        <div className="border-l-4 border-green-500 pl-4">
                            <h3 className="text-xl font-medium mb-2 text-green-700 dark:text-green-400 flex items-center">
                                <FontAwesomeIcon icon={FaTree} className="mr-2" /> Биосфера
                            </h3>
                            <p className="text-gray-700 dark:text-gray-300">
                                <strong>Биосфера</strong> - это оболочка Земли, заселенная живыми организмами ("оболочка жизни"). Она охватывает нижнюю часть атмосферы, всю гидросферу и верхнюю часть литосферы.
                                <br />
                                <strong>Компоненты:</strong> Растения, животные, грибы, бактерии.
                                <br />
                                <strong>Границы:</strong> От озонового слоя в атмосфере до глубин океана и нескольких километров вглубь земной коры, где встречаются живые организмы.
                                <br />
                                <strong>Взаимодействие:</strong> Живые организмы активно взаимодействуют с другими оболочками Земли, изменяя их (например, растения создают почву и выделяют кислород, кораллы образуют рифы). Человек - часть биосферы, его деятельность оказывает значительное влияние на нее.
                                <br />
                                <strong>Природные зоны</strong> - крупные участки земной поверхности с однородным климатом, почвами, растительным и животным миром (например, тундра, тайга, степи, пустыни, саванны, влажные экваториальные леса).
                            </p>
                             <img src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/geo-natural-zones-3f1c6f06-3cdd-49e4-91ee-b551ed244290.png" alt="Природные зоны" className="mt-4 rounded-lg shadow-sm w-full max-w-sm mx-auto" />
                        </div>
                    </div>
                </section>

                {/* Погода и Климат */}
                <section className="mb-12 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                    <h2 className="text-2xl font-semibold mb-4 text-purple-600 dark:text-purple-400 flex items-center">
                        <FontAwesomeIcon icon={FaCloudSunRain} className="mr-2" /> Погода и Климат
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Погода */}
                        <div className="border-l-4 border-purple-500 pl-4">
                            <h3 className="text-xl font-medium mb-2 text-purple-700 dark:text-purple-400 flex items-center">
                                <FontAwesomeIcon icon={FaThermometerHalf} className="mr-2" /> Погода
                            </h3>
                            <p className="text-gray-700 dark:text-gray-300">
                                <strong>Погода</strong> - это состояние тропосферы в данном месте в данный момент времени (или за короткий промежуток - сутки, неделя).
                                <br />
                                <strong>Элементы погоды:</strong>
                                <ul>
                                    <li><strong>Температура воздуха (°C):</strong> Измеряется термометром. Суточный ход (max днем, min перед восходом), годовой ход (max летом, min зимой). Среднесуточная t° - среднее арифметическое измерений за сутки.</li>
                                    <li><strong>Атмосферное давление (мм рт.ст. или гПа):</strong> Сила, с которой воздух давит на земную поверхность. Измеряется барометром. Нормальное давление ~760 мм рт.ст. Уменьшается с высотой.</li>
                                    <li><strong>Ветер:</strong> Движение воздуха над земной поверхностью из области высокого давления в область низкого. Характеристики: <strong>направление</strong> (откуда дует, измеряется флюгером), <strong>скорость</strong> (м/с, км/ч, измеряется анемометром), <strong>сила</strong> (в баллах). См. Розу Ветров.</li>
                                    <li><strong>Влажность воздуха:</strong> Содержание водяного пара в воздухе. Абсолютная (г/м³) и относительная (%). Измеряется гигрометром.</li>
                                    <li><strong>Облачность:</strong> Степень покрытия неба облаками (в баллах от 0 до 10). Виды облаков: перистые, кучевые, слоистые.</li>
                                    <li><strong>Атмосферные осадки:</strong> Вода в жидком или твердом состоянии, выпадающая из облаков (дождь, снег, град) или осаждающаяся из воздуха (роса, иней, изморозь). Измеряются осадкомером (в мм).</li>
                                </ul>
                                <strong>Прогноз погоды:</strong> Научно обоснованное предсказание будущего состояния погоды. Составляется метеорологами на основе данных с метеостанций, спутников.
                            </p>
                            <img src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/geo-weather-symbols-9deca9a2-1000-47f7-a13b-cf3c2e4980dd.png" alt="Условные знаки погоды" className="mt-4 rounded-lg shadow-sm w-full max-w-xs mx-auto bg-white p-2" />
                        </div>

                        {/* Климат и Роза ветров */}
                        <div className="border-l-4 border-teal-500 pl-4">
                            <h3 className="text-xl font-medium mb-2 text-teal-700 dark:text-teal-400 flex items-center">
                                <FontAwesomeIcon icon={FaSmog} className="mr-2" /> Климат
                            </h3>
                            <p className="text-gray-700 dark:text-gray-300">
                                <strong>Климат</strong> - это многолетний режим погоды, характерный для данной местности. Определяется географическим положением, влиянием океанов, рельефом и др.
                                <br />
                                <strong>Климатообразующие факторы:</strong> Географическая широта (угол падения солнечных лучей), циркуляция атмосферы (ветры, воздушные массы), характер подстилающей поверхности (суша/вода, рельеф, растительность), океанические течения, высота над уровнем моря.
                                <br />
                                <strong>Климатические пояса:</strong> Широтные зоны с относительно однородным климатом (экваториальный, тропический, умеренный, арктический/антарктический и переходные).
                            </p>
                            <h4 className="text-lg font-medium mt-4 mb-2 text-teal-700 dark:text-teal-400 flex items-center">
                                <FontAwesomeIcon icon={FaCompass} className="mr-2" /> Роза ветров
                            </h4>
                            <p className="text-gray-700 dark:text-gray-300">
                                <strong>Роза ветров</strong> - это диаграмма, показывающая повторяемость (частоту) ветров разных направлений в данной местности за определенный период (месяц, год).
                                <br />
                                <strong>Как читать розу ветров (на примере):</strong>
                                <ul>
                                   <li>Круговая диаграмма показывает общее направление и скорость ветра.</li>
                                   <li>Направления обозначены по сторонам света. <strong>Важно:</strong> На картинке английские обозначения: N (North) - Север (С), NE (North-East) - Северо-Восток (СВ), E (East) - Восток (В), SE (South-East) - Юго-Восток (ЮВ), S (South) - Юг (Ю), SW (South-West) - Юго-Запад (ЮЗ), W (West) - Запад (З), NW (North-West) - Северо-Запад (СЗ).</li>
                                   <li>Лучи ("спицы") расходятся от центра. Направление луча указывает, <strong>откуда</strong> дул ветер.</li>
                                   <li>Длина каждого луча пропорциональна частоте (повторяемости) ветра данного направления (в % или днях). Чем длиннее луч, тем чаще дул ветер с этого направления. В примере, ветер с Запада (W/З) дул около 30% времени, с Северо-Востока (NE/СВ) - около 12% времени.</li>
                                   <li>Разные цвета или отрезки на луче показывают повторяемость ветра с разной скоростью (легенда обычно прилагается). В примере показана скорость в узлах (knots). Например, самый длинный луч (западный) показывает, что ветер дул с запада со скоростью 1-4 узла (голубой цвет) около 4% времени, 4-7 узлов (темно-зеленый) около 18% времени и 7-11 узлов (темно-синий) около 7% времени.</li>
                                   <li>Цифра в центре (если есть) показывает процент штилей (безветрия). В примере - 0%.</li>
                                </ul>
                                Роза ветров помогает понять преобладающие ветры в регионе, что важно для строительства, сельского хозяйства, экологии.
                            </p>
                            <img src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/geo-wind-rose.png-bc50103a-016a-4d39-a1a6-595d018ec926.jpg" alt="Роза ветров" className="mt-4 rounded-lg shadow-sm w-full max-w-sm mx-auto" />
                        </div>
                    </div>
                </section>

                {/* План и Карта */}
                <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                    <h2 className="text-2xl font-semibold mb-4 text-orange-600 dark:text-orange-400 flex items-center">
                        <FontAwesomeIcon icon={FaMapMarkedAlt} className="mr-2" /> План и Карта
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* План местности */}
                        <div className="border-l-4 border-orange-500 pl-4">
                            <h3 className="text-xl font-medium mb-2 text-orange-700 dark:text-orange-400 flex items-center">
                                <FontAwesomeIcon icon={FaRulerCombined} className="mr-2" /> План местности
                            </h3>
                            <p className="text-gray-700 dark:text-gray-300">
                                <strong>План местности</strong> - это чертеж небольшого участка земной поверхности в уменьшенном виде с помощью условных знаков.
                                <br />
                                <strong>Особенности:</strong>
                                <ul>
                                    <li>Изображает <strong>небольшую</strong> территорию (комната, школьный двор, парк).</li>
                                    <li>Использует <strong>крупный масштаб</strong> (например, 1:1000 - в 1 см на плане 10 м на местности).</li>
                                    <li>Все объекты изображаются <strong>подробно</strong> с помощью <strong>условных знаков</strong> (топографических знаков).</li>
                                    <li>Учитывается <strong>кривизна Земли</strong>? <strong>Нет</strong>, участок слишком мал.</li>
                                    <li>Направление <strong>Север-Юг</strong> обычно указывается стрелкой.</li>
                                </ul>
                                <strong>Масштаб</strong> - показывает, во сколько раз расстояние на плане/карте меньше соответствующего расстояния на местности. Виды:
                                <ul>
                                    <li><strong>Численный:</strong> 1 : 10 000 (означает, что 1 см на плане = 10 000 см = 100 м на местности)</li>
                                    <li><strong>Именованный:</strong> в 1 см - 100 м</li>
                                    <li><strong>Линейный:</strong> Графическая линейка для измерения расстояний циркулем.</li>
                                </ul>
                                <strong>Ориентирование</strong> - определение своего местоположения относительно сторон горизонта. Способы: по компасу, по Солнцу, по местным признакам (мох на деревьях, муравейники и т.д.).
                                <br />
                                <strong>Азимут</strong> - угол между направлением на север и направлением на какой-либо предмет, отсчитываемый по часовой стрелке (от 0° до 360°). Измеряется компасом.
                            </p>
                        </div>

                        {/* Географическая карта */}
                        <div className="border-l-4 border-red-500 pl-4">
                            <h3 className="text-xl font-medium mb-2 text-red-700 dark:text-red-400 flex items-center">
                                <FontAwesomeIcon icon={FaSatelliteDish} className="mr-2" /> Географическая карта
                            </h3>
                            <p className="text-gray-700 dark:text-gray-300">
                                <strong>Географическая карта</strong> - это уменьшенное, обобщенное изображение земной поверхности на плоскости с помощью условных знаков, с учетом кривизны Земли.
                                <br />
                                <strong>Особенности:</strong>
                                <ul>
                                    <li>Изображает <strong>большие</strong> территории (страна, материк, весь мир).</li>
                                    <li>Использует <strong>мелкий масштаб</strong> (например, 1:1 000 000 - в 1 см 10 км).</li>
                                    <li>Объекты изображаются <strong>обобщенно</strong> (генерализация), используются другие условные знаки.</li>
                                    <li>Учитывается <strong>кривизна Земли</strong>? <strong>Да</strong>, с помощью картографических проекций (возникают искажения).</li>
                                    <li>Направление <strong>Север-Юг</strong> определяется по меридианам, <strong>Запад-Восток</strong> - по параллелям.</li>
                                </ul>
                                <strong>Глобус</strong> - модель Земли, наиболее точно передающая ее форму и взаимное расположение объектов, но имеющая очень мелкий масштаб.
                                <br />
                                <strong>Градусная сеть:</strong> Система меридианов и параллелей на глобусе/карте.
                                <ul>
                                    <li><strong>Меридианы:</strong> Линии, соединяющие Северный и Южный полюсы (направление Север-Юг). Все меридианы равны по длине. Начальный (нулевой) меридиан - Гринвичский.</li>
                                    <li><strong>Параллели:</strong> Линии, параллельные экватору (направление Запад-Восток). Длина параллелей уменьшается к полюсам. Самая длинная параллель - <strong>экватор</strong> (0° широты).</li>
                                    <li><strong>Географические координаты:</strong> Широта и долгота, определяющие положение точки на Земле.</li>
                                    <li><strong>Широта:</strong> Угол от экватора к северу (с.ш.) или югу (ю.ш.) от 0° до 90°. Определяется по параллелям.</li>
                                    <li><strong>Долгота:</strong> Угол от начального меридиана к востоку (в.д.) или западу (з.д.) от 0° до 180°. Определяется по меридианам.</li>
                                </ul>
                                <strong>Способы изображения рельефа на картах:</strong> Отметки высот, послойная окраска (низменности - зеленым, возвышенности - желтым, горы - коричневым), горизонтали (линии равных высот).
                            </p>
                        </div>
                    </div>
                </section>

                 <div className="text-center mt-8">
                     <Link href="/vpr-tests" legacyBehavior>
                       <a className="text-blue-600 dark:text-blue-400 hover:underline">
                         &larr; Вернуться к тестам
                       </a>
                     </Link>
                 </div>

            </main>

            
        </div>
    );
};

export default GeographyCheatsheet;