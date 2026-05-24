'use client'

import { ORDER_STEPS } from './shared/constants'

// ─────────────────────────────────────────────────────
// SvarProfi Order Process — step-by-step flow
// ─────────────────────────────────────────────────────

export function SvarProfiOrderProcess() {
  return (
    <section className="border-y border-[#3A4250]/50 bg-[#242830]/50">
      <div className="container mx-auto max-w-7xl px-4 py-16 md:py-20">
        <div className="mb-10 text-center">
          <h2 className="mb-3 text-3xl font-bold md:text-4xl">Как заказать</h2>
          <p className="text-[#8A92A0]">Простой процесс от заявки до монтажа</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ORDER_STEPS.map((s) => (
            <div key={s.step} className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#2E7DBF] text-lg font-bold text-white">
                {s.step}
              </div>
              <div>
                <h3 className="font-bold">{s.title}</h3>
                <p className="text-sm text-[#8A92A0]">{s.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}