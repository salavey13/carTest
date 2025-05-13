"use client"; 

import React from 'react';
import Head from 'next/head';
import Image from 'next/image';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
// Если понадобятся иконки в заголовках секций, можно будет добавить:
// import { VibeContentRenderer } from "@/components/VibeContentRenderer";

export default function FinanceLiteracyMemoPage() {
  return (
    <div className="flex flex-col min-h-screen bg-white text-black">
      <Head>
        <title>Памятка: Финансовая Грамотность для Детей</title>
        <meta name="description" content="Памятка для детей и подростков о том, как правильно распоряжаться карманными деньгами, копить и избегать ненужных трат." />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="flex-grow container mx-auto px-3 md:px-4 py-10 md:py-12">
        <h1 className="text-3xl md:text-4xl font-bold mb-6 text-center text-indigo-700">
          ПАМЯТКА
        </h1>
        <h2 className="text-xl md:text-2xl font-semibold text-indigo-600 mt-1 mb-8 text-center">
          Как правильно распоряжаться карманными деньгами?
        </h2>

        <Card className="max-w-4xl mx-auto bg-gray-50/95 text-slate-800 rounded-xl border border-gray-200/80 shadow-lg">
          <CardHeader className="text-center border-b border-gray-200/60 pb-3 pt-4">
            <p className="text-sm md:text-base text-slate-600 mt-1 font-sans px-2">
              Это твои первые шаги к финансовой грамотности и самостоятельности. Научиться управлять деньгами – очень полезный навык!
            </p>
          </CardHeader>

          <CardContent className="space-y-8 p-4 md:p-6 text-sm md:text-base leading-relaxed">
            
            <p className="text-base sm:text-lg text-slate-700">
              Привет! Карманные деньги – это не просто монетки и купюры. Это твои первые шаги к финансовой грамотности и самостоятельности. Научиться ими управлять – очень полезный навык!
            </p>

            <section className="space-y-3">
              <h3 className="flex items-center text-xl md:text-2xl font-semibold text-teal-700 mb-4 border-b-2 border-teal-300 pb-2">
                Почему важно уметь распоряжаться карманными деньгами?
              </h3>
              <ul className="list-disc list-inside space-y-1.5 pl-4 text-slate-700">
                <li>Это учит ответственности.</li>
                <li>Помогает понять ценность денег и труда.</li>
                <li>Развивает умение планировать и достигать целей.</li>
                <li>Готовит тебя к взрослой жизни.</li>
              </ul>
            </section>

            <section className="space-y-4 border-t-2 border-indigo-200/80 pt-6">
              <h3 className="flex items-center text-xl md:text-2xl font-semibold text-indigo-700 mb-5 border-b-2 border-indigo-300 pb-2">
                Золотые правила управления карманными деньгами:
              </h3>
              <ol className="list-decimal list-inside space-y-4 pl-4 text-slate-700">
                <li>
                  <span className="font-semibold text-indigo-800">Определи свои потребности и желания:</span>
                  <ul className="list-disc list-inside space-y-1 pl-6 mt-1.5 text-xs sm:text-sm text-slate-600">
                    <li><span className="font-medium">Нужды:</span> То, без чего сложно обойтись (например, проезд, школьный обед, если не дают из дома).</li>
                    <li><span className="font-medium">Желания:</span> То, что хочется, но не является жизненно необходимым (новая игрушка, сладости, поход в кино).</li>
                  </ul>
                  <p className="mt-1.5 pl-6 text-xs sm:text-sm text-slate-600">Постарайся сначала обеспечить нужды, а потом – желания.</p>
                </li>
                <li>
                  <span className="font-semibold text-indigo-800">Планируй бюджет:</span>
                  <ul className="list-disc list-inside space-y-1 pl-6 mt-1.5 text-xs sm:text-sm text-slate-600">
                    <li>Получив карманные деньги, подумай, на что ты их потратишь.</li>
                    <li>Можно записать план в блокнот: сколько на еду, сколько на развлечения, сколько отложить.</li>
                  </ul>
                </li>
                <li>
                  <span className="font-semibold text-indigo-800">Откладывай (копи!):</span>
                  <ul className="list-disc list-inside space-y-1 pl-6 mt-1.5 text-xs sm:text-sm text-slate-600">
                    <li>Поставь себе цель: на что ты хочешь накопить (например, на новую книгу, игру, подарок другу).</li>
                    <li>Старайся откладывать небольшую сумму с каждых полученных карманных денег. Даже 10% – это уже хорошо!</li>
                    <li>Используй копилку или специальный конверт.</li>
                  </ul>
                  <div className="my-4 pl-6 flex justify-center">
                    <Image 
                      src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/IMG_20250513_213619-77b47209-f8ca-4d18-8d57-fd47132dff85.jpg"
                      alt="Копилка или велосипед мечты"
                      width={280} 
                      height={498} 
                      className="rounded-lg shadow-md border border-gray-200"
                    />
                  </div>
                </li>
                <li>
                  <span className="font-semibold text-indigo-800">Веди учет расходов:</span>
                  <ul className="list-disc list-inside space-y-1 pl-6 mt-1.5 text-xs sm:text-sm text-slate-600">
                    <li>Записывай, куда уходят твои деньги. Это поможет понять, на что ты тратишь больше всего и где можно сэкономить.</li>
                    <li>Можно использовать простой блокнот или приложение на телефоне (с разрешения родителей).</li>
                  </ul>
                </li>
                <li>
                  <span className="font-semibold text-indigo-800">Избегай импульсивных покупок:</span>
                  <ul className="list-disc list-inside space-y-1 pl-6 mt-1.5 text-xs sm:text-sm text-slate-600">
                    <li>Увидел что-то классное и сразу захотел купить? Не спеши!</li>
                    <li>Дай себе время подумать (например, до следующего дня). Действительно ли тебе это так нужно? Может, лучше отложить эти деньги на свою большую цель?</li>
                  </ul>
                   <div className="my-4 pl-6 flex justify-center">
                    <Image 
                      src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/IMG_20250513_234639-51320fad-588c-4412-a414-80b9263fe128.jpg"
                      alt="Мечтательное ожидание перед покупкой"
                      width={350} 
                      height={350}
                      className="rounded-lg shadow-md border border-gray-200"
                    />
                  </div>
                </li>
                <li>
                  <span className="font-semibold text-indigo-800">Сравнивай цены:</span>
                  <p className="mt-1.5 pl-6 text-xs sm:text-sm text-slate-600">Прежде чем что-то купить, посмотри, сколько это стоит в разных местах. Иногда можно найти то же самое дешевле.</p>
                </li>
                <li>
                  <span className="font-semibold text-indigo-800">Обсуждай финансы с родителями:</span>
                  <ul className="list-disc list-inside space-y-1 pl-6 mt-1.5 text-xs sm:text-sm text-slate-600">
                    <li>Если у тебя есть вопросы или трудности с управлением деньгами, не стесняйся спросить совета у родителей. Они помогут и подскажут.</li>
                    <li>Может быть, вы вместе решите, за какую помощь по дому ты можешь получать дополнительные карманные деньги.</li>
                  </ul>
                </li>
                <li>
                  <span className="font-semibold text-indigo-800">Помни о безопасности:</span>
                  <ul className="list-disc list-inside space-y-1 pl-6 mt-1.5 text-xs sm:text-sm text-slate-600">
                    <li>Не хвастайся деньгами перед сверстниками.</li>
                    <li>Не носи с собой крупные суммы без необходимости.</li>
                  </ul>
                </li>
              </ol>
            </section>

            <section className="space-y-4 border-t-2 border-amber-200/80 pt-6">
              <h3 className="flex items-center text-xl md:text-2xl font-semibold text-amber-700 mb-5 border-b-2 border-amber-300 pb-2">
                Примеры из жизни (Ситуация → Решение):
              </h3>
              <div className="my-6 flex justify-center">
                <Image 
                  src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/IMG_20250513_200328-ccf69779-06b6-4364-8eac-f2bb15766944.jpg"
                  alt="Иллюстрация к примерам из жизни"
                  width={450}
                  height={450}
                  className="rounded-lg shadow-xl border border-gray-200"
                />
              </div>
              <p className="mb-3 text-slate-700">Иногда теория – это одно, а жизнь – другое. Давай рассмотрим пару ситуаций:</p>
              <div className="space-y-5">
                <div>
                  <h4 className="font-semibold text-md text-amber-800">1. Ситуация: Ты увидел в магазине новую супер-игрушку (или вещь), о которой мечтаешь. Все друзья уже о ней говорят, и очень хочется купить её прямо сейчас, пока есть деньги!</h4>
                  <p className="font-medium mt-2 text-sm sm:text-base text-slate-600">Решение:</p>
                  <ul className="list-disc list-inside space-y-1 pl-6 mt-1.5 text-xs sm:text-sm text-slate-600">
                    <li>Стоп! Прежде чем бежать к кассе, спроси себя: "Мне это действительно *так* нужно, или это просто мимолетное желание?"</li>
                    <li>Дай себе время подумать. Используй "правило одного дня" или даже "правило 72 часов". Часто через день-два пыл угасает.</li>
                    <li>Проверь свой бюджет и цели. Хватит ли денег? Не покупаешь ли ты это в ущерб более важной цели, на которую копишь?</li>
                    <li>Если после раздумий желание не прошло, и покупка вписывается в твой план – отлично! Но часто оказывается, что можно было обойтись или найти что-то важнее.</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-md text-amber-800">2. Ситуация: Твой друг просит у тебя в долг небольшую сумму денег. Говорит, что скоро вернет.</h4>
                  <p className="font-medium mt-2 text-sm sm:text-base text-slate-600">Решение:</p>
                  <ul className="list-disc list-inside space-y-1 pl-6 mt-1.5 text-xs sm:text-sm text-slate-600">
                    <li>Подумай: Ты доверяешь этому другу? Сумма для тебя большая или маленькая?</li>
                    <li>Главное правило одалживания: Одалживай только ту сумму, которую не боишься потерять. К сожалению, не все долги возвращаются.</li>
                    <li>Если решил одолжить: Четко договоритесь о сроке возврата. Не стесняйся напомнить, если срок прошел.</li>
                    <li>Если решил отказать (и это нормально!): Можно вежливо сказать: "Извини, сейчас не могу, сам коплю" или "У меня сейчас все деньги распланированы". Ты не обязан объяснять причины.</li>
                  </ul>
                </div>
              </div>
            </section>

            <footer className="border-t-2 border-gray-300/80 pt-8 mt-10 text-center">
              <p className="font-bold text-md sm:text-lg text-green-700">
                Умение управлять деньгами – это суперспособность, которая пригодится тебе всю жизнь! Начни тренировать её уже сейчас! <span className="text-green-500">Удачи!</span>
              </p>
            </footer>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}