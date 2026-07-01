'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { MessageCircle, Truck, ChevronRight, Check, Zap, Battery, Shield, Gauge, Sparkles } from 'lucide-react'

import { type FranchizeCrewVM } from '../../actions'
import { useAppContext } from '@/contexts/AppContext'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { useToast } from '@/hooks/use-toast'

import {
  loadConfiguratorCatalog,
  sendConfiguratorLead,
} from './actions_configurator'
import {
  fallbackBikes,
  fallbackParts,
  lithiumBatteries,
} from './fallback-catalog'
import { DEFAULT_FACTORY_COLOR, FACTORY_COLORS, getFactoryColorById } from './factory-colors'
import {
  type ConfiguratorBike,
  type ConfiguratorPart,
  DELIVERY_AVERAGE,
  formatPrice,
  TIER_META,
  CATEGORY_LABELS,
  STEPS,
  type ConfigStep,
} from './configurator-types'

// ── Part category icons (must reference imported icon components) ──
const _PART_ICONS: Record<string, typeof Zap> = {
  battery: Battery,
  safety: Shield,
  brakes: Shield,
  performance: Gauge,
  electronics: Zap,
  accessories: Sparkles,
  suspension: Gauge,
  wheels: Gauge,
}


const buildBikeImageFallback = (label: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 560"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#101014"/><stop offset="0.55" stop-color="#182526"/><stop offset="1" stop-color="#00ffea" stop-opacity="0.35"/></linearGradient></defs><rect width="800" height="560" fill="url(#g)"/><path d="M126 362h548" stroke="#00ffea" stroke-opacity="0.24" stroke-width="8" stroke-linecap="round"/><circle cx="230" cy="362" r="70" fill="none" stroke="#f8fafc" stroke-opacity="0.72" stroke-width="18"/><circle cx="570" cy="362" r="70" fill="none" stroke="#f8fafc" stroke-opacity="0.72" stroke-width="18"/><path d="M240 348l98-120h104l98 120m-202-120l56 120m48-120l-80 120" fill="none" stroke="#00ffea" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/><text x="400" y="132" fill="#f8fafc" font-family="Inter,Arial,sans-serif" font-size="42" font-weight="800" text-anchor="middle">${label.replace(/[<>&]/g, '')}</text><text x="400" y="184" fill="#99f6e4" font-family="Inter,Arial,sans-serif" font-size="22" text-anchor="middle">image fallback / spec visible</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function ConfiguratorBikeImage({ src, alt, className = '', sizes }: { src?: string; alt: string; className?: string; sizes: string }) {
  const [failed, setFailed] = useState(false)
  const safeSrc = failed || !src ? buildBikeImageFallback(alt || 'VipBike') : src

  return (
    <Image
      src={safeSrc}
      alt={alt}
      fill
      sizes={sizes}
      className={`object-contain p-3 drop-shadow-[0_24px_34px_rgba(0,0,0,0.65)] transition-transform duration-700 ${className}`}
      onError={() => setFailed(true)}
    />
  )
}

// ──────────────── STEP INDICATOR ────────────────
function StepBar({ current, goTo, disabled }: {
  current: string; goTo: (s: string) => void; disabled: Record<string, boolean>
}) {
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
            <span className={[
              'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold transition-colors',
              active ? 'bg-black text-white' : done ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/10 text-white/30',
            ].join(' ')}>
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

// ──────────────── TIER BADGE ────────────────
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

// ──────────────── LIVE PRICE TICKER ────────────────
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

// ──────────────── MAIN COMPONENT ────────────────
interface Props {
  crew: FranchizeCrewVM
  slug: string
}

export function ConfiguratorClient({ crew, slug }: Props) {
  const { toast } = useToast()
  const { dbUser, user: tgUser } = useAppContext()
  const [isPending, startTransition] = useTransition()
  const [tab, setTab] = useState<ConfigStep>('model')
  const [priceRange, setPriceRange] = useState([100000, 500000])

  const [bikes, setBikes] = useState(fallbackBikes)
  const [parts, setParts] = useState(fallbackParts)
  const [selectedBikeId, setSelectedBikeId] = useState(fallbackBikes[0]?.id ?? '')
  const [motorPower, setMotorPower] = useState('3000')
  const [batteryMode, setBatteryMode] = useState<'regular' | 'lithium'>('regular')
  const [batteryCapacity, setBatteryCapacity] = useState('')
  const [selectedAccessories, setSelectedAccessories] = useState<string[]>([])
  const [selectedColorId, setSelectedColorId] = useState(DEFAULT_FACTORY_COLOR?.id ?? '')
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

  const userTelegramId = useMemo(() => {
    if (tgUser?.id) return String(tgUser.id)
    // fallback: try dbUser columns then metadata
    const row = dbUser as Record<string, unknown> | null
    if (!row) return ''
    const direct = String(row.telegram_id ?? '').trim()
    if (direct) return direct
    const meta = (row.metadata as Record<string, unknown>) ?? {}
    return String(meta.telegram_id ?? meta.telegramId ?? '').trim()
  }, [tgUser, dbUser])

  const userName = useMemo(() => {
    if (tgUser) {
      const parts = [tgUser.first_name, tgUser.last_name].filter(Boolean)
      if (parts.length) return parts.join(' ')
      if (tgUser.username) return tgUser.username
    }
    // fallback: dbUser display fields
    const row = dbUser as Record<string, unknown> | null
    if (!row) return 'Неизвестный'
    const meta = (row.metadata as Record<string, unknown>) ?? {}
    return (
      String(row.display_name ?? '').trim() ||
      String(row.name ?? '').trim() ||
      String(row.username ?? '').trim() ||
      String(meta.first_name ?? '').trim() ||
      String(meta.display_name ?? '').trim() ||
      'Неизвестный'
    )
  }, [tgUser, dbUser])
  
  const selectedBike = useMemo(() => bikes.find((b) => b.id === selectedBikeId) ?? null, [bikes, selectedBikeId])
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

  const selectedMotor = useMemo(() => availableMotors.find((m) => m.value === motorPower) ?? availableMotors[0], [availableMotors, motorPower])
  const activeBattery = useMemo(
    () => (batteryMode === 'regular' ? regularBatteries.find((b) => b.capacity === batteryCapacity) : lithiumBatteries.find((b) => b.capacity === batteryCapacity)) ?? null,
    [batteryCapacity, batteryMode, regularBatteries],
  )

  const selectedColor = useMemo(() => getFactoryColorById(selectedColorId) ?? DEFAULT_FACTORY_COLOR, [selectedColorId])

  const filteredBikes = useMemo(() => bikes.filter((b) => b.daily_price >= priceRange[0] && b.daily_price <= priceRange[1]), [bikes, priceRange])
  const accessoriesTotal = useMemo(() => selectedAccessories.reduce((sum, id) => sum + (parts.find((p) => p.id === id)?.daily_price ?? 0), 0), [selectedAccessories, parts])

  const basePrice = selectedBike?.daily_price ?? 0
  const motorExtra = selectedMotor?.extra ?? 0
  const batteryPrice = selectedBike?.model === 'A4' ? 0 : (activeBattery?.battery_price ?? 0)
  const subtotal = basePrice + motorExtra + batteryPrice + accessoriesTotal
  const total = subtotal + (deliveryApplied ? DELIVERY_AVERAGE : 0)

  const selectBike = (bikeId: string) => {
    setSelectedBikeId(bikeId)
    setTab('config')
  }

  // ── Submit with user context ──
  const submitLead = () => {
    if (!selectedBike) return
    startTransition(async () => {
      const response = await sendConfiguratorLead({
        bikeId: selectedBike.id,
        bikeLabel: `${selectedBike.make} ${selectedBike.model}`,
        motorLabel: selectedMotor?.label ?? '—',
        batteryLabel: activeBattery ? `${activeBattery.capacity} (${batteryMode})` : 'без батареи',
        selectedColorId: selectedColor?.id ?? DEFAULT_FACTORY_COLOR?.id ?? 'unknown',
        selectedColorFactoryId: selectedColor?.factoryId ?? DEFAULT_FACTORY_COLOR?.factoryId ?? 'UNKNOWN-FACTORY-COLOR',
        selectedAccessories: selectedAccessories.map((id) => {
          const part = parts.find((p) => p.id === id)
          return { name: part?.model ?? id, price: part?.daily_price ?? 0 }
        }),
        withDelivery: deliveryApplied,
        deliveryPrice: DELIVERY_AVERAGE,
        total,
        basePrice,
        motorExtra,
        batteryPrice,
        accessoriesTotal,
        userTelegramId,
        userName,
        userId: dbUser?.user_id ?? '',
        crewSlug: crew.slug || slug,
      })
      if (response.success) {
        toast({ title: 'Конфигурация отправлена', description: 'DOCX отправлен вам, админу и владельцу экипажа.' })
      } else {
        toast({ title: 'Ошибка', description: response.error ?? 'Не удалось отправить', variant: 'destructive' })
      }
    })
  }

  const tabDisabled: Record<string, boolean> = {
    model: false,
    config: !selectedBike,
    addons: !selectedBike,
    summary: !selectedBike,
  }

  const partsByCategory = useMemo(() => {
    const groups: Record<string, ConfiguratorPart[]> = {}
    for (const p of parts) {
      const cat = (p.specs as Record<string, unknown>)?.category ?? 'other'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(p)
    }
    return groups
  }, [parts])

  return (
    <>
      {/* ── Theme sync: map franchize CSS vars to configurator vars ── */}
      <style jsx global>{`
        .cfg-root {
          /* Map franchize theme variables to configurator variables */
          --cfg-bg: var(--franchize-bg-base, #09090b);
          --cfg-surface: var(--franchize-bg-card, #111113);
          --cfg-surface-raised: var(--franchize-bg-card, #1a1a1f);
          --cfg-border: var(--franchize-border-soft, #27272a);
          --cfg-border-hover: var(--franchize-border-soft, #3f3f46);
          --cfg-text: var(--franchize-text-primary, #fafafa);
          --cfg-text-muted: var(--franchize-text-secondary, #a1a1aa);
          --cfg-text-dim: var(--franchize-text-secondary, #71717a);
          --cfg-accent: var(--franchize-accent-main, #00ffea);
          --cfg-accent-hover: var(--franchize-accent-hover, #33ffed);
          --cfg-accent-dim: color-mix(in srgb, var(--cfg-accent) 30%, transparent);
          --cfg-accent-glow: color-mix(in srgb, var(--cfg-accent) 15%, transparent);
          --cfg-danger: #ef4444;
        }
      `}</style>

      {/* ── Configurator-scoped styles ── */}
      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap');
        .cfg-root {
          font-family: 'Inter', system-ui, sans-serif; background: var(--cfg-bg); color: var(--cfg-text); -webkit-font-smoothing: antialiased;
        }
        .cfg-mono { font-family: 'JetBrains Mono', monospace; }
        .cfg-fade-in { animation: cfgFadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes cfgFadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .cfg-card-hover { transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.35s ease, border-color 0.3s ease; }
        .cfg-card-hover:hover { transform: translateY(-4px); box-shadow: 0 20px 60px -15px rgba(0,0,0,0.5); border-color: var(--cfg-border-hover); }
        .cfg-selected-ring { box-shadow: 0 0 0 2px var(--cfg-accent), 0 0 30px var(--cfg-accent-dim); border-color: var(--cfg-accent) !important; }
        .cfg-option { transition: all 0.2s ease; cursor: pointer; }
        .cfg-option:hover { background: var(--cfg-surface-raised); border-color: var(--cfg-border-hover); }
        .cfg-option-active { background: var(--cfg-accent-glow) !important; border-color: var(--cfg-accent) !important; box-shadow: 0 0 20px var(--cfg-accent-dim); }
        .cfg-radio-dot { appearance: none; width: 18px; height: 18px; border: 2px solid var(--cfg-border-hover); border-radius: 50%; position: relative; transition: all 0.2s ease; flex-shrink: 0; }
        .cfg-radio-dot:checked { border-color: var(--cfg-accent); background: var(--cfg-accent); box-shadow: inset 0 0 0 3px var(--cfg-bg); }
        .cfg-check { appearance: none; width: 18px; height: 18px; border: 2px solid var(--cfg-border-hover); border-radius: 5px; position: relative; transition: all 0.2s ease; flex-shrink: 0; cursor: pointer; }
        .cfg-check:checked { border-color: var(--cfg-accent); background: var(--cfg-accent); }
        .cfg-check:checked::after { content: '✓'; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 11px; font-weight: 900; color: #000; }
        .cfg-slider [role="slider"] { background: var(--cfg-accent) !important; border: 3px solid var(--cfg-bg) !important; box-shadow: 0 0 10px var(--cfg-accent-dim) !important; }
        .cfg-slider span[data-orientation="horizontal"] { background: var(--cfg-accent) !important; }
        .cfg-sticky-bar { backdrop-filter: blur(20px) saturate(150%); -webkit-backdrop-filter: blur(20px) saturate(150%); }
        .cfg-grain::before { content: ''; position: fixed; inset: 0; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E"); pointer-events: none; z-index: 9999; }
        .cfg-root::-webkit-scrollbar { width: 6px; }
        .cfg-root::-webkit-scrollbar-track { background: transparent; }
        .cfg-root::-webkit-scrollbar-thumb { background: var(--cfg-border); border-radius: 3px; }
        .cfg-img-wrap { background: radial-gradient(circle at 50% 42%, color-mix(in srgb, var(--cfg-accent) 22%, transparent), transparent 36%), linear-gradient(145deg, color-mix(in srgb, var(--cfg-bg) 85%, white) 0%, color-mix(in srgb, var(--cfg-bg) 70%, white) 46%, var(--cfg-surface) 47%, var(--cfg-bg) 100%); }
        @keyframes shimmer { to { background-position: -200% 0; } }
        .cfg-stagger > * { opacity: 0; animation: cfgFadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .cfg-stagger > *:nth-child(1)  { animation-delay: 0.02s; } .cfg-stagger > *:nth-child(2)  { animation-delay: 0.06s; }
        .cfg-stagger > *:nth-child(3)  { animation-delay: 0.10s; } .cfg-stagger > *:nth-child(4)  { animation-delay: 0.14s; }
        .cfg-stagger > *:nth-child(5)  { animation-delay: 0.18s; } .cfg-stagger > *:nth-child(6)  { animation-delay: 0.22s; }
        .cfg-stagger > *:nth-child(7)  { animation-delay: 0.26s; } .cfg-stagger > *:nth-child(8)  { animation-delay: 0.30s; }
        .cfg-stagger > *:nth-child(9)  { animation-delay: 0.34s; } .cfg-stagger > *:nth-child(10) { animation-delay: 0.38s; }
        .cfg-stagger > *:nth-child(11) { animation-delay: 0.42s; } .cfg-stagger > *:nth-child(12) { animation-delay: 0.46s; }
        .cfg-stagger > *:nth-child(13) { animation-delay: 0.50s; } .cfg-stagger > *:nth-child(14) { animation-delay: 0.54s; }
        .cfg-stagger > *:nth-child(15) { animation-delay: 0.58s; } .cfg-stagger > *:nth-child(16) { animation-delay: 0.62s; }
        .cfg-glow-btn { position: relative; overflow: hidden; transition: all 0.3s ease; }
        .cfg-glow-btn::before { content: ''; position: absolute; inset: -2px; background: conic-gradient(from 0deg, var(--cfg-accent), transparent, var(--cfg-accent)); border-radius: inherit; animation: spin 3s linear infinite; opacity: 0; transition: opacity 0.3s; z-index: -1; }
        .cfg-glow-btn:hover::before { opacity: 1; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <section className="cfg-root cfg-grain relative min-h-screen">
        {/* ── HERO ── */}
        <div className="relative overflow-hidden border-b border-[var(--cfg-border)]">
          <div
            className="absolute -top-40 left-1/2 h-[500px] w-[800px] -translate-x-1/2 rounded-full opacity-20"
            style={{ background: 'radial-gradient(ellipse, var(--cfg-accent) 0%, transparent 70%)' }}
          />
          <div className="relative mx-auto max-w-7xl px-4 pb-8 pt-10 sm:pt-14 2xl:max-w-[1600px]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="cfg-mono mb-2 text-[11px] font-medium uppercase tracking-[0.25em] text-[var(--cfg-accent)]">Конфигуратор</p>
                <h1 className="text-3xl font-black leading-[1.1] tracking-tight sm:text-5xl">
                  Собери свой<br />
                  <span className="text-[var(--cfg-accent)]">электробайк</span>
                </h1>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-[var(--cfg-text-muted)]">
                  Выбери модель, настрой мотор и батарею, добавь опции — получи точную цену за секунды.
                </p>
              </div>
              {selectedBike && <LivePrice value={total} label="Текущая конфигурация" />}
            </div>
          </div>
        </div>

        {/* ── CONTENT ── */}
        <div className="mx-auto max-w-7xl px-4 py-6 pb-20 sm:pb-8 2xl:max-w-[1600px]">
          <StepBar current={tab} goTo={(s) => setTab(s as ConfigStep)} disabled={tabDisabled} />

          {/* ═══ STEP 1: MODEL ═══ */}
          {tab === 'model' && (
            <div className="cfg-fade-in space-y-6">
              <div className="rounded-2xl border border-[var(--cfg-border)] bg-[var(--cfg-surface)] p-5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium uppercase tracking-widest text-[var(--cfg-text-dim)]">Диапазон цены</Label>
                  <span className="cfg-mono text-sm font-bold text-[var(--cfg-accent)]">{formatPrice(priceRange[0])} — {formatPrice(priceRange[1])}</span>
                </div>
                <Slider value={priceRange} onValueChange={setPriceRange} min={100000} max={500000} step={10000} className="cfg-slider mt-4" />
                <div className="mt-2 flex justify-between text-[10px] text-[var(--cfg-text-dim)]"><span>100 000 ₽</span><span>500 000 ₽</span></div>
              </div>
              <p className="cfg-mono text-xs text-[var(--cfg-text-dim)]">Найдено: <span className="font-bold text-white">{filteredBikes.length}</span> моделей</p>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 cfg-stagger">
                {filteredBikes.map((bike) => {
                  const isSelected = selectedBikeId === bike.id
                  return (
                    <article key={bike.id} className={['group relative overflow-hidden rounded-2xl border bg-[var(--cfg-surface)] cfg-card-hover', isSelected ? 'cfg-selected-ring border-[var(--cfg-accent)]' : 'border-[var(--cfg-border)]'].join(' ')}>
                      <button type="button" className="block w-full text-left" onClick={() => selectBike(bike.id)}>
                        <div className="cfg-img-wrap relative aspect-[4/3] w-full overflow-hidden lg:aspect-square">
                          <ConfiguratorBikeImage src={bike.image_url} alt={`${bike.make} ${bike.model}`} sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw" className="group-hover:scale-105" />
                          <div className="absolute inset-0 bg-gradient-to-t from-[var(--cfg-bg)] via-transparent to-transparent opacity-60" />
                          <div className="absolute left-3 top-3"><TierBadge tier={bike.specs.tier} /></div>
                          {isSelected && <div className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--cfg-accent)] shadow-lg shadow-[var(--cfg-accent)]/30"><Check className="h-4 w-4 text-black" /></div>}
                          <div className="absolute bottom-3 left-3 right-3"><p className="cfg-mono text-xl font-bold text-white drop-shadow-lg">{formatPrice(bike.daily_price)}</p></div>
                        </div>
                        <div className="p-4">
                          <h3 className="mb-1.5 text-sm font-bold tracking-tight text-white">{bike.make} {bike.model}</h3>
                          <p className="line-clamp-2 text-xs leading-relaxed text-[var(--cfg-text-muted)]">{bike.description}</p>
                          <div className="mt-3 flex items-center gap-3 text-[10px] uppercase tracking-widest text-[var(--cfg-text-dim)]">
                            <span className="flex items-center gap-1"><Zap className="h-3 w-3" />{bike.specs.power_w}W</span>
                            <span className="flex items-center gap-1"><Gauge className="h-3 w-3" />{bike.specs.max_speed_kmh} км/ч</span>
                          </div>
                        </div>
                      </button>
                    </article>
                  )
                })}
              </div>
              {filteredBikes.length === 0 && (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--cfg-border)] py-16">
                  <p className="text-sm text-[var(--cfg-text-dim)]">Нет моделей в этом диапазоне цен</p>
                  <Button variant="ghost" className="mt-3 text-xs text-[var(--cfg-text-muted)]" onClick={() => setPriceRange([100000, 500000])}>Сбросить фильтр</Button>
                </div>
              )}
            </div>
          )}

          {/* ═══ STEP 2: CONFIG ═══ */}
          {tab === 'config' && selectedBike && (
            <div className="cfg-fade-in space-y-6">
              <div className="overflow-hidden rounded-2xl border border-[var(--cfg-border)] bg-[var(--cfg-surface)]">
                <div className="relative aspect-[21/9] w-full overflow-hidden sm:aspect-[3/1]">
                  <ConfiguratorBikeImage src={selectedBike.image_url} alt={`${selectedBike.make} ${selectedBike.model}`} sizes="(max-width: 1024px) 100vw, 66vw" />
                  <div className="absolute inset-0 bg-gradient-to-r from-[var(--cfg-bg)] via-[var(--cfg-bg)]/60 to-transparent" />
                  <div className="absolute bottom-0 left-0 p-6 sm:p-8">
                    <TierBadge tier={selectedBike.specs.tier} />
                    <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-4xl">{selectedBike.make} {selectedBike.model}</h2>
                    <p className="mt-1 max-w-lg text-sm text-[var(--cfg-text-muted)]">{selectedBike.description}</p>
                  </div>
                </div>
                {selectedBike.specs.gallery && selectedBike.specs.gallery.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto border-t border-[var(--cfg-border)] p-3">
                    {[selectedBike.image_url, ...selectedBike.specs.gallery].map((img, i) => (
                      <div key={img + i} className="relative h-16 w-24 flex-shrink-0 overflow-hidden rounded-lg border border-[var(--cfg-border)]"><ConfiguratorBikeImage src={img} alt={`${selectedBike.make} ${selectedBike.model} фото ${i + 1}`} sizes="96px" /></div>
                    ))}
                  </div>
                )}
              </div>

              {/* Motor */}
              <div className="rounded-2xl border border-[var(--cfg-border)] bg-[var(--cfg-surface)] p-5 sm:p-6">
                <div className="mb-4 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--cfg-accent)]/10"><Zap className="h-4 w-4 text-[var(--cfg-accent)]" /></div>
                  <div><h3 className="text-sm font-bold">Мощность мотора</h3><p className="text-[11px] text-[var(--cfg-text-dim)]">Влияет на динамику и максимальную скорость</p></div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {availableMotors.map((motor) => {
                    const active = motorPower === motor.value
                    return (
                      <label key={motor.value} className={['cfg-option flex items-center justify-between rounded-xl border p-4', active ? 'cfg-option-active' : 'border-[var(--cfg-border)]'].join(' ')}>
                        <span className="flex items-center gap-3">
                          <input type="radio" name="motor" className="cfg-radio-dot" value={motor.value} checked={active} onChange={() => setMotorPower(motor.value)} aria-label={`Мощность мотора ${motor.value}W`} />
                          <span><span className="block text-sm font-semibold">{motor.value}W</span><span className="block text-[11px] text-[var(--cfg-text-dim)]">{motor.extra === 0 ? 'Базовая комплектация' : `+${formatPrice(motor.extra)}`}</span></span>
                        </span>
                        {motor.extra > 0 && <span className="cfg-mono text-xs font-medium text-[var(--cfg-text-muted)]">+{formatPrice(motor.extra)}</span>}
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Battery */}
              {selectedBike.model !== 'A4' && (
                <div className="rounded-2xl border border-[var(--cfg-border)] bg-[var(--cfg-surface)] p-5 sm:p-6">
                  <div className="mb-4 flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10"><Battery className="h-4 w-4 text-emerald-400" /></div>
                    <div><h3 className="text-sm font-bold">Аккумулятор</h3><p className="text-[11px] text-[var(--cfg-text-dim)]">Тип и ёмкость определяют запас хода</p></div>
                  </div>
                  <div className="mb-4 inline-flex rounded-xl border border-[var(--cfg-border)] bg-[var(--cfg-bg)] p-1">
                    {(['regular', 'lithium'] as const).map((mode) => (
                      <button key={mode} type="button" onClick={() => { setBatteryMode(mode); setBatteryCapacity((mode === 'regular' ? regularBatteries[0] : lithiumBatteries[0])?.capacity ?? '') }}
                        aria-label={`Тип аккумулятора ${mode === 'regular' ? 'Regular' : 'Lithium'}`}
                        className={['rounded-lg px-4 py-2 text-xs font-semibold transition-all', batteryMode === mode ? 'bg-[var(--cfg-accent)] text-black shadow-md' : 'text-[var(--cfg-text-dim)] hover:text-white'].join(' ')}>
                        {mode === 'regular' ? 'Regular' : 'Lithium'}
                      </button>
                    ))}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(batteryMode === 'regular' ? regularBatteries : lithiumBatteries).map((battery) => {
                      const active = batteryCapacity === battery.capacity
                      return (
                        <label key={`${batteryMode}-${battery.capacity}`} className={['cfg-option flex items-center justify-between rounded-xl border p-4', active ? 'cfg-option-active' : 'border-[var(--cfg-border)]'].join(' ')}>
                          <span className="flex items-center gap-3">
                            <input type="radio" name="battery" className="cfg-radio-dot" value={battery.capacity} checked={active} onChange={() => setBatteryCapacity(battery.capacity)} aria-label={`Аккумулятор ${battery.capacity}`} />
                            <span><span className="block text-sm font-semibold">{battery.capacity}</span><span className="block text-[11px] text-[var(--cfg-text-dim)]">Запас хода: {battery.range_km} км</span></span>
                          </span>
                          <span className="cfg-mono text-xs font-medium text-[var(--cfg-text-muted)]">{battery.battery_price === 0 ? 'Вкл.' : `+${formatPrice(battery.battery_price)}`}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-[var(--cfg-border)] bg-[var(--cfg-surface)] p-5 sm:p-6">
                <div className="mb-4 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--cfg-accent)]/10"><Sparkles className="h-4 w-4 text-[var(--cfg-accent)]" /></div>
                  <div><h3 className="text-sm font-bold">Цвет</h3><p className="text-[11px] text-[var(--cfg-text-dim)]">Цвет попадёт в заказ и DOCX с factory ID</p></div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {FACTORY_COLORS.map((color) => {
                    const active = selectedColorId === color.id
                    return (
                      <button
                        key={color.id}
                        type="button"
                        onClick={() => setSelectedColorId(color.id)}
                        aria-label={`Цвет рамы ${color.label}`}
                        className={[
                          'cfg-option flex items-center justify-between rounded-xl border p-4 text-left',
                          active ? 'cfg-option-active' : 'border-[var(--cfg-border)]',
                        ].join(' ')}
                      >
                        <span className="flex items-center gap-3">
                          <span className="h-5 w-5 rounded-full border border-white/20" style={{ backgroundColor: color.hex ?? '#6b7280' }} />
                          <span>
                            <span className="block text-sm font-semibold">{color.label}</span>
                            <span className="block text-[11px] text-[var(--cfg-text-dim)]">Factory ID: {color.factoryId}</span>
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>


              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => setTab('model')} className="text-[var(--cfg-text-dim)] hover:text-white">← Назад</Button>
                <Button onClick={() => setTab('addons')} className="cfg-glow-btn flex-1 bg-[var(--cfg-accent)] font-bold text-black hover:bg-[var(--cfg-accent-hover)] sm:flex-none">Дальше: опции<ChevronRight className="ml-1 h-4 w-4" /></Button>
              </div>
            </div>
          )}

          {/* ═══ STEP 3: ADDONS ═══ */}
          {tab === 'addons' && selectedBike && (
            <div className="cfg-fade-in space-y-6">
              {Object.entries(partsByCategory).map(([category, categoryParts]) => {
                const Icon = _PART_ICONS[category] || Sparkles
                return (
                  <div key={category} className="rounded-2xl border border-[var(--cfg-border)] bg-[var(--cfg-surface)] p-5 sm:p-6">
                    <div className="mb-4 flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5"><Icon className="h-4 w-4 text-[var(--cfg-text-muted)]" /></div>
                      <h3 className="text-sm font-bold">{CATEGORY_LABELS[category] ?? category}</h3>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {categoryParts.map((part) => {
                        const checked = selectedAccessories.includes(part.id)
                        return (
                          <label key={part.id} className={['cfg-option flex items-start justify-between gap-3 rounded-xl border p-4', checked ? 'cfg-option-active' : 'border-[var(--cfg-border)]'].join(' ')}>
                            <span className="flex items-start gap-3">
                              <input type="checkbox" className="cfg-check mt-0.5" checked={checked} onChange={() => setSelectedAccessories((prev) => prev.includes(part.id) ? prev.filter((id) => id !== part.id) : [...prev, part.id])} aria-label={`Аксессуар ${part.model}`} />
                              <span><span className="block text-sm font-semibold">{part.model}</span><span className="mt-0.5 block text-[11px] leading-relaxed text-[var(--cfg-text-dim)]">{part.description}</span></span>
                            </span>
                            <span className="cfg-mono whitespace-nowrap text-xs font-medium text-[var(--cfg-text-muted)]">+{formatPrice(part.daily_price)}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
              {selectedAccessories.length > 0 && (
                <div className="flex items-center justify-between rounded-xl border border-[var(--cfg-accent)]/20 bg-[var(--cfg-accent)]/5 px-4 py-3">
                  <span className="text-sm text-[var(--cfg-text-muted)]">Выбрано опций: <span className="font-bold text-white">{selectedAccessories.length}</span></span>
                  <span className="cfg-mono text-sm font-bold text-[var(--cfg-accent)]">+{formatPrice(accessoriesTotal)}</span>
                </div>
              )}
              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => setTab('config')} className="text-[var(--cfg-text-dim)] hover:text-white">← Назад</Button>
                <Button onClick={() => setTab('summary')} className="cfg-glow-btn flex-1 bg-[var(--cfg-accent)] font-bold text-black hover:bg-[var(--cfg-accent-hover)] sm:flex-none">Дальше: итог<ChevronRight className="ml-1 h-4 w-4" /></Button>
              </div>
            </div>
          )}

          {/* ═══ STEP 4: SUMMARY ═══ */}
          {tab === 'summary' && selectedBike && (
            <div className="cfg-fade-in space-y-6">
              <div className="grid gap-6 lg:grid-cols-5">
                <div className="lg:col-span-3 space-y-4">
                  <div className="overflow-hidden rounded-2xl border border-[var(--cfg-border)] bg-[var(--cfg-surface)]">
                    <div className="relative aspect-[16/7] w-full overflow-hidden"><ConfiguratorBikeImage src={selectedBike.image_url} alt={`${selectedBike.make} ${selectedBike.model}`} sizes="(max-width: 1280px) 100vw, 60vw" /><div className="absolute inset-0 bg-gradient-to-t from-[var(--cfg-surface)] via-transparent to-transparent" /></div>
                    <div className="p-5"><TierBadge tier={selectedBike.specs.tier} /><h2 className="mt-2 text-xl font-black">{selectedBike.make} {selectedBike.model}</h2></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      { icon: Zap, label: 'Мотор', value: `${selectedMotor?.value ?? '3000'}W` },
                      { icon: Battery, label: 'Батарея', value: activeBattery ? activeBattery.capacity : '—' },
                      { icon: Gauge, label: 'Скорость', value: `${selectedBike.specs.max_speed_kmh} км/ч` },
                      { icon: Sparkles, label: 'Цвет', value: selectedColor?.label ?? '—' },
                      { icon: Shield, label: 'Запас хода', value: activeBattery ? `${activeBattery.range_km} км` : '—' },
                    ].map(({ icon: Icon, label, value }) => (
                      <div key={label} className="rounded-xl border border-[var(--cfg-border)] bg-[var(--cfg-surface)] p-3"><Icon className="mb-1.5 h-4 w-4 text-[var(--cfg-text-dim)]" /><p className="cfg-mono text-lg font-bold">{value}</p><p className="text-[10px] uppercase tracking-widest text-[var(--cfg-text-dim)]">{label}</p></div>
                    ))}
                  </div>
                  {selectedAccessories.length > 0 && (
                    <div className="rounded-xl border border-[var(--cfg-border)] bg-[var(--cfg-surface)] p-4">
                      <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-[var(--cfg-text-dim)]">Доп. опции</h4>
                      <div className="space-y-2">
                        {selectedAccessories.map((id) => {
                          const part = parts.find((p) => p.id === id)
                          if (!part) return null
                          return <div key={id} className="flex items-center justify-between text-sm"><span className="flex items-center gap-2 text-[var(--cfg-text-muted)]"><Check className="h-3.5 w-3.5 text-[var(--cfg-accent)]" />{part.model}</span><span className="cfg-mono text-xs">+{formatPrice(part.daily_price)}</span></div>
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="lg:col-span-2">
                  <div className="sticky top-6 space-y-4">
                    <div className="rounded-2xl border border-[var(--cfg-border)] bg-[var(--cfg-surface)] p-5 sm:p-6">
                      <h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-[var(--cfg-text-dim)]">Расчёт стоимости</h3>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between"><span className="text-[var(--cfg-text-muted)]">{selectedBike.make} {selectedBike.model}</span><span className="cfg-mono font-medium">{formatPrice(basePrice)}</span></div>
                        <div className="flex justify-between"><span className="text-[var(--cfg-text-muted)]">Цвет (Factory ID)</span><span className="cfg-mono text-xs font-medium">{selectedColor?.factoryId ?? 'UNKNOWN-FACTORY-COLOR'}</span></div>
                        {motorExtra > 0 && <div className="flex justify-between"><span className="text-[var(--cfg-text-muted)]">Мотор {selectedMotor?.value}W</span><span className="cfg-mono font-medium">+{formatPrice(motorExtra)}</span></div>}
                        {batteryPrice > 0 && <div className="flex justify-between"><span className="text-[var(--cfg-text-muted)]">Батарея {activeBattery?.capacity}</span><span className="cfg-mono font-medium">+{formatPrice(batteryPrice)}</span></div>}
                        {accessoriesTotal > 0 && <div className="flex justify-between"><span className="text-[var(--cfg-text-muted)]">Опции ({selectedAccessories.length})</span><span className="cfg-mono font-medium">+{formatPrice(accessoriesTotal)}</span></div>}
                        {deliveryApplied && <div className="flex justify-between"><span className="text-[var(--cfg-text-muted)]">Доставка</span><span className="cfg-mono font-medium">+{formatPrice(DELIVERY_AVERAGE)}</span></div>}
                      </div>
                      <Separator className="my-4 bg-[var(--cfg-border)]" />
                      <div className="flex items-baseline justify-between"><span className="text-sm font-bold uppercase tracking-widest text-[var(--cfg-text-dim)]">Итого</span><span className="cfg-mono text-3xl font-black text-[var(--cfg-accent)]">{formatPrice(total)}</span></div>
                      <button onClick={() => setDeliveryApplied((v) => !v)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--cfg-border)] py-3 text-xs text-[var(--cfg-text-dim)] transition-all hover:border-[var(--cfg-accent)]/30 hover:text-white">
                        <Truck className="h-4 w-4" />{deliveryApplied ? 'Убрать доставку' : `Добавить доставку (+${formatPrice(DELIVERY_AVERAGE)})`}
                      </button>
                    </div>
                    <div className="space-y-2">
                      <Button onClick={submitLead} disabled={isPending} className="cfg-glow-btn w-full bg-[var(--cfg-accent)] py-6 text-sm font-bold text-black hover:bg-[var(--cfg-accent-hover)]"><MessageCircle className="mr-2 h-4 w-4" />Отправить в Telegram</Button>
                      <Button asChild variant="outline" className="w-full border-[var(--cfg-border)] bg-transparent py-6 text-sm font-semibold text-white hover:bg-white/5 hover:text-white"><a href="https://t.me/I_O_S_NN" target="_blank" rel="noopener noreferrer">Оформить покупку</a></Button>
                    </div>
                    <Button variant="ghost" onClick={() => setTab('addons')} className="w-full text-[var(--cfg-text-dim)] hover:text-white">← Вернуться к опциям</Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── MOBILE STICKY BAR ── */}
        {selectedBike && (
          <div className="cfg-sticky-bar fixed inset-x-0 bottom-0 z-50 border-t border-[var(--cfg-border)] bg-[var(--cfg-bg)]/90 px-4 py-3 sm:hidden">
            <div className="flex items-center justify-between">
              <div><p className="text-[10px] uppercase tracking-widest text-[var(--cfg-text-dim)]">{selectedBike.make} {selectedBike.model}</p><p className="cfg-mono text-xl font-black text-[var(--cfg-accent)]">{formatPrice(total)}</p></div>
              <Button onClick={() => setTab('summary')} size="sm" className="bg-[var(--cfg-accent)] font-bold text-black">Итог<ChevronRight className="ml-1 h-4 w-4" /></Button>
            </div>
          </div>
        )}
        <div className="h-20 sm:h-0" />
      </section>
    </>
  )
}
