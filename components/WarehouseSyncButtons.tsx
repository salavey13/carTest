"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Settings, RefreshCcw, Check, X, Clock, Copy } from "lucide-react";
import { motion } from "framer-motion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  syncWbStocks,
  syncOzonStocks,
  syncYmStocks,
  setWbBarcodes,
  setYmSku,
  getWarehouseItems,
  checkYmToken, // <- серверная проверка token/campaign
} from "@/app/wb/actions";

type RunStatus = {
  status: "idle" | "running" | "success" | "error";
  updatedAt?: string; // ISO
  message?: string;
  sent?: number;
  failed?: number;
};

const Pill: React.FC<{ state: RunStatus }> = ({ state }) => {
  const { status, updatedAt, sent, failed } = state;
  const timeLabel = updatedAt ? new Date(updatedAt).toLocaleString() : null;
  const base = "inline-flex items-center text-xs rounded-full px-2 py-0.5 gap-1 select-none";
  if (status === "running") {
    return (
      <span className={`${base} bg-slate-100 text-slate-800`} aria-live="polite">
        <Loader2 className="h-3 w-3 animate-spin" /> Running
      </span>
    );
  }
  if (status === "success") {
    return (
      <span className={`${base} bg-green-100 text-green-800`} title={timeLabel}>
        <Check className="h-3 w-3" /> OK {sent ? `· ${sent}` : ""} {failed ? `· ✖${failed}` : ""}
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className={`${base} bg-rose-100 text-rose-800`} title={timeLabel}>
        <X className="h-3 w-3" /> Err {failed ? `· ✖${failed}` : ""}
      </span>
    );
  }
  return (
    <span className={`${base} bg-yellow-50 text-yellow-800`} title={timeLabel}>
      <Clock className="h-3 w-3" /> {timeLabel ? timeLabel.split(",")[0] : "idle"}
    </span>
  );
};

