'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Phone,
  Menu,
} from 'lucide-react'
import { BRAND, IMAGES } from './shared/constants'
import { MARKET_ROUTE } from './SvarProfiClient'

// ─────────────────────────────────────────────────────
// SvarProfi Header — sticky with scroll compact mode
// Links to /franchize/svarprofi for full market
// NOTE: No map-riders — N/A for metal_stuff franchise
// NOTE: No telegram link — contact info not yet confirmed
// ─────────────────────────────────────────────────────

export function SvarProfiHeader() {
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
        {/* Logo + name → market */}
        <Link href={MARKET_ROUTE} className="flex items-center gap-3">
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
        </Link>

        {/* Nav (desktop) */}
        <nav className="hidden items-center gap-6 md:flex">
          <Link href={MARKET_ROUTE} className="text-sm text-[#8A92A0] transition-colors hover:text-[#E8ECF1]">Каталог</Link>
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
              <Link href={MARKET_ROUTE} className="text-base text-[#C8CDD5] hover:text-[#2E7DBF]">Каталог</Link>
              <a href="#features" className="text-base text-[#C8CDD5] hover:text-[#2E7DBF]">О компании</a>
              <a href="#faq" className="text-base text-[#C8CDD5] hover:text-[#2E7DBF]">FAQ</a>
              <Separator className="bg-[#3A4250]" />
              <a href={BRAND.phoneHref} className="flex items-center gap-2 text-base text-[#2E7DBF]">
                <Phone className="h-4 w-4" /> {BRAND.phone}
              </a>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}