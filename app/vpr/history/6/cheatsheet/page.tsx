"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FaLandmark, FaCalendarDays, FaUserShield, FaShieldHalved,
  FaScroll, FaGraduationCap, FaBuildingColumns, FaStar, FaMap
} from "react-icons/fa6";
import Image from "next/image";

const imageUrls: Record<string, string> = {
  historyVarangians: "https://upload.wikimedia.org/wikipedia/commons/1/16/%D0%92%D0%B0%D1%80%D1%8F%D0%B3%D0%B8.jpg",
  historyBaptism: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/the-baptism-of-russia-1896.jpg!Large-71324dba-453c-4b24-b587-ef83b807fd17.jpg",
  historyYaroslav: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/Yaroslav_the_Wise-09415836-fa19-4ee5-9816-47a06ac717ed.jpg",
  historyMongols: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/1573709092_batyja-na-rus-miniatjura-iz-zhitija-evfrosini-suzdalskoj-xvii-vek-2e27ed16-3791-472a-84fd-37d982c8ab6b.jpg",
  historyNevsky: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/0027_NEVSKY-FINAL-FRAME-1750x875-5599046e-d438-49ea-a57b-1cb458c5098e.jpg",
  historyKulikovo: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/1299747-84c22ba5-9f6d-4fc9-be34-bdb06f69d557.jpg",
  historyIvan3: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/album_alb3350347-007001aa-c7c3-40b7-89fe-50a4491004ca.jpg",
  historyFeudalism: "https://ru-static.z-dn.net/files/d62/328673063ea0e22a24d9392a9c99959e.jpg",
  historyCrusades: "https://upload.wikimedia.org/wikipedia/commons/d/d3/SiegeofAntioch.jpeg",
  historyWW2Victory: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/IMG_20250420_135854-b056be47-8e5b-44f9-bccd-d14ca75fd294.jpg",
  historyWW2Monument: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/motherland-calls.jpg-660bb17c-5de2-4b61-9744-f03b780bf455.jpg",
};

const Pill: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="inline-block bg-white/5 text-xs px-2 py-0.5 rounded-full mr-2">{children}</span>
);

const Takeaway: React.FC<{ text: string }> = ({ text }) => (
  <li className="text-sm md:text-base text-gray-300 list-disc list-inside ml-4">🔑 {text}</li>
);

const QuestionBlock: React.FC<{ q: string; a: string }> = ({ q, a }) => (
  <details className="bg-white/3 p-3 rounded-md border border-white/5">
    <summary className="cursor-pointer font-medium text-gray-100">{q} <span className="text-xs text-gray-400">— проверить</span></summary>
    <div className="mt-2 text-gray-300">
      <strong>Ответ:</strong> <span className="ml-1">{a}</span>
    </div>
  </details>
);

const SectionHeader: React.FC<{ icon: React.ReactNode; title: string; subtitle?: string }> = ({ icon, title, subtitle }) => (
  <div>
    <h2 className="flex items-center text-2xl md:text-3xl font-semibold text-brand-green mb-2">
      <span className="mr-3 text-brand-green/90">{icon}</span>
      {title}
    </h2>
    {subtitle && <p className="text-sm text-gray-400 mb-3">{subtitle}</p>}
  </div>
);

