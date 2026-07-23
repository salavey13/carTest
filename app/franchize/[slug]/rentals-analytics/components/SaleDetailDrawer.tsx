"use client";

// /analytics/components/SaleDetailDrawer.tsx
//
// Lighter sale detail drawer (5 sections):
//   1. Header          — bike title, buyer ФИО, sale badge, close
//   2. Primary actions  — Open contract / Send by email / Mark signed / Cancel
//   3. Info grid        — bike, buyer, phone, email, price, total, created, bike_id
//   4. Notes            — short notes section
//   5. Sticky footer    — "Открыть продажу →"
//
// Mobile: rendered inside AnalyticsMobileSheet.
// Desktop: right-side panel (max-w-[640px]).

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  FileText,
  Mail,
  CheckCircle2,
  XCircle,
  ExternalLink,
  StickyNote,
  Banknote,
} from "lucide-react";
import type { ThemeTokens } from "../hooks/useTheme";
import type { AnalyticsSaleRow, DrawerAction } from "./types";
import {
  DrawerInfoGrid,
  DrawerPrimaryActions,
  DrawerStickyFooter,
  DrawerSection,
  DrawerAddNoteInput,
  DrawerEmptyHint,
  type InfoTile,
  type PrimaryAction,
} from "./DrawerPrimitives";
import {
  formatRubles,
  formatDateTime,
  getBuyerName,
  getInitials,
  getSaleBikeTitle,
} from "./lib/analytics-utils";

interface SaleDetailDrawerProps {
  sale: AnalyticsSaleRow;
  onClose: () => void;
  onAction: (action: DrawerAction) => void;
  onAddNote?: (text: string) => void;
  T: ThemeTokens;
  asSheetChild?: boolean;
}

export function SaleDetailDrawer({
  sale,
  onClose,
  onAction,
  onAddNote,
  T,
  asSheetChild = false,
}: SaleDetailDrawerProps) {
  const [newNote, setNewNote] = useState("");
  const [openNotes, setOpenNotes] = useState(true);

  const bikeTitle = getSaleBikeTitle(sale);
  const buyerName = getBuyerName(sale);
  const price = Number(sale.total_sum ?? sale.sale_price) || 0;
  const initials = getInitials(buyerName);

  const primaryActions: PrimaryAction[] = [
    { icon: FileText,      label: "Договор",     action: "open_rental", color: "#3b82f6" },
    { icon: Mail,          label: "Отправить",   action: "telegram",    color: "#22c55e" },
    { icon: CheckCircle2,  label: "Подписан",    action: "complete",    color: "#8b5cf6" },
    { icon: XCircle,       label: "Отменить",    action: "cancel",      color: "#ef4444" },
  ];

  const infoItems: InfoTile[] = [
    { label: "Байк",       value: bikeTitle },
    { label: "Покупатель", value: buyerName },
    { label: "Телефон",    value: sale.buyer_phone || "—", copyable: !!sale.buyer_phone },
    { label: "Email",      value: sale.buyer_email || "—", copyable: !!sale.buyer_email },
    { label: "Цена",       value: formatRubles(price), tone: "good" },
    { label: "Сумма итого", value: sale.total_sum != null ? formatRubles(sale.total_sum) : "—" },
    { label: "Создана",    value: formatDateTime(sale.created_at) },
    { label: "Байк ID",    value: sale.resolved_bike_id || "—" },
  ];

  const submitNote = () => {
    if (!newNote.trim() || !onAddNote) return;
    onAddNote(newNote.trim());
    setNewNote("");
  };

  const content = (
    <>
      {/* 1. Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 gap-4">
          <div
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-lg font-bold md:h-14 md:w-14"
            style={{ background: "#f59e0b26", color: "#f59e0b" }}
            aria-hidden
          >
            {initials}
          </div>
          <div className="min-w-0">
            <h2
              className="truncate text-lg font-semibold tracking-tight md:text-xl"
              style={{ color: T.text }}
            >
              {bikeTitle}
            </h2>
            <div className="mt-1 text-sm" style={{ color: T.textMuted }}>
              {buyerName}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <span
                className="rounded-full px-3 py-1 text-[11px] font-medium"
                style={{ background: "#f59e0b1a", color: "#f59e0b" }}
              >
                Продажа
              </span>
              <span
                className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px]"
                style={{ background: T.bgCard, color: "#22c55e" }}
              >
                <Banknote className="h-3 w-3" aria-hidden />
                {formatRubles(price)}
              </span>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть панель"
          className="cursor-pointer rounded-lg p-2.5 transition focus:outline-none focus-visible:ring-2"
          style={{
            color: T.textMuted,
            minHeight: "44px",
            minWidth: "44px",
          }}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* 2. Primary actions */}
      <div className="mt-5">
        <DrawerPrimaryActions
          actions={primaryActions}
          onAction={(a) => onAction(a as DrawerAction)}
          T={T}
        />
      </div>

      {/* 3. Info grid */}
      <div className="mt-5">
        <DrawerInfoGrid items={infoItems} T={T} />
      </div>

      {/* 4. Notes */}
      <div className="mt-5">
        <DrawerSection
          title="Заметки"
          icon={StickyNote}
          expanded={openNotes}
          onToggle={() => setOpenNotes(!openNotes)}
          T={T}
        >
          {onAddNote && (
            <div className="mb-2">
              <DrawerAddNoteInput
                value={newNote}
                onChange={setNewNote}
                onSubmit={submitNote}
                T={T}
              />
            </div>
          )}
          <DrawerEmptyHint label="Заметок нет" T={T} />
        </DrawerSection>
      </div>

      {/* 5. Sticky footer */}
      <DrawerStickyFooter
        label="Открыть продажу"
        icon={ExternalLink}
        onClick={() => onAction("open_rental")}
        T={T}
      />
    </>
  );

  if (asSheetChild) return content;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-40 hidden justify-end lg:flex"
        style={{ background: "color-mix(in srgb, #000000 60%, transparent)" }}
        onClick={onClose}
      >
        <motion.aside
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 280 }}
          onClick={(e) => e.stopPropagation()}
          className="relative flex h-full w-full flex-col lg:max-w-[640px]"
          style={{
            background: T.bg,
            borderLeft: `1px solid ${T.border}`,
            boxShadow: "0 0 60px rgba(0,0,0,0.55)",
          }}
          role="dialog"
          aria-modal="true"
          aria-label={`Продажа: ${bikeTitle}`}
        >
          <div className="flex-1 overflow-y-auto px-4 pb-6 pt-5 sm:px-5">
            {content}
          </div>
        </motion.aside>
      </motion.div>
    </AnimatePresence>
  );
}
