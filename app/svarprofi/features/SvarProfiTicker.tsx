'use client'

import { CheckCircle2 } from 'lucide-react'
import { TICKER_ITEMS } from './shared/constants'

// ─────────────────────────────────────────────────────
// SvarProfi Ticker — scrolling trust bar
// ─────────────────────────────────────────────────────

export function SvarProfiTicker() {
  return (
    <div className="border-y border-[#3A4250]/50 bg-[#242830]/80 backdrop-blur-sm">
      <div className="container mx-auto flex max-w-7xl items-center gap-6 overflow-x-auto px-4 py-2.5">
        {TICKER_ITEMS.map((item, i) => (
          <div key={i} className="flex shrink-0 items-center gap-2 text-sm text-[#8A92A0]">
            <CheckCircle2 className="h-3.5 w-3.5 text-[#2E7DBF]" />
            {item}
            {i < TICKER_ITEMS.length - 1 && <span className="ml-4 text-[#3A4250]">|</span>}
          </div>
        ))}
      </div>
    </div>
  )
}