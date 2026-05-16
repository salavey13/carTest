**AGENT_INSTRUCTIONS_CART_REDESIGN.md**

**Задача:** Полностью переработать страницу Корзины (`/franchize/[slug]/cart`) в едином премиум-кибер стиле **CyberForge Market**.

**Ключевые требования:**

- Поддержка двух независимых потоков: **Rent** и **Buy**.
- В **Rent** — цена за день × количество дней.
- В **Buy** — фиксированная цена покупки (`sale_price` из `specs` JSONB), без умножения на дни.
- Единый визуальный язык с новой страницей Маркета (неоновый премиум 2026).

---

### 1. Общая концепция

- Тёмный техно-премиум стиль.
- Неоновые акценты + glow-эффекты.
- Максимум воздуха, крупные визуалы байков.
- Чёткое разделение Rent / Buy на уровне UI и логики.

### 2. Палитра (ОЧЕНЬ ВАЖНО)

**Запрещено** использовать hardcoded hex цвета.

**Обязательно** использовать уже существующую систему:

```tsx
const surface = crewPaletteForSurface(crew.theme);
// или
const theme = await getCrewPaletteBySlug(slug);
```

**Основные токены для использования:**

- `surface.page` → фон страницы
- `surface.card` → карточки
- `surface.subtleCard` → второстепенные блоки
- `surface.mutedText` → второстепенный текст
- `crew.theme.palette.accentMain` → основной акцент (gold/neon)
- `crew.theme.palette.textPrimary`, `textSecondary`
- `crew.theme.palette.borderSoft`

**Glow-эффекты** создавать через:
- `withAlpha(crew.theme.palette.accentMain, 0.6)`
- CSS `box-shadow` с `hsla(var(--accent-rgb), 0.5)`

### 3. Структура страницы

**Top**
- Breadcrumb: `/FRANCHIZE / VIP-BIKE / CART` (маленький, uppercase, accent)
- Заголовок: **Корзина** (Orbitron, крупно)
- Подзаголовок (muted)

**Карточка товара** (основной фокус)

- Большое фото слева (соотношение ~4:3 или квадрат)
- Справа:
  - Название модели (жирно, Orbitron)
  - Короткое описание + ключевые specs
  - Бейдж `Покупка` / `Аренда`
  - 3 мини-карточки характеристик (мощность, батарея, запас хода)
  - Цена:
    - Rent: `15 000 ₽ / день` (заметно)
    - Buy: `390 000 ₽` (самый крупный шрифт + gold glow)
  - Quantity controls (`- 1 +`) — **только для Rent**
  - Кнопка «Удалить» (справа сверху, иконка)

**Блок итого**

- Итого позиций
- Сумма за 1 день (только Rent)
- **Сумма за весь период** — самый акцентный блок (большой шрифт + gold)
- Баннер скидки (зелёный + shimmer)
- Блок «Полная защита включена» (shield)
- Большая жёлтая кнопка **«Перейти к оформлению»**

**Trust bar** (3 иконки) внизу

### 4. Анимации (детально)

**Обязательно** добавить:

1. Появление карточки товара — stagger + fade-up (framer-motion)
2. Изменение количества — scale + мягкий "пульс" цены
3. Удаление товара — slide-out + fade
4. Главная CTA кнопка — hover glow + subtle scale
5. Баннер скидки — лёгкий shimmer (background-position animation)
6. Hover на карточке — lift + cyan/gold border glow
7. Появление всей страницы — soft fade-in

**Пример анимации quantity:**

```tsx
<motion.div
  animate={{ scale: [1, 1.15, 1] }}
  transition={{ duration: 0.2 }}
>
  {quantity}
</motion.div>
```

### 5. Easter Egg

В самом низу страницы (перед футером):

```tsx
<div className="mt-16 text-center opacity-30 hover:opacity-100 transition-all duration-700 text-[10px] font-mono tracking-widest">
  Easter egg for future maintainers:<br/>
  天上天下，唯我独尊 // May your code be clean and your bugs be few.<br/>
  — Built with neon &amp; spite — 2026 —
</div>
```

