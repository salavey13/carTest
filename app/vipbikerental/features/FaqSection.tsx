/**
 * FaqSection.tsx
 * ===============
 * Accordion FAQ section.
 */
"use client";

import { motion } from "framer-motion";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const faqItems = [
  { value: "item-1", question: "Можно ли арендовать мотоцикл без категории «А»?", answer: "Да! У нас есть парк скутеров, для управления которыми достаточно категории «B» или «M». Для всех остальных мотоциклов категория «А» обязательна." },
  { value: "item-2", question: "Что будет, если я попаду в ДТП?", answer: "Все мотоциклы застрахованы по ОСАГО. Ваша финансовая ответственность ограничена суммой залога, если нет серьезных нарушений с вашей стороны. Главное — немедленно связаться с нами." },
  { value: "item-3", question: "Что входит в стоимость аренды?", answer: "В стоимость входит аренда мотоцикла на 24 часа, полис ОСАГО и полный комплект защитной экипировки. Пробег обычно ограничен (например, 300 км/сутки), превышение оплачивается отдельно." },
  { value: "item-4", question: "У вас есть свой сервис?", answer: "Да, на нашей новой локации работает полноценный сервис. Вы можете пригнать своего верного друга к нам на обслуживание или ремонт." },
];

export function FaqSection() {
  return (
    <motion.section initial={{ opacity: 0, y: 50 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} viewport={{ once: true }} className="mx-auto max-w-3xl">
      <h2 className="mb-10 text-center font-orbitron text-4xl">Частые вопросы</h2>
      <Accordion type="single" collapsible className="w-full rounded-2xl border border-border/60 bg-card/40 px-4 text-sm">
        {faqItems.map((item) => (
          <AccordionItem key={item.value} value={item.value}>
            <AccordionTrigger className="text-base">{item.question}</AccordionTrigger>
            <AccordionContent className="text-sm leading-relaxed text-muted-foreground">{item.answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </motion.section>
  );
}