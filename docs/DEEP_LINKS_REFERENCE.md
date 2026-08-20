# 🔗 Deep Links Reference — useStartParamRouter

> Справочник поддерживаемых Telegram WebApp deep-link'ов (startapp payload) для бота
> **@oneBikePlsBot**. Роутер: `hooks/useStartParamRouter.ts` (обрабатывается в `ClientLayout`).
>
> **Формат ссылки:**
> ```
> https://t.me/oneBikePlsBot/app?startapp=<payload>
> ```
>
> Источник параметра (строка 427 роутера):
> `searchParams.get("tgWebAppStartParam") || searchParams.get("startapp")` — поддерживаются оба имени.
>
> ⚠️ `docs/*.md` лежит в `.vercelignore` → этот файл **не публикуется** на Vercel/VPS,
> это внутренний справочник для разработчиков.

---

## 1. Байки: аренда, покупка, QR-клейм

| startapp | Куда ведёт | Комментарий |
|---|---|---|
| `rent_{bikeId}` | `/franchize/{crewSlug}?vehicle={bikeId}&flow=rent` | Стандартная воронка аренды. Crew-slug резолвится серверно по `cars.crew_id` → `crews.slug` (fallback `vip-bike`) |
| `rent_{bikeId}_{docSha256}` | **Арендатор:** страница байка `?vehicle=&flow=rent&docSha256=…` (авто-заполнение формы из договора) · **Владелец экипажа:** `/franchize/{slug}/contract-draft/{rentalId}` | **QR-клейм** договора. Двухшаговый flow: 1) привязка chat_id к секрету (`claimRentalSecretsAction`), 2) проверка владения (`checkRentalOwnershipForQr`) |
| `buy_{bikeId}` | `/franchize/{crewSlug}/market/{bikeId}/buy` | Страница покупки байка |
| `testdrive_{bikeId}_{docSha256}` | Страница байка с `docSha256` — форма пре-филлится данными тест-драйва | QR тест-драйва: `claimTestdriveSecretsAction` → привязка `user_rental_secrets` по chat_id |
| `rent-bike` | `/franchize/vip-bike` | Простая ссылка на каталог проката |

> **Резолвер crew-slug:** `/api/startapp/vehicle?vehicle={id}&flow=rent|buy` — ищет `cars` по id,
> берёт `crew_id` → slug; при отсутствии crew — по `owner_id`; финальный fallback `vip-bike`.

### QR-клейм `rent_{bikeId}_{docSha256}` — механика

1. `parseRentDeepLink`: bike_id = сегмент до `_` (бренды используют дефисы), sha256 = второй сегмент.
2. Если есть `docSha256` и пользователь авторизован → `claimRentalSecretsAction`:
   - `ok` → тост «Ваши данные привязаны! Форма заполнится автоматически»;
   - `already_claimed_by_other` → «Эта ссылка уже привязана к другому пользователю»;
   - `revoked` → «Документ аннулирован»;
   - `not_found` → обычный флоу первого арендатора.
3. Проверка владения экипажем: владелец → `contract-draft/{rentalId}` (страница черновика договора).
4. Иначе арендатор → страница байка. Если при клейме создалась аренда, в URL добавляется `&rentalId={id}`.

---

## 2. Аренды: страница vs аналитика

| startapp | Куда ведёт | Комментарий |
|---|---|---|
| `rental_{rentalId}` | `/franchize/{slug}/rental/{rentalId}` | **Декатированная страница аренды** — здесь полный closure UI (одометр, возврат депозита, damage notes). Не путать с аналитикой |
| `analytics_rental_{rentalId}` | `/franchize/{slug}/rentals-analytics?ui=v2&tab=rentals&rentalId={id}` | Аналитика + drawer аренды |
| `analytics_sale_{saleId}` | `/franchize/{slug}/rentals-analytics?ui=v2&tab=sales&saleId={id}` | Аналитика + drawer продажи |

