"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { fetchWbStocks, fetchOzonStocks, getWarehouseItems, updateItemLocationQty, syncWbStocks, syncOzonStocks } from "@/app/wb/actions";
import { WarehouseSyncButtons } from "@/components/WarehouseSyncButtons";

export default function WarehouseTestPage() {
  const [wbStocks, setWbStocks] = useState<{ sku: string; amount: number }[]>([]);
  const [ozonStocks, setOzonStocks] = useState<{ sku: string; amount: number }[]>([]);
  const [localItems, setLocalItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleFetchWb = async () => {
    setLoading(true);
    const res = await fetchWbStocks();
    setLoading(false);
    if (res.success && res.data) {
      setWbStocks(res.data);
      toast.success(`Загружено ${res.data.length} товаров из WB`);
    } else {
      toast.error(res.error || "Ошибка загрузки стоков WB");
    }
  };

  const handleFetchOzon = async () => {
    setLoading(true);
    const res = await fetchOzonStocks();
    setLoading(false);
    if (res.success && res.data) {
      setOzonStocks(res.data);
      toast.success(`Загружено ${res.data.length} товаров из Ozon`);
    } else {
      toast.error(res.error || "Ошибка загрузки стоков Ozon");
    }
  };

  const handleFetchLocal = async () => {
    setLoading(true);
    const res = await getWarehouseItems();
    setLoading(false);
    if (res.success && res.data) {
      setLocalItems(res.data.map(i => ({
        id: i.id,
        amount: i.specs?.warehouse_locations?.reduce((sum: number, loc: any) => sum + loc.quantity, 0) || 0
      })));
      toast.success(`Загружено ${res.data.length} локальных товаров`);
    } else {
      toast.error(res.error || "Ошибка загрузки локальных товаров");
    }
  };

  const handleUpdate = async (itemId: string, delta: number, voxelId: string = "A1") => {
    const res = await updateItemLocationQty(itemId, voxelId, delta);
    if (res.success) {
      toast.success(`Обновлено ${itemId} на ${delta}`);
      handleFetchLocal();  // Refresh local
    } else {
      toast.error(res.error);
    }
  };

  const handleSync = async (platform: 'wb' | 'ozon') => {
    const res = platform === 'wb' ? await syncWbStocks() : await syncOzonStocks();
    if (res.success) {
      toast.success(`${platform.toUpperCase()} синхронизировано!`);
      // Refresh all
      handleFetchWb();
      handleFetchOzon();
      handleFetchLocal();
    } else {
      toast.error(res.error);
    }
  };

  // Compare lists
  const comparisons = localItems.map(local => {
    const wb = wbStocks.find(w => w.sku === local.id);
    const ozon = ozonStocks.find(o => o.sku === local.id);
    const mismatch = !wb || !ozon || local.amount !== wb?.amount || local.amount !== ozon?.amount;
    return { id: local.id, local: local.amount, wb: wb?.amount || 'N/A', ozon: ozon?.amount || 'N/A', mismatch };
  }).filter(c => c.mismatch);  // Show only mismatches

  return (
    <div className="container mx-auto p-2 text-sm">
      <h1 className="text-lg font-bold mb-2">Тестовая страница склада</h1>
      
      <div className="flex flex-wrap gap-2 mb-2">
        <Button className="text-xs py-1 px-2" onClick={handleFetchWb} disabled={loading}>Загрузить WB</Button>
        <Button className="text-xs py-1 px-2" onClick={handleFetchOzon} disabled={loading}>Загрузить Ozon</Button>
        <Button className="text-xs py-1 px-2" onClick={handleFetchLocal} disabled={loading}>Загрузить локальные</Button>
      </div>

      <WarehouseSyncButtons />

      <Card className="mb-2 text-xs">
        <CardHeader className="p-2">
          <CardTitle className="text-sm">Стоки WB</CardTitle>
        </CardHeader>
        <CardContent className="p-2 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">SKU</TableHead>
                <TableHead className="text-xs">Кол-во</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {wbStocks.map((stock) => (
                <TableRow key={stock.sku}>
                  <TableCell className="text-xs">{stock.sku}</TableCell>
                  <TableCell className="text-xs">{stock.amount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mb-2 text-xs">
        <CardHeader className="p-2">
          <CardTitle className="text-sm">Стоки Ozon</CardTitle>
        </CardHeader>
        <CardContent className="p-2 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">SKU</TableHead>
                <TableHead className="text-xs">Кол-во</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ozonStocks.map((stock) => (
                <TableRow key={stock.sku}>
                  <TableCell className="text-xs">{stock.sku}</TableCell>
                  <TableCell className="text-xs">{stock.amount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mb-2 text-xs">
        <CardHeader className="p-2">
          <CardTitle className="text-sm">Локальные товары (Supabase)</CardTitle>
        </CardHeader>
        <CardContent className="p-2 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">ID</TableHead>
                <TableHead className="text-xs">Кол-во</TableHead>
                <TableHead className="text-xs">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {localItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="text-xs">{item.id}</TableCell>
                  <TableCell className="text-xs">{item.amount}</TableCell>
                  <TableCell className="flex gap-1">
                    <Button className="text-xs py-0 px-1 bg-gradient-to-r from-green-500 to-green-700" onClick={() => handleUpdate(item.id, 1)}>+1</Button>
                    <Button className="text-xs py-0 px-1 bg-gradient-to-r from-red-500 to-red-700" onClick={() => handleUpdate(item.id, -1)}>-1</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="text-xs">
        <CardHeader className="p-2">
          <CardTitle className="text-sm">Сравнение (расхождения)</CardTitle>
        </CardHeader>
        <CardContent className="p-2 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">ID</TableHead>
                <TableHead className="text-xs">Локал</TableHead>
                <TableHead className="text-xs">WB</TableHead>
                <TableHead className="text-xs">Ozon</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {comparisons.map((comp) => (
                <TableRow key={comp.id} className={comp.mismatch ? "bg-red-100" : ""}>
                  <TableCell className="text-xs">{comp.id}</TableCell>
                  <TableCell className="text-xs">{comp.local}</TableCell>
                  <TableCell className="text-xs">{comp.wb}</TableCell>
                  <TableCell className="text-xs">{comp.ozon}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}