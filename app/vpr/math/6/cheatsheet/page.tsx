"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { FaCalculator, FaPlusMinus, FaDivide, FaPercent, FaChartBar, FaRulerCombined, FaMapMarkedAlt, FaBrain, FaGamepad, FaLightbulb } from "react-icons/fa6";
import Link from "next/link";
import Image from "next/image";

// Описания для тултипов — простые, как сказка
const tooltipDescriptions: Record<string, string> = {
  'math-arith-*.png': "Представь: числа — как супергерои! Минус — это 'враги' (отнимаем), умножение — 'клоны' (множим силу). Отрицательные? Это просто 'зеркальные' герои. Шаг за шагом: сначала скобки (спаси друга!), потом умножение/деление, потом +/-. Никогда не торопись!",
  'math-fractions-*.png': "Дроби — как пицца: числитель — кусочки, знаменатель — сколько всего. Складываем? Ищем общий 'дом' (знаменатель). Умножаем? Просто 'кусочек на кусочек'. Делишь? Переворачиваем вторую и умножаем. Легко, как есть пиццу!",
  'math-percent-*.png': "Проценты — это 'доли от 100'. 50% — половина пирога! Чтобы найти 'сколько от чего': (часть / целое) * 100. Скидка 20%? Цена * 0.8. Увеличили на 10%? Цена * 1.1. Всегда проверяй: итог логичный?",
  'math-diagram-*.png': "Диаграммы — как карта сокровищ! Столбцы — высота клада. Считай: сколько выше линии? Суммируй цвета. В месяце >70 мм осадков? Смотри, где столбик 'выше черты'. Ты — детектив чисел!",
  'math-coord-*.png': "Координатная прямая — как дорога с номерами домов. Отрицательные — 'за углом налево'. Точки A, B, C? Смотри: A слева от 0? Выбери отрицательное число. Шаг: найди ближайшее по позиции!",
  'math-logic-*.png': "Логика — как пазл супергероя. 'Можно ли получить 1?' — пробуй шаги назад: от 1 прибавь 2018, потом 'стирай' цифры. Семья с детьми? Считай сестёр/братьев для каждого. Нет спешки — рисуй картинку!",
  'math-geo-*.png': "Геометрия — как конструктор Lego! Симметрия — зеркало: отрази фигуру по линии. Кубик? Противоположные грани = 7 очков. Оси симметрии треугольника? Три 'волшебные' линии через вершины!",
};

// URLs изображений — внешние или плейсхолдеры для визуалов
const imageUrls: Record<string, string> = {
  'math-arith-*.png': 'https://example.com/math-arith-example.jpg', // Пример: базовые операции
  'math-fractions-*.png': 'https://example.com/math-fractions-pizza.jpg', // Пицца для дробей
  'math-percent-*.png': 'https://example.com/math-percent-pie.jpg', // Круговая диаграмма %
  'math-diagram-*.png': 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/math/diagram-example.png', // Диаграмма осадков
  'math-coord-*.png': 'https://example.com/math-coord-line.jpg', // Координатная прямая
  'math-logic-*.png': 'https://example.com/math-logic-puzzle.jpg', // Пазл с шарами/детьми
  'math-geo-*.png': 'https://example.com/math-geo-symmetry.jpg', // Симметрия и кубик
};

