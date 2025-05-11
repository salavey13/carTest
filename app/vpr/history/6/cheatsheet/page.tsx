"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// Removed Tooltip imports
import {
    FaLandmark, FaBookOpen, FaScroll, FaCalendarDays, FaUserShield, FaShieldHalved,
    FaCross, FaGavel, FaMoneyBill1,
    FaMapLocationDot,
    FaRoute, FaFeather, FaPalette,
    FaChurch, FaGraduationCap, FaUsers, FaBuildingColumns, FaShip, FaCrown, FaChessKing,
    FaBookBible, FaPlaceOfWorship, FaUniversity, FaBalanceScale, FaHandsPraying,
    FaMedal, FaStar, FaMonument, FaMusic,
    FaMap
} from "react-icons/fa6";
import Link from "next/link";
import Image from "next/image";

// --- Component ---
const VprHistoryCheatsheet: React.FC = () => {

  // Removed tooltipDescriptions constant

  // == UPDATED Image URLs ==
  const imageUrls: Record<string, string> = {
      'history-varangians.png': "https://upload.wikimedia.org/wikipedia/commons/1/16/%D0%92%D0%B0%D1%80%D1%8F%D0%B3%D0%B8.jpg", // 16:9
      'history-baptism.png': "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/the-baptism-of-russia-1896.jpg!Large-71324dba-453c-4b24-b587-ef83b807fd17.jpg", // 9:16
      'history-yaroslav.png': "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/Yaroslav_the_Wise-09415836-fa19-4ee5-9816-47a06ac717ed.jpg", // 9:16
      'history-mongols.png': "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/1573709092_batyja-na-rus-miniatjura-iz-zhitija-evfrosini-suzdalskoj-xvii-vek-2e27ed16-3791-472a-84fd-37d982c8ab6b.jpg", // 1:1
      'history-nevsky.png': "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/0027_NEVSKY-FINAL-FRAME-1750x875-5599046e-d438-49ea-a57b-1cb458c5098e.jpg", // 16:9
      'history-kulikovo.png': "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/1299747-84c22ba5-9f6d-4fc9-be34-bdb06f69d557.jpg", // 9:16
      'history-ivan3.png': "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/album_alb3350347-007001aa-c7c3-40b7-89fe-50a4491004ca.jpg", // 16:9
      'history-feudalism.png': "https://ru-static.z-dn.net/files/d62/328673063ea0e22a24d9392a9c99959e.jpg", // 16:10
      'history-crusades.png': "https://upload.wikimedia.org/wikipedia/commons/d/d3/SiegeofAntioch.jpeg", // 1:1
      'history-ww2-victory.png': "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/IMG_20250420_135854-b056be47-8e5b-44f9-bccd-d14ca75fd294.jpg", // 9:16
      'history-ww2-monument.png': "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/motherland-calls.jpg-660bb17c-5de2-4b61-9744-f03b780bf455.jpg", // 16:9
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

      {/* Removed TooltipProvider */}
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
                        {/* Removed Tooltip wrapper */}
                           {/* Container forces 16:9 aspect ratio */}
                           <div className="aspect-video w-full h-auto overflow-hidden rounded bg-gray-700/30">
                             {/* === IMAGE USES UPDATED URL === */}
                             <Image
                               src={imageUrls['history-varangians.png']} // 16:9 image fits well
                               alt="Картина В. Васнецова 'Варяги'"
                               width={400} // Hint for Next.js, actual display controlled by div+object-cover
                               height={225} // Hint for Next.js (16:9 ratio)
                               className="w-full h-full object-cover" // Fill container, cropping if needed
                               loading="lazy"
                               unoptimized // Use if external host doesn't support optimization
                              />
                           </div>
                        {/* Removed TooltipContent */}
                        <p className="text-xs text-center text-gray-400 mt-1 italic">Призвание варягов (862)</p>
                    </div>
                    <div className="p-2 border border-blue-500/30 rounded-lg bg-black/30">
                        {/* Removed Tooltip wrapper */}
                             {/* Container forces 16:9 aspect ratio */}
                             <div className="aspect-video w-full h-auto overflow-hidden rounded bg-gray-700/30">
                               {/* === IMAGE USES UPDATED URL === */}
                               <Image
                                 src={imageUrls['history-baptism.png']} // 9:16 image will be cropped
                                 alt="Картина В. Васнецова 'Крещение Руси'"
                                 width={400} // Hint for Next.js
                                 height={711} // Hint for Next.js (9:16 ratio)
                                 className="w-full h-full object-cover" // Fill container, cropping portrait image
                                 loading="lazy"
                                 unoptimized
                               />
                              </div>
                        {/* Removed TooltipContent */}
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
                   <div className="my-6 p-2 border border-blue-500/30 rounded-lg bg-black/30 max-w-sm mx-auto">
                     {/* Removed Tooltip wrapper */}
                          {/* Container forces 1:1 aspect ratio */}
                          <div className="aspect-square w-full h-auto overflow-hidden rounded bg-gray-700/30">
                            {/* === IMAGE USES UPDATED URL === */}
                            <Image
                              src={imageUrls['history-yaroslav.png']} // 9:16 image will be cropped
                              alt="Портрет Ярослава Мудрого (В. Васнецов)"
                              width={400} // Hint
                              height={711} // Hint (9:16 ratio)
                              className="w-full h-full object-cover" // Fill container, cropping portrait image
                              loading="lazy"
                              unoptimized
                             />
                          </div>
                     {/* Removed TooltipContent */}
                     <p className="text-xs text-center text-gray-400 mt-1 italic">Ярослав Мудрый - расцвет Руси.</p>
                   </div>

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
                  <div className="my-6 p-2 border border-red-600/30 rounded-lg bg-black/30">
                    {/* Removed Tooltip wrapper */}
                          {/* Container forces 16:9 aspect ratio */}
                          <div className="aspect-video w-full h-auto overflow-hidden rounded bg-gray-700/30">
                             {/* === IMAGE USES UPDATED URL === */}
                             <Image
                               src={imageUrls['history-mongols.png']} // 1:1 image will be cropped (letterboxed if 'object-contain')
                               alt="Миниатюра 'Нашествие Батыя на Русь'"
                               width={600} // Hint
                               height={600} // Hint (1:1 ratio)
                               className="w-full h-full object-cover" // Fill container, cropping square image
                               loading="lazy"
                               unoptimized
                              />
                           </div>
                    {/* Removed TooltipContent */}
                    <p className="text-xs text-center text-gray-400 mt-1 italic">Нашествие Батыя (1237-1241)</p>
                  </div>

                  {/* Subsection: Борьба с захватчиками */}
                   <h3 className="flex items-center text-xl font-semibold text-blue-300 mt-6 mb-2">
                     <FaUserShield className="mr-2 text-blue-300/80" /> Борьба с Захватчиками
                   </h3>
                   <ul className="list-disc list-inside space-y-1 text-gray-300 pl-4 text-base md:text-lg">
                     <li><strong>Александр Невский:</strong> Невская битва (1240), Ледовое побоище (1242).</li>
                     <li><strong>Дмитрий Донской:</strong> Куликовская битва (1380).</li>
                   </ul>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
                     <div className="p-2 border border-cyan-500/30 rounded-lg bg-black/30">
                       {/* Removed Tooltip wrapper */}
                             {/* Container forces 16:9 aspect ratio */}
                             <div className="aspect-video w-full h-auto overflow-hidden rounded bg-gray-700/30">
                               {/* === IMAGE USES UPDATED URL === */}
                               <Image
                                 src={imageUrls['history-nevsky.png']} // 16:9 image fits well
                                 alt="Картина 'Ледовое побоище'"
                                 width={400} // Hint
                                 height={225} // Hint (16:9 ratio)
                                 className="w-full h-full object-cover"
                                 loading="lazy"
                                 unoptimized
                               />
                              </div>
                          {/* Removed TooltipContent */}
                         <p className="text-xs text-center text-gray-400 mt-1 italic">Ледовое побоище (1242)</p>
                      </div>
                     <div className="p-2 border border-orange-500/30 rounded-lg bg-black/30">
                       {/* Removed Tooltip wrapper */}
                             {/* Container forces 16:9 aspect ratio */}
                             <div className="aspect-video w-full h-auto overflow-hidden rounded bg-gray-700/30">
                                {/* === IMAGE USES UPDATED URL === */}
                                <Image
                                  src={imageUrls['history-kulikovo.png']} // 9:16 image will be cropped
                                  alt="Картина 'Поединок Пересвета с Челубеем'"
                                  width={400} // Hint
                                  height={711} // Hint (9:16 ratio)
                                  className="w-full h-full object-cover" // Fill container, cropping portrait image
                                  loading="lazy"
                                  unoptimized
                                />
                              </div>
                           {/* Removed TooltipContent */}
                         <p className="text-xs text-center text-gray-400 mt-1 italic">Куликовская битва (1380)</p>
                       </div>
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
                   <div className="my-6 p-2 border border-green-500/30 rounded-lg bg-black/30 max-w-md mx-auto">
                     {/* Removed Tooltip wrapper */}
                           {/* Container forces 16:9 aspect ratio */}
                           <div className="aspect-video w-full h-auto overflow-hidden rounded bg-gray-700/30">
                              {/* === IMAGE USES UPDATED URL === */}
                              <Image
                                src={imageUrls['history-ivan3.png']} // 16:9 image fits well
                                alt="Картина 'Стояние на Угре'"
                                width={500} // Hint
                                height={281} // Hint (16:9 ratio)
                                className="w-full h-full object-cover"
                                loading="lazy"
                                unoptimized
                               />
                            </div>
                         {/* Removed TooltipContent */}
                       <p className="text-xs text-center text-gray-400 mt-1 italic">Стояние на Угре (1480) - конец ига.</p>
                    </div>
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
                     <div className="p-2 border border-purple-500/30 rounded-lg bg-black/30">
                       {/* Removed Tooltip wrapper */}
                             {/* Container forces 1:1 aspect ratio */}
                             <div className="aspect-square w-full h-auto overflow-hidden rounded bg-gray-700/30">
                               {/* === IMAGE USES UPDATED URL === */}
                               <Image
                                 src={imageUrls['history-feudalism.png']} // 16:10 image, use contain
                                 alt="Схема феодальной лестницы"
                                 width={400} // Hint
                                 height={250} // Hint (16:10 ratio)
                                 className="w-full h-full object-contain bg-white p-1" // Fit inside container, add white bg for clarity
                                 loading="lazy"
                                 unoptimized
                               />
                              </div>
                          {/* Removed TooltipContent */}
                        <p className="text-xs text-center text-gray-400 mt-1 italic">Феодальная система.</p>
                     </div>
                     <div className="p-2 border border-purple-500/30 rounded-lg bg-black/30">
                       {/* Removed Tooltip wrapper */}
                             {/* Container forces 1:1 aspect ratio */}
                             <div className="aspect-square w-full h-auto overflow-hidden rounded bg-gray-700/30">
                               {/* === IMAGE USES UPDATED URL === */}
                               <Image
                                 src={imageUrls['history-crusades.png']} // 1:1 image fits well
                                 alt="Средневековая миниатюра 'Осада Антиохии' (Крестовый поход)"
                                 width={400} // Hint
                                 height={400} // Hint (1:1 ratio)
                                 className="w-full h-full object-cover"
                                 loading="lazy"
                                 unoptimized
                               />
                              </div>
                          {/* Removed TooltipContent */}
                        <p className="text-xs text-center text-gray-400 mt-1 italic">Крестовые походы.</p>
                     </div>
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
                     <div className="p-2 border border-red-600/30 rounded-lg bg-black/30">
                       {/* Removed Tooltip wrapper */}
                             {/* Container forces 16:9 aspect ratio */}
                             <div className="aspect-video w-full h-auto overflow-hidden rounded bg-gray-700/30">
                                {/* === IMAGE USES UPDATED URL === */}
                                <Image
                                  src={imageUrls['history-ww2-victory.png']} // 9:16 image will be cropped
                                  alt="Фотография Е. Халдея 'Знамя Победы над Рейхстагом'"
                                  width={400} // Hint
                                  height={711} // Hint (9:16 ratio)
                                  className="w-full h-full object-cover" // Fill container, cropping portrait image
                                  loading="lazy"
                                  unoptimized
                                 />
                              </div>
                           {/* Removed TooltipContent */}
                          <p className="text-xs text-center text-gray-400 mt-1 italic">Знамя Победы над Рейхстагом.</p>
                     </div>
                     <div className="p-2 border border-red-600/30 rounded-lg bg-black/30">
                       {/* Removed Tooltip wrapper */}
                             {/* Container forces 16:9 aspect ratio */}
                             <div className="aspect-video w-full h-auto overflow-hidden rounded bg-gray-700/30">
                               {/* === IMAGE USES UPDATED URL === */}
                               <Image
                                  src={imageUrls['history-ww2-monument.png']} // 16:9 image fits well
                                  alt="Фото: Монумент 'Родина-мать зовет!' на Мамаевом кургане."
                                  width={400} // Hint
                                  height={225} // Hint (16:9 ratio)
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                  unoptimized
                                />
                              </div>
                           {/* Removed TooltipContent */}
                          <p className="text-xs text-center text-gray-400 mt-1 italic">"Родина-мать зовет!".</p>
                     </div>
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
      {/* Removed TooltipProvider */}
    </div>
  );
};

export default VprHistoryCheatsheet;