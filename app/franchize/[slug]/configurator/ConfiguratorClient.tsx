'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { MessageCircle, Truck, ChevronRight, Check, Zap, Battery, Shield, Gauge, X, Sparkles } from 'lucide-react'

import { type FranchizeCrewVM } from '../../actions'
import { crewPaletteForSurface } from '../../lib/theme'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { useToast } from '@/hooks/use-toast'

import { loadConfiguratorCatalog, sendConfiguratorLead, type ConfiguratorBatteryOption, type ConfiguratorBike, type ConfiguratorPart } from './actions_configurator'

const DELIVERY_AVERAGE = 95_000
const CARPIX_BASE = 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix'
const formatPrice = (price: number) => `${price.toLocaleString('ru-RU')} ₽`

const fallbackBikes: ConfiguratorBike[] = [
  { id: 'vipbike-g8', make: 'VipBike', model: 'G8', description: 'Электромотоцикл VipBike G8 с мощным двигателем 3000 Вт и максимальной скоростью до 150 км/ч.', daily_price: 120800, image_url: `${CARPIX_BASE}/vipbike-g8/image_0.jpg`, rent_link: '/rent/vipbike-g8', specs: { power_w: 3000, power_kw: 3, max_speed_kmh: '90-150', subtitle: 'Электромотоцикл VipBike G8', tier: 'standard', gallery: [`${CARPIX_BASE}/vipbike-g8/image_1.jpg`, `${CARPIX_BASE}/vipbike-g8/image_2.jpg`, `${CARPIX_BASE}/vipbike-g8/image_3.jpg`], battery_options: { base_price: 120800, batteries: [{ capacity: '50Ah', type: 'regular', battery_price: 44500, total_price: 165300, range_km: '70-110' }, { capacity: '60Ah', type: 'regular', battery_price: 55000, total_price: 175800, range_km: '80-120' }, { capacity: '80Ah', type: 'regular', battery_price: 59000, total_price: 179800, range_km: '90-150' }] } }, type: 'bike', quantity: 1 },
  { id: 'vipbike-g8-2', make: 'VipBike', model: 'G8-2', description: 'Обновленная версия популярной модели G8. Двигатель 3000 Вт, скорость до 150 км/ч.', daily_price: 124400, image_url: `${CARPIX_BASE}/vipbike-g8-2/image_0.jpg`, rent_link: '/rent/vipbike-g8-2', specs: { power_w: 3000, power_kw: 3, max_speed_kmh: '90-150', subtitle: 'Электромотоцикл VipBike G8-2', tier: 'standard', gallery: [`${CARPIX_BASE}/vipbike-g8-2/image_1.jpg`, `${CARPIX_BASE}/vipbike-g8-2/image_2.jpg`, `${CARPIX_BASE}/vipbike-g8-2/image_3.jpg`], battery_options: { base_price: 124400, batteries: [{ capacity: '50Ah', type: 'regular', battery_price: 44500, total_price: 168900, range_km: '70-110' }, { capacity: '60Ah', type: 'regular', battery_price: 55000, total_price: 179400, range_km: '80-120' }, { capacity: '80Ah', type: 'regular', battery_price: 59000, total_price: 183400, range_km: '90-150' }] } }, type: 'bike', quantity: 1 },
  { id: 'vipbike-dmg', make: 'VipBike', model: 'DMG', description: 'Премиальный электромотоцикл VipBike DMG с двигателем 3000 Вт.', daily_price: 159200, image_url: `${CARPIX_BASE}/vipbike-dmg/image_0.jpg`, rent_link: '/rent/vipbike-dmg', specs: { power_w: 3000, power_kw: 3, max_speed_kmh: '90-150', subtitle: 'Премиальный электромотоцикл VipBike DMG', tier: 'premium', gallery: [`${CARPIX_BASE}/vipbike-dmg/image_1.jpg`, `${CARPIX_BASE}/vipbike-dmg/image_2.jpg`, `${CARPIX_BASE}/vipbike-dmg/image_3.jpg`], battery_options: { base_price: 159200, batteries: [{ capacity: '50Ah', type: 'regular', battery_price: 44500, total_price: 203700, range_km: '70-110' }, { capacity: '60Ah', type: 'regular', battery_price: 55000, total_price: 214200, range_km: '80-120' }, { capacity: '80Ah', type: 'regular', battery_price: 59000, total_price: 218200, range_km: '90-150' }] } }, type: 'bike', quantity: 1 },
  { id: 'vipbike-dk', make: 'VipBike', model: 'DK', description: 'Надежный городской байк с двигателем 3000 Вт.', daily_price: 128000, image_url: `${CARPIX_BASE}/vipbike-dk/image_0.jpg`, rent_link: '/rent/vipbike-dk', specs: { power_w: 3000, power_kw: 3, max_speed_kmh: '90-150', tier: 'mid-range', gallery: [`${CARPIX_BASE}/vipbike-dk/image_1.jpg`, `${CARPIX_BASE}/vipbike-dk/image_2.jpg`, `${CARPIX_BASE}/vipbike-dk/image_3.jpg`], battery_options: { base_price: 128000, batteries: [{ capacity: '50Ah', type: 'regular', battery_price: 44500, total_price: 172500, range_km: '70-110' }, { capacity: '60Ah', type: 'regular', battery_price: 55000, total_price: 183000, range_km: '80-120' }, { capacity: '80Ah', type: 'regular', battery_price: 59000, total_price: 187000, range_km: '90-150' }] } }, type: 'bike', quantity: 1 },
  { id: 'vipbike-r1', make: 'VipBike', model: 'R1', description: 'Стильный городской байк с двигателем 3000 Вт.', daily_price: 124400, image_url: `${CARPIX_BASE}/vipbike-r1/image_0.jpg`, rent_link: '/rent/vipbike-r1', specs: { power_w: 3000, power_kw: 3, max_speed_kmh: '90-150', tier: 'standard', gallery: [`${CARPIX_BASE}/vipbike-r1/image_1.jpg`, `${CARPIX_BASE}/vipbike-r1/image_2.jpg`, `${CARPIX_BASE}/vipbike-r1/image_3.jpg`], battery_options: { base_price: 124400, batteries: [{ capacity: '50Ah', type: 'regular', battery_price: 44500, total_price: 168900, range_km: '70-110' }, { capacity: '60Ah', type: 'regular', battery_price: 55000, total_price: 179400, range_km: '80-120' }, { capacity: '80Ah', type: 'regular', battery_price: 59000, total_price: 183400, range_km: '90-150' }] } }, type: 'bike', quantity: 1 },
  { id: 'vipbike-r2', make: 'VipBike', model: 'R2', description: 'Второе поколение популярной R-серии.', daily_price: 124400, image_url: `${CARPIX_BASE}/vipbike-r2/image_0.jpg`, rent_link: '/rent/vipbike-r2', specs: { power_w: 3000, power_kw: 3, max_speed_kmh: '90-150', tier: 'standard', gallery: [`${CARPIX_BASE}/vipbike-r2/image_1.jpg`, `${CARPIX_BASE}/vipbike-r2/image_2.jpg`, `${CARPIX_BASE}/vipbike-r2/image_3.jpg`], battery_options: { base_price: 124400, batteries: [{ capacity: '50Ah', type: 'regular', battery_price: 44500, total_price: 168900, range_km: '70-110' }, { capacity: '60Ah', type: 'regular', battery_price: 55000, total_price: 179400, range_km: '80-120' }, { capacity: '80Ah', type: 'regular', battery_price: 59000, total_price: 183400, range_km: '90-150' }] } }, type: 'bike', quantity: 1 },
  { id: 'vipbike-r3', make: 'VipBike', model: 'R3', description: 'Доступный городской байк с двигателем 3000 Вт.', daily_price: 114800, image_url: `${CARPIX_BASE}/vipbike-r3/image_0.jpg`, rent_link: '/rent/vipbike-r3', specs: { power_w: 3000, power_kw: 3, max_speed_kmh: '90-150', tier: 'budget', gallery: [`${CARPIX_BASE}/vipbike-r3/image_1.jpg`, `${CARPIX_BASE}/vipbike-r3/image_2.jpg`, `${CARPIX_BASE}/vipbike-r3/image_3.jpg`], battery_options: { base_price: 114800, batteries: [{ capacity: '50Ah', type: 'regular', battery_price: 44500, total_price: 159300, range_km: '70-110' }, { capacity: '60Ah', type: 'regular', battery_price: 55000, total_price: 169800, range_km: '80-120' }, { capacity: '80Ah', type: 'regular', battery_price: 59000, total_price: 173800, range_km: '90-150' }] } }, type: 'bike', quantity: 1 },
  { id: 'vipbike-r6', make: 'VipBike', model: 'R6', description: 'Спортивный электромотоцикл с агрессивным дизайном.', daily_price: 148400, image_url: `${CARPIX_BASE}/vipbike-r6/image_0.jpg`, rent_link: '/rent/vipbike-r6', specs: { power_w: 3000, power_kw: 3, max_speed_kmh: '90-150', tier: 'sport', gallery: [`${CARPIX_BASE}/vipbike-r6/image_1.jpg`, `${CARPIX_BASE}/vipbike-r6/image_2.jpg`, `${CARPIX_BASE}/vipbike-r6/image_3.jpg`], battery_options: { base_price: 148400, batteries: [{ capacity: '50Ah', type: 'regular', battery_price: 44500, total_price: 192900, range_km: '70-110' }, { capacity: '60Ah', type: 'regular', battery_price: 55000, total_price: 203400, range_km: '80-120' }, { capacity: '80Ah', type: 'regular', battery_price: 59000, total_price: 207400, range_km: '90-150' }] } }, type: 'bike', quantity: 1 },
  { id: 'vipbike-rz', make: 'VipBike', model: 'RZ', description: 'Бюджетный электромотоцикл с двигателем 3000 Вт.', daily_price: 112400, image_url: `${CARPIX_BASE}/vipbike-rz/image_0.jpg`, rent_link: '/rent/vipbike-rz', specs: { power_w: 3000, power_kw: 3, max_speed_kmh: '90-150', tier: 'budget', gallery: [`${CARPIX_BASE}/vipbike-rz/image_1.jpg`, `${CARPIX_BASE}/vipbike-rz/image_2.jpg`, `${CARPIX_BASE}/vipbike-rz/image_3.jpg`], battery_options: { base_price: 112400, batteries: [{ capacity: '50Ah', type: 'regular', battery_price: 44500, total_price: 156900, range_km: '70-110' }, { capacity: '60Ah', type: 'regular', battery_price: 55000, total_price: 167400, range_km: '80-120' }, { capacity: '80Ah', type: 'regular', battery_price: 59000, total_price: 171400, range_km: '90-150' }] } }, type: 'bike', quantity: 1 },
  { id: 'vipbike-v6', make: 'VipBike', model: 'V6', description: 'Классический дизайн в современном исполнении.', daily_price: 114800, image_url: `${CARPIX_BASE}/vipbike-v6/image_0.jpg`, rent_link: '/rent/vipbike-v6', specs: { power_w: 3000, power_kw: 3, max_speed_kmh: '90-150', tier: 'budget', gallery: [`${CARPIX_BASE}/vipbike-v6/image_1.jpg`, `${CARPIX_BASE}/vipbike-v6/image_2.jpg`, `${CARPIX_BASE}/vipbike-v6/image_3.jpg`], battery_options: { base_price: 114800, batteries: [{ capacity: '50Ah', type: 'regular', battery_price: 44500, total_price: 159300, range_km: '70-110' }, { capacity: '60Ah', type: 'regular', battery_price: 55000, total_price: 169800, range_km: '80-120' }, { capacity: '80Ah', type: 'regular', battery_price: 59000, total_price: 173800, range_km: '90-150' }] } }, type: 'bike', quantity: 1 },
  { id: 'vipbike-jy', make: 'VipBike', model: 'JY', description: 'Оригинальный дизайн, хорошая комплектация.', daily_price: 128000, image_url: `${CARPIX_BASE}/vipbike-jy/image_0.jpg`, rent_link: '/rent/vipbike-jy', specs: { power_w: 3000, power_kw: 3, max_speed_kmh: '90-150', tier: 'mid-range', gallery: [`${CARPIX_BASE}/vipbike-jy/image_1.jpg`, `${CARPIX_BASE}/vipbike-jy/image_2.jpg`, `${CARPIX_BASE}/vipbike-jy/image_3.jpg`], battery_options: { base_price: 128000, batteries: [{ capacity: '50Ah', type: 'regular', battery_price: 44500, total_price: 172500, range_km: '70-110' }, { capacity: '60Ah', type: 'regular', battery_price: 55000, total_price: 183000, range_km: '80-120' }, { capacity: '80Ah', type: 'regular', battery_price: 59000, total_price: 187000, range_km: '90-150' }] } }, type: 'bike', quantity: 1 },
  { id: 'vipbike-xf', make: 'VipBike', model: 'XF', description: 'Динамичный дизайн, отличные ходовые качества.', daily_price: 120800, image_url: `${CARPIX_BASE}/vipbike-xf/image_0.jpg`, rent_link: '/rent/vipbike-xf', specs: { power_w: 3000, power_kw: 3, max_speed_kmh: '90-150', tier: 'standard', gallery: [`${CARPIX_BASE}/vipbike-xf/image_1.jpg`, `${CARPIX_BASE}/vipbike-xf/image_2.jpg`, `${CARPIX_BASE}/vipbike-xf/image_3.jpg`], battery_options: { base_price: 120800, batteries: [{ capacity: '50Ah', type: 'regular', battery_price: 44500, total_price: 165300, range_km: '70-110' }, { capacity: '60Ah', type: 'regular', battery_price: 55000, total_price: 175800, range_km: '80-120' }, { capacity: '80Ah', type: 'regular', battery_price: 59000, total_price: 179800, range_km: '90-150' }] } }, type: 'bike', quantity: 1 },
  { id: 'vipbike-z1000', make: 'VipBike', model: 'Z1000', description: 'Мощный дизайн в стиле японских стритфайтеров.', daily_price: 128000, image_url: `${CARPIX_BASE}/vipbike-z1000/image_0.jpg`, rent_link: '/rent/vipbike-z1000', specs: { power_w: 3000, power_kw: 3, max_speed_kmh: '90-150', tier: 'mid-range', gallery: [`${CARPIX_BASE}/vipbike-z1000/image_1.jpg`, `${CARPIX_BASE}/vipbike-z1000/image_2.jpg`, `${CARPIX_BASE}/vipbike-z1000/image_3.jpg`], battery_options: { base_price: 128000, batteries: [{ capacity: '50Ah', type: 'regular', battery_price: 44500, total_price: 172500, range_km: '70-110' }, { capacity: '60Ah', type: 'regular', battery_price: 55000, total_price: 183000, range_km: '80-120' }, { capacity: '80Ah', type: 'regular', battery_price: 59000, total_price: 187000, range_km: '90-150' }] } }, type: 'bike', quantity: 1 },
  { id: 'vipbike-dn', make: 'VipBike', model: 'DN', description: 'Агрессивный нейкед-стиль, спортивная посадка.', daily_price: 148400, image_url: `${CARPIX_BASE}/vipbike-dn/image_0.jpg`, rent_link: '/rent/vipbike-dn', specs: { power_w: 3000, power_kw: 3, max_speed_kmh: '90-150', tier: 'sport', gallery: [`${CARPIX_BASE}/vipbike-dn/image_1.jpg`, `${CARPIX_BASE}/vipbike-dn/image_2.jpg`, `${CARPIX_BASE}/vipbike-dn/image_3.jpg`], battery_options: { base_price: 148400, batteries: [{ capacity: '50Ah', type: 'regular', battery_price: 44500, total_price: 192900, range_km: '70-110' }, { capacity: '60Ah', type: 'regular', battery_price: 55000, total_price: 203400, range_km: '80-120' }, { capacity: '80Ah', type: 'regular', battery_price: 59000, total_price: 207400, range_km: '90-150' }] } }, type: 'bike', quantity: 1 },
  { id: 'vipbike-a4', make: 'VipBike', model: 'A4', description: 'Флагманский электромотоцикл с двигателем 10000 Вт.', daily_price: 490000, image_url: `${CARPIX_BASE}/vipbike-a4/image_0.jpg`, rent_link: '/rent/vipbike-a4', specs: { power_w: 10000, power_kw: 10, max_speed_kmh: '150+', tier: 'high-performance', gallery: [`${CARPIX_BASE}/vipbike-a4/image_1.jpg`, `${CARPIX_BASE}/vipbike-a4/image_2.jpg`, `${CARPIX_BASE}/vipbike-a4/image_3.jpg`], battery_options: { base_price: 490000, batteries: [{ capacity: 'Included', type: 'lithium', battery_price: 0, total_price: 490000, range_km: '200+' }] } }, type: 'bike', quantity: 1 },
]

