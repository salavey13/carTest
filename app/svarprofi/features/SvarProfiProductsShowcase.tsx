'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  ChevronRight,
  Wrench,
  Truck,
  HardHat,
  Flame,
  ImageIcon,
  ExternalLink,
} from 'lucide-react'
import type { MetalProduct } from './shared/types'
import { MARKET_ROUTE } from './SvarProfiClient'

// ─────────────────────────────────────────────────────
// SvarProfi Products Showcase — product cards with gallery
// "Подробнее" links to /franchize/svarprofi?vehicle=<slug>
// (same pattern as VipBike: ?vehicle=<id>)
// ─────────────────────────────────────────────────────

export function SvarProfiProductsShowcase({
  items,
  onGalleryOpen,
  onOrderClick,
}: {
  items: MetalProduct[]
  onGalleryOpen: (id: string) => void
  onOrderClick: (slug?: string) => void
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
              {item.specs.gallery.length > 1 && (
                <Badge className="absolute right-3 top-3 bg-black/60 text-white backdrop-blur-sm">
                  <ImageIcon className="mr-1 h-3 w-3" /> {item.specs.gallery.length} фото
                </Badge>
              )}
              {/* Type badge */}
              <Badge className="absolute left-3 top-3 bg-[#2E7DBF]/90 text-white">
                {item.specs.type}
                {item.specs.subtype && ` · ${item.specs.subtype}`}
              </Badge>
            </div>

            <CardContent className="p-5">
              <h3 className="mb-2 text-xl font-bold">{item.model}</h3>
              <p className="mb-4 line-clamp-3 text-sm text-[#8A92A0]">{item.description}</p>

              {/* Features */}
              <div className="mb-4 flex flex-wrap gap-1.5">
                {item.specs.features.slice(0, 4).map((f, i) => (
                  <Badge
                    key={`${item.id}-f-${i}`}
                    variant="secondary"
                    className="bg-[#2A2E36] text-[#8A92A0] text-xs"
                  >
                    {f}
                  </Badge>
                ))}
              </div>

              {/* Colors */}
              {item.specs.buy_colors && item.specs.buy_colors.length > 0 && (
                <div className="mb-4 flex items-center gap-2">
                  <span className="text-xs text-[#8A92A0]">Цвета:</span>
                  {item.specs.buy_colors.map((c, i) => (
                    <div
                      key={`${item.id}-c-${i}`}
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

              {/* Action buttons: order + market details with vehicle slug */}
              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-[#2E7DBF] text-white hover:bg-[#2563A0]"
                  onClick={() => onOrderClick(item.slug)}
                >
                  Запросить расчёт <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
                <Link href={`${MARKET_ROUTE}?vehicle=${item.slug}`}>
                  <Button
                    variant="outline"
                    className="border-[#3A4250] text-[#8A92A0] hover:bg-[#242830] hover:text-[#E8ECF1]"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}