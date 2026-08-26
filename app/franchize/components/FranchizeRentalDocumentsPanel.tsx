"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import { addRentalDamageReport, saveRentalPickupFreeze } from "@/app/rentals/actions";

type RentalMetadata = Record<string, any> | null;

interface FranchizeRentalDocumentsPanelProps {
  rentalId: string;
  ownerId: string;
  crewId: string;
  /** Crew slug — more reliable than crewId for membership matching (mirrors FranchizeRentalRoleGuard) */
  crewSlug?: string;
  /** Bike's partner owner (specs.subrenter_chat_id) — mini admin for this bike */
  subrenterChatId?: string;
  status: string;
  metadata: RentalMetadata;
  /** metadata.pep_signature — renter's ПЭП (ст. 5–6 ФЗ-63) status for operators */
  pepSignature?: { telegram_id?: string; username?: string | null; signed_at?: string; doc_sha256?: string } | null;
  /** metadata.doc_sha256 — the CURRENT document fingerprint (stale-signature detection) */
  currentDocSha?: string | null;
  palette: {
    accentMain: string;
    borderSoft: string;
    textPrimary: string;
    textSecondary: string;
    bgCard: string;
  };
  isAuto?: boolean;
}

const freezeChecklistOptions = [
  "Фото байка сделано",
  "VIN/номер сверены",
  "Шлем и экипировка проверены",
  "Топливный уровень зафиксирован",
  "Клиент подписал условия",
];