export function WarehouseSyncButtons() {
  // per-button run states
  const [wbState, setWbState] = useState<RunStatus>({ status: "idle" });
  const [ozonState, setOzonState] = useState<RunStatus>({ status: "idle" });
  const [ymState, setYmState] = useState<RunStatus>({ status: "idle" });

  // setup buttons states
  const [setupWbLoading, setSetupWbLoading] = useState(false);
  const [setupYmLoading, setSetupYmLoading] = useState(false);

  // items loaded & syncable flags
  const [itemsLoaded, setItemsLoaded] = useState(false);
  const [hasWb, setHasWb] = useState(false);
  const [hasOzon, setHasOzon] = useState(false);
  const [hasYm, setHasYm] = useState(false);
  const [needWbSetup, setNeedWbSetup] = useState(false);

  // YM token check state
  const [ymCheckLoading, setYmCheckLoading] = useState(false);
  const [ymCheckResult, setYmCheckResult] = useState<{
    listStatus?: number;
    listJson?: any;
    campStatus?: number;
    campJson?: any;
    rawList?: string;
    rawCamp?: string;
  } | null>(null);
  const [showYmCheck, setShowYmCheck] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await getWarehouseItems();
        if (res.success && res.data) {
          const missingBarcodes = res.data.some((i: any) => !i.specs?.wb_sku);
          const syncableWb = res.data.some((i: any) => !!i.specs?.wb_sku);
          const syncableOzon = res.data.some((i: any) => !!i.specs?.ozon_sku);
          const syncableYm = res.data.some((i: any) => !!i.specs?.ym_sku);
          setNeedWbSetup(missingBarcodes);
          setHasWb(syncableWb);
          setHasOzon(syncableOzon);
          setHasYm(syncableYm);
          setItemsLoaded(true);
        } else {
          toast.error(res.error || "Ошибка загрузки items");
        }
      } catch (e) {
        console.error("loadItems error", e);
        toast.error("Ошибка при загрузке items (см. логи)");
      }
    })();
  }, []);

  // helpers: update run state with timestamp
  const markSuccess = (setter: React.Dispatch<React.SetStateAction<RunStatus>>, payload?: Partial<RunStatus>) =>
    setter({ status: "success", updatedAt: new Date().toISOString(), ...payload });
  const markError = (setter: React.Dispatch<React.SetStateAction<RunStatus>>, message?: string, payload?: Partial<RunStatus>) =>
    setter({ status: "error", updatedAt: new Date().toISOString(), message, ...payload });
  const markRunning = (setter: React.Dispatch<React.SetStateAction<RunStatus>>) => setter({ status: "running", updatedAt: new Date().toISOString() });

  // Handlers
  const handleSetupWb = async () => {
    setSetupWbLoading(true);
    setWbState({ status: "running" });
    try {
      const res = await setWbBarcodes();
      if (res.success) {
        toast.success(`WB setup: обновлено ${res.updated ?? 0}`);
        const itemsRes = await getWarehouseItems();
        if (itemsRes.success && itemsRes.data) {
          setNeedWbSetup(itemsRes.data.some((i: any) => !i.specs?.wb_sku));
          setHasWb(itemsRes.data.some((i: any) => !!i.specs?.wb_sku));
        }
        markSuccess(setWbState, {});
      } else {
        toast.error(res.error || "Ошибка setup WB");
        markError(setWbState, res.error);
      }
    } catch (e: any) {
      console.error("handleSetupWb", e);
      toast.error("Ошибка setup WB (см. логи)");
      markError(setWbState, e?.message);
    } finally {
      setSetupWbLoading(false);
    }
  };

  const handleSetupYm = async () => {
    setSetupYmLoading(true);
    setYmState({ status: "running" });
    try {
      const res = await setYmSku();
      if (res.success) {
        toast.success(`YM setup: обновлено ${res.updated ?? 0}`);
        const itemsRes = await getWarehouseItems();
        if (itemsRes.success && itemsRes.data) {
          setHasYm(itemsRes.data.some((i: any) => !!i.specs?.ym_sku));
        }
        markSuccess(setYmState, {});
      } else {
        toast.error(res.error || "Ошибка setup YM");
        markError(setYmState, res.error);
      }
    } catch (e: any) {
      console.error("handleSetupYm", e);
      toast.error("Ошибка setup YM (см. логи)");
      markError(setYmState, e?.message);
    } finally {
      setSetupYmLoading(false);
    }
  };

  const handleSyncWb = async () => {
    markRunning(setWbState);
    try {
      const res = await syncWbStocks();
      if (res.success) {
        toast.success("WB синхронизировано!");
        markSuccess(setWbState);
      } else {
        toast.error(res.error || "Ошибка синка WB");
        markError(setWbState, res.error);
      }
    } catch (e: any) {
      console.error("syncWb error", e);
      toast.error("Ошибка синка WB (см. логи)");
      markError(setWbState, e?.message);
    }
  };

  const handleSyncOzon = async () => {
    markRunning(setOzonState);
    try {
      const res = await syncOzonStocks();
      if (res.success) {
        toast.success("Ozon синхронизировано!");
        markSuccess(setOzonState);
      } else {
        toast.error(res.error || "Ошибка синка Ozon");
        markError(setOzonState, res.error);
      }
    } catch (e: any) {
      console.error("syncOzon error", e);
      toast.error("Ошибка синка Ozon (см. логи)");
      markError(setOzonState, e?.message);
    }
  };

  const handleSyncYm = async () => {
    markRunning(setYmState);
    try {
      const res: any = await syncYmStocks();
      if (res.success) {
        toast.success(`YM синхронизировано! Отправлено: ${res.sent ?? 0}`);
        markSuccess(setYmState, { sent: res.sent, failed: res.failed });
      } else {
        toast.error(res.error || `YM sync failed: ${res.failed ?? 0}`);
        markError(setYmState, res.error, { sent: res.sent, failed: res.failed });
      }
    } catch (e: any) {
      console.error("syncYm error", e);
      toast.error("Ошибка синка YM (см. логи)");
      markError(setYmState, e?.message);
    }
  };

  // NEW: check YM token/campaign
  const handleCheckYmToken = async () => {
    setYmCheckLoading(true);
    setShowYmCheck(true);
    setYmCheckResult(null);
    try {
      const res: any = await checkYmToken(); // server action (no args, uses env)
      // res: { listStatus, listText, campStatus, campText }
      const parsedList = tryParseJsonSafe(res.listText);
      const parsedCamp = tryParseJsonSafe(res.campText);
      setYmCheckResult({
        listStatus: res.listStatus,
        listJson: parsedList.parsed,
        campStatus: res.campStatus,
        campJson: parsedCamp.parsed,
        rawList: parsedList.raw,
        rawCamp: parsedCamp.raw,
      });

      // Update YM pill based on campaign check status
      if (res.campStatus === 200) {
        markSuccess(setYmState);
      } else if (res.campStatus === 403) {
        markError(setYmState, "Forbidden: token lacks access to campaign");
      } else {
        markError(setYmState, `Campaign check returned ${res.campStatus}`);
      }
    } catch (e: any) {
      console.error("handleCheckYmToken", e);
      setYmCheckResult({
        listStatus: (e?.status as number) || undefined,
        listJson: undefined,
        campStatus: (e?.status as number) || undefined,
        campJson: undefined,
        rawList: String(e?.message || e),
        rawCamp: "",
      });
      markError(setYmState, String(e?.message || "check Ym token failed"));
      toast.error("Ошибка проверки YM токена (см. логи)");
    } finally {
      setYmCheckLoading(false);
    }
  };

  const tryParseJsonSafe = (txt: any) => {
    if (!txt || typeof txt !== "string") return { parsed: null, raw: String(txt || "") };
    try {
      return { parsed: JSON.parse(txt), raw: txt };
    } catch {
      return { parsed: null, raw: txt };
    }
  };

  const copyToClipboard = async (txt?: string) => {
    if (!txt) return;
    try {
      await navigator.clipboard.writeText(txt);
      toast.success("Скопировано в буфер");
    } catch {
      toast.error("Не удалось скопировать");
    }
  };

  // visuals
  const btnBase = "flex items-center gap-2 px-3 py-2 rounded-2xl shadow-sm text-sm";
  const transformPulse = { whileTap: { scale: 0.98 }, whileHover: { scale: 1.02 } };

  return (
    <TooltipProvider>
      <div className="flex flex-col md:flex-row md:items-center md:gap-4 gap-3 w-full">
        <div className="flex flex-wrap gap-2 items-center">
          {/* Setup WB */}
          {needWbSetup && (
            <Tooltip>
              <TooltipTrigger asChild>
                <motion.button
                  {...transformPulse}
                  onClick={handleSetupWb}
                  disabled={setupWbLoading || wbState.status === "running"}
                  className={`${btnBase} bg-gradient-to-r from-[#E313BF] to-[#C010A8] text-white`}
                  aria-label="Setup WB"
                >
                  {setupWbLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings className="h-4 w-4" />}
                  <span className="font-medium">Setup WB</span>
                </motion.button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Подтянуть barcodes с WB и проставить в локальных items.</p>
              </TooltipContent>
            </Tooltip>
          )}

          {/* Setup YM */}
          <Tooltip>
            <TooltipTrigger asChild>
              <motion.button
                {...transformPulse}
                onClick={handleSetupYm}
                disabled={setupYmLoading || ymState.status === "running"}
                className={`${btnBase} bg-gradient-to-r from-[#FFD54F] to-[#FFB300] text-black`}
                aria-label="Setup YM"
              >
                {setupYmLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings className="h-4 w-4" />}
                <span className="font-medium">Setup YM</span>
              </motion.button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Проставляет ym_sku = id и ym_warehouse_id = 7252771 для тех, у кого пусто.</p>
            </TooltipContent>
          </Tooltip>

          {/* Check YM Token */}
          <Tooltip>
            <TooltipTrigger asChild>
              <motion.button
                {...transformPulse}
                onClick={handleCheckYmToken}
                disabled={ymCheckLoading}
                className={`${btnBase} bg-gradient-to-r from-[#00C853] to-[#009624] text-white`}
                aria-label="Check YM Token"
              >
                {ymCheckLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                <span className="font-medium">Check YM Token</span>
              </motion.button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Проверяет доступность Api-Key и видит ли он кампанию (7252771).</p>
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {/* WB Sync */}
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <motion.button
                  {...transformPulse}
                  onClick={handleSyncWb}
                  disabled={wbState.status === "running" || !itemsLoaded || !hasWb}
                  className={`${btnBase} bg-gradient-to-r from-[#E313BF] to-[#C010A8] text-white`}
                  aria-label="Sync WB"
                >
                  {wbState.status === "running" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                  <span className="font-semibold">{wbState.status === "running" ? "Syncing WB…" : "WB"}</span>
                </motion.button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{!hasWb ? "Нет items с wb_sku" : "Синхронизировать остатки в Wildberries"}</p>
              </TooltipContent>
            </Tooltip>
            <Pill state={wbState} />
          </div>

          {/* Ozon Sync */}
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <motion.button
                  {...transformPulse}
                  onClick={handleSyncOzon}
                  disabled={ozonState.status === "running" || !itemsLoaded || !hasOzon}
                  className={`${btnBase} bg-gradient-to-r from-[#005BFF] to-[#0048CC] text-white`}
                  aria-label="Sync Ozon"
                >
                  {ozonState.status === "running" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                  <span className="font-semibold">{ozonState.status === "running" ? "Syncing Ozon…" : "Ozon"}</span>
                </motion.button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{!hasOzon ? "Нет items с ozon_sku" : "Синхронизировать остатки в Ozon"}</p>
              </TooltipContent>
            </Tooltip>
            <Pill state={ozonState} />
          </div>

          {/* YM Sync */}
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <motion.button
                  {...transformPulse}
                  onClick={handleSyncYm}
                  disabled={ymState.status === "running" || !itemsLoaded || !hasYm}
                  className={`${btnBase} bg-gradient-to-r from-[#FFC107] to-[#FF9800] text-black`}
                  aria-label="Sync YM"
                >
                  {ymState.status === "running" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                  <span className="font-semibold">{ymState.status === "running" ? "Syncing YM…" : "YM"}</span>
                </motion.button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{!hasYm ? "Нет items с ym_sku" : "Синхронизировать остатки в Yandex.Market"}</p>
              </TooltipContent>
            </Tooltip>
            <Pill state={ymState} />
          </div>
        </div>

        {/* YM Check panel */}
        {showYmCheck && (
          <div className="mt-3 w-full bg-white border rounded-lg p-3 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <strong>YM token check</strong>
                  <span className="text-xs text-muted-foreground">({ymCheckResult?.listStatus ?? "—"} / {ymCheckResult?.campStatus ?? "—"})</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {ymCheckResult?.campStatus === 200 ? (
                    <span className="text-green-700">Кампания доступна</span>
                  ) : ymCheckResult?.campStatus === 403 ? (
                    <span className="text-rose-700">Доступ к кампании запрещён (403)</span>
                  ) : (
                    <span className="text-yellow-700">Проверка не выполнялась или вернулась ошибка</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  className="inline-flex items-center gap-2 px-2 py-1 text-xs"
                  onClick={() => {
                    setShowYmCheck(false);
                    setYmCheckResult(null);
                  }}
                >
                  Закрыть
                </Button>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Список кампаний (GET /v2/campaigns)</div>
                  <div className="flex items-center gap-2">
                    <button
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-slate-50"
                      onClick={() => copyToClipboard(ymCheckResult?.rawList)}
                    >
                      <Copy className="h-3 w-3" /> Copy
                    </button>
                  </div>
                </div>
                <pre className="mt-2 max-h-44 overflow-auto text-[12px] bg-slate-50 p-2 rounded">
                  {ymCheckResult?.listJson ? JSON.stringify(ymCheckResult.listJson, null, 2) : (ymCheckResult?.rawList ?? "—")}
                </pre>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Кампания {process.env.NEXT_PUBLIC_YM_WAREHOUSE_ID || "7252771"} (GET /v2/campaigns/:id)</div>
                  <div className="flex items-center gap-2">
                    <button
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-slate-50"
                      onClick={() => copyToClipboard(ymCheckResult?.rawCamp)}
                    >
                      <Copy className="h-3 w-3" /> Copy
                    </button>
                  </div>
                </div>
                <pre className="mt-2 max-h-44 overflow-auto text-[12px] bg-slate-50 p-2 rounded">
                  {ymCheckResult?.campJson ? JSON.stringify(ymCheckResult.campJson, null, 2) : (ymCheckResult?.rawCamp ?? "—")}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* Footer hint */}
        <div className="ml-auto text-xs text-muted-foreground w-full md:w-auto">
          <div className="italic text-[12px]">Вайб: кликай аккуратно. Статусы показывают последний запуск.</div>
        </div>
      </div>
    </TooltipProvider>
  );
}