> История: раньше `rental_{id}` вёл в аналитику (BUG A+H), но у аналитического drawer'а не было
> нормального closure UI — роут переведён на `/franchize/{slug}/rental/{id}`.
> Для аналитики теперь явная форма `analytics_rental_{id}`.

---

## 3. Аналитика

| startapp | Куда ведёт |
|---|---|
| `analytics_rentals` · `analytics_sales` · `analytics_services` | `/franchize/{slug}/rentals-analytics?ui=v2&tab={tab}` |
| `analytics_rentals_2026-08-19` (вкладка + дата) | `/franchize/{slug}/rentals-analytics?ui=v2&tab=rentals&date=2026-08-19` |

---

## 4. Лиды

| startapp | Куда ведёт | Комментарий |
|---|---|---|
| `lead_{userId}` | `/franchize/{slug}/leads?leadId={userId}` | Открывает карточку лида (detail drawer, auto-focus строки) |
| `leads_hot` · `leads_warm` · `leads_verified` · `leads_troubled` · `leads_all` | `/franchize/{slug}/leads?segment={segment}` | Пред-фильтрованный список воронки |
| `lead_{id}` / `lead-{id}` (legacy) | `/franchize/{slug}/leads?leadId={id}` | Дубль-ветка из уведомлений lead-watcher |

> Crew-slug для лидов берётся из `userCrewInfo.slug` (fallback `vip-bike`).

---

## 5. Экипажи, карта, присоединение

| startapp | Куда ведёт |
|---|---|
| `crew_{slug}` | `/franchize/{slug}` — страница экипажа |
| `crew_{slug}_join_crew` | `/franchize/{slug}?join_crew=true` |
| `create_crew` | `/franchize/create#create-crew-form` (скролл к форме создания) |
| `mapriders_{slug}` / `mapriders-{slug}` | `/franchize/{slug}/map-riders` — карта райдеров |

---

## 6. Корзина: хэндофф «сайт → Telegram»

| startapp | Куда ведёт | Комментарий |
|---|---|---|
| `cart_id_{cartId}` | Остаётся на текущей странице | Потребляет временную корзину: `consumeTempFranchizeCartAction` → пишет cart-state всех crew в localStorage + событие `franchize-cart-sync` |
| `cart_{base64url-json}` | `/franchize/vip-bike?startappState=…&startappBikeId=…&startDate=&helmetCount=&extras*=&package=&perk=` | Structured state (пустые `extras*` параметры опускаются). Пишет лид-интент (`upsertFranchizeLead`, type rent/sale, urgency 75/85). Проверка свежести state: устаревший → `/franchize/vip-bike?startapp_expired=1&bikeId=…` |

---

## 7. Порядок обработки (важно!)

Проверки идут строго по цепочке — порядок критичен:

```
wb_dashboard → cart_id_* → cart_* → buy_* → rent_* (QR!) → testdrive_* → статический MAP
→ lead_/leads_* → rental_* → analytics_* → crew_* → viz_* → bio30_* → lobby_* → legacy → fallback "/{payload}"
```

- `rent_` ловится **раньше** `rental_` — поэтому `rental_{id}` не попадает в QR-ветку.
- Статический MAP (`hooks/useStartParamRouter.ts:19-44`) содержит страницы типа `settings`, `profile`,
  `leaderboard`, `crews`, `reports`, `wb`, `wb_dashboard`, `audit-tool`, `rent-bike` и др.

---

## 8. Защита от повторной обработки

- `activeStartParamRef` / `lastHandledStartParamRef` — параметр обрабатывается один раз за сессию.
- `isLatestRun()` — устаревшие async-результаты отбрасываются при быстрой смене параметров.
- `ignoredUrlStartParamRef` — если startapp пришёл и через payload контекста, и через URL — URL-дубль игнорируется.

---

*Источник: `hooks/useStartParamRouter.ts` (актуально на 19.08.2026) + `app/api/startapp/vehicle/route.ts`.*