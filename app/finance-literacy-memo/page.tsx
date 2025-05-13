import React from 'react';

export default function FinanceLiteracyMemoPage() {
  return (
    <div className="bg-white text-black min-h-screen p-4 sm:p-6 md:p-8 print:p-0">
      <style jsx global>{`
        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            margin: 0;
            padding: 10mm; /* Add some padding for printing */
          }
          .no-print {
            display: none !important;
          }
          .printable-content {
            width: 100% !important;
            max-width: 100% !important;
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          h1, h2, h3, p, li {
            color: #000 !important; /* Ensure text is black for printing */
          }
          img.image-placeholder-style {
            border: 1px solid #ccc !important;
            background-color: #f0f0f0 !important; /* Fallback for failed image load */
          }
          .railway-safety-memo, .finance-literacy-memo-content {
             page-break-inside: avoid; /* Try to keep memo sections on one page */
          }
        }
      `}</style>
      <main className="max-w-4xl mx-auto printable-content">
        {/* Railway Safety Memo Section */}
        <div className="railway-safety-memo mb-12">
          <header className="mb-6 text-center">
            <div className="flex justify-between items-start mb-4">
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-600">РЖД (Пример)</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-red-600">Выигрывая минуту,</p>
                <p className="text-sm font-bold text-red-600">можете потерять жизнь!</p>
              </div>
            </div>
            <h1 className="text-4xl font-bold text-red-700 border-b-4 border-blue-500 pb-2 inline-block">ПАМЯТКА</h1>
            <p className="text-blue-600 font-semibold mt-1">для школьников</p>
            <p className="text-blue-600 font-semibold">по личной безопасности при пользовании средствами железнодорожного транспорта</p>
            <h2 className="text-2xl font-bold text-red-600 mt-4">Внимание, учащиеся!</h2>
          </header>

          <section className="mb-4 clearfix">
            {/* IMAGE_URL_PLACEHOLDER_1_1_TRACKS (e.g., https://via.placeholder.com/150) */}
            <img
              src="https://via.placeholder.com/128x128.png?text=1:1+Пути"
              alt="Иллюстрация: опасно ходить по путям"
              className="image-placeholder-style float-right ml-3 mb-2 w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 aspect-square object-cover bg-gray-200 border border-gray-400 rounded"
            />
            <h3 className="text-lg sm:text-xl font-semibold text-green-700 bg-green-100 p-2 rounded mb-2">
              Не ходите по железнодорожным путям в неустановленных местах — <span className="font-bold">ЭТО ОПАСНО ДЛЯ ЖИЗНИ!</span>
            </h3>
          </section>

          <section className="mb-4 clearfix">
            <h3 className="text-lg sm:text-xl font-semibold text-pink-700 bg-pink-100 p-2 rounded mb-2">
              Не перебегайте пути перед поездом. Выигрывая минуту, можете потерять жизнь!
            </h3>
          </section>
          
          <section className="mb-4 clearfix">
            {/* IMAGE_URL_PLACEHOLDER_9_16_TRAIN_DOOR (e.g., https://via.placeholder.com/112x200) */}
            <img
              src="https://via.placeholder.com/112x199.png?text=9:16+Дверь"
              alt="Иллюстрация: опасность у автоматических дверей поезда"
              className="image-placeholder-style float-right ml-3 mb-2 w-[4.5rem] h-[8rem] sm:w-[5.0625rem] sm:h-[9rem] md:w-[5.625rem] md:h-[10rem] aspect-[9/16] object-cover bg-gray-200 border border-gray-400 rounded"
              // w-20 h-[35.5px] sm:w-24 sm:h-[42.6px] md:w-28 md:h-[49.7px] -> this calculation was wrong for aspect-[9/16]
              // Corrected: width drives height via aspect ratio.
              // Base: 4.5rem width (72px), height = 72 * 16/9 = 128px (8rem)
              // SM: 5.0625rem width (81px), height = 81 * 16/9 = 144px (9rem)
              // MD: 5.625rem width (90px), height = 90 * 16/9 = 160px (10rem)
            />
            <p className="mb-2 p-2 bg-yellow-50 rounded border border-yellow-200 text-sm sm:text-base">
              Находясь в электропоезде, не препятствуйте закрытию автоматических дверей, так как от неожиданного толчка можно упасть под поезд.
            </p>
          </section>

          <section className="mb-4 clearfix">
            <p className="mb-2 p-2 bg-blue-50 rounded border border-blue-200 text-sm sm:text-base">
              Нельзя бросать снежки и камни в окна поездов. От этого машинист может потерять способность вести поезд и могут пострадать пассажиры.
            </p>
          </section>
          
          <section className="mb-4 clearfix">
            {/* IMAGE_URL_PLACEHOLDER_1_1_PLATFORM (e.g., https://via.placeholder.com/150) */}
            <img
              src="https://via.placeholder.com/128x128.png?text=1:1+Платформа"
              alt="Иллюстрация: не играть у жд линии"
              className="image-placeholder-style float-right ml-3 mb-2 w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 aspect-square object-cover bg-gray-200 border border-gray-400 rounded"
            />
            <p className="mb-2 p-2 bg-purple-50 rounded border border-purple-200 text-sm sm:text-base">
              Не играйте и не катайтесь на санках и лыжах вблизи железнодорожной линии.
            </p>
          </section>

          <footer className="mt-6 pt-4 border-t-2 border-gray-300 text-center">
            <p className="font-bold text-md sm:text-lg">
              Запомните, что железнодорожный транспорт является источником повышенной опасности, поэтому, находясь на железной дороге и в поезде, не нарушайте сами и не позволяйте другим нарушать <span className="text-red-600">ПРАВИЛА ЛИЧНОЙ БЕЗОПАСНОСТИ!</span>
            </p>
          </footer>
        </div>

        {/* Finance Literacy Memo Content */}
        <div className="finance-literacy-memo-content mt-12 pt-8 border-t-4 border-dashed border-gray-400">
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