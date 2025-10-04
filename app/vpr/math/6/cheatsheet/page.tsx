"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import Link from "next/link";
import Image from "next/image";
import { cn } from '@/lib/utils';

// URLs изображений — твои сгенерированные 1:1
const imageUrls: Record<string, string> = {
  'math-arith-*.png': 'https://tyqnthnifewjrrjlvmor.supabase.co/storage/v1/object/public/vprmath/m1.jpg', // Супергерой-математика
  'math-fractions-*.png': 'https://tyqnthnifewjrrjlvmor.supabase.co/storage/v1/object/public/vprmath/m2.jpg', // Пицца для дробей
  'math-percent-*.png': 'https://tyqnthnifewjrrjlvmor.supabase.co/storage/v1/object/public/vprmath/m3.jpg', // Круговая диаграмма %
  'math-diagram-*.png': 'https://tyqnthnifewjrrjlvmor.supabase.co/storage/v1/object/public/vprmath/m4.jpg', // Столбчатая диаграмма
  'math-coord-*.png': 'https://tyqnthnifewjrrjlvmor.supabase.co/storage/v1/object/public/vprmath/m5.jpg', // Координатная прямая
  'math-logic-*.png': 'https://tyqnthnifewjrrjlvmor.supabase.co/storage/v1/object/public/vprmath/m6.jpg', // Пазл-логика
  'math-geo-*.png': 'https://tyqnthnifewjrrjlvmor.supabase.co/storage/v1/object/public/vprmath/m7.jpg', // Геометрия Lego-стиль
};

// Подсказки — короткие, весёлые, bold для ключей
const captions: Record<string, string> = {
  'math-arith-*.png': "<strong>Числа — супергерои!</strong> Минус — враги, умножение — клоны. <em>Сначала скобки!</em> 😂",
  'math-fractions-*.png': "<strong>Дроби как пицца:</strong> числитель — кусочки, знаменатель — части. <em>Складывай с общим!</em> 🍕",
  'math-percent-*.png': "<strong>Проценты — доли от 100.</strong> Скидка 20%? ×0.8. <em>Проверяй: логично?</em> 💰",
  'math-diagram-*.png': "<strong>Диаграммы — карта клада!</strong> Суммируй столбцы, ищи >70 мм. <em>Ты — охотник!</em> 🗺️",
  'math-coord-*.png': "<strong>Прямая — дорога:</strong> минус влево, плюс вправо. <em>Ближе к метке — то число!</em> 🛣️",
  'math-logic-*.png': "<strong>Логика — пазл:</strong> рисуй семью, считай сестёр. <em>+3 каждый разрыв!</em> 🧩",
  'math-geo-*.png': "<strong>Геометрия — Lego!</strong> Симметрия — зеркало, кубик: <em>1+6=7.</em> 🧱",
};

