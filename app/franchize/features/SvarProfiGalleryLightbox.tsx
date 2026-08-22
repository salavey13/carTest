'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { MetalProduct } from './shared/types'

// ─────────────────────────────────────────────────────
// SvarProfi Gallery Lightbox — full-screen image viewer
// ─────────────────────────────────────────────────────

export function SvarProfiGalleryLightbox({
  items,
  productId,
  onClose,
}: {
  items: MetalProduct[]
  productId: string
  onClose: () => void
}) {
  const item = items.find((i) => i.id === productId)
  const [activeIdx, setActiveIdx] = useState(0)

  if (!item) return null

  // FIX: Defensive access — specs.gallery may be undefined if this component
  // receives data from an un-normalized source (e.g., DEMO_ITEMS fallback or
  // a race condition before normalizeProduct runs). The old code crashed with
  // "Cannot read properties of undefined (reading 'length')" on mobile.
  const gallery = item.specs?.gallery?.length ? item.specs.gallery : [item.image_url]

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative mx-4 w-full max-w-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Main image */}
        <img
          src={gallery[activeIdx]}
          alt={`${item.model} — фото ${activeIdx + 1}`}
          className="max-h-[75vh] w-full rounded-xl object-contain"
        />

        {/* Nav arrows */}
        {gallery.length > 1 && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white hover:bg-black/70"
              onClick={() => setActiveIdx((i) => (i - 1 + gallery.length) % gallery.length)}
            >
              ←
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white hover:bg-black/70"
              onClick={() => setActiveIdx((i) => (i + 1) % gallery.length)}
            >
              →
            </Button>
          </>
        )}

        {/* Thumbnails */}
        {gallery.length > 1 && (
          <div className="mt-3 flex justify-center gap-2">
            {gallery.map((url, i) => (
              <button
                key={i}
                onClick={() => setActiveIdx(i)}
                className={cn(
                  'h-14 w-14 overflow-hidden rounded-lg border-2 transition-all',
                  i === activeIdx ? 'border-[#2E7DBF]' : 'border-transparent opacity-60 hover:opacity-100'
                )}
              >
                <img src={url} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}

        {/* Close */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute -right-2 -top-2 text-white hover:bg-black/50"
          onClick={onClose}
        >
          ✕
        </Button>

        {/* Title */}
        <div className="mt-2 text-center">
          <h3 className="font-bold">{item.model}</h3>
          <p className="text-sm text-[#8A92A0]">
            {activeIdx + 1} / {gallery.length}
          </p>
        </div>
      </div>
    </div>
  )
}