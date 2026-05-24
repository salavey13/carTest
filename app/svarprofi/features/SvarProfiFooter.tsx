'use client'

import Link from 'next/link'
import { Separator } from '@/components/ui/separator'
import {
  Phone,
  Building2,
} from 'lucide-react'
import { BRAND, CATEGORIES } from './shared/constants'
import { MARKET_ROUTE } from './SvarProfiClient'

// ─────────────────────────────────────────────────────
// SvarProfi Footer — contact info & links
// Category links go to /franchize/svarprofi?vehicle=<slug>
// NOTE: No telegram — contact info not yet confirmed
// ─────────────────────────────────────────────────────

export function SvarProfiFooter() {
  return (
    <footer className="border-t border-[#3A4250]/50 bg-[#14161A]">
      <div className="container mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {/* Products → market links with vehicle slug */}
          <div>
            <h3 className="mb-4 font-bold">Продукция</h3>
            <ul className="space-y-2">
              {CATEGORIES.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`${MARKET_ROUTE}?vehicle=${c.vehicleSlug}`}
                    className="text-sm text-[#8A92A0] transition-colors hover:text-[#2E7DBF]"
                  >
                    {c.title}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href={MARKET_ROUTE}
                  className="text-sm text-[#8A92A0] transition-colors hover:text-[#2E7DBF]"
                >
                  Все конструкции
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="mb-4 font-bold">Компания</h3>
            <ul className="space-y-2">
              <li><a href="#features" className="text-sm text-[#8A92A0] hover:text-[#2E7DBF]">О нас</a></li>
              <li><a href="#features" className="text-sm text-[#8A92A0] hover:text-[#2E7DBF]">Сертификаты</a></li>
              <li><Link href={MARKET_ROUTE} className="text-sm text-[#8A92A0] hover:text-[#2E7DBF]">Каталог</Link></li>
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