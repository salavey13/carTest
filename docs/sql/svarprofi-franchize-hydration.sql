-- ============================================================================
-- СварПрофи-НН Franchise Hydration SQL
-- ============================================================================
-- Franchise: СварПрофи-НН — производство строительных металлических конструкций
-- Location:  Нижний Новгород, Россия
-- Slug:      svarprofi
-- Type:      metal_stuff
-- Source:    rusprofile.ru (ИНН 5258146959, ОГРН 1195275055491)
-- ============================================================================
--
-- IMAGE URLS THAT NEED TO BE UPLOADED:
-- (bucket: svarprofi)
--
-- Branding / UI images (root level):
--  1. https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/svarprofi/logo.png
--  2. https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/svarprofi/hero.jpg
--  3. https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/svarprofi/about-hero.jpg
--  4. https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/svarprofi/promo-karkasy.jpg
--  5. https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/svarprofi/promo-navesy.jpg
--  6. https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/svarprofi/promo-ograzhdeniya.jpg
--  7. https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/svarprofi/ad-certified.jpg
--  8. https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/svarprofi/ad-delivery.jpg
--
-- Product images (in subfolders by product slug, named image_N.jpg):
--  9.  https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/svarprofi/karkas-prom/image_1.jpg
-- 10.  https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/svarprofi/karkas-prom/image_2.jpg
-- 11.  https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/svarprofi/karkas-prom/image_3.jpg
-- 12.  https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/svarprofi/karkas-kran/image_1.jpg
--
-- TOTAL: 12 images (8 branding/UI + 4 product)
-- ============================================================================

begin;

-- ============================================================================
-- 1. UPSERT CREW
-- ============================================================================
insert into public.crews (
  id,
  name,
  description,
  logo_url,
  owner_id,
  slug,
  hq_location,
  metadata,
  created_at,
  updated_at
)
values (
  'a1b2c3d4-e5f6-7a8b-9c0d-012345678901',
  'СварПрофи-НН',
  'СварПрофи-НН — производство строительных металлических конструкций в Нижнем Новгороде. Сварные конструкции, каркасы, ограждения, навесы и индивидуальные проекты.',
  'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/svarprofi/logo.png',
  '413553377',
  'svarprofi',
  '56.2965,43.9472',
  '{}'::jsonb,
  now(),
  now()
)
on conflict (id) do update
set
  name = excluded.name,
  description = excluded.description,
  logo_url = excluded.logo_url,
  owner_id = excluded.owner_id,
  slug = excluded.slug,
  hq_location = excluded.hq_location,
  updated_at = now();

