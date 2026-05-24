'use client'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { FAQ_ITEMS } from './shared/constants'

// ─────────────────────────────────────────────────────
// SvarProfi FAQ — accordion with common questions
// ─────────────────────────────────────────────────────

export function SvarProfiFaq() {
  return (
    <section id="faq" className="container mx-auto max-w-7xl px-4 py-16 md:py-20">
      <div className="mb-10 text-center">
        <h2 className="mb-3 text-3xl font-bold md:text-4xl">Частые вопросы</h2>
      </div>

      <div className="mx-auto max-w-2xl">
        <Accordion type="single" collapsible className="space-y-3">
          {FAQ_ITEMS.map((faq, i) => (
            <AccordionItem
              key={i}
              value={`q-${i}`}
              className="rounded-xl border-[#3A4250] bg-[#242830] px-5 data-[state=open]:border-[#2E7DBF]/40"
            >
              <AccordionTrigger className="text-left text-base font-medium hover:no-underline">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-[#8A92A0]">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}