const fallbackParts: ConfiguratorPart[] = [
  { id: 'vipbike-battery-50ah-regular', make: 'VipBike', model: 'Аккумулятор 50Ah (Regular)', description: 'Стандартная аккумуляторная батарея емкостью 50Ah. Запас хода: 70-110 км.', daily_price: 44500, image_url: `${CARPIX_BASE}/parts/battery_50ah.jpg`, specs: { type: 'Battery', capacity: '50Ah', battery_type: 'regular', range_km: '70-110', category: 'battery' }, type: 'parts' },
  { id: 'vipbike-battery-60ah-regular', make: 'VipBike', model: 'Аккумулятор 60Ah (Regular)', description: 'Стандартная аккумуляторная батарея емкостью 60Ah. Запас хода: 80-120 км.', daily_price: 55000, image_url: `${CARPIX_BASE}/parts/battery_60ah.jpg`, specs: { type: 'Battery', capacity: '60Ah', battery_type: 'regular', range_km: '80-120', category: 'battery' }, type: 'parts' },
  { id: 'vipbike-battery-80ah-regular', make: 'VipBike', model: 'Аккумулятор 80Ah (Regular)', description: 'Стандартная аккумуляторная батарея емкостью 80Ah. Запас хода: 90-150 км.', daily_price: 59000, image_url: `${CARPIX_BASE}/parts/battery_80ah.jpg`, specs: { type: 'Battery', capacity: '80Ah', battery_type: 'regular', range_km: '90-150', category: 'battery' }, type: 'parts' },
  { id: 'vipbike-battery-50ah-lithium', make: 'VipBike', model: 'Литиевая батарея 50Ah', description: 'Литиевая аккумуляторная батарея 50Ah. Легче и долговечнее.', daily_price: 82000, image_url: `${CARPIX_BASE}/parts/battery_li_50ah.jpg`, specs: { type: 'Battery', capacity: '50Ah', battery_type: 'lithium', range_km: '70-110', category: 'battery' }, type: 'parts' },
  { id: 'vipbike-battery-60ah-lithium', make: 'VipBike', model: 'Литиевая батарея 60Ah', description: 'Литиевая аккумуляторная батарея 60Ah. Оптимальный выбор.', daily_price: 90000, image_url: `${CARPIX_BASE}/parts/battery_li_60ah.jpg`, specs: { type: 'Battery', capacity: '60Ah', battery_type: 'lithium', range_km: '80-120', category: 'battery' }, type: 'parts' },
  { id: 'vipbike-battery-80ah-lithium', make: 'VipBike', model: 'Литиевая батарея 80Ah', description: 'Литиевая аккумуляторная батарея 80Ah. Увеличенная дальность.', daily_price: 98000, image_url: `${CARPIX_BASE}/parts/battery_li_80ah.jpg`, specs: { type: 'Battery', capacity: '80Ah', battery_type: 'lithium', range_km: '90-150', category: 'battery' }, type: 'parts' },
  { id: 'vipbike-helmet-e4', make: 'VipBike', model: 'Шлем E4 (Tensun)', description: 'Мотоциклетный шлем E4 от Tensun.', daily_price: 8300, image_url: `${CARPIX_BASE}/parts/helmet_e4.jpg`, specs: { type: 'Helmet', brand: 'Tensun', category: 'safety' }, type: 'parts' },
  { id: 'vipbike-motorcycle-helmet', make: 'VipBike', model: 'Мотошлем', description: 'Качественный мотошлем для безопасной езды.', daily_price: 4200, image_url: `${CARPIX_BASE}/parts/helmet.jpg`, specs: { type: 'Helmet', category: 'safety' }, type: 'parts' },
  { id: 'vipbike-abs-system', make: 'VipBike', model: 'ABS система', description: 'Система ABS для безопасного торможения.', daily_price: 16700, image_url: `${CARPIX_BASE}/parts/abs_system.jpg`, specs: { type: 'Safety', system: 'ABS', category: 'brakes' }, type: 'parts' },
  { id: 'vipbike-cbs-system', make: 'VipBike', model: 'Система CBS', description: 'Combi Brake System для сбалансированного торможения.', daily_price: 4200, image_url: `${CARPIX_BASE}/parts/cbs_system.jpg`, specs: { type: 'Safety', system: 'CBS', category: 'brakes' }, type: 'parts' },
  { id: 'vipbike-brembo-brakes', make: 'VipBike', model: 'Тормоза Brembo', description: 'Премиальные тормоза Brembo.', daily_price: 12400, image_url: `${CARPIX_BASE}/parts/brembo_brakes.jpg`, specs: { type: 'Brakes', brand: 'Brembo', category: 'performance' }, type: 'parts' },
  { id: 'vipbike-tft-display', make: 'VipBike', model: 'TFT дисплей', description: 'Цифровой дисплей с поддержкой мобильного телефона.', daily_price: 8300, image_url: `${CARPIX_BASE}/parts/tft_display.jpg`, specs: { type: 'Display', technology: 'TFT', category: 'electronics' }, type: 'parts' },
  { id: 'vipbike-bluetooth-alarm', make: 'VipBike', model: 'Противоугонная Bluetooth', description: 'Противоугонная система с Bluetooth.', daily_price: 5600, image_url: `${CARPIX_BASE}/parts/bluetooth_alarm.jpg`, specs: { type: 'Security', technology: 'Bluetooth', category: 'electronics' }, type: 'parts' },
  { id: 'vipbike-cnc-footpegs', make: 'VipBike', model: 'CNC подножки', description: 'CNC передние и задние подножки.', daily_price: 9700, image_url: `${CARPIX_BASE}/parts/cnc_footpegs.jpg`, specs: { type: 'Footpegs', material: 'CNC Aluminum', category: 'accessories' }, type: 'parts' },
  { id: 'vipbike-front-shock', make: 'VipBike', model: 'Амортизатор передний', description: 'Передний амортизатор.', daily_price: 38600, image_url: `${CARPIX_BASE}/parts/front_shock.jpg`, specs: { type: 'Suspension', position: 'front', category: 'suspension' }, type: 'parts' },
  { id: 'vipbike-rear-shock', make: 'VipBike', model: 'Амортизатор задний', description: 'Задний амортизатор.', daily_price: 16500, image_url: `${CARPIX_BASE}/parts/rear_shock.jpg`, specs: { type: 'Suspension', position: 'rear', category: 'suspension' }, type: 'parts' },
  { id: 'vipbike-rear-tire', make: 'VipBike', model: 'Задняя шина', description: 'Задняя шина для электромотоциклов VipBike.', daily_price: 4200, image_url: `${CARPIX_BASE}/parts/rear_tire.jpg`, specs: { type: 'Tire', position: 'rear', category: 'wheels' }, type: 'parts' },
]

