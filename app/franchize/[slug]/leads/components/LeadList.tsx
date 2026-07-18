"use client";

import { useMemo, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { useVirtualList } from "../hooks/useVirtualList";
import { LeadCard } from "./LeadCard";
import type { LeadRow, LeadTodoRow } from "@/app/franchize/server-actions/leads";

interface LeadListProps {
  leads: LeadRow[];
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  onDismiss: (id: string) => void;
  getTodosForLead: (lead: LeadRow) => LeadTodoRow[];
  T: any;
  crewId: string;
  slug: string;
  /**
   * Optional callback fired when a lead is selected (desktop: detail panel,
   * mobile: bottom sheet). Lets parent own the detail entirely.
   */
  onSelectLead?: (lead: LeadRow | null) => void;
}

/** Approximate starting height — real height is measured via measureElement */
const ITEM_HEIGHT = 128;

const cardVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.97 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring",
      damping: 24,
      stiffness: 260,
      mass: 0.6,
      delay: Math.min(i * 0.025, 0.12),
    },
  }),
};

export function LeadList({
  leads,
  selectedId,
  setSelectedId,
  onDismiss,
  getTodosForLead,
  T,
  crewId,
  slug,
  onSelectLead,
}: LeadListProps) {
  const { parentRef, virtualItems, totalHeight, measureElement } = useVirtualList(leads, {
    itemHeight: ITEM_HEIGHT,
    containerHeight: 600,
    overscan: 5,
  });

  const isSelected = useMemo(
    () => (selectedId ? new Set([selectedId]) : new Set<string>()),
    [selectedId]
  );

  const handleSelect = useCallback(
    (lead: LeadRow) => {
      const nextId = selectedId === lead.user_id ? null : lead.user_id;
      setSelectedId(nextId);
      onSelectLead?.(nextId ? lead : null);
    },
    [selectedId, setSelectedId, onSelectLead]
  );

  return (
    <div
      ref={parentRef}
      className="h-full max-h-[calc(100vh-280px)] overflow-y-auto"
      style={{ width: "100%" }}
    >
      <div style={{ position: "relative", height: totalHeight, width: "100%" }}>
        {virtualItems.map((virtualRow) => {
          const lead = leads[virtualRow.index];
          const isThisSelected = isSelected.has(lead.user_id);
          return (
            <motion.div
              key={lead.user_id}
              data-index={virtualRow.index}
              ref={measureElement}
              className="virtual-item"
              custom={virtualRow.index}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <LeadCard
                lead={lead}
                T={T}
                isSelected={isThisSelected}
                onSelect={() => handleSelect(lead)}
                onDismiss={onDismiss}
                todos={getTodosForLead(lead)}
              />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
