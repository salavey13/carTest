"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  // == UPDATED Image URLs == (оставлены как в исходнике, без изменений)
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

          <div className="relative z-10 container mx-auto px-4">
            <Card className="max-w-5xl mx-auto bg-black/80 backdrop-blur-md text-white rounded-2xl border border-brand-green/30 shadow-[0_0_25px_rgba(0,255,157,0.4)]">
              <CardHeader className="text-center border-b border-brand-green/20 pb-4">
                <CardTitle className="text-3xl md:text-5xl font-bold text-brand-green cyber-text glitch" data-text="ВПР История 6 класс: Эпичная Шпаргалка с Мемами и Хакми">
                  ВПР История 6 класс: Эпичная Шпаргалка с Мемами и Хакми
                </CardTitle>
                <p className="text-md md:text-lg text-gray-300 mt-3 font-mono">
                  Готовься к ВПР как к квесту в игре: с аналогиями, шуточками и самотестами. Не нудно, а круто! 🚀
                </p>
              </CardHeader>

              <CardContent className="space-y-12 p-4 md:p-8">

                {/* Section: Древняя Русь */}
                <section className="space-y-4">
                  <h2 className="flex items-center text-2xl md:text-3xl font-semibold text-blue-400 mb-4">
                    <FaLandmark className="mr-3 text-blue-400/80" /> 🇷🇺 Древняя Русь (до XIII в.): Как Славяне Собрали "Команду" и Апгрейдили Страну
                  </h2>
                  <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                    Представь: древние славяне живут в лесах и реках, как в большом Minecraft-сервере. Им нужны правила и босс — вот они и "приглашают" варягов (викингов из Скандинавии) в 862 г. Рюрик становится первым князем. Это как звать соседа-супергероя помочь с фермой, а в итоге он строит целый замок. В 882 г. Олег хитро захватывает Киев и делает его столицей: "Киев — мама городам русским!" Теперь Русь — единый сервер от Новгорода до Киева.
                  </p>
                  <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                    Кульминация: 988 г. — Владимир Святой крестит Русь. Это апгрейд ОС — Русь подключается к византийской "сети" (христианство, церкви, книги). Ярослав Мудрый (расцвет в XI в.) строит Софийский собор, пишет "Русскую Правду" (первые законы, как кодекс в игре) и женит дочек на европейских королях — дипломатия на уровне!
                  </p>

                  {/* Subsection: Ключевые Даты и События */}
                  <h3 className="flex items-center text-xl font-semibold text-blue-300 mt-6 mb-2">
                     <FaCalendarDays className="mr-2 text-blue-300/80" /> Ключевые Даты: Не Зубри, Запоминай как Сюжет
                  </h3>
                  <ul className="list-disc list-inside space-y-1 text-gray-300 pl-4 text-base md:text-lg">
                    <li><strong className="text-blue-400 font-semibold">862 г.</strong> — Призвание варягов (Рюрик). Мем: "Славяне постят в чат: 'Нужен админ!'"</li>
                    <li><strong className="text-blue-400 font-semibold">882 г.</strong> — Олег объединяет Новгород и Киев. Аналогия: "Сливает два сервера в один мега-мир."</li>
                    <li><strong className="text-blue-400 font-semibold">988 г.</strong> — Крещение Руси (Владимир). "Русь переходит на новый патч с церквями и иконами."</li>
                    <li><strong className="text-blue-400 font-semibold">1097 г.</strong> — Любечский съезд: князья делят земли, начало раздробленности (как когда гильдия распадается).</li>
                    <li><strong className="text-blue-400 font-semibold">1147 г.</strong> — Первое упоминание Москвы (маленький форпост, который вырастет в столицу).</li>
                    <li><strong className="text-blue-400 font-semibold">1223 г.</strong> — Битва на Калке: первая встреча с монголами (спойлер: не дружеская).</li>
                  </ul>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
                    <div className="p-2 border border-blue-500/30 rounded-lg bg-black/30">
                           <div className="aspect-video w-full h-auto overflow-hidden rounded bg-gray-700/30">
                             <Image
                               src={imageUrls['history-varangians.png']}
                               alt="Варяги — викинги, которых позвали править"
                               width={400}
                               height={225}
                               className="w-full h-full object-cover"
                               loading="lazy"
                               unoptimized
                              />
                           </div>
                        <p className="text-xs text-center text-gray-400 mt-1 italic">Варяги: "Пришли править, как в викинг-сериале!"</p>
                    </div>
                    <div className="p-2 border border-blue-500/30 rounded-lg bg-black/30">
                             <div className="aspect-video w-full h-auto overflow-hidden rounded bg-gray-700/30">
                               <Image
                                 src={imageUrls['history-baptism.png']}
                                 alt="Крещение Руси: апгрейд веры"
                                 width={400}
                                 height={711}
                                 className="w-full h-full object-cover"
                                 loading="lazy"
                                 unoptimized
                               />
                              </div>
                         <p className="text-xs text-center text-gray-400 mt-1 italic">Крещение: "Вся Русь в бассейне с новой религией!"</p>
                    </div>
                  </div>

                   {/* Subsection: Важные Правители */}
                   <h3 className="flex items-center text-xl font-semibold text-blue-300 mt-6 mb-2">
                     <FaUserShield className="mr-2 text-blue-300/80" /> Боссы Руси: Кто Правил и Что Сделал
                   </h3>
                   <ul className="list-disc list-inside space-y-1 text-gray-300 pl-4 text-base md:text-lg">
                     <li><strong>Рюрик, Олег, Игорь, Ольга, Святослав:</strong> Первые князья — строители государства. Ольга — хитрая княгиня, первая христианка (как босс-леди).</li>
                     <li><strong>Владимир I Святой:</strong> Креститель. Мем: "Выбрал веру, как тариф на телефон — византийский оказался топ."</li>
                     <li><strong>Ярослав Мудрый:</strong> Расцвет! Законы, церкви, альянсы. Аналогия: "Сделал Русь 'премиум-аккаунтом' в Европе."</li>
                     <li><strong>Владимир Мономах:</strong> Боролся с половцами, написал "Поучение детям" (типа, отцовский гайд по жизни).</li>
                     <li><strong>Юрий Долгорукий, Андрей Боголюбский:</strong> Рост Севера. Юрий основал Москву (маленький форт, но с потенциалом).</li>
                   </ul>
                   <div className="my-6 p-2 border border-blue-500/30 rounded-lg bg-black/30 max-w-sm mx-auto">
                          <div className="aspect-square w-full h-auto overflow-hidden rounded bg-gray-700/30">
                            <Image
                              src={imageUrls['history-yaroslav.png']}
                              alt="Ярослав Мудрый: король расцвета"
                              width={400}
                              height={711}
                              className="w-full h-full object-cover"
                              loading="lazy"
                              unoptimized
                             />
                          </div>
                     <p className="text-xs text-center text-gray-400 mt-1 italic">Ярослав: "Мудрый босс с топ-законами и связями."</p>
                   </div>

                   {/* Subsection: Термины и Культура */}
                   <h3 className="flex items-center text-xl font-semibold text-blue-300 mt-6 mb-2">
                     <FaScroll className="mr-2 text-blue-300/80" /> Термины и Культура: Гаджеты и Правила Игры
                   </h3>
                   <ul className="list-disc list-inside space-y-1 text-gray-300 pl-4 text-base md:text-lg">
                     <li><strong>Термины:</strong> Варяги (викинги-админы), Полюдье (сбор дани на колесах), Уроки (фиксированный налог, ввела Ольга), Вече (народный чат), Дружина (княжеский сквад), Бояре (богатые советники), Смерды (свободные фермеры), Закупы (должники на подработке), Холопы (рабы).</li>
                     <li><strong>Законы:</strong> "Русская Правда" — кодекс, как правила в Fortnite.</li>
                     <li><strong>Культура:</strong> Кириллица (азбука от Кирилла и Мефодия — первый "смартфон" для письма), "Повесть временных лет" (летопись-сериал от Нестора), иконы, фрески, София Киевская (как космический собор).</li>
                   </ul>

                  {/* Самопроверка */}
                  <h3 className="flex items-center text-xl font-semibold text-blue-300 mt-6 mb-2">
                    <FaGraduationCap className="mr-2 text-blue-300/80" /> Самопроверка: Тест как в ВПР
                  </h3>
                  <ul className="list-disc list-inside space-y-1 text-gray-300 pl-4 text-base md:text-lg">
                    <li>Когда призвали варягов и кто такой Рюрик? (862 г., первый князь-варяг)</li>
                    <li>Что случилось в 988 г.? (Крещение Руси Владимиром — апгрейд культуры)</li>
                    <li>Кто Ярослав Мудрый и почему "мудрый"? (Расцвет, законы, церкви, альянсы)</li>
                  </ul>
                </section>

                {/* Section: Русь в XIII-XV вв. */}
                <section className="space-y-4 border-t border-blue-500/20 pt-8">
                  <h2 className="flex items-center text-2xl md:text-3xl font-semibold text-blue-400 mb-4">
                    <FaShieldHalved className="mr-3 text-blue-400/80" /> 🛡️ Русь под Игом и Объединение (XIII-XV вв.): От "Боссов-Монголов" к Независимости
                  </h2>
                  <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                    Глобальный этап: Монголы приходят как "новый босс" в игру — Русь платит дань, но герои сопротивляются. Конец — Москва собирает земли, как в Monopoly, и скидывает иго.
                  </p>

                  {/* Subsection: Монгольское нашествие и Иго */}
                  <h3 className="flex items-center text-xl font-semibold text-blue-300 mt-6 mb-2">
                     <FaShieldHalved className="mr-2 text-blue-300/80" /> Монгольское Нашествие: "Игровое Вторжение"
                  </h3>
                  <ul className="list-disc list-inside space-y-1 text-gray-300 pl-4 text-base md:text-lg">
                    <li><strong>1237-1241 гг.:</strong> Батый проходит по Руси как туча — разграбил города. Аналогия: "Монголы — читеры с конями и луками."</li>
                    <li><strong>Иго:</strong> Зависимость от Орды — плати "выход" (дань), бери ярлык (грамоту на княжение). Баскаки — налоговые "боссы". Мем: "Русь в подписке на Орду."</li>
                  </ul>
                  <div className="my-6 p-2 border border-red-600/30 rounded-lg bg-black/30">
                           <div className="aspect-video w-full h-auto overflow-hidden rounded bg-gray-700/30">
                             <Image
                               src={imageUrls['history-mongols.png']}
                               alt="Нашествие Батыя: монголы как апокалипсис"
                               width={600}
                               height={600}
                               className="w-full h-full object-cover"
                               loading="lazy"
                               unoptimized
                              />
                           </div>
                    <p className="text-xs text-center text-gray-400 mt-1 italic">Батый: "Пришли, увидели, взяли дань."</p>
                  </div>

                  {/* Subsection: Борьба с захватчиками */}
                   <h3 className="flex items-center text-xl font-semibold text-blue-300 mt-6 mb-2">
                     <FaUserShield className="mr-2 text-blue-300/80" /> Герои Сопротивления: Битвы как Босс-Файты
                   </h3>
                   <ul className="list-disc list-inside space-y-1 text-gray-300 pl-4 text-base md:text-lg">
                     <li><strong>Александр Невский:</strong> Невская битва (1240) — отбил шведов; Ледовое побоище (1242) — разбил рыцарей на льду. Аналогия: "Невский — как танк в игре."</li>
                     <li><strong>Дмитрий Донской:</strong> Куликовская битва (1380) — разбил Мамая. Мем: "Первый удар по Орде — как бить финального босса."</li>
                   </ul>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
                     <div className="p-2 border border-cyan-500/30 rounded-lg bg-black/30">
                             <div className="aspect-video w-full h-auto overflow-hidden rounded bg-gray-700/30">
                               <Image
                                 src={imageUrls['history-nevsky.png']}
                                 alt="Ледовое побоище: битва на льду"
                                 width={400}
                                 height={225}
                                 className="w-full h-full object-cover"
                                 loading="lazy"
                                 unoptimized
                               />
                              </div>
                         <p className="text-xs text-center text-gray-400 mt-1 italic">Невский: "Лёд трещит, рыцари тонут!"</p>
                      </div>
                     <div className="p-2 border border-orange-500/30 rounded-lg bg-black/30">
                             <div className="aspect-video w-full h-auto overflow-hidden rounded bg-gray-700/30">
                                <Image
                                  src={imageUrls['history-kulikovo.png']}
                                  alt="Куликовская битва: перелом"
                                  width={400}
                                  height={711}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                  unoptimized
                                />
                              </div>
                         <p className="text-xs text-center text-gray-400 mt-1 italic">Донской: "Орда, уходи!"</p>
                       </div>
                   </div>

                  {/* Subsection: Объединение Руси */}
                  <h3 className="flex items-center text-xl font-semibold text-blue-300 mt-6 mb-2">
                     <FaUsers className="mr-2 text-blue-300/80" /> Объединение вокруг Москвы: "Сбор Пазла"
                  </h3>
                   <ul className="list-disc list-inside space-y-1 text-gray-300 pl-4 text-base md:text-lg">
                     <li><strong>Центр:</strong> Москва (Иван Калита собирал дань, Дмитрий Донской бился).</li>
                     <li><strong>Иван III:</strong> Присоединил Новгород, Тверь; конец ига (Стояние на Угре, 1480); Судебник 1497 (законы для всех). Аналогия: "Москва — как столица в Civilization."</li>
                   </ul>
                   <div className="my-6 p-2 border border-green-500/30 rounded-lg bg-black/30 max-w-md mx-auto">
                           <div className="aspect-video w-full h-auto overflow-hidden rounded bg-gray-700/30">
                              <Image
                                src={imageUrls['history-ivan3.png']}
                                alt="Стояние на Угре: конец ига"
                                width={500}
                                height={281}
                                className="w-full h-full object-cover"
                                loading="lazy"
                                unoptimized
                               />
                            </div>
                       <p className="text-xs text-center text-gray-400 mt-1 italic">Иван III: "Стоим и побеждаем!"</p>
                    </div>

                  {/* Самопроверка */}
                  <h3 className="flex items-center text-xl font-semibold text-blue-300 mt-6 mb-2">
                    <FaGraduationCap className="mr-2 text-blue-300/80" /> Самопроверка: Тест как в ВПР
                  </h3>
                  <ul className="list-disc list-inside space-y-1 text-gray-300 pl-4 text-base md:text-lg">
                    <li>Что такое иго и как оно кончилось? (Зависимость от Орды, конец в 1480 на Угре)</li>
                    <li>Кто Невский и Донской? (Герои битв с захватчиками)</li>
                    <li>Что такое ярлык и баскаки? (Грамота от хана, сборщики дани)</li>
                  </ul>
                </section>

                {/* Section: Средние века (Зарубежная) */}
                <section className="space-y-4 border-t border-purple-500/20 pt-8">
                  <h2 className="flex items-center text-2xl md:text-3xl font-semibold text-purple-400 mb-4">
                    <FaBuildingColumns className="mr-3 text-purple-400/80" /> 🌍 Средние Века в Европе: Рыцари, Походы и "Феодальный Сервер"
                  </h2>
                  <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                    Глобальный вайб: Европа — как большой RPG-сервер с рыцарями, королями и квестами. Византия — старая империя, феодализм — иерархия, крестовые походы — эпичные рейды.
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-gray-300 pl-4 text-base md:text-lg">
                    <li><strong className="text-purple-400">Византия:</strong> Юстиниан (VI в.) строит Св. Софию; раскол церквей (1054); падение Константинополя (1453) туркам. Аналогия: "Византия — старый сервер, который хакнули."</li>
                    <li><strong className="text-purple-400">Франки:</strong> Карл Великий (800 г.) — император. Мем: "Папа коронует: 'Ты теперь босс Европы!'"</li>
                    <li><strong className="text-purple-400">Феодализм:</strong> Сеньоры (боссы) дают феоды вассалам за службу. Крестьяне пашут. Как в Among Us — все зависят друг от друга.</li>
                    <li><strong className="text-purple-400">Англия:</strong> Великая хартия (1215) — лимит на власть короля; парламент. "Король не может просто так брать налоги!"</li>
                    <li><strong className="text-purple-400">Франция:</strong> Столетняя война (1337-1453), Жанна д`Арк — героиня. Аналогия: "Долгий матч Англия vs Франция."</li>
                    <li><strong className="text-purple-400">Крестовые походы:</strong> XI-XIII вв. — рейды за Святую Землю. Мем: "Папа: 'Вперёд за лутом в Иерусалим!'"</li>
                    <li><strong className="text-purple-400">Города:</strong> Цехи, гильдии — как кланы ремесленников.</li>
                    <li><strong className="text-purple-400">Культура:</strong> Готика (Нотр-Дам — как космический корабль), университеты (Болонья — первые "академии").</li>
                  </ul>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
                     <div className="p-2 border border-purple-500/30 rounded-lg bg-black/30">
                             <div className="aspect-square w-full h-auto overflow-hidden rounded bg-gray-700/30">
                               <Image
                                 src={imageUrls['history-feudalism.png']}
                                 alt="Феодализм: иерархия как лестница"
                                 width={400}
                                 height={250}
                                 className="w-full h-full object-contain bg-white p-1"
                                 loading="lazy"
                                 unoptimized
                               />
                              </div>
                        <p className="text-xs text-center text-gray-400 mt-1 italic">Феодализм: "Лестница власти от короля до крестьянина."</p>
                     </div>
                     <div className="p-2 border border-purple-500/30 rounded-lg bg-black/30">
                             <div className="aspect-square w-full h-auto overflow-hidden rounded bg-gray-700/30">
                               <Image
                                 src={imageUrls['history-crusades.png']}
                                 alt="Крестовые походы: осада Антиохии"
                                 width={400}
                                 height={400}
                                 className="w-full h-full object-cover"
                                 loading="lazy"
                                 unoptimized
                               />
                              </div>
                        <p className="text-xs text-center text-gray-400 mt-1 italic">Походы: "Рейд за Святой Землёй."</p>
                     </div>
                   </div>

                  {/* Самопроверка */}
                  <h3 className="flex items-center text-xl font-semibold text-purple-300 mt-6 mb-2">
                    <FaGraduationCap className="mr-2 text-purple-300/80" /> Самопроверка: Тест как в ВПР
                  </h3>
                  <ul className="list-disc list-inside space-y-1 text-gray-300 pl-4 text-base md:text-lg">
                    <li>Что такое феодализм? (Иерархия сеньоров и вассалов)</li>
                    <li>Кто Карл Великий? (Император франков, 800 г.)</li>
                    <li>Цели крестовых походов? (Освобождение Иерусалима)</li>
                  </ul>
                </section>

                {/* Section: Память о ВОВ */}
                <section className="space-y-4 border-t border-red-500/20 pt-8">
                  <h2 className="flex items-center text-2xl md:text-3xl font-semibold text-red-500 mb-4">
                    <FaStar className="mr-3 text-red-500/80" /> ⭐ Память о Великой Отечественной Войне (1941-1945): Герои, Символы и Почему Это Навсегда
                  </h2>
                  <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                    Это не древность, но важный блок ВПР. ВОВ — как эпический босс-файт всего народа. 9 мая — День Победы: радость с слезами (победа над фашистами, но миллионы потерь).
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-gray-300 pl-4 text-base md:text-lg">
                    <li><strong className="text-red-500">Праздник:</strong> 9 мая — парады, салюты, "Бессмертный полк" (несёшь фото деда-героя).</li>
                    <li><strong className="text-red-500">Смысл:</strong> Подвиг народа: "Радость со слезами" — выиграли, но цена огромная.</li>
                    <li><strong className="text-red-500">Битвы:</strong> Московская (остановили у столицы), Сталинградская (перелом), Курская (танки в деле).</li>
                    <li><strong className="text-red-500">Символы:</strong> "Священная война" (песня-крик), Знамя над Рейхстагом, георгиевская ленточка.</li>
                    <li><strong className="text-red-500">Памятники:</strong> Мамаев курган ("Родина-мать" — статуя зовёт в бой).</li>
                  </ul>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
                     <div className="p-2 border border-red-600/30 rounded-lg bg-black/30">
                             <div className="aspect-video w-full h-auto overflow-hidden rounded bg-gray-700/30">
                                <Image
                                  src={imageUrls['history-ww2-victory.png']}
                                  alt="Знамя над Рейхстагом: символ Победы"
                                  width={400}
                                  height={711}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                  unoptimized
                                 />
                              </div>
                          <p className="text-xs text-center text-gray-400 mt-1 italic">Знамя: "Мы победили!"</p>
                     </div>
                     <div className="p-2 border border-red-600/30 rounded-lg bg-black/30">
                             <div className="aspect-video w-full h-auto overflow-hidden rounded bg-gray-700/30">
                               <Image
                                  src={imageUrls['history-ww2-monument.png']}
                                  alt="Родина-мать: зовёт к подвигу"
                                  width={400}
                                  height={225}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                  unoptimized
                                />
                              </div>
                          <p className="text-xs text-center text-gray-400 mt-1 italic">"Родина зовёт!"</p>
                     </div>
                   </div>

                  {/* Самопроверка */}
                  <h3 className="flex items-center text-xl font-semibold text-red-300 mt-6 mb-2">
                    <FaGraduationCap className="mr-2 text-red-300/80" /> Самопроверка: Тест как в ВПР
                  </h3>
                  <ul className="list-disc list-inside space-y-1 text-gray-300 pl-4 text-base md:text-lg">
                    <li>Когда День Победы? (9 мая)</li>
                    <li>Ключевые битвы? (Москва, Сталинград, Курск)</li>
                    <li>Символы? (Знамя, песня "Священная война", "Родина-мать")</li>
                  </ul>
                </section>

                {/* Final Tip */}
                <section className="border-t border-brand-green/20 pt-8 mt-10 text-center">
                  <h2 className="flex items-center justify-center text-2xl md:text-3xl font-semibold text-brand-green mb-4">
                    <FaMap className="mr-3 text-brand-green/80" /> Финальный Хак: Карта — Твой Секретный Оружие!
                  </h2>
                  <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                    В ВПР может быть контурная карта — запоминай ключевые точки как чекпоинты в игре: Киев (столица древняя), Новгород (северный хаб), Владимир/Москва (центр объединения), Константинополь (византийский босс), реки Днепр/Волга/Нева (торговые трассы), Золотая Орда (восточный враг). Успехов на ВПР — ты справишься, как Невский на льду! 🔥
                  </p>
                </section>

              </CardContent>
            </Card>
          </div>
    </div>
  );
};

export default VprHistoryCheatsheet;