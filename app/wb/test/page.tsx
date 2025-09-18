"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { fetchWbStocks, fetchOzonStocks, getWarehouseItems, updateItemLocationQty, syncWbStocks, syncOzonStocks, getWbParentCategories, getWbSubjects, getWbSubjectCharcs, getWbColors, getWbGenders, getWbCountries, getWbSeasons, getWbVat, getWbTnved, generateWbBarcodes, createWbProductCards, getWbProductCardsList } from "@/app/wb/actions";
import { WarehouseSyncButtons } from "@/components/WarehouseSyncButtons";

export default function WarehouseTestPage() {
  const [wbStocks, setWbStocks] = useState<{ sku: string; amount: number }[]>([]);
  const [ozonStocks, setOzonStocks] = useState<{ sku: string; amount: number }[]>([]);
  const [localItems, setLocalItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Состояния для WB API тестов
  const [wbApiResult, setWbApiResult] = useState<any>(null);
  const [subjectId, setSubjectId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [parentID, setParentID] = useState("");
  const [barcodeCount, setBarcodeCount] = useState(1);
  const [productCards, setProductCards] = useState("[]");

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
      handleFetchLocal(); // Refresh local
    } else {
      toast.error(res.error);
    }
  };

  const handleSync = async (platform: 'wb' | 'ozon') => {
    const res = platform === 'wb' ? await syncWbStocks() : await syncOzonStocks();
    if (res.success) {
      toast.success(`${platform.toUpperCase()} синхронизировано!`);
      handleFetchWb();
      handleFetchOzon();
      handleFetchLocal();
    } else {
      toast.error(res.error);
    }
  };

  // Handlers для WB API
  const handleGetParentCategories = async () => {
    const res = await getWbParentCategories();
    setWbApiResult(res);
    toast[res.success ? "success" : "error"](res.success ? "Категории получены" : res.error);
  };

  const handleGetSubjects = async () => {
    const res = await getWbSubjects('ru', searchQuery, 30, 0, parentID ? parseInt(parentID) : undefined);
    setWbApiResult(res);
    toast[res.success ? "success" : "error"](res.success ? "Субъекты получены" : res.error);
  };

  const handleGetSubjectCharcs = async () => {
    if (!subjectId) return toast.error("Введите subjectId");
    const res = await getWbSubjectCharcs(parseInt(subjectId));
    setWbApiResult(res);
    toast[res.success ? "success" : "error"](res.success ? "Характеристики получены" : res.error);
  };

  const handleGetColors = async () => {
    const res = await getWbColors();
    setWbApiResult(res);
    toast[res.success ? "success" : "error"](res.success ? "Цвета получены" : res.error);
  };

  const handleGetGenders = async () => {
    const res = await getWbGenders();
    setWbApiResult(res);
    toast[res.success ? "success" : "error"](res.success ? "Полы получены" : res.error);
  };

  const handleGetCountries = async () => {
    const res = await getWbCountries();
    setWbApiResult(res);
    toast[res.success ? "success" : "error"](res.success ? "Страны получены" : res.error);
  };

  const handleGetSeasons = async () => {
    const res = await getWbSeasons();
    setWbApiResult(res);
    toast[res.success ? "success" : "error"](res.success ? "Сезоны получены" : res.error);
  };

  const handleGetVat = async () => {
    const res = await getWbVat();
    setWbApiResult(res);
    toast[res.success ? "success" : "error"](res.success ? "НДС получен" : res.error);
  };

  const handleGetTnved = async () => {
    if (!subjectId) return toast.error("Введите subjectID");
    const res = await getWbTnved(parseInt(subjectId), searchQuery);
    setWbApiResult(res);
    toast[res.success ? "success" : "error"](res.success ? "ТН ВЭД получены" : res.error);
  };

  const handleGenerateBarcodes = async () => {
    const res = await generateWbBarcodes(barcodeCount);
    setWbApiResult(res);
    toast[res.success ? "success" : "error"](res.success ? "Баркоды сгенерированы" : res.error);
  };

  const handleCreateProductCards = async () => {
    try {
      const cards = JSON.parse(productCards);
      const res = await createWbProductCards(cards);
      setWbApiResult(res);
      toast[res.success ? "success" : "error"](res.success ? "Карточки созданы" : res.error);
    } catch (e) {
      toast.error("Неверный JSON для карточек");
    }
  };

  const handleGetProductCardsList = async () => {
    const settings = {
      settings: {
        cursor: { limit: 100 },
        filter: { withPhoto: -1 }
      }
    };
    const res = await getWbProductCardsList(settings);
    setWbApiResult(res);
    toast[res.success ? "success" : "error"](res.success ? "Список карточек получен" : res.error);
  };

  // Compare lists
  const comparisons = localItems.map(local => {
    const wb = wbStocks.find(w => w.sku === local.id);
    const ozon = ozonStocks.find(o => o.sku === local.id);
    const mismatch = !wb || !ozon || local.amount !== wb?.amount || local.amount !== ozon?.amount;
    return { id: local.id, local: local.amount, wb: wb?.amount || 'N/A', ozon: ozon?.amount || 'N/A', mismatch };
  }).filter(c => c.mismatch);

  return (
    <div className="container mx-auto p-2 text-sm">
      <h1 className="text-lg font-bold mb-2">Тестовая страница склада</h1>

      <div className="flex flex-wrap gap-2 mb-2">
        <Button className="text-xs py-1 px-2" onClick={handleFetchWb} disabled={loading}>Загрузить WB</Button>
        <Button className="text-xs py-1 px-2" onClick={handleFetchOzon} disabled={loading}>Загрузить Ozon</Button>
        <Button className="text-xs py-1 px-2" onClick={handleFetchLocal} disabled={loading}>Загрузить локальные</Button>
      </div>

      <WarehouseSyncButtons />

      {/* Инструкция по синхронизации */}
      <Card className="mb-4 text-xs">
        <CardHeader className="p-2">
          <CardTitle className="text-sm">Инструкция по устранению расхождений</CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          <p>Если в таблице "Сравнение (расхождения)" есть записи, выполните следующие шаги:</p>
          <ol className="list-decimal pl-4">
            <li><strong>Проверьте источник правды</strong>: Локальная база Supabase считается основным источником данных о запасах.</li>
            <li><strong>Обновите локальные данные</strong>: Используйте кнопки "+1"/"-1" для корректировки количества в Supabase, если данные неверны.</li>
            <li><strong>Синхронизируйте с платформами</strong>: Нажмите "Синхронизировать с WB" и "Синхронизировать с Ozon" в компоненте WarehouseSyncButtons, чтобы отправить данные из Supabase на платформы.</li>
            <li><strong>Повторно загрузите данные</strong>: Нажмите "Загрузить WB", "Загрузить Ozon" и "Загрузить локальные" для проверки синхронизации.</li>
            <li><strong>Повторите при необходимости</strong>: Если расхождения остались, проверьте логи (в консоли или через админ-панель) и устраните возможные ошибки (например, неверные SKU).</li>
          </ol>
          <p className="mt-2"><strong>Примечание</strong>: Всегда обновляйте Supabase перед синхронизацией, чтобы избежать потери данных.</p>
        </CardContent>
      </Card>

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

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-sm">WB API Тесты</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div>
              <Button className="w-full text-xs" onClick={handleGetParentCategories}>Получить Parent Categories</Button>
              <p className="text-xs mt-1 text-muted-foreground">
                Для чего: Получает список родительских категорий товаров на WB. Используется для выбора категории при создании карточек товаров.<br />
                Пример: Выводит список категорий, например, `[{ "id": 123, "name": "Одежда" }, { "id": 124, "name": "Обувь" }]`.
              </p>
            </div>
            <div>
              <div className="flex gap-2">
                <Input
                  placeholder="Search name (e.g., Постельное белье)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="text-xs"
                />
                <Input
                  placeholder="Parent ID (e.g., 123)"
                  value={parentID}
                  onChange={(e) => setParentID(e.target.value)}
                  className="text-xs"
                />
              </div>
              <Button className="w-full text-xs" onClick={handleGetSubjects}>Получить Subjects</Button>
              <p className="text-xs mt-1 text-muted-foreground">
                Для чего: Получает список подкатегорий (subjects) для выбранной родительской категории. Используется для уточнения категории товара.<br />
                Пример: Введите `Parent ID: 123` и `Search: Постельное`, получите `[{ "id": 456, "name": "Постельное белье" }, ...]`.
              </p>
            </div>
            <div>
              <Input
                placeholder="Subject ID (e.g., 456)"
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="text-xs"
              />
              <Button className="w-full text-xs" onClick={handleGetSubjectCharcs}>Получить Characteristics</Button>
              <p className="text-xs mt-1 text-muted-foreground">
                Для чего: Получает характеристики для указанного subject ID. Нужны для заполнения карточек товаров.<br />
                Пример: Введите `Subject ID: 456`, получите `[{ "name": "Материал", "type": "string", "required": true }, ...]`.
              </p>
            </div>
            <div>
              <Button className="w-full text-xs" onClick={handleGetColors}>Получить Colors</Button>
              <p className="text-xs mt-1 text-muted-foreground">
                Для чего: Получает список доступных цветов для товаров на WB. Используется для выбора цвета в карточке.<br />
                Пример: Выводит `[{ "id": 1, "name": "Белый" }, { "id": 2, "name": "Черный" }, ...]`.
              </p>
            </div>
            <div>
              <Button className="w-full text-xs" onClick={handleGetGenders}>Получить Genders</Button>
              <p className="text-xs mt-1 text-muted-foreground">
                Для чего: Получает список полов (например, мужской, женский) для товаров. Нужен для товаров с гендерной привязкой.<br />
                Пример: Выводит `[{ "id": 1, "name": "Мужской" }, { "id": 2, "name": "Женский" }, ...]`.
              </p>
            </div>
            <div>
              <Button className="w-full text-xs" onClick={handleGetCountries}>Получить Countries</Button>
              <p className="text-xs mt-1 text-muted-foreground">
                Для чего: Получает список стран производства. Используется для указания страны в карточке товара.<br />
                Пример: Выводит `[{ "id": 1, "name": "Россия" }, { "id": 2, "name": "Китай" }, ...]`.
              </p>
            </div>
            <div>
              <Button className="w-full text-xs" onClick={handleGetSeasons}>Получить Seasons</Button>
              <p className="text-xs mt-1 text-muted-foreground">
                Для чего: Получает список сезонов (например, зима, лето). Используется для сезонных товаров.<br />
                Пример: Выводит `[{ "id": 1, "name": "Зима" }, { "id": 2, "name": "Лето" }, ...]`.
              </p>
            </div>
            <div>
              <Button className="w-full text-xs" onClick={handleGetVat}>Получить VAT</Button>
              <p className="text-xs mt-1 text-muted-foreground">
                Для чего: Получает доступные ставки НДС. Нужны для финансовых настроек карточки товара.<br />
                Пример: Выводит `["0%", "10%", "20%"]`.
              </p>
            </div>
            <div>
              <Button className="w-full text-xs" onClick={handleGetTnved}>Получить TNVED</Button>
              <p className="text-xs mt-1 text-muted-foreground">
                Для чего: Получает коды ТН ВЭД для указанного subject ID. Нужны для таможенной классификации.<br />
                Пример: Введите `Subject ID: 456`, получите `[{ "code": "6302210000", "name": "Постельное белье" }, ...]`.
              </p>
            </div>
            <div>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Count (e.g., 1)"
                  value={barcodeCount}
                  onChange={(e) => setBarcodeCount(parseInt(e.target.value) || 1)}
                  className="text-xs"
                />
                <Button className="w-full text-xs" onClick={handleGenerateBarcodes}>Генерировать Barcodes</Button>
              </div>
              <p className="text-xs mt-1 text-muted-foreground">
                Для чего: Генерирует уникальные штрихкоды для новых карточек товаров.<br />
                Пример: Введите `Count: 2`, получите `["4601234567890", "4601234567891"]`.
              </p>
            </div>
            <div>
              <Input
                placeholder="Product Cards JSON (e.g., [{...}])"
                value={productCards}
                onChange={(e) => setProductCards(e.target.value)}
                className="text-xs"
              />
              <Button className="w-full text-xs" onClick={handleCreateProductCards}>Создать Product Cards</Button>
              <p className="text-xs mt-1 text-muted-foreground">
                Для чего: Создает новые карточки товаров на WB. Требуется JSON с данными карточек.<br />
                Пример: Введите `[{"nmId": 123, "subjectId": 456, "vendorCode": "ABC123", ...}]`, создаст карточку.
              </p>
            </div>
            <div>
              <Button className="w-full text-xs" onClick={handleGetProductCardsList}>Получить Product Cards List</Button>
              <p className="text-xs mt-1 text-muted-foreground">
                Для чего: Получает список существующих карточек товаров на WB с фильтрацией.<br />
                Пример: Выводит `[{ "nmId": 123, "vendorCode": "ABC123", "title": "Постельное белье" }, ...]`.
              </p>
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