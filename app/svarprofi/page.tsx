import type { Metadata } from 'next'
import { SvarProfiClient } from './features/SvarProfiClient'

export const metadata: Metadata = {
  title: 'СварПрофи-НН — Металлоконструкции в Москве',
  description:
    'Производство строительных металлических конструкций. Каркасы, навесы, ограждения, лестницы. От чертежа до монтажа. Москва, МО, ЦФО.',
  keywords: [
    'металлоконструкции',
    'каркасы',
    'навесы',
    'ограждения',
    'сварка',
    'Москва',
    'СварПрофи',
  ],
  authors: [{ name: 'СварПрофи-НН' }],
  openGraph: {
    title: 'СварПрофи-НН — Металлоконструкции в Москве',
    description:
      'Металлические конструкции любой сложности — от чертежа до монтажа',
    type: 'website',
  },
}

export default function SvarProfiPage() {
  return <SvarProfiClient />
}