-- ============================================================================
-- 2. SET FULL FRANCHISE METADATA
-- ============================================================================
update public.crews c
set metadata = jsonb_set(coalesce(c.metadata, '{}'::jsonb), '{franchize}', $$
{
  "version": 2,
  "enabled": true,
  "slug": "svarprofi",

  "branding": {
    "name": "СварПрофи-НН",
    "shortName": "СварПрофи",
    "tagline": "Металлические конструкции любой сложности — от чертежа до монтажа",
    "logoUrl": "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/svarprofi/logo.png",
    "heroImageUrl": "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/svarprofi/hero.jpg",
    "centerLogoInHeader": true
  },

  "theme": {
    "mode": "dark",
    "palette": {
      "background": "#1A1D23",
      "foreground": "#E8ECF1",
      "card": "#242830",
      "cardForeground": "#E8ECF1",
      "primary": "#2E7DBF",
      "primaryForeground": "#FFFFFF",
      "secondary": "#3A4250",
      "secondaryForeground": "#C8CDD5",
      "muted": "#2A2E36",
      "mutedForeground": "#8A92A0",
      "accent": "#D4740E",
      "accentForeground": "#FFFFFF",
      "destructive": "#C0392B",
      "destructiveForeground": "#FFFFFF",
      "border": "#3A4250",
      "input": "#3A4250",
      "ring": "#2E7DBF"
    },
    "palettes": {
      "dark": {
        "background": "#1A1D23",
        "foreground": "#E8ECF1",
        "card": "#242830",
        "primary": "#2E7DBF",
        "accent": "#D4740E"
      },
      "light": {
        "background": "#F0F2F5",
        "foreground": "#1A1D23",
        "card": "#FFFFFF",
        "primary": "#1B5A8C",
        "accent": "#B8640A"
      }
    },
    "radius": "0.5rem",
    "spacing": "0.75rem",
    "effects": {
      "glassmorphism": false,
      "grain": false,
      "gradientHero": true,
      "gradientDirection": "to bottom right",
      "gradientFrom": "#1A1D23",
      "gradientVia": "#1F2937",
      "gradientTo": "#0F172A"
    }
  },

  "header": {
    "showBackButton": false,
    "title": "СварПрофи-НН",
    "subtitle": "Металлоконструкции в Нижнем Новгороде",
    "logoHref": "/",
    "menuLinks": [
      { "label": "Каталог", "href": "/catalog" },
      { "label": "О компании", "href": "/about" },
      { "label": "Контакты", "href": "/contacts" },
      { "label": "Заказ", "href": "/order" }
    ],
    "quickActions": [
      { "label": "Позвонить", "href": "tel:+79040600644", "icon": "phone" }
    ]
  },

  "footer": {
    "textColor": "#8A92A0",
    "columns": [
      {
        "title": "Продукция",
        "links": [
          { "label": "Каркасы", "href": "/catalog?group=karkasy" },
          { "label": "Навесы", "href": "/catalog?group=navesy" },
          { "label": "Ограждения", "href": "/catalog?group=ograzhdeniya" },
          { "label": "Лестницы", "href": "/catalog?group=lestnitsy" },
          { "label": "Индивидуальные проекты", "href": "/catalog?group=individual" }
        ]
      },
      {
        "title": "Компания",
        "links": [
          { "label": "О нас", "href": "/about" },
          { "label": "Сертификаты", "href": "/about#certificates" },
          { "label": "Отзывы", "href": "/about#reviews" }
        ]
      },
      {
        "title": "Контакты",
        "links": [
          { "label": "+7 (904) 060-06-44", "href": "tel:+79040600644" },
          { "label": "Telegram", "href": "https://t.me/svarprofi_nn" },
          { "label": "Нижний Новгород", "href": "/contacts" }
        ]
      }
    ],
    "copyrightTemplate": "© {year} ООО «СварПрофи-НН». Все права защищены.",
    "poweredBy": "СварПрофи-НН"
  },

  "about": {
    "heroTitle": "Надёжные металлоконструкции от производителя",
    "heroSubtitle": "Проектируем, производим и монтируем сварные конструкции для промышленных и гражданских объектов в Нижнем Новгороде и Нижегородской области",
    "heroImage": "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/svarprofi/about-hero.jpg",
    "features": [
      {
        "icon": "shield",
        "title": "Гарантия качества",
        "description": "Все изделия сертифицированы по ГОСТ. Контроль качества на каждом этапе производства."
      },
      {
        "icon": "ruler",
        "title": "Проектирование",
        "description": "Разработка КМ и КЖ чертежей. Индивидуальный подход к каждому проекту."
      },
      {
        "icon": "truck",
        "title": "Доставка и монтаж",
        "description": "Доставка по Нижнему Новгороду, МО и ЦФО. Профессиональный монтаж бригадой опытных сварщиков."
      },
      {
        "icon": "clock",
        "title": "Точные сроки",
        "description": "Собственное производство позволяет соблюдать сроки."
      },
      {
        "icon": "palette",
        "title": "Любое исполнение",
        "description": "Порошковая покраска в любой цвет по RAL. Оцинковка. Комбинированная защита."
      },
      {
        "icon": "handshake",
        "title": "Договор и оплата",
        "description": "Работаем по договору. Безналичная оплата."
      }
    ],
    "faq": [
      {
        "question": "Какие минимальные сроки изготовления?",
        "answer": "Типовые конструкции — от 7 рабочих дней. Индивидуальные проекты — от 14 дней в зависимости от сложности."
      },
      {
        "question": "Работаете ли вы с физическими лицами?",
        "answer": "Да, мы работаем как с юридическими, так и с физическими лицами. Оформление по договору."
      },
      {
        "question": "Какие марки стали вы используете?",
        "answer": "Основные марки: С245, С345, 09Г2С, Ст3пс. Возможна работа с другими марками по запросу."
      },
      {
        "question": "Есть ли гарантия на конструкции?",
        "answer": "Гарантия на сварные конструкции — от 5 лет. На антикоррозийное покрытие — от 3 лет."
      },
      {
        "question": "Возможен ли выезд замерщика?",
        "answer": "Да, выезд замерщика по Нижнему Новгороду — бесплатно. По области — по договорённости."
      }
    ]
  },

  "contacts": {
    "address": "603032, Нижегородская область, г. Нижний Новгород",
    "phone": "+7 (904) 060-06-44",
    "email": null,
    "telegram": "https://t.me/svarprofi_nn",
    "telegramBotUsername": null,
    "workingHours": null,
    "map": {
      "lat": 56.2965,
      "lng": 43.9472,
      "zoom": 12
    }
  },

  "contentBlocks": {
    "productCategories": [
      {
        "id": "karkasy",
        "title": "Каркасы",
        "description": "Металлические каркасы для промышленных и гражданских зданий",
        "image": "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/svarprofi/promo-karkasy.jpg",
        "href": "/catalog?group=karkasy"
      },
      {
        "id": "navesy",
        "title": "Навесы",
        "description": "Навесы из профнастила и поликарбоната для автостоянок и террас",
        "image": "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/svarprofi/promo-navesy.jpg",
        "href": "/catalog?group=navesy"
      },
      {
        "id": "ograzhdeniya",
        "title": "Ограждения",
        "description": "Сварные секционные ограждения для территорий и объектов",
        "image": "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/svarprofi/promo-ograzhdeniya.jpg",
        "href": "/catalog?group=ograzhdeniya"
      }
    ],
    "orderProcess": [
      { "step": 1, "title": "Заявка", "description": "Оставьте заявку на сайте или позвоните" },
      { "step": 2, "title": "Замер", "description": "Выезд замерщика (бесплатно по Н.Новгороду)" },
      { "step": 3, "title": "Проект", "description": "Разработка чертежей и согласование" },
      { "step": 4, "title": "Производство", "description": "Изготовление конструкции на нашем производстве" },
      { "step": 5, "title": "Доставка", "description": "Доставка на объект" },
      { "step": 6, "title": "Монтаж", "description": "Профессиональный монтаж и сдача объекта" }
    ],
    "materials": [
      { "grade": "С245", "description": "Углеродистая сталь общего назначения" },
      { "grade": "С345", "description": "Низколегированная сталь повышенной прочности" },
      { "grade": "09Г2С", "description": "Конструкционная низколегированная сталь для сварных конструкций" }
    ],
    "certificates": [
      { "name": "ГОСТ 23118-2019", "description": "Конструкции стальные строительные" },
      { "name": "ISO 3834-2", "description": "Требования к качеству при сварке" }
    ],
    "onboardingChecklist": [
      { "id": "req_measurement", "label": "Запросить выезд замерщика", "done": false },
      { "id": "req_quote", "label": "Получить расчёт стоимости", "done": false },
      { "id": "sign_contract", "label": "Подписать договор", "done": false },
      { "id": "approve_drawings", "label": "Утвердить чертежи КМ/КЖ", "done": false },
      { "id": "prepay", "label": "Внести предоплату", "done": false },
      { "id": "schedule_delivery", "label": "Согласовать дату доставки", "done": false }
    ]
  },

  "catalog": {
    "groupOrder": ["karkasy", "navesy", "ograzhdeniya", "lestnitsy", "individual"],
    "groupLabels": {
      "karkasy": "Каркасы",
      "navesy": "Навесы",
      "ograzhdeniya": "Ограждения",
      "lestnitsy": "Лестницы",
      "individual": "Индивидуальные проекты"
    },
    "quickLinks": [
      { "label": "Каркасы зданий", "href": "/catalog?group=karkasy", "icon": "building" },
      { "label": "Навесы", "href": "/catalog?group=navesy", "icon": "shed" },
      { "label": "Ограждения", "href": "/catalog?group=ograzhdeniya", "icon": "fence" },
      { "label": "Лестницы", "href": "/catalog?group=lestnitsy", "icon": "stairs" }
    ],
    "tickerItems": [
      "Бесплатный выезд замерщика по Нижнему Новгороду",
      "Доставка по ЦФО",
      "Гарантия на все конструкции от 5 лет"
    ],
    "showTwoColumnsMobile": false,
    "useModalDetails": true,
    "promoBanners": [
      {
        "title": "Каркасы промышленных зданий",
        "subtitle": "От проекта до монтажа",
        "image": "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/svarprofi/promo-karkasy.jpg",
        "href": "/catalog?group=karkasy"
      },
      {
        "title": "Навесы под ключ",
        "subtitle": "Профнастил и поликарбонат",
        "image": "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/svarprofi/promo-navesy.jpg",
        "href": "/catalog?group=navesy"
      },
      {
        "title": "Ограждения сварные",
        "subtitle": "Секционные ограждения для территорий",
        "image": "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/svarprofi/promo-ograzhdeniya.jpg",
        "href": "/catalog?group=ograzhdeniya"
      }
    ],
    "adCards": [
      {
        "title": "Сертифицированная сварка",
        "description": "Качество сварных швов по ISO 3834.",
        "image": "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/svarprofi/ad-certified.jpg"
      },
      {
        "title": "Доставка и монтаж",
        "description": "Доставка и монтаж бригадой опытных специалистов.",
        "image": "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/svarprofi/ad-delivery.jpg"
      }
    ],
    "floatingCart": {
      "enabled": false
    }
  },

  "order": {
    "allowPromo": false,
    "deliveryModes": ["self_pickup", "delivery", "delivery_and_installation"],
    "defaultMode": "delivery_and_installation",
    "paymentOptions": [],
    "consentText": "Нажимая «Отправить заявку», вы соглашаетесь на обработку персональных данных. Менеджер свяжется с вами для уточнения деталей и расчёта стоимости.",
    "submitLabel": "Отправить заявку",
    "notificationOnly": true,
    "orderFields": [
      { "name": "name", "label": "Ваше имя", "type": "text", "required": true },
      { "name": "phone", "label": "Телефон", "type": "tel", "required": true },
      { "name": "email", "label": "Email", "type": "email", "required": false },
      { "name": "product_type", "label": "Тип конструкции", "type": "select", "options": ["Каркас", "Навес", "Ограждение", "Лестница", "Индивидуальный проект"], "required": true },
      { "name": "dimensions", "label": "Приблизительные размеры", "type": "text", "required": false },
      { "name": "comment", "label": "Комментарий к заказу", "type": "textarea", "required": false }
    ]
  },

  "contractDefaults": {
    "issuer": {
      "name": "ООО «СварПрофи-НН»",
      "inn": "5258146959",
      "kpp": "525801001",
      "ogrn": "1195275055491",
      "address": "603032, Нижегородская область, г. Нижний Новгород, Переякопская ул., д. 8 к. 1, кв. 61",
      "phone": "+7 (904) 060-06-44",
      "email": null,
      "signatory": "Генеральный директор Токаева А.Н.",
      "bank": null,
      "bik": null,
      "checkingAccount": null,
      "correspondentAccount": null
    },
    "templateFields": [
      "order_number",
      "order_date",
      "customer_name",
      "customer_inn",
      "product_type",
      "product_model",
      "quantity",
      "total_price",
      "delivery_address",
      "production_days",
      "warranty_years",
      "payment_terms"
    ],
    "defaults": {
      "warranty_years": 5,
      "payment_terms": null,
      "delivery_terms": null
    }
  }
}
$$::jsonb)
where c.id = 'a1b2c3d4-e5f6-7a8b-9c0d-012345678901';