const lithiumBatteries: ConfiguratorBatteryOption[] = [
  { capacity: '50Ah', type: 'lithium', battery_price: 82000, total_price: 0, range_km: '70-110' },
  { capacity: '60Ah', type: 'lithium', battery_price: 90000, total_price: 0, range_km: '80-120' },
  { capacity: '80Ah', type: 'lithium', battery_price: 98000, total_price: 0, range_km: '90-150' },
  { capacity: '120Ah', type: 'lithium', battery_price: 106000, total_price: 0, range_km: '120-220' },
  { capacity: '160Ah', type: 'lithium', battery_price: 106000, total_price: 0, range_km: '160-260' },
]

const TIER_META: Record<string, { label: string; color: string }> = {
  budget: { label: 'Бюджет', color: '#6ee7b7' },
  standard: { label: 'Стандарт', color: '#60a5fa' },
  'mid-range': { label: 'Оптимум', color: '#a78bfa' },
  premium: { label: 'Премиум', color: '#fbbf24' },
  sport: { label: 'Спорт', color: '#f87171' },
  'high-performance': { label: 'Флагман', color: '#fb923c' },
}

const PART_CATEGORY_ICONS: Record<string, typeof Zap> = {
  battery: Battery,
  safety: Shield,
  brakes: Shield,
  performance: Gauge,
  electronics: Zap,
  accessories: Sparkles,
  suspension: Gauge,
  wheels: Gauge,
}