const VprHistoryCheatsheet: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 text-gray-200 py-12 px-4">
      <div className="max-w-5xl mx-auto">
        <Card className="bg-black/80 border border-brand-green/30 rounded-2xl shadow-lg">
          <CardHeader className="text-center border-b border-brand-green/20 p-6">
            <CardTitle className="text-3xl md:text-5xl font-bold text-brand-green">ВПР История 6 класс — Шпаргалка-Квест</CardTitle>
            <p className="text-gray-300 mt-2">Эпично, мемно и полезно: понимаем этапы, запоминаем хаки, тренируемся в тесте.</p>
          </CardHeader>

          <CardContent className="p-6 space-y-8">

            {/* TIMELINE CHEAT */}
            <section className="bg-white/2 p-4 rounded-lg border border-white/5">
              <h3 className="font-semibold text-lg text-gray-100 mb-2">🔭 Быстрый таймлайн (чек-поинты)</h3>
              <div className="flex flex-wrap gap-2">
                <Pill>862 — Призвание варягов (Рюрик)</Pill>
                <Pill>882 — Олег в Киеве</Pill>
                <Pill>988 — Крещение Руси</Pill>
                <Pill>1237–1241 — Нашествие Батыя</Pill>
                <Pill>1240/1242 — Невская / Ледовое</Pill>
                <Pill>1380 — Куликово</Pill>
                <Pill>1480 — Стояние на Угре (конец ига)</Pill>
                <Pill>IX–XV вв. — Средневековая Европа (квесты и крестовые походы)</Pill>
                <Pill>1941–1945 — ВОВ (День Победы 9 мая)</Pill>
              </div>
              <p className="text-xs text-gray-400 mt-2">Хочешь одно правило: помни крупные этапы, потом уже даты. Сначала сюжет — потом цифры.</p>
            </section>

            {/* Section: Древняя Русь */}
            <section className="space-y-4">
              <SectionHeader icon={<FaLandmark />} title="Древняя Русь (до XIII в.) — как собирали государство" subtitle="РОВ — Рюрик, Олег, Владимир: запомнили?"/>
              <p className="text-gray-300 leading-relaxed">
                Коротко: славяне жили как в большом мире-песочнице. В 862 г. — призвали варягов (Рюрик) — пришёл «админ». 882 г. — Олег сделал Киев столицей. 988 г. — Владимир «обновил систему» — принято христианство, культура ускорилась.
              </p>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm text-gray-300 font-medium mb-2">Мнемоника</h4>
                  <ul className="text-gray-300 list-disc list-inside ml-4 space-y-1">
                    <Takeaway text="РОВ — Рюрик (862), Олег (882), Владимир (988) — запоминаем как короткую комбо-цепочку." />
                    <Takeaway text="Крещение = культурный апгрейд: письма, иконы, связи с Византией." />
                    <Takeaway text="«Дружина» — сквад князя; «Вече» — народный чат." />
                  </ul>
                </div>

                <div className="rounded-md overflow-hidden border border-white/5">
                  <div className="aspect-video relative w-full">
                    <Image src={imageUrls.historyVarangians} alt="Варяги" fill className="object-cover" unoptimized/>
                  </div>
                  <div className="p-3 bg-black/60 text-gray-300 text-sm">Варяги: как викинг-админы, которых позвали управлять сервером.</div>
                </div>
              </div>

              <div className="space-y-2">
                <QuestionBlock q="Когда произошло крещение Руси и почему это важно?" a="988 г. — подключение к византийской культуре: письма, храмы, усиление власти князя." />
                <QuestionBlock q="Кто такой Ярослав Мудрый и что он сделал важного?" a="Организовал законы (Русская Правда), строил соборы, заключал династические браки — укрепил государство." />
              </div>
            </section>

            {/* Section: Монгольское иго */}
            <section className="space-y-4 border-t border-white/5 pt-6">
              <SectionHeader icon={<FaShieldHalved />} title="Монгольское иго (XIII–XV вв.) — когда пришёл 'босс' игра" subtitle="Хак: БНК — Батый, Невский, Куликово/Конец"/>
              <p className="text-gray-300 leading-relaxed">
                Батый и монголы — словно большой рейд: захват, разрушения, и потом система вассалитета (ярлыки и дань). Но появились герои — Невский и Донской — которые отбивали внешние угрозы и дали шанс Москве стать центром объединения.
              </p>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <ul className="text-gray-300 list-disc list-inside ml-4 space-y-1">
                    <Takeaway text="1237–1241 — нашествие Батыя: города разорены, начинается зависимость от Орды." />
                    <Takeaway text="Ярлык = бумажка от хана, без неё князь как игрок без пропуска." />
                    <Takeaway text="1380 — Куликово: Донской наносит удар, 1480 — Стояние на Угре — символ конца ига." />
                  </ul>
                </div>

                <div className="rounded-md overflow-hidden border border-white/5">
                  <div className="aspect-video relative w-full">
                    <Image src={imageUrls.historyMongols} alt="Монголы" fill className="object-cover" unoptimized/>
                  </div>
                  <div className="p-3 bg-black/60 text-gray-300 text-sm">Монголы пришли как читеры — на время сломали правила, но систему пересобрали.</div>
                </div>
              </div>

              <div className="space-y-2">
                <QuestionBlock q="Что такое ярлык и баскаки?" a="Ярлык — грамота от хана на княжение; баскаки — сборщики дани/чиновники Орды." />
                <QuestionBlock q="Какие битвы связаны с именем Александра Невского?" a="Невская битва (1240) и Ледовое побоище (1242)." />
              </div>
            </section>

            {/* Section: Средние века (Зарубежная) */}
            <section className="space-y-4 border-t border-white/5 pt-6">
              <SectionHeader icon={<FaBuildingColumns />} title="Средние века в Европе — рыцари, короли, квесты" subtitle="Формула: Крестовые походы + Феодализм + Императоры = мега-сериал"/>
              <p className="text-gray-300 leading-relaxed">
                Представь: Европа — огромный RPG-сервер. Короли выдают земли вассалам, те дают защиту — это феодализм. Крестовые походы — масштабные рейды за святынями. Карл Великий — как босс, которого короновал папа (800 г.).
              </p>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <ul className="text-gray-300 list-disc list-inside ml-4 space-y-1">
                    <Takeaway text="Готика = высокие соборы и витражи; университеты — первые «академии»." />
                    <Takeaway text="1215 г. — Великая хартия вольностей в Англии: ограничение власти короля." />
                    <Takeaway text="Крестовые походы (XI–XIII вв.) — цель: вернуть Иерусалим." />
                  </ul>
                </div>

                <div className="rounded-md overflow-hidden border border-white/5">
                  <div className="aspect-square relative w-full">
                    <Image src={imageUrls.historyCrusades} alt="Крестовые походы" fill className="object-cover" unoptimized/>
                  </div>
                  <div className="p-3 bg-black/60 text-gray-300 text-sm">Крестовые походы — масштабные религиозные рейды с политическими целями.</div>
                </div>
              </div>

              <div className="space-y-2">
                <QuestionBlock q="Кто такой Карл Великий и почему он важен?" a="Император франков, коронован в 800 г., объединил большую часть Западной Европы." />
                <QuestionBlock q="Что такое феодализм?" a="Система отношений: сеньор даёт землю вассалу за службу; крестьяне работают на земле." />
              </div>
            </section>

            {/* Section: Память о ВОВ */}
            <section className="space-y-4 border-t border-white/5 pt-6">
              <SectionHeader icon={<FaStar />} title="Память о ВОВ (1941-1945) — почему это в ВПР?" subtitle="День Победы — главное: 9 мая, память, символы."/>
              <p className="text-gray-300 leading-relaxed">
                Это не древняя история — это то, что хранит память общества. ВПР часто спрашивает про символы, даты и смысл: почему люди чтят память, какие битвы были переломными и какие памятники — знаковые.
              </p>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <ul className="text-gray-300 list-disc list-inside ml-4 space-y-1">
                    <Takeaway text="9 мая — День Победы (подписание капитуляции Германии в 1945)." />
                    <Takeaway text="Главные битвы: Московская, Сталинградская, Курская — ключевые повороты войны." />
                    <Takeaway text="Символы: Знамя Победы, Георгиевская ленточка, 'Родина-мать'." />
                  </ul>
                </div>

                <div className="rounded-md overflow-hidden border border-white/5">
                  <div className="aspect-video relative w-full">
                    <Image src={imageUrls.historyWW2Monument} alt="Родина-мать" fill className="object-cover" unoptimized/>
                  </div>
                  <div className="p-3 bg-black/60 text-gray-300 text-sm">Память — это не только даты, это истории людей и их подвиг.</div>
                </div>
              </div>

              <div className="space-y-2">
                <QuestionBlock q="Когда отмечают День Победы?" a="9 мая (1945 г.)." />
                <QuestionBlock q="Назови один символ Победы и один памятник." a="Знамя Победы; Мамаев курган — статуя Родины-матери." />
              </div>
            </section>

            {/* FINAL HACK */}
            <section className="border-t border-white/5 pt-6">
              <h3 className="text-lg md:text-xl font-semibold">Финальный хак: как учить, чтобы не сойти с ума</h3>
              <ul className="text-gray-300 list-disc list-inside ml-4 space-y-1">
                <li>Учись как в игре: сначала сюжет (главные этапы), потом квесты (битвы) и в конце — даты (чекпоинты).</li>
                <li>Рисуй карту — отмечай 5 точек: Киев, Новгород, Владимир/Москва, Константинополь, места битв (Невское, Куликово, Угра).</li>
                <li>Повтори три раза три ключевые идеи каждой секции (3×3 = 9 — в голове останется лучше).</li>
              </ul>
              <p className="text-sm text-gray-400 mt-3">Хочешь — сделаю экспорт в Markdown/PDF или отдельную версию с вопросами без ответов (для тренировок). Готов подправить вайб — скажи лишь: «еще мемов» или «убери мемы» — как прикажешь, капитан.</p>
            </section>

          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default VprHistoryCheatsheet;