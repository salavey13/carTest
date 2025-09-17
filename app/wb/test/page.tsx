"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { fetchWbStocks, fetchOzonStocks, getWarehouseItems, updateItemLocationQty } from "@/app/wb/actions";
import { useWarehouse } from "@/hooks/useWarehouse";  // Assuming this hook exists for modes

export default function WarehouseTestPage() {
  const [wbStocks, setWbStocks] = useState<{ sku: string; amount: number }[]>([]);
  const [ozonStocks, setOzonStocks] = useState<{ sku: string; amount: number }[]>([]);
  const [localItems, setLocalItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const { gameMode } = useWarehouse();  // To get current mode for updates

  const handleFetchWb = async () => {
    setLoading(true);
    const res = await fetchWbStocks();
    setLoading(false);
    if (res.success && res.data) {
      setWbStocks(res.data);
      toast.success(`Fetched ${res.data.length} items from WB`);
    } else {
      toast.error(res.error || "Error fetching WB stocks");
    }
  };

  const handleFetchOzon = async () => {
    setLoading(true);
    const res = await fetchOzonStocks();
    setLoading(false);
    if (res.success && res.data) {
      setOzonStocks(res.data);
      toast.success(`Fetched ${res.data.length} items from Ozon`);
    } else {
      toast.error(res.error || "Error fetching Ozon stocks");
    }
  };

  const handleFetchLocal = async () => {
    setLoading(true);
    const res = await getWarehouseItems();
    setLoading(false);
    if (res.success && res.data) {
      setLocalItems(res.data);
      toast.success(`Fetched ${res.data.length} local items`);
    } else {
      toast.error(res.error || "Error fetching local items");
    }
  };

  const handleItemClick = async (itemId: string, voxelId: string = "A1") => {  // Default voxel
    if (!gameMode) {
      toast.info("Select onload or offload mode to update");
      return;
    }
    const delta = gameMode === "onload" ? 1 : -1;
    const res = await updateItemLocationQty(itemId, voxelId, delta);
    if (res.success) {
      toast.success(`Updated ${itemId} by ${delta}`);
      // Refresh local if needed
      handleFetchLocal();
    } else {
      toast.error(res.error);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Warehouse Test Page</h1>
      
      <div className="flex gap-4 mb-4">
        <Button onClick={handleFetchWb} disabled={loading}>Fetch WB Stocks</Button>
        <Button onClick={handleFetchOzon} disabled={loading}>Fetch Ozon Stocks</Button>
        <Button onClick={handleFetchLocal} disabled={loading}>Fetch Local Items</Button>
      </div>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>WB Stocks</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {wbStocks.map((stock) => (
                <TableRow key={stock.sku}>
                  <TableCell>{stock.sku}</TableCell>
                  <TableCell>{stock.amount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Ozon Stocks</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ozonStocks.map((stock) => (
                <TableRow key={stock.sku}>
                  <TableCell>{stock.sku}</TableCell>
                  <TableCell>{stock.amount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Local Items (Supabase) - Click to Update in Mode</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Total Quantity</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {localItems.map((item) => (
                <TableRow key={item.id} onClick={() => setSelectedItemId(item.id)}>
                  <TableCell>{item.id}</TableCell>
                  <TableCell>{item.specs?.warehouse_locations?.reduce((sum: number, loc: any) => sum + loc.quantity, 0) || 0}</TableCell>
                  <TableCell>
                    <Button onClick={() => handleItemClick(item.id)} disabled={!gameMode}>
                      Update ({gameMode || "No Mode"})
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}