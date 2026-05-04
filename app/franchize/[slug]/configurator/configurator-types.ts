export const DELIVERY_AVERAGE = 95_000
export const CARPIX_BASE = 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix'

export const formatPrice = (price: number) => `${price.toLocaleString('ru-RU')} ₽`

// ── DB shapes ──

export interface ConfiguratorBatteryOption {
  capacity: string
  type: 'regular' | 'lithium'
  battery_price: number
  total_price: number
  range_km: string
}

export interface ConfiguratorBike {
  id: string
  make: string
  model: string
  description: string
  daily_price: number
  image_url: string
  rent_link: string
  specs: {
    power_w: number
    power_kw: number
    max_speed_kmh: string
    subtitle?: string
    tier?: string
    gallery?: string[]
    battery_options?: {
      base_price: number
      batteries: ConfiguratorBatteryOption[]
    }
    [key: string]: unknown
  }
  type: string
  quantity: number
}

export interface ConfiguratorPart {
  id: string
  make: string
  model: string
  description: string
  daily_price: number
  image_url: string
  specs: {
    type?: string
    capacity?: string
    battery_type?: string
    range_km?: string
    category?: string
    brand?: string
    system?: string
    technology?: string
    material?: string
    position?: string
    [key: string]: unknown
  }
  type: string
}

// ── UI constants ──


export interface ConfiguratorColorOption {
  id: string
  factoryId: string
  label: string
  hex?: string
  availability?: 'in_stock' | 'made_to_order' | 'out_of_stock'
  isDefault?: boolean
}

export const TIER_META: Record<string, { label: string; color: string }> = {
  budget: { label: 'Бюджет', color: '#6ee7b7' },
  standard: { label: 'Стандарт', color: '#60a5fa' },
  'mid-range': { label: 'Оптимум', color: '#a78bfa' },
  premium: { label: 'Премиум', color: '#fbbf24' },
  sport: { label: 'Спорт', color: '#f87171' },
  'high-performance': { label: 'Флагман', color: '#fb923c' },
}

export const CATEGORY_LABELS: Record<string, string> = {
  battery: 'Аккумуляторы',
  safety: 'Безопасность',
  brakes: 'Тормоза',
  performance: 'Производительность',
  electronics: 'Электроника',
  accessories: 'Аксессуары',
  suspension: 'Подвеска',
  wheels: 'Колёса',
}

export const STEPS = [
  { key: 'model', label: 'Модель', num: '01' },
  { key: 'config', label: 'Конфиг', num: '02' },
  { key: 'addons', label: 'Опции', num: '03' },
  { key: 'summary', label: 'Итог', num: '04' },
] as const

export type ConfigStep = (typeof STEPS)[number]['key']

// ── Server action input ──

export interface ConfiguratorLeadInput {
  bikeId: string
  bikeLabel: string
  motorLabel: string
  batteryLabel: string
  selectedColorId: string
  selectedColorFactoryId: string
  selectedAccessories: Array<{ name: string; price: number }>
  withDelivery: boolean
  deliveryPrice: number
  total: number
  basePrice: number
  motorExtra: number
  batteryPrice: number
  accessoriesTotal: number
  // from dbUser
  userTelegramId: string
  userName: string
  userId: string
  crewSlug: string
}