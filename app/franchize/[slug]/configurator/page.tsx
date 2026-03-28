'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Battery, Check, Gauge, Info, MessageCircle, PackageCheck, Shield, Truck, Wrench, Zap } from 'lucide-react'

import BikeFooter from '@/components/BikeFooter'
import BikeHeader from '@/components/BikeHeader'
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

const hardcodedBikes: ConfiguratorBike[] = [
  { id: 'vipbike-g8', make: 'VipBike', model: 'G8', description: 'Городской универсал с уверенной динамикой.', daily_price: 120800, image_url: `${CARPIX_BASE}/vipbike-g8/image_1.jpg`, rent_link: null, specs: { power_w: 3000, power_kw: 3, max_speed_kmh: '90-150', tier: 'standard', gallery: [`${CARPIX_BASE}/vipbike-g8/image_1.jpg`, `${CARPIX_BASE}/vipbike-g8/image_2.jpg`, `${CARPIX_BASE}/vipbike-g8/image_3.jpg`], battery_options: { base_price: 120800, batteries: [ { capacity: '50Ah', type: 'regular', battery_price: 44500, total_price: 165300, range_km: '70-110' }, { capacity: '60Ah', type: 'regular', battery_price: 55000, total_price: 175800, range_km: '80-120' }, { capacity: '80Ah', type: 'regular', battery_price: 59000, total_price: 179800, range_km: '90-150' } ] } }, type: 'bike', quantity: 1 },
  { id: 'vipbike-dmg', make: 'VipBike', model: 'DMG', description: 'Премиальная комплектация и топовая отделка.', daily_price: 159200, image_url: `${CARPIX_BASE}/vipbike-dmg/image_1.jpg`, rent_link: null, specs: { power_w: 3000, power_kw: 3, max_speed_kmh: '90-150', tier: 'premium', gallery: [`${CARPIX_BASE}/vipbike-dmg/image_1.jpg`, `${CARPIX_BASE}/vipbike-dmg/image_2.jpg`, `${CARPIX_BASE}/vipbike-dmg/image_3.jpg`], battery_options: { base_price: 159200, batteries: [ { capacity: '50Ah', type: 'regular', battery_price: 44500, total_price: 203700, range_km: '70-110' }, { capacity: '60Ah', type: 'regular', battery_price: 55000, total_price: 214200, range_km: '80-120' }, { capacity: '80Ah', type: 'regular', battery_price: 59000, total_price: 218200, range_km: '90-150' } ] } }, type: 'bike', quantity: 1 },
  { id: 'vipbike-r6', make: 'VipBike', model: 'R6', description: 'Спортивная посадка и агрессивный дизайн.', daily_price: 148400, image_url: `${CARPIX_BASE}/vipbike-r6/image_1.jpg`, rent_link: null, specs: { power_w: 3000, power_kw: 3, max_speed_kmh: '90-150', tier: 'sport', gallery: [`${CARPIX_BASE}/vipbike-r6/image_1.jpg`, `${CARPIX_BASE}/vipbike-r6/image_2.jpg`, `${CARPIX_BASE}/vipbike-r6/image_3.jpg`], battery_options: { base_price: 148400, batteries: [ { capacity: '50Ah', type: 'regular', battery_price: 44500, total_price: 192900, range_km: '70-110' }, { capacity: '60Ah', type: 'regular', battery_price: 55000, total_price: 203400, range_km: '80-120' }, { capacity: '80Ah', type: 'regular', battery_price: 59000, total_price: 207400, range_km: '90-150' } ] } }, type: 'bike', quantity: 1 },
  { id: 'vipbike-a4', make: 'VipBike', model: 'A4', description: 'Флагман 10000W, для максимальной производительности.', daily_price: 490000, image_url: `${CARPIX_BASE}/vipbike-a4/image_1.jpg`, rent_link: null, specs: { power_w: 10000, power_kw: 10, max_speed_kmh: '150+', tier: 'high-performance', gallery: [`${CARPIX_BASE}/vipbike-a4/image_1.jpg`, `${CARPIX_BASE}/vipbike-a4/image_2.jpg`, `${CARPIX_BASE}/vipbike-a4/image_3.jpg`], battery_options: { base_price: 490000, batteries: [{ capacity: 'Included', type: 'lithium', battery_price: 0, total_price: 490000, range_km: '200+' }] } }, type: 'bike', quantity: 1 },
]

