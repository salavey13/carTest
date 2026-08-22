'use client'

import { Card, CardContent } from '@/components/ui/card'
import { MATERIALS } from './shared/constants'

// ─────────────────────────────────────────────────────
// SvarProfi Materials — steel grades display
// ─────────────────────────────────────────────────────

export function SvarProfiMaterials() {
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