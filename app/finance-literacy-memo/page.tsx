"use client"; 

import React from 'react';

export default function FinanceLiteracyMemoPage() {
  return (
    <div className="bg-white text-black min-h-screen p-4 sm:p-6 md:p-8">
      {/* Global styles removed as per request */}
      <main className="max-w-4xl mx-auto">
        {/* Finance Literacy Memo Content */}
        <div className="finance-literacy-memo-content mt-2 sm:mt-4 md:mt-6 pt-2 sm:pt-4">
          <header className="mb-6 text-center">
            <h1 className="text-3xl font-bold text-indigo-700">ПАМЯТКА</h1>
            <h2 className="text-xl font-semibold text-indigo-600 mt-1">Как правильно распоряжаться карманными деньгами?</h2>
          </header>

          <p className="mb-4 text-base sm:text-lg">
            Привет! Карманные деньги – это не просто монетки и купюры. Это твои первые шаги к финансовой грамотности и самостоятельности. Научиться ими управлять – очень полезный навык!
          </p>

          <section className="mb-6">
            <h3 className="text-lg sm:text-xl font-semibold text-teal-700 mb-2">Почему важно уметь распоряжаться карманными деньгами?</h3>
            <ul className="list-disc list-inside space-y-1 pl-4 text-sm sm:text-base">
              <li>Это учит ответственности.</li>
              <li>Помогает понять ценность денег и труда.</li>
              <li>Развивает умение планировать и достигать целей.</li>
              <li>Готовит тебя к взрослой жизни.</li>
            </ul>
          </section>

          <section className="mb-6">
            <h3 className="text-lg sm:text-xl font-semibold text-teal-700 mb-3">Золотые правила управления карманными деньгами:</h3>
            <ol className="list-decimal list-inside space-y-3 pl-4 text-sm sm:text-base">
              <li>
                <span className="font-semibold">Определи свои потребности и желания:</span>
                <ul className="list-disc list-inside space-y-1 pl-6 mt-1 text-xs sm:text-sm">
                  <li><span className="font-medium">Нужды:</span> То, без чего сложно обойтись (например, проезд, школьный обед, если не дают из дома).</li>
                  <li><span className="font-medium">Желания:</span> То, что хочется, но не является жизненно необходимым (новая игрушка, сладости, поход в кино).</li>
                </ul>
                <p className="mt-1 pl-6 text-xs sm:text-sm">Постарайся сначала обеспечить нужды, а потом – желания.</p>
              </li>
              <li>
                <span className="font-semibold">Планируй бюджет:</span>
                <ul className="list-disc list-inside space-y-1 pl-6 mt-1 text-xs sm:text-sm">
                  <li>Получив карманные деньги, подумай, на что ты их потратишь.</li>
                  <li>Можно записать план в блокнот: сколько на еду, сколько на развлечения, сколько отложить.</li>
                </ul>
              </li>
              <li>
                <span className="font-semibold">Откладывай (копи!):</span>
                <ul className="list-disc list-inside space-y-1 pl-6 mt-1 text-xs sm:text-sm">
                  <li>Поставь себе цель: на что ты хочешь накопить (например, на новую книгу, игру, подарок другу).</li>
                  <li>Старайся откладывать небольшую сумму с каждых полученных карманных денег. Даже 10% – это уже хорошо!</li>
                  <li>Используй копилку или специальный конверт.</li>
                </ul>
              </li>
              <li>
                <span className="font-semibold">Веди учет расходов:</span>
                <ul className="list-disc list-inside space-y-1 pl-6 mt-1 text-xs sm:text-sm">
                  <li>Записывай, куда уходят твои деньги. Это поможет понять, на что ты тратишь больше всего и где можно сэкономить.</li>
                  <li>Можно использовать простой блокнот или приложение на телефоне (с разрешения родителей).</li>
                </ul>
              </li>
              <li>
                <span className="font-semibold">Избегай импульсивных покупок:</span>
                <ul className="list-disc list-inside space-y-1 pl-6 mt-1 text-xs sm:text-sm">
                  <li>Увидел что-то классное и сразу захотел купить? Не спеши!</li>
                  <li>Дай себе время подумать (например, до следующего дня). Действительно ли тебе это так нужно? Может, лучше отложить эти деньги на свою большую цель?</li>
                </ul>
              </li>
              <li>
                <span className="font-semibold">Сравнивай цены:</span>
                <p className="mt-1 pl-6 text-xs sm:text-sm">Прежде чем что-то купить, посмотри, сколько это стоит в разных местах. Иногда можно найти то же самое дешевле.</p>
              </li>
              <li>
                <span className="font-semibold">Обсуждай финансы с родителями:</span>
                <ul className="list-disc list-inside space-y-1 pl-6 mt-1 text-xs sm:text-sm">
                  <li>Если у тебя есть вопросы или трудности с управлением деньгами, не стесняйся спросить совета у родителей. Они помогут и подскажут.</li>
                  <li>Может быть, вы вместе решите, за какую помощь по дому ты можешь получать дополнительные карманные деньги.</li>
                </ul>
              </li>
              <li>
                <span className="font-semibold">Помни о безопасности:</span>
                <ul className="list-disc list-inside space-y-1 pl-6 mt-1 text-xs sm:text-sm">
                  <li>Не хвастайся деньгами перед сверстниками.</li>
                  <li>Не носи с собой крупные суммы без необходимости.</li>
                </ul>
              </li>
            </ol>
          </section>

          <section className="mb-6">
            <h3 className="text-lg sm:text-xl font-semibold text-teal-700 mb-3">Примеры из жизни (Ситуация → Решение):</h3>
            <p className="mb-2 text-sm sm:text-base">Иногда теория – это одно, а жизнь – другое. Давай рассмотрим пару ситуаций:</p>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-md text-amber-700">1. Ситуация: Ты увидел в магазине новую супер-игрушку (или вещь), о которой мечтаешь. Все друзья уже о ней говорят, и очень хочется купить её прямо сейчас, пока есть деньги!</h4>
                <p className="font-medium mt-1 text-sm sm:text-base">Решение:</p>
                <ul className="list-disc list-inside space-y-1 pl-6 mt-1 text-xs sm:text-sm">
                  <li>Стоп! Прежде чем бежать к кассе, спроси себя: "Мне это действительно *так* нужно, или это просто мимолетное желание?"</li>
                  <li>Дай себе время подумать. Используй "правило одного дня" или даже "правило 72 часов". Часто через день-два пыл угасает.</li>
                  <li>Проверь свой бюджет и цели. Хватит ли денег? Не покупаешь ли ты это в ущерб более важной цели, на которую копишь?</li>
                  <li>Если после раздумий желание не прошло, и покупка вписывается в твой план – отлично! Но часто оказывается, что можно было обойтись или найти что-то важнее.</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-md text-amber-700">2. Ситуация: Твой друг просит у тебя в долг небольшую сумму денег. Говорит, что скоро вернет.</h4>
                <p className="font-medium mt-1 text-sm sm:text-base">Решение:</p>
                <ul className="list-disc list-inside space-y-1 pl-6 mt-1 text-xs sm:text-sm">
                  <li>Подумай: Ты доверяешь этому другу? Сумма для тебя большая или маленькая?</li>
                  <li>Главное правило одалживания: Одалживай только ту сумму, которую не боишься потерять. К сожалению, не все долги возвращаются.</li>
                  <li>Если решил одолжить: Четко договоритесь о сроке возврата. Не стесняйся напомнить, если срок прошел.</li>
                  <li>Если решил отказать (и это нормально!): Можно вежливо сказать: "Извини, сейчас не могу, сам коплю" или "У меня сейчас все деньги распланированы". Ты не обязан объяснять причины.</li>
                </ul>
              </div>
            </div>
          </section>

          <footer className="mt-8 pt-4 border-t-2 border-gray-300">
            <p className="font-bold text-md sm:text-lg text-center">
              Умение управлять деньгами – это суперспособность, которая пригодится тебе всю жизнь! Начни тренировать её уже сейчас! <span className="text-green-600">Удачи!</span>
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
}