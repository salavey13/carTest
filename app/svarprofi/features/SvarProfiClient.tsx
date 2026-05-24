'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Shield,
  Ruler,
  Truck,
  Clock,
  Palette,
  Handshake,
  Phone,
  MessageCircle,
  ChevronRight,
  Wrench,
  Building2,
  Columns3,
  Stairs,
  HardHat,
  Flame,
  ArrowRight,
  Star,
  CheckCircle2,
  ImageIcon,
  Send,
  Menu,
} from 'lucide-react'

// ─────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────

interface MetalProductSpecs {
  type: string
  subtype: string | null
  manufacturer: string
  model: string
  profile_type: string | null
  coating_type: string | null
  assembly_type: string | null
  weld_type: string | null
  features: string[]
  gallery: string[]
  buy_colors?: Array<{ name: string; ral: string; swatch: string }>
  delivery_available: boolean | null
  installation_available: boolean | null
  delivery_region: string | null
  price_rub: number | null
  production_days: number | null
}

interface MetalProduct {
  id: string
  make: string
  model: string
  description: string
  image_url: string
  specs: MetalProductSpecs
}

// FIX: Runtime data from the API may have `specs` partially undefined.
// This normalizer ensures every nested array/field has a safe default,
// preventing "Cannot read properties of undefined (reading 'length')" crashes.
const EMPTY_SPECS: MetalProductSpecs = {
  type: '',
  subtype: null,
  manufacturer: '',
  model: '',
  profile_type: null,
  coating_type: null,
  assembly_type: null,
  weld_type: null,
  features: [],
  gallery: [],
  buy_colors: [],
  delivery_available: null,
  installation_available: null,
  delivery_region: null,
  price_rub: null,
  production_days: null,
}

function normalizeProduct(item: Partial<MetalProduct> & { id: string; image_url: string }): MetalProduct {
  const raw = item.specs
  return {
    id: item.id,
    make: item.make ?? '',
    model: item.model ?? '',
    description: item.description ?? '',
    image_url: item.image_url,
    specs: raw
      ? {
          type: raw.type ?? '',
          subtype: raw.subtype ?? null,
          manufacturer: raw.manufacturer ?? '',
          model: raw.model ?? '',
          profile_type: raw.profile_type ?? null,
          coating_type: raw.coating_type ?? null,
          assembly_type: raw.assembly_type ?? null,
          weld_type: raw.weld_type ?? null,
          features: Array.isArray(raw.features) ? raw.features : [],
          gallery: Array.isArray(raw.gallery) ? raw.gallery : [],
          buy_colors: Array.isArray(raw.buy_colors) ? raw.buy_colors : [],
          delivery_available: raw.delivery_available ?? null,
          installation_available: raw.installation_available ?? null,
          delivery_region: raw.delivery_region ?? null,
          price_rub: raw.price_rub ?? null,
          production_days: raw.production_days ?? null,
        }
      : { ...EMPTY_SPECS },
  }
}

interface FranchiseTheme {
  mode: 'dark' | 'light'
  palette: Record<string, string>
  effects?: {
    gradientHero?: boolean
    gradientFrom?: string
    gradientVia?: string
    gradientTo?: string
    gradientDirection?: string
  }
}

// ─────────────────────────────────────────────────────
// Franchise Data (from SQL hydration)
// ─────────────────────────────────────────────────────

const BRAND = {
  name: 'СварПрофи-НН',
  shortName: 'СварПрофи',
  tagline: 'Металлические конструкции любой сложности — от чертежа до монтажа',
  phone: '+7 (904) 060-06-44',
  phoneHref: 'tel:+79040600644',
  telegram: 'https://t.me/svarprofi_nn',
  city: 'Москва',
}

const IMAGES = {
  logo: 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/svarprofi/logo.png',
  hero: 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/svarprofi/hero.jpg',
  aboutHero: 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/svarprofi/about-hero.jpg',
  promoKarkasy: 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/svarprofi/promo-karkasy.jpg',
  promoNavesy: 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/svarprofi/promo-navesy.jpg',
  promoOgrazhdeniya: 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/svarprofi/promo-ograzhdeniya.jpg',
  adCertified: 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/svarprofi/ad-certified.jpg',
  adDelivery: 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/svarprofi/ad-delivery.jpg',
}