const MathCheatsheet: React.FC = () => {
  const getTooltip = (keyPart: string) => {
    const key = Object.keys(tooltipDescriptions).find(k => k.includes(keyPart));
    return key ? tooltipDescriptions[key] : 'Подсказка: шаг за шагом, как в игре!';
  };

  const ImageWithTooltip = ({ src, alt, width, height, tooltipKeyPart }: { src: string, alt: string, width: number, height: number, tooltipKeyPart: string }) => (
    <div className="p-2 border border-blue-300/50 rounded-lg bg-blue-50 hover:shadow-md transition-shadow">
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="aspect-video w-full overflow-hidden rounded bg-white">
            <Image
              src={src}
              alt={alt}
              width={width}
              height={height}
              className="w-full h-full object-cover cursor-help"
              loading="lazy"
              unoptimized
            />
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs bg-yellow-100 border border-yellow-300 text-blue-800 p-2 rounded text-sm">
          {getTooltip(tooltipKeyPart)}
        </TooltipContent>
      </Tooltip>
      <p className="text-xs text-center text-gray-600 mt-1">{alt}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 text-gray-800 pt-20 pb-10 overflow-hidden">
      <div className="absolute inset-0 bg-repeat opacity-10" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` }}></div>

      <div className="relative z-10 container mx-auto px-4">
        <Card className="max-w-4xl mx-auto bg-white/90 backdrop-blur-md text-gray-800 rounded-2xl border border-blue-200 shadow-lg">
          <CardHeader className="text-center border-b border-blue-200 pb-4">
            <CardTitle className="text-3xl md:text-4xl font-bold text-blue-600 flex items-center justify-center mb-2">
              <FaCalculator className="mr-2" /> Математика 6 класс: Твоя Супер-Шпаргалка! 🦸‍♂️
            </CardTitle>
            <p className="text-lg text-gray-600 font-medium">Числа — твои друзья! Разберём ВПР как приключение. Легко, весело, шаг за шагом. Ты справишься! 💪</p>
          </CardHeader>

          <CardContent className="space-y-8 p-4 md:p-6 text-sm md:text-base leading-relaxed">

            {/* Раздел 1: Арифметика — Базовые супергерои */}
            <section className="space-y-4 border-b border-blue-200 pb-6">
              <h2 className="flex items-center text-2xl font-bold text-blue-700 mb-3">
                <FaPlusMinus className="mr-2 text-blue-500" /> 1. Арифметика: Числа дерутся и дружат! ⚔️
              </h2>
              <p className="text-gray-700 mb-4">Представь: положительные числа — 'добрые рыцари', отрицательные — 'тени'. Умножаем? 'Копируем силу'! Делим? 'Раздаём поровну'. Всегда сначала скобки — 'спаси команду'!</p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li><strong>Пример из ВПР:</strong> –2 · (54 – 129) = ? <br /> Шаг 1: Скобки! 54 - 129 = -75. <br /> Шаг 2: -2 × -75 = +150 (два 'тени' = свет!). <em>Ответ: 150</em></li>
                <li><strong>Совет:</strong> Отрицательные: + × + = +, + × - = -, - × - = +. Дели? То же правило!</li>
              </ul>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ImageWithTooltip src={imageUrls['math-arith-*.png']} alt="Супергерои чисел в бою" width={400} height={225} tooltipKeyPart="math-arith-*.png" />
              </div>
            </section>

            {/* Раздел 2: Дроби — Пицца для всех! 🍕 */}
            <section className="space-y-4 border-b border-blue-200 pb-6">
              <h2 className="flex items-center text-2xl font-bold text-green-700 mb-3">
                <FaDivide className="mr-2 text-green-500" /> 2. Дроби: Разделим пиццу поровну! 
              </h2>
              <p className="text-gray-700 mb-4">Дробь — это 'кусочек от целого'. Числитель — сколько кусочков взял, знаменатель — на сколько разрезали. Складываем? 'Общий размер пиццы'! Умножаем? 'Кусок на кусок'.</p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li><strong>Пример из ВПР:</strong> (6/5 - 3/4) × 2/3 = ? <br /> Шаг 1: 6/5 - 3/4 = (24-15)/20 = 9/20. <br /> Шаг 2: 9/20 × 2/3 = 18/60 = 3/10. <em>Ответ: 3/10</em></li>
                <li><strong>Совет:</strong> Дробь >1? Это 'целое + кусочек' (смешанная). Сокращай всегда — дели на общий 'друг'!</li>
              </ul>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ImageWithTooltip src={imageUrls['math-fractions-*.png']} alt="Пицца с дробями" width={400} height={225} tooltipKeyPart="math-fractions-*.png" />
              </div>
            </section>

            {/* Раздел 3: Проценты — Секретные скидки! 🛒 */}
            <section className="space-y-4 border-b border-blue-200 pb-6">
              <h2 className="flex items-center text-2xl font-bold text-purple-700 mb-3">
                <FaPercent className="mr-2 text-purple-500" /> 3. Проценты: Скидки и бонусы в магазине!
              </h2>
              <p className="text-gray-700 mb-4">Проценты — 'доля от 100'. 50% — половина! Увеличили на 20%? ×1.2. Снизили на 20%? ×0.8. Но помни: +20% и -20% — не возвращает назад!</p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li><strong>Пример из ВПР:</strong> Коньки 4500 руб. -20%, +20%. Итог? <br /> Шаг 1: 4500 × 0.8 = 3600. <br /> Шаг 2: 3600 × 1.2 = 4320. <em>Ответ: 4320 руб.</em></li>
                <li><strong>Совет:</strong> 'Осталось после скидки' = 100% - %. Читай внимательно: 'увеличили' или 'уменьшили'?</li>
              </ul>
              <ImageWithTooltip src={imageUrls['math-percent-*.png']} alt="Круг с процентами" width={400} height={400} tooltipKeyPart="math-percent-*.png" />
            </section>

            {/* Раздел 4: Диаграммы — Карта сокровищ! 🗺️ */}
            <section className="space-y-4 border-b border-blue-200 pb-6">
              <h2 className="flex items-center text-2xl font-bold text-orange-700 mb-3">
                <FaChartBar className="mr-2 text-orange-500" /> 4. Диаграммы: Считаем кладу по столбцам!
              </h2>
              <p className="text-gray-700 mb-4">Столбцы — 'высота горы'. Суммируй цвета для 'всего'. >70 мм? Смотри, где столбик выше черты. Ты — охотник за числами!</p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li><strong>Пример из ВПР:</strong> Сколько учеников сработали тест? (Диаграмма оценок). <br /> Шаг 1: 3+6+8+5=22. <em>Ответ: 22</em></li>
                <li><strong>Совет:</strong> Читай подписи! Сумма столбцов = общее. Разница max-min = 'прыжок'.</li>
              </ul>
              <ImageWithTooltip src={imageUrls['math-diagram-*.png']} alt="Столбчатая диаграмма" width={400} height={225} tooltipKeyPart="math-diagram-*.png" />
            </section>

            {/* Раздел 5: Координаты — Дорога с номерами! 🛣️ */}
            <section className="space-y-4 border-b border-blue-200 pb-6">
              <h2 className="flex items-center text-2xl font-bold text-red-700 mb-3">
                <FaMapMarkedAlt className="mr-2 text-red-500" /> 5. Координаты: Точки на дороге!
              </h2>
              <p className="text-gray-700 mb-4">Прямая — как улица: 0 — центр, лево — минус, право — плюс. Точка A слева от B? Выбери меньшее число. Смотри расстояние до меток!</p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li><strong>Пример из ВПР:</strong> A, B, C на прямой. Соответствие? <br /> Шаг 1: A ≈0.67 (2/3), B=1.5 (3/2), C=2.9. <em>Ответ: 341</em></li>
                <li><strong>Совет:</strong> Рисуй стрелку: от 0 влево/вправо. Ближе к метке — то число!</li>
              </ul>
              <ImageWithTooltip src={imageUrls['math-coord-*.png']} alt="Координатная прямая с точками" width={400} height={200} tooltipKeyPart="math-coord-*.png" />
            </section>

            {/* Раздел 6: Логика — Пазлы для мозга! 🧩 */}
            <section className="space-y-4 border-b border-blue-200 pb-6">
              <h2 className="flex items-center text-2xl font-bold text-indigo-700 mb-3">
                <FaBrain className="mr-2 text-indigo-500" /> 6. Логика: Разгадываем загадки!
              </h2>
              <p className="text-gray-700 mb-4">Не цифры, а 'почему?'. Семья детей? Считай для каждого: 'у меня сестры — все девочки минус я'. Можно ли 30 частей? Смотри правило +3 каждый раз!</p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li><strong>Пример из ВПР:</strong> 5 детей (3М,2Д). Верные? <br /> Шаг 1: У девочки 1 сестра (не 2). 3) Да, мальчиков >. 4) Да, по 2 брата/сестры. <em>Ответ: 34</em></li>
                <li><strong>Совет:</strong> Рисуй: мальчик — квадратик, девочка — кружок. Проверь каждое 'да/нет'.</li>
              </ul>
              <ImageWithTooltip src={imageUrls['math-logic-*.png']} alt="Пазл с семьёй" width={400} height={225} tooltipKeyPart="math-logic-*.png" />
            </section>

            {/* Раздел 7: Геометрия — Конструктор Lego! 🧱 */}
            <section className="space-y-4">
              <h2 className="flex items-center text-2xl font-bold text-teal-700 mb-3">
                <FaRulerCombined className="mr-2 text-teal-500" /> 7. Геометрия: Строим фигуры!
              </h2>
              <p className="text-gray-700 mb-4">Симметрия — 'зеркало'! Отражаем по линии. Кубик: напротив 1 — 6 (сумма 7). Оси треугольника? Три через вершину к базе.</p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li><strong>Пример из ВПР:</strong> Симметрия треугольника? <em>Ответ: 3 оси</em></li>
                <li><strong>Совет:</strong> Бумага + карандаш: нарисуй и сложи — совпадает? Ты — архитектор фигур!</li>
              </ul>
              <ImageWithTooltip src={imageUrls['math-geo-*.png']} alt="Симметрия и кубик" width={400} height={225} tooltipKeyPart="math-geo-*.png" />
            </section>

            {/* Финальный совет: Ты — чемпион! 🏆 */}
            <section className="text-center pt-6 border-t border-blue-200">
              <h2 className="flex items-center justify-center text-xl font-bold text-yellow-600 mb-4">
                <FaLightbulb className="mr-2" /> Ты — супергерой чисел! Последние хитрости:
              </h2>
              <ul className="text-left max-w-md mx-auto space-y-2 text-gray-700">
                <li>📖 Читай вопрос дважды: что именно спрашивают?</li>
                <li>✏️ Рисуй: линии, пиццы, семьи — помогает видеть!</li>
                <li>✅ Проверяй: ответ логичный? (Не 1000 км для муравья!)</li>
                <li>🎮 Играй: решай по 1 миссии в день, как уровень в игре.</li>
              </ul>
              <p className="mt-4 text-lg font-semibold text-blue-600">Ты справишься! ВПР — твоя арена. Удачи, герой! 🌟</p>
              <div className="mt-6">
                <Link href="/vpr-tests" className="inline-block bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-all">
                  ← К тестам и другим шпаргалкам
                </Link>
              </div>
            </section>

          </CardContent>
        </Card>
      </div>

      <TooltipProvider>
        {/* Tooltip провайдер здесь для глобальности */}
      </TooltipProvider>
    </div>
  );
};

export default MathCheatsheet;