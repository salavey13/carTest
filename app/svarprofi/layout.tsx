import type { Metadata } from 'next'

// ─────────────────────────────────────────────────────
// SvarProfi Layout
// ─────────────────────────────────────────────────────
// Minimal layout — no Toaster (root layout already has one).
// Just wraps children with dark bg + Russian lang.
// ─────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'СварПрофи-НН',
  description: 'Металлоконструкции в Москве',
}

export default function SvarProfiLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#1A1D23] text-[#E8ECF1]">
      {children}
    </div>
  )
}