import type { Metadata } from 'next'
import { SvarProfiClientShell } from './SvarProfiClientShell'

// ─────────────────────────────────────────────────────
// SvarProfi Layout
// ─────────────────────────────────────────────────────
// Server component with metadata. Wraps children in
// SvarProfiClientShell which provides:
//   - Error boundary (catches Safari/WKWebView crashes)
//   - Dark background container
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
  return <SvarProfiClientShell>{children}</SvarProfiClientShell>
}
