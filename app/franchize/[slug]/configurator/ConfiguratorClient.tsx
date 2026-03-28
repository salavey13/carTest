'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { Battery, Check, Gauge, MessageCircle, Shield, Truck, Wrench, Zap } from 'lucide-react'

import { type FranchizeCrewVM } from '../../actions'
import { catalogCardVariantStyles, crewPaletteForSurface, interactionRingStyle } from '../../lib/theme'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'

import { loadConfiguratorCatalog, sendConfiguratorLead, type ConfiguratorBatteryOption, type ConfiguratorBike, type ConfiguratorPart } from './actions_configurator'

const DELIVERY_AVERAGE = 95_000
const CARPIX_BASE = 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix'
const formatPrice = (price: number) => `${price.toLocaleString('ru-RU')} ₽`

const fallbackBikes: ConfiguratorBike[] = [
  { id: 'vipbike-g8', make: 'VipBike', model: 'G8', description: 'Электромотоцикл VipBike G8 с мощным двигателем 3000 Вт и максимальной скоростью до 150 км/ч.', daily_price: 120800, image_url: `${CARPIX_BASE}/vipbike-g8/image_1.jpg`, rent_link: '/rent/vipbike-g8', specs: { power_w: 3000, power_kw: 3, max_speed_kmh: '90-150', subtitle: 'Электромотоцикл VipBike G8', tier: 'standard', gallery: [`${CARPIX_BASE}/vipbike-g8/image_1.jpg`, `${CARPIX_BASE}/vipbike-g8/image_2.jpg`, `${CARPIX_BASE}/vipbike-g8/image_3.jpg`], battery_options: { base_price: 120800, batteries: [{ capacity: '50Ah', type: 'regular', battery_price: 44500, total_price: 165300, range_km: '70-110' }, { capacity: '60Ah', type: 'regular', battery_price: 55000, total_price: 175800, range_km: '80-120' }, { capacity: '80Ah', type: 'regular', battery_price: 59000, total_price: 179800, range_km: '90-150' }] } }, type: 'bike', quantity: 1 },
  { id: 'vipbike-g8-2', make: 'VipBike', model: 'G8-2', description: 'Обновленная версия популярной модели G8. Двигатель 3000 Вт, скорость до 150 км/ч.', daily_price: 124400, image_url: `${CARPIX_BASE}/vipbike-g8-2/image_1.jpg`, rent_link: '/rent/vipbike-g8-2', specs: { power_w: 3000, power_kw: 3, max_speed_kmh: '90-150', subtitle: 'Электромотоцикл VipBike G8-2', tier: 'standard', gallery: [`${CARPIX_BASE}/vipbike-g8-2/image_1.jpg`, `${CARPIX_BASE}/vipbike-g8-2/image_2.jpg`, `${CARPIX_BASE}/vipbike-g8-2/image_3.jpg`], battery_options: { base_price: 124400, batteries: [{ capacity: '50Ah', type: 'regular', battery_price: 44500, total_price: 168900, range_km: '70-110' }, { capacity: '60Ah', type: 'regular', battery_price: 55000, total_price: 179400, range_km: '80-120' }, { capacity: '80Ah', type: 'regular', battery_price: 59000, total_price: 183400, range_km: '90-150' }] } }, type: 'bike', quantity: 1 },
  { id: 'vipbike-dmg', make: 'VipBike', model: 'DMG', description: 'Премиальный электромотоцикл VipBike DMG с двигателем 3000 Вт.', daily_price: 159200, image_url: `${CARPIX_BASE}/vipbike-dmg/image_1.jpg`, rent_link: '/rent/vipbike-dmg', specs: { power_w: 3000, power_kw: 3, max_speed_kmh: '90-150', subtitle: 'Премиальный электромотоцикл VipBike DMG', tier: 'premium', gallery: [`${CARPIX_BASE}/vipbike-dmg/image_1.jpg`, `${CARPIX_BASE}/vipbike-dmg/image_2.jpg`, `${CARPIX_BASE}/vipbike-dmg/image_3.jpg`], battery_options: { base_price: 159200, batteries: [{ capacity: '50Ah', type: 'regular', battery_price: 44500, total_price: 203700, range_km: '70-110' }, { capacity: '60Ah', type: 'regular', battery_price: 55000, total_price: 214200, range_km: '80-120' }, { capacity: '80Ah', type: 'regular', battery_price: 59000, total_price: 218200, range_km: '90-150' }] } }, type: 'bike', quantity: 1 },
  { id: 'vipbike-dk', make: 'VipBike', model: 'DK', description: 'Надежный городской байк с двигателем 3000 Вт.', daily_price: 128000, image_url: `${CARPIX_BASE}/vipbike-dk/image_1.jpg`, rent_link: '/rent/vipbike-dk', specs: { power_w: 3000, power_kw: 3, max_speed_kmh: '90-150', tier: 'mid-range', gallery: [`${CARPIX_BASE}/vipbike-dk/image_1.jpg`, `${CARPIX_BASE}/vipbike-dk/image_2.jpg`, `${CARPIX_BASE}/vipbike-dk/image_3.jpg`], battery_options: { base_price: 128000, batteries: [{ capacity: '50Ah', type: 'regular', battery_price: 44500, total_price: 172500, range_km: '70-110' }, { capacity: '60Ah', type: 'regular', battery_price: 55000, total_price: 183000, range_km: '80-120' }, { capacity: '80Ah', type: 'regular', battery_price: 59000, total_price: 187000, range_km: '90-150' }] } }, type: 'bike', quantity: 1 },
  { id: 'vipbike-r1', make: 'VipBike', model: 'R1', description: 'Стильный городской байк с двигателем 3000 Вт.', daily_price: 124400, image_url: `${CARPIX_BASE}/vipbike-r1/image_1.jpg`, rent_link: '/rent/vipbike-r1', specs: { power_w: 3000, power_kw: 3, max_speed_kmh: '90-150', tier: 'standard', gallery: [`${CARPIX_BASE}/vipbike-r1/image_1.jpg`, `${CARPIX_BASE}/vipbike-r1/image_2.jpg`, `${CARPIX_BASE}/vipbike-r1/image_3.jpg`], battery_options: { base_price: 124400, batteries: [{ capacity: '50Ah', type: 'regular', battery_price: 44500, total_price: 168900, range_km: '70-110' }, { capacity: '60Ah', type: 'regular', battery_price: 55000, total_price: 179400, range_km: '80-120' }, { capacity: '80Ah', type: 'regular', battery_price: 59000, total_price: 183400, range_km: '90-150' }] } }, type: 'bike', quantity: 1 },
  { id: 'vipbike-r2', make: 'VipBike', model: 'R2', description: 'Второе поколение популярной R-серии.', daily_price: 124400, image_url: `${CARPIX_BASE}/vipbike-r2/image_1.jpg`, rent_link: '/rent/vipbike-r2', specs: { power_w: 3000, power_kw: 3, max_speed_kmh: '90-150', tier: 'standard', gallery: [`${CARPIX_BASE}/vipbike-r2/image_1.jpg`, `${CARPIX_BASE}/vipbike-r2/image_2.jpg`, `${CARPIX_BASE}/vipbike-r2/image_3.jpg`], battery_options: { base_price: 124400, batteries: [{ capacity: '50Ah', type: 'regular', battery_price: 44500, total_price: 168900, range_km: '70-110' }, { capacity: '60Ah', type: 'regular', battery_price: 55000, total_price: 179400, range_km: '80-120' }, { capacity: '80Ah', type: 'regular', battery_price: 59000, total_price: 183400, range_km: '90-150' }] } }, type: 'bike', quantity: 1 },
  { id: 'vipbike-r3', make: 'VipBike', model: 'R3', description: 'Доступный городской байк с двигателем 3000 Вт.', daily_price: 114800, image_url: `${CARPIX_BASE}/vipbike-r3/image_1.jpg`, rent_link: '/rent/vipbike-r3', specs: { power_w: 3000, power_kw: 3, max_speed_kmh: '90-150', tier: 'budget', gallery: [`${CARPIX_BASE}/vipbike-r3/image_1.jpg`, `${CARPIX_BASE}/vipbike-r3/image_2.jpg`, `${CARPIX_BASE}/vipbike-r3/image_3.jpg`], battery_options: { base_price: 114800, batteries: [{ capacity: '50Ah', type: 'regular', battery_price: 44500, total_price: 159300, range_km: '70-110' }, { capacity: '60Ah', type: 'regular', battery_price: 55000, total_price: 169800, range_km: '80-120' }, { capacity: '80Ah', type: 'regular', battery_price: 59000, total_price: 173800, range_km: '90-150' }] } }, type: 'bike', quantity: 1 },
  { id: 'vipbike-r6', make: 'VipBike', model: 'R6', description: 'Спортивный электромотоцикл с агрессивным дизайном.', daily_price: 148400, image_url: `${CARPIX_BASE}/vipbike-r6/image_1.jpg`, rent_link: '/rent/vipbike-r6', specs: { power_w: 3000, power_kw: 3, max_speed_kmh: '90-150', tier: 'sport', gallery: [`${CARPIX_BASE}/vipbike-r6/image_1.jpg`, `${CARPIX_BASE}/vipbike-r6/image_2.jpg`, `${CARPIX_BASE}/vipbike-r6/image_3.jpg`], battery_options: { base_price: 148400, batteries: [{ capacity: '50Ah', type: 'regular', battery_price: 44500, total_price: 192900, range_km: '70-110' }, { capacity: '60Ah', type: 'regular', battery_price: 55000, total_price: 203400, range_km: '80-120' }, { capacity: '80Ah', type: 'regular', battery_price: 59000, total_price: 207400, range_km: '90-150' }] } }, type: 'bike', quantity: 1 },
  { id: 'vipbike-rz', make: 'VipBike', model: 'RZ', description: 'Бюджетный электромотоцикл с двигателем 3000 Вт.', daily_price: 112400, image_url: `${CARPIX_BASE}/vipbike-rz/image_1.jpg`, rent_link: '/rent/vipbike-rz', specs: { power_w: 3000, power_kw: 3, max_speed_kmh: '90-150', tier: 'budget', gallery: [`${CARPIX_BASE}/vipbike-rz/image_1.jpg`, `${CARPIX_BASE}/vipbike-rz/image_2.jpg`, `${CARPIX_BASE}/vipbike-rz/image_3.jpg`], battery_options: { base_price: 112400, batteries: [{ capacity: '50Ah', type: 'regular', battery_price: 44500, total_price: 156900, range_km: '70-110' }, { capacity: '60Ah', type: 'regular', battery_price: 55000, total_price: 167400, range_km: '80-120' }, { capacity: '80Ah', type: 'regular', battery_price: 59000, total_price: 171400, range_km: '90-150' }] } }, type: 'bike', quantity: 1 },
  { id: 'vipbike-v6', make: 'VipBike', model: 'V6', description: 'Классический дизайн в современном исполнении.', daily_price: 114800, image_url: `${CARPIX_BASE}/vipbike-v6/image_1.jpg`, rent_link: '/rent/vipbike-v6', specs: { power_w: 3000, power_kw: 3, max_speed_kmh: '90-150', tier: 'budget', gallery: [`${CARPIX_BASE}/vipbike-v6/image_1.jpg`, `${CARPIX_BASE}/vipbike-v6/image_2.jpg`, `${CARPIX_BASE}/vipbike-v6/image_3.jpg`], battery_options: { base_price: 114800, batteries: [{ capacity: '50Ah', type: 'regular', battery_price: 44500, total_price: 159300, range_km: '70-110' }, { capacity: '60Ah', type: 'regular', battery_price: 55000, total_price: 169800, range_km: '80-120' }, { capacity: '80Ah', type: 'regular', battery_price: 59000, total_price: 173800, range_km: '90-150' }] } }, type: 'bike', quantity: 1 },
  { id: 'vipbike-jy', make: 'VipBike', model: 'JY', description: 'Оригинальный дизайн, хорошая комплектация.', daily_price: 128000, image_url: `${CARPIX_BASE}/vipbike-jy/image_1.jpg`, rent_link: '/rent/vipbike-jy', specs: { power_w: 3000, power_kw: 3, max_speed_kmh: '90-150', tier: 'mid-range', gallery: [`${CARPIX_BASE}/vipbike-jy/image_1.jpg`, `${CARPIX_BASE}/vipbike-jy/image_2.jpg`, `${CARPIX_BASE}/vipbike-jy/image_3.jpg`], battery_options: { base_price: 128000, batteries: [{ capacity: '50Ah', type: 'regular', battery_price: 44500, total_price: 172500, range_km: '70-110' }, { capacity: '60Ah', type: 'regular', battery_price: 55000, total_price: 183000, range_km: '80-120' }, { capacity: '80Ah', type: 'regular', battery_price: 59000, total_price: 187000, range_km: '90-150' }] } }, type: 'bike', quantity: 1 },
  { id: 'vipbike-xf', make: 'VipBike', model: 'XF', description: 'Динамичный дизайн, отличные ходовые качества.', daily_price: 120800, image_url: `${CARPIX_BASE}/vipbike-xf/image_1.jpg`, rent_link: '/rent/vipbike-xf', specs: { power_w: 3000, power_kw: 3, max_speed_kmh: '90-150', tier: 'standard', gallery: [`${CARPIX_BASE}/vipbike-xf/image_1.jpg`, `${CARPIX_BASE}/vipbike-xf/image_2.jpg`, `${CARPIX_BASE}/vipbike-xf/image_3.jpg`], battery_options: { base_price: 120800, batteries: [{ capacity: '50Ah', type: 'regular', battery_price: 44500, total_price: 165300, range_km: '70-110' }, { capacity: '60Ah', type: 'regular', battery_price: 55000, total_price: 175800, range_km: '80-120' }, { capacity: '80Ah', type: 'regular', battery_price: 59000, total_price: 179800, range_km: '90-150' }] } }, type: 'bike', quantity: 1 },
  { id: 'vipbike-z1000', make: 'VipBike', model: 'Z1000', description: 'Мощный дизайн в стиле японских стритфайтеров.', daily_price: 128000, image_url: `${CARPIX_BASE}/vipbike-z1000/image_1.jpg`, rent_link: '/rent/vipbike-z1000', specs: { power_w: 3000, power_kw: 3, max_speed_kmh: '90-150', tier: 'mid-range', gallery: [`${CARPIX_BASE}/vipbike-z1000/image_1.jpg`, `${CARPIX_BASE}/vipbike-z1000/image_2.jpg`, `${CARPIX_BASE}/vipbike-z1000/image_3.jpg`], battery_options: { base_price: 128000, batteries: [{ capacity: '50Ah', type: 'regular', battery_price: 44500, total_price: 172500, range_km: '70-110' }, { capacity: '60Ah', type: 'regular', battery_price: 55000, total_price: 183000, range_km: '80-120' }, { capacity: '80Ah', type: 'regular', battery_price: 59000, total_price: 187000, range_km: '90-150' }] } }, type: 'bike', quantity: 1 },
  { id: 'vipbike-dn', make: 'VipBike', model: 'DN', description: 'Агрессивный нейкед-стиль, спортивная посадка.', daily_price: 148400, image_url: `${CARPIX_BASE}/vipbike-dn/image_1.jpg`, rent_link: '/rent/vipbike-dn', specs: { power_w: 3000, power_kw: 3, max_speed_kmh: '90-150', tier: 'sport', gallery: [`${CARPIX_BASE}/vipbike-dn/image_1.jpg`, `${CARPIX_BASE}/vipbike-dn/image_2.jpg`, `${CARPIX_BASE}/vipbike-dn/image_3.jpg`], battery_options: { base_price: 148400, batteries: [{ capacity: '50Ah', type: 'regular', battery_price: 44500, total_price: 192900, range_km: '70-110' }, { capacity: '60Ah', type: 'regular', battery_price: 55000, total_price: 203400, range_km: '80-120' }, { capacity: '80Ah', type: 'regular', battery_price: 59000, total_price: 207400, range_km: '90-150' }] } }, type: 'bike', quantity: 1 },
  { id: 'vipbike-a4', make: 'VipBike', model: 'A4', description: 'Флагманский электромотоцикл с двигателем 10000 Вт.', daily_price: 490000, image_url: `${CARPIX_BASE}/vipbike-a4/image_1.jpg`, rent_link: '/rent/vipbike-a4', specs: { power_w: 10000, power_kw: 10, max_speed_kmh: '150+', tier: 'high-performance', gallery: [`${CARPIX_BASE}/vipbike-a4/image_1.jpg`, `${CARPIX_BASE}/vipbike-a4/image_2.jpg`, `${CARPIX_BASE}/vipbike-a4/image_3.jpg`], battery_options: { base_price: 490000, batteries: [{ capacity: 'Included', type: 'lithium', battery_price: 0, total_price: 490000, range_km: '200+' }] } }, type: 'bike', quantity: 1 },
]

