"use client";

import { useState, useEffect } from "react";
import { X, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import { useFranchizeTheme } from "@/app/franchize/hooks/useFranchizeTheme";
import { withAlpha } from "@/app/franchize/lib/theme";
import {
  getRentalHandoff,
  saveRentalHandoff,
  deleteRentalHandoff,
  type RentalHandoff,
} from "@/app/franchize/server-actions/rental-handoffs";

interface RentalHandoffModalProps {
  rentalId: string;
  vehicleName: string;
  phase: "handout" | "return";
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  isPasswordAuth?: boolean;
  crewTheme?: any;
}

const PHASE_LABELS = {
  handout: "ВЫДАЧА",
  return: "ВОЗВРАТ",
};

const PERCENT_OPTIONS = [0, 25, 50, 75, 100];

const CONDITION_OPTIONS = [
  { label: "Норм", value: "Норм" },
  { label: "Грязно", value: "Грязно" },
  { label: "Есть царапины", value: "Есть царапины" },
  { label: "Есть потёртости", value: "Есть потёртости" },
  { label: "Есть повреждения", value: "Есть повреждения" },
];

// ─── Theme-aware QuickSelect Chip ────────────────────────────────────────────────

interface QuickSelectChipProps {
  label: string;
  selected: boolean;
  onClick: () => void;
  accentColor: string;
  textColor: string;
  borderColor: string;
}

function QuickSelectChip({ label, selected, onClick, accentColor, textColor, borderColor }: QuickSelectChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-1.5 text-xs rounded-full transition-all"
      style={
        selected
          ? { backgroundColor: accentColor, color: "#000000", fontWeight: 500 }
          : { backgroundColor: withAlpha(borderColor, 0.15), color: textColor }
      }
    >
      {label}
    </button>
  );
}

// ─── Theme-aware Checkbox Item ───────────────────────────────────────────────────

interface CheckboxItemProps {
  checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  label: string;
  accentColor: string;
  cardBg: string;
  textColor: string;
  completedColor?: string;
}

