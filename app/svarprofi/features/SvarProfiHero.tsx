'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Phone,
  HardHat,
  ArrowRight,
  Search,
} from 'lucide-react'
import { BRAND, IMAGES } from './shared/constants'
import { MARKET_ROUTE } from './SvarProfiClient'

// ─────────────────────────────────────────────────────
// SvarProfi Hero — main landing CTA
// Primary CTA → order sheet; Secondary → market catalog
// ─────────────────────────────────────────────────────

export function SvarProfiHero({ onOrderClick }: { onOrderClick: () => void }) {
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
            <Link href={MARKET_ROUTE}>
              <Button
                size="lg"
                variant="ghost"
                className="text-[#2E7DBF] hover:bg-[#2E7DBF]/10 hover:text-[#5BA3D9] h-12 px-8 text-base"
              >
                <Search className="mr-2 h-4 w-4" /> Смотреть каталог
              </Button>
            </Link>
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