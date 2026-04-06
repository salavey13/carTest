# Map Riders — TODO / Execution Log

Updated: 2026-04-01
Owner: codex

## Что сделано в этом проходе

- [x] Внедрил **Demo Mode** с ручным тумблером в rider console.
- [x] Добавил авто-включение demo режима, если нет live-сессий/лайв-локаций.
- [x] Добавил анимированных синтетических демо-райдеров (Alpha/Beta/Gamma) с плавным движением и динамической скоростью.
- [x] Улучшил визуал map viewport: glass-card, градиентный cinematic overlay, статус-бейджи `LIVE DATA` / `DEMO FLOW ON`.
- [x] Прокачал UX-хинты для быстрого демо-показа без реальных GPS-данных.

## Актуальная цель

Сделать MapRiders «showroom-ready»: чтобы экран выглядел премиально и живо даже без трафика/участников, а при наличии реальных данных мгновенно переключался в production-live поведение.

## Следующий этап (после этого коммита)

- [ ] Добавить heat-layer/ghost trails для live и demo райдеров (переключаемый режим).
- [ ] Добавить mini radar/convoy widget с ближайшими райдерами и ETA до meetup.
- [ ] Вынести пресеты визуального стиля карты (Neo, Tactical, Night Pulse) в crew-theme metadata.
- [ ] Добавить stress-demo (20/50/100 synthetic riders) для быстрой smoke-проверки FPS.
- [ ] Добавить микро-анимации карточек/бейджей через framer motion без перегруза CPU.

## Технические заметки

- Demo режим работает клиентски и не требует service-role ключей.
- Базовые live-флоу и текущая структура map-riders API не сломаны.
- Принцип «live data > demo visuals» сохранён: demo нужен для презентации и cold-start UX.