const CATEGORIES = [
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

const FEATURES = [
  { icon: Shield, title: 'Гарантия качества', description: 'Все изделия сертифицированы по ГОСТ. Контроль качества на каждом этапе производства.' },
  { icon: Ruler, title: 'Проектирование', description: 'Разработка КМ и КЖ чертежей. Индивидуальный подход к каждому проекту.' },
  { icon: Truck, title: 'Доставка и монтаж', description: 'Доставка по Москве, МО и ЦФО. Профессиональный монтаж бригадой опытных сварщиков.' },
  { icon: Clock, title: 'Точные сроки', description: 'Собственное производство позволяет соблюдать сроки.' },
  { icon: Palette, title: 'Любое исполнение', description: 'Порошковая покраска в любой цвет по RAL. Оцинковка. Комбинированная защита.' },
  { icon: Handshake, title: 'Договор и оплата', description: 'Работаем по договору. Безналичная оплата.' },
]

const ORDER_STEPS = [
  { step: 1, title: 'Заявка', description: 'Оставьте заявку на сайте или позвоните' },
  { step: 2, title: 'Замер', description: 'Выезд замерщика (бесплатно по Москве)' },
  { step: 3, title: 'Проект', description: 'Разработка чертежей и согласование' },
  { step: 4, title: 'Производство', description: 'Изготовление конструкции на нашем производстве' },
  { step: 5, title: 'Доставка', description: 'Доставка на объект' },
  { step: 6, title: 'Монтаж', description: 'Профессиональный монтаж и сдача объекта' },
]

const FAQ_ITEMS = [
  { question: 'Какие минимальные сроки изготовления?', answer: 'Типовые конструкции — от 7 рабочих дней. Индивидуальные проекты — от 14 дней в зависимости от сложности.' },
  { question: 'Работаете ли вы с физическими лицами?', answer: 'Да, мы работаем как с юридическими, так и с физическими лицами. Оформление по договору.' },
  { question: 'Какие марки стали вы используете?', answer: 'Основные марки: С245, С345, 09Г2С, Ст3пс. Возможна работа с другими марками по запросу.' },
  { question: 'Есть ли гарантия на конструкции?', answer: 'Гарантия на сварные конструкции — от 5 лет. На антикоррозийное покрытие — от 3 лет.' },
  { question: 'Возможен ли выезд замерщика?', answer: 'Да, выезд замерщика по Москве — бесплатно. По области — по договорённости.' },
]

const MATERIALS = [
  { grade: 'С245', description: 'Углеродистая сталь общего назначения' },
  { grade: 'С345', description: 'Низколегированная сталь повышенной прочности' },
  { grade: '09Г2С', description: 'Конструкционная низколегированная сталь для сварных конструкций' },
]

const TICKER_ITEMS = [
  'Бесплатный выезд замерщика по Москве',
  'Доставка по ЦФО',
  'Гарантия на все конструкции от 5 лет',
]

// ─────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────

export function SvarProfiClient({ items: initialItems }: { items?: MetalProduct[] }) {
  const [catalogItems, setCatalogItems] = useState<MetalProduct[]>(initialItems ?? [])
  const [orderOpen, setOrderOpen] = useState(false)
  const [orderSubmitted, setOrderSubmitted] = useState(false)
  const [galleryOpen, setGalleryOpen] = useState<string | null>(null)

  // Fetch catalog if not provided
  useEffect(() => {
    if (catalogItems.length === 0) {
      fetch('/api/franchize/catalog?slug=svarprofi')
        .then(r => r.json())
        .then(p => {
          const raw: unknown[] = p?.data?.items ?? []
          // FIX: normalize every item from the API — gallery/features may be undefined
          const safe = raw.map((item: Record<string, unknown>) =>
            normalizeProduct({
              id: (item.id as string) ?? '',
              make: (item.make as string) ?? '',
              model: (item.model as string) ?? '',
              description: (item.description as string) ?? '',
              image_url: (item.image_url as string) ?? '',
              specs: item.specs as Partial<MetalProductSpecs> | undefined,
            })
          )
          setCatalogItems(safe)
        })
        .catch(() => setCatalogItems([]))
    }
  }, [catalogItems.length])

  // Combine catalog items with fallback demo items
  const displayItems = useMemo(() => {
    if (catalogItems.length > 0) return catalogItems
    // Fallback demo items from SQL seed
    return [
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
    ] as MetalProduct[]
  }, [catalogItems])

  return (
    <div className="relative min-h-screen bg-[#1A1D23] text-[#E8ECF1]">
      {/* Background gradient */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: 'linear-gradient(to bottom right, #1A1D23 0%, #1F2937 50%, #0F172A 100%)',
        }}
      />

      <div className="relative z-10">
        {/* ── Header ── */}
        <Header />

        {/* ── Hero ── */}
        <HeroSection onOrderClick={() => setOrderOpen(true)} />

        {/* ── Ticker ── */}
        <TickerBar />

        {/* ── Categories ── */}
        <CategoriesSection />

        {/* ── Products Showcase ── */}
        <ProductsShowcase
          items={displayItems}
          onGalleryOpen={setGalleryOpen}
          onOrderClick={() => setOrderOpen(true)}
        />

        {/* ── Features ── */}
        <FeaturesSection />

        {/* ── Order Process ── */}
        <OrderProcessSection />

        {/* ── Materials ── */}
        <MaterialsSection />

        {/* ── Ad Cards ── */}
        <AdCardsSection />

        {/* ── FAQ ── */}
        <FaqSection />

        {/* ── Footer ── */}
        <FooterSection />
      </div>

      {/* ── Order Sheet ── */}
      <OrderSheet open={orderOpen} onOpenChange={setOrderOpen} submitted={orderSubmitted} onSubmitted={setOrderSubmitted} />

      {/* ── Gallery Lightbox ── */}
      {galleryOpen && (
        <GalleryLightbox items={displayItems} productId={galleryOpen} onClose={() => setGalleryOpen(null)} />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────────────

function Header() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <header
      className={cn(
        'sticky top-0 z-50 transition-all duration-300',
        scrolled ? 'bg-[#1A1D23]/95 backdrop-blur-md shadow-lg shadow-black/20' : 'bg-transparent'
      )}
    >
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        {/* Logo + name */}
        <div className="flex items-center gap-3">
          <img
            src={IMAGES.logo}
            alt={BRAND.shortName}
            className="h-9 w-9 rounded-lg object-contain"
          />
          <div className="flex flex-col">
            <span className="text-lg font-bold leading-tight text-[#E8ECF1]">
              {BRAND.shortName}
            </span>
            <span className="text-[11px] leading-tight text-[#8A92A0]">
              Металлоконструкции · {BRAND.city}
            </span>
          </div>
        </div>

        {/* Nav (desktop) */}
        <nav className="hidden items-center gap-6 md:flex">
          <a href="#catalog" className="text-sm text-[#8A92A0] transition-colors hover:text-[#E8ECF1]">Каталог</a>
          <a href="#features" className="text-sm text-[#8A92A0] transition-colors hover:text-[#E8ECF1]">О компании</a>
          <a href="#faq" className="text-sm text-[#8A92A0] transition-colors hover:text-[#E8ECF1]">FAQ</a>
          <a href={BRAND.phoneHref} className="text-sm text-[#8A92A0] transition-colors hover:text-[#2E7DBF]">
            <Phone className="mr-1 inline h-3.5 w-3.5" />
            {BRAND.phone}
          </a>
          <Button
            size="sm"
            className="bg-[#2E7DBF] text-white hover:bg-[#2563A0]"
            onClick={() => window.open(BRAND.phoneHref)}
          >
            Позвонить
          </Button>
        </nav>

        {/* Mobile menu */}
        <Sheet>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon" className="text-[#8A92A0]">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="bg-[#1A1D23] text-[#E8ECF1] border-[#3A4250]">
            <SheetHeader>
              <SheetTitle className="text-[#E8ECF1]">{BRAND.shortName}</SheetTitle>
            </SheetHeader>
            <nav className="mt-6 flex flex-col gap-4">
              <a href="#catalog" className="text-base text-[#C8CDD5] hover:text-[#2E7DBF]">Каталог</a>
              <a href="#features" className="text-base text-[#C8CDD5] hover:text-[#2E7DBF]">О компании</a>
              <a href="#faq" className="text-base text-[#C8CDD5] hover:text-[#2E7DBF]">FAQ</a>
              <Separator className="bg-[#3A4250]" />
              <a href={BRAND.phoneHref} className="flex items-center gap-2 text-base text-[#2E7DBF]">
                <Phone className="h-4 w-4" /> {BRAND.phone}
              </a>
              <a href={BRAND.telegram} target="_blank" className="flex items-center gap-2 text-base text-[#2E7DBF]">
                <MessageCircle className="h-4 w-4" /> Telegram
              </a>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}

// ─────────────────────────────────────────────────────
// Hero Section
// ─────────────────────────────────────────────────────

function HeroSection({ onOrderClick }: { onOrderClick: () => void }) {
  return (
    <section className="relative overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0 z-0">
        <img
          src={IMAGES.hero}
          alt="Металлоконструкции"
          className="h-full w-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#1A1D23]/60 via-[#1A1D23]/80 to-[#1A1D23]" />
      </div>

      <div className="relative z-10 container mx-auto max-w-7xl px-4 py-20 md:py-32">
        <div className="max-w-2xl">
          <Badge className="mb-4 bg-[#D4740E]/20 text-[#D4740E] border-[#D4740E]/30 hover:bg-[#D4740E]/30">
            <HardHat className="mr-1 h-3 w-3" /> Производитель металлоконструкций
          </Badge>

          <h1 className="mb-4 text-4xl font-extrabold leading-tight tracking-tight md:text-5xl lg:text-6xl">
            Надёжные<br />
            <span className="text-[#2E7DBF]">металлоконструкции</span><br />
            от производителя
          </h1>

          <p className="mb-8 max-w-lg text-lg text-[#8A92A0] md:text-xl">
            {BRAND.tagline}
          </p>

          <div className="flex flex-wrap gap-3">
            <Button
              size="lg"
              className="bg-[#2E7DBF] text-white hover:bg-[#2563A0] h-12 px-8 text-base"
              onClick={onOrderClick}
            >
              Оставить заявку <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-[#3A4250] text-[#C8CDD5] hover:bg-[#242830] hover:text-white h-12 px-8 text-base"
              onClick={() => window.open(BRAND.phoneHref)}
            >
              <Phone className="mr-2 h-4 w-4" /> Позвонить
            </Button>
          </div>

          {/* Quick stats */}
          <div className="mt-10 flex gap-8">
            {[
              { value: '5+', label: 'лет гарантии' },
              { value: '7', label: 'дней производство' },
              { value: 'ЦФО', label: 'доставка' },
            ].map((s) => (
              <div key={s.label} className="flex flex-col">
                <span className="text-2xl font-bold text-[#2E7DBF]">{s.value}</span>
                <span className="text-xs text-[#8A92A0]">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────
// Ticker
// ─────────────────────────────────────────────────────

function TickerBar() {
  return (
    <div className="border-y border-[#3A4250]/50 bg-[#242830]/80 backdrop-blur-sm">
      <div className="container mx-auto flex max-w-7xl items-center gap-6 overflow-x-auto px-4 py-2.5">
        {TICKER_ITEMS.map((item, i) => (
          <div key={i} className="flex shrink-0 items-center gap-2 text-sm text-[#8A92A0]">
            <CheckCircle2 className="h-3.5 w-3.5 text-[#2E7DBF]" />
            {item}
            {i < TICKER_ITEMS.length - 1 && <span className="ml-4 text-[#3A4250]">|</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────
// Categories
// ─────────────────────────────────────────────────────

function CategoriesSection() {
  return (
    <section id="catalog" className="container mx-auto max-w-7xl px-4 py-16 md:py-20">
      <div className="mb-10 text-center">
        <h2 className="mb-3 text-3xl font-bold md:text-4xl">Каталог продукции</h2>
        <p className="text-[#8A92A0]">Металлические конструкции для любых задач</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon
          return (
            <Card
              key={cat.id}
              className="group overflow-hidden border-[#3A4250] bg-[#242830] transition-all duration-300 hover:border-[#2E7DBF]/50 hover:shadow-lg hover:shadow-[#2E7DBF]/10"
            >
              <div className="relative h-48 overflow-hidden">
                <img
                  src={cat.image}
                  alt={cat.title}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#242830] via-transparent to-transparent" />
                <div className="absolute bottom-3 left-3 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2E7DBF]/90">
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-lg font-bold">{cat.title}</span>
                </div>
              </div>
              <CardContent className="p-4">
                <p className="text-sm text-[#8A92A0]">{cat.description}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────
// Products Showcase
// ─────────────────────────────────────────────────────

function ProductsShowcase({
  items,
  onGalleryOpen,
  onOrderClick,
}: {
  items: MetalProduct[]
  onGalleryOpen: (id: string) => void
  onOrderClick: () => void
}) {
  if (items.length === 0) return null

  return (
    <section className="container mx-auto max-w-7xl px-4 py-16 md:py-20">
      <div className="mb-10 text-center">
        <h2 className="mb-3 text-3xl font-bold md:text-4xl">Наши конструкции</h2>
        <p className="text-[#8A92A0]">Примеры выполненных проектов</p>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {items.map((item) => (
          <Card
            key={item.id}
            className="group overflow-hidden border-[#3A4250] bg-[#242830] transition-all duration-300 hover:border-[#2E7DBF]/50"
          >
            {/* Image */}
            <div
              className="relative h-64 cursor-pointer overflow-hidden"
              onClick={() => onGalleryOpen(item.id)}
            >
              <img
                src={item.image_url}
                alt={item.model}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#242830] via-transparent to-transparent" />
              {/* FIX: use optional chaining — gallery may be [] from normalizeProduct, never undefined */}
              {item.specs.gallery.length > 1 && (
                <Badge className="absolute right-3 top-3 bg-black/60 text-white backdrop-blur-sm">
                  <ImageIcon className="mr-1 h-3 w-3" /> {item.specs.gallery.length} фото
                </Badge>
              )}
              {/* Type badge */}
              {item.specs.type && (
                <Badge className="absolute left-3 top-3 bg-[#2E7DBF]/90 text-white">
                  {item.specs.type}
                  {item.specs.subtype && ` · ${item.specs.subtype}`}
                </Badge>
              )}
            </div>

            <CardContent className="p-5">
              <h3 className="mb-2 text-xl font-bold">{item.model}</h3>
              <p className="mb-4 line-clamp-3 text-sm text-[#8A92A0]">{item.description}</p>

              {/* Features — FIX: features is always [] after normalizeProduct, .slice is safe */}
              {item.specs.features.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-1.5">
                  {item.specs.features.slice(0, 4).map((f, i) => (
                    <Badge
                      key={i}
                      variant="secondary"
                      className="bg-[#2A2E36] text-[#8A92A0] text-xs"
                    >
                      {f}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Colors — FIX: buy_colors is always [] after normalizeProduct */}
              {item.specs.buy_colors && item.specs.buy_colors.length > 0 && (
                <div className="mb-4 flex items-center gap-2">
                  <span className="text-xs text-[#8A92A0]">Цвета:</span>
                  {item.specs.buy_colors.map((c, i) => (
                    <div
                      key={i}
                      className="group/color relative flex items-center gap-1"
                    >
                      <div
                        className="h-4 w-4 rounded-full border border-white/20"
                        style={{ backgroundColor: c.swatch }}
                      />
                      <span className="text-[10px] text-[#8A92A0] opacity-0 transition-opacity group-hover/color:opacity-100">
                        {c.ral}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Specs summary */}
              <div className="mb-4 grid grid-cols-2 gap-2 text-xs">
                {item.specs.profile_type && (
                  <div className="flex items-center gap-1 text-[#8A92A0]">
                    <Flame className="h-3 w-3 text-[#D4740E]" /> {item.specs.profile_type}
                  </div>
                )}
                {item.specs.assembly_type && (
                  <div className="flex items-center gap-1 text-[#8A92A0]">
                    <Wrench className="h-3 w-3 text-[#2E7DBF]" /> {item.specs.assembly_type}
                  </div>
                )}
                {item.specs.delivery_available && (
                  <div className="flex items-center gap-1 text-[#8A92A0]">
                    <Truck className="h-3 w-3 text-[#43A047]" /> Доставка
                  </div>
                )}
                {item.specs.installation_available && (
                  <div className="flex items-center gap-1 text-[#8A92A0]">
                    <HardHat className="h-3 w-3 text-[#D4740E]" /> Монтаж
                  </div>
                )}
              </div>

              <Button
                className="w-full bg-[#2E7DBF] text-white hover:bg-[#2563A0]"
                onClick={onOrderClick}
              >
                Запросить расчёт <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────
// Features
// ─────────────────────────────────────────────────────

function FeaturesSection() {
  return (
    <section id="features" className="container mx-auto max-w-7xl px-4 py-16 md:py-20">
      <div className="mb-10 text-center">
        <h2 className="mb-3 text-3xl font-bold md:text-4xl">Почему мы</h2>
        <p className="text-[#8A92A0]">Полный цикл от проекта до монтажа</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f, i) => {
          const Icon = f.icon
          return (
            <Card
              key={i}
              className="border-[#3A4250] bg-[#242830] transition-all duration-300 hover:border-[#2E7DBF]/40"
            >
              <CardContent className="p-5">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[#2E7DBF]/15">
                  <Icon className="h-5 w-5 text-[#2E7DBF]" />
                </div>
                <h3 className="mb-1.5 font-bold">{f.title}</h3>
                <p className="text-sm text-[#8A92A0]">{f.description}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────
// Order Process
// ─────────────────────────────────────────────────────

function OrderProcessSection() {
  return (
    <section className="border-y border-[#3A4250]/50 bg-[#242830]/50">
      <div className="container mx-auto max-w-7xl px-4 py-16 md:py-20">
        <div className="mb-10 text-center">
          <h2 className="mb-3 text-3xl font-bold md:text-4xl">Как заказать</h2>
          <p className="text-[#8A92A0]">Простой процесс от заявки до монтажа</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ORDER_STEPS.map((s) => (
            <div key={s.step} className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#2E7DBF] text-lg font-bold text-white">
                {s.step}
              </div>
              <div>
                <h3 className="font-bold">{s.title}</h3>
                <p className="text-sm text-[#8A92A0]">{s.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────
// Materials
// ─────────────────────────────────────────────────────

function MaterialsSection() {
  return (
    <section className="container mx-auto max-w-7xl px-4 py-16 md:py-20">
      <div className="mb-10 text-center">
        <h2 className="mb-3 text-3xl font-bold md:text-4xl">Марки стали</h2>
        <p className="text-[#8A92A0]">Работаем с сертифицированными материалами</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {MATERIALS.map((m) => (
          <Card key={m.grade} className="border-[#3A4250] bg-[#242830]">
            <CardContent className="p-5 text-center">
              <div className="mb-2 text-3xl font-extrabold text-[#2E7DBF]">{m.grade}</div>
              <p className="text-sm text-[#8A92A0]">{m.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────
// Ad Cards
// ─────────────────────────────────────────────────────

function AdCardsSection() {
  return (
    <section className="container mx-auto max-w-7xl px-4 py-8">
      <div className="grid gap-6 md:grid-cols-2">
        {[
          {
            title: 'Сертифицированная сварка',
            description: 'Качество сварных швов по ISO 3834. Каждый шов проходит контроль.',
            image: IMAGES.adCertified,
          },
          {
            title: 'Доставка и монтаж',
            description: 'Доставка и монтаж бригадой опытных специалистов по Москве и МО.',
            image: IMAGES.adDelivery,
          },
        ].map((ad, i) => (
          <Card
            key={i}
            className="group overflow-hidden border-[#3A4250] bg-[#242830] transition-all duration-300 hover:border-[#D4740E]/40"
          >
            <div className="relative h-44 overflow-hidden">
              <img
                src={ad.image}
                alt={ad.title}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#242830] via-[#242830]/40 to-transparent" />
              <div className="absolute bottom-3 left-4 right-4">
                <h3 className="text-lg font-bold">{ad.title}</h3>
                <p className="text-sm text-[#C8CDD5]">{ad.description}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────
// FAQ
// ─────────────────────────────────────────────────────

function FaqSection() {
  return (
    <section id="faq" className="container mx-auto max-w-7xl px-4 py-16 md:py-20">
      <div className="mb-10 text-center">
        <h2 className="mb-3 text-3xl font-bold md:text-4xl">Частые вопросы</h2>
      </div>

      <div className="mx-auto max-w-2xl">
        <Accordion type="single" collapsible className="space-y-3">
          {FAQ_ITEMS.map((faq, i) => (
            <AccordionItem
              key={i}
              value={`q-${i}`}
              className="rounded-xl border-[#3A4250] bg-[#242830] px-5 data-[state=open]:border-[#2E7DBF]/40"
            >
              <AccordionTrigger className="text-left text-base font-medium hover:no-underline">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-[#8A92A0]">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────
// Footer
// ─────────────────────────────────────────────────────

function FooterSection() {
  return (
    <footer className="border-t border-[#3A4250]/50 bg-[#14161A]">
      <div className="container mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {/* Products */}
          <div>
            <h3 className="mb-4 font-bold">Продукция</h3>
            <ul className="space-y-2">
              {CATEGORIES.map((c) => (
                <li key={c.id}>
                  <a href={`#catalog`} className="text-sm text-[#8A92A0] transition-colors hover:text-[#2E7DBF]">
                    {c.title}
                  </a>
                </li>
              ))}
              <li>
                <a href="#catalog" className="text-sm text-[#8A92A0] transition-colors hover:text-[#2E7DBF]">
                  Лестницы
                </a>
              </li>
              <li>
                <a href="#catalog" className="text-sm text-[#8A92A0] transition-colors hover:text-[#2E7DBF]">
                  Индивидуальные проекты
                </a>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="mb-4 font-bold">Компания</h3>
            <ul className="space-y-2">
              <li><a href="#features" className="text-sm text-[#8A92A0] hover:text-[#2E7DBF]">О нас</a></li>
              <li><a href="#features" className="text-sm text-[#8A92A0] hover:text-[#2E7DBF]">Сертификаты</a></li>
              <li><a href="#faq" className="text-sm text-[#8A92A0] hover:text-[#2E7DBF]">FAQ</a></li>
            </ul>
          </div>

          {/* Contacts */}
          <div>
            <h3 className="mb-4 font-bold">Контакты</h3>
            <ul className="space-y-2">
              <li>
                <a href={BRAND.phoneHref} className="flex items-center gap-2 text-sm text-[#8A92A0] hover:text-[#2E7DBF]">
                  <Phone className="h-3.5 w-3.5" /> {BRAND.phone}
                </a>
              </li>
              <li>
                <a href={BRAND.telegram} target="_blank" className="flex items-center gap-2 text-sm text-[#8A92A0] hover:text-[#2E7DBF]">
                  <MessageCircle className="h-3.5 w-3.5" /> Telegram
                </a>
              </li>
              <li>
                <span className="flex items-center gap-2 text-sm text-[#8A92A0]">
                  <Building2 className="h-3.5 w-3.5" /> {BRAND.city}
                </span>
              </li>
            </ul>
          </div>
        </div>

        <Separator className="my-8 bg-[#3A4250]" />

        <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
          <p className="text-xs text-[#8A92A0]">
            &copy; {new Date().getFullYear()} ООО &laquo;СварПрофи-НН&raquo;. Все права защищены.
          </p>
          <p className="text-xs text-[#3A4250]">Powered by СварПрофи-НН</p>
        </div>
      </div>
    </footer>
  )
}

// ─────────────────────────────────────────────────────
// Order Sheet (notification-only)
// ─────────────────────────────────────────────────────

function OrderSheet({
  open,
  onOpenChange,
  submitted,
  onSubmitted,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  submitted: boolean
  onSubmitted: (v: boolean) => void
}) {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    product_type: '',
    dimensions: '',
    comment: '',
  })

  const handleSubmit = useCallback(() => {
    // Notification-only: just mark as submitted (real backend would POST)
    onSubmitted(true)
    setTimeout(() => {
      onOpenChange(false)
      onSubmitted(false)
      setForm({ name: '', phone: '', email: '', product_type: '', dimensions: '', comment: '' })
    }, 2500)
  }, [onSubmitted, onOpenChange])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="bg-[#1A1D23] text-[#E8ECF1] border-[#3A4250] sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-[#E8ECF1]">Оставить заявку</SheetTitle>
        </SheetHeader>

        {submitted ? (
          <div className="flex flex-col items-center justify-center gap-4 py-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#2E7DBF]/20">
              <CheckCircle2 className="h-8 w-8 text-[#2E7DBF]" />
            </div>
            <h3 className="text-xl font-bold">Заявка отправлена!</h3>
            <p className="text-center text-sm text-[#8A92A0]">
              Менеджер свяжется с вами для уточнения деталей и расчёта стоимости.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Ваше имя *</label>
              <Input
                className="border-[#3A4250] bg-[#242830] text-[#E8ECF1]"
                placeholder="Иван Петров"
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Телефон *</label>
              <Input
                className="border-[#3A4250] bg-[#242830] text-[#E8ECF1]"
                placeholder="+7 (___) ___-__-__"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Email</label>
              <Input
                className="border-[#3A4250] bg-[#242830] text-[#E8ECF1]"
                placeholder="ivan@example.com"
                type="email"
                value={form.email}
                onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Тип конструкции *</label>
              <Select value={form.product_type} onValueChange={(v) => setForm(f => ({ ...f, product_type: v }))}>
                <SelectTrigger className="border-[#3A4250] bg-[#242830] text-[#E8ECF1]">
                  <SelectValue placeholder="Выберите тип" />
                </SelectTrigger>
                <SelectContent className="border-[#3A4250] bg-[#242830]">
                  <SelectItem value="Каркас">Каркас</SelectItem>
                  <SelectItem value="Навес">Навес</SelectItem>
                  <SelectItem value="Ограждение">Ограждение</SelectItem>
                  <SelectItem value="Лестница">Лестница</SelectItem>
                  <SelectItem value="Индивидуальный проект">Индивидуальный проект</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Приблизительные размеры</label>
              <Input
                className="border-[#3A4250] bg-[#242830] text-[#E8ECF1]"
                placeholder="Например: 12x6x4 м"
                value={form.dimensions}
                onChange={(e) => setForm(f => ({ ...f, dimensions: e.target.value }))}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Комментарий</label>
              <Textarea
                className="border-[#3A4250] bg-[#242830] text-[#E8ECF1] min-h-[80px]"
                placeholder="Опишите ваш проект..."
                value={form.comment}
                onChange={(e) => setForm(f => ({ ...f, comment: e.target.value }))}
              />
            </div>

            <p className="text-[11px] text-[#8A92A0]">
              Нажимая «Отправить заявку», вы соглашаетесь на обработку персональных данных.
            </p>

            <Button
              className="w-full bg-[#2E7DBF] text-white hover:bg-[#2563A0] h-12 text-base"
              onClick={handleSubmit}
              disabled={!form.name || !form.phone || !form.product_type}
            >
              <Send className="mr-2 h-4 w-4" /> Отправить заявку
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

// ─────────────────────────────────────────────────────
// Gallery Lightbox
// ─────────────────────────────────────────────────────

function GalleryLightbox({
  items,
  productId,
  onClose,
}: {
  items: MetalProduct[]
  productId: string
  onClose: () => void
}) {
  const item = items.find((i) => i.id === productId)
  const [activeIdx, setActiveIdx] = useState(0)

  if (!item) return null

  // FIX: gallery is always [] after normalizeProduct, so .length is safe
  const gallery = item.specs.gallery.length > 0 ? item.specs.gallery : [item.image_url]

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative mx-4 w-full max-w-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Main image */}
        <img
          src={gallery[activeIdx]}
          alt={`${item.model} — фото ${activeIdx + 1}`}
          className="max-h-[75vh] w-full rounded-xl object-contain"
        />

        {/* Nav arrows */}
        {gallery.length > 1 && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white hover:bg-black/70"
              onClick={() => setActiveIdx((i) => (i - 1 + gallery.length) % gallery.length)}
            >
              &#8592;
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white hover:bg-black/70"
              onClick={() => setActiveIdx((i) => (i + 1) % gallery.length)}
            >
              &#8594;
            </Button>
          </>
        )}

        {/* Thumbnails */}
        {gallery.length > 1 && (
          <div className="mt-3 flex justify-center gap-2">
            {gallery.map((url, i) => (
              <button
                key={i}
                onClick={() => setActiveIdx(i)}
                className={cn(
                  'h-14 w-14 overflow-hidden rounded-lg border-2 transition-all',
                  i === activeIdx ? 'border-[#2E7DBF]' : 'border-transparent opacity-60 hover:opacity-100'
                )}
              >
                <img src={url} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}

        {/* Close */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute -right-2 -top-2 text-white hover:bg-black/50"
          onClick={onClose}
        >
          &#10005;
        </Button>

        {/* Title */}
        <div className="mt-2 text-center">
          <h3 className="font-bold">{item.model}</h3>
          <p className="text-sm text-[#8A92A0]">
            {activeIdx + 1} / {gallery.length}
          </p>
        </div>
      </div>
    </div>
  )
}
