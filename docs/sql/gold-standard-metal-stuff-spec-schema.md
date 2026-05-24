# Gold Standard Spec Schema — Metal Structures (`metal_stuff`)

> Canonical specification contract for all metal structure products in the СварПрофи-НН franchise.
> Every product inserted into `public.cars` with `type = 'metal_stuff'` MUST conform to this schema.

---

## 1. Spec Key Registry

> **POLICY: Unverified parameters MUST be left as `NULL`, never hallucinated.**
> Only fill a spec key when the value is confirmed by the franchise owner or an authoritative source.
> "Start small" — a product with mostly NULL specs is better than one with made-up data.

### Category: `identity`
| Key | Type | Required | Label (RU) | Description |
|-----|------|----------|------------|-------------|
| `type` | text | YES | Тип конструкции | Каркас / Навес / Ограждение / Лестница / Индивидуальный проект |
| `subtype` | text | no | Подтип | Промышленный / С подкрановыми путями / Поликарбонатный / Секционный / Маршевый / Винтовой |
| `year` | integer | no | Год разработки | Год проекта/модели |
| `manufacturer` | text | YES | Производитель | Название производителя / цеха |
| `model` | text | YES | Модель / Маркировка | Артикул или наименование модели |
| `sku` | text | no | Артикул | Внутренний артикул |

### Category: `dimensions`
| Key | Type | Required | Label (RU) | Description |
|-----|------|----------|------------|-------------|
| `length_mm` | integer | no | Длина, мм | Общая длина конструкции |
| `width_mm` | integer | no | Ширина, мм | Общая ширина конструкции |
| `height_mm` | integer | no* | Высота, мм | Общая высота конструкции (*required when known) |
| `wall_thickness_mm` | numeric(5,2) | no | Толщина стенки, мм | Толщина стенки профиля |
| `section_length_mm` | integer | no | Длина секции, мм | Для секционных конструкций |
| `span_mm` | integer | no | Пролёт, мм | Максимальный пролёт без опор |
| `step_mm` | integer | no | Шаг стоек, мм | Расстояние между стойками |

### Category: `material`
| Key | Type | Required | Label (RU) | Description |
|-----|------|----------|------------|-------------|
| `steel_grade` | text | no* | Марка стали | С245 / С345 / 09Г2С / Ст3пс и т.д. (*required when known) |
| `profile_type` | text | no* | Тип профиля | Квадратная труба / Прямоугольная труба / Двутавр / Швеллер / Уголок / Лист (*required when known) |
| `coating_type` | text | no | Тип покрытия | Грунт / Порошковое / Оцинковка / Без покрытия |
| `coating_color_ral` | text | no | Цвет RAL | Код цвета по RAL (например RAL 7016) |
| `strength_class` | text | no | Класс прочности | С245 / С345 / С375 |
| `gost` | text | no | ГОСТ | Соответствующий ГОСТ |

### Category: `weight`
| Key | Type | Required | Label (RU) | Description |
|-----|------|----------|------------|-------------|
| `weight_kg` | numeric(10,2) | no* | Масса, кг | Общая масса конструкции (*required when known) |
| `weight_per_meter_kg` | numeric(8,2) | no | Масса 1 п.м., кг | Масса одного погонного метра |
| `weight_per_sqm_kg` | numeric(8,2) | no | Масса 1 м2, кг | Масса одного квадратного метра |

### Category: `fabrication`
| Key | Type | Required | Label (RU) | Description |
|-----|------|----------|------------|-------------|
| `weld_type` | text | no* | Тип сварки | МАГ / МИГ / РДС / Аргонодуговая / Контактная (*required when known) |
| `anticorrosion` | text | no | Антикоррозийная обработка | Грунтовка / Порошковая покраска / Горячее цинкование / Холодное цинкование |
| `certification` | text[] | no | Сертификация | Массив сертификатов (ГОСТ, ISO, ТУ) |
| `drawing_available` | boolean | no | Чертёж в комплекте | Наличие КМ/КЖ чертежей |
| `assembly_type` | text | no | Тип сборки | Сварная / Болтовая / Комбинированная |

