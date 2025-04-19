"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    FaLandmark, FaBookOpen, FaScroll, FaCalendarDays, FaUserShield, FaShieldHalved,
    FaCross, FaGavel, FaMoneyBill1, FaMapLocationDot, FaRoute, FaFeather, FaPalette,
    FaChurch, FaGraduationCap, FaUsers, FaBuildingColumns, FaShip, FaCrown, FaChessKing,
    FaBookBible, FaPlaceOfWorship, FaUniversity, FaBalanceScale, FaHandsPraying,
    FaMedal, FaStar, FaMonument, FaMusic, // FaMicrophoneLines potentially for songs
    FaMap // For the map tip
} from "react-icons/fa6"; // Using Fa6 for consistency
import Link from "next/link"; // Assuming internal links if needed
import Image from "next/image";

// --- Component ---
const VprHistoryCheatsheet: React.FC = () => {

  // Tooltip descriptions for image placeholders
  const tooltipDescriptions: Record<string, string> = {
      'history-varangians.png': "Иллюстрация: Варяжские воины (Рюрик с дружиной?) прибывают на ладьях к славянскому поселению. Атмосфера ожидания и надежды.",
      'history-baptism.png': "Иллюстрация: Князь Владимир Святой стоит на берегу Днепра во время массового крещения киевлян византийскими священниками. Солнечный день, преображение.",
      'history-yaroslav.png': "Иллюстрация: Князь Ярослав Мудрый в богатых одеждах сидит с развернутым свитком 'Русской Правды'. На фоне виднеется строящийся Софийский собор.",
      'history-mongols.png': "Иллюстрация: Монгольская конница во главе с ханом Батыем штурмует стены русского города (например, Рязани). Дым, огонь, драматизм.",
      'history-nevsky.png': "Иллюстрация: Сцена Ледового побоища. Александр Невский на коне ведет дружину в бой против тевтонских рыцарей на льду Чудского озера.",
      'history-kulikovo.png': "Иллюстрация: Куликовская битва. Поединок Пересвета и Челубея как центральный элемент. На фоне - русские и ордынские полки.",
      'history-ivan3.png': "Иллюстрация: Иван III Великий стоит на берегу Угры напротив хана Ахмата. Спокойная решимость на лице Ивана, растерянность у ордынцев. Символ конца ига.",
      'history-feudalism.png': "Схема: Классическая феодальная лестница в Европе. Король наверху, ниже - герцоги/графы (его вассалы, сеньоры для баронов), бароны, рыцари. Стрелки показывают вассальные обязательства.",
      'history-crusades.png': "Иллюстрация: Европейские рыцари-крестоносцы с крестами на плащах в походе на Иерусалим. Пустынный пейзаж, тяготы пути.",
      'history-ww2-victory.png': "Иллюстрация: Советские солдаты водружают Знамя Победы над Рейхстагом в Берлине. Символ окончания войны.",
      'history-ww2-monument.png': "Изображение: Монумент 'Родина-мать зовет!' на Мамаевом кургане в Волгограде. Величественный и скорбный.",
  };


  return (
    <div className="relative min-h-screen overflow-hidden pt-20 pb-10 bg-gradient-to-br from-gray-900 via-black to-gray-800 text-gray-200">
       <div
        className="absolute inset-0 bg-repeat opacity-5 z-0"
        style={{
          backgroundImage: `linear-gradient(to right, rgba(0, 255, 157, 0.2) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(0, 255, 157, 0.2) 1px, transparent 1px)`,
          backgroundSize: '50px 50px', // Adjusted grid size
        }}
      ></div>

      <TooltipProvider delayDuration={200}>
          <div className="relative z-10 container mx-auto px-4">
            <Card className="max-w-5xl mx-auto bg-black/80 backdrop-blur-md text-white rounded-2xl border border-brand-green/30 shadow-[0_0_25px_rgba(0,255,157,0.4)]">
              <CardHeader className="text-center border-b border-brand-green/20 pb-4">
                <CardTitle className="text-3xl md:text-5xl font-bold text-brand-green cyber-text glitch" data-text="ВПР История 6 класс: Шпаргалка">
                  ВПР История 6 класс: Шпаргалка
                </CardTitle>
                <p className="text-md md:text-lg text-gray-300 mt-3 font-mono">
                  Ключевые факты для успешной сдачи! 🚀
                </p>
              </CardHeader>

              <CardContent className="space-y-12 p-4 md:p-8">

                {/* Section: Древняя Русь */}
                <section className="space-y-4">
                  <h2 className="flex items-center text-2xl md:text-3xl font-semibold text-blue-400 mb-4">
                    <FaLandmark className="mr-3 text-blue-400/80" /> 🇷🇺 Древняя Русь (до XIII в.)
                  </h2>

                  {/* Subsection: Ключевые Даты и События */}
                  <h3 className="flex items-center text-xl font-semibold text-blue-300 mt-6 mb-2">
                     <FaCalendarDays className="mr-2 text-blue-300/80" /> Ключевые Даты и События
                  </h3>
                  <ul className="list-disc list-inside space-y-1 text-gray-300 pl-4 text-base md:text-lg">
                    <li><strong className="text-blue-400 font-semibold">862 г.</strong> - Призвание варягов (Рюрик).</li>
                    <li><strong className="text-blue-400 font-semibold">882 г.</strong> - Объединение Новгорода и Киева (Олег).</li>
                    <li><strong className="text-blue-400 font-semibold">988 г.</strong> - Крещение Руси (Владимир Святой).</li>
                    <li><strong className="text-blue-400 font-semibold">1097 г.</strong> - Любечский съезд (начало раздробленности).</li>
                    <li><strong className="text-blue-400 font-semibold">1147 г.</strong> - Первое упоминание Москвы.</li>
                    <li><strong className="text-blue-400 font-semibold">1223 г.</strong> - Битва на Калке (первая встреча с монголами).</li>
                  </ul>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
                    <div className="p-2 border border-blue-500/30 rounded-lg bg-black/30">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span> {/* Image placeholder: Призвание варягов */} <div className="aspect-video w-full h-auto overflow-hidden rounded bg-gray-700/30 cursor-help"> <Image src="/placeholders/history-varangians.png" alt="Иллюстрация: Варяжские воины (Рюрик с дружиной?) прибывают на ладьях к славянскому поселению." width={400} height={225} className="w-full h-full object-cover opacity-50" loading="lazy"/> </div> </span>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-[250px] bg-gray-950 border border-blue-500/60 text-white p-2"><p className="text-xs">{tooltipDescriptions['history-varangians.png']}</p></TooltipContent>
                        </Tooltip>
                        <p className="text-xs text-center text-gray-400 mt-1 italic">Призвание варягов (862)</p>
                    </div>
                    <div className="p-2 border border-blue-500/30 rounded-lg bg-black/30">
                        <Tooltip>
                          <TooltipTrigger asChild>
                             <span> {/* Image placeholder: Крещение Руси */} <div className="aspect-video w-full h-auto overflow-hidden rounded bg-gray-700/30 cursor-help"> <Image src="/placeholders/history-baptism.png" alt="Иллюстрация: Князь Владимир Святой стоит на берегу Днепра во время массового крещения киевлян византийскими священниками." width={400} height={225} className="w-full h-full object-cover opacity-50" loading="lazy"/> </div> </span>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-[250px] bg-gray-950 border border-blue-500/60 text-white p-2"><p className="text-xs">{tooltipDescriptions['history-baptism.png']}</p></TooltipContent>
                        </Tooltip>
                         <p className="text-xs text-center text-gray-400 mt-1 italic">Крещение Руси (988)</p>
                    </div>
                  </div>

                   {/* Subsection: Важные Правители */}
                   <h3 className="flex items-center text-xl font-semibold text-blue-300 mt-6 mb-2">
                     <FaUserShield className="mr-2 text-blue-300/80" /> Важные Правители
                   </h3>
                   <ul className="list-disc list-inside space-y-1 text-gray-300 pl-4 text-base md:text-lg">
                     <li><strong>Рюрик, Олег, Игорь, Ольга, Святослав:</strong> Первые князья, становление государства.</li>
                     <li><strong>Владимир I Святой:</strong> Креститель Руси.</li>
                     <li><strong>Ярослав Мудрый:</strong> Расцвет, "Русская Правда", София Киевская.</li>
                     <li><strong>Владимир Мономах:</strong> Борьба с половцами, "Поучение детям".</li>
                     <li><strong>Юрий Долгорукий, Андрей Боголюбский:</strong> Рост Северо-Восточной Руси.</li>
                   </ul>
                   {/* Image Placeholder: Ярослав Мудрый */}
                   <div className="my-6 p-2 border border-blue-500/30 rounded-lg bg-black/30 max-w-sm mx-auto"> <Tooltip> <TooltipTrigger asChild> <span> <div className="aspect-square w-full h-auto overflow-hidden rounded bg-gray-700/30 cursor-help"> <Image src="/placeholders/history-yaroslav.png" alt="Иллюстрация: Князь Ярослав Мудрый со свитком 'Русской Правды'." width={400} height={400} className="w-full h-full object-cover opacity-50" loading="lazy"/> </div> </span> </TooltipTrigger> <TooltipContent side="bottom" className="max-w-[250px] bg-gray-950 border border-blue-500/60 text-white p-2"><p className="text-xs">{tooltipDescriptions['history-yaroslav.png']}</p></TooltipContent> </Tooltip> <p className="text-xs text-center text-gray-400 mt-1 italic">Ярослав Мудрый - расцвет Руси.</p> </div>

                   {/* Subsection: Термины и Культура */}
                   <h3 className="flex items-center text-xl font-semibold text-blue-300 mt-6 mb-2">
                     <FaScroll className="mr-2 text-blue-300/80" /> Термины и Культура
                   </h3>
                   <ul className="list-disc list-inside space-y-1 text-gray-300 pl-4 text-base md:text-lg">
                     <li><strong>Термины:</strong> Варяги, Полюдье, Уроки, Погосты, Вече, Дружина, Бояре, Смерды, Закупы, Холопы, Вотчина.</li>
                     <li><strong>Законы:</strong> "Русская Правда".</li>
                     <li><strong>Культура:</strong> Кириллица (Кирилл и Мефодий), "Повесть временных лет", "Слово о Законе и Благодати", иконопись, фрески, София Киевская/Новгородская.</li>
                   </ul>
                </section>

                {/* Section: Русь в XIII-XV вв. */}
                <section className="space-y-4 border-t border-blue-500/20 pt-8">
                  <h2 className="flex items-center text-2xl md:text-3xl font-semibold text-blue-400 mb-4">
                    <FaShieldHalved className="mr-3 text-blue-400/80" /> 🛡️ Русь под Игом и Объединение (XIII-XV вв.)
                  </h2>

                  {/* Subsection: Монгольское нашествие и Иго */}
                  <h3 className="flex items-center text-xl font-semibold text-blue-300 mt-6 mb-2">
                     <FaShieldHalved className="mr-2 text-blue-300/80" /> Монгольское Нашествие и Иго
                  </h3>
                  <ul className="list-disc list-inside space-y-1 text-gray-300 pl-4 text-base md:text-lg">
                    <li><strong>1237-1241 гг.:</strong> Нашествие Батыя.</li>
                    <li><strong>Иго:</strong> Зависимость от Золотой Орды.</li>
                    <li><strong>Термины Ига:</strong> Ярлык (грамота на княжение), Выход (дань), Баскаки (сборщики дани).</li>
                  </ul>
                  {/* Image Placeholder: Монгольское нашествие */}
                  <div className="my-6 p-2 border border-red-600/30 rounded-lg bg-black/30"> <Tooltip> <TooltipTrigger asChild> <span> <div className="aspect-video w-full h-auto overflow-hidden rounded bg-gray-700/30 cursor-help"> <Image src="/placeholders/history-mongols.png" alt="Иллюстрация: Монгольская конница штурмует русский город." width={600} height={338} className="w-full h-full object-cover opacity-50" loading="lazy"/> </div> </span> </TooltipTrigger> <TooltipContent side="bottom" className="max-w-[250px] bg-gray-950 border border-red-600/60 text-white p-2"><p className="text-xs">{tooltipDescriptions['history-mongols.png']}</p></TooltipContent> </Tooltip> <p className="text-xs text-center text-gray-400 mt-1 italic">Нашествие Батыя (1237-1241)</p> </div>

                  {/* Subsection: Борьба с захватчиками */}
                   <h3 className="flex items-center text-xl font-semibold text-blue-300 mt-6 mb-2">
                     <FaUserShield className="mr-2 text-blue-300/80" /> Борьба с Захватчиками
                   </h3>
                   <ul className="list-disc list-inside space-y-1 text-gray-300 pl-4 text-base md:text-lg">
                     <li><strong>Александр Невский:</strong> Невская битва (1240), Ледовое побоище (1242).</li>
                     <li><strong>Дмитрий Донской:</strong> Куликовская битва (1380).</li>
                   </ul>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
                     <div className="p-2 border border-cyan-500/30 rounded-lg bg-black/30"> <Tooltip> <TooltipTrigger asChild> <span> {/* Image Placeholder: Ледовое побоище */} <div className="aspect-video w-full h-auto overflow-hidden rounded bg-gray-700/30 cursor-help"> <Image src="/placeholders/history-nevsky.png" alt="Иллюстрация: Александр Невский в Ледовом побоище." width={400} height={225} className="w-full h-full object-cover opacity-50" loading="lazy"/> </div> </span> </TooltipTrigger> <TooltipContent side="bottom" className="max-w-[250px] bg-gray-950 border border-cyan-500/60 text-white p-2"><p className="text-xs">{tooltipDescriptions['history-nevsky.png']}</p></TooltipContent> </Tooltip> <p className="text-xs text-center text-gray-400 mt-1 italic">Ледовое побоище (1242)</p> </div>
                     <div className="p-2 border border-orange-500/30 rounded-lg bg-black/30"> <Tooltip> <TooltipTrigger asChild> <span> {/* Image Placeholder: Куликовская битва */} <div className="aspect-video w-full h-auto overflow-hidden rounded bg-gray-700/30 cursor-help"> <Image src="/placeholders/history-kulikovo.png" alt="Иллюстрация: Куликовская битва, поединок Пересвета и Челубея." width={400} height={225} className="w-full h-full object-cover opacity-50" loading="lazy"/> </div> </span> </TooltipTrigger> <TooltipContent side="bottom" className="max-w-[250px] bg-gray-950 border border-orange-500/60 text-white p-2"><p className="text-xs">{tooltipDescriptions['history-kulikovo.png']}</p></TooltipContent> </Tooltip> <p className="text-xs text-center text-gray-400 mt-1 italic">Куликовская битва (1380)</p> </div>
                   </div>

                  {/* Subsection: Объединение Руси */}
                  <h3 className="flex items-center text-xl font-semibold text-blue-300 mt-6 mb-2">
                     <FaUsers className="mr-2 text-blue-300/80" /> Объединение Руси вокруг Москвы
                  </h3>
                   <ul className="list-disc list-inside space-y-1 text-gray-300 pl-4 text-base md:text-lg">
                     <li><strong>Центр объединения:</strong> Москва (Иван Калита, Дмитрий Донской).</li>
                     <li><strong>Иван III Великий:</strong> Присоединение Новгорода, Твери; Конец ига (Стояние на Угре, 1480); Судебник 1497 г.</li>
                   </ul>
                   {/* Image Placeholder: Стояние на Угре */}
                   <div className="my-6 p-2 border border-green-500/30 rounded-lg bg-black/30 max-w-md mx-auto"> <Tooltip> <TooltipTrigger asChild> <span> <div className="aspect-video w-full h-auto overflow-hidden rounded bg-gray-700/30 cursor-help"> <Image src="/placeholders/history-ivan3.png" alt="Иллюстрация: Стояние на Угре. Иван III и хан Ахмат." width={500} height={281} className="w-full h-full object-cover opacity-50" loading="lazy"/> </div> </span> </TooltipTrigger> <TooltipContent side="bottom" className="max-w-[250px] bg-gray-950 border border-green-500/60 text-white p-2"><p className="text-xs">{tooltipDescriptions['history-ivan3.png']}</p></TooltipContent> </Tooltip> <p className="text-xs text-center text-gray-400 mt-1 italic">Стояние на Угре (1480) - конец ига.</p> </div>
                </section>

                {/* Section: Средние века (Зарубежная) */}
                <section className="space-y-4 border-t border-purple-500/20 pt-8">
                  <h2 className="flex items-center text-2xl md:text-3xl font-semibold text-purple-400 mb-4">
                    <FaBuildingColumns className="mr-3 text-purple-400/80" /> 🌍 История Средних веков (Зарубежная)
                  </h2>
                  <ul className="list-disc list-inside space-y-2 text-gray-300 pl-4 text-base md:text-lg">
                    <li><strong className="text-purple-400">Византия:</strong> Юстиниан (VI в.), Св. София, раскол церквей (1054), падение Константинополя (1453).</li>
                    <li><strong className="text-purple-400">Франки:</strong> Карл Великий (император 800 г.).</li>
                    <li><strong className="text-purple-400">Феодализм:</strong> Сеньоры, вассалы, рыцари, замки.</li>
                    <li><strong className="text-purple-400">Англия:</strong> Великая хартия вольностей (1215), Парламент.</li>
                    <li><strong className="text-purple-400">Франция:</strong> Столетняя война (1337-1453), Жанна д`Арк.</li>
                    <li><strong className="text-purple-400">Крестовые походы:</strong> Походы на Восток (XI-XIII вв.).</li>
                    <li><strong className="text-purple-400">Города:</strong> Цехи, гильдии, коммуны.</li>
                    <li><strong className="text-purple-400">Культура:</strong> Готика (Нотр-Дам), университеты.</li>
                  </ul>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
                     <div className="p-2 border border-purple-500/30 rounded-lg bg-black/30"> <Tooltip> <TooltipTrigger asChild> <span> {/* Image Placeholder: Феодализм */} <div className="aspect-square w-full h-auto overflow-hidden rounded bg-gray-700/30 cursor-help"> <Image src="/placeholders/history-feudalism.png" alt="Схема: Феодальная лестница в Европе." width={400} height={400} className="w-full h-full object-cover opacity-50" loading="lazy"/> </div> </span> </TooltipTrigger> <TooltipContent side="bottom" className="max-w-[250px] bg-gray-950 border border-purple-500/60 text-white p-2"><p className="text-xs">{tooltipDescriptions['history-feudalism.png']}</p></TooltipContent> </Tooltip> <p className="text-xs text-center text-gray-400 mt-1 italic">Феодальная система.</p> </div>
                     <div className="p-2 border border-purple-500/30 rounded-lg bg-black/30"> <Tooltip> <TooltipTrigger asChild> <span> {/* Image Placeholder: Крестоносцы */} <div className="aspect-square w-full h-auto overflow-hidden rounded bg-gray-700/30 cursor-help"> <Image src="/placeholders/history-crusades.png" alt="Иллюстрация: Рыцари-крестоносцы в походе." width={400} height={400} className="w-full h-full object-cover opacity-50" loading="lazy"/> </div> </span> </TooltipTrigger> <TooltipContent side="bottom" className="max-w-[250px] bg-gray-950 border border-purple-500/60 text-white p-2"><p className="text-xs">{tooltipDescriptions['history-crusades.png']}</p></TooltipContent> </Tooltip> <p className="text-xs text-center text-gray-400 mt-1 italic">Крестовые походы.</p> </div>
                   </div>
                </section>

                {/* Section: Память о ВОВ */}
                <section className="space-y-4 border-t border-red-500/20 pt-8">
                  <h2 className="flex items-center text-2xl md:text-3xl font-semibold text-red-500 mb-4">
                    <FaStar className="mr-3 text-red-500/80" /> ⭐ Память о Великой Отечественной Войне (1941-1945)
                  </h2>
                  <ul className="list-disc list-inside space-y-2 text-gray-300 pl-4 text-base md:text-lg">
                    <li><strong className="text-red-500">Праздник:</strong> День Победы (9 мая).</li>
                    <li><strong className="text-red-500">Смысл:</strong> "Радость со слезами на глазах" (победа + скорбь).</li>
                    <li><strong className="text-red-500">Битвы:</strong> Московская, Сталинградская, Курская.</li>
                    <li><strong className="text-red-500">Символы:</strong> "Священная война", Знамя Победы.</li>
                    <li><strong className="text-red-500">Памятники:</strong> Мамаев курган ("Родина-мать").</li>
                  </ul>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
                     <div className="p-2 border border-red-600/30 rounded-lg bg-black/30"> <Tooltip> <TooltipTrigger asChild> <span> {/* Image Placeholder: Знамя над Рейхстагом */} <div className="aspect-video w-full h-auto overflow-hidden rounded bg-gray-700/30 cursor-help"> <Image src="/placeholders/history-ww2-victory.png" alt="Иллюстрация: Водружение Знамени Победы над Рейхстагом." width={400} height={225} className="w-full h-full object-cover opacity-50" loading="lazy"/> </div> </span> </TooltipTrigger> <TooltipContent side="bottom" className="max-w-[250px] bg-gray-950 border border-red-600/60 text-white p-2"><p className="text-xs">{tooltipDescriptions['history-ww2-victory.png']}</p></TooltipContent> </Tooltip> <p className="text-xs text-center text-gray-400 mt-1 italic">Знамя Победы над Рейхстагом.</p> </div>
                     <div className="p-2 border border-red-600/30 rounded-lg bg-black/30"> <Tooltip> <TooltipTrigger asChild> <span> {/* Image Placeholder: Родина-мать */} <div className="aspect-video w-full h-auto overflow-hidden rounded bg-gray-700/30 cursor-help"> <Image src="/placeholders/history-ww2-monument.png" alt="Фото: Монумент 'Родина-мать зовет!' на Мамаевом кургане." width={400} height={225} className="w-full h-full object-cover opacity-50" loading="lazy"/> </div> </span> </TooltipTrigger> <TooltipContent side="bottom" className="max-w-[250px] bg-gray-950 border border-red-600/60 text-white p-2"><p className="text-xs">{tooltipDescriptions['history-ww2-monument.png']}</p></TooltipContent> </Tooltip> <p className="text-xs text-center text-gray-400 mt-1 italic">"Родина-мать зовет!".</p> </div>
                   </div>
                </section>

                {/* Final Tip */}
                <section className="border-t border-brand-green/20 pt-8 mt-10 text-center">
                  <h2 className="flex items-center justify-center text-2xl md:text-3xl font-semibold text-brand-green mb-4">
                    <FaMap className="mr-3 text-brand-green/80" /> Не забудь про карту!
                  </h2>
                  <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                    Помни, что в ВПР может быть задание с контурной картой. Повтори расположение <strong className="text-brand-green font-semibold">ключевых городов</strong> (Киев, Новгород, Владимир, Москва, Константинополь), <strong className="text-brand-green font-semibold">рек</strong> (Днепр, Волга, Нева) и <strong className="text-brand-green font-semibold">территорий</strong> (Русь, Византия, Золотая Орда, Крымское ханство). Успехов!
                  </p>
                </section>

              </CardContent>
            </Card>
          </div>
      </TooltipProvider>
    </div>
  );
};

export default VprHistoryCheatsheet;