import React from 'react';

export default function WarehouseLandingPage() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      {/* Hero Section */}
      <section className="bg-blue-600 text-white py-20 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-4">Управление складом для онлайн-магазинов</h1>
          <p className="text-xl md:text-2xl mb-8">Снижайте количество недостач. Ведите учет товаров и смен персонала в 10 раз быстрее. Идеально для владельцев 2+ магазинов на WB, Ozon, YM с ~100 артикулами и 500 ед. товаров.</p>
          <a href="#features" className="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold text-lg hover:bg-gray-100">Узнать больше</a>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Ключевые возможности</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-bold mb-4">Синхронизация с маркетплейсами</h3>
              <p>Автоматическая синхронизация остатков с WB, Ozon и Яндекс.Маркет. Поддержка API для seamless интеграции.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-bold mb-4">Управление сменами</h3>
              <p>Контроль смен персонала, чекпоинты, сбросы и статистика эффективности. Идеально для складского персонала.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-bold mb-4">Мульти-тенантность</h3>
              <p>Доступ для нескольких владельцев складов как тенантов. Суперадмин управление на базе Supabase freemium.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-bold mb-4">Авторизация через Telegram</h3>
              <p>Безопасная авторизация с использованием Telegram и Supabase RLS для контроля доступа.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-bold mb-4">Визуализация склада</h3>
              <p>Интерактивная визуализация ячеек склада, фильтры по сезонам, узорам, цветам и размерам.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-bold mb-4">Экспорт и отчеты</h3>
              <p>Экспорт текущих остатков, ежедневных смен в CSV/TSV. Автоматическая генерация отчетов.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="bg-gray-100 py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Преимущества для вашего бизнеса</h2>
          <div className="space-y-8">
            {/* Для владельца */}
            <div>
              <h3 className="text-2xl font-bold mb-4">Для владельца склада</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>Контроль нескольких онлайн-магазинов в одном месте.</li>
                <li>Снижение потерь за счет точного учета ~100 артикулов и 500 ед. товаров.</li>
                <li>Автоматизация синхронизации с WB, Ozon, YM.</li>
                <li>Мониторинг эффективности персонала через смены и чекпоинты.</li>
                <li>Freemium модель на базе Supabase - масштабируемо и бесплатно для старта.</li>
              </ul>
            </div>
            {/* Для персонала */}
            <div>
              <h3 className="text-2xl font-bold mb-4">Для складского персонала</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>Простой интерфейс через Telegram - без сложных приложений.</li>
                <li>Быстрые операции: загрузка/выгрузка, редактирование, визуализация.</li>
                <li>Игровой режим с очками, уровнями и достижениями.</li>
                <li>Статистика: эффективность, время на товар, ежедневные цели.</li>
              </ul>
            </div>
            {/* Для бухгалтера/админа */}
            <div>
              <h3 className="text-2xl font-bold mb-4">Для администратора</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>Мульти-тенант доступ: управляйте несколькими складами как суперадмин.</li>
                <li>RLS для безопасности данных.</li>
                <li>Автоматические уведомления о заказах и машинах.</li>
                <li>Экспорт в CSV для отчетов и аналитики.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Как это работает</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-bold mb-4">Авторизация и доступ</h3>
              <p>Вход через Telegram с Supabase RLS. Экипажи действуют как тенанты для владельцев складов.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-bold mb-4">Учет и визуализация</h3>
              <p>Загрузка/выгрузка товаров, чекпоинты, визуализация ячеек, фильтры по атрибутам.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-bold mb-4">Смены и статистика</h3>
              <p>Управление сменами, статистика эффективности, достижения, лидерборд.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-bold mb-4">Синхронизации</h3>
              <p>Синхронизация с WB, Ozon, YM. Экспорт отчетов, уведомления о заказах.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Code Explainer Section */}
      <section className="bg-gray-100 py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Анализ кода приложения</h2>
          <p className="text-lg mb-8">Приложение построено на Next.js с использованием Supabase для хранения данных и Telegram для авторизации. Оно фокусируется на управлении складом с интеграцией маркетплейсов. Вот ключевые детали и потоки:</p>
          <div className="space-y-6">
            <div>
              <h3 className="text-2xl font-bold mb-2">Архитектура</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Фронтенд:</strong> React с компонентами UI (shadcn/ui, lucide-react). Использует hooks для состояния (useState, useEffect, custom hooks как useCrewWarehouse).</li>
                <li><strong>Бэкенд:</strong> Server actions в Next.js для CRUD, синхронизации, уведомлений. Supabase для БД с RLS.</li>
                <li><strong>Авторизация:</strong> Через Telegram (useTelegram hook), интеграция с Supabase для пользователей/экипажей.</li>
                <li><strong>Модель данных:</strong> Экипажи (crews) как тенанты, члены (crew_members) с ролями, смены (crew_member_shifts) с чекпоинтами, товары (cars) с specs (locations, sku).</li>
              </ul>
            </div>
            <div>
              <h3 className="text-2xl font-bold mb-2">Ключевые потоки</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Авторизация:</strong> Telegram auth -> Supabase RLS. Пользователи в экипажах с ролями (owner, member, car_observer).</li>
                <li><strong>Управление складом:</strong> Визуализация ячеек (WarehouseViz), карточки товаров (WarehouseItemCard). Фильтры/сортировка по атрибутам (сезон, узор, цвет, размер).</li>
                <li><strong>Операции:</strong> Загрузка/выгрузка в режимах gameMode. Чекпоинты для фиксации состояний, сброс. Оптимистичные обновления с fallback на reload.</li>
                <li><strong>Смены:</strong> Старт/завершение смен, статусы (online/offline/riding). Уведомления владельцам о запросах (машина, заказы).</li>
                <li><strong>Синхронизация:</strong> API с WB/Ozon/YM для стоков. Настройка SKU/баркодов. Экспорт CSV (стоки, смены).</li>
                <li><strong>Статистика:</strong> Эффективность, время на товар, цели, достижения, лидерборд. Игровые элементы (очки, уровни, босс-режим).</li>
                <li><strong>Приглашения:</strong> Владельцы создают экипажи (/crews/create). Приглашают через ссылки (start_param как 'crew_slug_join_crew'). Заявки на вступление подтверждают владельцы. Участники видят статусы (pending/active).</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Real Example Section */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Реальный пример использования</h2>
          <p className="text-lg mb-8">Мы управляли складом по продаже одеял: 4 размера, 2 сезона, 8 цветовых узоров - всего 64 разных артикула, общий объем >500 единиц. Приложение работало стабильно на freemium Supabase.</p>
          <div className="space-y-4">
            <h3 className="text-2xl font-bold">Достижения:</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Время на обновление остатков сократилось с половины дня до 1 клика.</li>
              <li>Штрафы за ошибки уменьшились с 30+ тыс. руб. до 8 тыс. руб.</li>
            </ul>
            <p className="text-lg">Мы предлагаем использование приложения за половину от снижения штрафов - индивидуальный расчет по вашим метрикам!</p>
          </div>
        </div>
      </section>

      {/* Invite Section */}
      <section className="bg-gray-100 py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Как пригласить людей в экипаж и получить доступ</h2>
          <ol className="list-decimal pl-6 space-y-4 max-w-2xl mx-auto text-lg">
            <li>Создайте экипаж в приложении (кнопка "+" на странице /crews).</li>
            <li>Поделитесь ссылкой для приглашения: t.me/вашбот?start=crew_ваш-slug_join_crew.</li>
            <li>Пользователь подаст заявку на вступление.</li>
            <li>Подтвердите заявку в интерфейсе экипажа как владелец.</li>
            <li>После присоединения назначьте роли (member, car_observer) и предоставьте доступ к складу.</li>
          </ol>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-blue-600 text-white py-16 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Готовы оптимизировать свой склад?</h2>
          <p className="text-xl mb-8">Создайте экипаж и начните управлять складом эффективнее уже сегодня!</p>
          <a href="/crews/create" className="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold text-lg hover:bg-gray-100">Создать экипаж</a>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-8 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <p>&copy; 2025 Управление складом. Все права защищены.</p>
        </div>
      </footer>
    </div>
  );
}