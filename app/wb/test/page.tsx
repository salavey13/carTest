"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  extractIdsFromSources,
  getWarehouseSql,
  getOzonProductList,
  fetchWbStocks,
  fetchOzonStocks,
  getWarehouseItems,
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
  getWbWarehouses,
} from "@/app/wb/actions";

import {
  fetchWbCardsWithWarehouseInfo,
  parseWbCardsToMinimal,
  fetchWbStocksForBarcodes,
} from "@/app/wb/test/actions";

import { WarehouseSyncButtons } from "@/components/WarehouseSyncButtons";
import { Clipboard } from "lucide-react";

type ApiRes = any;

export default function WarehouseTestPage(): JSX.Element {
  const [wbCards, setWbCards] = useState<any[]>([]);
  const [ozonProducts, setOzonProducts] = useState<any[]>([]);
  const [supaItems, setSupaItems] = useState<string[]>([]);
  const [unmatchedWb, setUnmatchedWb] = useState<string[]>([]);
  const [unmatchedOzon, setUnmatchedOzon] = useState<string[]>([]);
  const [unmatchedSupa, setUnmatchedSupa] = useState<string[]>([]);
  const [manualMapWb, setManualMapWb] = useState<{ [wb: string]: string }>({});
  const [manualMapOzon, setManualMapOzon] = useState<{ [ozon: string]: string }>({});
  const [sqlScript, setSqlScript] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const [wbApiResult, setWbApiResult] = useState<ApiRes | null>(null);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [subjectId, setSubjectId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [parentID, setParentID] = useState<string>("");
  const [barcodeCount, setBarcodeCount] = useState<number>(1);
  const [productCards, setProductCards] = useState<string>("[]");

  const [warehousesInfoLog, setWarehousesInfoLog] = useState<any>(null);
  const [chosenWarehouseLog, setChosenWarehouseLog] = useState<string | null>(null);

  const handleFetchWbCards = async () => {
    setLoading(true);
    try {
      const res = await fetchWbCardsWithWarehouseInfo();
      if (res?.success) {
        const cards = res.cards || [];
        const minimalMap = res.minimalMap || {};
        const rows = cards.map((c: any) => {
          const vc = (c.vendorCode || "").toLowerCase();
          const mm = minimalMap[vc] || { nmID: c.nmID, barcodes: [], quantity: 0 };
          return {
            vendorCode: c.vendorCode,
            nmID: c.nmID,
            barcodes: mm.barcodes || [],
            quantity: mm.quantity || 0,
          };
        });
        setWbCards(rows);
        setWarehousesInfoLog(res.warehousesInfo || []);
        setChosenWarehouseLog(res.chosenWarehouseId ?? null);
        const totalQty = rows.reduce((sum, r) => sum + r.quantity, 0);
        let msg = `Загружено ${rows.length} карточек WB (склады: ${ (res.warehousesInfo||[]).length }, chosen: ${res.chosenWarehouseId || 'auto'}. Quantities: ${totalQty} total)`;
        if (totalQty === 0) msg += " (возможно, стоки пусты или склад не имеет доступа — проверь logs)";
        toast.success(msg);
      } else {
        toast.error(res?.error ?? "Ошибка при загрузке карточек WB");
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Ошибка запроса");
    } finally {
      setLoading(false);
    }
  };

  const handleFetchOzonProducts = async () => {
    setLoading(true);
    try {
      const res = await getOzonProductList();
      if (res?.success) {
        const stockRes = await fetchOzonStocks();
        const stocksMap = new Map((stockRes.data || []).map(s => [s.sku.toLowerCase(), s.amount]));
        const mapped = res.data.map((p: any) => ({
          offer_id: p.offer_id,
          product_id: p.product_id,
          quantity: stocksMap.get(p.offer_id.toLowerCase()) || 0,
        }));
        setOzonProducts(mapped);
        toast.success(`Загружено ${res.data.length} продуктов Ozon (total qty: ${mapped.reduce((sum, p) => sum + p.quantity, 0)})`);
      } else {
        toast.warn(res?.error ?? "No Ozon keys, skipping");
        setOzonProducts([]);
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Ошибка запроса");
    } finally {
      setLoading(false);
    }
  };

  const handleFetchSupaItems = async () => {
    setLoading(true);
    try {
      const res = await getWarehouseItems();
      if (res?.success) {
        setSupaItems(res.data.map((i: any) => i.id));
        toast.success(`Загружено ${res.data.length} items из Supabase`);
      } else {
        toast.error(res?.error ?? "Ошибка");
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  const handleExtractIds = async () => {
    setLoading(true);
    try {
      const res = await extractIdsFromSources();
      if (res?.success) {
        setUnmatchedWb(res.unmatched.wb);
        setUnmatchedOzon(res.unmatched.ozon);
        setUnmatchedSupa(res.unmatched.supa);
        toast.success("IDs извлечены и unmatched выделены");
      } else {
        toast.error(res?.error ?? "Ошибка");
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateManualMap = (type: 'wb' | 'ozon', key: string, value: string) => {
    if (type === 'wb') {
      const newMap = { ...manualMapWb };
      if (value === "fallback") {
        delete newMap[key];
      } else {
        newMap[key] = value;
      }
      setManualMapWb(newMap);
    } else {
      const newMap = { ...manualMapOzon };
      if (value === "fallback") {
        delete newMap[key];
      } else {
        newMap[key] = value;
      }
      setManualMapOzon(newMap);
    }
  };

  const handleGenerateSql = async () => {
    setLoading(true);
    try {
      const res = await getWarehouseSql({ wb: manualMapWb, ozon: manualMapOzon });
      if (res?.success && res.sql) {
        setSqlScript(res.sql);
        toast.success("SQL сгенерирован с учётом manual matches");
      } else {
        toast.error(res?.error ?? "Ошибка генерации SQL");
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlScript);
    toast.success("SQL скопирован в буфер");
  };

  const handleGetParentCategories = async () => {
    const res = await getWbParentCategories();
    setWbApiResult(res);
    if (res?.success) toast.success("Категории получены");
    else toast.error(res?.error ?? "Ошибка");
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
    else toast.error(res?.error ?? "Ошибка");
  };

  const handleGetSubjectCharcs = async () => {
    if (!subjectId) {
      toast.error("Введите subjectId");
      return;
    }
    const res = await getWbSubjectCharcs(parseInt(subjectId, 10));
    setWbApiResult(res);
    if (res?.success) toast.success("Характеристики получены");
    else toast.error(res?.error ?? "Ошибка");
  };

  const handleGetColors = async () => {
    const res = await getWbColors();
    setWbApiResult(res);
    if (res?.success) toast.success("Цвета получены");
    else toast.error(res?.error ?? "Ошибка");
  };

  const handleGetGenders = async () => {
    const res = await getWbGenders();
    setWbApiResult(res);
    if (res?.success) toast.success("Полы получены");
    else toast.error(res?.error ?? "Ошибка");
  };

  const handleGetCountries = async () => {
    const res = await getWbCountries();
    setWbApiResult(res);
    if (res?.success) toast.success("Страны получены");
    else toast.error(res?.error ?? "Ошибка");
  };

  const handleGetSeasons = async () => {
    const res = await getWbSeasons();
    setWbApiResult(res);
    if (res?.success) toast.success("Сезоны получены");
    else toast.error(res?.error ?? "Ошибка");
  };

  const handleGetVat = async () => {
    const res = await getWbVat();
    setWbApiResult(res);
    if (res?.success) toast.success("НДС получен");
    else toast.error(res?.error ?? "Ошибка");
  };

  const handleGetTnved = async () => {
    if (!subjectId) {
      toast.error("Введите subjectID");
      return;
    }
    const res = await getWbTnved(parseInt(subjectId, 10), searchQuery);
    setWbApiResult(res);
    if (res?.success) toast.success("ТН ВЭД получены");
    else toast.error(res?.error ?? "Ошибка");
  };

  const handleGenerateBarcodes = async () => {
    const res = await generateWbBarcodes(barcodeCount);
    setWbApiResult(res);
    if (res?.success) toast.success("Баркоды сгенерированы");
    else toast.error(res?.error ?? "Ошибка");
  };

  const handleCreateProductCards = async () => {
    try {
      const cards = JSON.parse(productCards);
      const res = await createWbProductCards(cards);
      setWbApiResult(res);
      if (res?.success) toast.success("Карточки созданы");
      else toast.error(res?.error ?? "Ошибка");
    } catch (e: any) {
      toast.error("Неверный JSON");
    }
  };

  const handleGetWarehouses = async () => {
    const res = await getWbWarehouses();
    setWbApiResult(res);
    if (res?.success && Array.isArray(res.data)) {
      setWarehouses(res.data);
      toast.success(`Найдено ${res.data.length} склад(ов)`);
    } else {
      toast.error(res?.error ?? "Ошибка");
    }
  };

  return (
    <div className="container mx-auto p-2 text-sm">
      <h1 className="text-lg font-bold mb-2">Тест склада: Экстракция, Матчинг & Update</h1>

      <WarehouseSyncButtons />

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-sm">Инструкции по Матчингу & SQL</CardTitle>
        </CardHeader>
        <CardContent className="text-xs space-y-2">
          <p>0. Setup ENV: Убедись в .env WB_CONTENT_TOKEN, WB_API_TOKEN для WB; OZON_CLIENT_ID, OZON_API_KEY для Ozon. Warehouse IDs optional — auto first active. </p>
          <p>1. Fetch WB Cards — полная пагинация, vendorCode/nmID/barcodes/quantity (multi-warehouse logic for stocks).</p>
          <p>2. Fetch Ozon Products — offer_id/product_id/quantity. Skip if no keys — toast warn.</p>
          <p>3. Fetch Supa Items — id из wb_item. Must for matching.</p>
          <p>4. Extract & Match IDs — auto-match по lower, show unmatched tables. Select to manual match.</p>
          <p>5. Generate SQL — UPDATE specs с sku/quantity/wh. Skipped unmatched with comment. Copy & run in Supabase.</p>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-sm">Экстракция & Матчинг (тест)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <Button size="sm" onClick={handleFetchWbCards} disabled={loading}>Fetch WB Cards (enhanced)</Button>
            <Button size="sm" onClick={handleFetchOzonProducts} disabled={loading}>Fetch Ozon Products</Button>
            <Button size="sm" onClick={handleFetchSupaItems} disabled={loading}>Fetch Supa Items</Button>
          </div>

          {wbCards.length > 0 && (
            <div>
              <h3 className="text-xs font-bold">WB Cards ({wbCards.length})</h3>
              <Table className="text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead>VendorCode</TableHead>
                    <TableHead>nmID</TableHead>
                    <TableHead>Barcodes</TableHead>
                    <TableHead>Qty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {wbCards.map((c, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{c.vendorCode}</TableCell>
                      <TableCell>{c.nmID}</TableCell>
                      <TableCell>{c.barcodes.join(', ')}</TableCell>
                      <TableCell>{c.quantity}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {ozonProducts.length > 0 && (
            <div>
              <h3 className="text-xs font-bold">Ozon Products ({ozonProducts.length})</h3>
              <Table className="text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead>Offer ID</TableHead>
                    <TableHead>Product ID</TableHead>
                    <TableHead>Qty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ozonProducts.map((p, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{p.offer_id}</TableCell>
                      <TableCell>{p.product_id}</TableCell>
                      <TableCell>{p.quantity}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <Button size="sm" className="w-full" onClick={handleExtractIds} disabled={loading || supaItems.length === 0}>
            Extract & Match IDs
          </Button>

          {unmatchedWb.length > 0 && (
            <div>
              <h3 className="text-xs font-bold">Unmatched WB ({unmatchedWb.length})</h3>
              <Table className="text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead>WB VendorCode</TableHead>
                    <TableHead>Match to Supa ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unmatchedWb.map((wbId) => (
                    <TableRow key={wbId}>
                      <TableCell>{wbId}</TableCell>
                      <TableCell>
                        <Select value={manualMapWb[wbId] || "fallback"} onValueChange={(v) => handleUpdateManualMap('wb', wbId, v)}>
                          <SelectTrigger className="text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fallback">Fallback to ID</SelectItem>
                            {supaItems.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {unmatchedOzon.length > 0 && (
            <div>
              <h3 className="text-xs font-bold">Unmatched Ozon ({unmatchedOzon.length})</h3>
              <Table className="text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead>Ozon Offer ID</TableHead>
                    <TableHead>Match to Supa ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unmatchedOzon.map((ozonId) => (
                    <TableRow key={ozonId}>
                      <TableCell>{ozonId}</TableCell>
                      <TableCell>
                        <Select value={manualMapOzon[ozonId] || "fallback"} onValueChange={(v) => handleUpdateManualMap('ozon', ozonId, v)}>
                          <SelectTrigger className="text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fallback">Fallback to ID</SelectItem>
                            {supaItems.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {unmatchedSupa.length > 0 && (
            <div>
              <h3 className="text-xs font-bold">Unmatched Supa ({unmatchedSupa.length})</h3>
              <ul className="text-xs">
                {unmatchedSupa.map((s) => <li key={s}>{s} (no WB/Ozon match)</li>)}
              </ul>
            </div>
          )}

          <Button size="sm" className="w-full" onClick={handleGenerateSql} disabled={loading}>
            Generate SQL
          </Button>
          {sqlScript && (
            <>
              <textarea className="w-full h-32 p-2 border rounded text-xs" value={sqlScript} readOnly />
              <Button size="sm" className="w-full mt-2" onClick={handleCopySql}>
                <Clipboard className="mr-2 h-3 w-3" /> Copy SQL
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-sm">Warehouse detection log (test)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xs mb-2">
            <strong>Chosen Warehouse:</strong> {chosenWarehouseLog ?? "N/A"}
          </div>
          <div className="text-xs">
            <strong>Warehouses Info:</strong>
            <pre className="bg-muted p-2 rounded text-xs max-h-48 overflow-auto">
              {JSON.stringify(warehousesInfoLog, null, 2)}
            </pre>
          </div>
        </CardContent>
      </Card>

      <Accordion type="single" collapsible>
        <AccordionItem value="other">
          <AccordionTrigger className="text-sm">Другие WB API</AccordionTrigger>
          <AccordionContent className="space-y-2">
            <Button size="sm" className="w-full text-xs" onClick={handleGetParentCategories}>
              Parent Categories
            </Button>
            <div className="flex gap-2">
              <Input placeholder="Search name" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="text-xs" />
              <Input placeholder="Parent ID" value={parentID} onChange={(e) => setParentID(e.target.value)} className="text-xs" />
            </div>
            <Button size="sm" className="w-full text-xs" onClick={handleGetSubjects}>
              Subjects
            </Button>
            <Input placeholder="Subject ID" value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="text-xs" />
            <Button size="sm" className="w-full text-xs" onClick={handleGetSubjectCharcs}>
              Characteristics
            </Button>
            <Button size="sm" className="w-full text-xs" onClick={handleGetColors}>
              Colors
            </Button>
            <Button size="sm" className="w-full text-xs" onClick={handleGetGenders}>
              Genders
            </Button>
            <Button size="sm" className="w-full text-xs" onClick={handleGetCountries}>
              Countries
            </Button>
            <Button size="sm" className="w-full text-xs" onClick={handleGetSeasons}>
              Seasons
            </Button>
            <Button size="sm" className="w-full text-xs" onClick={handleGetVat}>
              VAT
            </Button>
            <Button size="sm" className="w-full text-xs" onClick={handleGetTnved}>
              TNVED
            </Button>
            <Input type="number" placeholder="Barcode Count" value={barcodeCount} onChange={(e) => setBarcodeCount(parseInt(e.target.value) || 1)} className="text-xs" />
            <Button size="sm" className="w-full text-xs" onClick={handleGenerateBarcodes}>
              Generate Barcodes
            </Button>
            <Input placeholder="Product Cards JSON" value={productCards} onChange={(e) => setProductCards(e.target.value)} className="text-xs" />
            <Button size="sm" className="w-full text-xs" onClick={handleCreateProductCards}>
              Create Product Cards
            </Button>
            <Button size="sm" className="w-full text-xs" onClick={handleGetWarehouses}>
              Warehouses
            </Button>
            <pre className="bg-muted p-2 rounded text-xs max-h-64 overflow-auto">
              {JSON.stringify(wbApiResult, null, 2)}
            </pre>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}