function CheckboxItem({ checked, onChange, label, accentColor, cardBg, textColor, completedColor = "#10b981" }: CheckboxItemProps) {
  return (
    <label
      className="flex items-center gap-2 p-2 rounded cursor-pointer transition-all"
      style={{
        backgroundColor: checked ? withAlpha(completedColor, 0.2) : withAlpha(cardBg, 0.5),
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="w-4 h-4 rounded"
        style={{ accentColor }}
      />
      <span className="text-sm" style={{ color: textColor }}>{label}</span>
      {checked && <CheckCircle2 className="w-3.5 h-3.5 ml-auto" style={{ color: completedColor }} />}
    </label>
  );
}

// ─── Main Modal Component ───────────────────────────────────────────────────────────

export function RentalHandoffModal({
  rentalId,
  vehicleName,
  phase,
  isOpen,
  onClose,
  onSuccess,
  isPasswordAuth,
  crewTheme,
}: RentalHandoffModalProps) {
  const { dbUser, passwordAuthOwnerId } = useAppContext();
  const actorUserId = dbUser?.user_id || passwordAuthOwnerId || "";

  // Get theme colors
  const cssVars = crewTheme ? useFranchizeTheme(crewTheme).cssVars : {
    backgroundColor: "#0A0A0A",
    cardBackground: "#1A1A1A",
    accentColor: "#FFD700",
    accentHover: "#FFC125",
    textColor: "#FFFAF0",
    mutedColor: "#D4AF37",
    borderColor: "#2A2A2A",
  };

  const bgBase = cssVars.backgroundColor;
  const bgCard = cssVars.cardBackground;
  const accentMain = cssVars.accentColor;
  const accentHover = cssVars.accentHover;
  const textPrimary = cssVars.textColor;
  const textSecondary = cssVars.mutedColor;
  const borderSoft = cssVars.borderColor;

  const [handoff, setHandoff] = useState<RentalHandoff | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [passportChecked, setPassportChecked] = useState(false);
  const [licenseChecked, setLicenseChecked] = useState(false);
  const [depositCollected, setDepositCollected] = useState(false);
  const [helmetIssued, setHelmetIssued] = useState(false);
  const [keysIssued, setKeysIssued] = useState(false);
  const [instructionsGiven, setInstructionsGiven] = useState(false);
  const [photosTaken, setPhotosTaken] = useState(false);

  const [conditionChecked, setConditionChecked] = useState(false);
  const [helmetReturned, setHelmetReturned] = useState(false);
  const [keysReturned, setKeysReturned] = useState(false);
  const [depositReturned, setDepositReturned] = useState(false);
  const [noDamagesConfirmed, setNoDamagesConfirmed] = useState(false);

  const [odometerStart, setOdometerStart] = useState("");
  const [odometerEnd, setOdometerEnd] = useState("");
  const [fuelLevelStart, setFuelLevelStart] = useState<number | null>(null);
  const [fuelLevelEnd, setFuelLevelEnd] = useState<number | null>(null);
  const [batteryLevelStart, setBatteryLevelStart] = useState<number | null>(null);
  const [batteryLevelEnd, setBatteryLevelEnd] = useState<number | null>(null);
  const [keysCount, setKeysCount] = useState<number>(1);

  const [chargerIncluded, setChargerIncluded] = useState(false);
  const [lockCableIncluded, setLockCableIncluded] = useState(false);
  const [jacketIssued, setJacketIssued] = useState(false);
  const [secondHelmetIssued, setSecondHelmetIssued] = useState(false);
  const [bagIssued, setBagIssued] = useState(false);
  const [netIssued, setNetIssued] = useState(false);
  const [cameraMountIssued, setCameraMountIssued] = useState(false);
  const [motoCoverIssued, setMotoCoverIssued] = useState(false);
  const [ebikeChargerIssued, setEbikeChargerIssued] = useState(false);

  const [otherEquipment, setOtherEquipment] = useState("");
  const [equipmentConditionReturn, setEquipmentConditionReturn] = useState("");
  const [damageNotes, setDamageNotes] = useState("");
  const [notes, setNotes] = useState("");

  // Load existing handoff data
  useEffect(() => {
    if (!isOpen || !rentalId) return;

    setLoading(true);
    getRentalHandoff({ actorUserId, rentalId, isPasswordAuth })
      .then((result) => {
        if (result.success && result.data) {
          const phaseData = phase === "handout" ? result.data.handout : result.data.return;
          setHandoff(phaseData);

          if (phaseData) {
            setPassportChecked(phaseData.passport_checked || false);
            setLicenseChecked(phaseData.license_checked || false);
            setDepositCollected(phaseData.deposit_collected || false);
            setHelmetIssued(phaseData.helmet_issued || false);
            setKeysIssued(phaseData.keys_issued || false);
            setInstructionsGiven(phaseData.instructions_given || false);
            setPhotosTaken(phaseData.photos_taken || false);

            setConditionChecked(phaseData.condition_checked || false);
            setHelmetReturned(phaseData.helmet_returned || false);
            setKeysReturned(phaseData.keys_returned || false);
            setDepositReturned(phaseData.deposit_returned || false);
            setNoDamagesConfirmed(phaseData.no_damages_confirmed || false);

            setOdometerStart(phaseData.odometer_start?.toString() || "");
            setOdometerEnd(phaseData.odometer_end?.toString() || "");
            setFuelLevelStart(phaseData.fuel_level_start ?? null);
            setFuelLevelEnd(phaseData.fuel_level_end ?? null);
            setBatteryLevelStart(phaseData.battery_level_start ?? null);
            setBatteryLevelEnd(phaseData.battery_level_end ?? null);
            setDamageNotes(phaseData.damage_notes || "");
            setNotes(phase === "handout" ? phaseData.handout_notes || "" : phaseData.return_notes || "");

            setKeysCount(phaseData.keys_count ?? 1);
            setChargerIncluded(phaseData.charger_included || false);
            setLockCableIncluded(phaseData.lock_cable_included || false);
            setJacketIssued(phaseData.jacket_issued || false);
            setSecondHelmetIssued(phaseData.second_helmet_issued || false);
            setBagIssued(phaseData.bag_issued || false);
            setNetIssued(phaseData.net_issued || false);
            setCameraMountIssued(phaseData.camera_mount_issued || false);
            setMotoCoverIssued(phaseData.moto_cover_issued || false);
            setEbikeChargerIssued(phaseData.ebike_charger_issued || false);
            setOtherEquipment(phaseData.other_equipment || "");
            setEquipmentConditionReturn(phaseData.equipment_condition_return || "");
          }
        }
      })
      .finally(() => { setLoading(false); });
  }, [isOpen, rentalId, phase, actorUserId, isPasswordAuth]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await saveRentalHandoff({
        actorUserId,
        rentalId,
        phase,
        data: {
          passport_checked: passportChecked,
          license_checked: licenseChecked,
          deposit_collected: depositCollected,
          helmet_issued: helmetIssued,
          keys_issued: keysIssued,
          instructions_given: instructionsGiven,
          photos_taken: photosTaken,
          condition_checked: conditionChecked,
          helmet_returned: helmetReturned,
          keys_returned: keysReturned,
          deposit_returned: depositReturned,
          no_damages_confirmed: noDamagesConfirmed,
          odometer_start: odometerStart ? parseInt(odometerStart) : null,
          odometer_end: odometerEnd ? parseInt(odometerEnd) : null,
          fuel_level_start: fuelLevelStart,
          fuel_level_end: fuelLevelEnd,
          battery_level_start: batteryLevelStart,
          battery_level_end: batteryLevelEnd,
          damage_notes: damageNotes || null,
          handout_notes: phase === "handout" ? notes || null : undefined,
          return_notes: phase === "return" ? notes || null : undefined,
          keys_count: keysCount,
          charger_included: chargerIncluded,
          lock_cable_included: lockCableIncluded,
          jacket_issued: jacketIssued,
          second_helmet_issued: secondHelmetIssued,
          bag_issued: bagIssued,
          net_issued: netIssued,
          camera_mount_issued: cameraMountIssued,
          moto_cover_issued: motoCoverIssued,
          ebike_charger_issued: ebikeChargerIssued,
          other_equipment: otherEquipment || null,
          equipment_condition_return: equipmentConditionReturn || null,
        },
        isPasswordAuth,
      });

      if (result.success) {
        toast.success(phase === "handout" ? "Выдача сохранена" : "Возврат сохранён");
        onSuccess?.();
        onClose();
      } else {
        toast.error(result.error || "Ошибка сохранения");
      }
    } catch (error) {
      toast.error("Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Удалить запись?")) return;

    setSaving(true);
    try {
      const result = await deleteRentalHandoff({ actorUserId, rentalId, phase, isPasswordAuth });

      if (result.success) {
        toast.success("Запись удалена");
        onSuccess?.();
        onClose();
      } else {
        toast.error(result.error || "Ошибка удаления");
      }
    } catch (error) {
      toast.error("Ошибка удаления");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const isCompleted = phase === "handout"
    ? passportChecked && licenseChecked && depositCollected && helmetIssued && keysIssued && odometerStart
    : conditionChecked && helmetReturned && keysReturned && odometerEnd;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm p-4" style={{ backgroundColor: withAlpha("#000000", 0.5) }}>
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border shadow-2xl" style={{ background: `linear-gradient(to bottom right, ${bgCard}, ${withAlpha(bgCard, 0.8)})`, borderColor: withAlpha(borderSoft, 0.3) }}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: withAlpha(borderSoft, 0.3) }}>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: isCompleted ? "#10b981" : "#f59e0b" }} />
            <h2 className="text-lg font-bold" style={{ color: textPrimary }}>{PHASE_LABELS[phase]}</h2>
            <span className="text-sm" style={{ color: textSecondary }}>{vehicleName}</span>
          </div>
          <button onClick={onClose} className="p-1 rounded transition-colors hover:bg-white/10" style={{ color: textSecondary }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {loading ? (
            <div className="text-center py-8" style={{ color: textSecondary }}>Загрузка...</div>
          ) : (
            <>
              {/* Phase-specific checklist */}
              {phase === "handout" ? (
                <div className="space-y-1.5">
                  <h3 className="text-xs font-medium uppercase tracking-wide" style={{ color: textSecondary }}>Чеклист</h3>
                  <div className="space-y-1">
                    <CheckboxItem checked={passportChecked} onChange={(e) => setPassportChecked(e.target.checked)} label="Паспорт" accentColor={accentMain} cardBg={bgCard} textColor={textPrimary} />
                    <CheckboxItem checked={licenseChecked} onChange={(e) => setLicenseChecked(e.target.checked)} label="ВУ" accentColor={accentMain} cardBg={bgCard} textColor={textPrimary} />
                    <CheckboxItem checked={depositCollected} onChange={(e) => setDepositCollected(e.target.checked)} label="Залог" accentColor={accentMain} cardBg={bgCard} textColor={textPrimary} />
                    <CheckboxItem checked={helmetIssued} onChange={(e) => setHelmetIssued(e.target.checked)} label="Шлем" accentColor={accentMain} cardBg={bgCard} textColor={textPrimary} />
                    <CheckboxItem checked={keysIssued} onChange={(e) => setKeysIssued(e.target.checked)} label="Ключи" accentColor={accentMain} cardBg={bgCard} textColor={textPrimary} />
                    <CheckboxItem checked={instructionsGiven} onChange={(e) => setInstructionsGiven(e.target.checked)} label="Инструкция" accentColor={accentMain} cardBg={bgCard} textColor={textPrimary} />
                    <CheckboxItem checked={photosTaken} onChange={(e) => setPhotosTaken(e.target.checked)} label="Фото" accentColor={accentMain} cardBg={bgCard} textColor={textPrimary} />
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <h3 className="text-xs font-medium uppercase tracking-wide" style={{ color: textSecondary }}>Чеклист</h3>
                  <div className="space-y-1">
                    <CheckboxItem checked={conditionChecked} onChange={(e) => setConditionChecked(e.target.checked)} label="Состояние проверено" accentColor={accentMain} cardBg={bgCard} textColor={textPrimary} />
                    <CheckboxItem checked={helmetReturned} onChange={(e) => setHelmetReturned(e.target.checked)} label="Шлем возвращён" accentColor={accentMain} cardBg={bgCard} textColor={textPrimary} />
                    <CheckboxItem checked={keysReturned} onChange={(e) => setKeysReturned(e.target.checked)} label="Ключи возвращены" accentColor={accentMain} cardBg={bgCard} textColor={textPrimary} />
                    <CheckboxItem checked={depositReturned} onChange={(e) => setDepositReturned(e.target.checked)} label="Залог возвращён" accentColor={accentMain} cardBg={bgCard} textColor={textPrimary} />
                    <CheckboxItem checked={noDamagesConfirmed} onChange={(e) => setNoDamagesConfirmed(e.target.checked)} label="Без повреждений" accentColor={accentMain} cardBg={bgCard} textColor={textPrimary} />
                  </div>
                </div>
              )}

              {/* Odometer */}
              <div className="space-y-2">
                <h3 className="text-xs font-medium uppercase tracking-wide" style={{ color: textSecondary }}>Одометр (км)</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: textSecondary }}>Выдача</label>
                    <input
                      type="number"
                      value={odometerStart}
                      onChange={(e) => setOdometerStart(e.target.value)}
                      placeholder="1250"
                      disabled={phase === "return" && handoff?.odometer_start}
                      className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                      style={{ backgroundColor: withAlpha(bgCard, 0.5), border: `1px solid ${borderSoft}`, color: textPrimary }}
                    />
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: textSecondary }}>Возврат</label>
                    <input
                      type="number"
                      value={odometerEnd}
                      onChange={(e) => setOdometerEnd(e.target.value)}
                      placeholder="1450"
                      className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                      style={{ backgroundColor: withAlpha(bgCard, 0.5), border: `1px solid ${borderSoft}`, color: textPrimary }}
                    />
                  </div>
                </div>
                {odometerStart && odometerEnd && (
                  <div className="flex items-center justify-center gap-1 text-xs py-1.5 rounded-lg" style={{ color: "#10b981", backgroundColor: withAlpha("#10b981", 0.1) }}>
                    <span>Пробег:</span>
                    <span className="font-bold">{parseInt(odometerEnd) - parseInt(odometerStart)}</span>
                    <span>км</span>
                  </div>
                )}
              </div>

              {/* Fuel level */}
              <div className="space-y-2">
                <h3 className="text-xs font-medium uppercase tracking-wide" style={{ color: textSecondary }}>Топливо (%)</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs mb-1.5 block" style={{ color: textSecondary }}>Выдача</label>
                    <div className="flex flex-wrap gap-1.5">
                      {PERCENT_OPTIONS.map((pct) => (
                        <QuickSelectChip
                          key={`fuel-start-${pct}`}
                          label={`${pct}%`}
                          selected={fuelLevelStart === pct}
                          onClick={() => setFuelLevelStart(pct)}
                          accentColor={accentMain}
                          textColor={textPrimary}
                          borderColor={borderSoft}
                        />
                      ))}
                      <button
                        type="button"
                        onClick={() => setFuelLevelStart(null)}
                        className="px-3 py-1.5 text-xs rounded-full transition-all"
                        style={{ backgroundColor: fuelLevelStart === null ? withAlpha(borderSoft, 0.2) : withAlpha(borderSoft, 0.1), color: textSecondary }}
                      >
                        —
                      </button>
                    </div>
                  </div>
                  {phase === "return" && (
                    <div>
                      <label className="text-xs mb-1.5 block" style={{ color: textSecondary }}>Возврат</label>
                      <div className="flex flex-wrap gap-1.5">
                        {PERCENT_OPTIONS.map((pct) => (
                          <QuickSelectChip
                            key={`fuel-end-${pct}`}
                            label={`${pct}%`}
                            selected={fuelLevelEnd === pct}
                            onClick={() => setFuelLevelEnd(pct)}
                            accentColor={accentMain}
                            textColor={textPrimary}
                            borderColor={borderSoft}
                          />
                        ))}
                        <button
                          type="button"
                          onClick={() => setFuelLevelEnd(null)}
                          className="px-3 py-1.5 text-xs rounded-full transition-all"
                          style={{ backgroundColor: fuelLevelEnd === null ? withAlpha(borderSoft, 0.2) : withAlpha(borderSoft, 0.1), color: textSecondary }}
                        >
                          —
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Battery level */}
              <div className="space-y-2">
                <h3 className="text-xs font-medium uppercase tracking-wide" style={{ color: textSecondary }}>Заряд АКБ (%)</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs mb-1.5 block" style={{ color: textSecondary }}>Выдача</label>
                    <div className="flex flex-wrap gap-1.5">
                      {PERCENT_OPTIONS.map((pct) => (
                        <QuickSelectChip
                          key={`battery-start-${pct}`}
                          label={`${pct}%`}
                          selected={batteryLevelStart === pct}
                          onClick={() => setBatteryLevelStart(pct)}
                          accentColor={accentMain}
                          textColor={textPrimary}
                          borderColor={borderSoft}
                        />
                      ))}
                      <button
                        type="button"
                        onClick={() => setBatteryLevelStart(null)}
                        className="px-3 py-1.5 text-xs rounded-full transition-all"
                        style={{ backgroundColor: batteryLevelStart === null ? withAlpha(borderSoft, 0.2) : withAlpha(borderSoft, 0.1), color: textSecondary }}
                      >
                        —
                      </button>
                    </div>
                  </div>
                  {phase === "return" && (
                    <div>
                      <label className="text-xs mb-1.5 block" style={{ color: textSecondary }}>Возврат</label>
                      <div className="flex flex-wrap gap-1.5">
                        {PERCENT_OPTIONS.map((pct) => (
                          <QuickSelectChip
                            key={`battery-end-${pct}`}
                            label={`${pct}%`}
                            selected={batteryLevelEnd === pct}
                            onClick={() => setBatteryLevelEnd(pct)}
                            accentColor={accentMain}
                            textColor={textPrimary}
                            borderColor={borderSoft}
                          />
                        ))}
                        <button
                          type="button"
                          onClick={() => setBatteryLevelEnd(null)}
                          className="px-3 py-1.5 text-xs rounded-full transition-all"
                          style={{ backgroundColor: batteryLevelEnd === null ? withAlpha(borderSoft, 0.2) : withAlpha(borderSoft, 0.1), color: textSecondary }}
                        >
                          —
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Equipment */}
              <div className="space-y-2">
                <h3 className="text-xs font-medium uppercase tracking-wide" style={{ color: textSecondary }}>Комплектация</h3>

                <div>
                  <label className="text-xs mb-1.5 block" style={{ color: textSecondary }}>Ключи (шт)</label>
                  <div className="flex gap-2">
                    {[1, 2].map((count) => (
                      <QuickSelectChip
                        key={`keys-${count}`}
                        label={`${count}`}
                        selected={keysCount === count}
                        onClick={() => setKeysCount(count)}
                        accentColor={accentMain}
                        textColor={textPrimary}
                        borderColor={borderSoft}
                      />
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5 mt-2">
                  {[
                    { checked: chargerIncluded, set: setChargerIncluded, label: "Зарядка" },
                    { checked: lockCableIncluded, set: setLockCableIncluded, label: "Замок/трос" },
                    { checked: jacketIssued, set: setJacketIssued, label: "Куртка" },
                    { checked: secondHelmetIssued, set: setSecondHelmetIssued, label: "2-й шлем" },
                    { checked: bagIssued, set: setBagIssued, label: "Сумка" },
                    { checked: netIssued, set: setNetIssued, label: "Сетка" },
                    { checked: cameraMountIssued, set: setCameraMountIssued, label: "Крепление камеры" },
                    { checked: motoCoverIssued, set: setMotoCoverIssued, label: "Чехол мото" },
                    { checked: ebikeChargerIssued, set: setEbikeChargerIssued, label: "Зарядка е-байк" },
                  ].map((item) => (
                    <label
                      key={item.label}
                      className="flex items-center gap-2 p-2 rounded cursor-pointer transition-colors"
                      style={{ backgroundColor: item.checked ? withAlpha(accentMain, 0.2) : withAlpha(bgCard, 0.5) }}
                    >
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={(e) => item.set(e.target.checked)}
                        className="w-3.5 h-3.5 rounded"
                        style={{ accentColor }}
                      />
                      <span className="text-xs" style={{ color: textPrimary }}>{item.label}</span>
                    </label>
                  ))}
                </div>

                <input
                  type="text"
                  value={otherEquipment}
                  onChange={(e) => setOtherEquipment(e.target.value)}
                  placeholder="Другое оборудование..."
                  className="w-full px-3 py-2 text-xs rounded-lg focus:outline-none"
                  style={{ backgroundColor: withAlpha(bgCard, 0.5), border: `1px solid ${borderSoft}`, color: textPrimary }}
                />

                {phase === "return" && (
                  <div className="mt-2">
                    <label className="text-xs mb-1.5 block" style={{ color: textSecondary }}>Состояние экипировки</label>
                    <div className="flex flex-wrap gap-1.5">
                      {CONDITION_OPTIONS.map((opt) => (
                        <QuickSelectChip
                          key={opt.value}
                          label={opt.label}
                          selected={equipmentConditionReturn === opt.value}
                          onClick={() => setEquipmentConditionReturn(opt.value)}
                          accentColor={accentMain}
                          textColor={textPrimary}
                          borderColor={borderSoft}
                        />
                      ))}
                    </div>
                    <textarea
                      value={equipmentConditionReturn}
                      onChange={(e) => setEquipmentConditionReturn(e.target.value)}
                      placeholder="Или введите своё..."
                      rows={1}
                      className="w-full mt-2 px-3 py-2 text-xs rounded-lg focus:outline-none resize-none"
                      style={{ backgroundColor: withAlpha(bgCard, 0.5), border: `1px solid ${borderSoft}`, color: textPrimary }}
                    />
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <h3 className="text-xs font-medium uppercase tracking-wide" style={{ color: textSecondary }}>Заметки</h3>
                <textarea
                  value={damageNotes}
                  onChange={(e) => setDamageNotes(e.target.value)}
                  placeholder="Повреждения..."
                  rows={2}
                  className="w-full px-3 py-2 text-xs rounded-lg focus:outline-none resize-none"
                  style={{ backgroundColor: withAlpha(bgCard, 0.5), border: `1px solid ${borderSoft}`, color: textPrimary }}
                />
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Другие заметки..."
                  rows={1}
                  className="w-full px-3 py-2 text-xs rounded-lg focus:outline-none resize-none"
                  style={{ backgroundColor: withAlpha(bgCard, 0.5), border: `1px solid ${borderSoft}`, color: textPrimary }}
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t" style={{ borderColor: withAlpha(borderSoft, 0.3) }}>
          <button
            onClick={handleDelete}
            disabled={saving || !handoff}
            className="px-3 py-2 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ color: "#f87171" }}
          >
            Сбросить
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm disabled:opacity-50 transition-colors"
              style={{ color: textSecondary }}
            >
              Отмена
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 text-sm font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-white"
              style={{
                backgroundColor: isCompleted ? "#10b981" : accentMain,
              }}
            >
              {saving ? "..." : isCompleted ? "Готово ✓" : "Сохранить"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
