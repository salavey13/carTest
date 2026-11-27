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
  'math-diagram-*.png': "<strong>Диаграммы — карта клада!</strong> Суммируй столбцы, ищи &gt;70 мм. <em>Ты — охотник!</em> 🗺️",
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
              <VibeContentRenderer content="<FaCalculator />" className="mr-2 hover:scale-110 transition-transform" /> Математика 6 класс: От 0 до героя! Твоя супер-шпаргалка 🦸‍♂️
            </CardTitle>
            <p className="text-lg text-gray-600 font-medium">Старт от нуля — и ты герой! Числа, дроби, загадки — всё как игра. Весело, просто, шаг за шагом. Давай станем матешка-мастерами! 💥</p>
          </CardHeader>

          <CardContent className="space-y-8 p-4 md:p-6 text-sm md:text-base leading-relaxed">

            {/* Уровень 1: Арифметика — Базовые супергерои */}
            <section className="space-y-4 border-b border-blue-200 pb-6">
              <h2 className={cn("flex items-center text-2xl font-bold text-blue-700 mb-3")}>
                <VibeContentRenderer content="<FaPlusMinus />" className="mr-2 text-blue-500 hover:scale-110 transition-transform" /> Уровень 1: Арифметика — Числа дерутся и дружат! ⚔️
              </h2>
          {/* HERO-иллюстрация (task220) */}
          <div className="relative mb-6 overflow-hidden rounded-none border" style={{ borderColor: "#3b82f633" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/task220/math-6.jpg"
              alt="Математика 6 класс — неоновая иллюстрация"
              className="w-full h-auto opacity-80"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#030712] via-transparent to-transparent" />
          </div>
              <p className="text-gray-700 mb-4">Положительные — добрые рыцари, отрицательные — тени. Умножаем? Копируем силу! Делим? Раздаём конфеты. Сначала скобки — спаси друзей! А ты знал, что - × - = +? Волшебство! ✨</p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li><strong>Совет:</strong> Отрицательные: + × + = +, + × - = -, - × - = +. Ты — рефери! 👊</li>
              </ul>
              <h3 className="text-xl font-bold text-blue-600">Миссия 1: Простой расчёт</h3>
              <p>Задача: 36 – 12 · 17 = ?</p>
              <ul className="list-decimal pl-6 space-y-1">
                <li>Умножение: 12 × 17 = 204.</li>
                <li>Вычитание: 36 - 204 = -168.</li>
              </ul>
              <p className="italic text-gray-600">Хинт от героя: Сначала умножь, как супергерой! Ответ: -168. Молодец! ⭐</p>

              <h3 className="text-xl font-bold text-blue-600">Миссия 2: С отрицательными</h3>
              <p>Задача: (–15 + 4) · (–6) = ?</p>
              <ul className="list-decimal pl-6 space-y-1">
                <li>Скобки: –15 + 4 = –11.</li>
                <li>Умножение: –11 · (–6) = 66.</li>
              </ul>
              <p className="italic text-gray-600">Хинт: Два минуса — плюс! Ответ: 66. Ты крут! 🚀</p>

              <h3 className="text-xl font-bold text-blue-600">Миссия 3: Добавь свою</h3>
              <p>Задача: 48 : (–6) – 30 : (–5) = ? (Попробуй сам!)</p>
              <p className="italic text-gray-600">Хинт: Дели шаг за шагом, помни знаки. Ответ: -2. Уровень пройден! 🏆</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SimpleImage src={imageUrls['math-arith-*.png']} alt="Супергерои чисел в бою" width={400} height={400} tooltipKeyPart="math-arith-*.png" />
              </div>
            </section>

            {/* Уровень 2: Дроби — Пицца для всех! 🍕 */}
            <section className="space-y-4 border-b border-blue-200 pb-6">
              <h2 className={cn("flex items-center text-2xl font-bold text-green-700 mb-3")}>
                <VibeContentRenderer content="<FaDivide />" className="mr-2 text-green-500 hover:scale-110 transition-transform" /> Уровень 2: Дроби — Разделим пиццу поровну! 
              </h2>
              <p className="text-gray-700 mb-4">Дробь — кусочек пиццы! Числитель — твои кусочки, знаменатель — вся пицца. Складываем? Общий размер! Умножаем? Кусок на кусок. А ты любишь пиццу? 😋</p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li><strong>Совет:</strong> Дробь &gt;1? Целое + кусочек. Сокращай — дели на друга! 👯</li>
              </ul>
              <h3 className="text-xl font-bold text-green-600">Миссия 1: Вычитание и умножение</h3>
              <p>Задача: (6/5 - 3/4) × 2/3 = ?</p>
              <ul className="list-decimal pl-6 space-y-1">
                <li>Скобки: 6/5 - 3/4 = (24-15)/20 = 9/20.</li>
                <li>Умножение: 9/20 × 2/3 = 18/60 = 3/10.</li>
              </ul>
              <p className="italic text-gray-600">Хинт: Общий знаменатель — как общий стол для пиццы. Ответ: 3/10. Вкусно! 🍕</p>

              <h3 className="text-xl font-bold text-green-600">Миссия 2: Эквивалентные дроби</h3>
              <p>Задача: 1/2 = ?/4 (найди пропуск).</p>
              <ul className="list-decimal pl-6 space-y-1">
                <li>Умножь числитель и знаменатель на 2: 1×2 = 2, 2×2 = 4.</li>
                <li>Получи 2/4. Это та же пицца!</li>
              </ul>
              <p className="italic text-gray-600">Хинт: Умножай или дели верх и низ на одно число — дробь не меняется! Ответ: 2/4. Ты мастер! ⭐</p>

              <h3 className="text-xl font-bold text-green-600">Миссия 3: Деление</h3>
              <p>Задача: 9/16 : (5/8 – 1/4) = ?</p>
              <ul className="list-decimal pl-6 space-y-1">
                <li>Скобки: 5/8 – 2/8 = 3/8.</li>
                <li>Деление: 9/16 ÷ 3/8 = 9/16 × 8/3 = 3/2.</li>
              </ul>
              <p className="italic text-gray-600">Хинт: Деление — переверни вторую дробь и умножь. Ответ: 3/2. Уровень пройден! 🚀</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SimpleImage src={imageUrls['math-fractions-*.png']} alt="Пицца с дробями" width={400} height={400} tooltipKeyPart="math-fractions-*.png" />
              </div>
            </section>

            {/* Уровень 3: Проценты — Секретные скидки! 🛒 */}
            <section className="space-y-4 border-b border-blue-200 pb-6">
              <h2 className={cn("flex items-center text-2xl font-bold text-purple-700 mb-3")}>
                <VibeContentRenderer content="<FaPercent />" className="mr-2 text-purple-500 hover:scale-110 transition-transform" /> Уровень 3: Проценты: Скидки и бонусы в магазине!
              </h2>
              <p className="text-gray-700 mb-4">Проценты — доля от 100, как кусок торта! 50% — половина. +20%? ×1.2. -20%? ×0.8. +20% и -20% — сюрприз, не назад! А ты любишь скидки? 🤑</p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li><strong>Совет:</strong> Осталось = 100% - скидка. Читай: увеличили или уменьшили? Ты — шопинг-герой! 🔍</li>
              </ul>
              <h3 className="text-xl font-bold text-purple-600">Миссия 1: Скидка</h3>
              <p>Задача: Цена 500 руб. Скидка 15%. Сколько стоит?</p>
              <ul className="list-decimal pl-6 space-y-1">
                <li>Скидка: 0.15 × 500 = 75 руб.</li>
                <li>Итог: 500 - 75 = 425 руб.</li>
              </ul>
              <p className="italic text-gray-600">Хинт: Процент — умножь на 0.хх. Ответ: 425. Купи конфет! 🍬</p>

              <h3 className="text-xl font-bold text-purple-600">Миссия 2: Процент в десятичный</h3>
              <p>Задача: 25% как десятичное?</p>
              <ul className="list-decimal pl-6 space-y-1">
                <li>25% = 25 / 100 = 0.25.</li>
              </ul>
              <p className="italic text-gray-600">Хинт: Дели на 100 или двигай точку. Ответ: 0.25. Легко! 😎</p>

              <h3 className="text-xl font-bold text-purple-600">Миссия 3: Банк</h3>
              <p>Задача: 10000 руб. под 5% на 2 года. Сумма?</p>
              <ul className="list-decimal pl-6 space-y-1">
                <li>Год: 0.05 × 10000 = 500 руб.</li>
                <li>2 года: 500 × 2 = 1000 руб.</li>
                <li>Итог: 10000 + 1000 = 11000 руб.</li>
              </ul>
              <p className="italic text-gray-600">Хинт: Простые проценты — на начальную сумму. Ответ: 11000. Богатей! 💸</p>
              <SimpleImage src={imageUrls['math-percent-*.png']} alt="Круг с процентами" width={400} height={400} tooltipKeyPart="math-percent-*.png" />
            </section>

            {/* Уровень 4: Диаграммы — Карта сокровищ! 🗺️ */}
            <section className="space-y-4 border-b border-blue-200 pb-6">
              <h2 className={cn("flex items-center text-2xl font-bold text-orange-700 mb-3")}>
                <VibeContentRenderer content="<FaChartBar />" className="mr-2 text-orange-500 hover:scale-110 transition-transform" /> Уровень 4: Диаграммы: Считаем кладу по столбцам!
              </h2>
              <p className="text-gray-700 mb-4">Столбцы — высота горы с золотом! Суммируй цвета. &gt;70 мм? Где столбик выше черты. Ты — пират чисел! 🏴‍☠️ А ты нашёл клад в диаграмме?</p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li><strong>Совет:</strong> Читай метки! Сумма = весь клад. Max - min = прыжок через океан! 🌊</li>
              </ul>
              <h3 className="text-xl font-bold text-orange-600">Миссия 1: Сумма</h3>
              <p>Задача: Осадки в Томске &gt;70 мм — сколько месяцев? (Май 78, Авг 72, Окт 71)</p>
              <ul className="list-decimal pl-6 space-y-1">
                <li>Найди &gt;70: Май, Август, Октябрь.</li>
                <li>Считай: 3 месяца.</li>
              </ul>
              <p className="italic text-gray-600">Хинт: Смотри выше линии 70 — как выше облаков! Ответ: 3. Клад найден! 🏆</p>

              <h3 className="text-xl font-bold text-orange-600">Миссия 2: Чтение бара</h3>
              <p>Задача: В баре apples =5. Сколько apples?</p>
              <ul className="list-decimal pl-6 space-y-1">
                <li>Найди бар "apples".</li>
                <li>Верх =5 — значит 5 apples.</li>
              </ul>
              <p className="italic text-gray-600">Хинт: Бар — лестница. Поднимись до верха! Ответ: 5. Просто! 📈</p>

              <h3 className="text-xl font-bold text-orange-600">Миссия 3: Разница</h3>
              <p>Задача: Температура max 15°C, min 8°C. Разница?</p>
              <ul className="list-decimal pl-6 space-y-1">
                <li>Max - min: 15 - 8 = 7°C.</li>
              </ul>
              <p className="italic text-gray-600">Хинт: Разница — прыжок от низкого к высокому. Ответ: 7. Ты пират! ☠️</p>
              <SimpleImage src={imageUrls['math-diagram-*.png']} alt="Столбчатая диаграмма" width={400} height={400} tooltipKeyPart="math-diagram-*.png" />
            </section>

            {/* Уровень 5: Координаты — Дорога с номерами! 🛣️ */}
            <section className="space-y-4 border-b border-blue-200 pb-6">
              <h2 className={cn("flex items-center text-2xl font-bold text-red-700 mb-3")}>
                <VibeContentRenderer content="<FaMapLocationDot />" className="mr-2 text-red-500 hover:scale-110 transition-transform" /> Уровень 5: Координаты: Точки на дороге!
              </h2>
              <p className="text-gray-700 mb-4">Прямая — волшебная улица: 0 — центр, лево — минус (туманный лес), право — плюс (солнечный парк). A слева от B? Меньшее число! Расстояние до меток — как путь к сокровищу. Ты готов к путешествию? 🧳</p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li><strong>Совет:</strong> Рисуй стрелку от 0. Ближе к метке — то число! Ты — капитан карты. 🧭</li>
              </ul>
              <h3 className="text-xl font-bold text-red-600">Миссия 1: Соответствие</h3>
              <p>Задача: Точки A, B, C. Координаты: 1) 1/3, 2) 2.8, 3) -1.6, 4) 0.55, 5) -0.9. (A &lt; -1, B между -1 и 1, C &gt;1)</p>
              <ul className="list-decimal pl-6 space-y-1">
                <li>Позиции: A=-1.6 (3), B=0.55 (4), C=2.8 (2).</li>
              </ul>
              <p className="italic text-gray-600">Хинт: Слева — минус, право — плюс. Ответ: 342. Путешествие началось! 🌍</p>

              <h3 className="text-xl font-bold text-red-600">Миссия 2: Плоттинг точки</h3>
              <p>Задача: Нарисуй точку (2,3) на сетке.</p>
              <ul className="list-decimal pl-6 space-y-1">
                <li>От 0 вправо 2 (x).</li>
                <li>Вверх 3 (y). Маркируй!</li>
              </ul>
              <p className="italic text-gray-600">Хинт: X — по горизонтали, Y — по вертикали. Ответ: Точка на (2,3). Ты картограф! 🗺️</p>

              <h3 className="text-xl font-bold text-red-600">Миссия 3: Ещё одна</h3>
              <p>Задача: Точки P, Q, R. Координаты: 1) -0.9, 2) 4/5, 3) -1.1, 4) 2.05, 5) 1/2. (P &lt; -1, Q между -1 и 1, R &gt;1)</p>
              <ul className="list-decimal pl-6 space-y-1">
                <li>Позиции: P=-1.1 (3), Q=4/5=0.8 (2), R=2.05 (4).</li>
              </ul>
              <p className="italic text-gray-600">Хинт: Сравни позиции как на дороге. Ответ: 324. Уровень пройден! 🚀</p>
              <SimpleImage src={imageUrls['math-coord-*.png']} alt="Координатная прямая с точками" width={400} height={400} tooltipKeyPart="math-coord-*.png" />
            </section>

            {/* Уровень 6: Логика — Пазлы для мозга! 🧩 */}
            <section className="space-y-4 border-b border-blue-200 pb-6">
              <h2 className={cn("flex items-center text-2xl font-bold text-indigo-700 mb-3")}>
                <VibeContentRenderer content="<FaBrain />" className="mr-2 text-indigo-500 hover:scale-110 transition-transform" /> Уровень 6: Логика: Разгадываем загадки!
              </h2>
              <p className="text-gray-700 mb-4">Не просто цифры, а 'почему?' — как супер-детектив! Семья? Считай по ролям. Можно 30 частей? Проверь правило +3. Ты — Шерлок чисел! 🕵️‍♂️ Готов к тайнам?</p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li><strong>Совет:</strong> Рисуй или таблицу! Проверь 'да/нет' по шагам. Нет спешки — как пазл собирай. 😊</li>
              </ul>
              <h3 className="text-xl font-bold text-indigo-600">Миссия 1: Семья</h3>
              <p>Задача: 5 детей (3 мальчика, 2 девочки). Верные? 1) У девочки 2 сестры? 2) Дочерей ≥3? 3) Большинство — мальчики? 4) У мальчика сестёр = братьев?</p>
              <p>Проверим по порядку:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>1) У девочки 1 сестра (всего 2-1). Нет.</li>
                <li>2) Дочерей 2 &lt;3. Нет.</li>
                <li>3) Мальчиков 3&gt;2. Да!</li>
                <li>4) У мальчика: сестёр 2, братьев 2 (3-1). Да!</li>
              </ul>
              <p className="italic text-gray-600">Хинт: Для девочки: сестры = девочки -1. Для мальчика: братья = мальчики -1. Ответ: 3 и 4. Тайна раскрыта! 🔍</p>

              <h3 className="text-xl font-bold text-indigo-600">Миссия 2: Паттерн</h3>
              <p>Задача: Что дальше: 2, 4, 6, 8, __?</p>
              <ul className="list-decimal pl-6 space-y-1">
                <li>Разница: +2 каждый раз.</li>
                <li>8 +2 =10.</li>
              </ul>
              <p className="italic text-gray-600">Хинт: Ищи правило: прибавь то же, что раньше. Ответ: 10. Ты детектив! 🧐</p>

              <h3 className="text-xl font-bold text-indigo-600">Миссия 3: Игра с бумагой</h3>
              <p>Задача: Рви лист на 4 части, потом одну на 4. Можно 30 частей?</p>
              <ul className="list-decimal pl-6 space-y-1">
                <li>Каждый рыв: +3 части (1→4).</li>
                <li>Начало 1. После k: 1+3k.</li>
                <li>1+3k=30? 3k=29 — не делится. Нет!</li>
              </ul>
              <p className="italic text-gray-600">Хинт: Считай +3, как +3 конфеты каждый раз. 29/3 не целое. Ответ: Нет. Загадка решена! 🎉</p>
              <SimpleImage src={imageUrls['math-logic-*.png']} alt="Пазл с семьёй" width={400} height={400} tooltipKeyPart="math-logic-*.png" />
            </section>

            {/* Уровень 7: Геометрия — Конструктор Lego! 🧱 */}
            <section className="space-y-4">
              <h2 className={cn("flex items-center text-2xl font-bold text-teal-700 mb-3")}>
                <VibeContentRenderer content="<FaRulerCombined />" className="mr-2 text-teal-500 hover:scale-110 transition-transform" /> Уровень 7: Геометрия: Строим фигуры!
              </h2>
              <p className="text-gray-700 mb-4">Симметрия — волшебное зеркало! Отражаем по линии — как в сказке. Кубик: напротив 1 — 6 (сумма 7). Оси треугольника? Три через вершину! Ты строишь замки? 🏰</p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li><strong>Совет:</strong> Нарисуй и сложи — совпадает? Ты — Lego-мастер! 🏗️</li>
              </ul>
              <h3 className="text-xl font-bold text-teal-600">Миссия 1: Оси</h3>
              <p>Задача: Сколько осей симметрии у равностороннего треугольника?</p>
              <ul className="list-decimal pl-6 space-y-1">
                <li>Через каждую вершину к середине стороны.</li>
                <li>Всего 3.</li>
              </ul>
              <p className="italic text-gray-600">Хинт: Равносторонний — все стороны равны, как Lego-кубик. Ответ: 3. Строим! 🎨</p>

              <h3 className="text-xl font-bold text-teal-600">Миссия 2: Формы</h3>
              <p>Задача: Форма с 4 равными сторонами и 4 углами 90°?</p>
              <ul className="list-decimal pl-6 space-y-1">
                <li>4 стороны равны + углы прямые = квадрат.</li>
              </ul>
              <p className="italic text-gray-600">Хинт: Считай стороны и углы, как Lego-блоки. Ответ: Квадрат. Ты архитектор! 🏠</p>

              <h3 className="text-xl font-bold text-teal-600">Миссия 3: Проволока</h3>
              <p>Задача: Проволока на квадрат 6 см сторона. Разогнули, сделали треугольник. Сторона?</p>
              <ul className="list-decimal pl-6 space-y-1">
                <li>Периметр квадрата: 4×6=24 см.</li>
                <li>Треугольник периметр 24, 3 стороны: 24/3=8 см.</li>
              </ul>
              <p className="italic text-gray-600">Хинт: Периметр — вся длина. Дели поровну! Ответ: 8 см. Уровень пройден! 🚀</p>
              <SimpleImage src={imageUrls['math-geo-*.png']} alt="Симметрия и кубик" width={400} height={400} tooltipKeyPart="math-geo-*.png" />
            </section>

            {/* Финал: Ты — чемпион! 🏆 */}
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
              <p className="mt-4 text-lg font-semibold text-blue-600">Ты прошёл путь от 0 до героя! ВПР — лёгкая миссия. Удачи, чемпион! 🌟 Ты звезда матеши!</p>
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