'use client'

import Image from 'next/image'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { MessageCircle, Truck, ChevronRight, Check, Zap, Battery, Shield, Gauge, Sparkles, Star, Plus, Minus, MapPin, Disc3, Anchor, CircleDot } from 'lucide-react'

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
  RECOMMENDED_PART_IDS,
  type ConfigStep,
} from './configurator-types'

// ── Part category icons — distinct per category (CR-048) ──
const PART_ICONS: Record<string, typeof Zap> = {
  battery: Battery,
  safety: Shield,
  brakes: Disc3,        // was Shield (same as safety)
  performance: Gauge,
  electronics: Zap,
  accessories: Sparkles,
  suspension: Anchor,    // was Gauge (same as performance)
  wheels: CircleDot,     // was Gauge (same as performance)
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
              'flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold transition-colors shrink-0',
              active ? 'bg-black text-white' : done ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/10 text-white/30',
            ].join(' ')}>
              {done ? <Check className="h-3.5 w-3.5" /> : step.num}
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
      {label && <span className="text-xs uppercase tracking-widest text-[var(--cfg-text-muted)]">{label}</span>}
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
  // Accessories state: id -> quantity (0 = not selected, 1+ = selected with qty)
  const [accessoryQuantities, setAccessoryQuantities] = useState<Record<string, number>>({})
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

  // CR-013: Detect "battery included" bikes by spec, not by model name string.
  // A bike is "included" if its battery_options has a single battery with type 'lithium'
  // and battery_price 0 (the A4 pattern). This survives model renames.
  const isBatteryIncluded = useMemo(() => {
    const opts = selectedBike?.specs.battery_options?.batteries ?? []
    return opts.length === 1 && opts[0].type === 'lithium' && (opts[0].battery_price ?? 0) === 0
  }, [selectedBike])

  // CR-009: Preserve batteryMode across bike switches of the same kind.
  // Only force-flip when crossing the included/non-included boundary.
  const prevBikeIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (!selectedBike) return
    if (prevBikeIdRef.current === selectedBike.id) return // avoid re-running on re-render
    prevBikeIdRef.current = selectedBike.id

    setMotorPower(String(selectedBike.specs.power_w ?? 3000))

    if (isBatteryIncluded) {
      // Battery-included bike: force lithium, use the bike's own battery spec
      const includedBattery = selectedBike.specs.battery_options?.batteries?.[0]
      setBatteryMode('lithium')
      setBatteryCapacity(includedBattery?.capacity ?? 'Included')
    } else {
      // Non-included bike: preserve previous mode if it was lithium, otherwise regular
      setBatteryMode((prev) => (prev === 'lithium' ? 'lithium' : 'regular'))
      setBatteryCapacity((regularBatteries[0] ?? lithiumBatteries[0])?.capacity ?? '')
    }
    setAccessoryQuantities({})
    setDeliveryApplied(false)
  }, [selectedBike, isBatteryIncluded, regularBatteries])

  // CR-042: Use the bike's actual power_w for high-power bikes, not a hardcoded 10000
  const availableMotors = useMemo(() => {
    const powerW = selectedBike?.specs.power_w ?? 3000
    if (powerW >= 10000) return [{ value: String(powerW), extra: 0, label: `${powerW}W (база)` }]
    return [
      { value: '3000', extra: 0, label: '3000W (база)' },
      { value: '5000', extra: 79000, label: '5000W (+79 000 ₽)' },
      { value: '8000', extra: 90000, label: '8000W (+90 000 ₽)' },
      { value: '10000', extra: 167000, label: '10000W (+167 000 ₽)' },
    ]
  }, [selectedBike])

  const selectedMotor = useMemo(() => availableMotors.find((m) => m.value === motorPower) ?? availableMotors[0], [availableMotors, motorPower])
  const activeBattery = useMemo(() => {
    // CR-008: For battery-included bikes, resolve from the bike's own spec (not the global lithiumBatteries array)
    if (isBatteryIncluded) {
      return selectedBike?.specs.battery_options?.batteries?.[0] ?? null
    }
    return (batteryMode === 'regular' ? regularBatteries.find((b) => b.capacity === batteryCapacity) : lithiumBatteries.find((b) => b.capacity === batteryCapacity)) ?? null
  }, [batteryCapacity, batteryMode, regularBatteries, isBatteryIncluded, selectedBike])

  const selectedColor = useMemo(() => getFactoryColorById(selectedColorId) ?? DEFAULT_FACTORY_COLOR, [selectedColorId])

  const filteredBikes = useMemo(() => bikes.filter((b) => b.daily_price >= priceRange[0] && b.daily_price <= priceRange[1]), [bikes, priceRange])

  // ── Accessory helpers (qty map → derived list + total) ──
  const selectedAccessoryIds = useMemo(
    () => Object.keys(accessoryQuantities).filter((id) => (accessoryQuantities[id] ?? 0) > 0),
    [accessoryQuantities],
  )
  const selectedAccessoriesCount = useMemo(
    () => selectedAccessoryIds.reduce((sum, id) => sum + (accessoryQuantities[id] ?? 0), 0),
    [selectedAccessoryIds, accessoryQuantities],
  )
  const accessoriesTotal = useMemo(
    () => selectedAccessoryIds.reduce((sum, id) => {
      const part = parts.find((p) => p.id === id)
      return sum + (part?.daily_price ?? 0) * (accessoryQuantities[id] ?? 0)
    }, 0),
    [selectedAccessoryIds, accessoryQuantities, parts],
  )

  const setAccessoryQty = (id: string, qty: number) => {
    setAccessoryQuantities((prev) => {
      const next = { ...prev }
      if (qty <= 0) delete next[id]
      else next[id] = Math.min(qty, 9) // cap at 9 to keep DOCX layout sane
      return next
    })
  }
  const toggleAccessory = (id: string) => {
    setAccessoryQuantities((prev) => {
      const next = { ...prev }
      if ((prev[id] ?? 0) > 0) delete next[id]
      else next[id] = 1
      return next
    })
  }
  const selectAllInCategory = (categoryParts: ConfiguratorPart[]) => {
    setAccessoryQuantities((prev) => {
      const next = { ...prev }
      for (const p of categoryParts) if (!(p.id in next)) next[p.id] = 1
      return next
    })
  }
  const clearCategory = (categoryParts: ConfiguratorPart[]) => {
    setAccessoryQuantities((prev) => {
      const next = { ...prev }
      for (const p of categoryParts) delete next[p.id]
      return next
    })
  }

  const basePrice = selectedBike?.daily_price ?? 0
  const motorExtra = selectedMotor?.extra ?? 0
  const batteryPrice = isBatteryIncluded ? 0 : (activeBattery?.battery_price ?? 0)
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
        motorLabel: selectedMotor?.value ? `${selectedMotor.value}W` : '—',
        // CR-008: For battery-included bikes, send "Included (lithium)" so the server action
        // can detect it and render "в комплекте" instead of the wrong "50Ah" capacity.
        batteryLabel: activeBattery
          ? (isBatteryIncluded
              ? `Included (${activeBattery.type ?? 'lithium'})`
              : `${activeBattery.capacity} (${batteryMode})`)
          : 'без батареи',
        batteryRange: activeBattery?.range_km ?? '',
        selectedColorId: selectedColor?.id ?? DEFAULT_FACTORY_COLOR?.id ?? 'unknown',
        selectedColorFactoryId: selectedColor?.factoryId ?? DEFAULT_FACTORY_COLOR?.factoryId ?? 'UNKNOWN-FACTORY-COLOR',
        selectedAccessories: selectedAccessoryIds.map((id) => {
          const part = parts.find((p) => p.id === id)
          const qty = accessoryQuantities[id] ?? 1
          return {
            name: part?.model ?? id,
            price: (part?.daily_price ?? 0) * qty, // total price for this line (unit × qty)
            quantity: qty,
          }
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
        .cfg-root {
          font-family: 'Inter', system-ui, -apple-system, sans-serif; background: var(--cfg-bg); color: var(--cfg-text); -webkit-font-smoothing: antialiased;
        }
        .cfg-mono { font-family: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace; font-variant-numeric: tabular-nums; }
        .cfg-fade-in { animation: cfgFadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes cfgFadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .cfg-card-hover { transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.35s ease, border-color 0.3s ease; }
        .cfg-card-hover:hover { transform: translateY(-4px); box-shadow: 0 20px 60px -15px rgba(0,0,0,0.5); border-color: var(--cfg-border-hover); }
        .cfg-card-hover:active { transform: scale(0.98); } /* CR-037: touch feedback */
        .cfg-selected-ring { box-shadow: 0 0 0 2px var(--cfg-accent), 0 0 30px var(--cfg-accent-dim); border-color: var(--cfg-accent) !important; }
        .cfg-option { transition: all 0.2s ease; cursor: pointer; }
        .cfg-option:hover { background: var(--cfg-surface-raised); border-color: var(--cfg-border-hover); }
        .cfg-option:active { transform: scale(0.98); } /* CR-037: touch feedback */
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
        .cfg-glow-btn:active { transform: scale(0.97); } /* CR-037: touch feedback */
        @keyframes spin { to { transform: rotate(360deg); } }

        /* CR-020: visible focus indicator for keyboard users */
        .cfg-root :focus-visible {
          outline: 2px solid var(--cfg-accent);
          outline-offset: 2px;
          border-radius: 4px;
        }
        .cfg-root button:focus-visible,
        .cfg-root [role="checkbox"]:focus-visible,
        .cfg-root [role="radio"]:focus-visible,
        .cfg-root a:focus-visible {
          outline: 2px solid var(--cfg-accent);
          outline-offset: 2px;
        }

        /* CR-015/CR-016: respect prefers-reduced-motion */
        @media (prefers-reduced-motion: reduce) {
          .cfg-root *,
          .cfg-root *::before,
          .cfg-root *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
            scroll-behavior: auto !important;
          }
          /* Make staggered children visible immediately (animation: none leaves them at opacity:0) */
          .cfg-stagger > * { opacity: 1 !important; animation: none !important; transform: none !important; }
          .cfg-fade-in { opacity: 1 !important; animation: none !important; transform: none !important; }
          .cfg-glow-btn::before { display: none !important; }
        }

        /* CR-033: ensure small text remains legible — bump tiny labels on mobile */
        @media (max-width: 640px) {
          .cfg-root .text-\\[10px\\] { font-size: 11px !important; }
          .cfg-root .text-\\[11px\\] { font-size: 12px !important; }
        }
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
                {/* CR-032: 16/9 on mobile, 2/1 on desktop — avoids over-cropping the bike */}
                <div className="relative aspect-[16/9] w-full overflow-hidden sm:aspect-[2/1]">
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
                    {/* CR-039: dedup — DB-loaded bikes may include image_0 in gallery, fallback doesn't */}
                    {Array.from(new Set([selectedBike.image_url, ...selectedBike.specs.gallery])).map((img, i) => (
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

              {/* Battery — included (A4-style: lithium built-in, no choice) */}
              {isBatteryIncluded && activeBattery && (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 sm:p-6">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15"><Battery className="h-4 w-4 text-emerald-400" /></div>
                    <div>
                      <h3 className="text-sm font-bold">Аккумулятор в комплекте</h3>
                      <p className="text-xs text-[var(--cfg-text-dim)]">Литиевая батарея уже входит в стоимость</p>
                    </div>
                    <span className="ml-auto rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                      включено
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-[var(--cfg-border)] bg-[var(--cfg-surface)] p-3">
                      <p className="text-[10px] uppercase tracking-widest text-[var(--cfg-text-dim)]">Тип</p>
                      <p className="mt-1 text-sm font-semibold text-emerald-400">Lithium</p>
                    </div>
                    <div className="rounded-xl border border-[var(--cfg-border)] bg-[var(--cfg-surface)] p-3">
                      <p className="text-[10px] uppercase tracking-widest text-[var(--cfg-text-dim)]">Ёмкость</p>
                      <p className="mt-1 text-sm font-semibold">{activeBattery.capacity}</p>
                    </div>
                    <div className="rounded-xl border border-[var(--cfg-border)] bg-[var(--cfg-surface)] p-3 sm:col-span-1 col-span-2">
                      <p className="text-[10px] uppercase tracking-widest text-[var(--cfg-text-dim)]">Запас хода</p>
                      <p className="mt-1 text-sm font-semibold text-emerald-400">{activeBattery.range_km} км</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Battery — selectable (regular / lithium toggle) */}
              {!isBatteryIncluded && (
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

              {/* CR-019: color selection uses radiogroup semantics for screen readers */}
              <div className="rounded-2xl border border-[var(--cfg-border)] bg-[var(--cfg-surface)] p-5 sm:p-6">
                <div className="mb-4 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--cfg-accent)]/10"><Sparkles className="h-4 w-4 text-[var(--cfg-accent)]" /></div>
                  <div><h3 className="text-sm font-bold">Цвет</h3><p className="text-xs text-[var(--cfg-text-dim)]">Цвет попадёт в заказ и DOCX с factory ID</p></div>
                </div>
                <div role="radiogroup" aria-label="Цвет рамы" className="grid gap-2 sm:grid-cols-2">
                  {FACTORY_COLORS.map((color) => {
                    const active = selectedColorId === color.id
                    return (
                      <button
                        key={color.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setSelectedColorId(color.id)}
                        aria-label={`Цвет рамы ${color.label}${color.availability === 'out_of_stock' ? ' (нет в наличии)' : color.availability === 'made_to_order' ? ' (под заказ)' : ''}`}
                        className={[
                          'cfg-option flex items-center justify-between rounded-xl border p-4 text-left',
                          active ? 'cfg-option-active' : 'border-[var(--cfg-border)]',
                        ].join(' ')}
                      >
                        <span className="flex items-center gap-3">
                          <span
                            className="h-6 w-6 rounded-full border-2 border-white/20 shadow-inner"
                            style={{ backgroundColor: color.hex ?? '#6b7280' }}
                            aria-hidden="true"
                          />
                          <span>
                            <span className="block text-sm font-semibold">{color.label}</span>
                            <span className="block text-xs text-[var(--cfg-text-dim)]">
                              <span className="cfg-mono">{color.factoryId}</span>
                              {color.availability === 'out_of_stock' && <span className="ml-2 text-rose-400">нет в наличии</span>}
                              {color.availability === 'made_to_order' && <span className="ml-2 text-amber-400">под заказ</span>}
                            </span>
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
                const Icon = PART_ICONS[category] || Sparkles
                const selectedInCat = categoryParts.filter((p) => (accessoryQuantities[p.id] ?? 0) > 0).length
                const allSelected = selectedInCat === categoryParts.length && categoryParts.length > 0
                return (
                  <div key={category} className="rounded-2xl border border-[var(--cfg-border)] bg-[var(--cfg-surface)] p-5 sm:p-6">
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5"><Icon className="h-4 w-4 text-[var(--cfg-text-muted)]" /></div>
                      <h3 className="text-sm font-bold">{CATEGORY_LABELS[category] ?? category}</h3>
                      <span className="text-xs text-[var(--cfg-text-dim)]">{categoryParts.length} поз.</span>
                      {selectedInCat > 0 && (
                        <span className="rounded-full bg-[var(--cfg-accent)]/15 px-2 py-0.5 text-xs font-bold text-[var(--cfg-accent)]">
                          {selectedInCat} выбрано
                        </span>
                      )}
                      <div className="ml-auto flex gap-1">
                        {/* CR-017: bigger touch targets (py-1.5 text-xs = ~32px) */}
                        <button
                          type="button"
                          onClick={() => selectAllInCategory(categoryParts)}
                          disabled={allSelected}
                          className={[
                            'rounded-md border px-3 py-1.5 text-xs font-semibold transition-all',
                            allSelected
                              ? 'border-[var(--cfg-border)] text-[var(--cfg-text-dim)] opacity-50 cursor-not-allowed'
                              : 'border-[var(--cfg-border)] text-[var(--cfg-text-muted)] hover:border-[var(--cfg-accent)]/40 hover:text-[var(--cfg-accent)]',
                          ].join(' ')}
                        >
                          Все
                        </button>
                        <button
                          type="button"
                          onClick={() => clearCategory(categoryParts)}
                          disabled={selectedInCat === 0}
                          className={[
                            'rounded-md border px-3 py-1.5 text-xs font-semibold transition-all',
                            selectedInCat === 0
                              ? 'border-[var(--cfg-border)] text-[var(--cfg-text-dim)] opacity-50 cursor-not-allowed'
                              : 'border-[var(--cfg-border)] text-[var(--cfg-text-muted)] hover:border-rose-400/40 hover:text-rose-400',
                          ].join(' ')}
                        >
                          Очистить
                        </button>
                      </div>
                    </div>
                    {/* CR-018: single tab stop per card — the whole card is a button.
                        The qty stepper is a separate tab stop group (only visible when selected). */}
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {categoryParts.map((part) => {
                        const qty = accessoryQuantities[part.id] ?? 0
                        const checked = qty > 0
                        const isRecommended = RECOMMENDED_PART_IDS.has(part.id)
                        return (
                          <div
                            key={part.id}
                            className={[
                              'group relative flex flex-col gap-2 rounded-xl border p-4 text-left transition-all duration-200',
                              checked
                                ? 'border-[var(--cfg-accent)] bg-[var(--cfg-accent)]/8 shadow-[0_0_20px_-4px_var(--cfg-accent)]'
                                : 'border-[var(--cfg-border)] hover:border-[var(--cfg-text-dim)] hover:bg-white/3',
                            ].join(' ')}
                          >
                            {/* Top-right: recommended badge (decorative) + check indicator (part of the card button) */}
                            {isRecommended && !checked && (
                              <span className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-400 pointer-events-none">
                                <Star className="h-3 w-3 fill-amber-400" />Топ
                              </span>
                            )}
                            {checked && (
                              <span className="absolute right-3 top-3 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--cfg-accent)] pointer-events-none">
                                <Check className="h-3.5 w-3.5 text-black" />
                              </span>
                            )}
                            {/* CR-018: single button = single tab stop. Whole card toggles selection. */}
                            <button
                              type="button"
                              onClick={() => toggleAccessory(part.id)}
                              aria-pressed={checked}
                              aria-label={`${checked ? 'Убрать' : 'Добавить'}: ${part.model}, ${formatPrice(part.daily_price)}`}
                              className="flex flex-1 flex-col gap-2 text-left pr-8"
                            >
                              {/* CR-023: use next/image with fill for part thumbnails */}
                              {part.image_url && (
                                <div className="relative h-16 w-full overflow-hidden rounded-lg bg-white/5">
                                  <Image
                                    src={part.image_url}
                                    alt={part.model}
                                    fill
                                    sizes="200px"
                                    className="object-cover"
                                    loading="lazy"
                                  />
                                </div>
                              )}
                              <span className="block text-sm font-semibold leading-tight">{part.model}</span>
                              <span className="block text-xs leading-relaxed text-[var(--cfg-text-dim)] line-clamp-2">{part.description}</span>
                              <span className="cfg-mono mt-1 text-sm font-bold text-[var(--cfg-accent)]">
                                +{formatPrice(part.daily_price)}
                              </span>
                            </button>
                            {/* CR-017: qty stepper with bigger touch targets (h-9 w-9 = 36px).
                                stopPropagation so tapping +/- doesn't toggle the card. */}
                            {checked && (
                              <div
                                className="flex items-center gap-1 self-end rounded-lg border border-[var(--cfg-border)] bg-[var(--cfg-bg)] p-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setAccessoryQty(part.id, qty - 1) }}
                                  aria-label={`Уменьшить количество: ${part.model}`}
                                  className="flex h-9 w-9 items-center justify-center rounded text-[var(--cfg-text-muted)] hover:bg-white/5 hover:text-white transition-colors"
                                >
                                  <Minus className="h-4 w-4" />
                                </button>
                                <span className="cfg-mono w-7 text-center text-sm font-bold text-white" aria-live="polite">{qty}</span>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setAccessoryQty(part.id, qty + 1) }}
                                  disabled={qty >= 9}
                                  aria-label={`Увеличить количество: ${part.model}`}
                                  className="flex h-9 w-9 items-center justify-center rounded text-[var(--cfg-text-muted)] hover:bg-white/5 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                  <Plus className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
              {selectedAccessoryIds.length > 0 && (
                <div className="flex items-center justify-between rounded-xl border border-[var(--cfg-accent)]/20 bg-[var(--cfg-accent)]/5 px-4 py-3">
                  <span className="text-sm text-[var(--cfg-text-muted)]">
                    Выбрано позиций: <span className="font-bold text-white">{selectedAccessoryIds.length}</span>
                    {selectedAccessoriesCount !== selectedAccessoryIds.length && (
                      <span className="text-[var(--cfg-text-dim)]"> · {selectedAccessoriesCount} шт. всего</span>
                    )}
                  </span>
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
                  {/* CR-031: 6 spec cards in 3-col grid (was 5 in 4-col — orphan on 2nd row) */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {[
                      { icon: Zap, label: 'Мотор', value: `${selectedMotor?.value ?? '3000'}W` },
                      { icon: Battery, label: 'Батарея', value: activeBattery ? activeBattery.capacity : '—' },
                      { icon: Gauge, label: 'Скорость', value: `${selectedBike.specs.max_speed_kmh} км/ч` },
                      { icon: MapPin, label: 'Запас хода', value: activeBattery ? `${activeBattery.range_km} км` : '—' }, /* CR-022: MapPin for range */
                      { icon: Sparkles, label: 'Цвет', value: selectedColor?.label ?? '—' },
                      { icon: Shield, label: 'Тип батареи', value: isBatteryIncluded ? 'Lithium' : (batteryMode === 'lithium' ? 'Lithium' : 'Regular') },
                    ].map(({ icon: Icon, label, value }) => (
                      <div key={label} className="rounded-xl border border-[var(--cfg-border)] bg-[var(--cfg-surface)] p-3">
                        <Icon className="mb-1.5 h-4 w-4 text-[var(--cfg-text-dim)]" aria-hidden="true" />
                        <p className="cfg-mono text-base font-bold leading-tight">{value}</p>
                        <p className="text-xs uppercase tracking-widest text-[var(--cfg-text-dim)]">{label}</p>
                      </div>
                    ))}
                  </div>
                  {selectedAccessoryIds.length > 0 && (
                    <div className="rounded-xl border border-[var(--cfg-border)] bg-[var(--cfg-surface)] p-4">
                      <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-[var(--cfg-text-dim)]">Доп. опции</h4>
                      <div className="space-y-2">
                        {selectedAccessoryIds.map((id) => {
                          const part = parts.find((p) => p.id === id)
                          if (!part) return null
                          const qty = accessoryQuantities[id] ?? 1
                          const lineTotal = part.daily_price * qty
                          return (
                            <div key={id} className="flex items-center justify-between text-sm">
                              <span className="flex items-center gap-2 text-[var(--cfg-text-muted)]">
                                <Check className="h-3.5 w-3.5 text-[var(--cfg-accent)]" />
                                {part.model}
                                {qty > 1 && <span className="cfg-mono text-[10px] text-[var(--cfg-text-dim)]">×{qty}</span>}
                              </span>
                              <span className="cfg-mono text-xs">+{formatPrice(lineTotal)}</span>
                            </div>
                          )
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
                        {accessoriesTotal > 0 && <div className="flex justify-between"><span className="text-[var(--cfg-text-muted)]">Опции ({selectedAccessoriesCount} шт.)</span><span className="cfg-mono font-medium">+{formatPrice(accessoriesTotal)}</span></div>}
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

        {/* ── MOBILE STICKY BAR ──
            CR-035: hide on summary step (button was redundant — user already on summary).
            CR-036: spacer is inside this conditional so it doesn't add dead space when bar is hidden. */}
        {selectedBike && tab !== 'summary' && (
          <>
            <div className="cfg-sticky-bar fixed inset-x-0 bottom-0 z-50 border-t border-[var(--cfg-border)] bg-[var(--cfg-bg)]/90 px-4 py-3 sm:hidden">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-widest text-[var(--cfg-text-muted)]">{selectedBike.make} {selectedBike.model}</p>
                  <p className="cfg-mono text-xl font-black text-[var(--cfg-accent)]">{formatPrice(total)}</p>
                </div>
                <Button onClick={() => setTab('summary')} size="sm" className="bg-[var(--cfg-accent)] font-bold text-black h-10 px-4">Итог<ChevronRight className="ml-1 h-4 w-4" /></Button>
              </div>
            </div>
            {/* Spacer so content isn't hidden behind the sticky bar on mobile */}
            <div className="h-20 sm:h-0" aria-hidden="true" />
          </>
        )}
      </section>
    </>
  )
}
