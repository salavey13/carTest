/**
 * GearSection.tsx
 * ================
 * Equipment and safety grid section with improved design and hover effects.
 * Now uses shared data constants and VIP theme system.
 */
"use client";

import { motion } from "framer-motion";
import { Shield, Check } from "lucide-react";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { GEAR_ITEMS } from "./shared/data";
import { vipColorWithAlpha, vipCssVars } from "../lib/vip-theme";

export function GearSection() {
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
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mb-10 text-center"
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
          style={{
            backgroundColor: vipColorWithAlpha("#D99A00", 0.12),
          }}
        >
          <Shield className="h-7 w-7" style={{ color: "#D99A00" }} />
        </div>
        <h2 className="font-orbitron text-2xl sm:text-3xl text-white">
          Экип и безопасность
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-white/70">
          Перед арендой или покупкой сразу закрываем вопрос защиты: подбираем комплект
          под стиль катания и сезон. Вся экипировка выдается бесплатно.
        </p>
      </motion.div>

      {/* Gear Items Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {GEAR_ITEMS.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.05, duration: 0.4 }}
            whileHover={{ y: -4, scale: 1.02 }}
            className="group relative"
          >
            <div
              className="relative h-full rounded-2xl border p-5 backdrop-blur-sm overflow-hidden"
              style={{
                borderColor: item.included
                  ? vipColorWithAlpha("#D99A00", 0.3)
                  : "rgba(255,255,255,0.1)",
                backgroundColor: item.included
                  ? vipColorWithAlpha("#D99A00", 0.08)
                  : "rgba(255,255,255,0.03)",
              }}
            >
              {/* Included badge */}
              {item.included && (
                <div className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: vipColorWithAlpha("#D99A00", 0.2),
                  }}
                >
                  <Check className="h-3 w-3" style={{ color: "#D99A00" }} />
                </div>
              )}

              {/* Content */}
              <div className="flex items-start gap-4">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                  style={{
                    backgroundColor: item.included
                      ? vipColorWithAlpha("#D99A00", 0.15)
                      : "rgba(255,255,255,0.05)",
                  }}
                >
                  <VibeContentRenderer
                    content={`::${getGearIcon(item.id)}::`}
                    className="text-2xl"
                  />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-white mb-1">{item.name}</h3>
                  <p className="text-xs leading-relaxed text-white/60">
                    {item.description}
                  </p>
                  {item.included && (
                    <div className="mt-2 inline-flex items-center gap-1 text-[10px]"
                      style={{ color: "#D99A00" }}
                    >
                      <Check className="h-3 w-3" />
                      Включено в аренду
                    </div>
                  )}
                </div>
              </div>

              {/* Hover glow effect */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                style={{
                  background: `radial-gradient(circle at var(--mouse-x, 50%) var(--mouse-y, 50%), ${vipColorWithAlpha("#D99A00", 0.1)}, transparent 50%)`,
                }}
              />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Note */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="mt-8 text-center"
      >
        <p className="text-xs text-white/50">
          Размеры и модель подбираются индивидуально при выдаче техники
        </p>
      </motion.div>
    </motion.section>
  );
}

// Helper to get icon for gear item
function getGearIcon(id: string): string {
  const icons: Record<string, string> = {
    helmet: "FaHelmetSafety",
    jacket: "FaShirt",
    gloves: "FaHands",
    pants: "FaPerson",
    boots: "FaShoePrints",
    protector: "FaShield",
  };
  return icons[id] || "FaShield";
}
