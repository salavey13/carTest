'use client'

import { Card, CardContent } from '@/components/ui/card'
import { FEATURES } from './shared/constants'

// ─────────────────────────────────────────────────────
// SvarProfi Features — why choose us grid
// ─────────────────────────────────────────────────────

export function SvarProfiFeatures() {
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