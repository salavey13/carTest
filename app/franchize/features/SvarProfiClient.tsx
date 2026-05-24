'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
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

/**
 * FIX: Runtime data from /api/franchize/catalog may have `specs` partially
 * or fully undefined (gallery, features, buy_colors can be missing from JSON).
 * This normalizer guarantees every nested array/field has a safe default,
 * preventing "Cannot read properties of undefined (reading 'length')" crashes
 * in sub-components that access item.specs.gallery.length etc.
 *
 * This is the MOBILE-ONLY crash fix: the API returns items where
 * specs.gallery / specs.features are undefined (not present in JSON response),
 * and the old code passed these directly to setCatalogItems() without
 * normalizing. On mobile viewports the slower network + render timing
 * exposes the undefined fields more readily, but the fix applies universally.
 */
function normalizeProduct(item: Record<string, unknown>): MetalProduct {
  const raw = item.specs as Record<string, unknown> | undefined
  return {
    id: (item.id as string) ?? '',
    slug: (item.slug as string) ?? '',
    make: (item.make as string) ?? '',
    model: (item.model as string) ?? '',
    description: (item.description as string) ?? '',
    image_url: (item.image_url as string) ?? '',
    specs: raw
      ? {
          type: (raw.type as string) ?? '',
          subtype: (raw.subtype as string | null) ?? null,
          manufacturer: (raw.manufacturer as string) ?? '',
          model: (raw.model as string) ?? '',
          profile_type: (raw.profile_type as string | null) ?? null,
          coating_type: (raw.coating_type as string | null) ?? null,
          assembly_type: (raw.assembly_type as string | null) ?? null,
          weld_type: (raw.weld_type as string | null) ?? null,
          features: Array.isArray(raw.features) ? (raw.features as string[]) : [],
          gallery: Array.isArray(raw.gallery) ? (raw.gallery as string[]) : [],
          buy_colors: Array.isArray(raw.buy_colors) ? (raw.buy_colors as Array<{ name: string; ral: string; swatch: string }>) : [],
          delivery_available: (raw.delivery_available as boolean | null) ?? null,
          installation_available: (raw.installation_available as boolean | null) ?? null,
          delivery_region: (raw.delivery_region as string | null) ?? null,
          price_rub: (raw.price_rub as number | null) ?? null,
          production_days: (raw.production_days as number | null) ?? null,
        }
      : {
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
        },
  } as MetalProduct
}

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
          const raw: unknown[] = p?.data?.items ?? []
          // FIX: normalize every item from the API — specs.gallery/features may be undefined
          const safe = raw.map((item) => normalizeProduct(item as Record<string, unknown>))
          if (safe.length > 0) setCatalogItems(safe)
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