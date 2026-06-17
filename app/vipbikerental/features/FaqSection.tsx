/**
 * FaqSection.tsx
 * ===============
 * Accordion FAQ section with enhanced styling and animations.
 * Now uses shared data constants and VIP theme system.
 */
"use client";

import { motion } from "framer-motion";
import { HelpCircle, ChevronDown } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { FAQ_ITEMS } from "./shared/data";
import { vipColorWithAlpha, vipCssVars } from "../lib/vip-theme";

export function FaqSection() {
  const themeVars = vipCssVars();

  return (
    <motion.section
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
      viewport={{ once: true }}
      className="mx-auto max-w-3xl"
      style={themeVars}
    >
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mb-10 text-center"
      >
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full"
          style={{
            backgroundColor: vipColorWithAlpha("#D99A00", 0.12),
          }}
        >
          <HelpCircle className="h-6 w-6" style={{ color: "#D99A00" }} />
        </div>
        <h2 className="font-orbitron text-3xl sm:text-4xl text-white">
          Частые вопросы
        </h2>
        <p className="mt-3 text-sm text-white/70">
          Ответы на популярные вопросы об аренде, требованиях и условиях
        </p>
      </motion.div>

      <Accordion
        type="single"
        collapsible
        className="w-full space-y-3"
      >
        {FAQ_ITEMS.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1, duration: 0.5 }}
          >
            <AccordionItem
              value={item.id}
              className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden"
              style={{
                transition: "all 0.3s ease",
              }}
            >
              <AccordionTrigger className="relative px-5 py-4 text-left hover:no-underline group">
                <div className="flex items-center gap-3 flex-1">
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
                    style={{
                      backgroundColor: vipColorWithAlpha("#D99A00", 0.15),
                      color: "#D99A00",
                    }}
                  >
                    {index + 1}
                  </span>
                  <span className="font-medium text-white">{item.question}</span>
                </div>
                <ChevronDown className="h-4 w-4 shrink-0 text-white/50 transition-transform group-hover:text-white/80" />
              </AccordionTrigger>
              <AccordionContent className="px-5 pb-4 pt-0">
                <div className="rounded-xl border border-white/5 bg-black/20 p-4">
                  <p className="text-sm leading-relaxed text-white/80">{item.answer}</p>
                </div>
              </AccordionContent>
            </AccordionItem>
          </motion.div>
        ))}
      </Accordion>

      {/* Additional CTA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.6 }}
        className="mt-8 rounded-2xl border border-dashed p-6 text-center"
        style={{
          borderColor: vipColorWithAlpha("#D99A00", 0.3),
          backgroundColor: vipColorWithAlpha("#D99A00", 0.05),
        }}
      >
        <p className="text-sm font-medium text-white">
          Не нашли ответ на свой вопрос?
        </p>
        <p className="mt-1 text-xs text-white/60">
          Свяжитесь с нами напрямую — мы ответим в течение 15 минут
        </p>
      </motion.div>
    </motion.section>
  );
}
