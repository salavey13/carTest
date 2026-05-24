// ─────────────────────────────────────────────────────
// SvarProfi — Shared Types
// ─────────────────────────────────────────────────────

export interface MetalProduct {
  id: string
  /** URL-safe slug for routing: /franchize/svarprofi?vehicle=<slug> */
  slug: string
  make: string
  model: string
  description: string
  image_url: string
  specs: {
    type: string
    subtype: string | null
    manufacturer: string
    model: string
    profile_type: string | null
    coating_type: string | null
    assembly_type: string | null
    weld_type: string | null
    features: string[]
    gallery: string[]
    buy_colors?: Array<{ name: string; ral: string; swatch: string }>
    delivery_available: boolean | null
    installation_available: boolean | null
    delivery_region: string | null
    price_rub: number | null
    production_days: number | null
  }
}

export interface FranchiseTheme {
  mode: 'dark' | 'light'
  palette: Record<string, string>
  effects?: {
    gradientHero?: boolean
    gradientFrom?: string
    gradientVia?: string
    gradientTo?: string
    gradientDirection?: string
  }
}