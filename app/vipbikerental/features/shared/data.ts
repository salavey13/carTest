/**
 * VIP Bike Rental - Shared Data Constants
 * =====================================
 * Extracted hardcoded data from feature components for better maintainability.
 */

// ── Service Cards Data ──
export const SERVICE_CARDS = [
  {
    title: "Требования",
    icon: "::FaClipboardList::",
    borderColorClass: "border-secondary text-accent",
    imageUrl: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/fon-8f9c72b7-c622-4159-98da-64173322eae4.jpg",
    items: [
      { icon: "::FaUserClock::", text: "Возраст от 23 лет" },
      { icon: "::FaIdCard::", text: "Паспорт и В/У категории 'А' (есть скутеры без 'А')" },
      { icon: "::FaAward::", text: "Залог от 20 000 ₽" },
      { icon: "::FaCreditCard::", text: "Оплата любым удобным способом" }
    ]
  },
  {
    title: "Что получает клиент",
    icon: "::FaGift::",
    borderColorClass: "border-accent text-accent",
    imageUrl: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/81Dts9uMBXZXTKC7PjIbBRRRHYGQx_2TPEKFWvaUwDzzgSQPjxUf4GjAiRaDWIcWgwmeaZQTKppFn5VBS6yZeK7R-38bfc7fb-0d5a-4b62-b7e6-ca83950cb265.jpg",
    items: [
      { icon: "::FaCircleCheck::", text: "Полностью обслуженный и чистый мотоцикл" },
      { icon: "::FaFileSignature::", text: "Открытый полис ОСАГО" },
      { icon: "::FaUserShield::", text: "Полный комплект защитной экипировки" },
      { icon: "::FaTag::", text: "Минус 10% на первый выезд по промокоду VIPSTART — мягкий вход без снижения уровня сервиса" }
    ]
  },
  {
    title: "Наши услуги",
    icon: "::FaWrench::",
    borderColorClass: "border-primary text-primary",
    imageUrl: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/IMG_bg-cf31dc2b-291b-440b-953b-6e1b4a838e4e.jpg",
    items: [
      { icon: "::FaTools::", text: "Обслуживание и ремонт вашего мотоцикла" },
      { icon: "::FaGamepad::", text: "Лаунж-зона с кальяном и игровыми приставками" },
      { icon: "::FaMapLocationDot::", text: "Новая удобная локация: пл. Комсомольская 2" },
      { icon: "::FaBeerMugEmpty::", text: "Место, где можно встретить единомышленников" }
    ]
  }
] as const;

// ── FAQ Data ──
export const FAQ_ITEMS = [
  {
    id: "age",
    question: "Какой минимальный возраст для аренды?",
    answer: "Базовый минимум — 23 года для аренды мотоциклов. Для скутеров возраст может быть ниже — уточняйте при бронировании."
  },
  {
    id: "documents",
    question: "Какие документы нужны?",
    answer: "Паспорт РФ и водительское удостоверение категории 'А'. Для скутеров без категории 'А' достаточно паспорта и любых прав."
  },
  {
    id: "deposit",
    question: "Какой размер залога?",
    answer: "Залог от 20 000 ₽ в зависимости от модели мотоцикла. Залог возвращается при возврате техники в исходном состоянии."
  },
  {
    id: "insurance",
    question: "Входит ли страховка в стоимость?",
    answer: "Да, ОСАГО включено в стоимость аренды. Дополнительное КАСКО можно оформить за отдельную плату."
  },
  {
    id: "routes",
    question: "Есть ли ограничения по маршруту?",
    answer: "Базовый тариф включает поездки в пределах Нижнего Новгородской области. Заезды в другие регионы согласовываются дополнительно."
  },
  {
    id: "cancellation",
    question: "Можно ли отменить бронь?",
    answer: "Отмена бронирования бесплатно за 24 часа до начала аренды. При более поздней отмене удерживается 50% стоимости."
  }
] as const;