### Category: `price`
| Key | Type | Required | Label (RU) | Description |
|-----|------|----------|------------|-------------|
| `price_rub` | integer | no* | Цена, руб | Базовая цена в рублях (*required when known; notification-only mode allows NULL) |
| `price_per_sqm_rub` | integer | no | Цена за м2, руб | Цена за квадратный метр |
| `price_per_meter_rub` | integer | no | Цена за п.м., руб | Цена за погонный метр |
| `sale_price` | integer | no | Цена со скидкой, руб | Акционная/договорная цена |
| `sale` | boolean | no | Скидка | Наличие скидки |

### Category: `delivery`
| Key | Type | Required | Label (RU) | Description |
|-----|------|----------|------------|-------------|
| `production_days` | integer | no* | Срок изготовления, дней | Количество дней на производство (*required when known) |
| `delivery_available` | boolean | no | Доставка | Возможна ли доставка |
| `delivery_region` | text | no | Регион доставки | Нижний Новгород / НО / ЦФО / РФ |
| `installation_available` | boolean | no | Монтаж | Возможен ли монтаж |
| `installation_days` | integer | no | Срок монтажа, дней | Количество дней на монтаж |

### Category: `social`
| Key | Type | Required | Label (RU) | Description |
|-----|------|----------|------------|-------------|
| `rating` | numeric(3,1) | no | Рейтинг | Средний рейтинг (1.0-5.0) |
| `sold_count` | integer | no | Продано, шт | Количество проданных единиц |
| `recommend_percent` | integer | no | Рекомендуют, % | Процент рекомендаций |

---

## 2. Image Naming Convention

All product images for the `metal_stuff` type follow a strict naming convention in the Supabase storage bucket `svarprofi`.

### Storage Structure

```
svarprofi/                          ← Storage bucket
├── logo.png                        ← Branding images (root level)
├── hero.jpg
├── about-hero.jpg
├── promo-karkasy.jpg
├── promo-navesy.jpg
├── promo-ograzhdeniya.jpg
├── ad-certified.jpg
├── ad-delivery.jpg
├── karkas-prom/                    ← Product subfolder (slug-based)
│   ├── image_1.jpg                 ← Main image (orange truss installation)
│   ├── image_2.jpg                 ← Gallery (steel framework + blue sky)
│   └── image_3.jpg                 ← Gallery (workshop interior)
├── naves-polykarb/
│   └── image_1.jpg                 ← Polycarbonate canopy
├── karkas-kran/
│   └── image_1.jpg                 ← Space truss with crane runway
└── lm-01/
    └── image_1.jpg                 ← Mezzanine with staircase
```

### Rules

1. **Product images** are stored in subfolders named by the product slug (lowercased model identifier derived from `specs.sku` or `specs.model`).
2. **Image filenames** follow the pattern `image_N.jpg` where N starts at 1.
3. **`image_1.jpg`** is the **main product image**. It MUST appear in both:
   - The dedicated `image_url` column of `public.cars`
   - The first position of the `specs->gallery` JSONB array
4. **`image_2.jpg`, `image_3.jpg`, ...** are additional gallery images appearing in `specs->gallery` positions 2, 3, etc.
5. **Branding/UI images** (logo, hero, promos, ads, about-hero) are stored at the root level of the bucket without subfolders.
6. The **base URL** for all images is:
   `https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/`
7. Full image URL pattern for product images:
   `https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/svarprofi/{product-slug}/image_{N}.jpg`

### Example

For product `Каркас промышленный` with slug `karkas-prom`:

| Field | Value |
|-------|-------|
| `image_url` | `https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/svarprofi/karkas-prom/image_1.jpg` |
| `specs->gallery[0]` | `https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/svarprofi/karkas-prom/image_1.jpg` |
| `specs->gallery[1]` | `https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/svarprofi/karkas-prom/image_2.jpg` |
| `specs->gallery[2]` | `https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/svarprofi/karkas-prom/image_3.jpg` |

### Files to Upload (checklist)