-- ============================================================================
-- 3. UPDATE TOP-LEVEL METADATA
-- ============================================================================
update public.crews c
set metadata = jsonb_set(c.metadata, '{slug}', '"svarprofi"'::jsonb)
where c.id = 'a1b2c3d4-e5f6-7a8b-9c0d-012345678901';

update public.crews c
set metadata = jsonb_set(c.metadata, '{is_provider}', 'true'::jsonb)
where c.id = 'a1b2c3d4-e5f6-7a8b-9c0d-012345678901';

update public.crews c
set metadata = jsonb_set(c.metadata, '{provider_type}', '"metal_stuff"'::jsonb)
where c.id = 'a1b2c3d4-e5f6-7a8b-9c0d-012345678901';

update public.crews c
set metadata = jsonb_set(c.metadata, '{rating}', '4.8'::jsonb)
where c.id = 'a1b2c3d4-e5f6-7a8b-9c0d-012345678901';

update public.crews c
set metadata = jsonb_set(c.metadata, '{contacts}', $$
{
  "address": "603032, Нижегородская область, г. Нижний Новгород",
  "phone": "+7 (904) 060-06-44",
  "email": null,
  "telegram": "https://t.me/svarprofi_nn",
  "workingHours": null
}
$$::jsonb)
where c.id = 'a1b2c3d4-e5f6-7a8b-9c0d-012345678901';

-- ============================================================================
-- 4. CREW SECRETS (contract defaults)
-- ============================================================================
insert into private.crew_secrets (
  crew_slug,
  contract_defaults,
  updated_at
)
select
  'svarprofi',
  (metadata->'franchize'->'contractDefaults')::text,
  now()
from public.crews
where slug = 'svarprofi'
on conflict (crew_slug) do update
set
  contract_defaults = excluded.contract_defaults,
  updated_at = now();

commit;