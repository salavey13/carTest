"use client";

// /analytics/components/SaleDetailDrawer.tsx
//
// Sale detail drawer (v2 — iter15):
//   1. Header          — bike title, buyer ФИО, sale badge, close
//   2. Primary actions — Download contract (signed URL from Supabase storage)
//                        / Send by email / Mark signed / Cancel
//   3. Info grid       — bike, buyer, phone, email, price, total, created, bike_id,
//                        delivery method (+ transport company when set)
//   4. Notes           — PERSISTED operator notes (lead_notes keyed "sale:<contract_key>"),
//                        e.g. «шлем в подарок» — same UX as the rental page notes
//   5. Sticky footer   — "Открыть продажу →"
//
// Data: instant render from the dashboard row; getSaleDetails enriches with
// passport/delivery fields, the signed DOCX URL and notes (graceful on failure).

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  X,
  FileDown,
  Mail,
  CheckCircle2,
  XCircle,
  ExternalLink,
  StickyNote,
  Banknote,
} from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";
import { getSaleDetails, addSaleNote, type SaleNoteItem } from "@/app/franchize/server-actions/sale-details";
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
  /** crew slug for server-action auth */
  crewSlug: string;
  onClose: () => void;
  onAction: (action: DrawerAction) => void;
  T: ThemeTokens;
  asSheetChild?: boolean;
}

