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
            width: 100%;
            max-width: 100%;
            box-shadow: none;
            border: none;
          }
          h1, h2, h3, p, li {
            color: #000 !important; /* Ensure text is black for printing */
          }
          .image-placeholder {
            border: 1px solid #ccc !important; /* Ensure placeholders are visible */
            background-color: #f0f0f0 !important;
          }
        }
        /* Simple styling for image placeholders */
        .image-placeholder {
          width: 120px; /* Adjusted for better fit */
          height: 120px; /* Adjusted for better fit */
          background-color: #e0e0e0;
          border: 1px dashed #999;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.8rem;
          color: #555;
          text-align: center;
          float: right; /* Float right like in example */
          margin-left: 15px;
          margin-bottom: 10px;
          clear: right; /* Ensure subsequent placeholders stack correctly */
        }
      `}</style>
      <main className="max-w-4xl mx-auto printable-content">
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

        <section className="mb-6 relative">
          <div className="image-placeholder">Место для картинки 1 (120x120)</div>
          <h3 className="text-xl font-semibold text-green-700 bg-green-100 p-2 rounded mb-2">
            Не ходите по железнодорожным путям в неустановленных местах — <span className="font-bold">ЭТО ОПАСНО ДЛЯ ЖИЗНИ!</span>
          </h3>
        </section>

        <section className="mb-6 relative">
           {/* Placeholder for the second image if needed, otherwise it will float after text */}
          <h3 className="text-xl font-semibold text-pink-700 bg-pink-100 p-2 rounded mb-2">
            Не перебегайте пути перед поездом. Выигрывая минуту, можете потерять жизнь!
          </h3>
        </section>
        
        <section className="mb-6 relative">
          <div className="image-placeholder">Место для картинки 2 (120x120)</div>
          <p className="mb-2 p-2 bg-yellow-50 rounded border border-yellow-200">
            Находясь в электропоезде, не препятствуйте закрытию автоматических дверей, так как от неожиданного толчка можно упасть под поезд.
          </p>
        </section>

        <section className="mb-6 relative">
          <p className="mb-2 p-2 bg-blue-50 rounded border border-blue-200">
            Нельзя бросать снежки и камни в окна поездов. От этого машинист может потерять способность вести поезд и могут пострадать пассажиры.
          </p>
        </section>
        
        <section className="mb-6 relative">
          <div className="image-placeholder">Место для картинки 3 (120x120)</div>
          <p className="mb-2 p-2 bg-purple-50 rounded border border-purple-200">
            Не играйте и не катайтесь на санках и лыжах вблизи железнодорожной линии.
          </p>
        </section>

        <footer className="mt-8 pt-4 border-t-2 border-gray-300 text-center">
          <p className="font-bold text-lg">
            Запомните, что железнодорожный транспорт является источником повышенной опасности, поэтому, находясь на железной дороге и в поезде, не нарушайте сами и не позволяйте другим нарушать <span className="text-red-600">ПРАВИЛА ЛИЧНОЙ БЕЗОПАСНОСТИ!</span>
          </p>
        </footer>

        {/* Text for the new "Finance Literacy Memo" */}
        <div className="mt-12 pt-8 border-t-4 border-dashed border-gray-400">
          <header className="mb-6 text-center">
            <h1 className="text-3xl font-bold text-indigo-700">ПАМЯТКА</h1>
            <h2 className="text-xl font-semibold text-indigo-600 mt-1">Как правильно распоряжаться карманными деньгами?</h2>
          </header>

          <p className="mb-4 text-lg">
            Привет! Карманные деньги – это не просто монетки и купюры. Это твои первые шаги к финансовой грамотности и самостоятельности. Научиться ими управлять – очень полезный навык!
          </p>

          <section className="mb-6">
            <h3 className="text-xl font-semibold text-teal-700 mb-2">Почему важно уметь распоряжаться карманными деньгами?</h3>
            <ul className="list-disc list-inside space-y-1 pl-4">
              <li>Это учит ответственности.</li>
              <li>Помогает понять ценность денег и труда.</li>
              <li>Развивает умение планировать и достигать целей.</li>
              <li>Готовит тебя к взрослой жизни.</li>
            </ul>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-semibold text-teal-700 mb-3">Золотые правила управления карманными деньгами:</h3>
            <ol className="list-decimal list-inside space-y-3 pl-4">
              <li>
                <span className="font-semibold">Определи свои потребности и желания:</span>
                <ul className="list-disc list-inside space-y-1 pl-6 mt-1 text-sm">
                  <li><span className="font-medium">Нужды:</span> То, без чего сложно обойтись (например, проезд, школьный обед, если не дают из дома).</li>
                  <li><span className="font-medium">Желания:</span> То, что хочется, но не является жизненно необходимым (новая игрушка, сладости, поход в кино).</li>
                </ul>
                <p className="mt-1 pl-6 text-sm">Постарайся сначала обеспечить нужды, а потом – желания.</p>
              </li>
              <li>
                <span className="font-semibold">Планируй бюджет:</span>
                <ul className="list-disc list-inside space-y-1 pl-6 mt-1 text-sm">
                  <li>Получив карманные деньги, подумай, на что ты их потратишь.</li>
                  <li>Можно записать план в блокнот: сколько на еду, сколько на развлечения, сколько отложить.</li>
                </ul>
              </li>
              <li>
                <span className="font-semibold">Откладывай (копи!):</span>
                <ul className="list-disc list-inside space-y-1 pl-6 mt-1 text-sm">
                  <li>Поставь себе цель: на что ты хочешь накопить (например, на новую книгу, игру, подарок другу).</li>
                  <li>Старайся откладывать небольшую сумму с каждых полученных карманных денег. Даже 10% – это уже хорошо!</li>
                  <li>Используй копилку или специальный конверт.</li>
                </ul>
              </li>
              <li>
                <span className="font-semibold">Веди учет расходов:</span>
                <ul className="list-disc list-inside space-y-1 pl-6 mt-1 text-sm">
                  <li>Записывай, куда уходят твои деньги. Это поможет понять, на что ты тратишь больше всего и где можно сэкономить.</li>
                  <li>Можно использовать простой блокнот или приложение на телефоне (с разрешения родителей).</li>
                </ul>
              </li>
              <li>
                <span className="font-semibold">Избегай импульсивных покупок:</span>
                <ul className="list-disc list-inside space-y-1 pl-6 mt-1 text-sm">
                  <li>Увидел что-то классное и сразу захотел купить? Не спеши!</li>
                  <li>Дай себе время подумать (например, до следующего дня). Действительно ли тебе это так нужно? Может, лучше отложить эти деньги на свою большую цель?</li>
                </ul>
              </li>
              <li>
                <span className="font-semibold">Сравнивай цены:</span>
                <p className="mt-1 pl-6 text-sm">Прежде чем что-то купить, посмотри, сколько это стоит в разных местах. Иногда можно найти то же самое дешевле.</p>
              </li>
              <li>
                <span className="font-semibold">Обсуждай финансы с родителями:</span>
                <ul className="list-disc list-inside space-y-1 pl-6 mt-1 text-sm">
                  <li>Если у тебя есть вопросы или трудности с управлением деньгами, не стесняйся спросить совета у родителей. Они помогут и подскажут.</li>
                  <li>Может быть, вы вместе решите, за какую помощь по дому ты можешь получать дополнительные карманные деньги.</li>
                </ul>
              </li>
              <li>
                <span className="font-semibold">Помни о безопасности:</span>
                <ul className="list-disc list-inside space-y-1 pl-6 mt-1 text-sm">
                  <li>Не хвастайся деньгами перед сверстниками.</li>
                  <li>Не носи с собой крупные суммы без необходимости.</li>
                </ul>
              </li>
            </ol>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-semibold text-teal-700 mb-3">Примеры из жизни (Ситуация → Решение):</h3>
            <p className="mb-2">Иногда теория – это одно, а жизнь – другое. Давай рассмотрим пару ситуаций:</p>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-md text-amber-700">1. Ситуация: Ты увидел в магазине новую супер-игрушку (или вещь), о которой мечтаешь. Все друзья уже о ней говорят, и очень хочется купить её прямо сейчас, пока есть деньги!</h4>
                <p className="font-medium mt-1">Решение:</p>
                <ul className="list-disc list-inside space-y-1 pl-6 mt-1 text-sm">
                  <li>Стоп! Прежде чем бежать к кассе, спроси себя: "Мне это действительно *так* нужно, или это просто мимолетное желание?"</li>
                  <li>Дай себе время подумать. Используй "правило одного дня" или даже "правило 72 часов". Часто через день-два пыл угасает.</li>
                  <li>Проверь свой бюджет и цели. Хватит ли денег? Не покупаешь ли ты это в ущерб более важной цели, на которую копишь?</li>
                  <li>Если после раздумий желание не прошло, и покупка вписывается в твой план – отлично! Но часто оказывается, что можно было обойтись или найти что-то важнее.</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-md text-amber-700">2. Ситуация: Твой друг просит у тебя в долг небольшую сумму денег. Говорит, что скоро вернет.</h4>
                <p className="font-medium mt-1">Решение:</p>
                <ul className="list-disc list-inside space-y-1 pl-6 mt-1 text-sm">
                  <li>Подумай: Ты доверяешь этому другу? Сумма для тебя большая или маленькая?</li>
                  <li>Главное правило одалживания: Одалживай только ту сумму, которую не боишься потерять. К сожалению, не все долги возвращаются.</li>
                  <li>Если решил одолжить: Четко договоритесь о сроке возврата. Не стесняйся напомнить, если срок прошел.</li>
                  <li>Если решил отказать (и это нормально!): Можно вежливо сказать: "Извини, сейчас не могу, сам коплю" или "У меня сейчас все деньги распланированы". Ты не обязан объяснять причины.</li>
                </ul>
              </div>
            </div>
          </section>

          <footer className="mt-8 pt-4 border-t-2 border-gray-300">
            <p className="font-bold text-lg text-center">
              Умение управлять деньгами – это суперспособность, которая пригодится тебе всю жизнь! Начни тренировать её уже сейчас! <span className="text-green-600">Удачи!</span>
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
}