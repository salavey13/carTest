"use client";

// CrewOperationsPanel — «Операции экипажа»: quick links grid (crew only).

import { motion } from "framer-motion";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { FranchizeOperatorLinkButton, FranchizeOperatorPanel } from "@/app/franchize/components/FranchizeOperatorSurface";
import { itemVariants, type CrewTokens } from "./profile-shared";

export function CrewOperationsPanel({ slug, T }: { slug: string; T: CrewTokens }) {
  return (
    <motion.div variants={itemVariants}>
      <FranchizeOperatorPanel>
        <h2 className="flex items-center gap-2 text-base font-semibold" style={{ color: T.text }}>
          <VibeContentRenderer content="::FaTools::" /> Операции экипажа
        </h2>
        <p className="mt-1 text-xs" style={{ color: T.textMuted }}>
          Быстрый доступ к инструментам управления экипажем
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <FranchizeOperatorLinkButton href={`/franchize/${slug}/equipment`}>
            📦 Оборудование
          </FranchizeOperatorLinkButton>
          <FranchizeOperatorLinkButton href={`/franchize/${slug}/cash-ledger`}>
            💰 Касса
          </FranchizeOperatorLinkButton>
          <FranchizeOperatorLinkButton href={`/franchize/${slug}/commissions`}>
            📊 Комиссии
          </FranchizeOperatorLinkButton>
          <FranchizeOperatorLinkButton href={`/franchize/${slug}/salary`}>
            💵 Зарплата
          </FranchizeOperatorLinkButton>
          <FranchizeOperatorLinkButton href={`/franchize/${slug}/salary-coefficients`}>
            🎯 Ставки ЗП
          </FranchizeOperatorLinkButton>
          <FranchizeOperatorLinkButton href={`/franchize/${slug}/admin`}>
            ⚙️ Админка
          </FranchizeOperatorLinkButton>
          <FranchizeOperatorLinkButton href={`/franchize/${slug}/rentals-analytics`}>
            📈 Аналитика
          </FranchizeOperatorLinkButton>
          <FranchizeOperatorLinkButton href={`/franchize/${slug}/leads`}>
            👥 Лиды
          </FranchizeOperatorLinkButton>
          <FranchizeOperatorLinkButton href={`/franchize/${slug}/admin/deposits`}>
            🏦 Депозиты
          </FranchizeOperatorLinkButton>
          <FranchizeOperatorLinkButton href={`/franchize/${slug}/calc-explainer`}>
            📐 Как считаются деньги
          </FranchizeOperatorLinkButton>
        </div>
      </FranchizeOperatorPanel>
    </motion.div>
  );
}
