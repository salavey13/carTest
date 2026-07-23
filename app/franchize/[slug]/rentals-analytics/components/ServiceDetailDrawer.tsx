"use client";

// /analytics/components/ServiceDetailDrawer.tsx
//
// Lighter service detail drawer (5 sections):
//   1. Header          — service type, client ФИО, status badge, close
//   2. Primary actions  — Activate / Complete / Cancel / Open service page
//   3. Info grid        — service type, client, phone, status, payment, start, end, cost, mechanic
//   4. Assigned mechanic — section showing who's working on this service
//   5. Sticky footer    — "Открыть сервис →"
//
// Mobile: rendered inside AnalyticsMobileSheet.
// Desktop: right-side panel (max-w-[640px]).

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Wrench,
  User,
  StickyNote,
} from "lucide-react";
import type { ThemeTokens } from "../hooks/useTheme";
import type { AnalyticsRentalRow, DrawerAction } from "./types";
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
  getInitials,
  getRenterName,
  getRentalStatusMeta,
} from "./lib/analytics-utils";

interface ServiceDetailDrawerProps {
  rental: AnalyticsRentalRow;
  mechanicName?: string | null;
  onClose: () => void;
  onAction: (action: DrawerAction) => void;
  onAddNote?: (text: string) => void;
  T: ThemeTokens;
  asSheetChild?: boolean;
}

export function ServiceDetailDrawer({
  rental,
  mechanicName,
  onClose,
  onAction,
  onAddNote,
  T,
  asSheetChild = false,
}: ServiceDetailDrawerProps) {
  const [newNote, setNewNote] = useState("");
  const [openNotes, setOpenNotes] = useState(true);

  const statusMeta = getRentalStatusMeta(rental.status);
  const clientName = getRenterName(rental);
  const cost = Number(rental.total_cost) || 0;
  const initials = getInitials(clientName);
  const serviceType = rental.vehicle?.make || "Сервисная услуга";

  const primaryActions: PrimaryAction[] = [
    { icon: CheckCircle2,  label: "Активировать", action: "activate",    color: "#22c55e" },
    { icon: CheckCircle2,  label: "Завершить",    action: "complete",    color: "#3b82f6" },
    { icon: XCircle,       label: "Отменить",     action: "cancel",      color: "#ef4444" },
    { icon: ExternalLink,  label: "Открыть",      action: "open_rental", color: "#8b5cf6" },
  ];

  const phone = (rental.metadata as Record<string, unknown> | null)?.phone as string | undefined;

  const infoItems: InfoTile[] = [
    { label: "Услуга",       value: serviceType },
    { label: "Клиент",       value: clientName },
    { label: "Телефон",      value: phone || "—", copyable: !!phone },
    { label: "Статус",       value: statusMeta.label },
    { label: "Оплата",       value: rental.payment_status || "—" },
    { label: "Начало",       value: formatDateTime(rental.agreed_start_date || rental.requested_start_date) },
    { label: "Конец",        value: formatDateTime(rental.agreed_end_date || rental.requested_end_date) },
    { label: "Стоимость",    value: formatRubles(cost), tone: "good" },
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
            style={{ background: `${statusMeta.color}26`, color: statusMeta.color }}
            aria-hidden
          >
            {initials}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Wrench className="h-5 w-5 shrink-0" style={{ color: "#8b5cf6" }} aria-hidden />
              <h2
                className="truncate text-lg font-semibold tracking-tight md:text-xl"
                style={{ color: T.text }}
              >
                {serviceType}
              </h2>
            </div>
            <div className="mt-1 text-sm" style={{ color: T.textMuted }}>
              {clientName}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <span
                className="rounded-full px-3 py-1 text-[11px] font-medium"
                style={{ background: `${statusMeta.color}1a`, color: statusMeta.color }}
              >
                {statusMeta.label}
              </span>
              <span
                className="rounded-full px-3 py-1 text-[11px]"
                style={{ background: T.bgCard, color: T.text }}
              >
                {formatRubles(cost)}
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

      {/* 4. Assigned mechanic */}
      <div className="mt-5">
        <DrawerSection
          title="Исполнитель"
          icon={User}
          expanded={true}
          T={T}
        >
          <div
            className="flex min-h-[44px] items-center gap-3 rounded-xl border p-3"
            style={{ borderColor: T.border, backgroundColor: T.bgElevated }}
          >
            <div
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold"
              style={{ background: T.bgCard, color: T.text }}
              aria-hidden
            >
              {(mechanicName || "?").slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium" style={{ color: T.text }}>
                {mechanicName || "Не назначен"}
              </p>
              <p className="text-[11px]" style={{ color: T.textMuted }}>
                Механик
              </p>
            </div>
          </div>
        </DrawerSection>
      </div>

      {/* 5. Notes */}
      <div className="mt-4">
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

      {/* 6. Sticky footer */}
      <DrawerStickyFooter
        label="Открыть сервис"
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
          aria-label={`Сервис: ${serviceType}`}
        >
          <div className="flex-1 overflow-y-auto px-4 pb-6 pt-5 sm:px-5">
            {content}
          </div>
        </motion.aside>
      </motion.div>
    </AnimatePresence>
  );
}
