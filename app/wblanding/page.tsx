import React from 'react';
import Image from 'next/image';

export default function WarehouseLandingPage() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-24 px-4 md:py-32">
        <div className="max-w-6xl mx-auto text-center">
          <Image 
            src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/IMG_20250623_004400_844-152720e6-ad84-48d1-b4e7-e0f238b7442b.png"
            alt="Логотип приложения"
            width={120}
            height={120}
            className="mx-auto mb-6 rounded-full shadow-lg"
          />
          <h1 className="text-4xl md:text-6xl font-bold mb-6">Складской учет для онлайн-магазинов</h1>
          <p className="text-xl md:text-2xl mb-10 max-w-3xl mx-auto">Сократите недостачи, ускорьте учет товаров и смен персонала в 10 раз. Идеально для владельцев 2+ магазинов на WB, Ozon, YM с ~100 артикулами и до 500 единиц товаров.</p>
          <a href="#features" className="bg-white text-blue-600 px-8 py-4 rounded-full font-semibold text-lg hover:bg-gray-100 shadow-md transition-all">Узнать больше</a>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16 text-gray-900">Возможности приложения</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-gray-50 p-8 rounded-xl shadow-md hover:shadow-xl transition-shadow">
              <svg className="w-12 h-12 mx-auto mb-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <h3 className="text-xl font-bold mb-4 text-center">Синхронизация с маркетплейсами</h3>
              <p className="text-center text-gray-600">Автоматическое обновление остатков на WB, Ozon и Яндекс.Маркет в реальном времени.</p>
            </div>
            <div className="bg-gray-50 p-8 rounded-xl shadow-md hover:shadow-xl transition-shadow">
              <svg className="w-12 h-12 mx-auto mb-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-xl font-bold mb-4 text-center">Управление сменами</h3>
              <p className="text-center text-gray-600">Контроль работы персонала, чекпоинты и детальная статистика по сменам.</p>
            </div>
            <div className="bg-gray-50 p-8 rounded-xl shadow-md hover:shadow-xl transition-shadow">
              <svg className="w-12 h-12 mx-auto mb-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <h3 className="text-xl font-bold mb-4 text-center">Мульти-доступ</h3>
              <p className="text-center text-gray-600">Управление несколькими складами, ролевой доступ для команды.</p>
            </div>
            <div className="bg-gray-50 p-8 rounded-xl shadow-md hover:shadow-xl transition-shadow">
              <svg className="w-12 h-12 mx-auto mb-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <h3 className="text-xl font-bold mb-4 text-center">Telegram-интерфейс</h3>
              <p className="text-center text-gray-600">Удобный доступ через мессенджер, без установки приложений.</p>
            </div>
            <div className="bg-gray-50 p-8 rounded-xl shadow-md hover:shadow-xl transition-shadow">
              <svg className="w-12 h-12 mx-auto mb-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <h3 className="text-xl font-bold mb-4 text-center">Визуализация</h3>
              <p className="text-center text-gray-600">Интерактивная карта склада с фильтрами по характеристикам товаров.</p>
            </div>
            <div className="bg-gray-50 p-8 rounded-xl shadow-md hover:shadow-xl transition-shadow">
              <svg className="w-12 h-12 mx-auto mb-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-xl font-bold mb-4 text-center">Отчеты</h3>
              <p className="text-center text-gray-600">Экспорт остатков и смен в удобных форматах, статистика продаж.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="bg-gray-100 py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16 text-gray-900">Почему наше приложение выгодно для вас</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-xl shadow-md">
              <h3 className="text-xl font-bold mb-6 text-center text-blue-800">Для владельца</h3>
              <ul className="space-y-4 text-gray-600">
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Контроль нескольких магазинов в одном интерфейсе
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Снижение потерь и ошибок в учете
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Автоматическая синхронизация остатков
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Мониторинг работы команды
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Freemium модель - начните бесплатно
                </li>
              </ul>
            </div>
            <div className="bg-white p-8 rounded-xl shadow-md">
              <h3 className="text-xl font-bold mb-6 text-center text-blue-800">Для персонала</h3>
              <ul className="space-y-4 text-gray-600">
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Простой интерфейс в Telegram
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Быстрые операции с товарами
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Игровой режим с наградами
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Личная статистика и цели
                </li>
              </ul>
            </div>
            <div className="bg-white p-8 rounded-xl shadow-md">
              <h3 className="text-xl font-bold mb-6 text-center text-blue-800">Для администратора</h3>
              <ul className="space-y-4 text-gray-600">
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Управление несколькими складами
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Безопасный доступ для команды
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Уведомления о заказах
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Простые отчеты в CSV
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Us vs YClients */}
      <section id="why-us" className="py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16 text-gray-900">Почему наше приложение лучше YClients</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-md">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-6 py-4 text-left font-bold text-gray-700">Аспект</th>
                  <th className="px-6 py-4 text-left font-bold text-gray-700">Наше приложение</th>
                  <th className="px-6 py-4 text-left font-bold text-gray-700">YClients</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t">
                  <td className="px-6 py-4 font-medium">Ценообразование</td>
                  <td className="px-6 py-4">Freemium модель. Платите только половину от сэкономленных на штрафах средств (индивидуальный расчет). Бесплатно для малого бизнеса.</td>
                  <td className="px-6 py-4">Фиксированные тарифы от 900 руб/мес (за 3 мес предоплаты). Дополнительные модули оплачиваются отдельно. Нет бесплатной версии.</td>
                </tr>
                <tr className="border-t">
                  <td className="px-6 py-4 font-medium">Функциональность</td>
                  <td className="px-6 py-4">Фокус на складе: синхронизация с маркетплейсами, управление сменами, визуализация, игровые элементы для персонала, ежедневные отчеты.</td>
                  <td className="px-6 py-4">Полная CRM для услуг: склад - дополнительный модуль. Больше функций для записи клиентов, но менее специализирован на складском учете для e-com.</td>
                </tr>
                <tr className="border-t">
                  <td className="px-6 py-4 font-medium">Удобство использования</td>
                  <td className="px-6 py-4">Мобильный интерфейс через Telegram. Простой и интуитивный, с gamification для мотивации. Нет нужды в обучении.</td>
                  <td className="px-6 py-4">Веб/приложение с полным CRM. Требует времени на освоение, больше подходит для комплексного бизнеса услуг.</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-8 text-center text-gray-600 max-w-3xl mx-auto">Наше приложение - специализированное решение для складов онлайн-магазинов. Оно проще, дешевле и эффективнее для малого/среднего e-com, где ключ - быстрый учет и снижение ошибок.</p>
        </div>
      </section>

      {/* Real Example Section */}
      <section className="bg-gray-100 py-16 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-12 text-gray-900">Реальный кейс: Склад одеял</h2>
          <p className="text-lg mb-12 max-w-3xl mx-auto">Мы тестировали приложение на складе с одеялами: 4 размера, 2 сезона, 8 узоров - 64 артикула, >500 единиц. Работало стабильно на бесплатном Supabase.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="bg-white p-8 rounded-xl shadow-md">
              <h3 className="text-xl font-bold mb-4 text-blue-800">До приложения</h3>
              <ul className="space-y-3 text-left text-gray-600">
                <li>Обновление остатков - полдня работы</li>
                <li>Штрафы за ошибки - 30+ тыс. руб/мес</li>
              </ul>
            </div>
            <div className="bg-white p-8 rounded-xl shadow-md">
              <h3 className="text-xl font-bold mb-4 text-blue-800">После</h3>
              <ul className="space-y-3 text-left text-gray-600">
                <li>Обновление - 1 клик</li>
                <li>Штрафы - 8 тыс. руб/мес (снижение на 73%)</li>
              </ul>
            </div>
          </div>
          <p className="mt-12 text-lg font-semibold text-blue-800">Мы предлагаем использование за 50% от вашей экономии на штрафах - рассчитаем индивидуально!</p>
        </div>
      </section>

      {/* Invite Section */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-12 text-gray-900">Как начать работу и пригласить команду</h2>
          <div className="max-w-3xl mx-auto text-left space-y-6 text-lg text-gray-600">
            <ol className="list-decimal pl-6 space-y-4">
              <li>Откройте приложение в Telegram и авторизуйтесь.</li>
              <li>Перейдите в раздел "Экипажи" и создайте новый экипаж (кнопка "+").</li>
              <li>Поделитесь ссылкой приглашения: t.me/[ваш-бот]?start=crew_[ваш-slug]_join_crew</li>
              <li>Сотрудник перейдет по ссылке и подаст заявку.</li>
              <li>Подтвердите заявку в карточке экипажа.</li>
              <li>Назначьте роли и предоставьте доступ к складу.</li>
            </ol>
            <p className="text-center font-semibold mt-8">Экипаж - это ваш склад. Приглашайте команду для совместной работы!</p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-20 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Оптимизируйте склад уже сегодня</h2>
          <p className="text-xl mb-10">Создайте экипаж бесплатно и начните экономить на ошибках</p>
          <a href="/crews/create" className="bg-white text-blue-600 px-10 py-4 rounded-full font-bold text-xl hover:bg-gray-100 shadow-lg transition-all">Создать экипаж</a>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-8 px-4">
        <div className="max-w-6xl mx-auto text-center space-y-4">
          <p>&copy; 2025 Управление складом. Все права защищены.</p>
          <div className="flex justify-center gap-6 text-sm">
            <a href="/privacy" className="hover:text-white">Политика конфиденциальности</a>
            <a href="/terms" className="hover:text-white">Условия использования</a>
            <a href="/support" className="hover:text-white">Поддержка</a>
          </div>
        </div>
      </footer>
    </div>
  );
}