export function SaleDetailDrawer({
  sale,
  crewSlug,
  onClose,
  onAction,
  T,
  asSheetChild = false,
}: SaleDetailDrawerProps) {
  const { dbUser } = useAppContext();
  const [newNote, setNewNote] = useState("");
  const [openNotes, setOpenNotes] = useState(true);
  const [notes, setNotes] = useState<SaleNoteItem[]>([]);
  const [notesLoaded, setNotesLoaded] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [docLoading, setDocLoading] = useState(false);
  const [savingNote, setSavingNote] = useState(false);

  const bikeTitle = getSaleBikeTitle(sale);
  const buyerName = getBuyerName(sale);
  const price = Number(sale.total_sum ?? sale.sale_price) || 0;
  const initials = getInitials(buyerName);

  // ── Enrich: notes + signed DOCX url ─────────────────────────────────────
  const loadDetails = useCallback(async () => {
    const actorUserId = dbUser?.user_id;
    if (!actorUserId) return;
    try {
      const result = await getSaleDetails({ actorUserId, crewSlug, saleId: sale.id });
      if (result.success && result.data) {
        setNotes(result.data.notes);
        setDownloadUrl(result.data.downloadUrl);
      }
    } catch {
      // non-fatal — drawer still renders the row data
    } finally {
      setNotesLoaded(true);
    }
  }, [dbUser?.user_id, crewSlug, sale.id]);

  useEffect(() => {
    setNotes([]);
    setNotesLoaded(false);
    setDownloadUrl(null);
    void loadDetails();
  }, [loadDetails]);

  const submitNote = async () => {
    const text = newNote.trim();
    const actorUserId = dbUser?.user_id;
    if (!text || !actorUserId || savingNote) return;
    setSavingNote(true);
    try {
      const result = await addSaleNote({ actorUserId, crewSlug, saleId: sale.id, text });
      if (result.success && result.data) {
        setNotes((prev) => [...prev, result.data!]);
        setNewNote("");
        toast.success("Заметка сохранена");
      } else {
        toast.error(result.error || "Не удалось сохранить заметку");
      }
    } catch {
      toast.error("Не удалось сохранить заметку");
    } finally {
      setSavingNote(false);
    }
  };

  // ── Contract download: signed URL opens in a new tab ─────────────────────
  const onDownloadContract = async () => {
    if (downloadUrl) {
      window.open(downloadUrl, "_blank", "noopener,noreferrer");
      return;
    }
    // Maybe the first fetch failed or the doc was stored after page load — retry once.
    setDocLoading(true);
    try {
      await loadDetails();
      toast.info("Документ обновляется — нажмите ещё раз");
    } finally {
      setDocLoading(false);
    }
  };

  const primaryActions: PrimaryAction[] = [
    { icon: FileDown,     label: docLoading ? "Ищем…" : "Договор", action: "open_rental", color: "#3b82f6" },
    { icon: Mail,         label: "Отправить",   action: "telegram",    color: "#22c55e" },
    { icon: CheckCircle2, label: "Подписан",    action: "complete",    color: "#8b5cf6" },
    { icon: XCircle,      label: "Отменить",    action: "cancel",      color: "#ef4444" },
  ];

  const handleAction = (a: DrawerAction) => {
    if (a === "open_rental") {
      void onDownloadContract();
      return;
    }
    onAction(a);
  };

  const deliveryLabel = (() => {
    if (sale.delivery_method === "transport_company") {
      return sale.transport_company_name ? `ТК (${sale.transport_company_name})` : "Транспортная компания";
    }
    if (sale.delivery_method === "pickup") return "Самовывоз";
    return sale.delivery_method || null;
  })();

  const infoItems: InfoTile[] = [
    { label: "Байк",       value: bikeTitle },
    { label: "Покупатель", value: buyerName },
    { label: "Телефон",    value: sale.buyer_phone || "—", copyable: !!sale.buyer_phone },
    { label: "Email",      value: sale.buyer_email || "—", copyable: !!sale.buyer_email },
    { label: "Цена",       value: formatRubles(price), tone: "good" },
    { label: "Сумма итого", value: sale.total_sum != null ? formatRubles(sale.total_sum) : "—" },
    { label: "Доставка",   value: deliveryLabel || "—" },
    { label: "Создана",    value: formatDateTime(sale.created_at) },
  ];

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
              {sale.contract_key && (
                <span
                  className="inline-flex max-w-full items-center gap-1 truncate rounded-full px-3 py-1 text-[11px]"
                  style={{ background: T.bgCard, color: T.textMuted }}
                  title={sale.contract_key}
                >
                  #{String(sale.contract_key).slice(0, 24)}
                </span>
              )}
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
          onAction={(a) => handleAction(a as DrawerAction)}
          T={T}
        />
        {!sale.storage_path && notesLoaded && (
          <p className="mt-2 text-xs" style={{ color: T.textMuted }}>
            DOCX договора не найден в хранилище — скачайте через CSV-выгрузку или уточните у администратора.
          </p>
        )}
      </div>

      {/* 3. Info grid */}
      <div className="mt-5">
        <DrawerInfoGrid items={infoItems} T={T} />
      </div>

      {/* 4. Notes — persisted per contract */}
      <div className="mt-5">
        <DrawerSection
          title="Заметки"
          icon={StickyNote}
          expanded={openNotes}
          onToggle={() => setOpenNotes(!openNotes)}
          T={T}
        >
          <div className="mb-2">
            <DrawerAddNoteInput
              value={newNote}
              onChange={setNewNote}
              onSubmit={() => void submitNote()}
              placeholder="Например: шлем в подарок"
              T={T}
            />
          </div>
          {notes.length === 0 ? (
            <DrawerEmptyHint label={notesLoaded ? "Заметок нет" : "Загрузка заметок…"} T={T} />
          ) : (
            <ul className="space-y-2">
              {notes.map((n) => (
                <li
                  key={n.id}
                  className="rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: T.borderSoft, background: T.bgCard, color: T.text }}
                >
                  <p>{n.text}</p>
                  <p className="mt-1 text-[11px]" style={{ color: T.textMuted }}>
                    {n.created_at ? formatDateTime(n.created_at) : ""}
                    {n.created_by ? ` · ${n.created_by}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
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
        // z-[55]: above the sticky CrewHeader (z-50), below dialogs (z-[60]) / toasts (z-[70])
        className="fixed inset-0 z-[55] hidden justify-end lg:flex"
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
