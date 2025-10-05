"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import Link from "next/link";
import Image from "next/image";
import { cn } from '@/lib/utils';

// URLs изображений — обновлённые, с учётом соотношений
const imageUrls: Record<string, string> = {
  'history-varangians.png': "https://tyqnthnifewjrrjlvmor.supabase.co/storage/v1/object/public/vprmath/1history-varangians.jpg", // 16:9
  'history-baptism.png': "https://tyqnthnifewjrrjlvmor.supabase.co/storage/v1/object/public/vprmath/2history-baptism.jpg", 
  'history-yaroslav.png': "https://tyqnthnifewjrrjlvmor.supabase.co/storage/v1/object/public/vprmath/3history-yaroslav.jpg", // 9:16 -> crop
  'history-mongols.png': "https://tyqnthnifewjrrjlvmor.supabase.co/storage/v1/object/public/vprmath/4history-mongols.jpg", // 1:1
  'history-nevsky.png': "https://tyqnthnifewjrrjlvmor.supabase.co/storage/v1/object/public/vprmath/5history-nevsky.jpg", // 16:9
  'history-kulikovo.png': "https://tyqnthnifewjrrjlvmor.supabase.co/storage/v1/object/public/vprmath/6history-kulikovo.jpg", // 9:16 -> crop
  'history-ivan3.png': "https://tyqnthnifewjrrjlvmor.supabase.co/storage/v1/object/public/vprmath/7history-ivan3.jpg", // 16:9
  'history-feudalism.png': "https://tyqnthnifewjrrjlvmor.supabase.co/storage/v1/object/public/vprmath/8history-feudalism.jpg", // 16:10 -> contain
  'history-crusades.png': "https://tyqnthnifewjrrjlvmor.supabase.co/storage/v1/object/public/vprmath/9history-crusades.jpg", // 1:1
  'history-ww2-victory.png': "https://tyqnthnifewjrrjlvmor.supabase.co/storage/v1/object/public/vprmath/10history-ww2-victory.jpg", // 9:16 -> crop
  'history-ww2-monument.png': "https://tyqnthnifewjrrjlvmor.supabase.co/storage/v1/object/public/vprmath/11history-ww2-monument.jpg", // 16:9
};

// Подсказки — короткие, весёлые, bold для ключей
const captions: Record<string, string> = {
  'history-varangians.png': "<strong>Варяги приплывают!</strong> Как викинги на ладьях. <em>862 год — начало Руси!</em> 🛡️",
  'history-baptism.png': "<strong>Крещение Руси!</strong> Владимир в воде. <em>988 год — христианство!</em> ✝️",
  'history-yaroslav.png': "<strong>Ярослав Мудрый!</strong> Расцвет Руси. <em>Законы и соборы!</em> 👑",
  'history-mongols.png': "<strong>Монголы нападают!</strong> Разорение городов. <em>1237-1241 — нашествие Батыя!</em> ⚔️",
  'history-nevsky.png': "<strong>Ледовое побоище!</strong> Александр на льду. <em>1242 год — победа!</em> 🛡️",
  'history-kulikovo.png': "<strong>Куликовская битва!</strong> Поединок героев. <em>1380 год — Донской!</em> 🏇",
  'history-ivan3.png': "<strong>Стояние на Угре!</strong> Конец ига. <em>1480 год — свобода!</em> 🛡️",
  'history-feudalism.png': "<strong>Феодализм!</strong> Лестница сеньоров. <em>Рыцари и вассалы!</em> 🏰",
  'history-crusades.png': "<strong>Крестовые походы!</strong> Осада города. <em>XI-XIII вв. — на Восток!</em> ⚔️",
  'history-ww2-victory.png': "<strong>Знамя Победы!</strong> Над Рейхстагом. <em>1945 — конец войны!</em> ⭐",
  'history-ww2-monument.png': "<strong>Родина-мать!</strong> На Мамаевом. <em>Память о героях!</em> 🎖️",
};