// ── Gear/Equipment Data ──
export const GEAR_ITEMS = [
  {
    id: "helmet",
    name: "Шлем",
    description: "Интегральные и модульные шлемы всех размеров",
    included: true
  },
  {
    id: "jacket",
    name: "Куртка",
    description: "Защитные мотоциклетные куртки с защитой",
    included: true
  },
  {
    id: "gloves",
    name: "Перчатки",
    description: "Летние и демисезонные перчатки",
    included: true
  },
  {
    id: "pants",
    name: "Штаны",
    description: "Защитные штаны с встроенной защитой",
    included: true
  },
  {
    id: "boots",
    name: "Ботинки",
    description: "Мотоциклетные ботинки",
    included: true
  },
  {
    id: "protector",
    name: "Защита позвоночника",
    description: "Дополнительный защитный жилет (опция)",
    included: false
  }
] as const;

// ── How It Works Steps ──
export const HOW_IT_WORKS_STEPS = [
  {
    id: "choose",
    num: "1",
    title: "Выберите байк",
    icon: "::FaMotorcycle::",
    description: "Откройте каталог, выберите подходящий мотоцикл и дату аренды"
  },
  {
    id: "book",
    num: "2",
    title: "Забронируйте онлайн",
    icon: "::FaCalendarCheck::",
    description: "Заполните форму и оплатите бронирование. Это займет 2 минуты."
  },
  {
    id: "pickup",
    num: "3",
    title: "Получите байк",
    icon: "::FaKey::",
    description: "Приезжайте в точку выдачи, подпишите договор и получите экипировку"
  },
  {
    id: "ride",
    num: "4",
    title: "Катайтесь!",
    icon: "::FaRoad::",
    description: "Наслаждайтесь поездкой по своим маршрутам или нашим рекомендациям"
  },
  {
    id: "return",
    num: "5",
    title: "Верните технику",
    icon: ":: faHandshake::",
    description: "Вовремя верните байк в исходном состоянии и получите залог обратно"
  }
] as const;

// ── Investment/ROI Data ──
export const INVESTMENT_TIERS = [
  {
    id: "starter",
    name: "Стартовый",
    minInvestment: 500000,
    expectedReturn: 18,
    period: "6 месяцев",
    risk: "Низкий"
  },
  {
    id: "standard",
    name: "Стандарт",
    minInvestment: 1000000,
    expectedReturn: 24,
    period: "12 месяцев",
    risk: "Средний"
  },
  {
    id: "premium",
    name: "Премиум",
    minInvestment: 2500000,
    expectedReturn: 32,
    period: "18 месяцев",
    risk: "Средний"
  }
] as const;

// ── Quick Actions Data ──
export const QUICK_ACTIONS = [
  {
    id: "test-drive",
    label: "Тест-драйв",
    href: "/vipbikerental#test-drive",
    icon: "::faMotorcycle::",
    description: "Протестируйте любой байк перед арендой"
  },
  {
    id: "catalog",
    label: "Каталог",
    href: "/franchize/vip-bike",
    icon: "::faBookOpen::",
    description: "Выберите из нашего парка"
  },
  {
    id: "sales",
    label: "Покупка",
    href: "/franchize/vip-bike/sales",
    icon: "::faTag::",
    description: "Купите электробайк в рассрочку"
  },
  {
    id: "contacts",
    label: "Контакты",
    href: "/franchize/vip-bike/contacts",
    icon: "::faPhone::",
    description: "Свяжитесь с нами"
  }
] as const;

// ── Hero Video Config ──
export const HERO_VIDEO_CONFIG = {
  // Fallback gradient when video fails
  fallbackGradient: "radial-gradient(ellipse_at_top, rgba(255,106,0,0.15), transparent 50%)",
  // Accent color for overlays
  accentColor: "#D99A00",
  // Shadow color for cards
  shadowColor: "rgba(217,154,0,0.3)",
  // Border color
  borderColor: "rgba(217,154,0,0.3)",
  // Glow effect color
  glowColor: "rgba(255,106,0,0.15)"
} as const;

// ── Type Exports ──
export type ServiceItem = { icon: string; text: string };
export type ServiceCard = typeof SERVICE_CARDS[number];
export type FAQItem = typeof FAQ_ITEMS[number];
export type GearItem = typeof GEAR_ITEMS[number];
export type HowItWorksStep = typeof HOW_IT_WORKS_STEPS[number];
export type InvestmentTier = typeof INVESTMENT_TIERS[number];
export type QuickAction = typeof QUICK_ACTIONS[number];
