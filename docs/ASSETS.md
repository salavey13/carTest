# ASSETS.md — Скриншоты, alt-text и GIF

## Руководство
- Все скриншоты оптимизировать до webp, max-width 1600px, сжатие ~70%.
- Для GitHub README - используем 800px width.
- Для Mini App — используем 360×800 (mobile).

## Примеры (оптимизированные)
- `screenshots/jumpstart-1.webp` — alt: "Supervibe Studio — интерфейс извлечения файлов и создания PR"
- `screenshots/bot-invoice-1.webp` — alt: "Telegram Bot — выставление счета и кнопка оплаты"
- `screenshots/sauna-booking-1.webp` — alt: "Страница бронирования сауны — форма и баланс звезд"
- `screenshots/rental-journey-1.webp` — alt: "Путь арендатора — шаги: оплата, фото, подтверждение"

## GIF
- `gifs/bot-to-pr-flow.gif` — короткий loop 6–8s: Bot → Ask AI → Parse → Create PR. Оптимизировать до 5MB.

## Accessibility
- Каждый `<img>` должен иметь alt text. GIF — дублировать ключевую информацию текстом рядом.