const VprHistoryCheatsheet: React.FC = () => {
  const getCaption = (keyPart: string) => {
    const key = Object.keys(captions).find(k => k.includes(keyPart));
    return key ? captions[key] : 'Шаг за шагом, как в приключении! 🚀';
  };

  const SimpleImage = ({ src, alt, width, height, tooltipKeyPart }: { src: string, alt: string, width: number, height: number, tooltipKeyPart: string }) => (
    <div className="p-2 border border-blue-300/50 rounded-lg bg-blue-50 hover:shadow-md transition-shadow">
      <div className="aspect-square w-full overflow-hidden rounded bg-white"> {/* 1:1 квадрат! */}
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height} // 400x400 для 1:1
          className="w-full h-full object-cover"
          loading="lazy"
          unoptimized
        />
      </div>
      <p className="text-xs text-center text-gray-600 mt-1 italic" dangerouslySetInnerHTML={{ __html: getCaption(tooltipKeyPart) }} /> {/* HTML для bold/em */}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 text-gray-800 pt-20 pb-10 overflow-hidden">
      <div className="absolute inset-0 bg-repeat opacity-10" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` }}></div>

      <div className="relative z-10 container mx-auto px-4">
        <Card className="max-w-4xl mx-auto bg-white/90 backdrop-blur-md text-gray-800 rounded-2xl border border-blue-200 shadow-lg">
          <CardHeader className="text-center border-b border-blue-200 pb-4">
            <CardTitle className="text-3xl md:text-4xl font-bold text-blue-600 flex items-center justify-center mb-2">
              <VibeContentRenderer content="<FaLandmark />" className="mr-2 hover:scale-110 transition-transform" /> История 6 класс: От 0 до героя! Твоя супер-шпаргалка 🏰
            </CardTitle>
            <p className="text-lg text-gray-600 font-medium">Путешествуй во времени! Князья, битвы, замки — всё как приключение. Легко, весело, шаг за шагом. Стань историческим героем! 💥</p>
          </CardHeader>

          <CardContent className="space-y-8 p-4 md:p-6 text-sm md:text-base leading-relaxed">

            {/* Уровень 1: Древняя Русь — Начало приключения! 🇷🇺 */}
            <section className="space-y-4 border-b border-blue-200 pb-6">
              <h2 className={cn("flex items-center text-2xl font-bold text-blue-700 mb-3")}>
                <VibeContentRenderer content="<FaLandmark />" className="mr-2 text-blue-500 hover:scale-110 transition-transform" /> Уровень 1: Древняя Русь — Начало приключения! 🛡️
              </h2>
              <p className="text-gray-700 mb-4">Древняя Русь — как сказка про князей и варягов! Варяги приплыли, Рюрик стал правителем. Потом крещение, расцвет. А ты знал, что Москва упоминается в 1147? Волшебство истории! ✨</p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li><strong>Ключевые даты:</strong> 862 — варяги, 988 — крещение, 1223 — Калка.</li>
                <li><strong>Правители:</strong> Рюрик — начало, Владимир — креститель, Ярослав — мудрый расцвет!</li>
                <li><strong>Термины:</strong> Дружина — друзья князя, вотчина — земля бояр. Культура: иконы, летописи, Кириллица!</li>
                <li><strong>Совет:</strong> Запоминай даты как дни рождения друзей! Ты — исторический рыцарь. 👑</li>
              </ul>
              <h3 className="text-xl font-bold text-blue-600">Миссия 1: Князь-основатель</h3>
              <p>Задача: Кто объединил Киев и Новгород в 882?</p>
              <ul className="list-decimal pl-6 space-y-1">
                <li>Вспомни: Вещий Олег! Хитростью взял Киев.</li>
              </ul>
              <p className="italic text-gray-600">Хинт от героя: Олег — "вещий" как волшебник. Ответ: Вещий Олег. Ты хитрец! 🧙‍♂️</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
                <SimpleImage src={imageUrls['history-varangians.png']} alt="Призвание варягов (862)" width={400} height={400} tooltipKeyPart="history-varangians.png" />
                <SimpleImage src={imageUrls['history-baptism.png']} alt="Крещение Руси (988)" width={400} height={400} tooltipKeyPart="history-baptism.png" />
              </div>

              <h3 className="text-xl font-bold text-blue-600">Миссия 2: Прозвище князя</h3>
              <p>Задача: Какой князь — автор "Поучения детям"?</p>
              <ul className="list-decimal pl-6 space-y-1">
                <li>Владимир Мономах! Написал советы детям.</li>
              </ul>
              <p className="italic text-gray-600">Хинт: Мономах — как "единоборец". Ответ: Владимир Мономах. Умный совет! 📜</p>

              <h3 className="text-xl font-bold text-blue-600">Миссия 3: Событие-дата</h3>
              <p>Задача: Когда первое упоминание Москвы? (1147)</p>
              <ul className="list-decimal pl-6 space-y-1">
                <li>Вспомни: 1147 год — Юрий Долгорукий пригласил союзника.</li>
              </ul>
              <p className="italic text-gray-600">Хинт: Москва — как день рождения города. Ответ: 1147. Уровень пройден! 🚀</p>
              <SimpleImage src={imageUrls['history-yaroslav.png']} alt="Ярослав Мудрый - расцвет Руси" width={400} height={400} tooltipKeyPart="history-yaroslav.png" />
            </section>

            {/* Уровень 2: Русь под Игом — Битвы и свобода! 🛡️ */}
            <section className="space-y-4 border-b border-blue-200 pb-6">
              <h2 className={cn("flex items-center text-2xl font-bold text-blue-700 mb-3")}>
                <VibeContentRenderer content="<FaShieldHalved />" className="mr-2 text-blue-500 hover:scale-110 transition-transform" /> Уровень 2: Русь под Игом — Битвы и свобода! ⚔️
              </h2>
              <p className="text-gray-700 mb-4">Монголы напали, Русь под игом. Но герои сражались: Невский на льду, Донской на поле! Конец — стояние на Угре. А ты герой битв? 💪</p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li><strong>Нашествие:</strong> 1237-1241 — Батый. Иго: ярлык, дань, баскаки.</li>
                <li><strong>Борьба:</strong> Невский — Невская (1240), Ледовое (1242). Донской — Куликово (1380).</li>
                <li><strong>Объединение:</strong> Москва — центр. Иван III — конец ига (1480), Судебник.</li>
                <li><strong>Совет:</strong> Помни героев: Невский — лёд, Донской — поле! Ты — воин истории. 🏇</li>
              </ul>
              <h3 className="text-xl font-bold text-blue-600">Миссия 1: Конец ига</h3>
              <p>Задача: Событие 1480 — конец ига?</p>
              <ul className="list-decimal pl-6 space-y-1">
                <li>Стояние на Угре: армии стояли, ордынцы ушли.</li>
              </ul>
              <p className="italic text-gray-600">Хинт: Не битва, а стояние — как переглядки! Ответ: Стояние на Угре. Свобода! 🎉</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
                <SimpleImage src={imageUrls['history-mongols.png']} alt="Нашествие Батыя (1237-1241)" width={400} height={400} tooltipKeyPart="history-mongols.png" />
                <SimpleImage src={imageUrls['history-nevsky.png']} alt="Ледовое побоище (1242)" width={400} height={400} tooltipKeyPart="history-nevsky.png" />
              </div>

              <h3 className="text-xl font-bold text-blue-600">Миссия 2: Битва с рыцарями</h3>
              <p>Задача: Сражение 1242, Александр Невский разбил рыцарей?</p>
              <ul className="list-decimal pl-6 space-y-1">
                <li>Ледовое побоище на Чудском озере.</li>
              </ul>
              <p className="italic text-gray-600">Хинт: Лёд трещал под рыцарями! Ответ: Ледовое побоище. Холодная победа! ❄️</p>
              <SimpleImage src={imageUrls['history-kulikovo.png']} alt="Куликовская битва (1380)" width={400} height={400} tooltipKeyPart="history-kulikovo.png" />

              <h3 className="text-xl font-bold text-blue-600">Миссия 3: Объединение</h3>
              <p>Задача: Кто центр объединения — Москва, князь Калита?</p>
              <ul className="list-decimal pl-6 space-y-1">
                <li>Иван Калита — собирал земли, дань платил, Москву укрепил.</li>
              </ul>
              <p className="italic text-gray-600">Хинт: Калита — "мешок с деньгами", купил земли! Ответ: Иван Калита. Уровень пройден! 🚀</p>
              <SimpleImage src={imageUrls['history-ivan3.png']} alt="Стояние на Угре (1480)" width={400} height={400} tooltipKeyPart="history-ivan3.png" />
            </section>

            {/* Уровень 3: Средние века — Зарубежные приключения! 🌍 */}
            <section className="space-y-4 border-b border-blue-200 pb-6">
              <h2 className={cn("flex items-center text-2xl font-bold text-purple-700 mb-3")}>
                <VibeContentRenderer content="<FaBuildingColumns />" className="mr-2 text-purple-500 hover:scale-110 transition-transform" /> Уровень 3: Средние века — Зарубежные приключения! 🏰
              </h2>
              <p className="text-gray-700 mb-4">Европа: рыцари, замки, походы! Византия — императоры, София. Франки — Карл Великий. Феодализм — лестница вассалов. А ты рыцарь? ⚔️</p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li><strong>Византия:</strong> Юстиниан, София, раскол 1054, падение 1453.</li>
                <li><strong>Франки:</strong> Карл Великий — император 800.</li>
                <li><strong>Феодализм:</strong> Сеньоры-вассалы, рыцари, замки.</li>
                <li><strong>Англия/Франция:</strong> Хартия 1215, Столетняя война, Жанна д`Арк.</li>
                <li><strong>Походы:</strong> Крестовые XI-XIII.</li>
                <li><strong>Города/Культура:</strong> Цехи, готика, университеты.</li>
                <li><strong>Совет:</strong> Рыцари — кодекс чести! Ты — путешественник по векам. 🧳</li>
              </ul>
              <h3 className="text-xl font-bold text-purple-600">Миссия 1: Император</h3>
              <p>Задача: Кто коронован императором в 800?</p>
              <ul className="list-decimal pl-6 space-y-1">
                <li>Карл Великий — франки, огромная империя.</li>
              </ul>
              <p className="italic text-gray-600">Хинт: Карл — "великий" как гигант! Ответ: Карл Великий. Ты король! 👑</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
                <SimpleImage src={imageUrls['history-feudalism.png']} alt="Феодальная система" width={400} height={400} tooltipKeyPart="history-feudalism.png" />
                <SimpleImage src={imageUrls['history-crusades.png']} alt="Крестовые походы" width={400} height={400} tooltipKeyPart="history-crusades.png" />
              </div>

              <h3 className="text-xl font-bold text-purple-600">Миссия 2: Война</h3>
              <p>Задача: Длительная война Англии и Франции (1337-1453)?</p>
              <ul className="list-decimal pl-6 space-y-1">
                <li>Столетняя война — за престол, Жанна д`Арк героиня.</li>
              </ul>
              <p className="italic text-gray-600">Хинт: 100+ лет битв! Ответ: Столетняя война. Ты воин! ⚔️</p>

              <h3 className="text-xl font-bold text-purple-600">Миссия 3: Раскол</h3>
              <p>Задача: Раскол церкви в 1054?</p>
              <ul className="list-decimal pl-6 space-y-1">
                <li>Великая схизма: Католическая и Православная.</li>
              </ul>
              <p className="italic text-gray-600">Хинт: Папа vs Патриарх — ссора! Ответ: Великая схизма. Уровень пройден! 🚀</p>
            </section>

            {/* Уровень 4: Память о ВОВ — Герои войны! ⭐ */}
            <section className="space-y-4">
              <h2 className={cn("flex items-center text-2xl font-bold text-red-700 mb-3")}>
                <VibeContentRenderer content="<FaStar />" className="mr-2 text-red-500 hover:scale-110 transition-transform" /> Уровень 4: Память о ВОВ — Герои войны! 🎖️
              </h2>
              <p className="text-gray-700 mb-4">ВОВ — подвиг народа! День Победы 9 мая. Битвы: Москва, Сталинград, Курск. Символы: Знамя, "Священная война", памятники. Ты помнишь героев? 🇷🇺</p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li><strong>Праздник:</strong> 9 мая — радость и слёзы.</li>
                <li><strong>Битвы:</strong> Сталинград — перелом, Москва — первое поражение немцев.</li>
                <li><strong>Символы:</strong> Знамя над Рейхстагом, Родина-мать.</li>
                <li><strong>Совет:</strong> Чти память — смотри фильмы, читай книги! Ты — хранитель истории. 🕯️</li>
              </ul>
              <h3 className="text-xl font-bold text-red-600">Миссия 1: Песня</h3>
              <p>Задача: Песня — символ ВОВ, "Вставай, страна огромная"?</p>
              <ul className="list-decimal pl-6 space-y-1">
                <li>"Священная война" — призыв к бою.</li>
              </ul>
              <p className="italic text-gray-600">Хинт: Песня первых дней войны. Ответ: "Священная война". Ты герой! ⭐</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
                <SimpleImage src={imageUrls['history-ww2-victory.png']} alt="Знамя Победы" width={400} height={400} tooltipKeyPart="history-ww2-victory.png" />
                <SimpleImage src={imageUrls['history-ww2-monument.png']} alt="Родина-мать" width={400} height={400} tooltipKeyPart="history-ww2-monument.png" />
              </div>

              <h3 className="text-xl font-bold text-red-600">Миссия 2: Битва</h3>
              <p>Задача: Битва 1941-1942 — первое поражение Германии?</p>
              <ul className="list-decimal pl-6 space-y-1">
                <li>Битва под Москвой — отбросили врага.</li>
              </ul>
              <p className="italic text-gray-600">Хинт: Зимой под столицей! Ответ: Битва под Москвой. Победа! 🎖️</p>

              <h3 className="text-xl font-bold text-red-600">Миссия 3: Памятник</h3>
              <p>Задача: Комплекс в Волгограде — Сталинградская битва?</p>
              <ul className="list-decimal pl-6 space-y-1">
                <li>Мамаев курган — "Родина-мать зовёт!".</li>
              </ul>
              <p className="italic text-gray-600">Хинт: Гигантская статуя на холме. Ответ: Мамаев курган. Уровень пройден! 🚀</p>
            </section>

            {/* Финал: Ты — чемпион! 🏆 */}
            <section className="text-center pt-6 border-t border-blue-200">
              <h2 className={cn("flex items-center justify-center text-xl font-bold text-yellow-600 mb-4")}>
                <VibeContentRenderer content="<FaLightbulb />" className="mr-2 hover:scale-110 transition-transform" /> Ты — герой истории! Последние хитрости:
              </h2>
              <ul className="text-left max-w-md mx-auto space-y-2 text-gray-700">
                <li><strong>📖 Читай вопрос дважды:</strong> что именно спрашивают? Как рыцарь перед битвой!</li>
                <li><strong>✏️ Рисуй:</strong> карты, битвы, князей — помогает видеть прошлое! 🎨</li>
                <li><strong>✅ Проверяй:</strong> ответ логичный? (Не 2000 год для Невского, ха-ха!) 😄</li>
                <li><strong>🎮 Играй:</strong> решай по 1 миссии в день, как уровень в игре. Уровень up! 🚀</li>
              </ul>
              <p className="mt-4 text-lg font-semibold text-blue-600">Ты прошёл путь от 0 до героя! ВПР — лёгкая миссия. Удачи, чемпион! 🌟 Ты звезда истории!</p>
              <div className="mt-6">
                <Link href="/vpr-tests" className="inline-block bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-all">
                  ← К тестам и другим шпаргалкам
                </Link>
              </div>
            </section>

          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default VprHistoryCheatsheet;