const MathCheatsheet: React.FC = () => {
  const getCaption = (keyPart: string) => {
    const key = Object.keys(captions).find(k => k.includes(keyPart));
    return key ? captions[key] : 'Шаг за шагом, как в игре! 🎮';
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
              <VibeContentRenderer content="<FaCalculator />" className="mr-2 hover:scale-110 transition-transform" /> Математика 6 класс: Твоя Супер-Шпаргалка! 🦸‍♂️
            </CardTitle>
            <p className="text-lg text-gray-600 font-medium">Числа — твои друзья! Разберём ВПР как приключение. Легко, весело, шаг за шагом. Ты справишься! 💪</p>
          </CardHeader>

          <CardContent className="space-y-8 p-4 md:p-6 text-sm md:text-base leading-relaxed">

            {/* Раздел 1: Арифметика — Базовые супергерои */}
            <section className="space-y-4 border-b border-blue-200 pb-6">
              <h2 className={cn("flex items-center text-2xl font-bold text-blue-700 mb-3")}>
                <VibeContentRenderer content="<FaPlusMinus />" className="mr-2 text-blue-500 hover:scale-110 transition-transform" /> 1. Арифметика: Числа дерутся и дружат! ⚔️
              </h2>
              <p className="text-gray-700 mb-4">Представь: положительные числа — <strong>добрые рыцари</strong>, отрицательные — <em>тени-невидимки</em>. Умножаем? <strong>Копируем силу!</strong> Делим? <em>Раздаём поровну, как конфеты.</em> Всегда сначала скобки — <strong>спаси команду!</strong> 😂</p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li><strong>Пример из ВПР:</strong> –2 · (54 – 129) = ? <br /> Шаг 1: Скобки! 54 - 129 = -75. <br /> Шаг 2: -2 × -75 = +150 (два 'тени' = светло и весело!). <em>Ответ: 150</em> 🎉</li>
                <li><strong>Совет:</strong> Отрицательные: + × + = +, + × - = -, - × - = +. Дели? То же правило! Ты — рефери в битве чисел. 👊</li>
              </ul>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SimpleImage src={imageUrls['math-arith-*.png']} alt="Супергерои чисел в бою" width={400} height={400} tooltipKeyPart="math-arith-*.png" />
              </div>
            </section>

            {/* Раздел 2: Дроби — Пицца для всех! 🍕 */}
            <section className="space-y-4 border-b border-blue-200 pb-6">
              <h2 className={cn("flex items-center text-2xl font-bold text-green-700 mb-3")}>
                <VibeContentRenderer content="<FaDivide />" className="mr-2 text-green-500 hover:scale-110 transition-transform" /> 2. Дроби: Разделим пиццу поровну! 
              </h2>
              <p className="text-gray-700 mb-4">Дробь — это <strong>кусочек от целого</strong>, как пицца на празднике! Числитель — <em>сколько кусочков взял</em>, знаменатель — <strong>на сколько разрезали</strong>. Складываем? <em>Общий размер пиццы!</em> Умножаем? <strong>Кусок на кусок — ещё вкуснее.</strong> 😋</p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li><strong>Пример из ВПР:</strong> (6/5 - 3/4) × 2/3 = ? <br /> Шаг 1: 6/5 - 3/4 = (24-15)/20 = 9/20. <br /> Шаг 2: 9/20 × 2/3 = 18/60 = 3/10. <em>Ответ: 3/10</em> — твоя порция! 🍕</li>
                <li><strong>Совет:</strong> Дробь >1? Это <em>целое + кусочек</em> (смешанная, как бургер). Сокращай всегда — дели на общий 'друг'! Делись с друзьями. 👯</li>
              </ul>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SimpleImage src={imageUrls['math-fractions-*.png']} alt="Пицца с дробями" width={400} height={400} tooltipKeyPart="math-fractions-*.png" />
              </div>
            </section>

            {/* Раздел 3: Проценты — Секретные скидки! 🛒 */}
            <section className="space-y-4 border-b border-blue-200 pb-6">
              <h2 className={cn("flex items-center text-2xl font-bold text-purple-700 mb-3")}>
                <VibeContentRenderer content="<FaPercent />" className="mr-2 text-purple-500 hover:scale-110 transition-transform" /> 3. Проценты: Скидки и бонусы в магазине!
              </h2>
              <p className="text-gray-700 mb-4">Проценты — <strong>доля от 100</strong>, как кусок пирога на торте! 50% — <em>половина веселья</em>. Увеличили на 20%? ×1.2. Снизили на 20%? ×0.8. Но помни: +20% и -20% — <strong>не возвращает назад, сюрприз!</strong> 😲</p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li><strong>Пример из ВПР:</strong> Коньки 4500 руб. -20%, +20%. Итог? <br /> Шаг 1: 4500 × 0.8 = 3600. <br /> Шаг 2: 3600 × 1.2 = 4320. <em>Ответ: 4320 руб.</em> — твоя скидочная победа! 🛍️</li>
                <li><strong>Совет:</strong> 'Осталось после скидки' = 100% - %. Читай внимательно: <em>'увеличили' или 'уменьшили'?</em> Ты — шопинг-детектив! 🔍</li>
              </ul>
              <SimpleImage src={imageUrls['math-percent-*.png']} alt="Круг с процентами" width={400} height={400} tooltipKeyPart="math-percent-*.png" />
            </section>

            {/* Раздел 4: Диаграммы — Карта сокровищ! 🗺️ */}
            <section className="space-y-4 border-b border-blue-200 pb-6">
              <h2 className={cn("flex items-center text-2xl font-bold text-orange-700 mb-3")}>
                <VibeContentRenderer content="<FaChartBar />" className="mr-2 text-orange-500 hover:scale-110 transition-transform" /> 4. Диаграммы: Считаем кладу по столбцам!
              </h2>
              <p className="text-gray-700 mb-4">Столбцы — <strong>высота горы с сокровищами</strong>! Суммируй цвета для 'всего'. >70 мм? <em>Смотри, где столбик выше черты.</em> Ты — <strong>охотник за числами</strong>, ура! 🏴‍☠️</p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li><strong>Пример из ВПР:</strong> Сколько учеников сдали тест? (Диаграмма оценок). <br /> Шаг 1: 3+6+8+5=22. <em>Ответ: 22</em> — твоя команда в сборе! 📊</li>
                <li><strong>Совет:</strong> Читай подписи! Сумма столбцов = <em>общее сокровище</em>. Разница max-min = 'прыжок в приключение'! 🚀</li>
              </ul>
              <SimpleImage src={imageUrls['math-diagram-*.png']} alt="Столбчатая диаграмма" width={400} height={400} tooltipKeyPart="math-diagram-*.png" />
            </section>

            {/* Раздел 5: Координаты — Дорога с номерами! 🛣️ */}
            <section className="space-y-4 border-b border-blue-200 pb-6">
              <h2 className={cn("flex items-center text-2xl font-bold text-red-700 mb-3")}>
                <VibeContentRenderer content="<FaMapLocationDot />" className="mr-2 text-red-500 hover:scale-110 transition-transform" /> 5. Координаты: Точки на дороге!
              </h2>
              <p className="text-gray-700 mb-4">Прямая — <strong>как волшебная улица</strong>: 0 — центр города, лево — минус (туман), право — плюс (солнце). Точка A слева от B? <em>Выбери меньшее число!</em> Смотри расстояние до меток — как к дому друга. 🏠</p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li><strong>Пример из ВПР:</strong> A, B, C на прямой. Соответствие? <br /> Шаг 1: A ≈0.67 (2/3), B=1.5 (3/2), C=2.9. <em>Ответ: 341</em> — точка в точку! 🎯</li>
                <li><strong>Совет:</strong> Рисуй стрелку: от 0 влево/вправо. <strong>Ближе к метке — то число!</strong> Ты — капитан карты. 🧭</li>
              </ul>
              <SimpleImage src={imageUrls['math-coord-*.png']} alt="Координатная прямая с точками" width={400} height={400} tooltipKeyPart="math-coord-*.png" />
            </section>

            {/* Раздел 6: Логика — Пазлы для мозга! 🧩 */}
            <section className="space-y-4 border-b border-blue-200 pb-6">
              <h2 className={cn("flex items-center text-2xl font-bold text-indigo-700 mb-3")}>
                <VibeContentRenderer content="<FaBrain />" className="mr-2 text-indigo-500 hover:scale-110 transition-transform" /> 6. Логика: Разгадываем загадки!
              </h2>
              <p className="text-gray-700 mb-4">Не просто цифры, а <strong>'почему?'</strong> — как детектив! Семья детей? <em>Считай для каждого: 'у меня сестры — все девочки минус я'.</em> Можно ли 30 частей? <strong>Смотри правило +3 каждый раз!</strong> Ты — мастер пазлов. 🕵️‍♂️</p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li><strong>Пример из ВПР:</strong> 5 детей (3М,2Д). Верные? <br /> Шаг 1: У девочки 1 сестра (не 2). 3) Да, мальчиков больше! 4) Да, по 2 брата/сестры. <em>Ответ: 34</em> — загадка решена! 🔍</li>
                <li><strong>Совет:</strong> Рисуй: мальчик — квадратик, девочка — кружок. <em>Проверь каждое 'да/нет'.</em> Нет спешки — наслаждайся! 😊</li>
              </ul>
              <SimpleImage src={imageUrls['math-logic-*.png']} alt="Пазл с семьёй" width={400} height={400} tooltipKeyPart="math-logic-*.png" />
            </section>

            {/* Раздел 7: Геометрия — Конструктор Lego! 🧱 */}
            <section className="space-y-4">
              <h2 className={cn("flex items-center text-2xl font-bold text-teal-700 mb-3")}>
                <VibeContentRenderer content="<FaRulerCombined />" className="mr-2 text-teal-500 hover:scale-110 transition-transform" /> 7. Геометрия: Строим фигуры!
              </h2>
              <p className="text-gray-700 mb-4">Симметрия — <strong>'волшебное зеркало'!</strong> Отражаем по линии — как в сказке. Кубик: <em>напротив 1 — 6 (сумма 7)</em>. Оси треугольника? <strong>Три через вершину к базе</strong> — супер-замок! 🏰</p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li><strong>Пример из ВПР:</strong> Симметрия треугольника? <em>Ответ: 3 оси</em> — твой Lego-шедевр! 🎨</li>
                <li><strong>Совет:</strong> Бумага + карандаш: нарисуй и сложи — <em>совпадает?</em> Ты — архитектор фигур, строишь мечты! 🏗️</li>
              </ul>
              <SimpleImage src={imageUrls['math-geo-*.png']} alt="Симметрия и кубик" width={400} height={400} tooltipKeyPart="math-geo-*.png" />
            </section>

            {/* Финальный совет: Ты — чемпион! 🏆 */}
            <section className="text-center pt-6 border-t border-blue-200">
              <h2 className={cn("flex items-center justify-center text-xl font-bold text-yellow-600 mb-4")}>
                <VibeContentRenderer content="<FaLightbulb />" className="mr-2 hover:scale-110 transition-transform" /> Ты — супергерой чисел! Последние хитрости:
              </h2>
              <ul className="text-left max-w-md mx-auto space-y-2 text-gray-700">
                <li><strong>📖 Читай вопрос дважды:</strong> что именно спрашивают? Не торопись, как супергерой перед прыжком!</li>
                <li><strong>✏️ Рисуй:</strong> линии, пиццы, семьи — помогает видеть магию чисел! 🎨</li>
                <li><strong>✅ Проверяй:</strong> ответ логичный? (Не 1000 км для муравья, ха-ха!) 😄</li>
                <li><strong>🎮 Играй:</strong> решай по 1 миссии в день, как уровень в любимой игре. Уровень up! 🚀</li>
              </ul>
              <p className="mt-4 text-lg font-semibold text-blue-600">Ты справишься! ВПР — твоя арена. Удачи, герой! 🌟 Ты уже звезда!</p>
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

export default MathCheatsheet;