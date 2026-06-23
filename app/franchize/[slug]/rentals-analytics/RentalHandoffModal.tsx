"use client";

import { useState, useEffect } from "react";
import { X, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
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
}

const PHASE_LABELS = {
  handout: "ВЫДАЧА",
  return: "ВОЗВРАТ",
};

// Quick-select options for fuel/battery
const PERCENT_OPTIONS = [0, 25, 50, 75, 100];

// Common equipment condition options
const CONDITION_OPTIONS = [
  { label: "Норм", value: "Норм" },
  { label: "Грязно", value: "Грязно" },
  { label: "Есть царапины", value: "Есть царапины" },
  { label: "Есть потёртости", value: "Есть потёртости" },
  { label: "Есть повреждения", value: "Есть повреждения" },
];

// ─── QuickSelect Chip Component ───────────────────────────────────────────────

function QuickSelectChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 text-xs rounded-full transition-all ${
        selected
          ? "bg-yellow-400 text-black font-medium"
          : "bg-white/10 text-white/70 hover:bg-white/20"
      }`}
    >
      {label}
    </button>
  );
}

export function RentalHandoffModal({
  rentalId,
  vehicleName,
  phase,
  isOpen,
  onClose,
  onSuccess,
  isPasswordAuth,
}: RentalHandoffModalProps) {
  const { dbUser, passwordAuthOwnerId } = useAppContext();
  const actorUserId = dbUser?.user_id || passwordAuthOwnerId || "";

  const [handoff, setHandoff] = useState<RentalHandoff | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state - booleans (already 1-tap checkboxes)
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

  // Numeric - odometer (keep as number input, too variable)
  const [odometerStart, setOdometerStart] = useState("");
  const [odometerEnd, setOdometerEnd] = useState("");

  // Percentages - use quick-select
  const [fuelLevelStart, setFuelLevelStart] = useState<number | null>(null);
  const [fuelLevelEnd, setFuelLevelEnd] = useState<number | null>(null);
  const [batteryLevelStart, setBatteryLevelStart] = useState<number | null>(null);
  const [batteryLevelEnd, setBatteryLevelEnd] = useState<number | null>(null);

  // Equipment - use quick-select for count
  const [keysCount, setKeysCount] = useState<number>(1);

  // Equipment checkboxes (already 1-tap)
  const [chargerIncluded, setChargerIncluded] = useState(false);
  const [lockCableIncluded, setLockCableIncluded] = useState(false);
  const [jacketIssued, setJacketIssued] = useState(false);
  const [secondHelmetIssued, setSecondHelmetIssued] = useState(false);
  const [bagIssued, setBagIssued] = useState(false);
  const [netIssued, setNetIssued] = useState(false);
  const [cameraMountIssued, setCameraMountIssued] = useState(false);
  const [motoCoverIssued, setMotoCoverIssued] = useState(false);
  const [ebikeChargerIssued, setEbikeChargerIssued] = useState(false);

  // Notes - keep as text (natural for freeform)
  const [otherEquipment, setOtherEquipment] = useState("");
  const [equipmentConditionReturn, setEquipmentConditionReturn] = useState("");
  const [damageNotes, setDamageNotes] = useState("");
  const [notes, setNotes] = useState("");

  // Load existing handoff data
  useEffect(() => {
    if (!isOpen || !rentalId) return;

    setLoading(true);
    getRentalHandoff({
      actorUserId,
      rentalId,
      isPasswordAuth,
    })
      .then((result) => {
        if (result.success && result.data) {
          const phaseData = phase === "handout" ? result.data.handout : result.data.return;
          setHandoff(phaseData);

          // Populate form
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

            // Equipment fields
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
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen, rentalId, phase, actorUserId, isPasswordAuth]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await saveRentalHandoff({
        actorUserId,
        rentalId,
        phase,
        data: {
          // Handout fields
          passport_checked: passportChecked,
          license_checked: licenseChecked,
          deposit_collected: depositCollected,
          helmet_issued: helmetIssued,
          keys_issued: keysIssued,
          instructions_given: instructionsGiven,
          photos_taken: photosTaken,
          // Return fields
          condition_checked: conditionChecked,
          helmet_returned: helmetReturned,
          keys_returned: keysReturned,
          deposit_returned: depositReturned,
          no_damages_confirmed: noDamagesConfirmed,
          // Numeric fields
          odometer_start: odometerStart ? parseInt(odometerStart) : null,
          odometer_end: odometerEnd ? parseInt(odometerEnd) : null,
          fuel_level_start: fuelLevelStart,
          fuel_level_end: fuelLevelEnd,
          battery_level_start: batteryLevelStart,
          battery_level_end: batteryLevelEnd,
          // Notes
          damage_notes: damageNotes || null,
          handout_notes: phase === "handout" ? notes || null : undefined,
          return_notes: phase === "return" ? notes || null : undefined,
          // Equipment fields
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
      const result = await deleteRentalHandoff({
        actorUserId,
        rentalId,
        phase,
        isPasswordAuth,
      });

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl border border-white/10 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isCompleted ? "bg-emerald-400" : "bg-amber-400"}`} />
            <h2 className="text-lg font-bold text-white">{PHASE_LABELS[phase]}</h2>
            <span className="text-sm text-white/60">{vehicleName}</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10 transition-colors">
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {loading ? (
            <div className="text-center py-8 text-white/60">Загрузка...</div>
          ) : (
            <>
              {/* Phase-specific checklist */}
              {phase === "handout" ? (
                <div className="space-y-1.5">
                  <h3 className="text-xs font-medium text-white/50 uppercase tracking-wide">Чеклист</h3>
                  <div className="space-y-1">
                    {[
                      { checked: passportChecked, set: setPassportChecked, label: "Паспорт" },
                      { checked: licenseChecked, set: setLicenseChecked, label: "ВУ" },
                      { checked: depositCollected, set: setDepositCollected, label: "Залог" },
                      { checked: helmetIssued, set: setHelmetIssued, label: "Шлем" },
                      { checked: keysIssued, set: setKeysIssued, label: "Ключи" },
                      { checked: instructionsGiven, set: setInstructionsGiven, label: "Инструкция" },
                      { checked: photosTaken, set: setPhotosTaken, label: "Фото" },
                    ].map((item) => (
                      <label
                        key={item.label}
                        className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                          item.checked ? "bg-emerald-500/20" : "bg-white/5 hover:bg-white/10"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={(e) => item.set(e.target.checked)}
                          className="w-4 h-4 rounded accent-yellow-400"
                        />
                        <span className="text-sm text-white">{item.label}</span>
                        {item.checked && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 ml-auto" />}
                      </label>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <h3 className="text-xs font-medium text-white/50 uppercase tracking-wide">Чеклист</h3>
                  <div className="space-y-1">
                    {[
                      { checked: conditionChecked, set: setConditionChecked, label: "Состояние проверено" },
                      { checked: helmetReturned, set: setHelmetReturned, label: "Шлем возвращён" },
                      { checked: keysReturned, set: setKeysReturned, label: "Ключи возвращены" },
                      { checked: depositReturned, set: setDepositReturned, label: "Залог возвращён" },
                      { checked: noDamagesConfirmed, set: setNoDamagesConfirmed, label: "Без повреждений" },
                    ].map((item) => (
                      <label
                        key={item.label}
                        className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                          item.checked ? "bg-emerald-500/20" : "bg-white/5 hover:bg-white/10"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={(e) => item.set(e.target.checked)}
                          className="w-4 h-4 rounded accent-yellow-400"
                        />
                        <span className="text-sm text-white">{item.label}</span>
                        {item.checked && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 ml-auto" />}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Odometer - keep as number input */}
              <div className="space-y-2">
                <h3 className="text-xs font-medium text-white/50 uppercase tracking-wide">Одометр (км)</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Выдача</label>
                    <input
                      type="number"
                      value={odometerStart}
                      onChange={(e) => setOdometerStart(e.target.value)}
                      placeholder="1250"
                      disabled={phase === "return" && handoff?.odometer_start}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-yellow-400/50 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Возврат</label>
                    <input
                      type="number"
                      value={odometerEnd}
                      onChange={(e) => setOdometerEnd(e.target.value)}
                      placeholder="1450"
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-yellow-400/50 text-sm"
                    />
                  </div>
                </div>
                {odometerStart && odometerEnd && (
                  <div className="flex items-center justify-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 py-1.5 rounded-lg">
                    <span>Пробег:</span>
                    <span className="font-bold">{parseInt(odometerEnd) - parseInt(odometerStart)}</span>
                    <span>км</span>
                  </div>
                )}
              </div>

              {/* Fuel level - quick-select */}
              <div className="space-y-2">
                <h3 className="text-xs font-medium text-white/50 uppercase tracking-wide">Топливо (%)</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-white/50 mb-1.5 block">Выдача</label>
                    <div className="flex flex-wrap gap-1.5">
                      {PERCENT_OPTIONS.map((pct) => (
                        <QuickSelectChip
                          key={`fuel-start-${pct}`}
                          label={`${pct}%`}
                          selected={fuelLevelStart === pct}
                          onClick={() => setFuelLevelStart(pct)}
                        />
                      ))}
                      <button
                        type="button"
                        onClick={() => setFuelLevelStart(null)}
                        className={`px-3 py-1.5 text-xs rounded-full transition-all ${
                          fuelLevelStart === null
                            ? "bg-white/10 text-white/40"
                            : "bg-white/5 text-white/30"
                        }`}
                      >
                        —
                      </button>
                    </div>
                  </div>
                  {phase === "return" && (
                    <div>
                      <label className="text-xs text-white/50 mb-1.5 block">Возврат</label>
                      <div className="flex flex-wrap gap-1.5">
                        {PERCENT_OPTIONS.map((pct) => (
                          <QuickSelectChip
                            key={`fuel-end-${pct}`}
                            label={`${pct}%`}
                            selected={fuelLevelEnd === pct}
                            onClick={() => setFuelLevelEnd(pct)}
                          />
                        ))}
                        <button
                          type="button"
                          onClick={() => setFuelLevelEnd(null)}
                          className={`px-3 py-1.5 text-xs rounded-full transition-all ${
                            fuelLevelEnd === null
                              ? "bg-white/10 text-white/40"
                              : "bg-white/5 text-white/30"
                          }`}
                        >
                          —
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Battery level - quick-select */}
              <div className="space-y-2">
                <h3 className="text-xs font-medium text-white/50 uppercase tracking-wide">Заряд АКБ (%)</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-white/50 mb-1.5 block">Выдача</label>
                    <div className="flex flex-wrap gap-1.5">
                      {PERCENT_OPTIONS.map((pct) => (
                        <QuickSelectChip
                          key={`battery-start-${pct}`}
                          label={`${pct}%`}
                          selected={batteryLevelStart === pct}
                          onClick={() => setBatteryLevelStart(pct)}
                        />
                      ))}
                      <button
                        type="button"
                        onClick={() => setBatteryLevelStart(null)}
                        className={`px-3 py-1.5 text-xs rounded-full transition-all ${
                          batteryLevelStart === null
                            ? "bg-white/10 text-white/40"
                            : "bg-white/5 text-white/30"
                        }`}
                      >
                        —
                      </button>
                    </div>
                  </div>
                  {phase === "return" && (
                    <div>
                      <label className="text-xs text-white/50 mb-1.5 block">Возврат</label>
                      <div className="flex flex-wrap gap-1.5">
                        {PERCENT_OPTIONS.map((pct) => (
                          <QuickSelectChip
                            key={`battery-end-${pct}`}
                            label={`${pct}%`}
                            selected={batteryLevelEnd === pct}
                            onClick={() => setBatteryLevelEnd(pct)}
                          />
                        ))}
                        <button
                          type="button"
                          onClick={() => setBatteryLevelEnd(null)}
                          className={`px-3 py-1.5 text-xs rounded-full transition-all ${
                            batteryLevelEnd === null
                              ? "bg-white/10 text-white/40"
                              : "bg-white/5 text-white/30"
                          }`}
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
                <h3 className="text-xs font-medium text-white/50 uppercase tracking-wide">Комплектация</h3>

                {/* Keys count - quick-select */}
                <div>
                  <label className="text-xs text-white/50 mb-1.5 block">Ключи (шт)</label>
                  <div className="flex gap-2">
                    {[1, 2].map((count) => (
                      <QuickSelectChip
                        key={`keys-${count}`}
                        label={`${count}`}
                        selected={keysCount === count}
                        onClick={() => setKeysCount(count)}
                      />
                    ))}
                  </div>
                </div>

                {/* Equipment checkboxes - already 1-tap */}
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
                      className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                        item.checked ? "bg-yellow-500/20" : "bg-white/5 hover:bg-white/10"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={(e) => item.set(e.target.checked)}
                        className="w-3.5 h-3.5 rounded accent-yellow-400"
                      />
                      <span className="text-xs text-white">{item.label}</span>
                    </label>
                  ))}
                </div>

                {/* Other equipment - text input */}
                <input
                  type="text"
                  value={otherEquipment}
                  onChange={(e) => setOtherEquipment(e.target.value)}
                  placeholder="Другое оборудование..."
                  className="w-full px-3 py-2 text-xs bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-yellow-400/50"
                />

                {/* Equipment condition - quick-select for return */}
                {phase === "return" && (
                  <div className="mt-2">
                    <label className="text-xs text-white/50 mb-1.5 block">Состояние экипировки</label>
                    <div className="flex flex-wrap gap-1.5">
                      {CONDITION_OPTIONS.map((opt) => (
                        <QuickSelectChip
                          key={opt.value}
                          label={opt.label}
                          selected={equipmentConditionReturn === opt.value}
                          onClick={() => setEquipmentConditionReturn(opt.value)}
                        />
                      ))}
                    </div>
                    <textarea
                      value={equipmentConditionReturn}
                      onChange={(e) => setEquipmentConditionReturn(e.target.value)}
                      placeholder="Или введите своё..."
                      rows={1}
                      className="w-full mt-2 px-3 py-2 text-xs bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-yellow-400/50 resize-none"
                    />
                  </div>
                )}
              </div>

              {/* Notes - keep as text */}
              <div className="space-y-2">
                <h3 className="text-xs font-medium text-white/50 uppercase tracking-wide">Заметки</h3>
                <textarea
                  value={damageNotes}
                  onChange={(e) => setDamageNotes(e.target.value)}
                  placeholder="Повреждения..."
                  rows={2}
                  className="w-full px-3 py-2 text-xs bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-yellow-400/50 resize-none"
                />
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Другие заметки..."
                  rows={1}
                  className="w-full px-3 py-2 text-xs bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-yellow-400/50 resize-none"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-white/10">
          <button
            onClick={handleDelete}
            disabled={saving || !handoff}
            className="px-3 py-2 text-sm text-rose-400 hover:text-rose-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Сбросить
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm text-white/70 hover:text-white disabled:opacity-50 transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className={`px-5 py-2 text-sm font-bold rounded-lg transition-all ${
                isCompleted
                  ? "bg-emerald-500 text-white"
                  : "bg-gradient-to-r from-yellow-400 to-orange-500 text-black hover:from-yellow-300 hover:to-orange-400"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {saving ? "..." : isCompleted ? "Готово ✓" : "Сохранить"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
