"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Settings, RefreshCcw, ChevronDown, CheckCircle, AlertCircle, Play, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  syncCrewWbStocks,
  syncCrewOzonStocks,
  syncCrewYmStocks,
  setCrewWbBarcodes,
  getCrewYmCampaigns,
  checkCrewYmToken,
  setCrewYmSku,
} from "@/app/wb/[slug]/actions_sync";
import { getCrewWarehouseItems } from "@/app/wb/[slug]/actions_crud";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface Props {
  slug: string;
}

export function CrewWarehouseSyncButtons({ slug }: Props) {
  const [loading, setLoading] = useState({
    setupWb: false,
    setupYm: false,
    wb: false,
    ozon: false,
    ym: false,
    checkToken: false,
    general: false
  });
  const [itemsLoaded, setItemsLoaded] = useState(false);
  const [needSetupWb, setNeedSetupWb] = useState(false);
  const [hasSyncableWb, setHasSyncableWb] = useState(false);
  const [hasSyncableOzon, setHasSyncableOzon] = useState(false);
  const [hasSyncableYm, setHasSyncableYm] = useState(false);
  const [itemsCount, setItemsCount] = useState(0);

  const [campaigns, setCampaigns] = useState<any[] | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [tokenStatusText, setTokenStatusText] = useState<string | null>(null);

  useEffect(() => {
    const loadItems = async () => {
      setLoading(prev => ({ ...prev, general: true }));
      try {
        const res = await getCrewWarehouseItems(slug);
        if (res.success && res.data) {
          const missingWb = res.data.some((i: any) => !i.specs?.wb_sku);
          const syncableWb = res.data.some((i: any) => !!i.specs?.wb_sku);
          const syncableOzon = res.data.some((i: any) => !!i.specs?.ozon_sku);
          const syncableYm = res.data.some((i: any) => !!i.specs?.ym_sku);
          setNeedSetupWb(missingWb);
          setHasSyncableWb(syncableWb);
          setHasSyncableOzon(syncableOzon);
          setHasSyncableYm(syncableYm);
          setItemsCount(res.data.length);
          setItemsLoaded(true);
          
          toast.success(
            `Загружено ${res.data.length} товаров`,
            {
              description: missingWb 
                ? "Нужна настройка баркодов для некоторых товаров" 
                : "Все товары готовы к синхронизации"
            }
          );
        } else {
          toast.error("Ошибка загрузки товаров", {
            description: res.error || "Попробуйте обновить страницу"
          });
        }
      } catch (err: any) {
        console.error("CrewWarehouseSyncButtons.loadItems error:", err);
        toast.error("Ошибка при загрузке товаров", {
          description: "Подробности в консоли разработчика"
        });
      } finally {
        setLoading(prev => ({ ...prev, general: false }));
      }
    };

    loadItems();
    loadCampaigns();
  }, [slug]);

  const loadCampaigns = async () => {
    setLoading(prev => ({ ...prev, checkToken: true }));
    try {
      const res = await getCrewYmCampaigns(slug);
      if (res.success) {
        setCampaigns(res.campaigns || []);
        const avail = (res.campaigns || []).find((c: any) => c.apiAvailability === "AVAILABLE");
        if (avail) setSelectedCampaign(String(avail.id));
        
        if (res.campaigns?.length) {
          toast.success("Кампании Яндекс.Маркет загружены", {
            description: `Найдено ${res.campaigns.length} кампаний`
          });
        }
      } else {
        toast.error("Ошибка загрузки кампаний", {
          description: res.error || "Проверьте настройки Яндекс.Маркет"
        });
      }
    } catch (err: any) {
      console.error("loadCampaigns error:", err);
      toast.error("Ошибка при получении кампаний", {
        description: "Проверьте подключение к интернету"
      });
    } finally {
      setLoading(prev => ({ ...prev, checkToken: false }));
    }
  };

  const handleCheckYm = async () => {
    setLoading(prev => ({ ...prev, checkToken: true }));
    try {
      const res = await checkCrewYmToken(slug, selectedCampaign || undefined);
      const summary = `Списки: ${res?.listStatus || "?"}, Кампания: ${res?.campStatus || "?"}`;
      setTokenStatusText(summary);
      
      toast.success("Проверка токена выполнена", {
        description: summary
      });
      console.info("checkCrewYmToken result:", res);
    } catch (err: any) {
      console.error("handleCheckYm error:", err);
      toast.error("Ошибка проверки токена", {
        description: "Подробности в консоли разработчика"
      });
    } finally {
      setLoading(prev => ({ ...prev, checkToken: false }));
    }
  };

  const handleSetupWbSku = async () => {
    setLoading(prev => ({ ...prev, setupWb: true }));
    try {
      const res = await setCrewWbBarcodes(slug);
      if (res.success) {
        toast.success("Баркоды настроены", {
          description: `Обновлено ${res.updated} товаров`
        });
        
        const itemsRes = await getCrewWarehouseItems(slug);
        if (itemsRes.success && itemsRes.data) {
          const stillMissing = itemsRes.data.some((i: any) => !i.specs?.wb_sku);
          const syncableWb = itemsRes.data.some((i: any) => !!i.specs?.wb_sku);
          const syncableOzon = itemsRes.data.some((i: any) => !!i.specs?.ozon_sku);
          const syncableYm = itemsRes.data.some((i: any) => !!i.specs?.ym_sku);
          setNeedSetupWb(stillMissing);
          setHasSyncableWb(syncableWb);
          setHasSyncableOzon(syncableOzon);
          setHasSyncableYm(syncableYm);
          setItemsCount(itemsRes.data.length);
        }
      } else {
        toast.error("Ошибка настройки баркодов", {
          description: res.error || "Попробуйте еще раз"
        });
      }
    } catch (err: any) {
      console.error("handleSetupWbSku error:", err);
      toast.error("Ошибка при настройке баркодов", {
        description: "Подробности в консоли разработчика"
      });
    } finally {
      setLoading(prev => ({ ...prev, setupWb: false }));
    }
  };

  const handleSyncWb = async () => {
    setLoading(prev => ({ ...prev, wb: true }));
    try {
      const res = await syncCrewWbStocks(slug);
      if (res.success) {
        toast.success("Wildberries синхронизирован", {
          description: "Стоки успешно обновлены"
        });
      } else {
        toast.error("Ошибка синхронизации Wildberries", {
          description: res.error || "Попробуйте еще раз"
        });
      }
    } catch (err: any) {
      console.error("handleSyncWb error:", err);
      toast.error("Ошибка синхронизации", {
        description: "Подробности в консоли разработчика"
      });
    } finally {
      setLoading(prev => ({ ...prev, wb: false }));
    }
  };

  const handleSyncOzon = async () => {
    setLoading(prev => ({ ...prev, ozon: true }));
    try {
      const res = await syncCrewOzonStocks(slug);
      if (res.success) {
        toast.success("Ozon синхронизирован", {
          description: "Стоки успешно обновлены"
        });
      } else {
        toast.error("Ошибка синхронизации Ozon", {
          description: res.error || "Попробуйте еще раз"
        });
      }
    } catch (err: any) {
      console.error("handleSyncOzon error:", err);
      toast.error("Ошибка синхронизации", {
        description: "Подробности в консоли разработчика"
      });
    } finally {
      setLoading(prev => ({ ...prev, ozon: false }));
    }
  };

  const handleSyncYm = async () => {
    setLoading(prev => ({ ...prev, ym: true }));
    try {
      const res = await syncCrewYmStocks(slug, selectedCampaign || undefined);
      if (res.success) {
        toast.success("Яндекс.Маркет синхронизирован", {
          description: `Отправлено ${res.sent || "?"} товаров • Кампания: ${res.campaignId || "?"}`
        });
      } else {
        toast.error("Ошибка синхронизации Яндекс.Маркет", {
          description: res.error || "Попробуйте еще раз"
        });
      }
    } catch (err: any) {
      console.error("handleSyncYm error:", err);
      toast.error("Ошибка синхронизации", {
        description: "Подробности в консоли разработчика"
      });
    } finally {
      setLoading(prev => ({ ...prev, ym: false }));
    }
  };

  const handleSetYmSku = async () => {
    setLoading(prev => ({ ...prev, ymSku: true }));
    try {
      const res = await setCrewYmSku(slug);
      if (res.success) {
        toast.success("SKU настроены", {
          description: `Обновлено ${res.updated || 0} товаров`
        });
        
        const itemsRes = await getCrewWarehouseItems(slug);
        if (itemsRes.success && itemsRes.data) {
          const syncableYm = itemsRes.data.some((i: any) => !!i.specs?.ym_sku);
          setHasSyncableYm(syncableYm);
          setItemsCount(itemsRes.data.length);
        }
      } else {
        toast.error("Ошибка настройки SKU", {
          description: res.error || "Попробуйте еще раз"
        });
      }
    } catch (err: any) {
      console.error("handleSetYmSku error:", err);
      toast.error("Ошибка при настройке SKU", {
        description: "Подробности в консоли разработчика"
      });
    } finally {
      setLoading(prev => ({ ...prev, ymSku: false }));
    }
  };

  const getStatusBadge = () => {
    if (loading.general) {
      return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-slate-900 dark:text-blue-400 dark:border-blue-800">
        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
        Загрузка...
      </Badge>;
    }
    
    if (needSetupWb) {
      return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-slate-900 dark:text-amber-400 dark:border-amber-800">
        <AlertCircle className="w-3 h-3 mr-1" />
        Требуется настройка
      </Badge>;
    }
    
    return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-slate-900 dark:text-green-400 dark:border-green-800">
      <CheckCircle className="w-3 h-3 mr-1" />
      Готов к работе
    </Badge>;
  };

  return (
    <TooltipProvider>
      <Card className="w-full border-l-4 border-l-blue-500 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Zap className="w-5 h-5 text-blue-500" />
                Синхронизация склада
              </CardTitle>
              <CardDescription>
                Управление синхронизацией стоков между маркетплейсами
              </CardDescription>
            </div>
            {getStatusBadge()}
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Status Overview */}
          {/* FIXED: DARK BG (slate-900) + WHITE TEXT. NO LIGHT SPOTS. */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="flex flex-col p-2 bg-slate-50 rounded-lg dark:bg-slate-900 dark:border dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">Товаров</span>
              <span className="font-semibold text-lg text-gray-900 dark:text-white">{itemsCount}</span>
            </div>
            <div className="flex flex-col p-2 bg-slate-50 rounded-lg dark:bg-slate-900 dark:border dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">Wildberries</span>
              <span className={`font-semibold dark:text-white ${hasSyncableWb ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {hasSyncableWb ? 'Готов' : 'Нет SKU'}
              </span>
            </div>
            <div className="flex flex-col p-2 bg-slate-50 rounded-lg dark:bg-slate-900 dark:border dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">Ozon</span>
              <span className={`font-semibold dark:text-white ${hasSyncableOzon ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {hasSyncableOzon ? 'Готов' : 'Нет SKU'}
              </span>
            </div>
            <div className="flex flex-col p-2 bg-slate-50 rounded-lg dark:bg-slate-900 dark:border dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">Яндекс.Маркет</span>
              <span className={`font-semibold dark:text-white ${hasSyncableYm ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {hasSyncableYm ? 'Готов' : 'Нет SKU'}
              </span>
            </div>
          </div>

          <Separator />

          {/* Quick Actions */}
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
              <AnimatePresence>
                {needSetupWb && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={handleSetupWbSku}
                          disabled={loading.setupWb || loading.general}
                          className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-sm"
                        >
                          {loading.setupWb ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Settings className="w-4 h-4 mr-2" />
                          )}
                          Настроить баркоды
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Автоматически настроить баркоды для товаров без WB SKU</p>
                      </TooltipContent>
                    </Tooltip>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex flex-wrap gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleSyncWb}
                      disabled={loading.wb || !itemsLoaded || !hasSyncableWb}
                      className="bg-gradient-to-r from-[#E313BF] to-[#C010A8] hover:from-[#C010A8] hover:to-[#A00E91] text-white shadow-sm"
                    >
                      {loading.wb ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4 mr-2" />
                      )}
                      Синк WB
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{!hasSyncableWb ? "Нет товаров с WB SKU" : "Синхронизировать стоки Wildberries"}</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleSyncOzon}
                      disabled={loading.ozon || !itemsLoaded || !hasSyncableOzon}
                      className="bg-gradient-to-r from-[#005BFF] to-[#0048CC] hover:from-[#0048CC] hover:to-[#0039A6] text-white shadow-sm"
                    >
                      {loading.ozon ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4 mr-2" />
                      )}
                      Синк Ozon
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{!hasSyncableOzon ? "Нет товаров с Ozon SKU" : "Синхронизировать стоки Ozon"}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* Yandex Market Section */}
            {/* FIXED: DARK BG (slate-900) + LIGHT TEXT (gray-300/white). */}
            <div className="border rounded-lg p-3 bg-gradient-to-r from-amber-50 to-orange-50 space-y-3 dark:bg-slate-900 dark:border dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm flex items-center gap-2 text-gray-900 dark:text-white">
                  <RefreshCcw className="w-4 h-4 text-amber-600 dark:text-black" />
                  Яндекс.Маркет
                </h4>
                <Badge variant="secondary" className="text-xs bg-white dark:bg-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-600">
                  {campaigns?.length || 0} кампаний
                </Badge>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div className="space-y-2">
                  {/* FIXED: EXPLICIT DARK TEXT FOR LABEL */}
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                    Выбор кампании
                  </label>
                  <div className="relative">
                    <select
                      aria-label="Выберите кампанию Яндекс.Маркет"
                      className="w-full text-sm p-2 border rounded-md bg-background pr-8 appearance-none text-gray-900 dark:text-gray-100 dark:border-gray-300 dark:bg-slate-800"
                      value={selectedCampaign || ""}
                      onChange={(e) => setSelectedCampaign(e.target.value || null)}
                      disabled={loading.checkToken || !campaigns}
                    >
                      <option value="">Автовыбор доступной кампании</option>
                      {(campaigns || []).map((c: any) => (
                        <option key={c.id} value={c.id}>
                          {c.domain} — {c.id} {c.apiAvailability ? `(${c.apiAvailability})` : ""}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 dark:text-gray-300 pointer-events-none" />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCheckYm}
                    disabled={loading.checkToken}
                    className="flex-1"
                  >
                    {loading.checkToken ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : null}
                    Проверить токен
                  </Button>

                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleSyncYm}
                    disabled={loading.ym || !itemsLoaded || !hasSyncableYm}
                    className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-sm flex-1"
                  >
                    {loading.ym ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4 mr-2" />
                    )}
                    Синк YM
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSetYmSku}
                  disabled={loading.ymSku}
                  className="text-xs h-8 text-gray-600 dark:text-gray-400"
                >
                  {loading.ymSku ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : null}
                  Настроить YM SKU
                </Button>

                {/* FIXED: WHITE TEXT ON DARK BG */}
                {tokenStatusText && (
                  <div className="text-xs text-gray-700 dark:text-gray-200 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 px-2 py-1 rounded shadow-sm">
                    Статус: <span className="font-semibold">{tokenStatusText}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer Info */}
          <div className="text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-700">
            <p>
              Данные автоматически загружаются из Supabase. Автоматическая синхронизация выполняется ежедневно.
              {needSetupWb && " Настройте баркоды для товаров без WB SKU."}
            </p>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}