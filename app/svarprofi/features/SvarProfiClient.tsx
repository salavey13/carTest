'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import type { MetalProduct } from './shared/types'
import { DEMO_ITEMS } from './shared/constants'

import { SvarProfiHeader } from './SvarProfiHeader'
import { SvarProfiHero } from './SvarProfiHero'
import { SvarProfiTicker } from './SvarProfiTicker'
import { SvarProfiCategories } from './SvarProfiCategories'
import { SvarProfiProductsShowcase } from './SvarProfiProductsShowcase'
import { SvarProfiFeatures } from './SvarProfiFeatures'
import { SvarProfiOrderProcess } from './SvarProfiOrderProcess'
import { SvarProfiMaterials } from './SvarProfiMaterials'
import { SvarProfiAdCards } from './SvarProfiAdCards'
import { SvarProfiFaq } from './SvarProfiFaq'
import { SvarProfiFooter } from './SvarProfiFooter'
import { SvarProfiOrderSheet } from './SvarProfiOrderSheet'
import { SvarProfiGalleryLightbox } from './SvarProfiGalleryLightbox'

// ─────────────────────────────────────────────────────
// SvarProfiClient — orchestration shell
// ─────────────────────────────────────────────────────
// Thin orchestrator that wires data fetching + state
// to extracted feature components.
//
// Section order:
//   Header → Hero → Ticker → Categories → Products
//   → Features → OrderProcess → Materials → AdCards
//   → FAQ → Footer
//
// Overlays: OrderSheet (ORDERX) + GalleryLightbox
//
// Market route: /franchize/svarprofi
// Product links: /franchize/svarprofi?vehicle=<slug>
// ─────────────────────────────────────────────────────

/** Canonical route to the SvarProfi franchise market */
export const MARKET_ROUTE = '/franchize/svarprofi'

export function SvarProfiClient({ items: initialItems }: { items?: MetalProduct[] }) {
  const [catalogItems, setCatalogItems] = useState<MetalProduct[]>(initialItems ?? [])
  const [orderOpen, setOrderOpen] = useState(false)
  const [orderSubmitted, setOrderSubmitted] = useState(false)
  const [galleryOpen, setGalleryOpen] = useState<string | null>(null)
  const [vehicleSlug, setVehicleSlug] = useState<string | undefined>(undefined)

  // Guard against infinite re-fetch when API returns empty
  const fetchAttemptedRef = useRef(false)

  // Fetch catalog from API if not provided via props
  useEffect(() => {
    if (catalogItems.length === 0 && !fetchAttemptedRef.current) {
      fetchAttemptedRef.current = true
      fetch('/api/franchize/catalog?slug=svarprofi')
        .then(r => r.json())
        .then(p => {
          const items = p?.data?.items ?? []
          if (items.length > 0) setCatalogItems(items)
        })
        .catch(() => {/* fallback to DEMO_ITEMS via useMemo */})
    }
  }, [catalogItems.length])

  // Use API items or fallback to seed demo items
  const displayItems = useMemo(() => {
    if (catalogItems.length > 0) return catalogItems
    return DEMO_ITEMS as MetalProduct[]
  }, [catalogItems])

  // Open order sheet with optional vehicle slug context
  const openOrder = (slug?: string) => {
    setVehicleSlug(slug)
    setOrderOpen(true)
  }

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
        <SvarProfiHeader />
        <SvarProfiHero onOrderClick={() => openOrder()} />
        <SvarProfiTicker />
        <SvarProfiCategories />
        <SvarProfiProductsShowcase
          items={displayItems}
          onGalleryOpen={setGalleryOpen}
          onOrderClick={(slug?: string) => openOrder(slug)}
        />
        <SvarProfiFeatures />
        <SvarProfiOrderProcess />
        <SvarProfiMaterials />
        <SvarProfiAdCards />
        <SvarProfiFaq />
        <SvarProfiFooter />
      </div>

      {/* Overlays */}
      <SvarProfiOrderSheet
        open={orderOpen}
        onOpenChange={setOrderOpen}
        submitted={orderSubmitted}
        onSubmitted={setOrderSubmitted}
        vehicleSlug={vehicleSlug}
      />

      {galleryOpen && (
        <SvarProfiGalleryLightbox
          items={displayItems}
          productId={galleryOpen}
          onClose={() => setGalleryOpen(null)}
        />
      )}
    </div>
  )
}