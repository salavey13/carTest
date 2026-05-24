// ─────────────────────────────────────────────────────
// SvarProfi — Shared Constants (from SQL hydration)
// ─────────────────────────────────────────────────────

import {
  Shield,
  Ruler,
  Truck,
  Clock,
  Palette,
  Handshake,
  Building2,
  Columns3,
  Wrench,
} from 'lucide-react'

export const BRAND = {
  name: 'СварПрофи-НН',
  shortName: 'СварПрофи',
  tagline: 'Металлические конструкции любой сложности — от чертежа до монтажа',
  phone: '+7 (904) 060-06-44',
  phoneHref: 'tel:+79040600644',
  telegram: 'https://t.me/svarprofi_nn',
  city: 'Москва',
}

export const IMAGES = {
  logo: 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/svarprofi/logo.png',
  hero: 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/svarprofi/hero.jpg',
  aboutHero: 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/svarprofi/about-hero.jpg',
  promoKarkasy: 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/svarprofi/promo-karkasy.jpg',
  promoNavesy: 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/svarprofi/promo-navesy.jpg',
  promoOgrazhdeniya: 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/svarprofi/promo-ograzhdeniya.jpg',
  adCertified: 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/svarprofi/ad-certified.jpg',
  adDelivery: 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/svarprofi/ad-delivery.jpg',
}

export const CATEGORIES = [
  {
    id: 'karkasy',
    title: 'Каркасы',
    description: 'Металлические каркасы для промышленных и гражданских зданий',
    image: IMAGES.promoKarkasy,
    icon: Building2,
  },
  {
    id: 'navesy',
    title: 'Навесы',
    description: 'Навесы из профнастила и поликарбоната для автостоянок и террас',
    image: IMAGES.promoNavesy,
    icon: Columns3,
  },
  {
    id: 'ograzhdeniya',
    title: 'Ограждения',
    description: 'Сварные секционные ограждения для территорий и объектов',
    image: IMAGES.promoOgrazhdeniya,
    icon: Wrench,
  },
]

export const FEATURES = [
  { icon: Shield, title: 'Гарантия качества', description: 'Все изделия сертифицированы по ГОСТ. Контроль качества на каждом этапе производства.' },
  { icon: Ruler, title: 'Проектирование', description: 'Разработка КМ и КЖ чертежей. Индивидуальный подход к каждому проекту.' },
  { icon: Truck, title: 'Доставка и монтаж', description: 'Доставка по Москве, МО и ЦФО. Профессиональный монтаж бригадой опытных сварщиков.' },
  { icon: Clock, title: 'Точные сроки', description: 'Собственное производство позволяет соблюдать сроки.' },
  { icon: Palette, title: 'Любое исполнение', description: 'Порошковая покраска в любой цвет по RAL. Оцинковка. Комбинированная защита.' },
  { icon: Handshake, title: 'Договор и оплата', description: 'Работаем по договору. Безналичная оплата.' },
]

export const ORDER_STEPS = [
  { step: 1, title: 'Заявка', description: 'Оставьте заявку на сайте или позвоните' },
  { step: 2, title: 'Замер', description: 'Выезд замерщика (бесплатно по Москве)' },
  { step: 3, title: 'Проект', description: 'Разработка чертежей и согласование' },
  { step: 4, title: 'Производство', description: 'Изготовление конструкции на нашем производстве' },
  { step: 5, title: 'Доставка', description: 'Доставка на объект' },
  { step: 6, title: 'Монтаж', description: 'Профессиональный монтаж и сдача объекта' },
]

export const FAQ_ITEMS = [
  { question: 'Какие минимальные сроки изготовления?', answer: 'Типовые конструкции — от 7 рабочих дней. Индивидуальные проекты — от 14 дней в зависимости от сложности.' },
  { question: 'Работаете ли вы с физическими лицами?', answer: 'Да, мы работаем как с юридическими, так и с физическими лицами. Оформление по договору.' },
  { question: 'Какие марки стали вы используете?', answer: 'Основные марки: С245, С345, 09Г2С, Ст3пс. Возможна работа с другими марками по запросу.' },
  { question: 'Есть ли гарантия на конструкции?', answer: 'Гарантия на сварные конструкции — от 5 лет. На антикоррозийное покрытие — от 3 лет.' },
  { question: 'Возможен ли выезд замерщика?', answer: 'Да, выезд замерщика по Москве — бесплатно. По области — по договорённости.' },
]

export const MATERIALS = [
  { grade: 'С245', description: 'Углеродистая сталь общего назначения' },
  { grade: 'С345', description: 'Низколегированная сталь повышенной прочности' },
  { grade: '09Г2С', description: 'Конструкционная низколегированная сталь для сварных конструкций' },
]

export const TICKER_ITEMS = [
  'Бесплатный выезд замерщика по Москве',
  'Доставка по ЦФО',
  'Гарантия на все конструкции от 5 лет',
]

export const DEMO_ITEMS = [
  {
    id: 'b1c2d3e4-f5a6-7b8c-9d0e-012345678902',
    make: 'СварПрофи-НН',
    model: 'Каркас промышленный',
    description: 'Металлический каркас промышленного здания с фермами покрытия. Двутавровые колонны и фермы из прокатных профилей. Антикоррозийная обработка. Болтовые монтажные соединения.',
    image_url: 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/svarprofi/karkas-prom/image_1.jpg',
    specs: {
      type: 'Каркас',
      subtype: 'Промышленный',
      manufacturer: 'СварПрофи-НН',
      model: 'Каркас промышленный',
      profile_type: 'Двутавр',
      coating_type: 'Порошковое',
      assembly_type: 'Болтовая',
      weld_type: 'МАГ',
      features: ['Двутавровые колонны и фермы покрытия', 'Болтовые монтажные соединения', 'Антикоррозийная обработка'],
      gallery: [
        'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/svarprofi/karkas-prom/image_1.jpg',
        'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/svarprofi/karkas-prom/image_2.jpg',
        'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/svarprofi/karkas-prom/image_3.jpg',
      ],
      buy_colors: [],
      delivery_available: true,
      installation_available: true,
      delivery_region: 'Москва, МО, ЦФО',
      price_rub: null,
      production_days: null,
    },
  },
  {
    id: 'b1c2d3e4-f5a6-7b8c-9d0e-012345678903',
    make: 'СварПрофи-НН',
    model: 'Каркас с кран-балкой',
    description: 'Пространственная стропильная ферма с подкрановыми путями. Опорные колонны и подкрановые балки — жёлтого цвета (безопасность). Основные фермы — светло-серые.',
    image_url: 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/svarprofi/karkas-kran/image_1.jpg',
    specs: {
      type: 'Каркас',
      subtype: 'С подкрановыми путями',
      manufacturer: 'СварПрофи-НН',
      model: 'Каркас с кран-балкой',
      profile_type: 'Двутавр',
      coating_type: 'Порошковое',
      assembly_type: 'Комбинированная',
      weld_type: 'МАГ',
      features: ['Пространственная стропильная ферма', 'Подкрановые пути (мостовой кран)', 'Опорные колонны жёлтого цвета', 'Сварные + болтовые соединения'],
      gallery: [
        'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/svarprofi/karkas-kran/image_1.jpg',
      ],
      buy_colors: [
        { name: 'Серый (фермы)', ral: 'RAL 7035', swatch: '#C6C8CC' },
        { name: 'Жёлтый (колонны)', ral: 'RAL 1023', swatch: '#F0CA00' },
      ],
      delivery_available: true,
      installation_available: true,
      delivery_region: 'Москва, МО, ЦФО',
      price_rub: null,
      production_days: null,
    },
  },
]