interface Props {
  crew: FranchizeCrewVM
  slug: string
}

/* ──────────────── STEP INDICATOR ──────────────── */
const STEPS = [
  { key: 'model', label: 'Модель', num: '01' },
  { key: 'config', label: 'Конфиг', num: '02' },
  { key: 'addons', label: 'Опции', num: '03' },
  { key: 'summary', label: 'Итог', num: '04' },
] as const

function StepBar({ current, goTo, disabled }: { current: string; goTo: (s: string) => void; disabled: Record<string, boolean> }) {
  const idx = STEPS.findIndex((s) => s.key === current)
  return (
    <nav className="mb-8 flex items-center gap-1 overflow-x-auto pb-2">
      {STEPS.map((step, i) => {
        const active = step.key === current
        const done = i < idx
        const dis = disabled[step.key]
        return (
          <button
            key={step.key}
            disabled={dis}
            onClick={() => goTo(step.key)}
            className={[
              'group relative flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold tracking-wide transition-all duration-300 sm:text-sm',
              active
                ? 'bg-white text-black shadow-lg shadow-white/10 scale-105'
                : done
                  ? 'bg-white/10 text-white/80 hover:bg-white/15'
                  : dis
                    ? 'text-white/20 cursor-not-allowed'
                    : 'text-white/40 hover:text-white/60 hover:bg-white/5',
            ].join(' ')}
          >
            <span
              className={[
                'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold transition-colors',
                active ? 'bg-black text-white' : done ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/10 text-white/30',
              ].join(' ')}
            >
              {done ? <Check className="h-3 w-3" /> : step.num}
            </span>
            <span className="hidden sm:inline">{step.label}</span>
            {i < STEPS.length - 1 && (
              <ChevronRight className="ml-1 h-3 w-3 text-white/20 hidden sm:block" />
            )}
          </button>
        )
      })}
    </nav>
  )
}