const hardcodedParts: ConfiguratorPart[] = [
  { id: 'vipbike-helmet-e4', make: 'VipBike', model: 'Шлем E4 (Tensun)', description: 'Премиальный шлем', daily_price: 8300, image_url: `${CARPIX_BASE}/parts/helmet_e4.jpg`, specs: { category: 'safety' }, type: 'parts' },
  { id: 'vipbike-abs-system', make: 'VipBike', model: 'ABS система', description: 'Антиблокировка тормозов', daily_price: 16700, image_url: `${CARPIX_BASE}/parts/abs_system.jpg`, specs: { category: 'safety' }, type: 'parts' },
  { id: 'vipbike-brembo-brakes', make: 'VipBike', model: 'Тормоза Brembo', description: 'Тормозная система Brembo', daily_price: 12400, image_url: `${CARPIX_BASE}/parts/brembo_brakes.jpg`, specs: { category: 'performance' }, type: 'parts' },
  { id: 'vipbike-tft-display', make: 'VipBike', model: 'TFT дисплей', description: 'Цифровой дисплей', daily_price: 8300, image_url: `${CARPIX_BASE}/parts/tft_display.jpg`, specs: { category: 'electronics' }, type: 'parts' },
  { id: 'vipbike-bluetooth-alarm', make: 'VipBike', model: 'Противоугонная Bluetooth', description: 'Противоугонный модуль', daily_price: 5600, image_url: `${CARPIX_BASE}/parts/bluetooth_alarm.jpg`, specs: { category: 'security' }, type: 'parts' },
  { id: 'vipbike-cnc-footpegs', make: 'VipBike', model: 'CNC подножки', description: 'Алюминиевые подножки', daily_price: 9700, image_url: `${CARPIX_BASE}/parts/cnc_footpegs.jpg`, specs: { category: 'accessories' }, type: 'parts' },
]

const lithiumBatteries: ConfiguratorBatteryOption[] = [
  { capacity: '50Ah', type: 'lithium', battery_price: 82000, total_price: 0, range_km: '70-110' },
  { capacity: '60Ah', type: 'lithium', battery_price: 90000, total_price: 0, range_km: '80-120' },
  { capacity: '80Ah', type: 'lithium', battery_price: 98000, total_price: 0, range_km: '90-150' },
  { capacity: '120Ah', type: 'lithium', battery_price: 106000, total_price: 0, range_km: '120-220' },
  { capacity: '160Ah', type: 'lithium', battery_price: 106000, total_price: 0, range_km: '160-260' },
]