| # | Path in bucket | Description |
|---|---------------|-------------|
| 1 | `svarprofi/logo.png` | Brand logo |
| 2 | `svarprofi/hero.jpg` | Hero section background |
| 3 | `svarprofi/about-hero.jpg` | About section hero |
| 4 | `svarprofi/promo-karkasy.jpg` | Promo banner: Каркасы |
| 5 | `svarprofi/promo-navesy.jpg` | Promo banner: Навесы |
| 6 | `svarprofi/promo-ograzhdeniya.jpg` | Promo banner: Ограждения |
| 7 | `svarprofi/ad-certified.jpg` | Ad card: certified welding |
| 8 | `svarprofi/ad-delivery.jpg` | Ad card: delivery & installation |
| 9-11 | `svarprofi/karkas-prom/image_{1,2,3}.jpg` | Каркас промышленный (3 photos) |
| 12 | `svarprofi/naves-polykarb/image_1.jpg` | Навес поликарбонатный (1 photo) |
| 13 | `svarprofi/karkas-kran/image_1.jpg` | Каркас с кран-балкой (1 photo) |
| 14 | `svarprofi/lm-01/image_1.jpg` | Площадка с лестницей (1 photo) |

**Total: 14 images** (8 branding + 6 product)

---

## 3. Label Map (complete)

```json
{
  "identity": {
    "type": "Тип конструкции",
    "subtype": "Подтип",
    "year": "Год разработки",
    "manufacturer": "Производитель",
    "model": "Модель / Маркировка",
    "sku": "Артикул"
  },
  "dimensions": {
    "length_mm": "Длина, мм",
    "width_mm": "Ширина, мм",
    "height_mm": "Высота, мм",
    "wall_thickness_mm": "Толщина стенки, мм",
    "section_length_mm": "Длина секции, мм",
    "span_mm": "Пролёт, мм",
    "step_mm": "Шаг стоек, мм"
  },
  "material": {
    "steel_grade": "Марка стали",
    "profile_type": "Тип профиля",
    "coating_type": "Тип покрытия",
    "coating_color_ral": "Цвет RAL",
    "strength_class": "Класс прочности",
    "gost": "ГОСТ"
  },
  "weight": {
    "weight_kg": "Масса, кг",
    "weight_per_meter_kg": "Масса 1 п.м., кг",
    "weight_per_sqm_kg": "Масса 1 м2, кг"
  },
  "fabrication": {
    "weld_type": "Тип сварки",
    "anticorrosion": "Антикоррозийная обработка",
    "certification": "Сертификация",
    "drawing_available": "Чертёж в комплекте",
    "assembly_type": "Тип сборки"
  },
  "price": {
    "price_rub": "Цена, руб",
    "price_per_sqm_rub": "Цена за м2, руб",
    "price_per_meter_rub": "Цена за п.м., руб",
    "sale_price": "Цена со скидкой, руб",
    "sale": "Скидка"
  },
  "delivery": {
    "production_days": "Срок изготовления, дней",
    "delivery_available": "Доставка",
    "delivery_region": "Регион доставки",
    "installation_available": "Монтаж",
    "installation_days": "Срок монтажа, дней"
  },
  "social": {
    "rating": "Рейтинг",
    "sold_count": "Продано, шт",
    "recommend_percent": "Рекомендуют, %"
  }
}
```

---

## 4. Display Order

Specs are displayed in this order within each product card:

1. **identity** — type, subtype, manufacturer, model, sku, year
2. **dimensions** — length_mm, width_mm, height_mm, wall_thickness_mm, section_length_mm, span_mm, step_mm
3. **material** — steel_grade, profile_type, strength_class, gost, coating_type, coating_color_ral
4. **weight** — weight_kg, weight_per_meter_kg, weight_per_sqm_kg
5. **fabrication** — weld_type, assembly_type, anticorrosion, certification, drawing_available
6. **price** — price_rub, price_per_sqm_rub, price_per_meter_rub, sale_price, sale
7. **delivery** — production_days, delivery_available, delivery_region, installation_available, installation_days
8. **social** — rating, sold_count, recommend_percent

---

## 5. Bar Visualization Rules

Numeric specs that support a horizontal bar chart representation:

| Key | Min | Max | Unit | Color | Inverted |
|-----|-----|-----|------|-------|----------|
| `height_mm` | 500 | 15000 | мм | `#5B7FA5` | no |
| `wall_thickness_mm` | 1.0 | 20.0 | мм | `#3D6B8E` | no |
| `span_mm` | 1000 | 30000 | мм | `#7A9CB8` | no |
| `weight_kg` | 10 | 50000 | кг | `#8B4513` | no |
| `production_days` | 1 | 90 | дн | `#D4740E` | yes (lower is better) |
| `price_rub` | 1000 | 5000000 | руб | `#2E7D32` | no |
| `rating` | 1.0 | 5.0 | stars | `#F9A825` | no |
| `sold_count` | 0 | 500 | шт | `#1565C0` | no |
| `recommend_percent` | 0 | 100 | % | `#43A047` | no |

