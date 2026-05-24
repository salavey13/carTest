'use client'

import { Card } from '@/components/ui/card'
import { IMAGES } from './shared/constants'

// ─────────────────────────────────────────────────────
// SvarProfi Ad Cards — certified welders & delivery
// ─────────────────────────────────────────────────────

export function SvarProfiAdCards() {
  const ads = [
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
  ]

  return (
    <section className="container mx-auto max-w-7xl px-4 py-8">
      <div className="grid gap-6 md:grid-cols-2">
        {ads.map((ad, i) => (
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