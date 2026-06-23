"use client";

import { useState, useEffect } from "react";
import { X, CheckCircle2, AlertCircle } from "lucide-react";
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
  const [fuelLevelStart, setFuelLevelStart] = useState("");
  const [fuelLevelEnd, setFuelLevelEnd] = useState("");
  const [batteryLevelStart, setBatteryLevelStart] = useState("");
  const [batteryLevelEnd, setBatteryLevelEnd] = useState("");
  const [damageNotes, setDamageNotes] = useState("");
  const [notes, setNotes] = useState("");

  // Equipment fields
  const [keysCount, setKeysCount] = useState("1");
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
            setFuelLevelStart(phaseData.fuel_level_start?.toString() || "");
            setFuelLevelEnd(phaseData.fuel_level_end?.toString() || "");
            setBatteryLevelStart(phaseData.battery_level_start?.toString() || "");
            setBatteryLevelEnd(phaseData.battery_level_end?.toString() || "");
            setDamageNotes(phaseData.damage_notes || "");
            setNotes(phase === "handout" ? phaseData.handout_notes || "" : phaseData.return_notes || "");

            // Equipment fields
            setKeysCount(phaseData.keys_count?.toString() || "1");
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
          fuel_level_start: fuelLevelStart ? parseInt(fuelLevelStart) : null,
          fuel_level_end: fuelLevelEnd ? parseInt(fuelLevelEnd) : null,
          battery_level_start: batteryLevelStart ? parseInt(batteryLevelStart) : null,
          battery_level_end: batteryLevelEnd ? parseInt(batteryLevelEnd) : null,
          // Notes
          damage_notes: damageNotes || null,
          handout_notes: phase === "handout" ? notes || null : undefined,
          return_notes: phase === "return" ? notes || null : undefined,
          // Equipment fields
          keys_count: keysCount ? parseInt(keysCount) : 1,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
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
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-white/70">Чеклист выдачи</h3>
                  <label className="flex items-center gap-2 p-2 rounded bg-white/5 hover:bg-white/10 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={passportChecked}
                      onChange={(e) => setPassportChecked(e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-sm text-white">Паспорт проверен</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded bg-white/5 hover:bg-white/10 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={licenseChecked}
                      onChange={(e) => setLicenseChecked(e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-sm text-white">ВУ проверено</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded bg-white/5 hover:bg-white/10 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={depositCollected}
                      onChange={(e) => setDepositCollected(e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-sm text-white">Залог собран</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded bg-white/5 hover:bg-white/10 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={helmetIssued}
                      onChange={(e) => setHelmetIssued(e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-sm text-white">Шлем выдан</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded bg-white/5 hover:bg-white/10 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={keysIssued}
                      onChange={(e) => setKeysIssued(e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-sm text-white">Ключи выданы</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded bg-white/5 hover:bg-white/10 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={instructionsGiven}
                      onChange={(e) => setInstructionsGiven(e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-sm text-white">Инструкции даны</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded bg-white/5 hover:bg-white/10 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={photosTaken}
                      onChange={(e) => setPhotosTaken(e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-sm text-white">Фото (8-10) сделано</span>
                  </label>
                </div>
              ) : (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-white/70">Чеклист возврата</h3>
                  <label className="flex items-center gap-2 p-2 rounded bg-white/5 hover:bg-white/10 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={conditionChecked}
                      onChange={(e) => setConditionChecked(e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-sm text-white">Состояние проверено</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded bg-white/5 hover:bg-white/10 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={helmetReturned}
                      onChange={(e) => setHelmetReturned(e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-sm text-white">Шлем возвращён</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded bg-white/5 hover:bg-white/10 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={keysReturned}
                      onChange={(e) => setKeysReturned(e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-sm text-white">Ключи возвращены</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded bg-white/5 hover:bg-white/10 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={depositReturned}
                      onChange={(e) => setDepositReturned(e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-sm text-white">Залог возвращён</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded bg-white/5 hover:bg-white/10 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={noDamagesConfirmed}
                      onChange={(e) => setNoDamagesConfirmed(e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-sm text-white">Повреждений нет</span>
                  </label>
                </div>
              )}

              {/* Odometer */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-white/70">Показания одометра (км)</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-white/50">Выдача</label>
                    <input
                      type="number"
                      value={odometerStart}
                      onChange={(e) => setOdometerStart(e.target.value)}
                      placeholder="1250"
                      disabled={phase === "return" && handoff?.odometer_start}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded text-white placeholder-white/30 focus:outline-none focus:border-yellow-400/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/50">Возврат</label>
                    <input
                      type="number"
                      value={odometerEnd}
                      onChange={(e) => setOdometerEnd(e.target.value)}
                      placeholder="1450"
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded text-white placeholder-white/30 focus:outline-none focus:border-yellow-400/50"
                    />
                  </div>
                </div>
                {odometerStart && odometerEnd && (
                  <div className="text-xs text-emerald-400">
                    Пробег: {parseInt(odometerEnd) - parseInt(odometerStart)} км
                  </div>
                )}
              </div>

              {/* Fuel/Charge levels */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-white/70">Топливо / Заряд (%)</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-white/50">Выдача</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={fuelLevelStart}
                      onChange={(e) => setFuelLevelStart(e.target.value)}
                      placeholder="100"
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded text-white placeholder-white/30 focus:outline-none focus:border-yellow-400/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/50">Возврат</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={fuelLevelEnd}
                      onChange={(e) => setFuelLevelEnd(e.target.value)}
                      placeholder="80"
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded text-white placeholder-white/30 focus:outline-none focus:border-yellow-400/50"
                    />
                  </div>
                </div>
              </div>

              {/* Battery levels (for EV) */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-white/70">Заряд АКБ электробайка (%)</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-white/50">Выдача</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={batteryLevelStart}
                      onChange={(e) => setBatteryLevelStart(e.target.value)}
                      placeholder="100"
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded text-white placeholder-white/30 focus:outline-none focus:border-yellow-400/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/50">Возврат</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={batteryLevelEnd}
                      onChange={(e) => setBatteryLevelEnd(e.target.value)}
                      placeholder="60"
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded text-white placeholder-white/30 focus:outline-none focus:border-yellow-400/50"
                    />
                  </div>
                </div>
              </div>

              {/* Equipment / Completeness (from Appendix 1) */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-white/70">Комплектация и экипировка</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-white/50">Ключи (шт)</label>
                    <input
                      type="number"
                      min="0"
                      value={keysCount}
                      onChange={(e) => setKeysCount(e.target.value)}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded text-white placeholder-white/30 focus:outline-none focus:border-yellow-400/50"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <label className="flex items-center gap-2 p-2 rounded bg-white/5 hover:bg-white/10 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={chargerIncluded}
                      onChange={(e) => setChargerIncluded(e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-xs text-white">Зарядное устройство</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded bg-white/5 hover:bg-white/10 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={lockCableIncluded}
                      onChange={(e) => setLockCableIncluded(e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-xs text-white">Замок/трос</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded bg-white/5 hover:bg-white/10 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={jacketIssued}
                      onChange={(e) => setJacketIssued(e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-xs text-white">Куртка/черепаха</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded bg-white/5 hover:bg-white/10 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={secondHelmetIssued}
                      onChange={(e) => setSecondHelmetIssued(e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-xs text-white">Второй шлем</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded bg-white/5 hover:bg-white/10 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bagIssued}
                      onChange={(e) => setBagIssued(e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-xs text-white">Сумка/рюкзак</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded bg-white/5 hover:bg-white/10 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={netIssued}
                      onChange={(e) => setNetIssued(e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-xs text-white">Сетка</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded bg-white/5 hover:bg-white/10 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cameraMountIssued}
                      onChange={(e) => setCameraMountIssued(e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-xs text-white">Крепление для камеры</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded bg-white/5 hover:bg-white/10 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={motoCoverIssued}
                      onChange={(e) => setMotoCoverIssued(e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-xs text-white">Чехол для мотоцикла</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded bg-white/5 hover:bg-white/10 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ebikeChargerIssued}
                      onChange={(e) => setEbikeChargerIssued(e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-xs text-white">Зарядка для электробайка</span>
                  </label>
                </div>
                <div className="mt-2">
                  <input
                    type="text"
                    value={otherEquipment}
                    onChange={(e) => setOtherEquipment(e.target.value)}
                    placeholder="Другое оборудование..."
                    className="w-full px-3 py-2 text-xs bg-white/10 border border-white/20 rounded text-white placeholder-white/30 focus:outline-none focus:border-yellow-400/50"
                  />
                </div>
                {phase === "return" && (
                  <div className="mt-2">
                    <label className="text-xs text-white/50">Состояние экипировки при возврате</label>
                    <textarea
                      value={equipmentConditionReturn}
                      onChange={(e) => setEquipmentConditionReturn(e.target.value)}
                      placeholder="Описание состояния экипировки..."
                      rows={2}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded text-white placeholder-white/30 focus:outline-none focus:border-yellow-400/50 resize-none text-xs"
                    />
                  </div>
                )}
              </div>

              {/* Damage notes */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-white/70">Заметки о повреждениях</h3>
                <textarea
                  value={damageNotes}
                  onChange={(e) => setDamageNotes(e.target.value)}
                  placeholder="Царапина на пластике справа..."
                  rows={3}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded text-white placeholder-white/30 focus:outline-none focus:border-yellow-400/50 resize-none"
                />
              </div>

              {/* General notes */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-white/70">Доп. заметки</h3>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Любые другие заметки..."
                  rows={2}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded text-white placeholder-white/30 focus:outline-none focus:border-yellow-400/50 resize-none"
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
            className="px-4 py-2 text-sm text-rose-400 hover:text-rose-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Сбросить
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm text-white/70 hover:text-white disabled:opacity-50"
            >
              Отмена
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-bold rounded-lg hover:from-yellow-300 hover:to-orange-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {saving ? "Сохранение..." : isCompleted ? "Завершено ✓" : "Сохранить"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
