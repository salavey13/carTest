'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Zap, 
  Battery, 
  Gauge, 
  MapPin, 
  Phone, 
  MessageCircle, 
  Check, 
  Bike,
  Star,
  ArrowRight,
  ShoppingCart,
  Plus,
  Wrench,
  Shield
} from 'lucide-react'
//import { Toaster } from '@/components/ui/toaster'
import { useToast } from '@/hooks/use-toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'

// Types
interface BatteryOption {
  capacity: string
  type: 'regular' | 'lithium'
  battery_price: number
  total_price: number
  range_km: string
}

interface MotorcycleSpecs {
  type: string
  engine: string
  power_w: number
  power_kw: number
  max_speed_kmh: string
  subtitle: string
  bike_subtype: string
  gallery?: string[]
  battery_options: {
    base_price: number
    batteries: BatteryOption[]
  }
  tier: string
}

interface Motorcycle {
  id: string
  make: string
  model: string
  description: string
  daily_price: number
  image_url: string
  rent_link: string | null
  specs: MotorcycleSpecs
  type: string
  quantity: number
}

interface Accessory {
  id: string
  name: string
  price: number
  description: string
  category: string
  image_url: string
}

// Base URL for images
const CARPIX_BASE = 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix'

// Motorcycle data
const motorcycles: Motorcycle[] = [
  { id: "vipbike-g8", make: "VipBike", model: "G8", description: "Электромотоцикл VipBike G8 с мощным двигателем 3000 Вт и максимальной скоростью до 150 км/ч.", daily_price: 120800, image_url: `${CARPIX_BASE}/vipbike-g8/image_1.jpg`, rent_link: "/rent/vipbike-g8", specs: { type: "Electric", engine: "Электро", power_w: 3000, power_kw: 3, max_speed_kmh: "90-150", subtitle: "Электромотоцикл VipBike G8", bike_subtype: "Electric", gallery: [`${CARPIX_BASE}/vipbike-g8/image_1.jpg`, `${CARPIX_BASE}/vipbike-g8/image_2.jpg`, `${CARPIX_BASE}/vipbike-g8/image_3.jpg`], battery_options: { base_price: 120800, batteries: [{capacity: "50Ah", type: "regular", battery_price: 44500, total_price: 165300, range_km: "70-110"}, {capacity: "60Ah", type: "regular", battery_price: 55000, total_price: 175800, range_km: "80-120"}, {capacity: "80Ah", type: "regular", battery_price: 59000, total_price: 179800, range_km: "90-150"}] }, tier: "standard" }, type: "bike", quantity: 1 },
  { id: "vipbike-g8-2", make: "VipBike", model: "G8-2", description: "Обновленная версия популярной модели G8. Двигатель 3000 Вт, скорость до 150 км/ч.", daily_price: 124400, image_url: `${CARPIX_BASE}/vipbike-g8-2/image_1.jpg`, rent_link: "/rent/vipbike-g8-2", specs: { type: "Electric", engine: "Электро", power_w: 3000, power_kw: 3, max_speed_kmh: "90-150", subtitle: "Электромотоцикл VipBike G8-2", bike_subtype: "Electric", gallery: [`${CARPIX_BASE}/vipbike-g8-2/image_1.jpg`, `${CARPIX_BASE}/vipbike-g8-2/image_2.jpg`, `${CARPIX_BASE}/vipbike-g8-2/image_3.jpg`], battery_options: { base_price: 124400, batteries: [{capacity: "50Ah", type: "regular", battery_price: 44500, total_price: 168900, range_km: "70-110"}, {capacity: "60Ah", type: "regular", battery_price: 55000, total_price: 179400, range_km: "80-120"}, {capacity: "80Ah", type: "regular", battery_price: 59000, total_price: 183400, range_km: "90-150"}] }, tier: "standard" }, type: "bike", quantity: 1 },
  { id: "vipbike-dmg", make: "VipBike", model: "DMG", description: "Премиальный электромотоцикл VipBike DMG с двигателем 3000 Вт.", daily_price: 159200, image_url: `${CARPIX_BASE}/vipbike-dmg/image_1.jpg`, rent_link: "/rent/vipbike-dmg", specs: { type: "Electric", engine: "Электро", power_w: 3000, power_kw: 3, max_speed_kmh: "90-150", subtitle: "Премиальный электромотоцикл VipBike DMG", bike_subtype: "Electric", gallery: [`${CARPIX_BASE}/vipbike-dmg/image_1.jpg`, `${CARPIX_BASE}/vipbike-dmg/image_2.jpg`, `${CARPIX_BASE}/vipbike-dmg/image_3.jpg`], battery_options: { base_price: 159200, batteries: [{capacity: "50Ah", type: "regular", battery_price: 44500, total_price: 203700, range_km: "70-110"}, {capacity: "60Ah", type: "regular", battery_price: 55000, total_price: 214200, range_km: "80-120"}, {capacity: "80Ah", type: "regular", battery_price: 59000, total_price: 218200, range_km: "90-150"}] }, tier: "premium" }, type: "bike", quantity: 1 },
  { id: "vipbike-dk", make: "VipBike", model: "DK", description: "Надежный городской байк с двигателем 3000 Вт. Скорость до 150 км/ч.", daily_price: 128000, image_url: `${CARPIX_BASE}/vipbike-dk/image_1.jpg`, rent_link: "/rent/vipbike-dk", specs: { type: "Electric", engine: "Электро", power_w: 3000, power_kw: 3, max_speed_kmh: "90-150", subtitle: "Электромотоцикл VipBike DK", bike_subtype: "Electric", gallery: [`${CARPIX_BASE}/vipbike-dk/image_1.jpg`, `${CARPIX_BASE}/vipbike-dk/image_2.jpg`, `${CARPIX_BASE}/vipbike-dk/image_3.jpg`], battery_options: { base_price: 128000, batteries: [{capacity: "50Ah", type: "regular", battery_price: 44500, total_price: 172500, range_km: "70-110"}, {capacity: "60Ah", type: "regular", battery_price: 55000, total_price: 183000, range_km: "80-120"}, {capacity: "80Ah", type: "regular", battery_price: 59000, total_price: 187000, range_km: "90-150"}] }, tier: "mid-range" }, type: "bike", quantity: 1 },
  { id: "vipbike-r1", make: "VipBike", model: "R1", description: "Стильный городской байк с двигателем 3000 Вт. Спортивный дизайн.", daily_price: 124400, image_url: `${CARPIX_BASE}/vipbike-r1/image_1.jpg`, rent_link: "/rent/vipbike-r1", specs: { type: "Electric", engine: "Электро", power_w: 3000, power_kw: 3, max_speed_kmh: "90-150", subtitle: "Электромотоцикл VipBike R1", bike_subtype: "Electric", gallery: [`${CARPIX_BASE}/vipbike-r1/image_1.jpg`, `${CARPIX_BASE}/vipbike-r1/image_2.jpg`, `${CARPIX_BASE}/vipbike-r1/image_3.jpg`], battery_options: { base_price: 124400, batteries: [{capacity: "50Ah", type: "regular", battery_price: 44500, total_price: 168900, range_km: "70-110"}, {capacity: "60Ah", type: "regular", battery_price: 55000, total_price: 179400, range_km: "80-120"}, {capacity: "80Ah", type: "regular", battery_price: 59000, total_price: 183400, range_km: "90-150"}] }, tier: "standard" }, type: "bike", quantity: 1 },
  { id: "vipbike-r2", make: "VipBike", model: "R2", description: "Второе поколение популярной R-серии. Улучшенная аэродинамика.", daily_price: 124400, image_url: `${CARPIX_BASE}/vipbike-r2/image_1.jpg`, rent_link: "/rent/vipbike-r2", specs: { type: "Electric", engine: "Электро", power_w: 3000, power_kw: 3, max_speed_kmh: "90-150", subtitle: "Электромотоцикл VipBike R2", bike_subtype: "Electric", gallery: [`${CARPIX_BASE}/vipbike-r2/image_1.jpg`, `${CARPIX_BASE}/vipbike-r2/image_2.jpg`, `${CARPIX_BASE}/vipbike-r2/image_3.jpg`], battery_options: { base_price: 124400, batteries: [{capacity: "50Ah", type: "regular", battery_price: 44500, total_price: 168900, range_km: "70-110"}, {capacity: "60Ah", type: "regular", battery_price: 55000, total_price: 179400, range_km: "80-120"}, {capacity: "80Ah", type: "regular", battery_price: 59000, total_price: 183400, range_km: "90-150"}] }, tier: "standard" }, type: "bike", quantity: 1 },
  { id: "vipbike-r3", make: "VipBike", model: "R3", description: "Доступный городской байк с двигателем 3000 Вт. Отличное соотношение цены и качества.", daily_price: 114800, image_url: `${CARPIX_BASE}/vipbike-r3/image_1.jpg`, rent_link: "/rent/vipbike-r3", specs: { type: "Electric", engine: "Электро", power_w: 3000, power_kw: 3, max_speed_kmh: "90-150", subtitle: "Электромотоцикл VipBike R3", bike_subtype: "Electric", gallery: [`${CARPIX_BASE}/vipbike-r3/image_1.jpg`, `${CARPIX_BASE}/vipbike-r3/image_2.jpg`, `${CARPIX_BASE}/vipbike-r3/image_3.jpg`], battery_options: { base_price: 114800, batteries: [{capacity: "50Ah", type: "regular", battery_price: 44500, total_price: 159300, range_km: "70-110"}, {capacity: "60Ah", type: "regular", battery_price: 55000, total_price: 169800, range_km: "80-120"}, {capacity: "80Ah", type: "regular", battery_price: 59000, total_price: 173800, range_km: "90-150"}] }, tier: "budget" }, type: "bike", quantity: 1 },
  { id: "vipbike-r6", make: "VipBike", model: "R6", description: "Спортивный электромотоцикл с агрессивным дизайном.", daily_price: 148400, image_url: `${CARPIX_BASE}/vipbike-r6/image_1.jpg`, rent_link: "/rent/vipbike-r6", specs: { type: "Electric", engine: "Электро", power_w: 3000, power_kw: 3, max_speed_kmh: "90-150", subtitle: "Спортивный электромотоцикл VipBike R6", bike_subtype: "Electric", gallery: [`${CARPIX_BASE}/vipbike-r6/image_1.jpg`, `${CARPIX_BASE}/vipbike-r6/image_2.jpg`, `${CARPIX_BASE}/vipbike-r6/image_3.jpg`], battery_options: { base_price: 148400, batteries: [{capacity: "50Ah", type: "regular", battery_price: 44500, total_price: 192900, range_km: "70-110"}, {capacity: "60Ah", type: "regular", battery_price: 55000, total_price: 203400, range_km: "80-120"}, {capacity: "80Ah", type: "regular", battery_price: 59000, total_price: 207400, range_km: "90-150"}] }, tier: "sport" }, type: "bike", quantity: 1 },
  { id: "vipbike-rz", make: "VipBike", model: "RZ", description: "Бюджетный электромотоцикл с двигателем 3000 Вт. Компактный и надежный.", daily_price: 112400, image_url: `${CARPIX_BASE}/vipbike-rz/image_1.jpg`, rent_link: "/rent/vipbike-rz", specs: { type: "Electric", engine: "Электро", power_w: 3000, power_kw: 3, max_speed_kmh: "90-150", subtitle: "Электромотоцикл VipBike RZ", bike_subtype: "Electric", gallery: [`${CARPIX_BASE}/vipbike-rz/image_1.jpg`, `${CARPIX_BASE}/vipbike-rz/image_2.jpg`, `${CARPIX_BASE}/vipbike-rz/image_3.jpg`], battery_options: { base_price: 112400, batteries: [{capacity: "50Ah", type: "regular", battery_price: 44500, total_price: 156900, range_km: "70-110"}, {capacity: "60Ah", type: "regular", battery_price: 55000, total_price: 167400, range_km: "80-120"}, {capacity: "80Ah", type: "regular", battery_price: 59000, total_price: 171400, range_km: "90-150"}] }, tier: "budget" }, type: "bike", quantity: 1 },
  { id: "vipbike-v6", make: "VipBike", model: "V6", description: "Классический дизайн в современном исполнении. Надежный и комфортный.", daily_price: 114800, image_url: `${CARPIX_BASE}/vipbike-v6/image_1.jpg`, rent_link: "/rent/vipbike-v6", specs: { type: "Electric", engine: "Электро", power_w: 3000, power_kw: 3, max_speed_kmh: "90-150", subtitle: "Электромотоцикл VipBike V6", bike_subtype: "Electric", gallery: [`${CARPIX_BASE}/vipbike-v6/image_1.jpg`, `${CARPIX_BASE}/vipbike-v6/image_2.jpg`, `${CARPIX_BASE}/vipbike-v6/image_3.jpg`], battery_options: { base_price: 114800, batteries: [{capacity: "50Ah", type: "regular", battery_price: 44500, total_price: 159300, range_km: "70-110"}, {capacity: "60Ah", type: "regular", battery_price: 55000, total_price: 169800, range_km: "80-120"}, {capacity: "80Ah", type: "regular", battery_price: 59000, total_price: 173800, range_km: "90-150"}] }, tier: "budget" }, type: "bike", quantity: 1 },
  { id: "vipbike-jy", make: "VipBike", model: "JY", description: "Оригинальный дизайн, хорошая комплектация. Подходит для города и пригорода.", daily_price: 128000, image_url: `${CARPIX_BASE}/vipbike-jy/image_1.jpg`, rent_link: "/rent/vipbike-jy", specs: { type: "Electric", engine: "Электро", power_w: 3000, power_kw: 3, max_speed_kmh: "90-150", subtitle: "Электромотоцикл VipBike JY", bike_subtype: "Electric", gallery: [`${CARPIX_BASE}/vipbike-jy/image_1.jpg`, `${CARPIX_BASE}/vipbike-jy/image_2.jpg`, `${CARPIX_BASE}/vipbike-jy/image_3.jpg`], battery_options: { base_price: 128000, batteries: [{capacity: "50Ah", type: "regular", battery_price: 44500, total_price: 172500, range_km: "70-110"}, {capacity: "60Ah", type: "regular", battery_price: 55000, total_price: 183000, range_km: "80-120"}, {capacity: "80Ah", type: "regular", battery_price: 59000, total_price: 187000, range_km: "90-150"}] }, tier: "mid-range" }, type: "bike", quantity: 1 },
  { id: "vipbike-xf", make: "VipBike", model: "XF", description: "Динамичный дизайн, отличные ходовые качества.", daily_price: 120800, image_url: `${CARPIX_BASE}/vipbike-xf/image_1.jpg`, rent_link: "/rent/vipbike-xf", specs: { type: "Electric", engine: "Электро", power_w: 3000, power_kw: 3, max_speed_kmh: "90-150", subtitle: "Электромотоцикл VipBike XF", bike_subtype: "Electric", gallery: [`${CARPIX_BASE}/vipbike-xf/image_1.jpg`, `${CARPIX_BASE}/vipbike-xf/image_2.jpg`, `${CARPIX_BASE}/vipbike-xf/image_3.jpg`], battery_options: { base_price: 120800, batteries: [{capacity: "50Ah", type: "regular", battery_price: 44500, total_price: 165300, range_km: "70-110"}, {capacity: "60Ah", type: "regular", battery_price: 55000, total_price: 175800, range_km: "80-120"}, {capacity: "80Ah", type: "regular", battery_price: 59000, total_price: 179800, range_km: "90-150"}] }, tier: "standard" }, type: "bike", quantity: 1 },
  { id: "vipbike-z1000", make: "VipBike", model: "Z1000", description: "Мощный дизайн в стиле японских стритфайтеров.", daily_price: 128000, image_url: `${CARPIX_BASE}/vipbike-z1000/image_1.jpg`, rent_link: "/rent/vipbike-z1000", specs: { type: "Electric", engine: "Электро", power_w: 3000, power_kw: 3, max_speed_kmh: "90-150", subtitle: "Электромотоцикл VipBike Z1000", bike_subtype: "Electric", gallery: [`${CARPIX_BASE}/vipbike-z1000/image_1.jpg`, `${CARPIX_BASE}/vipbike-z1000/image_2.jpg`, `${CARPIX_BASE}/vipbike-z1000/image_3.jpg`], battery_options: { base_price: 128000, batteries: [{capacity: "50Ah", type: "regular", battery_price: 44500, total_price: 172500, range_km: "70-110"}, {capacity: "60Ah", type: "regular", battery_price: 55000, total_price: 183000, range_km: "80-120"}, {capacity: "80Ah", type: "regular", battery_price: 59000, total_price: 187000, range_km: "90-150"}] }, tier: "mid-range" }, type: "bike", quantity: 1 },
  { id: "vipbike-dn", make: "VipBike", model: "DN", description: "Агрессивный нейкед-стиль, спортивная посадка.", daily_price: 148400, image_url: `${CARPIX_BASE}/vipbike-dn/image_1.jpg`, rent_link: "/rent/vipbike-dn", specs: { type: "Electric", engine: "Электро", power_w: 3000, power_kw: 3, max_speed_kmh: "90-150", subtitle: "Спортивный электромотоцикл VipBike DN", bike_subtype: "Electric", gallery: [`${CARPIX_BASE}/vipbike-dn/image_1.jpg`, `${CARPIX_BASE}/vipbike-dn/image_2.jpg`, `${CARPIX_BASE}/vipbike-dn/image_3.jpg`], battery_options: { base_price: 148400, batteries: [{capacity: "50Ah", type: "regular", battery_price: 44500, total_price: 192900, range_km: "70-110"}, {capacity: "60Ah", type: "regular", battery_price: 55000, total_price: 203400, range_km: "80-120"}, {capacity: "80Ah", type: "regular", battery_price: 59000, total_price: 207400, range_km: "90-150"}] }, tier: "sport" }, type: "bike", quantity: 1 },
  { id: "vipbike-a4", make: "VipBike", model: "A4", description: "Флагманский электромотоцикл с двигателем 10000 Вт. Премиальная комплектация.", daily_price: 490000, image_url: `${CARPIX_BASE}/vipbike-a4/image_1.jpg`, rent_link: "/rent/vipbike-a4", specs: { type: "Electric", engine: "Электро", power_w: 10000, power_kw: 10, max_speed_kmh: "150+", subtitle: "Флагманский электромотоцикл VipBike A4", bike_subtype: "Electric", gallery: [`${CARPIX_BASE}/vipbike-a4/image_1.jpg`, `${CARPIX_BASE}/vipbike-a4/image_2.jpg`, `${CARPIX_BASE}/vipbike-a4/image_3.jpg`], battery_options: { base_price: 490000, batteries: [{capacity: "Included", type: "lithium", battery_price: 0, total_price: 490000, range_km: "200+"}] }, tier: "high-performance" }, type: "bike", quantity: 1 }
]

