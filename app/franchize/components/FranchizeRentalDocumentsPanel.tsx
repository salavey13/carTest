"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import { addRentalDamageReport, saveRentalPickupFreeze } from "@/app/rentals/actions";

type RentalMetadata = Record<string, any> | null;

interface FranchizeRentalDocumentsPanelProps {
  rentalId: string;
  ownerId: string;
  status: string;
  metadata: RentalMetadata;
  palette: {
    accentMain: string;
    borderSoft: string;
    textPrimary: string;
    textSecondary: string;
    bgCard: string;
  };
}

const freezeChecklistOptions = [
  "Фото байка сделано",
  "VIN/номер сверены",
  "Шлем и экипировка проверены",
  "Топливный уровень зафиксирован",
  "Клиент подписал условия",
];

export function FranchizeRentalDocumentsPanel({ rentalId, ownerId, status, metadata, palette }: FranchizeRentalDocumentsPanelProps) {
  const { dbUser } = useAppContext();
  const [isPending, startTransition] = useTransition();
  const [odometerKm, setOdometerKm] = useState("45000");
  const [fuelLevel, setFuelLevel] = useState("4/5");
  const [freezeNotes, setFreezeNotes] = useState("");
  const [checklist, setChecklist] = useState<string[]>(freezeChecklistOptions.slice(0, 2));
  const [damagePhase, setDamagePhase] = useState<"pickup" | "return">("pickup");
  const [damageSeverity, setDamageSeverity] = useState<"minor" | "major">("minor");
  const [damageNotes, setDamageNotes] = useState("");

  const isOwner = dbUser?.user_id === ownerId;
  const pickupFreeze = (metadata?.pickup_freeze ?? null) as Record<string, any> | null;
  const damageReports = useMemo(() => (Array.isArray(metadata?.damage_reports) ? metadata?.damage_reports : []), [metadata]);
  const canFreeze = isOwner && ["pending_confirmation", "confirmed"].includes(status);

  const toggleChecklist = (item: string) => {
    setChecklist((prev) => (prev.includes(item) ? prev.filter((it) => it !== item) : [...prev, item]));
  };

  const onSaveFreeze = () => {
    if (!canFreeze || !dbUser?.user_id) return;
    const parsedOdometer = Number(odometerKm);
    startTransition(async () => {
      const result = await saveRentalPickupFreeze(rentalId, dbUser.user_id, {
        odometerKm: parsedOdometer,
        fuelLevel,
        checklist,
        notes: freezeNotes,
      });
      if (!result.success) {
        toast.error(result.error || "Не удалось сохранить Pickup Freeze");
        return;
      }
      toast.success("Pickup Freeze сохранен. Теперь можно подтверждать выдачу.");
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
        toast.error(result.error || "Не удалось добавить Damage Report");
        return;
      }
      setDamageNotes("");
      toast.success("Damage Report добавлен в Rental Documents.");
    });
  };

  return (
    <section
      className="mt-4 rounded-2xl border p-4"
      style={{ borderColor: palette.borderSoft, backgroundColor: `${palette.bgCard}CC` }}
    >
      <p className="text-xs uppercase tracking-[0.16em]" style={{ color: palette.textSecondary }}>
        Rental Documents
      </p>
      <h3 className="mt-1 text-base font-semibold" style={{ color: palette.textPrimary }}>
        Pickup Freeze + Damage Report
      </h3>

      <div className="mt-3 rounded-xl border p-3" style={{ borderColor: palette.borderSoft }}>
        <p className="text-sm font-medium">Pickup Freeze</p>
        {pickupFreeze?.frozen_at ? (
          <div className="mt-2 space-y-1 text-xs" style={{ color: palette.textSecondary }}>
            <p>Статус: зафиксировано {new Date(pickupFreeze.frozen_at).toLocaleString("ru-RU")}</p>
            <p>Пробег: {pickupFreeze.odometer_km ?? "—"} км · Топливо: {pickupFreeze.fuel_level ?? "—"}</p>
            <p>Чеклист: {(pickupFreeze.checklist || []).join(", ") || "—"}</p>
          </div>
        ) : (
          <p className="mt-2 text-xs" style={{ color: palette.textSecondary }}>Freeze пока не зафиксирован.</p>
        )}

        {canFreeze && (
          <div className="mt-3 space-y-2 text-sm">
            <div className="grid gap-2 sm:grid-cols-2">
              <input className="rounded-lg border px-2 py-1.5" style={{ borderColor: palette.borderSoft }} value={odometerKm} onChange={(e) => setOdometerKm(e.target.value)} placeholder="Пробег, км" />
              <input className="rounded-lg border px-2 py-1.5" style={{ borderColor: palette.borderSoft }} value={fuelLevel} onChange={(e) => setFuelLevel(e.target.value)} placeholder="Топливо (например 4/5)" />
            </div>
            <div className="flex flex-wrap gap-2">
              {freezeChecklistOptions.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => toggleChecklist(item)}
                  className="rounded-full border px-2 py-1 text-xs"
                  style={{ borderColor: checklist.includes(item) ? palette.accentMain : palette.borderSoft, color: checklist.includes(item) ? palette.accentMain : palette.textSecondary }}
                >
                  {checklist.includes(item) ? "✓ " : ""}
                  {item}
                </button>
              ))}
            </div>
            <textarea className="min-h-16 w-full rounded-lg border px-2 py-1.5" style={{ borderColor: palette.borderSoft }} value={freezeNotes} onChange={(e) => setFreezeNotes(e.target.value)} placeholder="Комментарий к freeze (опционально)" />
            <button
              type="button"
              disabled={isPending}
              onClick={onSaveFreeze}
              className="rounded-lg px-3 py-2 text-sm font-semibold"
              style={{ backgroundColor: palette.accentMain, color: "#16130A" }}
            >
              {isPending ? "Сохраняем..." : "Сохранить Pickup Freeze"}
            </button>
          </div>
        )}
      </div>

      <div className="mt-3 rounded-xl border p-3" style={{ borderColor: palette.borderSoft }}>
        <p className="text-sm font-medium">Damage Reports ({damageReports.length})</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <select className="rounded-lg border px-2 py-1.5 text-sm" style={{ borderColor: palette.borderSoft }} value={damagePhase} onChange={(e) => setDamagePhase(e.target.value as "pickup" | "return")}>
            <option value="pickup">На выдаче</option>
            <option value="return">На возврате</option>
          </select>
          <select className="rounded-lg border px-2 py-1.5 text-sm" style={{ borderColor: palette.borderSoft }} value={damageSeverity} onChange={(e) => setDamageSeverity(e.target.value as "minor" | "major")}>
            <option value="minor">Minor</option>
            <option value="major">Major</option>
          </select>
        </div>
        <textarea className="mt-2 min-h-16 w-full rounded-lg border px-2 py-1.5 text-sm" style={{ borderColor: palette.borderSoft }} value={damageNotes} onChange={(e) => setDamageNotes(e.target.value)} placeholder="Описание повреждения / замечания" />
        <button
          type="button"
          disabled={isPending}
          onClick={onAddDamageReport}
          className="mt-2 rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: palette.borderSoft, color: palette.textPrimary }}
        >
          Добавить Damage Report
        </button>

        <ul className="mt-3 space-y-2 text-xs" style={{ color: palette.textSecondary }}>
          {damageReports.slice(0, 5).map((report: any) => (
            <li key={report.report_id || `${report.reported_at}-${report.notes}`} className="rounded-lg border p-2" style={{ borderColor: palette.borderSoft }}>
              <p className="font-medium" style={{ color: palette.textPrimary }}>
                {report.phase === "pickup" ? "Выдача" : "Возврат"} · {report.severity}
              </p>
              <p>{report.notes}</p>
              <p>{report.reporter_role || "user"} · {report.reported_at ? new Date(report.reported_at).toLocaleString("ru-RU") : "—"}</p>
            </li>
          ))}
          {damageReports.length === 0 && <li>Отчётов о повреждениях пока нет.</li>}
        </ul>
      </div>
    </section>
  );
}
