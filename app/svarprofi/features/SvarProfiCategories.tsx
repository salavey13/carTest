'use client'

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { CATEGORIES } from './shared/constants'
import { MARKET_ROUTE } from './SvarProfiClient'

// ─────────────────────────────────────────────────────
// SvarProfi Categories — product category cards
// Each card links to /franchize/svarprofi?vehicle=<slug>
// (not /catalog?group= — that pattern is for bike rental)
// ─────────────────────────────────────────────────────

export function SvarProfiCategories() {
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
            <Link key={cat.id} href={`${MARKET_ROUTE}?vehicle=${cat.vehicleSlug}`}>
              <Card className="group h-full overflow-hidden border-[#3A4250] bg-[#242830] transition-all duration-300 hover:border-[#2E7DBF]/50 hover:shadow-lg hover:shadow-[#2E7DBF]/10 cursor-pointer">
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
            </Link>
          )
        })}
      </div>
    </section>
  )
}