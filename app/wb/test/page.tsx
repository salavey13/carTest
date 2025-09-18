"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  fetchWbStocks,
  fetchOzonStocks,
  getWarehouseItems,
  updateItemLocationQty,
  syncWbStocks,
  syncOzonStocks,
  getWbParentCategories,
  getWbSubjects,
  getWbSubjectCharcs,
  getWbColors,
  getWbGenders,
  getWbCountries,
  getWbSeasons,
  getWbVat,
  getWbTnved,
  generateWbBarcodes,
  createWbProductCards,
  getWbProductCardsList,
} from "@/app/wb/actions";
import { WarehouseSyncButtons } from "@/components/WarehouseSyncButtons";

type Stock = { sku: string; amount: number };
type LocalItem = { id: string; amount: number };
type ApiRes = any;

export default function WarehouseTestPage(): JSX.Element {
  const [wbStocks, setWbStocks] = useState<Stock[]>([]);
  const [ozonStocks, setOzonStocks] = useState<Stock[]>([]);
  const [localItems, setLocalItems] = useState<LocalItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // WB API test states
  const [wbApiResult, setWbApiResult] = useState<ApiRes | null>(null);
  const [subjectId, setSubjectId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [parentID, setParentID] = useState<string>("");
  const [barcodeCount, setBarcodeCount] = useState<number>(1);
  const [productCards, setProductCards] = useState<string>("[]");

  const handleFetchWb = async () => {
    setLoading(true);
    try {
      const res = await fetchWbStocks();
      if (res?.success && res.data) {
        setWbStocks(res.data);
        toast.success(`Загружено ${res.data.length} товаров из WB`);
      } else {
        toast.error(res?.error ?? "Ошибка загрузки стоков WB");
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Ошибка запроса WB");
    } finally {
      setLoading(false);
    }
  };

  const handleFetchOzon = async () => {
    setLoading(true);
    try {
      const res = await fetchOzonStocks();
      if (res?.success && res.data) {
        setOzonStocks(res.data);
        toast.success(`Загружено ${res.data.length} товаров из Ozon`);
      } else {
        toast.error(res?.error ?? "Ошибка загрузки стоков Ozon");
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Ошибка запроса Ozon");
    } finally {
      setLoading(false);
    }
  };

  const handleFetchLocal = async () => {
    setLoading(true);
    try {
      const res = await getWarehouseItems();
      if (res?.success && Array.isArray(res.data)) {
        const items = res.data.map((i: any) => ({
          id: i.id,
          amount:
            i.specs?.warehouse_locations?.reduce(
              (sum: number, loc: any) => sum + (loc?.quantity ?? 0),
              0
            ) ?? 0,
        }));
        setLocalItems(items);
        toast.success(`Загружено ${res.data.length} локальных товаров`);
      } else {
        toast.error(res?.error ?? "Ошибка загрузки локальных товаров");
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Ошибка запроса локальных товаров");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (
    itemId: string,
    delta: number,
    voxelId: string = "A1"
  ) => {
    try {
      const res = await updateItemLocationQty(itemId, voxelId, delta);
      if (res?.success) {
        toast.success(`Обновлено ${itemId} на ${delta}`);
        await handleFetchLocal();
      } else {
        toast.error(res?.error ?? "Ошибка обновления");
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Ошибка обновления");
    }
  };

  const handleSync = async (platform: "wb" | "ozon") => {
    try {
      const res = platform === "wb" ? await syncWbStocks() : await syncOzonStocks();
      if (res?.success) {
        toast.success(`${platform.toUpperCase()} синхронизировано!`);
        // refresh
        await Promise.all([handleFetchWb(), handleFetchOzon(), handleFetchLocal()]);
      } else {
        toast.error(res?.error ?? "Ошибка синхронизации");
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Ошибка синхронизации");
    }
  };

  // WB API handlers (explicit if/else for toast)
  const handleGetParentCategories = async () => {
    const res = await getWbParentCategories();
    setWbApiResult(res);
    if (res?.success) toast.success("Категории получены");
    else toast.error(res?.error ?? "Ошибка получения категорий");
  };

  const handleGetSubjects = async () => {
    const res = await getWbSubjects(
      "ru",
      searchQuery,
      30,
      0,
      parentID ? parseInt(parentID, 10) : undefined
    );
    setWbApiResult(res);
    if (res?.success) toast.success("Субъекты получены");
    else toast.error(res?.error ?? "Ошибка получения subjects");
  };

  const handleGetSubjectCharcs = async () => {
    if (!subjectId) {
      toast.error("Введите subjectId");
      return;
    }
    const res = await getWbSubjectCharcs(parseInt(subjectId, 10));
    setWbApiResult(res);
    if (res?.success) toast.success("Характеристики получены");
    else toast.error(res?.error ?? "Ошибка получения характеристик");
  };

  const handleGetColors = async () => {
    const res = await getWbColors();
    setWbApiResult(res);
    if (res?.success) toast.success("Цвета получены");
    else toast.error(res?.error ?? "Ошибка получения цветов");
  };

  const handleGetGenders = async () => {
    const res = await getWbGenders();
    setWbApiResult(res);
    if (res?.success) toast.success("Пoлы получены");
    else toast.error(res?.error ?? "Ошибка получения полов");
  };

  const handleGetCountries = async () => {
    const res = await getWbCountries();
    setWbApiResult(res);
    if (res?.success) toast.success("Страны получены");
    else toast.error(res?.error ?? "Ошибка получения стран");
  };

  const handleGetSeasons = async () => {
    const res = await getWbSeasons();
    setWbApiResult(res);
    if (res?.success) toast.success("Сезоны получены");
    else toast.error(res?.error ?? "Ошибка получения сезонов");
  };

  const handleGetVat = async () => {
    const res = await getWbVat();
    setWbApiResult(res);
    if (res?.success) toast.success("НДС получен");
    else toast.error(res?.error ?? "Ошибка получения НДС");
  };

  const handleGetTnved = async () => {
    if (!subjectId) {
      toast.error("Введите subjectID");
      return;
    }
    const res = await getWbTnved(parseInt(subjectId, 10), searchQuery);
    setWbApiResult(res);
    if (res?.success) toast.success("ТН ВЭД получены");
    else toast.error(res?.error ?? "Ошибка получения ТН ВЭД");
  };

  const handleGenerateBarcodes = async () => {
    const res = await generateWbBarcodes(barcodeCount);
    setWbApiResult(res);
    if (res?.success) toast.success("Баркоды сгенерированы");
    else toast.error(res?.error ?? "Ошибка генерации баркодов");
  };

  const handleCreateProductCards = async () => {
    try {
      const cards = JSON.parse(productCards);
      const res = await createWbProductCards(cards);
      setWbApiResult(res);
      if (res?.success) toast.success("Карточки созданы");
      else toast.error(res?.error ?? "Ошибка создания карточек");
    } catch (e: any) {
      toast.error("Неверный JSON для карточек");
    }
  };

  const handleGetProductCardsList = async () => {
    const settings = {
      settings: {
        cursor: { limit: 100 },
        filter: { withPhoto: -1 },
      },
    };
    const res = await getWbProductCardsList(settings);
    setWbApiResult(res);
    if (res?.success) toast.success("Список карточек получен");
    else toast.error(res?.error ?? "Ошибка получения списка карточек");
  };

  // Compare lists (show only mismatches)
  const comparisons = localItems
    .map((local) => {
      const wb = wbStocks.find((w) => w.sku === local.id);
      const ozon = ozonStocks.find((o) => o.sku === local.id);
      const mismatch =
        !wb || !ozon || local.amount !== wb?.amount || local.amount !== ozon?.amount;
      return {
        id: local.id,
        local: local.amount,
        wb: wb?.amount ?? "N/A",
        ozon: ozon?.amount ?? "N/A",
        mismatch,
      };
    })
    .filter((c) => c.mismatch);

  return (
    <div className="container mx-auto p-2 text-sm">
      <h1 className="text-lg font-bold mb-2">Тестовая страница склада</h1>

      <div className="flex flex-wrap gap-2 mb-2">
        <Button
          className="text-xs py-1 px-2"
          onClick={handleFetchWb}
          disabled={loading}
        >
          Загрузить WB
        </Button>
        <Button
          className="text-xs py-1 px-2"
          onClick={handleFetchOzon}
          disabled={loading}
        >
          Загрузить Ozon
        </Button>
        <Button
          className="text-xs py-1 px-2"
          onClick={handleFetchLocal}
          disabled={loading}
        >
          Загрузить локальные
        </Button>
      </div>

      <WarehouseSyncButtons />

      {/* Инструкция по синхронизации */}
      <Card className="mb-4 text-xs">
        <CardHeader className="p-2">
          <CardTitle className="text-sm">Инструкция по устранению расхождений</CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          <p>
            Если в таблице "Сравнение (расхождения)" есть записи, выполните следующие шаги:
          </p>
          <ol className="list-decimal pl-4">
            <li>
              <strong>Проверьте источник правды</strong>: Локальная база Supabase
              считается основным источником данных о запасах.
            </li>
            <li>
              <strong>Обновите локальные данные</strong>: Используйте кнопки "+1"/"-1"
              для корректировки количества в Supabase, если данные неверны.
            </li>
            <li>
              <strong>Синхронизируйте с платформами</strong>: Нажмите соответствующие
              кнопки в компоненте WarehouseSyncButtons, чтобы отправить данные из Supabase на платформы.
            </li>
            <li>
              <strong>Повторно загрузите данные</strong>: Нажмите "Загрузить WB", "Загрузить Ozon" и "Загрузить локальные".
            </li>
            <li>
              <strong>Повторите при необходимости</strong>: Если расхождения остались,
              проверьте логи и SKU.
            </li>
          </ol>
          <p className="mt-2">
            <strong>Примечание</strong>: Всегда обновляйте Supabase перед синхронизацией, чтобы избежать потери данных.
          </p>
        </CardContent>
      </Card>

      {/* WB stocks */}
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

      {/* Ozon stocks */}
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

      {/* Local items */}
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
                    <Button
                      className="text-xs py-0 px-1"
                      onClick={() => handleUpdate(item.id, 1)}
                    >
                      +1
                    </Button>
                    <Button
                      className="text-xs py-0 px-1"
                      onClick={() => handleUpdate(item.id, -1)}
                    >
                      -1
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Comparisons */}
      <Card className="mb-4 text-xs">
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

      {/* WB API Tests */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-sm">WB API Тесты</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div>
              <Button className="w-full text-xs" onClick={handleGetParentCategories}>
                Получить Parent Categories
              </Button>
              <p className="text-xs mt-1 text-muted-foreground">
                Для чего: Получает список родительских категорий товаров на WB.
              </p>
            </div>

            <div>
              <div className="flex gap-2">
                <Input
                  placeholder="Search name (e.g., Постельное белье)"
                  value={searchQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setSearchQuery(e.target.value)
                  }
                  className="text-xs"
                />
                <Input
                  placeholder="Parent ID (e.g., 123)"
                  value={parentID}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setParentID(e.target.value)
                  }
                  className="text-xs"
                />
              </div>
              <Button className="w-full text-xs" onClick={handleGetSubjects}>
                Получить Subjects
              </Button>
            </div>

            <div>
              <Input
                placeholder="Subject ID (e.g., 456)"
                value={subjectId}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setSubjectId(e.target.value)
                }
                className="text-xs"
              />
              <Button className="w-full text-xs" onClick={handleGetSubjectCharcs}>
                Получить Characteristics
              </Button>
            </div>

            <div>
              <Button className="w-full text-xs" onClick={handleGetColors}>
                Получить Colors
              </Button>
            </div>

            <div>
              <Button className="w-full text-xs" onClick={handleGetGenders}>
                Получить Genders
              </Button>
            </div>

            <div>
              <Button className="w-full text-xs" onClick={handleGetCountries}>
                Получить Countries
              </Button>
            </div>

            <div>
              <Button className="w-full text-xs" onClick={handleGetSeasons}>
                Получить Seasons
              </Button>
            </div>

            <div>
              <Button className="w-full text-xs" onClick={handleGetVat}>
                Получить VAT
              </Button>
            </div>

            <div>
              <Button className="w-full text-xs" onClick={handleGetTnved}>
                Получить TNVED
              </Button>
            </div>

            <div>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Count (e.g., 1)"
                  value={String(barcodeCount)}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const v = parseInt(e.target.value, 10);
                    setBarcodeCount(Number.isNaN(v) ? 1 : v);
                  }}
                  className="text-xs"
                />
                <Button className="w-full text-xs" onClick={handleGenerateBarcodes}>
                  Генерировать Barcodes
                </Button>
              </div>
            </div>

            <div>
              <Input
                placeholder="Product Cards JSON (e.g., [{...}])"
                value={productCards}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setProductCards(e.target.value)
                }
                className="text-xs"
              />
              <Button className="w-full text-xs" onClick={handleCreateProductCards}>
                Создать Product Cards
              </Button>
            </div>

            <div>
              <Button className="w-full text-xs" onClick={handleGetProductCardsList}>
                Получить Product Cards List
              </Button>
            </div>
          </div>

          {wbApiResult && (
            <pre className="bg-muted p-2 rounded overflow-auto text-xs max-h-64">
              {JSON.stringify(wbApiResult, null, 2)}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}