const fallbackParts: ConfiguratorPart[] = [
  { id: 'helmet', make: 'VipBike', model: 'Мотошлем', description: 'Качественный мотошлем', daily_price: 4200, image_url: `${CARPIX_BASE}/parts/helmet.jpg`, specs: { category: 'safety' }, type: 'parts' },
  { id: 'helmet-e4', make: 'VipBike', model: 'Шлем E4 (Tensun)', description: 'Премиальный шлем Tensun E4', daily_price: 8300, image_url: `${CARPIX_BASE}/parts/helmet_e4.jpg`, specs: { category: 'safety' }, type: 'parts' },
  { id: 'abs', make: 'VipBike', model: 'ABS система', description: 'Система антиблокировки тормозов', daily_price: 16700, image_url: `${CARPIX_BASE}/parts/abs_system.jpg`, specs: { category: 'safety' }, type: 'parts' },
  { id: 'cbs', make: 'VipBike', model: 'Система CBS', description: 'Combi Brake System', daily_price: 4200, image_url: `${CARPIX_BASE}/parts/cbs_system.jpg`, specs: { category: 'safety' }, type: 'parts' },
  { id: 'brembo', make: 'VipBike', model: 'Тормоза Brembo', description: 'Премиальные тормоза', daily_price: 12400, image_url: `${CARPIX_BASE}/parts/brembo_brakes.jpg`, specs: { category: 'performance' }, type: 'parts' },
  { id: 'tft', make: 'VipBike', model: 'TFT дисплей', description: 'Цифровой дисплей', daily_price: 8300, image_url: `${CARPIX_BASE}/parts/tft_display.jpg`, specs: { category: 'electronics' }, type: 'parts' },
  { id: 'alarm', make: 'VipBike', model: 'Противоугонная Bluetooth', description: 'Сигнализация с отслеживанием', daily_price: 5600, image_url: `${CARPIX_BASE}/parts/bluetooth_alarm.jpg`, specs: { category: 'security' }, type: 'parts' },
  { id: 'footpegs', make: 'VipBike', model: 'CNC подножки', description: 'Алюминиевые подножки', daily_price: 9700, image_url: `${CARPIX_BASE}/parts/cnc_footpegs.jpg`, specs: { category: 'accessories' }, type: 'parts' },
  { id: 'front-shock', make: 'VipBike', model: 'Амортизатор передний', description: 'Передний амортизатор', daily_price: 38600, image_url: `${CARPIX_BASE}/parts/front_shock.jpg`, specs: { category: 'suspension' }, type: 'parts' },
  { id: 'rear-shock', make: 'VipBike', model: 'Амортизатор задний', description: 'Задний амортизатор', daily_price: 16500, image_url: `${CARPIX_BASE}/parts/rear_shock.jpg`, specs: { category: 'suspension' }, type: 'parts' },
]