const formatPrice = (price: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(price) + ' ₽'

export default function ConfiguratorPage() {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()

  const [bikes, setBikes] = useState<ConfiguratorBike[]>(hardcodedBikes)
  const [parts, setParts] = useState<ConfiguratorPart[]>(hardcodedParts)

  const [priceRange, setPriceRange] = useState([100000, 500000])
  const [selectedBikeId, setSelectedBikeId] = useState<string>(hardcodedBikes[0]?.id || '')
  const [motorPower, setMotorPower] = useState<string>('base')
  const [batteryMode, setBatteryMode] = useState<'regular' | 'lithium'>('regular')
  const [selectedBattery, setSelectedBattery] = useState<string>('')
  const [selectedAccessories, setSelectedAccessories] = useState<string[]>([])
  const [deliveryApplied, setDeliveryApplied] = useState(false)

  useEffect(() => {
    startTransition(async () => {
      const data = await loadConfiguratorCatalog()
      if (data.hasLiveEbikeData) {
        setBikes(data.ebikes)
        setSelectedBikeId(data.ebikes[0]?.id || '')
      }
      if (data.hasLivePartsData) setParts(data.parts)
      if (!data.hasLiveEbikeData) {
        toast({ title: 'Используется fallback каталог', description: 'В public.cars нет записей type="ebike", показываем подготовленный прайс.' })
      }
    })
  }, [toast])

  const selectedBike = useMemo(() => bikes.find((bike) => bike.id === selectedBikeId) ?? null, [bikes, selectedBikeId])

  const filteredBikes = useMemo(() => bikes.filter((bike) => bike.daily_price >= priceRange[0] && bike.daily_price <= priceRange[1]), [bikes, priceRange])

  const availableMotors = useMemo(() => {
    const base = selectedBike?.specs?.power_w || 3000
    if (base >= 10000) return [{ label: '10000W (база)', extra: 0, value: '10000' }]
    return [
      { label: '3000W (база)', extra: 0, value: '3000' },
      { label: '5000W (+79 000 ₽)', extra: 79000, value: '5000' },
      { label: '8000W (+90 000 ₽)', extra: 90000, value: '8000' },
      { label: '10000W (+167 000 ₽)', extra: 167000, value: '10000' },
    ]
  }, [selectedBike])

  const selectedMotor = useMemo(() => availableMotors.find((motor) => motor.value === motorPower) ?? availableMotors[0], [availableMotors, motorPower])

  const regularBatteries = useMemo(
    () => selectedBike?.specs?.battery_options?.batteries ?? [],
    [selectedBike],
  )

  useEffect(() => {
    if (!selectedBike) return
    const defaultBattery = regularBatteries[0]?.capacity || lithiumBatteries[0]?.capacity || ''
    setSelectedBattery(defaultBattery)
    setBatteryMode(selectedBike.model === 'A4' ? 'lithium' : 'regular')
    setMotorPower(String(selectedBike.specs?.power_w || 3000))
    setSelectedAccessories([])
    setDeliveryApplied(false)
  }, [selectedBikeId, selectedBike, regularBatteries])

  const activeBattery = useMemo(() => {
    if (!selectedBike) return null
    if (batteryMode === 'regular') return regularBatteries.find((battery) => battery.capacity === selectedBattery) ?? regularBatteries[0] ?? null
    return lithiumBatteries.find((battery) => battery.capacity === selectedBattery) ?? lithiumBatteries[0] ?? null
  }, [selectedBike, batteryMode, regularBatteries, selectedBattery])

  const accessoriesTotal = useMemo(() => selectedAccessories.reduce((sum, id) => sum + (parts.find((part) => part.id === id)?.daily_price || 0), 0), [parts, selectedAccessories])

  const subtotal = useMemo(() => {
    if (!selectedBike) return 0
    const base = selectedBike.daily_price
    const motorExtra = selectedMotor?.extra || 0
    const batteryExtra = selectedBike.model === 'A4' ? 0 : (activeBattery?.battery_price || 0)
    return base + motorExtra + batteryExtra + accessoriesTotal
  }, [selectedBike, selectedMotor, activeBattery, accessoriesTotal])

  const total = subtotal + (deliveryApplied ? DELIVERY_AVERAGE : 0)

  const handleToggleAccessory = (partId: string) => {
    setSelectedAccessories((current) => (current.includes(partId) ? current.filter((id) => id !== partId) : [...current, partId]))
  }

  const handleSendLead = () => {
    if (!selectedBike) return
    const chosenAccessories = selectedAccessories
      .map((id) => parts.find((part) => part.id === id))
      .filter((part): part is ConfiguratorPart => Boolean(part))
      .map((part) => ({ name: part.model, price: part.daily_price }))

    startTransition(async () => {
      const result = await sendConfiguratorLead({
        bikeId: selectedBike.id,
        bikeLabel: `${selectedBike.make} ${selectedBike.model}`,
        motorLabel: selectedMotor?.label || `${selectedBike.specs?.power_w || 3000}W`,
        batteryLabel: activeBattery ? `${activeBattery.capacity} (${batteryMode})` : 'без выбора',
        selectedAccessories: chosenAccessories,
        withDelivery: deliveryApplied,
        deliveryPrice: DELIVERY_AVERAGE,
        total,
      })

      if (result.success) {
        toast({ title: 'Заявка отправлена в Telegram', description: 'Команда VIP BIKE получила вашу конфигурацию.' })
      } else {
        toast({ title: 'Не удалось отправить заявку', description: result.error || 'Попробуйте ещё раз.', variant: 'destructive' })
      }
    })
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <BikeHeader />

      <main className="container mx-auto px-4 pb-12 pt-28">
        <section className="mb-6 rounded-2xl border border-border bg-card/70 p-6">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-brand-orange/50 bg-brand-orange/10 px-3 py-1 text-sm text-brand-orange">
            <Info className="h-4 w-4" /> Почему электробайк стоит брать сегодня
          </div>
          <h1 className="font-orbitron text-3xl font-bold">VIP BIKE Configurator • /franchize/vip-bike/configurator</h1>
          <p className="mt-3 max-w-4xl text-muted-foreground">
            Электробайк — это экономия на топливе, меньше расходов на обслуживание, быстрый отклик мотора и возможность ездить каждый день без шума и выхлопа.
            Выберите модель, мотор, батарею и опции — конфигуратор сразу посчитает итог и подготовит заявку на покупку.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <Badge variant="outline"><Zap className="mr-1 h-3 w-3" />Мгновенный крутящий момент</Badge>
            <Badge variant="outline"><Shield className="mr-1 h-3 w-3" />Низкая стоимость обслуживания</Badge>
            <Badge variant="outline"><PackageCheck className="mr-1 h-3 w-3" />Проверенные позиции из прайса и docs/sql</Badge>
          </div>
        </section>

        <div className="mb-6 rounded-2xl border border-border bg-card/50 p-4">
          <Label className="text-sm text-muted-foreground">Фильтр по цене модели: {formatPrice(priceRange[0])} — {formatPrice(priceRange[1])}</Label>
          <Slider value={priceRange} onValueChange={setPriceRange} min={100000} max={500000} step={10000} className="mt-3" />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <section className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>1) Выберите электромотоцикл</CardTitle>
                <CardDescription>Нажмите на карточку или фото модели — откроется конфигурация.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  {filteredBikes.map((bike) => (
                    <button
                      type="button"
                      key={bike.id}
                      onClick={() => setSelectedBikeId(bike.id)}
                      className={`overflow-hidden rounded-xl border text-left transition ${selectedBikeId === bike.id ? 'border-primary shadow-lg shadow-primary/20' : 'border-border hover:border-primary/50'}`}
                    >
                      <div className="relative h-44 w-full">
                        <Image src={bike.image_url} alt={`${bike.make} ${bike.model}`} fill className="object-cover" />
                      </div>
                      <div className="p-4">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold">{bike.make} {bike.model}</h3>
                          <Badge variant="outline">{bike.specs?.power_w || 3000}W</Badge>
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{bike.description}</p>
                        <div className="mt-2 text-lg font-bold text-primary">{formatPrice(bike.daily_price)}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {selectedBike && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Фото выбранной модели</CardTitle>
                    <CardDescription>Галерея подтянута из specs.gallery / storage carpix.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                      {(selectedBike.specs?.gallery?.length ? selectedBike.specs.gallery : [selectedBike.image_url]).map((img) => (
                        <div key={img} className="relative h-36 overflow-hidden rounded-lg border border-border">
                          <Image src={img} alt={selectedBike.model} fill className="object-cover" />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>2) Мотор и батарея</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <Label className="mb-3 block">Тип мотора / мощность</Label>
                      <RadioGroup value={motorPower} onValueChange={setMotorPower} className="grid gap-2 md:grid-cols-2">
                        {availableMotors.map((motor) => (
                          <Label key={motor.value} className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3">
                            <RadioGroupItem value={motor.value} />
                            <span className="text-sm">{motor.label}</span>
                          </Label>
                        ))}
                      </RadioGroup>
                    </div>

                    {selectedBike.model !== 'A4' && (
                      <>
                        <div>
                          <Label className="mb-3 block">Тип батареи</Label>
                          <RadioGroup value={batteryMode} onValueChange={(value) => setBatteryMode(value as 'regular' | 'lithium')} className="grid grid-cols-2 gap-2">
                            <Label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3"><RadioGroupItem value="regular" />Regular</Label>
                            <Label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3"><RadioGroupItem value="lithium" />Lithium</Label>
                          </RadioGroup>
                        </div>
                        <div>
                          <Label className="mb-3 block">Размер батареи</Label>
                          <RadioGroup value={selectedBattery} onValueChange={setSelectedBattery} className="grid gap-2 md:grid-cols-2">
                            {(batteryMode === 'regular' ? regularBatteries : lithiumBatteries).map((battery) => (
                              <Label key={`${batteryMode}-${battery.capacity}`} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border p-3">
                                <span className="flex items-center gap-2 text-sm"><RadioGroupItem value={battery.capacity} />{battery.capacity}</span>
                                <span className="text-sm text-primary">+{formatPrice(battery.battery_price)}</span>
                              </Label>
                            ))}
                          </RadioGroup>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>3) Дополнительные опции (из правой части прайса)</CardTitle>
                    <CardDescription>Тормоза, безопасность, дисплеи и аксессуары.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-2 md:grid-cols-2">
                      {parts.map((part) => {
                        const checked = selectedAccessories.includes(part.id)
                        return (
                          <label key={part.id} className={`flex cursor-pointer items-start justify-between gap-3 rounded-lg border p-3 ${checked ? 'border-primary bg-primary/5' : 'border-border'}`}>
                            <span className="flex items-start gap-3">
                              <Checkbox checked={checked} onCheckedChange={() => handleToggleAccessory(part.id)} className="mt-1" />
                              <span>
                                <span className="block font-medium">{part.model}</span>
                                <span className="block text-xs text-muted-foreground">{part.description}</span>
                              </span>
                            </span>
                            <span className="text-sm font-semibold text-primary">+{formatPrice(part.daily_price)}</span>
                          </label>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </section>

          <aside className="lg:sticky lg:top-24 lg:h-fit">
            <Card>
              <CardHeader>
                <CardTitle>Итог покупки</CardTitle>
                <CardDescription>Расчёт обновляется сразу по выбранным параметрам.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {selectedBike ? (
                  <>
                    <div className="flex justify-between gap-2"><span className="text-muted-foreground">Модель</span><span className="text-right font-medium">{selectedBike.make} {selectedBike.model}</span></div>
                    <div className="flex justify-between gap-2"><span className="text-muted-foreground">Мотор</span><span>{selectedMotor?.label || '-'}</span></div>
                    <div className="flex justify-between gap-2"><span className="text-muted-foreground">Батарея</span><span>{activeBattery ? `${activeBattery.capacity} (${activeBattery.range_km} км)` : '—'}</span></div>
                    <Separator />
                    <div className="flex justify-between gap-2"><span className="text-muted-foreground">База</span><span>{formatPrice(selectedBike.daily_price)}</span></div>
                    <div className="flex justify-between gap-2"><span className="text-muted-foreground">Мотор доплата</span><span>{formatPrice(selectedMotor?.extra || 0)}</span></div>
                    <div className="flex justify-between gap-2"><span className="text-muted-foreground">Батарея</span><span>{formatPrice(selectedBike.model === 'A4' ? 0 : (activeBattery?.battery_price || 0))}</span></div>
                    <div className="flex justify-between gap-2"><span className="text-muted-foreground">Доп. опции</span><span>{formatPrice(accessoriesTotal)}</span></div>
                    <div className="rounded-lg border border-dashed border-primary/60 p-3">
                      <p className="mb-2 text-xs text-muted-foreground">Доставка по РФ (средняя): {formatPrice(DELIVERY_AVERAGE)}</p>
                      <Button type="button" variant="outline" className="w-full" onClick={() => setDeliveryApplied((v) => !v)}>
                        <Truck className="mr-2 h-4 w-4" />
                        {deliveryApplied ? 'Убрать доставку' : 'Рассчитать доставку (+95 000 ₽)'}
                      </Button>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-base font-bold"><span>Итого к оплате</span><span className="text-primary">{formatPrice(total)}</span></div>

                    <div className="grid gap-2 pt-2">
                      <Button className="w-full" onClick={handleSendLead} disabled={isPending}>
                        <MessageCircle className="mr-2 h-4 w-4" /> Отправить оповещение в Telegram
                      </Button>
                      <Button asChild variant="secondary" className="w-full">
                        <a href="https://t.me/I_O_S_NN" target="_blank" rel="noopener noreferrer">Оформить покупку с менеджером</a>
                      </Button>
                      <Button asChild variant="ghost" className="w-full">
                        <Link href="/vipbikerental">Вернуться на главную VIPBIKE</Link>
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground">Сначала выберите модель из каталога слева.</p>
                )}
              </CardContent>
            </Card>

            <Card className="mt-4">
              <CardContent className="space-y-2 p-4 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Проверка данных прайса</p>
                <p className="flex items-center gap-2"><Battery className="h-3.5 w-3.5" /> Батареи и допы сверены с docs/sql seed.</p>
                <p className="flex items-center gap-2"><Gauge className="h-3.5 w-3.5" /> Мощность моторов: 3000/5000/8000/10000W.</p>
                <p className="flex items-center gap-2"><Wrench className="h-3.5 w-3.5" /> Опции из правой части прайса вынесены в отдельный блок.</p>
                <p className="flex items-center gap-2"><Check className="h-3.5 w-3.5" /> Поддержан fallback на хардкод, пока type="ebike" ещё не полностью заполнен.</p>
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>

      <BikeFooter />
    </div>
  )
}