/* ──────────────── TIER BADGE ──────────────── */
function TierBadge({ tier }: { tier?: string }) {
  if (!tier || !TIER_META[tier]) return null
  const meta = TIER_META[tier]
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest"
      style={{ background: `${meta.color}18`, color: meta.color, border: `1px solid ${meta.color}30` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
      {meta.label}
    </span>
  )
}

/* ──────────────── LIVE PRICE TICKER ──────────────── */
function LivePrice({ value, label }: { value: number; label?: string }) {
  const [display, setDisplay] = useState(value)
  useEffect(() => {
    const id = requestAnimationFrame(() => setDisplay(value))
    return () => cancelAnimationFrame(id)
  }, [value])
  return (
    <div className="flex flex-col items-end">
      {label && <span className="text-[10px] uppercase tracking-widest text-white/40">{label}</span>}
      <span className="font-mono text-2xl font-bold tracking-tight text-white sm:text-3xl transition-all duration-300">
        {formatPrice(display)}
      </span>
    </div>
  )
}

/* ──────────────── MAIN COMPONENT ──────────────── */
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
  const [hoveredBike, setHoveredBike] = useState<string | null>(null)

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

  const tabDisabled: Record<string, boolean> = {
    model: false,
    config: !selectedBike,
    addons: !selectedBike,
    summary: !selectedBike,
  }

  // Group parts by category for addons
  const partsByCategory = useMemo(() => {
    const groups: Record<string, ConfiguratorPart[]> = {}
    for (const p of parts) {
      const cat = (p.specs as any)?.category ?? 'other'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(p)
    }
    return groups
  }, [parts])

  const CATEGORY_LABELS: Record<string, string> = {
    battery: 'Аккумуляторы',
    safety: 'Безопасность',
    brakes: 'Тормоза',
    performance: 'Производительность',
    electronics: 'Электроника',
    accessories: 'Аксессуары',
    suspension: 'Подвеска',
    wheels: 'Колёса',
  }

  return (
    <>
      {/* ── Global styles injected once ── */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap');

        :root {
          --cfg-bg: #09090b;
          --cfg-surface: #111113;
          --cfg-surface-raised: #1a1a1f;
          --cfg-border: #27272a;
          --cfg-border-hover: #3f3f46;
          --cfg-text: #fafafa;
          --cfg-text-muted: #a1a1aa;
          --cfg-text-dim: #71717a;
          --cfg-accent: #00ffea;
          --cfg-accent-dim: #00ffea30;
          --cfg-accent-glow: #00ffea15;
          --cfg-danger: #ef4444;
        }

        .cfg-root {
          font-family: 'Inter', system-ui, sans-serif;
          background: var(--cfg-bg);
          color: var(--cfg-text);
          -webkit-font-smoothing: antialiased;
        }

        .cfg-mono {
          font-family: 'JetBrains Mono', monospace;
        }

        /* Smooth page transitions */
        .cfg-fade-in {
          animation: cfgFadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes cfgFadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* Card hover lift */
        .cfg-card-hover {
          transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.35s ease, border-color 0.3s ease;
        }
        .cfg-card-hover:hover {
          transform: translateY(-4px);
          box-shadow: 0 20px 60px -15px rgba(0,0,0,0.5);
          border-color: var(--cfg-border-hover);
        }

        /* Selected ring pulse */
        .cfg-selected-ring {
          box-shadow: 0 0 0 2px var(--cfg-accent), 0 0 30px var(--cfg-accent-dim);
          border-color: var(--cfg-accent) !important;
        }

        /* Motor / battery option hover */
        .cfg-option {
          transition: all 0.2s ease;
          cursor: pointer;
        }
        .cfg-option:hover {
          background: var(--cfg-surface-raised);
          border-color: var(--cfg-border-hover);
        }
        .cfg-option-active {
          background: var(--cfg-accent-glow) !important;
          border-color: var(--cfg-accent) !important;
          box-shadow: 0 0 20px var(--cfg-accent-dim);
        }

        /* Custom radio dot */
        .cfg-radio-dot {
          appearance: none;
          width: 18px; height: 18px;
          border: 2px solid var(--cfg-border-hover);
          border-radius: 50%;
          position: relative;
          transition: all 0.2s ease;
          flex-shrink: 0;
        }
        .cfg-radio-dot:checked {
          border-color: var(--cfg-accent);
          background: var(--cfg-accent);
          box-shadow: inset 0 0 0 3px var(--cfg-bg);
        }

        /* Custom checkbox */
        .cfg-check {
          appearance: none;
          width: 18px; height: 18px;
          border: 2px solid var(--cfg-border-hover);
          border-radius: 5px;
          position: relative;
          transition: all 0.2s ease;
          flex-shrink: 0;
          cursor: pointer;
        }
        .cfg-check:checked {
          border-color: var(--cfg-accent);
          background: var(--cfg-accent);
        }
        .cfg-check:checked::after {
          content: '✓';
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          font-size: 11px;
          font-weight: 900;
          color: #000;
        }

        /* Price range slider override */
        .cfg-slider [role="slider"] {
          background: var(--cfg-accent) !important;
          border: 3px solid var(--cfg-bg) !important;
          box-shadow: 0 0 10px var(--cfg-accent-dim) !important;
        }
        .cfg-slider span[data-orientation="horizontal"] {
          background: var(--cfg-accent) !important;
        }

        /* Sticky price bar */
        .cfg-sticky-bar {
          backdrop-filter: blur(20px) saturate(150%);
          -webkit-backdrop-filter: blur(20px) saturate(150%);
        }

        /* Grain overlay */
        .cfg-grain::before {
          content: '';
          position: fixed;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
          pointer-events: none;
          z-index: 9999;
        }

        /* Scrollbar */
        .cfg-root::-webkit-scrollbar { width: 6px; }
        .cfg-root::-webkit-scrollbar-track { background: transparent; }
        .cfg-root::-webkit-scrollbar-thumb { background: #27272a; border-radius: 3px; }

        /* Image shimmer on load */
        .cfg-img-wrap {
          background: linear-gradient(110deg, #1a1a1f 8%, #222 18%, #1a1a1f 33%);
          background-size: 200% 100%;
          animation: shimmer 1.5s linear infinite;
        }
        @keyframes shimmer {
          to { background-position: -200% 0; }
        }

        /* Staggered grid entrance */
        .cfg-stagger > * {
          opacity: 0;
          animation: cfgFadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .cfg-stagger > *:nth-child(1)  { animation-delay: 0.02s; }
        .cfg-stagger > *:nth-child(2)  { animation-delay: 0.06s; }
        .cfg-stagger > *:nth-child(3)  { animation-delay: 0.10s; }
        .cfg-stagger > *:nth-child(4)  { animation-delay: 0.14s; }
        .cfg-stagger > *:nth-child(5)  { animation-delay: 0.18s; }
        .cfg-stagger > *:nth-child(6)  { animation-delay: 0.22s; }
        .cfg-stagger > *:nth-child(7)  { animation-delay: 0.26s; }
        .cfg-stagger > *:nth-child(8)  { animation-delay: 0.30s; }
        .cfg-stagger > *:nth-child(9)  { animation-delay: 0.34s; }
        .cfg-stagger > *:nth-child(10) { animation-delay: 0.38s; }
        .cfg-stagger > *:nth-child(11) { animation-delay: 0.42s; }
        .cfg-stagger > *:nth-child(12) { animation-delay: 0.46s; }
        .cfg-stagger > *:nth-child(13) { animation-delay: 0.50s; }
        .cfg-stagger > *:nth-child(14) { animation-delay: 0.54s; }
        .cfg-stagger > *:nth-child(15) { animation-delay: 0.58s; }
        .cfg-stagger > *:nth-child(16) { animation-delay: 0.62s; }

        /* Glow button */
        .cfg-glow-btn {
          position: relative;
          overflow: hidden;
          transition: all 0.3s ease;
        }
        .cfg-glow-btn::before {
          content: '';
          position: absolute;
          inset: -2px;
          background: conic-gradient(from 0deg, var(--cfg-accent), transparent, var(--cfg-accent));
          border-radius: inherit;
          animation: spin 3s linear infinite;
          opacity: 0;
          transition: opacity 0.3s;
          z-index: -1;
        }
        .cfg-glow-btn:hover::before {
          opacity: 1;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <section className="cfg-root cfg-grain relative min-h-screen">
        {/* ── HERO HEADER ── */}
        <div className="relative overflow-hidden border-b border-[#27272a]">
          {/* Ambient glow */}
          <div className="absolute -top-40 left-1/2 h-[500px] w-[800px] -translate-x-1/2 rounded-full opacity-20" style={{ background: 'radial-gradient(ellipse, #c8ff00 0%, transparent 70%)' }} />

          <div className="relative mx-auto max-w-6xl px-4 pb-8 pt-10 sm:pt-14">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="cfg-mono mb-2 text-[11px] font-medium uppercase tracking-[0.25em] text-[#c8ff00]">Конфигуратор</p>
                <h1 className="text-3xl font-black leading-[1.1] tracking-tight sm:text-5xl">
                  Собери свой
                  <br />
                  <span className="text-[#c8ff00]">электробайк</span>
                </h1>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-[#a1a1aa]">
                  Выбери модель, настрой мотор и батарею, добавь опции — получи точную цену за секунды.
                </p>
              </div>
              {selectedBike && (
                <LivePrice value={total} label="Текущая конфигурация" />
              )}
            </div>
          </div>
        </div>

        {/* ── MAIN CONTENT ── */}
        <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
          <StepBar current={tab} goTo={(s) => setTab(s as typeof tab)} disabled={tabDisabled} />

          {/* ═══════════════════ STEP 1: MODEL ═══════════════════ */}
          {tab === 'model' && (
            <div className="cfg-fade-in space-y-6">
              {/* Price filter */}
              <div className="rounded-2xl border border-[#27272a] bg-[#111113] p-5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium uppercase tracking-widest text-[#71717a]">Диапазон цены</Label>
                  <span className="cfg-mono text-sm font-bold text-[#c8ff00]">
                    {formatPrice(priceRange[0])} — {formatPrice(priceRange[1])}
                  </span>
                </div>
                <Slider
                  value={priceRange}
                  onValueChange={setPriceRange}
                  min={100000}
                  max={500000}
                  step={10000}
                  className="cfg-slider mt-4"
                />
                <div className="mt-2 flex justify-between text-[10px] text-[#71717a]">
                  <span>100 000 ₽</span>
                  <span>500 000 ₽</span>
                </div>
              </div>

              {/* Results count */}
              <p className="cfg-mono text-xs text-[#71717a]">
                Найдено: <span className="font-bold text-white">{filteredBikes.length}</span> моделей
              </p>

              {/* Bike grid */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 cfg-stagger">
                {filteredBikes.map((bike) => {
                  const isSelected = selectedBikeId === bike.id
                  const tier = bike.specs.tier
                  return (
                    <article
                      key={bike.id}
                      className={[
                        'group relative overflow-hidden rounded-2xl border bg-[#111113] cfg-card-hover',
                        isSelected ? 'cfg-selected-ring border-[#c8ff00]' : 'border-[#27272a]',
                      ].join(' ')}
                      onMouseEnter={() => setHoveredBike(bike.id)}
                      onMouseLeave={() => setHoveredBike(null)}
                    >
                      <button
                        type="button"
                        className="block w-full text-left"
                        onClick={() => selectBike(bike.id)}
                      >
                        {/* Image */}
                        <div className="cfg-img-wrap relative aspect-[4/3] w-full overflow-hidden">
                          <Image
                            src={bike.image_url}
                            alt={`${bike.make} ${bike.model}`}
                            fill
                            className="object-cover transition-transform duration-700 group-hover:scale-105"
                            unoptimized
                          />
                          {/* Overlay gradient */}
                          <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-transparent to-transparent opacity-60" />

                          {/* Tier badge */}
                          <div className="absolute left-3 top-3">
                            <TierBadge tier={tier} />
                          </div>

                          {/* Selected indicator */}
                          {isSelected && (
                            <div className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-[#c8ff00] shadow-lg shadow-[#c8ff00]/30">
                              <Check className="h-4 w-4 text-black" />
                            </div>
                          )}

                          {/* Price overlay */}
                          <div className="absolute bottom-3 left-3 right-3">
                            <p className="cfg-mono text-xl font-bold text-white drop-shadow-lg">
                              {formatPrice(bike.daily_price)}
                            </p>
                          </div>
                        </div>

                        {/* Info */}
                        <div className="p-4">
                          <div className="mb-1.5 flex items-center gap-2">
                            <h3 className="text-sm font-bold tracking-tight text-white">
                              {bike.make} {bike.model}
                            </h3>
                          </div>
                          <p className="line-clamp-2 text-xs leading-relaxed text-[#a1a1aa]">
                            {bike.description}
                          </p>
                          {/* Specs row */}
                          <div className="mt-3 flex items-center gap-3 text-[10px] uppercase tracking-widest text-[#71717a]">
                            <span className="flex items-center gap-1">
                              <Zap className="h-3 w-3" />
                              {bike.specs.power_w}W
                            </span>
                            <span className="flex items-center gap-1">
                              <Gauge className="h-3 w-3" />
                              {bike.specs.max_speed_kmh} км/ч
                            </span>
                          </div>
                        </div>
                      </button>
                    </article>
                  )
                })}
              </div>

              {filteredBikes.length === 0 && (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#27272a] py-16">
                  <p className="text-sm text-[#71717a]">Нет моделей в этом диапазоне цен</p>
                  <Button variant="ghost" className="mt-3 text-xs text-[#a1a1aa]" onClick={() => setPriceRange([100000, 500000])}>
                    Сбросить фильтр
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════ STEP 2: CONFIG ═══════════════════ */}
          {tab === 'config' && selectedBike && (
            <div className="cfg-fade-in space-y-6">
              {/* Bike header with gallery */}
              <div className="overflow-hidden rounded-2xl border border-[#27272a] bg-[#111113]">
                <div className="relative aspect-[21/9] w-full overflow-hidden sm:aspect-[3/1]">
                  <Image
                    src={selectedBike.image_url}
                    alt={`${selectedBike.make} ${selectedBike.model}`}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-[#09090b] via-[#09090b]/60 to-transparent" />
                  <div className="absolute bottom-0 left-0 p-6 sm:p-8">
                    <TierBadge tier={selectedBike.specs.tier} />
                    <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-4xl">
                      {selectedBike.make} {selectedBike.model}
                    </h2>
                    <p className="mt-1 max-w-lg text-sm text-[#a1a1aa]">{selectedBike.description}</p>
                  </div>
                </div>

                {/* Gallery thumbnails */}
                {selectedBike.specs.gallery && selectedBike.specs.gallery.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto border-t border-[#27272a] p-3">
                    {[selectedBike.image_url, ...selectedBike.specs.gallery].map((img, i) => (
                      <div key={img + i} className="relative h-16 w-24 flex-shrink-0 overflow-hidden rounded-lg border border-[#27272a]">
                        <Image src={img} alt="" fill className="object-cover" unoptimized />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Motor selection */}
              <div className="rounded-2xl border border-[#27272a] bg-[#111113] p-5 sm:p-6">
                <div className="mb-4 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#c8ff00]/10">
                    <Zap className="h-4 w-4 text-[#c8ff00]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold">Мощность мотора</h3>
                    <p className="text-[11px] text-[#71717a]">Влияет на динамику и максимальную скорость</p>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {availableMotors.map((motor) => {
                    const active = motorPower === motor.value
                    return (
                      <label
                        key={motor.value}
                        className={[
                          'cfg-option flex items-center justify-between rounded-xl border p-4',
                          active ? 'cfg-option-active' : 'border-[#27272a]',
                        ].join(' ')}
                      >
                        <span className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="motor"
                            className="cfg-radio-dot"
                            value={motor.value}
                            checked={active}
                            onChange={() => setMotorPower(motor.value)}
                          />
                          <span>
                            <span className="block text-sm font-semibold">{motor.value}W</span>
                            <span className="block text-[11px] text-[#71717a]">
                              {motor.extra === 0 ? 'Базовая комплектация' : `+${formatPrice(motor.extra)}`}
                            </span>
                          </span>
                        </span>
                        {motor.extra > 0 && (
                          <span className="cfg-mono text-xs font-medium text-[#a1a1aa]">+{formatPrice(motor.extra)}</span>
                        )}
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Battery selection */}
              {selectedBike.model !== 'A4' && (
                <div className="rounded-2xl border border-[#27272a] bg-[#111113] p-5 sm:p-6">
                  <div className="mb-4 flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                      <Battery className="h-4 w-4 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold">Аккумулятор</h3>
                      <p className="text-[11px] text-[#71717a]">Тип и ёмкость определяют запас хода</p>
                    </div>
                  </div>

                  {/* Battery type toggle */}
                  <div className="mb-4 inline-flex rounded-xl border border-[#27272a] bg-[#09090b] p-1">
                    {(['regular', 'lithium'] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => {
                          setBatteryMode(mode)
                          const first = mode === 'regular' ? regularBatteries[0] : lithiumBatteries[0]
                          setBatteryCapacity(first?.capacity ?? '')
                        }}
                        className={[
                          'rounded-lg px-4 py-2 text-xs font-semibold transition-all',
                          batteryMode === mode
                            ? 'bg-[#c8ff00] text-black shadow-md'
                            : 'text-[#71717a] hover:text-white',
                        ].join(' ')}
                      >
                        {mode === 'regular' ? 'Regular' : 'Lithium'}
                      </button>
                    ))}
                  </div>

                  {/* Battery capacity options */}
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(batteryMode === 'regular' ? regularBatteries : lithiumBatteries).map((battery) => {
                      const active = batteryCapacity === battery.capacity
                      return (
                        <label
                          key={`${batteryMode}-${battery.capacity}`}
                          className={[
                            'cfg-option flex items-center justify-between rounded-xl border p-4',
                            active ? 'cfg-option-active' : 'border-[#27272a]',
                          ].join(' ')}
                        >
                          <span className="flex items-center gap-3">
                            <input
                              type="radio"
                              name="battery"
                              className="cfg-radio-dot"
                              value={battery.capacity}
                              checked={active}
                              onChange={() => setBatteryCapacity(battery.capacity)}
                            />
                            <span>
                              <span className="block text-sm font-semibold">{battery.capacity}</span>
                              <span className="block text-[11px] text-[#71717a]">
                                Запас хода: {battery.range_km} км
                              </span>
                            </span>
                          </span>
                          <span className="cfg-mono text-xs font-medium text-[#a1a1aa]">
                            {battery.battery_price === 0 ? 'Вкл.' : `+${formatPrice(battery.battery_price)}`}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  onClick={() => setTab('model')}
                  className="text-[#71717a] hover:text-white"
                >
                  ← Назад
                </Button>
                <Button
                  onClick={() => setTab('addons')}
                  className="cfg-glow-btn flex-1 bg-[#c8ff00] font-bold text-black hover:bg-[#d4ff33] sm:flex-none"
                >
                  Дальше: опции
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ═══════════════════ STEP 3: ADDONS ═══════════════════ */}
          {tab === 'addons' && selectedBike && (
            <div className="cfg-fade-in space-y-6">
              {Object.entries(partsByCategory).map(([category, categoryParts]) => {
                const Icon = PART_CATEGORY_ICONS[category] || Sparkles
                return (
                  <div key={category} className="rounded-2xl border border-[#27272a] bg-[#111113] p-5 sm:p-6">
                    <div className="mb-4 flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5">
                        <Icon className="h-4 w-4 text-[#a1a1aa]" />
                      </div>
                      <h3 className="text-sm font-bold">{CATEGORY_LABELS[category] ?? category}</h3>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {categoryParts.map((part) => {
                        const checked = selectedAccessories.includes(part.id)
                        return (
                          <label
                            key={part.id}
                            className={[
                              'cfg-option flex items-start justify-between gap-3 rounded-xl border p-4',
                              checked ? 'cfg-option-active' : 'border-[#27272a]',
                            ].join(' ')}
                          >
                            <span className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                className="cfg-check mt-0.5"
                                checked={checked}
                                onChange={() =>
                                  setSelectedAccessories((prev) =>
                                    prev.includes(part.id)
                                      ? prev.filter((id) => id !== part.id)
                                      : [...prev, part.id],
                                  )
                                }
                              />
                              <span>
                                <span className="block text-sm font-semibold">{part.model}</span>
                                <span className="mt-0.5 block text-[11px] leading-relaxed text-[#71717a]">
                                  {part.description}
                                </span>
                              </span>
                            </span>
                            <span className="cfg-mono whitespace-nowrap text-xs font-medium text-[#a1a1aa]">
                              +{formatPrice(part.daily_price)}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )
              })}

              {/* Selected count */}
              {selectedAccessories.length > 0 && (
                <div className="flex items-center justify-between rounded-xl border border-[#c8ff00]/20 bg-[#c8ff00]/5 px-4 py-3">
                  <span className="text-sm text-[#a1a1aa]">
                    Выбрано опций: <span className="font-bold text-white">{selectedAccessories.length}</span>
                  </span>
                  <span className="cfg-mono text-sm font-bold text-[#c8ff00]">
                    +{formatPrice(accessoriesTotal)}
                  </span>
                </div>
              )}

              {/* Navigation */}
              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => setTab('config')} className="text-[#71717a] hover:text-white">
                  ← Назад
                </Button>
                <Button
                  onClick={() => setTab('summary')}
                  className="cfg-glow-btn flex-1 bg-[#c8ff00] font-bold text-black hover:bg-[#d4ff33] sm:flex-none"
                >
                  Дальше: итог
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ═══════════════════ STEP 4: SUMMARY ═══════════════════ */}
          {tab === 'summary' && selectedBike && (
            <div className="cfg-fade-in space-y-6">
              <div className="grid gap-6 lg:grid-cols-5">
                {/* Left: config breakdown */}
                <div className="lg:col-span-3 space-y-4">
                  {/* Bike hero */}
                  <div className="overflow-hidden rounded-2xl border border-[#27272a] bg-[#111113]">
                    <div className="relative aspect-[16/7] w-full overflow-hidden">
                      <Image src={selectedBike.image_url} alt="" fill className="object-cover" unoptimized />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#111113] via-transparent to-transparent" />
                    </div>
                    <div className="p-5">
                      <TierBadge tier={selectedBike.specs.tier} />
                      <h2 className="mt-2 text-xl font-black">{selectedBike.make} {selectedBike.model}</h2>
                    </div>
                  </div>

                  {/* Specs grid */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      { icon: Zap, label: 'Мотор', value: `${selectedMotor?.value ?? '3000'}W` },
                      { icon: Battery, label: 'Батарея', value: activeBattery ? activeBattery.capacity : '—' },
                      { icon: Gauge, label: 'Скорость', value: `${selectedBike.specs.max_speed_kmh} км/ч` },
                      { icon: Shield, label: 'Запас хода', value: activeBattery ? `${activeBattery.range_km} км` : '—' },
                    ].map(({ icon: Icon, label, value }) => (
                      <div key={label} className="rounded-xl border border-[#27272a] bg-[#111113] p-3">
                        <Icon className="mb-1.5 h-4 w-4 text-[#71717a]" />
                        <p className="cfg-mono text-lg font-bold">{value}</p>
                        <p className="text-[10px] uppercase tracking-widest text-[#71717a]">{label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Selected accessories */}
                  {selectedAccessories.length > 0 && (
                    <div className="rounded-xl border border-[#27272a] bg-[#111113] p-4">
                      <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-[#71717a]">Доп. опции</h4>
                      <div className="space-y-2">
                        {selectedAccessories.map((id) => {
                          const part = parts.find((p) => p.id === id)
                          if (!part) return null
                          return (
                            <div key={id} className="flex items-center justify-between text-sm">
                              <span className="flex items-center gap-2 text-[#a1a1aa]">
                                <Check className="h-3.5 w-3.5 text-[#c8ff00]" />
                                {part.model}
                              </span>
                              <span className="cfg-mono text-xs">+{formatPrice(part.daily_price)}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: price breakdown + CTA */}
                <div className="lg:col-span-2">
                  <div className="sticky top-6 space-y-4">
                    <div className="rounded-2xl border border-[#27272a] bg-[#111113] p-5 sm:p-6">
                      <h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-[#71717a]">Расчёт стоимости</h3>

                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                          <span className="text-[#a1a1aa]">{selectedBike.make} {selectedBike.model}</span>
                          <span className="cfg-mono font-medium">{formatPrice(selectedBike.daily_price)}</span>
                        </div>
                        {(selectedMotor?.extra ?? 0) > 0 && (
                          <div className="flex justify-between">
                            <span className="text-[#a1a1aa]">Мотор {selectedMotor?.value}W</span>
                            <span className="cfg-mono font-medium">+{formatPrice(selectedMotor?.extra ?? 0)}</span>
                          </div>
                        )}
                        {selectedBike.model !== 'A4' && activeBattery && activeBattery.battery_price > 0 && (
                          <div className="flex justify-between">
                            <span className="text-[#a1a1aa]">Батарея {activeBattery.capacity}</span>
                            <span className="cfg-mono font-medium">+{formatPrice(activeBattery.battery_price)}</span>
                          </div>
                        )}
                        {accessoriesTotal > 0 && (
                          <div className="flex justify-between">
                            <span className="text-[#a1a1aa]">Доп. опции ({selectedAccessories.length})</span>
                            <span className="cfg-mono font-medium">+{formatPrice(accessoriesTotal)}</span>
                          </div>
                        )}
                        {deliveryApplied && (
                          <div className="flex justify-between">
                            <span className="text-[#a1a1aa]">Доставка</span>
                            <span className="cfg-mono font-medium">+{formatPrice(DELIVERY_AVERAGE)}</span>
                          </div>
                        )}
                      </div>

                      <Separator className="my-4 bg-[#27272a]" />

                      <div className="flex items-baseline justify-between">
                        <span className="text-sm font-bold uppercase tracking-widest text-[#71717a]">Итого</span>
                        <span className="cfg-mono text-3xl font-black text-[#c8ff00]">{formatPrice(total)}</span>
                      </div>

                      {/* Delivery toggle */}
                      <button
                        onClick={() => setDeliveryApplied((v) => !v)}
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#27272a] py-3 text-xs text-[#71717a] transition-all hover:border-[#c8ff00]/30 hover:text-white"
                      >
                        <Truck className="h-4 w-4" />
                        {deliveryApplied ? 'Убрать доставку' : `Добавить доставку (+${formatPrice(DELIVERY_AVERAGE)})`}
                      </button>
                    </div>

                    {/* CTA buttons */}
                    <div className="space-y-2">
                      <Button
                        onClick={submitLead}
                        disabled={isPending}
                        className="cfg-glow-btn w-full bg-[#c8ff00] py-6 text-sm font-bold text-black hover:bg-[#d4ff33]"
                      >
                        <MessageCircle className="mr-2 h-4 w-4" />
                        Отправить в Telegram
                      </Button>
                      <Button
                        asChild
                        variant="outline"
                        className="w-full border-[#27272a] bg-transparent py-6 text-sm font-semibold text-white hover:bg-white/5 hover:text-white"
                      >
                        <a href="https://t.me/I_O_S_NN" target="_blank" rel="noopener noreferrer">
                          Оформить покупку
                        </a>
                      </Button>
                      <Button
                        asChild
                        variant="ghost"
                        className="w-full text-xs text-[#71717a] hover:text-white"
                      >
                        <Link href={`/franchize/${crew.slug || slug}/contacts`}>
                          Контакты франшизы
                        </Link>
                      </Button>
                    </div>

                    {/* Back */}
                    <Button
                      variant="ghost"
                      onClick={() => setTab('addons')}
                      className="w-full text-[#71717a] hover:text-white"
                    >
                      ← Вернуться к опциям
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── FLOATING MOBILE PRICE BAR ── */}
        {selectedBike && (
          <div className="cfg-sticky-bar fixed inset-x-0 bottom-0 z-50 border-t border-[#27272a] bg-[#09090b]/90 px-4 py-3 sm:hidden">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[#71717a]">{selectedBike.make} {selectedBike.model}</p>
                <p className="cfg-mono text-xl font-black text-[#c8ff00]">{formatPrice(total)}</p>
              </div>
              <Button
                onClick={() => setTab('summary')}
                size="sm"
                className="bg-[#c8ff00] font-bold text-black"
              >
                Итог
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </section>
    </>
  )
}