const lithiumBatteries: ConfiguratorBatteryOption[] = [
  { capacity: '50Ah', type: 'lithium', battery_price: 82000, total_price: 0, range_km: '70-110' },
  { capacity: '60Ah', type: 'lithium', battery_price: 90000, total_price: 0, range_km: '80-120' },
  { capacity: '80Ah', type: 'lithium', battery_price: 98000, total_price: 0, range_km: '90-150' },
  { capacity: '120Ah', type: 'lithium', battery_price: 106000, total_price: 0, range_km: '120-220' },
  { capacity: '160Ah', type: 'lithium', battery_price: 106000, total_price: 0, range_km: '160-260' },
]

interface Props {
  crew: FranchizeCrewVM
  slug: string
}

export function ConfiguratorClient({ crew, slug }: Props) {
  const { toast } = useToast()
  const surface = crewPaletteForSurface(crew.theme)
  const [isPending, startTransition] = useTransition()
  const [tab, setTab] = useState<'model' | 'config' | 'addons' | 'summary'>('model')
  const [priceRange, setPriceRange] = useState([100000, 500000])

  const [bikes, setBikes] = useState(fallbackBikes)
  const [parts, setParts] = useState(fallbackParts)
  const [selectedBikeId, setSelectedBikeId] = useState(fallbackBikes[0]?.id ?? '')
  const [motorPower, setMotorPower] = useState('3000')
  const [batteryMode, setBatteryMode] = useState<'regular' | 'lithium'>('regular')
  const [batteryCapacity, setBatteryCapacity] = useState('')
  const [selectedAccessories, setSelectedAccessories] = useState<string[]>([])
  const [deliveryApplied, setDeliveryApplied] = useState(false)

  useEffect(() => {
    startTransition(async () => {
      const data = await loadConfiguratorCatalog()
      if (data.hasLiveEbikeData) {
        setBikes(data.ebikes)
        setSelectedBikeId(data.ebikes[0]?.id ?? '')
      }
      if (data.hasLivePartsData) setParts(data.parts)
      if (!data.hasLiveEbikeData) {
        toast({ title: 'Используется fallback-каталог', description: 'Показываем полный локальный прайс из хардкода.' })
      }
    })
  }, [toast])

  const selectedBike = useMemo(() => bikes.find((bike) => bike.id === selectedBikeId) ?? null, [bikes, selectedBikeId])
  const regularBatteries = useMemo(() => selectedBike?.specs.battery_options?.batteries ?? [], [selectedBike])

  useEffect(() => {
    if (!selectedBike) return
    setMotorPower(String(selectedBike.specs.power_w ?? 3000))
    setBatteryMode(selectedBike.model === 'A4' ? 'lithium' : 'regular')
    setBatteryCapacity((selectedBike.model === 'A4' ? lithiumBatteries[0] : regularBatteries[0])?.capacity ?? '')
    setSelectedAccessories([])
    setDeliveryApplied(false)
  }, [selectedBike, regularBatteries])

  const availableMotors = useMemo(() => {
    if ((selectedBike?.specs.power_w ?? 3000) >= 10000) return [{ value: '10000', extra: 0, label: '10000W (база)' }]
    return [
      { value: '3000', extra: 0, label: '3000W (база)' },
      { value: '5000', extra: 79000, label: '5000W (+79 000 ₽)' },
      { value: '8000', extra: 90000, label: '8000W (+90 000 ₽)' },
      { value: '10000', extra: 167000, label: '10000W (+167 000 ₽)' },
    ]
  }, [selectedBike])

  const selectedMotor = useMemo(() => availableMotors.find((item) => item.value === motorPower) ?? availableMotors[0], [availableMotors, motorPower])
  const activeBattery = useMemo(
    () => (batteryMode === 'regular' ? regularBatteries.find((b) => b.capacity === batteryCapacity) : lithiumBatteries.find((b) => b.capacity === batteryCapacity)) ?? null,
    [batteryCapacity, batteryMode, regularBatteries],
  )

  const filteredBikes = useMemo(() => bikes.filter((bike) => bike.daily_price >= priceRange[0] && bike.daily_price <= priceRange[1]), [bikes, priceRange])
  const accessoriesTotal = useMemo(() => selectedAccessories.reduce((sum, id) => sum + (parts.find((p) => p.id === id)?.daily_price ?? 0), 0), [selectedAccessories, parts])

  const subtotal = (selectedBike?.daily_price ?? 0) + (selectedMotor?.extra ?? 0) + (selectedBike?.model === 'A4' ? 0 : (activeBattery?.battery_price ?? 0)) + accessoriesTotal
  const total = subtotal + (deliveryApplied ? DELIVERY_AVERAGE : 0)

  const selectBike = (bikeId: string) => {
    setSelectedBikeId(bikeId)
    setTab('config')
  }

  const submitLead = () => {
    if (!selectedBike) return
    startTransition(async () => {
      const response = await sendConfiguratorLead({
        bikeId: selectedBike.id,
        bikeLabel: `${selectedBike.make} ${selectedBike.model}`,
        motorLabel: selectedMotor?.label ?? '—',
        batteryLabel: activeBattery ? `${activeBattery.capacity} (${batteryMode})` : 'без батареи',
        selectedAccessories: selectedAccessories.map((id) => {
          const part = parts.find((p) => p.id === id)
          return { name: part?.model ?? id, price: part?.daily_price ?? 0 }
        }),
        withDelivery: deliveryApplied,
        deliveryPrice: DELIVERY_AVERAGE,
        total,
      })

      if (response.success) {
        toast({ title: 'Конфигурация отправлена', description: 'Мы отправили оповещение в Telegram.' })
      } else {
        toast({ title: 'Ошибка', description: response.error ?? 'Не удалось отправить оповещение', variant: 'destructive' })
      }
    })
  }

  return (
    <section className="mx-auto w-full max-w-5xl px-4 pb-8 pt-8" style={surface.page}>
      <div className="mb-5 rounded-2xl border p-4" style={surface.card}>
        <h1 className="text-2xl font-semibold">Конфигуратор покупки электробайка</h1>
        <p className="mt-2 text-sm" style={surface.mutedText}>Электробайк выгоден уже сегодня: ниже эксплуатационные расходы, мгновенный отклик мотора и меньше обслуживания.</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="model">1. Модель</TabsTrigger>
          <TabsTrigger value="config" disabled={!selectedBike}>2. Конфиг</TabsTrigger>
          <TabsTrigger value="addons" disabled={!selectedBike}>3. Опции</TabsTrigger>
          <TabsTrigger value="summary" disabled={!selectedBike}>4. Итог</TabsTrigger>
        </TabsList>

        <TabsContent value="model" className="space-y-4">
          <Card>
            <CardContent className="pt-4">
              <Label>Диапазон цены: {formatPrice(priceRange[0])} — {formatPrice(priceRange[1])}</Label>
              <Slider value={priceRange} onValueChange={setPriceRange} min={100000} max={500000} step={10000} className="mt-3" />
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            {filteredBikes.map((bike) => (
              <article key={bike.id} className="overflow-hidden rounded-2xl border" style={catalogCardVariantStyles(crew.theme, bike.id.length)}>
                <button
                  type="button"
                  className="block w-full text-left"
                  onClick={() => selectBike(bike.id)}
                  style={selectedBikeId === bike.id ? interactionRingStyle(crew.theme) : undefined}
                >
                  <div className="relative h-28 w-full">
                    <Image src={bike.image_url} alt={`${bike.make} ${bike.model}`} fill className="object-cover" unoptimized />
                  </div>
                  <div className="p-3">
                    <div className="mb-1 flex items-center justify-between">
                      <h3 className="text-sm font-semibold">{bike.make} {bike.model}</h3>
                      {selectedBikeId === bike.id && <Badge>Выбран</Badge>}
                    </div>
                    <p className="text-xs" style={surface.mutedText}>{bike.description}</p>
                    <p className="mt-2 text-base font-bold" style={{ color: crew.theme.palette.accentMain }}>{formatPrice(bike.daily_price)}</p>
                  </div>
                </button>
              </article>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="config" className="space-y-4">
          {selectedBike && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>{selectedBike.make} {selectedBike.model}</CardTitle>
                  <CardDescription>Выбор мотора, батареи и обзор фото модели.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid grid-cols-3 gap-2">
                    {(selectedBike.specs.gallery?.length ? selectedBike.specs.gallery : [selectedBike.image_url]).map((image) => (
                      <div key={image} className="relative h-24 overflow-hidden rounded-lg border">
                        <Image src={image} alt={selectedBike.model} fill className="object-cover" unoptimized />
                      </div>
                    ))}
                  </div>

                  <div>
                    <Label className="mb-2 block">Мощность мотора</Label>
                    <RadioGroup value={motorPower} onValueChange={setMotorPower} className="grid gap-2 sm:grid-cols-2">
                      {availableMotors.map((motor) => (
                        <Label key={motor.value} className="flex items-center gap-3 rounded-lg border p-3">
                          <RadioGroupItem value={motor.value} />
                          {motor.label}
                        </Label>
                      ))}
                    </RadioGroup>
                  </div>

                  {selectedBike.model !== 'A4' && (
                    <>
                      <div>
                        <Label className="mb-2 block">Тип батареи</Label>
                        <RadioGroup value={batteryMode} onValueChange={(v) => setBatteryMode(v as 'regular' | 'lithium')} className="grid grid-cols-2 gap-2">
                          <Label className="flex items-center gap-2 rounded-lg border p-3"><RadioGroupItem value="regular" />Regular</Label>
                          <Label className="flex items-center gap-2 rounded-lg border p-3"><RadioGroupItem value="lithium" />Lithium</Label>
                        </RadioGroup>
                      </div>

                      <div>
                        <Label className="mb-2 block">Размер батареи</Label>
                        <RadioGroup value={batteryCapacity} onValueChange={setBatteryCapacity} className="grid gap-2 sm:grid-cols-2">
                          {(batteryMode === 'regular' ? regularBatteries : lithiumBatteries).map((battery) => (
                            <Label key={`${batteryMode}-${battery.capacity}`} className="flex items-center justify-between rounded-lg border p-3">
                              <span className="flex items-center gap-2"><RadioGroupItem value={battery.capacity} />{battery.capacity}</span>
                              <span className="text-sm">+{formatPrice(battery.battery_price)}</span>
                            </Label>
                          ))}
                        </RadioGroup>
                      </div>
                    </>
                  )}

                  <Button onClick={() => setTab('addons')} className="w-full">Дальше: доп. опции</Button>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="addons" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Доп. опции (правая часть прайса)</CardTitle>
              <CardDescription>Выберите нужные компоненты.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              {parts.map((part) => {
                const checked = selectedAccessories.includes(part.id)
                return (
                  <label key={part.id} className="flex cursor-pointer items-start justify-between gap-2 rounded-lg border p-3">
                    <span className="flex items-start gap-2">
                      <Checkbox checked={checked} onCheckedChange={() => setSelectedAccessories((prev) => prev.includes(part.id) ? prev.filter((id) => id !== part.id) : [...prev, part.id])} />
                      <span>
                        <span className="block text-sm font-medium">{part.model}</span>
                        <span className="block text-xs" style={surface.mutedText}>{part.description}</span>
                      </span>
                    </span>
                    <span className="text-xs font-semibold">+{formatPrice(part.daily_price)}</span>
                  </label>
                )
              })}
              <Button onClick={() => setTab('summary')} className="sm:col-span-2">Дальше: итог</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Итог конфигурации</CardTitle>
              <CardDescription>Выбранный байк и мгновенный расчёт суммы.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between"><span>Модель</span><span>{selectedBike?.make} {selectedBike?.model}</span></div>
              <div className="flex justify-between"><span>Мотор</span><span>{selectedMotor?.label}</span></div>
              <div className="flex justify-between"><span>Батарея</span><span>{activeBattery ? `${activeBattery.capacity} / ${activeBattery.range_km} км` : '—'}</span></div>
              <Separator />
              <div className="flex justify-between"><span>База</span><span>{formatPrice(selectedBike?.daily_price ?? 0)}</span></div>
              <div className="flex justify-between"><span>Мотор</span><span>{formatPrice(selectedMotor?.extra ?? 0)}</span></div>
              <div className="flex justify-between"><span>Батарея</span><span>{formatPrice(selectedBike?.model === 'A4' ? 0 : (activeBattery?.battery_price ?? 0))}</span></div>
              <div className="flex justify-between"><span>Опции</span><span>{formatPrice(accessoriesTotal)}</span></div>
              <div className="rounded-lg border border-dashed p-3">
                <p className="mb-2 text-xs">Доставка (средняя): {formatPrice(DELIVERY_AVERAGE)}</p>
                <Button variant="outline" className="w-full" onClick={() => setDeliveryApplied((v) => !v)}>
                  <Truck className="mr-2 h-4 w-4" />{deliveryApplied ? 'Убрать доставку' : 'Рассчитать доставку (+95 000 ₽)'}
                </Button>
              </div>
              <div className="flex justify-between text-base font-bold"><span>Итого</span><span>{formatPrice(total)}</span></div>

              <div className="grid gap-2 pt-2 sm:grid-cols-2">
                <Button onClick={submitLead} disabled={isPending}><MessageCircle className="mr-2 h-4 w-4" />Отправить в Telegram</Button>
                <Button asChild variant="secondary"><a href="https://t.me/I_O_S_NN" target="_blank" rel="noopener noreferrer">Оформить покупку</a></Button>
                <Button asChild variant="ghost" className="sm:col-span-2"><Link href={`/franchize/${crew.slug || slug}/contacts`}>Контакты франшизы</Link></Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-1 p-4 text-xs" style={surface.mutedText}>
              <p className="font-medium" style={{ color: crew.theme.palette.textPrimary }}>Что проверено по прайсу:</p>
              <p className="flex items-center gap-2"><Battery className="h-3.5 w-3.5" />Аккумы regular/lithium и цены.</p>
              <p className="flex items-center gap-2"><Zap className="h-3.5 w-3.5" />Моторы: 3000 / 5000 / 8000 / 10000W.</p>
              <p className="flex items-center gap-2"><Wrench className="h-3.5 w-3.5" />Опции из правой части прайса (ABS, Brembo, TFT и т.д.).</p>
              <p className="flex items-center gap-2"><Shield className="h-3.5 w-3.5" />Fallback оставлен полным, пока live `type=ebike` наполняется.</p>
              <p className="flex items-center gap-2"><Gauge className="h-3.5 w-3.5" />Выделение выбранного байка + шаговые табы для UX.</p>
              <p className="flex items-center gap-2"><Check className="h-3.5 w-3.5" />Доставка временно фиксированная: {formatPrice(DELIVERY_AVERAGE)}.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </section>
  )
}