export function FranchizeRentalDocumentsPanel({ rentalId, ownerId, crewId, crewSlug, subrenterChatId, status, metadata, pepSignature, currentDocSha, palette, isAuto = false }: FranchizeRentalDocumentsPanelProps) {
  const { dbUser, userCrewMemberships } = useAppContext();

  // All themed values — CSS vars for auto, palette values for manual themes
  const theme = useMemo(() => {
    if (isAuto) {
      return {
        bgCard: "color-mix(in srgb, var(--franchize-bg-card) 80%, transparent)",
        textPrimary: "var(--franchize-text-primary)",
        textSecondary: "var(--franchize-text-secondary)",
        borderSoft: "var(--franchize-border-soft)",
        accentMain: "var(--franchize-accent-main)",
        inputBg: "var(--franchize-bg-card)",
        inputText: "var(--franchize-text-primary)",
        inputBorder: "var(--franchize-border-soft)",
      };
    }
    return {
      bgCard: `${palette.bgCard}CC`,
      textPrimary: palette.textPrimary,
      textSecondary: palette.textSecondary,
      borderSoft: palette.borderSoft,
      accentMain: palette.accentMain,
      inputBg: palette.bgCard,
      inputText: palette.textPrimary,
      inputBorder: palette.borderSoft,
    };
  }, [isAuto, palette]);

  const [isPending, startTransition] = useTransition();
  // FIX (iter9): pre-fill the odometer from the rental's known state instead
  // of the hardcoded "45000" placeholder. Priority:
  //   1. already-saved pickup freeze value (re-open after save)
  //   2. metadata.last_known_odometer (recorded at order creation)
  //   3. metadata.odometer_before_hint (same, older key)
  const knownOdometer = useMemo(() => {
    const freezeOdo = Number((metadata?.pickup_freeze as Record<string, any> | undefined)?.odometer_km);
    if (Number.isFinite(freezeOdo) && freezeOdo > 0) return String(freezeOdo);
    const lastKnown = Number(metadata?.last_known_odometer ?? metadata?.odometer_before_hint);
    if (Number.isFinite(lastKnown) && lastKnown > 0) return String(lastKnown);
    return "";
  }, [metadata]);
  const [odometerKm, setOdometerKm] = useState(knownOdometer);
  const [fuelLevel, setFuelLevel] = useState("4/5");
  const [freezeNotes, setFreezeNotes] = useState("");
  const [checklist, setChecklist] = useState<string[]>(freezeChecklistOptions.slice(0, 2));
  // For active rentals, bike already handed off — default to "return" phase
  const [damagePhase, setDamagePhase] = useState<"pickup" | "return">(status === "active" ? "return" : "pickup");
  const [damageSeverity, setDamageSeverity] = useState<"minor" | "major">("minor");
  const [damageNotes, setDamageNotes] = useState("");

  const isOwner = dbUser?.user_id === ownerId;
  // FIX (iter9): client-side gate aligned with the server-side
  // canUserOperateRentalHandover chain — crew matching by crewId OR slug
  // (crewId formats sometimes diverge — see FranchizeRentalRoleGuard),
  // plus global admin and the bike's subrent partner.
  const isCrewAdmin = useMemo(() => {
    if (isOwner) return true;
    const member = userCrewMemberships.find(
      (m) => (crewId && m.crewId === crewId) || (crewSlug && m.slug === crewSlug),
    );
    if (member && ["owner", "admin", "co_owner", "member"].includes(member.role)) return true;
    if (subrenterChatId && dbUser?.user_id === subrenterChatId) return true;
    const dbUserAny = dbUser as unknown as Record<string, unknown> | undefined;
    const userMeta = (dbUser?.metadata as Record<string, unknown> | null) ?? null;
    if (
      dbUserAny?.role === "admin" || dbUserAny?.role === "vprAdmin" || dbUserAny?.status === "admin"
      || userMeta?.role === "admin" || userMeta?.status === "admin"
    ) {
      return true;
    }
    return false;
  }, [isOwner, userCrewMemberships, crewId, crewSlug, subrenterChatId, dbUser]);
  const pickupFreeze = (metadata?.pickup_freeze ?? null) as Record<string, any> | null;
  const damageReports = useMemo(() => (Array.isArray(metadata?.damage_reports) ? metadata?.damage_reports : []), [metadata]);
  const canFreeze = isCrewAdmin && ["pending_confirmation", "confirmed"].includes(status);

  const toggleChecklist = (item: string) => {
    setChecklist((prev) => (prev.includes(item) ? prev.filter((it) => it !== item) : [...prev, item]));
  };

  const onSaveFreeze = () => {
    if (!canFreeze || !dbUser?.user_id) return;
    const parsedOdometer = Number(odometerKm);
    if (!Number.isFinite(parsedOdometer) || parsedOdometer < 0) {
      toast.error("Укажите пробег (км) — например, подсказку со страницы аренды.");
      return;
    }
    startTransition(async () => {
      const result = await saveRentalPickupFreeze(rentalId, dbUser.user_id, {
        odometerKm: parsedOdometer,
        fuelLevel,
        checklist,
        notes: freezeNotes,
      });
      if (!result.success) {
        toast.error(result.error || "Не удалось сохранить выдачу");
        return;
      }
      toast.success("Выдача сохранена. Теперь можно подтверждать старт аренды.");
    });
  };

  const onAddDamageReport = () => {
    if (!dbUser?.user_id) {
      toast.error("Нужна авторизация в Telegram WebApp.");
      return;
    }
    startTransition(async () => {
      const result = await addRentalDamageReport(rentalId, dbUser.user_id, {
        phase: damagePhase,
        severity: damageSeverity,
        notes: damageNotes,
      });
      if (!result.success) {
        toast.error(result.error || "Не удалось добавить отчёт о повреждении");
        return;
      }
      setDamageNotes("");
      toast.success("Отчёт о повреждении добавлен в документы аренды.");
    });
  };

  return (
    <section
      className="mt-4 rounded-2xl border p-4"
      style={{ borderColor: theme.borderSoft, backgroundColor: theme.bgCard }}
    >
      <p className="text-xs uppercase tracking-[0.16em]" style={{ color: theme.textSecondary }}>
        Документы аренды
      </p>
      <h3 className="mt-1 text-base font-semibold" style={{ color: theme.textPrimary }}>
        Фиксация выдачи и повреждений
      </h3>

      <div className="mt-3 rounded-xl border p-3" style={{ borderColor: theme.borderSoft }}>
        <p className="text-sm font-medium" style={{ color: theme.textPrimary }}>Фиксация выдачи</p>
        {/* ПЭП status (ст. 5–6 ФЗ-63): signed by the renter → details;
            unsigned → paper-signature reminder for the operator.
            Stale (doc regenerated after signing) → amber warning. */}
        {(() => {
          const stale = Boolean(
            pepSignature?.signed_at &&
            typeof pepSignature.doc_sha256 === "string" &&
            pepSignature.doc_sha256.length > 0 &&
            typeof currentDocSha === "string" &&
            currentDocSha.length > 0 &&
            pepSignature.doc_sha256 !== currentDocSha,
          );
          if (pepSignature?.signed_at) {
            return (
              <div className="mt-2">
                <p className="text-xs" style={{ color: theme.textSecondary }}>
                  ✍️ ПЭП: подписана {new Date(pepSignature.signed_at).toLocaleString("ru-RU")} · Telegram ID {pepSignature.telegram_id}{pepSignature.username ? ` (@${pepSignature.username})` : ""}
                  {pepSignature.doc_sha256 ? ` · SHA-256 ${pepSignature.doc_sha256.slice(0, 12)}…` : ""} — бумажная подпись не нужна (п. 12.3).
                </p>
                {stale && (
                  <p className="mt-1 rounded-md px-2 py-1 text-[11px] font-medium" style={{ color: "#b45309", backgroundColor: "rgba(245, 158, 11, 0.12)" }}>
                    ⚠ Документ обновлён после подписи — попросите арендатора переподписать текущую версию
                  </p>
                )}
              </div>
            );
          }
          return (
            <p className="mt-2 text-xs" style={{ color: theme.textSecondary }}>
              ✍️ ПЭП: не подписана — договор подписывается на бумаге, либо арендатор может подписать его на своей странице аренды.
            </p>
          );
        })()}
        {pickupFreeze?.frozen_at ? (
          <div className="mt-2 space-y-1 text-xs" style={{ color: theme.textSecondary }}>
            <p>Статус: зафиксировано {new Date(pickupFreeze.frozen_at).toLocaleString("ru-RU")}</p>
            <p>Пробег: {pickupFreeze.odometer_km ?? "—"} км · Топливо: {pickupFreeze.fuel_level ?? "—"}</p>
            <p>Чеклист: {(pickupFreeze.checklist || []).join(", ") || "—"}</p>
          </div>
        ) : (
          <p className="mt-2 text-xs" style={{ color: theme.textSecondary }}>Выдача пока не зафиксирована.</p>
        )}

        {canFreeze && (
          <div className="mt-3 space-y-2 text-sm">
            <div className="grid gap-2 sm:grid-cols-2">
              <input className="rounded-lg border px-2 py-1.5" style={{ borderColor: theme.inputBorder, backgroundColor: theme.inputBg, color: theme.inputText }} value={odometerKm} onChange={(e) => setOdometerKm(e.target.value)} placeholder={knownOdometer ? knownOdometer : "Пробег, км"} inputMode="numeric" />
              <input className="rounded-lg border px-2 py-1.5" style={{ borderColor: theme.inputBorder, backgroundColor: theme.inputBg, color: theme.inputText }} value={fuelLevel} onChange={(e) => setFuelLevel(e.target.value)} placeholder="Топливо (например 4/5)" />
            </div>
            <div className="flex flex-wrap gap-2">
              {freezeChecklistOptions.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => toggleChecklist(item)}
                  className="rounded-full border px-2 py-1 text-xs"
                  style={{ borderColor: checklist.includes(item) ? theme.accentMain : theme.borderSoft, color: checklist.includes(item) ? theme.accentMain : theme.textSecondary }}
                >
                  {checklist.includes(item) ? "✓ " : ""}
                  {item}
                </button>
              ))}
            </div>
            <textarea className="min-h-16 w-full rounded-lg border px-2 py-1.5" style={{ borderColor: theme.inputBorder, backgroundColor: theme.inputBg, color: theme.inputText }} value={freezeNotes} onChange={(e) => setFreezeNotes(e.target.value)} placeholder="Комментарий к выдаче (опционально)" />
            <button
              type="button"
              disabled={isPending}
              onClick={onSaveFreeze}
              className="rounded-lg px-3 py-2 text-sm font-semibold"
              style={{ backgroundColor: theme.accentMain, color: "#16130A" }}
            >
              {isPending ? "Сохраняем..." : "Сохранить выдачу"}
            </button>
          </div>
        )}
      </div>

      <div className="mt-3 rounded-xl border p-3" style={{ borderColor: theme.borderSoft }}>
        <p className="text-sm font-medium" style={{ color: theme.textPrimary }}>Отчёты о повреждениях ({damageReports.length})</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <select className="rounded-lg border px-2 py-1.5 text-sm" style={{ borderColor: theme.inputBorder, backgroundColor: theme.inputBg, color: theme.inputText }} value={damagePhase} onChange={(e) => setDamagePhase(e.target.value as "pickup" | "return")}>
            {/* For active rentals, bike already handed off — only "На возврате" makes sense */}
            {status !== "active" && <option value="pickup">На выдаче</option>}
            <option value="return">На возврате</option>
          </select>
          <select className="rounded-lg border px-2 py-1.5 text-sm" style={{ borderColor: theme.inputBorder, backgroundColor: theme.inputBg, color: theme.inputText }} value={damageSeverity} onChange={(e) => setDamageSeverity(e.target.value as "minor" | "major")}>
            <option value="minor">Лёгкое</option>
            <option value="major">Серьёзное</option>
          </select>
        </div>
        <textarea className="mt-2 min-h-16 w-full rounded-lg border px-2 py-1.5 text-sm" style={{ borderColor: theme.inputBorder, backgroundColor: theme.inputBg, color: theme.inputText }} value={damageNotes} onChange={(e) => setDamageNotes(e.target.value)} placeholder="Описание повреждения / замечания" />
        <button
          type="button"
          disabled={isPending}
          onClick={onAddDamageReport}
          className="mt-2 rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: theme.borderSoft, color: theme.textPrimary }}
        >
          Добавить отчёт
        </button>

        <ul className="mt-3 space-y-2 text-xs" style={{ color: theme.textSecondary }}>
          {damageReports.slice(0, 5).map((report: any) => (
            <li key={report.report_id || `${report.reported_at}-${report.notes}`} className="rounded-lg border p-2" style={{ borderColor: theme.borderSoft }}>
              <p className="font-medium" style={{ color: theme.textPrimary }}>
                {report.phase === "pickup" ? "Выдача" : "Возврат"} · {report.severity}
              </p>
              <p>{report.notes}</p>
              <p>{report.reporter_role || "пользователь"} · {report.reported_at ? new Date(report.reported_at).toLocaleString("ru-RU") : "—"}</p>
            </li>
          ))}
          {damageReports.length === 0 && <li style={{ color: theme.textSecondary }}>Отчётов о повреждениях пока нет.</li>}
        </ul>
      </div>
    </section>
  );
}