> **Inverted** means lower values render a fuller bar (e.g., shorter production time is better).

---

## 6. Data Contract (TypeScript)

```typescript
interface MetalStuffSpec {
  // identity
  type: 'Каркас' | 'Навес' | 'Ограждение' | 'Лестница' | 'Индивидуальный проект';
  subtype?: string;
  year?: number;
  manufacturer: string;
  model: string;
  sku?: string;

  // dimensions
  length_mm?: number;
  width_mm?: number;
  height_mm: number;
  wall_thickness_mm?: number;
  section_length_mm?: number;
  span_mm?: number;
  step_mm?: number;

  // material
  steel_grade: string;
  profile_type: string;
  coating_type?: string;
  coating_color_ral?: string;
  strength_class?: string;
  gost?: string;

  // weight
  weight_kg: number;
  weight_per_meter_kg?: number;
  weight_per_sqm_kg?: number;

  // fabrication
  weld_type: string;
  anticorrosion?: string;
  certification?: string[];
  drawing_available?: boolean;
  assembly_type?: string;

  // price
  price_rub: number;
  price_per_sqm_rub?: number;
  price_per_meter_rub?: number;
  sale_price?: number;
  sale?: boolean;

  // delivery
  production_days: number;
  delivery_available?: boolean;
  delivery_region?: string;
  installation_available?: boolean;
  installation_days?: number;

  // social
  rating?: number;
  sold_count?: number;
  recommend_percent?: number;

  // images (see Section 2 for full convention)
  gallery?: string[];  // image_1.jpg MUST be first, same as image_url
  features?: string[];
  buy_options?: Array<{
    label: string;
    price_modifier: number;
    description: string;
  }>;
  buy_colors?: Array<{
    name: string;
    ral: string;
    swatch: string;
  }>;
}
```

---

## 7. Validation Rules

1. **Unverified values MUST be `NULL`** — never hallucinate or guess spec values.
2. `price_rub` if present MUST be > 0 (but can be NULL for notification-only mode).
3. `height_mm` if present MUST be > 0.
4. `weight_kg` if present MUST be > 0.
5. `production_days` if present MUST be >= 1.
6. `steel_grade` if present MUST be one of: `С245`, `С345`, `С375`, `09Г2С`, `Ст3пс`, `Ст3сп`, `10ХСНД`, or a custom value prefixed with `custom:`.
7. `weld_type` if present MUST be one of: `МАГ`, `МИГ`, `РДС`, `Аргонодуговая`, `Контактная`, `Комбинированная`.
8. If `sale` is `true`, `sale_price` MUST be present and < `price_rub`.
9. `coating_color_ral` if present MUST match pattern `RAL \d{4}`.
10. `rating` if present MUST be between 1.0 and 5.0.
11. `recommend_percent` if present MUST be between 0 and 100.
12. `gallery[0]` MUST equal `image_url` (both point to `image_1.jpg`).

---

## 8. Extensibility

- Custom keys not listed above MUST be prefixed with `x_` (e.g., `x_fire_resistance_class`).
- Frontend MUST ignore unknown keys gracefully (render as raw label/value if not in label map).
- New canonical keys are added via PR to this document.

---

## 9. Example Spec (golden demo — real product from photos)

### Minimal (unverified fields are NULL):

```json
{
  "type": "Каркас",
  "subtype": "Промышленный",
  "manufacturer": "СварПрофи-НН",
  "model": "Каркас промышленный",
  "height_mm": null,
  "steel_grade": null,
  "profile_type": "Двутавр",
  "weight_kg": null,
  "weld_type": "МАГ",
  "price_rub": null,
  "production_days": null,
  "rating": null,
  "sold_count": null,
  "recommend_percent": null
}
```

### With images (`image_url` + `gallery`):

```json
{
  "image_url": "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/svarprofi/karkas-prom/image_1.jpg",
  "gallery": [
    "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/svarprofi/karkas-prom/image_1.jpg",
    "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/svarprofi/karkas-prom/image_2.jpg",
    "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/svarprofi/karkas-prom/image_3.jpg"
  ]
}
```
