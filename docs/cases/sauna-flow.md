# Case: Sauna Booking Flow (пример реализации в CarTest)

## Цель
Быстрая бронь сауны через веб интерфейс с выставлением счёта в Telegram, возможностью оплаты звёздами (XTR), начислением cashback и уведомлением клинера/админа.

## Компоненты
- Frontend: `app/sauna-rent/page.tsx` — форма брони, расчёт цены, UX баланса звёзд.
- Server Action: `app/sauna-rent/actions.ts` → `createSaunaBooking`.
- DB: `rentals` (rental metadata содержит sauna-specific поля).
- Payments: `createInvoice` + `sendTelegramInvoice`.
- Realtime: Supabase Realtime для обновления статуса брони в UI.
- Notifications: `sendComplexMessage` для owner/admin.

## Поток
1. Пользователь выбирает дату/время/доп.услуги на страницу бронирования.
2. Рассчитывается `totalPrice` и `starsCost`.
3. Клиент вызывает `createSaunaBooking` (server action) — создаётся rental + invoice.
4. Бот Telegram получает webhook и отправляет invoice пользователю (invoiceId = `rental_interest_<rental_id>`).
5. После успешной оплаты:
   - Обновляется `payment_status` в rental.
   - Начисляются звезды (cashback) в `users.metadata.starsBalance`.
   - Отправляется уведомление клинеру/owner о уборке/смене.
6. Админ/клин-тим подписывается на оповещения об уборке (через подписку в таблице `clean_shifts`), получают звездное вознаграждение в момент подтверждения выполнения.

## Замечания по безопасности
- Invoice webhook должен быть idempotent.
- Метаданные инвойса содержат `rental_id` и `sauna_id`.
- Фото `start`/`end` хранятся в приватном bucket, доступны через signed URL для проверяющих.

## Расширения
- Интеграция с ресепшеном отеля (подтверждение проживания для скидок).
- White-label для SPA/Hotel partners — deploy per partner.