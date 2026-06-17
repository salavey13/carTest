/**
 * HowItWorksSection.tsx
 * ======================
 * 5-step "How it works" section with animations and better visual hierarchy.
 * Now uses shared data constants and VIP theme system.
 */
"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { CheckCircle, ArrowRight } from "lucide-react";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { StepItem } from "./ServiceCardsSection";
import { HOW_IT_WORKS_STEPS } from "./shared/data";
import { vipColorWithAlpha, vipCssVars } from "../lib/vip-theme";

interface HowItWorksSectionProps {
  crewSlug?: string;
}

export function HowItWorksSection({ crewSlug = "vip-bike" }: HowItWorksSectionProps) {
  const themeVars = vipCssVars();

  return (
    <motion.section
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
      viewport={{ once: true }}
      className="py-12"
      style={themeVars}
    >
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mb-10 text-center"
      >
        <h2 className="font-orbitron text-3xl sm:text-4xl text-white">
          Как это работает
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-white/70">
          5 простых шагов от выбора до вашего первого выезда
        </p>
      </motion.div>

      <div className="relative">
        {/* Connecting line for desktop */}
        <div className="absolute left-1/2 top-0 hidden h-full w-0.5 -translate-x-1/2 lg:block"
          style={{
            background: `linear-gradient(to bottom, ${vipColorWithAlpha("#D99A00", 0.5)}, ${vipColorWithAlpha("#D99A00", 0.1)})`,
          }}
        />

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {HOW_IT_WORKS_STEPS.map((step, index) => (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              className="relative"
            >
              {/* Step number badge */}
              <div className="mb-4 flex justify-center lg:justify-start lg:pl-0">
                <div
                  className="relative flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold shadow-lg"
                  style={{
                    backgroundColor: "#D99A00",
                    color: "#16130A",
                    boxShadow: `0 0 20px ${vipColorWithAlpha("#D99A00", 0.4)}`,
                  }}
                >
                  {step.num}
                  {/* Animated ring for active steps */}
                  <motion.span
                    className="absolute inset-0 rounded-full border-2"
                    style={{ borderColor: "#D99A00" }}
                    animate={{ scale: [1, 1.3, 1], opacity: [1, 0, 1] }}
                    transition={{ duration: 2, repeat: Infinity, delay: index * 0.3 }}
                  />
                </div>
              </div>

              {/* Step card */}
              <motion.div
                whileHover={{ y: -4 }}
                className="relative h-full rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm transition-all"
              >
                <div className="mb-3 flex justify-center lg:justify-start">
                  <VibeContentRenderer content={step.icon} className="text-2xl" />
                </div>
                <h3 className="mb-2 font-semibold text-white text-center lg:text-left">
                  {step.title}
                </h3>
                <p className="text-xs leading-relaxed text-white/70 text-center lg:text-left">
                  {step.description}
                </p>

                {/* Arrow indicator */}
                {index < HOW_IT_WORKS_STEPS.length - 1 && (
                  <div className="absolute -bottom-3 left-1/2 hidden -translate-x-1/2 lg:block"
                    style={{ color: vipColorWithAlpha("#D99A00", 0.5) }}
                  >
                    <ArrowRight className="h-5 w-5" />
                  </div>
                )}
              </motion.div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Bottom CTA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.5 }}
        className="mt-10 text-center"
      >
        <Link
          href={`/franchize/${crewSlug}`}
          className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-all hover:scale-105"
          style={{
            backgroundColor: "#D99A00",
            color: "#16130A",
            boxShadow: `0 4px 20px ${vipColorWithAlpha("#D99A00", 0.4)}`,
          }}
        >
          <CheckCircle className="h-4 w-4" />
          Начать с выбора байка
        </Link>
      </motion.div>
    </motion.section>
  );
}