// Accessories with images
const accessories: Accessory[] = [
  { id: 'helmet', name: 'Мотошлем', price: 4200, description: 'Качественный мотошлем', category: 'safety', image_url: `${CARPIX_BASE}/parts/helmet.jpg` },
  { id: 'helmet-e4', name: 'Шлем E4 (Tensun)', price: 8300, description: 'Премиальный шлем Tensun E4', category: 'safety', image_url: `${CARPIX_BASE}/parts/helmet_e4.jpg` },
  { id: 'abs', name: 'ABS система', price: 16700, description: 'Система антиблокировки тормозов', category: 'safety', image_url: `${CARPIX_BASE}/parts/abs_system.jpg` },
  { id: 'cbs', name: 'Система CBS', price: 4200, description: 'Combi Brake System', category: 'safety', image_url: `${CARPIX_BASE}/parts/cbs_system.jpg` },
  { id: 'brembo', name: 'Тормоза Brembo', price: 12400, description: 'Премиальные тормоза', category: 'performance', image_url: `${CARPIX_BASE}/parts/brembo_brakes.jpg` },
  { id: 'tft', name: 'TFT дисплей', price: 8300, description: 'Цифровой дисплей', category: 'electronics', image_url: `${CARPIX_BASE}/parts/tft_display.jpg` },
  { id: 'alarm', name: 'Противоугонная Bluetooth', price: 5600, description: 'Сигнализация с отслеживанием', category: 'security', image_url: `${CARPIX_BASE}/parts/bluetooth_alarm.jpg` },
  { id: 'footpegs', name: 'CNC подножки', price: 9700, description: 'Алюминиевые подножки', category: 'accessories', image_url: `${CARPIX_BASE}/parts/cnc_footpegs.jpg` },
  { id: 'front-shock', name: 'Амортизатор передний', price: 38600, description: 'Передний амортизатор', category: 'suspension', image_url: `${CARPIX_BASE}/parts/front_shock.jpg` },
  { id: 'rear-shock', name: 'Амортизатор задний', price: 16500, description: 'Задний амортизатор', category: 'suspension', image_url: `${CARPIX_BASE}/parts/rear_shock.jpg` },
]

// Lithium batteries
const lithiumBatteries = [
  { capacity: "50Ah", price: 82000, range_km: "70-110" },
  { capacity: "60Ah", price: 90000, range_km: "80-120" },
  { capacity: "80Ah", price: 98000, range_km: "90-150" },
  { capacity: "120Ah", price: 106000, range_km: "120-220" },
  { capacity: "160Ah", price: 106000, range_km: "160-260" }
]

// Tier config
const tierConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  budget: { label: "Бюджетный", variant: "secondary" },
  standard: { label: "Стандарт", variant: "outline" },
  "mid-range": { label: "Средний", variant: "default" },
  sport: { label: "Спорт", variant: "destructive" },
  premium: { label: "Премиум", variant: "default" },
  "high-performance": { label: "High-Perf", variant: "destructive" }
}

const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(price)
}

const getAccessoryIcon = (category: string) => {
  switch (category) {
    case 'safety': return <Shield className="h-4 w-4" />
    case 'performance': return <Wrench className="h-4 w-4" />
    default: return <Plus className="h-4 w-4" />
  }
}

export default function ConfiguratorPage() {
  const { toast } = useToast()
  const [selectedBike, setSelectedBike] = useState<Motorcycle | null>(null)
  const [selectedBattery, setSelectedBattery] = useState<BatteryOption | null>(null)
  const [useLithium, setUseLithium] = useState(false)
  const [selectedLithiumBattery, setSelectedLithiumBattery] = useState<typeof lithiumBatteries[0] | null>(null)
  const [priceRange, setPriceRange] = useState([100000, 500000])
  const [selectedTier, setSelectedTier] = useState<string>('all')
  const [selectedAccessories, setSelectedAccessories] = useState<string[]>([])
  const [step, setStep] = useState(1)

  const filteredBikes = useMemo(() => {
    return motorcycles.filter(bike => {
      const priceMatch = bike.daily_price >= priceRange[0] && bike.daily_price <= priceRange[1]
      const tierMatch = selectedTier === 'all' || bike.specs.tier === selectedTier
      return priceMatch && tierMatch
    })
  }, [priceRange, selectedTier])

  const totalPrice = useMemo(() => {
    if (!selectedBike) return 0
    let total = selectedBike.daily_price
    if (selectedBike.model !== 'A4') {
      if (useLithium && selectedLithiumBattery) total += selectedLithiumBattery.price
      else if (selectedBattery) total = selectedBattery.total_price
    }
    selectedAccessories.forEach(accId => {
      const acc = accessories.find(a => a.id === accId)
      if (acc) total += acc.price
    })
    return total
  }, [selectedBike, selectedBattery, useLithium, selectedLithiumBattery, selectedAccessories])

  const handleSelectBike = (bike: Motorcycle) => {
    setSelectedBike(bike)
    setSelectedBattery(null)
    setSelectedLithiumBattery(null)
    setSelectedAccessories([])
    setStep(bike.model !== 'A4' ? 2 : 3)
    toast({ title: "Мотоцикл выбран", description: `Выбран ${bike.make} ${bike.model}` })
  }

  const toggleAccessory = (accId: string) => {
    setSelectedAccessories(prev => prev.includes(accId) ? prev.filter(id => id !== accId) : [...prev, accId])
  }

  const goToStep = (targetStep: number) => {
    if (targetStep < step) setStep(targetStep)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white overflow-x-hidden">
      {/* Header 
      <header className="border-b border-gray-800 bg-gray-950/95 backdrop-blur-md sticky top-0 z-50 w-full">
        <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2.5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg sm:rounded-xl shadow-lg shadow-emerald-500/20">
                <Bike className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold tracking-tight">VipBike</h1>
                <p className="text-[10px] sm:text-xs text-gray-400 hidden sm:block">Конфигуратор электромотоциклов</p>
              </div>
            </div>
            <Badge variant="outline" className="text-emerald-400 border-emerald-500/50 bg-emerald-500/10 text-xs">
              ООО "Вип Байк"
            </Badge>
          </div>
        </div>
      </header>*/}

      <main className="w-full max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
        {/* Progress Steps - Electric Glow */}
        <div className="mb-6 sm:mb-8 lg:mb-10">
          <div className="flex items-center justify-center gap-1 sm:gap-2 mb-3 sm:mb-4">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex items-center">
                <button
                  onClick={() => goToStep(s)}
                  disabled={s > step}
                  className={`
                    relative w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 rounded-full flex items-center justify-center font-bold text-sm sm:text-base lg:text-lg
                    transition-all duration-500 ease-out
                    ${step === s 
                      ? 'bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-600 text-white shadow-[0_0_20px_rgba(16,185,129,0.6),0_0_40px_rgba(16,185,129,0.3)] animate-pulse' 
                      : step > s 
                        ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30' 
                        : 'bg-gray-800 text-gray-500 border border-gray-700'}
                    ${s <= step ? 'cursor-pointer hover:scale-110' : 'cursor-not-allowed'}
                  `}
                >
                  {step > s ? <Check className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6" /> : s}
                  {step === s && (
                    <span className="absolute inset-0 rounded-full bg-emerald-400/30 animate-ping" />
                  )}
                </button>
                {s < 4 && (
                  <div className={`w-12 sm:w-16 lg:w-20 h-0.5 sm:h-1 mx-0.5 rounded-full transition-all duration-500 ${step > s ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 'bg-gray-800'}`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-4 sm:gap-6 lg:gap-8 text-xs sm:text-sm font-medium">
            <span className={`${step >= 1 ? 'text-emerald-400' : 'text-gray-500'} transition-colors`}>Модель</span>
            <span className={`${step >= 2 ? 'text-emerald-400' : 'text-gray-500'} transition-colors`}>Аккумулятор</span>
            <span className={`${step >= 3 ? 'text-emerald-400' : 'text-gray-500'} transition-colors`}>Допы</span>
            <span className={`${step >= 4 ? 'text-emerald-400' : 'text-gray-500'} transition-colors`}>Итого</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 min-w-0">
            {step === 1 && (
              <div>
                {/* Filters */}
                <Card className="bg-gray-900/80 border-gray-800 mb-4 sm:mb-6 backdrop-blur-sm">
                  <CardHeader className="pb-2 sm:pb-3">
                    <CardTitle className="text-base sm:text-lg text-gray-100">Фильтры</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                      <div>
                        <Label className="text-gray-300 mb-2 sm:mb-3 block text-xs sm:text-sm font-medium">
                          {formatPrice(priceRange[0])} — {formatPrice(priceRange[1])}
                        </Label>
                        <Slider value={priceRange} onValueChange={setPriceRange} min={100000} max={500000} step={10000} className="w-full" />
                      </div>
                      <div>
                        <Label className="text-gray-300 mb-2 sm:mb-3 block text-xs sm:text-sm font-medium">Класс</Label>
                        <Select value={selectedTier} onValueChange={setSelectedTier}>
                          <SelectTrigger className="bg-gray-800 border-gray-700 text-gray-100 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent className="bg-gray-800 border-gray-700 text-gray-100">
                            <SelectItem value="all">Все классы</SelectItem>
                            <SelectItem value="budget">Бюджетный</SelectItem>
                            <SelectItem value="standard">Стандарт</SelectItem>
                            <SelectItem value="sport">Спорт</SelectItem>
                            <SelectItem value="premium">Премиум</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Motorcycle Grid - Responsive 1/2/3 columns */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 lg:gap-5">
                  {filteredBikes.map((bike) => (
                    <Card 
                      key={bike.id}
                      className={`bg-gray-900/80 border-gray-800 cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:border-emerald-500/50 hover:shadow-xl hover:shadow-emerald-500/10 ${selectedBike?.id === bike.id ? 'ring-2 ring-emerald-500 border-emerald-500 shadow-lg shadow-emerald-500/20' : ''} backdrop-blur-sm overflow-hidden`}
                      onClick={() => handleSelectBike(bike)}
                    >
                      <div className="relative">
                        <img src={bike.image_url} alt={`${bike.make} ${bike.model}`} className="w-full h-32 sm:h-36 lg:h-44 object-cover" onError={(e) => { (e.target as HTMLImageElement).src = `https://placehold.co/600x400/1a1a2e/ffffff?text=${bike.model}` }} />
                        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent" />
                        <Badge className="absolute top-2 right-2 text-[10px] sm:text-xs" variant={tierConfig[bike.specs.tier]?.variant || 'default'}>{tierConfig[bike.specs.tier]?.label}</Badge>
                        {bike.model === 'A4' && <Badge className="absolute top-2 left-2 bg-amber-500 text-black text-[10px] sm:text-xs"><Star className="h-3 w-3 mr-1" />Премиум</Badge>}
                      </div>
                      <CardHeader className="pb-1 sm:pb-2 pt-3 sm:pt-4 px-3 sm:px-4">
                        <CardTitle className="text-sm sm:text-base lg:text-lg text-gray-100">{bike.make} {bike.model}</CardTitle>
                        <CardDescription className="text-gray-400 line-clamp-2 text-xs sm:text-sm">{bike.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="pb-2 sm:pb-3 px-3 sm:px-4">
                        <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-center text-[10px] sm:text-xs">
                          <div className="bg-gray-800/80 rounded p-1.5 sm:p-2.5"><Zap className="h-3 w-3 sm:h-4 sm:w-4 mx-auto mb-0.5 sm:mb-1 text-emerald-400" /><span className="text-gray-300 font-medium">{bike.specs.power_kw} кВт</span></div>
                          <div className="bg-gray-800/80 rounded p-1.5 sm:p-2.5"><Gauge className="h-3 w-3 sm:h-4 sm:w-4 mx-auto mb-0.5 sm:mb-1 text-emerald-400" /><span className="text-gray-300 font-medium">{bike.specs.max_speed_kmh}</span></div>
                          <div className="bg-gray-800/80 rounded p-1.5 sm:p-2.5"><MapPin className="h-3 w-3 sm:h-4 sm:w-4 mx-auto mb-0.5 sm:mb-1 text-emerald-400" /><span className="text-gray-300 font-medium">150 км</span></div>
                        </div>
                      </CardContent>
                      <CardFooter className="pt-0 pb-3 sm:pb-4 px-3 sm:px-4">
                        <div className="w-full flex items-end justify-between">
                          <div>
                            <div className="text-lg sm:text-xl lg:text-2xl font-bold text-emerald-400">{formatPrice(bike.daily_price)}</div>
                            <div className="text-[10px] sm:text-xs text-gray-500">без аккумулятора</div>
                          </div>
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-xs sm:text-sm">Выбрать</Button>
                        </div>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {step === 2 && selectedBike && (
              <div>
                <Button variant="outline" onClick={() => setStep(1)} className="mb-4 sm:mb-6 border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800 hover:border-gray-600 text-sm font-medium">
                  <ArrowRight className="h-4 w-4 mr-2 rotate-180" />Назад
                </Button>
                <Card className="bg-gray-900/80 border-gray-800 backdrop-blur-sm">
                  <CardHeader className="border-b border-gray-800">
                    <CardTitle className="flex items-center gap-2 sm:gap-3 text-gray-100 text-base sm:text-lg">
                      <Battery className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-400" />Выбор аккумулятора
                    </CardTitle>
                    <CardDescription className="text-gray-400 text-xs sm:text-sm">{selectedBike.make} {selectedBike.model}</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4 sm:pt-6">
                    <Tabs defaultValue="regular" onValueChange={(v) => setUseLithium(v === 'lithium')}>
                      <TabsList className="grid w-full grid-cols-2 mb-4 sm:mb-6 bg-gray-800 text-xs sm:text-sm">
                        <TabsTrigger value="regular" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Стандартные</TabsTrigger>
                        <TabsTrigger value="lithium" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Литиевые</TabsTrigger>
                      </TabsList>
                      <TabsContent value="regular">
                        <RadioGroup value={selectedBattery?.capacity || ''} onValueChange={(v) => { const battery = selectedBike.specs.battery_options.batteries.find(b => b.capacity === v); setSelectedBattery(battery || null) }}>
                          <div className="grid gap-2 sm:gap-3">
                            {selectedBike.specs.battery_options.batteries.map((battery) => (
                              <Label key={battery.capacity} htmlFor={battery.capacity} className={`flex items-center justify-between p-3 sm:p-4 rounded-xl cursor-pointer transition-all text-xs sm:text-sm ${selectedBattery?.capacity === battery.capacity ? 'border-2 border-emerald-500 bg-emerald-500/10' : 'border border-gray-700 hover:border-gray-600 bg-gray-800/50'}`}>
                                <div className="flex items-center gap-3 sm:gap-4">
                                  <RadioGroupItem value={battery.capacity} id={battery.capacity} className="border-gray-500" />
                                  <div><div className="font-semibold text-gray-100">{battery.capacity}</div><div className="text-gray-400">Запас хода: {battery.range_km} км</div></div>
                                </div>
                                <div className="text-right"><div className="font-bold text-emerald-400 text-sm sm:text-lg">+{formatPrice(battery.battery_price)}</div><div className="text-[10px] sm:text-xs text-gray-500">Итого: {formatPrice(battery.total_price)}</div></div>
                              </Label>
                            ))}
                          </div>
                        </RadioGroup>
                      </TabsContent>
                      <TabsContent value="lithium">
                        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 sm:p-4 mb-4 sm:mb-5">
                          <div className="flex items-center gap-2 text-emerald-400 text-xs sm:text-sm"><Plus className="h-4 w-4" /><span className="font-medium">Литиевые батареи легче и долговечнее</span></div>
                        </div>
                        <RadioGroup value={selectedLithiumBattery?.capacity || ''} onValueChange={(v) => { const battery = lithiumBatteries.find(b => b.capacity === v); setSelectedLithiumBattery(battery || null) }}>
                          <div className="grid gap-2 sm:gap-3">
                            {lithiumBatteries.map((battery) => (
                              <Label key={battery.capacity} htmlFor={`li-${battery.capacity}`} className={`flex items-center justify-between p-3 sm:p-4 rounded-xl cursor-pointer transition-all text-xs sm:text-sm ${selectedLithiumBattery?.capacity === battery.capacity ? 'border-2 border-emerald-500 bg-emerald-500/10' : 'border border-gray-700 hover:border-gray-600 bg-gray-800/50'}`}>
                                <div className="flex items-center gap-3 sm:gap-4">
                                  <RadioGroupItem value={battery.capacity} id={`li-${battery.capacity}`} className="border-gray-500" />
                                  <div><div className="font-semibold text-gray-100">{battery.capacity} (Li-ion)</div><div className="text-gray-400">Запас хода: {battery.range_km} км</div></div>
                                </div>
                                <div className="font-bold text-emerald-400 text-sm sm:text-lg">+{formatPrice(battery.price)}</div>
                              </Label>
                            ))}
                          </div>
                        </RadioGroup>
                      </TabsContent>
                    </Tabs>
                    {(selectedBattery || selectedLithiumBattery) && (
                      <Button className="w-full mt-4 sm:mt-8 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-sm sm:text-lg py-4 sm:py-6" onClick={() => setStep(3)}>
                        Продолжить<ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 ml-2" />
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {step === 3 && selectedBike && (
              <div>
                <Button variant="outline" onClick={() => setStep(selectedBike.model === 'A4' ? 1 : 2)} className="mb-4 sm:mb-6 border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800 hover:border-gray-600 text-sm font-medium">
                  <ArrowRight className="h-4 w-4 mr-2 rotate-180" />Назад
                </Button>
                <Card className="bg-gray-900/80 border-gray-800 backdrop-blur-sm">
                  <CardHeader className="border-b border-gray-800">
                    <CardTitle className="flex items-center gap-2 sm:gap-3 text-gray-100 text-base sm:text-lg">
                      <Plus className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-400" />Дополнительное оборудование
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 sm:pt-6">
                    <ScrollArea className="h-[300px] sm:h-[350px] lg:h-[400px] pr-2 sm:pr-4">
                      <div className="grid gap-2 sm:gap-3">
                        {accessories.map((acc) => (
                          <div key={acc.id} className={`flex items-center justify-between p-3 sm:p-4 rounded-xl cursor-pointer transition-all border text-xs sm:text-sm ${selectedAccessories.includes(acc.id) ? 'border-emerald-500 bg-emerald-500/10' : 'border-gray-700 hover:border-gray-600 bg-gray-800/50'}`} onClick={() => toggleAccessory(acc.id)}>
                            <div className="flex items-center gap-3 sm:gap-4">
                              <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center ${selectedAccessories.includes(acc.id) ? 'bg-emerald-500' : 'bg-gray-700'}`}>
                                {selectedAccessories.includes(acc.id) ? <Check className="h-4 w-4 sm:h-5 sm:w-5 text-white" /> : getAccessoryIcon(acc.category)}
                              </div>
                              <div><div className="font-semibold text-gray-100">{acc.name}</div><div className="text-gray-400 hidden sm:block">{acc.description}</div></div>
                            </div>
                            <div className="font-bold text-emerald-400 text-sm sm:text-lg">+{formatPrice(acc.price)}</div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                    <Button className="w-full mt-4 sm:mt-6 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-sm sm:text-lg py-4 sm:py-6" onClick={() => setStep(4)}>
                      Перейти к оформлению<ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 ml-2" />
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}

            {step === 4 && selectedBike && (
              <div>
                <Button variant="outline" onClick={() => setStep(3)} className="mb-4 sm:mb-6 border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800 hover:border-gray-600 text-sm font-medium">
                  <ArrowRight className="h-4 w-4 mr-2 rotate-180" />Назад
                </Button>
                <Card className="bg-gray-900/80 border-gray-800 backdrop-blur-sm shadow-xl shadow-black/20">
                  <CardHeader className="border-b border-gray-800">
                    <CardTitle className="flex items-center gap-2 sm:gap-3 text-white text-lg sm:text-xl font-bold">
                      <ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-400" />Ваша конфигурация
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 sm:pt-6 space-y-4 sm:space-y-6">
                    <div className="flex gap-3 sm:gap-4 p-3 sm:p-4 bg-gray-800/50 rounded-xl">
                      <img src={selectedBike.image_url} alt={selectedBike.model} className="w-20 h-14 sm:w-28 sm:h-20 object-cover rounded-lg" onError={(e) => { (e.target as HTMLImageElement).src = `https://placehold.co/600x400/1a1a2e/ffffff?text=${selectedBike.model}` }} />
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base sm:text-lg font-bold text-gray-100">{selectedBike.make} {selectedBike.model}</h3>
                        <Badge variant={tierConfig[selectedBike.specs.tier]?.variant || 'default'} className="mt-1 text-[10px] sm:text-xs">{tierConfig[selectedBike.specs.tier]?.label}</Badge>
                        <div className="text-xs sm:text-sm text-gray-400 mt-1 sm:mt-2">{selectedBike.specs.power_kw} кВт • {selectedBike.specs.max_speed_kmh} км/ч</div>
                      </div>
                    </div>
                    <Separator className="bg-gray-700" />
                    {selectedBike.model !== 'A4' && (
                      <>
                        <div className="space-y-2 sm:space-y-3 text-xs sm:text-sm">
                          <div className="flex justify-between"><span className="text-gray-400">Базовая цена:</span><span className="text-gray-100 font-medium">{formatPrice(selectedBike.daily_price)}</span></div>
                          <div className="flex justify-between"><span className="text-gray-400">Аккумулятор:</span><span className="text-gray-100 font-medium">{useLithium && selectedLithiumBattery ? `${selectedLithiumBattery.capacity} (Li-ion)` : selectedBattery?.capacity || 'Не выбран'}</span></div>
                          <div className="flex justify-between"><span className="text-gray-400">Стоимость:</span><span className="text-emerald-400 font-medium">+{formatPrice(useLithium && selectedLithiumBattery ? selectedLithiumBattery.price : (selectedBattery?.battery_price || 0))}</span></div>
                        </div>
                        <Separator className="bg-gray-700" />
                      </>
                    )}
                    {selectedBike.model === 'A4' && (
                      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 sm:p-4">
                        <div className="flex items-center gap-2 text-emerald-400 text-xs sm:text-sm"><Star className="h-4 w-4" /><span className="font-medium">Включает премиальный литиевый аккумулятор</span></div>
                      </div>
                    )}
                    {selectedAccessories.length > 0 && (
                      <>
                        <div>
                          <h4 className="text-xs sm:text-sm font-medium text-gray-300 mb-2 sm:mb-3">Доп. оборудование:</h4>
                          <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">{selectedAccessories.map(accId => { const acc = accessories.find(a => a.id === accId); return acc ? <div key={accId} className="flex justify-between"><span className="text-gray-400">{acc.name}</span><span className="text-gray-100">+{formatPrice(acc.price)}</span></div> : null })}</div>
                        </div>
                        <Separator className="bg-gray-700" />
                      </>
                    )}
                    <div className="bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 rounded-xl p-4 sm:p-5">
                      <div className="flex justify-between items-center">
                        <span className="text-base sm:text-lg font-medium text-gray-200">Итого:</span>
                        <span className="text-2xl sm:text-3xl font-bold text-emerald-400">{formatPrice(totalPrice)}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:gap-4 pt-2">
                      <Button variant="outline" className="border-gray-500 text-gray-200 hover:text-white hover:bg-gray-700 hover:border-gray-400 py-4 sm:py-6 text-xs sm:text-sm font-medium" onClick={() => { setSelectedBike(null); setSelectedBattery(null); setSelectedLithiumBattery(null); setSelectedAccessories([]); setUseLithium(false); setStep(1) }}>Начать заново</Button>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 py-4 sm:py-6 text-xs sm:text-sm sm:text-lg">Оформить заказ</Button>
                        </DialogTrigger>
                        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-[90vw] sm:max-w-md">
                          <DialogHeader>
                            <DialogTitle className="text-lg sm:text-xl">Связаться с нами</DialogTitle>
                            <DialogDescription className="text-gray-400 text-xs sm:text-sm">Для оформления заказа свяжитесь с нами</DialogDescription>
                          </DialogHeader>
                          <div className="space-y-3 sm:space-y-4 py-3 sm:py-4">
                            <a href="tel:+79200789888" className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-gray-800/50 rounded-xl hover:bg-gray-800 transition-colors">
                              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center"><Phone className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-400" /></div>
                              <div><div className="font-medium text-gray-100 text-sm sm:text-base">Телефон</div><div className="text-xs sm:text-sm text-gray-400">+7 920 078-98-88</div></div>
                            </a>
                            <a href="https://t.me/I_O_S_NN" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-gray-800/50 rounded-xl hover:bg-gray-800 transition-colors">
                              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center"><MessageCircle className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-400" /></div>
                              <div><div className="font-medium text-gray-100 text-sm sm:text-base">Telegram</div><div className="text-xs sm:text-sm text-gray-400">@I_O_S_NN</div></div>
                            </a>
                            <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-gray-800/50 rounded-xl">
                              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center"><MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-400" /></div>
                              <div><div className="font-medium text-gray-100 text-sm sm:text-base">Адрес</div><div className="text-xs sm:text-sm text-gray-400">г. Нижний Новгород, Комсомольская пл. 2</div></div>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>

          {/* Sidebar - Hidden on mobile, shown on lg */}
          <div className="hidden lg:block lg:col-span-1">
            <div className="sticky top-28 space-y-4">
              <Card className="bg-gray-900/80 border-gray-800 backdrop-blur-sm">
                <CardHeader className="pb-3 border-b border-gray-800">
                  <CardTitle className="text-lg text-gray-100">Сводка заказа</CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  {selectedBike ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-xl">
                        <img src={selectedBike.image_url} alt={selectedBike.model} className="w-16 h-12 object-cover rounded-lg" onError={(e) => { (e.target as HTMLImageElement).src = `https://placehold.co/600x400/1a1a2e/ffffff?text=${selectedBike.model}` }} />
                        <div><div className="font-medium text-gray-100">{selectedBike.make} {selectedBike.model}</div><div className="text-xs text-gray-400">{selectedBike.specs.power_kw} кВт • {selectedBike.specs.max_speed_kmh} км/ч</div></div>
                      </div>
                      {selectedBike.model !== 'A4' && (
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between"><span className="text-gray-400">Аккумулятор:</span><span className="text-gray-100">{useLithium && selectedLithiumBattery ? `${selectedLithiumBattery.capacity} Li-ion` : selectedBattery?.capacity || 'Не выбран'}</span></div>
                          {((useLithium && selectedLithiumBattery) || selectedBattery) && <div className="flex justify-between"><span className="text-gray-400">Запас хода:</span><span className="text-gray-100">{useLithium && selectedLithiumBattery ? selectedLithiumBattery.range_km : selectedBattery?.range_km} км</span></div>}
                        </div>
                      )}
                      {selectedAccessories.length > 0 && (
                        <div className="pt-2 border-t border-gray-800">
                          <div className="text-xs text-gray-400 mb-2">Допы ({selectedAccessories.length})</div>
                          <div className="flex flex-wrap gap-1">{selectedAccessories.map(accId => { const acc = accessories.find(a => a.id === accId); return acc ? <Badge key={accId} variant="outline" className="text-xs border-gray-700 text-gray-300">{acc.name}</Badge> : null })}</div>
                        </div>
                      )}
                      <div className="pt-3 border-t border-gray-800">
                        <div className="flex justify-between items-center"><span className="text-gray-300 font-medium">Итого:</span><span className="text-xl font-bold text-emerald-400">{formatPrice(totalPrice)}</span></div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 mx-auto mb-4 bg-gray-800 rounded-xl flex items-center justify-center"><Bike className="h-8 w-8 text-gray-600" /></div>
                      <p className="text-gray-500 text-sm">Выберите мотоцикл</p>
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card className="bg-gray-900/80 border-gray-800 backdrop-blur-sm">
                <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-gray-300">Контакты</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3 text-sm"><Phone className="h-4 w-4 text-emerald-400" /><span className="text-gray-300">+7 920 078-98-88</span></div>
                  <div className="flex items-center gap-3 text-sm"><MessageCircle className="h-4 w-4 text-emerald-400" /><span className="text-gray-300">@I_O_S_NN</span></div>
                  <div className="flex items-center gap-3 text-sm"><MapPin className="h-4 w-4 text-emerald-400" /><span className="text-gray-300">Нижний Новгород</span></div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      {/* Footer
      <footer className="border-t border-gray-800 mt-12 sm:mt-16 py-6 sm:py-8 bg-gray-950/80">
        <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 text-center">
          <p className="text-gray-400 text-xs sm:text-sm">ООО "Вип Байк" • г. Нижний Новгород, Комсомольская пл. 2</p>
          <p className="text-gray-600 text-[10px] sm:text-xs mt-1 sm:mt-2">Данные извлечены из прайс-листа "Электромотоциклы ВипБайк"</p>
        </div>
      </footer> */}

      {/*<Toaster />*/}
    </div>
  )
}
